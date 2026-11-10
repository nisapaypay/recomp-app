import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { getReminderInputs, getReminderSettings } from "@/server/reminders/queries";

/**
 * Reminder data for the open app: the user's settings and today's program
 * status. Personal data → never cached (no-store); the service worker never
 * caches /api/* either. 401 JSON when signed out (no redirect HTML).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const [settings, inputs] = await Promise.all([getReminderSettings(), getReminderInputs()]);
    return NextResponse.json({ settings, inputs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
