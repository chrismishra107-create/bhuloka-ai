import React, { useState, useMemo, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MapAnimation } from './MapAnimation';
import { GeneratedTimeline } from './backend/generateTimeline';

export const AppUI: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  
  // App States
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'editor'>('idle');
  const [isPlaying, setIsPlaying] = useState(true);
  
  // Creative Overrides
  const [timeline, setTimeline] = useState<GeneratedTimeline | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(300);
  const [attackerColor, setAttackerColor] = useState<string>('#991b1b');
  const [defenderColor, setDefenderColor] = useState<string>('#1e3a8a');

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
        alert("Failed to generate timeline.");
        setStatus('idle');
      }
    } catch (error) {
      console.error(error);
      alert("Server error. Make sure your node app.js is running.");
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

    return modified;
  }, [timeline, videoDuration, attackerColor, defenderColor]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div style={{
      backgroundColor: '#040711', width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#ffffff', margin: 0, overflow: 'hidden', position: 'relative'
    }}>
      
      {/* =========================================
          STATE: PROMPT SCREEN
      ========================================= */}
      {status !== 'editor' && (
        <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '600px' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '12px' }}>
            BhuLoka AI
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '16px', marginBottom: '40px', textAlign: 'center' }}>
            Type a geopolitical event. Generate a cinematic map instantly.
          </p>

          {status === 'idle' ? (
            <form onSubmit={handleSubmit} style={{
              display: 'flex', flexDirection: 'column', gap: '16px', width: '100%',
              background: 'rgba(255, 255, 255, 0.04)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', padding: '24px',
              boxShadow: '0 30px 60px rgba(0,0,0,0.8)'
            }}>
              <textarea
                placeholder="e.g., India invading Bangladesh..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                style={{
                  background: 'transparent', border: 'none', color: '#ffffff',
                  fontSize: '18px', outline: 'none', resize: 'none'
                }}
                required
              />
              <button type="submit" style={{
                alignSelf: 'flex-end', background: '#ffffff', color: '#000000',
                border: 'none', borderRadius: '30px', padding: '12px 28px',
                fontWeight: 700, fontSize: '15px', cursor: 'pointer'
              }}>
                Generate Map ✦
              </button>
            </form>
          ) : (
            <div style={{ color: '#f59e0b', fontSize: '18px', animation: 'pulse 1.5s infinite' }}>
              Compiling Geopolitical Engine...
            </div>
          )}
        </div>
      )}

      {/* =========================================
          STATE: CREATIVE EDITOR HUD
      ========================================= */}
      {status === 'editor' && dynamicTimeline && (
        <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', justifyContent: 'center' }}>
          
          {/* THE RAW PLAYER (No boring default controls) */}
          <div style={{ width: '100%', maxWidth: '1080px', height: '100%', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}>
            <Player
              ref={playerRef}
              component={MapAnimation}
              inputProps={{ timeline: dynamicTimeline }}
              durationInFrames={videoDuration}
              compositionWidth={1080}
              compositionHeight={1920}
              fps={30}
              controls={false} // 🔥 KILLS THE GENERIC REMOTION UI
              style={{ width: '100%', height: '100%' }}
              loop
              autoPlay
            />
          </div>

          {/* 🔥 THE GOD-TIER GLASS HUD 🔥 */}
          <div style={{
            position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(15, 15, 20, 0.75)', backdropFilter: 'blur(30px) saturate(150%)',
            border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '30px',
            padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)', width: '90%', maxWidth: '700px'
          }}>
            
            {/* Custom Play/Pause */}
            <button onClick={togglePlay} style={{
              background: '#ffffff', border: 'none', borderRadius: '50%',
              width: '48px', height: '48px', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#000'
            }}>
              {isPlaying ? '⏸' : '▶'}
            </button>

            {/* Colors */}
            <div style={{ display: 'flex', gap: '16px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>ATTACKER</span>
                <input type="color" value={attackerColor} onChange={(e) => setAttackerColor(e.target.value)} 
                  style={{ width: '32px', height: '32px', border: 'none', borderRadius: '50%', cursor: 'pointer', background: 'transparent' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>DEFENDER</span>
                <input type="color" value={defenderColor} onChange={(e) => setDefenderColor(e.target.value)} 
                  style={{ width: '32px', height: '32px', border: 'none', borderRadius: '50%', cursor: 'pointer', background: 'transparent' }} />
              </div>
            </div>

            {/* Duration Override */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>TIMELINE DURATION</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{(videoDuration / 30).toFixed(1)}s</span>
              </div>
              <input 
                type="range" min="90" max="900" step="30"
                value={videoDuration} onChange={(e) => setVideoDuration(Number(e.target.value))} 
                style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
              />
            </div>

            {/* Reset */}
            <button onClick={() => setStatus('idle')} style={{
              background: 'transparent', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '20px', padding: '10px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
            }}>
              Close
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"]::-webkit-color-swatch { border: 2px solid rgba(255,255,255,0.4); border-radius: 50%; }
      `}</style>
    </div>
  );
};