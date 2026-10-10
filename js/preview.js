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
const BLOCK_TITLE = /access denied|acceso denegado|just a moment|un momento|attention required|forbidden|captcha|are you a robot|eres un robot|verifica|security check|request rejected|^error\b|^404|not found|no encontrad/i;
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
  const weak = BLOCK_TITLE.test(r.title) || n.length < 3 || !/[a-zà-ÿ]{2,}/i.test(r.title) || foreignSlug ||
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
    return {
      url,
      store,
      title: cleanTitle(r.title, store) || titleFromUrl(url),
      image: safeHttpUrl(r.image),
      price: parsePrice(r.price, currency),
      currency,
      failed: false,
    };
  }
  return { url, store, title: titleFromUrl(url), image: null, price: null, currency: guessCurrency(url), failed: true };
}
