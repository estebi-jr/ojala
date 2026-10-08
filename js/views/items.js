// Hojas de un deseo: agregar/editar (dueño), ver detalle y reservar (invitados)
import { CONFIG } from '../config.js';
import { api, errorText, prefs } from '../store/index.js';
import { icon } from '../icons.js';
import { fetchLinkPreview } from '../preview.js';
import { confirmDialog, openSheet, toast } from '../ui.js';
import {
  CURRENCIES, EMOJI_CHOICES, domainOf, esc, fileToDataUrl, formatPrice, guessEmoji,
  normalizeUrl, parsePrice, pickFile, titleFromUrl,
} from '../util.js';
import { avatarHtml, claimState, mediaHtml, priceHtml, storeHtml } from './cards.js';

const IS_ARTIFACT = typeof window !== 'undefined' && window.__OJALA_ENV__ === 'artifact';

function numberText(value, currency) {
  if (value == null || value === '') return '';
  const decimals = currency === 'CLP' || Number.isInteger(Number(value)) ? 0 : 2;
  return new Intl.NumberFormat(CONFIG.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value));
}

// ---------------------------------------------------------------------
// Agregar / editar
// ---------------------------------------------------------------------
export function openItemEditor(ctx, item, { prefillUrl = '', noLink = false } = {}) {
  const isNew = !item;
  const draft = item
    ? { ...item }
    : { title: '', url: '', image: null, price: null, currency: CONFIG.defaultCurrency, store: '', note: '', emoji: '', priority: false, qty: 1, hidden: false };
  let mode = item ? (item.url ? 'link' : 'nolink') : (noLink ? 'nolink' : 'link');
  const touched = { title: !!item, image: !!item?.image, price: item?.price != null };
  let ctrl = null;
  let lastUrl = item?.url || '';
  let saving = false;

  const currencyOptions = CURRENCIES.map((c) => `<option value="${c}"${c === draft.currency ? ' selected' : ''}>${c}</option>`).join('');
  const emojiButtons = EMOJI_CHOICES.map((e) => `<button type="button" class="emoji-btn" data-act="emoji" data-e="${e}" aria-label="Usar ${e}" aria-pressed="false">${e}</button>`).join('');

  const body = `
    ${isNew ? `<div class="segmented" role="group" aria-label="Tipo de deseo" style="justify-self:center">
      <button type="button" class="seg-btn" data-act="mode" data-v="link" aria-pressed="${mode === 'link'}">${icon('link')} Con link</button>
      <button type="button" class="seg-btn" data-act="mode" data-v="nolink" aria-pressed="${mode === 'nolink'}">${icon('sparkle')} Sin link</button>
    </div>` : ''}

    <div class="form-section" id="sec-link"${mode === 'link' ? '' : ' hidden'}>
      <div class="group">
        <label class="link-field">${icon('link')}
          <span class="sr-only">Link del producto</span>
          <input class="input" id="f-url" type="url" inputmode="url" placeholder="Pega el link del producto" autocomplete="off" autocapitalize="off" spellcheck="false" data-autofocus value="${esc(draft.url || '')}">
          <button type="button" class="paste-btn" data-act="paste">${icon('clipboard')} Pegar</button>
        </label>
      </div>
      <p class="fetch-status" id="f-status">${item?.url ? 'Si cambias el link, volvemos a buscar la foto y el precio.' : 'Sirve cualquier tienda: Falabella, Paris, Ripley, Mercado Libre, Zara…'}</p>
    </div>

    <div class="group edit-preview">
      <div id="f-media"></div>
      <div style="min-width:0">
        <p class="edit-preview-title" id="f-ptitle"></p>
        <p class="edit-preview-meta" id="f-pmeta"></p>
        <div class="photo-actions" style="margin-top:10px">
          <button type="button" class="pill" data-act="photo">${icon('photo')} <span id="f-photo-lbl">Subir foto</span></button>
          <button type="button" class="pill" data-act="remove-photo" id="f-remove-photo" hidden>Quitar foto</button>
        </div>
      </div>
    </div>

    <div class="form-section" id="sec-emoji" hidden>
      <p class="form-label">O elige un emoji</p>
      <div class="group"><div class="emoji-row">${emojiButtons}</div></div>
    </div>

    <div class="form-section">
      <div class="group">
        <label class="field"><span class="field-label">Nombre</span><input class="input" id="f-title" maxlength="160" placeholder="¿Qué quieres?" value="${esc(draft.title || '')}"></label>
        <label class="field"><span class="field-label">Precio</span><input class="input" id="f-price" inputmode="decimal" placeholder="Opcional" value="${esc(numberText(draft.price, draft.currency))}"><select class="input" id="f-currency" aria-label="Moneda" style="flex:none;width:auto;color:var(--label-2)">${currencyOptions}</select></label>
        <label class="field top"><span class="field-label">Comentario</span><textarea class="textarea" id="f-note" rows="3" maxlength="600" placeholder="Talla, color, modelo… o por qué lo quieres">${esc(draft.note || '')}</textarea></label>
      </div>
      <p class="form-hint">El comentario aparece como un mensaje tuyo junto al regalo.</p>
    </div>

    <div class="group">
      <div class="field">
        <span class="field-ic" style="background:#FF9500">${icon('star', 'fill')}</span>
        <span class="field-text"><b>Lo quiero mucho</b><small>Se destaca con una estrella</small></span>
        <label class="switch"><input type="checkbox" id="f-fav" role="switch" aria-label="Lo quiero mucho"${draft.priority ? ' checked' : ''}><span></span></label>
      </div>
      <div class="field">
        <span class="field-ic" style="background:#5856D6">${icon('gift')}</span>
        <span class="field-text"><b>Cantidad</b><small>Para copas, platos o aportes</small></span>
        <div class="stepper" role="group" aria-label="Cantidad">
          <button type="button" data-act="qty" data-d="-1" aria-label="Menos">−</button>
          <span class="stepper-value" id="f-qty" aria-live="polite">${draft.qty}</span>
          <button type="button" data-act="qty" data-d="1" aria-label="Más">+</button>
        </div>
      </div>
    </div>

    <button type="button" class="btn btn-primary btn-block" data-act="save" id="f-save">${isNew ? `${icon('plus')} Agregar a la lista` : 'Guardar cambios'}</button>
    ${isNew ? '' : `<div class="group"><button type="button" class="field-row-btn danger" data-act="delete"><span>Eliminar deseo</span>${icon('trash')}</button></div>`}
  `;

  const sheet = openSheet({
    title: isNew ? 'Nuevo deseo' : 'Editar deseo',
    left: '<button type="button" class="text-btn" data-close>Cancelar</button>',
    right: '',
    body,
    onClose: () => ctrl?.abort(),
  });
  const $ = (id) => sheet.el.querySelector(`#${id}`);
  const urlInput = $('f-url');
  const titleInput = $('f-title');
  const priceInput = $('f-price');
  const currencySel = $('f-currency');
  const noteInput = $('f-note');
  const favInput = $('f-fav');

  function status(kind, text) {
    const el = $('f-status');
    if (!el) return;
    el.className = `fetch-status ${kind === 'ok' ? 'ok' : kind === 'warn' ? 'warn' : ''}`;
    el.innerHTML = kind === 'loading'
      ? `<span class="spinner" aria-hidden="true"></span>${esc(text)}`
      : `${kind === 'ok' ? icon('checkCircle') : kind === 'warn' ? icon('info') : ''}${esc(text)}`;
  }

  function renderPreview(loading = false) {
    const title = titleInput.value.trim();
    $('f-media').innerHTML = mediaHtml({ ...draft, title: title || draft.title }, { size: 320, cls: loading ? 'is-loading' : '' });
    const pt = $('f-ptitle');
    pt.textContent = title || (loading ? 'Buscando…' : 'Tu deseo');
    pt.classList.toggle('placeholder', !title);
    const price = parsePrice(priceInput.value, currencySel.value);
    const meta = [price != null ? formatPrice(price, currencySel.value) : '', mode === 'link' ? draft.store : 'Idea sin link'].filter(Boolean).join(' · ');
    $('f-pmeta').textContent = meta;
    $('f-remove-photo').hidden = !draft.image;
    $('f-photo-lbl').textContent = draft.image ? 'Cambiar foto' : 'Subir foto';
    $('sec-emoji').hidden = !!draft.image;
    const current = draft.emoji || guessEmoji(title);
    sheet.el.querySelectorAll('.emoji-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.e === current)));
  }

  async function runFetch(raw) {
    const url = normalizeUrl(raw);
    if (!raw.trim()) return;
    if (!url) { status('warn', 'Eso no parece un link. Cópialo desde la barra de direcciones de la tienda.'); return; }
    if (urlInput.value !== url) urlInput.value = url;
    if (url === lastUrl && (draft.title || draft.image)) return;
    lastUrl = url;
    draft.url = url;
    draft.store = domainOf(url);
    ctrl?.abort();
    ctrl = new AbortController();
    status('loading', 'Buscando foto, nombre y precio…');
    renderPreview(true);
    try {
      const r = await fetchLinkPreview(url, { signal: ctrl.signal });
      if (!touched.title && r.title) titleInput.value = r.title;
      if (!touched.image && r.image) draft.image = r.image;
      if (!touched.price && r.price != null) priceInput.value = numberText(r.price, r.currency);
      if (r.currency && CURRENCIES.includes(r.currency)) currencySel.value = r.currency;
      draft.emoji = draft.emoji || guessEmoji(titleInput.value);
      renderPreview(false);
      if (!r.failed) status('ok', r.image ? 'Listo. Revisa los datos y agrega un comentario.' : 'Encontramos el nombre. Si quieres, sube una foto.');
      else if (IS_ARTIFACT) status('warn', 'En esta vista previa no se pueden leer tiendas. En tu sitio publicado la foto y el precio se cargan solos.');
      else status('warn', 'No pudimos leer esa página. Revisa el nombre y sube una foto si quieres.');
    } catch {
      renderPreview(false);
    }
  }

  // Eventos
  urlInput?.addEventListener('paste', () => setTimeout(() => runFetch(urlInput.value), 0));
  urlInput?.addEventListener('change', () => runFetch(urlInput.value));
  urlInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runFetch(urlInput.value); } });
  titleInput.addEventListener('input', () => { touched.title = true; renderPreview(); });
  priceInput.addEventListener('input', () => { touched.price = true; renderPreview(); });
  priceInput.addEventListener('blur', () => {
    const v = parsePrice(priceInput.value, currencySel.value);
    priceInput.value = v == null ? '' : numberText(v, currencySel.value);
  });
  currencySel.addEventListener('change', renderPreview);

  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'mode') {
      mode = b.dataset.v;
      sheet.el.querySelectorAll('[data-act="mode"]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === mode)));
      $('sec-link').hidden = mode !== 'link';
      if (mode === 'nolink') { ctrl?.abort(); if (!touched.image) draft.image = null; }
      renderPreview();
      if (mode === 'nolink') titleInput.focus();
    }
    if (act === 'paste') {
      try {
        const text = await navigator.clipboard.readText();
        if (text) { urlInput.value = text; runFetch(text); } else urlInput.focus();
      } catch {
        urlInput.focus();
        status('', 'Mantén presionado el campo y toca "Pegar".');
      }
    }
    if (act === 'photo') {
      const file = await pickFile('image/*');
      if (!file) return;
      try {
        draft.image = await fileToDataUrl(file, { max: 720 });
        touched.image = true;
        renderPreview();
      } catch {
        toast('No pudimos abrir esa imagen', { tone: 'error' });
      }
    }
    if (act === 'remove-photo') { draft.image = null; touched.image = true; renderPreview(); }
    if (act === 'emoji') { draft.emoji = b.dataset.e; renderPreview(); }
    if (act === 'qty') {
      draft.qty = Math.min(99, Math.max(1, draft.qty + Number(b.dataset.d)));
      $('f-qty').textContent = draft.qty;
    }
    if (act === 'save') save();
    if (act === 'delete') {
      const ok = await confirmDialog({ title: '¿Eliminar este deseo?', message: draft.title, confirm: 'Eliminar', danger: true });
      if (!ok) return;
      try {
        await api.deleteItem(ctx.list, ctx.token, item.id);
        sheet.close();
        ctx.onItemDeleted(item.id);
      } catch (err) {
        toast(errorText(err), { tone: 'error' });
      }
    }
  });

  async function save() {
    if (saving) return;
    const useLink = mode === 'link' && !!normalizeUrl(urlInput?.value || '');
    const url = useLink ? normalizeUrl(urlInput.value) : null;
    let title = titleInput.value.trim();
    if (!title && url) title = titleFromUrl(url) || domainOf(url);
    if (!title) {
      titleInput.focus();
      toast('Ponle un nombre a tu deseo', { tone: 'error' });
      return;
    }
    ctrl?.abort();
    saving = true;
    const btn = $('f-save');
    btn.classList.add('is-busy');
    const payload = {
      ...(item ? { id: item.id } : {}),
      title,
      url,
      store: url ? domainOf(url) : null,
      image: draft.image || null,
      price: parsePrice(priceInput.value, currencySel.value),
      currency: currencySel.value,
      note: noteInput.value.trim() || null,
      emoji: draft.emoji || guessEmoji(title),
      priority: favInput.checked,
      qty: draft.qty,
    };
    try {
      const saved = await api.saveItem(ctx.list, ctx.token, payload);
      sheet.close();
      ctx.onItemSaved(saved, isNew);
    } catch (err) {
      toast(errorText(err), { tone: 'error' });
    } finally {
      saving = false;
      btn.classList.remove('is-busy');
    }
  }

  renderPreview();
  if (prefillUrl) {
    urlInput.value = prefillUrl;
    runFetch(prefillUrl);
  }
  return sheet;
}

