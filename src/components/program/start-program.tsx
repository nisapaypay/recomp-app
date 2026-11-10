import { CalendarDays, Dumbbell, Footprints } from "lucide-react";
import { startDateOptions } from "@/lib/program/calendar";
import { formatDate } from "@/lib/program/format";
import { startProgram } from "@/server/actions/program";
import { getToday } from "@/server/program/queries";
import { StartDateForm, type StartDateOption } from "./start-date-form";

export async function buildStartDateOptions(): Promise<StartDateOption[]> {
  const today = await getToday();
  return startDateOptions(today).map((date, index) => ({
    value: date,
    label: `${formatDate(date, "long")}${index === 0 ? (date === today ? " — today" : " — this week") : ""}`,
  }));
}

/** Short onboarding shown when there is no active program. */
export async function StartProgram({ previousCompleted = false }: { previousCompleted?: boolean }) {
  const options = await buildStartDateOptions();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)] lg:gap-10">
      <div>
        <p className="text-overline uppercase text-accent-600">
          {previousCompleted ? "Start again" : "Get started"}
        </p>
        <h2 className="mt-1 text-title">Start your 12-week program</h2>
        <ul className="mt-5 space-y-3 text-[0.9375rem] text-ink-soft">
          <li className="flex gap-3">
            <CalendarDays aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-600" />
            12 weeks, always starting on a Monday. The weekly plan is fixed and never shifts if you miss a day.
          </li>
          <li className="flex gap-3">
            <Dumbbell aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-600" />
            Strength on Monday, Wednesday and Friday — bodyweight in week 1, then 2 × 3 kg dumbbells.
          </li>
          <li className="flex gap-3">
            <Footprints aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-600" />
            Walking on Tuesday and Saturday, recovery on Thursday, rest on Sunday.
          </li>
        </ul>
      </div>
      <StartDateForm
        action={startProgram}
        options={options}
        submitLabel="Start program"
        pendingLabel="Starting…"
        hint="Days before today in the first week will show as missed. Dates follow Jakarta time (WIB)."
      />
    </div>
  );
}
