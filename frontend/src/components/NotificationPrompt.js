// frontend/src/components/NotificationPrompt.js
// ─────────────────────────────────────────────────────────────
//  Modal that appears after signup asking to enable push alerts.
//  Also exports <NotificationBanner> used on profile + predictions pages.
// ─────────────────────────────────────────────────────────────
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
  const [error, setError] = useState('');

  useEffect(() => {
    // Show only if: supported, not already granted/subscribed, not dismissed
    if (
      isPushSupported() &&
      getPermissionState() === 'default' &&
      !isSubscribed() &&
      !hasDismissed()
    ) {
      // Small delay so the page has settled
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
      setVisible(false);
      onDone?.();
    } catch (err) {
      setError(err.message || 'Could not enable notifications');
    } finally {
      setLoading(false);
    }
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
        background: 'var(--color-surface, #1a2e00)',
        borderRadius: 24,
        padding: '36px 32px',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        border: '1px solid rgba(169,223,0,0.2)',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* Bell icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
          background: 'rgba(169,223,0,0.12)',
          border: '2px solid rgba(169,223,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#A9DF00" strokeWidth="1.8" width="34" height="34">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 10, color: 'var(--color-text-primary, #fff)' }}>
          Never Miss a Match
        </h2>
        <p style={{ color: 'var(--color-text-muted, #9ca3af)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 24 }}>
          Get a single daily reminder before any match you haven't predicted yet — sent 4 hours before the first kick-off of the day.
        </p>

        {/* Match preview pills */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
          {['⚽ Match reminders', '🔔 One alert per day', '🎯 Unpredicted only'].map(t => (
            <span key={t} style={{
              fontSize: '0.78rem', fontWeight: 600, padding: '5px 12px',
              borderRadius: 20, background: 'rgba(169,223,0,0.1)',
              color: '#A9DF00', border: '1px solid rgba(169,223,0,0.25)',
            }}>{t}</span>
          ))}
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(228,0,43,0.1)', color: '#ff6b6b', fontSize: '0.82rem' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleEnable}
          disabled={loading}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: loading ? 'rgba(169,223,0,0.4)' : '#A9DF00',
            color: '#1a2e00', fontWeight: 800, fontSize: '1rem',
            marginBottom: 12, transition: 'all 0.2s ease',
            boxShadow: loading ? 'none' : '0 4px 16px rgba(169,223,0,0.35)',
          }}
        >
          {loading ? 'Setting up…' : '🔔 Enable Notifications'}
        </button>

        <button
          onClick={handleDismiss}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted, #9ca3af)', fontSize: '0.85rem',
            padding: '6px 12px',
          }}
        >
          Not now
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}

// ─── Inline banner for profile / predictions pages ──────────
export function NotificationBanner() {
  const [state, setState] = useState('idle'); // idle | loading | subscribed | denied | unsupported
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isPushSupported()) { setState('unsupported'); return; }
    if (getPermissionState() === 'denied') { setState('denied'); return; }
    if (isSubscribed()) { setState('subscribed'); return; }
    setState('idle');
  }, []);

  if (!mounted || state === 'unsupported') return null;

  const handleEnable = async () => {
    setState('loading');
    try {
      await enablePushNotifications();
      setState('subscribed');
    } catch (err) {
      if (getPermissionState() === 'denied') setState('denied');
      else setState('idle');
    }
  };

  const handleDisable = async () => {
    setState('loading');
    await disablePushNotifications();
    setState('idle');
  };

  if (state === 'subscribed') {
    return (
      <div style={bannerBase('#1a2e00', 'rgba(169,223,0,0.25)')}>
        <span style={{ fontSize: '1.1rem' }}>🔔</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#A9DF00' }}>Notifications On</div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>You'll get daily match reminders</div>
        </div>
        <button onClick={handleDisable} disabled={state === 'loading'} style={ghostBtn}>Turn off</button>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div style={bannerBase('#2a1a1a', 'rgba(228,0,43,0.2)')}>
        <span style={{ fontSize: '1.1rem' }}>🔕</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ff6b6b' }}>Notifications Blocked</div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Allow notifications in your browser settings to get match reminders</div>
        </div>
      </div>
    );
  }

  // idle — not yet enabled
  return (
    <div style={bannerBase('#12200a', 'rgba(169,223,0,0.15)')}>
      <span style={{ fontSize: '1.1rem' }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#e5e7eb' }}>Match Reminders</div>
        <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Get notified 4 hrs before matches you haven't predicted</div>
      </div>
      <button
        onClick={handleEnable}
        disabled={state === 'loading'}
        style={{
          padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: '#A9DF00', color: '#1a2e00', fontWeight: 700, fontSize: '0.8rem',
          opacity: state === 'loading' ? 0.6 : 1, whiteSpace: 'nowrap',
        }}
      >
        {state === 'loading' ? 'Setting up…' : 'Enable'}
      </button>
    </div>
  );
}

const bannerBase = (bg, border) => ({
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '14px 16px', borderRadius: 14, marginBottom: 20,
  background: bg, border: `1px solid ${border}`,
});

const ghostBtn = {
  background: 'none', border: '1px solid #374151', color: '#9ca3af',
  padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
  fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap',
};
