// Componentes de interfaz: hojas, menús, alertas, avisos tipo "isla" y confeti
import { icon } from './icons.js';
import { esc, haptic } from './util.js';

let locks = 0;
const lock = () => { locks += 1; document.documentElement.classList.add('is-locked'); };
const unlock = () => { locks = Math.max(0, locks - 1); if (!locks) document.documentElement.classList.remove('is-locked'); };
const isDesktop = () => window.matchMedia('(min-width: 720px)').matches;

function trapFocus(e, root) {
  const nodes = [...root.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')]
    .filter((n) => !n.disabled && n.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/**
 * Abre una hoja (sheet) al estilo iOS: desde abajo en celular, centrada en escritorio.
 * Devuelve { el, body, close(), swap(html), setBar({left,title,right}) }.
 */
export function openSheet({ title = '', left = '', right = null, body = '', className = '', label = '', onClose } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const closeBtn = `<button class="icon-btn plain" data-close aria-label="Cerrar">${icon('close')}</button>`;
  overlay.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <section class="sheet ${className}" role="dialog" aria-modal="true" aria-label="${esc(label || title)}" tabindex="-1">
      <div class="sheet-grabber" aria-hidden="true"></div>
      <header class="sheet-bar">
        <div class="sheet-left">${left}</div>
        <h2 class="sheet-title">${esc(title)}</h2>
        <div class="sheet-right">${right ?? closeBtn}</div>
      </header>
      <div class="sheet-body">${body}</div>
    </section>`;
  document.body.appendChild(overlay);
  lock();
  const sheet = overlay.querySelector('.sheet');
  const bodyEl = overlay.querySelector('.sheet-body');
  const prevFocus = document.activeElement;
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-open')));

  let closed = false;
  const onKey = (e) => {
    if (e.key === 'Escape' && !document.querySelector('.alert-wrap, .menu-layer')) api.close();
    if (e.key === 'Tab') trapFocus(e, sheet);
  };
  const api = {
    el: sheet,
    body: bodyEl,
    get closed() { return closed; },
    close(result) {
      if (closed) return;
      closed = true;
      sheet.style.transform = '';
      overlay.classList.remove('is-open');
      unlock();
      document.removeEventListener('keydown', onKey);
      setTimeout(() => overlay.remove(), 460);
      try { prevFocus?.focus?.({ preventScroll: true }); } catch { /* nada */ }
      onClose?.(result);
    },
    swap(html) {
      bodyEl.innerHTML = html;
      bodyEl.classList.remove('sheet-swap');
      void bodyEl.offsetWidth;
      bodyEl.classList.add('sheet-swap');
      bodyEl.scrollTop = 0;
    },
    setBar({ left: l, title: t, right: r } = {}) {
      if (l !== undefined) sheet.querySelector('.sheet-left').innerHTML = l;
      if (t !== undefined) sheet.querySelector('.sheet-title').textContent = t;
      if (r !== undefined) sheet.querySelector('.sheet-right').innerHTML = r ?? closeBtn;
    },
  };
  overlay.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
  document.addEventListener('keydown', onKey);
  enableDrag(sheet, api);
  setTimeout(() => {
    const f = sheet.querySelector('[data-autofocus]');
    if (f && isDesktop()) f.focus({ preventScroll: true });
    else sheet.focus({ preventScroll: true });
  }, 80);
  return api;
}

/** Arrastrar la hoja hacia abajo para cerrarla (como en iOS). */
function enableDrag(sheet, api) {
  const handles = [sheet.querySelector('.sheet-grabber'), sheet.querySelector('.sheet-bar')];
  let startY = 0;
  let dy = 0;
  let t0 = 0;
  let dragging = false;
  const down = (e) => {
    if (isDesktop() || e.target.closest('button, a, input, textarea, select')) return;
    dragging = true; startY = e.clientY; dy = 0; t0 = performance.now();
    sheet.classList.add('is-dragging');
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* nada */ }
  };
  const move = (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('is-dragging');
    const velocity = dy / Math.max(1, performance.now() - t0);
    if (dy > 120 || (dy > 30 && velocity > 0.6)) api.close();
    else sheet.style.transform = '';
  };
  handles.forEach((h) => {
    if (!h) return;
    h.addEventListener('pointerdown', down);
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  });
}

/** Menú contextual anclado a un botón. Resuelve con el `value` elegido o null. */
export function openMenu(anchor, items) {
  const list = items.filter(Boolean);
  return new Promise((resolve) => {
    const layer = document.createElement('div');
    layer.className = 'menu-layer';
    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = list.map((it, i) => `<button class="menu-item${it.danger ? ' danger' : ''}${it.sep ? ' sep' : ''}${it.checked ? ' checked' : ''}" role="menuitem" data-i="${i}"><span>${esc(it.label)}</span>${it.icon ? icon(it.icon) : ''}</button>`).join('');
    layer.appendChild(menu);
    document.body.appendChild(layer);
    const r = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    const left = Math.min(window.innerWidth - mw - 12, Math.max(12, r.right - mw));
    let top = r.bottom + 8;
    if (top + mh > window.innerHeight - 12) top = Math.max(12, r.top - mh - 8);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.transformOrigin = `${Math.max(0, r.left + r.width / 2 - left)}px ${top >= r.bottom ? 0 : mh}px`;
    const done = (v) => { layer.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('.menu-item');
      if (b) { haptic(); done(list[Number(b.dataset.i)].value); } else if (e.target === layer) done(null);
    });
    document.addEventListener('keydown', onKey);
    menu.querySelector('.menu-item')?.focus({ preventScroll: true });
  });
}

/** Alerta de confirmación (reemplaza a confirm(), que no funciona en todas partes). */
export function confirmDialog({ title, message = '', confirm = 'Aceptar', cancel = 'Cancelar', danger = false } = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'alert-wrap';
    wrap.innerHTML = `<div class="alert" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
      <div class="alert-body"><p class="alert-title" id="alert-title">${esc(title)}</p>${message ? `<p class="alert-msg">${esc(message)}</p>` : ''}</div>
      <div class="alert-actions"><button data-v="0">${esc(cancel)}</button><button data-v="1" class="${danger ? 'danger' : ''}">${esc(confirm)}</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const done = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (b) done(b.dataset.v === '1');
      else if (e.target === wrap) done(false);
    });
    document.addEventListener('keydown', onKey, true);
    wrap.querySelector('[data-v="1"]').focus();
  });
}

