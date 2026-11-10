import type { Metadata } from "next";
import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reached from the reset email (via /auth/callback). Requires the recovery session. */
export default function UpdatePasswordPage() {
  return (
    <>
      <h1 className="text-title">Choose a new password</h1>
      <p className="mt-1 mb-6 text-[0.9375rem] text-ink-muted">
        After saving, you&apos;ll be signed out on all devices and can sign in with the new password.
      </p>
      <UpdatePasswordForm />
    </>
  );
}
