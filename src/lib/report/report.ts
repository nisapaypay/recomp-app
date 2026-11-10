/**
 * 12-week report calculations (pure; unit-tested; shared by the report page
 * and the PDF so both always show the same numbers).
 *
 * Real records only: no interpolation, no estimates, no health claims.
 * Training figures come from the historical workout snapshots
 * (workout_exercises), so later adjustments never rewrite past results.
 *
 * Imports use .ts extensions so the module runs under plain Node in tests.
 */
import { addDays, type IsoDate } from "../program/calendar.ts";
import { METRICS, changeFor, type MeasurementRecord, type MetricChange, type MetricDef } from "../measurements/measurements.ts";
import type { ScheduledWalk } from "../walking/walking.ts";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type ReportSession = {
  id: string;
  weekNumber: number;
  scheduledDate: IsoDate;
  activityType: "lower_body" | "upper_body_core" | "full_body_core";
};

export type ReportExercise = {
  sessionId: string;
  exerciseId: string;
  name: string;
  status: "pending" | "in_progress" | "completed" | "partial" | "skipped";
  prescribedSets: number;
  prescribedTarget: number;
  measureType: "reps" | "seconds";
  sideMode: "none" | "per_side" | "per_direction";
};

export type ReportWalk = { activityDate: IsoDate; scheduledDate: IsoDate | null; durationMinutes: number; distanceKm: number | null };

// ---------------------------------------------------------------------------
// Body composition
// ---------------------------------------------------------------------------

export type BodyChangeRow = { def: MetricDef; change: MetricChange };

/** First vs latest per metric; metrics never measured are left out entirely. */
export function bodyChanges(records: MeasurementRecord[]): { rows: BodyChangeRow[]; measurementCount: number } {
  const rows = METRICS.map((def) => ({ def, change: changeFor(records, def) }))
    .filter((r): r is BodyChangeRow => r.change !== null);
  return { rows, measurementCount: records.length };
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export type TrainingSummary = {
  strengthCompleted: number;
  strengthPlannedToDate: number;
  completionRate: number | null; // 0…1, null when nothing was due yet
  exercisesPerformed: number;
  perWeek: { week: number; completed: number; planned: number }[];
  topExercises: { name: string; completed: number }[];
  progression: { name: string; from: string; to: string }[];
  feedback: { too_easy: number; just_right: number; too_hard: number };
};

function prescriptionLabel(e: Pick<ReportExercise, "prescribedSets" | "prescribedTarget" | "measureType" | "sideMode">): string {
  const unit = e.measureType === "seconds" ? " s" : e.sideMode === "per_side" ? "/side" : e.sideMode === "per_direction" ? "/direction" : "";
  return `${e.prescribedSets} × ${e.prescribedTarget}${unit}`;
}

export function trainingSummary(args: {
  sessions: ReportSession[]; // completed strength sessions
  exercises: ReportExercise[]; // snapshots of those sessions
  feedback: ("too_easy" | "just_right" | "too_hard")[];
  strengthPlannedToDate: number;
  weeksReached: number; // program weeks started so far (0–12)
}): TrainingSummary {
  const sessionIds = new Set(args.sessions.map((s) => s.id));
  const done = args.exercises.filter((e) => sessionIds.has(e.sessionId) && (e.status === "completed" || e.status === "partial"));

  const byName = new Map<string, number>();
  for (const e of done.filter((x) => x.status === "completed")) byName.set(e.name, (byName.get(e.name) ?? 0) + 1);
  const topExercises = [...byName.entries()]
    .map(([name, completed]) => ({ name, completed }))
    .sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name))
    .slice(0, 5);

  // Recorded progression: first vs latest snapshot per exercise + workout type (completed sessions, by scheduled date).
  const sessionById = new Map(args.sessions.map((s) => [s.id, s]));
  const groups = new Map<string, { name: string; items: { date: IsoDate; label: string }[] }>();
  for (const e of args.exercises.filter((x) => sessionIds.has(x.sessionId) && x.status !== "skipped")) {
    const s = sessionById.get(e.sessionId)!;
    const key = `${e.exerciseId}|${s.activityType}`;
    const g = groups.get(key) ?? { name: e.name, items: [] };
    g.items.push({ date: s.scheduledDate, label: prescriptionLabel(e) });
    groups.set(key, g);
  }
  const progression = [...groups.values()]
    .map((g) => {
      const sorted = g.items.sort((a, b) => a.date.localeCompare(b.date));
      return { name: g.name, from: sorted[0].label, to: sorted[sorted.length - 1].label };
    })
    .filter((p) => p.from !== p.to)
    .sort((a, b) => a.name.localeCompare(b.name));

  const perWeek = Array.from({ length: Math.min(12, Math.max(0, args.weeksReached)) }, (_, i) => ({
    week: i + 1,
    completed: args.sessions.filter((s) => s.weekNumber === i + 1).length,
    planned: 3,
  }));

  return {
    strengthCompleted: args.sessions.length,
    strengthPlannedToDate: args.strengthPlannedToDate,
    completionRate: args.strengthPlannedToDate > 0 ? Math.min(1, args.sessions.length / args.strengthPlannedToDate) : null,
    exercisesPerformed: done.length,
    perWeek,
    topExercises,
    progression,
    feedback: {
      too_easy: args.feedback.filter((f) => f === "too_easy").length,
      just_right: args.feedback.filter((f) => f === "just_right").length,
      too_hard: args.feedback.filter((f) => f === "too_hard").length,
    },
  };
}

