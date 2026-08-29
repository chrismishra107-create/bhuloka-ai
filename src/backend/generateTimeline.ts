import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface CameraKeyframe {
  frame: number;
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
}

export interface HighlightCountry {
  name: string;
  startFrame: number;
  endFrame?: number;
  color: string;
  isPrimary: boolean;
  revealStyle: 'flicker' | 'ink';
}

export interface BlastEvent {
  frame: number;
  coordinates: [number, number];
  color: string;
}

export interface TakeoverEvent {
  invader: string;
  target: string;
  startFrame: number;
  duration: number;
  color: string;
  origin: [number, number];
}

export interface LabelEvent {
  text: string;
  lat: number;
  lng: number;
  startFrame: number;
  duration: number;
  color?: string;
  bg?: string;
  size?: number;
  glow?: boolean;
  pinned?: boolean;
}

export interface GeneratedTimeline {
  title: string;
  totalFrames: number;
  cameraKeyframes: CameraKeyframe[];
  highlightCountries: HighlightCountry[];
  takeovers: TakeoverEvent[];
  arrows?: any[];
  blasts?: BlastEvent[];
  labels?: LabelEvent[];
}

// 🌍 NEW: Dynamically finds the center of ANY country on Earth
function getDynamicCountryCenter(countryName: string): [number, number] {
  try {
    const worldPath = path.resolve(__dirname, '..', 'world.json');
    if (fs.existsSync(worldPath)) {
      const data = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
      const norm = countryName.toLowerCase();
      
      const feature = data.features.find((f: any) => {
        const p = f.properties || {};
        const candidates = [p.ADMIN, p.admin, p.NAME, p.name]
          .filter(Boolean)
          .map(v => String(v).toLowerCase());
        return candidates.some(c => c === norm || c.includes(norm) || norm.includes(c));
      });

      if (feature && feature.geometry && feature.geometry.coordinates) {
        let coords = feature.geometry.coordinates;
        if (feature.geometry.type === 'MultiPolygon') coords = coords[0];
        
        const ring = coords[0];
        if (ring && Array.isArray(ring)) {
          let sumLng = 0, sumLat = 0;
          ring.forEach((pt: [number, number]) => { 
            sumLng += pt[0]; 
            sumLat += pt[1]; 
          });
          return [sumLng / ring.length, sumLat / ring.length];
        }
      }
    }
  } catch (e) {
    console.error('[Geocoding] Failed to dynamically calculate center:', e);
  }
  return [0, 0]; // Fallback if data is missing
}

