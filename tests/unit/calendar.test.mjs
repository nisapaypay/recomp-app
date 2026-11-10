import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  dateForProgramDay,
  dayStatus,
  isIsoDate,
  isoDayOfWeek,
  mondayOf,
  phaseForWeek,
  programEndDate,
  programTiming,
  programWeekFor,
  startDateOptions,
  todayIn,
  validateStartDate,
  weekDates,
} from "../../src/lib/program/calendar.ts";

// 2026-11-09 is a Monday; 2026-11-10 (Tue) is "today" in several tests.
const START = "2026-11-09";

test("ISO date parsing and weekdays", () => {
  assert.ok(isIsoDate("2026-11-09"));
  assert.ok(!isIsoDate("2026-02-30"));
  assert.ok(!isIsoDate("2026-11-9"));
  assert.ok(!isIsoDate(null));
  assert.equal(isoDayOfWeek("2026-11-09"), 1); // Monday
  assert.equal(isoDayOfWeek("2026-11-15"), 7); // Sunday
  assert.equal(isoDayOfWeek("1970-01-01"), 4); // Thursday
  assert.equal(isoDayOfWeek("1969-12-29"), 1); // negative epoch day
  assert.equal(mondayOf("2026-11-15"), START);
  assert.equal(mondayOf(START), START);
});

test("today is computed in Asia/Jakarta, not UTC", () => {
  // 2026-11-15 18:30 UTC = 2026-11-16 01:30 in Jakarta (UTC+7).
  const instant = new Date("2026-11-15T18:30:00Z");
  assert.equal(todayIn("Asia/Jakarta", instant), "2026-11-16");
  assert.equal(todayIn("UTC", instant), "2026-11-15");
  // 16:59 UTC is still the same Jakarta day (23:59).
  assert.equal(todayIn("Asia/Jakarta", new Date("2026-11-15T16:59:00Z")), "2026-11-15");
});

test("program spans exactly 12 weeks (84 days), Monday to Sunday", () => {
  const end = programEndDate(START);
  assert.equal(end, "2027-01-31");
  assert.equal(isoDayOfWeek(end), 7);
});

test("week number is calculated from the start date", () => {
  assert.equal(programWeekFor(START, "2026-11-09"), 1);
  assert.equal(programWeekFor(START, "2026-11-15"), 1);
  assert.equal(programWeekFor(START, "2026-11-16"), 2);
  assert.equal(programWeekFor(START, "2027-01-31"), 12);
  assert.equal(programWeekFor(START, "2027-02-01"), 13);
  assert.equal(programWeekFor(START, "2026-11-08"), 0);
});

test("program timing: not started, in progress, finished", () => {
  const before = programTiming(START, "2026-11-05");
  assert.equal(before.state, "not_started");
  assert.equal(before.daysUntilStart, 4);

  const during = programTiming(START, "2026-12-02"); // Wednesday of week 4
  assert.equal(during.state, "in_progress");
  assert.equal(during.week, 4);
  assert.equal(during.dayOfWeek, 3);
  assert.equal(during.phase.name, "Beginner Strength");
  assert.equal(during.dayNumber, 24);
  assert.equal(during.timeProgressPct, Math.round((24 / 84) * 100));

  const lastDay = programTiming(START, "2027-01-31");
  assert.equal(lastDay.state, "in_progress");
  assert.equal(lastDay.week, 12);
  assert.equal(lastDay.timeProgressPct, 100);

  assert.equal(programTiming(START, "2027-02-01").state, "finished");
});

test("phases follow the specification", () => {
  const names = Array.from({ length: 12 }, (_, i) => phaseForWeek(i + 1).name);
  assert.deepEqual(names, [
    "Foundation",
    "Beginner Strength", "Beginner Strength", "Beginner Strength",
    "Progressive Overload", "Progressive Overload", "Progressive Overload", "Progressive Overload",
    "Strengthening", "Strengthening", "Strengthening", "Strengthening",
  ]);
});

test("week dates map to fixed weekdays", () => {
  const dates = weekDates(START, 2);
  assert.equal(dates.length, 7);
  assert.equal(dates[0], "2026-11-16");
  assert.equal(dates[6], "2026-11-22");
  assert.deepEqual(dates.map(isoDayOfWeek), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(dateForProgramDay(START, 12, 7), programEndDate(START));
});

test("past days are Late in the same week, Missed after it, and never shift the schedule", () => {
  const today = "2026-11-11"; // Wednesday, week 1
  // Monday not done yet → Late (catch-up), not immediately Missed.
  assert.equal(dayStatus({ date: "2026-11-09", today, activity: "lower_body", completed: false }), "late");
  // Once that program week is over it becomes Missed (Sunday boundary).
  assert.equal(dayStatus({ date: "2026-11-09", today: "2026-11-15", activity: "lower_body", completed: false }), "late");
  assert.equal(dayStatus({ date: "2026-11-09", today: "2026-11-16", activity: "lower_body", completed: false }), "missed");
  // A catch-up completed later counts for its scheduled day.
  assert.equal(dayStatus({ date: "2026-11-09", today: "2026-11-20", activity: "lower_body", completed: true }), "completed");
  assert.equal(dayStatus({ date: "2026-11-10", today, activity: "walking", completed: true }), "completed");
  assert.equal(dayStatus({ date: "2026-11-11", today, activity: "upper_body_core", completed: false }), "today");
  // Recovery isn't configured yet: never Upcoming / Late / Missed.
  assert.equal(dayStatus({ date: "2026-11-12", today, activity: "recovery", completed: false }), "not_configured");
  assert.equal(dayStatus({ date: "2026-11-05", today, activity: "recovery", completed: false }), "not_configured");
  assert.equal(dayStatus({ date: "2026-11-15", today, activity: "rest", completed: false }), "rest");
  // Wednesday stays Upper Body even though Monday was missed.
  assert.equal(isoDayOfWeek("2026-11-11"), 3);
  // Completing today wins over "today".
  assert.equal(dayStatus({ date: today, today, activity: "upper_body_core", completed: true }), "completed");
});

test("start date validation: Monday only, this week up to 8 weeks ahead", () => {
  const today = "2026-11-11"; // Wednesday
  assert.equal(validateStartDate("2026-11-09", today), null); // this week's Monday
  assert.equal(validateStartDate("2027-01-04", today), null); // +8 weeks
  assert.match(validateStartDate("2026-11-10", today), /Monday/);
  assert.match(validateStartDate("2026-11-02", today), /before/);
  assert.match(validateStartDate("2027-01-11", today), /within/);
  assert.match(validateStartDate("2026-13-01", today), /valid/);
  assert.match(validateStartDate(undefined, today), /valid/);
});

test("start date options are 9 consecutive Mondays from this week", () => {
  const options = startDateOptions("2026-11-15"); // Sunday
  assert.equal(options.length, 9);
  assert.equal(options[0], "2026-11-09");
  assert.equal(options[8], addDays("2026-11-09", 56));
  assert.ok(options.every((d) => isoDayOfWeek(d) === 1));
});
