import { GoogleGenAI, FileState } from "@google/genai";
import fs from "fs";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
});

const subtitleSchema = {
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
        description: "English subtitle text",
      },
      secondaryText: {
        type: "STRING",
        description: "Secondary language subtitle text",
      },
    },
    required: ["startTime", "endTime", "text"],
  },
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
    Generate subtitles for this video in English${secondaryLanguage ? ` and ${secondaryLanguage}` : ""}.
    
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
    return JSON.parse(text);
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
    Generate subtitles for this video in English${secondaryLanguage ? ` and ${secondaryLanguage}` : ""}.
    
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
    return JSON.parse(text);
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