import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type CardProps = ComponentProps<"section"> & {
  padding?: "none" | "md" | "lg";
  tone?: "default" | "accent" | "muted";
};

const paddings = { none: "", md: "p-5", lg: "p-6 lg:p-7" } as const;
const tones = {
  default: "bg-surface border border-line/70 shadow-card",
  accent: "bg-accent-800 text-white shadow-raised",
  muted: "bg-surface-muted",
} as const;

export function Card({
  padding = "md",
  tone = "default",
  className,
  ...props
}: CardProps) {
  return (
    <section
      className={cn("rounded-card", tones[tone], paddings[padding], className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  eyebrow,
  action,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-overline uppercase text-ink-muted">{eyebrow}</p>
        ) : null}
        <h2 className="text-heading text-current">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
