// Lee foto, nombre y precio desde el link de un producto.
// Microlink (gratis, sin llave) + función propia de Supabase, en paralelo. Si ambas fallan: lo que se deduce de la URL
import { CONFIG } from './config.js';
import { cleanTitle, domainOf, guessCurrency, parsePrice, safeHttpUrl, titleFromUrl } from './util.js';

const PRICE_SELECTOR = 'meta[property="og:price:amount"],meta[property="product:price:amount"],meta[itemprop="price"]';
const CURRENCY_SELECTOR = 'meta[property="og:price:currency"],meta[property="product:price:currency"],meta[itemprop="priceCurrency"]';

function withTimeout(signal, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), ms);
  signal?.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

async function viaMicrolink(url, signal) {
  const call = async (withRules) => {
    const qs = new URLSearchParams({ url });
    if (withRules) {
      qs.set('data.price.selector', PRICE_SELECTOR);
      qs.set('data.price.attr', 'content');
      qs.set('data.currency.selector', CURRENCY_SELECTOR);
      qs.set('data.currency.attr', 'content');
    }
    const t = withTimeout(signal, 14000);
    try {
      const res = await fetch(`https://api.microlink.io/?${qs}`, { signal: t.signal });
      const json = await res.json();
      return json;
    } finally {
      t.done();
    }
  };
  let json = await call(true);
  if (json?.status !== 'success') json = await call(false);
  if (json?.status !== 'success') return null;
  const d = json.data || {};
  return {
    title: d.title,
    image: d.image?.url || null,
    price: d.price ?? null,
    currency: d.currency ?? null,
    siteName: d.publisher || null,
  };
}

async function viaEdgeFunction(url, signal) {
  // GET simple (sin headers propios): sin consulta previa de CORS y cacheable por el navegador
  const qs = new URLSearchParams({ url, apikey: CONFIG.supabaseKey });
  const t = withTimeout(signal, 16000);
  try {
    const res = await fetch(`${CONFIG.supabaseUrl.replace(/\/+$/, '')}/functions/v1/link-preview?${qs}`, { signal: t.signal });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    t.done();
  }
}

// Páginas de bloqueo o verificación: su título no es el producto y su imagen suele ser el logo
const BLOCK_TITLE = /access denied|acceso denegado|just a moment|un momento|attention required|forbidden|captcha|are you a robot|eres un robot|verifica|security check|request rejected|not allowed|^error\b|^[45]\d\d\s+(not|forbidden|error|unauthori|bad|service|internal|gateway|too many)|not found|no encontrad/i;
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
function sanitize(r, url) {
  if (!r || !r.title) return r;
  const n = norm(r.title);
  let host = '';
  try { host = new URL(url).hostname; } catch { /* nada */ }
  const labels = host.toLowerCase().split('.').filter((l) => !/^(www|com|cl|net|org|co|ar|mx|pe|br|es)$/.test(l)).map(norm);
  const bare = n.replace(/(chile|cl|oficial|tienda|store|online|shop)+$/, '');
  // Título-slug ("icono-automóvil-gps_y_outdoor") que no comparte palabras con el link: es de otra cosa
  let path = '';
  try { path = decodeURIComponent(new URL(url).pathname).toLowerCase(); } catch { /* nada */ }
  const slugWords = !/\s/.test(r.title) && /[-_]/.test(r.title) ? r.title.toLowerCase().split(/[-_]+/).filter((w) => w.length > 2) : null;
  const foreignSlug = slugWords && slugWords.filter((w) => path.includes(w)).length < 2;
  const looksLikeUrl = /^(https?:\/\/|www\.)|\.(cl|com|net)\//i.test(r.title);
  const weak = BLOCK_TITLE.test(r.title) || n.length < 3 || !/[a-zà-ÿ]{2,}/i.test(r.title) || foreignSlug || looksLikeUrl ||
    (r.siteName && n === norm(r.siteName)) || labels.includes(n) || labels.includes(bare);
  if (!weak) return r;
  const hasPrice = r.price != null && r.price !== '';
  return { ...r, title: null, image: hasPrice ? r.image : null };
}

/** Junta resultados: el primero con dato gana en cada campo (la función propia va primero). */
function mergeResults(list) {
  const out = {};
  for (const r of list) {
    if (!r) continue;
    for (const k of ['title', 'image', 'price', 'currency', 'siteName']) if (out[k] == null || out[k] === '') out[k] = r[k] ?? null;
  }
  return out;
}
const complete = (r) => r && r.title && r.image && r.price != null && r.price !== '';

