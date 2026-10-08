// =====================================================================
// Ojalá · Edge Function "link-preview" (OPCIONAL)
// Lee la página de un producto y devuelve { title, image, price, currency, siteName }.
// Sirve de respaldo si el servicio gratuito (Microlink) falla o se agota.
//
// Instalar: Supabase → Edge Functions → "Deploy a new function" → "Via Editor"
//           nombre: link-preview → pega este archivo → Deploy.
// Luego en js/config.js: linkPreview: { microlink: true, edgeFunction: true }
// =====================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Evita que la función se use para leer redes internas
function isBlockedHost(host: string) {
  return /^(localhost|0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?fc|\[?fd)/i.test(host) || host.endsWith('.internal') || host.endsWith('.local');
}

function attrs(tag: string) {
  const out: Record<string, string> = {};
  const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  return out;
}

function decode(s = '') {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function findProduct(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) { const f = findProduct(n); if (f) return f; }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return obj;
  return findProduct(obj['@graph']) || null;
}

export function parseHtml(html: string, base: URL) {
  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content && !(key in meta)) meta[key] = decode(a.content);
  }
  let product: Record<string, unknown> | null = null;
  for (const block of html.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []) {
    try {
      const body = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
      product = findProduct(JSON.parse(body));
      if (product) break;
    } catch { /* JSON-LD inválido: se ignora */ }
  }
  const offers = product?.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const offer = Array.isArray(offers) ? offers[0] : offers;
  const ldImage = product?.image;
  const image = meta['og:image'] || meta['og:image:secure_url'] || meta['twitter:image'] ||
    (typeof ldImage === 'string' ? ldImage : Array.isArray(ldImage) ? String(ldImage[0] ?? '') : (ldImage as Record<string, string> | undefined)?.url) || '';
  const title = meta['og:title'] || meta['twitter:title'] || (product?.name as string) || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '');
  const price = meta['og:price:amount'] || meta['product:price:amount'] || meta['price'] ||
    (offer?.price ?? offer?.lowPrice ?? '') as string;
  const currency = meta['og:price:currency'] || meta['product:price:currency'] || meta['pricecurrency'] || (offer?.priceCurrency as string) || '';
  return {
    title: title || null,
    image: image ? new URL(image, base).href : null,
    price: price ? String(price) : null,
    currency: currency || null,
    siteName: meta['og:site_name'] || null,
  };
}

async function shopify(target: URL) {
  if (!/\/products\//.test(target.pathname)) return null;
  try {
    const res = await fetch(`${target.origin}${target.pathname.replace(/\/$/, '')}.js`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const p = await res.json();
    const img = p.featured_image || p.images?.[0];
    return {
      title: p.title || null,
      image: img ? new URL(img.startsWith('//') ? `https:${img}` : img, target).href : null,
      price: typeof p.price === 'number' ? String(p.price / 100) : null,
      currency: null,
      siteName: target.hostname.replace(/^www\./, ''),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const { url } = await req.json();
    const target = new URL(String(url));
    if (!/^https?:$/.test(target.protocol) || isBlockedHost(target.hostname)) return json({ error: 'url' }, 400);

    const res = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-CL,es;q=0.9,en;q=0.6',
      },
    });
    const html = (await res.text()).slice(0, 2_000_000);
    const data = parseHtml(html, new URL(res.url || target.href));
    if (!data.price || !data.image) {
      const s = await shopify(target);
      if (s) return json({ ...s, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v)) , price: data.price || s.price, image: data.image || s.image });
    }
    return json(data);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 400);
  }
});
