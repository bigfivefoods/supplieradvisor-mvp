/* SupplierAdvisor service worker — offline shell + static cache
 * Version bump CACHE when deploying major shell changes.
 */
const CACHE = 'sa-shell-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  OFFLINE_URL,
  '/sa-logo.png',
  '/sa-icon-192.png',
  '/sa-icon-512.png',
  '/manifest.webmanifest',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Navigations: network first, offline page on failure.
 * Static same-origin assets: stale-while-revalidate.
 * API / auth: network only (never cache).
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API, Next data, auth, or service worker itself
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/data/') ||
    url.pathname === '/sw.js' ||
    url.pathname.includes('privy')
  ) {
    return;
  }

  // HTML navigations
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok && res.type === 'basic') {
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  // Static assets (icons, fonts, built chunks that fail offline)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/i)
  ) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});

/** Web Push — show system notification */
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
