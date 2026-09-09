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

function extractColor(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('red') || p.includes('crimson')) return '#ef4444';
  if (p.includes('blue') || p.includes('cyan')) return '#3b82f6';
  if (p.includes('green') || p.includes('emerald')) return '#10b981';
  if (p.includes('yellow') || p.includes('gold')) return '#f59e0b';
  if (p.includes('purple') || p.includes('violet')) return '#8b5cf6';
  if (p.includes('orange')) return '#f97316';
  const hexMatch = p.match(/#[0-9a-f]{6}/i);
  if (hexMatch) return hexMatch[0];
  return '#3b82f6';
}

function getCountriesByContinent(continentName: string): string[] {
  try {
    const worldPath = path.resolve(__dirname, '..', 'world.json');
    if (fs.existsSync(worldPath)) {
      const data = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
      const norm = continentName.toLowerCase();
      const matches: string[] = [];
      
      data.features.forEach((f: any) => {
        const p = f.properties || {};
        const cont = String(p.CONTINENT || p.continent || p.REGION || p.region || '').toLowerCase();
        const name = p.ADMIN || p.admin || p.NAME || p.name;
        
        if (cont.includes(norm) && name) {
          matches.push(name);
        }
      });
      if (matches.length > 0) return matches;
    }
  } catch (e) {
    console.error('[Region Engine] Failed to read world.json:', e);
  }

  if (continentName.toLowerCase().includes('asia')) {
    return [
      "India", "China", "Japan", "South Korea", "North Korea", "Vietnam", "Thailand", 
      "Indonesia", "Philippines", "Malaysia", "Singapore", "Pakistan", "Bangladesh", 
      "Saudi Arabia", "Iran", "Iraq", "Turkey", "Israel", "UAE", "Kazakhstan", "Mongolia"
    ];
  }
  return [];
}

function getIndianStatesAndUTs(): string[] {
  return [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", 
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", 
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", 
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", 
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
  ];
}

