// =====================================================================
// Ojalá · Edge Function "link-preview"
// Lee la página de un producto y devuelve { title, image, price, currency, siteName, source }.
// Trabaja en paralelo con Microlink desde la app: completa lo que a Microlink le falte
// (sobre todo el precio) y cubre tiendas que bloquean a Microlink (ej. Zara).
//
// Fuentes, en orden: API de VTEX (…/p) → Shopify (/products/…js) → HTML (JSON-LD, og:*, microdatos).
// Uso: POST {url}  ó  GET ?url=…   (header apikey o ?apikey= con la llave publicable)
// Despliegue: conector Supabase o Dashboard → Edge Functions (verify_jwt desactivado;
// la llave publicable se valida aquí abajo).
// =====================================================================

const PUBLISHABLE_KEY = 'sb_publishable_AV3N2M7WRlriM09hMLpMaQ_aw0C2b2A';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } });

type Result = { title: string | null; image: string | null; price: string | null; currency: string | null; siteName: string | null; source: string };
const EMPTY: Result = { title: null, image: null, price: null, currency: null, siteName: null, source: 'none' };

// ---------- Seguridad básica: no leer redes internas ----------
function isBlockedHost(host: string) {
  return /^(localhost|0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd])/i.test(host) ||
    host.endsWith('.internal') || host.endsWith('.local') || !host.includes('.');
}

// Bots de vista previa: muchas tiendas (ej. Zara) bloquean IPs de servidor pero sí les sirven la página a estos
const PREVIEW_UAS = [
  'WhatsApp/2.23.20.0 A',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
];
const ZERO_DECIMALS = new Set(['CLP', 'JPY', 'KRW', 'PYG', 'VND', 'ISK', 'UGX']);

async function get(url: string, accept = 'text/html,application/xhtml+xml', ua = UA) {
  return await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(9000),
    headers: { 'User-Agent': ua, Accept: accept, 'Accept-Language': 'es-CL,es;q=0.9,en;q=0.6' },
  });
}
const page = (url: string, ua = UA) =>
  get(url, undefined, ua).then(async (r) => ({ status: r.status, url: r.url, html: (await r.text()).slice(0, 3_000_000) }))
    .catch((e) => ({ status: 0, url, html: '', err: String(e) }));

// ---------- Utilidades de HTML ----------
function attrs(tag: string) {
  const out: Record<string, string> = {};
  const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  return out;
}
function decode(s = '') {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
const abs = (u: unknown, base: URL) => {
  if (!u || typeof u !== 'string') return null;
  try { return new URL(u.startsWith('//') ? `https:${u}` : u, base).href; } catch { return null; }
};
const firstImage = (img: unknown): string | null => {
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return firstImage(img[0]);
  if (typeof img === 'object') return (img as Record<string, string>).url || (img as Record<string, string>).contentUrl || null;
  return null;
};

// ---------- JSON-LD ----------
function collectProducts(node: unknown, out: Record<string, unknown>[] = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach((n) => collectProducts(n, out)); return out; }
  const o = node as Record<string, unknown>;
  const t = o['@type'];
  const types = Array.isArray(t) ? t : [t];
  if (types.includes('Product') || types.includes('ProductGroup')) out.push(o);
  if (o['@graph']) collectProducts(o['@graph'], out);
  if (o.hasVariant) collectProducts(o.hasVariant, out);
  return out;
}
function offerPrice(offers: unknown): { price: string | null; currency: string | null } {
  if (!offers) return { price: null, currency: null };
  const list = (Array.isArray(offers) ? offers : [offers]) as Record<string, unknown>[];
  for (const of of list) {
    if (!of || typeof of !== 'object') continue;
    const spec = (Array.isArray(of.priceSpecification) ? of.priceSpecification[0] : of.priceSpecification) as Record<string, unknown> | undefined;
    const p = of.price ?? of.lowPrice ?? spec?.price;
    if (p != null && p !== '') return { price: String(p), currency: (of.priceCurrency ?? spec?.priceCurrency ?? null) as string | null };
    if (of.offers) { const r = offerPrice(of.offers); if (r.price) return r; }
  }
  return { price: null, currency: null };
}

export function parseHtml(html: string, base: URL): Result {
  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content && !(key in meta)) meta[key] = decode(a.content);
  }
  let product: Record<string, unknown> | null = null;
  let ld = { price: null as string | null, currency: null as string | null };
  let ldImage: string | null = null;
  for (const block of html.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []) {
    try {
      const body = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
      for (const p of collectProducts(JSON.parse(body))) {
        product ||= p;
        ldImage ||= firstImage(p.image);
        if (!ld.price) ld = offerPrice(p.offers);
      }
    } catch { /* JSON-LD inválido */ }
  }
  // microdatos: <span itemprop="price" content="…">
  const micro = html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i) || html.match(/content=["']([\d.,]+)["'][^>]*itemprop=["']price["']/i);
  const title = meta['og:title'] || meta['twitter:title'] || (product?.name as string) || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '');
  const image = meta['og:image'] || meta['og:image:secure_url'] || meta['twitter:image'] || ldImage;
  let price = meta['og:price:amount'] || meta['product:price:amount'] || ld.price || meta['price'] || micro?.[1] || null;
  const currency = meta['og:price:currency'] || meta['product:price:currency'] || ld.currency || meta['pricecurrency'] || null;
  // Zara: su JSON-LD divide por 100 aunque el peso no tenga decimales (CLP 14.590 → 145.9).
  // "mainPrice" viene en la unidad menor de la moneda: se convierte según sus decimales.
  if (/(^|\.)zara\.com$/.test(base.hostname)) {
    const zm = html.match(/"mainPrice"\s*:\s*(\d+)/);
    if (zm) price = String(Number(zm[1]) / (ZERO_DECIMALS.has((currency || 'CLP').toUpperCase()) ? 1 : 100));
  }
  return { title: title.trim() || null, image: abs(image, base), price, currency, siteName: meta['og:site_name'] || null, source: 'html' };
}