export async function parseSrtWithGemini(inputContent: string): Promise<GeneratedTimeline> {
  const promptLower = inputContent.toLowerCase().trim();

  // ------------------------------------------------------------------------
  // 🚀 TIER 1: ZERO-COST FAST PARSER
  // ------------------------------------------------------------------------
  const attackMatch = promptLower.match(/(.+?)\s+(?:invades|invading|attacks|attacking|captures|annexes|strikes)\s+(.+)/i);
  
  if (attackMatch) {
    console.log('\n[FAST PARSER] Detected standard conflict prompt. Bypassing Gemini (Cost: $0).');
    
    const invader = attackMatch[1].trim();
    const target = attackMatch[2].replace(/but.*$/i, '').trim();

    // Dynamically calculate camera center for ANY country
    const [centerLng, centerLat] = getDynamicCountryCenter(target);

    return {
      title: `${invader} Tactical Offensive on ${target}`,
      totalFrames: 300,
      cameraKeyframes: [
        { frame: 0, lng: centerLng, lat: centerLat - 3, zoom: 4.2, pitch: 25 },
        { frame: 300, lng: centerLng, lat: centerLat, zoom: 5.5, pitch: 45 }
      ],
      highlightCountries: [
        { name: invader, startFrame: 0, color: "#991b1b", isPrimary: true, revealStyle: "flicker" },
        { name: target, startFrame: 0, color: "#1e3a8a", isPrimary: false, revealStyle: "flicker" }
      ],
      takeovers: [
        { 
          invader: invader, 
          target: target, 
          startFrame: 45, 
          duration: 180, 
          color: "#991b1b", 
          origin: [centerLng, centerLat] 
        }
      ],
      blasts: [],
      arrows: [],
      labels: []
    };
  }

  // ------------------------------------------------------------------------
  // 🤖 TIER 2: GEMINI API FALLBACK FOR COMPLEX PROMPTS
  // ------------------------------------------------------------------------
  console.log(`\n[Gemini AI] Complex prompt detected. Sending to Google...`);

  const prompt = `
You are a highly strict geopolitical data generator.
Convert this prompt into a timeline: "${inputContent}"

RULES:
1. "totalFrames" MUST be 300.
2. If the prompt implies war, invasion, or capture, YOU MUST populate the "takeovers" array.
3. The "takeovers" array MUST have "duration": 180.
4. The invader and target MUST both be listed in "highlightCountries".
5. Automatically generate "labels" to tag cities, borders, or regions mentioned. Ensure duration is at least 150.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          totalFrames: { type: Type.INTEGER },
          cameraKeyframes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                frame: { type: Type.INTEGER },
                lng: { type: Type.NUMBER },
                lat: { type: Type.NUMBER },
                zoom: { type: Type.NUMBER },
                pitch: { type: Type.NUMBER },
              },
              required: ['frame', 'lng', 'lat', 'zoom', 'pitch'],
            },
          },
          highlightCountries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                startFrame: { type: Type.INTEGER },
                endFrame: { type: Type.INTEGER },
                color: { type: Type.STRING },
                isPrimary: { type: Type.BOOLEAN },
                revealStyle: { type: Type.STRING },
              },
              required: ['name', 'startFrame', 'color', 'isPrimary', 'revealStyle'],
            },
          },
          takeovers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                invader: { type: Type.STRING },
                target: { type: Type.STRING },
                startFrame: { type: Type.INTEGER },
                duration: { type: Type.INTEGER },
                color: { type: Type.STRING },
                origin: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              },
              required: ['invader', 'target', 'startFrame', 'duration', 'color', 'origin'],
            },
          },
          arrows: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                frame: { type: Type.INTEGER }
              }
            } 
          },
          blasts: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                frame: { type: Type.INTEGER }
              }
            } 
          },
          labels: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER },
                startFrame: { type: Type.INTEGER },
                duration: { type: Type.INTEGER },
                pinned: { type: Type.BOOLEAN }
              }
            } 
          },
        },
        required: ['title', 'totalFrames', 'cameraKeyframes', 'highlightCountries', 'takeovers'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Empty response from Gemini.');

  let timeline = JSON.parse(text) as GeneratedTimeline;

  // 🔥 ULTIMATE JAVASCRIPT CHOKEHOLD 🔥
  const isConflict = promptLower.includes('invade') || promptLower.includes('capture') || promptLower.includes('attack');

  if (isConflict && (!timeline.takeovers || timeline.takeovers.length === 0)) {
    console.log("🔥 AI HALLUCINATED EMPTY TAKEOVERS! Hijacking JSON and forcing injection...");
    
    const words = inputContent.split(' ').map(w => w.trim());
    const attacker = words[0]; 
    const target = words[words.length - 1]; 
    
    const [centerLng, centerLat] = getDynamicCountryCenter(target);

    timeline.totalFrames = 300; 
    timeline.takeovers = [{
      invader: attacker,
      target: target,
      startFrame: 45,
      duration: 180, 
      color: "#991b1b", 
      origin: [centerLng, centerLat] 
    }];

    timeline.highlightCountries = [
      { name: attacker, startFrame: 0, color: "#991b1b", isPrimary: true, revealStyle: "ink" },
      { name: target, startFrame: 0, color: "#1e3a8a", isPrimary: false, revealStyle: "ink" }
    ];
  }

  if (timeline.takeovers && timeline.takeovers.length > 0) {
    timeline.arrows = [];
  }

  return timeline;
}