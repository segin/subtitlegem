import { GoogleGenAI, FileState, HarmCategory, HarmBlockThreshold } from "@google/genai";
import fs from "fs";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
});

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const subtitleSchema = {
  type: "OBJECT",
  properties: {
    detectedLanguage: {
      type: "STRING",
      description: "The primary language detected in the video audio (e.g. 'English', 'Spanish', 'Japanese').",
    },
    subtitles: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          startTime: {
            type: "STRING",
            description: "Timestamp in HH:MM:SS,mmm format",
          },
          endTime: {
            type: "STRING",
            description: "Timestamp in HH:MM:SS,mmm format",
          },
          text: {
            type: "STRING",
            description: "Primary language subtitle text (transcribed)",
          },
          secondaryText: {
            type: "STRING",
            description: "Secondary language translation (if requested)",
          },
        },
        required: ["startTime", "endTime", "text"],
      },
    },
  },
  required: ["detectedLanguage", "subtitles"],
};

// Helper to strip markdown code blocks from JSON response
function cleanJsonOutput(text: string): string {
  // Remove markdown code blocks (```json ... ``` or just ``` ... ```)
  let clean = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1');
  // Remove any leading/trailing whitespace
  return clean.trim();
}

const translationSchema = {
  type: "OBJECT",
  properties: {
    subtitles: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          startTime: { type: "STRING" },
          endTime: { type: "STRING" },
          text: { type: "STRING" },
          secondaryText: { type: "STRING" },
        },
        required: ["startTime", "endTime", "text", "secondaryText"],
      },
    },
  },
  required: ["subtitles"],
};

export async function uploadToGemini(filePath: string, mimeType: string) {
  // Upload file using new SDK
  const uploadResult = await ai.files.upload({
    file: filePath,
    config: {
      mimeType,
      displayName: filePath.split("/").pop(),
    },
  });

  const fileName = uploadResult.name!;
  let file = await ai.files.get({ name: fileName });
  let retryCount = 0;
  const maxRetries = 5;

  // Wait for file to be processed
  while (file.state === FileState.PROCESSING) {
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 10_000));

    // Retry with exponential backoff on transient errors
    try {
      file = await ai.files.get({ name: fileName });
      retryCount = 0; // Reset on success
    } catch (error: any) {
      retryCount++;
      console.error(
        `\n[Gemini] File status poll failed (attempt ${retryCount}/${maxRetries}):`,
        error.message
      );

      if (retryCount >= maxRetries) {
        throw new Error(
          `Failed to get file status after ${maxRetries} attempts: ${error.message}`
        );
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

export async function generateSubtitles(
  fileUri: string,
  mimeType: string,
  secondaryLanguage?: string,
  attempt = 1,
  modelName: string = "gemini-2.5-flash"
) {
  const prompt = `
    Analyze the audio in this video.
    1. Detect the primary spoken language.
    2. Generate subtitles in that detected primary language.
    ${secondaryLanguage ? `3. Also provide a translation in ${secondaryLanguage} for the 'secondaryText' field. If the detected primary language is already ${secondaryLanguage}, simply copy the primary text into 'secondaryText'.` : ""}
    
    CRITICAL TIMESTAMP RULES:
    1. Format MUST be exactly "HH:MM:SS,mmm" (Hours:Minutes:Seconds,Milliseconds).
    2. ALWAYS include the Hour part, even if it is 00. Example: "00:01:30,500" is CORRECT.
    3. Use a comma (,) for milliseconds.
    4. Ensure timings are synchronized with the audio speech.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                mimeType: mimeType,
                fileUri: fileUri,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: subtitleSchema as any,
      },
    });

    const text = response.text!;
    return JSON.parse(cleanJsonOutput(text));
  } catch (error: any) {
    if (error.status === 429 && attempt < 3) {
      const delayMatch = error.message.match(/retry in ([\d.]+)s/);
      const delaySeconds = delayMatch ? parseFloat(delayMatch[1]) : 10 * attempt;

      console.log(
        `Rate limited (429). Retrying in ${delaySeconds}s (Attempt ${attempt}/3)...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(delaySeconds * 1000, 60000))
      );
      return generateSubtitles(
        fileUri,
        mimeType,
        secondaryLanguage,
        attempt + 1,
        modelName
      );
    }
    throw error;
  }
}

/**
 * Generate subtitles using inline data (for files < 9.8MB)
 * Avoids Files API overhead for small files
 */
export async function generateSubtitlesInline(
  base64Data: string,
  mimeType: string,
  secondaryLanguage?: string,
  attempt = 1,
  modelName: string = "gemini-2.5-flash"
) {
  const prompt = `
    Analyze the audio in this video.
    1. Detect the primary spoken language.
    2. Generate subtitles in that detected primary language.
    ${secondaryLanguage ? `3. Also provide a translation in ${secondaryLanguage} for the 'secondaryText' field. If the detected primary language is already ${secondaryLanguage}, simply copy the primary text into 'secondaryText'.` : ""}
    
    CRITICAL TIMESTAMP RULES:
    1. Format MUST be exactly "HH:MM:SS,mmm" (Hours:Minutes:Seconds,Milliseconds).
    2. ALWAYS include the Hour part, even if it is 00. Example: "00:01:30,500" is CORRECT.
    3. Use a comma (,) for milliseconds.
    4. Ensure timings are synchronized with the audio speech.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: subtitleSchema as any,
      },
    });

    const text = response.text!;
    return JSON.parse(cleanJsonOutput(text));
  } catch (error: any) {
    if (error.status === 429 && attempt < 3) {
      const delayMatch = error.message.match(/retry in ([\d.]+)s/);
      const delaySeconds = delayMatch ? parseFloat(delayMatch[1]) : 10 * attempt;

      console.log(
        `Rate limited (429). Retrying in ${delaySeconds}s (Attempt ${attempt}/3)...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(delaySeconds * 1000, 60000))
      );
      return generateSubtitlesInline(
        base64Data,
        mimeType,
        secondaryLanguage,
        attempt + 1,
        modelName
      );
    }
    throw error;
  }
}

export async function translateSubtitles(
  subtitles: any[],
  targetLanguage: string,
  modelName: string = "gemini-2.5-flash"
) {
  const prompt = `
    You are an expert translator.
    Translate the 'text' field of the following JSON subtitles into ${targetLanguage}.
    Put the translated text into the 'secondaryText' field.
    
    Rules:
    1. PRESERVE 'startTime' and 'endTime' EXACTLY.
    2. PRESERVE the number of objects and their order.
    3. Output JSON object with a 'subtitles' array.
    
    Input JSON:
    ${JSON.stringify(subtitles)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: translationSchema as any,
        safetySettings,
      },
    });

    const text = response.text!;
    const result = JSON.parse(cleanJsonOutput(text));
    
    if (result.subtitles) return result.subtitles;
    // Fallback if schema wasn't fully respected (unlikely with responseSchema)
    if (Array.isArray(result)) return result;
    return result; 
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
}