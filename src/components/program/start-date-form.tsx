"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import type { ProgramFormState } from "@/server/actions/program";
import { cn } from "@/lib/utils/cn";

export type StartDateOption = { value: string; label: string };

/**
 * Monday picker. Offering only Mondays (rather than a free date input) makes
 * an invalid day impossible to choose on iPhone and desktop alike; the
 * server validates again.
 */
export function StartDateForm({
  action,
  options,
  defaultValue,
  submitLabel,
  pendingLabel,
  hint,
}: {
  action: (state: ProgramFormState, formData: FormData) => Promise<ProgramFormState>;
  options: StartDateOption[];
  defaultValue?: string;
  submitLabel: string;
  pendingLabel: string;
  hint?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <div className="space-y-1.5">
        <label htmlFor="startDate" className="block text-sm font-medium text-ink-soft">
          Start date (Monday)
        </label>
        <select
          id="startDate"
          name="startDate"
          defaultValue={defaultValue ?? options[0]?.value}
          className={cn(inputClasses, "appearance-none bg-[length:1.25rem] pr-10")}
          required
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {hint ? <p className="text-caption text-ink-muted">{hint}</p> : null}
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
