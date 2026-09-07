import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
  useVideoConfig,
  delayRender,
  continueRender,
  getRemotionEnvironment,
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
  
  const blendOverlayRef = useRef<HTMLCanvasElement>(null);
  const uiOverlayRef = useRef<HTMLCanvasElement>(null);
  
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [initialHandle] = useState(() => delayRender('Booting Dual-Canvas Engine...'));
  
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();

  const totalFrames = timeline?.totalFrames || 300;

  const validKeyframes = (timeline?.cameraKeyframes || []).filter(
    (k: any) => k && typeof k.frame === 'number' && (typeof k.lng === 'number' || typeof k.longitude === 'number')
  ).map((k: any) => ({
    frame: k.frame, lng: k.lng !== undefined ? k.lng : (k.longitude !== undefined ? k.longitude : 127.0), lat: k.lat !== undefined ? k.lat : (k.latitude !== undefined ? k.latitude : 38.0),
    zoom: k.zoom !== undefined ? k.zoom : 1.2, pitch: Math.min(60, k.pitch !== undefined ? k.pitch : 0), bearing: k.bearing !== undefined ? k.bearing : 0
  }));

  const fallbackKeyframes: any[] = [
    { frame: 0, lng: 79, lat: 22, zoom: 4.2, pitch: 15, bearing: 0 },
    { frame: totalFrames, lng: 88, lat: 31, zoom: 5.5, pitch: 40, bearing: 0 }
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
    const buildRasterStyle = (url: string, sat: number, con: number, bMin: number, bMax: number) => ({
      version: 8, sources: { raster_tiles: { type: 'raster', tiles: [url], tileSize: 256 } },
      layers: [{ id: 'base-layer', type: 'raster', source: 'raster_tiles', paint: { 'raster-saturation': sat, 'raster-contrast': con, 'raster-brightness-min': bMin, 'raster-brightness-max': bMax } }]
    });
    switch (styleId) {
      case 'dark': return buildRasterStyle('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', -1.0, 0.4, 0.02, 0.25);
      case 'light': return buildRasterStyle('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', 0, 0, 0, 1);
      case 'street': return buildRasterStyle('https://tile.openstreetmap.org/{z}/{x}/{y}.png', 0, 0, 0, 1);
      case 'satellite': default: return buildRasterStyle('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', -0.85, 0.25, 0.15, 0.8);
    }
  };

  useLayoutEffect(() => {
    if (!mapContainer.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current, 
      fadeDuration: 0, 
      maxTileCacheSize: 10000,
      preserveDrawingBuffer: true, 
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
      // 🔥 TS FIX: Added strict string types to url and resourceType
      transformRequest: (url: string, resourceType: string) => {
        if (resourceType === 'Tile' && url.startsWith('http')) {
          return {
            url: url + (url.includes('?') ? '&' : '?') + 'nocache=' + Date.now(),
            credentials: 'omit'
          };
        }
        return { url };
      }
    } as any); 

    map.on('load', () => { mapRef.current = map; setMapLoaded(true); continueRender(initialHandle); });
    return () => map.remove();
  }, [mapStyle]);

  useLayoutEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    let tileLockHandle: number | null = null;
    
    if (isRendering) tileLockHandle = delayRender(`Awaiting GPU Paint Frame ${frame}`);
    
    mapRef.current.jumpTo({ center: [currentLng, currentLat], zoom: currentZoom, pitch: currentPitch, bearing: currentBearing });

    if (isRendering && tileLockHandle !== null) {
      const lock = tileLockHandle;
      const release = () => setTimeout(() => continueRender(lock), 400); 
      if (mapRef.current.isStyleLoaded() && mapRef.current.areTilesLoaded()) release();
      else mapRef.current.once('idle', release);
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

  const getCanvasBlendMode = (mode: string) => {
    const m = (mode || 'screen').toLowerCase();
    if (m === 'multiply') return 'multiply';
    if (m === 'overlay') return 'overlay';
    if (m === 'add' || m === 'color dodge') return 'color-dodge';
    return 'screen'; 
  };

  useLayoutEffect(() => {
    if (!blendOverlayRef.current || !uiOverlayRef.current || !mapLoaded) return;
    
    const blendCtx = blendOverlayRef.current.getContext('2d');
    const uiCtx = uiOverlayRef.current.getContext('2d');
    if (!blendCtx || !uiCtx) return;
    
    blendCtx.clearRect(0, 0, width, height);
    blendCtx.lineJoin = 'round'; blendCtx.lineCap = 'round';

    uiCtx.clearRect(0, 0, width, height);
    uiCtx.lineJoin = 'round'; uiCtx.lineCap = 'round';

    rawCountries.forEach((entity: any) => {
      if (frame < (entity.startFrame || 0)) return;
      if (takeovers.some((t: any) => (t.target || '').toLowerCase() === (entity.name || entity.country || '').toLowerCase() && frame >= (t.startFrame || 0))) return;

      const eName = entity.name || entity.country || entity.state;
      const { path } = getGeometryFromSource(eName, [worldData, statesData]);
      if (!path) return;
      const p2d = new Path2D(path);

      blendCtx.save();
      blendCtx.globalCompositeOperation = getCanvasBlendMode(entity.blendMode);
      
      if (entity.dropShadow !== false) {
        blendCtx.save(); blendCtx.translate(0, 15); blendCtx.shadowColor = 'rgba(0,0,0,0.95)'; blendCtx.shadowBlur = 15; blendCtx.fillStyle = '#000000'; blendCtx.fill(p2d); blendCtx.restore();
      }
      if (entity.enableGlow !== false) {
        blendCtx.save(); blendCtx.shadowColor = entity.color || '#3b82f6'; blendCtx.shadowBlur = entity.glowIntensity !== undefined ? entity.glowIntensity : 20; blendCtx.globalAlpha = 0.55; blendCtx.fillStyle = entity.color || '#3b82f6'; blendCtx.fill(p2d); blendCtx.restore();
      }
      
      blendCtx.globalAlpha = 0.9; blendCtx.fillStyle = entity.color || '#3b82f6'; blendCtx.fill(p2d);
      if (entity.strokeWidth) { blendCtx.lineWidth = entity.strokeWidth; blendCtx.strokeStyle = entity.strokeColor || '#fff'; blendCtx.stroke(p2d); }
      blendCtx.restore();
    });

    takeovers.forEach((takeover: any) => {
      const start = takeover.startFrame || 0;
      if (frame < start) return;

      const targetGeo = getGeometryFromSource(takeover.target, [worldData]);
      if (!targetGeo.path) return;
      const p2d = new Path2D(targetGeo.path);

      const targetData: any = rawCountries.find((c: any) => (c.name || c.country) === takeover.target) || {};
      const targetColor = targetData.color || '#1e3a8a';
      const invaderColor = takeover.color || '#ef4444';
      
      blendCtx.save();
      blendCtx.globalCompositeOperation = getCanvasBlendMode(targetData.blendMode);
      blendCtx.fillStyle = targetColor; blendCtx.globalAlpha = 0.85; blendCtx.fill(p2d);
      
      const duration = Math.max(takeover.duration || 120, 90);
      const radius = interpolate(frame - start, [0, duration], [0, Math.max(width, height) * 1.5], { extrapolateRight: 'clamp', easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
      
      const invGeo = getGeometryFromSource(takeover.attacker || takeover.invader, [worldData]);
      let cx = width/2; let cy = height/2;
      if (invGeo.center) { const p = mapRef.current?.project(invGeo.center); if (p) { cx = p.x; cy = p.y; } }

      blendCtx.beginPath(); blendCtx.arc(cx, cy, radius, 0, Math.PI * 2); blendCtx.clip();
      blendCtx.fillStyle = invaderColor; blendCtx.globalAlpha = 0.9; blendCtx.fill(p2d);
      blendCtx.restore();
    });

    arrows.forEach((arrow: any) => {
      const startF = arrow.startFrame || arrow.frame || 0;
      if (frame < startF) return;
      
      let c1 = arrow.origin; let c2 = arrow.target;
      if (arrow.sourceName) c1 = getGeometryFromSource(arrow.sourceName, [worldData]).center;
      if (arrow.targetName) c2 = getGeometryFromSource(arrow.targetName, [worldData]).center;
      if (!c1 || !c2) return;
      
      const p1 = mapRef.current?.project(c1 as [number, number]); const p2 = mapRef.current?.project(c2 as [number, number]);
      if (!p1 || !p2) return;

      const dx = p2.x - p1.x; const dy = p2.y - p1.y; const dist = Math.sqrt(dx*dx + dy*dy);
      const arcH = dist * 0.38; const midX = (p1.x+p2.x)/2 + (-dy/dist)*arcH; const midY = (p1.y+p2.y)/2 + (dx/dist)*arcH;
      
      const pathD = `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`;
      const p2d = new Path2D(pathD);
      const t = Math.max(0, Math.min(1, Easing.bezier(0.25, 0.1, 0.25, 1)((frame - startF) / 45)));

      uiCtx.save();
      uiCtx.shadowColor = '#000000'; uiCtx.shadowBlur = 12; uiCtx.shadowOffsetY = 10;
      const approxLen = dist * 1.2;
      uiCtx.setLineDash([approxLen]);
      uiCtx.lineDashOffset = approxLen - (t * approxLen);

      if (arrow.type === 'missile') {
         uiCtx.strokeStyle = '#ef4444'; uiCtx.lineWidth = 8; uiCtx.globalAlpha = 0.3; uiCtx.stroke(p2d);
         uiCtx.strokeStyle = '#ffffff'; uiCtx.lineWidth = 3; uiCtx.globalAlpha = 0.9; uiCtx.stroke(p2d);
      } else {
         const sourceData = rawCountries.find((c: any) => (c.name || c.country || '').toLowerCase() === (arrow.sourceName || '').toLowerCase());
         uiCtx.strokeStyle = arrow.color || sourceData?.color || '#ef4444'; uiCtx.lineWidth = 6; uiCtx.stroke(p2d);
         uiCtx.setLineDash([]); uiCtx.strokeStyle = '#ffffff'; uiCtx.lineWidth = 2; uiCtx.stroke(p2d);
      }
      uiCtx.restore();
    });

    assets.forEach((asset: any) => {
      if (frame < asset.startFrame) return;
      const p = mapRef.current?.project([asset.lng, asset.lat]);
      if (!p) return;

      if (asset.type === 'pin') {
         const dropY = interpolate(frame - asset.startFrame, [0, 15], [-50, 0], { extrapolateRight: 'clamp', easing: Easing.bounce });
         uiCtx.save();
         uiCtx.translate(p.x, p.y + dropY);
         uiCtx.shadowColor = 'rgba(0,0,0,0.9)'; uiCtx.shadowBlur = 12; uiCtx.shadowOffsetY = 10;
         uiCtx.fillStyle = '#ef4444'; uiCtx.strokeStyle = '#ffffff'; uiCtx.lineWidth = 2;
         const path = new Path2D("M0 -24 C -8 -24, -14 -18, -14 -10 C -14 0, 0 12, 0 12 C 0 12, 14 0, 14 -10 C 14 -18, 8 -24, 0 -24 Z");
         uiCtx.fill(path); uiCtx.stroke(path);
         uiCtx.beginPath(); uiCtx.arc(0, -12, 4, 0, Math.PI * 2); uiCtx.fillStyle = '#fff'; uiCtx.fill();
         uiCtx.restore();
      } else if (asset.type === 'explosion') {
         const ringR = interpolate(frame - asset.startFrame, [0, 20], [0, 80], { extrapolateRight: 'clamp', easing: Easing.out(Easing.exp) });
         const opacity = interpolate(frame - asset.startFrame, [0, 20], [1, 0], { extrapolateRight: 'clamp' });
         uiCtx.save();
         uiCtx.translate(p.x, p.y); uiCtx.globalAlpha = opacity;
         uiCtx.beginPath(); uiCtx.arc(0, 0, ringR, 0, Math.PI * 2); uiCtx.strokeStyle = '#f59e0b'; uiCtx.lineWidth = 15; uiCtx.stroke();
         uiCtx.beginPath(); uiCtx.arc(0, 0, ringR * 0.8, 0, Math.PI * 2); uiCtx.strokeStyle = '#ffffff'; uiCtx.lineWidth = 5; uiCtx.stroke();
         uiCtx.beginPath(); uiCtx.arc(0, 0, ringR * 0.3, 0, Math.PI * 2); uiCtx.fillStyle = '#ef4444'; uiCtx.fill();
         uiCtx.restore();
      }
    });

    labels.forEach((l: any) => {
      if (frame < (l.startFrame || 0)) return;
      if (frame > (l.startFrame + (l.duration || 150)) && !l.pinned) return;
      const p = mapRef.current?.project([l.lng, l.lat]);
      if (!p) return;
      
      uiCtx.save();
      uiCtx.translate(p.x, p.y - 10);
      if (l.glow) { uiCtx.shadowColor = '#38bdf8'; uiCtx.shadowBlur = 20; }
      uiCtx.fillStyle = l.bg || 'rgba(0,0,0,0.7)';
      if (uiCtx.roundRect) {
        uiCtx.beginPath(); uiCtx.roundRect(-60, -20, 120, 36, 8); uiCtx.fill();
      } else {
        uiCtx.fillRect(-60, -20, 120, 36);
      }
      
      uiCtx.fillStyle = l.color || '#ffffff';
      uiCtx.font = `bold ${l.size !== undefined ? l.size : 24}px sans-serif`;
      uiCtx.textAlign = 'center'; uiCtx.textBaseline = 'middle';
      uiCtx.fillText(l.text, 0, -2);
      uiCtx.restore();
    });

  }, [frame, currentLng, currentLat, currentZoom, currentPitch, currentBearing, mapLoaded, rawCountries, takeovers, arrows, assets, labels]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#040711', overflow: 'hidden' }}>
      <div ref={mapContainer} style={{ width: `${width}px`, height: `${height}px`, position: 'absolute', top: 0, left: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, transparent 40%, rgba(4, 7, 17, 0.88) 100%)', pointerEvents: 'none', zIndex: 10 }} />

      <canvas id="vector-blend-overlay" ref={blendOverlayRef} width={width} height={height} style={{ position: 'absolute', inset: 0, zIndex: 60, pointerEvents: 'none', mixBlendMode: 'screen' }} />
      <canvas id="vector-ui-overlay" ref={uiOverlayRef} width={width} height={height} style={{ position: 'absolute', inset: 0, zIndex: 61, pointerEvents: 'none' }} />

      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'auto', zIndex: 65 }}>
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
    </AbsoluteFill>
  );
};