/* The build replaces the two placeholders; do not register this source file. */
const CACHE = 'tetris-pocket-__VERSION__'
const BASE = new URL('./', self.location.href)
const PRECACHE = __PRECACHE__.map(path => new URL(path, BASE).href)
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
