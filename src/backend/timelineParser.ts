import { GeneratedTimeline } from './generateTimeline';

export function parsePromptDeterministic(prompt: string): GeneratedTimeline | null {
  const clean = prompt.trim();
  
  // Zero-Cost Regex Matcher for standard conflicts
  const attackMatch = clean.match(/(.+?)\s+(?:invades|attacks|captures|annexes|strikes)\s+(.+)/i);
  
  if (attackMatch) {
    const invader = attackMatch[1].trim();
    const target = attackMatch[2].replace(/but.*$/i, '').trim();

    return {
      title: `${invader} Tactical Offensive on ${target}`,
      totalFrames: 300,
      cameraKeyframes: [
        { frame: 0, lng: 0, lat: 0, zoom: 3.5, pitch: 20 },
        { frame: 300, lng: 0, lat: 0, zoom: 4.8, pitch: 45 }
      ],
      highlightCountries: [
        { name: invader, startFrame: 0, color: "#f59e0b", isPrimary: true, revealStyle: "flicker" },
        { name: target, startFrame: 0, color: "#7f1d1d", isPrimary: false, revealStyle: "flicker" }
      ],
      takeovers: [
        { 
          invader: invader, 
          target: target, 
          startFrame: 45, 
          duration: 180, 
          color: "#dc2626",
          origin: [0, 0] // 🔥 ADDED THIS: Fixes the ts(2741) error
        }
      ],
      blasts: [],
      arrows: []
    };
  }

  return null;
}

export function sanitizeAiTimeline(rawTimeline: any, originalPrompt: string): GeneratedTimeline {
  let safeTimeline = { ...rawTimeline };

  if (!safeTimeline.totalFrames || safeTimeline.totalFrames < 240) {
    safeTimeline.totalFrames = 300;
  }

  if (safeTimeline.takeovers && Array.isArray(safeTimeline.takeovers)) {
    safeTimeline.takeovers.forEach((t: any) => {
      if (!safeTimeline.highlightCountries) safeTimeline.highlightCountries = [];
      
      const hasInvader = safeTimeline.highlightCountries.some((c: any) => c.name.toLowerCase() === t.invader.toLowerCase());
      if (!hasInvader) {
        safeTimeline.highlightCountries.push({
          name: t.invader,
          startFrame: 0,
          color: '#f59e0b',
          isPrimary: true
        });
      }
    });
  }

  return safeTimeline as GeneratedTimeline;
}