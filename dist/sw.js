/* The build replaces the two placeholders; do not register this source file. */
const CACHE = 'tetris-pocket-d84a3395ff4fa22f'
const BASE = new URL('./', self.location.href)
const PRECACHE = ["./assets/index-Bkinbxf1.js","./assets/index-DDW8Nav5.css","./favicon.svg","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/maskable-512.png","./icons/splash-1125x2436.png","./icons/splash-1170x2532.png","./icons/splash-1179x2556.png","./icons/splash-1206x2622.png","./icons/splash-1242x2208.png","./icons/splash-1242x2688.png","./icons/splash-1284x2778.png","./icons/splash-1290x2796.png","./icons/splash-1320x2868.png","./icons/splash-1536x2048.png","./icons/splash-1640x2360.png","./icons/splash-1668x2388.png","./icons/splash-2048x2732.png","./icons/splash-640x1136.png","./icons/splash-750x1334.png","./icons/splash-828x1792.png","./index.html","./manifest.webmanifest"].map(path => new URL(path, BASE).href)
const SHELL = new URL('./index.html', BASE).href

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)))
  // Updates wait for the previous app to close; a running game is never reloaded.
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('tetris-pocket-') && key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return
  // Never cache authentication pages, API responses or third-party requests.
  if (request.mode === 'navigate' && [BASE.pathname, `${BASE.pathname}index.html`].includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(SHELL)) || fetch(request)))
    return
  }
  if (!PRECACHE.includes(url.href)) return
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)))
})
