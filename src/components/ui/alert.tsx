import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "info" | "success" | "warning" | "danger";

const styles: Record<Tone, { box: string; icon: LucideIcon }> = {
  info: { box: "bg-accent-50 text-accent-800 border-accent-100", icon: Info },
  success: { box: "bg-success-soft text-success border-success/15", icon: CircleCheck },
  warning: { box: "bg-warning-soft text-warning border-warning/15", icon: TriangleAlert },
  danger: { box: "bg-danger-soft text-danger border-danger/15", icon: CircleAlert },
};

/**
 * Inline message. Errors use role="alert" so screen readers announce them;
 * other tones use role="status".
 */
export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = styles[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-sm", box, className)}
    >
      <Icon aria-hidden className="mt-px size-4.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
