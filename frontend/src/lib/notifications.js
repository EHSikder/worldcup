// frontend/src/lib/notifications.js
// ─────────────────────────────────────────────────────────────
//  Push notification helpers — permission, subscription, storage
// ─────────────────────────────────────────────────────────────

import api from '@/lib/api';

const STORAGE_KEY = 'wc2026_push_dismissed';
const SUBSCRIBED_KEY = 'wc2026_push_subscribed';

// VAPID public key — set NEXT_PUBLIC_VAPID_PUBLIC_KEY in your .env.local
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

/** True if the browser supports push notifications */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Current browser permission state: 'default' | 'granted' | 'denied' */
export function getPermissionState() {
  if (typeof window === 'undefined') return 'default';
  return Notification.permission;
}

/** Has the user actively subscribed (our own flag) */
export function isSubscribed() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SUBSCRIBED_KEY) === 'true';
}

/** Has the user already dismissed the prompt without enabling */
export function hasDismissed() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function markDismissed() {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, 'true');
}

/** Register SW and request push permission, then send subscription to server */
export async function enablePushNotifications() {
  if (!isPushSupported()) throw new Error('Push not supported in this browser');
  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID_PUBLIC_KEY not configured');

  // Register service worker
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission denied');

  // Subscribe
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Send subscription to backend
  await api.post('/api/notifications/subscribe', {
    subscription: subscription.toJSON(),
  });

  localStorage.setItem(SUBSCRIBED_KEY, 'true');
  localStorage.removeItem(STORAGE_KEY); // clear any dismiss flag
  return true;
}

/** Unsubscribe from push */
export async function disablePushNotifications() {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (registration) {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await api.post('/api/notifications/unsubscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
    }
  } catch { /* ignore */ }
  localStorage.removeItem(SUBSCRIBED_KEY);
}

/** Register the SW silently (needed on every page load so SW stays active) */
export async function registerServiceWorker() {
  if (!isPushSupported()) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch { /* ignore */ }
}
