import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, History } from "lucide-react";
import { PageContainer, PageHeader, PageSection } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime, formatSeconds } from "@/lib/program/format";
import { isCatchUp } from "@/lib/program/start-rules";
import { WEEKLY_SCHEDULE } from "@/lib/program/schedule";
import { getSessionHistory, type SessionInfo, type SessionStatus } from "@/server/workout/queries";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Log"
        title="History"
        description="Every workout attempt, with the day it was scheduled for and when you actually did it."
        actions={
          <ButtonLink href="/progress/report" variant="secondary" size="sm">
            View 12-Week Report
          </ButtonLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 rounded-card" />}>
        <WorkoutHistory />
      </Suspense>
    </PageContainer>
  );
}

const STATUS: Record<SessionStatus, { tone: "success" | "warning" | "neutral" | "accent"; label: string }> = {
  completed: { tone: "success", label: "Completed" },
  stopped: { tone: "warning", label: "Stopped" },
  abandoned: { tone: "neutral", label: "Abandoned" },
  interrupted: { tone: "accent", label: "Unfinished" },
  in_progress: { tone: "accent", label: "In progress" },
};

function activityLabel(activity: string): string {
  return WEEKLY_SCHEDULE.find((d) => d.activity === activity)?.activityLabel ?? activity;
}

async function WorkoutHistory() {
  const sessions = await getSessionHistory();
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No workouts yet"
        description="Workouts you start will be listed here. Walks and measurements are added in later phases."
      />
    );
  }

  return (
    <PageSection title="Workouts">
      <Card padding="none">
        <ul className="divide-y divide-line">
          {sessions.map((s) => (
            <li key={s.id}>
              <HistoryRow session={s} />
            </li>
          ))}
        </ul>
      </Card>
    </PageSection>
  );
}

function HistoryRow({ session: s }: { session: SessionInfo }) {
  const status = STATUS[s.status];
  const href =
    s.status === "completed" || s.status === "stopped"
      ? `/workout/session/${s.id}/summary`
      : s.status === "in_progress" || s.status === "interrupted"
        ? `/workout/session/${s.id}`
        : null;

  const body = (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-ink">{activityLabel(s.activityType)}</p>
          <Badge tone={status.tone}>{status.label}</Badge>
          {isCatchUp(s.scheduledDate, s.performedAt) ? <Badge tone="warning">Catch-up</Badge> : null}
        </div>
        <dl className="mt-1 grid gap-x-6 text-sm text-ink-muted sm:grid-cols-[auto_auto_1fr]">
          <div className="flex gap-1.5">
            <dt>Scheduled</dt>
            <dd className="text-ink-soft">{formatDate(s.scheduledDate, "long")} · Week {s.weekNumber}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Performed</dt>
            <dd className="text-ink-soft">{s.performedAt ? formatDateTime(s.performedAt) : "Not begun"}</dd>
          </div>
          {s.durationSeconds !== null && s.status !== "abandoned" ? (
            <div className="flex gap-1.5">
              <dt>Duration</dt>
              <dd className="text-ink-soft">{formatSeconds(s.durationSeconds)}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      {href ? <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-faint" /> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block transition-colors hover:bg-surface-muted/60">
      {body}
    </Link>
  ) : (
    body
  );
}
