
const CACHE_NAME = "kotoba-v1";
const CACHE_PREFIX = "kotoba-";

const BASE = new URL(self.registration.scope);

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./design.css",
  "./script.js",
  "./works.json",
  "./manifest.json"
];

// 初回インストール
self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await cache.addAll(
        APP_FILES.map(path =>
          new Request(new URL(path, BASE), {
            cache: "reload"
          })
        )
      );

      await self.skipWaiting();
    })()
  );
});

// 古いキャッシュを削除
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith(CACHE_PREFIX) &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

// 通信処理
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // 外部サイトや対象外の通信には干渉しない
  if (
    request.method !== "GET" ||
    url.origin !== BASE.origin ||
    !url.pathname.startsWith(BASE.pathname)
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        // オンライン時は最新の情報を優先
        const response = await fetch(request, {
          cache: "no-store"
        });

        if (response.ok) {
          try {
            await cache.put(request, response.clone());
          } catch (error) {
            console.warn("キャッシュ保存失敗", error);
          }
        }

        return response;

      } catch (error) {
        // 通信できない場合は保存済みデータを利用
        const saved = await cache.match(request);

        if (saved) {
          return saved;
        }

        if (request.mode === "navigate") {
          const fallback = await cache.match(
            new URL("./index.html", BASE)
          );

          if (fallback) {
            return fallback;
          }
        }

        return new Response(
          "インターネットに接続してください。",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=UTF-8"
            }
          }
        );
      }
    })()
  );
});
