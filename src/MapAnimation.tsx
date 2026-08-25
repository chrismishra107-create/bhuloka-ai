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

export const MapAnimation: React.FC<{ 
  timeline: GeneratedTimeline;
  isLiveEditMode?: boolean;
}> = ({ timeline }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [initialHandle] = useState(() => delayRender('Booting God-Tier Map Engine...'));
  
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const totalFrames = timeline?.totalFrames || 300;

  const rawKeyframes = timeline?.cameraKeyframes || [];
  const validKeyframes = rawKeyframes.filter(
    (k) => k && typeof k.frame === 'number' && typeof k.lng === 'number' && typeof k.lat === 'number'
  );

  const fallbackKeyframes: CameraKeyframe[] = [
    { frame: 0, lng: 79, lat: 22, zoom: 4.2, pitch: 15 },
    { frame: totalFrames, lng: 88, lat: 31, zoom: 5.5, pitch: 40 },
  ];

  const keyframes = validKeyframes.length > 1 ? validKeyframes : fallbackKeyframes;
  
  const strictlySortedKeyframes: any[] = [];
  let lastFrame = -1;
  [...keyframes].sort((a, b) => a.frame - b.frame).forEach(kf => {
     if (kf.frame > lastFrame) { strictlySortedKeyframes.push(kf); lastFrame = kf.frame; }
  });

  const frameIndices = strictlySortedKeyframes.map((k) => k.frame);
  const lngs = strictlySortedKeyframes.map((k) => k.lng);
  const lats = strictlySortedKeyframes.map((k) => k.lat);
  const zooms = strictlySortedKeyframes.map((k) => k.zoom);
  const pitches = strictlySortedKeyframes.map((k) => k.pitch || 0);
  const bearings = strictlySortedKeyframes.map((k: any) => k.bearing || 0);

  const kineticEasing = Easing.bezier(0.16, 1, 0.3, 1);

  const safeIndices = frameIndices.length > 1 ? frameIndices : [0, 9999];
  const safeLngs = frameIndices.length > 1 ? lngs : [lngs[0], lngs[0]];
  const safeLats = frameIndices.length > 1 ? lats : [lats[0], lats[0]];
  const safeZooms = frameIndices.length > 1 ? zooms : [zooms[0], zooms[0]];
  const safePitches = frameIndices.length > 1 ? pitches : [pitches[0], pitches[0]];
  const safeBearings = frameIndices.length > 1 ? bearings : [bearings[0], bearings[0]];

  const currentLng = interpolate(frame, safeIndices, safeLngs, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: kineticEasing });
  const currentLat = interpolate(frame, safeIndices, safeLats, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: kineticEasing });
  const currentZoom = interpolate(frame, safeIndices, safeZooms, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: kineticEasing });
  const currentPitch = interpolate(frame, safeIndices, safePitches, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: kineticEasing });
  const currentBearing = interpolate(frame, safeIndices, safeBearings, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: kineticEasing });

  useEffect(() => {
    if (!mapContainer.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current, fadeDuration: 0, maxTileCacheSize: 10000,
      style: {
        version: 8,
        sources: { satellite: { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256 } },
        layers: [{ id: 'sat-layer', type: 'raster', source: 'satellite', paint: { 'raster-saturation': -0.85, 'raster-contrast': 0.25, 'raster-brightness-max': 0.8, 'raster-brightness-min': 0.15 } }],
      },
      center: [safeLngs[0], safeLats[0]], zoom: safeZooms[0], pitch: safePitches[0], bearing: safeBearings[0], interactive: false, attributionControl: false,
    });

    map.on('load', () => { mapRef.current = map; setMapLoaded(true); continueRender(initialHandle); });
    return () => map.remove();
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    mapRef.current.jumpTo({ center: [currentLng, currentLat], zoom: currentZoom, pitch: currentPitch, bearing: currentBearing });
  }, [currentLng, currentLat, currentZoom, currentPitch, currentBearing, mapLoaded]);

  const getCountryGeometry = (countryName: string) => {
    if (!mapRef.current || !mapLoaded || !countryName) return { path: '', center: null as [number, number] | null };
    const norm = countryName.trim().toLowerCase();
    let geom: any = null;

    if (norm === 'india' || norm === 'ind') {
      try { const indiaFeature = (indiaData as any).features?.[0]; geom = indiaFeature?.geometry || indiaFeature; } catch (e) {}
    }

    if (!geom) {
      const features = (worldData as any).features || [];
      const matched = features.find((f: any) => {
        const p = f.properties || {};
        const candidates = [p.ADMIN, p.admin, p.NAME, p.name, p.SOVEREIGNT, p.ISO_A3].filter(Boolean).map((v) => String(v).toLowerCase());
        return candidates.includes(norm);
      });
      if (matched) geom = matched.geometry;
    }

    if (!geom) return { path: '', center: null };
    
    const rings: [number, number][][] = [];
    if (geom.type === 'Polygon') geom.coordinates.forEach((r: any) => rings.push(r));
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((poly: any) => poly.forEach((r: any) => rings.push(r)));

    const map = mapRef.current;
    let totalX = 0; let totalY = 0; let pointCount = 0;

    const valid = rings.map((ring) => {
      const points = ring.map((coord: [number, number]) => {
        const p = map.project(coord);
        if (!p || isNaN(p.x) || isNaN(p.y) || p.y < -2500 || p.y > height + 2500) return null;
        totalX += coord[0]; totalY += coord[1]; pointCount++;
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).filter(Boolean);
      if (points.length < 3) return '';
      return `M ${points.join(' L ')} Z`;
    }).filter(Boolean);

    const centroid: [number, number] | null = pointCount > 0 ? [totalX / pointCount, totalY / pointCount] : null;
    return { path: valid.join(' '), center: centroid };
  };

  const rawCountries = timeline.highlightCountries || [];
  const takeovers = timeline.takeovers || [];
  const arrows = timeline.arrows || [];
  const assets = (timeline as any).assets || [];

  const mapBlendMode = (mode: string) => {
    const m = (mode || 'normal').toLowerCase();
    if (m === 'add') return 'color-dodge'; 
    return m;
  };

  const getBezierPoint = (t: number, p0: number[], p1: number[], p2: number[]) => {
    const x = Math.pow(1 - t, 2) * p0[0] + 2 * (1 - t) * t * p1[0] + Math.pow(t, 2) * p2[0];
    const y = Math.pow(1 - t, 2) * p0[1] + 2 * (1 - t) * t * p1[1] + Math.pow(t, 2) * p2[1];
    return [x, y];
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#040711', overflow: 'hidden' }}>
      <div ref={mapContainer} style={{ width: `${width}px`, height: `${height}px`, position: 'absolute', top: 0, left: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, transparent 40%, rgba(4, 7, 17, 0.88) 100%)', pointerEvents: 'none', zIndex: 10 }} />

      {mapLoaded && (
        <>
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <filter id="tactical-shadow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000000" floodOpacity="0.95" />
              </filter>
              <filter id="ae-frontline-edge" x="-50%" y="-50%" width="200%" height="200%">
                <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="90" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <radialGradient id="frontline-gradient">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="65%" stopColor="white" stopOpacity="0.85" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>

          {/* 1. COUNTRIES (STRICTLY ISOLATED) */}
          {rawCountries.map((country: any, idx: number) => {
            if (frame < (country.startFrame || 0)) return null;
            const isTarget = takeovers.some((t: any) => (t.target || '').toLowerCase() === country.name.toLowerCase());
            if (isTarget) return null; 

            const { path } = getCountryGeometry(country.name);
            if (!path) return null;
            
            const fillColor = country.color || '#1e3a8a'; 
            const strokeColor = country.strokeColor || '#ffffff';
            const strokeWidth = typeof country.strokeWidth === 'number' ? country.strokeWidth : 0;
            const enableGlow = country.enableGlow === undefined ? true : country.enableGlow; 
            const glowIntensity = typeof country.glowIntensity === 'number' ? country.glowIntensity : 20;
            const blendMode = mapBlendMode(country.blendMode);
            const glowTarget = country.glowTarget || 'both';
            const dropShadow = country.dropShadow === undefined ? true : country.dropShadow;

            return (
              <svg key={`base-${idx}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: blendMode as any, zIndex: 20 }}>
                {dropShadow && <path d={path} fill="#000000" opacity={0.8} style={{ filter: 'blur(15px)' }} transform="translate(0, 15)" />}
                {enableGlow && (glowTarget === 'fill' || glowTarget === 'both') && (
                  <>
                    <path d={path} fill={fillColor} opacity={0.4} style={{ filter: `blur(${Math.max(2, glowIntensity)}px)` }} />
                    <path d={path} fill={fillColor} opacity={0.6} style={{ filter: `blur(${Math.max(2, glowIntensity / 2.5)}px)` }} />
                  </>
                )}
                {enableGlow && (glowTarget === 'stroke' || glowTarget === 'both') && strokeWidth > 0 && (
                  <>
                    <path d={path} fill="none" stroke={strokeColor} strokeWidth={strokeWidth * 3} opacity={0.5} style={{ filter: `blur(${Math.max(2, glowIntensity)}px)` }} />
                    <path d={path} fill="none" stroke={strokeColor} strokeWidth={strokeWidth * 1.5} opacity={0.8} style={{ filter: `blur(${Math.max(2, glowIntensity / 3)}px)` }} />
                  </>
                )}
                <path d={path} fill={glowTarget === 'stroke' ? 'transparent' : fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" opacity={0.9} />
              </svg>
            );
          })}

          {/* 2. TAKEOVERS (INHERITS ATTACKER COLOR) */}
          {takeovers.map((takeover: any, idx: number) => {
            const takeoverStart = takeover.startFrame || 0;
            const takeoverDuration = Math.max(takeover.duration || 120, 90); 
            const targetGeo = getCountryGeometry(takeover.target);
            if (!targetGeo.path) return null;

            const invaderName = takeover.attacker || takeover.invader;
            const targetData: any = rawCountries.find((c: any) => c.name.toLowerCase() === (takeover.target || '').toLowerCase()) || {};
            const invaderData: any = rawCountries.find((c: any) => c.name.toLowerCase() === (invaderName || '').toLowerCase()) || {};

            const tFill = targetData.color || '#1e3a8a';
            const tBlend = mapBlendMode(targetData.blendMode);
            
            // 🔥 INVASION COLOR INHERITANCE: Uses the attacker's actual selected color from state! 🔥
            const iFill = invaderData.color || takeover.color || '#ef4444';
            const iBlend = mapBlendMode(invaderData.blendMode || 'screen');

            if (frame < takeoverStart) {
              return (
                <svg key={`target-base-${idx}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: tBlend as any, zIndex: 20 }}>
                  <path d={targetGeo.path} fill={tFill} opacity={0.85} />
                </svg>
              );
            }

            const elapsed = frame - takeoverStart;
            const radius = interpolate(elapsed, [0, takeoverDuration], [0, Math.max(width, height) * 1.5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.25, 0.1, 0.25, 1) });

            let cx = width / 2; let cy = height / 2;
            if (invaderData.name) {
               const invaderGeo = getCountryGeometry(invaderData.name);
               if (invaderGeo.center) {
                  const proj = mapRef.current?.project(invaderGeo.center);
                  if (proj && !isNaN(proj.x) && !isNaN(proj.y)) { cx = proj.x; cy = proj.y; }
               }
            }

            return (
              <React.Fragment key={`takeover-layer-${idx}`}>
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: tBlend as any, zIndex: 20 }}>
                  <path d={targetGeo.path} fill={tFill} opacity={0.85} />
                </svg>
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: iBlend as any, zIndex: 21 }}>
                  <defs>
                    <mask id={`frontline-mask-${idx}`}>
                      <rect x="-3000" y="-3000" width="10000" height="10000" fill="black" />
                      <circle cx={cx} cy={cy} r={radius} fill="url(#frontline-gradient)" filter="url(#ae-frontline-edge)" />
                    </mask>
                  </defs>
                  <g mask={`url(#frontline-mask-${idx})`}>
                    <path d={targetGeo.path} fill={iFill} opacity={0.9} />
                  </g>
                </svg>
              </React.Fragment>
            );
          })}

          {/* 3. ARROWS & ASSETS */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 40, shapeRendering: 'geometricPrecision' }}>
            {arrows.map((arrow: any, idx: number) => {
              const startF = arrow.startFrame || arrow.frame || 0;
              if (frame < startF) return null;
              
              let c1 = arrow.origin; let c2 = arrow.target;
              if (arrow.sourceName && arrow.targetName) {
                 const geo1 = getCountryGeometry(arrow.sourceName); const geo2 = getCountryGeometry(arrow.targetName);
                 if (geo1.center) c1 = geo1.center; if (geo2.center) c2 = geo2.center;
              }
              if (!c1 || !c2) return null;
              
              const p1 = mapRef.current?.project(c1 as [number, number]);
              const p2 = mapRef.current?.project(c2 as [number, number]);
              if (!p1 || !p2 || isNaN(p1.x) || isNaN(p2.x)) return null;

              const dx = p2.x - p1.x; const dy = p2.y - p1.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 1) return null;

              const nx = -dy / dist; const ny = dx / dist; const arcHeight = dist * 0.38;
              const midX = (p1.x + p2.x) / 2 + nx * arcHeight; const midY = (p1.y + p2.y) / 2 + ny * arcHeight;
              const pathD = `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`;

              const t = interpolate(frame - startF, [0, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
              
              if (arrow.type === 'missile') {
                const headPos = getBezierPoint(t, [p1.x, p1.y], [midX, midY], [p2.x, p2.y]);
                return (
                  <g key={`missile-${idx}`}>
                    <path d={pathD} fill="none" stroke="#ffffff" strokeWidth="3" opacity={0.6} strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - t * 100} style={{ filter: 'blur(1px)' }} />
                    <path d={pathD} fill="none" stroke="#ef4444" strokeWidth="8" opacity={0.3} strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - t * 100} style={{ filter: 'blur(6px)' }} />
                    {t < 1 && (
                      <g transform={`translate(${headPos[0]}, ${headPos[1]})`}>
                        <circle cx="0" cy="0" r="12" fill="#ef4444" opacity={0.6} style={{ filter: 'blur(8px)' }} />
                        <circle cx="0" cy="0" r="6" fill="#ffffff" style={{ filter: 'blur(2px)' }} />
                        <circle cx="0" cy="0" r="3" fill="#ffffff" />
                      </g>
                    )}
                    {t === 1 && (
                      <g transform={`translate(${p2.x}, ${p2.y})`}>
                        <circle cx="0" cy="0" r={interpolate(frame - startF - 45, [0, 15], [0, 100], {extrapolateRight: 'clamp', easing: Easing.out(Easing.exp)})} fill="none" stroke="#ef4444" strokeWidth={interpolate(frame - startF - 45, [0, 15], [10, 0], {extrapolateRight: 'clamp'})} style={{ filter: 'blur(4px)' }} />
                        <circle cx="0" cy="0" r={interpolate(frame - startF - 45, [0, 10], [0, 40], {extrapolateRight: 'clamp'})} fill="#ffffff" opacity={interpolate(frame - startF - 45, [0, 10], [1, 0], {extrapolateRight: 'clamp'})} style={{ filter: 'blur(2px)' }} />
                      </g>
                    )}
                  </g>
                );
              } else {
                const sourceData = rawCountries.find((c: any) => c.name.toLowerCase() === (arrow.sourceName || '').toLowerCase());
                const arrowColor = arrow.color || sourceData?.color || "#ef4444";
                return (
                  <g key={`arrow-${idx}`} filter="url(#tactical-shadow)">
                    <path d={pathD} fill="none" stroke={arrowColor} strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - t * 100} />
                    <path d={pathD} fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - t * 100} />
                  </g>
                );
              }
            })}

            {assets.map((asset: any) => {
              if (frame < asset.startFrame) return null;
              const p = mapRef.current?.project([asset.lng, asset.lat]);
              if (!p || isNaN(p.x) || isNaN(p.y)) return null;

              if (asset.type === 'pin') {
                const dropY = interpolate(frame - asset.startFrame, [0, 15], [-50, 0], { extrapolateRight: 'clamp', easing: Easing.bounce });
                return (
                  <g key={asset.id} transform={`translate(${p.x}, ${p.y + dropY})`} filter="url(#tactical-shadow)">
                    <path d="M0 -24 C -8 -24, -14 -18, -14 -10 C -14 0, 0 12, 0 12 C 0 12, 14 0, 14 -10 C 14 -18, 8 -24, 0 -24 Z" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="0" cy="-12" r="4" fill="#ffffff" />
                  </g>
                );
              }
              
              if (asset.type === 'explosion') {
                const ringR = interpolate(frame - asset.startFrame, [0, 20], [0, 80], { extrapolateRight: 'clamp', easing: Easing.out(Easing.exp) });
                const opacity = interpolate(frame - asset.startFrame, [0, 20], [1, 0], { extrapolateRight: 'clamp' });
                return (
                  <g key={asset.id} transform={`translate(${p.x}, ${p.y})`}>
                    <circle cx="0" cy="0" r={ringR} fill="none" stroke="#f59e0b" strokeWidth={opacity * 15} style={{ filter: 'blur(6px)' }} />
                    <circle cx="0" cy="0" r={ringR * 0.8} fill="none" stroke="#ffffff" strokeWidth={opacity * 5} />
                    <circle cx="0" cy="0" r={ringR * 0.3} fill="#ef4444" opacity={opacity} style={{ filter: 'blur(8px)' }} />
                  </g>
                );
              }
              return null;
            })}
          </svg>

          {/* HITBOX RAYCASTER */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'auto', zIndex: 60 }}>
            {rawCountries.map((country: any, idx: number) => {
              if (frame < (country.startFrame || 0)) return null;
              const { path } = getCountryGeometry(country.name);
              if (!path) return null;
              const isSelected = selectedCountry === country.name;
              return (
                <g key={`hitbox-${idx}`}>
                  {isSelected && <path d={path} fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="8 8" />}
                  <path d={path} fill="transparent" stroke="transparent" strokeWidth="20" style={{ cursor: 'crosshair' }} onClick={() => setSelectedCountry(country.name)} />
                </g>
              );
            })}
          </svg>
        </>
      )}
    </AbsoluteFill>
  );
};