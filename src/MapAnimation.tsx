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

const generateGraticule = () => {
  const features = [];
  for (let lng = -180; lng <= 180; lng += 15) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[lng, -90], [lng, 90]] } });
  for (let lat = -80; lat <= 80; lat += 15) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[-180, lat], [180, lat]] } });
  return { type: 'FeatureCollection', features };
};

export const MapAnimation: React.FC<{
  timeline: any;
  isLiveEditMode?: boolean;
  mapStyle?: string;
  mapProjection?: 'mercator' | 'globe';
  showGrid?: boolean;
  onCameraChange?: (cam: any) => void;
}> = ({ timeline, isLiveEditMode = false, mapStyle = 'satellite', mapProjection = 'mercator', showGrid = true, onCameraChange }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onCameraChangeRef = useRef(onCameraChange);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [initialHandle] = useState(() => delayRender('Booting Cinematic Engine'));
  const [extraData, setExtraData] = useState<any[]>([]);
  
  const pathCache = useRef<Record<string, { path: string, center: [number, number] | null, isLine: boolean }>>({});
  const lastCameraHash = useRef<string>('');
  const isUserInteracting = useRef(false);
  const lastFrame = useRef(-1);

  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();
  const totalFrames = Math.max(1, timeline?.totalFrames || 300);

  const rawCountries = timeline?.highlightCountries || [];
  const takeovers = timeline?.takeovers || [];
  const arrows = timeline?.arrows || [];
  const labels = timeline?.labels || [];
  const assets = timeline?.assets || [];

  const stars = useMemo(() => Array.from({ length: 300 }).map(() => ({
    x: Math.random() * 100, y: Math.random() * 100, r: Math.random() * 1.5 + 0.2, o: Math.random() * 0.8 + 0.2
  })), []);

  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);

  useEffect(() => {
    let alive = true;
    const fetchGeoData = async () => {
      const data: any[] = [];
      try {
        const [statRes, rivRes] = await Promise.all([ fetch(GEOJSON_RESOURCES.states), fetch(GEOJSON_RESOURCES.rivers) ]);
        if (statRes.ok) data.push(await statRes.json());
        if (rivRes.ok) data.push(await rivRes.json());
      } catch (e) { }
      if (alive) setExtraData(data);
    };
    fetchGeoData();
    return () => { alive = false; };
  }, []);

  const getStyleDef = (styleId: string): any => {
    if (styleId === 'street') return { version: 8, sources: { r: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } }, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#040711' } }, { id: 'b', type: 'raster', source: 'r' }] };
    if (styleId === 'light') return { version: 8, sources: { r: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } }, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#040711' } }, { id: 'b', type: 'raster', source: 'r' }] };
    if (styleId === 'natural-earth') return { version: 8, sources: { r: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } }, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#040711' } }, { id: 'b', type: 'raster', source: 'r' }] };
    
    return {
      version: 8,
      sources: { r: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#040711' } }, 
        { id: 'b', type: 'raster', source: 'r' }
      ]
    };
  };

  const validKeyframes = useMemo(() => (timeline?.cameraKeyframes || [])
    .filter((k: any) => k && Number.isFinite(Number(k.frame)))
    .map((k: any) => ({
      frame: Number(k.frame), lng: Number(k.lng ?? 127), lat: Number(k.lat ?? 38), zoom: Number(k.zoom ?? 1.2), pitch: clamp(Number(k.pitch ?? 0), 0, 85), bearing: normalizeBearing(Number(k.bearing ?? 0)),
    })).sort((a: any, b: any) => a.frame - b.frame), [timeline?.cameraKeyframes]);

  const keyframes = validKeyframes.length ? validKeyframes : [
    { frame: 0, lng: 79, lat: 22, zoom: 4.2, pitch: 0, bearing: 0 },
    { frame: totalFrames, lng: 88, lat: 31, zoom: 5.5, pitch: 0, bearing: 0 },
  ];

  const camera = useMemo(() => {
    let cam = keyframes[keyframes.length - 1];
    if (keyframes.length === 1 || frame <= keyframes[0].frame) cam = keyframes[0];
    else {
      for (let i = 0; i < keyframes.length - 1; i++) {
        const a = keyframes[i], b = keyframes[i + 1];
        if (frame >= a.frame && frame <= b.frame) {
          const p = ease(clamp((frame - a.frame) / Math.max(1, b.frame - a.frame)));
          cam = {
            lng: a.lng + (b.lng - a.lng) * p, lat: a.lat + (b.lat - a.lat) * p, zoom: a.zoom + (b.zoom - a.zoom) * p, pitch: a.pitch + (b.pitch - a.pitch) * p, bearing: interpolateBearing(a.bearing, b.bearing, p),
          };
          break;
        }
      }
    }
    
    if (mapProjection === 'mercator') cam.pitch = 0;
    return cam;
  }, [keyframes, frame, mapProjection]);

  const currentCameraHash = `${camera.lng.toFixed(4)}_${camera.lat.toFixed(4)}_${camera.zoom.toFixed(2)}_${camera.pitch.toFixed(1)}_${camera.bearing.toFixed(1)}`;
  if (lastCameraHash.current !== currentCameraHash) {
    pathCache.current = {};
    lastCameraHash.current = currentCameraHash;
  }

  const isFrameChange = lastFrame.current !== frame;
  lastFrame.current = frame;
  if (mapRef.current && !isUserInteracting.current && (!isLiveEditMode || isRendering || isFrameChange)) {
    mapRef.current.jumpTo({ center: [camera.lng, camera.lat], zoom: camera.zoom, pitch: camera.pitch, bearing: camera.bearing });
  }

  useLayoutEffect(() => {
    if (!mapContainer.current) return;
    const m = new maplibregl.Map({
      container: mapContainer.current, style: getStyleDef(mapStyle), center: [camera.lng, camera.lat], zoom: camera.zoom, pitch: camera.pitch, bearing: camera.bearing,
      interactive: isLiveEditMode, attributionControl: false, fadeDuration: 0, renderWorldCopies: false,
      pixelRatio: (typeof window !== 'undefined' && window.innerWidth < 1024) ? 1 : (isRendering ? 2 : 1), 
      maxTileCacheSize: 10000, preserveDrawingBuffer: true, dragPan: { inertia: false }, dragRotate: { inertia: false }
    } as any);

    const lockInteractions = () => { isUserInteracting.current = true; };
    const unlockInteractions = () => { m.stop(); isUserInteracting.current = false; };
    m.on('dragstart', lockInteractions); m.on('dragend', unlockInteractions);
    m.on('zoomstart', lockInteractions); m.on('zoomend', unlockInteractions);
    m.on('pitchstart', lockInteractions); m.on('pitchend', unlockInteractions);
    
    m.on('move', () => { if (onCameraChangeRef.current && isUserInteracting.current) onCameraChangeRef.current({ lat: m.getCenter().lat, lng: m.getCenter().lng, zoom: m.getZoom(), pitch: m.getPitch(), bearing: normalizeBearing(m.getBearing()) }); });

    m.on('load', () => { 
      mapRef.current = m; (window as any).__mapInstance = m;
      m.addSource('graticule', { type: 'geojson', data: generateGraticule() as any });
      m.addLayer({ id: 'graticule-line', type: 'line', source: 'graticule', paint: { 'line-color': 'rgba(255,255,255,0.15)', 'line-width': 1, 'line-dasharray': [4, 4] } });
      try { if (m.setProjection) m.setProjection({ type: mapProjection }); } catch(e) {}
      setMapLoaded(true); try { continueRender(initialHandle); } catch (e) {}
    });

    return () => { if ((window as any).__mapInstance === m) (window as any).__mapInstance = null; m.remove(); mapRef.current = null; };
  }, []); 

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const applyMapState = () => {
      try {
        if (map.setProjection) map.setProjection({ type: mapProjection });
        if (mapProjection === 'mercator') map.setPitch(0);
      } catch (e) {}

      if (!map.getSource('graticule')) {
        map.addSource('graticule', { type: 'geojson', data: generateGraticule() as any });
      }
      if (!map.getLayer('graticule-line')) {
        map.addLayer({ id: 'graticule-line', type: 'line', source: 'graticule', paint: { 'line-color': 'rgba(255,255,255,0.15)', 'line-width': 1, 'line-dasharray': [4, 4] } });
      }
      map.setLayoutProperty('graticule-line', 'visibility', showGrid ? 'visible' : 'none');
    };

    map.setStyle(getStyleDef(mapStyle));
    map.once('style.load', applyMapState);
  }, [mapStyle, mapProjection, showGrid, mapLoaded]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (isLiveEditMode) { map.boxZoom.enable(); map.dragPan.enable(); map.dragRotate.enable(); map.keyboard.enable(); map.doubleClickZoom.enable(); map.touchZoomRotate.enable(); map.scrollZoom.enable(); } 
    else { map.boxZoom.disable(); map.dragPan.disable(); map.dragRotate.disable(); map.keyboard.disable(); map.doubleClickZoom.disable(); map.touchZoomRotate.disable(); map.scrollZoom.disable(); }
  }, [isLiveEditMode]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    let lock: number | null = null;
    if (isRendering) lock = delayRender(`Rendering frame ${frame}`);
    
    if (lock !== null) {
      const release = () => setTimeout(() => { try { continueRender(lock!); } catch(e) {} }, 40);
      if (map.areTilesLoaded() && !map.isMoving()) release(); else map.once('idle', release);
    }
  }, [camera, mapLoaded, isRendering, isLiveEditMode, frame]);

  const project = (coord: [number, number]) => {
    if (!mapRef.current) return null;
    try {
      const p = mapRef.current.project(coord as any);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      return p;
    } catch { return null; }
  };

  const isVisibleOnGlobe = (coord: [number, number] | null) => {
    if (!coord || mapProjection !== 'globe') return true;
    const [lon, lat] = coord;
    const r = Math.PI / 180;
    
    const px = Math.cos(lat * r) * Math.cos(lon * r);
    const py = Math.cos(lat * r) * Math.sin(lon * r);
    const pz = Math.sin(lat * r);

    const cx = Math.cos(camera.lat * r) * Math.cos(camera.lng * r);
    const cy = Math.cos(camera.lat * r) * Math.sin(camera.lng * r);
    const cz = Math.sin(camera.lat * r);

    const dot = px * cx + py * cy + pz * cz;
    return dot > 0.05; // Balanced threshold preventing high-zoom clipping tearing
  };

  const geometryFor = (name: string) => {
    if (!name || !mapLoaded) return { path: '', center: null as [number, number] | null, isLine: false, isVisible: false };
    let searchName = String(name).trim().toLowerCase();
    
    if (searchName === 'usa' || searchName === 'us' || searchName === 'united states') {
      searchName = 'united states of america';
    }

    if (pathCache.current[searchName] && pathCache.current[searchName].path !== '') {
      const cached = pathCache.current[searchName]; return { ...cached, isVisible: isVisibleOnGlobe(cached.center) };
    }

    const hardcodedCenters: Record<string, [number, number]> = {
      'france': [2.3522, 48.8566],
      'united states of america': [-98.5795, 39.8283],
      'uk': [-3.4359, 55.3781],
      'united kingdom': [-3.4359, 55.3781]
    };

    let geom: any = null;
    if (['india', 'ind', 'bharat'].includes(searchName)) geom = (indiaData as any).geometry || (indiaData as any).features?.[0]?.geometry || indiaData;
    
    if (!geom) {
      for (const src of [worldData, ...extraData]) {
        const match = (src?.features || []).find((f: any) => {
          const names = [f.properties?.ADMIN, f.properties?.admin, f.properties?.NAME, f.properties?.name].filter(Boolean).map(x => String(x).toLowerCase());
          return names.includes(searchName) || names.some(x => x === searchName || x.includes(searchName) || searchName.includes(x));
        });
        if (match) { geom = match.geometry; break; }
      }
    }
    if (!geom) return { path: '', center: null, isLine: false, isVisible: false };

    const lines: number[][][] = [];
    const extractCoords = (coords: any) => {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0][0] === 'number') lines.push(coords); else coords.forEach(extractCoords);
    };
    if (geom.coordinates) extractCoords(geom.coordinates);

    const isLine = geom.type.includes('Line');
    let path = ''; let sumLng = 0, sumLat = 0, pointCount = 0;

    for (const line of lines) {
      let first = true, lastPx = { x: -999, y: -999 }, lastRawLng = 0;
      for (const coord of line) {
        if (!coord || coord.length < 2) continue;
        const rawLng = Number(coord[0]);
        sumLng += rawLng; sumLat += Number(coord[1]); pointCount++;
        const p = project([rawLng, Number(coord[1])]);
        if (!p) { first = true; continue; }
        
        let isAntimeridianCross = false;
        if (!first && Math.abs(rawLng - lastRawLng) > 100) isAntimeridianCross = true;
        const dist = Math.hypot(p.x - lastPx.x, p.y - lastPx.y);
        if (!first && dist < 1.5 && !isAntimeridianCross) continue;

        if (first || isAntimeridianCross) path += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        else path += `L ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        first = false; lastPx = { x: p.x, y: p.y }; lastRawLng = rawLng;
      }
      if (!isLine && path) path += 'Z ';
    }
    
    let center = pointCount > 0 ? [sumLng / pointCount, sumLat / pointCount] as [number, number] : null;
    if (hardcodedCenters[searchName]) center = hardcodedCenters[searchName];

    const result = { path, center, isLine };
    if (path !== '') pathCache.current[searchName] = result;
    return { ...result, isVisible: isVisibleOnGlobe(center) };
  };

  const cssBlendModes = ['normal', 'multiply', 'screen', 'overlay', 'color-dodge'];

  return (
    <AbsoluteFill style={{ backgroundColor: '#040711', overflow: 'hidden' }}>

      {mapProjection === 'globe' && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}>
          {stars.map((s, i) => <circle key={`s-${i}`} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#ffffff" opacity={s.o} />)}
        </svg>
      )}

      <div style={{ position: 'absolute', inset: 0, width, height }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%', pointerEvents: 'auto', opacity: 1 }} onWheel={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} />
        
        {mapLoaded && (
          <>
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
              <defs>
                <filter id="tactical-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#000000" floodOpacity="0.85" /></filter>
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
                  const { path, isLine, isVisible } = geometryFor(c.name);
                  if (!path || isLine || !isVisible) return null;
                  return <path key={`shadow-${i}`} d={path} fill="#000" opacity={0.6} transform="translate(0, 15)" style={{ filter: 'blur(15px)' }} />;
                })}

                {rawCountries.map((c: any, i: number) => {
                  const start = Number(c.startFrame ?? 0), end = Number(c.endFrame ?? totalFrames);
                  if (frame < start || frame > end) return null;
                  const mode = ['screen', 'multiply', 'overlay', 'color-dodge'].includes(c.blendMode) ? c.blendMode : 'normal';
                  if ((mode === 'color-dodge' ? 'color-dodge' : mode) !== blendGroup) return null;
                  
                  const { path, isLine, center, isVisible } = geometryFor(c.name);
                  if (!path || !isVisible) return null;
                  
                  const centerProj = center ? project(center) : null;
                  const t = revealEase(clamp((frame - start) / Number(c.fadeInDuration ?? 30)));
                  
                  let glowFilter = 'none';
                  if (c.enableGlow !== false) glowFilter = `drop-shadow(0 0 ${c.glowIntensity ?? 20}px ${c.color || '#3b82f6'})`;

                  if (isLine || c.noFill) {
                    const trimT = revealEase(clamp((frame - start) / Number(c.trimDuration ?? 45)));
                    return (
                      <g key={`eline-${i}`} opacity={t}>
                        {c.revealStyle === 'ink' && (
                          <mask id={`mask-ink-line-${i}`}>
                            <radialGradient id={`ink-fade-line-${i}`}><stop offset="0%" stopColor="white" /><stop offset="70%" stopColor="white" /><stop offset="100%" stopColor="black" /></radialGradient>
                            <circle cx={centerProj?.x ?? width/2} cy={centerProj?.y ?? height/2} r={Math.max(0.1, Math.max(width, height) * 1.5 * t)} fill={`url(#ink-fade-line-${i})`} style={{ filter: 'url(#ink-displacement)' }} />
                          </mask>
                        )}
                        <g mask={c.revealStyle === 'ink' ? `url(#mask-ink-line-${i})` : undefined}>
                          <path d={path} fill="none" stroke={c.color || '#3b82f6'} strokeWidth={c.strokeWidth || 4} strokeLinecap="round" strokeLinejoin="round" pathLength="100" strokeDasharray={c.revealStyle === 'trim' ? "100" : "none"} strokeDashoffset={c.revealStyle === 'trim' ? 100 * (1 - trimT) : 0} style={{ filter: glowFilter !== 'none' ? glowFilter : undefined }} />
                        </g>
                      </g>
                    );
                  }

                  return (
                    <g key={`epoly-${i}`} opacity={t}>
                      {c.revealStyle === 'ink' && (
                        <mask id={`mask-ink-${i}`}>
                          <radialGradient id={`ink-fade-${i}`}><stop offset="0%" stopColor="white" /><stop offset="70%" stopColor="white" /><stop offset="100%" stopColor="black" /></radialGradient>
                          <circle cx={centerProj?.x ?? width/2} cy={centerProj?.y ?? height/2} r={Math.max(0.1, Math.max(width, height) * 1.5 * t)} fill={`url(#ink-fade-${i})`} style={{ filter: 'url(#ink-displacement)' }} />
                        </mask>
                      )}
                      <g mask={c.revealStyle === 'ink' ? `url(#mask-ink-${i})` : undefined}>
                        {c.enableGlow !== false && mode !== 'multiply' && <path d={path} fill={c.color || '#3b82f6'} opacity={0.5} style={{ filter: `blur(${c.glowIntensity || 20}px)` }} />}
                        <path d={path} fill={c.color || '#3b82f6'} />
                        {(c.strokeWidth !== undefined ? c.strokeWidth : 2) > 0 && <path d={path} fill="none" stroke={c.strokeColor || '#fff'} strokeWidth={c.strokeWidth ?? 2} />}
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
                  if (!targetGeo.path || !targetGeo.isVisible) return null;
                  const attackerGeo = geometryFor(t.attacker);
                  const p = attackerGeo.center ? project(attackerGeo.center) : null;
                  const radius = Math.max(width, height) * 1.7 * revealEase(clamp((frame - start) / Math.max(1, Number(t.duration ?? 90))));
                  
                  return (
                    <g key={`tk-${i}`}>
                       {tBlend === blendGroup && <path d={targetGeo.path} fill={targetData.color || '#1e3a8a'} opacity={0.85} />}
                       {iBlend === blendGroup && (
                         <React.Fragment>
                           <mask id={`tk-mask-${i}`}>
                             <radialGradient id={`tk-fade-${i}`}><stop offset="0%" stopColor="white" /><stop offset="70%" stopColor="white" /><stop offset="100%" stopColor="black" /></radialGradient>
                             <circle cx={p?.x ?? width/2} cy={p?.y ?? height/2} r={Math.max(0.1, radius)} fill={`url(#tk-fade-${i})`} style={{ filter: 'url(#ink-displacement)' }} />
                           </mask>
                           <path d={targetGeo.path} fill={invaderData.color || t.color || '#ef4444'} mask={`url(#tk-mask-${i})`} opacity={0.95} />
                         </React.Fragment>
                       )}
                    </g>
                  );
                })}
              </svg>
            ))}

            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 30, pointerEvents: 'none', shapeRendering: 'geometricPrecision' }}>
              <defs>
                <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" /><stop offset="70%" stopColor="#ffffff" /><stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>

              {arrows.map((arrow: any, i: number) => {
                const startF = arrow.startFrame || 0;
                if (frame < startF) return null;
                
                let a = arrow.origin, b = arrow.target;
                if (arrow.sourceName) a = geometryFor(arrow.sourceName).center;
                if (arrow.targetName) b = geometryFor(arrow.targetName).center;
                if (!a || !b) return null;
                
                const t = revealEase(clamp((frame - startF) / Number(arrow.duration ?? 45)));
                const sourceColor = rawCountries.find((c: any) => c.name === arrow.sourceName)?.color || '#ef4444';

                const segments = 60; 
                const currentSegments = Math.floor(t * segments); 
                const geoPoints = [];
                
                for (let j = 0; j <= currentSegments; j++) {
                  const ptT = j / segments;
                  const dLng = shortestBearingDelta(a[0], b[0]);
                  let cLng = a[0] + dLng * ptT;
                  cLng = ((cLng + 540) % 360) - 180;
                  
                  const arc = Math.sin(ptT * Math.PI) * (Math.abs(dLng) * 0.15 + 2);
                  const cLat = a[1] + (b[1] - a[1]) * ptT + arc;
                  geoPoints.push([cLng, cLat]);
                }

                let pathD = '';
                let isDrawing = false;
                let lastValidProj: any = null;
                
                for (let j = 0; j <= currentSegments; j++) {
                  const pt = geoPoints[j];
                  const p = project(pt as any);
                  const visible = isVisibleOnGlobe(pt as any);
                  
                  if (!p || !visible) {
                    isDrawing = false; 
                    lastValidProj = null;
                    continue;
                  }

                  if (!isDrawing || !lastValidProj) {
                    pathD += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
                    isDrawing = true;
                  } else {
                    const screenDist = Math.hypot(p.x - lastValidProj.x, p.y - lastValidProj.y);
                    if (screenDist > width * 0.25) {
                      pathD += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
                    } else {
                      pathD += `L ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
                    }
                  }
                  lastValidProj = p;
                }

                let planeJSX = null;
                if (arrow.isFlight && t > 0 && t < 1 && currentSegments > 1) {
                  const pt1 = project(geoPoints[Math.max(0, currentSegments - 2)] as any);
                  const pt2 = project(geoPoints[currentSegments] as any);
                  
                  if (pt1 && pt2 && isVisibleOnGlobe(geoPoints[currentSegments] as any)) {
                    const angle = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x) * (180/Math.PI);
                    planeJSX = (
                      <g transform={`translate(${pt2.x}, ${pt2.y}) rotate(${angle}) scale(1.5)`} filter="url(#tactical-shadow)">
                        <path d="M 0,-6 L 2,-1 L 8,-1 L 8,1 L 2,1 L 0,6 L -2,6 L -1,1 L -6,1 L -8,3 L -8,-3 L -6,-1 L -1,-1 L -2,-6 Z" fill="#ffffff" />
                      </g>
                    );
                  }
                }

                return (
                  <g key={`arr-${i}`} filter="url(#tactical-shadow)">
                    {pathD && (
                      <>
                        <path d={pathD} fill="none" stroke={sourceColor} strokeWidth="14" strokeLinecap="round" opacity={0.3} style={{ filter: 'blur(8px)' }} />
                        <path d={pathD} fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
                      </>
                    )}
                    {planeJSX}
                  </g>
                );
              })}

              {labels.map((l: any, i: number) => {
                const start = Number(l.startFrame ?? 0), duration = Number(l.duration ?? 300), end = start + duration;
                if (frame < start || (!l.pinned && frame > end) || !isVisibleOnGlobe([Number(l.lng), Number(l.lat)])) return null;
                const p = project([Number(l.lng), Number(l.lat)]);
                if (!p) return null;

                const intro = revealEase(clamp((frame - start) / 20));
                const outro = !l.pinned && frame > end - 15 ? clamp((end - frame) / 15) : 1;
                const alpha = intro * outro;
                const scale = 0.72 + 0.28 * intro;
                const txt = String(l.text || '').toUpperCase();
                const size = Number(l.size ?? 24), color = l.color || '#ffffff', bg = l.bg || '#f472b6', font = l.font || 'sans-serif', style = l.style || 'geo-pin';

                return (
                  <g key={`lbl-${i}`} transform={`translate(${p.x}, ${p.y}) scale(${scale})`} opacity={alpha}>
                    {style === 'callout' && (
                      <React.Fragment>
                        <circle cx="0" cy="0" r="6" fill={color} style={{ filter: l.glow !== false ? `drop-shadow(0 0 12px ${color})` : 'none' }} />
                        <path d={`M 0 0 L 30 -40 L ${30 + txt.length * (size*0.6)} -40`} fill="none" stroke={color} strokeWidth="3" strokeDasharray="500" strokeDashoffset={500 * (1 - intro)} />
                        {intro > 0.5 && <text x="40" y="-48" fill={color} fontSize={size} fontWeight="900" fontFamily={font}>{txt}</text>}
                      </React.Fragment>
                    )}
                    {style === 'geo-pin' && (
                      <g transform={`translate(-${(txt.length * (size*0.6) + 36)/2}, -${size + 28})`}>
                        <rect width={txt.length * (size*0.6) + 36} height={size + 16} rx="10" fill={bg} style={{ filter: l.glow !== false ? `drop-shadow(0 0 20px ${color})` : 'none' }} />
                        <path d={`M ${(txt.length * (size*0.6) + 36)/2 - 6} ${size + 16} L ${(txt.length * (size*0.6) + 36)/2} ${size + 24} L ${(txt.length * (size*0.6) + 36)/2 + 6} ${size + 16} Z`} fill={bg} />
                        <text x={(txt.length * (size*0.6) + 36)/2} y={(size + 16)/2 + 2} fill={color} fontSize={size} fontWeight="900" fontFamily={font} textAnchor="middle" dominantBaseline="middle">{txt}</text>
                      </g>
                    )}
                    {style === 'pill' && (
                      <g transform={`translate(-${(txt.length * (size*0.6) + 40)/2}, -${(size + 16)/2})`}>
                        <rect width={txt.length * (size*0.6) + 40} height={size + 16} rx="8" fill={bg} style={{ filter: l.glow !== false ? `drop-shadow(0 0 20px ${color})` : 'none' }} />
                        <text x={(txt.length * (size*0.6) + 40)/2} y={(size + 16)/2 + 2} fill={color} fontSize={size} fontWeight="900" fontFamily={font} textAnchor="middle" dominantBaseline="middle">{txt}</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

export default MapAnimation;