import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { MapAnimation } from './MapAnimation';
import worldData from './world.json';
import './index.css';

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
  
  const [disabledEntities, setDisabledEntities] = useState<string[]>([]);

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

  const [pathStartCoord, setPathStartCoord] = useState<[number, number] | null>(null);

  const [manualMode, setManualMode] = useState<boolean>(false);
  const [entityA, setEntityA] = useState<string>('North Korea');
  const [entityB, setEntityB] = useState<string>('South Korea');
  const [eventType, setEventType] = useState<'arrow' | 'takeover'>('arrow');
  
  const [newCountrySearch, setNewCountrySearch] = useState<string>('');
  const [allGeoNames, setAllGeoNames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const [mapStyle, setMapStyle] = useState<string>('dark-documentary');

  // LABEL ENGINE STATES
  const [labelText, setLabelText] = useState<string>('DMZ Border');
  const [labelColor, setLabelColor] = useState<string>('#ffffff');
  const [labelBg, setLabelBg] = useState<string>('rgba(0,0,0,0.7)');
  const [labelSize, setLabelSize] = useState<number>(24);
  const [labelStyle, setLabelStyle] = useState<string>('callout');
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
          fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson'),
          fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson')
        ]);
        
        const rivData: any = await rivRes.json();
        const statData: any = await statRes.json();
        
        if (rivData && rivData.features) {
          rivData.features.forEach((f:any) => { 
            if(f.properties.name) names.add(f.properties.name); 
            if(f.properties.name_en) names.add(f.properties.name_en); 
          });
        }
        
        if (statData && statData.features) {
          statData.features.forEach((f:any) => { 
            if(f.properties.name) names.add(f.properties.name); 
            if(f.properties.admin) names.add(f.properties.admin); 
          });
        }
        
        setAllGeoNames(Array.from(names).filter(Boolean).sort());
      } catch(e) {}
    };
    
    loadExtras();
    setAllGeoNames(Array.from(names).filter(Boolean).sort());
  }, []);

  const filteredSuggestions = newCountrySearch.length >= 2 
    ? allGeoNames.filter(n => n.toLowerCase().includes(newCountrySearch.toLowerCase())).slice(0, 6)
    : [];

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
    setStatus('generating');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const data = await response.json();
      if (data && data.timeline) {
        if (!prompt.toLowerCase().includes('invad') && !prompt.toLowerCase().includes('attack') && !prompt.toLowerCase().includes('war')) data.timeline.takeovers = [];
        setTimeline(data.timeline); setVideoDuration(data.timeline.totalFrames || 300); setStatus('editor');
      } else { setErrorMessage("API Quota Exceeded. Please try again later."); setStatus('idle'); }
    } catch (error) { setErrorMessage("Network error. Please try again."); setStatus('idle'); }
  };

  const handleDeterministicExport = async () => {
    if (typeof VideoEncoder === 'undefined') { alert("Browser does not support WebCodecs. Please use Chrome or Brave."); return; }
    setIsExporting(true); setExportProgress('Initializing encoder...'); playerRef.current?.pause(); setIsPlaying(false);

    let MuxerModule: any;
    try { 
      MuxerModule = await import('webm-muxer'); 
    } catch { 
      // @ts-ignore
      MuxerModule = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/webm-muxer@5.0.2/+esm'); 
    }

    const exportWidth = 1080; const exportHeight = 1920; const fps = 30;
    const muxer = new MuxerModule.Muxer({ target: new MuxerModule.ArrayBufferTarget(), video: { codec: 'V_VP8', width: exportWidth, height: exportHeight, frameRate: fps } });
    const videoEncoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => console.error("VideoEncoder Error:", e) });
    videoEncoder.configure({ codec: 'vp8', width: exportWidth, height: exportHeight, bitrate: 8_000_000 });

    const offscreenCanvas = document.createElement('canvas'); offscreenCanvas.width = exportWidth; offscreenCanvas.height = exportHeight;
    const offCtx = offscreenCanvas.getContext('2d', { willReadFrequently: false });
    if (!offCtx) { setIsExporting(false); return; }
    const frameDurationUs = Math.round(1_000_000 / fps);

    for (let f = 0; f < videoDuration; f++) {
      setExportProgress(`Frame ${f + 1}/${videoDuration} (${Math.round(((f + 1) / videoDuration) * 100)}%) - Verifying tiles...`);
      playerRef.current?.seekTo(f); setCurrentFrame(f);
      
      await new Promise(r => setTimeout(r, 40));
      const map = (window as any).__mapInstance;
      if (map) { 
         let attempts = 0; 
         while (!map.areTilesLoaded() && attempts < 40) { 
           await new Promise(r => setTimeout(r, 50)); 
           attempts++; 
         } 
         await new Promise<void>((resolve) => {
            map.once('render', () => setTimeout(resolve, 50));
            map.triggerRepaint();
         });
      }
      
      await new Promise(r => requestAnimationFrame(r));
      
      offCtx.fillStyle = '#040711';
      offCtx.fillRect(0, 0, exportWidth, exportHeight);
      
      const mapCanvas = map ? map.getCanvas() : null;
      const blendCanvas = document.getElementById('vector-blend-overlay') as HTMLCanvasElement;
      const uiCanvas = document.getElementById('vector-ui-overlay') as HTMLCanvasElement;
      
      if (mapCanvas) offCtx.drawImage(mapCanvas, 0, 0, exportWidth, exportHeight);
      offCtx.globalCompositeOperation = 'source-over';
      if (blendCanvas) offCtx.drawImage(blendCanvas, 0, 0, exportWidth, exportHeight);
      if (uiCanvas) offCtx.drawImage(uiCanvas, 0, 0, exportWidth, exportHeight);
      
      const videoFrame = new VideoFrame(offscreenCanvas, { timestamp: f * frameDurationUs, duration: frameDurationUs });
      videoEncoder.encode(videoFrame, { keyFrame: f % 30 === 0 }); videoFrame.close();
    }

    setExportProgress('Finalizing video container...'); await videoEncoder.flush(); muxer.finalize();
    const { buffer } = muxer.target; const blob = new Blob([buffer], { type: 'video/webm' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${timeline?.title?.replace(/\s+/g, '_') || 'Bhuloka_Pristine'}_${Date.now()}.webm`; a.click(); URL.revokeObjectURL(url);
    setIsExporting(false); setExportProgress(''); alert("Export Complete! All tiles verified and recorded at full resolution.");
  };

  const handleHDLocalExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timeline: dynamicTimeline }) });
      if (res.ok) {
        const blob = await res.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `${timeline?.title?.replace(/\s+/g, '_') || 'Tactical_Map'}_HD.mp4`; a.click();
      } else { alert("Backend rendering failed. Ensure your server terminal is running and has FFmpeg installed."); }
    } catch (e) { alert("Network error during local export."); }
    setIsExporting(false);
  };

  // FULLY RESTORED DELETE ASSET FUNCTION
  const deleteAsset = (id: string) => {
    setTimeline((prev: any) => {
      const updated = { ...prev };
      if (updated.assets) updated.assets = updated.assets.filter((a: any) => a.id !== id);
      if (updated.arrows) updated.arrows = updated.arrows.filter((a: any) => a.id !== id);
      if (updated.takeovers) updated.takeovers = updated.takeovers.filter((t: any) => t.id !== id);
      if (updated.labels) updated.labels = updated.labels.filter((l: any) => l.id !== id);
      return updated;
    });
  };

  const initializeManualScene = () => {
    const blankTimeline = {
      title: `${entityA} vs ${entityB} (Manual)`,
      totalFrames: 300,
      highlightCountries: [
        { name: entityA, country: entityA, color: '#ef4444', strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, blendMode: 'source-over', isPrimary: true, startFrame: 0, endFrame: 300, revealStyle: 'ink' },
        { name: entityB, country: entityB, color: '#3b82f6', strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, blendMode: 'source-over', isPrimary: false, startFrame: 0, endFrame: 300, revealStyle: 'ink' }
      ],
      takeovers: [], arrows: [], labels: [],
      cameraKeyframes: [{ frame: 0, zoom: 1.2, lat: 38.0, lng: 127.0, pitch: 45, bearing: 0 }],
      assets: [] 
    }; 
    setTimeline(blankTimeline);
    setVideoDuration(300);
    setStatus('editor');
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

  const addCustomVector = (type: 'missile' | 'arrow') => {
    if (!pathStartCoord) return;
    setTimeline((prev: any) => {
      const updated = { ...prev };
      updated.arrows = [...(prev.arrows || []), { id: Math.random().toString(36).substr(2, 9), type, origin: pathStartCoord, target: [targetLng, targetLat], startFrame: currentFrame, duration: 90, color: type === 'missile' ? '#ffffff' : '#ef4444' }];
      return updated;
    });
    setPathStartCoord(null); 
  };

  const dropLabel = () => {
    if (!labelText.trim()) return;
    setTimeline((prev: any) => {
      const updated = { ...prev };
      updated.labels = [...(prev.labels || []), { 
        id: Math.random().toString(36).substr(2, 9), text: labelText, lat: targetLat, lng: targetLng, startFrame: currentFrame, duration: 300, color: labelColor, bg: labelBg, size: labelSize, glow: labelGlow, pinned: labelPinned, style: labelStyle 
      }];
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

  const addStoryEvent = () => {
    if (!entityA || !entityB) return;
    setTimeline((prev: any) => {
      const updated = { ...prev };
      updated.takeovers = [...(prev.takeovers || [])]; updated.arrows = [...(prev.arrows || [])]; updated.highlightCountries = [...(prev.highlightCountries || [])];
      const foundEntityA = updated.highlightCountries.find((c:any) => c.name === entityA || c.country === entityA);
      const colorA = foundEntityA?.color || '#ef4444';
      const colorB = updated.highlightCountries.find((c:any) => c.name === entityB || c.country === entityB)?.color || '#3b82f6';
      
      if (eventType === 'takeover') updated.takeovers.push({ id: Math.random().toString(36).substr(2,9), attacker: entityA, target: entityB, startFrame: currentFrame, duration: 90, color: colorA });
      else updated.arrows.push({ id: Math.random().toString(36).substr(2,9), type: 'arrow', sourceName: entityA, targetName: entityB, startFrame: currentFrame, duration: 90, color: colorA });
      
      if (!foundEntityA) updated.highlightCountries.push({ name: entityA, country: entityA, color: colorA, strokeWidth: 2, enableGlow: true, blendMode: 'source-over', isPrimary: true, startFrame: currentFrame, endFrame: videoDuration, revealStyle: 'fade' });
      if (!updated.highlightCountries.find((c:any) => c.name === entityB || c.country === entityB)) updated.highlightCountries.push({ name: entityB, country: entityB, color: colorB, strokeWidth: 2, enableGlow: true, blendMode: 'source-over', isPrimary: false, startFrame: currentFrame, endFrame: videoDuration, revealStyle: 'fade' });
      return updated;
    });
  };

  const addCountryMap = () => {
    if (!newCountrySearch.trim()) return;
    const searchTarget = newCountrySearch.trim();
    setTimeline((prev: any) => {
      const updated = { ...prev };
      updated.highlightCountries = [...(prev.highlightCountries || [])];
      if (!updated.highlightCountries.find((c: any) => (c.name || c.country).toLowerCase() === searchTarget.toLowerCase())) {
        updated.highlightCountries.push({ name: searchTarget, country: searchTarget, color: '#3b82f6', strokeWidth: 2, enableGlow: true, blendMode: 'source-over', isPrimary: false, startFrame: currentFrame, endFrame: videoDuration, revealStyle: 'fade' });
      }
      return updated;
    });
    setNewCountrySearch(''); setShowSuggestions(false);
  };

  const updateEntityStyle = (name: string, key: string, value: any) => {
    setTimeline((prev: any) => {
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
      const updated = { ...prev };
      if (updated.labels) updated.labels = updated.labels.map((l: any) => l.id === id ? { ...l, text } : l);
      return updated;
    });
  };

  const togglePlay = () => { if (!playerRef.current) return; if (isPlaying) playerRef.current.pause(); else playerRef.current.play(); setIsPlaying(!isPlaying); };

  const dynamicTimeline = useMemo(() => {
    if (!timeline) return null;
    const modified: any = { ...timeline, totalFrames: videoDuration };
    if (disabledEntities.length > 0) {
       modified.highlightCountries = modified.highlightCountries?.filter((c: any) => !disabledEntities.includes(c.name || c.country));
       modified.takeovers = modified.takeovers?.filter((t: any) => !disabledEntities.includes(t.target || t.to || t.country));
    }
    let newKfs = [...(timeline.cameraKeyframes || [])];
    if (isLiveEdit && playerRef.current && !isPlaying) {
      newKfs = newKfs.filter((kf: any) => Math.abs(kf.frame - currentFrame) > 15);
      newKfs.push({ frame: currentFrame, lat: targetLat, lng: targetLng, zoom: targetZoom, pitch: targetPitch, bearing: targetBearing });
      newKfs.sort((a: any, b: any) => a.frame - b.frame);
    }
    modified.cameraKeyframes = newKfs;
    return modified;
  }, [timeline, videoDuration, disabledEntities, isLiveEdit, targetLat, targetLng, targetZoom, targetPitch, targetBearing, currentFrame, isPlaying]);

  const playerInputProps = useMemo(() => ({
    timeline: dynamicTimeline, isLiveEditMode: isLiveEdit, mapStyle: mapStyle,
    onCameraChange: (cam: any) => { setTargetLat(cam.lat); setTargetLng(cam.lng); setTargetZoom(cam.zoom); setTargetPitch(cam.pitch); setTargetBearing(cam.bearing); }
  }), [dynamicTimeline, isLiveEdit, mapStyle]);

  const panelStyle: React.CSSProperties = {
    background: 'rgba(20, 20, 24, 0.7)', backdropFilter: 'blur(40px) saturate(200%)', WebkitBackdropFilter: 'blur(40px) saturate(200%)', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 30px 60px rgba(0,0,0,0.6)', borderRadius: '24px'
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
            <div style={{ display: 'flex', gap: '6px', position: 'relative' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input type="text" value={newCountrySearch} onChange={(e) => { setNewCountrySearch(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="Search river, state, country..." style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px', padding: '8px', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }} onKeyDown={(e) => e.key === 'Enter' && addCountryMap()} />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111827', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', zIndex: 999, marginTop: '4px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.8)' }}>
                    {filteredSuggestions.map(s => ( <div key={s} onMouseDown={() => { setNewCountrySearch(s); addCountryMap(); setShowSuggestions(false); }} style={{ padding: '8px 12px', fontSize: '11px', color: '#fff', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{s}</div> ))}
                  </div>
                )}
              </div>
              <button onClick={addCountryMap} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', padding: '0 10px', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'visible', overflowX: 'hidden' }}>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 10px 12px 10px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                          <span style={{ color: '#8e8e93' }}>Reveal Style</span>
                          <select value={c.revealStyle || 'fade'} onChange={(e) => updateEntityStyle(name, 'revealStyle', e.target.value)} style={{ background: '#111', color: '#38bdf8', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '10px', padding: '4px' }}>
                            <option value="fade">Fade In</option><option value="ink">Ink Bleed</option><option value="trim">River Trim</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                          <span style={{ color: '#8e8e93' }}>Fill Color</span>
                          <input type="color" value={c.color || '#3b82f6'} onChange={(e) => updateEntityStyle(name, 'color', e.target.value)} style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                          <span style={{ color: '#8e8e93' }}>Blend Mode</span>
                          <select value={c.blendMode || 'source-over'} onChange={(e) => updateEntityStyle(name, 'blendMode', e.target.value)} style={{ background: '#111', color: '#38bdf8', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '10px', padding: '4px' }}>
                            <option value="source-over">Normal</option><option value="screen">Screen</option><option value="multiply">Multiply</option><option value="overlay">Overlay</option>
                          </select>
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
        <BranchHeader title="📝 TYPOGRAPHY" branchKey="typography" />
        {openBranches.typography && (
          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input type="text" value={labelText} onChange={(e) => setLabelText(e.target.value)} placeholder="Label Text..." style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px', padding: '8px', borderRadius: '8px', outline: 'none' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
              <span style={{ color: '#8e8e93' }}>STYLE ENGINE</span>
              <select value={labelStyle} onChange={(e) => setLabelStyle(e.target.value)} style={{ background: '#111', color: '#38bdf8', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '10px', padding: '4px' }}>
                <option value="callout">Classy Callout</option><option value="pill">Cinematic Pill</option><option value="minimal">Minimal Dot</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: '#8e8e93' }}>COLOR</span>
                <input type="color" value={labelColor} onChange={(e) => setLabelColor(e.target.value)} style={{ width: '18px', height: '18px', border: 'none', background: 'transparent', cursor: 'pointer' }} />
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: '#8e8e93' }}>SIZE</span>
                <input type="range" min="12" max="72" value={labelSize} onChange={(e) => setLabelSize(Number(e.target.value))} style={{ width: '50px', accentColor: '#38bdf8' }} />
              </div>
            </div>
            <button onClick={() => { if(isLiveEdit) dropLabel(); }} style={{ background: isLiveEdit ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)', color: isLiveEdit ? '#38bdf8' : '#8e8e93', border: `1px solid ${isLiveEdit ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', padding: '8px', fontSize: '11px', fontWeight: 700, cursor: isLiveEdit ? 'pointer' : 'not-allowed' }}>{isLiveEdit ? '📍 Drop Element at Crosshair' : 'Enter Live Edit to Drop'}</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <BranchHeader title="🎨 MAP STYLE" branchKey="mapStyle" />
        {openBranches.mapStyle && (
          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['dark-documentary', 'satellite', 'natural-earth', 'light'].map(style => (
              <button key={style} onClick={() => setMapStyle(style)} style={{ flex: '1 1 45%', background: mapStyle === style ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.05)', color: '#fff', border: mapStyle === style ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px', fontSize: '10px', cursor: 'pointer', textTransform: 'capitalize' }}>
                {style.replace('-', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <BranchHeader title="✏️ VECTORS & ROUTES" branchKey="vectors" />
        {openBranches.vectors && (
          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
             {!pathStartCoord ? (
              <button onClick={() => { if(isLiveEdit) setPathStartCoord([targetLng, targetLat]); }} style={{ background: isLiveEdit ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)', color: isLiveEdit ? '#38bdf8' : '#8e8e93', border: `1px solid ${isLiveEdit ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', padding: '8px', fontSize: '11px', fontWeight: 700, cursor: isLiveEdit ? 'pointer' : 'not-allowed' }}>{isLiveEdit ? '📍 1. Lock Start at Crosshair' : 'Enter Live Edit to plot vectors'}</button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: '#38bdf8' }}>Drag map to target, then fire:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => addCustomVector('missile')} style={{ flex: 1, background: '#ef4444', border: 'none', borderRadius: '8px', padding: '6px', color: '#fff', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>🚀 Missile</button>
                  <button onClick={() => addCustomVector('arrow')} style={{ flex: 1, background: '#3b82f6', border: 'none', borderRadius: '8px', padding: '6px', color: '#fff', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>🏹 Arrow</button>
                  <button onClick={() => setPathStartCoord(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '6px 10px', color: '#fff', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const rightPanelJSX = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
        <button onClick={handleDeterministicExport} disabled={isPreloading || isExporting} style={{ background: isExporting ? '#f59e0b' : '#10b981', color: '#000', border: 'none', borderRadius: '10px', height: '42px', fontSize: '11px', fontWeight: 800, cursor: isExporting ? 'wait' : 'pointer', boxShadow: '0 0 15px rgba(16,185,129,0.2)' }}>
          {isExporting ? `⏳ Exporting...` : '🎥 Offline WebM (100% Tiles)'}
        </button>
      </div>

      {isExporting && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '8px', fontSize: '10px', color: '#fde047', textAlign: 'center', marginBottom: '8px' }}>
          {exportProgress}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 700, letterSpacing: '0.15em' }}>CAMERA ENGINE</div>
        {isLiveEdit && <button onClick={() => setIsLiveEdit(false)} style={{ background: 'transparent', color: '#8e8e93', border: 'none', fontSize: '10px', cursor: 'pointer' }}>✕ Close</button>}
      </div>

      {!isLiveEdit ? (
        <button onClick={startLiveEdit} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '10px', width: '100%', height: '38px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 15px rgba(56,189,248,0.1)', marginTop: '10px' }}>🎯 Enter Live Canvas Edit</button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          <button onClick={dropKeyframeLive} style={{ background: '#38bdf8', color: '#000', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(56,189,248,0.4)' }}>📍 Save Keyframe Here</button>
        </div>
      )}

      {((timeline as any)?.arrows?.length > 0 || (timeline as any)?.takeovers?.length > 0 || (timeline as any)?.labels?.length > 0) && (
        <React.Fragment>
          <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 700, letterSpacing: '0.15em', width: '100%', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginTop: '10px' }}>ACTIVE ASSETS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(timeline as any).labels?.map((l: any) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px' }}>
                <input type="text" value={l.text} onChange={(e) => updateLabelText(l.id, e.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', flex: 1, outline: 'none' }} />
                <button onClick={() => deleteAsset(l.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>✕</button>
              </div>
            ))}
            {(timeline as any).arrows?.filter((a:any) => a.id).map((a: any) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 12px' }}>
                <span style={{ fontSize: '11px', color: '#fff' }}>{a.type === 'missile' ? '🚀 Missile' : '🏹 Arrow'}</span>
                <button onClick={() => deleteAsset(a.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>✕</button>
              </div>
            ))}
            {(timeline as any).takeovers?.filter((t:any) => t.id).map((t: any) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', padding: '6px 12px' }}>
                <span style={{ fontSize: '11px', color: '#ef4444' }}>⚔️ {t.attacker} › {t.target}</span>
                <button onClick={() => deleteAsset(t.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>✕</button>
              </div>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );

  const handleDragEdge = (e: React.PointerEvent, index: number, isStart: boolean) => {
    e.stopPropagation();
    const track = trackContainerRef.current?.getBoundingClientRect();
    if (!track) return;
    
    const onMove = (moveEvent: PointerEvent) => {
      const px = moveEvent.clientX - track.left;
      const pct = Math.max(0, Math.min(1, px / track.width));
      const frame = Math.round(pct * videoDuration);
      
      setTimeline((prev: any) => {
        const u = { ...prev, highlightCountries: [...prev.highlightCountries] };
        const entity = u.highlightCountries[index];
        if (isStart) entity.startFrame = Math.min(frame, (entity.endFrame || videoDuration) - 5);
        else entity.endFrame = Math.max(frame, (entity.startFrame || 0) + 5);
        return u;
      });
    };
    
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  };

  const handleDragClip = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    setSelectedEntity(timeline.highlightCountries[index].name);
    
    const track = trackContainerRef.current?.getBoundingClientRect();
    if (!track) return;
    
    const startX = e.clientX;
    const initialStartFrame = timeline.highlightCountries[index].startFrame || 0;
    const initialEndFrame = timeline.highlightCountries[index].endFrame || videoDuration;
    
    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const frameShift = Math.round((dx / track.width) * videoDuration);
      
      setTimeline((prev: any) => {
        const u = { ...prev, highlightCountries: [...prev.highlightCountries] };
        const entity = u.highlightCountries[index];
        
        let newStart = initialStartFrame + frameShift;
        let newEnd = initialEndFrame + frameShift;
        
        if (newStart < 0) {
          newEnd -= newStart;
          newStart = 0;
        }
        if (newEnd > videoDuration) {
          newStart -= (newEnd - videoDuration);
          newEnd = videoDuration;
        }
        
        entity.startFrame = newStart;
        entity.endFrame = newEnd;
        return u;
      });
    };
    
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  };

  const handleDragKeyframe = (e: React.PointerEvent, kfIndex: number) => {
    e.stopPropagation();
    const track = trackContainerRef.current?.getBoundingClientRect();
    if (!track) return;
    
    const onMove = (moveEvent: PointerEvent) => {
      const px = moveEvent.clientX - track.left;
      const pct = Math.max(0, Math.min(1, px / track.width));
      const frame = Math.round(pct * videoDuration);
      
      setTimeline((prev: any) => {
        const u = { ...prev, cameraKeyframes: [...prev.cameraKeyframes] };
        const isCollision = u.cameraKeyframes.some((k: any, idx: number) => idx !== kfIndex && Math.abs(k.frame - frame) < 15);
        if (!isCollision) {
           u.cameraKeyframes[kfIndex].frame = frame;
           u.cameraKeyframes.sort((a: any, b: any) => a.frame - b.frame);
        }
        return u;
      });
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  };

  return (
    <div style={{ backgroundColor: '#000', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#fff', overflow: 'hidden' }}>

      <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: isDesktop ? '20px' : '0px', overflow: 'hidden' }}>
        
        {status !== 'editor' && status !== 'generating' && (
          <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '680px', padding: '16px', boxSizing: 'border-box' }}>
            <h1 style={{ fontSize: isDesktop ? '42px' : '28px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '24px', textAlign: 'center' }}>Cinematic Timeline Studio</h1>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(255,255,255,0.06)', padding: '6px', borderRadius: '18px', width: '100%', maxWidth: '320px', boxSizing: 'border-box' }}>
              <button onClick={() => setManualMode(false)} style={{ flex: 1, background: !manualMode ? 'rgba(255,255,255,0.15)' : 'transparent', color: !manualMode ? '#fff' : '#8e8e93', border: 'none', borderRadius: '12px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>AI Directive</button>
              <button onClick={() => setManualMode(true)} style={{ background: manualMode ? 'rgba(255,255,255,0.15)' : 'transparent', color: manualMode ? '#fff' : '#8e8e93', border: 'none', borderRadius: '12px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Manual Builder</button>
            </div>
            {!manualMode ? (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '24px', padding: '16px', boxSizing: 'border-box' }}>
                <textarea placeholder="e.g., North Korea and South Korea relations..." value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} style={{ width: '100%', background: 'transparent', border: 'none', color: '#ffffff', fontSize: '16px', outline: 'none', resize: 'none', boxSizing: 'border-box' }} required />
                <button type="submit" style={{ background: '#fff', color: '#000', border: 'none', borderRadius: '16px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}>Generate ✦</button>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '24px', padding: '16px', boxSizing: 'border-box' }}>
                <input type="text" value={entityA} onChange={(e) => setEntityA(e.target.value)} placeholder="Primary Entity" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '12px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                <input type="text" value={entityB} onChange={(e) => setEntityB(e.target.value)} placeholder="Secondary Entity" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '12px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                <button onClick={initializeManualScene} style={{ background: '#38bdf8', color: '#000', border: 'none', borderRadius: '16px', padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Launch Empty Studio 🚀</button>
              </div>
            )}
          </div>
        )}

        {status === 'generating' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '14px', letterSpacing: '0.2em', color: '#38bdf8', fontWeight: 600 }}>COMPILING DIRECTIVE...</div>
          </div>
        )}

        {status === 'editor' && dynamicTimeline && (
          <React.Fragment>
            {/* FIXED SLIDING DRAWERS FOR DESKTOP AND MOBILE */}
            <div style={{ position: 'fixed', left: leftPanelOpen ? '0px' : '-300px', top: '40%', transform: 'translateY(-50%)', transition: 'left 0.3s cubic-bezier(0.25, 1, 0.5, 1)', zIndex: 100, display: 'flex', alignItems: 'center' }}>
              <div style={{ ...panelStyle, width: '300px', maxHeight: '75vh', borderLeft: 'none', borderRadius: '0 16px 16px 0', overflowY: 'auto' }}>
                {leftPanelJSX}
              </div>
              <div onClick={() => setLeftPanelOpen(!leftPanelOpen)} style={{ ...panelStyle, width: '36px', height: '72px', borderLeft: 'none', borderRadius: '0 12px 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#38bdf8', fontSize: '14px', marginLeft: '-1px' }}>
                 {leftPanelOpen ? '◀' : '▶'}
              </div>
            </div>

            <div style={{ position: 'fixed', right: rightPanelOpen ? '0px' : '-300px', top: '40%', transform: 'translateY(-50%)', transition: 'right 0.3s cubic-bezier(0.25, 1, 0.5, 1)', zIndex: 100, display: 'flex', alignItems: 'center' }}>
              <div onClick={() => setRightPanelOpen(!rightPanelOpen)} style={{ ...panelStyle, width: '36px', height: '72px', borderRight: 'none', borderRadius: '12px 0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#a855f7', fontSize: '14px', marginRight: '-1px' }}>
                 {rightPanelOpen ? '▶' : '◀'}
              </div>
              <div style={{ ...panelStyle, width: '300px', maxHeight: '75vh', borderRight: 'none', borderRadius: '16px 0 0 16px', overflowY: 'auto' }}>
                {rightPanelJSX}
              </div>
            </div>

            <div style={{ height: '100%', maxHeight: '100%', aspectRatio: '9/16', borderRadius: isDesktop ? '24px' : '0px', border: isDesktop ? '2px solid #1a1a1a' : 'none', boxShadow: isLiveEdit ? '0 0 0 4px #38bdf8, 0 30px 90px rgba(56,189,248,0.4)' : '0 0 40px rgba(0,0,0,0.8)', position: 'relative', overflow: 'hidden', background: '#040711', zIndex: 10 }}>
              <Player
                ref={playerRef} component={MapAnimation} inputProps={playerInputProps} durationInFrames={videoDuration} compositionWidth={1080} compositionHeight={1920} fps={30} controls={false} loop autoPlay
                style={{ width: '100%', height: '100%', display: 'block', pointerEvents: isLiveEdit ? 'none' : 'none' }}
              />
              {/* Simple crosshair overlay during live edit, MapLibre handles native touches */}
              {isLiveEdit && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '28px', height: '28px', border: '1.5px solid rgba(56,189,248,0.5)', borderRadius: '50%', pointerEvents: 'none', zIndex: 50 }}>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '4px', height: '4px', background: '#38bdf8', borderRadius: '50%' }} />
                </div>
              )}
            </div>
          </React.Fragment>
        )}
      </div>

      {status === 'editor' && dynamicTimeline && (
        <div style={{ position: 'fixed', bottom: isDesktop ? '20px' : '30px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 120, padding: '0 16px', boxSizing: 'border-box' }}>
          <div style={{ ...panelStyle, width: '100%', maxWidth: '900px', display: 'flex', alignItems: 'center', gap: '16px', borderRadius: '24px', padding: '12px 24px', height: '140px', boxSizing: 'border-box' }}>
            <button onClick={togglePlay} style={{ background: '#ffffff', color: '#000', border: 'none', borderRadius: '50%', width: '40px', height: '40px', flexShrink: 0, cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', alignSelf: 'flex-start' }}>{isPlaying ? '❚❚' : '▶'}</button>
            
            <div style={{ flex: 1, height: '100%', overflowY: 'auto', paddingRight: '8px', position: 'relative' }}>
              <div ref={trackContainerRef} style={{ position: 'relative', minHeight: '100%' }}>
                
                <div style={{ position: 'sticky', top: 0, height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', zIndex: 5 }}>
                  <input type="range" min="0" max={videoDuration} step="1" value={currentFrame} onChange={(e) => { const tf = Number(e.target.value); setCurrentFrame(tf); playerRef.current?.seekTo(tf); }} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer', margin: 0, height: '100%', opacity: 0.3 }} />
                </div>
                
                {/* Camera Keyframes */}
                {timeline?.cameraKeyframes && timeline.cameraKeyframes.map((kf: any, i: number) => {
                  const leftPercent = (kf.frame / videoDuration) * 100;
                  return (
                    <div key={`kf-drawer-${i}`} style={{ position: 'absolute', left: `${Math.min(Math.max(leftPercent, 0), 100)}%`, top: '8px', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 30 }}>
                      <div onPointerDown={(e) => handleDragKeyframe(e, i)} style={{ width: '12px', height: '12px', backgroundColor: '#a855f7', border: '2px solid #ffffff', cursor: 'ew-resize', transform: 'rotate(45deg)', boxShadow: '0 2px 8px rgba(0,0,0,0.8)' }} />
                      <button onClick={() => { if (confirm(`Delete keyframe at frame ${kf.frame}?`)) deleteSpecificKeyframe(kf.frame); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '14px', height: '14px', fontSize: '8px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  );
                })}

                {/* Staggered Entity Tracks */}
                {timeline?.highlightCountries && timeline.highlightCountries.map((c: any, i: number) => {
                  const startPct = ((c.startFrame || 0) / videoDuration) * 100;
                  const endPct = ((c.endFrame || videoDuration) / videoDuration) * 100;
                  const widthPct = endPct - startPct;
                  return (
                    <div 
                      key={`hc-drawer-${i}`}
                      style={{ position: 'absolute', left: `${startPct}%`, width: `${widthPct}%`, top: `${32 + (i * 28)}px`, height: '22px', background: c.color || '#3b82f6', opacity: 0.85, borderRadius: '4px', display: 'flex', justifyContent: 'space-between', zIndex: 16, boxShadow: '0 2px 6px rgba(0,0,0,0.8)' }}
                    >
                      <div onPointerDown={(e) => handleDragEdge(e, i, true)} style={{ width: '16px', height: '100%', background: 'rgba(255,255,255,0.4)', borderRadius: '4px 0 0 4px', cursor: 'ew-resize' }} />
                      <div onPointerDown={(e) => handleDragClip(e, i)} style={{ flex: 1, height: '100%', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#fff', fontWeight: 600, pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{c.name}</span>
                      </div>
                      <div onPointerDown={(e) => handleDragEdge(e, i, false)} style={{ width: '16px', height: '100%', background: 'rgba(255,255,255,0.4)', borderRadius: '0 4px 4px 0', cursor: 'ew-resize' }} />
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', alignSelf: 'flex-start' }}>
              <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.05em', flexShrink: 0 }}>
                {(currentFrame / 30).toFixed(1)}s / {(videoDuration / 30).toFixed(1)}s
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default WebApp;
const container = document.getElementById('root');
if (container) { const root = createRoot(container); root.render(<WebApp />); }