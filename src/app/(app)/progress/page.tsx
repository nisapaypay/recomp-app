import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Camera, Ruler } from "lucide-react";
import { PageContainer, PageHeader, PageSection } from "@/components/layout/page";
import { AdjustmentHistory } from "@/components/progression/adjustment-history";
import { CheckInSchedule } from "@/components/progress/measurement-parts";
import { MetricCards } from "@/components/progress/metric-cards";
import { PhotoCompare } from "@/components/progress/photo-compare";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/program/format";
import { METRICS, changeFor, formatDelta, formatValue, nextCheckIn } from "@/lib/measurements/measurements";
import { formatDuration, formatKm, walkingTotals, weeklyWalkingCompletion } from "@/lib/walking/walking";
import { getPhotos, getProgressContext } from "@/server/progress/queries";
import { getAdjustmentHistory } from "@/server/progression/queries";
import { getWalkingContext, getWalks } from "@/server/walking/queries";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Body composition"
        title="Progress"
        description="Check-ins, photos, training and walking — real records only, nothing estimated."
        actions={
          <ButtonLink href="/progress/report" variant="secondary" size="sm">
            View 12-Week Report
          </ButtonLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 rounded-card" />}>
        <Overview />
      </Suspense>
      <PageSection title="Charts" description="Each dot is a saved check-in. Lines connect recorded values only; nothing is predicted.">
        <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
          <Charts />
        </Suspense>
      </PageSection>
      <PageSection title="Photo comparison">
        <Suspense fallback={<Skeleton className="h-80 rounded-card" />}>
          <Photos />
        </Suspense>
      </PageSection>
      <PageSection title="Walking">
        <Suspense fallback={<Skeleton className="h-32 rounded-card" />}>
          <Walking />
        </Suspense>
      </PageSection>
      <PageSection
        title="Training adjustments"
        description="What changed in your targets after Too Easy / Too Hard feedback, why, and from when. Finished workouts are never changed."
      >
        <Suspense fallback={<Skeleton className="h-32 rounded-card" />}>
          <Adjustments />
        </Suspense>
      </PageSection>
    </PageContainer>
  );
}

async function Overview() {
  const ctx = await getProgressContext();
  const next = nextCheckIn(ctx.schedule);
  const latest = ctx.measurements[0] ?? null;
  const ids = new Map(ctx.measurements.map((m) => [m.weekNumber, m.id]));
  const tiles = METRICS.filter((m) => ["weightKg", "bodyFatPct", "skeletalMuscleKg", "waistCm"].includes(m.key));

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      <Card padding="lg" className="lg:col-span-2">
        <CardHeader
          eyebrow={ctx.currentWeek ? `Program week ${ctx.currentWeek}` : "Program"}
          title={latest ? `Latest check-in · ${formatDate(latest.recordedOn, "medium")}` : "Latest check-in"}
          action={
            <ButtonLink href="/progress/measurements#log" size="sm">
              <Ruler aria-hidden className="size-4" />
              Log
            </ButtonLink>
          }
        />
        {latest ? (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {tiles.map((def) => {
              const c = changeFor(ctx.measurements, def);
              return (
                <div key={def.key}>
                  <dt className="text-caption text-ink-muted">{def.label}</dt>
                  <dd className="text-heading tabular-nums">{c ? formatValue(c.latest.value, def) : "—"}</dd>
                  <dd className="text-caption text-ink-muted">
                    {c && c.delta !== null ? `${formatDelta(c.delta, def)} since first` : c ? "first value" : "not recorded"}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <EmptyState
            icon={Ruler}
            title="No measurements yet"
            description="Your first check-in sets the starting point. Weight and body fat are enough; the rest is optional."
            className="py-6"
          />
        )}
        {latest ? (
          <p className="mt-4 text-caption text-ink-muted">
            Changes compare your first and latest check-in. In a recomposition, weight may stay the same or rise
            while body fat falls — the full picture matters more than one number.
          </p>
        ) : null}
      </Card>

      <Card padding="lg">
        <CardHeader eyebrow="Schedule" title={next ? `Next: Week ${next.week}` : "All check-ins saved"} />
        {ctx.schedule.length === 0 ? (
          <p className="text-sm text-ink-muted">Start your program to see the week 1 / 4 / 8 / 12 check-ins.</p>
        ) : next ? (
          <p className="text-sm text-ink-muted">
            {next.status === "late"
              ? `Week ${next.week} has passed — you can still record it; it counts for week ${next.week}.`
              : next.status === "due"
                ? `This week (${formatDate(next.windowStart, "medium")} – ${formatDate(next.windowEnd, "medium")}).`
                : `From ${formatDate(next.windowStart, "long")}.`}
          </p>
        ) : (
          <p className="text-sm text-ink-muted">Every official check-in has data.</p>
        )}
        <Link href="/progress/measurements" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-700">
          History & check-ins <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Card>

      {ctx.schedule.length > 0 ? (
        <div className="lg:col-span-3">
          <CheckInSchedule schedule={ctx.schedule} measurementIds={ids} />
        </div>
      ) : null}
    </div>
  );
}

async function Charts() {
  const ctx = await getProgressContext();
  return <MetricCards records={ctx.measurements} />;
}

async function Photos() {
  const photos = await getPhotos();
  return (
    <Card padding="lg">
      {photos.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No progress photos yet"
          description="Add front, side and back photos at your check-ins to compare week 1 with weeks 4, 8 and 12."
          action={<ButtonLink href="/progress/photos" size="sm">Add photos</ButtonLink>}
        />
      ) : (
        <>
          <PhotoCompare photos={photos} />
          <Link href="/progress/photos" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-700">
            Manage photos <ArrowRight aria-hidden className="size-4" />
          </Link>
        </>
      )}
    </Card>
  );
}

async function Walking() {
  const [ctx, walks] = await Promise.all([getWalkingContext(), getWalks()]);
  const totals = walkingTotals(walks);
  const program = weeklyWalkingCompletion(ctx.walks.filter((w) => w.date <= ctx.today), walks);
  return (
    <Card padding="lg">
      {totals.count === 0 ? (
        <p className="text-sm text-ink-muted">
          No walks logged yet. <Link href="/walking#log" className="font-semibold text-accent-700">Log a walk</Link>
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-caption text-ink-muted">Program walks</dt>
            <dd className="text-heading tabular-nums">{program.completed} / {program.planned}</dd>
            <dd className="text-caption text-ink-muted">so far · {program.targetMet} met the target</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Extra walks</dt>
            <dd className="text-heading tabular-nums">{totals.additional}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Time</dt>
            <dd className="text-heading tabular-nums">{formatDuration(totals.minutes)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Distance</dt>
            <dd className="text-heading tabular-nums">{formatKm(totals.km)}</dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

async function Adjustments() {
  const items = await getAdjustmentHistory();
  return <AdjustmentHistory items={items} />;
}
