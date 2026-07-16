/* SupplierAdvisor service worker — offline shell + static cache
 * Version bump CACHE when deploying shell changes.
 */
const CACHE = 'sa-shell-v2';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  OFFLINE_URL,
  '/sa-logo.png',
  '/sa-icon-192.png',
  '/sa-icon-512.png',
  '/apple-icon.png',
  '/favicon.ico',
  '/?source=pwa',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Cache each asset individually so one failure does not block install
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res.ok) await cache.put(url, res);
          } catch {
            /* ignore single asset failure */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

/**
 * Fetch handler required for installability.
 * Navigations: network first → offline page.
 * Static assets: cache then network.
 * API / auth: network only.
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/data/') ||
    url.pathname === '/sw.js'
  ) {
    return;
  }

  // HTML navigations
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(CACHE);
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return (
            offline ||
            new Response('You are offline. Reconnect and try again.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
        }
      })()
    );
    return;
  }

  // Static assets
  if (
    url.pathname.startsWith('/_next/static/') ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js|webmanifest)$/i.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) {
          fetch(req)
            .then((res) => {
              if (res.ok) {
                caches.open(CACHE).then((c) => c.put(req, res)).catch(() => {});
              }
            })
            .catch(() => {});
          return cached;
        }
        try {
          const res = await fetch(req);
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        } catch {
          return new Response('', { status: 504 });
        }
      })()
    );
  }
});

/** Web Push */
self.addEventListener('push', (event) => {
  let data = {
    title: 'SupplierAdvisor',
    body: 'You have an update',
    url: '/dashboard',
    tag: 'sa-push',
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    try {
      const text = event.data && event.data.text();
      if (text) data.body = text;
    } catch {
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
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c && c.url.includes(self.location.origin)) {
          c.navigate(target);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
