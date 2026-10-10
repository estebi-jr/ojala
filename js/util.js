// Utilidades pequeñas y sin dependencias
import { CONFIG } from './config.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapa texto para insertarlo en HTML (siempre úsalo con datos del usuario). */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function randomToken(bytes = 24) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function randomSlug(n = 9) {
  const a = crypto.getRandomValues(new Uint8Array(n));
  return [...a].map((x) => SLUG_ALPHABET[x % SLUG_ALPHABET.length]).join('');
}

// ---------- Almacenamiento seguro (puede fallar en modo privado o vistas previas) ----------
const memory = new Map();
export const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch { /* sin acceso a localStorage */ }
    return memory.has(key) ? memory.get(key) : fallback;
  },
  set(key, value) {
    memory.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
  remove(key) {
    memory.delete(key);
    try { localStorage.removeItem(key); } catch { /* nada */ }
  },
};

// ---------- Fechas ----------
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function parseDate(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function daysUntil(s) {
  const t = parseDate(s);
  if (!t) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((t - now) / 864e5);
}

export function formatDateLong(s) {
  const d = parseDate(s);
  if (!d) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}${sameYear ? '' : ` de ${d.getFullYear()}`}`;
}

export function formatDateShort(s) {
  const d = parseDate(s);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function countdownText(s) {
  const n = daysUntil(s);
  if (n == null) return '';
  if (n > 1) return `faltan ${n} días`;
  if (n === 1) return 'es mañana';
  if (n === 0) return 'es hoy';
  if (n === -1) return 'fue ayer';
  return `fue hace ${-n} días`;
}

export function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- Precios ----------
const ZERO_DECIMALS = new Set(['CLP', 'JPY', 'KRW', 'PYG', 'VND', 'ISK']);

/**
 * Convierte "18.990", "$23.000,00", "1,299.50" o 18990 en número.
 * En pesos chilenos "18.990" son dieciocho mil novecientos noventa.
 */
export function parsePrice(input, currency = CONFIG.defaultCurrency) {
  if (input == null || input === '') return null;
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? input : null;
  const s = String(input).replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return null;
  let intPart = s;
  let decPart = '';
  const last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  if (last >= 0) {
    const sep = s[last];
    const other = sep === '.' ? ',' : '.';
    const after = s.slice(last + 1);
    const isDecimal = (after.length > 0 && after.length <= 2) || (s.includes(other) && after.length !== 3);
    if (isDecimal) { intPart = s.slice(0, last); decPart = after; }
  }
  const digits = intPart.replace(/[.,]/g, '');
  let value = Number(digits || '0') + (decPart ? Number(`0.${decPart}`) : 0);
  if (ZERO_DECIMALS.has(currency)) value = Math.round(value);
  return Number.isFinite(value) ? value : null;
}

export function formatPrice(value, currency = CONFIG.defaultCurrency) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '';
  const v = Number(value);
  const decimals = ZERO_DECIMALS.has(currency) || Number.isInteger(v) ? 0 : 2;
  try {
    return new Intl.NumberFormat(CONFIG.locale, { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
  } catch {
    return `${currency} ${v}`;
  }
}

export const CURRENCIES = ['CLP', 'USD', 'EUR', 'ARS', 'MXN', 'PEN', 'COP', 'BRL'];

export function guessCurrency(url) {
  const host = domainOf(url);
  if (/\.cl$/.test(host)) return 'CLP';
  if (/\.ar$/.test(host)) return 'ARS';
  if (/\.mx$/.test(host)) return 'MXN';
  if (/\.pe$/.test(host)) return 'PEN';
  if (/\.co$/.test(host)) return 'COP';
  if (/\.br$/.test(host)) return 'BRL';
  if (/\.(es|fr|de|it|nl|pt)$/.test(host)) return 'EUR';
  return CONFIG.defaultCurrency;
}

// ---------- URLs ----------
const TRACKING = /^(utm_\w+|srsltid|gclid|fbclid|gad_source|gbraid|wbraid|_gl|mc_cid|mc_eid|ref_src)$/i;

/** Extrae y limpia una URL (acepta texto pegado con más cosas alrededor). */
export function normalizeUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/https?:\/\/[^\s<>"']+/i);
  if (m) s = m[0];
  else if (/^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(s)) s = `https://${s}`;
  else return null;
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol)) return null;
    [...u.searchParams.keys()].forEach((k) => { if (TRACKING.test(k)) u.searchParams.delete(k); });
    return u.href;
  } catch {
    return null;
  }
}

