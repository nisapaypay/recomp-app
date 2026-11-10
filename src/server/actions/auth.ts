"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  success?: string;
  email?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Map Supabase auth errors to clear, non-technical messages. */
function describeAuthError(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "This email address hasn't been confirmed yet. Check your inbox for the confirmation email.";
    case "user_banned":
      return "This account has been disabled.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a minute and try again.";
    case "same_password":
      return "Your new password must be different from the current one.";
    case "weak_password":
      return "That password is too weak. Use a longer password with a mix of characters.";
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
      return "Your session has expired. Please sign in again.";
    default:
      if (error.name === "AuthRetryableFetchError" || error.status === 0) {
        return "Can't reach the server. Check your internet connection and try again.";
      }
      if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
      return "Something went wrong. Please try again.";
  }
}

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// -----------------------------------------------------------------------------
// Sign in (email + password)
// -----------------------------------------------------------------------------
export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = readString(formData, "email").trim().toLowerCase();
  const password = readString(formData, "password");
  const next = safeNextPath(readString(formData, "next"));

  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address.", email };
  if (!password) return { error: "Enter your password.", email };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: describeAuthError(error), email };

  redirect(next);
}

// -----------------------------------------------------------------------------
// Sign out (this device)
// -----------------------------------------------------------------------------
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?reason=signed_out");
}

// -----------------------------------------------------------------------------
// Password reset: request email
// -----------------------------------------------------------------------------
export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readString(formData, "email").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address.", email };

  const supabase = await createSupabaseServerClient();
  const redirectTo = `${await siteOrigin()}/auth/callback?next=/update-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  // Rate limits and network failures are worth reporting; anything else gets
  // the same neutral message so the form doesn't reveal which emails exist.
  if (error && (error.status === 429 || error.status === 0 || error.name === "AuthRetryableFetchError")) {
    return { error: describeAuthError(error), email };
  }
  return {
    email,
    success: "If an account exists for that email, a reset link is on its way. The link expires after a short time.",
  };
}

// -----------------------------------------------------------------------------
// Password reset: set a new password (requires the recovery session)
// -----------------------------------------------------------------------------
export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = readString(formData, "password");
  const confirm = readString(formData, "confirmPassword");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) return { error: "The passwords don't match." };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?reason=expired");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: describeAuthError(error) };

  // Require a fresh sign-in with the new password everywhere.
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?reason=password_updated");
}
