import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  // Read the user prompt from the shared JSON file
  let userPrompt = "India military operations near Pakistan border";
  const promptFilePath = path.join(__dirname, 'currentPrompt.json');
  
  if (fs.existsSync(promptFilePath)) {
    const promptData = JSON.parse(fs.readFileSync(promptFilePath, 'utf-8'));
    if (promptData.prompt) {
      userPrompt = promptData.prompt;
    }
  }

  console.log(`[Gemini AI] Generating timeline for prompt: "${userPrompt}"`);

  const systemInstruction = `
You are a professional geopolitical video editor and mapping expert. 
Given a user's prompt, generate a cinematic timeline script for a 3D Map animation in JSON format.

You must return ONLY valid JSON matching this exact TypeScript interface structure, with no markdown code blocks or extra text:
{
  "totalFrames": 300,
  "cameraKeyframes": [
    { "frame": 0, "lng": 77.2, "lat": 28.6, "zoom": 4.5, "pitch": 20 },
    { "frame": 300, "lng": 73.05, "lat": 33.68, "zoom": 5.8, "pitch": 45 }
  ],
  "highlightCountries": [
    { "name": "India", "color": "#f59e0b", "startFrame": 0, "isPrimary": true },
    { "name": "Pakistan", "color": "#dc2626", "startFrame": 30, "isPrimary": false }
  ],
  "arrows": [
    { "origin": [77.2, 28.6], "target": [73.05, 33.68], "frame": 60, "color": "#ff4500" }
  ],
  "blasts": [
    { "coordinates": [73.05, 33.68], "frame": 120, "color": "#ffaa00" }
  ]
}
Make sure coordinates (lng, lat) accurately match the geography of the countries mentioned in the prompt.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `User Prompt: ${userPrompt}` }] }
      ],
      config: {
        systemInstruction,
        temperature: 0.2,
      }
    });

    let rawText = response.text ? response.text.trim() : '';
    rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    const parsedTimeline = JSON.parse(rawText);
    
    const outputPath = path.join(__dirname, 'dynamicTimeline.json');
    fs.writeFileSync(outputPath, JSON.stringify(parsedTimeline, null, 2));
    console.log('[Gemini AI] Dynamic timeline saved successfully!');
  } catch (error) {
    console.error('[Gemini AI] Error generating timeline:', error);
    process.exit(1);
  }
}

run();