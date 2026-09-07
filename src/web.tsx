import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { MapAnimation } from './MapAnimation';
import fixWebmDuration from 'fix-webm-duration';
import worldData from './world.json';
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
  const [allGeoNames, setAllGeoNames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const [mapStyle, setMapStyle] = useState<string>('dark-documentary');

  const [labelText, setLabelText] = useState<string>('DMZ Border');
  const [labelColor, setLabelColor] = useState<string>('#ffffff');
  const [labelBg, setLabelBg] = useState<string>('rgba(0,0,0,0.7)');
  const [labelSize, setLabelSize] = useState<number>(24);
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
      } catch(e) {
        console.warn("Could not preload dynamic names for autocomplete.");
      }
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
      setErrorMessage("Network error. Please try again.");
      setStatus('idle');
    }
  };

  const handleFinalizeCache = async () => {
    setIsPreloading(true);
    playerRef.current?.pause();
    setIsPlaying(false);
    
    for(let f = 0; f < videoDuration; f += 5) {
      playerRef.current?.seekTo(f);
      await new Promise(r => setTimeout(r, 200)); 
    }
    
    playerRef.current?.seekTo(0);
    setIsPreloading(false);
    alert("Map Cache Finalized! Ready for flawless export.");
  };

  const handleFastMobileExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    playerRef.current?.seekTo(0);
    playerRef.current?.play();
    setIsPlaying(true);

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = 1080;
    compositeCanvas.height = 1920;
    compositeCanvas.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; z-index:-1; pointer-events:none; border-radius:36px;';
    
    const playerContainer = document.querySelector('.remotion-player') || document.body;
    playerContainer.appendChild(compositeCanvas);

    const ctx = compositeCanvas.getContext('2d');
    if (!ctx) {
      setIsExporting(false);
      return;
    }

    const stream = compositeCanvas.captureStream(30);
    const videoTrack = stream.getVideoTracks()[0] as any;

    const options = { mimeType: 'video/webm', videoBitsPerSecond: 8000000 }; 
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
      
      try { if (mapCanvas) ctx.drawImage(mapCanvas, 0, 0, 1080, 1920); } catch(e) {}
      ctx.globalCompositeOperation = 'screen';
      try { if (blendCanvas) ctx.drawImage(blendCanvas, 0, 0, 1080, 1920); } catch(e) {}
      ctx.globalCompositeOperation = 'source-over';
      try { if (uiCanvas) ctx.drawImage(uiCanvas, 0, 0, 1080, 1920); } catch(e) {}
      
      if (videoTrack && typeof videoTrack.requestFrame === 'function') videoTrack.requestFrame();
      animId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    const startTime = Date.now();
    const durationMs = (videoDuration / 30) * 1000;

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
      
      if (blob.size === 0) {
        alert("Export failed: Browser security (CORS) blocked canvas extraction. Use True HD Server Export instead.");
        setIsExporting(false);
        setExportProgress(0);
        return;
      }

      try { blob = await fixWebmDuration(blob, durationMs); } catch (err) { console.warn("Duration patcher warning:", err); }

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
      takeovers: [], arrows: [], labels: [],
      cameraKeyframes: [{ frame: 0, zoom: 1.2, lat: 38.0, lng: 127.0, pitch: 45, bearing: 0 }],
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
    const baseKf: any = pastKfs[pastKfs.length - 1] || timeline?.cameraKeyframes?.[0] || { lat: 38.0, lng: 127.0, zoom: 1.2, pitch: 45, bearing: 0 };

    setTargetLat(baseKf.lat ?? baseKf.latitude ?? 38.0);
    setTargetLng(baseKf.lng ?? baseKf.longitude ?? 127.0);
    setTargetZoom(baseKf.zoom ?? 1.2);
    setTargetPitch(baseKf.pitch ?? 45);
    setTargetBearing(baseKf.bearing ?? 0);
    setIsLiveEdit(true);
  };

  const dropKeyframeLive = () => {
    const cFrame = currentFrame;
    let extensionNeeded = 0;
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.cameraKeyframes = [...(prev.cameraKeyframes || [])].filter((kf: any) => Math.abs(kf.frame - cFrame) > 15);
      updated.cameraKeyframes.push({ frame: cFrame, zoom: targetZoom, lat: targetLat, lng: targetLng, pitch: targetPitch, bearing: targetBearing });
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
        id: Math.random().toString(36).substr(2, 9), text: labelText, lat: targetLat, lng: targetLng, startFrame: cFrame, duration: 150, color: labelColor, bg: labelBg, size: labelSize, glow: labelGlow, pinned: labelPinned 
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
      if (updated.highlightCountries) updated.highlightCountries = updated.highlightCountries.filter((c: any) => c.name !== name && c.country !== name);
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
    const searchTarget = newCountrySearch.trim();
    const cFrame = currentFrame;
    
    setTimeline((prev: any) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated.highlightCountries = [...(prev.highlightCountries || [])];
      const exists = updated.highlightCountries.find((c: any) => (c.name || c.country).toLowerCase() === searchTarget.toLowerCase());
      
      if (!exists) {
        updated.highlightCountries.push({ 
          name: searchTarget, 
          country: searchTarget, 
          color: '#3b82f6', 
          strokeColor: '#ffffff', 
          strokeWidth: 2, 
          enableGlow: true, 
          glowTarget: 'both', 
          dropShadow: true, 
          blendMode: 'screen', 
          isPrimary: false, 
          startFrame: cFrame, 
          revealStyle: 'fade' 
        });
      }
      return updated;
    });
    
    setNewCountrySearch('');
    setShowSuggestions(false);
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

  const toggleEntitySuppression = (name: string) => setDisabledEntities(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pause(); else playerRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const activeEntityData: any = timeline?.highlightCountries?.find((c: any) => c.name === selectedEntity || c.country === selectedEntity);
  const activeColor = activeEntityData?.color || '#3b82f6';
  const activeStrokeColor = activeEntityData?.strokeColor || '#ffffff';
  const activeStrokeWidth = activeEntityData?.strokeWidth !== undefined ? activeEntityData.strokeWidth : 2.5;
  const activeEnableGlow = activeEntityData?.enableGlow !== undefined ? activeEntityData.enableGlow : true;
  const activeGlowIntensity = activeEntityData?.glowIntensity !== undefined ? activeEntityData.glowIntensity : 20;
  const activeBlendMode = activeEntityData?.blendMode || 'screen';
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
    newKfs = newKfs.map((kf: any) => ({ ...kf, lat: kf.lat !== undefined ? kf.lat : (kf.latitude !== undefined ? kf.latitude : 38.0), lng: kf.lng !== undefined ? kf.lng : (kf.longitude !== undefined ? kf.longitude : 127.0), zoom: kf.zoom !== undefined ? kf.zoom : 1.2, pitch: kf.pitch !== undefined ? kf.pitch : 0, bearing: kf.bearing !== undefined ? kf.bearing : 0 }));
    
    if (isLiveEdit && playerRef.current && !isPlaying) {
      newKfs = newKfs.filter((kf: any) => Math.abs(kf.frame - currentFrame) > 15);
      newKfs.push({ frame: currentFrame, lat: targetLat, lng: targetLng, zoom: targetZoom, pitch: targetPitch, bearing: targetBearing });
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
    background: 'rgba(20, 20, 24, 0.75)', backdropFilter: 'blur(30px) saturate(180%)', WebkitBackdropFilter: 'blur(30px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: '0 30px 60px rgba(0,0,0,0.6)'
  };

  const BranchHeader = ({ title, branchKey }: { title: string, branchKey: string }) => (
    <button onClick={() => toggleBranch(branchKey)} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, width: '100%', letterSpacing: '0.05em' }}>
      <span>{title}</span><span>{openBranches[branchKey] ? '▼' : '▶'}</span>
    </button>
  );

  const leftPanelJSX = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <BranchHeader title="🌍 SCENE ENTITIES" branchKey="entities" />
        {openBranches.entities && (
          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '6px', position: 'relative' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input 
                  type="text" 
                  value={newCountrySearch} 
                  onChange={(e) => { setNewCountrySearch(e.target.value); setShowSuggestions(true); }} 
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Search river, state, country..." 
                  style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px', padding: '8px', borderRadius: '8px', outline: 'none' }} 
                  onKeyDown={(e) => e.key === 'Enter' && addCountryMap()} 
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111827', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', zIndex: 999, marginTop: '4px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.8)' }}>
                    {filteredSuggestions.map(s => (
                       <div key={s} onClick={() => { setNewCountrySearch(s); setShowSuggestions(false); }} style={{ padding: '8px 12px', fontSize: '11px', color: '#fff', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{s}</div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={addCountryMap} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', padding: '0 10px', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
            </div>

            {timeline?.highlightCountries?.map((c: any, idx: number) => {
              const name = c.name || c.country;
              const isSelected = selectedEntity === name;
              const isDisabled = disabledEntities.includes(name);
              return (
                <div key={idx} style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => setSelectedEntity(name)} style={{ flex: 1, background: isSelected ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.05)', border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)', color: '#ffffff', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', textAlign: 'left', cursor: 'pointer', textDecoration: isDisabled ? 'line-through' : 'none' }}>{name}</button>
                  <button onClick={() => toggleEntitySuppression(name)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8e8e93', borderRadius: '8px', padding: '0 6px', cursor: 'pointer', fontSize: '11px' }}>{isDisabled ? '🙈' : '👁️'}</button>
                  <button onClick={(e) => cutEntity(e, name)} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '8px', border: 'none', padding: '0 8px', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <BranchHeader title="📝 TYPOGRAPHY" branchKey="typography" />
        {openBranches.typography && (
          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input type="text" value={labelText} onChange={(e) => setLabelText(e.target.value)} placeholder="Label Text..." style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px', padding: '8px', borderRadius: '8px', outline: 'none' }} />
            <button onClick={() => { if(isLiveEdit) dropLabel(); }} style={{ background: isLiveEdit ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)', color: isLiveEdit ? '#38bdf8' : '#8e8e93', border: `1px solid ${isLiveEdit ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', padding: '8px', fontSize: '11px', fontWeight: 700, cursor: isLiveEdit ? 'pointer' : 'not-allowed' }}>{isLiveEdit ? '📍 Drop Label at Crosshair' : 'Enter Live Edit to Drop'}</button>
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
    </div>
  );

  const rightPanelJSX = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
        <button onClick={handleHDLocalExport} disabled={isPreloading || isExporting} style={{ background: isExporting ? '#f59e0b' : '#a855f7', color: '#fff', border: 'none', borderRadius: '10px', width: '100%', height: '34px', fontSize: '11px', fontWeight: 800, cursor: isExporting ? 'wait' : 'pointer' }}>🖥️ True HD Server Export</button>
        <button onClick={handleFastMobileExport} disabled={isExporting || isPreloading} style={{ background: isExporting ? '#f59e0b' : '#10b981', color: '#000', border: 'none', borderRadius: '10px', height: '38px', fontSize: '10px', fontWeight: 800, cursor: isExporting ? 'wait' : 'pointer' }}>🎥 Mobile WebM Export</button>
      </div>

      {!isLiveEdit ? (
        <button onClick={startLiveEdit} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '10px', width: '100%', height: '38px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>🎯 Enter Live Canvas Edit</button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={dropKeyframeLive} style={{ background: '#38bdf8', color: '#000', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>📍 Save Keyframe Here</button>
        </div>
      )}

      {selectedEntity && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          <div style={{ fontSize: '9px', color: '#8e8e93', fontWeight: 700 }}>STYLING: {selectedEntity.toUpperCase()}</div>
          <select value={timeline?.highlightCountries?.find((c:any)=>c.name===selectedEntity)?.revealStyle || 'fade'} onChange={(e) => updateEntityStyle('revealStyle', e.target.value)} style={{ background: 'rgba(0,0,0,0.5)', color: '#38bdf8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '10px', padding: '6px' }}>
            <option value="fade">Fade</option><option value="ink">Ink</option><option value="trim">River Trim</option>
          </select>
          <input type="color" value={activeColor} onChange={(e) => updateEntityStyle('color', e.target.value)} style={{ width: '100%', height: '30px', border: 'none', borderRadius: '4px', background: 'transparent' }} />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ backgroundColor: '#000000', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif', color: '#ffffff', margin: 0, padding: 0, overflow: 'hidden' }}>

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

      {status === 'editor' && dynamicTimeline && (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px', paddingBottom: '80px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: isDesktop ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', width: '100%', height: '100%', boxSizing: 'border-box' }}>
            
            {isDesktop && <div style={{ ...panelStyle, borderRadius: '20px', padding: '16px', width: '280px', maxHeight: '80vh', overflowY: 'auto', zIndex: 60, flexShrink: 0 }}>{leftPanelJSX}</div>}

            <div style={{ height: isDesktop ? '75vh' : '60vh', aspectRatio: '9/16', borderRadius: '24px', border: '3px solid #1a1a1a', boxShadow: '0 0 0 2px #38bdf8, 0 0 30px rgba(56,189,248,0.2)', position: 'relative', overflow: 'hidden', background: '#040711', flexShrink: 0, zIndex: 10 }}>
              <div className="remotion-player" style={{ position: 'absolute', inset: 0, zIndex: 10, width: '100%', height: '100%' }}>
                <Player ref={playerRef} component={MapAnimation} inputProps={playerInputProps} durationInFrames={videoDuration} compositionWidth={1080} compositionHeight={1920} fps={30} controls={false} loop autoPlay style={{ width: '100%', height: '100%', display: 'block', pointerEvents: isLiveEdit ? 'auto' : 'none' }} />
              </div>
            </div>

            {isDesktop && <div style={{ ...panelStyle, borderRadius: '20px', padding: '16px', width: '280px', maxHeight: '80vh', overflowY: 'auto', zIndex: 60, flexShrink: 0 }}>{rightPanelJSX}</div>}
          </div>

          {!isDesktop && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', zIndex: 100 }}>
              <button onClick={() => setLeftPanelOpen(true)} style={{ background: '#38bdf8', color: '#000', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', fontWeight: 700 }}>🌍 Entities</button>
              <button onClick={() => setRightPanelOpen(true)} style={{ background: '#a855f7', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', fontWeight: 700 }}>⚙️ Controls</button>
            </div>
          )}

          {!isDesktop && leftPanelOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', flexDirection: 'column', padding: '20px', overflowY: 'auto' }}>
              <button onClick={() => setLeftPanelOpen(false)} style={{ alignSelf: 'flex-end', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontWeight: 'bold' }}>✕</button>
              {leftPanelJSX}
            </div>
          )}

          {!isDesktop && rightPanelOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', flexDirection: 'column', padding: '20px', overflowY: 'auto' }}>
              <button onClick={() => setRightPanelOpen(false)} style={{ alignSelf: 'flex-end', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontWeight: 'bold' }}>✕</button>
              {rightPanelJSX}
            </div>
          )}

          {isTimelineOpen && (
            <div style={{ position: 'fixed', bottom: '10px', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 120, padding: '0 10px', boxSizing: 'border-box' }}>
              <div style={{ ...panelStyle, width: '100%', maxWidth: '800px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '18px', padding: '10px 16px', boxSizing: 'border-box' }}>
                <button onClick={togglePlay} style={{ background: '#ffffff', color: '#000', border: 'none', borderRadius: '50%', width: '30px', height: '30px', flexShrink: 0, cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>{isPlaying ? '❚❚' : '▶'}</button>
                <div style={{ position: 'relative', flex: 1, height: '30px', display: 'flex', alignItems: 'center' }}>
                  <input type="range" min="0" max={videoDuration} step="1" value={currentFrame} onChange={(e) => { const tf = Number(e.target.value); setCurrentFrame(tf); playerRef.current?.seekTo(tf); }} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer', position: 'relative', zIndex: 6, background: 'transparent' }} />
                </div>
                <span style={{ fontSize: '10px', color: '#fff', fontWeight: 600, flexShrink: 0 }}>{Math.round(currentFrame)}/{videoDuration}</span>
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
if (container) { const root = createRoot(container); root.render(<WebApp />); }