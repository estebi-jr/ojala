// =====================================================================
// Ojalá · Edge Function "link-preview"
// Lee la página de un producto y devuelve { title, image, price, currency, siteName, source }.
// Trabaja en paralelo con Microlink desde la app: completa lo que a Microlink le falte
// (sobre todo el precio) y cubre tiendas que bloquean a Microlink (ej. Zara).
//
// Fuentes: API de VTEX (…/p), Shopify (/products/…js), API oficial de Mercado Libre (con token), HTML (JSON-LD, og:*, microdatos)
// y reintento como bot de vista previa. Gana el resultado más completo; los demás rellenan.
// Uso: POST {url}  ó  GET ?url=…   (header apikey o ?apikey= con la llave publicable)
// Despliegue: conector Supabase o Dashboard → Edge Functions (verify_jwt desactivado;
// la llave publicable se valida aquí abajo).
// =====================================================================

import postgres from 'npm:postgres@3.4.5';

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
const PREVIEW_UAS: [string, string][] = [
  ['whatsapp', 'WhatsApp/2.23.20.0 A'],
  ['facebook', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
];
const ZERO_DECIMALS = new Set(['CLP', 'JPY', 'KRW', 'PYG', 'VND', 'ISK', 'UGX']);

async function get(url: string, accept = 'text/html,application/xhtml+xml', ua = UA) {
  return await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(9000),
    headers: { 'User-Agent': ua, Accept: accept, 'Accept-Language': 'es-CL,es;q=0.9,en;q=0.6' },
  });
}
type Page = { label: string; status: number; url: string; html: string; err?: string };
const page = (url: string, ua = UA, label = 'safari'): Promise<Page> =>
  get(url, undefined, ua).then(async (r) => ({ label, status: r.status, url: r.url, html: (await r.text()).slice(0, 3_000_000) }))
    .catch((e) => ({ label, status: 0, url, html: '', err: String(e) }));

// Títulos de páginas de bloqueo / verificación (no son el producto)
const BLOCK_TITLE = /access denied|acceso denegado|just a moment|un momento|attention required|forbidden|captcha|are you a robot|eres un robot|verifica|security check|request rejected|^error\b|^404|not found|no encontrad/i;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
function isWeakTitle(t: string | null, host: string, siteName: string | null) {
  if (!t) return true;
  const n = norm(t);
  // "Mercado Libre", "Mercado Libre Chile", "PC Factory"… en articulo.mercadolibre.cl, www.pcfactory.cl
  const labels = host.toLowerCase().split('.').filter((l) => !/^(www|com|cl|net|org|co|ar|mx|pe|br|es)$/.test(l)).map(norm);
  const bare = n.replace(/(chile|cl|oficial|tienda|store|online|shop)+$/, '');
  return BLOCK_TITLE.test(t) || n.length < 3 || !/[a-zà-ÿ]{2,}/i.test(t) || (!!siteName && n === norm(siteName)) || labels.includes(n) || labels.includes(bare);
}

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

// Número de producto en la URL (ej. /producto/55576-microfono… → 55576)
const productId = (u: URL) => (u.pathname.match(/(?:^|[/\-_p])(\d{4,9})(?=[-_/.]|$)/) || [])[1] || null;

// Busca un objeto "producto" (nombre + precio) dentro de JSON embebido (Next.js y similares)
const NAME_KEYS = ['name', 'nombre', 'productName', 'title', 'titulo'];
const PRICE_KEYS = ['price', 'precio', 'finalPrice', 'salePrice', 'bestPrice', 'precioOferta', 'precioNormal', 'offerPrice', 'currentPrice'];
const IMG_KEYS = ['image', 'imagen', 'imageUrl', 'img', 'foto', 'thumbnail', 'images', 'imagenes', 'fotos'];
function jsonProduct(html: string, pid: string | null) {
  type Best = { name: string; price: string; image: string | null; score: number };
  let best = null as Best | null;
  const blocks = html.match(/<script[^>]*type=["']application\/json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of blocks.slice(0, 6)) {
    let data: unknown;
    try { data = JSON.parse(block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '')); } catch { continue; }
    let seen = 0;
    const walk = (o: any, depth: number) => {
      if (!o || typeof o !== 'object' || depth > 14 || ++seen > 40000) return;
      if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
      const nk = NAME_KEYS.find((k) => typeof o[k] === 'string' && /[a-zà-ÿ]{3,}/i.test(o[k]) && o[k].length <= 200);
      const pk = PRICE_KEYS.find((k) => (typeof o[k] === 'number' && o[k] > 0) || (typeof o[k] === 'string' && /\d/.test(o[k]) && o[k].length < 20));
      if (nk && pk) {
        const flat = JSON.stringify(o).slice(0, 4000);
        const score = (pid && flat.includes(pid) ? 10 : 0) + (depth < 8 ? 1 : 0);
        const ik = IMG_KEYS.find((k) => o[k]);
        const img = ik ? (firstImage(o[ik]) || (typeof o[ik]?.[0] === 'object' ? firstImage(o[ik][0]) : null)) : null;
        if (!best || score > best.score) best = { name: o[nk], price: String(o[pk]), image: typeof img === 'string' ? img : null, score };
      }
      for (const k in o) walk(o[k], depth + 1);
    };
    walk(data, 0);
  }
  const b = best as Best | null;
  return b && (b.score >= 10 || !pid) ? b : null; // sin coincidir con el id es muy arriesgado
}

