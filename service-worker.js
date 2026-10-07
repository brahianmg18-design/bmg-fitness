const CACHE_NAME = "bmg-fitness-static-v1";
const APP_SHELL = [
    "/",
    "/index.html",
    "/style.css",
    "/routine_engine.js",
    "/nutrition_engine.js",
    "/app.js",
    "/manifest.webmanifest",
    "/icons/favicon.svg",
    "/icons/favicon.ico",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/apple-touch-icon.png"
];
const STATIC_LIBRARY_PATH = /^\/(?:nutrition|training)\/[a-z0-9._-]+\.json$/i;
const APP_SHELL_PATHS = new Set(APP_SHELL);

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith("bmg-fitness-static-") && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

function esRecursoEstatico(url, request) {
    return APP_SHELL_PATHS.has(url.pathname)
        || STATIC_LIBRARY_PATH.test(url.pathname)
        || (request.destination === "image" && url.pathname.startsWith("/icons/"));
}

async function guardarRecursoEstatico(request, response) {
    const cacheControl = response.headers.get("Cache-Control") || "";
    if (!response.ok || response.type !== "basic" || /(?:private|no-store)/i.test(cacheControl)) {
        return response;
    }

    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
    } catch (error) {
        console.warn("No se pudo guardar un recurso estático de BMG Fitness en caché:", error);
    }
    return response;
}

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin || /^\/api(?:\/|$)/i.test(url.pathname)) return;

    const esInicio = request.mode === "navigate" && ["/", "/index.html"].includes(url.pathname);
    if (!esInicio && !esRecursoEstatico(url, request)) return;

    event.respondWith(
        fetch(request)
            .then((response) => guardarRecursoEstatico(
                esInicio ? new Request("/index.html", { method: "GET" }) : request,
                response
            ))
            .catch(async (error) => {
                const recursoGuardado = await caches.match(
                    esInicio ? "/index.html" : request
                );
                if (recursoGuardado) return recursoGuardado;
                throw error;
            })
    );
});
