import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultScheduledDate,
  formatDuration,
  formatPace,
  formatSpeed,
  openScheduledWalks,
  paceSecondsPerKm,
  parseDistance,
  parseDuration,
  parseSteps,
  scheduledWalks,
  speedKmh,
  targetStatus,
  validateActivityDate,
  validateWalk,
  walkingTotals,
  weeklyWalkingCompletion,
} from "../../src/lib/walking/walking.ts";

// Program starts Monday 9 Nov 2026; targets as in the seed (spec table).
const START = "2026-11-09";
const TARGETS = [];
for (let week = 1; week <= 12; week++) {
  for (const day of [2, 6]) {
    const [min, max] =
      week === 1 ? [20, 20] : week <= 4 ? [20, 25] : week <= 8 ? (day === 2 ? [25, 25] : [30, 30]) : [30, 30];
    TARGETS.push({ week, dayOfWeek: day, minMinutes: min, maxMinutes: max });
  }
}
const WALKS = scheduledWalks(START, TARGETS);

test("pace = duration / distance: 30 min over 2.5 km = 12:00 min/km", () => {
  assert.equal(paceSecondsPerKm(30, 2.5), 720);
  assert.equal(formatPace(paceSecondsPerKm(30, 2.5)), "12:00 min/km");
  assert.equal(formatPace(paceSecondsPerKm(25, 2.1)), "11:54 min/km");
});

test("average speed = distance / hours: 2.5 km in 30 min = 5.0 km/h", () => {
  assert.equal(speedKmh(30, 2.5), 5);
  assert.equal(formatSpeed(speedKmh(30, 2.5)), "5.0 km/h");
  assert.equal(formatSpeed(speedKmh(45, 3.2)), "4.3 km/h");
});

test("no calculation from invalid values (never misleading)", () => {
  for (const [min, km] of [[null, 2], [30, null], [0, 2], [30, 0], [-5, 2]]) {
    assert.equal(paceSecondsPerKm(min, km), null);
    assert.equal(speedKmh(min, km), null);
  }
  assert.equal(formatPace(null), null);
  assert.equal(formatSpeed(null), null);
});

test("duration: hours + minutes, whole numbers, 1 min … 10 h", () => {
  assert.deepEqual(parseDuration("", "30"), { ok: true, value: 30 });
  assert.deepEqual(parseDuration("1", "5"), { ok: true, value: 65 });
  assert.equal(parseDuration("0", "0").ok, false);
  assert.equal(parseDuration("0", "75").ok, false); // minutes > 59
  assert.equal(parseDuration("1.5", "0").ok, false);
  assert.equal(parseDuration("-1", "10").ok, false);
  assert.equal(parseDuration("11", "0").ok, false); // > 600 min
  assert.equal(formatDuration(30), "30 min");
  assert.equal(formatDuration(65), "1 h 05 min");
  assert.equal(formatDuration(120), "2 h");
});

test("distance: decimals with dot or comma, > 0, ≤ 100 km", () => {
  assert.deepEqual(parseDistance("2.5"), { ok: true, value: 2.5 });
  assert.deepEqual(parseDistance("2,5"), { ok: true, value: 2.5 });
  assert.deepEqual(parseDistance("3.456"), { ok: true, value: 3.46 });
  assert.equal(parseDistance("").ok, false); // required
  assert.equal(parseDistance("0").ok, false);
  assert.equal(parseDistance("abc").ok, false);
  assert.equal(parseDistance("-2").ok, false);
  assert.equal(parseDistance("150").ok, false);
});

test("steps: optional whole positive number", () => {
  assert.deepEqual(parseSteps(""), { ok: true, value: null });
  assert.deepEqual(parseSteps("4500"), { ok: true, value: 4500 });
  assert.deepEqual(parseSteps("4.500"), { ok: true, value: 4500 }); // thousands separator
  assert.equal(parseSteps("0").ok, false);
  assert.equal(parseSteps("-10").ok, false);
  assert.equal(parseSteps("12.5x").ok, false);
  assert.equal(parseSteps("250000").ok, false);
});

test("date: valid ISO, today or earlier — never the future", () => {
  assert.deepEqual(validateActivityDate("2026-11-17", "2026-11-17"), { ok: true, value: "2026-11-17" });
  assert.equal(validateActivityDate("2026-11-10", "2026-11-17").ok, true);
  assert.equal(validateActivityDate("2026-11-18", "2026-11-17").ok, false);
  assert.equal(validateActivityDate("17/11/2026", "2026-11-17").ok, false);
});

test("program walks: 24 Tue/Sat walks with the spec targets", () => {
  assert.equal(WALKS.length, 24);
  assert.deepEqual(WALKS[0], { date: "2026-11-10", week: 1, dayOfWeek: 2, label: "Tuesday Walking", targetMin: 20, targetMax: 20 });
  const w5 = WALKS.filter((w) => w.week === 5);
  assert.deepEqual(w5.map((w) => [w.label, w.targetMin, w.targetMax]), [["Tuesday Walking", 25, 25], ["Saturday Walking", 30, 30]]);
  assert.deepEqual([WALKS[2].targetMin, WALKS[2].targetMax], [20, 25]); // week 2
});

