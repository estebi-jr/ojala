// Página de una lista: vista del dueño (editar) y de los invitados (reservar)
import { CONFIG } from '../config.js';
import { api, adminListUrl, claimKeys, errorText, prefs } from '../store/index.js';
import { applyTheme, getOccasion } from '../occasions.js';
import { brandMark, icon } from '../icons.js';
import { copyText, countdownText, esc, formatDateLong, openExternal } from '../util.js';
import { avatarHtml, cardHtml, claimState, coverHtml } from './cards.js';
import { confetti, confirmDialog, openMenu, openSheet, toast } from '../ui.js';
import { openClaimSheet, openItemDetail, openItemEditor } from './items.js';
import { openShare } from './share.js';
import { openListSettings } from './listsettings.js';
import { go, goBack, silentReplace } from '../router.js'; /* iOS-pass · Bloque C: goBack */
import { createExampleBackend } from '../example.js';

const SORTS = [
  { v: 'default', label: 'Orden de la lista', short: 'Orden' },
  { v: 'priority', label: 'Favoritos primero', short: 'Favoritos' },
  { v: 'price-asc', label: 'Precio: menor a mayor', short: 'Precio ↑' },
  { v: 'price-desc', label: 'Precio: mayor a menor', short: 'Precio ↓' },
  { v: 'alpha', label: 'Alfabético', short: 'A–Z' },
  { v: 'store', label: 'Por tienda', short: 'Tienda' },
];

export function ListView({ slug, preview = false, example = false, query = new URLSearchParams() }) {
  const ctx = {
    slug, preview, example, query,
    sort: prefs.get('sort', 'default'),
    filter: 'all',
    layout: prefs.get('layout', 'grid'),
    list: null, items: [], claims: [], isOwner: false, token: null,
    cleanups: [],
    lastLoad: 0,
  };
  wireActions(ctx);

  return {
    html: skeletonHtml(),
    async mount(root) {
      ctx.root = root;
      try {
        await load(ctx);
      } catch (e) {
        renderError(ctx, e);
        return;
      }
      renderPage(ctx);
      bind(ctx);
      if (query.has('nueva') && ctx.isOwner) {
        silentReplace(`/l/${ctx.list.slug}`);
        const pending = prefs.get('pendingUrl', null);
        if (pending) {
          prefs.set('pendingUrl', null);
          setTimeout(() => openItemEditor(ctx, null, { prefillUrl: pending }), 350);
        } else {
          setTimeout(() => openWelcome(ctx), 350);
        }
      }
    },
    destroy() { ctx.cleanups.forEach((fn) => fn()); },
  };
}

// ---------- Datos ----------
async function load(ctx) {
  if (ctx.example) {
    ctx.exampleBackend ||= createExampleBackend();
    const d = ctx.exampleBackend.data;
    Object.assign(ctx, { list: d.list, items: d.items, claims: d.claims, isOwner: false, token: null, ownedHere: false });
  } else {
    const r = await api.loadList(ctx.slug, { asGuest: ctx.preview });
    Object.assign(ctx, r);
  }
  ctx.lastLoad = Date.now();
  derive(ctx);
}

function derive(ctx) {
  ctx.mode = ctx.isOwner ? 'owner' : 'guest';
  ctx.claimsByItem = new Map();
  for (const c of ctx.claims) {
    const arr = ctx.claimsByItem.get(c.item_id) || [];
    arr.push(c);
    ctx.claimsByItem.set(c.item_id, arr);
  }
  ctx.myClaimIds = new Set(ctx.claims
    .filter((c) => (ctx.example ? ctx.exampleBackend.isMine(c.id) : !!claimKeys.get(c.id)))
    .map((c) => c.id));
  const surprise = ctx.list.surprise !== false;
  ctx.showClaims = ctx.isOwner ? !surprise : !(ctx.preview && surprise);
}

function visibleItems(ctx) {
  let arr = [...ctx.items];
  if (ctx.filter === 'available') arr = arr.filter((i) => !claimState(i, ctx).full);
  if (ctx.filter === 'fav') arr = arr.filter((i) => i.priority);
  const price = (i, fallback) => (i.price == null ? fallback : Number(i.price));
  switch (ctx.sort) {
    case 'priority': arr.sort((a, b) => Number(b.priority) - Number(a.priority) || a.position - b.position); break;
    case 'price-asc': arr.sort((a, b) => price(a, Infinity) - price(b, Infinity)); break;
    case 'price-desc': arr.sort((a, b) => price(b, -Infinity) - price(a, -Infinity)); break;
    case 'alpha': arr.sort((a, b) => a.title.localeCompare(b.title, 'es')); break;
    case 'store': arr.sort((a, b) => (a.store || '~').localeCompare(b.store || '~', 'es') || a.title.localeCompare(b.title, 'es')); break;
    default: arr.sort((a, b) => a.position - b.position);
  }
  return arr;
}

