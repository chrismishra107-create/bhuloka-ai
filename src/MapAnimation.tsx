import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing, useVideoConfig, delayRender, continueRender, getRemotionEnvironment } from 'remotion';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import worldData from './world.json';
import indiaData from './india.json';

const GEOJSON_RESOURCES: Record<string, string> = {
  rivers: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson',
  states: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson'
};

const dynamicGeoCache = new Map<string, any>();

export const MapAnimation: React.FC<{ 
  timeline: any;
  isLiveEditMode?: boolean;
  mapStyle?: string;
}> = ({ timeline, isLiveEditMode = false, mapStyle = 'dark-documentary' }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const blendOverlayRef = useRef<HTMLCanvasElement>(null);
  const uiOverlayRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [initialHandle] = useState(() => delayRender('Booting Dual-Canvas Engine...'));
  
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [extraData, setExtraData] = useState<any[]>([]);

  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();

  const totalFrames = timeline?.totalFrames || 300;

  useEffect(() => {
    const loadExtra = async () => {
      const states = await fetchGeographicFeature('states');
      const rivers = await fetchGeographicFeature('rivers');
      setExtraData([states, rivers]);
    };
    loadExtra();
  }, []);

  const fetchGeographicFeature = async (type: string) => {
    if (dynamicGeoCache.has(type)) return dynamicGeoCache.get(type);
    try {
      const res = await fetch(GEOJSON_RESOURCES[type]);
      const data = await res.json();
      dynamicGeoCache.set(type, data);
      return data;
    } catch (err) {
      return { features: [] };
    }
  };

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
         const duration = kfs[i+1].frame - kfs[i].frame;
         const rawProgress = (frame - kfs[i].frame) / duration;
         
         const panEase = Easing.bezier(0.33, 1, 0.68, 1)(rawProgress);
         const zoomEase = Easing.bezier(0.65, 0, 0.35, 1)(rawProgress);
         
         return {
           lng: kfs[i].lng + (kfs[i+1].lng - kfs[i].lng) * panEase,
           lat: kfs[i].lat + (kfs[i+1].lat - kfs[i].lat) * panEase,
           zoom: kfs[i].zoom + (kfs[i+1].zoom - kfs[i].zoom) * zoomEase,
           pitch: kfs[i].pitch + (kfs[i+1].pitch - kfs[i].pitch) * zoomEase,
           bearing: kfs[i].bearing + (kfs[i+1].bearing - kfs[i].bearing) * panEase
         };
      }
    }
    return kfs[kfs.length - 1];
  };

  const currentCam = getInterpolatedCamera();

  const getStyleDef = (styleId: string): any => {
    if (styleId === 'satellite') return { version: 8, sources: { raster_tiles: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } }, layers: [{ id: 'base-layer', type: 'raster', source: 'raster_tiles', paint: { 'raster-saturation': -0.2, 'raster-contrast': 0.1 } }] };
    if (styleId === 'natural-earth') return { version: 8, sources: { raster_tiles: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } }, layers: [{ id: 'base-layer', type: 'raster', source: 'raster_tiles' }] };
    if (styleId === 'light') return { version: 8, sources: { raster_tiles: { type: 'raster', tiles: ['https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } }, layers: [{ id: 'base-layer', type: 'raster', source: 'raster_tiles' }] };
    
    return {
      version: 8,
      sources: { raster_tiles: { type: 'raster', tiles: ['https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } },
      layers: [{ id: 'base-layer', type: 'raster', source: 'raster_tiles', paint: { 'raster-contrast': 0.2, 'raster-brightness-max': 0.8 } }]
    };
  };

  useLayoutEffect(() => {
    if (!mapContainer.current) return;
    const isMobileEdit = isLiveEditMode && typeof window !== 'undefined' && window.innerWidth < 1024;
    
    const map = new maplibregl.Map({
      container: mapContainer.current, 
      fadeDuration: 0, 
      maxTileCacheSize: 10000,
      preserveDrawingBuffer: true, 
      renderWorldCopies: false, 
      pixelRatio: isMobileEdit ? 1 : (isRendering ? 2 : 1), 
      style: getStyleDef(mapStyle), 
      center: [currentCam.lng, currentCam.lat], 
      zoom: currentCam.zoom, 
      pitch: currentCam.pitch, 
      bearing: currentCam.bearing, 
      maxPitch: 60, 
      interactive: false, 
      attributionControl: false
    } as any); 

    map.on('load', () => { mapRef.current = map; setMapLoaded(true); continueRender(initialHandle); });
    return () => map.remove();
  }, [mapStyle, isLiveEditMode]);

  useLayoutEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    let tileLockHandle: number | null = null;
    
    if (isRendering) tileLockHandle = delayRender(`Awaiting GPU Paint Frame ${frame}`);
    
    mapRef.current.jumpTo({ center: [currentCam.lng, currentCam.lat], zoom: currentCam.zoom, pitch: currentCam.pitch, bearing: currentCam.bearing });

    if (isRendering && tileLockHandle !== null) {
      const lock = tileLockHandle;
      const release = () => setTimeout(() => continueRender(lock), 100); 
      if (mapRef.current.areTilesLoaded()) release();
      else mapRef.current.once('idle', release);
    }
  }, [currentCam, mapLoaded, isRendering, frame]);

  const projectClamped = (map: maplibregl.Map, coord: [number, number]) => {
    const p = map.project(coord);
    if (!p || isNaN(p.x) || isNaN(p.y)) return null;
    if (p.x < -3000 || p.x > width + 3000 || p.y < -3000 || p.y > height + 3000) return null;
    return p;
  };

  const getGeometryFromSource = (name: string, dataSources: any[]) => {
    if (!mapRef.current || !mapLoaded || !name) return { path: '', center: null as [number, number] | null, isLine: false };
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
          const candidates = [p.ADMIN, p.admin, p.NAME, p.name, p.name_en].filter(Boolean).map((v) => String(v).toLowerCase());
          return candidates.includes(norm) || candidates.some(c => c.includes(norm));
        });
        if (matched) { geom = matched.geometry; break; }
      }
    }
    if (!geom) return { path: '', center: null, isLine: false };
    
    const rings: [number, number][][] = [];
    if (geom.type === 'Polygon') geom.coordinates.forEach((r: any) => rings.push(r));
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((poly: any) => poly.forEach((r: any) => rings.push(r)));
    else if (geom.type === 'LineString') rings.push(geom.coordinates);
    else if (geom.type === 'MultiLineString') geom.coordinates.forEach((line: any) => rings.push(line));

    const map = mapRef.current;
    let totalX = 0; let totalY = 0; let pointCount = 0;

    const valid = rings.map((ring) => {
      const points = ring.map((coord: [number, number]) => {
        const p = projectClamped(map, coord);
        if (!p) return null;
        totalX += coord[0]; totalY += coord[1]; pointCount++;
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).filter(Boolean);
      
      if (points.length < 2) return '';
      return geom.type.includes('Line') ? `M ${points.join(' L ')}` : `M ${points.join(' L ')} Z`;
    }).filter(Boolean);

    const centroid: [number, number] | null = pointCount > 0 ? [totalX / pointCount, totalY / pointCount] : null;
    return { path: valid.join(' '), center: centroid, isLine: geom.type.includes('Line') };
  };

  const rawCountries = timeline.highlightCountries || [];
  const takeovers = timeline.takeovers || [];
  const arrows = timeline.arrows || [];
  const labels = timeline.labels || [];

  useLayoutEffect(() => {
    if (!blendOverlayRef.current || !uiOverlayRef.current || !mapLoaded) return;
    
    const blendCtx = blendOverlayRef.current.getContext('2d');
    const uiCtx = uiOverlayRef.current.getContext('2d');
    if (!blendCtx || !uiCtx) return;
    
    blendCtx.clearRect(0, 0, width, height);
    blendCtx.lineJoin = 'round'; blendCtx.lineCap = 'round';

    uiCtx.clearRect(0, 0, width, height);
    uiCtx.lineJoin = 'round'; uiCtx.lineCap = 'round';

    const isMobileEdit = isLiveEditMode && typeof window !== 'undefined' && window.innerWidth < 1024;

    rawCountries.forEach((entity: any) => {
      const startF = entity.startFrame || 0;
      const endF = entity.endFrame || totalFrames + 100;
      
      if (frame < startF || frame > endF) return;
      if (takeovers.some((t: any) => (t.target || '').toLowerCase() === (entity.name || entity.country || '').toLowerCase() && frame >= (t.startFrame || 0))) return;

      const eName = entity.name || entity.country || entity.state;
      const { path, center, isLine } = getGeometryFromSource(eName, [worldData, ...extraData]);
      if (!path) return;
      const p2d = new Path2D(path);

      blendCtx.save();
      blendCtx.globalCompositeOperation = entity.blendMode || 'screen';
      
      let masterAlpha = 1;
      const fadeInDuration = 45;
      const fadeOutDuration = 30;

      if (frame < startF + fadeInDuration) {
        masterAlpha = (frame - startF) / fadeInDuration;
      } else if (frame > endF - fadeOutDuration) {
        masterAlpha = Math.max(0, (endF - frame) / fadeOutDuration);
      }

      if (entity.revealStyle === 'fade') {
        blendCtx.globalAlpha = masterAlpha;
      } else if (entity.revealStyle === 'ink') {
        const cx = center ? mapRef.current!.project(center).x : width/2;
        const cy = center ? mapRef.current!.project(center).y : height/2;
        const maxRad = Math.max(width, height) * 1.5;
        blendCtx.beginPath();
        blendCtx.arc(cx, cy, maxRad * Easing.bezier(0.25, 1, 0.5, 1)(Math.min(1, (frame - startF) / fadeInDuration)), 0, Math.PI*2);
        blendCtx.clip();
        blendCtx.globalAlpha = frame > endF - fadeOutDuration ? masterAlpha : 1; 
      }

      const activeColor = entity.color || '#3b82f6';

      if (isLine) {
        if (entity.enableGlow !== false && !isMobileEdit) {
          blendCtx.save(); blendCtx.globalAlpha = masterAlpha; blendCtx.shadowColor = activeColor; blendCtx.shadowBlur = entity.glowIntensity || 20; blendCtx.lineWidth = (entity.strokeWidth || 4) + 4; blendCtx.strokeStyle = activeColor; blendCtx.stroke(p2d); blendCtx.restore();
        }
        if (entity.revealStyle === 'trim' && frame < startF + fadeInDuration) {
          const approxLen = 4000; 
          blendCtx.setLineDash([approxLen]);
          blendCtx.lineDashOffset = approxLen - (((frame - startF) / fadeInDuration) * approxLen);
        }
        blendCtx.globalAlpha = masterAlpha;
        blendCtx.lineWidth = entity.strokeWidth || 4; blendCtx.strokeStyle = entity.strokeColor || activeColor; blendCtx.stroke(p2d);
      } else {
        if (entity.dropShadow !== false && !isMobileEdit) {
          blendCtx.save(); blendCtx.globalAlpha = masterAlpha; blendCtx.translate(0, 15); blendCtx.shadowColor = 'rgba(0,0,0,0.95)'; blendCtx.shadowBlur = 15; blendCtx.fillStyle = '#000000'; blendCtx.fill(p2d); blendCtx.restore();
        }
        if (entity.enableGlow !== false && !isMobileEdit) {
          blendCtx.save(); blendCtx.shadowColor = activeColor; blendCtx.shadowBlur = entity.glowIntensity !== undefined ? entity.glowIntensity : 20; blendCtx.globalAlpha = 0.55 * masterAlpha; blendCtx.fillStyle = activeColor; blendCtx.fill(p2d); blendCtx.restore();
        }
        blendCtx.globalAlpha = 0.9 * masterAlpha; 
        blendCtx.fillStyle = activeColor; blendCtx.fill(p2d);
        if (entity.strokeWidth) { blendCtx.lineWidth = entity.strokeWidth; blendCtx.strokeStyle = entity.strokeColor || '#fff'; blendCtx.stroke(p2d); }
      }
      
      blendCtx.restore();
    });

    takeovers.forEach((takeover: any) => {
      const start = takeover.startFrame || 0;
      if (frame < start) return;

      const targetGeo = getGeometryFromSource(takeover.target, [worldData]);
      if (!targetGeo.path) return;
      const p2d = new Path2D(targetGeo.path);

      const targetData: any = rawCountries.find((c: any) => (c.name || c.country) === takeover.target) || {};
      blendCtx.save();
      blendCtx.globalCompositeOperation = targetData.blendMode || 'screen';
      blendCtx.fillStyle = targetData.color || '#1e3a8a'; blendCtx.globalAlpha = 0.85; blendCtx.fill(p2d);
      
      const duration = Math.max(takeover.duration || 120, 90);
      const radius = interpolate(frame - start, [0, duration], [0, Math.max(width, height) * 1.5], { extrapolateRight: 'clamp', easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
      
      const invGeo = getGeometryFromSource(takeover.attacker || takeover.invader, [worldData]);
      let cx = width/2; let cy = height/2;
      if (invGeo.center) { const p = mapRef.current?.project(invGeo.center); if (p) { cx = p.x; cy = p.y; } }

      blendCtx.beginPath(); blendCtx.arc(cx, cy, radius, 0, Math.PI * 2); blendCtx.clip();
      blendCtx.fillStyle = takeover.color || '#ef4444'; blendCtx.globalAlpha = 0.9; blendCtx.fill(p2d);
      blendCtx.restore();
    });

    arrows.forEach((arrow: any) => {
      const startF = arrow.startFrame || arrow.frame || 0;
      if (frame < startF) return;
      
      if (arrow.type === 'custom-path' && arrow.coordinates) {
         uiCtx.save();
         uiCtx.beginPath();
         arrow.coordinates.forEach((coord: [number, number], i: number) => {
            const p = projectClamped(mapRef.current!, coord);
            if (!p) return;
            if (i === 0) uiCtx.moveTo(p.x, p.y);
            else uiCtx.lineTo(p.x, p.y);
         });
         const t = Math.max(0, Math.min(1, Easing.bezier(0.25, 0.1, 0.25, 1)((frame - startF) / 45)));
         uiCtx.strokeStyle = arrow.color || '#f59e0b';
         uiCtx.lineWidth = arrow.strokeWidth || 4;
         if (!isMobileEdit) { uiCtx.shadowColor = 'rgba(0,0,0,0.8)'; uiCtx.shadowBlur = 10; }
         uiCtx.stroke();
         uiCtx.restore();
         return;
      }

      let c1 = arrow.origin; let c2 = arrow.target;
      if (arrow.sourceName) c1 = getGeometryFromSource(arrow.sourceName, [worldData]).center;
      if (arrow.targetName) c2 = getGeometryFromSource(arrow.targetName, [worldData]).center;
      if (!c1 || !c2) return;
      
      const p1 = projectClamped(mapRef.current!, c1 as [number, number]); 
      const p2 = projectClamped(mapRef.current!, c2 as [number, number]);
      if (!p1 || !p2) return;

      const dx = p2.x - p1.x; const dy = p2.y - p1.y; const dist = Math.sqrt(dx*dx + dy*dy);
      const arcH = dist * 0.38; const midX = (p1.x+p2.x)/2 + (-dy/dist)*arcH; const midY = (p1.y+p2.y)/2 + (dx/dist)*arcH;
      
      const pathD = `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`;
      const p2d = new Path2D(pathD);
      const t = Math.max(0, Math.min(1, Easing.bezier(0.25, 0.1, 0.25, 1)((frame - startF) / 45)));

      uiCtx.save();
      if (!isMobileEdit) { uiCtx.shadowColor = '#000000'; uiCtx.shadowBlur = 12; uiCtx.shadowOffsetY = 10; }
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

    labels.forEach((l: any) => {
      const lStart = l.startFrame || 0;
      const lDur = l.duration || 150;
      const lEnd = lStart + lDur;

      if (frame < lStart) return;
      if (!l.pinned && frame > lEnd) return;

      const p = projectClamped(mapRef.current!, [l.lng, l.lat]);
      if (!p) return;

      let lAlpha = 1;
      const lFade = 15;
      if (frame < lStart + lFade) lAlpha = (frame - lStart) / lFade;
      if (!l.pinned && frame > lEnd - lFade) lAlpha = Math.max(0, (lEnd - frame) / lFade);
      
      uiCtx.save();
      uiCtx.globalAlpha = lAlpha;
      uiCtx.translate(p.x, p.y - 10);
      if (l.glow && !isMobileEdit) { uiCtx.shadowColor = '#38bdf8'; uiCtx.shadowBlur = 20; }
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

  }, [frame, currentCam, mapLoaded, rawCountries, takeovers, arrows, labels, extraData, isLiveEditMode]);

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
          const { path } = getGeometryFromSource(cName, [worldData, ...extraData]);
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