// <title> de la página (los íconos SVG también traen <title>, ej. "icono-automóvil-gps_y_outdoor")
const headTitle = (html: string) => html.replace(/<svg\b[\s\S]*?<\/svg>/gi, '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';

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
  const og = meta['og:title'] || meta['twitter:title'] || '';
  const ldName = typeof product?.name === 'string' ? decode(product.name as string).trim() : '';
  const title = (ldName.length >= 6 && og.toLowerCase().includes(ldName.toLowerCase()) ? ldName : og) || ldName ||
    decode(headTitle(html));
  const image = meta['og:image'] || meta['og:image:secure_url'] || meta['twitter:image'] || ldImage;
  let price = meta['og:price:amount'] || meta['product:price:amount'] || ld.price || meta['price'] || micro?.[1] || null;
  const currency = meta['og:price:currency'] || meta['product:price:currency'] || ld.currency || meta['pricecurrency'] || null;
  // Zara: su JSON-LD divide por 100 aunque el peso no tenga decimales (CLP 14.590 → 145.9).
  // "mainPrice" viene en la unidad menor de la moneda: se convierte según sus decimales.
  if (/(^|\.)zara\.com$/.test(base.hostname)) {
    const zm = html.match(/"mainPrice"\s*:\s*(\d+)/);
    if (zm) price = String(Number(zm[1]) / (ZERO_DECIMALS.has((currency || 'CLP').toUpperCase()) ? 1 : 100));
  }
  let finalTitle = title.replace(/\s+/g, ' ').trim();
  let finalImage = image;
  const pid = productId(base);
  if (!price || !finalImage) {
    const jp = jsonProduct(html, pid);
    if (jp) { price ||= jp.price; finalImage ||= jp.image; if (!og && !ldName) finalTitle = jp.name; }
  }
  // Foto cuya URL contiene el número de producto (ej. …/foto/55576/1_500.jpg)
  if (!finalImage && pid) {
    const re = new RegExp(`(?:https?:)?\\/\\/[^"'\\s()<>]*\\b${pid}\\b[^"'\\s()<>]*\\.(?:jpe?g|png|webp)(?:\\?[^"'\\s()<>]*)?`, 'i');
    finalImage = html.match(re)?.[0] || html.match(new RegExp(`["'](\\/[^"'\\s<>]*\\b${pid}\\b[^"'\\s<>]*\\.(?:jpe?g|png|webp)[^"'\\s<>]*)["']`, 'i'))?.[1] || null;
  }
  return { title: finalTitle || null, image: abs(finalImage, base), price, currency, siteName: meta['og:site_name'] || null, source: 'html' };
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

// ---------- Mercado Libre (API oficial con token; su web bloquea a los servidores) ----------
// Configuración (una vez): en la app de ML marcar Authorization Code + Refresh Token (+ Client Credentials de respaldo),
// secretos ML_CLIENT_ID y ML_CLIENT_SECRET en Supabase y abrir …/functions/v1/link-preview/ml-login para autorizar.
// El token vive en private.ml_token y se renueva solo; si falta, se usa un token de aplicación (Client Credentials).
const ML_AUTH = 'https://auth.mercadolibre.cl/authorization';
const ML_API = Deno.env.get('ML_API_BASE') || 'https://api.mercadolibre.com'; // override solo para pruebas locales
const env = (k: string) => Deno.env.get(k) || '';
const mlCallback = () => `${env('SUPABASE_URL')}/functions/v1/link-preview/ml-callback`;
let sqlClient: any = null;
const db = () => (sqlClient ||= postgres(env('SUPABASE_DB_URL'), { prepare: false, max: 1, idle_timeout: 20 }));
let tokenCache: { access: string; exp: number } | null = null;

async function mlOauth(params: Record<string, string>) {
  const r = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST', signal: AbortSignal.timeout(9000),
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('ML_CLIENT_ID'), client_secret: env('ML_CLIENT_SECRET'), ...params }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(`oauth ${r.status} ${d.error || ''} ${d.message || ''}`);
  console.log(`meli oauth ${params.grant_type}: ${Object.keys(d).join(',')}`); // solo los nombres de los campos
  return d as { access_token: string; refresh_token: string; expires_in: number };
}

