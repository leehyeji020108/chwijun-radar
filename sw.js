/* 취준 Radar service worker
 * - HTML(navigation): network-first → 오프라인이면 캐시
 * - 정적 자원: stale-while-revalidate
 * - 교차 출처(Supabase 등): 통과
 */
const VERSION = 'radar-v8.1.25';
const SHELL = [
  './', './index.html', './styles.css?v=8.1.25', './data.js?v=8.1.25', './app.js?v=8.1.25',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-192.png', './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // 하나라도 받지 못하면 새 worker 설치를 실패시켜 기존의 완전한 캐시를 유지한다.
    await c.addAll(SHELL.map(u => new Request(u, { cache:'reload' })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(VERSION);
        c.put('./index.html', fresh.clone());
        return fresh;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then(res => {
      if (res && res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
