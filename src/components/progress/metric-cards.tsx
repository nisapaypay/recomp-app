import { LineChart as LineChartIcon } from "lucide-react";
import { formatDate } from "@/lib/program/format";
import {
  METRICS,
  changeFor,
  formatDelta,
  formatValue,
  seriesFor,
  type MeasurementRecord,
  type MetricKey,
} from "@/lib/measurements/measurements";
import { MetricChart } from "./metric-chart";

const CHART_METRICS: MetricKey[] = ["weightKg", "bodyFatPct", "skeletalMuscleKg", "waistCm", "lowerAbdomenCm", "armCm", "thighCm"];

/** Small multiples: one card per metric with first / latest / change and a chart of real values. */
export function MetricCards({ records }: { records: MeasurementRecord[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CHART_METRICS.map((key) => {
        const def = METRICS.find((m) => m.key === key)!;
        const change = changeFor(records, def);
        const points = seriesFor(records, key).map((p) => ({
          t: Date.parse(`${p.date}T00:00:00Z`),
          value: p.value,
          label: formatDate(p.date, "medium"),
          week: p.week,
        }));
        return (
          <section key={key} className="rounded-card border border-line/70 bg-surface p-5 shadow-card" aria-labelledby={`m-${key}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 id={`m-${key}`} className="font-semibold text-ink">
                {def.label}
              </h3>
              {change ? (
                <p className="text-sm tabular-nums text-ink-soft">
                  <span className="text-heading text-ink">{formatValue(change.latest.value, def)}</span>
                  <span className="ml-1.5 text-caption text-ink-muted">{formatDate(change.latest.date, "medium")}</span>
                </p>
              ) : null}
            </div>
            {change ? (
              <>
                <p className="mt-0.5 text-caption text-ink-muted">
                  {change.delta === null
                    ? "One check-in so far — a trend appears after the next one."
                    : `${formatDelta(change.delta, def)} since ${formatDate(change.first.date, "medium")} (first: ${formatValue(change.first.value, def)})`}
                </p>
                <div className="mt-3">
                  <MetricChart points={points} unit={def.unit} decimals={def.decimals} />
                </div>
                <p className="mt-2 text-caption text-ink-muted">{def.context}</p>
              </>
            ) : (
              <div className="mt-3 grid h-44 place-items-center rounded-control bg-surface-muted text-center">
                <div className="px-6">
                  <LineChartIcon aria-hidden className="mx-auto size-5 text-ink-faint" />
                  <p className="mt-2 text-sm text-ink-muted">
                    No {def.label.toLowerCase()} recorded yet{def.required ? "" : " — it's optional"}.
                  </p>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
