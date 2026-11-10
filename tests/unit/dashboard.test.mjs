import assert from "node:assert/strict";
import { test } from "node:test";
import { STATUS_LABEL, nextActivity, primaryWorkoutAction, weeklyActivity } from "../../src/lib/program/dashboard.ts";
import { dayStatus } from "../../src/lib/program/calendar.ts";

// Week 2: Mon 16 … Sun 22 Nov 2026. Today = Thursday 19.
const TODAY = "2026-11-19";
const plan = [
  ["2026-11-16", "lower_body", "Lower Body", true],
  ["2026-11-17", "walking", "Walking", true],
  ["2026-11-18", "upper_body_core", "Upper Body & Core", false],
  ["2026-11-19", "recovery", "Recovery / Stretching", false],
  ["2026-11-20", "full_body_core", "Full Body & Core", false],
  ["2026-11-21", "walking", "Walking", false],
  ["2026-11-22", "rest", "Rest", false],
];
const week = plan.map(([date, activity, activityLabel, done]) => ({
  date, activity, activityLabel, status: dayStatus({ date, today: TODAY, activity, completed: done }),
}));

test("statuses: completed, late (this week), due today, upcoming, missed (earlier week)", () => {
  assert.deepEqual(week.map((d) => d.status), ["completed", "completed", "late", "not_configured", "upcoming", "upcoming", "rest"]);
  assert.equal(dayStatus({ date: "2026-11-11", today: TODAY, activity: "upper_body_core", completed: false }), "missed");
  assert.equal(STATUS_LABEL.late, "Late · catch-up");
});

test("weekly activity: each day once; walking time from every walk once; extra walks don't complete program walks", () => {
  const walks = [
    { activityDate: "2026-11-17", scheduledDate: "2026-11-17", durationMinutes: 22, distanceKm: 1.9 },
    { activityDate: "2026-11-18", scheduledDate: null, durationMinutes: 30, distanceKm: 2.4 },
    { activityDate: "2026-11-14", scheduledDate: "2026-11-14", durationMinutes: 20, distanceKm: 1.6 }, // last week
    { activityDate: "2026-11-19", scheduledDate: "2026-11-14", durationMinutes: 21, distanceKm: 1.7 }, // catch-up of last week, done this week
  ];
  const w = weeklyActivity(week, walks);
  assert.deepEqual(w.strength, { done: 1, planned: 3 });
  assert.deepEqual(w.recovery, { done: 0, planned: 1 });
  assert.deepEqual(w.walking, { done: 1, planned: 2, minutes: 73, km: 6, extraWalks: 1 });
});

test("empty week data → zeros, no crash", () => {
  const w = weeklyActivity(week.map((d) => ({ ...d, status: d.activity === "rest" ? "rest" : "upcoming" })), []);
  assert.deepEqual(w.walking, { done: 0, planned: 2, minutes: 0, km: 0, extraWalks: 0 });
});

test("next activity: first non-rest, not done, after today", () => {
  assert.equal(nextActivity(week, TODAY).date, "2026-11-20");
  assert.equal(nextActivity(week, "2026-11-22"), null);
});

test("workout action follows the session/start/catch-up rules", () => {
  assert.equal(primaryWorkoutAction({ activeSessionId: "abc", today: week[3], week }).kind, "continue");
  assert.deepEqual(primaryWorkoutAction({ activeSessionId: null, today: week[3], week }), {
    kind: "catch_up", href: "/workout/day/2026-11-18", label: "Catch up: Upper Body & Core",
  });
  const friday = { ...week[4], status: "today" };
  assert.equal(primaryWorkoutAction({ activeSessionId: null, today: friday, week }).kind, "start");
  const allDone = week.map((d) => ({ ...d, status: d.activity === "rest" ? "rest" : "completed" }));
  assert.equal(primaryWorkoutAction({ activeSessionId: null, today: allDone[3], week: allDone }).kind, "plan");
});
