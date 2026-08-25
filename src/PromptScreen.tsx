import React, { useState } from 'react';
import { AbsoluteFill } from 'remotion';

export const PromptScreen: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('SYSTEM STANDBY // READY FOR TARGET DIRECTIVE');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setStatusMsg('DECRYPTING SATELLITE TOPOLOGY & VECTOR MESH...');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      setStatusMsg('COMPILING RENDER TIMELINE...');
      const data = await response.json();

      if (data.success || data.timeline) {
        setStatusMsg('ENGAGING REMOTION ENGINE...');
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        alert('Directive failed to compile.');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('Network telemetry error.');
      setLoading(false);
    }
  };

  return (
    <AbsoluteFill style={{
      backgroundColor: '#020408',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      color: '#e2e8f0',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Sci-Fi Tactical Grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(239, 68, 68, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(239, 68, 68, 0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px', zIndex: 1, pointerEvents: 'none'
      }} />

      {/* War-Room Ambient Core Glow */}
      <div style={{
        position: 'absolute', width: '700px', height: '700px',
        background: 'radial-gradient(circle, rgba(239, 68, 68, 0.08) 0%, rgba(30, 58, 138, 0.04) 50%, transparent 70%)',
        borderRadius: '50%', zIndex: 1, pointerEvents: 'none', filter: 'blur(50px)'
      }} />

      <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '640px' }}>
        
        {/* Radar Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%', boxShadow: '0 0 12px #ef4444', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: '11px', letterSpacing: '0.35em', color: '#94a3b8', textTransform: 'uppercase' }}>
            BHULOKA // STRATEGIC WAR-ROOM HUD
          </span>
        </div>

        <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '12px', textAlign: 'center', color: '#ffffff' }}>
          GEOPOLITICAL DIRECTIVE
        </h1>
        <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '36px', textAlign: 'center', lineHeight: '1.5' }}>
          Execute tactical scripts, border offenses, or kinetic interventions. Zero latency neural parser active.
        </p>

        <form onSubmit={handleGenerate} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: '100%',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 40px 80px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}>
          <textarea
            placeholder="ENTER DIRECTIVE: e.g., India invading Bangladesh..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            disabled={loading}
            style={{
              width: '100%',
              background: 'rgba(2, 6, 23, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '16px',
              padding: '16px',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
            <span style={{ fontSize: '11px', color: loading ? '#ef4444' : '#475569', letterSpacing: '0.1em' }}>
              {statusMsg}
            </span>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#334155' : 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)',
                color: loading ? '#94a3b8' : '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontWeight: 800,
                fontSize: '13px',
                letterSpacing: '0.1em',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 10px 25px rgba(239, 68, 68, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'EXECUTING...' : 'INITIALIZE MAP ➔'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 12px #ef4444; }
          50% { opacity: 0.4; transform: scale(0.92); box-shadow: 0 0 4px #ef4444; }
        }
      `}</style>
    </AbsoluteFill>
  );
};