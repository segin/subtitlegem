import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = 'nodejs';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguage, contextBefore, contextAfter } = await req.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing text or targetLanguage" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are a professional subtitle translator.
      Translate the following line into ${targetLanguage}.
      
      Context before: "${contextBefore || ''}"
      Context after: "${contextAfter || ''}"
      
      Line to translate: "${text}"
      
      Return ONLY the translated text. Do not include quotes or explanations.
    `;

    const result = await model.generateContent(prompt);
    const translation = result.response.text().trim();

    return NextResponse.json({ translation });
  } catch (error: any) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: error.message || "Failed to translate" }, { status: 500 });
  }
}
