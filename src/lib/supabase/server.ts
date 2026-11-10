import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireSupabasePublicEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Reads the auth session from request cookies, so callers are dynamic and
 * (with Cache Components) must render inside a <Suspense> boundary.
 * Wired up in Phase 2 — not yet used by any screen.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, publishableKey } = requireSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by the proxy (added in Phase 2).
        }
      },
    },
  });
}
