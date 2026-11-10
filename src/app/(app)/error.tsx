"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { PageContainer } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Error state for app pages (e.g. Supabase unreachable or a query failed). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer className="max-w-2xl">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description="We couldn't load this page. Check your internet connection and try again. Nothing was changed."
        action={
          <Button onClick={reset} variant="secondary">
            <RotateCcw aria-hidden className="size-4.5" />
            Try again
          </Button>
        }
        className="mt-6 bg-surface py-14"
      />
    </PageContainer>
  );
}