let islandTimer;
/** Aviso breve arriba, al estilo Dynamic Island. tone: success | error | info */
export function toast(text, { tone = 'success', iconName } = {}) {
  let el = document.querySelector('.island');
  if (!el) {
    el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  const ic = iconName || (tone === 'success' ? 'check' : 'info');
  el.className = `island ${tone}`;
  el.innerHTML = `<span class="island-ic">${icon(ic)}</span><span>${esc(text)}</span>`;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
  clearTimeout(islandTimer);
  islandTimer = setTimeout(() => el.classList.remove('is-in'), tone === 'error' ? 4500 : 2600);
  if (tone === 'success') haptic();
}

/** Confeti para los momentos felices (respeta "reducir movimiento"). */
export function confetti({ x = window.innerWidth / 2, y = window.innerHeight / 3 } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth;
  const H = window.innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  c.style.width = `${W}px`; c.style.height = `${H}px`;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement);
  const palette = ['--a1', '--a2', '--a3'].map((v) => cs.getPropertyValue(v).trim()).filter(Boolean).concat(['#FFD60A', '#30D158', '#FFFFFF']);
  const parts = Array.from({ length: 120 }, () => ({
    x, y,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 13 - 4,
    r: Math.random() * 7 + 5,
    rot: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.35,
    color: palette[Math.floor(Math.random() * palette.length)],
    round: Math.random() < 0.4,
  }));
  let frame = 0;
  const FRAMES = 120;
  const tick = () => {
    frame += 1;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.36; p.vx *= 0.986; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - frame / FRAMES);
      ctx.fillStyle = p.color;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.r / 2.6, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    }
    if (frame < FRAMES) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
}

/** Fotos: aparecen suaves, prueban la original si el CDN falla, y deciden si "llenar" o "flotar". */
export function installImageHandlers() {
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.closest('.media')) return;
    img.classList.add('is-loaded');
    decideFit(img);
  }, true);
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.orig) {
      const orig = img.dataset.orig;
      delete img.dataset.orig;
      img.removeAttribute('crossorigin');
      img.src = orig;
      return;
    }
    const media = img.closest('.media');
    if (media) { media.classList.add('is-broken'); return; }
    if (img.classList.contains('favicon')) { img.style.visibility = 'hidden'; return; }
    img.remove();
  }, true);
}

/** Productos con fondo blanco "flotan" en la bandeja; fotos normales la llenan. */
function decideFit(img) {
  try {
    const canSample = img.src.startsWith('data:') || img.crossOrigin === 'anonymous';
    if (!canSample) return;
    const c = document.createElement('canvas');
    c.width = 24; c.height = 24;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 24, 24);
    const px = ctx.getImageData(0, 0, 24, 24).data;
    const at = (x, y) => { const i = (y * 24 + x) * 4; return [px[i], px[i + 1], px[i + 2], px[i + 3]]; };
    const points = [[0, 0], [23, 0], [0, 23], [23, 23], [12, 0], [0, 12], [23, 12], [12, 23]];
    const light = points.filter(([x, y]) => { const [r, g, b, a] = at(x, y); return a < 30 || (r > 232 && g > 232 && b > 232); }).length;
    img.classList.toggle('is-cover', light < 6);
  } catch {
    /* imagen sin permiso de lectura: se queda flotando */
  }
}