export function safeHttpUrl(u) {
  try {
    const x = new URL(u);
    return /^https?:$/.test(x.protocol) ? x.href : null;
  } catch {
    return null;
  }
}

export function safeImageSrc(u) {
  if (typeof u !== 'string' || !u) return null;
  if (/^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(u)) return u;
  return safeHttpUrl(u);
}

export function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

export const faviconUrl = (domain) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

/** Pasa las fotos externas por un CDN que las achica (con respaldo a la original si falla). */
export function proxiedImage(src, size = 640) {
  if (!src || src.startsWith('data:') || !CONFIG.imageProxy) return src;
  return `https://images.weserv.nl/?url=${encodeURIComponent(src)}&w=${size}&h=${size}&fit=inside&we&output=webp&q=82`;
}

/** Título a partir de la URL cuando no podemos leer la página. */
export function titleFromUrl(url) {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
    const words = (s) => s.replace(/\.(html?|php|aspx?|jsp)$/i, '').split(/[-_+\s]+/).filter((w) => /[a-záéíóúñ]{2,}/i.test(w)).length;
    const best = segs.reduce((a, b) => (words(b) >= words(a) ? b : a), '');
    if (words(best) < 2) return '';
    let t = best
      .replace(/\.(html?|php|aspx?|jsp)$/i, '')
      .replace(/[-_+]+/g, ' ')
      .replace(/\b(ML[A-Z])\b/g, '')
      .replace(/\b[a-z]{0,2}\d{5,}\b/gi, '')
      .replace(/\bJM\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    // códigos de producto al final ("… a1959 0146"), sin tocar "501", "90s" ni "256"
    let prev;
    do { prev = t; t = t.replace(/\s+(?:[a-z]{1,3}\d{4,}[a-z]?|\d{4,})$/i, '').trim(); } while (t !== prev);
    if (t.length < 4) return '';
    t = t.toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  } catch {
    return '';
  }
}

