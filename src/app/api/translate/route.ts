import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = 'nodejs';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "" });

const translationSchema = {
  type: "OBJECT",
  properties: {
    translation: {
      type: "STRING",
      description: "The translated text only",
    },
  },
  required: ["translation"],
};

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguage, contextBefore, contextAfter } = await req.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing text or targetLanguage" }, { status: 400 });
    }

    const prompt = `
      You are a professional subtitle translator.
      Translate the following line into ${targetLanguage}.
      
      Context before: "${contextBefore || ''}"
      Context after: "${contextAfter || ''}"
      
      Line to translate: "${text}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: translationSchema as any,
      },
    });

    const responseText = response.text!;
    const data = JSON.parse(responseText);

    return NextResponse.json({ translation: data.translation });
  } catch (error: any) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: error.message || "Failed to translate" }, { status: 500 });
  }
}