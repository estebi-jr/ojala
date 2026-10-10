// Ajustes, recuperar acceso con el enlace para editar y "agregar desde otra app"
import { CONFIG } from '../config.js';
import { adminListUrl, api, baseUrl, errorText, isDemo, keychain, prefs } from '../store/index.js';
import { applyTheme, getOccasion, thumbBackground } from '../occasions.js';
import { brandMark, icon } from '../icons.js';
import { toast } from '../ui.js';
import { copyText, esc, normalizeUrl } from '../util.js';
import { go, goBack } from '../router.js';
import { bookmarkletHref, hintFromQuery, hintQuery } from '../bookmarklet.js';
import { shareTextTitle } from '../preview.js';

export function applyThemePref(value = prefs.get('theme', 'auto')) {
  if (value === 'light' || value === 'dark') document.documentElement.dataset.theme = value;
  else delete document.documentElement.dataset.theme;
}

const plainTopbar = (title, back = '#/') => `<header class="topbar" id="topbar">
  <div class="topbar-left"><a class="icon-btn" href="${back}" data-act="back" aria-label="Volver">${icon('chevronLeft')}</a></div>
  <div class="topbar-title">${esc(title)}</div>
  <div class="topbar-right"></div>
</header>`;

export function SettingsView() {
  applyTheme(null);
  const theme = prefs.get('theme', 'auto');
  const mine = keychain.list();
  const bookmarklet = bookmarkletHref(baseUrl()); // lee nombre, foto y precio en la página de la tienda
  const themeBtn = (v, l) => `<button class="seg-btn" data-act="theme" data-v="${v}" aria-pressed="${theme === v}">${l}</button>`;
  return {
    html: `<div class="page page-plain">
      ${plainTopbar('Ajustes')}
      <div class="wrap">
        <div class="settings-stack">
          <div class="large-head"><div><h1 class="t-large">Ajustes</h1></div></div>

          <div class="form-section">
            <p class="form-label">Apariencia</p>
            <div class="group"><div class="field"><span class="field-text"><b>Tema</b></span>
              <div class="segmented" role="group" aria-label="Tema">${themeBtn('auto', 'Auto')}${themeBtn('light', 'Claro')}${themeBtn('dark', 'Oscuro')}</div>
            </div></div>
          </div>

          <div class="form-section">
            <p class="form-label">Agregar desde cualquier tienda (computador)</p>
            <div class="group" style="padding:16px;display:grid;gap:12px;justify-items:start">
              <p class="t-sub">Arrastra este botón a tu barra de favoritos. Cuando estés mirando un producto, tócalo: lee el nombre, la foto y el precio de esa página y abre ${esc(CONFIG.brand)} listo para agregarlo. Funciona incluso en tiendas que no dejan leer sus links.</p>
              <a class="bookmarklet" href="${esc(bookmarklet)}" draggable="true" data-act="bookmarklet">${icon('plus', 'sm')} Agregar a ${esc(CONFIG.brand)}</a>
            </div>
            <p class="form-hint">¿Ya lo tenías? Vuelve a arrastrarlo para usar la versión nueva. En el celular: copia el link del producto desde la tienda y pégalo en tu lista.</p>
          </div>

          <div class="form-section">
            <p class="form-label">Úsala como app</p>
            <div class="group">
              <div class="field"><span class="field-ic" style="background:#0A84FF">${icon('phone')}</span><span class="field-text"><b>iPhone</b><small>En Safari toca Compartir y luego "Agregar a inicio".</small></span></div>
              <div class="field"><span class="field-ic" style="background:#30B85A">${icon('phone')}</span><span class="field-text"><b>Android</b><small>En Chrome toca el menú ⋮ y luego "Instalar app". Después podrás compartir productos directo a tu lista.</small></span></div>
            </div>
          </div>

          <div class="form-section">
            <p class="form-label">Tus enlaces para editar</p>
            <div class="group">
              ${mine.length ? mine.map((l) => `<div class="field"><span class="list-thumb" style="${thumbBackground(l.occasion)};width:34px;height:34px;border-radius:10px;font-size:18px">${getOccasion(l.occasion).emoji}</span><span class="field-text"><b>${esc(l.title)}</b><small>${esc(l.slug)}</small></span><button class="pill gray" data-act="copy-admin" data-slug="${esc(l.slug)}" data-token="${esc(l.token)}">${icon('copy')} Copiar</button></div>`).join('')
                : '<div class="field"><span class="field-text"><small>Todavía no has creado listas en este dispositivo.</small></span></div>'}
            </div>
            <p class="form-hint">Guárdalos para editar tus listas desde otro dispositivo. Quien tenga un enlace para editar puede cambiar esa lista.</p>
          </div>

          <div class="form-section">
            <p class="form-label">Datos</p>
            <div class="group"><div class="field"><span class="field-ic" style="background:${isDemo ? '#FF9500' : '#30B85A'}">${icon(isDemo ? 'info' : 'checkCircle')}</span><span class="field-text"><b>${isDemo ? 'Modo demo' : 'Conectado a la base de datos'}</b><small>${isDemo ? 'Todo se guarda solo en este navegador.' : 'Tus listas se comparten con cualquiera que tenga el enlace.'}</small></span></div></div>
          </div>

          <div class="list-footer" style="margin-top:8px">${brandMark()}<p>Hecho en Chile 🇨🇱</p></div>
        </div>
      </div>
    </div>`,
    mount(root) {
      root.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        // Volver a donde estabas (portada o Mis listas); si entraste directo, a Mis listas
        if (b.dataset.act === 'back') { e.preventDefault(); goBack('/'); return; }
        if (b.dataset.act === 'theme') {
          prefs.set('theme', b.dataset.v);
          applyThemePref(b.dataset.v);
          root.querySelectorAll('[data-act="theme"]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        }
        if (b.dataset.act === 'copy-admin') {
          const ok = await copyText(adminListUrl(b.dataset.slug, b.dataset.token));
          toast(ok ? 'Enlace para editar copiado' : 'No se pudo copiar', { tone: ok ? 'success' : 'error' });
        }
        if (b.dataset.act === 'bookmarklet') {
          e.preventDefault();
          toast('Arrástralo a tu barra de favoritos', { tone: 'info', iconName: 'plus' });
        }
      });
    },
  };
}

