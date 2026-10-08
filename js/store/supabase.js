// Adaptador real: habla con Supabase a través de funciones SQL (RPC).
// No usa librerías: solo fetch. Todas las reglas de seguridad viven en supabase/schema.sql.

const KNOWN = new Set(['not_found', 'invalid_token', 'item_full', 'too_many_items', 'invalid_input']);
const fail = (code, detail) => Object.assign(new Error(code), { code, detail });

export class SupabaseAdapter {
  constructor({ supabaseUrl, supabaseKey }) {
    this.kind = 'supabase';
    this.url = String(supabaseUrl).replace(/\/+$/, '');
    this.key = String(supabaseKey).trim();
  }

  headers() {
    const h = { apikey: this.key, 'Content-Type': 'application/json', Accept: 'application/json' };
    // Las llaves antiguas ("anon", tipo JWT) también van como Bearer; las nuevas (sb_publishable_) no.
    if (this.key.startsWith('eyJ')) h.Authorization = `Bearer ${this.key}`;
    return h;
  }

  async rpc(fn, args) {
    let res;
    try {
      res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(args) });
    } catch {
      throw fail('network');
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      const msg = String(data?.message || '');
      if (KNOWN.has(msg)) throw fail(msg);
      if (res.status === 404 || data?.code === 'PGRST202' || /could not find the function/i.test(msg)) throw fail('setup', msg);
      if (res.status === 401 || res.status === 403) throw fail('setup', msg);
      if (data?.code === '23514' || data?.code === '22P02') throw fail('invalid_input', msg);
      throw fail('server', msg);
    }
    return data;
  }

  createList(data) { return this.rpc('create_list', { p_data: data }); }
  getList(slug, token) { return this.rpc('get_list', { p_slug: slug, p_token: token || null }); }
  checkToken(slug, token) { return this.rpc('check_token', { p_slug: slug, p_token: token }); }
  updateList(listId, token, patch) { return this.rpc('update_list', { p_list_id: listId, p_token: token, p_data: patch }); }
  deleteList(listId, token) { return this.rpc('delete_list', { p_list_id: listId, p_token: token }); }
  saveItem(listId, token, item) { return this.rpc('save_item', { p_list_id: listId, p_token: token, p_item: item }); }
  deleteItem(listId, token, itemId) { return this.rpc('delete_item', { p_list_id: listId, p_token: token, p_item_id: itemId }); }
  reorder(listId, token, ids) { return this.rpc('reorder_items', { p_list_id: listId, p_token: token, p_ids: ids }); }
  claimItem(itemId, name, qty = 1) { return this.rpc('claim_item', { p_item_id: itemId, p_name: name || null, p_qty: qty }); }
  unclaim(claimId, token) { return this.rpc('unclaim', { p_claim_id: claimId, p_token: token }); }
}
