import assert from "node:assert/strict";
import { test } from "node:test";
import { bodyChanges, reportKind, trainingSummary, walkingReport, weeklyTimeline } from "../../src/lib/report/report.ts";
import { scheduledWalks } from "../../src/lib/walking/walking.ts";

const START = "2026-11-09";
const m = (id, recordedOn, weekNumber, o = {}) => ({
  id, recordedOn, weekNumber, weightKg: null, bodyFatPct: null, skeletalMuscleKg: null, visceralFat: null,
  waistCm: null, lowerAbdomenCm: null, armCm: null, thighCm: null, ...o,
});

test("body changes: first vs latest, never-measured metrics omitted, single value → no change", () => {
  const records = [
    m("1", "2026-11-10", 1, { weightKg: 53.9, bodyFatPct: 32.4, waistCm: 80 }),
    m("2", "2026-12-03", 4, { weightKg: 54.3, bodyFatPct: 31.2, skeletalMuscleKg: 20.4 }),
  ];
  const { rows, measurementCount } = bodyChanges(records);
  assert.equal(measurementCount, 2);
  assert.deepEqual(rows.map((r) => r.def.key), ["weightKg", "bodyFatPct", "skeletalMuscleKg", "waistCm"]);
  const weight = rows.find((r) => r.def.key === "weightKg").change;
  assert.equal(weight.delta, 0.4); // weight UP while body fat down — reported as is
  assert.equal(weight.first.date, "2026-11-10");
  assert.equal(weight.latest.date, "2026-12-03");
  assert.equal(rows.find((r) => r.def.key === "skeletalMuscleKg").change.delta, null); // one value only
  assert.equal(rows.find((r) => r.def.key === "waistCm").change.delta, null);
  assert.deepEqual(bodyChanges([]).rows, []);
});

const sessions = [
  { id: "s1", weekNumber: 1, scheduledDate: "2026-11-09", activityType: "lower_body" },
  { id: "s2", weekNumber: 1, scheduledDate: "2026-11-11", activityType: "upper_body_core" },
  { id: "s3", weekNumber: 2, scheduledDate: "2026-11-16", activityType: "lower_body" },
];
const ex = (sessionId, exerciseId, name, status, sets, target, extra = {}) => ({
  sessionId, exerciseId, name, status, prescribedSets: sets, prescribedTarget: target, measureType: "reps", sideMode: "none", ...extra,
});
const exercises = [
  ex("s1", "goblet-squat", "Goblet Squat", "completed", 2, 12),
  ex("s1", "plank", "Plank", "partial", 2, 20, { measureType: "seconds" }),
  ex("s2", "shoulder-press", "Shoulder Press", "completed", 2, 10),
  ex("s2", "dead-bug", "Dead Bug", "skipped", 2, 10, { sideMode: "per_side" }),
  ex("s3", "goblet-squat", "Goblet Squat", "completed", 2, 14), // adjusted later — history keeps 12 in s1
  ex("s9", "goblet-squat", "Goblet Squat", "completed", 2, 16), // not a completed session → ignored
];

test("training: snapshots, completion rate, per week, top exercises, recorded progression, feedback", () => {
  const t = trainingSummary({ sessions, exercises, feedback: ["too_easy", "just_right", "just_right"], strengthPlannedToDate: 6, weeksReached: 2 });
  assert.equal(t.strengthCompleted, 3);
  assert.equal(t.completionRate, 0.5);
  assert.equal(t.exercisesPerformed, 4); // completed + partial, skipped excluded, foreign session excluded
  assert.deepEqual(t.perWeek, [{ week: 1, completed: 2, planned: 3 }, { week: 2, completed: 1, planned: 3 }]);
  assert.deepEqual(t.topExercises[0], { name: "Goblet Squat", completed: 2 });
  assert.deepEqual(t.progression, [{ name: "Goblet Squat", from: "2 × 12", to: "2 × 14" }]);
  assert.deepEqual(t.feedback, { too_easy: 1, just_right: 2, too_hard: 0 });
  assert.equal(trainingSummary({ sessions: [], exercises: [], feedback: [], strengthPlannedToDate: 0, weeksReached: 0 }).completionRate, null);
});

const TARGETS = [];
for (let w = 1; w <= 12; w++) for (const d of [2, 6]) TARGETS.push({ week: w, dayOfWeek: d, minMinutes: 20, maxMinutes: 25 });
const PROGRAM_WALKS = scheduledWalks(START, TARGETS);

test("walking: every walk once, weighted pace/speed, weekly program-walk consistency", () => {
  const walks = [
    { activityDate: "2026-11-10", scheduledDate: "2026-11-10", durationMinutes: 30, distanceKm: 2.5 },
    { activityDate: "2026-11-12", scheduledDate: null, durationMinutes: 20, distanceKm: 1.5 },
    { activityDate: "2026-11-19", scheduledDate: "2026-11-14", durationMinutes: 10, distanceKm: null }, // catch-up, no distance
  ];
  const r = walkingReport({ walks, programWalks: PROGRAM_WALKS, programStart: START, weeksReached: 2 });
  assert.deepEqual([r.sessions, r.scheduled, r.extra, r.minutes, r.km], [3, 2, 1, 60, 4]);
  assert.equal(r.paceSecondsPerKm, 750); // (30+20) min / 4 km = 12:30 (walk without distance excluded)
  assert.equal(r.speedKmh, 4.8);
  assert.deepEqual(r.perWeek, [
    { week: 1, programDone: 2, programPlanned: 2, km: 4 },
    { week: 2, programDone: 0, programPlanned: 2, km: 0 },
  ]);
  assert.equal(walkingReport({ walks: [], programWalks: PROGRAM_WALKS, programStart: START, weeksReached: 0 }).paceSecondsPerKm, null);
});

test("weekly timeline: 12 weeks, future weeks have no percentage, measurements and walking per week", () => {
  const tl = weeklyTimeline({
    programStart: START,
    today: "2026-11-18",
    completedByWeek: new Map([[1, 4], [2, 1]]),
    plannedPerWeek: 5,
    measurements: [{ ...m("1", "2026-11-10", 1, { weightKg: 53.9, bodyFatPct: 32.4 }), notes: "morning" }],
    walks: [{ activityDate: "2026-11-17", scheduledDate: "2026-11-17", durationMinutes: 25, distanceKm: 2.1 }],
  });
  assert.equal(tl.length, 12);
  assert.deepEqual([tl[0].state, tl[0].percent, tl[0].measurement.weightKg, tl[0].notes], ["past", 80, 53.9, "morning"]);
  assert.deepEqual([tl[1].state, tl[1].percent, tl[1].walkingKm], ["current", 20, 2.1]);
  assert.deepEqual([tl[2].state, tl[2].percent, tl[2].measurement], ["future", null, null]);
});

test("final vs interim", () => {
  assert.equal(reportKind("finished"), "final");
  assert.equal(reportKind("in_progress"), "interim");
  assert.equal(reportKind("not_started"), "interim");
});

test("navigation: Report and Progress are never highlighted together", async () => {
  const { isNavItemActive } = await import("../../src/lib/navigation.ts");
  assert.equal(isNavItemActive("/progress/report", "/progress/report"), true);
  assert.equal(isNavItemActive("/progress/report", "/progress"), false);
  assert.equal(isNavItemActive("/progress/measurements", "/progress"), true);
  assert.equal(isNavItemActive("/dashboard", "/progress"), false);
});
