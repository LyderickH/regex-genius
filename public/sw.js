const CACHE_NAME = "regex-genius-v2.2";
const STATIC_ASSETS = [
  "./",
  "./manifest.json",
  "./icon.svg",
  "./favicon.ico",
];

// Install: Mise en cache préalable des ressources clés
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("PWA: Échec pré-mise en cache partielle", err);
      });
    }),
  );
  self.skipWaiting();
});

// Activate: Nettoyage des anciens caches et prise de contrôle immédiate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      );
    }).then(() => self.clients.claim()),
  );
});

// Fetch: Stratégie Cache First avec mise en cache dynamique (Offline-First)
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // On n'intercepte que les requêtes GET HTTP(S)
  if (req.method !== "GET" || !req.url.startsWith("http")) {
    return;
  }

  // Pour les requêtes de navigation (pages HTML)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            return cached || caches.match("./") || caches.match("./index.html");
          });
        }),
    );
    return;
  }

  // Pour tous les autres assets (JS, CSS, images, polices, datasets)
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      if (cachedRes) {
        // En arrière-plan, tenter de rafraîchir le cache si le réseau est dispo
        fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, networkRes));
            }
          })
          .catch(() => {
            // Mode hors-ligne : silencieux
          });
        return cachedRes;
      }

      // Si pas encore en cache, on va sur le réseau et on met en cache
      return fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => {
          // Si réseau inaccessible et asset absent, échec gracieux
          return new Response("Mode hors-ligne actif", {
            status: 503,
            statusText: "Service Unavailable Offline",
          });
        });
    }),
  );
});
