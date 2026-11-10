import type { ReactNode } from "react";
import type { ScheduleStatus } from "@/lib/program/schedule";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-soft",
  accent: "bg-accent-100 text-accent-700",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-chip px-2.5 py-0.5 text-caption font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusTone: Record<ScheduleStatus, Tone> = {
  upcoming: "neutral",
  today: "accent",
  completed: "success",
  missed: "danger",
  rest: "neutral",
};

const statusLabel: Record<ScheduleStatus, string> = {
  upcoming: "Upcoming",
  today: "Today",
  completed: "Completed",
  missed: "Missed",
  rest: "Rest",
};

/** Schedule status chip. Always renders a text label, never colour alone. */
export function StatusBadge({ status }: { status: ScheduleStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}
