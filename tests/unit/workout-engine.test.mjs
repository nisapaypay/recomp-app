import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADD_REST_MS,
  PREPARE_MS,
  SUSPEND_THRESHOLD_MS,
  TRANSITION_REST_MS,
  activeSeconds,
  createInitialState,
  reduce,
  remainingMs,
  restKind,
  tempoPositionAt,
  tempoSequence,
  workoutProgress,
} from "../../src/lib/engine/workout-engine.ts";
import { restoreFromCheckpoint, toCheckpoint } from "../../src/lib/engine/checkpoint.ts";
import { exerciseResult } from "../../src/lib/engine/results.ts";

const T0 = Date.parse("2026-11-16T08:00:00Z");
const squat = { order: 1, name: "Goblet Squat", measureType: "reps", sideMode: "none", sets: 2, target: 3, tempo: { eccentric: 3, pause: 1, concentric: 1 }, tempoStart: "eccentric", restSeconds: 90 };
const lunge = { order: 2, name: "Reverse Lunge", measureType: "reps", sideMode: "per_side", sets: 2, target: 2, tempo: { eccentric: 2, pause: 1, concentric: 2 }, tempoStart: "eccentric", restSeconds: 60 };
const plank = { order: 3, name: "Plank", measureType: "seconds", sideMode: "none", sets: 2, target: 20, tempo: null, tempoStart: "eccentric", restSeconds: 60 };

/** Apply actions in order, collecting effects. */
function run(state, steps) {
  const effects = [];
  for (const [action, at] of steps) {
    const r = reduce(state, action, at);
    state = r.state;
    effects.push(...r.effects);
  }
  return { state, effects };
}
const recorded = (effects) => effects.filter((e) => e.type === "record_set").map((e) => e.result);
const sounds = (effects) => effects.filter((e) => e.type === "sound").map((e) => e.cue);

test("begin starts a 10 s preparation countdown for set 1", () => {
  const { state, effects } = run(createInitialState([squat]), [[{ type: "begin" }, T0]]);
  assert.equal(state.phase, "prepare");
  assert.equal(state.setNumber, 1);
  assert.equal(remainingMs(state, T0 + 4_000), PREPARE_MS - 4_000);
  assert.ok(effects.some((e) => e.type === "began"));
});

test("preparation ends by timestamp, and countdown never records a set", () => {
  let { state, effects } = run(createInitialState([squat]), [
    [{ type: "begin" }, T0],
    [{ type: "tick" }, T0 + 7_100],
    [{ type: "tick" }, T0 + 8_100],
    [{ type: "tick" }, T0 + 9_100],
    [{ type: "tick" }, T0 + 10_050],
  ]);
  assert.equal(state.phase, "work");
  assert.equal(state.phaseStartedAt, T0 + PREPARE_MS); // started exactly at the countdown end
  assert.equal(recorded(effects).length, 0);
  assert.deepEqual(sounds(effects), ["countdown", "countdown", "countdown", "go"]);
});

