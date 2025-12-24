import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export const runtime = 'nodejs';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

const translationSchema = {
  type: SchemaType.OBJECT,
  properties: {
    translation: {
      type: SchemaType.STRING,
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

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: translationSchema as any,
      }
    });

    const prompt = `
      You are a professional subtitle translator.
      Translate the following line into ${targetLanguage}.
      
      Context before: "${contextBefore || ''}"
      Context after: "${contextAfter || ''}"
      
      Line to translate: "${text}"
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    return NextResponse.json({ translation: data.translation });
  } catch (error: any) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: error.message || "Failed to translate" }, { status: 500 });
  }
}