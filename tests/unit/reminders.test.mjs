import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeDays,
  dueReminders,
  isValidTime,
  isValidTimeZone,
  localParts,
  toNotify,
} from "../../src/lib/reminders/reminders.ts";

const settings = {
  workoutEnabled: true,
  workoutTime: "08:00",
  measurementEnabled: true,
  measurementTime: "08:00",
  days: [1, 2, 3, 4, 5, 6, 7],
  timezone: "Asia/Jakarta",
};
const strength = { date: "2026-11-16", kind: "strength", label: "Lower Body", status: "today", href: "/workout/day/2026-11-16" };
const checkIn = { week: 4, status: "due", href: "/progress/measurements#log" };
// Monday 16 Nov 2026, 08:30 in Jakarta = 01:30 UTC.
const MON_0830_JKT = new Date("2026-11-16T01:30:00Z");

test("local time parts follow the user's timezone (not UTC)", () => {
  assert.deepEqual(localParts(MON_0830_JKT, "Asia/Jakarta"), { date: "2026-11-16", isoDay: 1, minutes: 8 * 60 + 30 });
  assert.deepEqual(localParts(MON_0830_JKT, "Europe/London"), { date: "2026-11-16", isoDay: 1, minutes: 90 });
  assert.equal(localParts(new Date("2026-11-15T20:00:00Z"), "Asia/Jakarta").date, "2026-11-16"); // 03:00 Mon in Jakarta
});

test("workout reminder: due at/after the chosen time on a chosen day", () => {
  const due = dueReminders(MON_0830_JKT, settings, { activity: strength, checkIn: null });
  assert.deepEqual(due.map((r) => r.id), ["workout:2026-11-16"]);
  assert.equal(due[0].href, "/workout/day/2026-11-16");
  // Before 08:00 → nothing.
  assert.deepEqual(dueReminders(new Date("2026-11-16T00:59:00Z"), settings, { activity: strength, checkIn: null }), []);
  // Exactly 08:00 → due.
  assert.equal(dueReminders(new Date("2026-11-16T01:00:00Z"), settings, { activity: strength, checkIn: null }).length, 1);
});

test("never outside the chosen weekdays", () => {
  const weekdaysOnly = { ...settings, days: [2, 3, 4, 5, 6] }; // no Monday
  assert.deepEqual(dueReminders(MON_0830_JKT, weekdaysOnly, { activity: strength, checkIn }), []);
});

test("completed activity → no workout reminder", () => {
  assert.deepEqual(dueReminders(MON_0830_JKT, settings, { activity: { ...strength, status: "completed" }, checkIn: null }), []);
});

test("walking and recovery days get their own wording; rest day (null) none", () => {
  const walk = dueReminders(MON_0830_JKT, settings, { activity: { ...strength, kind: "walking", label: "Walking" }, checkIn: null });
  assert.match(walk[0].body, /walk/);
  const rec = dueReminders(MON_0830_JKT, settings, { activity: { ...strength, kind: "recovery", label: "Recovery" }, checkIn: null });
  assert.equal(rec[0].title, "Recovery day");
  assert.deepEqual(dueReminders(MON_0830_JKT, settings, { activity: null, checkIn: null }), []);
});

test("enable / disable each reminder separately", () => {
  const off = { ...settings, workoutEnabled: false };
  assert.deepEqual(dueReminders(MON_0830_JKT, off, { activity: strength, checkIn }).map((r) => r.kind), ["measurement"]);
  const noMeasure = { ...settings, measurementEnabled: false };
  assert.deepEqual(dueReminders(MON_0830_JKT, noMeasure, { activity: strength, checkIn }).map((r) => r.kind), ["workout"]);
});

test("measurement reminder only while the check-in is due or late (saved → no input → none)", () => {
  const due = dueReminders(MON_0830_JKT, settings, { activity: null, checkIn });
  assert.deepEqual(due.map((r) => r.id), ["measurement:w4:2026-11-16"]);
  const late = dueReminders(MON_0830_JKT, settings, { activity: null, checkIn: { ...checkIn, status: "late" } });
  assert.match(late[0].body, /still counts/);
  assert.deepEqual(dueReminders(MON_0830_JKT, settings, { activity: null, checkIn: null }), []);
  // Own time.
  assert.deepEqual(dueReminders(MON_0830_JKT, { ...settings, measurementTime: "09:00" }, { activity: null, checkIn }), []);
});

test("no duplicate notifications: stable ids, filtered by what was already notified", () => {
  const due = dueReminders(MON_0830_JKT, settings, { activity: strength, checkIn });
  const later = dueReminders(new Date("2026-11-16T05:00:00Z"), settings, { activity: strength, checkIn });
  assert.deepEqual(due.map((r) => r.id), later.map((r) => r.id)); // same day → same ids
  const notified = new Set(due.map((r) => r.id));
  assert.deepEqual(toNotify(later, notified), []);
  assert.equal(toNotify(due, new Set(["workout:2026-11-16"])).length, 1);
});

test("invalid timezone falls back to Asia/Jakarta; validators", () => {
  assert.equal(dueReminders(MON_0830_JKT, { ...settings, timezone: "Mars/Base" }, { activity: strength, checkIn: null }).length, 1);
  assert.equal(isValidTimeZone("Asia/Jakarta"), true);
  assert.equal(isValidTimeZone("Not/AZone"), false);
  assert.equal(isValidTime("08:00"), true);
  assert.equal(isValidTime("24:00"), false);
  assert.equal(isValidTime("8:00"), false);
});

test("day descriptions", () => {
  assert.equal(describeDays([1, 2, 3, 4, 5, 6, 7]), "Every day");
  assert.equal(describeDays([5, 4, 3, 2, 1]), "Weekdays");
  assert.equal(describeDays([6, 7]), "Weekends");
  assert.equal(describeDays([1, 3, 5]), "Mon, Wed, Fri");
});