test("skip countdown goes straight to the set", () => {
  const { state } = run(createInitialState([squat]), [[{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0 + 2_000]]);
  assert.equal(state.phase, "work");
  assert.equal(state.reps, 0);
});

test("tempo follows the exercise's own tempo and start phase", () => {
  assert.deepEqual(tempoSequence({ eccentric: 3, pause: 1, concentric: 1 }, "eccentric").map((s) => s.name), ["eccentric", "hold", "concentric"]);
  assert.deepEqual(tempoSequence({ eccentric: 2, pause: 1, concentric: 1 }, "concentric").map((s) => s.name), ["concentric", "hold", "eccentric"]);
  assert.deepEqual(tempoSequence({ eccentric: 1, pause: 0, concentric: 1 }, "eccentric").map((s) => s.name), ["eccentric", "concentric"]);
  const t311 = { eccentric: 3, pause: 1, concentric: 1 };
  assert.equal(tempoPositionAt(t311, "eccentric", T0, T0 + 2_900).step.name, "eccentric");
  assert.equal(tempoPositionAt(t311, "eccentric", T0, T0 + 3_500).step.name, "hold");
  assert.equal(tempoPositionAt(t311, "eccentric", T0, T0 + 4_200).step.name, "concentric");
  assert.equal(tempoPositionAt(t311, "eccentric", T0, T0 + 5_100).step.name, "eccentric"); // next cycle
  const t212 = { eccentric: 2, pause: 1, concentric: 2 };
  assert.equal(tempoPositionAt(t212, "eccentric", T0, T0 + 2_500).step.name, "hold");
  assert.equal(tempoPositionAt(t212, "eccentric", T0, T0 + 3_500).step.name, "concentric");
});

test("each completed tempo cycle counts one rep automatically", () => {
  // 3-1-1 tempo = 5 s per rep, target 3.
  let { state } = run(createInitialState([squat]), [
    [{ type: "begin" }, T0],
    [{ type: "skip_prepare" }, T0],
    [{ type: "tick" }, T0 + 4_900],
  ]);
  assert.equal(state.reps, 0);
  ({ state } = run(state, [[{ type: "tick" }, T0 + 5_100]]));
  assert.equal(state.reps, 1);
  assert.equal(state.tempoAnchorAt, T0 + 5_000); // tempo guide keeps its rhythm
  ({ state } = run(state, [[{ type: "tick" }, T0 + 10_200]]));
  assert.equal(state.reps, 2);
  // Undo corrects; the next cycle counts again.
  ({ state } = run(state, [[{ type: "rep_undo" }, T0 + 11_000], [{ type: "tick" }, T0 + 15_100]]));
  assert.equal(state.reps, 2);
});

test("auto-count finishes the set at the end of the last rep's cycle, then rests", () => {
  const { state, effects } = run(createInitialState([squat]), [
    [{ type: "begin" }, T0],
    [{ type: "skip_prepare" }, T0],
    [{ type: "tick" }, T0 + 5_000],
    [{ type: "tick" }, T0 + 40_000], // throttled tick: caught up exactly
  ]);
  assert.deepEqual(recorded(effects), [
    { exerciseOrder: 1, setNumber: 1, side: null, target: 3, achieved: 3, status: "completed", durationSeconds: 15 },
  ]);
  assert.equal(state.phase, "rest");
  assert.equal(remainingMs(state, T0 + 40_000), 90_000 - 25_000);
});

test("Rep done adds a rep immediately and restarts the tempo cycle", () => {
  const { state } = run(createInitialState([squat]), [
    [{ type: "begin" }, T0],
    [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 2_000],
    [{ type: "tick" }, T0 + 6_500], // only 4.5 s since the manual rep
  ]);
  assert.equal(state.reps, 1);
  assert.equal(state.tempoAnchorAt, T0 + 2_000);
});

test("no auto-count while paused or for exercises without a tempo", () => {
  const paused = run(createInitialState([squat]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0], [{ type: "pause" }, T0 + 1_000], [{ type: "tick" }, T0 + 30_000],
  ]).state;
  assert.equal(paused.reps, 0);
  const noTempo = run(createInitialState([{ ...squat, tempo: null }]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0], [{ type: "tick" }, T0 + 30_000],
  ]).state;
  assert.equal(noTempo.reps, 0);
});

test("unilateral auto-count: left side finishes, right side starts and counts from zero", () => {
  const { state, effects } = run(createInitialState([lunge]), [ // 2-1-2 = 5 s, target 2
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "tick" }, T0 + 5_000], [{ type: "tick" }, T0 + 10_000], [{ type: "tick" }, T0 + 15_000],
  ]);
  assert.deepEqual(recorded(effects).map((r) => [r.side, r.achieved]), [["left", 2]]);
  assert.equal(state.side, "right");
  assert.equal(state.phaseStartedAt, T0 + 10_000);
  assert.equal(state.reps, 1);
});

test("reaching the target finishes the set, then rest uses the prescribed 90 s", () => {
  const { state, effects } = run(createInitialState([squat]), [
    [{ type: "begin" }, T0],
    [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 5_000],
    [{ type: "rep_done" }, T0 + 10_000],
    [{ type: "rep_done" }, T0 + 15_000],
  ]);
  assert.deepEqual(recorded(effects), [
    { exerciseOrder: 1, setNumber: 1, side: null, target: 3, achieved: 3, status: "completed", durationSeconds: 15 },
  ]);
  assert.equal(state.phase, "rest");
  assert.equal(state.setNumber, 2);
  assert.equal(remainingMs(state, T0 + 15_000), 90_000);
});

test("finishing a set early records it as partial with the confirmed reps", () => {
  const { effects } = run(createInitialState([squat]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 5_000], [{ type: "finish_side" }, T0 + 9_000],
  ]);
  assert.equal(recorded(effects)[0].status, "partial");
  assert.equal(recorded(effects)[0].achieved, 1);
});

