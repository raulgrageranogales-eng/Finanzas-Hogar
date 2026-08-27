const CACHE_NAME = "finanzas-hogar-v1";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./manifest.json"
];


self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => {

                return cache.addAll(
                    FILES_TO_CACHE
                );

            })

    );

});


self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys().then(keys => {

            return Promise.all(

                keys
                    .filter(key =>
                        key !== CACHE_NAME
                    )
                    .map(key =>
                        caches.delete(key)
                    )

            );

        })

    );

});


self.addEventListener("fetch", event => {

    event.respondWith(

        caches.match(event.request)
            .then(cached => {

                return cached ||
                    fetch(event.request);

            })

    );

});
