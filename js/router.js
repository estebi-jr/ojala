// Navegación con "#/ruta": funciona en GitHub Pages sin configurar el servidor
export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, q = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(q) };
}

export function go(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (location.hash === target) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  if (replace) {
    try {
      history.replaceState(history.state, '', target);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    } catch { /* algunos entornos no permiten replaceState */ }
  }
  location.hash = path;
}

/** Cambia la URL sin volver a dibujar la pantalla (para limpiar ?parámetros). */
export function silentReplace(path) {
  try { history.replaceState(history.state, '', `#${path}`); } catch { /* nada */ }
}

/* iOS-pass · Bloque C: posición dentro del historial de Ojalá, para que "volver" nunca saque de la app */
let depth = 0;
let started = false;
let reliable = true;

export function trackHistory() {
  try {
    const s = history.state;
    if (s && typeof s === 'object' && Number.isInteger(s.ojalaDepth)) {
      depth = s.ojalaDepth;
    } else {
      depth = started ? depth + 1 : 0;
      history.replaceState({ ...(s && typeof s === 'object' ? s : {}), ojalaDepth: depth }, '');
    }
  } catch {
    reliable = false;
  } finally {
    started = true;
  }
}

/** Vuelve a la pantalla anterior de Ojalá; si se llegó directo (ej. desde un link), va a `fallback`. */
export function goBack(fallback = '/inicio') {
  if (reliable && depth > 0) history.back();
  else go(fallback);
}
