import assert from "node:assert/strict";
import { test } from "node:test";
import { SUSPEND_THRESHOLD_MS, createInitialState, reduce } from "../../src/lib/engine/workout-engine.ts";
import { restoreFromCheckpoint, toCheckpoint } from "../../src/lib/engine/checkpoint.ts";
import { animationTime, movementAt } from "../../src/lib/animation/movement.ts";
import { EXERCISE_FIGURES, figureFor } from "../../src/lib/animation/exercises.ts";
import { capsulePath, figurePrimitives, isMirrored, skeletonAt } from "../../src/lib/animation/figure.ts";

const T0 = Date.parse("2026-11-16T08:00:00Z");
const goblet = { order: 1, name: "Goblet Squat", measureType: "reps", sideMode: "none", sets: 2, target: 12, tempo: { eccentric: 3, pause: 1, concentric: 1 }, tempoStart: "eccentric", restSeconds: 90 };
const lunge = { order: 2, name: "Reverse Lunge", measureType: "reps", sideMode: "per_side", sets: 1, target: 2, tempo: { eccentric: 2, pause: 1, concentric: 2 }, tempoStart: "eccentric", restSeconds: 60 };
const plank = { order: 3, name: "Plank", measureType: "seconds", sideMode: "none", sets: 1, target: 20, tempo: null, tempoStart: "eccentric", restSeconds: 60 };

function step(state, action, at) {
  return reduce(state, action, at).state;
}
/** Start a workout and skip the 10 s countdown at T0 → work begins at T0. */
function working(exercises) {
  let s = step(createInitialState(exercises), { type: "begin" }, T0 - 1000);
  return step(s, { type: "skip_prepare" }, T0);
}
const deepFreeze = (o) => {
  Object.freeze(o);
  for (const v of Object.values(o)) if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v);
  return o;
};

test("1. tempo 3-1-1: eccentric 0–3 s goes down, hold 3–4 s stays at the bottom, concentric 4–5 s comes up", () => {
  const s = working([goblet]);
  const at = (ms) => movementAt(s, T0 + ms);
  assert.equal(at(0).tempoPhase, "eccentric");
  assert.equal(at(0).amount, 0);
  assert.ok(at(1500).amount > 0.4 && at(1500).amount < 0.6);
  assert.equal(at(2999).tempoPhase, "eccentric");
  assert.ok(at(2999).amount > 0.99);
  assert.equal(at(3000).tempoPhase, "hold");
  assert.equal(at(3500).amount, 1);
  assert.equal(at(4000).tempoPhase, "concentric");
  assert.ok(at(4500).amount > 0.4 && at(4500).amount < 0.6);
  assert.ok(at(4999).amount < 0.01);
  // Monotonic down then up.
  for (let ms = 0; ms < 2900; ms += 100) assert.ok(at(ms + 100).amount >= at(ms).amount);
  for (let ms = 4000; ms < 4900; ms += 100) assert.ok(at(ms + 100).amount <= at(ms).amount);
});

test("2 + 3. one animation cycle = one counted rep; 12 reps with jittery ticks never drift", () => {
  let s = working([goblet]);
  let t = T0;
  let lastReps = 0;
  const jitter = [250, 230, 270, 250, 400, 120, 250];
  for (let i = 0; s.phase === "work" && s.exerciseIndex === 0 && s.setNumber === 1 && i < 1000; i++) {
    t += jitter[i % jitter.length];
    s = step(s, { type: "tick" }, t);
    if (s.phase !== "work") break;
    const m = movementAt(s, t);
    const elapsedCycles = Math.floor((t - T0) / 5000);
    // The engine's rep count is exactly the number of finished animation cycles.
    assert.equal(s.reps, elapsedCycles, `at ${t - T0} ms`);
    // The figure's position inside the cycle matches the wall-clock position.
    assert.ok(Math.abs(m.cycle - ((t - T0) % 5000) / 5000) < 1e-9);
    if (s.reps !== lastReps) {
      assert.equal(s.reps, lastReps + 1);
      lastReps = s.reps;
    }
  }
  assert.equal(lastReps, 11); // the 12th cycle finishes the set → rest
  assert.equal(s.phase, "rest");
  assert.equal(movementAt(s, t).mode, "preview");
});

