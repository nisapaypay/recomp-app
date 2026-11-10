import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-accent-700 text-white",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <path
          d="M4 16.5 9 11l3.5 3.5L20 7"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M15 7h5v5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Brand({
  showWordmark = true,
  className,
}: {
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/dashboard"
      className={cn("flex items-center gap-2.5 rounded-control", className)}
      aria-label="RECOMP — go to dashboard"
    >
      <BrandMark />
      {showWordmark ? (
        <span className="text-[1.0625rem] font-bold tracking-[0.14em] text-ink">
          RECOMP
        </span>
      ) : null}
    </Link>
  );
}
