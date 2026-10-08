// Portada del sitio: lo primero que ve alguien nuevo (o un invitado que quiere su propia lista)
import { keychain } from '../store/index.js';
import { OCCASIONS, applyTheme, occasionVars } from '../occasions.js';
import { brandMark, icon } from '../icons.js';
import { esc } from '../util.js';
import { exampleData } from '../example.js';
import { avatarHtml, cardHtml, coverHtml } from './cards.js';
import { getOccasion } from '../occasions.js';
import { countdownText, formatDateShort } from '../util.js';

function phoneScreen() {
  const { list, items, claims } = exampleData();
  const claimsByItem = new Map();
  claims.forEach((c) => claimsByItem.set(c.item_id, [...(claimsByItem.get(c.item_id) || []), c]));
  const ctx = { mode: 'guest', showClaims: true, claimsByItem, myClaimIds: new Set(), list };
  const occ = getOccasion(list.occasion);
  return `<div class="page list-page">
    <div class="cover">${coverHtml(list)}</div>
    <div class="wrap">
      <section class="list-hero">
        <div class="avatar-wrap">${avatarHtml(list)}</div>
        <h1 class="list-title">${esc(list.title)}</h1>
        <div class="meta-chips"><span class="chip accent">${occ.emoji} ${esc(occ.label)}</span><span class="chip">${icon('calendar')} ${esc(formatDateShort(list.event_date))} · ${esc(countdownText(list.event_date))}</span></div>
      </section>
      <div class="grid">${items.slice(0, 4).map((it, i) => cardHtml(it, ctx, i)).join('')}</div>
    </div>
  </div>`;
}

const FEATURES = [
  [
    ['#0A84FF', 'photo', 'Fotos automáticas', 'Pegas el link y aparece el producto con su foto, nombre y precio.'],
    ['#30B85A', 'chat', 'Comentarios en cada regalo', 'Talla, color, modelo o "cualquier marca sirve", como un mensaje tuyo.'],
    ['#FF9500', 'gift', 'Cero regalos repetidos', 'Tus invitados reservan sin crear cuenta y ven qué queda disponible.'],
  ],
  [
    ['#AF52DE', 'eyeOff', 'Modo sorpresa', 'Tú no ves qué te reservaron. La sorpresa queda intacta hasta el día.'],
    ['#FF2D55', 'qr', 'QR para invitaciones', 'Descárgalo e imprímelo en la invitación del baby shower o del matrimonio.'],
    ['#5856D6', 'people', 'Listas en pareja', 'Comparte el enlace para editar y armen juntos la lista de novios.'],
  ],
];

export function LandingView() {
  applyTheme(null);
  const hasLists = keychain.list().length > 0;
  const rows = (group) => `<div class="group">${group.map(([c, ic, t, d]) => `<div class="set-row"><span class="set-ic" style="background:${c}">${icon(ic)}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></div>`).join('')}</div>`;

  return {
    html: `<div class="page landing">
      <div class="wrap">
        <header class="landing-nav">
          <a href="#/inicio" aria-label="Ojalá, inicio">${brandMark()}</a>
          <nav aria-label="Principal">
            ${hasLists ? '<a class="btn btn-sm btn-glass" href="#/">Mis listas</a>' : '<a class="btn btn-sm btn-plain" href="#/ejemplo">Ver ejemplo</a>'}
            <a class="btn btn-sm btn-gray" href="#/nueva">Crear lista</a>
          </nav>
        </header>

        <section class="hero">
          <div>
            <h1 class="hero-title">Que te regalen lo que de verdad quieres.</h1>
            <p class="hero-sub">Arma tu lista de deseos con links de cualquier tienda y compártela por WhatsApp. Tus invitados reservan lo que van a regalar para no repetirse, y tú no te enteras de nada hasta el gran día.</p>
            <div class="hero-cta">
              <a class="btn btn-primary" href="#/nueva">${icon('plus')} Crear mi lista</a>
              <a class="btn btn-glass" href="#/ejemplo">Ver un ejemplo</a>
            </div>
            <div class="hero-note"><span>${icon('check')} Gratis</span><span>${icon('check')} Sin crear cuenta</span><span>${icon('check')} Desde cualquier celular</span></div>
          </div>
          <div class="stage">
            <div class="phone" aria-hidden="true">
              <div class="phone-screen"><div class="phone-island"></div><div class="phone-scaler" id="phone-scaler">${phoneScreen()}</div></div>
            </div>
            <div class="float-chip one" aria-hidden="true"><span class="dot" style="background:#0A84FF">${icon('link')}</span><span>Pegas el link<small>y la foto aparece sola</small></span></div>
            <div class="float-chip two" aria-hidden="true"><span class="dot" style="background:#30B85A">${icon('check')}</span><span>Tío Pedro reservó<small>las zapatillas</small></span></div>
          </div>
        </section>

        <section class="section" aria-labelledby="occ-h">
          <div class="section-head"><h2 id="occ-h">Para cada celebración</h2><p>Cada ocasión trae sus propios colores. Elige una y empieza.</p></div>
          <div class="occ-strip">
            ${OCCASIONS.map((o) => `<a class="occ-chip" style="${occasionVars(o.id)}" href="#/nueva/${o.id}"><span class="em" aria-hidden="true">${o.emoji}</span>${esc(o.label)}</a>`).join('')}
          </div>
        </section>

        <section class="section" aria-labelledby="how-h">
          <div class="section-head"><h2 id="how-h">Así de simple</h2></div>
          <div class="steps">
            <div class="step"><span class="step-n">1</span><h3>Elige la ocasión</h3><p>Cumpleaños, Navidad, amigo secreto, baby shower o matrimonio. Ponle fecha y un mensaje para tus invitados.</p></div>
            <div class="step"><span class="step-n">2</span><h3>Pega tus links</h3><p>Copia el link de cualquier tienda y traemos la foto, el nombre y el precio. Suma un comentario con tu talla o color.</p><div class="step-demo">${icon('link')}<span>falabella.com/audifonos-inalambricos…</span></div></div>
            <div class="step"><span class="step-n">3</span><h3>Compártela</h3><p>Mándala por WhatsApp o imprime el QR en la invitación. Cada uno reserva lo que va a regalar.</p></div>
          </div>
        </section>

        <section class="section" aria-labelledby="feat-h">
          <div class="section-head"><h2 id="feat-h">Todo lo que necesitas, nada que sobre</h2></div>
          <div class="settings-like">${FEATURES.map(rows).join('')}</div>
        </section>

        <section class="section">
          <div class="cta-band">
            <h2>Tu próxima celebración empieza con una lista.</h2>
            <p>Créala en un minuto. Sin cuenta y sin contraseñas.</p>
            <a class="btn btn-primary" href="#/nueva">${icon('plus')} Crear mi lista</a>
          </div>
        </section>

        <footer class="site-footer">
          ${brandMark()}
          <nav aria-label="Pie de página"><a href="#/ejemplo">Ver ejemplo</a><a href="#/">Mis listas</a><a href="#/ajustes">Ajustes</a></nav>
          <span>Hecho en Chile 🇨🇱</span>
        </footer>
      </div>
    </div>`,
    mount(root) {
      const scaler = root.querySelector('#phone-scaler');
      const fit = () => {
        const w = scaler.parentElement.clientWidth;
        scaler.style.transform = `scale(${w / 390})`;
      };
      fit();
      window.addEventListener('resize', fit);
      this.destroy = () => window.removeEventListener('resize', fit);
    },
  };
}