// ---------------------------------------------------------------------
// Detalle (invitados y ejemplo)
// ---------------------------------------------------------------------
export function openItemDetail(ctx, item) {
  const sheet = openSheet({ title: '', label: item.title, body: detailHtml(ctx, item) });
  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'claim') { sheet.close(); setTimeout(() => ctx.startClaim(item), 200); }
    if (b.dataset.act === 'unclaim') {
      const done = await ctx.doUnclaim(item);
      if (done) sheet.swap(detailHtml(ctx, item));
    }
  });
  return sheet;
}

function detailHtml(ctx, item) {
  const st = claimState(item, ctx);
  const owner = ctx.list.owner_name || 'La persona';
  const fav = item.priority ? `<span class="badge fav">${icon('star', 'xs fill')} ${esc(owner)} lo quiere mucho</span>` : '';
  let action;
  if (st.mine.length) action = `<button class="btn btn-gray" data-act="unclaim">${icon('check')} Lo regalas tú · Deshacer</button>`;
  else if (st.full) action = `<button class="btn btn-gray" disabled>${icon('check')} Ya está reservado</button>`;
  else action = `<button class="btn btn-primary" data-act="claim">${icon('gift')} Lo regalo yo</button>`;
  const shop = item.url ? `<a class="btn btn-gray" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${icon('bag')} Ver en la tienda</a>` : '';
  const who = st.claims.length
    ? `<div class="claim-info">${icon('checkCircle')}<div class="claim-list">${st.claims.map((c) => `<span><b style="color:var(--label)">${esc(c.name || 'Alguien')}</b> reservó ${c.qty > 1 ? `${c.qty} unidades` : 'este regalo'}${ctx.myClaimIds.has(c.id) ? ' (tú)' : ''}</span>`).join('')}</div></div>`
    : '';
  return `<div class="detail">
    ${mediaHtml(item, { size: 900, extra: fav })}
    <h3 class="detail-title">${esc(item.title)}</h3>
    <div class="detail-meta">${priceHtml(item)}${storeHtml(item)}</div>
    ${item.note ? `<div class="detail-note">${avatarHtml(ctx.list, 'mini-avatar')}<p class="bubble"><span>${esc(item.note)}</span></p></div>` : ''}
    ${item.qty > 1 ? `<p class="muted t-sub">Quiere ${item.qty} en total${st.show ? ` · quedan ${st.left}` : ''}.</p>` : ''}
    ${who}
    <div class="detail-actions${shop ? ' two' : ''}">${shop}${action}</div>
  </div>`;
}

