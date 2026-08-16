// This app is served from a subpath of an origin that hosts several other
// PWAs (e.g. https://csm10495.github.io/<app>/). CacheStorage is shared by the
// whole origin, so every cache this worker owns is namespaced by the subpath
// it is served from, and the worker only ever reads or deletes caches it owns.
// Touching another app's cache would silently break that app's offline mode.
const APP_SCOPE_URL = new URL('./', self.location);
const APP_SCOPE_KEY = APP_SCOPE_URL.pathname.replace(/^\/+|\/+$/g, '').replace(/\//g, '-') || 'root';
const CACHE_PREFIX = `${APP_SCOPE_KEY}-app-`;
const CACHE_NAME = `${CACHE_PREFIX}v20`;
// Caches created before app caches were namespaced by subpath. They belong to
// this app, so they're still reused on install and cleaned up on activate.
const LEGACY_CACHE_PREFIX = 'cruise-drink-tracker-';
// Deliberately not renamed/versioned: this holds the user's ~40 MB Vosk
// download and the name is shared with js/utils/voice-engine.js.
const VOICE_CACHE_NAME = 'cruise-voice-v1';
const SW_VERSION = CACHE_NAME;
console.log(`[ServiceWorker] script loaded: ${SW_VERSION}`);
// Used only when a requested URL isn't already cached. Cached assets are
// served immediately (stale-while-revalidate) so the network is never on
// the critical path for known files.
const NETWORK_TIMEOUT_MS = 2500;
// Resolved against the app's own subpath so the worker keeps working if the
// app is ever hosted under a different path.
const scopedUrl = (path) => new URL(path, APP_SCOPE_URL).toString();
const urlsToCache = [
  '',
  'index.html',
  'manifest.json',
  'css/main.css',
  'css/themes.css',
  'css/components.css',
  'js/app.js',
  'js/storage.js',
  'js/utils/app-storage.js',
  'js/components/navigation.js',
  'js/components/add-drink.js',
  'js/components/analytics.js',
  'js/components/settings.js',
  'js/utils/photo.js',
  'js/utils/themes.js',
  'js/utils/cruise-highlights-exporter.js',
  'js/utils/voice-parser.js',
  'js/utils/voice-engine.js',
  'js/utils/voice-ui.js',
  'lib/chart.min.js',
  'favicon.ico',
  'icon.png',
  'gravatar.png'
].map(scopedUrl);

// A cache belongs to this app only if it is namespaced with this app's
// subpath (or is one of the app's pre-namespacing caches).
function isOwnCache(cacheName) {
  return cacheName === VOICE_CACHE_NAME ||
    cacheName.startsWith(CACHE_PREFIX) ||
    cacheName.startsWith(LEGACY_CACHE_PREFIX);
}

// Caches owned by this app that aren't the current app cache or the voice
// cache — i.e. leftovers from an older version of this app.
async function getStaleOwnCacheNames() {
  const cacheNames = await caches.keys();
  return cacheNames.filter((name) =>
    isOwnCache(name) && name !== CACHE_NAME && name !== VOICE_CACHE_NAME);
}

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

  // Reuse responses from this app's previous caches so updates don't force a
  // re-download of every asset over a slow network, and so a cache rename
  // (e.g. when the subpath namespace was introduced) is lossless. Only this
  // app's caches are consulted — another app's cached copy of a same-named
  // path must never be served here.
  const oldCaches = await Promise.all(
    (await getStaleOwnCacheNames()).map((name) => caches.open(name))
  );

  for (const oldCache of oldCaches) {
    const requests = await oldCache.keys();
    await Promise.allSettled(requests.map(async (request) => {
      if (await cache.match(request)) return;
      const response = await oldCache.match(request);
      if (response) {
        await cache.put(request, response);
      }
    }));
  }

  // Use allSettled so a single slow/failed asset doesn't abort the whole
  // install. Anything that fails here will be populated lazily by the
  // fetch handler on first successful access.
  await Promise.allSettled(urlsToCache.map(async (url) => {
    if (await cache.match(url)) return;

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

// Look a request up in this app's caches only. `caches.match()` would search
// *every* cache on the origin, which means another app's cached copy of a
// same-path URL could be served here (and vice versa).
async function matchOwnCaches(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  // The voice cache is filled by the page (js/utils/voice-engine.js); check it
  // without creating it so offline voice assets still resolve here.
  if (await caches.has(VOICE_CACHE_NAME)) {
    const voiceCache = await caches.open(VOICE_CACHE_NAME);
    return voiceCache.match(request);
  }
  return undefined;
}

// Only responses for this app's own subpath belong in this app's cache.
function isOwnAsset(url) {
  return url.startsWith(APP_SCOPE_URL.toString());
}

function handleFetch(request) {
  return matchOwnCaches(request).then((cachedResponse) => {
    // Always kick off a network request in the background. If it succeeds
    // we refresh the cache for next time; we never block on it when we
    // already have a cached copy.
    const networkUpdate = fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic' &&
            isOwnAsset(request.url)) {
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
          matchOwnCaches(scopedUrl('index.html')).then((shell) => {
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
      // Only this app's own stale caches are dropped. Caches belonging to
      // other apps on this origin are left alone, and the dedicated voice
      // cache survives main-cache version bumps — the user's ~40 MB
      // downloaded model must not be deleted by a routine app update.
      getStaleOwnCacheNames().then((staleNames) =>
        Promise.all(staleNames.map((cacheName) => caches.delete(cacheName)))
      )
    ])
  );
});

// Allow pages to query the active SW version on demand (e.g., right after
// registration, when the page may have loaded before activate fired).
self.addEventListener('message', (event) => {
  // Reply helper that prefers a MessageChannel port (passed in
  // event.ports[0]) and falls back to the originating client.
  const reply = (msg) => {
    const port = event.ports && event.ports[0];
    if (port) {
      try { port.postMessage(msg); } catch (e) {}
    } else if (event.source) {
      try { event.source.postMessage(msg); } catch (e) {}
    }
  };

  if (event.data && event.data.type === 'GET_SW_VERSION') {
    reply({ type: 'SW_VERSION', version: SW_VERSION });
  } else if (event.data && event.data.type === 'CLEAR_APP_CACHE') {
    // Triggered by Settings → Update Now. Deletes this app's caches only —
    // never another app's on the same origin — and keeps the dedicated voice
    // cache so the user's ~40 MB Vosk download isn't discarded.
    event.waitUntil((async () => {
      try {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((n) => isOwnCache(n) && n !== VOICE_CACHE_NAME)
            .map((n) => caches.delete(n))
        );
        reply({ type: 'APP_CACHE_CLEARED' });
      } catch (e) {
        reply({ type: 'APP_CACHE_CLEARED', error: String(e) });
      }
    })());
  }
});
