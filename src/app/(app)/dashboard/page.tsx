import type { Metadata } from "next";
import { Activity, CalendarClock, Ruler } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { WeeklySchedule } from "@/components/program/weekly-schedule";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="12-week recomposition" title="Dashboard" />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Next action first: today's activity. */}
        <Card tone="accent" padding="lg" className="lg:col-span-2">
          <p className="text-overline uppercase text-accent-200">Today</p>
          <h2 className="mt-1 text-title text-white">Program not started</h2>
          <p className="mt-2 max-w-md text-[0.9375rem] text-accent-100">
            Once you&apos;re signed in and have set a start date, today&apos;s workout,
            exercise count and estimated duration will appear here.
          </p>
        </Card>

        <Card padding="lg">
          <CardHeader eyebrow="Overview" title="Program" />
          <EmptyState
            icon={CalendarClock}
            title="No start date set"
            description="Current week, phase and completion will show once the program starts."
            className="py-6"
          />
        </Card>

        <Card padding="lg" className="lg:col-span-3">
          <CardHeader eyebrow="Fixed weekly plan" title="This week" />
          <WeeklySchedule />
        </Card>

        <Card padding="lg" className="lg:col-span-2">
          <CardHeader eyebrow="Body composition" title="Progress overview" />
          <EmptyState
            icon={Ruler}
            title="No measurements recorded"
            description="Weight, body fat, waist and change from baseline will appear after your first measurement."
            className="py-6"
          />
        </Card>

        <Card padding="lg">
          <CardHeader eyebrow="Consistency" title="Activity summary" />
          <EmptyState
            icon={Activity}
            title="No activity recorded"
            description="Completed workouts, walks and your streak will appear here."
            className="py-6"
          />
        </Card>
      </div>
    </PageContainer>
  );
}
