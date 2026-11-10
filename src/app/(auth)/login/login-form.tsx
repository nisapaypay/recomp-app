"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { PasswordField } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LOGIN_REASON_MESSAGES, isLoginReason } from "@/lib/auth/redirect";
import { signIn, type AuthFormState } from "@/server/actions/auth";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const reason = searchParams.get("reason");
  const notice = isLoginReason(reason) ? LOGIN_REASON_MESSAGES[reason] : null;

  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signIn, {});

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? (
        <Alert tone="danger">{state.error}</Alert>
      ) : notice ? (
        <Alert tone={notice.tone}>{notice.text}</Alert>
      ) : null}

      <input type="hidden" name="next" value={next} />

      <Field
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state.email}
        aria-invalid={state.error ? true : undefined}
      />

      <div className="space-y-2">
        <PasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          required
          aria-invalid={state.error ? true : undefined}
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="rounded-sm text-sm font-medium text-accent-600 hover:text-accent-700"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
