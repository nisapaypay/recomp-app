import { VIEWBOX, capsulePath, figurePrimitives, isMirrored, viewBoxFor, type FigureConfig } from "@/lib/animation/figure";
import type { Movement } from "@/lib/animation/movement";
import { humanize } from "@/lib/program/format";

/** Draws an exercise figure for a given pose. Pure presentational (no timing). */
export function FigureSvg({
  config,
  movement,
  muscles,
  className,
}: {
  config: FigureConfig;
  movement: Pick<Movement, "amount" | "cycle" | "side">;
  muscles?: readonly string[];
  className?: string;
}) {
  const prims = figurePrimitives(config, movement, { muscles });
  const mirror = config.view === "side" && isMirrored(movement);
  return (
    <svg viewBox={viewBoxFor(config)} preserveAspectRatio="xMidYMid meet" className={className ?? "h-full w-full"} aria-hidden>
      <g transform={mirror ? `translate(${VIEWBOX.width} 0) scale(-1 1)` : undefined}>
        {prims.map((p, i) =>
          p.type === "capsule" ? (
            <path key={i} d={capsulePath(p.from, p.to, p.r1, p.r2)} fill={p.fill} opacity={p.opacity} />
          ) : p.type === "circle" ? (
            <circle key={i} cx={p.at[0]} cy={p.at[1]} r={p.r} fill={p.fill} opacity={p.opacity} />
          ) : p.type === "ellipse" ? (
            <ellipse key={i} cx={p.at[0]} cy={p.at[1]} rx={p.rx} ry={p.ry} fill={p.fill} />
          ) : (
            <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill={p.fill} />
          ),
        )}
      </g>
    </svg>
  );
}

/** Red-dot legend of the focus muscles shown on the figure. */
export function MuscleLegend({ muscles, className }: { muscles: readonly string[]; className?: string }) {
  if (muscles.length === 0) return null;
  return (
    <p className={className ?? "flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-soft"}>
      <span className="font-semibold text-ink">Focus</span>
      {muscles.map((m) => (
        <span key={m} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-[#e5484d]" />
          {humanize(m)}
        </span>
      ))}
    </p>
  );
}
