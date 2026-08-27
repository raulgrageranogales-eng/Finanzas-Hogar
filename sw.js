const CACHE_NAME = "finanzas-hogar-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./firebase-config.js",
  "./manifest.json"
];


/* =========================================================
   INSTALACIÓN
========================================================= */

self.addEventListener("install", event => {

  event.waitUntil(

    caches
      .open(CACHE_NAME)
      .then(cache =>
        cache.addAll(APP_FILES)
      )

  );

  self.skipWaiting();

});


/* =========================================================
   ACTIVACIÓN
========================================================= */

self.addEventListener("activate", event => {

  event.waitUntil(

    caches
      .keys()
      .then(keys =>

        Promise.all(

          keys
            .filter(
              key =>
                key !== CACHE_NAME
            )
            .map(
              key =>
                caches.delete(key)
            )

        )

      )

  );

  self.clients.claim();

});


/* =========================================================
   PETICIONES
========================================================= */

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


    /*
      Firebase y Google deben ir
      siempre contra Internet.
    */

    if (
      request.url.includes(
        "firebaseio.com"
      )
      ||
      request.url.includes(
        "googleapis.com"
      )
      ||
      request.url.includes(
        "gstatic.com"
      )
      ||
      request.url.includes(
        "google.com"
      )
    ) {

      return;

    }


    event.respondWith(

      caches
        .match(request)
        .then(cached => {

          if (cached) {

            return cached;

          }


          return fetch(request)
            .then(response => {

              if (
                !response
                ||
                response.status !== 200
              ) {

                return response;

              }


              const clone =
                response.clone();


              caches
                .open(CACHE_NAME)
                .then(cache => {

                  cache.put(
                    request,
                    clone
                  );

                });


              return response;

            })
            .catch(() =>
              caches.match(
                "./index.html"
              )
            );

        })

    );

  }
);