test("rest previews the coming exercise at its tempo (paused → frozen), without counting reps", () => {
  let s = working([goblet, lunge]);
  s = step(s, { type: "tick" }, T0 + 60_000); // set 1 done → rest starts at T0 + 60 s
  assert.equal(s.phase, "rest");
  const restStart = s.phaseStartedAt;
  const at = (ms) => movementAt(s, restStart + ms);
  assert.equal(at(0).amount, 0);
  assert.equal(at(1500).tempoPhase, "eccentric");
  assert.ok(at(1500).amount > 0.4 && at(1500).amount < 0.6);
  assert.equal(at(3500).amount, 1);
  assert.ok(Math.abs(at(6500).cycle - 0.3) < 1e-9); // keeps looping
  s = step(s, { type: "tick" }, restStart + 20_000);
  assert.equal(s.reps, 0); // nothing counted during rest
  s = step(s, { type: "pause" }, restStart + 21_000);
  assert.equal(movementAt(s, restStart + 80_000).amount, movementAt(s, restStart + 21_000).amount);

  // Transition rest previews the NEXT exercise (the engine already points at it).
  let t = working([{ ...goblet, sets: 1, target: 1 }, lunge]);
  t = step(t, { type: "tick" }, T0 + 5000);
  assert.equal(t.phase, "rest");
  const m = movementAt(t, T0 + 6000);
  assert.equal(m.exerciseIndex, 1);
  assert.equal(m.mode, "preview");

  // Preparation countdown previews the first exercise too.
  const prep = step(createInitialState([plank]), { type: "begin" }, T0);
  assert.equal(movementAt(prep, T0 + 1000).mode, "preview");
});

test("3b. between the last cycle's end and the next tick the figure stays in the start position", () => {
  let s = working([{ ...goblet, target: 1 }]);
  s = step(s, { type: "tick" }, T0 + 4900);
  const m = movementAt(s, T0 + 5100); // engine hasn't ticked past 5 s yet
  assert.equal(m.amount, 0);
  assert.equal(s.reps, 0);
});

test("4 + 5. pause freezes the figure; resume continues from the same position", () => {
  let s = working([goblet]);
  s = step(s, { type: "tick" }, T0 + 1800);
  s = step(s, { type: "pause" }, T0 + 1800);
  const frozen = movementAt(s, T0 + 1800);
  for (const later of [5_000, 60_000, 600_000]) {
    const m = movementAt(s, T0 + 1800 + later);
    assert.equal(m.amount, frozen.amount);
    assert.equal(m.cycle, frozen.cycle);
    assert.equal(m.frozen, true);
  }
  const resumeAt = T0 + 1800 + 42_000;
  s = step(s, { type: "resume" }, resumeAt);
  const resumed = movementAt(s, resumeAt);
  assert.ok(Math.abs(resumed.amount - frozen.amount) < 1e-9);
  assert.equal(resumed.tempoPhase, "eccentric");
  assert.ok(movementAt(s, resumeAt + 500).amount > resumed.amount); // keeps lowering
});

test("6. background tab: throttled ticks catch up exactly; a sleep gap never jumps ahead", () => {
  // Throttled (one tick per 20 s): position still equals the true tempo position.
  let s = working([goblet]);
  s = step(s, { type: "tick" }, T0 + 20_000);
  s = step(s, { type: "tick" }, T0 + 40_000);
  assert.equal(s.reps, 8);
  const m = movementAt(s, T0 + 41_500);
  assert.equal(m.tempoPhase, "eccentric");
  assert.ok(Math.abs(m.cycle - 0.3) < 1e-9);

  // Sleep: before the engine's next tick the figure holds at the last tick,
  // the exact moment the engine pauses at.
  let z = working([goblet]);
  z = step(z, { type: "tick" }, T0 + 2000);
  const woke = T0 + 2000 + SUSPEND_THRESHOLD_MS + 5000;
  assert.equal(animationTime(z, woke), T0 + 2000);
  const before = movementAt(z, woke);
  z = step(z, { type: "tick" }, woke);
  assert.equal(z.paused, true);
  assert.equal(z.pauseReason, "suspended");
  const after = movementAt(z, woke);
  assert.equal(before.amount, after.amount);
});

