"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabasePublicEnv } from "@/lib/env";

let browserClient: SupabaseClient | undefined;

/**
 * Supabase client for Client Components (browser only).
 * Uses the publishable key; all data access is protected by RLS.
 * Wired up in Phase 2 — not yet used by any screen.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const { url, publishableKey } = requireSupabasePublicEnv();
  browserClient = createBrowserClient(url, publishableKey);
  return browserClient;
}
