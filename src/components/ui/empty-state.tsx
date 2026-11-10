import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Honest placeholder for content that has no data yet (or whose feature is
 * not built yet). Never use it to imply data exists.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed",
        "border-line-strong px-6 py-10 text-center",
        className,
      )}
    >
      <span className="mb-3 grid size-11 place-items-center rounded-full bg-accent-50 text-accent-600">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="text-heading text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
