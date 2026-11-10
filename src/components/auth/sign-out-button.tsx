"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/server/actions/auth";
import { cn } from "@/lib/utils/cn";

/** Signs out this device. `compact` = icon-only below lg (sidebar rail). */
export function SignOutButton({
  variant = "nav",
  className,
}: {
  variant?: "nav" | "button";
  className?: string;
}) {
  return (
    <form action={signOut} className={className}>
      <SubmitButton variant={variant} />
    </form>
  );
}

function SubmitButton({ variant }: { variant: "nav" | "button" }) {
  const { pending } = useFormStatus();
  const label = pending ? "Signing out…" : "Log out";

  if (variant === "button") {
    return (
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center gap-2 rounded-control border border-line bg-surface px-4 text-[0.9375rem] font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
      >
        <LogOut aria-hidden className="size-4.5" />
        {label}
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={pending}
      title="Log out"
      className={cn(
        "group flex h-11 w-full items-center gap-3 rounded-control px-3 text-[0.9375rem] font-medium",
        "justify-center text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink lg:justify-start",
        "disabled:opacity-50",
      )}
    >
      <LogOut aria-hidden className="size-5 shrink-0 text-ink-muted group-hover:text-ink" />
      <span className="sr-only lg:not-sr-only">{label}</span>
    </button>
  );
}