/** Limpia títulos de tiendas: "Plumón X ⚡𝗖𝘆𝗯𝗲𝗿 | Falabella Chile" → "Plumón X" */
export function cleanTitle(raw, domain = '') {
  if (!raw) return '';
  let t = String(raw).normalize('NFC')
    .replace(/[\u{1D400}-\u{1D7FF}]+/gu, '')
    .replace(/⚡️?/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const root = (domain.split('.')[0] || '').toLowerCase();
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let parts = t.split(/\s+[|–—•·]\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    const kept = parts.filter((p) => !(root && norm(p).includes(root) && p.length < 40));
    parts = kept.length ? kept : parts;
    t = parts.reduce((a, b) => (b.length > a.length ? b : a), '');
  }
  const dash = t.match(/^(.*\S)\s+-\s+([^-]{2,40})$/);
  if (dash && root && norm(dash[2]).includes(root)) t = dash[1];
  // Palabras con forma de slug ("55576-hollyland-microfono-…", sola o dentro del título): a palabras, sin el código inicial
  if (/[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+){2,}/u.test(t)) {
    t = t.split(' ').map((w) => (/^[\p{L}\p{N}?=&.]+(?:[-_][\p{L}\p{N}?=&.]+){2,}$/u.test(w)
      ? w.replace(/\?.*$/, '').replace(/^[a-z]{0,3}\d{3,}[-_]+/i, '').replace(/[-_]+/g, ' ') : w)).join(' ');
    t = t.replace(/^\d{4,}\s+/, '').replace(/\s+/g, ' ').trim();
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  const letters = t.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '').length;
  if (letters.length > 8 && upper / letters.length > 0.75) t = t.charAt(0) + t.slice(1).toLowerCase();
  return t.slice(0, 160).trim();
}

// ---------- Emojis de respaldo según el nombre del deseo ----------
const EMOJI_RULES = [
  [/perfum|colonia|fragancia|\bed[pt]\b/i, '🧴'],
  [/aud[ií]fono|headphone|airpods|parlante|speaker|earbuds/i, '🎧'],
  [/zapatill|sneaker|zapato|bot[ií]n|sandalia/i, '👟'],
  [/polera|camis|pol[eé]r[oó]n|sudadera|hoodie|chaqueta|parka|ropa|short|pantal|jean|vestido|falda|calcet/i, '👕'],
  [/libro|novela|c[oó]mic|manga/i, '📚'],
  [/caf[eé]|cafetera|taza|mug|\bt[eé]\b/i, '☕'],
  [/planta|macetero|suculenta|flor/i, '🪴'],
  [/consola|playstation|ps5|xbox|nintendo|switch|videojuego|joystick/i, '🎮'],
  [/juego|lego|puzzle|rompecabeza|rummi|naipe|uno\b|catan/i, '🎲'],
  [/reloj|watch/i, '⌚'],
  [/c[aá]mara|instax|polaroid/i, '📷'],
  [/\bbip\b|tarjeta|recarga/i, '💳'],
  [/dinero|plata|efectivo|aporte|transferencia|gift ?card|cariño/i, '💰'],
  [/viaje|pasaje|vuelo|hotel|vacaciones|luna de miel/i, '✈️'],
  [/entrada|ticket|concierto|cine|teatro|festival/i, '🎟️'],
  [/chocolate|dulce|takis|snack|galleta|helado/i, '🍫'],
  [/vino|cerveza|pisco|whisky|\bgin\b|espumante/i, '🍷'],
  [/peluche|juguete|mu[ñn]eca|figura/i, '🧸'],
  [/beb[eé]|pa[ñn]al|cuna|mamadera|chupete|body\b|coche/i, '🍼'],
  [/olla|sart[eé]n|cocina|cuchillo|batidora|licuadora|air ?fryer|freidora|horno/i, '🍳'],
  [/s[aá]bana|plum[oó]n|almohada|cobertor|toalla|frazada/i, '🛏️'],
  [/mochila|bolso|cartera|billetera|maleta/i, '🎒'],
  [/lentes|anteojos|gafas/i, '🕶️'],
  [/joya|\baros?\b|collar|anillo|pulsera/i, '💍'],
  [/bici|bicicleta|casco|patineta|skate/i, '🚲'],
  [/pesa|mancuerna|gym|gimnasio|prote[ií]na|whey|lastre|yoga|creatina/i, '🏋️'],
  [/maquillaje|labial|crema|skincare|s[eé]rum|bloqueador/i, '💄'],
  [/celular|iphone|tel[eé]fono|tablet|ipad|notebook|laptop|computador/i, '📱'],
  [/vela|aroma|difusor/i, '🕯️'],
  [/cuadro|p[oó]ster|l[aá]mina|arte|marco/i, '🖼️'],
  [/vinilo|guitarra|piano|ukelele|m[uú]sica/i, '🎸'],
  [/experiencia|cena|restaurant|spa|masaje|clase/i, '🍽️'],
  [/afeitad|oneblade|repuesto|cuchilla|barber/i, '🪒'],
  [/perro|gato|mascota/i, '🐾'],
];

export function guessEmoji(text = '') {
  for (const [re, e] of EMOJI_RULES) if (re.test(text)) return e;
  return '🎁';
}

export const EMOJI_CHOICES = ['🎁', '💰', '🎧', '👟', '👕', '📚', '🧴', '☕', '🎮', '🎲', '⌚', '📷', '🪴', '🍫', '🍷', '✈️', '🎟️', '🧸', '🍼', '🍳', '🛏️', '🎒', '💍', '🏋️', '💄', '📱', '🕯️', '🖼️', '🎸', '🍽️', '💳', '🐾'];

// ---------- Imágenes ----------
/** Achica una foto subida y la devuelve como data URL liviana. */
export async function fileToDataUrl(file, { max = 720, quality = 0.82, square = false } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image'));
      i.src = url;
    });
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    let sx = 0;
    let sy = 0;
    if (square) {
      const side = Math.min(sw, sh);
      sx = (sw - side) / 2; sy = (sh - side) / 2; sw = side; sh = side;
    }
    const scale = Math.min(1, max / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    let out = c.toDataURL('image/webp', quality);
    if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', quality);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function pickFile(accept = 'image/*') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.addEventListener('change', () => { resolve(input.files?.[0] || null); input.remove(); }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '✦';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Abre un link externo en otra pestaña usando un <a> real (más compatible que window.open). */
export function openExternal(url) {
  const safe = safeHttpUrl(url);
  if (!safe) return;
  const a = document.createElement('a');
  a.href = safe;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const haptic = () => { try { if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(8); } catch { /* nada */ } };

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
