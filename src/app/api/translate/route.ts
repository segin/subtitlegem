import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = 'nodejs';

// Neighbouring lines that give the model context for a single line
const ContextLines = z.array(z.string().max(1000)).max(20).optional();

const TranslateRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  targetLanguage: z.string().min(1).max(100),
  contextBefore: ContextLines,
  contextAfter: ContextLines,
});

export async function POST(req: NextRequest) {
  try {
    const parsed = TranslateRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing or invalid text, targetLanguage or context" }, { status: 400 });
    }
    const { text, targetLanguage, contextBefore, contextAfter } = parsed.data;

    const { getGlobalSettings } = await import("@/lib/global-settings-store");
    const { processWithFallback } = await import("@/lib/ai-provider");
    const settings = getGlobalSettings();

    // Map single line request to what processWithFallback expects if needed,
    // or just handle the single line translation here via processWithFallback.
    
    // If it's single text, we wrap it in a pseudo-subtitle array for the translate task
    if (text) {
      const result = await processWithFallback(
        'translate',
        {
          subtitles: [{ id: "single", startTime: 0, endTime: 0, text }],
          targetLanguage,
          context: { before: contextBefore, after: contextAfter },
        },
        settings.aiFallbackChain
      );
      
      const translation = result.subtitles[0].secondaryText || result.subtitles[0].text;
      return NextResponse.json({ translation });
    }

    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to translate" }, { status: 500 });
  }
}