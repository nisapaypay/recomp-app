import { NextResponse, type NextRequest } from "next/server";
import { PROGRESS_PHOTOS_BUCKET, isOwnPhotoPath } from "@/lib/storage/progress-photos";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth";
import { getMeasurements } from "@/server/progress/queries";
import { renderReportPdf, type PdfPhoto } from "@/server/report/pdf-document";
import { getReportData } from "@/server/report/queries";

/**
 * GET /api/report/pdf?photos=1 → A4 PDF download. Read-only (never writes to
 * Supabase). Photos (optional) are downloaded with the user's session and
 * embedded as bytes; WebP files are skipped (not supported by the PDF engine).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const data = await getReportData();
  if (!data) return NextResponse.json({ error: "no_program" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const measurements = await getMeasurements();

  let photos: PdfPhoto[] | null = null;
  if (request.nextUrl.searchParams.get("photos") === "1") {
    photos = [];
    const supabase = await createSupabaseServerClient();
    const { data: rows } = await supabase
      .from("progress_photos")
      .select("week_number,photo_type,taken_on,storage_path,content_type")
      .eq("user_id", user.id)
      .in("week_number", [1, 4, 8, 12]);
    for (const r of rows ?? []) {
      const path = r.storage_path as string;
      const type = r.content_type as string;
      if (!isOwnPhotoPath(user.id, path) || (type !== "image/jpeg" && type !== "image/png")) continue;
      const file = await supabase.storage.from(PROGRESS_PHOTOS_BUCKET).download(path);
      if (file.error || !file.data) continue;
      photos.push({
        weekNumber: r.week_number as number,
        photoType: r.photo_type as PdfPhoto["photoType"],
        takenOn: r.taken_on as string,
        data: Buffer.from(await file.data.arrayBuffer()),
        format: type === "image/png" ? "png" : "jpg",
      });
    }
  }

  const pdf = await renderReportPdf(data, measurements, photos);
  const name = `recomp-${data.kind === "final" ? "12-week-report" : "interim-report"}-${data.generatedOn}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
