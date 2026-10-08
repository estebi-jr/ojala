// Lista de ejemplo (ficticia) para mostrar cómo se ve Ojalá por dentro
import { isoDate } from './util.js';

const created = '2026-01-01T12:00:00.000Z';

export function exampleData() {
  const list = {
    id: 'ejemplo',
    slug: 'ejemplo',
    title: 'Los 25 de Martina',
    owner_name: 'Martina',
    occasion: 'cumple',
    event_date: isoDate(17),
    message: '¡Hola! Armé esta lista para que no tengan que adivinar 😅\nLo más importante es que estén ese día. Si reservan algo, márquenlo para que nadie lo repita 🫶',
    cover: null,
    avatar: null,
    surprise: true,
    created_at: created,
    updated_at: created,
  };
  const base = { list_id: 'ejemplo', image: null, url: null, currency: 'CLP', hidden: false, created_at: created, updated_at: created, qty: 1, priority: false };
  const items = [
    { ...base, id: 'e1', position: 0, emoji: '🎧', title: 'Audífonos inalámbricos con cancelación de ruido', price: 89990, store: 'falabella.com', url: 'https://www.falabella.com/', note: 'Cualquier marca, pero que tengan cancelación de ruido 🙏 Los uso para estudiar', priority: true },
    { ...base, id: 'e2', position: 1, emoji: '👟', title: 'Zapatillas para correr', price: 64990, store: 'paris.cl', url: 'https://www.paris.cl/', note: 'Talla 38. Ojalá blancas o grises' },
    { ...base, id: 'e3', position: 2, emoji: '👕', title: 'Polerón oversize', price: 24990, store: 'zara.com', url: 'https://www.zara.com/cl/', note: 'Talla M, colores tierra: café, crema o verde oliva' },
    { ...base, id: 'e4', position: 3, emoji: '📚', title: 'Una novela de ciencia ficción', price: 16990, store: 'buscalibre.cl', url: 'https://www.buscalibre.cl/', note: 'Me encantó «Proyecto Hail Mary», algo parecido' },
    { ...base, id: 'e5', position: 4, emoji: '☕', title: 'Cafetera de émbolo', price: 19990, store: 'ripley.cl', url: 'https://simple.ripley.cl/', note: 'La mía se quebró 🥲' },
    { ...base, id: 'e6', position: 5, emoji: '🪴', title: 'Una planta para el depto', price: null, store: null, note: 'Que sea difícil de matar jaja' },
    { ...base, id: 'e7', position: 6, emoji: '🧴', title: 'Perfume fresco para el verano', price: 34990, store: 'paris.cl', url: 'https://www.paris.cl/', note: 'Algo cítrico, nada muy dulce', priority: true },
    { ...base, id: 'e8', position: 7, emoji: '💰', title: 'Aporte para mi viaje al sur', price: null, store: null, note: 'Lo que sea su cariño 🏔️', qty: 5 },
  ];
  const claims = [
    { id: 'c1', item_id: 'e2', name: 'Tío Pedro', qty: 1, created_at: created },
    { id: 'c2', item_id: 'e5', name: 'Cami', qty: 1, created_at: created },
    { id: 'c3', item_id: 'e8', name: 'Abuela Rosa', qty: 1, created_at: created },
    { id: 'c4', item_id: 'e8', name: 'Seba', qty: 1, created_at: created },
  ];
  return { list, items, claims };
}

/** "Backend" de juguete para la lista de ejemplo: las reservas viven solo en memoria. */
export function createExampleBackend() {
  const data = exampleData();
  const mine = new Map();
  return {
    data,
    async claimItem(itemId, name, qty = 1) {
      const item = data.items.find((i) => i.id === itemId);
      const taken = data.claims.filter((c) => c.item_id === itemId).reduce((s, c) => s + c.qty, 0);
      if (!item || taken + qty > item.qty) throw Object.assign(new Error('item_full'), { code: 'item_full' });
      const claim = { id: `x${Date.now()}`, item_id: itemId, name: name || null, qty, created_at: new Date().toISOString() };
      data.claims.push(claim);
      mine.set(claim.id, true);
      return claim;
    },
    async unclaim(claimId) {
      data.claims = data.claims.filter((c) => c.id !== claimId);
      mine.delete(claimId);
    },
    isMine: (id) => mine.has(id),
  };
}
