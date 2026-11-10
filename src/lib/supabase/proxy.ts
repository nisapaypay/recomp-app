import { createServerClient } from "@supabase/ssr";
import type { JwtPayload } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabasePublicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session cookies for this request and returns the
 * verified JWT claims (or null). Runs in `src/proxy.ts` on every matched
 * request so Server Components always see a fresh session.
 *
 * `getClaims()` verifies the JWT signature (asymmetric ES256 keys → verified
 * locally against the project's JWKS, no auth round-trip per request).
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  claims: JwtPayload | null;
}> {
  const { url, publishableKey } = requireSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cache-Control headers that stop CDNs caching auth responses.
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not run code between client creation and getClaims(): it can cause
  // hard-to-debug random sign-outs.
  const { data, error } = await supabase.auth.getClaims();
  const claims = !error && data?.claims ? data.claims : null;

  return { response, claims };
}

/** True when the browser still carries Supabase auth cookies. */
export function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
}

/** Redirect while preserving any cookies Supabase set during refresh. */
export function redirectWithCookies(target: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(target);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}
