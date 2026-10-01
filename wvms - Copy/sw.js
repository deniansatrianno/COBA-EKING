const CACHE = 'wvms-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
// Network-first: selalu ambil versi terbaru, pakai cache kalau offline
self.addEventListener('fetch', e => {
  // Permintaan ke backend (data & login) selalu langsung ke jaringan, tidak pernah dari cache.
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.includes('/backend/')) return;
  e.respondWith(
    fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request))
  );
});
