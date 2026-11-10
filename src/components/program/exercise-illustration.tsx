import { ImageOff } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/**
 * Exercise illustration, or a clearly labelled placeholder while the
 * original illustration assets don't exist yet.
 *
 * The placeholder deliberately shows no figure or pose, only a "no image"
 * icon and visible text at every size, so it can't be mistaken for a
 * picture of the exercise.
 */
export function ExerciseIllustration({
  name,
  path,
  size = "md",
  className,
}: {
  name: string;
  path: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = {
    sm: "size-14 rounded-control",
    md: "aspect-[4/3] w-full rounded-card",
    lg: "aspect-[4/3] w-full rounded-card",
  }[size];

  if (path) {
    return (
      <div className={cn("relative overflow-hidden bg-surface-muted", box, className)}>
        {/* Local SVG assets: served as-is (no image optimisation for SVG). */}
        <Image src={path} alt={`${name}: start and end position`} fill unoptimized className="object-contain p-2" />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`No illustration yet for ${name}`}
      title="No illustration yet"
      className={cn(
        "flex shrink-0 flex-col items-center justify-center gap-1 border border-dashed border-line-strong bg-surface-muted text-center text-ink-muted",
        box,
        className,
      )}
    >
      <ImageOff aria-hidden className={size === "sm" ? "size-4" : "size-7"} />
      {size === "sm" ? (
        <span aria-hidden className="text-[0.625rem] leading-none">
          No image
        </span>
      ) : (
        <>
          <span className="text-sm font-medium text-ink-soft">No illustration yet</span>
          <span className="max-w-[16rem] px-4 text-caption">
            Follow the written instructions. Original illustrations will be added later.
          </span>
        </>
      )}
    </div>
  );
}
