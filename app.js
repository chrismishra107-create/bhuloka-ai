const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));
app.use('/out', express.static(path.join(__dirname, 'out')));

// Force root URL to serve the compiled React Studio HTML directly
app.get('/', (req, res) => {
  const studioPath = path.join(__dirname, 'public', 'studio.html');
  if (fs.existsSync(studioPath)) {
    return res.sendFile(studioPath);
  }
  res.status(404).send('studio.html not found in public folder. Did you run your build?');
});

// Waitlist Route
app.get('/waitlist', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'landing.html');
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('landing.html not found inside public folder.');
  }

  let html = fs.readFileSync(filePath, 'utf8');
  html = html
    .replace('__SUPABASE_URL_PLACEHOLDER__', process.env.SUPABASE_URL || '')
    .replace('__SUPABASE_ANON_KEY_PLACEHOLDER__', process.env.SUPABASE_ANON_KEY || '');

  res.send(html);
});

// Pipeline endpoint for video generation (Full MP4 Render)
app.post('/api/run-pipeline', (req, res) => {
  const { prompt } = req.body;
  console.log(`\n[Studio] Processing Prompt: "${prompt}"`);

  const promptFilePath = path.join(__dirname, 'src', 'currentPrompt.json');
  fs.writeFileSync(promptFilePath, JSON.stringify({ prompt }, null, 2));

  exec(`npx tsx src/testGemini.ts`, (err, stdout, stderr) => {
    if (err) {
      console.error('Generator error:', stderr || err);
      return res.status(500).json({ success: false, error: 'Timeline generation failed' });
    }

    console.log('[Studio] Timeline generated successfully. Encoding MP4 video...');

    const outputFilename = `map-${Date.now()}.mp4`;
    const outputPath = path.join(__dirname, 'out', outputFilename);

    exec(`npx remotion render src/index.ts Map3D "${outputPath}" --concurrency=1`, (renderErr) => {
      if (renderErr) {
        console.error('Remotion render error:', renderErr);
        return res.status(500).json({ success: false, error: 'Video rendering failed' });
      }

      console.log(`[Studio] Video successfully rendered: ${outputFilename}`);
      res.json({ success: true, videoUrl: `/out/${outputFilename}` });
    });
  });
});

// Live Endpoint for the React UI Player
app.post('/api/generate', (req, res) => {
  const { prompt } = req.body;
  console.log(`\n[Live Studio] AI generating timeline for: "${prompt}"`);

  const promptFilePath = path.join(__dirname, 'src', 'currentPrompt.json');
  fs.writeFileSync(promptFilePath, JSON.stringify({ prompt }, null, 2));

  exec(`npx tsx src/testGemini.ts`, (err, stdout, stderr) => {
    if (err) {
      console.error('Gemini error:', stderr || err);
      return res.status(500).json({ error: 'AI Timeline generation failed' });
    }

    console.log('[Live Studio] Timeline JSON generated! Sending to browser player...');

    try {
      const timelinePath = path.join(__dirname, 'src', 'dynamicTimeline.json');
      const timelineData = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
      
      res.json({ timeline: timelineData }); 
    } catch (readErr) {
      console.error('Error reading generated timeline:', readErr);
      res.status(500).json({ error: 'Failed to load timeline data' });
    }
  });
});

app.listen(5000, '0.0.0.0', () => {
  console.log('----------------------------------------------------');
  console.log('🚀 Server active!');
  console.log('   BhuLoka.ai Studio : http://localhost:5000');
  console.log('   Waitlist Page   : http://localhost:5000/waitlist');
  console.log('----------------------------------------------------');
});