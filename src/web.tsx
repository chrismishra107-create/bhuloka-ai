import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { MapAnimation } from './MapAnimation';
import worldData from './world.json';
import './index.css';
import { Muxer, ArrayBufferTarget } from 'webm-muxer';
import type { Map as MapLibreMap } from 'maplibre-gl';

const BUILD_STORIES = [
  "Conquering the 15MB Natural Earth River GeoJSON bottleneck...",
  "Debugging WebGL black void and camera autopilot locks...",
  "Bypassing Gemini token limits for mass-district rendering...",
  "Optimizing ink-bleed displacement maps for cinematic transitions...",
  "Syncing SVG coordinates with MapLibre camera matrix..."
];

const CinematicLoader: React.FC = () => {
  const [storyIndex, setStoryIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => { setStoryIndex(prev => (prev + 1) % BUILD_STORIES.length); }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', background: '#040711', padding: '40px', borderRadius: '24px', border: '1px solid rgba(56,189,248,0.3)' }}>
      <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: '4px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: '14px', letterSpacing: '0.2em', color: '#38bdf8', fontWeight: 800 }}>BHULOKA ENGINE INITIALIZING</div>
      <div style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '300px', textAlign: 'center', fontFamily: 'monospace' }}>{BUILD_STORIES[storyIndex]}</div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const WebApp: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'editor'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  
  const [timeline, setTimeline] = useState<any | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(300);
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(true);

  const [isDesktop, setIsDesktop] = useState<boolean>(true);
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(false);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(false);

  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [isLiveEdit, setIsLiveEdit] = useState<boolean>(false);
  
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<string>('');
  const [isPreloading, setIsPreloading] = useState<boolean>(false);
  
  const [targetLat, setTargetLat] = useState<number>(38.0);
  const [targetLng, setTargetLng] = useState<number>(127.0);
  const [targetZoom, setTargetZoom] = useState<number>(1.2);
  const [targetPitch, setTargetPitch] = useState<number>(20);
  const [targetBearing, setTargetBearing] = useState<number>(0);

  const [manualMode, setManualMode] = useState<boolean>(false);
  const [entityA, setEntityA] = useState<string>('North Korea');
  const [entityB, setEntityB] = useState<string>('South Korea');
  
  const [newCountrySearch, setNewCountrySearch] = useState<string>('');
  const [allGeoNames, setAllGeoNames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const [mapStyle, setMapStyle] = useState<string>('dark-documentary');
  const [previewQuality, setPreviewQuality] = useState<number>(1);
  const [labelText, setLabelText] = useState<string>('DMZ Border');
  const [labelColor, setLabelColor] = useState<string>('#ffffff');
  const [labelBg, setLabelBg] = useState<string>('#f472b6');
  const [labelSize, setLabelSize] = useState<number>(24);
  const [labelStyle, setLabelStyle] = useState<string>('geo-pin');
  const [labelGlow, setLabelGlow] = useState<boolean>(true);
  const [labelPinned, setLabelPinned] = useState<boolean>(true);

  const [openBranches, setOpenBranches] = useState<Record<string, boolean>>({
    entities: true, typography: false, mapStyle: false, vectors: false
  });
  const toggleBranch = (key: string) => setOpenBranches(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    const names = new Set<string>();
    if (worldData && (worldData as any).features) {
      (worldData as any).features.forEach((f: any) => {
        if (f.properties.ADMIN) names.add(f.properties.ADMIN);
        if (f.properties.NAME) names.add(f.properties.NAME);
        if (f.properties.name) names.add(f.properties.name);
      });
    }

    const loadExtras = async () => {
      try {
        const [rivRes, statRes] = await Promise.all([
          fetch('https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_rivers_lake_centerlines.geojson'),
          fetch('https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_1_states_provinces.geojson')
        ]);
        const rivData: any = await rivRes.json();
        const statData: any = await statRes.json();
        if (rivData && rivData.features) rivData.features.forEach((f:any) => { if(f.properties.name) names.add(f.properties.name); if(f.properties.name_en) names.add(f.properties.name_en); });
        if (statData && statData.features) statData.features.forEach((f:any) => { if(f.properties.name) names.add(f.properties.name); if(f.properties.admin) names.add(f.properties.admin); });
        setAllGeoNames(Array.from(names).filter(Boolean).sort());
      } catch(e) { console.error("GeoJSON Fetch Blocked:", e) }
    };
    loadExtras();
  }, []);

  const filteredSuggestions = newCountrySearch.length >= 2 ? allGeoNames.filter(n => n.toLowerCase().includes(newCountrySearch.toLowerCase())).slice(0, 6) : [];

  useEffect(() => {
    let animationFrameId: number;
    const syncTimeline = () => {
      if (playerRef.current && isPlaying && !isExporting) {
        setCurrentFrame(Math.min(playerRef.current.getCurrentFrame(), videoDuration));
      }
      animationFrameId = requestAnimationFrame(syncTimeline);
    };
    syncTimeline();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isExporting, videoDuration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setStatus('generating'); setErrorMessage(null);
    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const data = await response.json();
      if (data && data.timeline) {
        if (!prompt.toLowerCase().includes('invad') && !prompt.toLowerCase().includes('attack') && !prompt.toLowerCase().includes('war')) data.timeline.takeovers = [];
        setTimeline(data.timeline); setVideoDuration(data.timeline.totalFrames || 300); setStatus('editor');
      } else { setErrorMessage("API Quota Exceeded."); setStatus('idle'); }
    } catch (error) { setErrorMessage("Network error."); setStatus('idle'); }
  };

  const handleDeterministicExport = async () => {
    if (typeof VideoEncoder === 'undefined') { alert('Browser does not support WebCodecs.'); return; }
    setIsExporting(true); setExportProgress('Initializing encoder...');
    playerRef.current?.pause(); setIsPlaying(false);
    try {
      const exportWidth = 1080, exportHeight = 1920, fps = 30;
      let MuxerModule: any;
      try { MuxerModule = await import('webm-muxer'); } 
      catch { 
        // @ts-ignore
        MuxerModule = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/webm-muxer@5.0.2/+esm'); 
      }
      const muxer = new MuxerModule.Muxer({ target: new MuxerModule.ArrayBufferTarget(), video: { codec: 'V_VP8', width: exportWidth, height: exportHeight, frameRate: fps } });
      const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (err) => console.error('VideoEncoder:', err) });
      encoder.configure({ codec: 'vp8', width: exportWidth, height: exportHeight, bitrate: 10_000_000, framerate: fps });

      const canvas = document.createElement('canvas');
      canvas.width = exportWidth; canvas.height = exportHeight;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Could not create export canvas');
      const frameDurationUs = Math.round(1_000_000 / fps);
      const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

      for (let f = 0; f < videoDuration; f++) {
        setExportProgress(`Exporting frame ${f + 1}/${videoDuration}`);
        setCurrentFrame(f);
        playerRef.current?.seekTo(f);
        await wait(50);

        const map = (window as any).__mapInstance as MapLibreMap | null;
        if (map) {
          map.resize(); map.triggerRepaint();
          let tries = 0;
          while (!map.areTilesLoaded() && tries++ < 30) await wait(50);
          await new Promise<void>(resolve => { map.once('idle', () => resolve()); map.triggerRepaint(); setTimeout(resolve, 300); });
        }
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#040711'; ctx.fillRect(0, 0, exportWidth, exportHeight);
        const mapCanvas = map?.getCanvas() || null;
        if (mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) ctx.drawImage(mapCanvas, 0, 0, mapCanvas.width, mapCanvas.height, 0, 0, exportWidth, exportHeight);

        const svgs = document.querySelectorAll('svg');
        for (let i = 0; i < svgs.length; i++) {
           const svgData = new XMLSerializer().serializeToString(svgs[i]);
           const img = new Image();
           const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
           const url = URL.createObjectURL(svgBlob);
           await new Promise<void>((resolve) => {
             img.onload = () => { ctx.drawImage(img, 0, 0, exportWidth, exportHeight); URL.revokeObjectURL(url); resolve(); };
             img.src = url;
           });
        }

        const vf = new VideoFrame(canvas, { timestamp: f * frameDurationUs, duration: frameDurationUs });
        encoder.encode(vf, { keyFrame: f === 0 || f % 60 === 0 });
        vf.close();
        if (encoder.encodeQueueSize > 3) await encoder.flush();
      }
      setExportProgress('Finalizing video...');
      await encoder.flush(); encoder.close(); muxer.finalize();
      const blob = new Blob([muxer.target.buffer], { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${(timeline?.title || 'map-animation').replace(/[^a-z0-9_-]+/gi, '_')}_${Date.now()}.webm`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      console.error(err); alert(`Export failed: ${err?.message || err}`);
    } finally { setIsExporting(false); setExportProgress(''); }
  };

  const handleHDLocalExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline: dynamicTimeline })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${timeline?.title?.replace(/\s+/g, '_') || 'Tactical_Map'}_HD.mp4`;
        a.click();
      } else {
        alert("Backend rendering failed.");
      }
    } catch (e) {
      alert("Network error during local export.");
    }
    setIsExporting(false);
  };

  const initializeManualScene = () => {
    setTimeline({ title: `${entityA} vs ${entityB}`, totalFrames: 300, highlightCountries: [ { name: entityA, country: entityA, color: '#ef4444', strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, blendMode: 'normal', isPrimary: true, startFrame: 0, endFrame: 300, revealStyle: 'ink' }, { name: entityB, country: entityB, color: '#3b82f6', strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, blendMode: 'normal', isPrimary: false, startFrame: 0, endFrame: 300, revealStyle: 'ink' } ], takeovers: [], arrows: [], labels: [], cameraKeyframes: [{ frame: 0, zoom: 1.2, lat: 38.0, lng: 127.0, pitch: 45, bearing: 0 }], assets: [] });
    setVideoDuration(300); setStatus('editor');
  };

  const startLiveEdit = () => {
    playerRef.current?.pause(); setIsPlaying(false);
    const pastKfs = timeline?.cameraKeyframes?.filter((kf: any) => kf.frame <= currentFrame) || [];
    const baseKf: any = pastKfs[pastKfs.length - 1] || timeline?.cameraKeyframes?.[0] || { lat: 38.0, lng: 127.0, zoom: 1.2, pitch: 45, bearing: 0 };
    setTargetLat(baseKf.lat); setTargetLng(baseKf.lng); setTargetZoom(baseKf.zoom); setTargetPitch(baseKf.pitch); setTargetBearing(baseKf.bearing);
    setIsLiveEdit(true);
  };

  const dropKeyframeLive = () => {
    setTimeline((prev: any) => {
      const updated = { ...prev };
      updated.cameraKeyframes = [...(prev.cameraKeyframes || [])].filter((kf: any) => Math.abs(kf.frame - currentFrame) > 15);
      updated.cameraKeyframes.push({ frame: currentFrame, zoom: targetZoom, lat: targetLat, lng: targetLng, pitch: targetPitch, bearing: targetBearing });
      updated.cameraKeyframes.sort((a: any, b: any) => a.frame - b.frame);
      return updated;
    });
  };

  const deleteSpecificKeyframe = (frameIndex: number) => {
    setTimeline((prev: any) => {
      const updated = { ...prev };
      updated.cameraKeyframes = updated.cameraKeyframes.filter((kf: any) => kf.frame !== frameIndex);
      return updated;
    });
  };

  const dropLabel = () => {
    if (!labelText.trim()) return;
    setTimeline((prev: any) => {
      const updated = { ...prev };
      updated.labels = [...(prev.labels || []), { id: Math.random().toString(36).substr(2, 9), text: labelText, lat: targetLat, lng: targetLng, startFrame: currentFrame, duration: 300, color: labelColor, bg: labelBg, size: labelSize, glow: labelGlow, pinned: labelPinned, style: labelStyle }];
      return updated;
    });
  };

  const cutEntity = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setTimeline((prev: any) => {
      const updated = { ...prev };
      if (updated.highlightCountries) updated.highlightCountries = updated.highlightCountries.filter((c: any) => c.name !== name && c.country !== name);
      return updated;
    });
    if (selectedEntity === name) setSelectedEntity(null);
  };

  const addCountryMap = (explicitName?: string) => {
    const searchTarget = (explicitName ?? newCountrySearch).trim();
    if (!searchTarget) return;
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const existing = [...(prev.highlightCountries || [])];
      if (!existing.some((c: any) => String(c.name || c.country || '').toLowerCase() === searchTarget.toLowerCase())) {
        existing.push({
          name: searchTarget, country: searchTarget, color: '#3b82f6', strokeColor: '#ffffff',
          strokeWidth: 2, enableGlow: true, glowIntensity: 20, dropShadow: true,
          blendMode: 'normal', isPrimary: false, startFrame: currentFrame, endFrame: videoDuration,
          revealStyle: 'fade', trimDuration: 45, fadeInDuration: 30, fadeOutDuration: 20
        });
      }
      return { ...prev, highlightCountries: existing };
    });
    setNewCountrySearch(''); setShowSuggestions(false);
  };

  const updateEntityStyle = (name: string, key: string, value: any) => {
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (updated.highlightCountries) {
        updated.highlightCountries = updated.highlightCountries.map((c: any) => {
          if (c.name === name || c.country === name) return { ...c, [key]: value };
          return c;
        });
      }
      return updated;
    });
  };

  const updateLabelText = (id: string, text: string) => {
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (updated.labels) updated.labels = updated.labels.map((l: any) => l.id === id ? { ...l, text } : l);
      return updated;
    });
  };

  const togglePlay = () => { if (!playerRef.current) return; if (isPlaying) playerRef.current.pause(); else playerRef.current.play(); setIsPlaying(!isPlaying); };

  const dynamicTimeline = useMemo(() => {
    if (!timeline) return null;
    const modified: any = { ...timeline, totalFrames: videoDuration };
    let newKfs = [...(timeline.cameraKeyframes || [])];
    if (isLiveEdit && playerRef.current && !isPlaying) {
      newKfs = newKfs.filter((kf: any) => Math.abs(kf.frame - currentFrame) > 15);
      newKfs.push({ frame: currentFrame, lat: targetLat, lng: targetLng, zoom: targetZoom, pitch: targetPitch, bearing: targetBearing });
      newKfs.sort((a: any, b: any) => a.frame - b.frame);
    }
    modified.cameraKeyframes = newKfs;
    return modified;
  }, [timeline, videoDuration, isLiveEdit, targetLat, targetLng, targetZoom, targetPitch, targetBearing, currentFrame, isPlaying]);

  const playerInputProps = useMemo(() => ({
    timeline: dynamicTimeline, isLiveEditMode: isLiveEdit, mapStyle: mapStyle,
    onCameraChange: (cam: any) => { setTargetLat(cam.lat); setTargetLng(cam.lng); setTargetZoom(cam.zoom); setTargetPitch(cam.pitch); setTargetBearing(cam.bearing); }
  }), [dynamicTimeline, isLiveEdit, mapStyle]);

  const panelStyle: React.CSSProperties = {
    background: 'rgba(20, 20, 24, 0.75)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 30px 60px rgba(0,0,0,0.6)', borderRadius: '24px'
  };

  const BranchHeader = ({ title, branchKey }: { title: string, branchKey: string }) => (
    <button onClick={() => toggleBranch(branchKey)} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, width: '100%', letterSpacing: '0.05em' }}>
      <span>{title}</span><span>{openBranches[branchKey] ? '▼' : '▶'}</span>
    </button>
  );

  const leftPanelJSX = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <BranchHeader title="🌍 SCENE ENTITIES" branchKey="entities" />
        {openBranches.entities && (
          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '6px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={() => {
                setTimeline((prev: any) => ({
                  ...prev,
                  highlightCountries: (prev.highlightCountries || []).map((c: any) => ({ ...c, color: '#3b82f6', enableGlow: true, strokeWidth: 1 }))
                }));
              }} style={{ flex: 1, background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)', borderRadius: '6px', padding: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>⚡ Select All / Reset Blue</button>
            </div>

            <div style={{ display: 'flex', gap: '6px', position: 'relative', width: '100%' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text" value={newCountrySearch}
                  onChange={(e) => { setNewCountrySearch(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Search river, state, country..."
                  style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px', padding: '8px', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCountryMap(); }}
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#111827', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', zIndex: 99999, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 15px 35px rgba(0,0,0,0.9)', boxSizing: 'border-box' }}>
                    {filteredSuggestions.map(s => (
                      <div key={s} onMouseDown={(e) => { e.preventDefault(); addCountryMap(s); }} style={{ padding: '10px 12px', fontSize: '11px', color: '#fff', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{s}</div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => addCountryMap()} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', padding: '0 10px', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '500px', overflowY: 'visible', overflowX: 'hidden' }}>
              {timeline?.highlightCountries?.map((c: any, idx: number) => {
                const name = c.name || c.country;
                const isSelected = selectedEntity === name;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '8px', gap: '6px' }}>
                      <button onClick={() => setSelectedEntity(isSelected ? null : name)} style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', textAlign: 'left', cursor: 'pointer', fontWeight: 600 }}>{isSelected ? '▼' : '▶'} {name}</button>
                      <button onClick={(e) => cutEntity(e, name)} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '6px', border: 'none', padding: '4px 8px', fontSize: '10px', cursor: 'pointer' }}>✕</button>
                    </div>
                    {isSelected && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 10px 12px 10px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.08)', borderRadius: '0 0 8px 8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                          <span style={{ color: '#8e8e93' }}>Reveal Style</span>
                          <select value={c.revealStyle || 'fade'} onChange={(e) => updateEntityStyle(name, 'revealStyle', e.target.value)} style={{ background: '#111', color: '#38bdf8', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '10px', padding: '4px', outline: 'none' }}>
                            <option value="fade">Fade In</option><option value="ink">Ink Bleed</option><option value="trim">River Trim</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                          <span style={{ color: '#8e8e93' }}>Fill Color</span>
                          <input type="color" value={c.color || '#3b82f6'} onChange={(e) => updateEntityStyle(name, 'color', e.target.value)} style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                          <span style={{ color: '#8e8e93' }}>Stroke Width</span>
                          <input type="range" min="0" max="10" step="0.5" value={c.strokeWidth !== undefined ? c.strokeWidth : 2} onChange={(e) => updateEntityStyle(name, 'strokeWidth', Number(e.target.value))} style={{ width: '70px', accentColor: '#38bdf8' }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <BranchHeader title="📝 TYPOGRAPHY & LABELS" branchKey="typography" />
        {openBranches.typography && (
          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input type="text" value={labelText} onChange={(e) => setLabelText(e.target.value)} placeholder="Label Text..." style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px', padding: '8px', borderRadius: '8px', outline: 'none' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
              <span style={{ color: '#8e8e93' }}>LABEL STYLE</span>
              <select value={labelStyle} onChange={(e) => setLabelStyle(e.target.value)} style={{ background: '#111', color: '#38bdf8', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '10px', padding: '4px' }}>
                <option value="callout">Classy Callout</option><option value="geo-pin">GEOlayers Pin / Pill</option><option value="pill">Dark Translucent Pill</option><option value="minimal">Minimal Dot</option>
              </select>
            </div>

            <button onClick={() => { if(isLiveEdit) dropLabel(); }} style={{ background: isLiveEdit ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)', color: isLiveEdit ? '#38bdf8' : '#8e8e93', border: `1px solid ${isLiveEdit ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', padding: '8px', fontSize: '11px', fontWeight: 700, cursor: isLiveEdit ? 'pointer' : 'not-allowed' }}>{isLiveEdit ? '📍 Drop Label at Crosshair' : 'Enter Live Edit to Drop'}</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <BranchHeader title="🎨 MAP STYLE" branchKey="mapStyle" />
        {openBranches.mapStyle && (
          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['dark-documentary', 'satellite', 'natural-earth', 'light', 'street'].map(style => (
              <button key={style} onClick={() => setMapStyle(style)} style={{ flex: '1 1 45%', background: mapStyle === style ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.05)', color: '#fff', border: mapStyle === style ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px', fontSize: '10px', cursor: 'pointer', textTransform: 'capitalize' }}>
                {style.replace('-', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const rightPanelJSX = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', boxSizing: 'border-box' }}>
      <button onClick={handleHDLocalExport} disabled={isPreloading || isExporting} style={{ background: isExporting ? '#f59e0b' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '10px', height: '42px', fontSize: '11px', fontWeight: 800, cursor: isExporting ? 'wait' : 'pointer' }}>
        {isExporting ? `⏳ Server Exporting...` : '🖥️ Server HD Export'}
      </button>
      <button onClick={handleDeterministicExport} disabled={isPreloading || isExporting} style={{ background: isExporting ? '#f59e0b' : '#10b981', color: '#000', border: 'none', borderRadius: '10px', height: '42px', fontSize: '11px', fontWeight: 800, cursor: isExporting ? 'wait' : 'pointer' }}>
        {isExporting ? `⏳ Exporting...` : '🎥 Offline WebM (100% Tiles)'}
      </button>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#000', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#fff', overflow: 'hidden' }}>
      {isExporting && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(10,10,14,.94)', border: '1px solid rgba(56,189,248,.45)', borderRadius: 12, padding: '10px 16px', color: '#38bdf8', fontSize: 12, fontWeight: 700, boxShadow: '0 12px 40px rgba(0,0,0,.6)' }}>{exportProgress || 'Preparing export…'}</div>}
      <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: isDesktop ? '20px' : '0px', overflow: 'hidden' }}>
        {status !== 'editor' && status !== 'generating' && (
          <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '680px', padding: '16px', boxSizing: 'border-box' }}>
            <h1 style={{ fontSize: isDesktop ? '42px' : '28px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '24px', textAlign: 'center' }}>Cinematic Timeline Studio</h1>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '24px', padding: '16px', boxSizing: 'border-box' }}>
              <textarea placeholder="e.g., generate all states of India in red..." value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} style={{ width: '100%', background: 'transparent', border: 'none', color: '#ffffff', fontSize: '16px', outline: 'none', resize: 'none', boxSizing: 'border-box' }} required />
              <button type="submit" style={{ background: '#fff', color: '#000', border: 'none', borderRadius: '16px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}>Generate ✦</button>
            </form>
          </div>
        )}

        {status === 'generating' && <CinematicLoader />}

        {status === 'editor' && dynamicTimeline && (
          <React.Fragment>
            <div style={{ position: 'fixed', left: leftPanelOpen ? '0px' : '-300px', top: '40%', transform: 'translateY(-50%)', transition: 'left 0.3s cubic-bezier(0.25, 1, 0.5, 1)', zIndex: 100, display: 'flex', alignItems: 'center' }}>
              <div style={{ ...panelStyle, width: '300px', maxHeight: '75vh', borderLeft: 'none', borderRadius: '0 16px 16px 0', overflowY: 'auto', overflowX: 'visible' }}>{leftPanelJSX}</div>
              <div onClick={() => setLeftPanelOpen(!leftPanelOpen)} style={{ ...panelStyle, width: '36px', height: '72px', borderLeft: 'none', borderRadius: '0 12px 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#38bdf8', fontSize: '14px', marginLeft: '-1px' }}>{leftPanelOpen ? '◀' : '▶'}</div>
            </div>
            <div style={{ position: 'fixed', right: rightPanelOpen ? '0px' : '-300px', top: '40%', transform: 'translateY(-50%)', transition: 'right 0.3s cubic-bezier(0.25, 1, 0.5, 1)', zIndex: 100, display: 'flex', alignItems: 'center' }}>
              <div onClick={() => setRightPanelOpen(!rightPanelOpen)} style={{ ...panelStyle, width: '36px', height: '72px', borderRight: 'none', borderRadius: '12px 0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#a855f7', fontSize: '14px', marginRight: '-1px' }}>{rightPanelOpen ? '▶' : '◀'}</div>
              <div style={{ ...panelStyle, width: '300px', maxHeight: '75vh', borderRight: 'none', borderRadius: '16px 0 0 16px', overflowY: 'auto', overflowX: 'visible' }}>{rightPanelJSX}</div>
            </div>
            <div style={{ height: '100%', maxHeight: '100%', aspectRatio: '9/16', borderRadius: isDesktop ? '24px' : '0px', border: isDesktop ? '2px solid #1a1a1a' : 'none', boxShadow: isLiveEdit ? '0 0 0 4px #38bdf8, 0 30px 90px rgba(56,189,248,0.4)' : '0 0 40px rgba(0,0,0,0.8)', position: 'relative', overflow: 'hidden', background: '#040711', zIndex: 10 }}>
              <div style={{ position: 'absolute', inset: 0, zIndex: 10, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <Player
                  ref={playerRef} component={MapAnimation} inputProps={playerInputProps} 
                  durationInFrames={videoDuration} 
                  compositionWidth={Math.round(1080 * previewQuality)} 
                  compositionHeight={Math.round(1920 * previewQuality)} 
                  fps={30} controls={false} loop autoPlay clickToPlay={false}
                  style={{ width: '100%', height: '100%', display: 'block' }}
                />
              </div>
            </div>
          </React.Fragment>
        )}
      </div>

      {status === 'editor' && dynamicTimeline && (
        <div style={{ position: 'fixed', bottom: isDesktop ? '20px' : '15px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 120, padding: '0 16px', boxSizing: 'border-box' }}>
          <div style={{ ...panelStyle, width: '100%', maxWidth: '950px', display: 'flex', alignItems: 'center', gap: '16px', borderRadius: '24px', padding: '14px 24px', height: '160px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, width: '80px' }}>
              <button onClick={togglePlay} style={{ background: '#ffffff', color: '#000', border: 'none', borderRadius: '50%', width: '42px', height: '42px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>{isPlaying ? '❚❚' : '▶'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebApp;
const container = document.getElementById('root');
if (container) { const root = createRoot(container); root.render(<WebApp />); }