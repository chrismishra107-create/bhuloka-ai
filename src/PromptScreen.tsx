import React, { useState } from 'react';
import { AbsoluteFill } from 'remotion';

export const PromptScreen: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setSubmitted(true);
  };

  return (
    <AbsoluteFill style={{
      backgroundColor: '#000000',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#ffffff',
      overflow: 'hidden'
    }}>
      {/* Background ambient gold glow */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%',
        zIndex: 1,
        pointerEvents: 'none'
      }} />

      <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '85%', maxWidth: '540px' }}>
        <h1 style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '10px', textAlign: 'center', color: '#ffffff' }}>
          Geopolitical Studio
        </h1>
        <p style={{ color: '#888888', fontSize: '16px', marginBottom: '32px', textAlign: 'center', lineHeight: '1.4' }}>
          Type your scene description to instantly generate 3D map animations.
        </p>

        {!submitted ? (
          <form onSubmit={handleGenerate} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '28px',
            padding: '20px',
            boxShadow: '0 30px 60px rgba(0,0,0,0.9)'
          }}>
            <textarea
              placeholder="e.g., Show Russian forces advancing toward eastern Ukraine with an airstrike on the target..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '16px',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.5'
              }}
              required
            />
            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#000000',
                border: 'none',
                borderRadius: '16px',
                padding: '14px',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.25)',
                transition: 'transform 0.1s ease'
              }}
            >
              Generate Cinematic Map
            </button>
          </form>
        ) : (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '20px',
            padding: '24px',
            textAlign: 'center',
            width: '100%'
          }}>
            <h3 style={{ color: '#f59e0b', marginBottom: '8px', fontSize: '18px' }}>Generating Timeline...</h3>
            <p style={{ color: '#aaa', fontSize: '14px' }}>Compiling script and rendering map frames via backend engine.</p>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};