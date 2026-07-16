/**
 * SupplierAdvisor service worker — MINIMAL (installable + offline fallback only).
 *
 * IMPORTANT: Do NOT cache /_next/static/* or HTML app shells.
 * Caching hashed JS after deploy is a common cause of “site broken in Safari/Chrome”.
 *
 * v4 — network-only for app code; precache only offline page + icons.
 */
const CACHE = 'sa-offline-v4';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  OFFLINE_URL,
  '/add-to-home.html',
  '/sa-icon-192.png',
  '/sa-icon-512.png',
  '/apple-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await Promise.all(
          PRECACHE.map(async (url) => {
            try {
              const res = await fetch(url, { cache: 'no-store' });
              if (res && res.ok) await cache.put(url, res);
            } catch (_) {
              /* ignore */
            }
          })
        );
      } catch (_) {
        /* ignore */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Wipe ALL previous caches (v1–v3 may hold broken JS)
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      // Re-seed offline assets
      try {
        const cache = await caches.open(CACHE);
        await Promise.all(
          PRECACHE.map(async (url) => {
            try {
              const res = await fetch(url, { cache: 'no-store' });
              if (res && res.ok) await cache.put(url, res);
            } catch (_) {
              /* ignore */
            }
          })
        );
      } catch (_) {
        /* ignore */
      }
      await self.clients.claim();
    })()
  );
});

/**
 * Fetch handler required for installability.
 * - API / Next static / almost everything → network only (pass through)
 * - Document navigations offline → offline.html
 * - Never cache application JS/CSS
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Never intercept APIs, Next data, or the SW itself
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname === '/sw.js' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    return; // default network
  }

  // Only special-case full page navigations when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Always network first — never serve cached HTML for the app
          return await fetch(req);
        } catch (_) {
          const offline = await caches.match(OFFLINE_URL);
          return (
            offline ||
            new Response(
              '<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem"><h1>Offline</h1><p>Reconnect and reload.</p><p><a href="/add-to-home.html">Install help</a></p></body></html>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
          );
        }
      })()
    );
  }
  // All other requests: browser default (network)
});

/** Web Push display */
self.addEventListener('push', (event) => {
  let data = {
    title: 'SupplierAdvisor',
    body: 'You have an update',
    url: '/dashboard',
    tag: 'sa-push',
  };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (_) {
    try {
      if (event.data) data.body = event.data.text();
    } catch (_) {
      /* ignore */
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'SupplierAdvisor', {
      body: data.body || '',
      icon: '/sa-icon-192.png',
      badge: '/sa-icon-192.png',
      tag: data.tag || 'sa-push',
      data: { url: data.url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.url && c.url.indexOf(self.location.origin) === 0 && 'focus' in c) {
          if (c.navigate) c.navigate(target);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
