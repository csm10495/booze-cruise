const CACHE_NAME = 'cruise-drink-tracker-v1';
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
  '/booze-cruise/lib/chart.min.js',
  '/booze-cruise/favicon.ico',
  '/booze-cruise/icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // IMPORTANT: Clone the request. A request is a stream and
        // can only be consumed once. We must clone it so that we can
        // consume the stream twice: one for the cache and one for the
        // network.
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and can only be consumed once. We must clone it so that
            // we can consume the stream twice.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(() => {
          // If network request fails, try to serve from cache
          return caches.match('/index.html'); // Fallback to index.html
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});