test("rest: add 15 s, skip rest, and rest end → next set starts directly (no countdown)", () => {
  const atRest = run(createInitialState([squat]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 1], [{ type: "rep_done" }, T0 + 2], [{ type: "rep_done" }, T0 + 3],
  ]).state;
  assert.equal(restKind(atRest), "between_sets");
  const added = reduce(atRest, { type: "add_rest" }, T0 + 10).state;
  assert.equal(added.phaseEndsAt, atRest.phaseEndsAt + ADD_REST_MS); // target timestamp moved
  assert.equal(remainingMs(added, T0 + 10), 90_000 + ADD_REST_MS - 7);
  // Regular ticks (the app ticks continuously; a single 105 s jump would be a sleep gap).
  const ended = run(added, [
    [{ type: "tick" }, T0 + 40_000], [{ type: "tick" }, T0 + 80_000], [{ type: "tick" }, T0 + 101_500],
    [{ type: "tick" }, T0 + 102_500], [{ type: "tick" }, T0 + 104_000], [{ type: "tick" }, T0 + 104_500], [{ type: "tick" }, T0 + 3 + 105_000],
  ]);
  assert.equal(remainingMs(added, T0 + 104_000), 1_003); // the 15 s were added: rest still running at +104 s
  assert.equal(ended.state.phase, "work");
  assert.equal(ended.state.setNumber, 2);
  assert.equal(ended.state.phaseStartedAt, T0 + 3 + 105_000); // starts exactly when rest ends
  assert.ok(sounds(ended.effects).includes("rest_complete"));
  assert.equal(sounds(ended.effects).filter((c) => c === "countdown").length, 3); // 3-2-1 before the set
  const skipped = run(atRest, [[{ type: "skip_rest" }, T0 + 20]]);
  assert.equal(skipped.state.phase, "work");
  assert.equal(skipped.state.setNumber, 2);
  assert.equal(skipped.state.phaseStartedAt, T0 + 20);
});

test("last set of an exercise → 60 s transition rest previewing the next exercise → its set 1", () => {
  const s = createInitialState([{ ...squat, sets: 1 }, plank]);
  const { state } = run(s, [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 1], [{ type: "rep_done" }, T0 + 2], [{ type: "rep_done" }, T0 + 3],
  ]);
  assert.equal(state.phase, "rest");
  assert.equal(restKind(state), "transition");
  assert.equal(state.exerciseIndex, 1); // preview = next exercise
  assert.equal(state.setNumber, 1);
  assert.equal(remainingMs(state, T0 + 3), TRANSITION_REST_MS);
  const next = run(state, [[{ type: "tick" }, T0 + 30_000], [{ type: "tick" }, T0 + 3 + TRANSITION_REST_MS]]);
  assert.equal(next.state.phase, "work"); // no extra 10 s countdown
  assert.equal(next.state.exerciseIndex, 1);
  assert.equal(next.state.phaseStartedAt, T0 + 3 + TRANSITION_REST_MS);
  // Skip rest during a transition also starts the next exercise.
  const skipped = reduce(state, { type: "skip_rest" }, T0 + 1_000).state;
  assert.equal(skipped.phase, "work");
  assert.equal(skipped.exerciseIndex, 1);
});

test("preparation countdown happens only once, at the start of the workout", () => {
  const two = [{ ...squat, sets: 2 }, { ...lunge, sets: 2 }];
  const steps = [[{ type: "begin" }, T0]];
  let t = T0;
  const reps = (n) => { for (let i = 0; i < n; i++) steps.push([{ type: "rep_done" }, (t += 1_000)]); };
  steps.push([{ type: "skip_prepare" }, t]);
  reps(3); steps.push([{ type: "skip_rest" }, (t += 1_000)]); reps(3); // squat set 1, set 2
  steps.push([{ type: "skip_rest" }, (t += 1_000)]); // transition
  reps(2); reps(2); steps.push([{ type: "skip_rest" }, (t += 1_000)]); reps(2); reps(2); // lunge
  const phases = [];
  let state = createInitialState(two);
  for (const [a, at] of steps) {
    state = reduce(state, a, at).state;
    phases.push(state.phase);
  }
  assert.equal(phases.filter((p) => p === "prepare").length, 1); // only right after Begin
  assert.equal(state.phase, "complete");
});

