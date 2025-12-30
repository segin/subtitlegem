import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguage, contextBefore, contextAfter } = await req.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing text or targetLanguage" }, { status: 400 });
    }

    const { getGlobalSettings } = await import("@/lib/global-settings-store");
    const { processWithFallback } = await import("@/lib/ai-provider");
    const settings = getGlobalSettings();

    // Map single line request to what processWithFallback expects if needed,
    // or just handle the single line translation here via processWithFallback.
    
    // If it's single text, we wrap it in a pseudo-subtitle array for the translate task
    if (text) {
      const result = await processWithFallback(
        'translate',
        { subtitles: [{ text }], targetLanguage },
        settings.aiFallbackChain
      );
      
      const translation = result.subtitles[0].secondaryText || result.subtitles[0].text;
      return NextResponse.json({ translation });
    }

    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  } catch (error: any) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: error.message || "Failed to translate" }, { status: 500 });
  }
}