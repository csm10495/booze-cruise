const CACHE_NAME = 'cruise-drink-tracker-v1';
const BASE_PATH = self.location.pathname.includes('/booze-cruise/') ? '/booze-cruise/' : '/';

const urlsToCache = [
  `${BASE_PATH}`,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}css/main.css`,
  `${BASE_PATH}css/themes.css`,
  `${BASE_PATH}css/components.css`,
  `${BASE_PATH}js/app.js`,
  `${BASE_PATH}js/storage.js`,
  `${BASE_PATH}js/components/navigation.js`,
  `${BASE_PATH}js/components/add-drink.js`,
  `${BASE_PATH}js/components/analytics.js`,
  `${BASE_PATH}js/components/settings.js`,
  `${BASE_PATH}js/utils/photo.js`,
  `${BASE_PATH}js/utils/themes.js`,
  `${BASE_PATH}lib/chart.min.js`,
  `${BASE_PATH}favicon.ico`,
  `${BASE_PATH}icon.png`
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