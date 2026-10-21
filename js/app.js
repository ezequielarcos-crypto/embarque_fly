// Arranque de la aplicación: rutas, instalación y recepción de archivos.

import { importFiles } from './cards.js';
import { releaseUrls, toast, pickFiles } from './ui.js';
import { renderHome } from './views/home.js';
import { renderList } from './views/list.js';
import { renderDetail } from './views/detail.js';
import { renderAdd } from './views/add.js';
import { renderSettings } from './views/settings.js';

const VERSION = '1.0.0';
const SHARED_CACHE = 'embarque-shared';
const view = document.getElementById('view');
let installEvent = null;
let controller;

const ctx = {
  version: VERSION,
  pendingResults: null,
  get signal() { return controller.signal; },
  refresh: () => route(),
  loadDemo,
  browse,
  importFiles: doImport,
  install,
  canInstall: () => Boolean(installEvent),
  isStandalone: () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  getTheme,
  setTheme,
};

const ROUTES = [
  [/^\/?$/, (p) => renderHome(view, ctx, p), 'inicio'],
  [/^\/tarjetas$/, (p) => renderList(view, ctx, p), 'tarjetas'],
  [/^\/tarjeta\/(.+)$/, (p, id) => renderDetail(view, ctx, p, decodeURIComponent(id)), 'tarjetas'],
  [/^\/nueva$/, (p) => renderAdd(view, ctx, p), 'nueva'],
  [/^\/ajustes$/, (p) => renderSettings(view, ctx, p), 'ajustes'],
];

let lastPath = null;
async function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = hash.split('?');
  const params = new URLSearchParams(query);
  const match = ROUTES.map(([re, fn, tab]) => [path.match(re), fn, tab]).find(([m]) => m);
  const [m, fn, tab] = match || [null, (p) => renderHome(view, ctx, p), 'inicio'];

  controller?.abort();
  controller = new AbortController();
  releaseUrls();
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const samePage = lastPath === path;
  lastPath = path;
  view.setAttribute('aria-busy', 'true');
  try {
    await fn(params, ...(m ? m.slice(1) : []));
  } catch (e) {
    console.error(e);
    view.innerHTML = '<div class="empty"><h2>Algo ha fallado</h2><p>No se pudo cargar esta pantalla. Vuelve a intentarlo.</p><a class="btn btn--primary" href="#/">Ir al inicio</a></div>';
  }
  view.removeAttribute('aria-busy');
  if (!samePage) {
    window.scrollTo(0, 0);
    view.classList.remove('enter');
    void view.offsetWidth;
    view.classList.add('enter');
  }
}

async function doImport(files, { quiet = false } = {}) {
  const r = await importFiles(files);
  const ok = r.added.length + r.updated.length;
  if (!quiet || (ok && !r.errors.length)) {
    if (ok === 1 && !r.errors.length) {
      const c = r.added[0] || r.updated[0];
      toast(r.added.length ? 'Tarjeta añadida' : 'Tarjeta actualizada', {
        tone: 'ok',
        action: 'Ver',
        onAction: () => { location.hash = `#/tarjeta/${encodeURIComponent(c.id)}`; },
      });
    } else if (ok) {
      toast(`${ok} tarjetas importadas${r.errors.length ? `, ${r.errors.length} con errores` : ''}`, { tone: 'ok' });
    } else if (r.errors.length && !quiet) {
      toast(r.errors[0].message, { tone: 'bad' });
    }
  }
  return r;
}

// Abre el selector de archivos del sistema (en Android, el explorador de la memoria).
async function browse() {
  const files = await pickFiles();
  if (!files.length) return;
  ctx.pendingResults = await doImport(files, { quiet: true });
  if (location.hash === '#/nueva') route();
  else location.hash = '#/nueva';
}

async function loadDemo() {
  const names = ['ejemplos/altamar-mad-lim.pkpass', 'ejemplos/nimbo-bcn-ory.pkpass', 'ejemplos/altamar-lim-cuz.pkpass'];
  try {
    const files = await Promise.all(names.map(async (n) => {
      const res = await fetch(n);
      if (!res.ok) throw new Error(n);
      return new File([await res.blob()], n.split('/').pop(), { type: 'application/vnd.apple.pkpass' });
    }));
    await doImport(files);
    route();
  } catch {
    toast('No se pudieron cargar los ejemplos. Comprueba la conexión.', { tone: 'bad' });
  }
}

// Archivos compartidos desde otra app de Android (Web Share Target).
async function consumeShared() {
  const url = new URL(location.href);
  if (!url.searchParams.has('compartido')) return;
  url.searchParams.delete('compartido');
  history.replaceState(null, '', `${url.pathname}${url.search}#/nueva`);
  if (!('caches' in window)) return;
  const cache = await caches.open(SHARED_CACHE);
  const files = [];
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    const name = decodeURIComponent(res.headers.get('x-file-name') || 'tarjeta.pkpass');
    files.push(new File([await res.blob()], name, { type: res.headers.get('content-type') || '' }));
    await cache.delete(req);
  }
  if (files.length) {
    ctx.pendingResults = await doImport(files, { quiet: true });
  }
}

// Archivos abiertos con la app (File Handling API, Chrome de escritorio y ChromeOS).
function setupLaunchQueue() {
  if (!('launchQueue' in window)) return;
  window.launchQueue.setConsumer(async (params) => {
    if (!params.files?.length) return;
    const files = await Promise.all(params.files.map((h) => h.getFile()));
    ctx.pendingResults = await doImport(files, { quiet: true });
    if (location.hash === '#/nueva') route();
    else location.hash = '#/nueva';
  });
}

function setupInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    document.body.classList.add('can-install');
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    document.body.classList.remove('can-install');
    toast('¡Embarque instalada!', { tone: 'ok' });
  });
  document.querySelectorAll('[data-install]').forEach((b) => b.addEventListener('click', install));
}

async function install() {
  if (!installEvent) {
    toast('Abre el menú del navegador y pulsa «Instalar aplicación».');
    return;
  }
  installEvent.prompt();
  await installEvent.userChoice.catch(() => null);
  installEvent = null;
  document.body.classList.remove('can-install');
}

function getTheme() {
  try { return localStorage.getItem('embarque-tema') || 'auto'; } catch { return 'auto'; }
}

function setTheme(t) {
  try { localStorage.setItem('embarque-tema', t); } catch { /* sin almacenamiento */ }
  applyTheme(t);
}

function applyTheme(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#0e0f11' : '#efece4');
}

function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Hay una nueva versión disponible', {
            action: 'Actualizar',
            duration: 0,
            onAction: () => sw.postMessage('skipWaiting'),
          });
        }
      });
    });
  }).catch((e) => console.warn('Service worker no registrado', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

// Arrastrar archivos sobre cualquier pantalla también los importa.
function setupGlobalDrop() {
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    if (e.target.closest?.('[data-drop]')) return;
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) { await doImport(files); route(); }
  });
}

// La cuenta atrás del próximo vuelo se refresca cada minuto.
setInterval(async () => {
  const el = document.querySelector('[data-countdown]');
  if (!el) return;
  const { countdown } = await import('./format.js');
  el.textContent = countdown(Number(el.dataset.countdown));
}, 60_000);

applyTheme(getTheme());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getTheme()));
setupInstall();
setupServiceWorker();
setupLaunchQueue();
setupGlobalDrop();
window.addEventListener('hashchange', route);
await consumeShared().catch((e) => console.error(e));
route();
