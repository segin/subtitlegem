import { NextRequest, NextResponse } from "next/server";
import { getExportFontMetrics } from "@/lib/font-metrics";
import { ExportFontMetrics } from "@/lib/subtitle-render-style";

export const runtime = "nodejs";

const MAX_FAMILIES = 10;

/**
 * GET /api/font-metrics?families=Noto Sans,Georgia
 * For each family: the font the export will really use and its line ratio,
 * so the editor preview can draw subtitles at the exported size.
 */
export async function GET(req: NextRequest) {
  const families = [...new Set(
    (req.nextUrl.searchParams.get("families") || "")
      .split(",")
      .map(f => f.trim())
      .filter(Boolean),
  )].slice(0, MAX_FAMILIES);

  if (families.length === 0) {
    return NextResponse.json({ error: "Missing families" }, { status: 400 });
  }

  const fonts: Record<string, ExportFontMetrics> = {};
  for (const family of families) {
    fonts[family] = await getExportFontMetrics(family);
  }
  return NextResponse.json({ fonts }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