/** #/admin/slug/token → guarda la llave en este dispositivo y abre la lista. */
export function AdminImportView({ slug, token }) {
  return {
    html: `<div class="page"><div class="state-page"><div><span class="spinner" style="width:28px;height:28px"></span><p>Abriendo tu lista…</p></div></div></div>`,
    async mount(root) {
      try {
        await api.importAdmin(slug, token);
        toast('Listo: ya puedes editar esta lista');
        go(`/l/${slug}`, { replace: true });
      } catch (e) {
        root.innerHTML = `<div class="page">${plainTopbar('Enlace para editar', '#/inicio')}<div class="state-page"><div>
          <div class="empty-icon">${icon('lock')}</div><h1>No pudimos abrir la lista</h1><p>${esc(errorText(e))}</p>
          <div class="hero-cta" style="justify-content:center"><a class="btn btn-gray" href="#/l/${esc(slug)}">Verla como invitado</a><a class="btn btn-primary" href="#/nueva">Crear una lista</a></div>
        </div></div></div>`;
      }
    },
  };
}

/** #/agregar?url=… (botón del navegador o compartir desde Android) */
export function AddFromShareView({ query }) {
  applyTheme(null);
  const raw = query.get('url') || query.get('text') || '';
  const url = normalizeUrl(raw);
  // Datos del marcador (t, h, img, p, c) o, al compartir desde otra app, el texto que acompaña al link
  const hint = hintFromQuery(query) || {};
  const st = shareTextTitle(query.get('title') || query.get('text') || '', url);
  if (st && !hint.st) hint.st = st;
  const extra = hintQuery(hint);
  const mine = keychain.list();
  if (url && mine.length === 1) {
    setTimeout(() => go(`/l/${mine[0].slug}?agregar=${encodeURIComponent(url)}${extra}`, { replace: true }), 0);
    return { html: '<div class="page"></div>' };
  }
  if (!mine.length) {
    if (url) prefs.set('pendingUrl', url);
    return {
      html: `<div class="page">${plainTopbar('Agregar deseo', '#/inicio')}<div class="state-page"><div>
        <div class="empty-icon">${icon('gift')}</div><h1>Primero crea tu lista</h1>
        <p>Guardamos este link y lo agregamos apenas tengas una lista.</p>
        <div class="hero-cta" style="justify-content:center"><a class="btn btn-primary" href="#/nueva">${icon('plus')} Crear mi lista</a></div>
      </div></div></div>`,
    };
  }
  return {
    html: `<div class="page page-plain">${plainTopbar('Agregar deseo')}
      <div class="wrap wrap-narrow">
        <div class="large-head"><div><h1 class="t-large">¿A qué lista?</h1>${url ? `<p class="muted t-sub" style="overflow-wrap:anywhere">${esc(url)}</p>` : ''}</div></div>
        <div class="list-rows" style="grid-template-columns:1fr">
          ${mine.map((l) => `<a class="list-row" href="#/l/${esc(l.slug)}${url ? `?agregar=${encodeURIComponent(url)}${esc(extra)}` : ''}"><span class="list-thumb" style="${thumbBackground(l.occasion)}">${getOccasion(l.occasion).emoji}</span><span class="list-row-main"><h3>${esc(l.title)}</h3><p>${esc(getOccasion(l.occasion).label)}</p></span><span class="chev">${icon('chevronRight', 'sm')}</span></a>`).join('')}
        </div>
      </div></div>`,
  };
}

