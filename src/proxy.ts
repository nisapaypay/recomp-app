import type { NextRequest } from "next/server";
import {
  DEFAULT_AUTHENTICATED_PATH,
  GUEST_ONLY_ROUTES,
  PUBLIC_ROUTES,
  matchesRoute,
} from "@/lib/auth/redirect";
import { hasAuthCookie, redirectWithCookies, updateSession } from "@/lib/supabase/proxy";

/**
 * Route protection (Next.js 16 Proxy, formerly Middleware).
 *
 * This is an optimistic gate based on the verified session cookie. It is NOT
 * the only line of defence: Server Actions / data access re-check the user
 * (src/server/auth.ts) and the database enforces Row Level Security.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { response, claims } = await updateSession(request);
  const signedIn = claims !== null;

  // API routes check auth themselves and answer 401 (no HTML login redirect for fetch()).
  if (pathname.startsWith("/api/")) return response;

  if (!signedIn && !matchesRoute(pathname, PUBLIC_ROUTES)) {
    const login = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== DEFAULT_AUTHENTICATED_PATH) {
      login.searchParams.set("next", `${pathname}${search}`);
    }
    if (hasAuthCookie(request)) login.searchParams.set("reason", "expired");
    return redirectWithCookies(login, response);
  }

  if (signedIn && matchesRoute(pathname, GUEST_ONLY_ROUTES)) {
    return redirectWithCookies(new URL(DEFAULT_AUTHENTICATED_PATH, request.url), response);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files (anything with an extension).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
