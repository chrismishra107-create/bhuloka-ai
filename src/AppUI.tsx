import React, { useState } from 'react';
import { Player } from '@remotion/player';
import { MapAnimation } from './MapAnimation';
import timelineData from './dynamicTimeline.json';

export const AppUI: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'success'>('idle');
  const [activeTimeline, setActiveTimeline] = useState(timelineData);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setStatus('generating');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.timeline) {
          setActiveTimeline(data.timeline);
        }
      }
      setStatus('success');
    } catch {
      setTimeout(() => setStatus('success'), 1500);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#090E17', /* Deep Slate Background */
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#F8FAFC',
        margin: 0,
        overflow: 'hidden',
        position: 'relative',
        padding: '20px',
      }}
    >
      {/* Background Electric Cyan glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '700px',
          height: '700px',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(9, 14, 23, 0) 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', gap: '24px' }}>
        
        {/* NEW BRANDING HEADER */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
            {/* Tactical Cyan SVG Globe Logo */}
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0px 0px 8px rgba(34, 211, 238, 0.6))' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              <path d="M2 12h20"></path>
            </svg>
            <h1 style={{ 
              fontSize: '38px', 
              fontWeight: 800, 
              letterSpacing: '-0.03em', 
              margin: 0,
              backgroundImage: 'linear-gradient(to right, #22D3EE, #3B82F6)',
              WebkitBackgroundClip: 'text',
              color: 'transparent'
            }}>
              BhuLoka AI
            </h1>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '15px', fontWeight: 500 }}>
            Type a prompt. Generate a cinematic map animation.
          </p>
        </div>

        {/* Prompt Input Form */}
        <form
          onSubmit={handleGenerate}
          style={{
            display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px',
            padding: '8px 10px 8px 20px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            width: '100%', maxWidth: '620px', gap: '10px'
          }}
        >
          <input
            type="text"
            placeholder="e.g., Highlight India with a gold border..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#F8FAFC', fontSize: '15px', outline: 'none' }}
            required
          />
          <button
            type="submit"
            disabled={status === 'generating'}
            style={{
              background: '#F8FAFC', color: '#0F172A', border: 'none', borderRadius: '16px',
              padding: '12px 22px', fontWeight: 700, fontSize: '14px',
              cursor: status === 'generating' ? 'not-allowed' : 'pointer', opacity: status === 'generating' ? 0.7 : 1,
              whiteSpace: 'nowrap'
            }}
          >
            {status === 'generating' ? 'Generating...' : 'Generate Map'}
          </button>
        </form>

        {/* Live Video Display Area */}
        <div style={{ width: '320px', height: '568px', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', backgroundColor: '#000000', position: 'relative' }}>
          <Player
            component={MapAnimation}
            durationInFrames={activeTimeline?.totalFrames || 300}
            compositionWidth={1080}
            compositionHeight={1920}
            fps={30}
            style={{ width: '100%', height: '100%' }}
            inputProps={{ timeline: activeTimeline as any }}
            controls
            autoPlay
            loop
          />
        </div>
      </div>
    </div>
  );
};