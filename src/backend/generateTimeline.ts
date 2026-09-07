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
  revealStyle: 'flicker' | 'ink' | 'fade' | 'trim';
  blendMode?: string;
  enableGlow?: boolean;
}

export interface TakeoverEvent {
  invader: string;
  target: string;
  startFrame: number;
  duration: number;
  color: string;
  origin?: [number, number];
}

export interface ArrowEvent {
  id: string;
  type: 'arrow' | 'missile';
  sourceName?: string;
  targetName?: string;
  origin?: [number, number];
  target?: [number, number];
  startFrame: number;
  duration: number;
  color: string;
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
  arrows?: ArrowEvent[];
  labels?: LabelEvent[];
}

function getDynamicCountryCenter(countryName: string): [number, number] {
  try {
    const worldPath = path.resolve(__dirname, '..', 'world.json');
    if (fs.existsSync(worldPath)) {
      const data = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
      const norm = countryName.toLowerCase();
      
      const feature = data.features.find((f: any) => {
        const p = f.properties || {};
        const candidates = [p.ADMIN, p.admin, p.NAME, p.name].filter(Boolean).map(v => String(v).toLowerCase());
        return candidates.some(c => c === norm || c.includes(norm) || norm.includes(c));
      });

      if (feature && feature.geometry && feature.geometry.coordinates) {
        let coords = feature.geometry.coordinates;
        if (feature.geometry.type === 'MultiPolygon') coords = coords[0];
        
        const ring = coords[0];
        if (ring && Array.isArray(ring)) {
          let sumLng = 0, sumLat = 0;
          ring.forEach((pt: [number, number]) => { sumLng += pt[0]; sumLat += pt[1]; });
          return [sumLng / ring.length, sumLat / ring.length];
        }
      }
    }
  } catch (e) {
    console.error('[Geocoding] Failed to dynamically calculate center:', e);
  }
  return [0, 0]; 
}

export async function parseSrtWithGemini(inputContent: string): Promise<GeneratedTimeline> {
  const promptLower = inputContent.toLowerCase().trim();

  const attackMatch = promptLower.match(/(.+?)\s+(?:invades|invading|attacks|attacking|captures|annexes|strikes)\s+(.+)/i);
  
  if (attackMatch) {
    console.log('\n[FAST PARSER] Detected standard conflict prompt. Bypassing AI compute.');
    const invader = attackMatch[1].trim();
    const target = attackMatch[2].replace(/but.*$/i, '').trim();
    const [centerLng, centerLat] = getDynamicCountryCenter(target);

    return {
      title: `${invader} Tactical Offensive on ${target}`,
      totalFrames: 300,
      cameraKeyframes: [
        { frame: 0, lng: centerLng, lat: centerLat - 5, zoom: 2.5, pitch: 10 },
        { frame: 300, lng: centerLng, lat: centerLat, zoom: 4.8, pitch: 45 }
      ],
      highlightCountries: [
        { name: invader, startFrame: 0, color: "#ef4444", isPrimary: true, revealStyle: "ink", blendMode: "screen", enableGlow: true },
        { name: target, startFrame: 0, color: "#3b82f6", isPrimary: false, revealStyle: "fade", blendMode: "screen", enableGlow: true }
      ],
      takeovers: [
        { invader: invader, target: target, startFrame: 45, duration: 180, color: "#ef4444", origin: [centerLng, centerLat] }
      ],
      arrows: [],
      labels: [{ text: "Conflict Zone", lat: centerLat, lng: centerLng, startFrame: 30, duration: 250, glow: true, pinned: true }]
    };
  }

  console.log(`\n[Gemini AI] Orchestrating cinematic sequence...`);

  const prompt = `
You are the lead motion graphics director for a high-end geopolitical short-form content channel. 
Convert this narrative into a precise 300-frame (10-second) cinematic timeline: "${inputContent}"

CRITICAL DIRECTIVES:
1. THE CAMERA ENGINE: Simulate a dynamic 3D camera move. Frame 0 should start wide (zoom 1.5 - 3, pitch 0-15). Frame 300 should push in tightly on the primary action area (zoom 4 - 6, pitch 40-55). Estimate the real-world Geographic Longitude and Latitude for these keyframes.
2. TIMING: Total frames is strictly 300.
3. ENTITIES & RIVERS: Highlight relevant countries, global states, or rivers. 
   - For Countries/States: Set 'revealStyle' to "ink" or "fade".
   - For Rivers (e.g., "Nile River", "Ganges"): You MUST set 'revealStyle' to "trim". Our dynamic MapLibre engine will automatically intercept the name, fetch the water body GeoJSON, and animate a trim-path stroke along the river centerline.
4. CONFLICT: If the prompt describes war or invasion, completely populate the "takeovers" array. Duration MUST be between 120 and 180.
5. LOGISTICS: For trade routes or troop movements, populate the "arrows" array.
6. TYPOGRAPHY: Drop 1 or 2 "labels" on key capitals or borders. Estimate the lat/lng accurately.
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
                revealStyle: { type: Type.STRING, description: "Use 'ink' or 'fade' for countries, and STRICTLY use 'trim' for rivers." },
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
              },
              required: ['invader', 'target', 'startFrame', 'duration', 'color'],
            },
          },
          arrows: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                sourceName: { type: Type.STRING },
                targetName: { type: Type.STRING },
                startFrame: { type: Type.INTEGER },
                duration: { type: Type.INTEGER },
                color: { type: Type.STRING }
              },
              required: ['type', 'startFrame', 'duration', 'color']
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
              },
              required: ['text', 'lat', 'lng', 'startFrame', 'duration']
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

  const isConflict = promptLower.includes('invade') || promptLower.includes('capture') || promptLower.includes('attack') || promptLower.includes('war');

  if (isConflict && (!timeline.takeovers || timeline.takeovers.length === 0)) {
    console.log("🔥 AI HALLUCINATED EMPTY TAKEOVERS! Hijacking JSON and forcing injection...");
    const words = inputContent.split(' ').map(w => w.trim());
    const attacker = words[0]; 
    const target = words[words.length - 1]; 
    const [centerLng, centerLat] = getDynamicCountryCenter(target);

    timeline.totalFrames = 300; 
    timeline.takeovers = [{
      invader: attacker, target: target, startFrame: 45, duration: 180, color: "#ef4444", origin: [centerLng, centerLat] 
    }];

    timeline.highlightCountries = [
      { name: attacker, startFrame: 0, color: "#ef4444", isPrimary: true, revealStyle: "ink" },
      { name: target, startFrame: 0, color: "#3b82f6", isPrimary: false, revealStyle: "ink" }
    ];
  }

  return timeline;
}