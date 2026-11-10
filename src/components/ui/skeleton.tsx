import { cn } from "@/lib/utils/cn";

/** Loading placeholder block. Decorative; pair with an accessible status. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-control bg-surface-muted", className)}
    />
  );
}