test("unilateral: left then right with no rest between; rest starts only after both sides", () => {
  let { state, effects } = run(createInitialState([lunge]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 5_000], [{ type: "rep_done" }, T0 + 10_000],
  ]);
  assert.equal(state.side, "right");
  assert.equal(state.phase, "work"); // straight to the right side, same set
  assert.equal(state.setNumber, 1);
  assert.equal(state.phaseStartedAt, T0 + 10_000);
  assert.deepEqual(recorded(effects).map((r) => [r.setNumber, r.side, r.achieved]), [[1, "left", 2]]);
  assert.deepEqual(workoutProgress(state), { done: 1, total: 4 });
  ({ state, effects } = run(state, [
    [{ type: "rep_done" }, T0 + 15_000], [{ type: "rep_done" }, T0 + 20_000],
  ]));
  assert.deepEqual(recorded(effects).map((r) => [r.setNumber, r.side]), [[1, "right"]]);
  assert.equal(state.phase, "rest");
  assert.equal(restKind(state), "between_sets");
  assert.equal(remainingMs(state, T0 + 20_000), 60_000);
  assert.equal(state.setNumber, 2);
  assert.equal(state.side, "left");
});

test("per-direction exercises use forward then backward", () => {
  const circles = { ...lunge, name: "Arm Circles", sideMode: "per_direction", tempo: { eccentric: 1, pause: 0, concentric: 1 } };
  const { state } = run(createInitialState([circles]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 1], [{ type: "rep_done" }, T0 + 2],
  ]);
  assert.equal(state.side, "backward");
});

test("timed hold (plank) counts down its target and completes the set", () => {
  const { state, effects } = run(createInitialState([plank]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "tick" }, T0 + 17_500], [{ type: "tick" }, T0 + 18_500], [{ type: "tick" }, T0 + 19_500],
    [{ type: "tick" }, T0 + 20_200],
  ]);
  assert.equal(recorded(effects)[0].achieved, 20);
  assert.equal(recorded(effects)[0].status, "completed");
  assert.equal(state.phase, "rest");
  assert.equal(sounds(effects).filter((c) => c === "countdown").length, 3);
});

test("ending a hold early records the seconds actually held", () => {
  const { effects } = run(createInitialState([plank]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0], [{ type: "finish_side" }, T0 + 12_400],
  ]);
  assert.equal(recorded(effects)[0].achieved, 12);
  assert.equal(recorded(effects)[0].status, "partial");
});

test("pause / resume keeps the remaining time exactly", () => {
  let { state } = run(createInitialState([plank]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0], [{ type: "pause" }, T0 + 5_000],
  ]);
  assert.equal(remainingMs(state, T0 + 60_000), 15_000); // frozen while paused
  ({ state } = run(state, [[{ type: "tick" }, T0 + 60_000], [{ type: "resume" }, T0 + 65_000]]));
  assert.equal(state.phase, "work");
  assert.equal(remainingMs(state, T0 + 65_000), 15_000);
  const done = run(state, [[{ type: "tick" }, T0 + 80_100]]);
  assert.equal(recorded(done.effects)[0].durationSeconds, 20); // pause excluded from the set duration
  assert.equal(activeSeconds(done.state, T0, T0 + 80_100), 20);
});

test("background tab: throttled ticks are caught up from timestamps", () => {
  // Rest 60 s, tick arrives 70 s later (within the throttling window).
  const atRest = run(createInitialState([{ ...plank, restSeconds: 60 }]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0], [{ type: "tick" }, T0 + 20_000],
  ]).state;
  assert.equal(atRest.phase, "rest");
  const r = run(atRest, [[{ type: "tick" }, T0 + 20_000 + 50_000], [{ type: "tick" }, T0 + 20_000 + 75_000]]);
  // rest ended at +80 s → hold (set 2) started at +80 s exactly.
  assert.equal(r.state.phase, "work");
  assert.equal(r.state.setNumber, 2);
  assert.equal(r.state.phaseStartedAt, T0 + 80_000);
  assert.equal(remainingMs(r.state, T0 + 95_000), 5_000);
});

