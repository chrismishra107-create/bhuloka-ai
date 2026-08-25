import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { MapAnimation } from './MapAnimation';
import { GeneratedTimeline } from './backend/generateTimeline';
import './index.css';

const WebApp: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'editor'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  
  const [timeline, setTimeline] = useState<GeneratedTimeline | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(300);
  
  const [showArrows, setShowArrows] = useState<boolean>(true);
  const [disabledEntities, setDisabledEntities] = useState<string[]>([]);
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(true);

  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [isLiveEdit, setIsLiveEdit] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  const [targetLat, setTargetLat] = useState<number>(20.0);
  const [targetLng, setTargetLng] = useState<number>(78.0);
  const [targetZoom, setTargetZoom] = useState<number>(1.2);
  const [targetPitch, setTargetPitch] = useState<number>(20);
  const [targetBearing, setTargetBearing] = useState<number>(0);
  const [targetEasing, setTargetEasing] = useState<string>('easeInOut');

  const [pathStartCoord, setPathStartCoord] = useState<[number, number] | null>(null);

  const [manualMode, setManualMode] = useState<boolean>(false);
  const [entityA, setEntityA] = useState<string>('North Korea');
  const [entityB, setEntityB] = useState<string>('South Korea');
  const [eventType, setEventType] = useState<'arrow' | 'takeover'>('arrow');
  const [newCountrySearch, setNewCountrySearch] = useState<string>('');

  useEffect(() => {
    let animationFrameId: number;
    const syncTimeline = () => {
      if (playerRef.current) setCurrentFrame(playerRef.current.getCurrentFrame());
      animationFrameId = requestAnimationFrame(syncTimeline);
    };
    syncTimeline();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setStatus('generating');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const data = await response.json();
      
      if (data && data.timeline) {
        if (!prompt.toLowerCase().includes('invad') && !prompt.toLowerCase().includes('attack') && !prompt.toLowerCase().includes('war')) {
           data.timeline.takeovers = [];
        }
        setTimeline(data.timeline);
        setVideoDuration(data.timeline.totalFrames || 300);
        setStatus('editor');
      } else {
        setErrorMessage("There is high demand for this service. Please wait a moment and try again.");
        setStatus('idle');
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Network telemetry error or server timeout. Please wait a moment.");
      setStatus('idle');
    }
  };

  const initializeManualScene = () => {
    const blankTimeline = {
      title: `${entityA} vs ${entityB} (Manual)`,
      totalFrames: 300,
      highlightCountries: [
        { name: entityA, color: '#ef4444', strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, glowTarget: 'both', dropShadow: true, blendMode: 'screen', isPrimary: true, startFrame: 0, revealStyle: 'ink' },
        { name: entityB, color: '#3b82f6', strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, glowTarget: 'both', dropShadow: true, blendMode: 'screen', isPrimary: false, startFrame: 0, revealStyle: 'ink' }
      ],
      takeovers: [],
      arrows: [],
      cameraKeyframes: [
        { frame: 0, zoom: 1.0, lat: 38.0, lng: 127.0, pitch: 45, bearing: 0, easing: 'easeInOut' }
      ],
      assets: [] 
    } as any; 
    setTimeline(blankTimeline);
    setVideoDuration(300);
    setStatus('editor');
  };

  const startLiveEdit = () => {
    playerRef.current?.pause();
    setIsPlaying(false);
    const cFrame = playerRef.current?.getCurrentFrame() || 0;
    const pastKfs = timeline?.cameraKeyframes?.filter((kf: any) => kf.frame <= cFrame) || [];
    const baseKf: any = pastKfs[pastKfs.length - 1] || timeline?.cameraKeyframes?.[0] || { lat: 20, lng: 78, zoom: 1.2, pitch: 45, bearing: 0, easing: 'easeInOut' };

    setTargetLat(baseKf.lat ?? baseKf.latitude ?? 20);
    setTargetLng(baseKf.lng ?? baseKf.longitude ?? 78);
    setTargetZoom(baseKf.zoom ?? 1.2);
    setTargetPitch(baseKf.pitch ?? 45);
    setTargetBearing(baseKf.bearing ?? 0);
    setTargetEasing(baseKf.easing ?? 'easeInOut');
    setIsLiveEdit(true);
  };

  const dropKeyframeLive = () => {
    const cFrame = playerRef.current?.getCurrentFrame() || 0;
    let extensionNeeded = 0;
    setTimeline(prev => {
      if (!prev) return prev;
      const updated = JSON.parse(JSON.stringify(prev)) as any;
      if (!updated.cameraKeyframes) updated.cameraKeyframes = [];
      updated.cameraKeyframes = updated.cameraKeyframes.filter((kf: any) => Math.abs(kf.frame - cFrame) > 15);
      updated.cameraKeyframes.push({ frame: cFrame, zoom: targetZoom, lat: targetLat, lng: targetLng, pitch: targetPitch, bearing: targetBearing, easing: targetEasing });
      updated.cameraKeyframes.sort((a: any, b: any) => a.frame - b.frame);
      if (cFrame + 60 >= videoDuration) {
        extensionNeeded = (cFrame + 90) - videoDuration;
        updated.totalFrames = cFrame + 90;
      }
      return updated;
    });
    if (extensionNeeded > 0) setVideoDuration(prev => prev + extensionNeeded);
    setIsLiveEdit(false);
    setPathStartCoord(null);
  };

  const addCustomVector = (type: 'missile' | 'arrow') => {
    if (!pathStartCoord) return;
    const cFrame = playerRef.current?.getCurrentFrame() || 0;
    setTimeline(prev => {
      if (!prev) return prev;
      const updated = JSON.parse(JSON.stringify(prev)) as any;
      if (!updated.arrows) updated.arrows = [];
      updated.arrows.push({
        id: Math.random().toString(36).substr(2, 9),
        type,
        origin: pathStartCoord,
        target: [targetLng, targetLat],
        startFrame: cFrame,
        color: type === 'missile' ? '#ffffff' : '#ef4444' 
      });
      return updated;
    });
    setPathStartCoord(null); 
  };

  const dropAsset = (type: 'pin' | 'explosion') => {
    const cFrame = playerRef.current?.getCurrentFrame() || 0;
    setTimeline(prev => {
      if (!prev) return prev;
      const updated = JSON.parse(JSON.stringify(prev)) as any;
      if (!updated.assets) updated.assets = [];
      updated.assets.push({ id: Math.random().toString(36).substr(2, 9), type, lat: targetLat, lng: targetLng, startFrame: cFrame });
      return updated;
    });
  };

  const deleteAsset = (id: string) => {
    setTimeline(prev => {
      if (!prev) return prev;
      const updated = JSON.parse(JSON.stringify(prev)) as any;
      if (updated.assets) updated.assets = updated.assets.filter((a: any) => a.id !== id);
      if (updated.arrows) updated.arrows = updated.arrows.filter((a: any) => a.id !== id);
      if (updated.takeovers) updated.takeovers = updated.takeovers.filter((t: any) => t.id !== id);
      return updated;
    });
  };

  const addStoryEvent = () => {
    if (!entityA || !entityB) return;
    const cFrame = playerRef.current?.getCurrentFrame() || 0;
    setTimeline(prev => {
      if (!prev) return prev;
      const updated = JSON.parse(JSON.stringify(prev)) as any;
      if (!updated.takeovers) updated.takeovers = [];
      if (!updated.arrows) updated.arrows = [];
      if (!updated.highlightCountries) updated.highlightCountries = [];

      const foundEntityA = updated.highlightCountries.find((c:any) => c.name === entityA);
      const colorA = foundEntityA?.color || '#ef4444';
      const colorB = updated.highlightCountries.find((c:any) => c.name === entityB)?.color || '#3b82f6';

      if (eventType === 'takeover') {
        updated.takeovers.push({ id: Math.random().toString(36).substr(2,9), attacker: entityA, target: entityB, startFrame: cFrame, duration: 90, color: colorA });
      } else {
        updated.arrows.push({ id: Math.random().toString(36).substr(2,9), type: 'arrow', sourceName: entityA, targetName: entityB, startFrame: cFrame, color: colorA });
      }

      if (!foundEntityA) {
        updated.highlightCountries.push({ name: entityA, color: colorA, strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, glowTarget: 'both', dropShadow: true, blendMode: 'screen', isPrimary: true, startFrame: cFrame, revealStyle: 'ink' });
      }
      if (!updated.highlightCountries.find((c:any) => c.name === entityB)) {
        updated.highlightCountries.push({ name: entityB, color: colorB, strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, glowTarget: 'both', dropShadow: true, blendMode: 'screen', isPrimary: false, startFrame: cFrame, revealStyle: 'ink' });
      }
      return updated;
    });
  };

  const addCountryMap = () => {
    if (!newCountrySearch.trim()) return;
    const cFrame = playerRef.current?.getCurrentFrame() || 0;
    setTimeline(prev => {
      if (!prev) return prev;
      const updated = JSON.parse(JSON.stringify(prev)) as any;
      if (!updated.highlightCountries) updated.highlightCountries = [];
      const exists = updated.highlightCountries.find((c: any) => (c.name || c.country).toLowerCase() === newCountrySearch.trim().toLowerCase());
      if (!exists) {
        updated.highlightCountries.push({ name: newCountrySearch.trim(), color: '#3b82f6', strokeColor: '#ffffff', strokeWidth: 2, enableGlow: true, glowTarget: 'both', dropShadow: true, blendMode: 'screen', isPrimary: false, startFrame: cFrame, revealStyle: 'ink' });
      }
      return updated;
    });
    setNewCountrySearch(''); 
  };

  const updateEntityStyle = (key: string, value: any) => {
    if (!selectedEntity) return;
    setTimeline(prev => {
      if (!prev) return prev;
      const updated = JSON.parse(JSON.stringify(prev)) as any;
      if (updated.highlightCountries) {
        updated.highlightCountries = updated.highlightCountries.map((c: any) => {
          if (c.name === selectedEntity || c.country === selectedEntity) return { ...c, [key]: value };
          return c;
        });
      }
      if (key === 'color' && updated.arrows) {
        updated.arrows = updated.arrows.map((arr: any) => { 
          if (arr.sourceName === selectedEntity && arr.type !== 'missile') return { ...arr, color: value }; 
          return arr;
        });
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
  const activeStrokeWidth = activeEntityData?.strokeWidth ?? 2.5;
  const activeEnableGlow = activeEntityData?.enableGlow ?? true;
  const activeGlowIntensity = activeEntityData?.glowIntensity ?? 20;
  const activeBlendMode = activeEntityData?.blendMode ?? 'screen';
  const activeGlowTarget = activeEntityData?.glowTarget || 'both';
  const activeDropShadow = activeEntityData?.dropShadow ?? true;

  const dynamicTimeline = useMemo(() => {
    if (!timeline) return null;
    const modified = JSON.parse(JSON.stringify(timeline)) as any;
    modified.totalFrames = videoDuration;
    if (modified.highlightCountries) modified.highlightCountries = modified.highlightCountries.filter((c: any) => !disabledEntities.includes(c.name || c.country));
    if (modified.takeovers) modified.takeovers = modified.takeovers.filter((t: any) => !disabledEntities.includes(t.target || t.to || t.country));
    if (!showArrows) modified.arrows = [];

    if (modified.cameraKeyframes) {
      modified.cameraKeyframes = modified.cameraKeyframes.map((kf: any) => ({ ...kf, lat: kf.lat ?? 20.0, lng: kf.lng ?? 78.0, zoom: kf.zoom ?? 1.2, pitch: kf.pitch ?? 0, bearing: kf.bearing ?? 0, easing: kf.easing ?? 'easeInOut' }));
      if (isLiveEdit && playerRef.current) {
        const editFrame = playerRef.current.getCurrentFrame();
        modified.cameraKeyframes = modified.cameraKeyframes.filter((kf: any) => Math.abs(kf.frame - editFrame) > 15);
        modified.cameraKeyframes.push({ frame: editFrame, lat: targetLat, lng: targetLng, zoom: targetZoom, pitch: targetPitch, bearing: targetBearing, easing: targetEasing });
        modified.cameraKeyframes.sort((a: any, b: any) => a.frame - b.frame);
      }
    }
    return modified;
  }, [timeline, videoDuration, showArrows, disabledEntities, isLiveEdit, targetLat, targetLng, targetZoom, targetPitch, targetBearing, targetEasing]);

  return (
    <div style={{ backgroundColor: '#000000', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif', color: '#ffffff', margin: 0, overflow: 'hidden', position: 'relative' }}>
      
      {status === 'generating' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(30px)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: '14px', letterSpacing: '0.2em', color: '#38bdf8', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>COMPILING GEOPOLITICAL TELEMETRY...</div>
        </div>
      )}

      {status !== 'editor' && status !== 'generating' && (
        <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '680px' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '12px', textAlign: 'center' }}>Cinematic Timeline Studio</h1>
          
          {errorMessage && (
            <div style={{ width: '100%', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '14px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '16px' }}>⚡</span>
              <span style={{ fontSize: '12px', color: '#fde047', lineHeight: '1.4' }}>{errorMessage}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => setManualMode(false)} style={{ background: !manualMode ? 'rgba(255,255,255,0.1)' : 'transparent', color: !manualMode ? '#fff' : '#8e8e93', border: 'none', borderRadius: '10px', padding: '8px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>AI Directive Mode</button>
            <button onClick={() => setManualMode(true)} style={{ background: manualMode ? 'rgba(56,189,248,0.2)' : 'transparent', color: manualMode ? '#38bdf8' : '#8e8e93', border: 'none', borderRadius: '10px', padding: '8px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>🛠️ Manual Geopolitical Builder</button>
          </div>
          {!manualMode ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '24px', padding: '20px' }}>
              <textarea placeholder="e.g., North Korea and South Korea relations..." value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} style={{ width: '100%', background: 'transparent', border: 'none', color: '#ffffff', fontSize: '16px', outline: 'none', resize: 'none' }} required />
              <button type="submit" style={{ background: '#ffffff', color: '#000', border: 'none', borderRadius: '14px', padding: '10px 24px', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}>Generate Scene ✦</button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(40px)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '24px', padding: '24px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input type="text" value={entityA} onChange={(e) => setEntityA(e.target.value)} placeholder="Primary Entity" style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', color: '#fff', outline: 'none' }} />
                <input type="text" value={entityB} onChange={(e) => setEntityB(e.target.value)} placeholder="Secondary Entity" style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', color: '#fff', outline: 'none' }} />
              </div>
              <button onClick={initializeManualScene} style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)', color: '#000', border: 'none', borderRadius: '14px', padding: '12px 24px', fontWeight: 700, cursor: 'pointer', marginTop: '10px' }}>Launch Empty Studio 🚀</button>
            </div>
          )}
        </div>
      )}

      {status === 'editor' && dynamicTimeline && (
        <div style={{ zIndex: 10, width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', boxSizing: 'border-box' }}>
          
          <div style={{ position: 'absolute', left: '28px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(22, 22, 25, 0.75)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '14px', width: '200px', zIndex: 20 }}>
            <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 600, letterSpacing: '0.1em', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>SCENE ENTITIES</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input type="text" value={newCountrySearch} onChange={(e) => setNewCountrySearch(e.target.value)} placeholder="Search Country..." style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '10px', padding: '6px', borderRadius: '6px', outline: 'none' }} onKeyDown={(e) => e.key === 'Enter' && addCountryMap()} />
              <button onClick={addCountryMap} title="Add Map Layer" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', padding: '0 8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
              {timeline?.highlightCountries && timeline.highlightCountries.map((c: any, idx: number) => {
                const name = c.name || c.country;
                const isDisabled = disabledEntities.includes(name);
                const isSelected = selectedEntity === name;
                return (
                  <div key={`entity-${idx}`} style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setSelectedEntity(name)} style={{ flex: 1, background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)', border: isSelected ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)', color: '#ffffff', borderRadius: '8px', padding: '8px 10px', fontSize: '11px', textAlign: 'left', cursor: 'pointer', textDecoration: isDisabled ? 'line-through' : 'none' }}>{name}</button>
                    <button onClick={() => toggleEntitySuppression(name)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8e8e93', borderRadius: '8px', padding: '0 8px', cursor: 'pointer', fontSize: '12px' }}>{isDisabled ? '🙈' : '👁️'}</button>
                  </div>
                );
              })}
            </div>

            {((timeline as any)?.assets?.length > 0 || (timeline as any)?.arrows?.some((a:any) => a.id) || (timeline as any)?.takeovers?.some((t:any) => t.id)) && (
              <>
                <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 600, letterSpacing: '0.1em', width: '100%', textAlign: 'center', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginTop: '12px' }}>SCENE EVENTS & ASSETS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  
                  {(timeline as any).assets?.map((a: any) => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 10px' }}>
                      <span style={{ fontSize: '11px', color: '#fff' }}>{a.type === 'pin' ? '📍 Pin' : '💥 Boom'}</span>
                      <button onClick={() => deleteAsset(a.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                    </div>
                  ))}

                  {(timeline as any).arrows?.filter((a:any) => a.id).map((a: any) => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 10px' }}>
                      <span style={{ fontSize: '11px', color: '#fff' }}>{a.type === 'missile' ? '🚀 Missile' : '🏹 Arrow'}</span>
                      <button onClick={() => deleteAsset(a.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                    </div>
                  ))}

                  {(timeline as any).takeovers?.filter((t:any) => t.id).map((t: any) => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '6px 10px' }}>
                      <span style={{ fontSize: '11px', color: '#ef4444' }}>⚔️ {t.attacker} › {t.target}</span>
                      <button onClick={() => deleteAsset(t.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                    </div>
                  ))}

                </div>
              </>
            )}
          </div>

          <div 
            style={{ 
              position: 'relative', width: '100%', maxWidth: '650px', height: '82vh', 
              boxShadow: isLiveEdit ? '0 0 0 4px #38bdf8, 0 30px 90px rgba(56,189,248,0.3)' : '0 30px 90px rgba(0,0,0,0.9)', 
              border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '28px', overflow: 'hidden', background: '#000',
              transition: 'all 0.2s ease'
            }}
            onWheel={(e) => {
              if (!isLiveEdit) return;
              e.preventDefault(); 
              setTargetZoom(z => Math.max(0.2, Math.min(15, z - e.deltaY * 0.002)));
            }}
          >
            <Player
              ref={playerRef}
              component={MapAnimation}
              inputProps={{ timeline: dynamicTimeline, isLiveEditMode: isLiveEdit }}
              durationInFrames={videoDuration}
              compositionWidth={1080}
              compositionHeight={1920}
              fps={30}
              controls={false}
              style={{ width: '100%', height: '100%', pointerEvents: isLiveEdit ? 'auto' : 'none' }}
              loop
              autoPlay
            />
            
            {isLiveEdit && (
              <div 
                onContextMenu={(e) => e.preventDefault()} 
                onPointerDown={() => setIsDragging(true)}
                onPointerUp={() => setIsDragging(false)}
                onPointerLeave={() => setIsDragging(false)}
                onPointerMove={(e) => {
                  if (!isDragging) return;
                  if (e.buttons === 2 || e.shiftKey || e.altKey) {
                    setTargetPitch(p => Math.max(0, Math.min(85, p - e.movementY * 0.4)));
                    setTargetBearing(b => b + e.movementX * 0.8);
                  } else {
                    const panSensitivity = 1.5 / Math.pow(1.5, targetZoom);
                    setTargetLng(l => l - e.movementX * panSensitivity);
                    setTargetLat(l => Math.max(-85, Math.min(85, l + e.movementY * panSensitivity)));
                  }
                }}
                style={{ position: 'absolute', inset: 0, cursor: isDragging ? 'grabbing' : 'grab', zIndex: 50 }}
              >
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '24px', height: '24px', border: '2px solid rgba(56,189,248,0.6)', borderRadius: '50%', pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '4px', height: '4px', background: pathStartCoord ? '#ef4444' : '#38bdf8', borderRadius: '50%' }} />
                </div>
                
                <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '12px', fontSize: '10px', color: '#38bdf8', pointerEvents: 'none', border: '1px solid rgba(56,189,248,0.3)', backdropFilter: 'blur(10px)' }}>
                  L-Click Drag: Pan | R-Click or Shift+Drag: Spin CD & Tilt
                </div>

                <div style={{ position: 'absolute', top: '60px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.85)', padding: '12px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.15)', pointerEvents: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                  <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 600, letterSpacing: '0.1em' }}>MANUAL PATH TOOL</div>
                  {!pathStartCoord ? (
                    <button onPointerDown={(e) => { e.stopPropagation(); setPathStartCoord([targetLng, targetLat]); }} style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', borderRadius: '8px', padding: '8px 16px', color: '#38bdf8', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📍 Lock Start Point Here</button>
                  ) : (
                    <>
                      <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600 }}>START LOCKED. MOVE TO TARGET.</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onPointerDown={(e) => { e.stopPropagation(); addCustomVector('missile'); }} style={{ background: '#ef4444', border: 'none', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>🚀 Fire Missile</button>
                        <button onPointerDown={(e) => { e.stopPropagation(); addCustomVector('arrow'); }} style={{ background: '#3b82f6', border: 'none', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>🏹 Draw Arrow</button>
                        <button onPointerDown={(e) => { e.stopPropagation(); setPathStartCoord(null); }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '8px 12px', color: '#8e8e93', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </>
                  )}
                </div>
                
                <div style={{ position: 'absolute', bottom: '80px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.8)', padding: '10px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'auto' }}>
                  <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 600, textAlign: 'center' }}>STATIC ASSETS</div>
                  <button onPointerDown={(e) => { e.stopPropagation(); dropAsset('pin'); }} style={{ background: '#27272a', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>📍 Drop Pin Here</button>
                  <button onPointerDown={(e) => { e.stopPropagation(); dropAsset('explosion'); }} style={{ background: '#27272a', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>💥 Add Boom Here</button>
                </div>

                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px' }}>
                  <button onPointerDown={(e) => { e.stopPropagation(); dropKeyframeLive(); }} style={{ background: '#38bdf8', color: '#000', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', pointerEvents: 'auto', boxShadow: '0 10px 30px rgba(56,189,248,0.5)' }}>📍 Set Keyframe Here</button>
                  <button onPointerDown={(e) => { e.stopPropagation(); setIsLiveEdit(false); setPathStartCoord(null); }} style={{ background: 'rgba(0,0,0,0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '12px 16px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', pointerEvents: 'auto' }}>Done</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'absolute', right: '28px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(22, 22, 25, 0.75)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '16px', width: '220px', zIndex: 20 }}>
            
            {!isLiveEdit ? (
              <button onClick={startLiveEdit} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '8px', width: '100%', height: '40px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 15px rgba(56,189,248,0.2)' }}>
                🎯 Enter Live Canvas Edit
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '8px' }}>
                <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 600, letterSpacing: '0.1em', width: '100%', textAlign: 'center', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>CAMERA ENGINE</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                  <span style={{ color: '#8e8e93' }}>PITCH</span><span style={{ color: '#38bdf8', fontWeight: 600 }}>{Math.round(targetPitch)}°</span>
                </div>
                <input type="range" min="0" max="85" step="1" value={targetPitch} onChange={(e) => setTargetPitch(Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                  <span style={{ color: '#8e8e93' }}>BEARING</span><span style={{ color: '#38bdf8', fontWeight: 600 }}>{Math.round(targetBearing)}°</span>
                </div>
                <input type="range" min="-180" max="180" step="1" value={targetBearing} onChange={(e) => setTargetBearing(Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '4px' }}>
                  <span style={{ color: '#8e8e93' }}>EASING</span>
                  <select value={targetEasing} onChange={(e) => setTargetEasing(e.target.value)} style={{ background: 'rgba(0,0,0,0.5)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px', outline: 'none', fontSize: '10px', padding: '4px 6px', cursor: 'pointer' }}>
                    <option value="easeInOut">Ease In/Out</option>
                    <option value="easeOut">Ease Out</option>
                    <option value="linear">Linear</option>
                  </select>
                </div>
              </div>
            )}

            {selectedEntity ? (
              <>
                <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 600, letterSpacing: '0.1em', width: '100%', textAlign: 'center', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginTop: '8px' }}>
                  STYLING: {selectedEntity.toUpperCase()}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                  <span style={{ color: '#8e8e93' }}>FILL COLOR</span>
                  <input type="color" value={activeColor} onChange={(e) => updateEntityStyle('color', e.target.value)} style={{ width: '20px', height: '20px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
                  <span style={{ color: '#8e8e93' }}>GLOW</span>
                  <button onClick={() => updateEntityStyle('enableGlow', !activeEnableGlow)} style={{ background: activeEnableGlow ? '#38bdf8' : 'transparent', color: activeEnableGlow ? '#000' : '#8e8e93', border: '1px solid #38bdf8', borderRadius: '4px', padding: '2px 6px', fontSize: '8px', cursor: 'pointer' }}>{activeEnableGlow ? 'ON' : 'OFF'}</button>
                </div>
                {activeEnableGlow && <input type="range" min="0" max="50" step="1" value={activeGlowIntensity} onChange={(e) => updateEntityStyle('glowIntensity', Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }} />}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '4px' }}>
                  <span style={{ color: '#8e8e93' }}>GLOW TARGET</span>
                  <select value={activeGlowTarget} onChange={(e) => updateEntityStyle('glowTarget', e.target.value)} style={{ background: 'rgba(0,0,0,0.5)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px', outline: 'none', fontSize: '10px', padding: '4px 6px', cursor: 'pointer' }}>
                    <option value="both">Both</option>
                    <option value="fill">Fill Only</option>
                    <option value="stroke">Stroke Only</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '4px' }}>
                  <span style={{ color: '#8e8e93' }}>DROP SHADOW</span>
                  <button onClick={() => updateEntityStyle('dropShadow', !activeDropShadow)} style={{ background: activeDropShadow ? '#38bdf8' : 'transparent', color: activeDropShadow ? '#000' : '#8e8e93', border: '1px solid #38bdf8', borderRadius: '4px', padding: '2px 6px', fontSize: '8px', cursor: 'pointer' }}>{activeDropShadow ? 'ON' : 'OFF'}</button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '8px' }}>
                  <span style={{ color: '#8e8e93' }}>STROKE ({activeStrokeWidth}px)</span>
                  <input type="color" value={activeStrokeColor} onChange={(e) => updateEntityStyle('strokeColor', e.target.value)} style={{ width: '16px', height: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                </div>
                <input type="range" min="0" max="10" step="0.5" value={activeStrokeWidth} onChange={(e) => updateEntityStyle('strokeWidth', Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '4px' }}>
                  <span style={{ color: '#8e8e93' }}>BLEND</span>
                  <select value={activeBlendMode} onChange={(e) => updateEntityStyle('blendMode', e.target.value)} style={{ background: 'rgba(0,0,0,0.5)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px', outline: 'none', fontSize: '10px', padding: '4px 6px', cursor: 'pointer' }}>
                    <option value="normal">Normal</option>
                    <option value="screen">Screen</option>
                    <option value="multiply">Multiply</option>
                    <option value="overlay">Overlay</option>
                    <option value="add">Color Dodge (Add)</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '10px', color: '#8e8e93', fontWeight: 600, letterSpacing: '0.1em', width: '100%', textAlign: 'center', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginTop: '8px' }}>AUTO INJECTOR</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={entityA} onChange={(e)=>setEntityA(e.target.value)} placeholder="From" style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '10px', padding: '6px', borderRadius: '6px' }} />
                  <input type="text" value={entityB} onChange={(e)=>setEntityB(e.target.value)} placeholder="Target" style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '10px', padding: '6px', borderRadius: '6px' }} />
                </div>
                <select value={eventType} onChange={(e) => setEventType(e.target.value as any)} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px', outline: 'none', fontSize: '10px', padding: '6px', cursor: 'pointer' }}>
                  <option value="arrow">Diplomatic Tension (Line Arrow)</option>
                  <option value="takeover">Conflict (Invasion Wave)</option>
                </select>
                <button onClick={addStoryEvent} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', width: '100%', height: '30px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>＋ Inject Event</button>
              </>
            )}

            <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)', marginTop: '8px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsTimelineOpen(!isTimelineOpen)} style={{ flex: 1, background: isTimelineOpen ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)', border: isTimelineOpen ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', height: '32px', cursor: 'pointer', fontSize: '14px' }}>⏳</button>
            </div>
          </div>

          {/* TIMELINE DRAWER */}
          {isTimelineOpen && (
            <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(20, 20, 24, 0.9)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '22px', padding: '18px 28px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 30px 60px rgba(0,0,0,0.9)', width: '85%', maxWidth: '800px', zIndex: 30 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={togglePlay} style={{ background: '#ffffff', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}>{isPlaying ? '❚❚' : '▶'}</button>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>TIMELINE // DURATION: {videoDuration}f // CURRENT: {Math.round(currentFrame)}f</span>
                <button onClick={() => setIsTimelineOpen(false)} style={{ background: 'transparent', border: 'none', color: '#8e8e93', cursor: 'pointer', fontSize: '12px' }}>✕ CLOSE</button>
              </div>

              <div style={{ position: 'relative', width: '100%', height: '30px', display: 'flex', alignItems: 'center' }}>
                {timeline?.takeovers && timeline.takeovers.map((t: any, i: number) => {
                  const leftPercent = ((t.startFrame || 0) / videoDuration) * 100;
                  return <div key={`inv-drawer-${i}`} title={`Conflict: ${t.attacker} > ${t.target}`} style={{ position: 'absolute', left: `${Math.min(Math.max(leftPercent, 0), 100)}%`, transform: 'translateX(-50%)', width: '6px', height: '16px', backgroundColor: '#ef4444', borderRadius: '2px', cursor: 'help', zIndex: 15 }} />
                })}

                {timeline?.arrows && timeline.arrows.map((a: any, i: number) => {
                  const leftPercent = ((a.startFrame || 0) / videoDuration) * 100;
                  const isMissile = a.type === 'missile';
                  return <div key={`arr-drawer-${i}`} title={`${isMissile ? 'Missile' : 'Arrow'}`} style={{ position: 'absolute', left: `${Math.min(Math.max(leftPercent, 0), 100)}%`, transform: 'translateX(-50%)', width: '6px', height: '16px', backgroundColor: isMissile ? '#ffffff' : '#3b82f6', borderRadius: '2px', cursor: 'help', zIndex: 15 }} />
                })}

                {(timeline as any)?.assets && (timeline as any).assets.map((a: any, i: number) => {
                  const leftPercent = ((a.startFrame || 0) / videoDuration) * 100;
                  return <div key={`ast-drawer-${i}`} title={`Asset: ${a.type}`} style={{ position: 'absolute', left: `${Math.min(Math.max(leftPercent, 0), 100)}%`, transform: 'translateX(-50%)', width: '10px', height: '10px', backgroundColor: '#10b981', borderRadius: '50%', cursor: 'help', zIndex: 15 }} />
                })}
                
                {timeline?.cameraKeyframes && timeline.cameraKeyframes.map((kf: any, i: number) => {
                  const leftPercent = (kf.frame / videoDuration) * 100;
                  return (
                    <div 
                      key={`kf-drawer-${i}`}
                      title={`Cam Keyframe ${i + 1} (Frame: ${kf.frame})\nRight-Click to Delete`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setTimeline(prev => {
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
                          
                          setTimeline(prev => {
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
                      style={{ position: 'absolute', left: `${Math.min(Math.max(leftPercent, 0), 100)}%`, transform: 'translate(-50%, -50%) rotate(45deg)', top: '15px', width: '14px', height: '14px', backgroundColor: '#38bdf8', border: '2px solid #ffffff', cursor: 'ew-resize', zIndex: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
                    />
                  );
                })}
                
                <input 
                  type="range" min="0" max={videoDuration} step="1" value={currentFrame} 
                  onChange={(e) => { const targetFrame = Number(e.target.value); setCurrentFrame(targetFrame); playerRef.current?.seekTo(targetFrame); }} 
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer', position: 'relative', zIndex: 6, background: 'transparent' }} 
                />
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

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<WebApp />);
}