import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, isoDayOfWeek, startDateOptions, weekDates } from "../../src/lib/program/calendar.ts";
import { activityForDate, programCompletion, sessionKey } from "../../src/lib/program/completion.ts";
import { WEEKLY_SCHEDULE } from "../../src/lib/program/schedule.ts";

const START = "2026-11-09"; // Monday
const empty = () => ({ completedSessions: new Set(), walkDates: new Set() });

test("plan totals: 36 strength + 24 walking = 60 while recovery is not configured (12 recovery days tracked apart)", () => {
  const c = programCompletion(START, "2026-11-01", empty());
  assert.equal(c.recoveryConfigured, false);
  assert.deepEqual(
    [c.total.planned, c.strength.planned, c.walking.planned, c.recovery.planned],
    [60, 36, 24, 12],
  );
  assert.equal(c.total.plannedToDate, 0); // before start
  assert.equal(c.total.completed, 0); // nothing logged → nothing completed
});

test("planned-to-date counts non-rest days up to today", () => {
  // Wednesday of week 1: Mon, Tue, Wed reached.
  const c = programCompletion(START, "2026-11-11", empty());
  assert.equal(c.total.plannedToDate, 3);
  assert.equal(c.strength.plannedToDate, 2);
  assert.equal(c.walking.plannedToDate, 1);
  // After the end: everything reached.
  assert.equal(programCompletion(START, "2027-03-01", empty()).total.plannedToDate, 60);
});

test("recovery is never counted as a strength workout", () => {
  const records = empty();
  records.completedSessions.add(sessionKey("2026-11-12", "recovery")); // Thursday
  const c = programCompletion(START, "2026-11-15", records);
  assert.equal(c.recovery.completed, 1);
  assert.equal(c.strength.completed, 0);
  assert.equal(c.total.completed, 0); // recovery isn't part of the total until it is configured
});

test("records only count on their scheduled day and activity", () => {
  const records = empty();
  records.completedSessions.add(sessionKey("2026-11-09", "lower_body")); // Mon ✓
  records.completedSessions.add(sessionKey("2026-11-10", "lower_body")); // Tue: wrong activity ✗
  records.completedSessions.add(sessionKey("2026-11-11", "recovery")); // Wed: wrong activity ✗
  records.walkDates.add("2026-11-10"); // Tue walk ✓
  records.walkDates.add("2026-11-12"); // Thu walk: not a walking day ✗
  records.walkDates.add("2026-11-08"); // before start ✗
  const c = programCompletion(START, "2026-11-15", records);
  assert.equal(c.strength.completed, 1);
  assert.equal(c.walking.completed, 1);
  assert.equal(c.recovery.completed, 0);
  assert.equal(c.total.completed, 2);
});

test("any valid start date keeps the fixed weekday schedule", () => {
  // Every Monday a user could pick, from a range of "today" values.
  const starts = new Set();
  for (let i = 0; i < 21; i++) for (const s of startDateOptions(addDays("2026-11-05", i))) starts.add(s);
  assert.ok(starts.size > 9);
  for (const start of starts) {
    for (let week = 1; week <= 12; week++) {
      weekDates(start, week).forEach((date, i) => {
        // Position i in the week is always the same weekday and the same activity.
        assert.equal(isoDayOfWeek(date), i + 1);
        assert.equal(activityForDate(date), WEEKLY_SCHEDULE[i].activity);
      });
    }
    const c = programCompletion(start, start, empty());
    assert.equal(c.total.planned, 60);
  }
  // Monday is always Lower Body, Sunday always Rest.
  assert.equal(activityForDate("2027-01-04"), "lower_body");
  assert.equal(activityForDate("2027-01-10"), "rest");
});