// ---------- Render ----------
function skeletonHtml() {
  return `<div class="page list-page" aria-busy="true">
    <div class="sk sk-cover"></div>
    <div class="wrap" style="display:grid;gap:14px;margin-top:-40px">
      <div class="sk" style="width:96px;height:96px;border-radius:50%"></div>
      <div class="sk" style="width:min(420px,80%);height:40px"></div>
      <div class="sk" style="width:min(260px,60%);height:28px;border-radius:999px"></div>
      <div class="grid" style="margin-top:24px">${'<div class="sk sk-card"></div>'.repeat(4)}</div>
    </div>
  </div>`;
}

function renderError(ctx, e) {
  applyTheme(null);
  const notFound = e?.code === 'not_found';
  ctx.root.innerHTML = `<div class="page">
    <header class="topbar"><div class="topbar-left"><a href="#/inicio" aria-label="Ir al inicio">${brandMark()}</a></div><div></div><div></div></header>
    <div class="state-page"><div>
      <div class="empty-icon">${icon(notFound ? 'info' : 'refresh')}</div>
      <h1>${notFound ? 'Esta lista no existe' : 'No pudimos cargar la lista'}</h1>
      <p>${esc(errorText(e))}</p>
      <div class="hero-cta" style="justify-content:center">
        ${notFound ? '<a class="btn btn-primary" href="#/nueva">Crear mi lista</a>' : '<button class="btn btn-primary" data-act="retry">Reintentar</button>'}
      </div>
    </div></div>
  </div>`;
  ctx.root.querySelector('[data-act="retry"]')?.addEventListener('click', () => window.dispatchEvent(new HashChangeEvent('hashchange')));
}

function topbarHtml(ctx) {
  /* iOS-pass · Bloque C: invitado y ejemplo usan el mismo "‹" que el resto (vuelve atrás o al inicio de Ojalá) */
  let left = `<button class="icon-btn" data-act="nav-back" aria-label="Volver">${icon('chevronLeft')}</button>`;
  let right = ''; /* iOS-pass · Bloque C: Compartir queda solo en el dock, también para el invitado */
  if (ctx.isOwner) {
    left = `<button class="icon-btn" data-act="back" aria-label="Mis listas">${icon('chevronLeft')}</button>`;
    right = `<button class="icon-btn" data-act="list-menu" aria-label="Más opciones">${icon('more')}</button>`; /* iOS-pass · Bloque C: Compartir queda solo en el dock */
  } else if (ctx.preview) {
    left = `<button class="icon-btn" data-act="exit-preview" aria-label="Volver a editar">${icon('chevronLeft')}</button>`;
    right = '';
  } else if (ctx.example) {
    right = '';
  }
  return `<header class="topbar" id="topbar">
    <div class="topbar-left">${left}</div>
    <div class="topbar-title">${esc(ctx.list.title)}</div>
    <div class="topbar-right">${right}</div>
  </header>`;
}

function heroHtml(ctx) {
  const { list } = ctx;
  const occ = getOccasion(list.occasion);
  const surprise = list.surprise !== false;
  const name = (list.owner_name || '').trim();
  const showOwner = name && !list.title.toLowerCase().includes(name.toLowerCase());
  const chips = [`<span class="chip accent">${occ.emoji} ${esc(occ.label)}</span>`];
  if (list.event_date) chips.push(`<span class="chip">${icon('calendar')} ${esc(formatDateLong(list.event_date))} · ${esc(countdownText(list.event_date))}</span>`);
  if (ctx.isOwner && surprise) chips.push(`<button class="chip" data-act="surprise-info">${icon('eyeOff')} Modo sorpresa</button>`);
  return `
    <div class="avatar-wrap">${avatarHtml(list)}</div>
    <h1 class="list-title" id="list-title">${esc(list.title)}</h1>
    ${showOwner ? `<p class="owner-line">Lista de ${esc(name)}</p>` : ''}
    <div class="meta-chips">${chips.join('')}</div>
    ${list.message ? `<div class="welcome-row">${avatarHtml(list, 'mini-avatar')}<p class="bubble lg"><span>${esc(list.message)}</span></p></div>` : ''}
    ${statsHtml(ctx)}`;
}

