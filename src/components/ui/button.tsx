import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold " +
  "transition-colors select-none disabled:pointer-events-none disabled:opacity-45 " +
  "aria-disabled:pointer-events-none aria-disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-muted active:bg-line",
  ghost: "text-ink-soft hover:bg-surface-muted hover:text-ink",
  danger: "bg-danger text-white hover:brightness-95 active:brightness-90",
};

// All sizes keep a ≥44px touch target except `sm` (desktop-only contexts).
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[0.9375rem]",
  lg: "h-13 px-6 text-base",
  xl: "h-16 px-8 text-lg rounded-card", // workout controls
};

export type ButtonStyleProps = { variant?: Variant; size?: Size };

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyleProps & { className?: string }): string {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonStyleProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyleProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props} />
  );
}
