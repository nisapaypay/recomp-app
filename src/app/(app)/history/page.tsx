import type { Metadata } from "next";
import { History } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Log"
        title="History"
        description="Completed, skipped and interrupted workouts, walks and program adjustments."
      />
      <EmptyState
        icon={History}
        title="No history yet"
        description="Sessions you complete will be listed here."
        action={<Badge tone="accent">In development</Badge>}
      />
    </PageContainer>
  );
}
