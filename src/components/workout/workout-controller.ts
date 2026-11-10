"use client";

import { AudioCues } from "@/lib/audio/audio-cues";
import { toCheckpoint } from "@/lib/engine/checkpoint";
import {
  activeSeconds,
  pickCue,
  reduce,
  type EngineAction,
  type EngineEffect,
  type EngineExercise,
  type EngineState,
} from "@/lib/engine/workout-engine";
import {
  completeWorkout,
  markWorkoutBegun,
  recordSet,
  skipExercise,
  stopWorkout,
  type ActionResult,
} from "@/server/actions/workout";

/**
 * Owns the single source of truth for a running workout:
 *  - the engine state (pure reducer in src/lib/engine),
 *  - ONE interval that sends `tick` (time always comes from Date.now()),
 *  - a sequential persistence queue (sets, skips, checkpoints) with retry,
 *  - audio cues.
 * React subscribes with useSyncExternalStore; it never owns timer state.
 */

export type SaveStatus = "saved" | "saving" | "retrying" | "conflict" | "ended";

export type Snapshot = {
  state: EngineState;
  now: number;
  saveStatus: SaveStatus;
};

type Job = { kind: "checkpoint" } | { kind: "call"; label: string; run: () => Promise<ActionResult> };

const TICK_MS = 250;
const PERIODIC_CHECKPOINT_MS = 15_000;
const CHECKPOINT_DEBOUNCE_MS = 600;

export class WorkoutController {
  private state: EngineState;
  private snapshot: Snapshot;
  private listeners = new Set<() => void>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private queue: Job[] = [];
  private processing = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private checkpointTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCheckpointAt = 0;
  private saveStatus: SaveStatus = "saved";
  private revision: number;
  private readonly original: EngineExercise[];
  readonly audio: AudioCues;
  private onFinished: (() => void) | null = null;

  /** When the workout was begun: performed_at (restored) or the moment Begin is pressed. */
  private startedAt: number;

  constructor(
    private readonly sessionId: string,
    performedAt: number | null,
    initial: EngineState,
    revision: number,
    sound: { enabled: boolean; volume: number },
  ) {
    this.startedAt = performedAt ?? Date.now();
    this.state = initial;
    this.original = initial.exercises;
    this.revision = revision;
    this.audio = new AudioCues(sound.enabled, sound.volume);
    this.snapshot = { state: initial, now: Date.now(), saveStatus: "saved" };
  }

  // -- store -----------------------------------------------------------------
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.snapshot;

  private emit() {
    this.snapshot = { state: this.state, now: Date.now(), saveStatus: this.saveStatus };
    for (const l of this.listeners) l();
  }

  // -- lifecycle ----------------------------------------------------------------
  /** Called once every result of the finished workout has been saved. */
  setOnFinished(callback: () => void) {
    this.onFinished = callback;
  }

