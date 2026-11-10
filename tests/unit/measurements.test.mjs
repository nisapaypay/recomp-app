import assert from "node:assert/strict";
import { test } from "node:test";
import {
  METRICS,
  changeFor,
  checkInSchedule,
  formatDelta,
  formatValue,
  nextCheckIn,
  parseMetric,
  programWeekOf,
  seriesFor,
  suggestedWeek,
  validateMeasurement,
} from "../../src/lib/measurements/measurements.ts";
import {
  comparisonPair,
  fitWithin,
  validatePhotoFile,
  validateTakenOn,
  weekFolder,
} from "../../src/lib/storage/progress-photos.ts";

const START = "2026-11-09";
const def = (key) => METRICS.find((m) => m.key === key);
const empty = { weightKg: "", bodyFatPct: "", skeletalMuscleKg: "", visceralFat: "", waistCm: "", lowerAbdomenCm: "", armCm: "", thighCm: "" };
const input = (o = {}) => ({ ...empty, weightKg: "53.9", bodyFatPct: "32.4", recordedOn: "2026-11-10", weekNumber: "1", notes: "", ...o });
const ctx = { today: "2026-12-02", programStart: START, takenWeeks: new Set() };

test("metric parsing: decimals with dot/comma, ranges, required vs optional", () => {
  assert.deepEqual(parseMetric("53,9", def("weightKg")), { ok: true, value: 53.9 });
  assert.deepEqual(parseMetric("", def("waistCm")), { ok: true, value: null }); // optional stays empty
  assert.equal(parseMetric("", def("weightKg")).ok, false); // required
  assert.equal(parseMetric("0", def("weightKg")).ok, false);
  assert.equal(parseMetric("-3", def("waistCm")).ok, false);
  assert.equal(parseMetric("80", def("bodyFatPct")).ok, false); // > 75 %
  assert.equal(parseMetric("abc", def("armCm")).ok, false);
  assert.deepEqual(parseMetric("32.44", def("bodyFatPct")), { ok: true, value: 32.4 });
});

test("measurement creation: required fields only, optional fields null (no defaults)", () => {
  const r = validateMeasurement(input(), ctx);
  assert.equal(r.ok, true);
  assert.equal(r.value.weightKg, 53.9);
  assert.equal(r.value.bodyFatPct, 32.4);
  for (const k of ["skeletalMuscleKg", "visceralFat", "waistCm", "lowerAbdomenCm", "armCm", "thighCm"]) assert.equal(r.value[k], null);
  assert.equal(r.value.weekNumber, 1);
  assert.equal(r.value.notes, null);
});

test("measurement validation: future date, missing core values, week rules", () => {
  const r = validateMeasurement(input({ recordedOn: "2026-12-03", weightKg: "", bodyFatPct: "120" }), ctx);
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ["bodyFatPct", "recordedOn", "weightKg"]);
  assert.match(validateMeasurement(input({ weekNumber: "4" }), ctx).errors.weekNumber, /hadn't started/);
  assert.match(validateMeasurement(input(), { ...ctx, takenWeeks: new Set([1]) }).errors.weekNumber, /already has/);
  // Late is fine: week 4 recorded on Thursday of week 5.
  assert.equal(validateMeasurement(input({ recordedOn: "2026-12-10", weekNumber: "4" }), { ...ctx, today: "2026-12-10" }).ok, true);
  // No week chosen → the week of the date.
  assert.equal(validateMeasurement(input({ recordedOn: "2026-11-25", weekNumber: "" }), ctx).value.weekNumber, 3);
});

