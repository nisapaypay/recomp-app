import assert from "node:assert/strict";
import { test } from "node:test";
import { isCatchUp, performedDate, workoutStartAvailability } from "../../src/lib/program/start-rules.ts";

const base = { programStart: "2026-11-09", programEnd: "2027-01-31", completed: false, activeElsewhere: false };

test("today's strength workout can be started", () => {
  assert.deepEqual(
    workoutStartAvailability({ ...base, date: "2026-11-11", today: "2026-11-11", activity: "upper_body_core" }),
    { kind: "available", catchUp: false },
  );
});

test("a past strength workout that isn't completed is a catch-up (Monday's on Tuesday)", () => {
  assert.deepEqual(
    workoutStartAvailability({ ...base, date: "2026-11-09", today: "2026-11-10", activity: "lower_body" }),
    { kind: "available", catchUp: true, daysLate: 1 },
  );
  // Older weeks too, while the program runs.
  assert.equal(workoutStartAvailability({ ...base, date: "2026-11-13", today: "2026-11-25", activity: "full_body_core" }).kind, "available");
});

test("a future workout can be viewed but not started", () => {
  assert.deepEqual(
    workoutStartAvailability({ ...base, date: "2026-11-13", today: "2026-11-10", activity: "full_body_core" }),
    { kind: "not_yet", availableOn: "2026-11-13" },
  );
});

test("completed workouts can't be started again; other active session blocks", () => {
  assert.equal(workoutStartAvailability({ ...base, completed: true, date: "2026-11-09", today: "2026-11-10", activity: "lower_body" }).kind, "completed");
  assert.equal(workoutStartAvailability({ ...base, activeElsewhere: true, date: "2026-11-09", today: "2026-11-10", activity: "lower_body" }).kind, "active_elsewhere");
});

test("walking, recovery, rest and out-of-program days are not started here", () => {
  for (const activity of ["walking", "recovery", "rest"]) {
    assert.equal(workoutStartAvailability({ ...base, date: "2026-11-10", today: "2026-11-10", activity }).kind, "not_a_workout");
  }
  assert.equal(workoutStartAvailability({ ...base, date: "2026-11-02", today: "2026-11-10", activity: "lower_body" }).kind, "outside_program");
});

test("catch-up detection uses the Jakarta calendar date of performed_at", () => {
  // 2026-11-09 18:00 UTC = 10 Nov 01:00 in Jakarta → performed the day after Monday.
  assert.equal(performedDate("2026-11-09T18:00:00Z"), "2026-11-10");
  assert.equal(isCatchUp("2026-11-09", "2026-11-09T18:00:00Z"), true);
  assert.equal(isCatchUp("2026-11-09", "2026-11-09T10:00:00Z"), false); // same Jakarta day
  assert.equal(isCatchUp("2026-11-09", null), false); // not performed → never counted
});
