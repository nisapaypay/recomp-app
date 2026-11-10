"use client";

import {
  Check,
  ChevronsRight,
  CloudOff,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Square,
  Undo2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ExerciseIllustration } from "@/components/program/exercise-illustration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MuscleLegend } from "@/components/exercise/figure-svg";
import { ExerciseAnimation, hasExerciseAnimation } from "./exercise-animation";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  currentExercise,
  remainingMs,
  restKind,
  secondSide,
  tempoPositionAt,
  tempoSequence,
  workoutProgress,
  type EngineState,
  type Side,
  type TempoPhaseName,
} from "@/lib/engine/workout-engine";
import { formatTempo, humanize } from "@/lib/program/format";
import { cn } from "@/lib/utils/cn";
import type { SessionExercise } from "@/server/workout/queries";
import { SoundControls } from "./sound-controls";
import { TempoAdjust } from "./tempo-adjust";
import { WorkoutController, type SaveStatus } from "./workout-controller";

const SIDE_LABEL: Record<Side, string> = { left: "Left", right: "Right", forward: "Forward", backward: "Backward" };

const TEMPO_LABEL: Record<TempoPhaseName, { title: string; hint: string }> = {
  eccentric: { title: "Eccentric", hint: "Slow and controlled" },
  hold: { title: "Hold", hint: "Pause and stay steady" },
  concentric: { title: "Concentric", hint: "Push or pull with control" },
};

