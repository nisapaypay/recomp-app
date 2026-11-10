"use client";

import { Gauge, Timer, TrendingUp } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import type { IsoDate } from "@/lib/program/calendar";
import { formatDate } from "@/lib/program/format";
import { cn } from "@/lib/utils/cn";
import {
  defaultScheduledDate,
  formatPace,
  formatSpeed,
  formatTarget,
  openScheduledWalks,
  paceSecondsPerKm,
  parseDistance,
  parseDuration,
  speedKmh,
  targetStatus,
  validateWalk,
  type ScheduledWalk,
  type WalkErrors,
} from "@/lib/walking/walking";
import { saveWalk, type WalkFormState } from "@/server/actions/walking";

export type WalkFormInitial = {
  id: string;
  activityDate: IsoDate;
  scheduledDate: IsoDate | null;
  durationMinutes: number;
  distanceKm: number | null;
  steps: number | null;
  notes: string | null;
};

/**
 * Log or edit a walk. Mobile-first: large inputs, numeric keyboards, the save
 * button at the bottom within thumb reach. Pace / speed / target appear as
 * soon as duration and distance are valid. The server re-validates.
 */
export function WalkForm({
  today,
  walks,
  loggedDates,
  initial,
  preselect,
}: {
  today: IsoDate;
  walks: ScheduledWalk[];
  loggedDates: IsoDate[];
  initial?: WalkFormInitial;
  /** Scheduled date suggested by a link (e.g. from the dashboard). */
  preselect?: IsoDate | null;
}) {
  const [state, action, pending] = useActionState<WalkFormState, FormData>(saveWalk, {});
  const logged = useMemo(() => new Set(loggedDates), [loggedDates]);
  const editing = initial?.scheduledDate ?? null;

  const [activityDate, setActivityDate] = useState<string>(initial?.activityDate ?? today);
  const [hours, setHours] = useState(initial ? String(Math.floor(initial.durationMinutes / 60) || "") : "");
  const [minutes, setMinutes] = useState(initial ? String(Math.round(initial.durationMinutes % 60)) : "");
  const [distance, setDistance] = useState(initial?.distanceKm != null ? String(initial.distanceKm) : "");
  const [steps, setSteps] = useState(initial?.steps != null ? String(initial.steps) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [clientErrors, setClientErrors] = useState<WalkErrors>({});

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(activityDate) && activityDate <= today ? (activityDate as IsoDate) : today;
  const open = useMemo(() => openScheduledWalks(walks, logged, validDate, editing), [walks, logged, validDate, editing]);
  const initialChoice =
    initial !== undefined
      ? (initial.scheduledDate ?? "")
      : preselect && open.some((w) => w.date === preselect)
        ? preselect
        : (defaultScheduledDate(open, validDate) ?? "");
  const [scheduledDate, setScheduledDate] = useState<string>(initialChoice);
  // If the chosen walk is no longer possible for the chosen date, fall back to "additional".
  const choice = scheduledDate === "" || open.some((w) => w.date === scheduledDate) ? scheduledDate : "";

  const duration = parseDuration(hours, minutes);
  const km = parseDistance(distance);
  const durationValue = duration.ok ? duration.value : null;
  const kmValue = km.ok ? km.value : null;
  const pace = formatPace(paceSecondsPerKm(durationValue, kmValue));
  const speed = formatSpeed(speedKmh(durationValue, kmValue));
  const chosen = walks.find((w) => w.date === choice) ?? null;

  const errors: WalkErrors = { ...state.errors, ...clientErrors };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const result = validateWalk(
      { activityDate, hours, minutes, distance, steps, notes, scheduledDate: choice },
      { today, walks, loggedDates: logged, editingScheduledDate: editing },
    );
    if (!result.ok) {
      e.preventDefault();
      setClientErrors(result.errors);
    } else {
      setClientErrors({});
    }
  }

  // Past + current-week walks first (most recent first), then the rest of this week.
  const options = [...open].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-5" noValidate>
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="scheduledDate" value={choice} />

      <FieldShell id="activityDate" label="Date walked" error={errors.activityDate}>
        <input
          id="activityDate"
          name="activityDate"
          type="date"
          max={today}
          value={activityDate}
          onChange={(e) => setActivityDate(e.target.value)}
          aria-invalid={errors.activityDate ? true : undefined}
          className={inputClasses}
          required
        />
      </FieldShell>

      <FieldShell id="walk" label="Which walk is this?" error={errors.scheduledDate}>
        <select
          id="walk"
          value={choice}
          onChange={(e) => setScheduledDate(e.target.value)}
          aria-invalid={errors.scheduledDate ? true : undefined}
          className={cn(inputClasses, "appearance-none")}
        >
          {options.map((w) => (
            <option key={w.date} value={w.date}>
              {w.label} · {formatDate(w.date, "medium")} · Week {w.week} · target {formatTarget(w.targetMin, w.targetMax)}
              {w.date < validDate && w.date !== editing ? " (catch-up)" : ""}
            </option>
          ))}
          <option value="">Additional walk (outside the schedule)</option>
        </select>
        <p className="text-caption text-ink-muted">
          {chosen
            ? `Counts for ${chosen.label.replace(" Walking", "")} ${formatDate(chosen.date, "long")}. The schedule doesn't shift.`
            : walks.length === 0
              ? "Start your program to link walks to the Tuesday and Saturday targets."
              : "Recorded in your history and totals, but it doesn't count toward the program's walking target."}
        </p>
      </FieldShell>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-ink-soft">Duration</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="relative block">
            <span className="sr-only">Hours</span>
            <input
              name="hours"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              aria-invalid={errors.duration ? true : undefined}
              className={cn(inputClasses, "pr-12 tabular-nums")}
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-muted">h</span>
          </label>
          <label className="relative block">
            <span className="sr-only">Minutes</span>
            <input
              name="minutes"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="30"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              aria-invalid={errors.duration ? true : undefined}
              className={cn(inputClasses, "pr-14 tabular-nums")}
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-muted">min</span>
          </label>
        </div>
        {errors.duration ? <ErrorText>{errors.duration}</ErrorText> : null}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <FieldShell id="distance" label="Distance" error={errors.distance}>
          <div className="relative">
            <input
              id="distance"
              name="distance"
              inputMode="decimal"
              placeholder="2.5"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              aria-invalid={errors.distance ? true : undefined}
              className={cn(inputClasses, "pr-12 tabular-nums")}
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-muted">km</span>
          </div>
        </FieldShell>
        <FieldShell id="steps" label="Steps (optional)" error={errors.steps}>
          <input
            id="steps"
            name="steps"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="—"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            aria-invalid={errors.steps ? true : undefined}
            className={cn(inputClasses, "tabular-nums")}
          />
        </FieldShell>
      </div>

      {/* Live summary — only from valid values */}
      <div className="grid grid-cols-3 gap-2" aria-live="polite">
        <Metric icon={Timer} label="Pace" value={pace ?? "—"} />
        <Metric icon={Gauge} label="Avg speed" value={speed ?? "—"} />
        <Metric
          icon={TrendingUp}
          label="Target"
          value={
            chosen && durationValue !== null
              ? targetStatus(durationValue, chosen.targetMin) === "met"
                ? "Met ✓"
                : `${chosen.targetMin - durationValue} min short`
              : chosen
                ? formatTarget(chosen.targetMin, chosen.targetMax)
                : "—"
          }
        />
      </div>

      <FieldShell id="notes" label="Notes (optional)" error={errors.notes}>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="block w-full rounded-control border border-line-strong bg-surface px-4 py-3 text-base focus:border-accent-500 focus:outline-none"
        />
      </FieldShell>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending ? "Saving…" : initial ? "Save changes" : "Save walk"}
      </Button>
    </form>
  );
}

function FieldShell({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-soft">
        {label}
      </label>
      {children}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-caption font-medium text-danger">
      {children}
    </p>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <div className="rounded-control bg-accent-50 px-3 py-2.5">
      <p className="flex items-center gap-1 text-caption text-accent-700">
        <Icon aria-hidden className="size-3.5" />
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
