/**
 * Reminder rules (pure; unit-tested).
 *
 * RECOMP has no push server: reminders are evaluated by the OPEN app (on
 * load, when the tab becomes visible, and once a minute) and shown as an
 * in-app banner, plus a browser notification when permission was granted.
 * Nothing fires while the app is fully closed — the UI says so.
 *
 * - Times and weekdays are evaluated in the user's saved timezone.
 * - A reminder is due only on a selected weekday, at/after the chosen time,
 *   and only while its activity / check-in is still not done.
 * - Each reminder has a stable id (one per activity per day) so it is
 *   notified at most once and can be dismissed.
 *
 * Imports use .ts extensions so the module runs under plain Node in tests.
 */
import type { IsoDate } from "../program/calendar.ts";

export type ReminderSettings = {
  workoutEnabled: boolean;
  workoutTime: string; // "HH:MM"
  measurementEnabled: boolean;
  measurementTime: string; // "HH:MM"
  days: number[]; // ISO weekdays 1–7
  timezone: string;
};

export type ReminderInputs = {
  /** Today's program activity (fixed calendar), or null without an active program / rest day. */
  activity: {
    date: IsoDate;
    kind: "strength" | "walking" | "recovery";
    label: string;
    status: "today" | "completed";
    href: string;
  } | null;
  /** The next official check-in when it is due this week or late; null otherwise (or already saved). */
  checkIn: { week: number; status: "due" | "late"; href: string } | null;
};

export type Reminder = { id: string; kind: "workout" | "measurement"; title: string; body: string; href: string };

const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Calendar date, ISO weekday and minutes since midnight of `now` in `timeZone`. */
export function localParts(now: Date, timeZone: string): { date: IsoDate; isoDay: number; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    isoDay: WEEKDAY[parts.weekday],
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz.length > 0 && tz.length <= 64;
  } catch {
    return false;
  }
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

const WORKOUT_TEXT: Record<"strength" | "walking" | "recovery", (label: string) => string> = {
  strength: (l) => `${l} is on today's plan. Open RECOMP to start when you're ready.`,
  walking: (l) => `${l}: today's walk is waiting. Log it after your walk.`,
  recovery: () => "Recovery day — keep it light with gentle movement and stretching.",
};

/** Reminders that are due at `now` (in the user's timezone). */
export function dueReminders(now: Date, settings: ReminderSettings, inputs: ReminderInputs): Reminder[] {
  const tz = isValidTimeZone(settings.timezone) ? settings.timezone : "Asia/Jakarta";
  const local = localParts(now, tz);
  if (!settings.days.includes(local.isoDay)) return [];
  const due: Reminder[] = [];

  const a = inputs.activity;
  if (settings.workoutEnabled && a && a.status !== "completed" && local.minutes >= timeToMinutes(settings.workoutTime)) {
    due.push({
      id: `workout:${a.date}`,
      kind: "workout",
      title: a.kind === "recovery" ? "Recovery day" : `Today: ${a.label}`,
      body: WORKOUT_TEXT[a.kind](a.label),
      href: a.href,
    });
  }

  const c = inputs.checkIn;
  if (settings.measurementEnabled && c && local.minutes >= timeToMinutes(settings.measurementTime)) {
    due.push({
      id: `measurement:w${c.week}:${local.date}`,
      kind: "measurement",
      title: `Week ${c.week} check-in`,
      body:
        c.status === "late"
          ? `Your week ${c.week} measurement isn't saved yet — it still counts if you record it now.`
          : `Week ${c.week} is a measurement week. Record weight and body fat when it suits you.`,
      href: c.href,
    });
  }
  return due;
}

/** Only reminders not notified before (stable ids → never twice). */
export function toNotify(due: Reminder[], alreadyNotified: ReadonlySet<string>): Reminder[] {
  return due.filter((r) => !alreadyNotified.has(r.id));
}

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Every day" / "Weekdays" / "Mon, Wed, Fri". */
export function describeDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  if (sorted.join() === "1,2,3,4,5") return "Weekdays";
  if (sorted.join() === "6,7") return "Weekends";
  return sorted.map((d) => DAY_SHORT[d - 1]).join(", ");
}
