import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { MapAnimation } from './MapAnimation';
import fixWebmDuration from 'fix-webm-duration';
import './index.css';

const WebApp: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'editor'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  
  const [timeline, setTimeline] = useState<any | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(300);
  
  const [disabledEntities, setDisabledEntities] = useState<string[]>([]);
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
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [isPreloading, setIsPreloading] = useState<boolean>(false);
  
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragPos = useRef<{x: number, y: number} | null>(null);
  const activePointers = useRef<Map<number, {x: number, y: number}>>(new Map());
  const previousPinch = useRef<{ dist: number, angle: number, centerY: number, centerX: number } | null>(null);
  
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

  const [mapStyle, setMapStyle] = useState<string>('satellite');

  const [labelText, setLabelText] = useState<string>('DMZ Border');
  const [labelColor, setLabelColor] = useState<string>('#ffffff');
  const [labelBg, setLabelBg] = useState<string>('rgba(0,0,0,0.7)');
  const [labelSize, setLabelSize] = useState<number>(24);
  const [labelGlow, setLabelGlow] = useState<boolean>(true);
  const [labelPinned, setLabelPinned] = useState<boolean>(true);

  useEffect(() => {
    let animationFrameId: number;
    const syncTimeline = () => {
      if (playerRef.current && isPlaying && !isExporting) {
        setCurrentFrame(playerRef.current.getCurrentFrame());
      }
      animationFrameId = requestAnimationFrame(syncTimeline);
    };
    syncTimeline();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isExporting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setStatus('generating');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/generate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ prompt }) 
      });
      const data = await response.json();
      
      if (data && data.timeline) {
        if (!prompt.toLowerCase().includes('invad') && !prompt.toLowerCase().includes('attack') && !prompt.toLowerCase().includes('war')) {
           data.timeline.takeovers = [];
        }
        setTimeline(data.timeline);
        setVideoDuration(data.timeline.totalFrames || 300);
        setStatus('editor');
      } else {
        setErrorMessage("API Quota Exceeded. Please try again later.");
        setStatus('idle');
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Network error. Please try again.");
      setStatus('idle');
    }
  };

  const handleFinalizeCache = async () => {
    setIsPreloading(true);
    playerRef.current?.pause();
    setIsPlaying(false);
    
    for(let f = 0; f < videoDuration; f += 10) {
      playerRef.current?.seekTo(f);
      await new Promise(r => setTimeout(r, 100)); 
    }
    
    playerRef.current?.seekTo(0);
    setIsPreloading(false);
    alert("Map Cache Finalized! Ready for flawless export.");
  };

  // 🚀 BULLETPROOF MOBILE CANVAS EXPORTER (OOM Crash Fix & Live Progress)
  const handleFastMobileExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    playerRef.current?.seekTo(0);
    playerRef.current?.play();
    setIsPlaying(true);

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = 1080;
    compositeCanvas.height = 1920;
    
    // 🔥 FIX: Shrunk to 1px and made virtually invisible so it satisfies Chromium
    // without blocking your screen or glitching the UI.
    compositeCanvas.style.cssText = 'position:absolute; top:0; left:0; width:1px; height:1px; opacity:0.01; z-index:-1; pointer-events:none;';
    
    const playerContainer = document.querySelector('.remotion-player') || document.body;
    playerContainer.appendChild(compositeCanvas);

    const ctx = compositeCanvas.getContext('2d');
    if (!ctx) {
      setIsExporting(false);
      return;
    }

    const stream = compositeCanvas.captureStream(30);
    const videoTrack = stream.getVideoTracks()[0] as any;

    const options = { mimeType: 'video/webm', videoBitsPerSecond: 5000000 }; // Dropped to 5Mbps to stop mobile RAM crashes
    if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
      options.mimeType = 'video/webm; codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')) {
       options.mimeType = 'video/webm; codecs=vp8';
    }
    
    const recorder = new MediaRecorder(stream, options);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    let animId: number;
    const renderLoop = () => {
      if (!isExporting) return;
      ctx.clearRect(0, 0, 1080, 1920);
      
      const mapCanvas = document.querySelector('canvas.maplibregl-canvas') as HTMLCanvasElement;
      const blendCanvas = document.querySelector('canvas#vector-blend-overlay') as HTMLCanvasElement;
      const uiCanvas = document.querySelector('canvas#vector-ui-overlay') as HTMLCanvasElement;
      
      if (mapCanvas) ctx.drawImage(mapCanvas, 0, 0, 1080, 1920);
      
      ctx.globalCompositeOperation = 'screen';
      if (blendCanvas) ctx.drawImage(blendCanvas, 0, 0, 1080, 1920);
      
      ctx.globalCompositeOperation = 'source-over';
      if (uiCanvas) ctx.drawImage(uiCanvas, 0, 0, 1080, 1920);
      
      if (videoTrack && typeof videoTrack.requestFrame === 'function') {
          videoTrack.requestFrame();
      }

      animId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    const startTime = Date.now();
    const durationMs = (videoDuration / 30) * 1000;

    // Progress Tracker Interval
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const prog = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setExportProgress(prog);
    }, 100);

    recorder.onstop = async () => {
      clearInterval(progressInterval);
      cancelAnimationFrame(animId);
      if (compositeCanvas.parentNode) compositeCanvas.parentNode.removeChild(compositeCanvas);
      
      let blob = new Blob(chunks, { type: options.mimeType });
      
      try {
        blob = await fixWebmDuration(blob, durationMs);
      } catch (err) {
        console.warn("Duration patcher warning:", err);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${timeline?.title?.replace(/\s+/g, '_') || 'Bhuloka_Mobile'}_${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setIsExporting(false);
      setExportProgress(0);
    };

    recorder.start(250); 
    
    setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
      playerRef.current?.pause();
      setIsPlaying(false);
    }, durationMs + 500);
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
        alert("Backend rendering failed. Ensure your server terminal is running and has FFmpeg installed.");
      }
    } catch (e) {
      alert("Network error during local export.");
    }
    setIsExporting(false);
  };

  const initializeManualScene = () => {
    const blankTimeline = {
      title: `${entityA} vs ${entityB} (Manual)`,
      totalFrames: 300,
      highlightCountries: [
        { name: entityA, country: entityA, color: '#ef4444', strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, glowTarget: 'both', dropShadow: true, blendMode: 'screen', isPrimary: true, startFrame: 0, revealStyle: 'ink' },
        { name: entityB, country: entityB, color: '#3b82f6', strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, glowTarget: 'both', dropShadow: true, blendMode: 'screen', isPrimary: false, startFrame: 0, revealStyle: 'ink' }
      ],
      takeovers: [],
      arrows: [],
      labels: [],
      cameraKeyframes: [{ frame: 0, zoom: 1.2, lat: 38.0, lng: 127.0, latitude: 38.0, longitude: 127.0, pitch: 45, bearing: 0, easing: 'easeInOut' }],
      assets: [] 
    }; 
    setTimeline(blankTimeline);
    setVideoDuration(300);
    setStatus('editor');
  };

  const startLiveEdit = () => {
    playerRef.current?.pause();
    setIsPlaying(false);
    const cFrame = currentFrame;
    const pastKfs = timeline?.cameraKeyframes?.filter((kf: any) => kf.frame <= cFrame) || [];
    const baseKf: any = pastKfs[pastKfs.length - 1] || timeline?.cameraKeyframes?.[0] || { lat: 38.0, lng: 127.0, zoom: 1.2, pitch: 45, bearing: 0, easing: 'easeInOut' };

    setTargetLat(baseKf.lat !== undefined ? baseKf.lat : (baseKf.latitude !== undefined ? baseKf.latitude : 38.0));
    setTargetLng(baseKf.lng !== undefined ? baseKf.lng : (baseKf.longitude !== undefined ? baseKf.longitude : 127.0));
    setTargetZoom(baseKf.zoom !== undefined ? baseKf.zoom : 1.2);
    setTargetPitch(baseKf.pitch !== undefined ? baseKf.pitch : 45);
    setTargetBearing(baseKf.bearing !== undefined ? baseKf.bearing : 0);
    setIsLiveEdit(true);
  };

  const dropKeyframeLive = () => {
    const cFrame = currentFrame;
    let extensionNeeded = 0;
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.cameraKeyframes = [...(prev.cameraKeyframes || [])].filter((kf: any) => Math.abs(kf.frame - cFrame) > 15);
      updated.cameraKeyframes.push({ frame: cFrame, zoom: targetZoom, lat: targetLat, lng: targetLng, latitude: targetLat, longitude: targetLng, pitch: targetPitch, bearing: targetBearing });
      updated.cameraKeyframes.sort((a: any, b: any) => a.frame - b.frame);
      if (cFrame + 60 >= videoDuration) {
        extensionNeeded = (cFrame + 90) - videoDuration;
        updated.totalFrames = cFrame + 90;
      }
      return updated;
    });
    if (extensionNeeded > 0) setVideoDuration(prev => prev + extensionNeeded);
  };

  const deleteSpecificKeyframe = (frameIndex: number) => {
    setTimeline((prev: any) => {
      if (!prev || !prev.cameraKeyframes) return prev;
      const updated = { ...prev };
      updated.cameraKeyframes = updated.cameraKeyframes.filter((kf: any) => kf.frame !== frameIndex);
      return updated;
    });
  };

  const addCustomVector = (type: 'missile' | 'arrow') => {
    if (!pathStartCoord) return;
    const cFrame = currentFrame;
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.arrows = [...(prev.arrows || []), { id: Math.random().toString(36).substr(2, 9), type, origin: pathStartCoord, target: [targetLng, targetLat], startFrame: cFrame, duration: 90, color: type === 'missile' ? '#ffffff' : '#ef4444' }];
      return updated;
    });
    setPathStartCoord(null); 
  };

  const dropLabel = () => {
    if (!labelText.trim()) return;
    const cFrame = currentFrame;
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.labels = [...(prev.labels || []), { 
        id: Math.random().toString(36).substr(2, 9), 
        text: labelText, 
        lat: targetLat, 
        lng: targetLng, 
        startFrame: cFrame, 
        duration: 150, 
        color: labelColor, 
        bg: labelBg, 
        size: labelSize, 
        glow: labelGlow, 
        pinned: labelPinned 
      }];
      return updated;
    });
  };

  const deleteAsset = (id: string) => {
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (updated.assets) updated.assets = updated.assets.filter((a: any) => a.id !== id);
      if (updated.arrows) updated.arrows = updated.arrows.filter((a: any) => a.id !== id);
      if (updated.takeovers) updated.takeovers = updated.takeovers.filter((t: any) => t.id !== id);
      if (updated.labels) updated.labels = updated.labels.filter((l: any) => l.id !== id);
      return updated;
    });
  };

  const cutEntity = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (updated.highlightCountries) {
        updated.highlightCountries = updated.highlightCountries.filter((c: any) => c.name !== name && c.country !== name);
      }
      return updated;
    });
    if (selectedEntity === name) setSelectedEntity(null);
  };

  const addStoryEvent = () => {
    if (!entityA || !entityB) return;
    const cFrame = currentFrame;
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.takeovers = [...(prev.takeovers || [])];
      updated.arrows = [...(prev.arrows || [])];
      updated.highlightCountries = [...(prev.highlightCountries || [])];

      const foundEntityA = updated.highlightCountries.find((c:any) => c.name === entityA || c.country === entityA);
      const colorA = foundEntityA?.color || '#ef4444';
      const colorB = updated.highlightCountries.find((c:any) => c.name === entityB || c.country === entityB)?.color || '#3b82f6';

      if (eventType === 'takeover') {
        updated.takeovers.push({ id: Math.random().toString(36).substr(2,9), attacker: entityA, target: entityB, startFrame: cFrame, duration: 90, color: colorA });
      } else {
        updated.arrows.push({ id: Math.random().toString(36).substr(2,9), type: 'arrow', sourceName: entityA, targetName: entityB, startFrame: cFrame, duration: 90, color: colorA });
      }

      if (!foundEntityA) {
        updated.highlightCountries.push({ name: entityA, country: entityA, color: colorA, strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, glowTarget: 'both', dropShadow: true, blendMode: 'screen', isPrimary: true, startFrame: cFrame, revealStyle: 'fade' });
      }
      if (!updated.highlightCountries.find((c:any) => c.name === entityB || c.country === entityB)) {
        updated.highlightCountries.push({ name: entityB, country: entityB, color: colorB, strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, glowTarget: 'both', dropShadow: true, blendMode: 'screen', isPrimary: false, startFrame: cFrame, revealStyle: 'fade' });
      }
      return updated;
    });
  };

  const addCountryMap = () => {
    if (!newCountrySearch.trim()) return;
    const cFrame = currentFrame;
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.highlightCountries = [...(prev.highlightCountries || [])];
      const exists = updated.highlightCountries.find((c: any) => (c.name || c.country).toLowerCase() === newCountrySearch.trim().toLowerCase());
      if (!exists) {
        updated.highlightCountries.push({ name: newCountrySearch.trim(), country: newCountrySearch.trim(), color: '#3b82f6', strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, glowTarget: 'both', dropShadow: true, blendMode: 'screen', isPrimary: false, startFrame: cFrame, revealStyle: 'fade' });
      }
      return updated;
    });
    setNewCountrySearch(''); 
  };

  const updateEntityStyle = (key: string, value: any) => {
    if (!selectedEntity) return;
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (updated.highlightCountries) {
        updated.highlightCountries = updated.highlightCountries.map((c: any) => {
          if (c.name === selectedEntity || c.country === selectedEntity) return { ...c, [key]: value };
          return c;
        });
      }
      if (key === 'color') {
        if (updated.arrows) updated.arrows = updated.arrows.map((arr: any) => (arr.sourceName === selectedEntity && arr.type !== 'missile' ? { ...arr, color: value } : arr));
        if (updated.takeovers) updated.takeovers = updated.takeovers.map((t: any) => (t.attacker === selectedEntity ? { ...t, color: value } : t));
      }
      return updated;
    });
  };

  const toggleEntitySuppression = (name: string) => {
    setDisabledEntities(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]);
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pause();
    else playerRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const activeEntityData: any = timeline?.highlightCountries?.find((c: any) => c.name === selectedEntity || c.country === selectedEntity);
  const activeColor = activeEntityData?.color || '#3b82f6';
  const activeStrokeColor = activeEntityData?.strokeColor || '#ffffff';
  const activeStrokeWidth = activeEntityData?.strokeWidth !== undefined ? activeEntityData.strokeWidth : 2.5;
  const activeEnableGlow = activeEntityData?.enableGlow !== undefined ? activeEntityData.enableGlow : true;
  const activeGlowIntensity = activeEntityData?.glowIntensity !== undefined ? activeEntityData.glowIntensity : 20;
  const activeBlendMode = activeEntityData?.blendMode || 'screen';
  const activeGlowTarget = activeEntityData?.glowTarget || 'both';
  const activeDropShadow = activeEntityData?.dropShadow !== undefined ? activeEntityData.dropShadow : true;

  const dynamicTimeline = useMemo(() => {
    if (!timeline) return null;
    const modified: any = { ...timeline, totalFrames: videoDuration };
    
    modified.highlightCountries = timeline.highlightCountries;
    modified.takeovers = timeline.takeovers;
    modified.arrows = timeline.arrows;
    modified.assets = timeline.assets;
    modified.labels = timeline.labels || [];

    if (disabledEntities.length > 0) {
       modified.highlightCountries = modified.highlightCountries?.filter((c: any) => !disabledEntities.includes(c.name || c.country));
       modified.takeovers = modified.takeovers?.filter((t: any) => !disabledEntities.includes(t.target || t.to || t.country));
    }
    
    let newKfs = [...(timeline.cameraKeyframes || [])];
    newKfs = newKfs.map((kf: any) => ({ ...kf, lat: kf.lat !== undefined ? kf.lat : (kf.latitude !== undefined ? kf.latitude : 38.0), lng: kf.lng !== undefined ? kf.lng : (kf.longitude !== undefined ? kf.longitude : 127.0), latitude: kf.latitude !== undefined ? kf.latitude : (kf.lat !== undefined ? kf.lat : 38.0), longitude: kf.longitude !== undefined ? kf.longitude : (kf.lng !== undefined ? kf.lng : 127.0), zoom: kf.zoom !== undefined ? kf.zoom : 1.2, pitch: kf.pitch !== undefined ? kf.pitch : 0, bearing: kf.bearing !== undefined ? kf.bearing : 0 }));
    
    if (isLiveEdit && playerRef.current && !isPlaying) {
      newKfs = newKfs.filter((kf: any) => Math.abs(kf.frame - currentFrame) > 15);
      newKfs.push({ frame: currentFrame, lat: targetLat, lng: targetLng, latitude: targetLat, longitude: targetLng, zoom: targetZoom, pitch: targetPitch, bearing: targetBearing });
      newKfs.sort((a: any, b: any) => a.frame - b.frame);
    }
    modified.cameraKeyframes = newKfs;

    return modified;
  }, [timeline, videoDuration, disabledEntities, isLiveEdit, targetLat, targetLng, targetZoom, targetPitch, targetBearing, currentFrame, isPlaying]);

  const playerInputProps = useMemo(() => ({
    timeline: dynamicTimeline,
    isLiveEditMode: isLiveEdit,
    mapStyle: mapStyle
  }), [dynamicTimeline, isLiveEdit, mapStyle]);

  const panelStyle: React.CSSProperties = {
    background: 'rgba(20, 20, 24, 0.55)',
    backdropFilter: 'blur(30px) saturate(180%)',
    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 30px 60px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1)'
  };

  const leftPanelJSX = (
    <React.Fragment>
      <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 700, letterSpacing: '0.15em', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>SCENE ENTITIES</div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input type="text" value={newCountrySearch} onChange={(e) => setNewCountrySearch(e.target.value)} placeholder="Search Country..." style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px', padding: '8px', borderRadius: '8px', outline: 'none' }} onKeyDown={(e) => e.key === 'Enter' && addCountryMap()} />
        <button onClick={addCountryMap} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', padding: '0 10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
        {timeline?.highlightCountries && timeline.highlightCountries.map((c: any, idx: number) => {
          const name = c.name || c.country;
          const isDisabled = disabledEntities.includes(name);
          const isSelected = selectedEntity === name;
          return (
            <div key={`entity-${idx}`} style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setSelectedEntity(name)} style={{ flex: 1, background: isSelected ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.05)', border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)', color: '#ffffff', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', textAlign: 'left', cursor: 'pointer', textDecoration: isDisabled ? 'line-through' : 'none' }}>{name}</button>
              <button onClick={() => toggleEntitySuppression(name)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8e8e93', borderRadius: '8px', padding: '0 6px', cursor: 'pointer', fontSize: '11px' }}>{isDisabled ? '🙈' : '👁️'}</button>
              <button onClick={(e) => cutEntity(e, name)} style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '8px', padding: '0 6px', cursor: 'pointer', fontSize: '10px' }}>✕</button>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 700, letterSpacing: '0.15em', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginTop: '12px' }}>MAP TYPOGRAPHY</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <input type="text" value={labelText} onChange={(e) => setLabelText(e.target.value)} placeholder="Label Text..." style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px', padding: '8px', borderRadius: '8px', outline: 'none' }} />
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', color: '#8e8e93' }}>TXT</span>
            <input type="color" value={labelColor} onChange={(e) => setLabelColor(e.target.value)} style={{ width: '18px', height: '18px', border: 'none', background: 'transparent', cursor: 'pointer' }} />
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', color: '#8e8e93' }}>BG</span>
            <input type="color" value={labelBg} onChange={(e) => setLabelBg(e.target.value)} style={{ width: '18px', height: '18px', border: 'none', background: 'transparent', cursor: 'pointer' }} />
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', color: '#8e8e93' }}>SIZE</span>
            <input type="range" min="12" max="72" value={labelSize} onChange={(e) => setLabelSize(Number(e.target.value))} style={{ width: '40px', accentColor: '#38bdf8' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setLabelGlow(!labelGlow)} style={{ flex: 1, background: labelGlow ? '#38bdf8' : 'rgba(255,255,255,0.05)', color: labelGlow ? '#000' : '#8e8e93', border: 'none', borderRadius: '6px', padding: '4px', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>{labelGlow ? 'GLOW ON' : 'GLOW OFF'}</button>
          <button onClick={() => setLabelPinned(!labelPinned)} style={{ flex: 1, background: labelPinned ? '#10b981' : 'rgba(255,255,255,0.05)', color: labelPinned ? '#000' : '#8e8e93', border: 'none', borderRadius: '6px', padding: '4px', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>{labelPinned ? '📌 PINNED' : 'FLOAT'}</button>
        </div>
        <button onClick={() => { if(isLiveEdit) dropLabel(); }} style={{ background: isLiveEdit ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)', color: isLiveEdit ? '#38bdf8' : '#8e8e93', border: `1px solid ${isLiveEdit ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', padding: '8px', fontSize: '11px', fontWeight: 700, cursor: isLiveEdit ? 'pointer' : 'not-allowed' }}>{isLiveEdit ? '📍 Drop Label at Crosshair' : 'Enter Live Edit to Drop'}</button>
      </div>

      <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 700, letterSpacing: '0.15em', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginTop: '12px' }}>MAP STYLE</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {['satellite', 'dark', 'light', 'street'].map(style => (
          <button key={style} onClick={() => setMapStyle(style)} style={{ flex: '1 1 45%', background: mapStyle === style ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.05)', color: '#fff', border: mapStyle === style ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px', fontSize: '10px', cursor: 'pointer', textTransform: 'capitalize' }}>
            {style}
          </button>
        ))}
      </div>

      <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 700, letterSpacing: '0.15em', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginTop: '12px' }}>CUSTOM VECTORS</div>
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

      {((timeline as any)?.assets?.length > 0 || (timeline as any)?.arrows?.some((a:any) => a.id) || (timeline as any)?.takeovers?.some((t:any) => t.id) || (timeline as any)?.labels?.length > 0) && (
        <React.Fragment>
          <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 700, letterSpacing: '0.15em', width: '100%', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginTop: '10px' }}>ACTIVE ASSETS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(timeline as any).labels?.map((l: any) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 12px' }}>
                <span style={{ fontSize: '11px', color: '#fff' }}>📝 {l.text}</span>
                <button onClick={() => deleteAsset(l.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>✕</button>
              </div>
            ))}
            {(timeline as any).assets?.map((a: any) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 12px' }}>
                <span style={{ fontSize: '11px', color: '#fff' }}>{a.type === 'pin' ? '📍 Pin' : '💥 Boom'}</span>
                <button onClick={() => deleteAsset(a.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>✕</button>
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
    </React.Fragment>
  );

  const rightPanelJSX = (
    <React.Fragment>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
        <button 
          onClick={handleHDLocalExport} 
          disabled={isPreloading || isExporting} 
          style={{ background: isExporting ? '#f59e0b' : '#a855f7', color: '#fff', border: 'none', borderRadius: '10px', width: '100%', height: '34px', fontSize: '11px', fontWeight: 800, cursor: isExporting ? 'wait' : 'pointer' }}>
          {isExporting ? '⏳ Rendering HD MP4...' : '🖥️ True HD Server Export'}
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={handleFinalizeCache} 
            disabled={isPreloading || isExporting} 
            style={{ flex: 1, background: isPreloading ? '#f59e0b' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '10px', height: '38px', fontSize: '10px', fontWeight: 800, cursor: isPreloading ? 'wait' : 'pointer' }}>
            {isPreloading ? '⏳ Preloading...' : '📦 Finalize Cache'}
          </button>
          <button 
            onClick={handleFastMobileExport} 
            disabled={isExporting || isPreloading} 
            style={{ flex: 1, background: isExporting ? '#f59e0b' : '#10b981', color: '#000', border: 'none', borderRadius: '10px', height: '38px', fontSize: '10px', fontWeight: 800, cursor: isExporting ? 'wait' : 'pointer', boxShadow: '0 0 15px rgba(16,185,129,0.2)' }}>
            {isExporting ? `⏳ Compiling... ${exportProgress}%` : '🎥 Mobile WebM Export'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 700, letterSpacing: '0.15em' }}>CAMERA ENGINE</div>
        {isLiveEdit && <button onClick={() => setIsLiveEdit(false)} style={{ background: 'transparent', color: '#8e8e93', border: 'none', fontSize: '10px', cursor: 'pointer' }}>✕ Close</button>}
      </div>

      {!isLiveEdit ? (
        <button onClick={startLiveEdit} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '10px', width: '100%', height: '38px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 15px rgba(56,189,248,0.1)', marginTop: '10px' }}>🎯 Enter Live Canvas Edit</button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          <button onClick={dropKeyframeLive} style={{ background: '#38bdf8', color: '#000', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(56,189,248,0.4)' }}>📍 Save Keyframe Here</button>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', maxHeight: '120px', overflowY: 'auto' }}>
            <span style={{ fontSize: '9px', color: '#8e8e93' }}>ACTIVE TIMELINE MARKERS:</span>
            {timeline?.cameraKeyframes?.map((kf: any) => (
               <div key={kf.frame} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                 <span style={{ fontSize: '10px', color: '#fff' }}>Frame: {Math.round(kf.frame)}</span>
                 <button onClick={() => deleteSpecificKeyframe(kf.frame)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '10px' }}>✕ Delete</button>
               </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '4px' }}>
            <span style={{ color: '#8e8e93' }}>PITCH TILT</span><span style={{ color: '#38bdf8', fontWeight: 600 }}>{Math.round(targetPitch)}°</span>
          </div>
          <input type="range" min="0" max="60" step="1" value={targetPitch} onChange={(e) => setTargetPitch(Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '2px' }}>
            <span style={{ color: '#8e8e93' }}>BEARING ROTATION</span><span style={{ color: '#38bdf8', fontWeight: 600 }}>{Math.round(targetBearing)}°</span>
          </div>
          <input type="range" min="-180" max="180" step="1" value={targetBearing} onChange={(e) => setTargetBearing(Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }} />
        </div>
      )}

      {selectedEntity ? (
        <React.Fragment>
          <div style={{ fontSize: '9px', color: '#8e8e93', fontWeight: 700, letterSpacing: '0.15em', paddingBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginTop: '8px' }}>STYLING: {selectedEntity.toUpperCase()}</div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '4px' }}>
            <span style={{ color: '#8e8e93', fontWeight: 500 }}>REVEAL ANIMATION</span>
            <select value={activeEntityData?.revealStyle || 'fade'} onChange={(e) => updateEntityStyle('revealStyle', e.target.value)} style={{ background: 'rgba(0,0,0,0.5)', color: '#38bdf8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', outline: 'none', fontSize: '10px', padding: '6px', cursor: 'pointer' }}>
              <option value="fade">Fade In</option><option value="ink">Ink Bleed</option><option value="scale">Pop Scale</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '8px' }}>
            <span style={{ color: '#8e8e93', fontWeight: 500 }}>FILL COLOR</span>
            <input type="color" value={activeColor} onChange={(e) => updateEntityStyle('color', e.target.value)} style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
            <span style={{ color: '#8e8e93', fontWeight: 500 }}>GLOW</span>
            <button onClick={() => updateEntityStyle('enableGlow', !activeEnableGlow)} style={{ background: activeEnableGlow ? '#38bdf8' : 'transparent', color: activeEnableGlow ? '#000' : '#8e8e93', border: '1px solid #38bdf8', borderRadius: '4px', padding: '2px 8px', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>{activeEnableGlow ? 'ON' : 'OFF'}</button>
          </div>
          {activeEnableGlow && <input type="range" min="0" max="50" step="1" value={activeGlowIntensity} onChange={(e) => updateEntityStyle('glowIntensity', Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '4px' }}>
            <span style={{ color: '#8e8e93', fontWeight: 500 }}>GLOW TARGET</span>
            <select value={activeGlowTarget} onChange={(e) => updateEntityStyle('glowTarget', e.target.value)} style={{ background: 'rgba(0,0,0,0.5)', color: '#38bdf8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', outline: 'none', fontSize: '10px', padding: '6px', cursor: 'pointer' }}>
              <option value="both">Both</option><option value="fill">Fill Only</option><option value="stroke">Stroke Only</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '4px' }}>
            <span style={{ color: '#8e8e93', fontWeight: 500 }}>DROP SHADOW</span>
            <button onClick={() => updateEntityStyle('dropShadow', !activeDropShadow)} style={{ background: activeDropShadow ? '#38bdf8' : 'transparent', color: activeDropShadow ? '#000' : '#8e8e93', border: '1px solid #38bdf8', borderRadius: '4px', padding: '2px 8px', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>{activeDropShadow ? 'ON' : 'OFF'}</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '6px' }}>
            <span style={{ color: '#8e8e93', fontWeight: 500 }}>STROKE ({activeStrokeWidth}px)</span>
            <input type="color" value={activeStrokeColor} onChange={(e) => updateEntityStyle('strokeColor', e.target.value)} style={{ width: '20px', height: '20px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
          </div>
          <input type="range" min="0" max="10" step="0.5" value={activeStrokeWidth} onChange={(e) => updateEntityStyle('strokeWidth', Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '4px' }}>
            <span style={{ color: '#8e8e93', fontWeight: 500 }}>BLEND MODE</span>
            <select value={activeBlendMode} onChange={(e) => updateEntityStyle('blendMode', e.target.value)} style={{ background: 'rgba(0,0,0,0.5)', color: '#38bdf8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', outline: 'none', fontSize: '10px', padding: '6px', cursor: 'pointer' }}>
              <option value="normal">Normal</option><option value="screen">Screen</option><option value="multiply">Multiply</option><option value="overlay">Overlay</option><option value="add">Color Dodge</option>
            </select>
          </div>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <div style={{ fontSize: '9px', color: '#8e8e93', fontWeight: 700, letterSpacing: '0.15em', paddingBottom: '2px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginTop: '8px' }}>AUTO INJECTOR</div>
          <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
            <input type="text" value={entityA} onChange={(e)=>setEntityA(e.target.value)} placeholder="Origin Country" style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '10px', padding: '8px', borderRadius: '6px', outline: 'none' }} />
            <input type="text" value={entityB} onChange={(e)=>setEntityB(e.target.value)} placeholder="Target Country" style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '10px', padding: '8px', borderRadius: '6px', outline: 'none' }} />
          </div>
          <select value={eventType} onChange={(e) => setEventType(e.target.value as any)} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', color: '#38bdf8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', outline: 'none', fontSize: '11px', padding: '8px', cursor: 'pointer', marginTop: '2px' }}>
            <option value="arrow">Diplomatic Line (Arrow)</option><option value="takeover">Conflict (Invasion Wave)</option>
          </select>
          <button onClick={addStoryEvent} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', width: '100%', height: '36px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', marginTop: '4px' }}>＋ Inject Event</button>
        </React.Fragment>
      )}
    </React.Fragment>
  );

  return (
    <div style={{ backgroundColor: '#000000', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif', color: '#ffffff', margin: 0, padding: 0, overflow: 'hidden' }}>

      {/* SETUP SCREENS */}
      {status !== 'editor' && (
        <div style={{ position: 'absolute', width: '800px', height: '800px', background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, rgba(148,163,184,0.02) 50%, transparent 70%)', borderRadius: '50%', zIndex: 1, pointerEvents: 'none', filter: 'blur(100px)' }} />
      )}

      {status === 'generating' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(30px)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: '14px', letterSpacing: '0.2em', color: '#38bdf8', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>COMPILING...</div>
        </div>
      )}

      {status !== 'editor' && status !== 'generating' && (
        <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '680px', padding: '20px' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '24px', textAlign: 'center' }}>Cinematic Timeline Studio</h1>
          {errorMessage && (
            <div style={{ width: '100%', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '16px', padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}>⚡</span><span style={{ fontSize: '13px', color: '#fde047' }}>{errorMessage}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(255,255,255,0.06)', padding: '6px', borderRadius: '18px' }}>
            <button onClick={() => setManualMode(false)} style={{ background: !manualMode ? 'rgba(255,255,255,0.15)' : 'transparent', color: !manualMode ? '#fff' : '#8e8e93', border: 'none', borderRadius: '12px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>AI Directive</button>
            <button onClick={() => setManualMode(true)} style={{ background: manualMode ? 'rgba(255,255,255,0.15)' : 'transparent', color: manualMode ? '#fff' : '#8e8e93', border: 'none', borderRadius: '12px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Manual Builder</button>
          </div>
          {!manualMode ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '32px', padding: '24px' }}>
              <textarea placeholder="e.g., North Korea and South Korea relations..." value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} style={{ width: '100%', background: 'transparent', border: 'none', color: '#ffffff', fontSize: '18px', outline: 'none', resize: 'none' }} required />
              <button type="submit" style={{ background: '#fff', color: '#000', border: 'none', borderRadius: '20px', padding: '14px 28px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}>Generate ✦</button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '32px', padding: '24px' }}>
              <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
                <input type="text" value={entityA} onChange={(e) => setEntityA(e.target.value)} placeholder="Primary Entity" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '16px', color: '#fff', fontSize: '16px', outline: 'none' }} />
                <input type="text" value={entityB} onChange={(e) => setEntityB(e.target.value)} placeholder="Secondary Entity" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '16px', color: '#fff', fontSize: '16px', outline: 'none' }} />
              </div>
              <button onClick={initializeManualScene} style={{ background: '#38bdf8', color: '#000', border: 'none', borderRadius: '20px', padding: '16px 28px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginTop: '10px' }}>Launch Empty Studio 🚀</button>
            </div>
          )}
        </div>
      )}

      {/* MAIN EDITOR INTERFACE */}
      {status === 'editor' && dynamicTimeline && (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', paddingBottom: '100px' }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '32px', width: '100%', height: '100%' }}>
            
            {isDesktop && (
              <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '10px', borderRadius: '20px', padding: '16px', width: '280px', maxHeight: '80vh', overflowY: 'auto', zIndex: 60, flexShrink: 0 }}>
                {leftPanelJSX}
              </div>
            )}

            <div style={{ 
              height: '75vh', 
              minHeight: '500px',
              maxHeight: '800px', 
              aspectRatio: '9/16', 
              borderRadius: '36px', 
              border: '4px solid #1a1a1a', 
              boxShadow: isLiveEdit ? '0 0 0 4px #38bdf8, 0 30px 90px rgba(56,189,248,0.4)' : '0 0 0 2px #38bdf8, 0 0 40px rgba(56,189,248,0.2)', 
              position: 'relative', overflow: 'hidden', background: '#040711', flexShrink: 0, zIndex: 10
            }}>
              <div className="remotion-player" style={{ position: 'absolute', inset: 0, zIndex: 10, width: '100%', height: '100%' }}>
                <Player
                  ref={playerRef}
                  component={MapAnimation}
                  inputProps={playerInputProps}
                  durationInFrames={videoDuration}
                  compositionWidth={1080}
                  compositionHeight={1920}
                  fps={30}
                  controls={false}
                  style={{ width: '100%', height: '100%', display: 'block', pointerEvents: isLiveEdit ? 'auto' : 'none' }}
                  loop
                  autoPlay
                />

                {isLiveEdit && (
                  <React.Fragment>
                    <div 
                      onContextMenu={(e) => e.preventDefault()} 
                      onWheel={(e) => {
                        setTargetZoom(z => Math.max(0.5, Math.min(15, z - (e.nativeEvent as WheelEvent).deltaY * 0.005)));
                      }}
                      onPointerDown={(e) => { 
                        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                        e.currentTarget.setPointerCapture(e.pointerId);
                        if (activePointers.current.size === 1) {
                          setIsDragging(true);
                          dragPos.current = { x: e.clientX, y: e.clientY };
                        } else if (activePointers.current.size === 2) {
                          setIsDragging(false);
                          const pts = Array.from(activePointers.current.values());
                          const dx = pts[0].x - pts[1].x;
                          const dy = pts[0].y - pts[1].y;
                          previousPinch.current = { 
                            dist: Math.hypot(dx, dy), 
                            angle: Math.atan2(dy, dx), 
                            centerY: (pts[0].y + pts[1].y) / 2,
                            centerX: (pts[0].x + pts[1].x) / 2
                          };
                        }
                      }}
                      onPointerUp={(e) => { 
                        activePointers.current.delete(e.pointerId);
                        e.currentTarget.releasePointerCapture(e.pointerId);
                        if (activePointers.current.size < 2) previousPinch.current = null;
                        if (activePointers.current.size === 0) setIsDragging(false);
                        if (activePointers.current.size === 1) {
                          const remainingPt = Array.from(activePointers.current.values())[0];
                          dragPos.current = { x: remainingPt.x, y: remainingPt.y };
                          setIsDragging(true);
                        }
                      }}
                      onPointerLeave={(e) => { 
                        activePointers.current.delete(e.pointerId);
                        if (activePointers.current.size < 2) previousPinch.current = null;
                        if (activePointers.current.size === 0) setIsDragging(false);
                      }}
                      onPointerMove={(e) => {
                        if (!activePointers.current.has(e.pointerId)) return;
                        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

                        if (activePointers.current.size === 1 && isDragging && dragPos.current) {
                          const dx = e.clientX - dragPos.current.x;
                          const dy = e.clientY - dragPos.current.y;
                          dragPos.current = { x: e.clientX, y: e.clientY };

                          if (e.buttons === 2 || e.shiftKey || e.altKey) {
                            setTargetPitch(p => Math.max(0, Math.min(85, p - dy * 0.4)));
                            setTargetBearing(b => b + dx * 0.8);
                          } else {
                            const panSens = 0.2 / Math.max(0.5, targetZoom);
                            setTargetLng(l => l - dx * panSens);
                            setTargetLat(l => Math.max(-85, Math.min(85, l + dy * panSens)));
                          }
                        } else if (activePointers.current.size === 2 && previousPinch.current) {
                          const pts = Array.from(activePointers.current.values());
                          const dx = pts[0].x - pts[1].x;
                          const dy = pts[0].y - pts[1].y;
                          const currentDist = Math.hypot(dx, dy);
                          const currentAngle = Math.atan2(dy, dx);
                          const currentCenterY = (pts[0].y + pts[1].y) / 2;
                          const currentCenterX = (pts[0].x + pts[1].x) / 2;

                          const distDiff = currentDist - previousPinch.current.dist;
                          let angleDiff = currentAngle - previousPinch.current.angle;
                          const yDiff = currentCenterY - previousPinch.current.centerY;
                          const xDiff = currentCenterX - previousPinch.current.centerX;

                          if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                          if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                          setTargetZoom(z => Math.max(0.5, Math.min(15, z + distDiff * 0.01)));
                          setTargetBearing(b => b + angleDiff * 60);
                          
                          if (Math.abs(yDiff) > 2) { 
                            setTargetPitch(p => Math.max(0, Math.min(85, p - yDiff * 0.4))); 
                          }
                          
                          const panSens = 0.1 / Math.max(0.5, targetZoom);
                          setTargetLng(l => l - xDiff * panSens);
                          setTargetLat(l => Math.max(-85, Math.min(85, l + yDiff * panSens)));

                          previousPinch.current = { dist: currentDist, angle: currentAngle, centerY: currentCenterY, centerX: currentCenterX };
                        }
                      }}
                      style={{ position: 'absolute', inset: 0, cursor: isDragging ? 'grabbing' : 'grab', zIndex: 50, touchAction: 'none' }}
                    >
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '28px', height: '28px', border: '1.5px solid rgba(56,189,248,0.5)', borderRadius: '50%', pointerEvents: 'none' }}>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '4px', height: '4px', background: pathStartCoord ? '#ef4444' : '#38bdf8', borderRadius: '50%' }} />
                      </div>
                    </div>
                    
                    <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', padding: '8px 16px', borderRadius: '12px', fontSize: '10px', color: '#8e8e93', fontWeight: 600, pointerEvents: 'none', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', gap: '12px', zIndex: 55 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📱 <strong style={{ color: '#fff' }}>1 Finger</strong> Pan</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>🤏 <strong style={{ color: '#fff' }}>2 Fingers</strong> Zoom/Twist</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>↕️ <strong style={{ color: '#fff' }}>2 Fingers</strong> Tilt</span>
                    </div>
                  </React.Fragment>
                )}
              </div>
            </div>

            {isDesktop && (
              <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '14px', borderRadius: '20px', padding: '16px', width: '280px', maxHeight: '80vh', overflowY: 'auto', zIndex: 60, flexShrink: 0 }}>
                {rightPanelJSX}
              </div>
            )}
          </div>

          {/* TIMELINE BOTTOM DOCK */}
          {isTimelineOpen && (
            <div style={{ position: 'fixed', bottom: isDesktop ? '20px' : '30px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 120 }}>
              <div style={{ ...panelStyle, width: '90%', maxWidth: '800px', display: 'flex', alignItems: 'center', gap: '16px', borderRadius: '24px', padding: '14px 24px' }}>
                <button onClick={togglePlay} style={{ background: '#ffffff', color: '#000', border: 'none', borderRadius: '50%', width: '36px', height: '36px', flexShrink: 0, cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>{isPlaying ? '❚❚' : '▶'}</button>
                <div style={{ position: 'relative', flex: 1, height: '30px', display: 'flex', alignItems: 'center' }}>
                  {timeline?.takeovers && timeline.takeovers.map((t: any, i: number) => {
                    const leftPercent = ((t.startFrame || 0) / videoDuration) * 100;
                    return <div key={`inv-drawer-${i}`} title={`Conflict: ${t.attacker} > ${t.target}`} style={{ position: 'absolute', left: `${Math.min(Math.max(leftPercent, 0), 100)}%`, transform: 'translateX(-50%)', width: '4px', height: '14px', backgroundColor: '#ef4444', borderRadius: '2px', cursor: 'help', zIndex: 15 }} />
                  })}
                  {timeline?.arrows && timeline.arrows.map((a: any, i: number) => {
                    const leftPercent = ((a.startFrame || 0) / videoDuration) * 100;
                    return <div key={`arr-drawer-${i}`} title={`${a.type === 'missile' ? 'Missile' : 'Arrow'}`} style={{ position: 'absolute', left: `${Math.min(Math.max(leftPercent, 0), 100)}%`, transform: 'translateX(-50%)', width: '4px', height: '14px', backgroundColor: a.type === 'missile' ? '#ffffff' : '#3b82f6', borderRadius: '2px', cursor: 'help', zIndex: 15 }} />
                  })}
                  {timeline?.labels && timeline.labels.map((l: any, i: number) => {
                    const leftPercent = ((l.startFrame || 0) / videoDuration) * 100;
                    return <div key={`lbl-drawer-${i}`} title={`Label: ${l.text}`} style={{ position: 'absolute', left: `${Math.min(Math.max(leftPercent, 0), 100)}%`, transform: 'translateX(-50%)', width: '6px', height: '6px', backgroundColor: '#a855f7', borderRadius: '50%', cursor: 'help', zIndex: 15 }} />
                  })}
                  {timeline?.cameraKeyframes && timeline.cameraKeyframes.map((kf: any, i: number) => {
                    const leftPercent = (kf.frame / videoDuration) * 100;
                    return (
                      <div 
                        key={`kf-drawer-${i}`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setTimeline((prev: any) => {
                            if (!prev) return prev;
                            const updated = JSON.parse(JSON.stringify(prev));
                            updated.cameraKeyframes = updated.cameraKeyframes.filter((k: any) => k.frame !== kf.frame);
                            return updated;
                          });
                        }}
                        onMouseDown={(e) => {
                          const trackRect = e.currentTarget.parentElement?.getBoundingClientRect();
                          if (!trackRect) return;
                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            const xPos = moveEvent.clientX - trackRect.left;
                            const percentage = Math.max(0, Math.min(1, xPos / trackRect.width));
                            const newFrame = Math.round(percentage * videoDuration);
                            setTimeline((prev: any) => {
                              if (!prev) return prev;
                              const updated = JSON.parse(JSON.stringify(prev));
                              const isCollision = updated.cameraKeyframes.some((k: any, idx: number) => idx !== i && Math.abs(k.frame - newFrame) < 15);
                              if (isCollision) return prev;
                              updated.cameraKeyframes[i].frame = newFrame;
                              updated.cameraKeyframes.sort((a: any, b: any) => a.frame - b.frame);
                              return updated;
                            });
                          };
                          const handleMouseUp = () => {
                            window.removeEventListener('mousemove', handleMouseMove);
                            window.removeEventListener('mouseup', handleMouseUp);
                          };
                          window.addEventListener('mousemove', handleMouseMove);
                          window.addEventListener('mouseup', handleMouseUp);
                        }}
                        style={{ position: 'absolute', left: `${Math.min(Math.max(leftPercent, 0), 100)}%`, transform: 'translate(-50%, -50%) rotate(45deg)', top: '15px', width: '12px', height: '12px', backgroundColor: '#38bdf8', border: '2px solid #ffffff', cursor: 'ew-resize', zIndex: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
                      />
                    );
                  })}
                  <input type="range" min="0" max={videoDuration} step="1" value={currentFrame} onChange={(e) => { const targetFrame = Number(e.target.value); setCurrentFrame(targetFrame); playerRef.current?.seekTo(targetFrame); }} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer', position: 'relative', zIndex: 6, background: 'transparent' }} />
                </div>
                <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600, letterSpacing: '0.05em', textShadow: '0 2px 8px rgba(0,0,0,0.8)', flexShrink: 0 }}>{Math.round(currentFrame)} / {videoDuration}</span>
              </div>
            </div>
          )}
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
if (container) {
  const root = createRoot(container);
  root.render(<WebApp />);
}