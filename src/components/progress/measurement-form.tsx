"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import type { IsoDate } from "@/lib/program/calendar";
import { formatDate } from "@/lib/program/format";
import {
  METRICS,
  suggestedWeek,
  validateMeasurement,
  type CheckIn,
  type MeasurementErrors,
  type MetricKey,
} from "@/lib/measurements/measurements";
import { cn } from "@/lib/utils/cn";
import { saveMeasurement, type MeasurementFormState } from "@/server/actions/progress";

export type MeasurementInitial = { id: string; recordedOn: IsoDate; weekNumber: number; notes: string | null } & Record<MetricKey, number | null>;

const STATUS: Record<CheckIn["status"], string> = { done: "saved", due: "due now", late: "late — still fine", upcoming: "upcoming" };

/**
 * Log or edit a check-in. Weight and body fat are required; everything else is
 * optional and starts empty (no defaults). Decimal keyboards on iPhone.
 */
export function MeasurementForm({
  today,
  programStart,
  schedule,
  takenWeeks,
  initial,
}: {
  today: IsoDate;
  programStart: IsoDate | null;
  schedule: CheckIn[];
  takenWeeks: number[];
  initial?: MeasurementInitial;
}) {
  const [state, action, pending] = useActionState<MeasurementFormState, FormData>(saveMeasurement, {});
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {
      recordedOn: initial?.recordedOn ?? today,
      notes: initial?.notes ?? "",
      weekNumber: initial ? String(initial.weekNumber) : programStart ? String(suggestedWeek(schedule, programStart, today) ?? "") : "",
    };
    for (const m of METRICS) v[m.key] = initial && initial[m.key] !== null ? String(initial[m.key]) : "";
    return v;
  });
  const [clientErrors, setClientErrors] = useState<MeasurementErrors>({});
  const errors: MeasurementErrors = { ...state.errors, ...clientErrors };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((s) => ({ ...s, [k]: e.target.value }));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const r = validateMeasurement(
      { ...(values as Record<MetricKey, string>), recordedOn: values.recordedOn, weekNumber: values.weekNumber, notes: values.notes },
      { today, programStart, takenWeeks: new Set(takenWeeks), editingWeek: initial?.weekNumber ?? null },
    );
    if (!r.ok) {
      e.preventDefault();
      setClientErrors(r.errors);
    } else setClientErrors({});
  }

  const otherWeeks = Array.from({ length: 12 }, (_, i) => i + 1).filter((w) => ![1, 4, 8, 12].includes(w));

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-5" noValidate>
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="grid grid-cols-2 gap-3">
        <Shell id="recordedOn" label="Measured on" error={errors.recordedOn}>
          <input id="recordedOn" name="recordedOn" type="date" max={today} value={values.recordedOn} onChange={set("recordedOn")}
            aria-invalid={errors.recordedOn ? true : undefined} className={inputClasses} />
        </Shell>
        <Shell id="weekNumber" label="Counts for" error={errors.weekNumber}>
          <select id="weekNumber" name="weekNumber" value={values.weekNumber} onChange={set("weekNumber")}
            aria-invalid={errors.weekNumber ? true : undefined} className={cn(inputClasses, "appearance-none")}>
            {schedule.map((c) => (
              <option key={c.week} value={c.week} disabled={takenWeeks.includes(c.week) && c.week !== initial?.weekNumber}>
                Week {c.week} check-in ({c.week === initial?.weekNumber ? "this one" : STATUS[c.status]})
              </option>
            ))}
            <optgroup label="Extra measurement">
              {otherWeeks.map((w) => (
                <option key={w} value={w} disabled={takenWeeks.includes(w) && w !== initial?.weekNumber}>
                  Week {w}
                </option>
              ))}
            </optgroup>
            {!programStart ? <option value="">Week of the date</option> : null}
          </select>
        </Shell>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Body composition</legend>
        <div className="grid grid-cols-2 gap-3">
          {METRICS.filter((m) => ["weightKg", "bodyFatPct", "skeletalMuscleKg", "visceralFat"].includes(m.key)).map((m) => (
            <NumberField key={m.key} id={m.key} label={m.required ? m.label : `${m.label} (optional)`} unit={m.unit === "level" ? "" : m.unit}
              value={values[m.key]} onChange={set(m.key)} error={errors[m.key]} />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Circumferences (optional)</legend>
        <div className="grid grid-cols-2 gap-3">
          {METRICS.filter((m) => m.unit === "cm").map((m) => (
            <NumberField key={m.key} id={m.key} label={m.label} unit="cm" value={values[m.key]} onChange={set(m.key)} error={errors[m.key]} />
          ))}
        </div>
      </fieldset>

      <Shell id="notes" label="Notes (optional)" error={errors.notes}>
        <textarea id="notes" name="notes" rows={2} maxLength={1000} value={values.notes} onChange={set("notes")}
          placeholder="e.g. morning, before breakfast, same scale"
          className="block w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-base focus:border-accent-500 focus:outline-none" />
      </Shell>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending ? "Saving…" : initial ? "Save changes" : "Save measurement"}
      </Button>
      <p className="text-caption text-ink-muted">
        Recording a few days late is fine — it still counts for its check-in week.
        {initial ? ` Recorded ${formatDate(initial.recordedOn, "long")}.` : ""}
      </p>
    </form>
  );
}

function NumberField({ id, label, unit, value, onChange, error }: {
  id: string; label: string; unit: string; value: string; error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Shell id={id} label={label} error={error}>
      <div className="relative">
        <input id={id} name={id} inputMode="decimal" value={value} onChange={onChange} placeholder="—"
          aria-invalid={error ? true : undefined} className={cn(inputClasses, unit ? "pr-12" : "", "tabular-nums")} />
        {unit ? <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-muted">{unit}</span> : null}
      </div>
    </Shell>
  );
}

function Shell({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-soft">{label}</label>
      {children}
      {error ? <p role="alert" className="text-caption font-medium text-danger">{error}</p> : null}
    </div>
  );
}