async function mlToken(): Promise<string | null> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.access;
  if (!env('ML_CLIENT_ID') || !env('ML_CLIENT_SECRET') || !env('SUPABASE_DB_URL')) return null;
  try {
    return await db().begin(async (tx: any) => {
      const [row] = await tx`select access_token, refresh_token, expires_at, broken from private.ml_token where id = 1 for update`;
      if (!row || row.broken) return null;
      let exp = new Date(row.expires_at).getTime();
      let access = row.access_token as string;
      if (exp < Date.now() + 120_000) { // vence pronto: renovar (el refresh_token es de un solo uso)
        if (!row.refresh_token) {
          await tx`update private.ml_token set broken = true, updated_at = now() where id = 1`;
          console.log('meli token vencido sin refresh_token: volver a autorizar con offline_access');
          return null;
        }
        try {
          const t = await mlOauth({ grant_type: 'refresh_token', refresh_token: row.refresh_token });
          exp = Date.now() + (Number(t.expires_in) || 21600) * 1000;
          access = t.access_token;
          await tx`update private.ml_token set access_token = ${t.access_token}, refresh_token = ${t.refresh_token || ''},
                   expires_at = ${new Date(exp)}, updated_at = now() where id = 1`;
          console.log('meli token renovado');
        } catch (e) {
          console.log(`meli renovación falló: ${e}`);
          await tx`update private.ml_token set broken = true, updated_at = now() where id = 1`;
          return null;
        }
      }
      tokenCache = { access, exp };
      return access;
    });
  } catch (e) { console.log(`meli token error: ${e}`); return null; }
}

// Respaldo: token de aplicación (flujo Client Credentials, sin usuario). Si ML no lo permite, se reintenta cada 10 min.
let appToken: { access: string; exp: number } | null = null;
async function mlAppToken(): Promise<string | null> {
  if (appToken && appToken.exp > Date.now() + 60_000) return appToken.access || null;
  if (!env('ML_CLIENT_ID') || !env('ML_CLIENT_SECRET')) return null;
  try {
    const t = await mlOauth({ grant_type: 'client_credentials' });
    appToken = { access: t.access_token, exp: Date.now() + (Number(t.expires_in) || 21600) * 1000 };
    return appToken.access;
  } catch (e) {
    console.log(`meli client_credentials no disponible: ${e}`);
    appToken = { access: '', exp: Date.now() + 10 * 60_000 };
    return null;
  }
}

