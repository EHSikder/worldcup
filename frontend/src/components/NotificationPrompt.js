'use client';

import { useState, useEffect } from 'react';
import {
  isPushSupported,
  getPermissionState,
  isSubscribed,
  hasDismissed,
  markDismissed,
  enablePushNotifications,
  disablePushNotifications,
} from '@/lib/notifications';

// ─── Full-screen modal (shown once after signup) ─────────────
export default function NotificationPrompt({ onDone }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (
      isPushSupported() &&
      getPermissionState() === 'default' &&
      !isSubscribed() &&
      !hasDismissed()
    ) {
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const handleEnable = async () => {
    setLoading(true);
    setError('');
    try {
      await enablePushNotifications();
    } catch (err) {
      // still show success UX — permission was either granted or user clicked allow
      // only show error if it's a config issue
      if (err.message?.includes('VAPID') || err.message?.includes('not configured')) {
        setError(err.message);
        setLoading(false);
        return;
      }
    }
    // Show brief "done" state then auto-close
    setDone(true);
    setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1200);
  };

  const handleDismiss = () => {
    markDismissed();
    setVisible(false);
    onDone?.();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      animation: 'fadeIn 0.25s ease',
    }}>
      <div style={{
        background: '#26445F',
        borderRadius: 24,
        padding: '36px 32px',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.15)',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* Bell icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
          background: 'rgba(255,255,255,0.1)',
          border: '2px solid rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" width="34" height="34">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 10, color: '#ffffff' }}>
          Never Miss a Match
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 24 }}>
          Get a single daily reminder before any match you haven't predicted yet — sent 4 hours before the first kick-off of the day.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
          {['⚽ Match reminders', '🔔 One alert per day', '🎯 Unpredicted only'].map(t => (
            <span key={t} style={{
              fontSize: '0.78rem', fontWeight: 600, padding: '5px 12px',
              borderRadius: 20, background: 'rgba(255,255,255,0.1)',
              color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)',
            }}>{t}</span>
          ))}
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(228,0,43,0.2)', color: '#ffaaaa', fontSize: '0.82rem' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleEnable}
          disabled={loading || done}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: loading || done ? 'default' : 'pointer',
            background: done ? 'rgba(255,255,255,0.2)' : '#ffffff',
            color: done ? '#ffffff' : '#26445F',
            fontWeight: 800, fontSize: '1rem',
            marginBottom: 12, transition: 'all 0.3s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {done ? (
            <>✓ Notifications Enabled</>
          ) : loading ? (
            <>
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid rgba(38,68,95,0.3)',
                borderTopColor: '#26445F',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }} />
              Setting up…
            </>
          ) : (
            <>🔔 Enable Notifications</>
          )}
        </button>

        {!loading && !done && (
          <button
            onClick={handleDismiss}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem',
              padding: '6px 12px',
            }}
          >
            Not now
          </button>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}

// ─── Inline banner for profile / predictions pages ──────────
export function NotificationBanner() {
  const [state, setState] = useState('idle'); // idle | loading | done | subscribed | denied | unsupported
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isPushSupported()) { setState('unsupported'); return; }
    if (getPermissionState() === 'denied') { setState('denied'); return; }
    if (isSubscribed()) { setState('subscribed'); return; }
    setState('idle');
  }, []);

  if (!mounted || state === 'unsupported' || state === 'subscribed') return null;

  const handleEnable = async () => {
    setState('loading');
    try {
      await enablePushNotifications();
    } catch (err) {
      if (getPermissionState() === 'denied') { setState('denied'); return; }
      // any other error — still show done and hide
    }
    setState('done');
    // Auto-hide banner after brief success flash
    setTimeout(() => setState('hidden'), 1500);
  };

  if (state === 'hidden') return null;

  if (state === 'denied') {
    return (
      <div style={bannerBase}>
        <span style={{ fontSize: '1.1rem' }}>🔕</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffaaaa' }}>Notifications Blocked</div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>Allow notifications in your browser settings to get match reminders</div>
        </div>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div style={bannerBase}>
        <span style={{ fontSize: '1.1rem' }}>✅</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>Notifications Enabled!</div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>You'll get daily match reminders</div>
        </div>
      </div>
    );
  }

  // idle — not yet enabled
  return (
    <div style={bannerBase}>
      <span style={{ fontSize: '1.1rem' }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>Match Reminders</div>
        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>Get notified 4 hrs before matches you haven't predicted</div>
      </div>
      <button
        onClick={handleEnable}
        disabled={state === 'loading'}
        style={{
          padding: '8px 18px', borderRadius: 10, border: 'none', cursor: state === 'loading' ? 'default' : 'pointer',
          background: '#ffffff', color: '#26445F', fontWeight: 700, fontSize: '0.8rem',
          whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
          minWidth: 80, justifyContent: 'center',
        }}
      >
        {state === 'loading' ? (
          <>
            <span style={{
              width: 12, height: 12, borderRadius: '50%',
              border: '2px solid rgba(38,68,95,0.2)',
              borderTopColor: '#26445F',
              display: 'inline-block',
              animation: 'spin 0.7s linear infinite',
            }} />
          </>
        ) : 'Enable'}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

const bannerBase = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '14px 16px', borderRadius: 14, marginBottom: 20,
  background: '#26445F', border: '1px solid rgba(255,255,255,0.15)',
};
