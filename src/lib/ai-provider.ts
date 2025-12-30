import { 
  SubtitleLine, 
  ModelConfig, 
  AIProvider 
} from "@/types/subtitle";
import { generateSubtitles, translateSubtitles } from "./gemini";

export interface AIResult {
  detectedLanguage?: string;
  subtitles: SubtitleLine[];
  provider: AIProvider;
  modelName: string;
}

export class AISafetyError extends Error {
  constructor(public provider: AIProvider, public modelName: string, message: string) {
    super(`Safety Refusal from ${provider} (${modelName}): ${message}`);
    this.name = "AISafetyError";
  }
}

/**
 * Main entry point for AI processing with safety re-route (fallback)
 */
export async function processWithFallback(
  task: 'generate' | 'translate',
  params: any,
  fallbackChain: ModelConfig[]
): Promise<AIResult> {
  const enabledChain = fallbackChain.filter(c => c.enabled);
  if (enabledChain.length === 0) {
    throw new Error("No enabled AI models in fallback chain.");
  }

  let lastError: any = null;

  for (const config of enabledChain) {
    try {
      console.log(`[AI-Provider] Trying ${config.provider} (${config.modelName}) for task: ${task}`);
      
      let result: any;
      if (task === 'generate') {
        result = await callGenerate(config, params);
      } else {
        result = await callTranslate(config, params);
      }

      return {
        ...result,
        provider: config.provider,
        modelName: config.modelName
      };

    } catch (error: any) {
      lastError = error;
      
      const isSafetyRefusal = detectSafetyRefusal(config.provider, error);
      if (isSafetyRefusal) {
        console.warn(`[AI-Provider] Safety refusal from ${config.provider}. Re-routing...`);
        continue; // Try next in chain
      }

      // If it's not a safety refusal (e.g. network error, auth error), we might want to re-route anyway
      // but let's be specific for now.
      console.error(`[AI-Provider] Error from ${config.provider}:`, error.message);
      
      // For now, let's re-route on most transient/recoverable errors too
      if (error.status === 429 || error.status >= 500) {
        console.warn(`[AI-Provider] Recoverable error from ${config.provider}. Re-routing...`);
        continue;
      }

      throw error; // Terminate on fatal errors
    }
  }

  throw lastError || new Error("All AI models in chain failed.");
}

async function callGenerate(config: ModelConfig, params: any) {
  if (config.provider === 'gemini') {
    if (params.isInline) {
      const { generateSubtitlesInline } = await import("./gemini");
      return await generateSubtitlesInline(
        params.base64Data,
        params.mimeType,
        params.secondaryLanguage,
        1,
        config.modelName
      );
    }
    const { generateSubtitles } = await import("./gemini");
    return await generateSubtitles(
      params.fileUri,
      params.mimeType,
      params.secondaryLanguage,
      1,
      config.modelName
    );
  }

  // TODO: Implement other providers for 'generate' (requires audio/video upload or local processing)
  throw new Error(`Provider ${config.provider} does not support 'generate' task yet.`);
}

async function callTranslate(config: ModelConfig, params: any) {
  if (config.provider === 'gemini') {
    const subtitles = await translateSubtitles(
      params.subtitles,
      params.targetLanguage,
      config.modelName
    );
    return { subtitles };
  }

  if (config.provider === 'openai' || config.provider === 'deepseek' || config.provider === 'local' || config.provider === 'ollama') {
    return await callOpenAICompatible(config, params);
  }

  throw new Error(`Provider ${config.provider} does not support 'translate' task yet.`);
}

async function callOpenAICompatible(config: ModelConfig, params: any) {
  const endpoint = config.endpoint || (config.provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1');
  const apiKey = config.apiKey || (config.provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY);

  if (!apiKey && config.provider !== 'ollama' && config.provider !== 'local') {
    throw new Error(`API Key missing for ${config.provider}`);
  }

  const prompt = `
    You are an expert translator.
    Translate the 'text' field of the following JSON subtitles into ${params.targetLanguage}.
    Put the translated text into the 'secondaryText' field.
    
    Rules:
    1. PRESERVE 'startTime' and 'endTime' EXACTLY.
    2. PRESERVE the number of objects and their order.
    3. Output raw JSON ONLY. Do not include markdown formatting or explanations.
    
    Input JSON:
    ${JSON.stringify(params.subtitles)}
  `;

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || 'no-key'}`
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: [
        { role: 'system', content: 'You are a subtitle translation engine. Output only JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const status = response.status;
    const message = errorData.error?.message || response.statusText;
    
    const err: any = new Error(message);
    err.status = status;
    err.data = errorData;
    throw err;
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    const result = JSON.parse(content);
    if (Array.isArray(result)) return { subtitles: result };
    if (result.subtitles) return { subtitles: result.subtitles };
    return { subtitles: result };
  } catch (e) {
    console.error("[AI-Provider] Failed to parse OpenAI response:", content);
    throw new Error("Invalid JSON returned from AI provider.");
  }
}

function detectSafetyRefusal(provider: AIProvider, error: any): boolean {
  const message = (error.message || "").toLowerCase();
  
  // Gemini safety detection
  if (provider === 'gemini') {
    // Check for "SAFETY" in error message or specific SDK error patterns
    if (message.includes("safety") || message.includes("blocked") || error.status === 400 && message.includes("candidate")) {
      return true;
    }
  }

  // DeepSeek / OpenAI safety detection
  if (provider === 'openai' || provider === 'deepseek') {
    if (message.includes("safety") || message.includes("policy") || message.includes("content filter") || message.includes("refused")) {
      return true;
    }
    // DeepSeek specific refusal often returns code 400 with "content_filter" or similar
    if (error.data?.error?.code === 'content_filter') return true;
  }

  return false;
}
