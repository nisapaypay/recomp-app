import assert from "node:assert/strict";
import { test } from "node:test";
import { bounds, completionRatio, decideAdjustment, PAIN_NOTE } from "../../src/lib/progression/adaptive.ts";

const META = {
  compound: { movementType: "compound", step: 2, headroom: 4, regressionRoom: 4, maxExtraSets: 1 },
  compoundUni: { movementType: "compound", step: 1, headroom: 2, regressionRoom: 3, maxExtraSets: 1 },
  isolation: { movementType: "isolation", step: 2, headroom: 5, regressionRoom: 4, maxExtraSets: 1 },
  coreUni: { movementType: "core", step: 1, headroom: 2, regressionRoom: 3, maxExtraSets: 1 },
  plank: { movementType: "core", step: 5, headroom: 15, regressionRoom: 10, maxExtraSets: 0 },
  mobility: { movementType: "mobility", step: 0, headroom: 0, regressionRoom: 0, maxExtraSets: 0 },
};

/** A fully completed exercise by default. */
function ex(id, o = {}) {
  const sets = o.sets ?? 2;
  const target = o.target ?? 12;
  const sideMode = o.sideMode ?? "none";
  const sides = sideMode === "none" ? 1 : 2;
  return {
    exerciseId: id,
    name: o.name ?? id,
    order: o.order ?? 1,
    measureType: o.measureType ?? "reps",
    sideMode,
    status: o.status ?? "completed",
    prescribedSets: sets,
    prescribedTarget: target,
    base: o.base ?? { sets, targetMin: target, targetMax: target },
    meta: o.meta ?? META.compound,
    rows: o.rows ?? Array.from({ length: sets * sides }, () => ({ achieved: target, status: "completed" })),
    lastAdjustedAt: o.lastAdjustedAt ?? null,
  };
}

test("Just Right never changes anything", () => {
  const d = decideAdjustment({ difficulty: "just_right", painReported: false, exercises: [ex("goblet-squat")] });
  assert.equal(d.adjustment, null);
  assert.match(d.message, /stay the same/);
});

test("Too Easy, compound: +2 reps on one exercise only, sets unchanged", () => {
  const d = decideAdjustment({
    difficulty: "too_easy",
    painReported: false,
    exercises: [ex("goblet-squat", { name: "Goblet Squat" }), ex("bent-over-row", { order: 2 })],
  });
  assert.deepEqual(
    { ...d.adjustment, reason: undefined },
    { exerciseId: "goblet-squat", exerciseName: "Goblet Squat", changeType: "increase_target", previousSets: 2, previousTarget: 12, newSets: 2, newTarget: 14, reason: undefined },
  );
  assert.match(d.adjustment.reason, /12 reps → 14 reps/);
  assert.match(d.adjustment.reason, /Weight stays the same/);
});

test("Too Easy at the ceiling adds ONE set (target unchanged); beyond max sets → next exercise", () => {
  const atTop = ex("goblet-squat", { target: 16, base: { sets: 2, targetMin: 12, targetMax: 12 } });
  const d = decideAdjustment({ difficulty: "too_easy", painReported: false, exercises: [atTop] });
  assert.equal(d.adjustment.changeType, "increase_sets");
  assert.equal(d.adjustment.newSets, 3);
  assert.equal(d.adjustment.newTarget, 16);
  const maxed = ex("goblet-squat", { sets: 3, target: 16, base: { sets: 2, targetMin: 12, targetMax: 12 } });
  const other = ex("bent-over-row", { order: 2 });
  const d2 = decideAdjustment({ difficulty: "too_easy", painReported: false, exercises: [maxed, other] });
  assert.equal(d2.adjustment.exerciseId, "bent-over-row");
});

test("Too Easy steps never jump past the ceiling", () => {
  const near = ex("goblet-squat", { target: 15, base: { sets: 2, targetMin: 12, targetMax: 12 } });
  const d = decideAdjustment({ difficulty: "too_easy", painReported: false, exercises: [near] });
  assert.equal(d.adjustment.newTarget, 16); // ceiling 12 + 4, not 17
});

test("Too Easy, isolation uses its own range (+5 headroom)", () => {
  const curl = ex("calf-raise", { target: 15, meta: META.isolation });
  assert.equal(bounds(curl).ceiling, 20);
  const d = decideAdjustment({ difficulty: "too_easy", painReported: false, exercises: [curl] });
  assert.equal(d.adjustment.newTarget, 17);
});

test("Too Easy, unilateral: +1 rep per side (applies to both sides)", () => {
  const lunge = ex("dumbbell-reverse-lunge", { target: 10, sideMode: "per_side", meta: META.compoundUni });
  const d = decideAdjustment({ difficulty: "too_easy", painReported: false, exercises: [lunge] });
  assert.equal(d.adjustment.newTarget, 11);
  assert.match(d.adjustment.reason, /10 reps per side → 11 reps per side/);
});

