// Crear una lista en dos pasos: ocasión → detalles
import { api, errorText, prefs } from '../store/index.js';
import { OCCASIONS, applyTheme, getOccasion, occasionVars } from '../occasions.js';
import { icon } from '../icons.js';
import { toast } from '../ui.js';
import { countdownText, esc, fileToDataUrl, formatDateShort, pickFile } from '../util.js';
import { coverHtml } from './cards.js';
import { go } from '../router.js';

export function CreateView({ occasion }) {
  const preset = OCCASIONS.some((o) => o.id === occasion) ? occasion : null;
  const state = { step: preset ? 2 : 1, occasion: preset, avatar: null, cover: null, titleTouched: false, messageTouched: false, name: '' };
  let root;

  const topbar = (title) => `<header class="topbar is-solid" id="topbar">
    <div class="topbar-left"><button class="icon-btn" data-act="back" aria-label="Volver">${icon('chevronLeft')}</button></div>
    <div class="topbar-title" style="opacity:1;transform:none">${esc(title)}</div>
    <div class="topbar-right"></div>
  </header>`;

  function step1() {
    applyTheme(null);
    return `<div class="page page-plain">
      ${topbar('Nueva lista')}
      <div class="wrap wrap-narrow">
        <div class="large-head"><div><h1 class="t-large">¿Qué celebras?</h1><p class="muted t-sub">Elige la ocasión. Puedes cambiarla cuando quieras.</p></div></div>
        <div class="occ-grid">
          ${OCCASIONS.map((o) => `<button class="occ-card" style="${occasionVars(o.id)}" data-act="pick" data-v="${o.id}">
            <span class="em" aria-hidden="true">${o.emoji}</span>
            <span><b>${esc(o.label)}</b><small>${esc(o.hint)}</small></span>
          </button>`).join('')}
        </div>
      </div>
    </div>`;
  }

  function step2() {
    const occ = getOccasion(state.occasion);
    applyTheme(occ.id);
    const name = state.name || prefs.get('ownerName', '');
    state.name = name;
    return `<div class="page page-plain">
      ${topbar('Nueva lista')}
      <div class="wrap wrap-narrow">
        <div class="large-head"><div><h1 class="t-large">Tu lista</h1><p class="muted t-sub">Solo el título es obligatorio. Lo demás lo puedes cambiar después.</p></div></div>
        <div class="create-preview" id="c-preview">
          ${coverHtml({ occasion: occ.id, cover: state.cover })}
          <h2 id="c-ptitle">${esc(occ.title(name))}</h2>
          <p id="c-pmeta">${occ.emoji} ${esc(occ.label)}</p>
        </div>
        <form id="create-form" style="display:grid;gap:22px;margin-top:22px" novalidate>
          <div class="form-section">
            <div class="group">
              <button type="button" class="field-row-btn" data-act="change-occ"><span>Ocasión</span><span class="muted">${occ.emoji} ${esc(occ.label)} ${icon('chevronRight', 'sm')}</span></button>
              <label class="field"><span class="field-label">Tu nombre</span><input class="input" id="c-name" maxlength="60" placeholder="Ej: Martina" autocomplete="given-name" value="${esc(name)}"></label>
              <label class="field"><span class="field-label">Título</span><input class="input" id="c-title" maxlength="120" value="${esc(occ.title(name))}" required></label>
              <label class="field"><span class="field-label">Fecha</span><input class="input" id="c-date" type="date" value="${esc(state.date || '')}"></label>
            </div>
            <p class="form-hint">Con la fecha mostramos la cuenta regresiva a tus invitados.</p>
          </div>
          <div class="form-section">
            <p class="form-label">Mensaje para tus invitados</p>
            <div class="group"><label class="field top"><span class="sr-only">Mensaje</span><textarea class="textarea" id="c-message" maxlength="1200" rows="3">${esc(state.messageTouched ? state.message : occ.message)}</textarea></label></div>
          </div>
          <div class="form-section">
            <p class="form-label">Fotos (opcional)</p>
            <div class="group">
              <button type="button" class="field-row-btn" data-act="avatar"><span>Foto de perfil</span><span class="muted" id="c-avatar-lbl">${state.avatar ? 'Lista ✓' : 'Elegir'}</span></button>
              <button type="button" class="field-row-btn" data-act="cover"><span>Portada</span><span class="muted" id="c-cover-lbl">${state.cover ? 'Lista ✓' : 'Elegir'}</span></button>
            </div>
          </div>
          <div class="group">
            <div class="field">
              <span class="field-ic" style="background:#5856D6">${icon('eyeOff')}</span>
              <span class="field-text"><b>Modo sorpresa</b><small>No verás qué te reservan. Tus invitados sí, para no repetir.</small></span>
              <label class="switch"><input type="checkbox" id="c-surprise" role="switch" aria-label="Modo sorpresa" checked><span></span></label>
            </div>
          </div>
          <button class="btn btn-primary btn-block" type="submit" id="c-submit">${icon('sparkle')} Crear lista</button>
          <p class="form-hint" style="text-align:center">Sin registro. Te damos un enlace privado para editarla.</p>
        </form>
      </div>
    </div>`;
  }

  function render() {
    root.innerHTML = state.step === 1 ? step1() : step2();
    window.scrollTo(0, 0);
    if (state.step === 2) bindStep2();
  }

  function updatePreview() {
    const occ = getOccasion(state.occasion);
    const title = root.querySelector('#c-title').value.trim() || occ.title(state.name);
    root.querySelector('#c-ptitle').textContent = title;
    const date = root.querySelector('#c-date').value;
    root.querySelector('#c-pmeta').textContent = `${occ.emoji} ${occ.label}${date ? ` · ${formatDateShort(date)} · ${countdownText(date)}` : ''}`;
  }

  function bindStep2() {
    const occ = getOccasion(state.occasion);
    const nameInput = root.querySelector('#c-name');
    const titleInput = root.querySelector('#c-title');
    nameInput.addEventListener('input', () => {
      state.name = nameInput.value.trim();
      if (!state.titleTouched) titleInput.value = occ.title(state.name);
      updatePreview();
    });
    titleInput.addEventListener('input', () => { state.titleTouched = true; updatePreview(); });
    root.querySelector('#c-date').addEventListener('input', (e) => { state.date = e.target.value; updatePreview(); });
    root.querySelector('#c-message').addEventListener('input', (e) => { state.messageTouched = true; state.message = e.target.value; });
    updatePreview();
    root.querySelector('#create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) { titleInput.focus(); toast('Ponle un título a tu lista', { tone: 'error' }); return; }
      const btn = root.querySelector('#c-submit');
      btn.classList.add('is-busy');
      try {
        if (state.name) prefs.set('ownerName', state.name);
        const { list } = await api.createList({
          title,
          owner_name: state.name || null,
          occasion: state.occasion,
          event_date: root.querySelector('#c-date').value || null,
          message: root.querySelector('#c-message').value.trim() || null,
          avatar: state.avatar,
          cover: state.cover,
          surprise: root.querySelector('#c-surprise').checked,
        });
        go(`/l/${list.slug}?nueva`, { replace: true }); // "atrás" no vuelve al formulario (evita listas duplicadas)
      } catch (err) {
        btn.classList.remove('is-busy');
        toast(errorText(err), { tone: 'error' });
      }
    });
  }

  return {
    html: '',
    mount(el) {
      root = el;
      render();
      root.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'pick') { state.occasion = b.dataset.v; state.step = 2; state.titleTouched = false; render(); }
        if (act === 'change-occ') { state.step = 1; render(); }
        if (act === 'back') {
          if (state.step === 2 && !preset) { state.step = 1; render(); }
          else if (history.length > 1) history.back();
          else go('/');
        }
        if (act === 'avatar' || act === 'cover') {
          const file = await pickFile();
          if (!file) return;
          try {
            state[act] = await fileToDataUrl(file, act === 'avatar' ? { max: 320, square: true, quality: 0.85 } : { max: 1400, quality: 0.8 });
            root.querySelector(`#c-${act}-lbl`).textContent = 'Lista ✓';
            if (act === 'cover') {
              const prev = root.querySelector('#c-preview');
              prev.querySelector('.cover-emoji')?.remove();
              prev.querySelector('.cover-img')?.remove();
              prev.querySelector('.cover-art').insertAdjacentHTML('afterend', `<img class="cover-img" src="${esc(state.cover)}" alt="">`);
            }
          } catch {
            toast('No pudimos abrir esa imagen', { tone: 'error' });
          }
        }
      });
    },
  };
}
