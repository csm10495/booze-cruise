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
  '/booze-cruise/icon.png',
  '/booze-cruise/gravatar.png'
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
    fetch(event.request)
      .then((response) => {
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
      })
      .catch(() => {
        // If network request fails, try to get it from the cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          // Fallback to index.html if the requested resource is not in cache
          return caches.match('/booze-cruise/index.html');
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