import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, Ruler } from "lucide-react";
import { PageContainer, PageHeader, PageSection } from "@/components/layout/page";
import { CheckInSchedule, MeasurementTable } from "@/components/progress/measurement-parts";
import { MeasurementForm } from "@/components/progress/measurement-form";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getProgressContext } from "@/server/progress/queries";

export const metadata: Metadata = { title: "Measurements" };

export default function MeasurementsPage({ searchParams }: PageProps<"/progress/measurements">) {
  return (
    <PageContainer>
      <Link href="/progress" className="mb-4 inline-flex h-11 items-center gap-1 rounded-control pr-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ChevronLeft aria-hidden className="size-4.5" />
        Progress
      </Link>
      <PageHeader eyebrow="Weeks 1 · 4 · 8 · 12" title="Measurements" description="Record each check-in. Weight and body fat are required; everything else is optional." />
      <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/progress/measurements">["searchParams"] }) {
  const [params, ctx] = await Promise.all([searchParams, getProgressContext()]);
  const saved = typeof params.saved === "string" ? params.saved : null;
  const ids = new Map(ctx.measurements.map((m) => [m.weekNumber, m.id]));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-8">
      <Card padding="lg" className="self-start">
        <div id="log" className="scroll-mt-24">
          <CardHeader eyebrow="New check-in" title="Log a measurement" />
          {saved ? (
            <Alert tone="success" className="mb-4">
              Measurement saved. <Link href={`/progress/measurements/${saved}`} className="font-semibold underline underline-offset-2">View it</Link>
            </Alert>
          ) : null}
          <MeasurementForm
            key={ctx.measurements.length}
            today={ctx.today}
            programStart={ctx.programStart}
            schedule={ctx.schedule}
            takenWeeks={ctx.measurements.map((m) => m.weekNumber)}
          />
        </div>
      </Card>

      <div className="space-y-6">
        {ctx.schedule.length > 0 ? (
          <PageSection title="Check-ins" className="mt-0">
            <CheckInSchedule schedule={ctx.schedule} measurementIds={ids} />
          </PageSection>
        ) : null}
        <PageSection title="History" description="Newest first. Tap a date for details, editing or deleting." className="mt-0">
          {ctx.measurements.length === 0 ? (
            <EmptyState icon={Ruler} title="No measurements yet" description="Your saved check-ins will be listed here." />
          ) : (
            <MeasurementTable items={ctx.measurements} />
          )}
        </PageSection>
      </div>
    </div>
  );
}
