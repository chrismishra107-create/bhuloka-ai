import React, { useState } from 'react';

export const HomeStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'done'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setStatus('generating');
    
    // Simulating backend timeline compilation & map trigger
    setTimeout(() => {
      setStatus('done');
    }, 2500);
  };

  return (
    <div style={{
      backgroundColor: '#09090b',
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#ffffff',
      margin: 0,
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Ambient background glow matching Gemini/Apple style */}
      <div style={{
        position: 'absolute',
        width: '700px',
        height: '700px',
        background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%',
        zIndex: 1,
        pointerEvents: 'none'
      }} />

      <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '720px' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '12px', textAlign: 'center' }}>
          What map animation do you want?
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '18px', marginBottom: '48px', textAlign: 'center' }}>
          Describe your geopolitical scene, troop movements, or airstrikes below.
        </p>

        {status === 'idle' && (
          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(255, 255, 255, 0.04)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '28px',
            padding: '16px 20px',
            boxShadow: '0 30px 60px rgba(0, 0, 0, 0.9)',
            width: '100%',
            gap: '16px'
          }}>
            <textarea
              placeholder="e.g., Show Russian forces advancing toward eastern Ukraine with an airstrike on the target..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '17px',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.5'
              }}
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
              <button
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '10px 24px',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                  transition: 'transform 0.1s ease'
                }}
              >
                Generate Scene →
              </button>
            </div>
          </form>
        )}

        {status === 'generating' && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '24px',
            padding: '32px',
            textAlign: 'center',
            width: '100%'
          }}>
            <div style={{ color: '#f59e0b', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Compiling Geopolitical Timeline...
            </div>
            <div style={{ color: '#888888', fontSize: '14px' }}>
              Analyzing script, calculating camera keyframes, and projecting map coordinates.
            </div>
          </div>
        )}

        {status === 'done' && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '24px',
            padding: '32px',
            textAlign: 'center',
            width: '100%'
          }}>
            <div style={{ color: '#10b981', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Timeline Ready!
            </div>
            <div style={{ color: '#d1d5db', fontSize: '14px', marginBottom: '20px' }}>
              Your animation script has been successfully structured. Open Remotion Studio to view or render.
            </div>
            <button
              onClick={() => setStatus('idle')}
              style={{
                background: 'transparent',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '16px',
                padding: '8px 18px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Create Another
            </button>
          </div>
        )}
      </div>
    </div>
  );
};