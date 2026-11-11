import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, FileText } from "lucide-react";
import { PageContainer, PageSection } from "@/components/layout/page";
import { AdjustmentHistory } from "@/components/progression/adjustment-history";
import { MetricCards } from "@/components/progress/metric-cards";
import { PhotoCompare } from "@/components/progress/photo-compare";
import { PdfExport } from "@/components/report/pdf-export";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/program/format";
import { formatDelta, formatValue } from "@/lib/measurements/measurements";
import { formatDuration, formatKm, formatPace } from "@/lib/walking/walking";
import { getMeasurements, getPhotos } from "@/server/progress/queries";
import { getReportData } from "@/server/report/queries";

export const metadata: Metadata = { title: "12-week report" };

export default function ReportPage() {
  return (
    <PageContainer>
      <Link href="/progress" className="mb-4 inline-flex h-11 items-center gap-1 rounded-control pr-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ChevronLeft aria-hidden className="size-4.5" />
        Progress
      </Link>
      <Suspense fallback={<Skeleton className="h-[40rem] rounded-card" />}>
        <Report />
      </Suspense>
    </PageContainer>
  );
}

async function Report() {
  const data = await getReportData();
  if (!data) {
    return (
      <EmptyState icon={FileText} title="No program yet" description="Start your 12-week program to build a report from your workouts, walks and check-ins."
        action={<ButtonLink href="/dashboard">Go to Dashboard</ButtonLink>} />
    );
  }
  const [measurements, photos] = await Promise.all([getMeasurements(), getPhotos()]);
  const { kind, program, timing, completion, training, walking, body, timeline } = data;
  const pct = completion.total.planned > 0 ? Math.round((completion.total.completed / completion.total.planned) * 100) : 0;

  return (
    <div className="space-y-2">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-overline uppercase text-accent-600">
            Recomp Nisa · 12-week program
            <Badge tone={kind === "final" ? "success" : "warning"}>{kind === "final" ? "Final report" : "Interim report"}</Badge>
          </p>
          <h1 className="mt-1 text-title md:text-display">{kind === "final" ? "12-Week Progress Report" : "Progress report so far"}</h1>
          <p className="mt-1 text-[0.9375rem] text-ink-muted">
            {formatDate(program.startDate, "long")} – {formatDate(program.endDate, "long")} · generated {formatDate(data.generatedOn, "long")}
            {kind === "interim" ? ` · ${data.daysLeft} days left in the program` : ""}
          </p>
        </div>
        <PdfExport hasPhotos={photos.length > 0} />
      </header>

      <PageSection title="Program summary">
        <Card padding="lg">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Program week" value={timing.state === "in_progress" ? `${timing.week} of 12` : timing.state === "finished" ? "12 of 12 (ended)" : "Not started"} />
            <Stat label="Calendar" value={`Day ${data.calendarDays} of 84`} sub="time elapsed, not activity" />
            <Stat label="Activities completed" value={`${completion.total.completed} of ${completion.total.planned}`} sub={`${pct}% of all planned`} />
            <Stat label="Due so far" value={`${completion.total.completed} of ${completion.total.plannedToDate}`} sub="planned up to today" />
            <Stat label="Strength sessions" value={`${completion.strength.completed} of ${completion.strength.planned}`} />
            <Stat label="Program walks" value={`${completion.walking.completed} of ${completion.walking.planned}`} />
            <Stat label="Recovery" value={completion.recoveryConfigured ? `${completion.recovery.completed} of ${completion.recovery.planned}` : "Not configured"} sub={completion.recoveryConfigured ? undefined : "not counted"} />
            <Stat label="Planned activities" value={String(completion.total.planned)} sub={completion.recoveryConfigured ? "strength + walking + recovery" : "36 strength + 24 walking"} />
          </dl>
          <p className="mt-4 text-caption text-ink-muted">
            Calendar progress and activity completion are separate: reaching week 12 doesn&apos;t mean every activity was done.
          </p>
        </Card>
      </PageSection>

      <PageSection title="Body composition" description="First vs latest recorded value of each metric. Metrics never measured are left out.">
        {body.rows.length === 0 ? (
          <EmptyState icon={FileText} title="No measurements yet" description="Record a check-in to compare body composition." />
        ) : (
          <>
            <div className="overflow-x-auto rounded-card border border-line/70 bg-surface shadow-card">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="text-caption text-ink-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2.5 font-medium" scope="col">Metric</th>
                    <th className="px-3 py-2.5 text-right font-medium" scope="col">Initial</th>
                    <th className="px-3 py-2.5 text-right font-medium" scope="col">Latest</th>
                    <th className="px-4 py-2.5 text-right font-medium" scope="col">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {body.rows.map(({ def, change }) => (
                    <tr key={def.key}>
                      <th scope="row" className="px-4 py-2.5 text-left font-medium text-ink">{def.label}</th>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatValue(change.first.value, def)}
                        <span className="block text-caption text-ink-muted">{formatDate(change.first.date, "medium")}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {change.delta === null ? "—" : formatValue(change.latest.value, def)}
                        {change.delta === null ? null : <span className="block text-caption text-ink-muted">{formatDate(change.latest.date, "medium")}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{change.delta === null ? <span className="text-caption text-ink-muted">needs a 2nd value</span> : formatDelta(change.delta, def)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-caption text-ink-muted">
              In a body recomposition, weight can stay the same or even rise while body fat falls and muscle grows. These
              are measurements, not a health assessment.
              {body.measurementCount === 1 ? " Only one check-in so far, so changes can't be calculated yet." : ""}
            </p>
            <div className="mt-4">
              <MetricCards records={measurements} />
            </div>
          </>
        )}
      </PageSection>

      <PageSection title="Training">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card padding="lg">
            <dl className="grid grid-cols-2 gap-4">
              <Stat label="Strength workouts" value={String(training.strengthCompleted)} />
              <Stat label="Completion rate" value={training.completionRate === null ? "—" : `${Math.round(training.completionRate * 100)}%`} sub={`of ${training.strengthPlannedToDate} due so far`} />
              <Stat label="Exercises performed" value={String(training.exercisesPerformed)} sub="completed or partly done" />
              <Stat label="Feedback" value={`${training.feedback.too_easy} · ${training.feedback.just_right} · ${training.feedback.too_hard}`} sub="too easy · just right · too hard" />
            </dl>
            {training.topExercises.length > 0 ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-ink">Most completed exercises</p>
                <ol className="mt-2 space-y-1 text-sm text-ink-soft">
                  {training.topExercises.map((e) => (
                    <li key={e.name} className="flex justify-between"><span>{e.name}</span><span className="tabular-nums">{e.completed}×</span></li>
                  ))}
                </ol>
              </div>
            ) : null}
            {training.progression.length > 0 ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-ink">Recorded progression (from workout snapshots)</p>
                <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                  {training.progression.map((p) => (
                    <li key={p.name} className="flex justify-between gap-3"><span>{p.name}</span><span className="tabular-nums">{p.from} → {p.to}</span></li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
          <Card padding="lg">
            <CardHeader eyebrow="3 per week" title="Weekly consistency" />
            {training.perWeek.length === 0 ? (
              <p className="text-sm text-ink-muted">Starts in week 1.</p>
            ) : (
              <ul className="space-y-2.5">
                {training.perWeek.map((w) => (
                  <li key={w.week} className="grid grid-cols-[4rem_1fr_3rem] items-center gap-3 text-sm">
                    <span className="text-ink-soft">Week {w.week}</span>
                    <ProgressBar label={`Week ${w.week} strength`} value={w.completed} max={w.planned} />
                    <span className="text-right tabular-nums">{w.completed}/{w.planned}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-ink">Adaptive changes</p>
          <AdjustmentHistory items={data.adjustments} />
        </div>
      </PageSection>

      <PageSection title="Walking" description="Every logged walk counted once; extra walks never add to program-walk completion.">
        <Card padding="lg">
          {walking.sessions === 0 ? (
            <p className="text-sm text-ink-muted">No walks logged yet.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="Walks" value={String(walking.sessions)} sub={`${walking.scheduled} program · ${walking.extra} extra`} />
              <Stat label="Distance" value={formatKm(walking.km)} />
              <Stat label="Time" value={formatDuration(walking.minutes)} />
              <Stat label="Average pace" value={formatPace(walking.paceSecondsPerKm) ?? "—"} sub="total time ÷ total km" />
              <Stat label="Average speed" value={walking.speedKmh === null ? "—" : `${walking.speedKmh.toFixed(1)} km/h`} />
            </dl>
          )}
          {walking.perWeek.length > 0 ? (
            <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {walking.perWeek.map((w) => (
                <li key={w.week} className="rounded-control bg-surface-muted px-3 py-2 text-caption">
                  <span className="block font-semibold text-ink">Week {w.week}</span>
                  <span className="text-ink-muted">{w.programDone}/{w.programPlanned} program · {formatKm(w.km)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </PageSection>

      <PageSection title="Progress photos" description="Private: shown through short-lived links, never public.">
        <Card padding="lg">
          {photos.length === 0 ? <p className="text-sm text-ink-muted">No progress photos uploaded.</p> : <PhotoCompare photos={photos} />}
        </Card>
      </PageSection>

      <PageSection title="Weekly timeline">
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {timeline.map((w) => (
            <li key={w.week} className="rounded-card border border-line/70 bg-surface p-4 shadow-card">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-ink">Week {w.week}</span>
                <span className="text-caption text-ink-muted">{formatDate(w.start, "medium")} – {formatDate(w.end, "medium")}</span>
              </div>
              {w.state === "future" ? (
                <p className="mt-2 text-sm text-ink-muted">Not reached yet.</p>
              ) : (
                <>
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <ProgressBar label={`Week ${w.week} activities`} value={w.completed} max={w.planned} className="flex-1" />
                    <span className="tabular-nums">{w.completed}/{w.planned} · {w.percent}%</span>
                  </div>
                  <p className="mt-1.5 text-caption text-ink-muted">
                    {w.walkingKm > 0 ? `Walking ${formatKm(w.walkingKm)}` : "No walking distance"}
                    {w.measurement ? ` · Check-in ${formatDate(w.measurement.recordedOn, "medium")}${w.measurement.weightKg !== null ? ` · ${w.measurement.weightKg} kg` : ""}${w.measurement.bodyFatPct !== null ? ` · ${w.measurement.bodyFatPct}%` : ""}` : ""}
                  </p>
                  {w.notes ? <p className="mt-1 text-caption text-ink-soft">“{w.notes}”</p> : null}
                  {w.state === "current" ? <Badge tone="accent" className="mt-2">This week</Badge> : null}
                </>
              )}
            </li>
          ))}
        </ol>
      </PageSection>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="text-heading tabular-nums">{value}</dd>
      {sub ? <dd className="text-caption text-ink-muted">{sub}</dd> : null}
    </div>
  );
}
