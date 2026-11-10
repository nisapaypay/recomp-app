import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-title">Welcome back</h1>
      <p className="mt-1 mb-6 text-[0.9375rem] text-ink-muted">Sign in to continue your program.</p>
      {/* The form reads ?next and ?reason, which are request-time values. */}
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm />
      </Suspense>
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <Skeleton className="h-[4.5rem]" />
      <Skeleton className="h-[4.5rem]" />
      <Skeleton className="h-13" />
    </div>
  );
}
