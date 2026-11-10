"use server";

import { revalidatePath } from "next/cache";
import { isValidTime, isValidTimeZone, type ReminderSettings } from "@/lib/reminders/reminders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";

/** Save reminder preferences to the user's reminder_settings row (RLS: own row only). */
export async function saveReminderSettings(input: ReminderSettings): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!isValidTime(input.workoutTime) || !isValidTime(input.measurementTime)) return { ok: false, error: "Choose a valid time." };
  const days = [...new Set(input.days)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort();
  if (days.length === 0) return { ok: false, error: "Choose at least one day." };
  const timezone = isValidTimeZone(input.timezone) ? input.timezone : "Asia/Jakarta";

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("reminder_settings")
    .update(
      {
        workout_reminders_enabled: Boolean(input.workoutEnabled),
        workout_reminder_time: input.workoutTime,
        measurement_reminders_enabled: Boolean(input.measurementEnabled),
        measurement_reminder_time: input.measurementTime,
        reminder_days: days,
        timezone,
      },
      { count: "exact" },
    )
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not save your reminder settings. Try again." };
  if (count === 0) return { ok: false, error: "Your settings row is missing — sign out and in again." };
  revalidatePath("/settings");
  return { ok: true };
}
