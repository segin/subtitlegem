import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = 'nodejs';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || ""
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
      } catch (error) {
        return NextResponse.json({
          success: false,
          model: testModel,
          error: error instanceof Error ? error.message : "Model not accessible"
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
      const supportedActions = (model as { supportedActions?: string[] }).supportedActions || [];
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
    
    // Sort by name (gemini-2.x first, then gemma-4.x, etc.)
    models.sort((a, b) => {
      // Helper to extract family and version
      const getScore = (name: string) => {
        // Boost '-latest' versions to the very top of their family
        const latestBoost = name.includes('-latest') ? 100 : 0;
        
        const geminiMatch = name.match(/gemini-(\d+)\.?(\d+)?/);
        if (geminiMatch) {
          const major = parseInt(geminiMatch[1]);
          const minor = parseInt(geminiMatch[2] || "0");
          return 2000 + major * 10 + minor + latestBoost;
        }
        
        // Handle gemini-pro-latest / gemini-flash-latest without specific version numbers
        if (name.startsWith('gemini')) return 2000 + latestBoost;

        const gemmaMatch = name.match(/gemma-(\d+)\.?(\d+)?/);
        if (gemmaMatch) {
          const major = parseInt(gemmaMatch[1]);
          const minor = parseInt(gemmaMatch[2] || "0");
          return 1000 + major * 10 + minor + latestBoost;
        }
        
        if (name.startsWith('gemma')) return 1000 + latestBoost;

        return 0;
      };
      
      return getScore(b.name) - getScore(a.name);
    });

    // Add category metadata for the UI
    const categorizedModels = models.map(m => ({
        ...m,
        category: m.name.startsWith('gemini') ? 'Gemini' : 
                  m.name.startsWith('gemma') ? 'Gemma' : 'Other'
    }));
    
    // Ensure Latest Gemma 4 models are present (pinned if not returned by API)
    const pinnedGemma = [
      { name: 'gemma-4-31b', displayName: 'Gemma 4 31B (Ultra)', category: 'Gemma' },
      { name: 'gemma-4-12b-unified', displayName: 'Gemma 4 12B Unified', category: 'Gemma' },
      { name: 'gemma-4-26b-a4b', displayName: 'Gemma 4 26B A4B (MoE)', category: 'Gemma' }
    ];
    
    pinnedGemma.forEach(p => {
      if (!categorizedModels.find(m => m.name === p.name)) {
        categorizedModels.push(p);
      }
    });
    
    return NextResponse.json({ models: categorizedModels });
  } catch (error) {
    console.error("[Models API] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
