import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';

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
}

export interface BlastEvent {
  frame: number;
  coordinates: [number, number];
  color: string;
}

export interface GeneratedTimeline {
  title: string;
  totalFrames: number;
  cameraKeyframes: CameraKeyframe[];
  highlightCountries: HighlightCountry[];
  arrows?: any[];
  blasts?: BlastEvent[];
}

export async function parseSrtWithGemini(srtContent: string): Promise<GeneratedTimeline> {
  const prompt = `
You are a high-velocity YouTube Shorts geopolitical motion graphics director.
Parse this SRT into a 3D map animation (30 fps).

Rules:
1. "totalFrames": Calculate precisely based on the final timestamp of the SRT (Seconds * 30).
2. "highlightCountries": Define actors. Set "isPrimary": true for the main focus, false for others.
3. "cameraKeyframes": Define a smooth continuous flight path matching the timestamps.
4. "blasts": If an attack, missile strike, or explosion occurs in the script, add a "blasts" entry with the target coordinates [lng, lat] and the exact frame it triggers.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: `SRT Subtitles:\n"""\n${srtContent}\n"""\n\n${prompt}`,
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
                frame: { type: Type.INTEGER }, lng: { type: Type.NUMBER }, lat: { type: Type.NUMBER }, zoom: { type: Type.NUMBER }, pitch: { type: Type.NUMBER },
              },
              required: ['frame', 'lng', 'lat', 'zoom', 'pitch'],
            }
          },
          highlightCountries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING }, startFrame: { type: Type.INTEGER }, endFrame: { type: Type.INTEGER }, color: { type: Type.STRING }, isPrimary: { type: Type.BOOLEAN },
              },
              required: ['name', 'startFrame', 'color', 'isPrimary'],
            }
          },
          arrows: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { frame: { type: Type.INTEGER }, origin: { type: Type.ARRAY, items: { type: Type.NUMBER } }, target: { type: Type.ARRAY, items: { type: Type.NUMBER } }, color: { type: Type.STRING } } } },
          blasts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { frame: { type: Type.INTEGER }, coordinates: { type: Type.ARRAY, items: { type: Type.NUMBER } }, color: { type: Type.STRING } } } }
        },
        required: ['title', 'totalFrames', 'cameraKeyframes', 'highlightCountries'],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('Empty response from Gemini.');
  return JSON.parse(text) as GeneratedTimeline;
}