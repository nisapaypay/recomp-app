import type { Metadata } from "next";
import { ChartLine } from "lucide-react";
import { PageContainer, PageHeader, PageSection } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MEASUREMENT_WEEKS } from "@/lib/program/schedule";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Body composition"
        title="Progress"
        description="Measurements, progress photos and charts comparing your baseline with each check-in."
      />

      <PageSection title="Measurement check-ins" description="Official measurement sessions in the program.">
        <ul className="flex flex-wrap gap-2">
          {MEASUREMENT_WEEKS.map((week) => (
            <li key={week}>
              <Badge>Week {week}</Badge>
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection title="Charts">
        <EmptyState
          icon={ChartLine}
          title="No measurements recorded"
          description="Charts appear once real measurements are saved. Missing values are never estimated."
          action={<Badge tone="accent">In development</Badge>}
        />
      </PageSection>
    </PageContainer>
  );
}