test("laptop sleep (long gap) pauses at the last tick — nothing is auto-completed", () => {
  const holding = run(createInitialState([plank]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0], [{ type: "tick" }, T0 + 5_000],
  ]).state;
  const woke = run(holding, [[{ type: "tick" }, T0 + 5_000 + 2 * 60 * 60_000]]);
  assert.equal(woke.state.paused, true);
  assert.equal(woke.state.pauseReason, "suspended");
  assert.equal(remainingMs(woke.state, Date.now()), 15_000);
  assert.equal(recorded(woke.effects).length, 0);
  // Resuming continues from 15 s and the sleep is not counted as active time.
  const resumed = reduce(woke.state, { type: "resume" }, T0 + 3 * 60 * 60_000).state;
  assert.equal(remainingMs(resumed, T0 + 3 * 60 * 60_000), 15_000);
  assert.ok(SUSPEND_THRESHOLD_MS > 60_000);
});

test("user actions keep the device 'awake' (no false sleep pause)", () => {
  // Long rest with no ticks but a user tap in between: not a sleep gap.
  let s = run(createInitialState([squat]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 1], [{ type: "rep_done" }, T0 + 2], [{ type: "rep_done" }, T0 + 80_000],
  ]).state;
  s = reduce(s, { type: "tick" }, T0 + 120_000).state;
  assert.equal(s.paused, false);
  assert.equal(s.phase, "rest");
});

test("ticks are idempotent: repeating the same tick changes nothing", () => {
  const s1 = run(createInitialState([squat]), [[{ type: "begin" }, T0], [{ type: "tick" }, T0 + 3_000]]).state;
  const s2 = reduce(s1, { type: "tick" }, T0 + 3_000);
  assert.deepEqual(s2.state, s1);
  assert.equal(s2.effects.length, 0);
});

test("skip exercise records nothing as completed and moves on", () => {
  const { state, effects } = run(createInitialState([squat, plank]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0], [{ type: "rep_done" }, T0 + 5_000],
    [{ type: "skip_exercise" }, T0 + 6_000],
  ]);
  assert.deepEqual(effects.filter((e) => e.type === "skip_exercise"), [{ type: "skip_exercise", exerciseOrder: 1 }]);
  assert.equal(recorded(effects).length, 0);
  assert.equal(state.exerciseIndex, 1);
  assert.equal(restKind(state), "transition");
});

test("last set of the last exercise completes the workout with no extra rest", () => {
  const { state, effects } = run(createInitialState([{ ...squat, sets: 2 }]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 1], [{ type: "rep_done" }, T0 + 2], [{ type: "rep_done" }, T0 + 3],
    [{ type: "skip_rest" }, T0 + 10],
    [{ type: "rep_done" }, T0 + 11], [{ type: "rep_done" }, T0 + 12], [{ type: "rep_done" }, T0 + 13],
  ]);
  assert.equal(state.phase, "complete");
  assert.equal(recorded(effects).length, 2);
  assert.equal(effects.filter((e) => e.type === "finished").length, 1);
});

test("finishing the last set (timed hold) completes the workout", () => {
  const { state, effects } = run(createInitialState([{ ...plank, sets: 1 }]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0], [{ type: "tick" }, T0 + 21_000],
  ]);
  assert.equal(state.phase, "complete");
  assert.ok(effects.some((e) => e.type === "finished"));
  assert.ok(sounds(effects).includes("workout_complete"));
  assert.deepEqual(workoutProgress(state), { done: 1, total: 1 });
});

test("workout progress counts sides", () => {
  const s = run(createInitialState([lunge]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0], [{ type: "rep_done" }, 1], [{ type: "rep_done" }, 2],
  ]).state;
  assert.deepEqual(workoutProgress(s), { done: 1, total: 4 });
});

