/**
 * The fixed RECOMP weekly schedule and the 12-week phase map.
 *
 * The schedule never shifts: a missed Monday is "missed", and Tuesday is
 * still Walking. Exercise prescriptions per week are added in Phase 3.
 */

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: 1 = Monday … 7 = Sunday

export type ActivityType =
  | "lower_body"
  | "walking"
  | "upper_body_core"
  | "recovery"
  | "full_body_core"
  | "rest";

export type ScheduleDay = {
  day: DayOfWeek;
  shortLabel: string;
  label: string;
  activity: ActivityType;
  activityLabel: string;
};

export const WEEKLY_SCHEDULE: readonly ScheduleDay[] = [
  { day: 1, shortLabel: "Mon", label: "Monday", activity: "lower_body", activityLabel: "Lower Body" },
  { day: 2, shortLabel: "Tue", label: "Tuesday", activity: "walking", activityLabel: "Walking" },
  { day: 3, shortLabel: "Wed", label: "Wednesday", activity: "upper_body_core", activityLabel: "Upper Body & Core" },
  { day: 4, shortLabel: "Thu", label: "Thursday", activity: "recovery", activityLabel: "Recovery / Stretching" },
  { day: 5, shortLabel: "Fri", label: "Friday", activity: "full_body_core", activityLabel: "Full Body & Core" },
  { day: 6, shortLabel: "Sat", label: "Saturday", activity: "walking", activityLabel: "Walking" },
  { day: 7, shortLabel: "Sun", label: "Sunday", activity: "rest", activityLabel: "Rest" },
] as const;

export type TrainingPhase = {
  id: "foundation" | "beginner_strength" | "progressive_overload" | "strengthening";
  name: string;
  firstWeek: number;
  lastWeek: number;
};

export const TRAINING_PHASES: readonly TrainingPhase[] = [
  { id: "foundation", name: "Foundation", firstWeek: 1, lastWeek: 1 },
  { id: "beginner_strength", name: "Beginner Strength", firstWeek: 2, lastWeek: 4 },
  { id: "progressive_overload", name: "Progressive Overload", firstWeek: 5, lastWeek: 8 },
  { id: "strengthening", name: "Strengthening", firstWeek: 9, lastWeek: 12 },
] as const;

export const PROGRAM_WEEKS = 12;

/** Official body-measurement weeks. */
export const MEASUREMENT_WEEKS = [1, 4, 8, 12] as const;

/**
 * late   = past, not done, still in the same program week (catch-up available)
 * missed = past, not done, an earlier program week (catch-up still possible for strength)
 */
export type ScheduleStatus = "upcoming" | "today" | "completed" | "late" | "missed" | "rest" | "not_configured";

/**
 * Thursday recovery can't be logged until its routine is approved by the
 * owner (Phase 9). Until then recovery days are "Not configured": never
 * counted as planned, completed, late or missed. Flip to true when the
 * recovery routine ships.
 */
export const RECOVERY_CONFIGURED = false;

/** Activities that count toward completion (planned / done). */
export function countsTowardCompletion(activity: ActivityType): boolean {
  if (activity === "rest") return false;
  if (activity === "recovery") return RECOVERY_CONFIGURED;
  return true;
}

export function isStrengthDay(activity: ActivityType): boolean {
  return (
    activity === "lower_body" ||
    activity === "upper_body_core" ||
    activity === "full_body_core"
  );
}