test("7. refresh / recovery: the restored state shows the saved exercise, side and set, then restarts the rep cleanly", () => {
  let s = working([goblet, lunge]);
  s = step(s, { type: "tick" }, T0 + 12_000); // 2 reps + 2 s
  const row = { ...toCheckpoint(s, [goblet, lunge]), revision: 2, updated_at: new Date(T0 + 12_000).toISOString() };
  let r = restoreFromCheckpoint([goblet, lunge], row);
  assert.equal(r.reps, 2);
  const m = movementAt(r, T0 + 90_000);
  assert.equal(m.frozen, true);
  assert.equal(m.exerciseIndex, 0);
  assert.equal(m.amount, 0); // start position until the user resumes
  r = step(r, { type: "resume" }, T0 + 95_000);
  assert.equal(movementAt(r, T0 + 95_000).amount, 0);
  r = step(r, { type: "tick" }, T0 + 95_000 + 5000);
  assert.equal(r.reps, 3); // continues counting from the checkpoint
});

test("8. unilateral: left reps don't finish the set; the figure switches to the right side (mirrored)", () => {
  let s = working([lunge]);
  assert.equal(movementAt(s, T0).side, "left");
  assert.equal(isMirrored(movementAt(s, T0)), false);
  s = step(s, { type: "tick" }, T0 + 5000);
  assert.equal(s.reps, 1);
  s = step(s, { type: "tick" }, T0 + 10_000); // both left reps
  assert.equal(s.phase, "work");
  assert.equal(s.side, "right");
  assert.equal(s.reps, 0);
  const m = movementAt(s, T0 + 10_000);
  assert.equal(m.side, "right");
  assert.equal(isMirrored(m), true);
  assert.equal(m.amount, 0);
  s = step(s, { type: "tick" }, T0 + 20_000);
  assert.equal(s.phase, "complete"); // only after both sides
  assert.equal(movementAt(s, T0 + 20_000), null);
});

test("9. plank follows the hold's duration, not a repetition cycle", () => {
  let s = working([plank]);
  const m0 = movementAt(s, T0);
  assert.equal(m0.mode, "hold");
  assert.equal(m0.tempoPhase, null);
  assert.equal(movementAt(s, T0 + 5000).holdProgress, 0.25);
  assert.equal(movementAt(s, T0 + 10_000).holdProgress, 0.5);
  s = step(s, { type: "pause" }, T0 + 10_000);
  assert.equal(movementAt(s, T0 + 99_000).holdProgress, 0.5);
  assert.equal(movementAt(s, T0 + 10_000, { reducedMotion: true }).amount, 0); // no breathing motion
});

test("10. the animation only reads the engine state (frozen state, unchanged results)", () => {
  let s = working([goblet]);
  s = step(s, { type: "tick" }, T0 + 7000);
  const frozen = deepFreeze(structuredClone(s));
  assert.doesNotThrow(() => movementAt(frozen, T0 + 7300));
  assert.deepEqual(frozen, s);
});

test("skip rest starts the next set from the start position; skip exercise moves the figure on", () => {
  let s = working([goblet, lunge]);
  s = step(s, { type: "tick" }, T0 + 60_000); // set 1 done → rest
  assert.equal(s.phase, "rest");
  s = step(s, { type: "skip_rest" }, T0 + 61_000);
  assert.equal(movementAt(s, T0 + 61_000).amount, 0);
  s = step(s, { type: "skip_exercise" }, T0 + 62_000);
  assert.equal(movementAt(s, T0 + 62_000).exerciseIndex, 1);
});

test("reduced motion: one position per tempo phase, no in-between frames", () => {
  const s = working([goblet]);
  const r = (ms) => movementAt(s, T0 + ms, { reducedMotion: true }).amount;
  assert.deepEqual([r(100), r(2000), r(3500), r(4200)], [1, 1, 1, 0]);
});

