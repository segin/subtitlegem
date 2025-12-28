import { NextRequest, NextResponse } from "next/server";
import { getGlobalSettings, saveGlobalSettings, resetGlobalSettings } from "@/lib/global-settings-store";
import { GlobalSettings } from "@/types/subtitle";

/**
 * GET /api/settings - Get current global settings
 */
export async function GET() {
  try {
    const settings = getGlobalSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("[Settings API] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/settings - Update global settings
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    const settings: GlobalSettings = {
      defaultPrimaryFontSize: body.defaultPrimaryFontSize ?? 2.22,
      defaultSecondaryFontSize: body.defaultSecondaryFontSize ?? 1.85,
      defaultMarginV: body.defaultMarginV ?? 2.78,
      defaultMarginH: body.defaultMarginH ?? 1.04,
      defaultPrimaryLanguage: body.defaultPrimaryLanguage ?? 'English',
      defaultSecondaryLanguage: body.defaultSecondaryLanguage ?? 'Simplified Chinese',
      defaultHwaccel: body.defaultHwaccel ?? 'none',
      defaultPreset: body.defaultPreset ?? 'veryfast',
      defaultCrf: body.defaultCrf ?? 23,
      defaultGeminiModel: body.defaultGeminiModel ?? 'gemini-2.0-flash',
    };
    
    saveGlobalSettings(settings);
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error("[Settings API] PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/settings - Reset to defaults
 */
export async function DELETE() {
  try {
    const settings = resetGlobalSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error("[Settings API] DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
