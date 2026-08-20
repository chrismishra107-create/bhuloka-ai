import React, { useEffect, useRef, useState } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
  useVideoConfig,
  delayRender,
  continueRender,
} from 'remotion';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GeneratedTimeline, CameraKeyframe } from './backend/generateTimeline';
import worldData from './world.json';
import indiaData from './india.json';

export const MapAnimation: React.FC<{ timeline: GeneratedTimeline }> = ({ timeline }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [initialHandle] = useState(() => delayRender('Booting Cinematic Map...'));

  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const fallbackKeyframes: CameraKeyframe[] = [
    { frame: 0, lng: 79, lat: 22, zoom: 4.2, pitch: 15 },
    { frame: 300, lng: 88, lat: 31, zoom: 5.5, pitch: 40 }
  ];

  const rawKeyframes = timeline?.cameraKeyframes || [];
  const validKeyframes = rawKeyframes.filter(
    (k) => k && typeof k.frame === 'number' && typeof k.lng === 'number' && typeof k.lat === 'number'
  );
  
  const keyframes = validKeyframes.length > 1 ? validKeyframes : fallbackKeyframes;
  const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);

  const frameIndices = sortedKeyframes.map((k) => k.frame);
  const lngs = sortedKeyframes.map((k) => k.lng);
  const lats = sortedKeyframes.map((k) => k.lat);
  const zooms = sortedKeyframes.map((k) => k.zoom);
  const pitches = sortedKeyframes.map((k) => k.pitch);

  const milkyEasing = Easing.bezier(0.42, 0, 0.58, 1);

  const currentLng = interpolate(frame, frameIndices, lngs, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: milkyEasing });
  const currentLat = interpolate(frame, frameIndices, lats, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: milkyEasing });
  const currentZoom = interpolate(frame, frameIndices, zooms, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: milkyEasing });
  const currentPitch = interpolate(frame, frameIndices, pitches, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: milkyEasing });

  useEffect(() => {
    if (!mapContainer.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      fadeDuration: 0,
      maxTileCacheSize: 10000,
      style: {
        version: 8,
        sources: {
          satellite: { 
            type: 'raster', 
            tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], 
            tileSize: 256 
          },
        },
        layers: [
          {
            id: 'sat-layer',
            type: 'raster',
            source: 'satellite',
            paint: {
              'raster-saturation': -1.0, 
              'raster-contrast': 0.25,
              'raster-brightness-max': 0.85,
              'raster-brightness-min': 0.10,
            },
          },
        ],
      },
      center: [lngs[0], lats[0]],
      zoom: zooms[0],
      pitch: pitches[0],
      interactive: false,
      attributionControl: false,
    });

    map.on('load', () => {
      mapRef.current = map;
      setMapLoaded(true);
      continueRender(initialHandle);
    });

    return () => map.remove();
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    mapRef.current.jumpTo({ center: [currentLng, currentLat], zoom: currentZoom, pitch: currentPitch });
  }, [currentLng, currentLat, currentZoom, currentPitch, mapLoaded]);

  const getCountrySvgPath = (countryName: string) => {
    if (!mapRef.current || !mapLoaded) return '';
    const norm = countryName.trim().toLowerCase();
    let geom: any = null;

    if (norm === 'india' && (indiaData as any).features) {
      geom = (indiaData as any).features[0].geometry || (indiaData as any).features[0];
    } else {
      const features = (worldData as any).features || [];
      const matched = features.find((f: any) => {
        const p = f.properties || {};
        const candidates = [p.ADMIN, p.admin, p.NAME, p.name, p.SOVEREIGNT, p.ISO_A3].filter(Boolean).map((v) => String(v).toLowerCase());
        return candidates.some((c) => c === norm || c.includes(norm) || norm.includes(c));
      });
      if (matched) geom = matched.geometry;
    }

    if (!geom) return '';
    const rings: [number, number][][] = [];
    if (geom.type === 'Polygon') geom.coordinates.forEach((r: any) => rings.push(r));
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((poly: any) => poly.forEach((r: any) => rings.push(r)));

    const map = mapRef.current;
    const valid = rings.map((ring) => {
      const points = ring.map((coord: [number, number]) => {
        const p = map.project(coord);
        if (!p || isNaN(p.x) || isNaN(p.y) || p.y < -2000 || p.y > height + 2000) return null;
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).filter(Boolean);
      if (points.length < 3) return '';
      return `M ${points.join(' L ')} Z`;
    }).filter(Boolean);

    return valid.join(' ');
  };

  const getFlickerOpacity = (startF: number, isPrimary: boolean) => {
    const elapsed = frame - startF;
    if (elapsed < 0) return 0;
    if (elapsed > 15) return isPrimary ? 0.95 : 0.85;
    const strobeMap: Record<number, number> = { 0:0, 1:1, 2:0, 3:1, 4:0, 5:0, 6:1, 7:1, 8:0, 9:1, 10:0, 11:1, 12:1, 13:1, 14:1, 15:1 };
    return strobeMap[elapsed] ?? 1;
  };

  const countries = timeline.highlightCountries || [];
  const blasts = timeline.blasts || [];

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      <div ref={mapContainer} style={{ width: `${width}px`, height: `${height}px`, position: 'absolute', top: 0, left: 0 }} />

      {mapLoaded && (
        <>
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'multiply', zIndex: 40 }}>
            {countries.map((country, idx) => {
              const isPrimary = country.isPrimary === true || country.name.toLowerCase() === 'india';
              if (isPrimary || frame < country.startFrame) return null;
              const pathData = getCountrySvgPath(country.name);
              if (!pathData) return null;
              return <path key={`multiply-${idx}`} d={pathData} fill={country.color || '#dc2626'} opacity={getFlickerOpacity(country.startFrame, false)} />;
            })}
          </svg>

          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}>
            {countries.map((country, idx) => {
              const isPrimary = country.isPrimary === true || country.name.toLowerCase() === 'india';
              if (!isPrimary || frame < country.startFrame) return null;
              const pathData = getCountrySvgPath(country.name);
              if (!pathData) return null;
              return <path key={`solid-${idx}`} d={pathData} fill={country.color || '#f59e0b'} opacity={getFlickerOpacity(country.startFrame, true)} />;
            })}
          </svg>

          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 60, shapeRendering: 'geometricPrecision' }}>
            <defs>
              <filter id="heavy-drop-shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000000" floodOpacity="0.85" />
              </filter>
            </defs>

            {countries.map((country, idx) => {
              if (frame < country.startFrame) return null;
              const pathData = getCountrySvgPath(country.name);
              if (!pathData) return null;
              const trimOffset = interpolate(frame - country.startFrame, [0, 18], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: milkyEasing });
              return <path key={`outline-${idx}`} d={pathData} fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength="100" strokeDasharray="100" strokeDashoffset={trimOffset} filter="url(#heavy-drop-shadow)" />;
            })}

            {timeline.arrows?.map((arrow, idx) => {
              if (frame < arrow.frame || !arrow.origin || !arrow.target) return null;
              const p1 = mapRef.current?.project(arrow.origin as [number, number]);
              const p2 = mapRef.current?.project(arrow.target as [number, number]);
              if (!p1 || !p2 || isNaN(p1.x) || isNaN(p2.x)) return null;

              const dx = p2.x - p1.x; const dy = p2.y - p1.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 1) return null; 

              const nx = -dy / dist; const ny = dx / dist;
              const arcHeight = dist * 0.35; 
              const midX = (p1.x + p2.x) / 2 + (nx * arcHeight);
              const midY = (p1.y + p2.y) / 2 + (ny * arcHeight);
              const pathD = `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`;

              const t = interpolate(frame - arrow.frame, [0, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: milkyEasing });
              const headX = Math.pow(1 - t, 2) * p1.x + 2 * (1 - t) * t * midX + Math.pow(t, 2) * p2.x;
              const headY = Math.pow(1 - t, 2) * p1.y + 2 * (1 - t) * t * midY + Math.pow(t, 2) * p2.y;
              const tanDx = 2 * (1 - t) * (midX - p1.x) + 2 * t * (p2.x - midX);
              const tanDy = 2 * (1 - t) * (midY - p1.y) + 2 * t * (p2.y - midY);
              const angle = Math.atan2(tanDy, tanDx) * (180 / Math.PI);

              return (
                <g key={`arrow-${idx}`} filter="url(#heavy-drop-shadow)">
                  <path d={pathD} fill="none" stroke={arrow.color || '#ff4500'} strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - (t * 100)} />
                  {t > 0.05 && <polygon points="-8,-12 16,0 -8,12" fill={arrow.color || '#ff4500'} transform={`translate(${headX}, ${headY}) rotate(${angle})`} />}
                </g>
              );
            })}

            {blasts?.map((blast, idx) => {
              if (frame < blast.frame) return null;
              const elapsed = frame - blast.frame;
              if (elapsed > 30) return null;
              const pt = mapRef.current?.project(blast.coordinates as [number, number]);
              if (!pt || isNaN(pt.x) || isNaN(pt.y)) return null;

              const radius = interpolate(elapsed, [0, 30], [5, 80], { extrapolateRight: 'clamp' });
              const opacity = interpolate(elapsed, [0, 20, 30], [1, 0.8, 0], { extrapolateRight: 'clamp' });

              return (
                <g key={`blast-${idx}`} transform={`translate(${pt.x}, ${pt.y})`}>
                  <circle cx="0" cy="0" r={radius} fill="none" stroke={blast.color || '#ffaa00'} strokeWidth="3" opacity={opacity} />
                  <circle cx="0" cy="0" r={radius * 0.5} fill="none" stroke="#ffffff" strokeWidth="2" opacity={opacity * 0.8} />
                  <circle cx="0" cy="0" r={Math.max(2, 12 - elapsed * 0.4)} fill="#ffff00" opacity={opacity} />
                </g>
              );
            })}
          </svg>
        </>
      )}
    </AbsoluteFill>
  );
};