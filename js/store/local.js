// Adaptador "demo": guarda todo en este navegador (localStorage).
// Imita exactamente las reglas del backend real para que la app se comporte igual.
import { storage, uid, randomToken, randomSlug, sleep } from '../util.js';

const DB_KEY = 'ojala.demo.db.v1';
const LIST_FIELDS = ['title', 'owner_name', 'occasion', 'event_date', 'message', 'cover', 'avatar', 'surprise'];
const ITEM_FIELDS = ['title', 'url', 'image', 'price', 'currency', 'store', 'note', 'emoji', 'priority', 'qty', 'position', 'hidden'];

const clone = (x) => JSON.parse(JSON.stringify(x));
const now = () => new Date().toISOString();
const fail = (code) => Object.assign(new Error(code), { code });
const byPosition = (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at);

function load() {
  return storage.get(DB_KEY, null) || { lists: {}, keys: {}, items: {}, claims: {}, claimKeys: {} };
}
function save(db) {
  if (!storage.set(DB_KEY, db)) throw fail('storage_full');
}

function pick(obj, fields) {
  const out = {};
  for (const f of fields) if (obj && Object.prototype.hasOwnProperty.call(obj, f)) out[f] = obj[f];
  return out;
}

function normalizeItem(item) {
  const out = { ...item };
  if ('title' in out) out.title = String(out.title || '').trim().slice(0, 200) || 'Deseo';
  if ('qty' in out) out.qty = Math.min(99, Math.max(1, parseInt(out.qty, 10) || 1));
  if ('price' in out) out.price = out.price === '' || out.price == null ? null : Number(out.price);
  for (const k of ['url', 'image', 'store', 'note', 'emoji']) if (k in out && !out[k]) out[k] = null;
  return out;
}

export class LocalAdapter {
  constructor() { this.kind = 'local'; }

  async createList(data) {
    await sleep(120);
    const db = load();
    const id = uid();
    const token = randomToken();
    let slug;
    do { slug = randomSlug(); } while (Object.values(db.lists).some((l) => l.slug === slug));
    const fields = pick(data, LIST_FIELDS);
    const list = {
      id, slug,
      title: String(fields.title || '').trim() || 'Mi lista de deseos',
      owner_name: fields.owner_name || null,
      occasion: fields.occasion || 'otra',
      event_date: fields.event_date || null,
      message: fields.message || null,
      cover: fields.cover || null,
      avatar: fields.avatar || null,
      surprise: fields.surprise !== false,
      created_at: now(), updated_at: now(),
    };
    db.lists[id] = list;
    db.keys[id] = token;
    save(db);
    return { list: clone(list), token };
  }

  async getList(slug, token) {
    await sleep(80);
    const db = load();
    const list = Object.values(db.lists).find((l) => l.slug === String(slug).toLowerCase().trim());
    if (!list) throw fail('not_found');
    const isOwner = !!token && db.keys[list.id] === token;
    const items = Object.values(db.items).filter((i) => i.list_id === list.id && (isOwner || !i.hidden)).sort(byPosition);
    const ids = new Set(items.map((i) => i.id));
    const claims = Object.values(db.claims).filter((c) => ids.has(c.item_id)).sort((a, b) => a.created_at.localeCompare(b.created_at));
    return clone({ list, is_owner: isOwner, items, claims });
  }

  async checkToken(slug, token) {
    const db = load();
    const list = Object.values(db.lists).find((l) => l.slug === slug);
    if (!list || db.keys[list.id] !== token) throw fail('invalid_token');
    return { ok: true, list: clone(list) };
  }

  assertOwner(db, listId, token) {
    if (!db.lists[listId]) throw fail('not_found');
    if (!token || db.keys[listId] !== token) throw fail('invalid_token');
  }

  async updateList(listId, token, patch) {
    await sleep(60);
    const db = load();
    this.assertOwner(db, listId, token);
    const fields = pick(patch, LIST_FIELDS);
    if ('title' in fields && !String(fields.title || '').trim()) delete fields.title;
    Object.assign(db.lists[listId], fields, { updated_at: now() });
    save(db);
    return clone(db.lists[listId]);
  }

  async deleteList(listId, token) {
    const db = load();
    this.assertOwner(db, listId, token);
    for (const item of Object.values(db.items)) {
      if (item.list_id !== listId) continue;
      for (const c of Object.values(db.claims)) if (c.item_id === item.id) { delete db.claims[c.id]; delete db.claimKeys[c.id]; }
      delete db.items[item.id];
    }
    delete db.lists[listId];
    delete db.keys[listId];
    save(db);
    return { ok: true };
  }

  async saveItem(listId, token, item) {
    await sleep(90);
    const db = load();
    this.assertOwner(db, listId, token);
    const fields = normalizeItem(pick(item, ITEM_FIELDS));
    if (!item.id) {
      const siblings = Object.values(db.items).filter((i) => i.list_id === listId);
      if (siblings.length >= 300) throw fail('too_many_items');
      const minPos = siblings.reduce((m, i) => Math.min(m, i.position), 0);
      const row = {
        id: uid(), list_id: listId,
        title: 'Deseo', url: null, image: null, price: null, currency: 'CLP', store: null, note: null, emoji: null,
        priority: false, qty: 1, hidden: false,
        ...fields,
        position: Number.isInteger(fields.position) ? fields.position : minPos - 1,
        created_at: now(), updated_at: now(),
      };
      db.items[row.id] = row;
      save(db);
      return clone(row);
    }
    const row = db.items[item.id];
    if (!row || row.list_id !== listId) throw fail('not_found');
    Object.assign(row, fields, { updated_at: now() });
    save(db);
    return clone(row);
  }

  async deleteItem(listId, token, itemId) {
    const db = load();
    this.assertOwner(db, listId, token);
    const row = db.items[itemId];
    if (!row || row.list_id !== listId) throw fail('not_found');
    for (const c of Object.values(db.claims)) if (c.item_id === itemId) { delete db.claims[c.id]; delete db.claimKeys[c.id]; }
    delete db.items[itemId];
    save(db);
    return { ok: true };
  }

  async reorder(listId, token, ids) {
    const db = load();
    this.assertOwner(db, listId, token);
    ids.forEach((id, index) => { if (db.items[id]?.list_id === listId) db.items[id].position = index; });
    save(db);
    return { ok: true };
  }

  async claimItem(itemId, name, qty = 1) {
    await sleep(140);
    const db = load();
    const item = db.items[itemId];
    if (!item || item.hidden) throw fail('not_found');
    const n = Math.max(1, parseInt(qty, 10) || 1);
    const taken = Object.values(db.claims).filter((c) => c.item_id === itemId).reduce((s, c) => s + c.qty, 0);
    if (taken + n > item.qty) throw fail('item_full');
    const claim = { id: uid(), item_id: itemId, name: String(name || '').trim().slice(0, 60) || null, qty: n, created_at: now() };
    const token = randomToken();
    db.claims[claim.id] = claim;
    db.claimKeys[claim.id] = token;
    save(db);
    return { claim: clone(claim), token };
  }

  async unclaim(claimId, token) {
    const db = load();
    if (!db.claims[claimId]) return { ok: true };
    if (db.claimKeys[claimId] !== token) throw fail('invalid_token');
    delete db.claims[claimId];
    delete db.claimKeys[claimId];
    save(db);
    return { ok: true };
  }
}
