"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * One metric over time — real check-ins only.
 * - Single series → no legend; the card title names it.
 * - Time-scaled x axis (dates keep their real spacing); straight segments
 *   between recorded values (type="linear"), no smoothing, no extrapolation.
 * - 2px line, 10px markers with a 2px surface ring, hairline solid grid.
 * - Crosshair + tooltip on hover/tap. The history table is the table view.
 */
export type ChartPoint = { t: number; value: number; label: string; week: number };

const SERIES = "#5d3fbb"; // accent-600 — validated (lightness, chroma, contrast vs surface)
const GRID = "#e6e3ea"; // line token
const AXIS_TEXT = "#6e6a77"; // ink-muted

export function MetricChart({ points, unit, decimals }: { points: ChartPoint[]; unit: string; decimals: number }) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.25, max * 0.01, 0.5);
  const domain: [number, number] = [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  const fmt = (v: number) => `${Number(v.toFixed(decimals))}${unit === "%" ? "%" : unit === "level" ? "" : ` ${unit}`}`;
  const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="h-44 w-full" role="img" aria-label={`Chart with ${points.length} recorded values`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={points.length === 1 ? [points[0].t - 7 * 864e5, points[0].t + 7 * 864e5] : ["dataMin", "dataMax"]}
            ticks={points.map((p) => p.t)}
            tickFormatter={(t: number) => short.format(new Date(t))}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            padding={{ left: 12, right: 12 }}
          />
          <YAxis
            domain={domain}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            tickFormatter={(v: number) => String(Number(v.toFixed(1)))}
            axisLine={false}
            tickLine={false}
            width={40}
            tickCount={4}
          />
          <Tooltip
            cursor={{ stroke: GRID, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active && payload?.[0] ? (payload[0].payload as ChartPoint) : null;
              if (!p) return null;
              return (
                <div className="rounded-control border border-line bg-surface px-3 py-2 text-caption shadow-raised">
                  <p className="font-semibold text-ink tabular-nums">{fmt(p.value)}</p>
                  <p className="text-ink-muted">
                    {p.label} · Week {p.week}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="linear"
            dataKey="value"
            stroke={SERIES}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{ r: 5, fill: SERIES, stroke: "#ffffff", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: SERIES, stroke: "#ffffff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