function statsHtml(ctx) {
  const total = ctx.items.filter((i) => !(ctx.isOwner && i.hidden)).length;
  if (!ctx.items.length) return '';
  if (!ctx.showClaims) {
    const favs = ctx.items.filter((i) => i.priority).length;
    const hidden = ctx.items.filter((i) => i.hidden).length;
    return `<div class="stats" id="stats">
      <div class="stat"><b>${total}</b> ${total === 1 ? 'deseo' : 'deseos'}</div>
      ${favs ? `<div class="stat"><b>${favs}</b> ${favs === 1 ? 'favorito' : 'favoritos'}</div>` : ''}
      ${hidden && ctx.isOwner ? `<div class="stat"><b>${hidden}</b> ${hidden === 1 ? 'oculto' : 'ocultos'}</div>` : ''}
      <div class="surprise-note">${icon('eyeOff')} ${ctx.isOwner ? 'No verás qué te reservan' : 'Vista previa sin reservas'}</div>
    </div>`;
  }
  const full = ctx.items.filter((i) => claimState(i, ctx).full).length;
  const pct = total ? Math.round((full / total) * 100) : 0;
  return `<div class="stats" id="stats">
    <div class="stat"><b>${total}</b> ${total === 1 ? 'deseo' : 'deseos'}</div>
    <div class="stat"><b>${full}</b> ${full === 1 ? 'reservado' : 'reservados'}</div>
    <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Regalos reservados"><i style="width:${pct}%"></i></div>
  </div>`;
}

function toolbarHtml(ctx) {
  if (!ctx.items.length) return '';
  const filters = ctx.isOwner
    ? [['all', 'Todos'], ['fav', 'Favoritos']]
    : [['all', 'Todos'], ['available', 'Disponibles']];
  const sort = SORTS.find((s) => s.v === ctx.sort) || SORTS[0];
  return `
    <div class="segmented" role="group" aria-label="Filtrar deseos">
      ${filters.map(([v, l]) => `<button class="seg-btn" data-act="filter" data-v="${v}" aria-pressed="${ctx.filter === v}">${l}</button>`).join('')}
    </div>
    <div class="toolbar-right">
      <button class="tool-btn" data-act="sort" aria-label="Ordenar: ${esc(sort.label)}">${icon('sort')}<span>${esc(sort.short)}</span></button>
      <button class="tool-btn icon-only" data-act="layout" aria-label="${ctx.layout === 'grid' ? 'Ver como lista' : 'Ver como grilla'}">${icon(ctx.layout === 'grid' ? 'rows' : 'grid')}</button>
    </div>`;
}

function gridHtml(ctx) {
  if (!ctx.items.length) return emptyHtml(ctx);
  const items = visibleItems(ctx);
  if (!items.length) {
    return ctx.filter === 'available'
      ? `<div class="empty"><div class="empty-icon">${icon('checkCircle')}</div><h2>¡Todo está reservado!</h2><p>Los invitados ya se repartieron todos los regalos. Igual puedes ver la lista completa en "Todos".</p></div>`
      : `<div class="empty"><div class="empty-icon">${icon('star')}</div><h2>Sin favoritos todavía</h2><p>Marca con estrella lo que más quieres desde el menú de cada deseo.</p></div>`;
  }
  return `<div class="grid${ctx.layout === 'rows' ? ' is-rows' : ''}" id="grid">${items.map((it, i) => cardHtml(it, ctx, i)).join('')}</div>`;
}

function emptyHtml(ctx) {
  if (ctx.isOwner) {
    return `<div class="empty">
      <div class="empty-icon">${icon('bag')}</div>
      <h2>Agrega tu primer deseo</h2>
      <p>Copia el link de cualquier producto (Falabella, Paris, Mercado Libre, Zara, lo que sea) y pégalo aquí. La foto, el nombre y el precio se cargan solos.</p>
      <form class="quick-add" data-act-form="quick-add">
        ${icon('link')}
        <input id="quick-url" type="url" inputmode="url" placeholder="Pega un link" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Link del producto">
        <button class="btn btn-primary" type="submit">Agregar</button>
      </form>
      <button class="btn btn-plain" data-act="add-nolink">O agrega una idea sin link</button>
    </div>`;
  }
  const name = ctx.list.owner_name ? esc(ctx.list.owner_name) : 'La persona';
  return `<div class="empty"><div class="empty-icon">${icon('gift')}</div><h2>Todavía no hay deseos</h2><p>${name} aún está armando su lista. Vuelve en un rato.</p></div>`;
}

