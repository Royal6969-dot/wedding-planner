// F6: el tablero abre sin internet. Primero caché para archivos propios; la página pide red primero.
const CACHE = "coolplanners-v1";
const FILES = [
  "./", "index.html", "css/styles.css", "js/data.js", "js/app.js", "manifest.webmanifest", "assets/icon.svg",
  "assets/img/hero-hacienda.webp", "assets/img/cer-civil.webp", "assets/img/cer-religiosa.webp", "assets/img/cer-simbolica.webp",
  "assets/img/venue-garden.webp", "assets/img/food-plated.webp", "assets/img/photo-classic.webp", "assets/img/photo-video.webp",
  "assets/img/music-dj.webp", "assets/img/music-strings.webp", "assets/img/flowers-roses.webp", "assets/img/vibe-classic.webp",
  "assets/img/cat-iluminacion.webp", "assets/img/cat-maquillaje.webp", "assets/img/cake-classic.webp", "assets/img/extra-car.webp",
  "assets/img/cat-oficiante.webp"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put("index.html", copy));
      return res;
    }).catch(() => caches.match("index.html")));
    return;
  }
  if (url.origin !== location.origin && !url.hostname.endsWith("gstatic.com") && !url.hostname.endsWith("googleapis.com")) return;
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