function getDistrictsForState(stateName: string): string[] {
  try {
    const districtPath = path.resolve(__dirname, '..', 'public', 'india_districts.geojson');
    if (fs.existsSync(districtPath)) {
      const data = JSON.parse(fs.readFileSync(districtPath, 'utf8'));
      const normState = stateName.toLowerCase();
      const matches: string[] = [];
      data.features.forEach((f: any) => {
        const p = f.properties || {};
        const s = String(p.STATE || p.state || p.ST_NM || '').toLowerCase();
        const d = p.DISTRICT || p.district || p.DIST || p.name;
        if (s.includes(normState) && d && !matches.includes(d)) {
          matches.push(d);
        }
      });
      if (matches.length > 0) return matches;
    }
  } catch (e) {
    console.error('[District Engine] Failed to read districts geojson:', e);
  }
  
  const norm = stateName.toLowerCase();
  if (norm.includes('uttar pradesh') || norm.includes('up')) {
    return ["Lucknow", "Kanpur", "Varanasi", "Agra", "Prayagraj", "Meerut", "Noida", "Ghaziabad", "Bareilly", "Aligarh", "Moradabad", "Gorakhpur", "Ayodhya", "Jhansi", "Mathura"];
  }
  if (norm.includes('bihar')) {
    return ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Purnia", "Darbhanga", "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra"];
  }
  if (norm.includes('karnataka')) {
    return ["Bengaluru Urban", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Belagavi", "Kalaburagi", "Davanagere", "Ballari", "Vijayapura", "Shivamogga", "Tumakuru"];
  }
  return ["District 1", "District 2", "District 3", "District 4", "District 5"];
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
  const customColor = extractColor(inputContent);

  if (promptLower.includes('district') || promptLower.includes('districts')) {
    let targetState = 'uttar pradesh';
    if (promptLower.includes('bihar')) targetState = 'bihar';
    else if (promptLower.includes('karnataka')) targetState = 'karnataka';
    else if (promptLower.includes('maharashtra')) targetState = 'maharashtra';
    else if (promptLower.includes('gujarat')) targetState = 'gujarat';

    const districts = getDistrictsForState(targetState);
    console.log(`\n[PROGRAMMATIC ENGINE] Detected districts query for '${targetState}'. Generating ${districts.length} entities via code loop.`);
    
    const totalFrames = Math.max(300, districts.length * 15);
    const highlightCountries = districts.map((district, index) => {
      const startFrame = index * 12;
      return {
        name: district,
        startFrame: startFrame,
        endFrame: startFrame + 40,
        color: customColor,
        isPrimary: false,
        revealStyle: "fade" as const,
        blendMode: "screen",
        enableGlow: true
      };
    });

    return {
      title: `Districts of ${targetState.toUpperCase()}`,
      totalFrames: totalFrames,
      cameraKeyframes: [
        { frame: 0, lng: 78.9629, lat: 20.5937, zoom: 4.0, pitch: 15 },
        { frame: totalFrames, lng: 78.9629, lat: 20.5937, zoom: 5.2, pitch: 35 }
      ],
      highlightCountries,
      takeovers: [],
      arrows: [],
      labels: [{ text: `${targetState.toUpperCase()} DISTRICTS`, lat: 20.5937, lng: 78.9629, startFrame: 0, duration: totalFrames, glow: true, pinned: true }]
    };
  }

  if (promptLower.includes('state') || promptLower.includes('union territory') || promptLower.includes('india states')) {
    const states = getIndianStatesAndUTs();
    console.log(`\n[PROGRAMMATIC ENGINE] Detected India states query. Generating ${states.length} entities via code loop.`);
    
    const totalFrames = Math.max(600, states.length * 15);
    const highlightCountries = states.map((state, index) => {
      const startFrame = index * 12;
      return {
        name: state,
        startFrame: startFrame,
        endFrame: startFrame + 40,
        color: customColor,
        isPrimary: false,
        revealStyle: "fade" as const,
        blendMode: "screen",
        enableGlow: true
      };
    });

    return {
      title: "States and Union Territories of India",
      totalFrames: totalFrames,
      cameraKeyframes: [
        { frame: 0, lng: 78.9629, lat: 20.5937, zoom: 3.5, pitch: 15 },
        { frame: totalFrames, lng: 78.9629, lat: 20.5937, zoom: 4.2, pitch: 35 }
      ],
      highlightCountries,
      takeovers: [],
      arrows: [],
      labels: [{ text: "INDIA STATES & UTS", lat: 20.5937, lng: 78.9629, startFrame: 0, duration: totalFrames, glow: true, pinned: true }]
    };
  }

  if (promptLower.includes('all countries') || promptLower.includes('countries of') || promptLower.includes('countries in')) {
    let targetContinent = 'asia';
    if (promptLower.includes('europe')) targetContinent = 'europe';
    else if (promptLower.includes('africa')) targetContinent = 'africa';
    else if (promptLower.includes('americas') || promptLower.includes('america')) targetContinent = 'north america';

    const countries = getCountriesByContinent(targetContinent);
    if (countries.length > 0) {
      console.log(`\n[PROGRAMMATIC ENGINE] Detected mass-region query for '${targetContinent}'. Generating ${countries.length} entities via code loop.`);
      
      const totalFrames = Math.max(300, countries.length * 15);
      const highlightCountries = countries.map((country, index) => {
        const startFrame = index * 12;
        return {
          name: country,
          startFrame: startFrame,
          endFrame: startFrame + 40,
          color: customColor,
          isPrimary: false,
          revealStyle: "fade" as const,
          blendMode: "screen",
          enableGlow: true
        };
      });

      return {
        title: `Countries of ${targetContinent.toUpperCase()}`,
        totalFrames: totalFrames,
        cameraKeyframes: [
          { frame: 0, lng: targetContinent === 'asia' ? 90 : 10, lat: targetContinent === 'asia' ? 30 : 50, zoom: 2.0, pitch: 15 },
          { frame: totalFrames, lng: targetContinent === 'asia' ? 100 : 20, lat: targetContinent === 'asia' ? 25 : 45, zoom: 3.2, pitch: 35 }
        ],
        highlightCountries,
        takeovers: [],
        arrows: [],
        labels: [{ text: `${targetContinent.toUpperCase()} REGION`, lat: 30, lng: 80, startFrame: 0, duration: totalFrames, glow: true, pinned: true }]
      };
    }
  }

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
        { name: invader, startFrame: 0, endFrame: 300, color: customColor, isPrimary: true, revealStyle: "ink", blendMode: "screen", enableGlow: true },
        { name: target, startFrame: 0, endFrame: 300, color: "#3b82f6", isPrimary: false, revealStyle: "fade", blendMode: "screen", enableGlow: true }
      ],
      takeovers: [
        { invader: invader, target: target, startFrame: 45, duration: 180, color: customColor, origin: [centerLng, centerLat] }
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
1. THE CAMERA ENGINE: Simulate a dynamic 3D camera move. Frame 0 should start wide (zoom 1.5 - 3, pitch 0-15). Frame 300 should push in tightly on the primary action area (zoom 4 - 6, pitch 40-55). 
2. TIMING: Total frames is strictly 300.
3. ENTITIES & REVEALS: Every item in 'highlightCountries' MUST specify a 'revealStyle' ("ink" or "fade" for countries/states, "trim" for rivers) and an explicit 'endFrame' integer so it fades out correctly.
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
              required: ['name', 'startFrame', 'endFrame', 'color', 'isPrimary', 'revealStyle'],
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
  return timeline;
}