import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGlobalSettings, saveGlobalSettings, resetGlobalSettings } from "@/lib/global-settings-store";
import { GlobalSettings } from "@/types/subtitle";

const HWACCELS = ['nvenc', 'amf', 'qsv', 'videotoolbox', 'vaapi', 'v4l2m2m', 'rkmpp', 'omx', 'none'] as const;
const PRESETS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'] as const;

// Validate the bounded/scalar fields; style objects are accepted as-is.
const SettingsSchema = z.object({
  defaultPrimaryStyle: z.unknown().optional(),
  defaultSecondaryStyle: z.unknown().optional(),
  defaultPrimaryLanguage: z.string().max(100).optional(),
  defaultSecondaryLanguage: z.string().max(100).optional(),
  subtitleStyle: z.unknown().optional(),
  defaultHwaccel: z.enum(HWACCELS).optional(),
  defaultPreset: z.enum(PRESETS).optional(),
  defaultCrf: z.number().int().min(0).max(51).optional(),
  defaultGeminiModel: z.string().max(200).optional(),
  aiFallbackChain: z.array(z.unknown()).optional(),
  maxFileSizeMB: z.number().positive().max(1024 * 1024).optional(),     // <= 1 PB
  maxProjectSizeMB: z.number().positive().max(1024 * 1024).optional(),
}).passthrough();

/**
 * GET /api/settings - Get current global settings
 */
export async function GET() {
  try {
    const settings = getGlobalSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("[Settings API] GET error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

/**
 * PUT /api/settings - Update global settings
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    const validation = SettingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid settings", details: validation.error.format() },
        { status: 400 }
      );
    }

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
      maxFileSizeMB: body.maxFileSizeMB ?? existing.maxFileSizeMB,
      maxProjectSizeMB: body.maxProjectSizeMB ?? existing.maxProjectSizeMB,
    };
    
    saveGlobalSettings(settings);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("[Settings API] PUT error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/settings - Reset to defaults
 */
export async function DELETE() {
  try {
    const settings = resetGlobalSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("[Settings API] DELETE error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