export function WorkoutPlayer({
  sessionId,
  performedAt,
  exercises,
  initialState,
  revision,
  sound,
}: {
  sessionId: string;
  performedAt: number | null;
  exercises: SessionExercise[];
  initialState: EngineState;
  revision: number;
  sound: { enabled: boolean; volume: number };
}) {
  const router = useRouter();
  const [controller] = useState(() => new WorkoutController(sessionId, performedAt, initialState, revision, sound));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const { state, now, saveStatus } = snapshot;
  const [confirm, setConfirm] = useState<"stop" | "skip" | null>(null);
  const [stopping, setStopping] = useState(false);

  // One controller, one interval — started/stopped with the component.
  useEffect(() => {
    controller.setOnFinished(() => router.replace(`/workout/session/${sessionId}/summary`));
    controller.start();
    return () => controller.stop();
  }, [controller, router, sessionId]);

  useWakeLock(state.phase !== "intro" && state.phase !== "complete" && !state.paused);

  // A new workout begins as soon as the player opens: preview of exercise 1 +
  // the single 10 s preparation countdown. (Begin is ignored once started.)
  useEffect(() => {
    if (state.phase !== "intro") return;
    controller.audio.unlock(); // allowed: the user just tapped Start Workout
    controller.dispatch({ type: "begin" });
  }, [controller, state.phase]);

  // Some browsers (Safari) need a gesture on this page before sounds play.
  useEffect(() => {
    const unlock = () => controller.audio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [controller]);

  const dispatch = controller.dispatch.bind(controller);
  const ex = currentExercise(state);
  const details = exercises.find((e) => e.order === ex?.order) ?? exercises[0];
  const progress = workoutProgress(state);

  // Keyboard: Space = main action, P = pause / resume.
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (state.paused) return;
        if (state.phase === "work" && ex?.measureType === "reps") dispatch({ type: "rep_done" });
        else if (state.phase === "prepare") dispatch({ type: "skip_prepare" });
      } else if (e.key === "p" || e.key === "P") {
        dispatch({ type: state.paused ? "resume" : "pause" });
      }
    },
    [dispatch, ex?.measureType, state.paused, state.phase],
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  async function confirmStop() {
    setStopping(true);
    await controller.stopWorkout();
    router.replace(`/workout/session/${sessionId}/summary`);
  }

  if (saveStatus === "conflict" || saveStatus === "ended") {
    return (
      <div className="m-auto max-w-md space-y-4 text-center">
        <h1 className="text-title">{saveStatus === "conflict" ? "Continued on another device" : "This workout has ended"}</h1>
        <p className="text-ink-muted">
          {saveStatus === "conflict"
            ? "This workout was continued somewhere else, so this screen stopped saving to avoid overwriting it."
            : "This workout was finished or ended elsewhere."}
        </p>
        <Button onClick={() => router.refresh()} variant="secondary">
          <RotateCcw aria-hidden className="size-4.5" />
          Reload
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-muted">
            {state.phase === "intro"
              ? `${exercises.length} exercises`
              : `Exercise ${Math.min(state.exerciseIndex + 1, exercises.length)} of ${exercises.length}`}
            <span className="ml-2 tabular-nums">· {progress.done}/{progress.total} sets</span>
          </p>
          <ProgressBar label="Workout progress" value={progress.done} max={progress.total} className="mt-2 max-w-xl" />
        </div>
        <SaveIndicator status={saveStatus} />
        <SoundControls
          compact
          initialEnabled={sound.enabled}
          initialVolume={sound.volume}
          onChange={(enabled, volume) => controller.setSound(enabled, volume)}
        />
        {state.phase !== "intro" && state.phase !== "complete" ? (
          <Button variant="secondary" onClick={() => setConfirm("stop")} aria-label="Stop workout">
            <Square aria-hidden className="size-4" />
            <span className="hidden sm:inline">Stop</span>
          </Button>
        ) : null}
      </header>

      {state.phase === "intro" ? (
        <p className="m-auto text-ink-muted" role="status">
          Starting your workout…
        </p>
      ) : state.phase === "complete" ? (
        <div className="m-auto text-center" role="status">
          <Check aria-hidden className="mx-auto size-14 text-success" />
          <h1 className="mt-3 text-title md:text-display">Workout complete</h1>
          <p className="mt-2 text-ink-muted">Saving your results…</p>
        </div>
      ) : (
        <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)] lg:gap-8">
          {/* Stage: first on mobile */}
          <section aria-label="Current step" className="order-1 lg:order-2">
            <Stage
              state={state}
              now={now}
              exerciseId={details?.exerciseId}
              muscles={details?.targetMuscles ?? []}
              onAction={dispatch}
              onSkipExercise={() => setConfirm("skip")}
            />
          </section>

          {/* Exercise info */}
          <aside className="order-2 space-y-4 lg:order-1">
            <div>
              <p className="text-overline uppercase text-accent-600">{asideLabel(state)}</p>
              <h1 className="mt-1 text-title md:text-display">{details?.name}</h1>
              {details ? (
                <p className="mt-1 text-[0.9375rem] text-ink-soft">
                  {details.sets} × {details.target}
                  {details.measureType === "seconds" ? " s hold" : " reps"}
                  {details.sideMode === "per_side" ? " per side" : details.sideMode === "per_direction" ? " each direction" : ""}
                  {details.tempo && details.measureType === "reps" ? ` · Tempo ${formatTempo(details.tempo)}` : ""}
                  {` · Rest ${details.restSeconds} s`}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {details?.targetMuscles.map((m) => (
                  <Badge key={m} tone="accent">
                    {humanize(m)}
                  </Badge>
                ))}
              </div>
            </div>
            {/* The animated figure is in the stage; the static illustration only for exercises without one. */}
            {hasExerciseAnimation(details?.exerciseId) ? null : (
              <ExerciseIllustration name={details?.name ?? ""} path={details?.illustrationPath ?? null} className="max-h-72" />
            )}
            {details && details.executionSteps.length > 0 ? (
              <details className="group rounded-card border border-line bg-surface p-4" open>
                <summary className="cursor-pointer list-none text-sm font-semibold text-ink">How to do it</summary>
                {details.startingPosition ? (
                  <p className="mt-2 text-[0.9375rem] text-ink-soft">{details.startingPosition}</p>
                ) : null}
                <ol className="mt-3 space-y-2">
                  {details.executionSteps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-[0.9375rem] text-ink-soft">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-100 text-caption font-semibold text-accent-700">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                {details.breathing ? <p className="mt-3 text-sm text-ink-muted">{details.breathing}</p> : null}
              </details>
            ) : null}
            {ex?.tempo && ex.measureType === "reps" ? (
              <TempoAdjust tempo={ex.tempo} onApply={(tempo) => dispatch({ type: "set_tempo", tempo })} />
            ) : null}
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={confirm === "stop"}
        title="Stop this workout?"
        confirmLabel={stopping ? "Saving…" : "Stop workout"}
        tone="danger"
        busy={stopping}
        onConfirm={confirmStop}
        onCancel={() => setConfirm(null)}
      >
        Sets you finished are saved. The workout will be recorded as stopped, not completed.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "skip"}
        title={`Skip ${details?.name ?? "this exercise"}?`}
        confirmLabel="Skip exercise"
        onConfirm={() => {
          dispatch({ type: "skip_exercise" });
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      >
        Remaining sets are recorded as skipped. Sets you already finished stay saved.
      </ConfirmDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Stage({
  state,
  now,
  exerciseId,
  muscles,
  onAction,
  onSkipExercise,
}: {
  state: EngineState;
  now: number;
  exerciseId: string | undefined;
  muscles: readonly string[];
  onAction: WorkoutController["dispatch"];
  onSkipExercise: () => void;
}) {
  const [enlarged, setEnlarged] = useState(false);
  useEffect(() => {
    if (!enlarged) return;
    // Esc leaves full screen (unless a confirmation dialog is open on top of it).
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) setEnlarged(false);
    };
    window.addEventListener("keydown", close);
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", close);
      document.documentElement.style.overflow = overflow;
    };
  }, [enlarged]);
  const ex = currentExercise(state);
  if (!ex) return null;
  const rem = remainingMs(state, now);
  const seconds = rem === null ? null : Math.ceil(rem / 1000);
  const at = state.paused && state.pausedAt !== null ? state.pausedAt : now;
  const tempoPos =
    state.phase === "work" && ex.measureType === "reps"
      ? tempoPositionAt(ex.tempo, ex.tempoStart, state.tempoAnchorAt, at)
      : null;

  const setLine = `Set ${Math.min(state.setNumber, ex.sets)} of ${ex.sets}`;
  const target = ex.measureType === "seconds" ? `${ex.target} s hold` : `${ex.target} reps`;

  let label: string;
  let sub: string;
  if (state.paused) {
    label = "Paused";
    sub =
      state.pauseReason === "suspended"
        ? "Paused automatically because your device went to sleep."
        : state.pauseReason === "recovered"
          ? "Welcome back. Resume when you're in position."
          : "Take your time.";
  } else if (state.phase === "prepare") {
    label = "Get ready";
    sub = `First up: ${ex.name} · ${setLine}${state.side ? ` · ${SIDE_LABEL[state.side]}` : ""} · ${target}`;
  } else if (state.phase === "rest" && restKind(state) === "transition") {
    label = "Rest · next exercise";
    sub = `Up next: ${ex.name} · ${setLine} · ${target}${state.side ? ` · start ${SIDE_LABEL[state.side]}` : ""}`;
  } else if (state.phase === "rest") {
    label = "Rest";
    sub = `Next: ${setLine}${state.side ? ` · ${SIDE_LABEL[state.side]} first` : ""} · ${target}`;
  } else if (switchedSide(state)) {
    label = `Switch to ${SIDE_LABEL[state.side as Side]}`;
    sub = `${setLine} · same set, no rest between sides`;
  } else if (ex.measureType === "seconds") {
    label = "Hold";
    sub = `${setLine} · keep steady and breathe`;
  } else {
    label = tempoPos ? TEMPO_LABEL[tempoPos.step.name].title : "Go";
    sub = tempoPos ? TEMPO_LABEL[tempoPos.step.name].hint : "Move with control";
  }

  const phaseTone =
    state.paused ? "bg-surface-muted" : state.phase === "rest" ? "bg-success-soft" : state.phase === "prepare" ? "bg-accent-50" : "bg-surface";

  return (
    <div className={cn("flex h-full flex-col rounded-card border border-line/70 p-5 shadow-card transition-colors md:p-8", phaseTone)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-overline uppercase text-ink-muted">{setLine} · {target}</p>
          <p className="mt-1 text-title md:text-display" aria-live="polite">
            {label}
          </p>
          <p className="mt-1 text-[0.9375rem] text-ink-soft">{sub}</p>
        </div>
        {ex.sideMode !== "none" ? <SideIndicator state={state} /> : null}
      </div>

      {/* Big number in front; the exercise figure right behind / below it, driven by the same engine state */}
      <div className="flex flex-1 flex-col items-center justify-center py-4 md:py-6">
        {state.phase === "work" && ex.measureType === "reps" ? (
          <p className="relative z-10 text-timer tabular-nums" aria-label={`${state.reps} of ${ex.target} reps`}>
            {state.reps}
            <span className="text-[0.35em] font-semibold text-ink-faint"> / {ex.target}</span>
          </p>
        ) : (
          <p className="relative z-10 text-timer tabular-nums" role="timer" aria-live="off">
            {seconds === null ? "–" : formatClock(seconds)}
          </p>
        )}
        {hasExerciseAnimation(exerciseId) ? (
          <div className="relative -mt-3 w-full max-w-2xl md:-mt-5">
            <button
              type="button"
              onClick={() => setEnlarged(true)}
              className="block h-72 w-full rounded-card bg-gradient-to-b from-transparent to-accent-50/60 sm:h-80 md:h-96 xl:h-[28rem]"
              aria-label="Open full screen"
            >
              <ExerciseAnimation exerciseId={exerciseId as string} state={state} now={now} muscles={muscles} />
            </button>
            <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-chip bg-surface/85 px-2.5 py-1 text-caption font-medium text-ink-soft shadow-sm">
              <Maximize2 aria-hidden className="size-3.5" />
              Full screen
            </span>
          </div>
        ) : null}
        {hasExerciseAnimation(exerciseId) ? <MuscleLegend muscles={muscles} className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-caption text-ink-soft" /> : null}
        {state.phase === "work" && ex.measureType === "reps" && ex.tempo ? (
          <TempoBar tempo={ex.tempo} start={ex.tempoStart} position={tempoPos} />
        ) : null}
        {state.phase !== "work" && hasExerciseAnimation(exerciseId) ? (
          <p className="mt-1 text-caption text-ink-muted">Preview of the movement · reps are counted when the set starts</p>
        ) : null}
      </div>

      {enlarged && exerciseId ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${ex.name} — full screen`}
          className={cn("fixed inset-0 z-50 flex flex-col", phaseTone === "bg-surface" ? "bg-surface" : phaseTone)}
        >
          <div className="flex items-center gap-3 border-b border-line/70 px-4 py-3 pt-safe md:px-8">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{ex.name}</p>
              <p className="text-sm text-ink-muted">
                {setLine}
                {state.side ? ` · ${SIDE_LABEL[state.side]}` : ""} · {target}
              </p>
            </div>
            <Button variant="secondary" onClick={() => setEnlarged(false)} aria-label="Exit full screen">
              <Minimize2 aria-hidden className="size-5" />
              <span className="hidden sm:inline">Exit full screen</span>
            </Button>
          </div>

          {/* Countdown + reps */}
          <div className="flex items-center justify-center gap-5 px-4 pt-2 md:gap-12 md:pt-4">
            <div className="text-center">
              <p className="text-lg font-semibold md:text-display" aria-live="polite">
                {label}
              </p>
              {state.phase === "work" && ex.measureType === "reps" ? (
                <p className="text-[clamp(3.5rem,13vw,9rem)] font-bold leading-none tabular-nums" aria-label={`${state.reps} of ${ex.target} reps`}>
                  {state.reps}
                  <span className="text-[0.38em] font-semibold text-ink-faint"> / {ex.target}</span>
                </p>
              ) : (
                <p className="text-[clamp(3.5rem,13vw,9rem)] font-bold leading-none tabular-nums" role="timer" aria-live="off">
                  {seconds === null ? "–" : formatClock(seconds)}
                </p>
              )}
            </div>
            {tempoPos && !state.paused ? (
              <div className="shrink-0 text-center" role="timer" aria-label={`${TEMPO_LABEL[tempoPos.step.name].title}, ${Math.ceil(tempoPos.stepRemainingMs / 1000)} seconds left`}>
                <span className="grid size-16 place-items-center rounded-full border-4 border-accent-600 bg-surface text-3xl font-bold tabular-nums md:size-28 md:text-5xl">
                  {Math.ceil(tempoPos.stepRemainingMs / 1000)}
                </span>
                <span className="mt-1 block text-caption font-semibold text-accent-700">{TEMPO_LABEL[tempoPos.step.name].title}</span>
              </div>
            ) : null}
          </div>

          <div className="relative min-h-0 flex-1 px-2 md:px-6">
            <ExerciseAnimation exerciseId={exerciseId} state={state} now={now} muscles={muscles} />
            <MuscleLegend muscles={muscles} className="absolute inset-x-0 top-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 text-caption text-ink-soft" />
          </div>

          <div className="mx-auto w-full max-w-3xl space-y-2 px-4 pb-3 pb-safe md:space-y-3 md:px-8">
            {state.phase === "work" && ex.measureType === "reps" && ex.tempo ? (
              <div className="hidden justify-center [@media(min-height:760px)]:flex">
                <TempoBar tempo={ex.tempo} start={ex.tempoStart} position={tempoPos} />
              </div>
            ) : null}
            <StageControls state={state} onAction={onAction} onSkipExercise={onSkipExercise} compact />
          </div>
        </div>
      ) : null}

      {/* Controls */}
      <div className="space-y-3">
        <StageControls state={state} onAction={onAction} onSkipExercise={onSkipExercise} />
        {ex.tempo && ex.measureType === "reps" ? (
          <p className="text-center text-caption text-ink-muted">
            Tempo {formatTempo(ex.tempo)} · Rest {ex.restSeconds} s between sets
          </p>
        ) : (
          <p className="text-center text-caption text-ink-muted">Rest {ex.restSeconds} s between sets</p>
        )}
      </div>
    </div>
  );
}

/** Main + secondary workout controls; used in the stage and in full screen. All go through the engine. */
function StageControls({
  state,
  onAction,
  onSkipExercise,
  compact = false,
}: {
  state: EngineState;
  onAction: WorkoutController["dispatch"];
  onSkipExercise: () => void;
  /** Full screen: lower main buttons and a tight secondary row so everything fits on a phone. */
  compact?: boolean;
}) {
  const ex = currentExercise(state);
  if (!ex) return null;
  const main = compact ? "lg" : "xl";
  return (
    <>
      {state.paused ? (
        <Button size={main} className="w-full" onClick={() => onAction({ type: "resume" })}>
          <Play aria-hidden className="size-6" />
          Resume
        </Button>
      ) : state.phase === "work" && ex.measureType === "reps" ? (
        <Button
          size={main}
          variant={ex.tempo ? "secondary" : "primary"}
          className="w-full"
          onClick={() => onAction({ type: "rep_done" })}
        >
          <Check aria-hidden className="size-6" />
          {ex.tempo ? "Count rep now" : "Rep done"}
          <kbd className="ml-2 hidden rounded-md bg-white/15 px-2 py-0.5 text-sm font-medium lg:inline">Space</kbd>
        </Button>
      ) : state.phase === "prepare" ? (
        <Button size={main} variant="secondary" className="w-full" onClick={() => onAction({ type: "skip_prepare" })}>
          <ChevronsRight aria-hidden className="size-6" />
          Skip countdown
        </Button>
      ) : state.phase === "rest" ? (
        <div className="grid grid-cols-2 gap-3">
          <Button size={main} variant="secondary" onClick={() => onAction({ type: "add_rest" })}>
            <Plus aria-hidden className="size-5" />
            Add 15 s
          </Button>
          <Button size={main} onClick={() => onAction({ type: "skip_rest" })}>
            <ChevronsRight aria-hidden className="size-6" />
            Skip rest
          </Button>
        </div>
      ) : (
        <Button size={main} variant="secondary" className="w-full" onClick={() => onAction({ type: "finish_side" })}>
          <Square aria-hidden className="size-5" />
          End hold early
        </Button>
      )}

      <div className={cn("flex flex-wrap items-center justify-center", compact ? "gap-x-1 gap-y-0" : "gap-2")}>
        {!state.paused ? (
          <Button variant="ghost" onClick={() => onAction({ type: "pause" })}>
            <Pause aria-hidden className="size-4.5" />
            Pause
          </Button>
        ) : null}
        {state.phase === "work" && ex.measureType === "reps" && !state.paused ? (
          <>
            <Button variant="ghost" onClick={() => onAction({ type: "rep_undo" })} disabled={state.reps === 0}>
              <Undo2 aria-hidden className="size-4.5" />
              Undo rep
            </Button>
            <Button variant="ghost" onClick={() => onAction({ type: "finish_side" })}>
              <Check aria-hidden className="size-4.5" />
              Finish {ex.sideMode === "none" ? "set" : "side"} early
            </Button>
          </>
        ) : null}
        <Button variant="ghost" onClick={onSkipExercise}>
          <SkipForward aria-hidden className="size-4.5" />
          Skip exercise
        </Button>
      </div>
    </>
  );
}

/** Heading above the exercise panel: what the user is looking at. */
function asideLabel(state: EngineState): string {
  if (state.phase === "prepare") return "First exercise";
  if (restKind(state) === "transition") return "Up next";
  if (state.phase === "rest") return "Current exercise";
  return "Now";
}

/** First moments on the second side (no reps yet): show a clear switch cue. */
function switchedSide(state: EngineState): boolean {
  return state.phase === "work" && state.side !== null && secondSide(state.side) === null && state.reps === 0
    && (currentExercise(state)?.measureType === "reps");
}

function SideIndicator({ state }: { state: EngineState }) {
  const ex = currentExercise(state);
  if (!ex) return null;
  const sides: Side[] = ex.sideMode === "per_side" ? ["left", "right"] : ["forward", "backward"];
  // During rest the side is already reset for the next set: nothing done yet.
  const onSecond = state.side !== null && secondSide(state.side) === null;
  return (
    <div className="flex gap-2" aria-label="Side">
      {sides.map((side, i) => {
        const current = state.side === side && state.phase !== "rest";
        const done = i === 0 && onSecond && state.phase !== "rest";
        return (
          <span
            key={side}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-chip border px-4 text-sm font-semibold",
              current ? "border-accent-600 bg-accent-600 text-white" : done ? "border-success/30 bg-success-soft text-success" : "border-line bg-surface text-ink-muted",
            )}
            aria-current={current ? "step" : undefined}
          >
            {done ? <Check aria-hidden className="size-4" /> : null}
            {SIDE_LABEL[side]}
          </span>
        );
      })}
    </div>
  );
}

function TempoBar({
  tempo,
  start,
  position,
}: {
  tempo: { eccentric: number; pause: number; concentric: number };
  start: "eccentric" | "concentric";
  position: ReturnType<typeof tempoPositionAt>;
}) {
  const steps = tempoSequence(tempo, start);
  const total = steps.reduce((n, s) => n + s.ms, 0);
  return (
    <div className="mt-4 w-full max-w-lg" aria-hidden>
      <div className="flex h-3 gap-1 overflow-hidden rounded-chip">
        {steps.map((s, i) => {
          const active = position?.index === i;
          const fill = active && position ? 1 - position.stepRemainingMs / s.ms : position && i < position.index ? 1 : 0;
          return (
            <div key={s.name} className="relative h-full overflow-hidden rounded-chip bg-accent-100" style={{ flexGrow: s.ms / total }}>
              <div className="absolute inset-y-0 left-0 bg-accent-600" style={{ width: `${Math.round(fill * 100)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1 text-caption">
        {steps.map((s, i) => (
          <span
            key={s.name}
            className={cn("text-center", position?.index === i ? "font-semibold text-accent-700" : "text-ink-muted")}
            style={{ flexGrow: s.ms / total, flexBasis: 0 }}
          >
            {TEMPO_LABEL[s.name].title} {s.ms / 1000}s
          </span>
        ))}
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "retrying") {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 rounded-chip bg-warning-soft px-3 py-1 text-caption font-medium text-warning">
        <CloudOff aria-hidden className="size-3.5" />
        Not saved — retrying
      </span>
    );
  }
  return (
    <span role="status" className="text-caption text-ink-muted">
      {status === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}

function formatClock(totalSeconds: number): string {
  if (totalSeconds < 60) return String(totalSeconds);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Keep the screen awake during an active workout (where supported). */
function useWakeLock(active: boolean) {
  const lock = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let cancelled = false;
    const request = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) await sentinel.release();
        else lock.current = sentinel;
      } catch {
        // Not allowed (e.g. battery saver) — the workout still works.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [active]);
}
