import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import fs from "fs";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
const fileManager = new GoogleAIFileManager(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

export async function uploadToGemini(filePath: string, mimeType: string) {
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName: filePath.split("/").pop(),
  });

  let file = await fileManager.getFile(uploadResult.file.name);
  while (file.state === FileState.PROCESSING) {
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    file = await fileManager.getFile(uploadResult.file.name);
  }

  if (file.state === FileState.FAILED) {
    throw new Error("Video processing failed.");
  }

  return file;
}

export async function generateSubtitles(fileUri: string, mimeType: string, secondaryLanguage?: string, attempt = 1, modelName: string = "gemini-2.5-flash") {
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const prompt = `
    You are an expert subtitle generator.
    Generate subtitles for this video in English${secondaryLanguage ? ` and ${secondaryLanguage}` : ""}.
    
    OUTPUT FORMAT:
    You must output a strictly valid JSON array of objects. 
    Do NOT output Markdown code blocks (like \`\`\`json).
    Do NOT output any introductory text or explanations.
    Just the raw JSON array.
    
    JSON Structure:
    [
      { 
        "startTime": "00:00:01,000", 
        "endTime": "00:00:04,000", 
        "text": "English text", 
        "secondaryText": "Secondary language text" 
      }
    ]

    CRITICAL TIMESTAMP RULES:
    1. Format MUST be exactly "HH:MM:SS,mmm" (Hours:Minutes:Seconds,Milliseconds).
    2. ALWAYS include the Hour part, even if it is 00. Example: "00:01:30,500" is CORRECT. "01:30,500" is WRONG.
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
    let text = response.text();
    
    // Cleanup potential markdown formatting if model ignores "No Markdown" instruction
    text = text.replace(/```json\s*|\s*```/g, "").trim();
    
    // Try to parse JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error("Failed to parse subtitles from Gemini response: " + text);
  } catch (error: any) {
    if (error.status === 429 && attempt < 3) {
      // Look for retry delay in error details
      const delayMatch = error.message.match(/retry in ([\d.]+)s/);
      const delaySeconds = delayMatch ? parseFloat(delayMatch[1]) : 10 * attempt;
      
      console.log(`Rate limited (429). Retrying in ${delaySeconds}s (Attempt ${attempt}/3)...`);
      await new Promise(resolve => setTimeout(resolve, Math.min(delaySeconds * 1000, 60000)));
      return generateSubtitles(fileUri, mimeType, secondaryLanguage, attempt + 1, modelName);
    }
    throw error;
  }
}
