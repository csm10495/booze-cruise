const CACHE_NAME = 'cruise-drink-tracker-v10';
const VOICE_CACHE_NAME = 'cruise-voice-v1';
const SW_VERSION = CACHE_NAME;
console.log(`[ServiceWorker] script loaded: ${SW_VERSION}`);
// Used only when a requested URL isn't already cached. Cached assets are
// served immediately (stale-while-revalidate) so the network is never on
// the critical path for known files.
const NETWORK_TIMEOUT_MS = 2500;
const urlsToCache = [
  '/booze-cruise/',
  '/booze-cruise/index.html',
  '/booze-cruise/manifest.json',
  '/booze-cruise/css/main.css',
  '/booze-cruise/css/themes.css',
  '/booze-cruise/css/components.css',
  '/booze-cruise/js/app.js',
  '/booze-cruise/js/storage.js',
  '/booze-cruise/js/components/navigation.js',
  '/booze-cruise/js/components/add-drink.js',
  '/booze-cruise/js/components/analytics.js',
  '/booze-cruise/js/components/settings.js',
  '/booze-cruise/js/utils/photo.js',
  '/booze-cruise/js/utils/themes.js',
  '/booze-cruise/js/utils/cruise-highlights-exporter.js',
  '/booze-cruise/js/utils/voice-parser.js',
  '/booze-cruise/js/utils/voice-engine.js',
  '/booze-cruise/js/utils/voice-ui.js',
  '/booze-cruise/lib/chart.min.js',
  '/booze-cruise/favicon.ico',
  '/booze-cruise/icon.png',
  '/booze-cruise/gravatar.png'
];

self.addEventListener('install', (event) => {
  console.log(`[ServiceWorker] installing: ${SW_VERSION}`);
  // Activate the new SW as soon as it finishes installing, instead of
  // waiting for every tab/window to close. This is what makes the
  // cache-first behavior actually kick in for users on the next load
  // after deploying an update.
  self.skipWaiting();
  event.waitUntil(populateCache());
});

async function populateCache() {
  const cache = await caches.open(CACHE_NAME);

  // Reuse responses from any previous service worker cache so updates
  // don't force a re-download of every asset over a slow network. This
  // makes SW updates near-instant for returning users.
  const existingCacheNames = await caches.keys();
  const oldCaches = await Promise.all(
    existingCacheNames
      .filter((name) => name !== CACHE_NAME)
      .map((name) => caches.open(name))
  );

  // Use allSettled so a single slow/failed asset doesn't abort the whole
  // install. Anything that fails here will be populated lazily by the
  // fetch handler on first successful access.
  await Promise.allSettled(urlsToCache.map(async (url) => {
    if (await cache.match(url)) return;

    for (const oldCache of oldCaches) {
      const reused = await oldCache.match(url);
      if (reused) {
        await cache.put(url, reused.clone());
        return;
      }
    }

    try {
      const response = await fetch(url);
      if (response && response.ok) {
        await cache.put(url, response);
      }
    } catch (e) {
      // Tolerated — fetch handler will retry on demand.
    }
  }));
}

self.addEventListener('fetch', (event) => {
  event.respondWith(handleFetch(event.request));
});

function handleFetch(request) {
  return caches.match(request).then((cachedResponse) => {
    // Always kick off a network request in the background. If it succeeds
    // we refresh the cache for next time; we never block on it when we
    // already have a cached copy.
    const networkUpdate = fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => null);

    if (cachedResponse) {
      // Stale-while-revalidate: serve the cached copy immediately. The
      // network update above keeps the cache fresh for the next load.
      // This is what makes loads near-instant on slow/flaky connections.
      return cachedResponse;
    }

    // No cached copy. Wait for the network, but enforce a timeout so a
    // stuck request doesn't hang the page. The index.html fallback is only
    // valid for top-level navigations — falling back to the HTML shell for
    // an arbitrary asset (e.g. a missing .txt or image) would corrupt the
    // caller (e.g. the app-version box ended up rendering a nested copy of
    // the app).
    const isNavigation = request.mode === 'navigate';

    return new Promise((resolve) => {
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const fallback = () => {
        if (isNavigation) {
          caches.match('/booze-cruise/index.html').then((shell) => {
            done(shell || new Response('', { status: 504, statusText: 'Gateway Timeout' }));
          });
        } else {
          done(new Response('', { status: 504, statusText: 'Gateway Timeout' }));
        }
      };

      const timeoutId = setTimeout(fallback, NETWORK_TIMEOUT_MS);

      networkUpdate.then((response) => {
        clearTimeout(timeoutId);
        if (response) {
          done(response);
        } else {
          fallback();
        }
      });
    });
  });
}

self.addEventListener('activate', (event) => {
  console.log(`[ServiceWorker] activating: ${SW_VERSION}`);
  // Whitelist the dedicated voice cache so it survives main-cache version
  // bumps — the user's ~40 MB downloaded model must not be deleted by a
  // routine app update.
  const cacheWhitelist = [CACHE_NAME, VOICE_CACHE_NAME];
  event.waitUntil(
    Promise.all([
      // Take control of any already-open pages immediately so they use the
      // new fetch handler (with timeout) without needing a hard reload.
      self.clients.claim().then(async () => {
        // Tell any pages we now control which version is active.
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
        }
      }),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Allow pages to query the active SW version on demand (e.g., right after
// registration, when the page may have loaded before activate fired).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_SW_VERSION') {
    event.source && event.source.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
  }
});