test("Too Easy, core: dead bug +1 per side; plank changes seconds and never adds sets", () => {
  const deadBug = ex("dead-bug", { target: 10, sideMode: "per_side", meta: META.coreUni });
  assert.equal(decideAdjustment({ difficulty: "too_easy", painReported: false, exercises: [deadBug] }).adjustment.newTarget, 11);
  const plank = ex("plank", { measureType: "seconds", target: 20, meta: META.plank });
  const d = decideAdjustment({ difficulty: "too_easy", painReported: false, exercises: [plank] });
  assert.equal(d.adjustment.changeType, "increase_target");
  assert.equal(d.adjustment.newTarget, 25);
  assert.match(d.adjustment.reason, /20 s → 25 s/);
  const plankTop = ex("plank", { measureType: "seconds", target: 35, base: { sets: 2, targetMin: 20, targetMax: 20 }, meta: META.plank });
  assert.equal(decideAdjustment({ difficulty: "too_easy", painReported: false, exercises: [plankTop] }).adjustment, null);
});

test("Too Easy only uses fully completed exercises; never with pain; never mobility", () => {
  const partial = ex("goblet-squat", { status: "partial", rows: [{ achieved: 12, status: "completed" }, { achieved: 8, status: "partial" }] });
  const skipped = ex("bent-over-row", { status: "skipped", rows: [], order: 2 });
  const circles = ex("arm-circles", { meta: META.mobility, order: 3 });
  const d = decideAdjustment({ difficulty: "too_easy", painReported: false, exercises: [partial, skipped, circles] });
  assert.equal(d.adjustment, null);
  const pain = decideAdjustment({ difficulty: "too_easy", painReported: true, exercises: [ex("goblet-squat")] });
  assert.equal(pain.adjustment, null);
  assert.equal(pain.message, PAIN_NOTE);
});

test("Too Easy rotates: the least recently adjusted exercise goes first", () => {
  const squat = ex("goblet-squat", { lastAdjustedAt: "2026-11-16T10:00:00Z" });
  const row = ex("bent-over-row", { order: 2 });
  const d = decideAdjustment({ difficulty: "too_easy", painReported: false, exercises: [squat, row] });
  assert.equal(d.adjustment.exerciseId, "bent-over-row");
});

test("Too Hard: the least completed exercise eases by one step (compound first on ties)", () => {
  const squat = ex("goblet-squat", { order: 1 });
  const row = ex("bent-over-row", { order: 2, status: "partial", rows: [{ achieved: 12, status: "completed" }, { achieved: 6, status: "partial" }] });
  const d = decideAdjustment({ difficulty: "too_hard", painReported: false, exercises: [squat, row] });
  assert.equal(d.adjustment.exerciseId, "bent-over-row");
  assert.equal(d.adjustment.changeType, "decrease_target");
  assert.equal(d.adjustment.newTarget, 10);
  assert.equal(d.adjustment.newSets, 2);
  assert.match(d.adjustment.reason, /75% of the target/);
  assert.doesNotMatch(d.adjustment.reason, /fail/i);
  const curl = ex("bicep-curl", { meta: META.isolation, order: 1 });
  const press = ex("shoulder-press", { order: 2 });
  assert.equal(decideAdjustment({ difficulty: "too_hard", painReported: false, exercises: [curl, press] }).adjustment.exerciseId, "shoulder-press");
});

test("Too Hard removes an added set first, then lowers reps to the floor, then drops a set", () => {
  const extra = ex("goblet-squat", { sets: 3, target: 14, base: { sets: 2, targetMin: 12, targetMax: 12 } });
  const d1 = decideAdjustment({ difficulty: "too_hard", painReported: false, exercises: [extra] }).adjustment;
  assert.deepEqual([d1.changeType, d1.newSets, d1.newTarget], ["decrease_sets", 2, 14]);
  const atFloor = ex("goblet-squat", { target: 8, base: { sets: 2, targetMin: 12, targetMax: 12 } });
  const d2 = decideAdjustment({ difficulty: "too_hard", painReported: false, exercises: [atFloor] }).adjustment;
  assert.deepEqual([d2.changeType, d2.newSets, d2.newTarget], ["decrease_sets", 1, 8]);
  const bottom = ex("goblet-squat", { sets: 1, target: 8, base: { sets: 2, targetMin: 12, targetMax: 12 } });
  assert.equal(decideAdjustment({ difficulty: "too_hard", painReported: false, exercises: [bottom] }).adjustment, null);
});

test("Too Hard never touches a skipped exercise; pain adds a safety note but still eases", () => {
  const skipped = ex("goblet-squat", { status: "skipped", rows: [{ achieved: 0, status: "skipped" }, { achieved: 0, status: "skipped" }] });
  const done = ex("bent-over-row", { order: 2 });
  const d = decideAdjustment({ difficulty: "too_hard", painReported: true, exercises: [skipped, done] });
  assert.equal(d.adjustment.exerciseId, "bent-over-row");
  assert.ok(d.message.includes(PAIN_NOTE));
});

test("plank floor is 10 s; reps floor is 4", () => {
  assert.equal(bounds(ex("plank", { measureType: "seconds", target: 15, base: { sets: 2, targetMin: 15, targetMax: 20 }, meta: META.plank })).floor, 10);
  assert.equal(bounds(ex("x", { target: 6, base: { sets: 2, targetMin: 6, targetMax: 6 } })).floor, 4);
});

test("completion ratio counts sides and treats skipped sets as zero", () => {
  const lunge = ex("dumbbell-reverse-lunge", {
    target: 10, sideMode: "per_side", meta: META.compoundUni,
    rows: [{ achieved: 10, status: "completed" }, { achieved: 10, status: "completed" }, { achieved: 5, status: "partial" }, { achieved: 0, status: "skipped" }],
  });
  assert.equal(completionRatio(lunge), 25 / 40);
});
