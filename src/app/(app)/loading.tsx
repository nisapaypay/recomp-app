import { PageContainer } from "@/components/layout/page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageContainer>
      <p role="status" className="sr-only">
        Loading…
      </p>
      <Skeleton className="mb-3 h-4 w-32" />
      <Skeleton className="mb-8 h-9 w-56" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-44 rounded-card lg:col-span-2" />
        <Skeleton className="h-44 rounded-card" />
      </div>
    </PageContainer>
  );
}
