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

  try {
    console.log("Listing available models...");
    const pager = await ai.models.list();
    for await (const model of pager) {
      const name = model.name || "unknown";
      if (name.includes("gemini-2.5-flash")) {
        console.log(`- ${name}`);
        console.log("Raw Model Keys:", Object.keys(model));
        console.log("Full Object:", JSON.stringify(model, null, 2));
        break;
      }
    }
    
    console.log("\nModel check complete.");
  } catch (error: any) {
    console.error("Model check FAILED:");
    console.error(error.message);
  }
}

testModel();