function dockHtml(ctx) {
  if (ctx.isOwner) {
    return `<nav class="dock" aria-label="Acciones de la lista">
      <button class="dock-btn" data-act="share">${icon('share')}<span class="lbl-opt">Compartir</span></button>
      <button class="dock-btn primary" data-act="add">${icon('plus')}<span>Agregar</span></button>
      <button class="dock-btn" data-act="edit-list">${icon('sliders')}<span class="lbl-opt">Editar</span></button>
    </nav>`;
  }
  if (ctx.preview) {
    return `<nav class="dock" aria-label="Vista previa"><button class="dock-btn primary" data-act="exit-preview">${icon('pencil')}<span>Volver a editar</span></button></nav>`;
  }
  if (ctx.example) {
    return `<nav class="dock" aria-label="Acciones"><a class="dock-btn primary" href="#/nueva">${icon('plus')}<span>Crear mi lista</span></a></nav>`; /* iOS-pass · Bloque C: sin "Volver" */
  }
  return `<nav class="dock" aria-label="Acciones">
    <button class="dock-btn" data-act="share">${icon('share')}<span class="lbl-opt">Compartir</span></button>
    <a class="dock-btn primary" href="#/nueva">${icon('plus')}<span>Crear mi lista</span></a>
  </nav>`;
}

function bannerHtml(ctx) {
  if (ctx.preview) {
    return `<div class="preview-banner glass">${icon('eye')}<span style="flex:1">Así ven tu lista tus invitados</span><button class="btn btn-sm btn-gray" data-act="exit-preview">Listo</button></div>`;
  }
  if (ctx.example) {
    return `<div class="example-banner">Lista de ejemplo: prueba reservar un regalo</div>`; /* iOS-pass · Bloque C: sólido, no sticky, sin botón */
  }
  return '';
}

function footerHtml(ctx) {
  if (ctx.isOwner || ctx.preview) return '';
  return `<footer class="list-footer">
    ${brandMark()}
    <p>¿Se viene tu cumpleaños, Navidad o un amigo secreto?<br>Arma tu propia lista en un minuto. Es gratis.</p>
    <a class="btn btn-gray" href="#/nueva">${icon('plus')} Crear mi lista</a>
  </footer>`;
}

function renderPage(ctx) {
  applyTheme(ctx.list.occasion);
  document.title = `${ctx.list.title} · ${CONFIG.brand}`;
  ctx.root.innerHTML = `<div class="page list-page">
    ${topbarHtml(ctx)}
    <div class="cover" id="cover">${coverHtml(ctx.list)}</div>
    <div class="wrap">
      <section class="list-hero" id="hero">${heroHtml(ctx)}</section>
      ${bannerHtml(ctx)}
      <div class="toolbar" id="toolbar">${toolbarHtml(ctx)}</div>
      <section id="grid-wrap" aria-label="Deseos">${gridHtml(ctx)}</section>
      ${footerHtml(ctx)}
    </div>
    ${dockHtml(ctx)}
  </div>`;
  updateTopbarThreshold(ctx);
}

function refresh(ctx, { hero = false, toolbar = false, grid = true } = {}) {
  const r = ctx.root;
  if (hero) r.querySelector('#hero').innerHTML = heroHtml(ctx);
  if (toolbar || hero) r.querySelector('#toolbar').innerHTML = toolbarHtml(ctx);
  if (grid) {
    const wrap = r.querySelector('#grid-wrap');
    wrap.innerHTML = gridHtml(ctx);
    wrap.querySelectorAll('.card').forEach((c) => { c.style.animation = 'none'; });
  }
}

function updateTopbarThreshold(ctx) {
  const bar = ctx.root.querySelector('#topbar');
  const title = ctx.root.querySelector('#list-title');
  if (!bar || !title) return;
  const y = title.getBoundingClientRect().bottom + window.scrollY - bar.offsetHeight;
  bar.dataset.solidAt = String(Math.max(40, Math.round(y)));
  window.dispatchEvent(new Event('scroll'));
}

