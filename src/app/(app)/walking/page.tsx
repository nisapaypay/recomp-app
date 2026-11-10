import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Footprints } from "lucide-react";
import { PageContainer, PageHeader, PageSection } from "@/components/layout/page";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { WalkForm } from "@/components/walking/walk-form";
import { WalkList } from "@/components/walking/walk-list";
import { WeekWalks } from "@/components/walking/week-walks";
import { addDays, isIsoDate, mondayOf, programWeekFor, type IsoDate } from "@/lib/program/calendar";
import { cn } from "@/lib/utils/cn";
import { formatDuration, formatKm, walkingTotals, weeklyWalkingCompletion } from "@/lib/walking/walking";
import { getWalkingContext, getWalks } from "@/server/walking/queries";

export const metadata: Metadata = { title: "Walking" };

const PERIODS = [
  { id: "all", label: "All" },
  { id: "week", label: "This week" },
  { id: "30d", label: "Last 30 days" },
] as const;
type Period = (typeof PERIODS)[number]["id"];

export default function WalkingPage({ searchParams }: PageProps<"/walking">) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Tuesday & Saturday"
        title="Walking"
        description="Log walks from your Apple Watch or any device. Pace and speed are calculated for you."
      />
      <Suspense fallback={<WalkingSkeleton />}>
        <WalkingContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function WalkingContent({ searchParams }: { searchParams: PageProps<"/walking">["searchParams"] }) {
  const params = await searchParams;
  const period: Period = PERIODS.some((p) => p.id === params.period) ? (params.period as Period) : "all";
  const saved = typeof params.saved === "string" ? params.saved : null;
  const preselect = typeof params.walk === "string" && isIsoDate(params.walk) ? (params.walk as IsoDate) : null;

  const [ctx, all] = await Promise.all([getWalkingContext(), getWalks()]);
  const from: IsoDate | null = period === "week" ? mondayOf(ctx.today) : period === "30d" ? addDays(ctx.today, -29) : null;
  const shown = from ? all.filter((w) => w.activityDate >= from) : all;
  const totals = walkingTotals(all);

  // Program week shown in "This week": the current one (or week 1 before the start / 12 after the end).
  const start = ctx.walks[0] ? addDays(ctx.walks[0].date, -1) : null;
  const week = start ? Math.min(12, Math.max(1, programWeekFor(start, ctx.today))) : null;
  const weekWalks = week ? ctx.walks.filter((w) => w.week === week) : [];
  const weekDone = weeklyWalkingCompletion(weekWalks, all);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-8">
      <Card padding="lg" className="self-start">
        <div id="log" className="scroll-mt-24">
          <CardHeader eyebrow="New entry" title="Log a walk" />
          {saved ? (
            <Alert tone="success" className="mb-4">
              Walk saved. <Link href={`/walking/${saved}`} className="font-semibold underline underline-offset-2">View it</Link>
            </Alert>
          ) : null}
          <WalkForm
            key={`${all.length}-${preselect ?? ""}`}
            today={ctx.today}
            walks={ctx.walks}
            loggedDates={ctx.loggedDates}
            preselect={preselect}
          />
        </div>
      </Card>

      <div className="space-y-6">
        {week ? (
          <Card padding="lg">
            <CardHeader
              eyebrow={`Week ${week} · ${weekDone.completed} of ${weekDone.planned} logged`}
              title="Program walks this week"
            />
            <WeekWalks walks={weekWalks} logs={all} today={ctx.today} />
            <p className="mt-3 text-caption text-ink-muted">
              A walk counts for its scheduled day even when you log it later. Additional walks are welcome but
              don&apos;t change the program targets.
            </p>
          </Card>
        ) : null}

        <Card padding="lg">
          <CardHeader eyebrow="All time" title="Totals" />
          {totals.count === 0 ? (
            <p className="text-sm text-ink-muted">Your totals appear after your first logged walk.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Walks" value={String(totals.count)} sub={`${totals.scheduled} program · ${totals.additional} extra`} />
              <Stat label="Time" value={formatDuration(totals.minutes)} />
              <Stat label="Distance" value={formatKm(totals.km)} />
              <Stat label="Steps" value={totals.steps !== null ? totals.steps.toLocaleString("en-US") : "—"} sub={totals.steps !== null ? "where recorded" : "none recorded"} />
            </dl>
          )}
        </Card>
      </div>

      <PageSection title="History" className="mt-2 lg:col-span-2">
        <nav aria-label="Period" className="mb-3 flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={p.id === "all" ? "/walking" : `/walking?period=${p.id}`}
              aria-current={p.id === period ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-chip border px-3.5 text-sm font-medium",
                p.id === period ? "border-accent-600 bg-accent-600 text-white" : "border-line bg-surface text-ink-soft hover:bg-surface-muted",
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        {shown.length === 0 ? (
          <EmptyState
            icon={Footprints}
            title={all.length === 0 ? "No walks logged yet" : "No walks in this period"}
            description={all.length === 0 ? "Log your first walk with the form — it takes a few seconds." : "Try another period."}
          />
        ) : (
          <WalkList walks={shown} scheduled={ctx.walks} />
        )}
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

function WalkingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2" aria-hidden>
      <Skeleton className="h-[34rem] rounded-card" />
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
      </div>
    </div>
  );
}
