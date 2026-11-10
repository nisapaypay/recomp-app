import "server-only";

import { Document, Image, Page, Path, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDate } from "@/lib/program/format";
import { METRICS, formatDelta, formatValue, seriesFor, type MeasurementRecord, type MetricKey } from "@/lib/measurements/measurements";
import { formatDuration, formatKm, formatPace } from "@/lib/walking/walking";
import type { ReportData } from "./queries";

/**
 * A4 PDF of the report. Same data object as the report page (getReportData),
 * so values and dates match. Photos are embedded as image bytes — the PDF
 * never contains a URL to private storage.
 */

export type PdfPhoto = { weekNumber: number; photoType: "front" | "side" | "back"; takenOn: string; data: Buffer; format: "jpg" | "png" };

const C = { ink: "#1f1d24", soft: "#4b4754", muted: "#6e6a77", line: "#e6e3ea", accent: "#5d3fbb", accentDark: "#4a3197", lavender: "#efeafb", canvas: "#f7f6f3" };

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const short = (d: string) => dayMonth.format(new Date(`${d}T00:00:00Z`));

// Built-in PDF fonts are WinAnsi: replace glyphs they can't draw.
const t = (s: string) => s.replace(/→/g, "->").replace(/−/g, "-").replace(/[✓✔]/g, "").replace(/…/g, "...");

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, color: C.ink, lineHeight: 1.35 },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  brandMark: { width: 22, height: 22, borderRadius: 6, backgroundColor: C.accentDark, marginRight: 8 },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 11, letterSpacing: 2 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 20, lineHeight: 1.2, marginBottom: 6 },
  sub: { color: C.muted, marginBottom: 2 },
  badge: { alignSelf: "flex-start", backgroundColor: C.lavender, color: C.accentDark, fontFamily: "Helvetica-Bold", fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, marginTop: 6 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 12.5, marginTop: 18, marginBottom: 6, color: C.accentDark },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  stat: { width: "25%", paddingHorizontal: 4, marginBottom: 8 },
  statLabel: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  statSub: { fontSize: 7.5, color: C.muted },
  note: { fontSize: 8, color: C.muted, marginTop: 4 },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 4, paddingHorizontal: 6 },
  th: { fontSize: 7.5, color: C.muted, fontFamily: "Helvetica-Bold" },
  cell: { flex: 1 },
  right: { textAlign: "right" },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted },
  chartBox: { width: "50%", paddingHorizontal: 4, marginBottom: 10 },
  chartTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 2 },
  photoRow: { flexDirection: "row", marginBottom: 10 },
  photoCell: { width: "50%", paddingHorizontal: 4 },
  photo: { width: "100%", height: 340, objectFit: "cover", objectPosition: "top", borderRadius: 4 }, // 3:4 frame like the app
});

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{t(label)}</Text>
      <Text style={s.statValue}>{t(value)}</Text>
      {sub ? <Text style={s.statSub}>{t(sub)}</Text> : null}
    </View>
  );
}

/** Line chart of real values only (straight segments, no smoothing), dates on the x axis. */
function MiniChart({ records, metric }: { records: MeasurementRecord[]; metric: MetricKey }) {
  const def = METRICS.find((m) => m.key === metric)!;
  const pts = seriesFor(records, metric);
  if (pts.length === 0) return null;
  const W = 240, H = 90, P = 10;
  const times = pts.map((p) => Date.parse(`${p.date}T00:00:00Z`));
  const vals = pts.map((p) => p.value);
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const v0 = Math.min(...vals), v1 = Math.max(...vals);
  const pad = Math.max((v1 - v0) * 0.25, 0.5);
  const x = (tm: number) => (t1 === t0 ? W / 2 : P + ((tm - t0) / (t1 - t0)) * (W - 2 * P));
  const y = (v: number) => H - P - ((v - (v0 - pad)) / (v1 + pad - (v0 - pad))) * (H - 2 * P);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(times[i]).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  return (
    <View style={s.chartBox} wrap={false}>
      <Text style={s.chartTitle}>
        {t(def.label)} <Text style={{ color: C.muted, fontFamily: "Helvetica" }}>({t(formatValue(vals[vals.length - 1], def))} latest)</Text>
      </Text>
      <Svg width={W} height={H}>
        <Rect x={0} y={0} width={W} height={H} fill={C.canvas} />
        {[0.25, 0.5, 0.75].map((f) => (
          <Path key={f} d={`M${P} ${(H * f).toFixed(1)} L${W - P} ${(H * f).toFixed(1)}`} stroke={C.line} strokeWidth={0.75} />
        ))}
        {pts.length > 1 ? <Path d={d} stroke={C.accent} strokeWidth={1.75} fill="none" /> : null}
        {pts.map((p, i) => (
          <Path key={p.date} d={`M${x(times[i]) - 2.6} ${y(p.value)} a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0`} fill={C.accent} stroke="#ffffff" strokeWidth={1} />
        ))}
      </Svg>
      <Text style={s.note}>{t(pts.map((p) => `${formatDate(p.date, "medium")}: ${formatValue(p.value, def)}`).join(" · "))}</Text>
    </View>
  );
}