// state firmado (HMAC con el secreto de la app) para que la autorización no se pueda falsificar
async function sign(text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env('ML_CLIENT_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
  return [...mac.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Supabase no sirve HTML desde sus funciones (lo pasa a texto plano): respondemos texto legible
const page200 = (msg: string, status = 200) => new Response(`${status === 200 ? '✅' : '⚠️'}  Ojalá · Mercado Libre\n\n${msg}\n`,
  { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

async function mlRoutes(req: Request): Promise<Response | null> {
  const u = new URL(req.url);
  if (!/\/ml-(login|callback)$/.test(u.pathname)) return null;
  if (!env('ML_CLIENT_ID') || !env('ML_CLIENT_SECRET')) return page200('Faltan los secretos ML_CLIENT_ID y ML_CLIENT_SECRET en Supabase.', 500);
  const [row] = await db()`select broken, refresh_token from private.ml_token where id = 1`;
  const linked = row && !row.broken && !!row.refresh_token;
  if (u.pathname.endsWith('/ml-login')) {
    if (linked) return page200('Mercado Libre ya está conectado a Ojalá. No hay nada que hacer.');
    const ts = String(Date.now());
    const state = `${ts}.${await sign(ts)}`;
    const to = `${ML_AUTH}?${new URLSearchParams({ response_type: 'code', client_id: env('ML_CLIENT_ID'), redirect_uri: mlCallback(), state })}`;
    return new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } });
  }
  // ml-callback
  const code = u.searchParams.get('code') || '';
  const [ts, mac] = (u.searchParams.get('state') || '').split('.');
  if (!code || !ts || mac !== await sign(ts) || Date.now() - Number(ts) > 15 * 60_000) return page200('El enlace de autorización no es válido o venció. Vuelve a abrir el link de conexión.', 400);
  if (linked) return page200('Mercado Libre ya estaba conectado. No cambié nada.');
  try {
    const t = await mlOauth({ grant_type: 'authorization_code', code, redirect_uri: mlCallback() });
    const exp = new Date(Date.now() + (Number(t.expires_in) || 21600) * 1000);
    const refresh = t.refresh_token || ''; // ML solo lo entrega si la app tiene el permiso offline_access
    await db()`insert into private.ml_token (id, access_token, refresh_token, expires_at, broken)
               values (1, ${t.access_token}, ${refresh}, ${exp}, false)
               on conflict (id) do update set access_token = excluded.access_token, refresh_token = excluded.refresh_token,
               expires_at = excluded.expires_at, broken = false, updated_at = now()`;
    tokenCache = { access: t.access_token, exp: exp.getTime() };
    console.log(`meli conectado (refresh_token: ${refresh ? 'sí' : 'NO'})`);
    if (!refresh) return page200('Conectado, pero solo por 6 horas: Mercado Libre no entregó el permiso para renovarlo.\n\nEn tu app de developers.mercadolibre.cl activa "offline_access" (acceso sin conexión), guarda y vuelve a abrir el link de conexión.', 202);
    return page200('¡Listo! Mercado Libre quedó conectado a Ojalá. Ya puedes cerrar esta pestaña.');
  } catch (e) {
    console.log(`meli callback error: ${e}`);
    return page200(`Mercado Libre no aceptó la autorización (${String((e as Error)?.message || e).slice(0, 120)}). Revisa que el Redirect URI de tu app sea exactamente el que te di.`, 502);
  }
}

async function mercadolibre(u: URL): Promise<Result | null> {
  if (!/(^|\.)mercadoli[bv]re\.(cl|com(\.[a-z]{2})?)$/i.test(u.hostname)) return null;
  const s = (() => { try { return decodeURIComponent(u.href); } catch { return u.href; } })();
  const prod = s.match(/\/p\/(ML[A-Z]\d{5,})/i)?.[1]?.toUpperCase();
  const up = s.match(/\/up\/(ML[A-Z]U\d{5,})/i)?.[1]?.toUpperCase();
  const item = [...s.matchAll(/(?:wid=|item_id[=:]|\/|-)(ML[A-Z])-?(\d{7,})/gi)]
    .map((m) => `${m[1]}${m[2]}`.toUpperCase()).find((id) => id !== prod) || null;
  if (!prod && !up && !item) return null;
  const token = (await mlToken()) || (await mlAppToken());
  if (!token) { console.log('meli sin token: falta conectar la app'); return null; }
  const api = async (path: string) => {
    try {
      const r = await fetch(`${ML_API}${path}`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
      console.log(`meli ${path} ${r.status}`);
      return r.ok ? await r.json() : null;
    } catch (e) { console.log(`meli ${path} error ${e}`); return null; }
  };
  const pic = (x: any) => x?.secure_url || x?.url || null;
  const out: Result = { title: null, image: null, price: null, currency: null, siteName: 'Mercado Libre', source: 'meli' };
  const fill = (title: unknown, image: unknown, price: unknown, cur: unknown) => {
    out.title ||= typeof title === 'string' ? title : null;
    out.image ||= typeof image === 'string' ? image : null;
    if (!out.price && price != null && price !== '') { out.price = String(price); out.currency = typeof cur === 'string' ? cur : null; }
  };
  // 1) la publicación concreta (trae precio); 2) catálogo; 3) "user product" (links /up/ de la app).
  // Ojo (oct 2026): ML responde 403 a /items y /user-products de publicaciones ajenas; solo /products (catálogo, links /p/) funciona.
  const [it, pr, us] = await Promise.all([
    item ? api(`/items/${item}`) : null,
    prod ? api(`/products/${prod}`) : null,
    up ? api(`/user-products/${up}`) : null,
  ]);
  if (it) fill(it.title, pic(it.pictures?.[0]) || it.thumbnail, it.price, it.currency_id);
  if (pr) fill(pr.name, pic(pr.pictures?.[0]), pr.buy_box_winner?.price, pr.buy_box_winner?.currency_id);
  if (us) fill(us.name, pic(us.pictures?.[0]), null, null);
  if (!out.price && prod) {
    const offers = await api(`/products/${prod}/items?limit=1`);
    const o = offers?.results?.[0];
    if (o) fill(null, null, o.price, o.currency_id);
  }
  return out.title || out.image || out.price ? out : null;
}

const merge = (a: Result, b: Result | null): Result => !b ? a : ({
  title: a.title || b.title, image: a.image || b.image, price: a.price || b.price,
  currency: a.currency || b.currency, siteName: a.siteName || b.siteName,
  source: [a.source, b.source].filter((s) => s && s !== 'none').join('+') || 'none',
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try { const r = await mlRoutes(req); if (r) return r; } catch (e) { return page200(`Error: ${(e as Error)?.message || e}`, 500); }
  const qs = new URL(req.url).searchParams;
  const key = req.headers.get('apikey') || qs.get('apikey');
  if (key !== PUBLISHABLE_KEY) return json({ error: 'unauthorized' }, 401);
  try {
    const raw = req.method === 'POST' ? (await req.json()).url : qs.get('url');
    const target = new URL(String(raw));
    if (!/^https?:$/.test(target.protocol) || isBlockedHost(target.hostname)) return json({ error: 'url' }, 400);
    const debug = qs.get('debug') === '1';

    // APIs de plataforma + HTML en paralelo; si falta algo, reintenta como bot de vista previa
    const [v, s, ml, pg] = await Promise.all([vtex(target), shopify(target), mercadolibre(target), page(target.href)]);
    const pages: Page[] = [pg];
    const cands: Result[] = [v, s, ml].filter(Boolean) as Result[];
    // Links cortos (ej. mercadolibre.cl/sec/…): reintenta la API con la URL final
    if (!ml && pg.url && pg.url !== target.href) { try { const m2 = await mercadolibre(new URL(pg.url)); if (m2) cands.push(m2); } catch { /* nada */ } }
    const fromPage = (p: Page): Result | null => {
      if (!p.html) return null;
      const h = parseHtml(p.html, new URL(p.url || target.href));
      if (isWeakTitle(h.title, target.hostname, h.siteName)) {
        h.title = null;
        if (!h.price) h.image = null; // página de bloqueo: su imagen suele ser el logo
      }
      return { ...h, source: p.label };
    };
    const score = (r: Result) => (r.price ? 4 : 0) + (r.image ? 2 : 0) + (r.title ? 1 : 0);
    const best = () => cands.reduce((m, r) => Math.max(m, score(r)), 0);
    const h0 = fromPage(pg); if (h0) cands.push(h0);
    if (best() < 7) {
      const bots = await Promise.all(PREVIEW_UAS.map(([label, ua]) => page(target.href, ua, label)));
      for (const b of bots) { pages.push(b); const h = fromPage(b); if (h) cands.push(h); }
    }
    // El candidato más completo manda; los demás rellenan (empate: orden original)
    const ranked = cands.map((r, i) => ({ r, i })).sort((a, b) => score(b.r) - score(a.r) || a.i - b.i).map((x) => x.r);
    let out: Result = { ...EMPTY };
    for (const r of ranked) out = merge(out, r);
    console.log(JSON.stringify({
      host: target.hostname, path: target.pathname.slice(0, 80), src: out.source,
      got: `${out.title ? 'T' : '-'}${out.image ? 'I' : '-'}${out.price ? 'P' : '-'}`,
      pages: pages.map((p) => `${p.label}:${p.status}:${p.html.length}:${headTitle(p.html).slice(0, 50)}`),
    }));
    if (debug) {
      let re: RegExp | null = null;
      try { re = qs.get('find') ? new RegExp(qs.get('find')!, 'gi') : null; } catch { /* regex inválida */ }
      return json({ ...out, debug: pages.map((p) => ({
        label: p.label, status: p.status, url: p.url, bytes: p.html.length, err: p.err,
        title: p.html.match(/<title[^>]*>([\s\S]{0,120})/i)?.[1] ?? null,
        ld: (p.html.match(/application\/ld\+json/gi) || []).length,
        find: re ? [...p.html.matchAll(re)].slice(0, 15).map((m) => m[0].slice(0, 240)) : undefined,
      })) });
    }
    return json(out);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 400);
  }
});