/**
 * Devuelve { url, store, title, image, price, currency, failed }.
 * Consulta Microlink y la función propia en paralelo y combina lo que traiga cada una:
 * la función propia aporta precio y tiendas que bloquean a Microlink (Zara, VTEX).
 * Nunca lanza error salvo que se cancele con `signal`.
 */
export async function fetchLinkPreview(url, { signal } = {}) {
  const store = domainOf(url);
  const sources = []; // en orden de preferencia
  if (CONFIG.linkPreview?.edgeFunction && CONFIG.supabaseUrl && CONFIG.supabaseKey) sources.push(viaEdgeFunction);
  if (CONFIG.linkPreview?.microlink !== false) sources.push(viaMicrolink);

  const results = new Array(sources.length).fill(null);
  await new Promise((resolve) => {
    let pending = sources.length;
    if (!pending) resolve();
    sources.forEach((source, i) => {
      source(url, signal)
        .then((r) => { results[i] = sanitize(r, url); if (complete(results[i])) resolve(); }) // uno completo basta
        .catch(() => {})
        .finally(() => { if (--pending === 0) resolve(); });
    });
  });
  if (signal?.aborted) throw signal.reason || new DOMException('aborted', 'AbortError');

  const r = mergeResults(results);
  if (r.title || r.image) {
    const currency = (r.currency && /^[A-Z]{3}$/i.test(r.currency) ? r.currency.toUpperCase() : null) || guessCurrency(url);
    const title = cleanTitle(r.title, store);
    return {
      url,
      store,
      title: title || titleFromUrl(url),
      titleFrom: title ? 'page' : 'url',
      image: safeHttpUrl(r.image),
      price: parsePrice(r.price, currency),
      currency,
      failed: false,
    };
  }
  return { url, store, title: titleFromUrl(url), titleFrom: 'url', image: null, price: null, currency: guessCurrency(url), failed: true };
}

/**
 * Combina lo leído por los servicios con lo que trajo el usuario:
 * - hint.t/h/img/p/c: datos sacados por el marcador desde la página que el usuario está viendo (mandan).
 * - hint.st: texto compartido junto al link (ej. app de Mercado Libre): solo reemplaza un nombre sacado del link.
 */
export function applyHint(result, hint, url) {
  if (!hint) return result;
  const store = domainOf(url);
  const r = { ...result };
  const ok = (t) => t && sanitize({ title: t }, url).title;
  // El <h1> suele ser el nombre exacto; se prefiere si el título de la página lo contiene o no sirve
  const t = ok(hint.t) ? hint.t : '';
  const h1 = ok(hint.h) ? hint.h : '';
  const pick = h1 && (!t || t.toLowerCase().includes(h1.toLowerCase().trim())) ? h1 : t || h1;
  const pageTitle = pick ? cleanTitle(pick, store) : '';
  if (pageTitle) { r.title = pageTitle; r.titleFrom = 'page'; }
  else if (r.titleFrom !== 'page' && ok(hint.st)) { r.title = cleanTitle(hint.st, store); r.titleFrom = 'text'; }
  const img = safeHttpUrl(hint.img);
  if (img) r.image = img;
  const currency = hint.c && /^[A-Z]{3}$/i.test(hint.c) ? hint.c.toUpperCase() : r.currency;
  const price = parsePrice(hint.p, currency);
  if (price) { r.price = price; r.currency = currency; }
  r.failed = !(r.title || r.image) && r.failed;
  if (pageTitle || img || price) r.failed = false;
  return r;
}

/** Texto que acompaña al link al compartir ("Mira este producto: Zapatillas X https://…") → posible nombre. */
export function shareTextTitle(raw, url) {
  let t = String(raw || '').replace(/https?:\/\/\S+/gi, ' ');
  const lead = /^\s*(mira|te comparto|te recomiendo|encontr[eé]|echa un vistazo a|look at|check out)\b/i;
  t = (/^[^:]{0,70}:/.test(t) && lead.test(t) ? t.replace(/^[^:]*:/, ' ') : t.replace(lead, ' ').replace(/^\s*(este|esto|esta)( producto)?\b/i, ' '))
    .replace(/\b(en|on) (mercado ?libre|ripley|falabella|paris|lider|amazon|aliexpress)\b.*$/i, ' ')
    .replace(/\s+/g, ' ').replace(/^[\s:\-–|]+|[\s:\-–|]+$/g, '').trim();
  if (!url || t.split(' ').length < 2 || t.length > 200) return '';
  return t;
}