// ---------------------------------------------------------------------
// Reservar
// ---------------------------------------------------------------------
export function openClaimSheet(ctx, item) {
  const st = claimState(item, ctx);
  if (st.full) { toast('Este regalo ya está reservado', { tone: 'info' }); return null; }
  let qty = 1;
  const owner = ctx.list.owner_name || 'La persona';
  const surprise = ctx.list.surprise !== false;
  const sheet = openSheet({
    title: 'Reservar regalo',
    body: `
      <div class="group mini-item">${mediaHtml(item, { size: 200 })}<div style="min-width:0"><b>${esc(item.title)}</b><small>${item.price != null ? esc(formatPrice(item.price, item.currency)) : 'Sin precio'}</small></div></div>
      <div class="form-section">
        <div class="group">
          <label class="field"><span class="field-label">Tu nombre</span><input class="input" id="c-name" maxlength="60" autocomplete="name" placeholder="Opcional, ej: Tía Carmen" value="${esc(prefs.get('guestName', ''))}"></label>
          ${st.left > 1 ? `<div class="field"><span class="field-text"><b>¿Cuántos regalas?</b><small>Quedan ${st.left}</small></span>
            <div class="stepper" role="group" aria-label="Cantidad"><button type="button" data-act="qty" data-d="-1" aria-label="Menos">−</button><span class="stepper-value" id="c-qty">1</span><button type="button" data-act="qty" data-d="1" aria-label="Más">+</button></div></div>` : ''}
        </div>
        <p class="form-hint">Así el resto sabe que ya está cubierto y nadie lo repite.${surprise ? ` ${esc(owner)} no ve quién reservó qué.` : ''}</p>
      </div>
      <button class="btn btn-primary btn-block" data-act="confirm" id="c-confirm">${icon('gift')} Confirmar reserva</button>
      ${item.url ? `<a class="btn btn-plain" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" style="justify-self:center">Ver en la tienda ${icon('external', 'sm')}</a>` : ''}`,
  });
  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'qty') {
      qty = Math.min(st.left, Math.max(1, qty + Number(b.dataset.d)));
      sheet.el.querySelector('#c-qty').textContent = qty;
    }
    if (b.dataset.act === 'confirm') {
      b.classList.add('is-busy');
      const name = sheet.el.querySelector('#c-name').value.trim();
      try {
        await ctx.doClaim(item, name, qty);
        sheet.close();
      } catch (err) {
        b.classList.remove('is-busy');
        toast(errorText(err), { tone: 'error' });
        if (err?.code === 'item_full') { sheet.close(); ctx.reload?.(); }
      }
    }
  });
  return sheet;
}
