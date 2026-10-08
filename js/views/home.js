// "Mis listas": las listas que puedo editar en este dispositivo y las que visité
import { isDemo, keychain, visited } from '../store/index.js';
import { applyTheme, getOccasion, thumbBackground } from '../occasions.js';
import { brandMark, icon } from '../icons.js';
import { countdownText, daysUntil, esc, formatDateShort } from '../util.js';

function rowHtml(l, { mine }) {
  const occ = getOccasion(l.occasion);
  const days = daysUntil(l.event_date);
  const when = l.event_date ? ` · ${formatDateShort(l.event_date)}${days != null && days >= 0 ? ` · ${countdownText(l.event_date)}` : ''}` : '';
  const sub = mine ? `${occ.label}${when}` : `${l.owner_name ? `De ${l.owner_name}` : occ.label}${when}`;
  return `<a class="list-row" href="#/l/${esc(l.slug)}">
    <span class="list-thumb" style="${thumbBackground(l.occasion)}" aria-hidden="true">${occ.emoji}</span>
    <span class="list-row-main"><h3>${esc(l.title)}</h3><p>${esc(sub)}</p></span>
    ${mine && l.count != null ? `<span class="count" aria-label="${l.count} deseos">${l.count}</span>` : ''}
    <span class="chev">${icon('chevronRight', 'sm')}</span>
  </a>`;
}

export function HomeView() {
  applyTheme(null);
  const mine = keychain.list();
  const seen = visited.list();
  const name = mine.find((l) => l.owner_name)?.owner_name;
  const greeting = name ? `Hola, ${esc(name.split(' ')[0])} 👋` : 'Tus listas guardadas en este dispositivo';

  const demo = isDemo
    ? `<div class="notice">${icon('info')}<span><b>Modo demo.</b> Tus listas viven solo en este navegador. Conecta la base de datos (ver README) para compartirlas con tu familia.</span></div>`
    : '';

  const mineHtml = mine.length
    ? `<div class="list-rows">${mine.map((l) => rowHtml(l, { mine: true })).join('')}<a class="list-row new-list-row" href="#/nueva">${icon('plus')} Crear otra lista</a></div>`
    : `<div class="empty"><div class="empty-icon">${icon('gift')}</div><h2>Aún no tienes listas</h2><p>Crea tu primera lista de deseos en un minuto.</p><a class="btn btn-primary" href="#/nueva">${icon('plus')} Crear mi lista</a></div>`;

  return {
    html: `<div class="page page-plain">
      <header class="topbar" id="topbar">
        <div class="topbar-left"><a href="#/inicio" aria-label="Ojalá, inicio">${brandMark()}</a></div>
        <div class="topbar-title">Mis listas</div>
        <div class="topbar-right"><a class="icon-btn" href="#/ajustes" aria-label="Ajustes">${icon('sliders')}</a></div>
      </header>
      <div class="wrap home-wrap">
        <div class="large-head">
          <div><h1 class="t-large">Mis listas</h1><p class="muted t-sub">${greeting}</p></div>
          <a class="btn btn-primary btn-sm" href="#/nueva">${icon('plus', 'sm')} Nueva</a>
        </div>
        <div style="display:grid;gap:14px">${demo}${mineHtml}</div>
        ${seen.length ? `<h2 class="sub-title">Listas que visitaste</h2><div class="list-rows">${seen.map((l) => rowHtml(l, { mine: false })).join('')}</div>` : ''}
      </div>
    </div>`,
  };
}