test("every library exercise has its own figure with valid geometry", () => {
  const ids = ["bodyweight-squat", "glute-bridge", "reverse-lunge", "donkey-kick", "calf-raise", "wall-push-up", "arm-circles", "bird-dog", "dead-bug", "prone-w-raise", "sumo-squat", "side-lying-leg-raise", "standing-knee-raise", "plank", "goblet-squat", "dumbbell-glute-bridge", "dumbbell-reverse-lunge", "dumbbell-calf-raise", "shoulder-press", "one-arm-dumbbell-row", "bicep-curl", "lateral-raise", "overhead-triceps-extension", "dumbbell-romanian-deadlift", "bent-over-row", "dumbbell-sumo-squat"];
  assert.equal(Object.keys(EXERCISE_FIGURES).length, ids.length);
  for (const id of ids) {
    const cfg = figureFor(id);
    assert.ok(cfg, id);
    for (const amount of [0, 0.25, 0.5, 0.75, 1]) {
      for (const p of figurePrimitives(cfg, { amount, cycle: amount, side: null })) {
        const nums =
          p.type === "capsule" ? [...p.from, ...p.to, p.r1, p.r2]
          : p.type === "circle" ? [...p.at, p.r]
          : p.type === "ellipse" ? [...p.at, p.rx, p.ry]
          : [p.x, p.y, p.w, p.h];
        assert.ok(nums.every(Number.isFinite), `${id} @ ${amount}`);
      }
    }
    // Start and peak differ (no static "generic" figure), except the plank's breathing which is subtle.
    const a = skeletonAt(cfg, { amount: 0, cycle: 0, side: null });
    const b = skeletonAt(cfg, { amount: 1, cycle: 0.5, side: null });
    const moved = Object.keys(a).some((k) => Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1]) > (id === "plank" ? 0.5 : 5));
    assert.ok(moved, `${id} should move`);
  }
  assert.equal(figureFor("unknown-exercise"), null);
});

test("planted feet stay on the floor during squats and lunges", () => {
  for (const id of ["bodyweight-squat", "goblet-squat", "dumbbell-romanian-deadlift"]) {
    const cfg = figureFor(id);
    for (const amount of [0, 0.5, 1]) {
      const sk = skeletonAt(cfg, { amount, cycle: 0, side: null });
      assert.ok(Math.abs(sk.ankleA[1] - 146) < 0.5 && Math.abs(sk.ankleB[1] - 146) < 0.5, `${id} @ ${amount}`);
    }
  }
});

test("capsule paths are well-formed and the figure is clothed (long sleeves, long trousers)", () => {
  const d = capsulePath([0, 0], [10, 0], 3, 2);
  assert.match(d, /^M[-\d. ]+L[-\d. ]+A[-\d. ]+L[-\d. ]+A[-\d. ]+Z$/);
  assert.ok(!d.includes("NaN"));
  const prims = figurePrimitives(figureFor("bodyweight-squat"), { amount: 0.5, cycle: 0, side: null });
  const fills = new Set(prims.map((p) => p.fill));
  for (const colour of ["#7556d4", "#3f3b4d", "#eebf9c", "#3b2a26"]) assert.ok(fills.has(colour), colour);
});

import { demoCycleMs, demoMovement } from "../../src/lib/animation/movement.ts";
import { PALETTE } from "../../src/lib/animation/figure.ts";

test("demo (library cover / interactive demo) uses the same tempo maths: one loop = one rep", () => {
  const ex = { measureType: "reps", tempo: { eccentric: 3, pause: 1, concentric: 1 }, tempoStart: "eccentric" };
  assert.equal(demoCycleMs(ex), 5000);
  assert.equal(demoMovement(ex, 0, null).amount, 0);
  assert.equal(demoMovement(ex, 3500, null).tempoPhase, "hold");
  assert.equal(demoMovement(ex, 3500, null).amount, 1);
  assert.equal(demoMovement(ex, 12_000, null).rep, 3);
  assert.equal(demoMovement(ex, 12_000, null).stepIndex, 0);
  const hold = { measureType: "seconds", tempo: null, tempoStart: "eccentric" };
  assert.equal(demoMovement(hold, 2000, null).tempoPhase, null);
  assert.equal(demoMovement(hold, 2000, null, true).amount, 0);
});

test("focus muscles are painted red, only on the working side for unilateral exercises", () => {
  const red = (id, muscles, side = null) =>
    figurePrimitives(figureFor(id), { amount: 0.5, cycle: 0, side }, { muscles }).filter((p) => p.fill === PALETTE.muscle);
  assert.equal(red("bodyweight-squat", []).length, 0);
  // Squat: quads on both legs + glutes.
  assert.equal(red("bodyweight-squat", ["quadriceps", "glutes"]).length, 3);
  // Reverse lunge works the front leg (legA) → quads on one leg only.
  assert.equal(red("reverse-lunge", ["quadriceps"]).length, 1);
  // Curl: biceps on both arms.
  assert.equal(red("bicep-curl", ["biceps"]).length, 2);
  // Unknown muscle names draw nothing.
  assert.equal(red("plank", ["spleen"]).length, 0);
});
