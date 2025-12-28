import { GoogleGenerativeAI, Part, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import fs from "fs";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
const fileManager = new GoogleAIFileManager(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

const subtitleSchema = {
  description: "List of subtitles with timestamps and text",
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      startTime: {
        type: SchemaType.STRING,
        description: "Timestamp in HH:MM:SS,mmm format",
      },
      endTime: {
        type: SchemaType.STRING,
        description: "Timestamp in HH:MM:SS,mmm format",
      },
      text: {
        type: SchemaType.STRING,
        description: "English subtitle text",
      },
      secondaryText: {
        type: SchemaType.STRING,
        description: "Secondary language subtitle text",
      },
    },
    required: ["startTime", "endTime", "text"],
  },
};

export async function uploadToGemini(filePath: string, mimeType: string) {
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName: filePath.split("/").pop(),
  });

  let file = await fileManager.getFile(uploadResult.file.name);
  let retryCount = 0;
  const maxRetries = 5;
  
  while (file.state === FileState.PROCESSING) {
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    
    // Retry with exponential backoff on transient errors
    try {
      file = await fileManager.getFile(uploadResult.file.name);
      retryCount = 0; // Reset on success
    } catch (error: any) {
      retryCount++;
      console.error(`\n[Gemini] File status poll failed (attempt ${retryCount}/${maxRetries}):`, error.message);
      
      if (retryCount >= maxRetries) {
        throw new Error(`Failed to get file status after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Exponential backoff: 5s, 10s, 20s, 40s, 80s
      const backoffMs = 5000 * Math.pow(2, retryCount - 1);
      console.log(`[Gemini] Retrying in ${backoffMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  if (file.state === FileState.FAILED) {
    throw new Error("Video processing failed.");
  }

  return file;
}

export async function generateSubtitles(fileUri: string, mimeType: string, secondaryLanguage?: string, attempt = 1, modelName: string = "gemini-2.5-flash") {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: subtitleSchema as any,
    },
  });
  
  const prompt = `
    Generate subtitles for this video in English${secondaryLanguage ? ` and ${secondaryLanguage}` : ""}.
    
    CRITICAL TIMESTAMP RULES:
    1. Format MUST be exactly "HH:MM:SS,mmm" (Hours:Minutes:Seconds,Milliseconds).
    2. ALWAYS include the Hour part, even if it is 00. Example: "00:01:30,500" is CORRECT.
    3. Use a comma (,) for milliseconds.
    4. Ensure timings are synchronized with the audio speech.
  `;

  try {
    const result = await model.generateContent([
      {
          fileData: {
            mimeType: mimeType,
            fileUri: fileUri,
          },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    const text = response.text();
    return JSON.parse(text);
  } catch (error: any) {
    if (error.status === 429 && attempt < 3) {
      const delayMatch = error.message.match(/retry in ([\d.]+)s/);
      const delaySeconds = delayMatch ? parseFloat(delayMatch[1]) : 10 * attempt;
      
      console.log(`Rate limited (429). Retrying in ${delaySeconds}s (Attempt ${attempt}/3)...`);
      await new Promise(resolve => setTimeout(resolve, Math.min(delaySeconds * 1000, 60000)));
      return generateSubtitles(fileUri, mimeType, secondaryLanguage, attempt + 1, modelName);
    }
    throw error;
  }
}

/**
 * Generate subtitles using inline data (for files < 9.8MB)
 * Avoids Files API overhead for small files
 */
export async function generateSubtitlesInline(base64Data: string, mimeType: string, secondaryLanguage?: string, attempt = 1, modelName: string = "gemini-2.5-flash") {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: subtitleSchema as any,
    },
  });
  
  const prompt = `
    Generate subtitles for this video in English${secondaryLanguage ? ` and ${secondaryLanguage}` : ""}.
    
    CRITICAL TIMESTAMP RULES:
    1. Format MUST be exactly "HH:MM:SS,mmm" (Hours:Minutes:Seconds,Milliseconds).
    2. ALWAYS include the Hour part, even if it is 00. Example: "00:01:30,500" is CORRECT.
    3. Use a comma (,) for milliseconds.
    4. Ensure timings are synchronized with the audio speech.
  `;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    const text = response.text();
    return JSON.parse(text);
  } catch (error: any) {
    if (error.status === 429 && attempt < 3) {
      const delayMatch = error.message.match(/retry in ([\d.]+)s/);
      const delaySeconds = delayMatch ? parseFloat(delayMatch[1]) : 10 * attempt;
      
      console.log(`Rate limited (429). Retrying in ${delaySeconds}s (Attempt ${attempt}/3)...`);
      await new Promise(resolve => setTimeout(resolve, Math.min(delaySeconds * 1000, 60000)));
      return generateSubtitlesInline(base64Data, mimeType, secondaryLanguage, attempt + 1, modelName);
    }
    throw error;
  }
}