import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { PageContainer, PageSection } from "@/components/layout/page";
import { DeleteMeasurementButton } from "@/components/progress/delete-buttons";
import { MeasurementForm } from "@/components/progress/measurement-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime } from "@/lib/program/format";
import { METRICS, formatValue } from "@/lib/measurements/measurements";
import { getMeasurement, getProgressContext } from "@/server/progress/queries";

export const metadata: Metadata = { title: "Measurement" };

export default function MeasurementPage({ params, searchParams }: PageProps<"/progress/measurements/[id]">) {
  return (
    <PageContainer className="max-w-4xl">
      <Link href="/progress/measurements" className="mb-4 inline-flex h-11 items-center gap-1 rounded-control pr-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ChevronLeft aria-hidden className="size-4.5" />
        Measurements
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: PageProps<"/progress/measurements/[id]">["params"];
  searchParams: PageProps<"/progress/measurements/[id]">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const m = await getMeasurement(id);
  if (!m) notFound();
  const ctx = await getProgressContext();
  const scheduled = ctx.schedule.find((c) => c.week === m.weekNumber);
  const late = scheduled && m.recordedOn > scheduled.windowEnd;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-overline uppercase text-accent-600">
          Week {m.weekNumber} {scheduled ? "check-in" : "· extra measurement"}
        </p>
        <h1 className="mt-1 text-title md:text-display">{formatDate(m.recordedOn, "full")}</h1>
        {late ? <p className="mt-1 text-[0.9375rem] text-ink-muted">Recorded after week {m.weekNumber} — it still counts for that check-in.</p> : null}
      </header>
      {query.saved ? <Alert tone="success">Changes saved.</Alert> : null}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {METRICS.map((def) => (
          <div key={def.key} className="rounded-card border border-line/70 bg-surface p-4 shadow-card">
            <dt className="text-caption text-ink-muted">{def.label}</dt>
            <dd className="mt-0.5 text-heading tabular-nums">
              {m[def.key] !== null ? formatValue(m[def.key] as number, def) : <span className="text-ink-faint">—</span>}
            </dd>
          </div>
        ))}
      </dl>
      {m.notes ? <p className="text-[0.9375rem] text-ink-soft">“{m.notes}”</p> : null}
      <p className="text-caption text-ink-muted">
        Saved {formatDateTime(m.createdAt)}
        {m.updatedAt !== m.createdAt ? ` · edited ${formatDateTime(m.updatedAt)}` : ""}
      </p>

      <PageSection title="Edit">
        <Card padding="lg">
          <MeasurementForm
            today={ctx.today}
            programStart={ctx.programStart}
            schedule={ctx.schedule}
            takenWeeks={ctx.measurements.map((x) => x.weekNumber)}
            initial={m}
          />
        </Card>
      </PageSection>
      <DeleteMeasurementButton id={m.id} week={m.weekNumber} />
    </div>
  );
}
