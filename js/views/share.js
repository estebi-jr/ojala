// Hoja "Compartir": copiar enlace, apps, código QR y enlace para editar
import { adminListUrl, baseUrl, publicListUrl } from '../store/index.js';
import { getOccasion } from '../occasions.js';
import { icon } from '../icons.js';
import { openSheet, toast } from '../ui.js';
import { copyText, esc } from '../util.js';
import { coverHtml } from './cards.js';

export function openShare(ctx) {
  const { list } = ctx;
  const occ = getOccasion(list.occasion);
  const url = ctx.example ? `${baseUrl()}#/ejemplo` : publicListUrl(list.slug);
  const text = `${occ.share}\n${list.title}`;
  const enc = encodeURIComponent;
  const apps = [
    { label: 'WhatsApp', ic: 'chat', href: `https://wa.me/?text=${enc(`${text}\n${url}`)}` },
    { label: 'Telegram', ic: 'send', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
    { label: 'Correo', ic: 'mail', href: `mailto:?subject=${enc(list.title)}&body=${enc(`${text}\n\n${url}`)}` },
    { label: 'SMS', ic: 'sms', href: `sms:?&body=${enc(`${text} ${url}`)}` },
  ];
  const canNative = typeof navigator.share === 'function' && window.__OJALA_ENV__ !== 'artifact';
  const adminUrl = ctx.isOwner && ctx.token ? adminListUrl(list.slug, ctx.token) : '';

  const body = `
    <div class="share-card">${coverHtml(list)}<h3>${esc(list.title)}</h3><p>${esc(url.replace(/^https?:\/\//, ''))}</p></div>
    <button class="btn btn-primary btn-block" data-act="copy">${icon('copy')} Copiar enlace</button>
    <div class="share-apps">
      ${apps.map((a) => `<a class="share-app" href="${esc(a.href)}" target="_blank" rel="noopener noreferrer"><span class="bubble-ic">${icon(a.ic)}</span>${a.label}</a>`).join('')}
      ${canNative
        ? `<button class="share-app" data-act="native"><span class="bubble-ic">${icon('share')}</span>Más</button>`
        : `<button class="share-app" data-act="qr-focus"><span class="bubble-ic">${icon('qr')}</span>QR</button>`}
    </div>
    <div class="group qr-box" id="qr-box">
      <canvas id="qr-canvas" width="720" height="720" role="img" aria-label="Código QR de la lista"></canvas>
      <div>
        <b>Código QR</b>
        <p>Imprímelo en la invitación o muéstralo en pantalla para que lo escaneen con la cámara.</p>
        <button class="pill gray" data-act="download-qr">${icon('download')} Descargar QR</button>
      </div>
    </div>
    ${adminUrl ? `<div class="form-section">
      <p class="form-label">Enlace para editar</p>
      <div class="group"><div class="copy-row"><code>${esc(adminUrl)}</code><button class="pill gray" data-act="copy-admin">${icon('copy')} Copiar</button></div></div>
      <p class="form-hint">Úsalo para editar desde otro dispositivo o para armar la lista en pareja. Ojo: quien lo tenga puede editarla.</p>
    </div>` : ''}`;

  const sheet = openSheet({ title: 'Compartir lista', body });
  const canvas = sheet.el.querySelector('#qr-canvas');
  // La librería QR se carga aparte; si aún no está, reintentamos un momento
  const tryDraw = (n = 0) => {
    if (drawQR(canvas, url, { emoji: occ.emoji })) return;
    if (n < 20) setTimeout(() => tryDraw(n + 1), 150);
    else sheet.el.querySelector('#qr-box').hidden = true;
  };
  tryDraw();

  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'copy') {
      const ok = await copyText(url);
      toast(ok ? 'Enlace copiado' : 'Mantén presionado el enlace para copiarlo', { tone: ok ? 'success' : 'info' });
    }
    if (act === 'copy-admin') {
      const ok = await copyText(adminUrl);
      toast(ok ? 'Enlace para editar copiado' : 'No se pudo copiar', { tone: ok ? 'success' : 'error' });
    }
    if (act === 'native') {
      try { await navigator.share({ title: list.title, text, url }); } catch { /* el usuario canceló */ }
    }
    if (act === 'qr-focus') sheet.el.querySelector('#qr-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (act === 'download-qr') downloadCanvas(canvas, `qr-${slugify(list.title)}.png`);
  });
  return sheet;
}

const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'lista';

/** QR con módulos redondeados y el emoji de la ocasión al centro (probado con ZXing y OpenCV). */
export function drawQR(canvas, text, { emoji = '', fg = '#111111', bg = '#FFFFFF' } = {}) {
  const lib = window.qrcode;
  if (typeof lib !== 'function') return false;
  const qr = lib(0, 'H');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = canvas.width;
  const quiet = 4;
  const cell = size / (n + quiet * 2);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = fg;
  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  // Desde la versión 7 hay un patrón de alineación al centro: ahí no ponemos emoji
  const hole = emoji && n < 45 ? Math.ceil(n * 0.22) : 0;
  const h0 = Math.floor((n - hole) / 2);
  const inHole = (r, c) => hole && r >= h0 && r < h0 + hole && c >= h0 && c < h0 + hole;
  const rr = (x, y, w, h, rad) => {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  };
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!qr.isDark(r, c) || inFinder(r, c) || inHole(r, c)) continue;
      const pad = cell * 0.04;
      rr((c + quiet) * cell + pad, (r + quiet) * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.3);
      ctx.fill();
    }
  }
  // "Ojos" del QR: esquinas apenas suaves (muy redondeados confunden a algunos lectores)
  [[0, 0], [0, n - 7], [n - 7, 0]].forEach(([r, c]) => {
    const x = (c + quiet) * cell;
    const y = (r + quiet) * cell;
    ctx.fillStyle = fg; rr(x, y, cell * 7, cell * 7, cell * 0.55); ctx.fill();
    ctx.fillStyle = bg; rr(x + cell, y + cell, cell * 5, cell * 5, cell * 0.38); ctx.fill();
    ctx.fillStyle = fg; rr(x + cell * 2, y + cell * 2, cell * 3, cell * 3, cell * 0.3); ctx.fill();
  });
  if (hole) {
    const s = hole * cell;
    const x = (h0 + quiet) * cell;
    const y = (h0 + quiet) * cell;
    ctx.fillStyle = bg;
    rr(x, y, s, s, s * 0.28);
    ctx.fill();
    ctx.font = `${Math.round(s * 0.62)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x + s / 2, y + s / 2 + s * 0.04);
  }
  return true;
}

async function downloadCanvas(canvas, filename) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) { toast('No se pudo generar la imagen', { tone: 'error' }); return; }
  if (window.__OJALA_ENV__ === 'artifact') {
    try {
      const dl = await window.claude?.use?.('downloads');
      if (dl) { await dl.save({ filename, data: blob }); return; }
    } catch { /* el visor no permite descargas */ }
    toast('Mantén presionado el QR para guardarlo', { tone: 'info' });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('QR descargado');
}

