import React, { useState, useMemo, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MapAnimation } from './MapAnimation';
import { GeneratedTimeline } from './backend/generateTimeline';

export const LiveApp: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'editor'>('idle');
  const [isPlaying, setIsPlaying] = useState(true);
  
  // Timeline & Pro Controls
  const [timeline, setTimeline] = useState<GeneratedTimeline | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(300);
  const [attackerColor, setAttackerColor] = useState<string>('#991b1b');
  const [defenderColor, setDefenderColor] = useState<string>('#1e3a8a');
  
  // Advanced Cinematic Toggles
  const [terrainOpacity, setTerrainOpacity] = useState<number>(0.65);
  const [showArrows, setShowArrows] = useState<boolean>(true);
  const [currentFrame, setCurrentFrame] = useState<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setStatus('generating');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      if (data.timeline) {
        setTimeline(data.timeline);
        setVideoDuration(data.timeline.totalFrames || 300);
        setStatus('editor');
      } else {
        alert("Directive compilation failed.");
        setStatus('idle');
      }
    } catch (error) {
      console.error(error);
      alert("Network telemetry error.");
      setStatus('idle');
    }
  };

  const dynamicTimeline = useMemo(() => {
    if (!timeline) return null;
    const modified = JSON.parse(JSON.stringify(timeline)) as GeneratedTimeline;
    modified.totalFrames = videoDuration;
    
    // Apply Colors
    modified.highlightCountries = modified.highlightCountries.map(c => ({
      ...c, color: c.isPrimary ? attackerColor : defenderColor
    }));
    modified.takeovers = modified.takeovers.map(t => ({
      ...t, color: attackerColor
    }));

    // Toggle Arrows on/off
    if (!showArrows) {
      modified.arrows = [];
    }

    return modified;
  }, [timeline, videoDuration, attackerColor, defenderColor, showArrows]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pause();
    else playerRef.current.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div style={{
      backgroundColor: '#020408', width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      color: '#e2e8f0', margin: 0, overflow: 'hidden', position: 'relative'
    }}>
      
      {/* Background Sci-Fi Grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(239, 68, 68, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(239, 68, 68, 0.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px', zIndex: 1, pointerEvents: 'none'
      }} />

      {/* =========================================
          PROMPT SCREEN
      ========================================= */}
      {status !== 'editor' && (
        <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '680px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%', boxShadow: '0 0 10px #ef4444' }} />
            <span style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#94a3b8', textTransform: 'uppercase' }}>
              BHULOKA // PRO STUDIO SUITE v3.0
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '12px', textAlign: 'center', color: '#fff' }}>
            TACTICAL THEATRE
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '40px', textAlign: 'center', maxWidth: '480px' }}>
            Generate cinematic geopolitical animations with professional real-time layer control.
          </p>

          {status === 'idle' ? (
            <form onSubmit={handleSubmit} style={{
              display: 'flex', flexDirection: 'column', gap: '20px', width: '100%',
              background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(40px)',
              border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '24px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.9)'
            }}>
              <textarea
                placeholder="EXECUTE DIRECTIVE: e.g., India invading Bangladesh..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                style={{
                  width: '100%', background: 'rgba(2, 6, 23, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px', color: '#ffffff', fontSize: '16px', padding: '16px',
                  outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box'
                }}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: '#ffffff',
                  border: 'none', borderRadius: '12px', padding: '14px 28px',
                  fontWeight: 800, fontSize: '14px', letterSpacing: '0.1em', cursor: 'pointer',
                  boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)'
                }}>
                  INITIALIZE SIMULATION ➔
                </button>
              </div>
            </form>
          ) : (
            <div style={{ color: '#ef4444', fontSize: '16px', fontWeight: 800, letterSpacing: '0.2em', animation: 'pulse 1.5s infinite' }}>
              COMPILING VECTOR TOPOLOGY...
            </div>
          )}
        </div>
      )}

      {/* =========================================
          ADVANCED EDITING SUITE & PLAYER HUD
      ========================================= */}
      {status === 'editor' && dynamicTimeline && (
        <div style={{ zIndex: 10, width: '100%', height: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          
          {/* Remotion Canvas Container */}
          <div style={{
            width: '100%', maxWidth: '850px', height: '100%', maxHeight: '88vh',
            boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 30px rgba(153,27,27,0.15)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', overflow: 'hidden', background: '#000'
          }}>
            <Player
              ref={playerRef}
              component={MapAnimation}
              inputProps={{ timeline: dynamicTimeline }}
              durationInFrames={videoDuration}
              compositionWidth={1080}
              compositionHeight={1920}
              fps={30}
              controls={false}
              style={{ width: '100%', height: '100%' }}
              loop
              autoPlay
            />
          </div>

          {/* 🔥 PRO-GRADE MULTI-TOOL HUD DECK 🔥 */}
          <div style={{
            position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(3, 7, 18, 0.9)', backdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '20px',
            padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '14px',
            boxShadow: '0 30px 60px rgba(0,0,0,0.9)', width: '92%', maxWidth: '750px', zIndex: 20
          }}>
            
            {/* Top Row: Playback & Colors */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={togglePlay} style={{
                  background: '#ffffff', border: 'none', borderRadius: '10px',
                  width: '38px', height: '38px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold'
                }}>
                  {isPlaying ? '❚❚' : '▶'}
                </button>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '9px', color: '#ef4444' }}>OFFENSIVE</span>
                    <input type="color" value={attackerColor} onChange={(e) => setAttackerColor(e.target.value)} 
                      style={{ width: '22px', height: '22px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '9px', color: '#3b82f6' }}>DEFENSIVE</span>
                    <input type="color" value={defenderColor} onChange={(e) => setDefenderColor(e.target.value)} 
                      style={{ width: '22px', height: '22px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowArrows(!showArrows)} style={{
                  background: showArrows ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)',
                  color: showArrows ? '#38bdf8' : '#64748b',
                  border: '1px solid ' + (showArrows ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.1)'),
                  borderRadius: '8px', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
                }}>
                  MISSILE ARROWS: {showArrows ? 'ON' : 'OFF'}
                </button>

                <button onClick={() => setStatus('idle')} style={{
                  background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
                }}>
                  NEW SCENE
                </button>
              </div>
            </div>

            {/* Bottom Row: Duration Slider & Telemetry */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.1em' }}>TIMELINE DURATION (SPEED)</span>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8' }}>{(videoDuration / 30).toFixed(1)}s</span>
                </div>
                <input 
                  type="range" min="90" max="900" step="30"
                  value={videoDuration} onChange={(e) => setVideoDuration(Number(e.target.value))} 
                  style={{ width: '100%', accentColor: '#ef4444', cursor: 'pointer' }}
                />
              </div>
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"]::-webkit-color-swatch { border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; }
      `}</style>
    </div>
  );
};