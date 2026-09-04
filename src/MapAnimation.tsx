import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  Easing,
  useVideoConfig,
  delayRender,
  continueRender,
  getRemotionEnvironment,
  interpolate, // 🔥 RESTORED MISSING IMPORT
} from 'remotion';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GeneratedTimeline } from './backend/generateTimeline';

// 🌍 BASE GEOMETRIES
import worldData from './world.json';
import indiaData from './india.json';

// 🗺️ ADVANCED GEOMETRIES
const statesData: any = { features: [] }; 
const riversData: any = { features: [] };
const citiesData: any = { features: [] };

export const MapAnimation: React.FC<{ 
  timeline: GeneratedTimeline;
  isLiveEditMode?: boolean;
  mapStyle?: string;
}> = ({ timeline, mapStyle = 'satellite' }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [initialHandle] = useState(() => delayRender('Booting Cinematic Map Engine...'));
  
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();

  const totalFrames = timeline?.totalFrames || 300;

  const rawKeyframes = timeline?.cameraKeyframes || [];
  const validKeyframes = rawKeyframes.filter(
    (k: any) => k && typeof k.frame === 'number' && (typeof k.lng === 'number' || typeof k.latitude === 'number')
  ).map((k: any) => ({
    frame: k.frame,
    lng: k.lng ?? k.longitude ?? 127.0,
    lat: k.lat ?? k.latitude ?? 38.0,
    zoom: k.zoom ?? 1.2,
    pitch: Math.min(60, k.pitch ?? 0), 
    bearing: k.bearing ?? 0
  }));

  const fallbackKeyframes: any[] = [
    { frame: 0, lng: 79, lat: 22, zoom: 4.2, pitch: 15, bearing: 0 },
    { frame: totalFrames, lng: 88, lat: 31, zoom: 5.5, pitch: 40, bearing: 0 },
  ];

  const keyframes = validKeyframes.length > 0 ? validKeyframes : fallbackKeyframes;
  const strictlySortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);

  const getInterpolatedCamera = () => {
    const kfs = strictlySortedKeyframes;
    if (kfs.length === 0) return { lng: 0, lat: 0, zoom: 1, pitch: 0, bearing: 0 };
    if (kfs.length === 1 || frame <= kfs[0].frame) return kfs[0];
    if (frame >= kfs[kfs.length - 1].frame) return kfs[kfs.length - 1];

    for (let i = 0; i < kfs.length - 1; i++) {
      if (frame >= kfs[i].frame && frame < kfs[i+1].frame) {
         const kf1 = kfs[i];
         const kf2 = kfs[i+1];
         
         const duration = kf2.frame - kf1.frame;
         const rawProgress = (frame - kf1.frame) / duration;
         const easeProgress = Easing.bezier(0.25, 0.1, 0.25, 1)(rawProgress);
         
         return {
           lng: kf1.lng + (kf2.lng - kf1.lng) * easeProgress,
           lat: kf1.lat + (kf2.lat - kf1.lat) * easeProgress,
           zoom: kf1.zoom + (kf2.zoom - kf1.zoom) * easeProgress,
           pitch: kf1.pitch + (kf2.pitch - kf1.pitch) * easeProgress,
           bearing: kf1.bearing + (kf2.bearing - kf1.bearing) * easeProgress
         };
      }
    }
    return kfs[kfs.length - 1];
  };

  const { lng: currentLng, lat: currentLat, zoom: currentZoom, pitch: currentPitch, bearing: currentBearing } = getInterpolatedCamera();

  const getStyleDef = (styleId: string): any => {
    const buildRasterStyle = (url: string, saturation: number, contrast: number, brightnessMin: number, brightnessMax: number) => ({
      version: 8,
      sources: { raster_tiles: { type: 'raster', tiles: [url], tileSize: 256 } },
      layers: [{ id: 'base-layer', type: 'raster', source: 'raster_tiles', paint: { 'raster-saturation': saturation, 'raster-contrast': contrast, 'raster-brightness-min': brightnessMin, 'raster-brightness-max': brightnessMax } }]
    });
  
    switch (styleId) {
      case 'dark': return buildRasterStyle('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', -1.0, 0.4, 0.02, 0.25);
      case 'light': return buildRasterStyle('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', 0, 0, 0, 1);
      case 'street': return buildRasterStyle('https://tile.openstreetmap.org/{z}/{x}/{y}.png', 0, 0, 0, 1);
      case 'satellite':
      default: return buildRasterStyle('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', -0.85, 0.25, 0.15, 0.8);
    }
  };

  useLayoutEffect(() => {
    if (!mapContainer.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current, 
      fadeDuration: 0, 
      maxTileCacheSize: 10000, 
      renderWorldCopies: false,
      pixelRatio: isRendering ? 2 : 1, 
      style: getStyleDef(mapStyle),
      center: [currentLng, currentLat], 
      zoom: currentZoom, 
      pitch: currentPitch, 
      bearing: currentBearing,
      maxPitch: 60,
      interactive: false, 
      attributionControl: false,
    });

    map.on('load', () => { 
      mapRef.current = map; 
      setMapLoaded(true); 
      continueRender(initialHandle); 
    });
    return () => map.remove();
  }, [mapStyle]);

  useLayoutEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    let tileLockHandle: number | null = null;
    
    if (isRendering) {
      tileLockHandle = delayRender(`Waiting for map tiles at frame ${frame}`);
    }

    mapRef.current.jumpTo({ 
      center: [currentLng, currentLat], 
      zoom: currentZoom, 
      pitch: currentPitch, 
      bearing: currentBearing 
    });

    if (isRendering && tileLockHandle !== null) {
      if (mapRef.current.isStyleLoaded() && mapRef.current.areTilesLoaded()) {
        continueRender(tileLockHandle);
      } else {
        mapRef.current.once('idle', () => {
          try {
            if (tileLockHandle !== null) continueRender(tileLockHandle);
          } catch (e) {
          }
        });
      }
    }
  }, [currentLng, currentLat, currentZoom, currentPitch, currentBearing, mapLoaded, isRendering, frame]);

  const getGeometryFromSource = (name: string, dataSources: any[]) => {
    if (!mapRef.current || !mapLoaded || !name) return { path: '', center: null as [number, number] | null };
    const norm = name.trim().toLowerCase();
    let geom: any = null;

    if (norm === 'india' || norm === 'ind' || norm === 'bharat') {
      try { geom = (indiaData as any).features?.[0]?.geometry || indiaData; } catch (e) {}
    }

    if (!geom) {
      for (const source of dataSources) {
        const features = source?.features || [];
        const matched = features.find((f: any) => {
          const p = f.properties || {};
          const candidates = [p.ADMIN, p.admin, p.NAME, p.name, p.SOVEREIGNT, p.ISO_A3].filter(Boolean).map((v) => String(v).toLowerCase());
          return candidates.includes(norm);
        });
        if (matched) { geom = matched.geometry; break; }
      }
    }

    if (!geom) return { path: '', center: null };
    
    const rings: [number, number][][] = [];
    if (geom.type === 'Polygon') geom.coordinates.forEach((r: any) => rings.push(r));
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((poly: any) => poly.forEach((r: any) => rings.push(r)));
    else if (geom.type === 'LineString') rings.push(geom.coordinates);
    else if (geom.type === 'MultiLineString') geom.coordinates.forEach((line: any) => rings.push(line));

    const map = mapRef.current;
    let totalX = 0; let totalY = 0; let pointCount = 0;

    const valid = rings.map((ring) => {
      const points = ring.map((coord: [number, number]) => {
        const p = map.project(coord);
        if (!p || isNaN(p.x) || isNaN(p.y) || p.y < -3000 || p.y > height + 3000) return null;
        totalX += coord[0]; totalY += coord[1]; pointCount++;
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).filter(Boolean);
      
      if (points.length < 2) return '';
      return geom.type.includes('Line') ? `M ${points.join(' L ')}` : `M ${points.join(' L ')} Z`;
    }).filter(Boolean);

    const centroid: [number, number] | null = pointCount > 0 ? [totalX / pointCount, totalY / pointCount] : null;
    return { path: valid.join(' '), center: centroid };
  };

  const rawCountries = timeline.highlightCountries || [];
  const rawStates = (timeline as any).highlightStates || [];
  const takeovers = timeline.takeovers || [];
  const arrows = timeline.arrows || [];
  const assets = (timeline as any).assets || [];
  const labels = (timeline as any).labels || [];

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

          {[...rawCountries, ...rawStates].map((entity: any, idx: number) => {
            if (frame < (entity.startFrame || 0)) return null;
            const eName = entity.name || entity.country || entity.state;
            const isTarget = takeovers.some((t: any) => (t.target || '').toLowerCase() === eName.toLowerCase());
            if (isTarget) return null; 

            const { path } = getGeometryFromSource(eName, [worldData, statesData, riversData, citiesData]);
            if (!path) return null;
            
            const fillColor = entity.color || '#1e3a8a'; 
            const strokeColor = entity.strokeColor || '#ffffff';
            const strokeWidth = typeof entity.strokeWidth === 'number' ? entity.strokeWidth : 0;
            const enableGlow = entity.enableGlow === undefined ? true : entity.enableGlow; 
            const glowIntensity = typeof entity.glowIntensity === 'number' ? entity.glowIntensity : 20;
            const blendMode = mapBlendMode(entity.blendMode);
            const glowTarget = entity.glowTarget || 'both';
            const dropShadow = entity.dropShadow === undefined ? true : entity.dropShadow;

            const isClosedPath = path.endsWith('Z');

            return (
              <svg key={`base-${idx}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: blendMode as any, zIndex: 20 }}>
                {dropShadow && <path d={path} fill={isClosedPath ? "#000000" : "none"} stroke={!isClosedPath ? "#000000" : "none"} strokeWidth={strokeWidth || 2} opacity={0.8} style={{ filter: 'blur(15px)' }} transform="translate(0, 15)" />}
                {enableGlow && (glowTarget === 'fill' || glowTarget === 'both') && (
                  <path d={path} fill={isClosedPath ? fillColor : "none"} stroke={!isClosedPath ? fillColor : "none"} strokeWidth={strokeWidth || 2} opacity={0.55} style={{ filter: `blur(${Math.max(2, glowIntensity / 1.5)}px)` }} />
                )}
                <path d={path} fill={isClosedPath && glowTarget !== 'stroke' ? fillColor : "transparent"} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" opacity={0.9} />
              </svg>
            );
          })}

          {takeovers.map((takeover: any, idx: number) => {
            const takeoverStart = takeover.startFrame || 0;
            const takeoverDuration = Math.max(takeover.duration || 120, 90); 
            const targetGeo = getGeometryFromSource(takeover.target, [worldData, statesData]);
            if (!targetGeo.path) return null;

            const invaderName = takeover.attacker || takeover.invader;
            const targetData: any = rawCountries.find((c: any) => (c.name || c.country || '').toLowerCase() === (takeover.target || '').toLowerCase()) || {};
            const invaderData: any = rawCountries.find((c: any) => (c.name || c.country || '').toLowerCase() === (invaderName || '').toLowerCase()) || {};

            const tFill = targetData.color || '#1e3a8a';
            const tBlend = mapBlendMode(targetData.blendMode);
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
            const invName = invaderData.name || invaderData.country;
            if (invName) {
               const invaderGeo = getGeometryFromSource(invName, [worldData, statesData]);
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

          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 40, shapeRendering: 'geometricPrecision' }}>
            {arrows.map((arrow: any, idx: number) => {
              const startF = arrow.startFrame || arrow.frame || 0;
              if (frame < startF) return null;
              
              let c1 = arrow.origin; let c2 = arrow.target;
              if (arrow.sourceName && arrow.targetName) {
                 const geo1 = getGeometryFromSource(arrow.sourceName, [worldData, statesData]); 
                 const geo2 = getGeometryFromSource(arrow.targetName, [worldData, statesData]);
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
                const sName = arrow.sourceName || '';
                const sourceData = rawCountries.find((c: any) => (c.name || c.country || '').toLowerCase() === sName.toLowerCase());
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

          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 70 }}>
            {labels.map((l: any, i: number) => {
              if (frame < (l.startFrame || 0)) return null;
              const p = mapRef.current?.project([l.lng, l.lat]);
              if (!p || isNaN(p.x) || isNaN(p.y)) return null;
              if (frame > (l.startFrame + (l.duration || 150)) && !l.pinned) return null;

              return (
                <div key={l.id || `lbl-${i}`} style={{ position: 'absolute', left: `${p.x}px`, top: `${p.y}px`, transform: 'translate(-50%, -100%)', background: l.bg || 'rgba(0,0,0,0.7)', color: l.color || '#ffffff', fontSize: `${l.size || 24}px`, fontWeight: 700, padding: '4px 12px', borderRadius: '8px', whiteSpace: 'nowrap', marginTop: '-10px' }}>
                  {l.text}
                </div>
              );
            })}
          </div>

          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'auto', zIndex: 60 }}>
            {rawCountries.map((country: any, idx: number) => {
              if (frame < (country.startFrame || 0)) return null;
              const cName = country.name || country.country;
              const { path } = getGeometryFromSource(cName, [worldData, statesData]);
              if (!path) return null;
              const isSelected = selectedCountry === cName;
              return (
                <g key={`hitbox-${idx}`}>
                  {isSelected && <path d={path} fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="8 8" />}
                  <path d={path} fill="transparent" stroke="transparent" strokeWidth="20" style={{ cursor: 'crosshair' }} onClick={() => setSelectedCountry(cName)} />
                </g>
              );
            })}
          </svg>
        </>
      )}
    </AbsoluteFill>
  );
};