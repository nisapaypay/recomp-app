/** Routes reachable without a session. Everything else requires sign-in. */
export const PUBLIC_ROUTES = ["/login", "/forgot-password", "/auth/callback"] as const;

/** Public routes a signed-in user should be bounced away from. */
export const GUEST_ONLY_ROUTES = ["/login", "/forgot-password"] as const;

export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";

export function matchesRoute(pathname: string, routes: readonly string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Only allow same-origin, absolute paths as post-login redirect targets.
 * Blocks open redirects such as "//evil.com", "https://evil.com" or "/\\evil".
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return DEFAULT_AUTHENTICATED_PATH;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  if (matchesRoute(next.split(/[?#]/)[0], PUBLIC_ROUTES)) return DEFAULT_AUTHENTICATED_PATH;
  return next;
}

/** Why the user landed on /login — drives the notice shown above the form. */
export type LoginReason =
  | "expired"
  | "signed_out"
  | "password_updated"
  | "link_invalid"
  | "reset_requested";

export const LOGIN_REASON_MESSAGES: Record<LoginReason, { tone: "info" | "success" | "warning"; text: string }> = {
  expired: { tone: "warning", text: "Your session has expired. Please sign in again." },
  signed_out: { tone: "info", text: "You've been signed out." },
  password_updated: { tone: "success", text: "Password updated. Sign in with your new password." },
  link_invalid: { tone: "warning", text: "That link is invalid or has expired. Request a new one." },
  reset_requested: { tone: "info", text: "Check your email for a password reset link." },
};

export function isLoginReason(value: string | null): value is LoginReason {
  return value !== null && value in LOGIN_REASON_MESSAGES;
}
