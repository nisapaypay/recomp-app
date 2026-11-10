import "server-only";

import { cache } from "react";
import type { ChangeType } from "@/lib/progression/adaptive";
import type { IsoDate } from "@/lib/program/calendar";
import type { ActivityType } from "@/lib/program/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";

/** Adaptive adjustments (RLS: own rows only; also filtered by user_id). */

export type AdjustmentView = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  measureType: "reps" | "seconds";
  sideMode: "none" | "per_side" | "per_direction";
  activityType: ActivityType;
  changeType: ChangeType;
  previousSets: number;
  previousTarget: number;
  newSets: number;
  newTarget: number;
  reason: string;
  effectiveFrom: IsoDate;
  createdAt: string;
  sourceSessionId: string | null;
};

type Row = Record<string, unknown>;

const COLUMNS =
  "id,exercise_id,activity_type,change_type,previous_sets,previous_target,new_sets,new_target,reason,effective_from,created_at,source_session_id," +
  "exercise:exercise_library(name,measure_type,side_mode)";

function map(r: Row): AdjustmentView {
  const lib = (r.exercise as Row | null) ?? {};
  return {
    id: r.id as string,
    exerciseId: r.exercise_id as string,
    exerciseName: (lib.name as string) ?? (r.exercise_id as string),
    measureType: ((lib.measure_type as string) ?? "reps") as AdjustmentView["measureType"],
    sideMode: ((lib.side_mode as string) ?? "none") as AdjustmentView["sideMode"],
    activityType: r.activity_type as ActivityType,
    changeType: r.change_type as ChangeType,
    previousSets: r.previous_sets as number,
    previousTarget: r.previous_target as number,
    newSets: r.new_sets as number,
    newTarget: r.new_target as number,
    reason: r.reason as string,
    effectiveFrom: r.effective_from as IsoDate,
    createdAt: r.created_at as string,
    sourceSessionId: (r.source_session_id as string | null) ?? null,
  };
}

/** The user's adjustments, newest first (optionally for one exercise). */
export const getAdjustmentHistory = cache(async (exerciseId?: string, limit = 50): Promise<AdjustmentView[]> => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("adaptive_adjustments")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (exerciseId) query = query.eq("exercise_id", exerciseId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load training adjustments: ${error.message}`);
  return (data as unknown as Row[]).map(map);
});

/**
 * What the feedback of one workout produced, and whether it can still be
 * changed (only until the next workout of the same type has been started).
 */
export const getFeedbackOutcome = cache(
  async (session: { id: string; activityType: ActivityType; completedAt: string | null }) => {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const [adjustment, later] = await Promise.all([
      supabase.from("adaptive_adjustments").select(COLUMNS).eq("user_id", user.id).eq("source_session_id", session.id).maybeSingle(),
      session.completedAt
        ? supabase
            .from("workout_sessions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("activity_type", session.activityType)
            .neq("id", session.id)
            .gte("created_at", session.completedAt)
        : Promise.resolve({ count: 0, error: null }),
    ]);
    if (adjustment.error) throw new Error(`Could not load the adjustment: ${adjustment.error.message}`);
    if (later.error) throw new Error(`Could not check later workouts: ${later.error.message}`);
    return {
      adjustment: adjustment.data ? map(adjustment.data as unknown as Row) : null,
      locked: (later.count ?? 0) > 0,
    };
  },
);