function ReportPdf({ data, measurements, photos }: { data: ReportData; measurements: MeasurementRecord[]; photos: PdfPhoto[] | null }) {
  const { kind, program, timing, completion, training, walking, body, timeline } = data;
  const pct = completion.total.planned > 0 ? Math.round((completion.total.completed / completion.total.planned) * 100) : 0;
  const title = kind === "final" ? "RECOMP — 12 Week Progress Report" : "RECOMP — 12 Week Progress Report (interim)";
  const comparisons = [4, 8, 12];
  const types = ["front", "side", "back"] as const;

  return (
    <Document title={t(title)} author="RECOMP" subject="12-week body recomposition progress report">
      <Page size="A4" style={s.page}>
        <View style={s.brandRow}>
          <View style={s.brandMark} />
          <Text style={s.brand}>RECOMP</Text>
        </View>
        <Text style={s.title}>{t(title)}</Text>
        <Text style={s.sub}>
          {t(`Program ${formatDate(program.startDate, "long")} – ${formatDate(program.endDate, "long")} · Report date ${formatDate(data.generatedOn, "long")}`)}
        </Text>
        <Text style={s.badge}>{kind === "final" ? "FINAL REPORT" : `INTERIM REPORT · ${data.daysLeft} DAYS LEFT`}</Text>

        <Text style={s.h2}>Program summary</Text>
        <View style={s.grid}>
          <Stat label="Program week" value={timing.state === "in_progress" ? `${timing.week} of 12` : timing.state === "finished" ? "12 of 12 (ended)" : "Not started"} />
          <Stat label="Calendar" value={`Day ${data.calendarDays} of 84`} sub="time elapsed" />
          <Stat label="Activities completed" value={`${completion.total.completed} of ${completion.total.planned}`} sub={`${pct}% of planned`} />
          <Stat label="Due so far" value={`${completion.total.completed} of ${completion.total.plannedToDate}`} />
          <Stat label="Strength" value={`${completion.strength.completed} of ${completion.strength.planned}`} />
          <Stat label="Program walks" value={`${completion.walking.completed} of ${completion.walking.planned}`} />
          <Stat label="Recovery" value={completion.recoveryConfigured ? `${completion.recovery.completed} of ${completion.recovery.planned}` : "Not configured"} />
          <Stat label="Planned activities" value={String(completion.total.planned)} />
        </View>
        <Text style={s.note}>Calendar progress and activity completion are reported separately.</Text>

        <Text style={s.h2}>Body composition</Text>
        {body.rows.length === 0 ? (
          <Text style={s.note}>No measurements recorded.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.tr} fixed>
              <Text style={[s.th, { flex: 1.4 }]}>Metric</Text>
              <Text style={[s.th, s.cell, s.right]}>Initial</Text>
              <Text style={[s.th, s.cell, s.right]}>Latest</Text>
              <Text style={[s.th, s.cell, s.right]}>Difference</Text>
            </View>
            {body.rows.map(({ def, change }) => (
              <View key={def.key} style={s.tr} wrap={false}>
                <Text style={{ flex: 1.4, fontFamily: "Helvetica-Bold" }}>{t(def.label)}</Text>
                <Text style={[s.cell, s.right]}>{t(`${formatValue(change.first.value, def)}\n${formatDate(change.first.date, "medium")}`)}</Text>
                <Text style={[s.cell, s.right]}>{change.delta === null ? "-" : t(`${formatValue(change.latest.value, def)}\n${formatDate(change.latest.date, "medium")}`)}</Text>
                <Text style={[s.cell, s.right]}>{change.delta === null ? "needs a 2nd value" : t(formatDelta(change.delta, def))}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={s.note}>
          In a body recomposition, weight can stay the same or rise while body fat falls and muscle grows. Measurements only — not a health assessment.
        </Text>
        {body.rows.length > 0 ? (
          <View style={[s.grid, { marginTop: 8 }]}>
            {(["weightKg", "bodyFatPct", "skeletalMuscleKg", "waistCm"] as MetricKey[]).map((k) => (
              <MiniChart key={k} records={measurements} metric={k} />
            ))}
          </View>
        ) : null}

        <Text style={s.h2} break={body.rows.length > 0}>Training</Text>
        <View style={s.grid}>
          <Stat label="Strength workouts" value={String(training.strengthCompleted)} />
          <Stat label="Completion rate" value={training.completionRate === null ? "-" : `${Math.round(training.completionRate * 100)}%`} sub={`of ${training.strengthPlannedToDate} due`} />
          <Stat label="Exercises performed" value={String(training.exercisesPerformed)} />
          <Stat label="Feedback" value={`${training.feedback.too_easy} / ${training.feedback.just_right} / ${training.feedback.too_hard}`} sub="too easy / just right / too hard" />
        </View>
        {training.perWeek.length > 0 ? (
          <Text style={s.note}>{t(`Weekly strength consistency: ${training.perWeek.map((w) => `W${w.week} ${w.completed}/${w.planned}`).join(" · ")}`)}</Text>
        ) : null}
        {training.topExercises.length > 0 ? (
          <Text style={s.note}>{t(`Most completed: ${training.topExercises.map((e) => `${e.name} (${e.completed}x)`).join(", ")}`)}</Text>
        ) : null}
        {training.progression.length > 0 ? (
          <View style={{ marginTop: 6 }} wrap={false}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>Recorded progression</Text>
            {training.progression.map((p) => (
              <Text key={p.name}>{t(`${p.name}: ${p.from} → ${p.to}`)}</Text>
            ))}
          </View>
        ) : null}
        {data.adjustments.length > 0 ? (
          <View style={{ marginTop: 6 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>Adaptive changes</Text>
            {data.adjustments.map((a) => (
              <Text key={a.id} wrap={false}>
                {t(`${formatDate(a.effectiveFrom, "medium")} · ${a.exerciseName}: ${a.changeType.includes("sets") ? `${a.previousSets} → ${a.newSets} sets` : `${a.previousTarget} → ${a.newTarget}${a.measureType === "seconds" ? " s" : " reps"}`}`)}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={s.h2}>Walking</Text>
        {walking.sessions === 0 ? (
          <Text style={s.note}>No walks logged.</Text>
        ) : (
          <View style={s.grid}>
            <Stat label="Walks" value={String(walking.sessions)} sub={`${walking.scheduled} program · ${walking.extra} extra`} />
            <Stat label="Distance" value={formatKm(walking.km)} />
            <Stat label="Time" value={formatDuration(walking.minutes)} />
            <Stat label="Avg pace / speed" value={formatPace(walking.paceSecondsPerKm) ?? "-"} sub={walking.speedKmh === null ? undefined : `${walking.speedKmh.toFixed(1)} km/h`} />
          </View>
        )}
        {walking.perWeek.length > 0 ? (
          <Text style={s.note}>{t(`Program walks per week: ${walking.perWeek.map((w) => `W${w.week} ${w.programDone}/${w.programPlanned}`).join(" · ")}`)}</Text>
        ) : null}

        <Text style={s.h2}>Weekly timeline</Text>
        <View style={s.table}>
          <View style={s.tr} fixed>
            <Text style={[s.th, { width: 44 }]}>Week</Text>
            <Text style={[s.th, { width: 100, paddingRight: 8 }]}>Dates</Text>
            <Text style={[s.th, s.cell]}>Activities</Text>
            <Text style={[s.th, s.cell]}>Walking</Text>
            <Text style={[s.th, { flex: 2 }]}>Check-in</Text>
          </View>
          {timeline.map((w) => (
            <View key={w.week} style={s.tr} wrap={false}>
              <Text style={{ width: 44, fontFamily: "Helvetica-Bold" }}>{w.week}</Text>
              <Text style={{ width: 100, paddingRight: 8 }}>{t(`${short(w.start)} – ${short(w.end)}`)}</Text>
              <Text style={s.cell}>{w.state === "future" ? "not reached" : `${w.completed}/${w.planned} (${w.percent}%)`}</Text>
              <Text style={s.cell}>{w.state === "future" ? "-" : formatKm(w.walkingKm)}</Text>
              <Text style={{ flex: 2 }}>
                {w.measurement
                  ? t(`${formatDate(w.measurement.recordedOn, "medium")}${w.measurement.weightKg !== null ? ` · ${w.measurement.weightKg} kg` : ""}${w.measurement.bodyFatPct !== null ? ` · ${w.measurement.bodyFatPct}%` : ""}`)
                  : "-"}
              </Text>
            </View>
          ))}
        </View>

        {photos ? (
          <View break>
            <Text style={s.h2}>Progress photos</Text>
            {photos.length === 0 ? <Text style={s.note}>No photos available.</Text> : null}
            {comparisons.flatMap((later) =>
              types.map((type) => {
                const before = photos.find((p) => p.weekNumber === 1 && p.photoType === type);
                const after = photos.find((p) => p.weekNumber === later && p.photoType === type);
                if (!before || !after) return null;
                return (
                  <View key={`${later}-${type}`} wrap={false}>
                    <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>{t(`Week 1 vs Week ${later} · ${type}`)}</Text>
                    <View style={[s.photoRow, { marginHorizontal: -4 }]}>
                      {[before, after].map((p) => (
                        <View key={p.weekNumber} style={s.photoCell}>
                          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                          <Image src={{ data: p.data, format: p.format }} style={s.photo} />
                          <Text style={s.note}>{t(`Week ${p.weekNumber} · ${formatDate(p.takenOn, "medium")}`)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              }),
            )}
            {photos.length > 0 ? <Text style={s.note}>Only pairs where both photos exist are shown.</Text> : null}
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text>RECOMP · personal report · {t(formatDate(data.generatedOn, "medium"))}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function renderReportPdf(data: ReportData, measurements: MeasurementRecord[], photos: PdfPhoto[] | null): Promise<Buffer> {
  return renderToBuffer(<ReportPdf data={data} measurements={measurements} photos={photos} />);
}
