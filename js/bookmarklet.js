// Botón "Agregar a Ojalá" para la barra de favoritos.
// Corre dentro de la página de la tienda que el usuario está mirando (su propio navegador),
// así que lee nombre, foto y precio aunque la tienda bloquee a los servidores (Ripley, DBS, PC Factory…).
// Ojo: grab() se serializa con toString(); no usar comentarios // dentro ni dependencias externas.

/* eslint-disable */
function grab(base) {
  var d = document;
  var q = function (s) { return d.querySelector(s); };
  var meta = function (n) {
    var e = q('meta[property="' + n + '"],meta[name="' + n + '"],meta[itemprop="' + n + '"]');
    return e && e.getAttribute('content');
  };
  var t = meta('og:title') || meta('twitter:title');
  var img = meta('og:image') || meta('og:image:secure_url') || meta('twitter:image');
  var p = meta('og:price:amount') || meta('product:price:amount');
  var c = meta('og:price:currency') || meta('product:price:currency');
  var prods = [];
  var walk = function (o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    var ty = [].concat(o['@type']);
    if (ty.indexOf('Product') > -1 || ty.indexOf('ProductGroup') > -1) prods.push(o);
    walk(o['@graph']); walk(o.hasVariant);
  };
  d.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) { try { walk(JSON.parse(s.textContent)); } catch (e) {} });
  var offer = function (list) {
    list = [].concat(list || []);
    for (var i = 0; i < list.length; i++) {
      var x = list[i]; if (!x || typeof x !== 'object') continue;
      var sp = [].concat(x.priceSpecification || [])[0] || {};
      var v = x.price != null ? x.price : (x.lowPrice != null ? x.lowPrice : sp.price);
      if (v != null && v !== '') return [v, x.priceCurrency || sp.priceCurrency];
      var r = x.offers && offer(x.offers); if (r) return r;
    }
  };
  var ldName = '';
  prods.forEach(function (pr) {
    ldName = ldName || pr.name || '';
    var im = [].concat(pr.image || [])[0];
    img = img || (im && (im.url || im.contentUrl || im));
    if (!p) { var o = offer(pr.offers); if (o) { p = o[0]; c = c || o[1]; } }
  });
  if (!p) { var ip = q('[itemprop="price"]'); if (ip) p = ip.getAttribute('content') || ip.textContent; }
  if (!p) {
    var els = d.querySelectorAll('[class*="price" i],[class*="precio" i],[id*="price" i],[data-testid*="price" i]');
    for (var k = 0; k < els.length; k++) {
      var b = els[k].getBoundingClientRect();
      if (!b.width || !b.height || b.top > innerHeight * 1.5) continue;
      var mt = (els[k].textContent || '').match(/\$\s?\d{1,3}(?:[.,]\d{3})+|\$\s?[1-9]\d*/);
      if (mt) { p = mt[0]; break; }
    }
  }
  if (!img) {
    var best = 0;
    d.querySelectorAll('img').forEach(function (i) {
      var r = i.getBoundingClientRect(), a = r.width * r.height;
      if (a > best && r.width > 120 && r.top < innerHeight * 1.5) { best = a; img = i.currentSrc || i.src; }
    });
  }
  var h1 = q('h1');
  var u = new URLSearchParams({ url: location.href });
  var add = function (key, v) { v = String(v || '').replace(/\s+/g, ' ').trim(); if (v) u.set(key, v.slice(0, 400)); };
  add('t', t || ldName); add('h', h1 && h1.textContent);
  if (img && !/^data:/.test(img)) { try { add('img', new URL(img, location.href).href); } catch (e) {} }
  add('p', p); add('c', c);
  window.open(base + '#/agregar?' + u.toString(), '_blank');
}
/* eslint-enable */

export function bookmarkletHref(base) {
  return `javascript:${encodeURIComponent(`(${grab.toString()})(${JSON.stringify(base)})`)}`;
}

/** Datos que mandó el marcador (o el texto compartido) en la URL: #/agregar?url=…&t=…&h=…&img=…&p=…&c=… */
export const HINT_KEYS = ['t', 'h', 'img', 'p', 'c', 'st'];
export function hintFromQuery(query) {
  const h = {};
  HINT_KEYS.forEach((k) => { const v = query.get(k); if (v) h[k] = v; });
  return Object.keys(h).length ? h : null;
}
export function hintQuery(hint) {
  if (!hint) return '';
  const qs = new URLSearchParams();
  HINT_KEYS.forEach((k) => { if (hint[k]) qs.set(k, hint[k]); });
  const s = qs.toString();
  return s ? `&${s}` : '';
}
