// ─────────────────────────────────────────────
//  WC2026 Service Worker — Push Notifications
// ─────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── Handle incoming push ──────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'WC2026', body: event.data.text() };
  }

  const { title = 'WC2026 Predictor', body = '', url = '/predictions', matches = [] } = payload;

  const options = {
    body,
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    tag: 'wc2026-match-reminder',           // replaces old notif with same tag
    renotify: true,
    requireInteraction: false,
    data: { url, matches },
    actions: [
      { action: 'predict', title: '⚽ Predict Now' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/predictions';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open new tab
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
