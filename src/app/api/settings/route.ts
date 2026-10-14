import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGlobalSettings, saveGlobalSettings, resetGlobalSettings } from "@/lib/global-settings-store";
import { GlobalSettings, ModelConfig } from "@/types/subtitle";

const HWACCELS = ['nvenc', 'amf', 'qsv', 'videotoolbox', 'vaapi', 'v4l2m2m', 'rkmpp', 'omx', 'none'] as const;
const PRESETS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'] as const;

const PROVIDERS = ['gemini', 'openai', 'anthropic', 'deepseek', 'ollama', 'local'] as const;

const ModelConfigSchema = z.object({
  id: z.string().min(1).max(100),
  provider: z.enum(PROVIDERS),
  modelName: z.string().max(200),
  apiKey: z.string().max(1000).optional(),
  endpoint: z.union([z.literal(''), z.url({ protocol: /^https?$/ }).max(2000)]).optional(),
  enabled: z.boolean(),
});

/** Placeholder returned by GET in place of a stored API key. */
const REDACTED_API_KEY = '__stored__';

function redactChain(chain: ModelConfig[]): ModelConfig[] {
  return chain.map(m => (m.apiKey ? { ...m, apiKey: REDACTED_API_KEY } : m));
}

/**
 * Swap redacted placeholders back for the stored keys. A stored key is only
 * restored if the entry still points at the same provider and endpoint, so a
 * caller can't redirect a saved key to a server of their choosing.
 */
function restoreChainKeys(incoming: ModelConfig[], existing: ModelConfig[]): ModelConfig[] {
  return incoming.map(m => {
    if (m.apiKey !== REDACTED_API_KEY) return m;
    const prev = existing.find(e => e.id === m.id);
    const sameTarget = prev && prev.provider === m.provider && (prev.endpoint || '') === (m.endpoint || '');
    return { ...m, apiKey: sameTarget ? prev.apiKey : undefined };
  });
}

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
  aiFallbackChain: z.array(ModelConfigSchema).max(20).optional(),
  maxFileSizeMB: z.number().positive().max(1024 * 1024).optional(),     // <= 1 PB
  maxProjectSizeMB: z.number().positive().max(1024 * 1024).optional(),
}).passthrough();

/**
 * GET /api/settings - Get current global settings
 */
export async function GET() {
  try {
    const settings = getGlobalSettings();
    return NextResponse.json({ ...settings, aiFallbackChain: redactChain(settings.aiFallbackChain) });
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
      aiFallbackChain: validation.data.aiFallbackChain
        ? restoreChainKeys(validation.data.aiFallbackChain, existing.aiFallbackChain)
        : existing.aiFallbackChain,
      maxFileSizeMB: body.maxFileSizeMB ?? existing.maxFileSizeMB,
      maxProjectSizeMB: body.maxProjectSizeMB ?? existing.maxProjectSizeMB,
    };
    
    saveGlobalSettings(settings);
    return NextResponse.json({
      success: true,
      settings: { ...settings, aiFallbackChain: redactChain(settings.aiFallbackChain) },
    });
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
