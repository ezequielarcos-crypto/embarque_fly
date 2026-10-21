// Service worker: funcionamiento sin conexión y recepción de archivos compartidos.

const VERSION = 'embarque-v1.0.0';
const SHARED_CACHE = 'embarque-shared';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/barcode.js',
  'js/cards.js',
  'js/db.js',
  'js/format.js',
  'js/pkpass.js',
  'js/render-pass.js',
  'js/ui.js',
  'js/zip.js',
  'js/views/add.js',
  'js/views/detail.js',
  'js/views/home.js',
  'js/views/list.js',
  'js/views/settings.js',
  'js/views/ticket.js',
  'vendor/bwip-js.min.js',
  'fonts/archivo-latin-wdth.woff2',
  'fonts/archivo-latin-ext-wdth.woff2',
  'fonts/jetbrains-mono-latin-400-normal.woff2',
  'fonts/jetbrains-mono-latin-600-normal.woff2',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== VERSION && key !== SHARED_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // Web Share Target: Android envía aquí los .pkpass compartidos desde otras apps.
  if (event.request.method === 'POST' && url.pathname.endsWith('/compartir')) {
    event.respondWith(receiveShare(event.request));
    return;
  }
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('index.html', copy));
          return res;
        })
        .catch(async () => (await caches.match('index.html')) || Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request).then((res) => {
      if (res.ok && url.pathname.includes('/ejemplos/')) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(event.request, copy));
      }
      return res;
    })),
  );
});

async function receiveShare(request) {
  const scope = self.registration.scope;
  try {
    const form = await request.formData();
    const files = form.getAll('pass').filter((f) => f && typeof f !== 'string');
    const cache = await caches.open(SHARED_CACHE);
    let i = 0;
    for (const file of files) {
      await cache.put(new Request(`${scope}__compartido/${Date.now()}-${i++}`), new Response(file, {
        headers: {
          'content-type': file.type || 'application/octet-stream',
          'x-file-name': encodeURIComponent(file.name || 'tarjeta.pkpass'),
        },
      }));
    }
  } catch (e) {
    console.error('Error al recibir archivos compartidos', e);
  }
  return Response.redirect(`${scope}?compartido=1#/nueva`, 303);
}
