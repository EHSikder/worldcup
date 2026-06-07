// frontend/src/lib/notifications.js

import api from '@/lib/api';

const STORAGE_KEY = 'wc2026_push_dismissed';
const SUBSCRIBED_KEY = 'wc2026_push_subscribed';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermissionState() {
  if (typeof window === 'undefined') return 'default';
  return Notification.permission;
}

export function isSubscribed() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SUBSCRIBED_KEY) === 'true';
}

export function hasDismissed() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function markDismissed() {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, 'true');
}

export async function enablePushNotifications() {
  if (!isPushSupported()) throw new Error('Push not supported in this browser');

  // Step 1: Register SW
  await navigator.serviceWorker.register('/sw.js');

  // Step 2: Wait for the SW to be fully ready — use navigator.serviceWorker.ready
  // which resolves with the ACTIVE registration (not the installing one)
  const readyRegistration = await navigator.serviceWorker.ready;

  // Step 3: Ask for permission (shows Chrome's native popup)
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission denied');

  // Step 4: Check VAPID key is set
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set in Vercel environment variables');
  }

  // Step 5: Subscribe using the READY registration (not the one from .register())
  let subscription;
  try {
    subscription = await readyRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  } catch (err) {
    throw new Error('Failed to create push subscription: ' + err.message);
  }

  // Step 6: Send to backend
  await api.post('/api/notifications/subscribe', {
    subscription: subscription.toJSON(),
  });

  localStorage.setItem(SUBSCRIBED_KEY, 'true');
  localStorage.removeItem(STORAGE_KEY);
  return true;
}

export async function disablePushNotifications() {
  if (!isPushSupported()) return;
  try {
    const readyRegistration = await navigator.serviceWorker.ready;
    const sub = await readyRegistration.pushManager.getSubscription();
    if (sub) {
      await api.post('/api/notifications/unsubscribe', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch { /* ignore */ }
  localStorage.removeItem(SUBSCRIBED_KEY);
}

export async function registerServiceWorker() {
  if (!isPushSupported()) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch { /* ignore */ }
}
