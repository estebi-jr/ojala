// Ojalá · punto de entrada
import { CONFIG } from './config.js';
import { keychain, prefs, visited } from './store/index.js';
import { closeAllSheets, installImageHandlers } from './ui.js';
import { parseHash, go, trackHistory } from './router.js'; /* iOS-pass · Bloque C: trackHistory */
import { LandingView } from './views/landing.js';
import { HomeView } from './views/home.js';
import { CreateView } from './views/create.js';
import { ListView } from './views/list.js';
import { SettingsView, AdminImportView, AddFromShareView, applyThemePref } from './views/settings.js';

const app = document.getElementById('app');
let current = null;
let lastPath = null;

// Rutas (todas con #/ para que funcionen en GitHub Pages)
const routes = [
  [/^\/$/, () => (keychain.list().length || visited.list().length ? HomeView() : LandingView())],
  [/^\/inicio$/, () => LandingView()],
  [/^\/nueva(?:\/([a-z]+))?$/, (m) => CreateView({ occasion: m[1] })],
  [/^\/ejemplo$/, (m, query) => ListView({ slug: 'ejemplo', example: true, query })],
  [/^\/l\/([a-z0-9]+)\/invitado$/, (m, query) => ListView({ slug: m[1], preview: true, query })],
  [/^\/l\/([a-z0-9]+)$/, (m, query) => ListView({ slug: m[1], query })],
  [/^\/admin\/([a-z0-9]+)\/([A-Za-z0-9_-]+)$/, (m) => AdminImportView({ slug: m[1], token: m[2] })],
  [/^\/agregar$/, (m, query) => AddFromShareView({ query })],
  [/^\/ajustes$/, () => SettingsView()],
];

async function render() {
  trackHistory(); /* iOS-pass · Bloque C */
  const { path, query } = parseHash();
  const match = routes.find(([re]) => re.test(path));
  if (!match) { go('/', { replace: true }); return; }
  const [re, factory] = match;
  if (path !== lastPath) closeAllSheets(); // volver con el gesto de iOS no deja hojas huérfanas
  lastPath = path;
  try { current?.destroy?.(); } catch { /* nada */ }
  document.title = `${CONFIG.brand} · Tu lista de deseos`;
  const view = factory(path.match(re), query);
  current = view;
  // Cada pantalla tiene su propio contenedor: al salir, sus listeners desaparecen con él
  const host = document.createElement('div');
  host.className = 'view';
  host.innerHTML = view.html || '';
  app.replaceChildren(host);
  window.scrollTo(0, 0);
  await view.mount?.(host);
  onScroll();
}

// Barra superior: se vuelve "vidrio" al hacer scroll
function onScroll() {
  const bar = document.getElementById('topbar');
  if (!bar) return;
  const at = Number(bar.dataset.solidAt || 8);
  bar.classList.toggle('is-solid', window.scrollY > at);
}

function boot() {
  applyThemePref();
  installImageHandlers();
  window.addEventListener('hashchange', render);
  window.addEventListener('scroll', onScroll, { passive: true });

  // Compartir desde otra app (Android, PWA instalada): ?url=…&text=…
  const params = new URLSearchParams(location.search);
  const shared = params.get('url') || params.get('text');
  if (shared) {
    try { history.replaceState(null, '', location.pathname); } catch { /* nada */ }
    go(`/agregar?url=${encodeURIComponent(shared)}`, { replace: true });
    return;
  }
  render();
}

boot();

// Para depurar desde la consola del navegador
window.ojala = { prefs, keychain, CONFIG };
