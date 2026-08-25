import React, { useState, useMemo, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MapAnimation } from './MapAnimation';
import { GeneratedTimeline } from './backend/generateTimeline';

export const LiveApp: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'editor'>('idle');
  const [isPlaying, setIsPlaying] = useState(true);
  
  const [timeline, setTimeline] = useState<GeneratedTimeline | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(300);
  const [attackerColor, setAttackerColor] = useState<string>('#991b1b');
  const [defenderColor, setDefenderColor] = useState<string>('#1e3a8a');
  const [showArrows, setShowArrows] = useState<boolean>(true);
  
  // Studio UI Layout States (Based on your sketch!)
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(false);
  const [selectedTool, setSelectedTool] = useState<string>('layers');

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
    
    modified.highlightCountries = modified.highlightCountries.map(c => ({
      ...c, color: c.isPrimary ? attackerColor : defenderColor
    }));
    modified.takeovers = modified.takeovers.map(t => ({
      ...t, color: attackerColor
    }));

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
      backgroundColor: '#05070f', width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      color: '#e2e8f0', margin: 0, overflow: 'hidden', position: 'relative'
    }}>
      
      {/* Sci-Fi Background Grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(56, 189, 248, 0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.015) 1px, transparent 1px)',
        backgroundSize: '40px 40px', zIndex: 1, pointerEvents: 'none'
      }} />

      {/* =========================================
          PROMPT SCREEN
      ========================================= */}
      {status !== 'editor' && (
        <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '680px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#38bdf8', borderRadius: '50%', boxShadow: '0 0 10px #38bdf8' }} />
            <span style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#94a3b8', textTransform: 'uppercase' }}>
              BHULOKA // STUDIO PRO WORKSPACE v6.0
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '12px', textAlign: 'center', color: '#fff' }}>
            TACTICAL THEATRE
          </h1>
          <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '40px', textAlign: 'center', maxWidth: '480px' }}>
            Professional cinematic map editor with flanking tool docks and modular timeline.
          </p>

          {status === 'idle' ? (
            <form onSubmit={handleSubmit} style={{
              display: 'flex', flexDirection: 'column', gap: '20px', width: '100%',
              background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(40px)',
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
                  background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)', color: '#000000',
                  border: 'none', borderRadius: '12px', padding: '14px 28px',
                  fontWeight: 800, fontSize: '14px', letterSpacing: '0.1em', cursor: 'pointer',
                  boxShadow: '0 10px 25px rgba(56, 189, 248, 0.4)'
                }}>
                  INITIALIZE STUDIO ➔
                </button>
              </div>
            </form>
          ) : (
            <div style={{ color: '#38bdf8', fontSize: '16px', fontWeight: 800, letterSpacing: '0.2em', animation: 'pulse 1.5s infinite' }}>
              ASSEMBLING WORKSPACE...
            </div>
          )}
        </div>
      )}

      {/* =========================================
          PRO STUDIO WORKSPACE (FLANKING DOCKS + CENTER VIEWPORT)
      ========================================= */}
      {status === 'editor' && dynamicTimeline && (
        <div style={{ zIndex: 10, width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
          
          {/* LEFT FLANKING TOOL DOCK (Layers & Controls) */}
          <div style={{
            position: 'absolute', left: '24px', display: 'flex', flexDirection: 'column', gap: '12px',
            background: 'rgba(10, 15, 30, 0.8)', backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '14px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 20
          }}>
            <span style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.15em', textAlign: 'center', marginBottom: '4px' }}>LAYERS</span>
            
            {['🌍', '⚔️', '📡', '📐'].map((icon, idx) => (
              <button 
                key={`left-tool-${idx}`}
                onClick={() => setSelectedTool(`layer-${idx}`)}
                style={{
                  background: selectedTool === `layer-${idx}` ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: selectedTool === `layer-${idx}` ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px', width: '40px', height: '40px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                }}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* CENTRAL CANVAS / VIEWPORT */}
          <div style={{
            width: '100%', maxWidth: '650px', height: '82vh',
            boxShadow: '0 0 100px rgba(0,0,0,0.9), 0 0 40px rgba(56,189,248,0.1)',
            border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '20px', overflow: 'hidden', background: '#000',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
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

          {/* RIGHT FLANKING TOOL DOCK (Properties, Faction Colors & Timeline Toggle) */}
          <div style={{
            position: 'absolute', right: '24px', display: 'flex', flexDirection: 'column', gap: '14px',
            background: 'rgba(10, 15, 30, 0.8)', backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '14px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)', zIndex: 20, alignItems: 'center'
          }}>
            <span style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.15em', textAlign: 'center' }}>PROPERTIES</span>

            {/* Faction Color Pickers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              <div title="Offensive Faction Color" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '8px', color: '#ef4444', marginBottom: '2px' }}>OFF</span>
                <input type="color" value={attackerColor} onChange={(e) => setAttackerColor(e.target.value)} 
                  style={{ width: '32px', height: '32px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }} />
              </div>
              <div title="Defensive Faction Color" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '8px', color: '#3b82f6', marginBottom: '2px' }}>DEF</span>
                <input type="color" value={defenderColor} onChange={(e) => setDefenderColor(e.target.value)} 
                  style={{ width: '32px', height: '32px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }} />
              </div>
            </div>

            <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }} />

            {/* 🔥 TIMELINE TOGGLE BUTTON (From your sketch!) 🔥 */}
            <button 
              onClick={() => setIsTimelineOpen(!isTimelineOpen)}
              title="Toggle Timeline Drawer"
              style={{
                background: isTimelineOpen ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                border: isTimelineOpen ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px', width: '42px', height: '42px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                boxShadow: isTimelineOpen ? '0 0 15px rgba(56, 189, 248, 0.4)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              ⏳
            </button>

            <button 
              onClick={() => setShowArrows(!showArrows)}
              style={{
                background: showArrows ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)',
                color: showArrows ? '#38bdf8' : '#64748b',
                border: '1px solid ' + (showArrows ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.1)'),
                borderRadius: '8px', width: '40px', height: '30px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              🏹
            </button>

            <button 
              onClick={() => setStatus('idle')}
              style={{
                background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px', width: '40px', height: '30px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>

          {/* 🔥 COLLAPSIBLE BOTTOM TIMELINE DRAWER (Opens when hourglass is clicked) 🔥 */}
          {isTimelineOpen && (
            <div style={{
              position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(5, 9, 20, 0.96)', backdropFilter: 'blur(40px)',
              border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px',
              padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px',
              boxShadow: '0 30px 60px rgba(0,0,0,0.9)', width: '85%', maxWidth: '780px', zIndex: 30,
              animation: 'slideUp 0.2s ease-out'
            }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={togglePlay} style={{
                    background: '#38bdf8', border: 'none', borderRadius: '6px',
                    width: '30px', height: '30px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold'
                  }}>
                    {isPlaying ? '❚❚' : '▶'}
                  </button>
                  <span style={{ fontSize: '10px', color: '#38bdf8', letterSpacing: '0.1em', fontWeight: 'bold' }}>
                    TIMELINE WORKSPACE // DURATION: {(videoDuration / 30).toFixed(1)}s
                  </span>
                </div>
                
                <button onClick={() => setIsTimelineOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>
                  ✕ CLOSE DRAWER
                </button>
              </div>

              {/* Draggable Keyframe Track Inside Drawer */}
              <div style={{ position: 'relative', width: '100%', height: '28px', display: 'flex', alignItems: 'center' }}>
                
                {timeline?.cameraKeyframes && timeline.cameraKeyframes.map((kf, i) => {
                  const leftPercent = (kf.frame / videoDuration) * 100;
                  return (
                    <div 
                      key={`kf-drawer-${i}`}
                      title={`Drag to shift Keyframe ${kf.frame}`}
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
                            updated.cameraKeyframes[i].frame = newFrame;
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
                      style={{
                        position: 'absolute', left: `${Math.min(Math.max(leftPercent, 0), 100)}%`,
                        transform: 'translateX(-50%) rotate(45deg)', width: '12px', height: '12px',
                        backgroundColor: '#38bdf8', border: '2px solid #ffffff', cursor: 'ew-resize', zIndex: 5
                      }}
                    />
                  );
                })}

                <input 
                  type="range" min="0" max={videoDuration} step="1"
                  defaultValue={0}
                  onChange={(e) => {
                    const targetFrame = Number(e.target.value);
                    playerRef.current?.seekTo(targetFrame);
                  }} 
                  style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer', position: 'relative', zIndex: 6, background: 'transparent' }}
                />
              </div>
            </div>
          )}

        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"]::-webkit-color-swatch { border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; }
      `}</style>
    </div>
  );
};