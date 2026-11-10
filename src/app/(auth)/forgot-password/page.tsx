import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-title">Reset password</h1>
      <p className="mt-1 mb-6 text-[0.9375rem] text-ink-muted">
        Enter your account email and we&apos;ll send you a link to choose a new password.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
