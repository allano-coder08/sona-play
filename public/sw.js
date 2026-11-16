/* Sona Play service worker: lets the app install and open fast.
   Network first, so you always get the newest files when online. */
const CACHE = "sona-play-v1";
const SHELL = ["/", "/index.html", "/style.css", "/script.js", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  // Only handle our own files. Leave YouTube, Google APIs, Supabase and analytics alone.
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/_vercel")) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match("/index.html")))
  );
});
