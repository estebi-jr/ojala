// Piezas visuales reutilizables: portada, avatar, foto del deseo y tarjeta
import { icon } from '../icons.js';
import { getOccasion } from '../occasions.js';
import { domainOf, esc, faviconUrl, formatPrice, guessEmoji, initials, proxiedImage, safeImageSrc } from '../util.js';

export function coverHtml(list, { emoji = true } = {}) {
  const occ = getOccasion(list.occasion);
  const img = safeImageSrc(list.cover);
  return `<div class="cover-art"></div>${img ? `<img class="cover-img" src="${esc(img)}" alt="">` : ''}${!img && emoji ? `<span class="cover-emoji" aria-hidden="true">${occ.emoji}</span>` : ''}`;
}

export function avatarHtml(list, cls = 'avatar') {
  const img = safeImageSrc(list.avatar);
  return `<div class="${cls}" aria-hidden="true"><span>${esc(initials(list.owner_name || list.title))}</span>${img ? `<img src="${esc(img)}" alt="">` : ''}</div>`;
}

/** Foto del deseo sobre una "bandeja" clara; si no hay foto (o falla), muestra un emoji. */
export function mediaHtml(item, { size = 640, cls = '', extra = '' } = {}) {
  const src = safeImageSrc(item.image);
  const emoji = item.emoji || guessEmoji(item.title);
  if (!src) return `<div class="media is-emoji ${cls}"><span class="media-emoji" aria-hidden="true">${esc(emoji)}</span>${extra}</div>`;
  const shown = proxiedImage(src, size);
  const proxied = shown !== src;
  return `<div class="media has-img ${cls}"><img src="${esc(shown)}"${proxied ? ` data-orig="${esc(src)}" crossorigin="anonymous"` : ''} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="media-emoji" aria-hidden="true">${esc(emoji)}</span>${extra}</div>`;
}

export function storeHtml(item) {
  const store = item.store || domainOf(item.url || '');
  if (!store) return '';
  return `<span class="store"><img class="favicon" src="${esc(faviconUrl(store))}" alt="" loading="lazy" referrerpolicy="no-referrer"><span>${esc(store)}</span></span>`;
}

export function priceHtml(item) {
  const p = item.price != null && item.price !== '' ? formatPrice(item.price, item.currency) : '';
  return p ? `<span class="price">${esc(p)}</span>` : `<span class="price none">${item.url ? 'Sin precio' : 'Idea sin link'}</span>`;
}

/**
 * Estado de reservas de un deseo.
 * ctx.showClaims = false en "modo sorpresa" (el dueño no ve nada).
 */
export function claimState(item, ctx) {
  const claims = ctx.claimsByItem?.get(item.id) || [];
  const show = !!ctx.showClaims;
  const taken = claims.reduce((s, c) => s + (c.qty || 1), 0);
  const mine = claims.filter((c) => ctx.myClaimIds?.has(c.id));
  return {
    show,
    claims: show ? claims : [],
    taken: show ? taken : 0,
    left: Math.max(0, item.qty - (show ? taken : 0)),
    full: show && taken >= item.qty,
    mine: show ? mine : [],
  };
}

export function cardHtml(item, ctx, index = 0) {
  const st = claimState(item, ctx);
  const owner = ctx.mode === 'owner';
  const badges = [];
  if (item.hidden && owner) badges.push(`<span class="badge hidden-b">${icon('eyeOff', 'xs')} Oculto</span>`);
  else if (item.priority) badges.push(`<span class="badge fav">${icon('star', 'xs fill')} Favorito</span>`);
  if (item.qty > 1) badges.push(`<span class="badge qty">${st.show ? `${st.taken}/${item.qty}` : `×${item.qty}`}</span>`);
  if (st.full) badges.push(`<span class="badge state">${icon('check', 'xs')} ${st.mine.length ? 'Lo regalas tú' : 'Reservado'}</span>`);
  if (owner) badges.push(`<button class="card-more" data-act="item-menu" data-id="${esc(item.id)}" aria-label="Opciones de ${esc(item.title)}">${icon('more', 'sm')}</button>`);

  let action = '';
  if (!owner) {
    if (st.mine.length) action = `<button class="pill done" data-act="unclaim" data-id="${esc(item.id)}">${icon('check')} Lo regalas tú</button>`;
    else if (st.full) action = '<span class="pill muted">Ya está reservado</span>';
    else action = `<button class="pill gray" data-act="claim" data-id="${esc(item.id)}">${icon('gift')} Lo regalo yo</button>`;
  }

  const classes = ['card', st.full ? 'is-full' : '', item.hidden && owner ? 'is-hidden' : ''].filter(Boolean).join(' ');
  return `<article class="${classes}" data-id="${esc(item.id)}" style="--i:${index}">
    <button class="card-hit" data-act="open" data-id="${esc(item.id)}" aria-label="Ver ${esc(item.title)}"></button>
    ${mediaHtml(item, { extra: badges.join('') })}
    <div class="card-body">
      <h3 class="card-title">${esc(item.title)}</h3>
      <div class="card-meta">${priceHtml(item)}${storeHtml(item)}</div>
      ${item.note ? `<p class="bubble"><span>${esc(item.note)}</span></p>` : ''}
      ${action ? `<div class="card-actions">${action}</div>` : ''}
    </div>
  </article>`;
}