function flashCard(ctx, id) {
  const card = ctx.root.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (!card) return;
  card.style.animation = '';
  card.classList.remove('is-flash');
  void card.offsetWidth;
  card.classList.add('is-flash');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cardCenter(ctx, id) {
  const card = ctx.root?.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (!card) return {};
  const r = card.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return {};
  return { x: r.left + r.width / 2, y: r.top + r.height / 3 };
}

// ---------- Acciones compartidas con las hojas ----------
function wireActions(ctx) {
  ctx.onItemSaved = (item, isNew) => {
    const i = ctx.items.findIndex((x) => x.id === item.id);
    if (i >= 0) ctx.items[i] = item; else ctx.items.push(item);
    api.countItems(ctx.list.id, ctx.items.length);
    derive(ctx);
    if (isNew && ctx.filter !== 'all') ctx.filter = 'all';
    refresh(ctx, { hero: true, grid: true });
    flashCard(ctx, item.id);
    toast(isNew ? 'Deseo agregado' : 'Cambios guardados');
  };

  ctx.onItemDeleted = (id) => {
    ctx.items = ctx.items.filter((x) => x.id !== id);
    ctx.claims = ctx.claims.filter((c) => c.item_id !== id);
    api.countItems(ctx.list.id, ctx.items.length);
    derive(ctx);
    refresh(ctx, { hero: true, grid: true });
    toast('Deseo eliminado');
  };

  ctx.onListUpdated = (list) => {
    ctx.list = list;
    derive(ctx);
    renderPage(ctx);
  };

  ctx.doClaim = async (item, name, qty) => {
    const claim = ctx.example
      ? await ctx.exampleBackend.claimItem(item.id, name, qty)
      : await api.claim(item.id, name, qty);
    if (ctx.example) ctx.claims = ctx.exampleBackend.data.claims;
    else ctx.claims.push(claim);
    if (name) prefs.set('guestName', name);
    derive(ctx);
    refresh(ctx, { hero: true, grid: true });
    const at = cardCenter(ctx, item.id);
    confetti(at);
    toast('¡Listo! Lo regalas tú');
  };

  ctx.doUnclaim = async (item) => {
    const mine = claimState(item, ctx).mine;
    if (!mine.length) return;
    const ok = await confirmDialog({
      title: '¿Quitar tu reserva?',
      message: 'El regalo volverá a quedar disponible para los demás.',
      confirm: 'Quitar reserva',
      danger: true,
    });
    if (!ok) return false;
    try {
      for (const c of mine) {
        if (ctx.example) await ctx.exampleBackend.unclaim(c.id);
        else await api.unclaim(c.id);
      }
      ctx.claims = ctx.example ? ctx.exampleBackend.data.claims : ctx.claims.filter((c) => !mine.includes(c));
      derive(ctx);
      refresh(ctx, { hero: true, grid: true });
      toast('Reserva quitada', { tone: 'info' });
      return true;
    } catch (e) {
      toast(errorText(e), { tone: 'error' });
      return false;
    }
  };

  ctx.startClaim = (item) => {
    if (ctx.preview) { toast('Tus invitados verán este botón para reservar', { tone: 'info', iconName: 'eye' }); return; }
    openClaimSheet(ctx, item);
  };

  ctx.reload = async ({ quiet = true } = {}) => {
    try {
      await load(ctx);
      refresh(ctx, { hero: true, grid: true });
    } catch (e) {
      if (!quiet) toast(errorText(e), { tone: 'error' });
    }
  };
}

// ---------- Eventos ----------
function bind(ctx) {
  const root = ctx.root;
  const findItem = (id) => ctx.items.find((i) => i.id === id);

  const onClick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b)) return;
    const act = b.dataset.act;
    const item = b.dataset.id ? findItem(b.dataset.id) : null;
    switch (act) {
      case 'back': go('/'); break;
      case 'nav-back': goBack('/inicio'); break; /* iOS-pass · Bloque C */
      case 'share': openShare(ctx); break;
      case 'list-menu': listMenu(ctx, b); break;
      case 'add': openItemEditor(ctx, null); break;
      case 'add-nolink': openItemEditor(ctx, null, { noLink: true }); break;
      case 'edit-list': openListSettings(ctx); break;
      case 'exit-preview': go(`/l/${ctx.list.slug}`); break;
      case 'surprise-info':
        toast('Modo sorpresa: no ves qué te reservaron', { tone: 'info', iconName: 'eyeOff' });
        break;
      case 'filter':
        ctx.filter = b.dataset.v;
        refresh(ctx, { toolbar: true, grid: true });
        break;
      case 'sort': sortMenu(ctx, b); break;
      case 'layout':
        ctx.layout = ctx.layout === 'grid' ? 'rows' : 'grid';
        prefs.set('layout', ctx.layout);
        refresh(ctx, { toolbar: true, grid: true });
        break;
      case 'open':
        if (!item) return;
        if (ctx.isOwner) openItemEditor(ctx, item);
        else openItemDetail(ctx, item);
        break;
      case 'item-menu': if (item) itemMenu(ctx, item, b); break;
      case 'claim': if (item) ctx.startClaim(item); break;
      case 'unclaim': if (item) ctx.doUnclaim(item); break;
      default: break;
    }
  };
  root.addEventListener('click', onClick);

  const onSubmit = (e) => {
    const form = e.target.closest('[data-act-form="quick-add"]');
    if (!form) return;
    e.preventDefault();
    const url = form.querySelector('input').value;
    openItemEditor(ctx, null, { prefillUrl: url });
  };
  root.addEventListener('submit', onSubmit);

  const onVisible = () => {
    if (document.visibilityState === 'visible' && !ctx.example && Date.now() - ctx.lastLoad > 20000 && !document.querySelector('.overlay')) ctx.reload();
  };
  document.addEventListener('visibilitychange', onVisible);
  const onResize = () => updateTopbarThreshold(ctx);
  window.addEventListener('resize', onResize);
  ctx.cleanups.push(() => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('resize', onResize);
  });

  // Desde el botón del navegador o compartir: #/l/slug?agregar=URL
  const prefill = ctx.query.get('agregar');
  if (prefill && ctx.isOwner) {
    silentReplace(`/l/${ctx.list.slug}`);
    setTimeout(() => openItemEditor(ctx, null, { prefillUrl: prefill }), 300);
  }
}

