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
  strokeWidth?: number;
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
  isFlight?: boolean;
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
  style?: string;
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
        if (cont.includes(norm) && name) matches.push(name);
      });
      if (matches.length > 0) return matches;
    }
  } catch (e) { console.error('[Region Engine] Failed to read world.json:', e); }

  if (continentName.toLowerCase().includes('asia')) {
    return [
      "India", "China", "Japan", "South Korea", "North Korea", "Vietnam", "Thailand", 
      "Indonesia", "Philippines", "Malaysia", "Singapore", "Pakistan", "Bangladesh", 
      "Saudi Arabia", "Iran", "Iraq", "Turkey", "Israel", "UAE", "Kazakhstan", "Mongolia"
    ];
  }
  return [];
}

function getStatesForCountry(countryName: string): string[] {
  const norm = countryName.toLowerCase();
  if (norm.includes('china')) {
    return [
      "Beijing", "Shanghai", "Tianjin", "Chongqing", "Guangdong", "Shandong", "Henan", 
      "Sichuan", "Jiangsu", "Hebei", "Hunan", "Anhui", "Hubei", "Zhejiang", "Guangxi", 
      "Yunnan", "Jiangxi", "Liaoning", "Fujian", "Shaanxi", "Guizhou", "Shanxi", 
      "Jilin", "Heilongjiang", "Inner Mongolia", "Xinjiang", "Gansu", "Hainan", 
      "Ningxia", "Qinghai", "Tibet"
    ];
  }
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

function getDistrictsForState(stateQuery: string): string[] {
  try {
    const districtPath = path.resolve(__dirname, '..', 'public', 'india_districts.geojson');
    if (fs.existsSync(districtPath)) {
      const data = JSON.parse(fs.readFileSync(districtPath, 'utf8'));
      const normState = stateQuery.toLowerCase();
      const matches: string[] = [];
      data.features.forEach((f: any) => {
        const p = f.properties || {};
        const s = String(p.STATE || p.state || p.ST_NM || '').toLowerCase();
        const d = p.DISTRICT || p.district || p.DIST || p.name;
        if ((s.includes(normState) || normState.includes('all')) && d && !matches.includes(d)) {
          matches.push(d);
        }
      });
      if (matches.length > 0) return matches;
    }
  } catch (e) { }
  return ["Lucknow", "Kanpur", "Varanasi", "Agra", "Prayagraj", "Meerut", "Noida", "Ghaziabad", "Gorakhpur", "Jhansi"];
}

function getRiversForCountry(countryQuery: string): string[] {
  return ["Ganges", "Brahmaputra", "Yamuna", "Godavari", "Krishna", "Indus", "Narmada", "Mahanadi", "Kaveri", "Tapti"];
}

// MAINLAND OVERRIDES FOR COMPLEX GEOJSON COUNTRIES
function getDynamicCountryCenter(countryName: string): [number, number] {
  const norm = countryName.toLowerCase();
  
  if (norm.includes('france')) return [2.3522, 48.8566]; // Paris
  if (norm.includes('united states') || norm === 'us' || norm === 'usa') return [-98.5795, 39.8283]; // USA Center
  if (norm.includes('united kingdom') || norm === 'uk') return [-3.4359, 55.3781]; // UK Center

  try {
    const worldPath = path.resolve(__dirname, '..', 'world.json');
    if (fs.existsSync(worldPath)) {
      const data = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
      
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
  } catch (e) { }
  return [0, 0]; 
}

export async function parseSrtWithGemini(inputContent: string): Promise<GeneratedTimeline> {
  const promptLower = inputContent.toLowerCase().trim();
  const customColor = extractColor(inputContent);

  if (promptLower.includes('river') || promptLower.includes('rivers')) {
    const rivers = getRiversForCountry(promptLower);
    const totalFrames = Math.max(300, rivers.length * 20);
    const highlightCountries = rivers.map((river, index) => {
      const startFrame = index * 15;
      return {
        name: river,
        startFrame,
        endFrame: startFrame + 60,
        color: customColor,
        isPrimary: false,
        revealStyle: "trim" as const,
        blendMode: "screen",
        enableGlow: true,
        strokeWidth: 4
      };
    });
    return {
      title: "Major Rivers",
      totalFrames,
      cameraKeyframes: [
        { frame: 0, lng: 78.9629, lat: 20.5937, zoom: 4.0, pitch: 20 },
        { frame: totalFrames, lng: 78.9629, lat: 20.5937, zoom: 5.0, pitch: 35 }
      ],
      highlightCountries,
      takeovers: [],
      arrows: [],
      labels: [{ text: "RIVER SYSTEMS", lat: 20.5937, lng: 78.9629, startFrame: 0, duration: totalFrames, glow: true, pinned: true, style: 'geo-pin' }]
    };
  }

  if (promptLower.includes('district') || promptLower.includes('districts')) {
    let targetState = 'uttar pradesh';
    if (promptLower.includes('bihar')) targetState = 'bihar';
    else if (promptLower.includes('karnataka')) targetState = 'karnataka';
    else if (promptLower.includes('maharashtra')) targetState = 'maharashtra';
    else if (promptLower.includes('gujarat')) targetState = 'gujarat';
    else if (promptLower.includes('all')) targetState = 'all';

    const districts = getDistrictsForState(targetState);
    const totalFrames = Math.max(300, districts.length * 12);
    const highlightCountries = districts.map((district, index) => {
      const startFrame = index * 10;
      return {
        name: district,
        startFrame,
        endFrame: startFrame + 35,
        color: customColor,
        isPrimary: false,
        revealStyle: "fade" as const,
        blendMode: "screen",
        enableGlow: true,
        strokeWidth: 1
      };
    });

    return {
      title: `Districts of ${targetState.toUpperCase()}`,
      totalFrames,
      cameraKeyframes: [
        { frame: 0, lng: 78.9629, lat: 20.5937, zoom: 4.2, pitch: 15 },
        { frame: totalFrames, lng: 78.9629, lat: 20.5937, zoom: 5.5, pitch: 40 }
      ],
      highlightCountries,
      takeovers: [],
      arrows: [],
      labels: [{ text: `${targetState.toUpperCase()} DISTRICTS`, lat: 20.5937, lng: 78.9629, startFrame: 0, duration: totalFrames, glow: true, pinned: true, style: 'geo-pin' }]
    };
  }

  if (promptLower.includes('state') || promptLower.includes('union territory') || promptLower.includes('states')) {
    const targetCountry = promptLower.includes('china') ? 'china' : 'india';
    const states = getStatesForCountry(targetCountry);
    const totalFrames = Math.max(600, states.length * 15);
    const highlightCountries = states.map((state, index) => {
      const startFrame = index * 12;
      return {
        name: state,
        startFrame,
        endFrame: startFrame + 40,
        color: customColor,
        isPrimary: false,
        revealStyle: "fade" as const,
        blendMode: "screen",
        enableGlow: true,
        strokeWidth: 2
      };
    });

    const centerLng = targetCountry === 'china' ? 104.1954 : 78.9629;
    const centerLat = targetCountry === 'china' ? 35.8617 : 20.5937;

    return {
      title: `States of ${targetCountry.toUpperCase()}`,
      totalFrames,
      cameraKeyframes: [
        { frame: 0, lng: centerLng, lat: centerLat, zoom: targetCountry === 'china' ? 3.0 : 3.5, pitch: 15 },
        { frame: totalFrames, lng: centerLng, lat: centerLat, zoom: targetCountry === 'china' ? 3.8 : 4.2, pitch: 35 }
      ],
      highlightCountries,
      takeovers: [],
      arrows: [],
      labels: [{ text: `${targetCountry.toUpperCase()} STATES`, lat: centerLat, lng: centerLng, startFrame: 0, duration: totalFrames, glow: true, pinned: true, style: 'geo-pin' }]
    };
  }

  if (promptLower.includes('all countries') || promptLower.includes('countries of') || promptLower.includes('countries in')) {
    let targetContinent = 'asia';
    if (promptLower.includes('europe')) targetContinent = 'europe';
    else if (promptLower.includes('africa')) targetContinent = 'africa';
    else if (promptLower.includes('americas') || promptLower.includes('america')) targetContinent = 'north america';

    const countries = getCountriesByContinent(targetContinent);
    if (countries.length > 0) {
      const totalFrames = Math.max(300, countries.length * 15);
      const highlightCountries = countries.map((country, index) => {
        const startFrame = index * 12;
        return {
          name: country,
          startFrame,
          endFrame: startFrame + 40,
          color: customColor,
          isPrimary: false,
          revealStyle: "fade" as const,
          blendMode: "screen",
          enableGlow: true,
          strokeWidth: 2
        };
      });

      return {
        title: `Countries of ${targetContinent.toUpperCase()}`,
        totalFrames,
        cameraKeyframes: [
          { frame: 0, lng: targetContinent === 'asia' ? 90 : 10, lat: targetContinent === 'asia' ? 30 : 50, zoom: 2.0, pitch: 15 },
          { frame: totalFrames, lng: targetContinent === 'asia' ? 100 : 20, lat: targetContinent === 'asia' ? 25 : 45, zoom: 3.2, pitch: 35 }
        ],
        highlightCountries,
        takeovers: [],
        arrows: [],
        labels: [{ text: `${targetContinent.toUpperCase()} REGION`, lat: 30, lng: 80, startFrame: 0, duration: totalFrames, glow: true, pinned: true, style: 'geo-pin' }]
      };
    }
  }

  const prompt = `
    You are an expert cinematic map animator.
    Convert this narrative into a precise cinematic timeline: "${inputContent}"
    
    INSTRUCTIONS FOR MULTI-STOP TRAVEL ROUTES (e.g., "I travelled from Texas to France to Delhi"):
    1. Set totalFrames to at least 450 to allow time for multiple hops.
    2. Sequentially highlight countries/states using startFrame and endFrame. Set revealStyle to "ink".
    3. Generate Arrows for EVERY flight path (e.g., Texas->France, then France->Delhi). ALWAYS set "isFlight": true for travel arrows.
    4. Keyframe the camera accurately across the globe to follow the journey.
    5. Add Labels for origin, connections, and destination.
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
                pitch: { type: Type.NUMBER } 
              }, 
              required: ['frame', 'lng', 'lat', 'zoom', 'pitch'] 
            } 
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
                revealStyle: { type: Type.STRING } 
              }, 
              required: ['name', 'startFrame', 'endFrame', 'color', 'isPrimary', 'revealStyle'] 
            } 
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
                color: { type: Type.STRING } 
              }, 
              required: ['invader', 'target', 'startFrame', 'duration', 'color'] 
            } 
          },
          arrows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sourceName: { type: Type.STRING },
                targetName: { type: Type.STRING },
                startFrame: { type: Type.INTEGER },
                duration: { type: Type.INTEGER },
                color: { type: Type.STRING },
                isFlight: { type: Type.BOOLEAN }
              },
              required: ['sourceName', 'targetName', 'startFrame', 'duration']
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
          }
        },
        required: ['title', 'totalFrames', 'cameraKeyframes', 'highlightCountries', 'takeovers'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Empty response from Gemini.');
  return JSON.parse(text) as GeneratedTimeline;
}