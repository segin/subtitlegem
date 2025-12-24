import { GoogleGenerativeAI } from "@google/generative-ai";
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
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    console.log(`Testing model: ${modelName}...`);
    const result = await model.generateContent("Hello, are you there?");
    console.log("Response:", result.response.text());
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
