import { GeneratedTimeline } from './backend/generateTimeline';

export const sampleScriptData: GeneratedTimeline = {
  title: 'Strait of Hormuz Conflict Escalation',
  totalFrames: 180,
  cameraStart: {
    lng: 54.0,
    lat: 25.5,
    zoom: 5.5,
    pitch: 45,
  },
  cameraEnd: {
    lng: 57.5,
    lat: 26.2,
    zoom: 6.8,
    pitch: 55,
  },
  highlightCountry: {
    name: 'iran',
    startFrame: 20,
    color: '#ef4444',
  },
  headlineCard: {
    title: 'NAVAL ESCALATION DETECTED',
    subtitle: 'Strategic Chokepoint Interception',
    frame: 30,
    color: '#ef4444',
  },
  events: [
    {
      frame: 35,
      name: 'Strait of Hormuz',
      coordinates: [56.45, 26.56],
      color: '#ef4444',
    },
    {
      frame: 75,
      name: 'Gulf of Oman Patrol',
      coordinates: [58.5, 24.5],
      color: '#06b6d4',
    },
    {
      frame: 110,
      name: 'Bandar Abbas Naval Base',
      coordinates: [56.27, 27.18],
      color: '#f59e0b',
    },
  ],
};