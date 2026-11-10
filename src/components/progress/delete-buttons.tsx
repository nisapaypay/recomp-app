"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteMeasurement, deletePhoto } from "@/server/actions/progress";

function DeleteButton({
  label,
  title,
  body,
  run,
  after,
  compact = false,
}: {
  label: string;
  title: string;
  body: string;
  run: () => Promise<{ ok: boolean; error?: string }>;
  after: (router: ReturnType<typeof useRouter>) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="ghost"
        size="md"
        onClick={() => setOpen(true)}
        className="text-danger hover:bg-danger-soft"
        aria-label={compact ? label : undefined}
      >
        <Trash2 aria-hidden className="size-4" />
        {compact ? null : label}
      </Button>
      {error ? <Alert tone="danger" className="mt-2">{error}</Alert> : null}
      <ConfirmDialog
        open={open}
        title={title}
        confirmLabel={pending ? "Deleting…" : "Delete"}
        tone="danger"
        busy={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            const r = await run();
            setOpen(false);
            if (!r.ok) {
              setError(r.error ?? "Could not delete.");
              return;
            }
            setError(null);
            after(router);
          })
        }
      >
        {body}
      </ConfirmDialog>
    </>
  );
}

export function DeleteMeasurementButton({ id, week }: { id: string; week: number }) {
  return (
    <DeleteButton
      label="Delete measurement"
      title={`Delete the week ${week} measurement?`}
      body="This can't be undone. Charts and changes update right away."
      run={() => deleteMeasurement(id)}
      after={(router) => router.replace("/progress/measurements")}
    />
  );
}

export function DeletePhotoButton({ id, label }: { id: string; label: string }) {
  return (
    <DeleteButton
      compact
      label={`Delete ${label}`}
      title={`Delete ${label}?`}
      body="The photo file is removed from your private storage. This can't be undone."
      run={() => deletePhoto(id)}
      after={(router) => router.refresh()}
    />
  );
}