async function sortMenu(ctx, anchor) {
  const v = await openMenu(anchor, SORTS.map((s) => ({ label: s.label, value: s.v, checked: s.v === ctx.sort })));
  if (!v) return;
  ctx.sort = v;
  prefs.set('sort', v);
  refresh(ctx, { toolbar: true, grid: true });
}

async function listMenu(ctx, anchor) {
  const surprise = ctx.list.surprise !== false;
  const v = await openMenu(anchor, [
    { label: 'Editar lista', icon: 'sliders', value: 'edit' },
    { label: 'Ver como invitado', icon: 'eye', value: 'preview' },
    { label: 'Copiar enlace para editar', icon: 'lock', value: 'admin' },
    { label: surprise ? 'Desactivar modo sorpresa' : 'Activar modo sorpresa', icon: surprise ? 'eye' : 'eyeOff', value: 'surprise' },
    { label: 'Eliminar lista', icon: 'trash', value: 'delete', danger: true, sep: true },
  ]);
  if (v === 'edit') openListSettings(ctx);
  if (v === 'preview') go(`/l/${ctx.list.slug}/invitado`);
  if (v === 'admin') {
    const ok = await copyText(adminListUrl(ctx.list.slug, ctx.token));
    toast(ok ? 'Enlace para editar copiado' : 'No se pudo copiar', { tone: ok ? 'success' : 'error' });
  }
  if (v === 'surprise') {
    if (surprise) {
      const ok = await confirmDialog({
        title: '¿Ver qué te reservaron?',
        message: 'Verás qué regalos ya están reservados y por quién. Se acaba la sorpresa.',
        confirm: 'Ver reservas',
      });
      if (!ok) return;
    }
    try {
      const list = await api.updateList(ctx.list, ctx.token, { surprise: !surprise });
      ctx.onListUpdated(list);
      toast(surprise ? 'Modo sorpresa desactivado' : 'Modo sorpresa activado', { tone: 'info', iconName: surprise ? 'eye' : 'eyeOff' });
    } catch (e) {
      toast(errorText(e), { tone: 'error' });
    }
  }
  if (v === 'delete') {
    const ok = await confirmDialog({
      title: '¿Eliminar esta lista?',
      message: 'Se borra para todos, incluidas las reservas. No se puede deshacer.',
      confirm: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteList(ctx.list, ctx.token);
      toast('Lista eliminada', { tone: 'info' });
      go('/');
    } catch (e) {
      toast(errorText(e), { tone: 'error' });
    }
  }
}

async function itemMenu(ctx, item, anchor) {
  const canMove = ctx.sort === 'default' && ctx.filter === 'all';
  const v = await openMenu(anchor, [
    { label: 'Editar', icon: 'pencil', value: 'edit' },
    { label: item.priority ? 'Quitar de favoritos' : 'Marcar como favorito', icon: 'star', value: 'fav' },
    { label: item.hidden ? 'Mostrar a invitados' : 'Ocultar a invitados', icon: item.hidden ? 'eye' : 'eyeOff', value: 'hide' },
    canMove && { label: 'Mover arriba', icon: 'arrowUp', value: 'up' },
    canMove && { label: 'Mover abajo', icon: 'arrowDown', value: 'down' },
    item.url && { label: 'Abrir en la tienda', icon: 'external', value: 'url' },
    { label: 'Eliminar', icon: 'trash', value: 'delete', danger: true, sep: true },
  ]);
  if (!v) return;
  try {
    if (v === 'edit') openItemEditor(ctx, item);
    if (v === 'url') openExternal(item.url);
    if (v === 'fav' || v === 'hide') {
      const patch = v === 'fav' ? { priority: !item.priority } : { hidden: !item.hidden };
      const saved = await api.saveItem(ctx.list, ctx.token, { id: item.id, ...patch });
      const i = ctx.items.findIndex((x) => x.id === item.id);
      ctx.items[i] = saved;
      derive(ctx);
      refresh(ctx, { hero: true, grid: true });
      toast(v === 'fav'
        ? (saved.priority ? 'Marcado como favorito' : 'Quitado de favoritos')
        : (saved.hidden ? 'Oculto para los invitados' : 'Visible para los invitados'), { tone: 'info', iconName: v === 'fav' ? 'star' : (saved.hidden ? 'eyeOff' : 'eye') });
    }
    if (v === 'up' || v === 'down') {
      const ordered = [...ctx.items].sort((a, b) => a.position - b.position);
      const i = ordered.findIndex((x) => x.id === item.id);
      const j = v === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= ordered.length) return;
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      ordered.forEach((x, k) => { x.position = k; });
      refresh(ctx, { grid: true });
      await api.reorder(ctx.list, ctx.token, ordered.map((x) => x.id));
    }
    if (v === 'delete') {
      const ok = await confirmDialog({ title: '¿Eliminar este deseo?', message: item.title, confirm: 'Eliminar', danger: true });
      if (!ok) return;
      await api.deleteItem(ctx.list, ctx.token, item.id);
      ctx.onItemDeleted(item.id);
    }
  } catch (e) {
    toast(errorText(e), { tone: 'error' });
  }
}