// ---------------------------------------------------------------------------
// Walking
// ---------------------------------------------------------------------------

export type WalkingReport = {
  sessions: number; // every logged walk once
  scheduled: number;
  extra: number;
  minutes: number;
  km: number;
  /** Total minutes / total km over walks that have a distance (weighted, not an average of paces). */
  paceSecondsPerKm: number | null;
  speedKmh: number | null;
  perWeek: { week: number; programDone: number; programPlanned: number; km: number }[];
};

export function walkingReport(args: { walks: ReportWalk[]; programWalks: ScheduledWalk[]; programStart: IsoDate | null; weeksReached: number }): WalkingReport {
  const withDistance = args.walks.filter((w) => w.distanceKm !== null && w.distanceKm > 0);
  const distMinutes = withDistance.reduce((n, w) => n + w.durationMinutes, 0);
  const km = Math.round(args.walks.reduce((n, w) => n + (w.distanceKm ?? 0), 0) * 100) / 100;
  const distKm = withDistance.reduce((n, w) => n + (w.distanceKm ?? 0), 0);
  const loggedScheduled = new Set(args.walks.filter((w) => w.scheduledDate).map((w) => w.scheduledDate as IsoDate));

  const perWeek = args.programStart
    ? Array.from({ length: Math.min(12, Math.max(0, args.weeksReached)) }, (_, i) => {
        const week = i + 1;
        const start = addDays(args.programStart as IsoDate, i * 7);
        const end = addDays(start, 6);
        const planned = args.programWalks.filter((w) => w.week === week);
        return {
          week,
          programDone: planned.filter((w) => loggedScheduled.has(w.date)).length,
          programPlanned: planned.length,
          km: Math.round(args.walks.filter((w) => w.activityDate >= start && w.activityDate <= end).reduce((n, w) => n + (w.distanceKm ?? 0), 0) * 100) / 100,
        };
      })
    : [];

  return {
    sessions: args.walks.length,
    scheduled: args.walks.filter((w) => w.scheduledDate !== null).length,
    extra: args.walks.filter((w) => w.scheduledDate === null).length,
    minutes: args.walks.reduce((n, w) => n + w.durationMinutes, 0),
    km,
    paceSecondsPerKm: distKm > 0 ? Math.round((distMinutes * 60) / distKm) : null,
    speedKmh: distMinutes > 0 ? Math.round((distKm / (distMinutes / 60)) * 10) / 10 : null,
    perWeek,
  };
}

// ---------------------------------------------------------------------------
// Weekly timeline
// ---------------------------------------------------------------------------

export type TimelineWeek = {
  week: number;
  start: IsoDate;
  end: IsoDate;
  state: "past" | "current" | "future";
  planned: number;
  completed: number;
  percent: number | null;
  measurement: { recordedOn: IsoDate; weightKg: number | null; bodyFatPct: number | null } | null;
  walkingKm: number;
  notes: string | null;
};

export function weeklyTimeline(args: {
  programStart: IsoDate;
  today: IsoDate;
  /** Completed (counted) program days per week, and planned per week (recovery excluded while not configured). */
  completedByWeek: Map<number, number>;
  plannedPerWeek: number;
  measurements: (MeasurementRecord & { notes?: string | null })[];
  walks: ReportWalk[];
}): TimelineWeek[] {
  return Array.from({ length: 12 }, (_, i) => {
    const week = i + 1;
    const start = addDays(args.programStart, i * 7);
    const end = addDays(start, 6);
    const state = args.today > end ? "past" : args.today >= start ? "current" : "future";
    const completed = args.completedByWeek.get(week) ?? 0;
    const m = args.measurements.find((x) => x.weekNumber === week) ?? null;
    return {
      week,
      start,
      end,
      state,
      planned: args.plannedPerWeek,
      completed,
      percent: state === "future" ? null : Math.round((completed / args.plannedPerWeek) * 100),
      measurement: m ? { recordedOn: m.recordedOn, weightKg: m.weightKg, bodyFatPct: m.bodyFatPct } : null,
      walkingKm: Math.round(args.walks.filter((w) => w.activityDate >= start && w.activityDate <= end).reduce((n, w) => n + (w.distanceKm ?? 0), 0) * 100) / 100,
      notes: m?.notes ?? null,
    };
  });
}

/** "Final" only once the 12 calendar weeks are over; otherwise an interim report. */
export function reportKind(timingState: "not_started" | "in_progress" | "finished"): "final" | "interim" {
  return timingState === "finished" ? "final" : "interim";
}
