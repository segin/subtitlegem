import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";

// Load .env.local manually since we are running a standalone script
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function testModel() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("No API KEY found in .env.local");
    process.exit(1);
  }

  console.log("Using API Key:", apiKey.substring(0, 5) + "...");
  
  const ai = new GoogleGenAI({ apiKey });
  const modelName = "gemini-2.5-flash";

  try {
    console.log(`Testing model: ${modelName}...`);
    const result = await ai.models.generateContent({
      model: modelName,
      contents: "Hello, are you there?",
    });
    console.log("Response:", result.text);
    console.log("Model check PASSED.");
  } catch (error: any) {
    console.error("Model check FAILED:");
    console.error(error.message);
    if (error.message.includes("404")) {
      console.error("Hint: The model name might be incorrect.");
    }
  }
}

testModel();