// ---------- Bienvenida al crear la lista ----------
function openWelcome(ctx) {
  const adminUrl = adminListUrl(ctx.list.slug, ctx.token);
  const sheet = openSheet({
    title: '',
    label: 'Lista creada',
    body: `
      <div class="center-stack">
        <div class="hero-emoji pop">🎉</div>
        <h2 class="t-title2">¡Tu lista está creada!</h2>
        <p class="muted t-sub">Ahora agrega lo que quieras. Pega links de cualquier tienda y la foto, el nombre y el precio aparecen solos.</p>
      </div>
      <div class="form-section">
        <p class="form-label">Tu enlace para editar</p>
        <div class="group"><div class="copy-row"><code>${esc(adminUrl)}</code><button class="pill gray" data-act="copy-admin">${icon('copy')} Copiar</button></div></div>
        <p class="form-hint">No necesitas cuenta: este enlace es tu llave. Guárdalo (por ejemplo, mándatelo por WhatsApp) para editar desde otro celular. No se lo pases a tus invitados.</p>
      </div>
      <button class="btn btn-primary btn-block" data-act="add-first">${icon('plus')} Agregar mi primer deseo</button>`,
  });
  confetti({ y: window.innerHeight * 0.35 });
  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'copy-admin') {
      const ok = await copyText(adminUrl);
      toast(ok ? 'Enlace copiado. Guárdalo bien' : 'Mantén presionado el enlace para copiarlo', { tone: ok ? 'success' : 'info' });
    }
    if (b.dataset.act === 'add-first') {
      sheet.close();
      setTimeout(() => openItemEditor(ctx, null), 250);
    }
  });
}

