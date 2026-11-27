
const CACHE_NAME = "kotoba-v2";
const CACHE_PREFIX = "kotoba-";
const BASE = new URL(self.registration.scope);

const APP_FILES = [
  "index.html",
  "style.css",
  "design.css",
  "script.js",
  "install.js",
  "works.json",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

const APP_PATHS = new Set(
  APP_FILES.map(file => new URL(file, BASE).pathname)
);

function cacheKey(url) {
  const key = new URL(url);

  key.search = "";
  key.hash = "";

  if (key.pathname === BASE.pathname) {
    return new URL("index.html", BASE).href;
  }

  return key.href;
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {

    const cache = await caches.open(CACHE_NAME);

    await cache.addAll(APP_FILES.map(file =>
      new Request(new URL(file, BASE), {
        cache: "reload"
      })
    ));

    await self.skipWaiting();

  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {

    const keys = await caches.keys();

    await Promise.all(
      keys.filter(key =>
        key.startsWith(CACHE_PREFIX) &&
        key !== CACHE_NAME
      ).map(key => caches.delete(key))
    );

    await self.clients.claim();

  })());
});

self.addEventListener("fetch", event => {

  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" ||
      url.origin !== BASE.origin ||
      (url.pathname !== BASE.pathname &&
       !APP_PATHS.has(url.pathname))) {
    return;
  }

  event.respondWith((async () => {

    const cache = await caches.open(CACHE_NAME);
    const key = cacheKey(url);

    try {

      const response = await fetch(request, {
        cache: "no-store"
      });

      if (response.ok) {

        try {
          await cache.put(key, response.clone());
        } catch (error) {
          console.warn("キャッシュ保存失敗", error);
        }

        return response;
      }

      if (response.status < 500) {
        return response;
      }

      return (await cache.match(key)) || response;

    } catch (error) {

      const saved = await cache.match(key);

      if (saved) return saved;

      return new Response(
        "インターネットに接続して、もう一度お試しください。",
        {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=UTF-8"
          }
        }
      );

    }

  })());
});
