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
