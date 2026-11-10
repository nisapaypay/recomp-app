/**
 * Dashboard summaries (pure; unit-tested). Real records only.
 *
 * - Weekly activity: each program day counts once for its category; walking
 *   time/distance sums every walk done this week exactly once (program walks
 *   + extra walks); extra walks never add to the walking completion.
 * - Next activity: the first non-rest program day after today that isn't done.
 * - Primary workout action follows Phase 4 rules: continue an active session,
 *   else today's strength workout, else a late one from this week (catch-up).
 *
 * Imports use .ts extensions so the module runs under plain Node in tests.
 */
import { addDays, diffDays, type IsoDate } from "./calendar.ts";
import { isStrengthDay, type ActivityType, type ScheduleStatus } from "./schedule.ts";

export type DayLike = { date: IsoDate; activity: ActivityType; activityLabel: string; status: ScheduleStatus };
export type WalkLike = { activityDate: IsoDate; scheduledDate: IsoDate | null; durationMinutes: number; distanceKm: number | null };

export type WeeklyActivity = {
  strength: { done: number; planned: number };
  walking: { done: number; planned: number; minutes: number; km: number; extraWalks: number };
  recovery: { done: number; planned: number };
};

export function weeklyActivity(days: DayLike[], walks: WalkLike[]): WeeklyActivity {
  const count = (pred: (d: DayLike) => boolean) => {
    const planned = days.filter(pred);
    return { done: planned.filter((d) => d.status === "completed").length, planned: planned.length };
  };
  const weekStart = days.reduce((min, d) => (d.date < min ? d.date : min), days[0]?.date ?? "9999-12-31");
  const weekEnd = addDays(weekStart, 6);
  const inWeek = walks.filter((w) => w.activityDate >= weekStart && w.activityDate <= weekEnd);
  return {
    strength: count((d) => isStrengthDay(d.activity)),
    walking: {
      ...count((d) => d.activity === "walking"),
      minutes: inWeek.reduce((n, w) => n + w.durationMinutes, 0),
      km: Math.round(inWeek.reduce((n, w) => n + (w.distanceKm ?? 0), 0) * 100) / 100,
      extraWalks: inWeek.filter((w) => w.scheduledDate === null).length,
    },
    recovery: count((d) => d.activity === "recovery"),
  };
}

/** First non-rest day strictly after today that isn't completed (days in date order). */
export function nextActivity<T extends DayLike>(days: T[], today: IsoDate): T | null {
  return days.find((d) => d.activity !== "rest" && d.status !== "completed" && diffDays(d.date, today) > 0) ?? null;
}

export type WorkoutAction =
  | { kind: "continue"; href: string; label: string }
  | { kind: "start"; href: string; label: string }
  | { kind: "catch_up"; href: string; label: string }
  | { kind: "plan"; href: string; label: string };

export function primaryWorkoutAction(args: {
  activeSessionId: string | null;
  today: DayLike | null;
  /** Days of the current week (for late strength workouts). */
  week: DayLike[];
}): WorkoutAction {
  if (args.activeSessionId) return { kind: "continue", href: `/workout/session/${args.activeSessionId}`, label: "Continue workout" };
  const t = args.today;
  if (t && isStrengthDay(t.activity) && t.status === "today") return { kind: "start", href: `/workout/day/${t.date}`, label: `Start ${t.activityLabel}` };
  const late = args.week.filter((d) => isStrengthDay(d.activity) && d.status === "late").sort((a, b) => a.date.localeCompare(b.date));
  if (late.length > 0) return { kind: "catch_up", href: `/workout/day/${late[0].date}`, label: `Catch up: ${late[0].activityLabel}` };
  return { kind: "plan", href: "/workout", label: "View workout plan" };
}

export const STATUS_LABEL: Record<ScheduleStatus, string> = {
  upcoming: "Upcoming",
  today: "Due today",
  completed: "Completed",
  late: "Late · catch-up",
  missed: "Missed",
  rest: "Rest",
  not_configured: "Not configured",
};
