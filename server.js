const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve rendered videos statically so the frontend can play them
app.use('/out', express.static(path.join(__dirname, 'out')));

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  console.log(`[AI Engine] Received prompt: "${prompt}"`);

  // Step 1: Run your Gemini generator (Pass prompt via environment variable or update your testGemini file)
  exec(`npx tsx src/testGemini.ts`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Generator Error: ${error}`);
      return res.status(500).json({ error: 'Failed to generate timeline script' });
    }

    console.log('[AI Engine] Timeline generated. Rendering video via Remotion...');

    // Step 2: Render the video automatically using Remotion CLI
    const videoFileName = `map-${Date.now()}.mp4`;
    const outputPath = path.join(__dirname, 'out', videoFileName);

    exec(`npx remotion render src/index.ts Map3D ${outputPath} --concurrency=1`, (renderError) => {
      if (renderError) {
        console.error(`Render Error: ${renderError}`);
        return res.status(500).json({ error: 'Failed to render video' });
      }

      console.log(`[AI Engine] Video rendered successfully: ${videoFileName}`);
      // Return the video URL back to the frontend
      res.json({ success: true, videoUrl: `http://localhost:4000/out/${videoFileName}` });
    });
  });
});

app.listen(4000, () => {
  console.log('🚀 Geopolitical Studio Backend running on http://localhost:4000');
});