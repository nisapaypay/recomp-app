import "server-only";

import { cache } from "react";
import type { IsoDate } from "@/lib/program/calendar";
import { scheduledWalks, type ScheduledWalk, type WalkingTarget } from "@/lib/walking/walking";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { getCurrentProgram, getToday } from "@/server/program/queries";

/** Walking data access. RLS limits rows to the signed-in user; queries also filter by user_id. */

export type Walk = {
  id: string;
  activityDate: IsoDate;
  scheduledDate: IsoDate | null;
  durationMinutes: number;
  distanceKm: number | null;
  steps: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = Record<string, unknown>;
const COLUMNS = "id,activity_date,scheduled_date,duration_minutes,distance_km,steps,notes,created_at,updated_at";

function map(r: Row): Walk {
  return {
    id: r.id as string,
    activityDate: r.activity_date as IsoDate,
    scheduledDate: (r.scheduled_date as IsoDate | null) ?? null,
    durationMinutes: Number(r.duration_minutes),
    distanceKm: r.distance_km === null ? null : Number(r.distance_km),
    steps: (r.steps as number | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

/** Program walking targets (reference data: 24 Tue/Sat rows). */
export const getWalkingTargets = cache(async (): Promise<WalkingTarget[]> => {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_days")
    .select("week_number,day_of_week,walking_target_min_minutes,walking_target_max_minutes")
    .eq("activity_type", "walking")
    .order("week_number")
    .order("day_of_week");
  if (error) throw new Error(`Could not load walking targets: ${error.message}`);
  return (data as Row[]).map((r) => ({
    week: r.week_number as number,
    dayOfWeek: r.day_of_week as number,
    minMinutes: (r.walking_target_min_minutes as number | null) ?? 0,
    maxMinutes: (r.walking_target_max_minutes as number | null) ?? 0,
  }));
});

/** The user's walks, newest first, optionally limited to activity dates from `from`. */
export const getWalks = cache(async (from?: IsoDate): Promise<Walk[]> => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("walking_activities")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (from) query = query.gte("activity_date", from);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load walks: ${error.message}`);
  return (data as Row[]).map(map);
});

export const getWalk = cache(async (id: string): Promise<Walk | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("walking_activities").select(COLUMNS).eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error(`Could not load the walk: ${error.message}`);
  return data ? map(data as Row) : null;
});

export type WalkingContext = {
  today: IsoDate;
  /** The program's 24 walks (empty without a program). */
  walks: ScheduledWalk[];
  /** Scheduled dates that already have a log. */
  loggedDates: IsoDate[];
  programActive: boolean;
};

/** Everything the walk form needs to offer the right "which walk?" choices. */
export const getWalkingContext = cache(async (): Promise<WalkingContext> => {
  const [today, program, targets, user] = await Promise.all([getToday(), getCurrentProgram(), getWalkingTargets(), requireUser()]);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("walking_activities")
    .select("scheduled_date")
    .eq("user_id", user.id)
    .not("scheduled_date", "is", null);
  if (error) throw new Error(`Could not load logged walks: ${error.message}`);
  return {
    today,
    walks: program ? scheduledWalks(program.startDate, targets) : [],
    loggedDates: (data as Row[]).map((r) => r.scheduled_date as IsoDate),
    programActive: program?.status === "active",
  };
});