// ---------- VTEX (Levi's, AE y muchas tiendas chilenas) ----------
async function vtex(target: URL): Promise<Result | null> {
  const m = target.pathname.match(/^\/(.+)\/p\/?$/);
  if (!m) return null;
  try {
    const res = await get(`${target.origin}/api/catalog_system/pub/products/search/${m[1]}/p`, 'application/json');
    if (!res.ok) return null;
    const data = await res.json();
    const p = Array.isArray(data) ? data[0] : null;
    if (!p) return null;
    const items = (p.items || []) as Record<string, any>[];
    let price: number | null = null;
    for (const it of items) for (const s of it.sellers || []) {
      const v = s.commertialOffer?.Price;
      if (typeof v === 'number' && v > 0 && (s.commertialOffer?.AvailableQuantity ?? 1) > 0 && (price == null || v < price)) price = v;
    }
    if (price == null) for (const it of items) for (const s of it.sellers || []) { const v = s.commertialOffer?.Price; if (typeof v === 'number' && v > 0) { price = v; break; } }
    return {
      title: p.productName || null,
      image: items[0]?.images?.[0]?.imageUrl || null,
      price: price != null ? String(price) : null,
      currency: null,
      siteName: p.brand || null,
      source: 'vtex',
    };
  } catch { return null; }
}

// ---------- Shopify ----------
async function shopify(target: URL): Promise<Result | null> {
  if (!/\/products\//.test(target.pathname)) return null;
  try {
    const res = await get(`${target.origin}${target.pathname.replace(/\/$/, '')}.js`, 'application/json');
    if (!res.ok) return null;
    const p = await res.json();
    return {
      title: p.title || null,
      image: abs(p.featured_image || p.images?.[0], target),
      price: typeof p.price === 'number' ? String(p.price / 100) : null,
      currency: null,
      siteName: target.hostname.replace(/^www\./, ''),
      source: 'shopify',
    };
  } catch { return null; }
}

const merge = (a: Result, b: Result | null): Result => !b ? a : ({
  title: a.title || b.title, image: a.image || b.image, price: a.price || b.price,
  currency: a.currency || b.currency, siteName: a.siteName || b.siteName,
  source: [a.source, b.source].filter((s) => s && s !== 'none').join('+') || 'none',
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const qs = new URL(req.url).searchParams;
  const key = req.headers.get('apikey') || qs.get('apikey');
  if (key !== PUBLISHABLE_KEY) return json({ error: 'unauthorized' }, 401);
  try {
    const raw = req.method === 'POST' ? (await req.json()).url : qs.get('url');
    const target = new URL(String(raw));
    if (!/^https?:$/.test(target.protocol) || isBlockedHost(target.hostname)) return json({ error: 'url' }, 400);
    const debug = qs.get('debug') === '1';

    // APIs de plataforma primero (datos exactos), en paralelo con el HTML
    const [v, s, pg] = await Promise.all([vtex(target), shopify(target), page(target.href)]);
    let out: Result = { ...EMPTY };
    out = merge(out, v);
    out = merge(out, s);
    // Una página sin foto ni precio suele ser un bloqueo antibots: su título queda solo como último recurso
    let weakTitle: string | null = null;
    if (pg.html) {
      const h = parseHtml(pg.html, new URL(pg.url || target.href));
      if (h.image || h.price) out = merge(out, h); else weakTitle = h.title;
    }
    // ¿Faltó foto o precio? Reintenta como bot de vista previa (en paralelo)
    const pages = [pg];
    if (!out.image || !out.price) {
      const bots = await Promise.all(PREVIEW_UAS.map((ua) => page(target.href, ua)));
      for (const b of bots) {
        if (!b.html) continue;
        pages.push(b);
        const h = parseHtml(b.html, new URL(b.url || target.href));
        if (h.image || h.price) out = merge(out, { ...h, source: 'bot' }); else weakTitle ||= h.title;
      }
    }
    out.title ||= weakTitle;
    if (debug) {
      return json({ ...out, debug: pages.map((p) => ({
        status: p.status, bytes: p.html.length, ld: (p.html.match(/application\/ld\+json/gi) || []).length,
        around: [...p.html.matchAll(/price/gi)].slice(0, 6).map((m) => p.html.slice(Math.max(0, m.index! - 60), m.index! + 80).replace(/\s+/g, ' ')),
      })) });
    }
    return json(out);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 400);
  }
});
