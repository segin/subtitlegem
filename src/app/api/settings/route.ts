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
    
    // Merge with existing settings to allow partial updates
    const existing = getGlobalSettings();
    const settings: GlobalSettings = {
      defaultPrimaryStyle: body.defaultPrimaryStyle ?? existing.defaultPrimaryStyle,
      defaultSecondaryStyle: body.defaultSecondaryStyle ?? existing.defaultSecondaryStyle,
      defaultPrimaryLanguage: body.defaultPrimaryLanguage ?? existing.defaultPrimaryLanguage,
      defaultSecondaryLanguage: body.defaultSecondaryLanguage ?? existing.defaultSecondaryLanguage,
      subtitleStyle: body.subtitleStyle ?? existing.subtitleStyle,
      defaultHwaccel: body.defaultHwaccel ?? existing.defaultHwaccel,
      defaultPreset: body.defaultPreset ?? existing.defaultPreset,
      defaultCrf: body.defaultCrf ?? existing.defaultCrf,
      defaultGeminiModel: body.defaultGeminiModel ?? existing.defaultGeminiModel,
      aiFallbackChain: body.aiFallbackChain ?? existing.aiFallbackChain,
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
