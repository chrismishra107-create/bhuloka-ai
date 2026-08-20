import React, { useState } from 'react';

export const LiveApp: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setVideoUrl(null);
    setStatusText('Gemini is structuring your geopolitical timeline...');

    try {
      const response = await fetch('http://localhost:4000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      setStatusText('Rendering cinematic 3D map frames via Remotion...');
      const data = await response.json();

      if (data.success) {
        setVideoUrl(data.videoUrl);
      } else {
        alert('Generation failed: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Network error connecting to backend server.');
    } finally {
      setLoading(false);
      setStatusText('');
    }
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
      overflow: 'hidden'
    }}>
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
        {!videoUrl ? (
          <>
            <h1 style={{ fontSize: '44px', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '12px', textAlign: 'center' }}>
              What map animation do you want?
            </h1>
            <p style={{ color: '#9ca3af', fontSize: '18px', marginBottom: '40px', textAlign: 'center' }}>
              Type your script or scene prompt. Gemini and Remotion will build it live.
            </p>

            <form onSubmit={handleSubmit} style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '28px',
              padding: '16px 20px',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.9)',
              width: '100%',
              gap: '16px'
            }}>
              <textarea
                placeholder="e.g., Show Russian forces advancing toward eastern Ukraine with an airstrike..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                disabled={loading}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>
                  {loading ? statusText : 'Powered by Gemini & Remotion'}
                </span>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: loading ? '#374151' : 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)',
                    color: loading ? '#9ca3af' : '#000000',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '10px 24px',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                    transition: 'transform 0.1s ease'
                  }}
                >
                  {loading ? 'Generating Video...' : 'Generate Scene →'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', width: '100%' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700 }}>Your Animation is Ready!</h2>
            <div style={{ width: '360px', height: '640px', background: '#000', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <video src={videoUrl} controls autoPlay loop style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <button
              onClick={() => { setVideoUrl(''); setPrompt(''); }}
              style={{
                background: 'transparent',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '16px',
                padding: '10px 24px',
                cursor: 'pointer',
                fontSize: '15px'
              }}
            >
              Create Another Map Scene
            </button>
          </div>
        )}
      </div>
    </div>
  );
};