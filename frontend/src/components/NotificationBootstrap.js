// frontend/src/components/NotificationBootstrap.js
// ─────────────────────────────────────────────────────────────
//  Mounted in layout.js — registers the service worker on every
//  page load, and shows the post-signup prompt for new users.
// ─────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { registerServiceWorker, isPushSupported, isSubscribed } from '@/lib/notifications';
import NotificationPrompt from '@/components/NotificationPrompt';

export default function NotificationBootstrap() {
  const { isAuthenticated, user } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);

  // 1. Always register the SW so it stays active
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // 2. Show prompt if user just completed signup (flag set by complete-profile page)
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (!isPushSupported()) return;
    if (isSubscribed()) return;

    // complete-profile page sets this flag in sessionStorage after successful registration
    const isNewSignup = sessionStorage.getItem('wc2026_new_signup') === 'true';
    if (isNewSignup) {
      sessionStorage.removeItem('wc2026_new_signup');
      // Small delay to let the page render first
      const t = setTimeout(() => setShowPrompt(true), 1200);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated, user]);

  if (!showPrompt) return null;

  return <NotificationPrompt onDone={() => setShowPrompt(false)} />;
}
