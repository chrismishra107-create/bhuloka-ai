import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { parseSrtWithGemini } from './backend/generateTimeline';

dotenv.config();

async function run() {
  let userPrompt = 'India military operations near Pakistan border';
  const promptFilePath = path.join(__dirname, 'currentPrompt.json');

  if (fs.existsSync(promptFilePath)) {
    try {
      const promptData = JSON.parse(fs.readFileSync(promptFilePath, 'utf-8'));
      if (promptData.prompt) {
        userPrompt = promptData.prompt;
      }
    } catch (err) {
      console.error('[Gemini AI] Error reading currentPrompt.json:', err);
    }
  }

  console.log(`[Gemini AI] Generating timeline for prompt: "${userPrompt}"`);

  try {
    // THIS IS THE CRITICAL LINE: It calls our bulletproof prompt
    const parsedTimeline = await parseSrtWithGemini(userPrompt);

    const outputPath = path.join(__dirname, 'dynamicTimeline.json');
    fs.writeFileSync(outputPath, JSON.stringify(parsedTimeline, null, 2));
    console.log('[Gemini AI] Dynamic timeline saved successfully!');
  } catch (error) {
    console.error('[Gemini AI] Error generating timeline:', error);
    process.exitCode = 1;
  }
}

run();