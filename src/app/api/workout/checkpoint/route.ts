import { NextResponse, type NextRequest } from "next/server";
import type { CheckpointWrite } from "@/lib/engine/checkpoint";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Saves a workout checkpoint. A route handler (not a Server Action) so the
 * player can send it with `fetch(..., { keepalive: true })` while the tab is
 * being closed or hidden.
 *
 * Optimistic concurrency: the write only succeeds when `revision` matches
 * the stored one; otherwise another device has taken over (409).
 */
const UUID = /^[0-9a-f-]{36}$/i;
const PHASES = ["intro", "prepare", "work", "rest", "complete"];
const SIDES = [null, "left", "right", "forward", "backward"];

function int(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}
function isoOrNull(v: unknown): v is string | null {
  return v === null || (typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)));
}
function tempoOverride(v: unknown): boolean {
  if (v === null) return true;
  if (typeof v !== "object" || Array.isArray(v)) return false;
  const entries = Object.entries(v as Record<string, unknown>);
  return entries.length <= 20 && entries.every(([k, t]) => /^\d{1,2}$/.test(k) && Array.isArray(t) && t.length === 3 && t.every((n) => int(n, 0, 10)));
}

function validate(c: unknown): c is CheckpointWrite {
  if (!c || typeof c !== "object") return false;
  const x = c as Record<string, unknown>;
  return (
    int(x.current_exercise_index, 0, 20) &&
    int(x.current_set, 1, 6) &&
    SIDES.includes(x.current_side as string | null) &&
    int(x.current_rep, 0, 300) &&
    PHASES.includes(x.current_phase as string) &&
    isoOrNull(x.phase_started_at) &&
    (x.phase_duration_ms === null || int(x.phase_duration_ms, 0, 3_600_000)) &&
    (x.remaining_ms === null || int(x.remaining_ms, 0, 3_600_000)) &&
    typeof x.paused === "boolean" &&
    int(x.paused_ms_total, 0, 2_000_000_000) &&
    isoOrNull(x.paused_at) &&
    tempoOverride(x.tempo_override)
  );
}

export async function POST(request: NextRequest) {
  let body: { sessionId?: unknown; revision?: unknown; checkpoint?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { sessionId, revision, checkpoint } = body;
  if (typeof sessionId !== "string" || !UUID.test(sessionId) || !int(revision, 0, 1_000_000_000) || !validate(checkpoint)) {
    return NextResponse.json({ error: "invalid_checkpoint" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select("status")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (sessionError) return NextResponse.json({ error: "server_error" }, { status: 500 });
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.status !== "in_progress") return NextResponse.json({ error: "not_active", status: session.status }, { status: 409 });

  const { data, error } = await supabase
    .from("workout_session_state")
    .update({ ...checkpoint, revision: revision + 1 })
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("revision", revision)
    .select("revision")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "conflict" }, { status: 409 });
  return NextResponse.json({ revision: data.revision });
}
