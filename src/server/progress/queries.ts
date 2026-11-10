import "server-only";

import { cache } from "react";
import type { IsoDate } from "@/lib/program/calendar";
import {
  METRICS,
  checkInSchedule,
  programWeekOf,
  type CheckIn,
  type MeasurementRecord,
  type MetricKey,
} from "@/lib/measurements/measurements";
import type { PhotoType } from "@/lib/storage/progress-photos";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { getCurrentProgram, getToday } from "@/server/program/queries";
import { createSignedPhotoUrls } from "@/server/storage/progress-photos";

/** Measurements & photos (RLS: own rows only; queries also filter by user_id). */

export type Measurement = MeasurementRecord & { notes: string | null; createdAt: string; updatedAt: string };

type Row = Record<string, unknown>;
const COLUMNS =
  "id,week_number,recorded_on,weight_kg,body_fat_pct,skeletal_muscle_kg,visceral_fat,waist_cm,lower_abdomen_cm,arm_cm,thigh_cm,notes,created_at,updated_at";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function mapMeasurement(r: Row): Measurement {
  const values = Object.fromEntries(METRICS.map((m) => [m.key, num(r[m.column])])) as Record<MetricKey, number | null>;
  return {
    id: r.id as string,
    weekNumber: r.week_number as number,
    recordedOn: r.recorded_on as IsoDate,
    ...values,
    notes: (r.notes as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

/** All measurements, newest first. */
export const getMeasurements = cache(async (): Promise<Measurement[]> => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("body_measurements")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .order("recorded_on", { ascending: false })
    .order("week_number", { ascending: false });
  if (error) throw new Error(`Could not load measurements: ${error.message}`);
  return (data as Row[]).map(mapMeasurement);
});

export const getMeasurement = cache(async (id: string): Promise<Measurement | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("body_measurements").select(COLUMNS).eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error(`Could not load the measurement: ${error.message}`);
  return data ? mapMeasurement(data as Row) : null;
});

export type Photo = {
  id: string;
  weekNumber: number;
  photoType: PhotoType;
  takenOn: IsoDate;
  storagePath: string;
  width: number | null;
  height: number | null;
  uploadedAt: string;
  /** Short-lived signed URL (null if Storage refused). Never a public URL. */
  url: string | null;
};

/** All photos with fresh signed URLs (5 min). */
export const getPhotos = cache(async (): Promise<Photo[]> => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress_photos")
    .select("id,week_number,photo_type,taken_on,storage_path,width_px,height_px,uploaded_at")
    .eq("user_id", user.id)
    .order("week_number")
    .order("photo_type");
  if (error) throw new Error(`Could not load photos: ${error.message}`);
  const rows = data as Row[];
  let urls: Record<string, string | null> = {};
  if (rows.length > 0) {
    try {
      urls = await createSignedPhotoUrls(rows.map((r) => r.storage_path as string));
    } catch {
      urls = {}; // Storage unavailable: photos show a "couldn't load" state instead of breaking the page
    }
  }
  return rows.map((r) => ({
    id: r.id as string,
    weekNumber: r.week_number as number,
    photoType: r.photo_type as PhotoType,
    takenOn: r.taken_on as IsoDate,
    storagePath: r.storage_path as string,
    width: (r.width_px as number | null) ?? null,
    height: (r.height_px as number | null) ?? null,
    uploadedAt: r.uploaded_at as string,
    url: urls[r.storage_path as string] ?? null,
  }));
});

export type ProgressContext = {
  today: IsoDate;
  programStart: IsoDate | null;
  /** Current program week (1–12), or null without a program / outside it. */
  currentWeek: number | null;
  schedule: CheckIn[];
  measurements: Measurement[];
};

export const getProgressContext = cache(async (): Promise<ProgressContext> => {
  const [today, program, measurements] = await Promise.all([getToday(), getCurrentProgram(), getMeasurements()]);
  const programStart = program?.startDate ?? null;
  const recorded = new Map(measurements.map((m) => [m.weekNumber, m.recordedOn]));
  return {
    today,
    programStart,
    currentWeek: programStart ? programWeekOf(programStart, today) : null,
    schedule: programStart ? checkInSchedule(programStart, today, recorded) : [],
    measurements,
  };
});
