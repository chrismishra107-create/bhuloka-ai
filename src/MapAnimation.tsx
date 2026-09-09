import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AbsoluteFill, Easing, continueRender, delayRender, getRemotionEnvironment, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import worldData from './world.json';
import indiaData from './india.json';

const GEOJSON_RESOURCES: Record<string, string> = {
  rivers: 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_rivers_lake_centerlines.geojson',
  states: 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_1_states_provinces.geojson',
};

const dynamicGeoCache = new Map<string, any>();
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const normalizeBearing = (b: number) => ((b % 360) + 360) % 360;
const shortestBearingDelta = (a: number, b: number) => ((b - a + 540) % 360) - 180;
const interpolateBearing = (a: number, b: number, t: number) => normalizeBearing(a + shortestBearingDelta(a, b) * t);
const ease = Easing.bezier(0.25, 0.1, 0.25, 1);
const revealEase = Easing.bezier(0.22, 1, 0.36, 1);

export const MapAnimation: React.FC<{
  timeline: any;
  isLiveEditMode?: boolean;
  mapStyle?: string;
  onCameraChange?: (cam: any) => void;
}> = ({ timeline, isLiveEditMode = false, mapStyle = 'dark-documentary', onCameraChange }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onCameraChangeRef = useRef(onCameraChange);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [initialHandle] = useState(() => delayRender('Booting Cinematic WebGL Engine'));
  const [extraData, setExtraData] = useState<any[]>([]);

  // High-Performance Geometry Cache
  const pathCache = useRef<Record<string, { path: string, center: [number, number] | null, isLine: boolean }>>({});
  const lastCameraHash = useRef<string>('');
  const isUserInteracting = useRef(false);

  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();
  const totalFrames = Math.max(1, timeline?.totalFrames || 300);

  const rawCountries = timeline?.highlightCountries || [];
  const takeovers = timeline?.takeovers || [];
  const arrows = timeline?.arrows || [];
  const labels = timeline?.labels || [];
  const assets = timeline?.assets || [];

  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      dynamicGeoCache.has('states') ? dynamicGeoCache.get('states') : fetch(GEOJSON_RESOURCES.states).then(r => r.json()),
      dynamicGeoCache.has('rivers') ? dynamicGeoCache.get('rivers') : fetch(GEOJSON_RESOURCES.rivers).then(r => r.json())
    ]).then(([states, rivers]) => {
      dynamicGeoCache.set('states', states);
      dynamicGeoCache.set('rivers', rivers);
      if (alive) setExtraData([states, rivers]);
    }).catch(err => console.error("GeoJSON Load Error:", err));
    return () => { alive = false; };
  }, []);

  const validKeyframes = useMemo(() => (timeline?.cameraKeyframes || [])
    .filter((k: any) => k && Number.isFinite(Number(k.frame)))
    .map((k: any) => ({
      frame: Number(k.frame),
      lng: Number(k.lng ?? k.longitude ?? 127),
      lat: Number(k.lat ?? k.latitude ?? 38),
      zoom: Number(k.zoom ?? 1.2),
      pitch: clamp(Number(k.pitch ?? 0), 0, 85),
      bearing: normalizeBearing(Number(k.bearing ?? 0)),
    }))
    .sort((a: any, b: any) => a.frame - b.frame), [timeline?.cameraKeyframes]);

  const keyframes = validKeyframes.length ? validKeyframes : [
    { frame: 0, lng: 79, lat: 22, zoom: 4.2, pitch: 15, bearing: 0 },
    { frame: totalFrames, lng: 88, lat: 31, zoom: 5.5, pitch: 40, bearing: 0 },
  ];

  const camera = useMemo(() => {
    if (keyframes.length === 1 || frame <= keyframes[0].frame) return keyframes[0];
    if (frame >= keyframes[keyframes.length - 1].frame) return keyframes[keyframes.length - 1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      const a = keyframes[i], b = keyframes[i + 1];
      if (frame >= a.frame && frame <= b.frame) {
        const p = ease(clamp((frame - a.frame) / Math.max(1, b.frame - a.frame)));
        return {
          lng: a.lng + (b.lng - a.lng) * p,
          lat: a.lat + (b.lat - a.lat) * p,
          zoom: a.zoom + (b.zoom - a.zoom) * p,
          pitch: a.pitch + (b.pitch - a.pitch) * p,
          bearing: interpolateBearing(a.bearing, b.bearing, p),
        };
      }
    }
    return keyframes[keyframes.length - 1];
  }, [keyframes, frame]);

  // Cache Invalidation Engine - Instantly purges cached SVGs if the camera moves
  const currentCameraHash = `${camera.lng.toFixed(4)}_${camera.lat.toFixed(4)}_${camera.zoom.toFixed(2)}_${camera.pitch.toFixed(1)}_${camera.bearing.toFixed(1)}`;
  if (lastCameraHash.current !== currentCameraHash) {
    pathCache.current = {};
    lastCameraHash.current = currentCameraHash;
  }

  const getStyleDef = (styleId: string): any => {
    const styles: Record<string, any> = {
      satellite: { version: 8, sources: { r: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } }, layers: [{ id: 'b', type: 'raster', source: 'r', paint: { 'raster-saturation': -0.15, 'raster-contrast': 0.08 } }] },
      'natural-earth': { version: 8, sources: { r: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } }, layers: [{ id: 'b', type: 'raster', source: 'r' }] },
      light: { version: 8, sources: { r: { type: 'raster', tiles: ['https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } }, layers: [{ id: 'b', type: 'raster', source: 'r', paint: { 'raster-contrast': 0.05 } }] },
      'dark-documentary': { version: 8, sources: { r: { type: 'raster', tiles: ['https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } }, layers: [{ id: 'b', type: 'raster', source: 'r', paint: { 'raster-contrast': 0.2, 'raster-brightness-max': 0.82 } }] },
    };
    return styles[styleId] || styles['dark-documentary'];
  };

  useLayoutEffect(() => {
    if (!mapContainer.current) return;
    const mobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: getStyleDef(mapStyle),
      center: [camera.lng, camera.lat], zoom: camera.zoom, pitch: camera.pitch, bearing: camera.bearing,
      interactive: isLiveEditMode, attributionControl: false, fadeDuration: 0, renderWorldCopies: false,
      pixelRatio: mobile ? 1 : (isRendering ? 2 : 1), maxTileCacheSize: 10000, preserveDrawingBuffer: true
    } as any);

    if (isLiveEditMode) {
      map.on('dragstart', () => { isUserInteracting.current = true; });
      map.on('zoomstart', () => { isUserInteracting.current = true; });
      map.on('pitchstart', () => { isUserInteracting.current = true; });
      map.on('rotatestart', () => { isUserInteracting.current = true; });
      
      map.on('dragend', () => { isUserInteracting.current = false; });
      map.on('zoomend', () => { isUserInteracting.current = false; });
      map.on('pitchend', () => { isUserInteracting.current = false; });
      map.on('rotateend', () => { isUserInteracting.current = false; });

      map.on('move', () => {
        if (onCameraChangeRef.current) {
          onCameraChangeRef.current({ lat: map.getCenter().lat, lng: map.getCenter().lng, zoom: map.getZoom(), pitch: map.getPitch(), bearing: normalizeBearing(map.getBearing()) });
        }
      });
    }

    map.on('load', () => { 
      mapRef.current = map; 
      (window as any).__mapInstance = map;
      setMapLoaded(true); 
      continueRender(initialHandle); 
    });

    return () => { 
      if ((window as any).__mapInstance === map) (window as any).__mapInstance = null;
      map.remove(); 
      mapRef.current = null; 
    };
  }, [mapStyle, isLiveEditMode]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    
    let lock: number | null = null;
    if (isRendering) lock = delayRender(`Rendering map frame ${frame}`);
    
    if (!isUserInteracting.current) {
  map.jumpTo({ center: [camera.lng, camera.lat], zoom: camera.zoom, pitch: camera.pitch, bearing: camera.bearing });
}
    
    if (lock !== null) {
      const release = () => setTimeout(() => continueRender(lock!), 40);
      if (map.areTilesLoaded()) release(); else map.once('idle', release);
    }
  }, [camera, mapLoaded, isRendering, isLiveEditMode, frame]);

  

  const project = (coord: [number, number]) => {
    if (!mapRef.current) return null;
    try {
      const p = mapRef.current.project(coord as any);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      // We removed the aggressive manual bounds clipping here. 
      // Chopping coordinates manually fractures LineStrings. Let the native SVG engine cull it.
      return p;
    } catch { return null; }
  };

  const geometryFor = (name: string) => {
    if (!name || !mapLoaded) return { path: '', center: null as [number, number] | null, isLine: false };
    const norm = String(name).trim().toLowerCase();
    
    // THE FIX: Only return from cache if it actually contains a valid, non-empty path.
    if (pathCache.current[norm] && pathCache.current[norm].path !== '') {
      return pathCache.current[norm];
    }

    let geom: any = null;
    
    // Robust fallback for India in case the GeoJSON structure varies
    if (['india', 'ind', 'bharat'].includes(norm)) {
      geom = (indiaData as any).geometry || (indiaData as any).features?.[0]?.geometry || indiaData;
    }
    
    if (!geom) {
      for (const src of [worldData, ...extraData]) {
        const match = (src?.features || []).find((f: any) => {
          const names = [f.properties?.ADMIN, f.properties?.admin, f.properties?.NAME, f.properties?.name, f.properties?.name_en].filter(Boolean).map(x => String(x).toLowerCase());
          return names.includes(norm) || names.some(x => x.includes(norm) || norm.includes(x));
        });
        if (match) { geom = match.geometry; break; }
      }
    }
    
    // If we STILL don't have it (because the network fetch is pending), return empty BUT DO NOT CACHE IT.
    if (!geom) return { path: '', center: null, isLine: false };

    const lines: number[][][] = [];
    const extractCoords = (coords: any) => {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0][0] === 'number') {
        lines.push(coords);
      } else {
        coords.forEach(extractCoords);
      }
    };
    
    if (geom.coordinates) extractCoords(geom.coordinates);

    const isLine = geom.type.includes('Line');
    let path = '';
    let sumLng = 0, sumLat = 0, pointCount = 0;

    for (const line of lines) {
      let first = true;
      let lastPx = { x: -999, y: -999 };
      
      for (const coord of line) {
        if (!coord || coord.length < 2) continue;
        sumLng += Number(coord[0]); sumLat += Number(coord[1]); pointCount++;
        
        const p = project([Number(coord[0]), Number(coord[1])]);
        if (!p) { first = true; continue; }
        
        const dist = Math.hypot(p.x - lastPx.x, p.y - lastPx.y);
        if (!first && dist < 1.5) continue;

        path += `${first ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        first = false;
        lastPx = { x: p.x, y: p.y };
      }
      if (!isLine && path) path += 'Z ';
    }
    
    const center = pointCount > 0 ? [sumLng / pointCount, sumLat / pointCount] as [number, number] : null;
    const result = { path, center, isLine };
    
    // ONLY SAVE TO CACHE IF IT SUCCESSFULLY GENERATED A REAL PATH
    if (path !== '') {
      pathCache.current[norm] = result;
    }
    
    return result;
  };

  const cssBlendModes = ['normal', 'multiply', 'screen', 'overlay', 'color-dodge'];

  return (
    <AbsoluteFill style={{ background: '#040711', overflow: 'hidden' }}>
      
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width, height, pointerEvents: 'auto' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', background: 'radial-gradient(circle at center, transparent 38%, rgba(4,7,17, 0.9) 100%)' }} />
      
      {mapLoaded && (
        <>
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <filter id="tactical-shadow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#000000" floodOpacity="0.85" />
              </filter>
              <filter id="glow-low" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-mid" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="16" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glow-high" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="24" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="ink-displacement" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="40" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
          </svg>

          {cssBlendModes.map(blendGroup => (
            <svg key={`blend-${blendGroup}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 20, pointerEvents: 'none', mixBlendMode: blendGroup as any }}>
              
              {blendGroup === 'normal' && rawCountries.map((c: any, i: number) => {
                const start = Number(c.startFrame ?? 0);
                if (frame < start || c.dropShadow === false || ['screen', 'multiply'].includes(c.blendMode)) return null;
                const { path, isLine } = geometryFor(c.name);
                if (!path || isLine) return null;
                return <path key={`shadow-${i}`} d={path} fill="#000" opacity={0.6} transform="translate(0, 15)" style={{ filter: 'blur(15px)' }} />;
              })}

              {rawCountries.map((c: any, i: number) => {
                const start = Number(c.startFrame ?? 0);
                const end = Number(c.endFrame ?? totalFrames);
                if (frame < start || frame > end) return null;
                
                const mode = ['screen', 'multiply', 'overlay', 'color-dodge'].includes(c.blendMode) ? c.blendMode : 'normal';
                const assignedBlend = mode === 'color-dodge' ? 'color-dodge' : mode;
                if (assignedBlend !== blendGroup) return null;

                if (takeovers.some((t: any) => (t.target||'').toLowerCase() === c.name.toLowerCase() && frame >= t.startFrame + (t.duration||90))) return null;

                const { path, isLine, center } = geometryFor(c.name);
                if (!path) return null;

                const t = revealEase(clamp((frame - start) / Number(c.fadeInDuration ?? 30)));
                const alpha = frame > end - 20 ? clamp((end - frame) / 20) : t;

                let glowFilter = 'none';
                if (c.enableGlow !== false) {
                  const gi = c.glowIntensity ?? 20;
                  if (gi <= 10) glowFilter = 'url(#glow-low)';
                  else if (gi <= 25) glowFilter = 'url(#glow-mid)';
                  else glowFilter = 'url(#glow-high)';
                }

                if (isLine || c.noFill) {
                  const dashLength = Math.max(width, height) * 4;
                  const trimT = revealEase(clamp((frame - start) / Number(c.trimDuration ?? 45)));
                  return (
                    <g key={`entity-line-${i}`} opacity={alpha}>
                      <path d={path} fill="none" stroke={c.color || '#3b82f6'} strokeWidth={c.strokeWidth || 4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashLength} strokeDashoffset={c.revealStyle === 'trim' ? dashLength * (1 - trimT) : 0} style={{ filter: glowFilter }} />
                    </g>
                  );
                }

                // Ink bleed logic requires the actual country center projected to screen
                const centerProj = center ? project(center) : null;

                return (
                  <g key={`entity-poly-${i}`} opacity={alpha}>
                    {c.revealStyle === 'ink' ? (
                      <mask id={`mask-ink-${i}`}>
                        <circle cx={centerProj?.x ?? width/2} cy={centerProj?.y ?? height/2} r={Math.max(width, height) * 1.5 * t} fill="white" style={{ filter: 'url(#ink-displacement)' }} />
                      </mask>
                    ) : null}
                    
                    <g mask={c.revealStyle === 'ink' ? `url(#mask-ink-${i})` : undefined}>
                      {c.enableGlow !== false && mode !== 'multiply' && (
                        <path d={path} fill={c.color || '#3b82f6'} opacity={0.5} style={{ filter: `blur(${c.glowIntensity || 20}px)` }} />
                      )}
                      <path d={path} fill={c.color || '#3b82f6'} />
                      {c.strokeWidth > 0 && <path d={path} fill="none" stroke={c.strokeColor || '#fff'} strokeWidth={c.strokeWidth} />}
                    </g>
                  </g>
                );
              })}

              {takeovers.map((t: any, i: number) => {
                const start = Number(t.startFrame ?? 0);
                if (frame < start) return null;
                
                const targetData = rawCountries.find((c: any) => c.name === t.target) || {};
                const invaderData = rawCountries.find((c: any) => c.name === t.attacker) || {};
                
                const tBlend = targetData.blendMode || 'normal';
                const iBlend = invaderData.blendMode || 'screen';

                const targetGeo = geometryFor(t.target);
                if (!targetGeo.path) return null;
                
                const attackerGeo = geometryFor(t.attacker);
                const p = attackerGeo.center ? project(attackerGeo.center) : null;
                const radius = Math.max(width, height) * 1.7 * revealEase(clamp((frame - start) / Math.max(1, Number(t.duration ?? 90))));
                
                return (
                  <g key={`takeover-${i}`}>
                     {tBlend === blendGroup && (
                       <path d={targetGeo.path} fill={targetData.color || '#1e3a8a'} opacity={0.85} />
                     )}
                     {iBlend === blendGroup && (
                       <React.Fragment>
                         <mask id={`takeover-mask-${i}`}>
                           <circle cx={p?.x ?? width/2} cy={p?.y ?? height/2} r={radius} fill="white" style={{ filter: 'url(#ink-displacement)' }} />
                         </mask>
                         <path d={targetGeo.path} fill={invaderData.color || t.color || '#ef4444'} mask={`url(#takeover-mask-${i})`} opacity={0.95} />
                       </React.Fragment>
                     )}
                  </g>
                );
              })}
            </svg>
          ))}

          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 30, pointerEvents: 'none', shapeRendering: 'geometricPrecision' }}>
            {arrows.map((arrow: any, i: number) => {
              const startF = arrow.startFrame || 0;
              if (frame < startF) return null;
              
              let a = arrow.origin, b = arrow.target;
              if (arrow.sourceName) a = geometryFor(arrow.sourceName).center;
              if (arrow.targetName) b = geometryFor(arrow.targetName).center;
              if (!a || !b) return null;
              
              const p1 = project(a as [number, number]), p2 = project(b as [number, number]);
              if (!p1 || !p2) return null;
              
              const dx = p2.x - p1.x, dy = p2.y - p1.y, dist = Math.hypot(dx, dy);
              if (dist < 1) return null;

              const mx = (p1.x + p2.x) / 2 - (dy / dist) * (dist * 0.38);
              const my = (p1.y + p2.y) / 2 + (dx / dist) * (dist * 0.38);
              const d = `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`;
              
              const t = revealEase(clamp((frame - startF) / Number(arrow.duration ?? 45)));
              
              if (arrow.type === 'missile') {
                const hx = Math.pow(1-t,2)*p1.x + 2*(1-t)*t*mx + Math.pow(t,2)*p2.x;
                const hy = Math.pow(1-t,2)*p1.y + 2*(1-t)*t*my + Math.pow(t,2)*p2.y;
                return (
                  <g key={`arr-${i}`}>
                    <path d={d} fill="none" stroke="#ef4444" strokeWidth="8" opacity={0.3} strokeLinecap="round" strokeDasharray={dist*2} strokeDashoffset={dist*2*(1-t)} style={{ filter: 'blur(6px)' }} />
                    <path d={d} fill="none" stroke="#ffffff" strokeWidth="3" opacity={0.9} strokeLinecap="round" strokeDasharray={dist*2} strokeDashoffset={dist*2*(1-t)} />
                    {t < 1 && (
                      <g transform={`translate(${hx}, ${hy})`}>
                        <circle cx="0" cy="0" r="14" fill="#ef4444" opacity={0.6} style={{ filter: 'blur(8px)' }} />
                        <circle cx="0" cy="0" r="5" fill="#ffffff" />
                      </g>
                    )}
                  </g>
                );
              }
              
              const sourceColor = rawCountries.find((c: any) => c.name === arrow.sourceName)?.color || '#ef4444';
              return (
                <g key={`arr-${i}`} filter="url(#tactical-shadow)">
                  <path d={d} fill="none" stroke={sourceColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={dist*2} strokeDashoffset={dist*2*(1-t)} />
                  <path d={d} fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeDasharray={dist*2} strokeDashoffset={dist*2*(1-t)} />
                </g>
              );
            })}

            {assets.map((asset: any, i: number) => {
               const start = Number(asset.startFrame ?? 0);
               if (frame < start) return null;
               const p = project([Number(asset.lng), Number(asset.lat)]);
               if (!p) return null;

               if (asset.type === 'pin') {
                 const dropY = interpolate(frame - start, [0, 15], [-50, 0], { extrapolateRight: 'clamp', easing: Easing.bounce });
                 return (
                   <g key={`asset-${i}`} transform={`translate(${p.x}, ${p.y + dropY})`} filter="url(#tactical-shadow)">
                     <path d="M0 -28 C -10 -28, -16 -20, -16 -10 C -16 0, 0 14, 0 14 C 0 14, 16 0, 16 -10 C 16 -20, 10 -28, 0 -28 Z" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                     <circle cx="0" cy="-14" r="5" fill="#ffffff" />
                   </g>
                 );
               }

               if (asset.type === 'explosion') {
                 const ringR = interpolate(frame - start, [0, 20], [0, 90], { extrapolateRight: 'clamp', easing: Easing.out(Easing.exp) });
                 const opacity = interpolate(frame - start, [0, 25], [1, 0], { extrapolateRight: 'clamp' });
                 return (
                   <g key={`asset-${i}`} transform={`translate(${p.x}, ${p.y})`} opacity={opacity}>
                     <circle cx="0" cy="0" r={ringR} fill="none" stroke="#f59e0b" strokeWidth={15 * opacity} style={{ filter: 'blur(8px)' }} />
                     <circle cx="0" cy="0" r={ringR * 0.8} fill="none" stroke="#ffffff" strokeWidth={6 * opacity} />
                     <circle cx="0" cy="0" r={ringR * 0.3} fill="#ef4444" style={{ filter: 'blur(10px)' }} />
                   </g>
                 );
               }
               return null;
            })}

            {labels.map((l: any, i: number) => {
              const start = Number(l.startFrame ?? 0);
              const duration = Number(l.duration ?? 300);
              const end = start + duration;
              if (frame < start || (!l.pinned && frame > end)) return null;
              const p = project([Number(l.lng), Number(l.lat)]);
              if (!p) return null;

              const intro = revealEase(clamp((frame - start) / 20));
              const outro = !l.pinned && frame > end - 15 ? clamp((end - frame) / 15) : 1;
              const alpha = intro * outro;
              const scale = 0.72 + 0.28 * intro;
              const txt = String(l.text || '').toUpperCase();
              const size = Number(l.size ?? 24);
              const color = l.color || '#ffffff';
              const bg = l.bg || '#f472b6';
              const font = l.font || 'sans-serif';

              return (
                <g key={`lbl-${i}`} transform={`translate(${p.x}, ${p.y}) scale(${scale})`} opacity={alpha}>
                  {l.style === 'callout' && (
                    <>
                      <circle cx="0" cy="0" r="6" fill={color} style={{ filter: l.glow !== false ? `drop-shadow(0 0 12px ${color})` : 'none' }} />
                      <path d={`M 0 0 L 30 -40 L ${30 + txt.length * (size*0.6)} -40`} fill="none" stroke={color} strokeWidth="3" strokeDasharray="500" strokeDashoffset={500 * (1 - intro)} />
                      {intro > 0.5 && <text x="40" y="-48" fill={color} fontSize={size} fontWeight="900" fontFamily={font}>{txt}</text>}
                    </>
                  )}
                  {l.style === 'geo-pin' && (
                    <g transform={`translate(-${(txt.length * (size*0.6) + 36)/2}, -${size + 28})`}>
                      <rect width={txt.length * (size*0.6) + 36} height={size + 16} rx="10" fill={bg} style={{ filter: l.glow !== false ? `drop-shadow(0 0 20px ${color})` : 'none' }} />
                      <path d={`M ${(txt.length * (size*0.6) + 36)/2 - 6} ${size + 16} L ${(txt.length * (size*0.6) + 36)/2} ${size + 24} L ${(txt.length * (size*0.6) + 36)/2 + 6} ${size + 16} Z`} fill={bg} />
                      <text x={(txt.length * (size*0.6) + 36)/2} y={(size + 16)/2 + 2} fill={color} fontSize={size} fontWeight="900" fontFamily={font} textAnchor="middle" dominantBaseline="middle">{txt}</text>
                    </g>
                  )}
                  {l.style === 'pill' && (
                    <g transform={`translate(-${(txt.length * (size*0.6) + 40)/2}, -${(size + 16)/2})`}>
                      <rect width={txt.length * (size*0.6) + 40} height={size + 16} rx="8" fill={bg} style={{ filter: l.glow !== false ? `drop-shadow(0 0 20px ${color})` : 'none' }} />
                      <text x={(txt.length * (size*0.6) + 40)/2} y={(size + 16)/2 + 2} fill={color} fontSize={size} fontWeight="900" fontFamily={font} textAnchor="middle" dominantBaseline="middle">{txt}</text>
                    </g>
                  )}
                  {l.style === 'minimal' && (
                    <>
                      <circle cx="0" cy="0" r="6" fill={color} style={{ filter: l.glow !== false ? `drop-shadow(0 0 12px ${color})` : 'none' }} />
                      <text x="16" y="2" fill={color} fontSize={size} fontWeight="900" fontFamily={font} dominantBaseline="middle">{txt}</text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </>
      )}
    </AbsoluteFill>
  );
};

export default MapAnimation;