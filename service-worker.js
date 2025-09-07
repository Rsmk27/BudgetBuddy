const CACHE_NAME = 'budgetbuddy-cache-v1';
const CORE_ASSETS = [
    '/index.html',
    '/manifest.json'
];

// Include all external CDN files
const CDN_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

const OFFLINE_PAGE = '/index.html'; // Fallback to the main page

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => {
            console.log('Opened cache');
            return cache.addAll(CORE_ASSETS.concat(CDN_ASSETS));
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Check if the request is a navigation request (for the main page)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request)
                    .catch(() => {
                        return caches.match(OFFLINE_PAGE);
                    });
            })
        );
    } else {
        // For other requests (CSS, JS, images, etc.)
        event.respondWith(
            caches.match(event.request)
            .then((response) => {
                // If a match is found in the cache, return it
                if (response) {
                    return response;
                }
                // If not, fetch the asset from the network
                return fetch(event.request)
                    .then((fetchResponse) => {
                        // Check if we received a valid response
                        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
                            return fetchResponse;
                        }
                        // Clone the response so it can be put in the cache
                        const responseToCache = fetchResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        return fetchResponse;
                    })
                    .catch(() => {
                        // If fetching from the network fails, return a fallback
                        return caches.match(event.request);
                    });
            })
        );
    }
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
