import "server-only";

import { cache } from "react";
import { nextCheckIn } from "@/lib/measurements/measurements";
import { isStrengthDay } from "@/lib/program/schedule";
import type { ReminderInputs, ReminderSettings } from "@/lib/reminders/reminders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { getCurrentProgram } from "@/server/program/queries";
import { getProgramOverview, getWeekView } from "@/server/program/view";
import { getProgressContext } from "@/server/progress/queries";

const hhmm = (t: unknown, fallback: string) => (typeof t === "string" && /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : fallback);

/** The user's reminder preferences (one row per user, RLS own). */
export const getReminderSettings = cache(async (): Promise<ReminderSettings> => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reminder_settings")
    .select("workout_reminders_enabled,workout_reminder_time,measurement_reminders_enabled,measurement_reminder_time,reminder_days,timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Could not load reminder settings: ${error.message}`);
  return {
    workoutEnabled: Boolean(data?.workout_reminders_enabled),
    workoutTime: hhmm(data?.workout_reminder_time, "08:00"),
    measurementEnabled: data ? Boolean(data.measurement_reminders_enabled) : true,
    measurementTime: hhmm(data?.measurement_reminder_time, "08:00"),
    days: Array.isArray(data?.reminder_days) ? (data.reminder_days as number[]) : [1, 2, 3, 4, 5, 6, 7],
    timezone: typeof data?.timezone === "string" ? data.timezone : "Asia/Jakarta",
  };
});

/** Today's program activity + the open check-in (real records only). */
export const getReminderInputs = cache(async (): Promise<ReminderInputs> => {
  const program = await getCurrentProgram();
  if (!program || program.status !== "active") return { activity: null, checkIn: null };

  const overview = await getProgramOverview(program);
  let activity: ReminderInputs["activity"] = null;
  if (overview.timing.state === "in_progress") {
    const today = (await getWeekView(overview, overview.currentWeek)).find((d) => d.isToday) ?? null;
    // Rest days and a not-yet-configured recovery day get no reminder.
    if (today && today.activity !== "rest" && today.status !== "not_configured") {
      activity = {
        date: today.date,
        kind: isStrengthDay(today.activity) ? "strength" : today.activity === "walking" ? "walking" : "recovery",
        label: today.activityLabel,
        status: today.status === "completed" ? "completed" : "today",
        href: today.activity === "walking" ? `/walking?walk=${today.date}#log` : `/workout/day/${today.date}`,
      };
    }
  }

  const { schedule } = await getProgressContext();
  const next = nextCheckIn(schedule);
  const checkIn = next && (next.status === "due" || next.status === "late") ? { week: next.week, status: next.status, href: "/progress/measurements#log" } : null;
  return { activity, checkIn };
});
