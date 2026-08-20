import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage({ type: 'error', text: 'Please enter both email and password.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Account created! Check your email to confirm.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Authentication failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#06090F',
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#F8FAFC',
        position: 'relative',
        overflow: 'hidden',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Radial Glow & Tactical Grid Accent */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.12) 0%, rgba(6, 9, 15, 0) 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Main Glass Card */}
      <div
        style={{
          zIndex: 2,
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          padding: '40px 32px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(34, 211, 238, 0.05)',
          textAlign: 'center',
        }}
      >
        {/* Tactical Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(34, 211, 238, 0.08)',
            border: '1px solid rgba(34, 211, 238, 0.25)',
            borderRadius: '9999px',
            padding: '4px 14px',
            marginBottom: '20px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#22D3EE',
              boxShadow: '0 0 8px #22D3EE',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#22D3EE',
              textTransform: 'uppercase',
            }}
          >
            Studio Access Gateway
          </span>
        </div>

        {/* Brand Title */}
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: '0 0 8px 0',
            backgroundImage: 'linear-gradient(135deg, #FFFFFF 30%, #22D3EE 100%)',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          BhuLoka AI
        </h1>
        <p
          style={{
            color: '#94A3B8',
            fontSize: '14px',
            margin: '0 0 28px 0',
            fontWeight: 400,
            lineHeight: 1.5,
          }}
        >
          {isSignUp ? 'Create an account to generate map animations' : 'Authenticate your session to enter the studio'}
        </p>

        {/* Input Form */}
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'left' }}>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#CBD5E1',
                marginBottom: '6px',
                display: 'block',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Email Address
            </label>
            <input
              type="email"
              placeholder="creator@bhuloka.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '13px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: 'rgba(2, 6, 23, 0.6)',
                color: '#FFFFFF',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#22D3EE')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)')}
            />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#CBD5E1',
                marginBottom: '6px',
                display: 'block',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '13px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: 'rgba(2, 6, 23, 0.6)',
                color: '#FFFFFF',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#22D3EE')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)')}
            />
          </div>

          {/* Alert Message */}
          {message && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                backgroundColor: message.type === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 211, 238, 0.12)',
                border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 211, 238, 0.3)'}`,
                color: message.type === 'error' ? '#FCA5A5' : '#67E8F9',
                textAlign: 'left',
              }}
            >
              {message.text}
            </div>
          )}

          {/* Primary Action Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              padding: '13px 20px',
              borderRadius: '12px',
              border: 'none',
              backgroundImage: 'linear-gradient(135deg, #22D3EE 0%, #3B82F6 100%)',
              color: '#06090F',
              fontWeight: 700,
              fontSize: '15px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 4px 20px rgba(34, 211, 238, 0.3)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            {loading ? 'Authenticating...' : isSignUp ? 'Create Studio Account' : 'Enter Situation Room'}
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div style={{ marginTop: '24px', fontSize: '13px', color: '#64748B' }}>
          {isSignUp ? 'Already have an account?' : "Don't have access yet?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#22D3EE',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            {isSignUp ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};