// Capa de datos: elige el adaptador (demo o Supabase) y guarda en el dispositivo
// las llaves de edición, las reservas propias y las listas visitadas.
import { CONFIG } from '../config.js';
import { storage } from '../util.js';
import { LocalAdapter } from './local.js';
import { SupabaseAdapter } from './supabase.js';

export const backend = CONFIG.supabaseUrl && CONFIG.supabaseKey ? new SupabaseAdapter(CONFIG) : new LocalAdapter();
export const isDemo = backend.kind === 'local';

const K = {
  keys: 'ojala.keys.v1',
  claims: 'ojala.claims.v1',
  visited: 'ojala.visited.v1',
  prefs: 'ojala.prefs.v1',
};

const summaryOf = (list, count) => ({
  slug: list.slug,
  title: list.title,
  occasion: list.occasion,
  event_date: list.event_date,
  owner_name: list.owner_name,
  count,
});

/** Llaves de edición de mis listas (sin cuenta: quien tiene la llave, edita). */
export const keychain = {
  all() { return storage.get(K.keys, {}) || {}; },
  list() {
    return Object.entries(this.all())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (b.updated || 0) - (a.updated || 0));
  },
  get(listId) { const v = this.all()[listId]; return v ? { id: listId, ...v } : null; },
  bySlug(slug) {
    for (const [id, v] of Object.entries(this.all())) if (v.slug === slug) return { id, ...v };
    return null;
  },
  save(listId, data) {
    const all = this.all();
    all[listId] = { ...(all[listId] || {}), ...data, updated: Date.now() };
    storage.set(K.keys, all);
  },
  remove(listId) {
    const all = this.all();
    delete all[listId];
    storage.set(K.keys, all);
  },
};

/** Reservas que hice yo (para poder deshacerlas). */
export const claimKeys = {
  all() { return storage.get(K.claims, {}) || {}; },
  get(id) { return this.all()[id] || null; },
  set(id, token) { const a = this.all(); a[id] = token; storage.set(K.claims, a); },
  remove(id) { const a = this.all(); delete a[id]; storage.set(K.claims, a); },
};

/** Listas de otras personas que abrí (como "seguir" una lista). */
export const visited = {
  list() { return storage.get(K.visited, []) || []; },
  touch(list, count) {
    const rest = this.list().filter((v) => v.slug !== list.slug);
    storage.set(K.visited, [{ ...summaryOf(list, count), at: Date.now() }, ...rest].slice(0, 20));
  },
  remove(slug) { storage.set(K.visited, this.list().filter((v) => v.slug !== slug)); },
};

/** Preferencias de la interfaz. */
export const prefs = {
  get(key, fallback) { const p = storage.get(K.prefs, {}) || {}; return key in p ? p[key] : fallback; },
  set(key, value) { const p = storage.get(K.prefs, {}) || {}; p[key] = value; storage.set(K.prefs, p); },
};

// ---------- Enlaces ----------
export function baseUrl() {
  if (CONFIG.publicUrl) return CONFIG.publicUrl.replace(/\/?$/, '/');
  const href = location.href.split('#')[0].split('?')[0];
  return href;
}
export const publicListUrl = (slug) => `${baseUrl()}#/l/${slug}`;
export const adminListUrl = (slug, token) => `${baseUrl()}#/admin/${slug}/${token}`;

// ---------- Errores legibles ----------
const ERRORS = {
  not_found: 'No encontramos esta lista. Puede que la hayan eliminado o que el enlace esté incompleto.',
  invalid_token: 'Este enlace de edición no es válido para esta lista.',
  item_full: 'Alguien se te adelantó: este regalo ya está reservado.',
  too_many_items: 'Llegaste al máximo de 300 deseos en una lista.',
  storage_full: 'Este navegador se quedó sin espacio. Usa fotos más livianas o borra listas de prueba.',
  network: 'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
  setup: 'Falta terminar de configurar la base de datos (revisa el README).',
  invalid_input: 'Algún dato no es válido. Revisa los campos e inténtalo de nuevo.',
  server: 'Algo falló al guardar. Inténtalo de nuevo en unos segundos.',
};
export const errorText = (e) => ERRORS[e?.code] || ERRORS.server;

// ---------- API que usan las vistas ----------
export const api = {
  async createList(data) {
    const { list, token } = await backend.createList(data);
    keychain.save(list.id, { token, ...summaryOf(list, 0) });
    return { list, token };
  },

  /** Carga una lista. Si tengo su llave, entro como dueño (salvo que pida verla como invitado). */
  async loadList(slug, { asGuest = false } = {}) {
    const key = keychain.bySlug(slug);
    const res = await backend.getList(slug, asGuest ? null : key?.token);
    if (key && !asGuest) {
      if (res.is_owner) keychain.save(res.list.id, summaryOf(res.list, res.items.length));
      else keychain.remove(key.id);
    }
    if (!key && !res.is_owner) visited.touch(res.list, res.items.length);
    return {
      list: res.list,
      items: res.items || [],
      claims: res.claims || [],
      isOwner: !!res.is_owner && !asGuest,
      ownedHere: !!key,
      token: res.is_owner ? key?.token : null,
    };
  },

  async importAdmin(slug, token) {
    const res = await backend.checkToken(slug, token);
    const list = res.list;
    keychain.save(list.id, { token, ...summaryOf(list, keychain.get(list.id)?.count || 0) });
    visited.remove(slug);
    return list;
  },

  async updateList(list, token, patch) {
    const updated = await backend.updateList(list.id, token, patch);
    keychain.save(updated.id, summaryOf(updated, keychain.get(updated.id)?.count || 0));
    return updated;
  },

  async deleteList(list, token) {
    await backend.deleteList(list.id, token);
    keychain.remove(list.id);
  },

  saveItem: (list, token, item) => backend.saveItem(list.id, token, item),
  deleteItem: (list, token, itemId) => backend.deleteItem(list.id, token, itemId),
  reorder: (list, token, ids) => backend.reorder(list.id, token, ids),

  async claim(itemId, name, qty) {
    const { claim, token } = await backend.claimItem(itemId, name, qty);
    claimKeys.set(claim.id, token);
    return claim;
  },

  async unclaim(claimId) {
    const token = claimKeys.get(claimId);
    await backend.unclaim(claimId, token);
    claimKeys.remove(claimId);
  },

  countItems(listId, count) {
    if (keychain.get(listId)) keychain.save(listId, { count });
  },
};