  start() {
    if (this.interval !== null) return; // never two intervals
    this.interval = setInterval(() => this.dispatch({ type: "tick" }), TICK_MS);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.onPageHide);
    window.addEventListener("online", this.onOnline);
  }

  stop() {
    if (this.interval !== null) clearInterval(this.interval);
    this.interval = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.checkpointTimer) clearTimeout(this.checkpointTimer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.onPageHide);
    window.removeEventListener("online", this.onOnline);
  }

  private onVisibility = () => {
    if (document.visibilityState === "hidden") this.sendCheckpointKeepalive();
    else this.dispatch({ type: "tick" });
  };
  private onPageHide = () => this.sendCheckpointKeepalive();
  private onOnline = () => this.process();

  // -- actions -------------------------------------------------------------------
  dispatch(action: EngineAction) {
    if (this.saveStatus === "conflict" || this.saveStatus === "ended") return;
    const now = Date.now();
    const { state, effects } = reduce(this.state, action, now);
    const changed = state !== this.state;
    this.state = state;
    this.handle(effects);
    if (
      action.type === "tick" &&
      this.isRunning() &&
      now - this.lastCheckpointAt > PERIODIC_CHECKPOINT_MS
    ) {
      this.enqueueCheckpoint();
    }
    if (changed || action.type === "tick") this.emit();
  }

  private isRunning() {
    const p = this.state.phase;
    return !this.state.paused && (p === "prepare" || p === "work" || p === "rest");
  }

  activeSeconds(now = Date.now()) {
    return activeSeconds(this.state, this.startedAt, now);
  }

  private handle(effects: EngineEffect[]) {
    let checkpoint = false;
    const cue = pickCue(effects); // one sound per step; ticks are idempotent, so no repeats
    if (cue) this.audio.play(cue);
    for (const e of effects) {
      switch (e.type) {
        case "sound":
          break;
        case "began":
          this.startedAt = Date.now();
          this.enqueue("begin", () => markWorkoutBegun(this.sessionId));
          break;
        case "record_set": {
          const result = e.result;
          this.enqueue("set", () => recordSet(this.sessionId, result));
          break;
        }
        case "skip_exercise": {
          const order = e.exerciseOrder;
          this.enqueue("skip", () => skipExercise(this.sessionId, order));
          break;
        }
        case "checkpoint":
          checkpoint = true;
          break;
        case "finished":
          this.enqueueCheckpointNow();
          this.enqueue("complete", () => completeWorkout(this.sessionId, this.activeSeconds()));
          this.whenIdle(() => this.onFinished?.());
          break;
      }
    }
    if (checkpoint) this.scheduleCheckpoint();
  }

  /** User confirmed Stop: save everything, then end without completing. */
  async stopWorkout(): Promise<void> {
    this.dispatch({ type: "pause" });
    if (this.interval !== null) clearInterval(this.interval);
    this.interval = null;
    this.enqueueCheckpointNow();
    const seconds = this.activeSeconds();
    this.enqueue("stop", () => stopWorkout(this.sessionId, seconds));
    await new Promise<void>((resolve) => this.whenIdle(resolve));
  }

  setSound(enabled: boolean, volume: number) {
    this.audio.set(enabled, volume);
  }

  // -- persistence queue -------------------------------------------------------
  private enqueue(label: string, run: () => Promise<ActionResult>) {
    this.queue.push({ kind: "call", label, run });
    this.process();
  }

  private scheduleCheckpoint() {
    if (this.checkpointTimer) return;
    this.checkpointTimer = setTimeout(() => {
      this.checkpointTimer = null;
      this.enqueueCheckpoint();
    }, CHECKPOINT_DEBOUNCE_MS);
  }

  private enqueueCheckpointNow() {
    if (this.checkpointTimer) clearTimeout(this.checkpointTimer);
    this.checkpointTimer = null;
    this.enqueueCheckpoint();
  }

  private enqueueCheckpoint() {
    this.lastCheckpointAt = Date.now();
    // Coalesce: one pending checkpoint is enough (it always saves the latest state).
    if (!this.queue.some((j) => j.kind === "checkpoint")) this.queue.push({ kind: "checkpoint" });
    this.process();
  }

  private idleCallbacks: (() => void)[] = [];
  private whenIdle(cb: () => void) {
    this.idleCallbacks.push(cb);
    this.process();
  }

  private async process() {
    if (this.processing) return;
    if (this.queue.length === 0) {
      if (this.saveStatus === "saving" || this.saveStatus === "retrying") {
        this.saveStatus = "saved";
        this.emit();
      }
      const callbacks = this.idleCallbacks.splice(0);
      callbacks.forEach((cb) => cb());
      return;
    }
    this.processing = true;
    if (this.saveStatus === "saved") {
      this.saveStatus = "saving";
      this.emit();
    }

    const job = this.queue[0];
    let outcome: "ok" | "retry" | "stop";
    try {
      outcome = job.kind === "checkpoint" ? await this.saveCheckpoint() : this.outcomeOf(await job.run());
    } catch {
      outcome = "retry"; // network error / server unreachable
    }
    this.processing = false;

    if (outcome === "ok") {
      this.queue.shift();
      this.process();
    } else if (outcome === "retry") {
      this.saveStatus = navigator.onLine ? "retrying" : "retrying";
      this.emit();
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.process(), 4_000);
    } else {
      // Session ended elsewhere or conflict: stop writing.
      this.queue = [];
      this.stop();
      this.emit();
      this.idleCallbacks.splice(0).forEach((cb) => cb());
    }
  }

  private outcomeOf(result: ActionResult): "ok" | "retry" | "stop" {
    if (result.ok) return "ok";
    if (result.error === "Workout is not active.") {
      this.saveStatus = "ended";
      return "stop";
    }
    // Validation errors would never succeed on retry; drop that job.
    return "ok";
  }

  private body() {
    return JSON.stringify({
      sessionId: this.sessionId,
      revision: this.revision,
      checkpoint: toCheckpoint(this.state, this.original),
    });
  }

  private async saveCheckpoint(): Promise<"ok" | "retry" | "stop"> {
    const res = await fetch("/api/workout/checkpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: this.body(),
    });
    if (res.ok) {
      const json = (await res.json()) as { revision: number };
      this.revision = json.revision;
      return "ok";
    }
    if (res.status === 409) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      this.saveStatus = json.error === "conflict" ? "conflict" : "ended";
      return "stop";
    }
    if (res.status === 400) return "ok"; // invalid payload: never retry
    return "retry";
  }

  /** Best-effort save while the tab is hidden/closing (survives unload). */
  private sendCheckpointKeepalive() {
    if (this.saveStatus === "conflict" || this.saveStatus === "ended") return;
    if (this.state.phase === "intro" || this.state.phase === "complete") return;
    if (this.processing) return; // a save is already in flight with the same revision
    fetch("/api/workout/checkpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: this.body(),
      keepalive: true,
    })
      .then(async (res) => {
        if (res.ok) this.revision = ((await res.json()) as { revision: number }).revision;
      })
      .catch(() => {});
  }
}
