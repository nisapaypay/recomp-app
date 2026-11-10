import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
};

/**
 * Data Access Layer entry point: the verified current user, or null.
 * Reads request cookies → callers must render inside <Suspense>.
 * Deduplicated per request with React `cache`.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Supabase auth checks token expiry with Date.now(). Mark this as
  // request-time work first, otherwise Cache Components rejects the current
  // time during (pre)rendering. No-op in Server Actions and Route Handlers.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: data.claims.sub, email };
});

/** Use in Server Actions and server-rendered data access. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reason=expired");
  return user;
}
