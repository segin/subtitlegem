import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = 'nodejs';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "" 
});

interface ModelInfo {
  name: string;
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

/**
 * GET /api/models - List available Gemini models
 * ?test=<modelName> - Test if a specific model is accessible
 */
export async function GET(req: NextRequest) {
  const testModel = req.nextUrl.searchParams.get("test");
  
  try {
    if (testModel) {
      // Test a specific model
      try {
        const response = await ai.models.generateContent({
          model: testModel,
          contents: "Hello, respond with just 'OK' if you can hear me.",
        });
        
        return NextResponse.json({ 
          success: true, 
          model: testModel,
          response: response.text?.substring(0, 100)
        });
      } catch (error: any) {
        return NextResponse.json({ 
          success: false, 
          model: testModel,
          error: error.message || "Model not accessible"
        }, { status: 400 });
      }
    }
    
    // List all available models
    const models: ModelInfo[] = [];
    
    // Get models list from API
    const pager = await ai.models.list();
    
    for await (const model of pager) {
      const modelName = model.name || "";
      // Only include generative models that support generateContent
      // and are NOT retired (2.0 and earlier, including all 1.x models)
      const isGenerative = (model as any).supportedGenerationMethods?.includes("generateContent");
      const isRetired = /gemini-(1\.|2\.0)/.test(modelName) || modelName.includes("pro-vision");

      if (isGenerative && !isRetired) {
        models.push({
          name: modelName,
          displayName: model.displayName || modelName,
          description: model.description,
          inputTokenLimit: model.inputTokenLimit,
          outputTokenLimit: model.outputTokenLimit,
          supportedGenerationMethods: (model as any).supportedGenerationMethods,
        });
      }
    }
    
    // Sort by name (gemini-2.x first, then gemini-1.x)
    models.sort((a, b) => {
      const aVersion = a.name.match(/gemini-(\d+)/)?.[1] || "0";
      const bVersion = b.name.match(/gemini-(\d+)/)?.[1] || "0";
      return parseInt(bVersion) - parseInt(aVersion);
    });
    
    return NextResponse.json({ models });
  } catch (error: any) {
    console.error("[Models API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