test("measurement editing keeps its own week", () => {
  const r = validateMeasurement(input({ waistCm: "78.5" }), { ...ctx, takenWeeks: new Set([1, 4]), editingWeek: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.value.waistCm, 78.5);
});

test("schedule: weeks 1/4/8/12 with done / due / late / upcoming; late never shifts the plan", () => {
  const recorded = new Map([[1, "2026-11-10"]]);
  const s = checkInSchedule(START, "2026-12-05", recorded); // Saturday of week 4
  assert.deepEqual(s.map((c) => [c.week, c.status]), [[1, "done"], [4, "due"], [8, "upcoming"], [12, "upcoming"]]);
  assert.deepEqual([s[1].windowStart, s[1].windowEnd], ["2026-11-30", "2026-12-06"]);
  const later = checkInSchedule(START, "2026-12-09", recorded); // week 5: week 4 is late
  assert.equal(later[1].status, "late");
  assert.equal(nextCheckIn(later).week, 4);
  assert.equal(suggestedWeek(later, START, "2026-12-09"), 4);
  assert.equal(nextCheckIn(checkInSchedule(START, "2027-02-01", new Map([[1, "a"], [4, "b"], [8, "c"], [12, "d"]]))), null);
  assert.equal(programWeekOf(START, "2026-11-08"), null);
  assert.equal(programWeekOf(START, "2027-01-31"), 12);
});

const records = [
  { id: "1", recordedOn: "2026-11-10", weekNumber: 1, weightKg: 53.9, bodyFatPct: 32.4, skeletalMuscleKg: 20, visceralFat: null, waistCm: 80, lowerAbdomenCm: null, armCm: 26, thighCm: null },
  { id: "2", recordedOn: "2026-12-03", weekNumber: 4, weightKg: 54.2, bodyFatPct: 31.6, skeletalMuscleKg: null, visceralFat: null, waistCm: 78.5, lowerAbdomenCm: null, armCm: 26.4, thighCm: null },
  { id: "3", recordedOn: "2026-12-31", weekNumber: 8, weightKg: 54.2, bodyFatPct: 30.9, skeletalMuscleKg: 20.6, visceralFat: null, waistCm: null, lowerAbdomenCm: null, armCm: null, thighCm: null },
];

test("progress: series only contain recorded values (no interpolation)", () => {
  assert.deepEqual(seriesFor(records, "skeletalMuscleKg").map((p) => p.week), [1, 8]);
  assert.deepEqual(seriesFor(records, "thighCm"), []);
  assert.deepEqual(seriesFor([...records].reverse(), "weightKg").map((p) => p.date), ["2026-11-10", "2026-12-03", "2026-12-31"]);
});

test("progress: first, latest and change — including increases and a single value", () => {
  const w = changeFor(records, def("weightKg"));
  assert.equal(w.delta, 0.3); // weight went UP while body fat went down
  assert.equal(formatDelta(w.delta, def("weightKg")), "+0.3 kg");
  assert.equal(formatDelta(changeFor(records, def("bodyFatPct")).delta, def("bodyFatPct")), "−1.5 pts");
  assert.equal(changeFor(records, def("waistCm")).latest.week, 4); // latest REAL value
  assert.equal(changeFor(records, def("thighCm")), null); // chart empty state
  assert.equal(changeFor([records[0]], def("weightKg")).delta, null); // one value → no change shown
  assert.equal(formatDelta(0, def("weightKg")), "no change");
  assert.equal(formatValue(32.4, def("bodyFatPct")), "32.4%");
  assert.match(def("weightKg").context, /stay similar|rise/);
});

test("photo files: type and size validation", () => {
  assert.equal(validatePhotoFile({ type: "image/jpeg", size: 2_000_000 }).ok, true);
  assert.equal(validatePhotoFile({ type: "image/heic", size: 2_000_000 }).ok, false);
  assert.equal(validatePhotoFile({ type: "image/png", size: 6 * 1024 * 1024 }).ok, false);
  assert.deepEqual(validateTakenOn("2026-11-10", "2026-11-10"), { ok: true });
  assert.equal(validateTakenOn("2026-11-11", "2026-11-10").ok, false);
  assert.equal(validateTakenOn("10/11/2026", "2026-11-10").ok, false);
});

test("photo resizing keeps the aspect ratio and never upscales", () => {
  assert.deepEqual(fitWithin(3024, 4032), { width: 1500, height: 2000 });
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
  assert.throws(() => fitWithin(0, 100));
});

test("photo comparison: Week 1 vs later week per type; missing side is null, never substituted", () => {
  const photos = [
    { id: "a", weekNumber: 1, photoType: "front", takenOn: "2026-11-10", storagePath: "u/week-1/front-1.jpg" },
    { id: "b", weekNumber: 4, photoType: "front", takenOn: "2026-12-03", storagePath: "u/week-4/front-2.jpg" },
    { id: "c", weekNumber: 4, photoType: "side", takenOn: "2026-12-03", storagePath: "u/week-4/side-3.jpg" },
  ];
  assert.deepEqual(comparisonPair(photos, "front", 4), { before: photos[0], after: photos[1] });
  assert.deepEqual(comparisonPair(photos, "side", 4), { before: null, after: photos[2] });
  assert.deepEqual(comparisonPair(photos, "front", 8), { before: photos[0], after: null });
  assert.equal(weekFolder("u", 4), "u/week-4");
});
