import assert from "node:assert/strict";
import { test } from "node:test";
import {
  estimateExerciseSeconds,
  estimateWorkoutSeconds,
  toMinutes,
} from "../../src/lib/program/estimate.ts";

const squat = {
  sets: 2, target: 12, measureType: "reps", sideMode: "none",
  tempo: { eccentric: 3, pause: 1, concentric: 1 }, restSeconds: 60,
};

test("bilateral rep exercise: reps × tempo per set, rest between sets (no per-set countdown)", () => {
  // per set 12 × 5 = 60; 2 sets + 1 rest = 120 + 60
  assert.equal(estimateExerciseSeconds(squat), 180);
});

test("unilateral exercise counts both sides per set", () => {
  const lunge = { ...squat, sideMode: "per_side", target: 10, tempo: { eccentric: 2, pause: 1, concentric: 2 } };
  // per set 2 × (10 × 5) = 100; 2 sets + 60 rest
  assert.equal(estimateExerciseSeconds(lunge), 260);
});

test("timed holds use seconds, not tempo", () => {
  const plank = { sets: 3, target: 30, measureType: "seconds", sideMode: "none", tempo: null, restSeconds: 60 };
  // per set 30; 3 sets + 2 rests
  assert.equal(estimateExerciseSeconds(plank), 210);
});

test("workout total: one 10 s countdown, 60 s transitions, nothing after the last set", () => {
  const plank = { sets: 2, target: 20, measureType: "seconds", sideMode: "none", tempo: null, restSeconds: 60 };
  // 10 prep + squat 180 + 60 transition + plank (2 × 20 + 60) = 350
  assert.equal(estimateWorkoutSeconds([squat, plank]), 10 + 180 + 60 + 100);
  assert.equal(estimateWorkoutSeconds([squat]), 190);
  assert.equal(estimateWorkoutSeconds([]), 0);
  assert.equal(toMinutes(61), 2);
});
