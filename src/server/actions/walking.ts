"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayIn, type IsoDate } from "@/lib/program/calendar";
import { scheduledWalks, validateWalk, type WalkErrors } from "@/lib/walking/walking";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";

/**
 * Walking mutations. The server re-validates everything with the same rules
 * as the form (src/lib/walking/walking.ts); the database adds RLS, the unique
 * scheduled-walk index and a validation trigger (migration 11).
 */

const UUID = /^[0-9a-f-]{36}$/i;

export type WalkFormState = { errors?: WalkErrors; error?: string };

const DB_ERRORS: Record<string, string> = {
  walk_in_future: "The date can't be in the future.",
  not_a_program_walk: "That isn't one of your program walks.",
};

function revalidateWalking() {
  revalidatePath("/walking", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/workout", "layout");
}

/** Create (no id) or edit (id) a walk. Editing updates the same row in place. */
export async function saveWalk(_prev: WalkFormState, formData: FormData): Promise<WalkFormState> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("id") ?? "");
  if (id && !UUID.test(id)) return { error: "Invalid walk." };

  // Context: the user's latest program + logged scheduled walks (excluding the one being edited).
  const [program, targets, logged, existing] = await Promise.all([
    supabase
      .from("user_programs")
      .select("start_date")
      .eq("user_id", user.id)
      .in("status", ["active", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("program_days")
      .select("week_number,day_of_week,walking_target_min_minutes,walking_target_max_minutes")
      .eq("activity_type", "walking"),
    supabase.from("walking_activities").select("id,scheduled_date").eq("user_id", user.id).not("scheduled_date", "is", null),
    id
      ? supabase.from("walking_activities").select("id,scheduled_date").eq("id", id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (program.error || targets.error || logged.error || existing.error) return { error: "Could not load your program. Try again." };
  if (id && !existing.data) return { error: "This walk no longer exists." };

  const walks = program.data
    ? scheduledWalks(
        program.data.start_date as IsoDate,
        (targets.data ?? []).map((t) => ({
          week: t.week_number as number,
          dayOfWeek: t.day_of_week as number,
          minMinutes: (t.walking_target_min_minutes as number | null) ?? 0,
          maxMinutes: (t.walking_target_max_minutes as number | null) ?? 0,
        })),
      )
    : [];
  const editingScheduledDate = (existing.data?.scheduled_date as IsoDate | null | undefined) ?? null;
  const loggedDates = new Set(
    (logged.data ?? []).filter((r) => r.id !== id).map((r) => r.scheduled_date as IsoDate),
  );

  const result = validateWalk(
    {
      activityDate: String(formData.get("activityDate") ?? ""),
      hours: String(formData.get("hours") ?? ""),
      minutes: String(formData.get("minutes") ?? ""),
      distance: String(formData.get("distance") ?? ""),
      steps: String(formData.get("steps") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      scheduledDate: String(formData.get("scheduledDate") ?? ""),
    },
    { today: todayIn(), walks, loggedDates, editingScheduledDate },
  );
  if (!result.ok) return { errors: result.errors };

  const v = result.value;
  const row = {
    activity_date: v.activityDate,
    scheduled_date: v.scheduledDate,
    duration_minutes: v.durationMinutes,
    distance_km: v.distanceKm,
    steps: v.steps,
    notes: v.notes,
  };
  const { data: savedRow, error } = id
    ? await supabase.from("walking_activities").update(row).eq("id", id).eq("user_id", user.id).select("id").maybeSingle()
    : await supabase.from("walking_activities").insert({ ...row, user_id: user.id }).select("id").single();
  if (error) {
    if (error.code === "23505") {
      return { errors: { scheduledDate: "That program walk is already logged. Log this one as an additional walk instead." } };
    }
    const known = Object.keys(DB_ERRORS).find((k) => error.message.includes(k));
    return { error: known ? DB_ERRORS[known] : "Could not save the walk. Try again." };
  }

  if (!savedRow) return { error: "This walk no longer exists." };
  revalidateWalking();
  redirect(id ? `/walking/${id}?saved=1` : `/walking?saved=${savedRow.id as string}`);
}

/** Delete one of the user's walks (confirmed in the UI). */
export async function deleteWalk(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(id)) return { ok: false, error: "Invalid walk." };
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("walking_activities")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not delete the walk. Try again." };
  if (count === 0) return { ok: false, error: "This walk no longer exists." };
  revalidateWalking();
  return { ok: true };
}
