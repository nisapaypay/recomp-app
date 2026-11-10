import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { PageContainer, PageSection } from "@/components/layout/page";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteWalkButton } from "@/components/walking/delete-walk-button";
import { WalkForm } from "@/components/walking/walk-form";
import { formatDate, formatDateTime } from "@/lib/program/format";
import {
  formatDuration,
  formatKm,
  formatPace,
  formatSpeed,
  formatTarget,
  paceSecondsPerKm,
  speedKmh,
  targetStatus,
} from "@/lib/walking/walking";
import { getWalk, getWalkingContext } from "@/server/walking/queries";

export const metadata: Metadata = { title: "Walk" };

export default function WalkPage({ params, searchParams }: PageProps<"/walking/[id]">) {
  return (
    <PageContainer className="max-w-4xl">
      <Link
        href="/walking"
        className="mb-4 inline-flex h-11 items-center gap-1 rounded-control pr-2 text-sm font-medium text-ink-soft hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4.5" />
        Walking
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
        <WalkContent params={params} searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function WalkContent({
  params,
  searchParams,
}: {
  params: PageProps<"/walking/[id]">["params"];
  searchParams: PageProps<"/walking/[id]">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const walk = await getWalk(id);
  if (!walk) notFound();
  const ctx = await getWalkingContext();
  const plan = walk.scheduledDate ? (ctx.walks.find((w) => w.date === walk.scheduledDate) ?? null) : null;
  const pace = formatPace(paceSecondsPerKm(walk.durationMinutes, walk.distanceKm));
  const speed = formatSpeed(speedKmh(walk.durationMinutes, walk.distanceKm));
  const met = plan ? targetStatus(walk.durationMinutes, plan.targetMin) === "met" : null;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-overline uppercase text-accent-600">
          {plan ? `${plan.label} · Week ${plan.week}` : walk.scheduledDate ? "Program walk" : "Additional walk"}
        </p>
        <h1 className="mt-1 text-title md:text-display">{formatDate(walk.activityDate, "full")}</h1>
        {walk.scheduledDate ? (
          <p className="mt-1 text-[0.9375rem] text-ink-muted">
            Scheduled {formatDate(walk.scheduledDate, "full")}
            {walk.activityDate > walk.scheduledDate ? " · logged as a catch-up" : ""}
          </p>
        ) : (
          <p className="mt-1 text-[0.9375rem] text-ink-muted">Outside the schedule — not counted toward the program target.</p>
        )}
      </header>

      {query.saved ? <Alert tone="success">Changes saved.</Alert> : null}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Duration" value={formatDuration(walk.durationMinutes)} />
        <Metric label="Distance" value={walk.distanceKm !== null ? formatKm(walk.distanceKm) : "—"} />
        <Metric label="Pace" value={pace ?? "—"} />
        <Metric label="Avg speed" value={speed ?? "—"} />
        {walk.steps !== null ? <Metric label="Steps" value={walk.steps.toLocaleString("en-US")} /> : null}
        {plan ? (
          <div className="col-span-2 rounded-card border border-line/70 bg-surface p-4 shadow-card md:col-span-3">
            <dt className="text-caption text-ink-muted">Program target</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-heading">
              {formatTarget(plan.targetMin, plan.targetMax)}
              {met ? <Badge tone="success">Met</Badge> : <Badge tone="warning">{plan.targetMin - walk.durationMinutes} min short</Badge>}
            </dd>
          </div>
        ) : null}
      </dl>
      {walk.notes ? <p className="text-[0.9375rem] text-ink-soft">“{walk.notes}”</p> : null}
      <p className="text-caption text-ink-muted">
        Logged {formatDateTime(walk.createdAt)}
        {walk.updatedAt !== walk.createdAt ? ` · edited ${formatDateTime(walk.updatedAt)}` : ""}
      </p>

      <PageSection title="Edit">
        <Card padding="lg">
          <WalkForm
            today={ctx.today}
            walks={ctx.walks}
            loggedDates={ctx.loggedDates}
            initial={{
              id: walk.id,
              activityDate: walk.activityDate,
              scheduledDate: walk.scheduledDate,
              durationMinutes: walk.durationMinutes,
              distanceKm: walk.distanceKm,
              steps: walk.steps,
              notes: walk.notes,
            }}
          />
        </Card>
      </PageSection>

      <DeleteWalkButton id={walk.id} scheduledLabel={plan ? `${plan.label} of ${formatDate(plan.date, "long")}` : null} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line/70 bg-surface p-4 shadow-card">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-heading tabular-nums">{value}</dd>
    </div>
  );
}