test("scheduled walking: catch-up allowed, never before its week, logged ones excluded", () => {
  const none = new Set();
  // Wednesday 18 Nov (week 2): Tue 17 open; Sat 21 is the same week → allowed early; earlier weeks → catch-up.
  const open = openScheduledWalks(WALKS, none, "2026-11-18").map((w) => w.date);
  assert.deepEqual(open, ["2026-11-10", "2026-11-14", "2026-11-17", "2026-11-21"]);
  // Logged walks can't be chosen again, except the one being edited.
  const logged = new Set(["2026-11-17"]);
  assert.ok(!openScheduledWalks(WALKS, logged, "2026-11-18").some((w) => w.date === "2026-11-17"));
  assert.ok(openScheduledWalks(WALKS, logged, "2026-11-18", "2026-11-17").some((w) => w.date === "2026-11-17"));
  // Default: the most recent reached walk of this week.
  assert.equal(defaultScheduledDate(openScheduledWalks(WALKS, none, "2026-11-18"), "2026-11-18"), "2026-11-17");
  assert.equal(defaultScheduledDate(openScheduledWalks(WALKS, none, "2026-11-16"), "2026-11-16"), null); // Monday: additional
});

const ctx = { today: "2026-11-19", walks: WALKS, loggedDates: new Set(["2026-11-14"]) };
const base = { activityDate: "2026-11-19", hours: "", minutes: "30", distance: "2.5", steps: "", notes: "", scheduledDate: "2026-11-17" };

test("validate: scheduled walk (Tuesday walk logged on Thursday) keeps its scheduled date", () => {
  const r = validateWalk(base, ctx);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { activityDate: "2026-11-19", durationMinutes: 30, distanceKm: 2.5, steps: null, notes: null, scheduledDate: "2026-11-17" });
});

test("validate: additional walk has no scheduled date", () => {
  const r = validateWalk({ ...base, scheduledDate: "", steps: "3200", notes: "  park  " }, ctx);
  assert.equal(r.ok, true);
  assert.equal(r.value.scheduledDate, null);
  assert.equal(r.value.steps, 3200);
  assert.equal(r.value.notes, "park");
});

test("validate: duplicate scheduled walk refused; editing that same log is fine", () => {
  const dup = validateWalk({ ...base, scheduledDate: "2026-11-14" }, ctx);
  assert.equal(dup.ok, false);
  assert.match(dup.errors.scheduledDate, /already logged/);
  const edit = validateWalk({ ...base, scheduledDate: "2026-11-14" }, { ...ctx, editingScheduledDate: "2026-11-14" });
  assert.equal(edit.ok, true);
});

test("validate: errors per field, future date, not a program walk, week not started", () => {
  const r = validateWalk({ ...base, activityDate: "2026-11-20", minutes: "0", distance: "", steps: "-1" }, ctx);
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ["activityDate", "distance", "duration", "steps"]);
  assert.equal(validateWalk({ ...base, scheduledDate: "2026-11-18" }, ctx).errors.scheduledDate, "That isn't one of your program walks.");
  const early = validateWalk({ ...base, activityDate: "2026-11-13", scheduledDate: "2026-11-17" }, ctx);
  assert.match(early.errors.scheduledDate, /hadn't started/);
});

test("target status: met at or above the minimum target", () => {
  assert.equal(targetStatus(20, 20), "met");
  assert.equal(targetStatus(19, 20), "below");
  assert.equal(targetStatus(31, 30), "met");
});

test("weekly completion counts scheduled walks only; additional walks never add", () => {
  const week2 = WALKS.filter((w) => w.week === 2);
  const logs = [
    { activityDate: "2026-11-19", scheduledDate: "2026-11-17", durationMinutes: 22, distanceKm: 2, steps: null },
    { activityDate: "2026-11-18", scheduledDate: null, durationMinutes: 40, distanceKm: 3, steps: 5000 },
    { activityDate: "2026-11-19", scheduledDate: null, durationMinutes: 40, distanceKm: 3, steps: null },
  ];
  assert.deepEqual(weeklyWalkingCompletion(week2, logs), { planned: 2, completed: 1, targetMet: 1 });
  const short = [{ ...logs[0], durationMinutes: 15 }];
  assert.deepEqual(weeklyWalkingCompletion(week2, short), { planned: 2, completed: 1, targetMet: 0 });
});

test("totals: scheduled vs additional, steps only when recorded", () => {
  const t = walkingTotals([
    { activityDate: "2026-11-10", scheduledDate: "2026-11-10", durationMinutes: 20, distanceKm: 1.6, steps: null },
    { activityDate: "2026-11-12", scheduledDate: null, durationMinutes: 35, distanceKm: 2.75, steps: 4100 },
  ]);
  assert.deepEqual(t, { count: 2, scheduled: 1, additional: 1, minutes: 55, km: 4.35, steps: 4100 });
  assert.equal(walkingTotals([{ activityDate: "2026-11-10", scheduledDate: null, durationMinutes: 20, distanceKm: 1, steps: null }]).steps, null);
});