test("tempo can be adjusted per exercise (validated)", () => {
  let s = run(createInitialState([squat]), [[{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0]]).state;
  s = reduce(s, { type: "set_tempo", tempo: { eccentric: 4, pause: 2, concentric: 1 } }, T0 + 1).state;
  assert.deepEqual(s.exercises[0].tempo, { eccentric: 4, pause: 2, concentric: 1 });
  const bad = reduce(s, { type: "set_tempo", tempo: { eccentric: -1, pause: 0, concentric: 1 } }, T0 + 2).state;
  assert.deepEqual(bad.exercises[0].tempo, { eccentric: 4, pause: 2, concentric: 1 });
});

test("checkpoint round trip: recovery comes back paused with validated time", () => {
  const exercises = [squat, plank];
  let s = run(createInitialState(exercises), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 1], [{ type: "rep_done" }, T0 + 2], [{ type: "rep_done" }, T0 + 3],
    [{ type: "tick" }, T0 + 30_000], // resting since T0+3 (90 s) → 60.003 s left
  ]).state;
  const row = { ...toCheckpoint(s, exercises), revision: 3, updated_at: new Date(T0 + 30_000).toISOString() };
  assert.equal(row.current_phase, "rest");
  assert.equal(row.phase_duration_ms, 90_000);

  // Reopened 3 hours later: rest did NOT run out while away.
  const restored = restoreFromCheckpoint(exercises, row);
  assert.equal(restored.paused, true);
  assert.equal(restored.pauseReason, "recovered");
  assert.equal(restored.phase, "rest");
  assert.equal(restored.setNumber, 2);
  assert.equal(remainingMs(restored, T0 + 3 * 3600_000), 60_003);
  const resumed = reduce(restored, { type: "resume" }, T0 + 3 * 3600_000).state;
  assert.equal(remainingMs(resumed, T0 + 3 * 3600_000 + 3_000), 57_003);
  // Away time counts as paused, not active.
  assert.equal(activeSeconds(resumed, T0, T0 + 3 * 3600_000), 30);
});

test("recovery restarts a preparation countdown and keeps confirmed reps", () => {
  const exercises = [squat];
  const prep = run(createInitialState(exercises), [[{ type: "begin" }, T0], [{ type: "tick" }, T0 + 8_000]]).state;
  const r1 = restoreFromCheckpoint(exercises, { ...toCheckpoint(prep, exercises), revision: 1, updated_at: new Date(T0 + 8_000).toISOString() });
  assert.equal(r1.remainingMs, PREPARE_MS);

  const work = run(createInitialState(exercises), [[{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0], [{ type: "rep_done" }, T0 + 5_000]]).state;
  const r2 = restoreFromCheckpoint(exercises, { ...toCheckpoint(work, exercises), revision: 1, updated_at: new Date(T0 + 6_000).toISOString() });
  assert.equal(r2.phase, "work");
  assert.equal(r2.reps, 1);
  const resumed = reduce(r2, { type: "resume" }, T0 + 60_000).state;
  assert.equal(resumed.tempoAnchorAt, T0 + 60_000);
});

test("tempo overrides survive a checkpoint", () => {
  const exercises = [squat];
  const s = reduce(createInitialState(exercises), { type: "set_tempo", tempo: { eccentric: 2, pause: 0, concentric: 2 } }, T0).state;
  const row = { ...toCheckpoint(s, exercises), revision: 0, updated_at: new Date(T0).toISOString() };
  assert.deepEqual(row.tempo_override, { 1: [2, 0, 2] });
});

test("exercise results: completed / partial / skipped from set rows", () => {
  const c = (set, side, achieved, status) => ({ set_number: set, side, achieved, status });
  assert.deepEqual(exerciseResult(2, "none", [c(1, null, 12, "completed"), c(2, null, 12, "completed")], true), { completedSets: 2, status: "completed" });
  assert.deepEqual(exerciseResult(2, "none", [c(1, null, 12, "completed"), c(2, null, 8, "partial")], true), { completedSets: 2, status: "partial" });
  assert.deepEqual(exerciseResult(2, "none", [c(1, null, 0, "skipped"), c(2, null, 0, "skipped")], true), { completedSets: 0, status: "skipped" });
  // Unilateral: only the left side done → set not counted.
  assert.deepEqual(exerciseResult(2, "per_side", [c(1, "left", 10, "completed")], false), { completedSets: 0, status: "in_progress" });
  assert.deepEqual(exerciseResult(2, "per_side", [c(1, "left", 10, "completed"), c(1, "right", 10, "completed")], true), { completedSets: 1, status: "partial" });
  assert.deepEqual(exerciseResult(2, "none", [], true), { completedSets: 0, status: "pending" });
});

test("pause / resume works in every phase", () => {
  const ex = [{ ...squat, sets: 2 }, plank];
  // prepare
  let s = run(createInitialState(ex), [[{ type: "begin" }, T0], [{ type: "pause" }, T0 + 3_000]]).state;
  assert.equal(remainingMs(s, T0 + 50_000), 7_000);
  s = run(s, [[{ type: "resume" }, T0 + 50_000]]).state;
  assert.equal(remainingMs(s, T0 + 50_000), 7_000);
  // rep work: tempo anchor shifts by the pause, reps kept
  s = run(s, [[{ type: "skip_prepare" }, T0 + 51_000], [{ type: "rep_done" }, T0 + 52_000], [{ type: "pause" }, T0 + 53_000]]).state;
  assert.equal(reduce(s, { type: "rep_done" }, T0 + 54_000).state.reps, 1); // ignored while paused
  s = run(s, [[{ type: "resume" }, T0 + 63_000]]).state;
  assert.equal(s.tempoAnchorAt, T0 + 62_000);
  assert.equal(s.reps, 1);
  // between-set rest
  s = run(s, [[{ type: "rep_done" }, T0 + 64_000], [{ type: "rep_done" }, T0 + 65_000], [{ type: "pause" }, T0 + 75_000]]).state;
  assert.equal(restKind(s), "between_sets");
  assert.equal(remainingMs(s, T0 + 200_000), 80_000);
  assert.equal(reduce(s, { type: "skip_rest" }, T0 + 76_000).state.phase, "rest"); // skip ignored while paused
  const plus = reduce(s, { type: "add_rest" }, T0 + 76_000).state;
  assert.equal(remainingMs(plus, T0 + 200_000), 95_000); // +15 s also works while paused
  s = run(s, [[{ type: "resume" }, T0 + 100_000]]).state;
  assert.equal(remainingMs(s, T0 + 100_000), 80_000);
  // transition rest
  s = run(s, [[{ type: "skip_rest" }, T0 + 101_000], [{ type: "rep_done" }, T0 + 102_000], [{ type: "rep_done" }, T0 + 103_000], [{ type: "rep_done" }, T0 + 104_000]]).state;
  assert.equal(restKind(s), "transition");
  s = run(s, [[{ type: "pause" }, T0 + 114_000], [{ type: "resume" }, T0 + 200_000]]).state;
  assert.equal(remainingMs(s, T0 + 200_000), 50_000);
  // timed hold
  s = run(s, [[{ type: "skip_rest" }, T0 + 201_000], [{ type: "pause" }, T0 + 206_000], [{ type: "tick" }, T0 + 260_000]]).state;
  assert.equal(s.phase, "work");
  assert.equal(remainingMs(s, T0 + 260_000), 15_000); // hold never completes while paused
});

test("rest duration follows the prescription (restSeconds) of each exercise", () => {
  const goblet = { ...squat, name: "Goblet Squat", restSeconds: 90 };
  const deadBug = { ...lunge, order: 2, name: "Dead Bug", restSeconds: 45 };
  const s1 = run(createInitialState([goblet]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 1], [{ type: "rep_done" }, T0 + 2], [{ type: "rep_done" }, T0 + 3],
  ]).state;
  assert.equal(remainingMs(s1, T0 + 3), 90_000);
  const s2 = run(createInitialState([deadBug]), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 1], [{ type: "rep_done" }, T0 + 2], [{ type: "rep_done" }, T0 + 3], [{ type: "rep_done" }, T0 + 4],
  ]).state;
  assert.equal(remainingMs(s2, T0 + 4), 45_000);
});

