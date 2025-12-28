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
  supportedActions?: string[];
}

/**
 * GET /api/models - List available Gemini models
 * ?test=<modelName> - Test if a specific model is accessible
 */
export async function GET(req: NextRequest) {
  const testModel = req.nextUrl.searchParams.get("test");
  
  try {
    if (testModel) {
      // Test a specific model - prepend models/ if missing
      const fullModelName = testModel.startsWith("models/") ? testModel : `models/${testModel}`;
      try {
        const response = await ai.models.generateContent({
          model: fullModelName,
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
      const supportedActions = (model as any).supportedActions || [];
      if (supportedActions.includes("generateContent")) {
        models.push({
          name: modelName.replace("models/", ""),
          displayName: model.displayName || modelName,
          description: model.description,
          inputTokenLimit: model.inputTokenLimit,
          outputTokenLimit: model.outputTokenLimit,
          supportedActions: supportedActions,
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
