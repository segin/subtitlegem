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

export async function generateSubtitles(fileUri: string, mimeType: string, secondaryLanguage?: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const prompt = `
    Generate subtitles for this video in English${secondaryLanguage ? ` and ${secondaryLanguage}` : ""}.
    Return the result strictly in SRT format. 
    If a secondary language is requested, provide it as a separate SRT or combined if possible, 
    but for this tool, please return a JSON array of objects with the following structure:
    [{ "startTime": "00:00:01,000", "endTime": "00:00:04,000", "text": "English text", "secondaryText": "Secondary language text" }]
    Ensure the timings are accurate.
  `;

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
  
  // Try to parse JSON from the response
  const jsonMatch = text.match(/\[.*\]/s);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error("Failed to parse subtitles from Gemini response: " + text);
}
