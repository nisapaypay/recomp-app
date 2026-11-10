"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayIn, validateStartDate } from "@/lib/program/calendar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";

export type ProgramFormState = { error?: string; success?: string };

function readStartDate(formData: FormData): string {
  const value = formData.get("startDate");
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Start the 12-week program. The database guarantees a Monday start date and
 * at most one active program per user; this action validates first so the
 * user gets a clear message, and treats a duplicate submit as harmless.
 */
export async function startProgram(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  const user = await requireUser();
  const startDate = readStartDate(formData);
  const validation = validateStartDate(startDate, todayIn());
  if (validation) return { error: validation };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("user_programs").insert({ user_id: user.id, start_date: startDate });

  if (error) {
    if (error.code === "23505") {
      // Already active (double submit, or another device) — show the existing program.
      redirect("/dashboard");
    }
    if (error.code === "23514") return { error: "The program must start on a Monday." };
    return { error: "Could not start the program. Check your connection and try again." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Change the start date of the active program. Allowed only before any
 * workout has been recorded for it, so history is never re-dated.
 */
export async function changeProgramStartDate(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  const user = await requireUser();
  const startDate = readStartDate(formData);

  const supabase = await createSupabaseServerClient();
  const { data: program, error: loadError } = await supabase
    .from("user_programs")
    .select("id,start_date")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (loadError) return { error: "Could not load your program. Try again." };
  if (!program) return { error: "You don't have an active program." };
  if (program.start_date === startDate) return { success: "The start date is unchanged." };

  const validation = validateStartDate(startDate, todayIn());
  if (validation) return { error: validation };

  const { count, error: countError } = await supabase
    .from("workout_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("program_id", program.id);
  if (countError) return { error: "Could not check your workout history. Try again." };
  if ((count ?? 0) > 0) {
    return { error: "The start date can't be changed after workouts have been recorded." };
  }

  const { error } = await supabase
    .from("user_programs")
    .update({ start_date: startDate })
    .eq("id", program.id)
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) return { error: "Could not update the start date. Try again." };

  revalidatePath("/", "layout");
  return { success: "Start date updated." };
}
