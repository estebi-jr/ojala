// Hoja "Editar lista": datos, ocasión, fotos, modo sorpresa y eliminar
import { api, errorText, keychain } from '../store/index.js';
import { OCCASIONS, applyTheme, occasionVars } from '../occasions.js';
import { icon } from '../icons.js';
import { confirmDialog, openSheet, toast } from '../ui.js';
import { esc, fileToDataUrl, pickFile } from '../util.js';
import { go } from '../router.js';

export function openListSettings(ctx) {
  const list = ctx.list;
  const draft = { occasion: list.occasion, avatar: list.avatar, cover: list.cover };
  const body = `
    <div class="form-section">
      <p class="form-label">Ocasión</p>
      <div class="occ-strip" id="s-occ" style="margin-inline:-16px;padding-inline:16px">
        ${OCCASIONS.map((o) => `<button type="button" class="occ-chip" style="${occasionVars(o.id)}" data-act="occ" data-v="${o.id}" aria-pressed="${o.id === draft.occasion}"><span class="em">${o.emoji}</span>${esc(o.label)}</button>`).join('')}
      </div>
    </div>
    <div class="form-section">
      <div class="group">
        <label class="field"><span class="field-label">Título</span><input class="input" id="s-title" maxlength="120" value="${esc(list.title)}"></label>
        <label class="field"><span class="field-label">Tu nombre</span><input class="input" id="s-owner" maxlength="60" placeholder="Opcional" value="${esc(list.owner_name || '')}"></label>
        <label class="field"><span class="field-label">Fecha</span><input class="input" id="s-date" type="date" value="${esc(list.event_date || '')}"></label>
        <label class="field top"><span class="field-label">Mensaje</span><textarea class="textarea" id="s-message" maxlength="1200" placeholder="Unas palabras para tus invitados">${esc(list.message || '')}</textarea></label>
      </div>
    </div>
    <div class="form-section">
      <p class="form-label">Fotos</p>
      <div class="group">
        <button type="button" class="field-row-btn" data-act="avatar"><span>Foto de perfil</span><span class="muted" id="s-avatar-lbl">${list.avatar ? 'Cambiar' : 'Elegir'}</span></button>
        <button type="button" class="field-row-btn" data-act="cover"><span>Portada</span><span class="muted" id="s-cover-lbl">${list.cover ? 'Cambiar' : 'Elegir'}</span></button>
        <button type="button" class="field-row-btn" data-act="clear-photos"${list.avatar || list.cover ? '' : ' hidden'} id="s-clear"><span>Usar colores de la ocasión</span>${icon('refresh', 'sm')}</button>
      </div>
    </div>
    <div class="form-section">
      <div class="group">
        <div class="field">
          <span class="field-ic" style="background:#5856D6">${icon('eyeOff')}</span>
          <span class="field-text"><b>Modo sorpresa</b><small>No verás qué te reservaron</small></span>
          <label class="switch"><input type="checkbox" id="s-surprise" role="switch" aria-label="Modo sorpresa"${list.surprise !== false ? ' checked' : ''}><span></span></label>
        </div>
      </div>
    </div>
    <button type="button" class="btn btn-primary btn-block" data-act="save" id="s-save">Guardar cambios</button>
    <div class="group">
      <button type="button" class="field-row-btn" data-act="preview"><span>Ver como invitado</span>${icon('eye', 'sm')}</button>
      <button type="button" class="field-row-btn" data-act="forget"><span>Quitar de este dispositivo</span>${icon('phone', 'sm')}</button>
      <button type="button" class="field-row-btn danger" data-act="delete"><span>Eliminar lista</span>${icon('trash', 'sm')}</button>
    </div>`;

  const sheet = openSheet({ title: 'Editar lista', left: '<button type="button" class="text-btn" data-close>Cancelar</button>', right: '', body, onClose: () => applyTheme(ctx.list.occasion) });
  const $ = (id) => sheet.el.querySelector(`#${id}`);

  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'occ') {
      draft.occasion = b.dataset.v;
      sheet.el.querySelectorAll('[data-act="occ"]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === draft.occasion)));
      applyTheme(draft.occasion);
    }
    if (act === 'avatar' || act === 'cover') {
      const file = await pickFile();
      if (!file) return;
      try {
        draft[act] = await fileToDataUrl(file, act === 'avatar' ? { max: 320, square: true, quality: 0.85 } : { max: 1400, quality: 0.8 });
        $(`s-${act}-lbl`).textContent = 'Lista ✓';
        $('s-clear').hidden = false;
      } catch {
        toast('No pudimos abrir esa imagen', { tone: 'error' });
      }
    }
    if (act === 'clear-photos') {
      draft.avatar = null; draft.cover = null;
      $('s-avatar-lbl').textContent = 'Elegir';
      $('s-cover-lbl').textContent = 'Elegir';
      b.hidden = true;
    }
    if (act === 'save') {
      const title = $('s-title').value.trim();
      if (!title) { $('s-title').focus(); toast('La lista necesita un título', { tone: 'error' }); return; }
      b.classList.add('is-busy');
      try {
        const updated = await api.updateList(ctx.list, ctx.token, {
          title,
          owner_name: $('s-owner').value.trim() || null,
          event_date: $('s-date').value || null,
          message: $('s-message').value.trim() || null,
          occasion: draft.occasion,
          avatar: draft.avatar || null,
          cover: draft.cover || null,
          surprise: $('s-surprise').checked,
        });
        ctx.list = updated;
        sheet.close();
        ctx.onListUpdated(updated);
        toast('Lista actualizada');
      } catch (err) {
        b.classList.remove('is-busy');
        toast(errorText(err), { tone: 'error' });
      }
    }
    if (act === 'preview') { sheet.close(); go(`/l/${ctx.list.slug}/invitado`); }
    if (act === 'forget') {
      const ok = await confirmDialog({
        title: '¿Quitar de este dispositivo?',
        message: 'La lista sigue existiendo. Para volver a editarla vas a necesitar tu enlace para editar.',
        confirm: 'Quitar',
        danger: true,
      });
      if (!ok) return;
      keychain.remove(ctx.list.id);
      sheet.close();
      toast('Lista quitada de este dispositivo', { tone: 'info' });
      go('/');
    }
    if (act === 'delete') {
      const ok = await confirmDialog({ title: '¿Eliminar esta lista?', message: 'Se borra para todos, con sus reservas. No se puede deshacer.', confirm: 'Eliminar', danger: true });
      if (!ok) return;
      try {
        await api.deleteList(ctx.list, ctx.token);
        sheet.close();
        toast('Lista eliminada', { tone: 'info' });
        go('/');
      } catch (err) {
        toast(errorText(err), { tone: 'error' });
      }
    }
  });
  return sheet;
}