test("refresh during a transition rest restores the next exercise and the time left", () => {
  const exercises = [{ ...squat, sets: 1 }, plank];
  const s = run(createInitialState(exercises), [
    [{ type: "begin" }, T0], [{ type: "skip_prepare" }, T0],
    [{ type: "rep_done" }, T0 + 1], [{ type: "rep_done" }, T0 + 2], [{ type: "rep_done" }, T0 + 3],
    [{ type: "tick" }, T0 + 20_003],
  ]).state;
  const row = { ...toCheckpoint(s, exercises), revision: 4, updated_at: new Date(T0 + 20_003).toISOString() };
  const restored = restoreFromCheckpoint(exercises, row);
  assert.equal(restored.exerciseIndex, 1);
  assert.equal(restKind(restored), "transition");
  assert.equal(restored.paused, true);
  const resumed = reduce(restored, { type: "resume" }, T0 + 600_000).state;
  assert.equal(remainingMs(resumed, T0 + 600_000), 40_000);
  const done = run(resumed, [[{ type: "tick" }, T0 + 620_000], [{ type: "tick" }, T0 + 640_000]]);
  assert.equal(done.state.phase, "work");
  assert.equal(done.state.exerciseIndex, 1);
  assert.equal(recorded(done.effects).length, 0); // transition creates no set
});
