import assert from "node:assert/strict";
import { test } from "node:test";
import { AudioCues } from "../../src/lib/audio/audio-cues.ts";
import { createInitialState, pickCue, reduce } from "../../src/lib/engine/workout-engine.ts";

/** Minimal stand-in for HTMLAudioElement that records what the app does. */
class FakeAudio {
  static created = [];
  static mode = "ok"; // "ok" | "reject" | "throw"
  constructor(src) {
    this.src = src;
    this.volume = 1;
    this.currentTime = 0;
    this.muted = false;
    this.plays = 0;
    this.paused = true;
    FakeAudio.created.push(this);
  }
  play() {
    if (FakeAudio.mode === "throw") throw new Error("NotSupportedError");
    this.plays += 1;
    this.paused = false;
    return FakeAudio.mode === "reject" ? Promise.reject(new Error("NotAllowedError")) : Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

function withFakeAudio(fn) {
  const before = globalThis.Audio;
  globalThis.Audio = FakeAudio;
  FakeAudio.created = [];
  FakeAudio.mode = "ok";
  try {
    return fn();
  } finally {
    globalThis.Audio = before;
  }
}

test("plays local files with HTML audio at the chosen volume", () =>
  withFakeAudio(() => {
    const a = new AudioCues(true, 0.6);
    a.play("rep");
    const el = FakeAudio.created.find((e) => e.src === "/audio/rep.wav");
    assert.ok(el, "uses the local file");
    assert.equal(el.plays, 1);
    assert.equal(el.volume, 0.6);
    a.play("rep"); // same element reused, restarted from 0
    assert.equal(FakeAudio.created.filter((e) => e.src === "/audio/rep.wav").length, 1);
    assert.equal(el.plays, 2);
  }));

test("sound toggle: off plays nothing and silences a cue that is playing", () =>
  withFakeAudio(() => {
    const a = new AudioCues(true, 0.8);
    a.play("transition");
    const el = FakeAudio.created[0];
    a.set(false, 0.8);
    assert.equal(el.paused, true);
    a.play("transition");
    assert.equal(el.plays, 1);
    a.set(true, 0.8);
    a.play("transition");
    assert.equal(el.plays, 2);
  }));

test("volume control: 0 is silent, changes apply, values are clamped", () =>
  withFakeAudio(() => {
    const a = new AudioCues(true, 0);
    a.play("go");
    assert.equal(FakeAudio.created.length, 0);
    a.set(true, 1.7);
    a.play("go");
    assert.equal(FakeAudio.created[0].volume, 1);
    a.set(true, 0.25);
    assert.equal(FakeAudio.created[0].volume, 0.25);
    assert.equal(new AudioCues(true, Number.NaN).volume, 0.8);
  }));

test("audio fallback: blocked, failing or missing audio never throws", async () => {
  await withFakeAudio(async () => {
    const a = new AudioCues(true, 0.8);
    FakeAudio.mode = "reject";
    assert.doesNotThrow(() => a.play("countdown"));
    FakeAudio.mode = "throw";
    assert.doesNotThrow(() => a.play("go"));
    await new Promise((r) => setTimeout(r, 0)); // no unhandled rejection
  });
  const before = globalThis.Audio;
  delete globalThis.Audio; // e.g. server render / unsupported
  try {
    assert.doesNotThrow(() => new AudioCues(true, 0.8).play("go"));
  } finally {
    globalThis.Audio = before;
  }
});

test("one cue per step, by priority (no piled-up sounds)", () => {
  const s = (cue) => ({ type: "sound", cue });
  assert.equal(pickCue([s("rep"), s("tempo")]), "rep");
  assert.equal(pickCue([s("rep"), s("go")]), "go");
  assert.equal(pickCue([s("rep"), s("transition")]), "transition");
  assert.equal(pickCue([s("countdown"), s("workout_complete")]), "workout_complete");
  assert.equal(pickCue([{ type: "checkpoint" }]), null);
});

test("engine cues: rep completion, exercise transition, workout complete", () => {
  const squat = { order: 1, name: "Squat", measureType: "reps", sideMode: "none", sets: 1, target: 2, tempo: { eccentric: 3, pause: 1, concentric: 1 }, tempoStart: "eccentric", restSeconds: 60 };
  const plank = { order: 2, name: "Plank", measureType: "seconds", sideMode: "none", sets: 1, target: 20, tempo: null, tempoStart: "eccentric", restSeconds: 60 };
  const T0 = Date.parse("2026-11-16T08:00:00Z");
  let state = createInitialState([squat, plank]);
  const cues = [];
  const step = (action, at) => {
    const r = reduce(state, action, at);
    state = r.state;
    const c = pickCue(r.effects);
    if (c) cues.push(c);
  };
  step({ type: "begin" }, T0);
  step({ type: "skip_prepare" }, T0);
  step({ type: "tick" }, T0 + 5_050); // rep 1 (auto) — tempo wrap is outranked by "rep"
  step({ type: "tick" }, T0 + 10_050); // rep 2 finishes the exercise → transition
  step({ type: "skip_rest" }, T0 + 11_000);
  step({ type: "tick" }, T0 + 31_100); // hold done → workout complete
  assert.deepEqual(cues, ["go", "rep", "transition", "go", "workout_complete"]);
  // Repeating the same tick (e.g. a React re-render) never plays again.
  const again = reduce(state, { type: "tick" }, T0 + 31_100);
  assert.equal(pickCue(again.effects), null);
});
