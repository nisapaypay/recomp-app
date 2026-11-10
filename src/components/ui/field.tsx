import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export const inputClasses =
  "block h-12 w-full rounded-control border border-line-strong bg-surface px-4 text-base text-ink " +
  "placeholder:text-ink-faint transition-colors focus:border-accent-500 focus:outline-none " +
  "focus:ring-3 focus:ring-accent-100 aria-invalid:border-danger aria-invalid:focus:ring-danger-soft " +
  "disabled:bg-surface-muted disabled:text-ink-muted";

/** Labelled form control with optional hint. 16px text avoids iOS zoom-on-focus. */
export function Field({
  id,
  label,
  hint,
  trailing,
  className,
  ...inputProps
}: ComponentProps<"input"> & {
  id: string;
  label: string;
  hint?: ReactNode;
  /** Element placed inside the input on the right (e.g. show-password toggle). */
  trailing?: ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-soft">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-describedby={hintId}
          className={cn(inputClasses, trailing ? "pr-12" : undefined)}
          {...inputProps}
        />
        {trailing ? (
          <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
