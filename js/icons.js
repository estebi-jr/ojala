// Iconos de línea (24×24) dibujados para Ojalá
const P = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  share: '<path d="M8.5 9.5H7A2 2 0 0 0 5 11.5v7A2 2 0 0 0 7 20.5h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1.5"/><path d="M12 3.5v11"/><path d="M8.5 7 12 3.5 15.5 7"/>',
  link: '<path d="M10.2 13.8a4.2 4.2 0 0 0 6 0l2.6-2.6a4.2 4.2 0 0 0-6-6L11.6 6.4"/><path d="M13.8 10.2a4.2 4.2 0 0 0-6 0l-2.6 2.6a4.2 4.2 0 0 0 6 6l1.2-1.2"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4.5" rx="1.3"/><path d="M5 12.5v6.5A1.5 1.5 0 0 0 6.5 20.5h11A1.5 1.5 0 0 0 19 19v-6.5"/><path d="M12 8v12.5"/><path d="M12 8S10.6 3.8 8.2 3.8a2.1 2.1 0 0 0 0 4.2H12Z"/><path d="M12 8s1.4-4.2 3.8-4.2a2.1 2.1 0 0 1 0 4.2H12Z"/>',
  star: '<path d="m12 3.6 2.55 5.2 5.7.83-4.12 4.03.97 5.68L12 16.67l-5.1 2.68.97-5.68L3.75 9.63l5.7-.83Z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.5"/><path d="m8.3 12.3 2.6 2.6 4.9-5.2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="m6 7 .9 12.1A1.6 1.6 0 0 0 8.5 20.5h7a1.6 1.6 0 0 0 1.6-1.4L18 7"/><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2"/>',
  pencil: '<path d="M4 20h4L19.2 8.8a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  more: '<circle cx="6" cy="12" r="1.7" class="f"/><circle cx="12" cy="12" r="1.7" class="f"/><circle cx="18" cy="12" r="1.7" class="f"/>',
  chevronLeft: '<path d="M15 4.5 7.5 12l7.5 7.5"/>',
  chevronRight: '<path d="m9 4.5 7.5 7.5L9 19.5"/>',
  chevronDown: '<path d="m5 9 7 7 7-7"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><path d="M14 14h2.5v2.5H14zM18.5 14H20M14 19v1M17.5 18.5H20V20"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.6"/><path d="M15.5 8.5V6.2a2.7 2.7 0 0 0-2.7-2.7H6.2a2.7 2.7 0 0 0-2.7 2.7v6.6a2.7 2.7 0 0 0 2.7 2.7h2.3"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3.5 3.5l17 17"/><path d="M10.6 5.7c.45-.1.92-.2 1.4-.2 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.7C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  sort: '<path d="M7.5 4v16M4 7.5 7.5 4 11 7.5M16.5 20V4M13 16.5l3.5 3.5 3.5-3.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  rows: '<rect x="4" y="4.5" width="5.5" height="5.5" rx="1.6"/><rect x="4" y="14" width="5.5" height="5.5" rx="1.6"/><path d="M13 6h7M13 9h4.5M13 15.5h7M13 18.5h4.5"/>',
  photo: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.7"/><path d="m4 17.5 5-4.5 3.5 3 3-2.5 4.5 4"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M18 14v3.5A2.5 2.5 0 0 1 15.5 20h-9A2.5 2.5 0 0 1 4 17.5v-9A2.5 2.5 0 0 1 6.5 6H10"/>',
  bag: '<path d="M5.5 8.5h13l-1 11a1.6 1.6 0 0 1-1.6 1.5H8.1a1.6 1.6 0 0 1-1.6-1.5Z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  chat: '<path d="M20 11.4c0 4.1-3.6 7.4-8 7.4a8.9 8.9 0 0 1-3.4-.7L4 19.5l1.3-3.6A7 7 0 0 1 4 11.4C4 7.3 7.6 4 12 4s8 3.3 8 7.4Z"/>',
  send: '<path d="M20.5 3.5 10.6 13.4"/><path d="m20.5 3.5-6.3 17-3.6-7.1-7.1-3.6Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7.5 8 5.5 8-5.5"/>',
  sms: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V16h0A1.5 1.5 0 0 1 4 14.5Z"/><path d="M8.5 10h.01M12 10h.01M15.5 10h.01"/>',
  sparkle: '<path d="M12 3c.5 4.6 2.4 6.5 7 7-4.6.5-6.5 2.4-7 7-.5-4.6-2.4-6.5-7-7 4.6-.5 6.5-2.4 7-7Z"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  top: '<path d="M5 4.5h14M12 20V9M7 13.5l5-5 5 5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  clipboard: '<rect x="5.5" y="5" width="13" height="15.5" rx="2.5"/><path d="M9 5V4.3A1.3 1.3 0 0 1 10.3 3h3.4A1.3 1.3 0 0 1 15 4.3V5"/><path d="M9 11h6M9 14.5h4"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="3"/><path d="M10.5 18.5h3"/>',
  home: '<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-5v6h-4A1.5 1.5 0 0 1 4 19Z"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1.2" class="f"/><circle cx="4.8" cy="12" r="1.2" class="f"/><circle cx="4.8" cy="17.5" r="1.2" class="f"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6.1M17 14.3a5.5 5.5 0 0 1 3.5 5.2"/>',
  wand: '<path d="m4 20 11-11M14 4v3M12.5 5.5h3M19 9v2.5M17.8 10.2h2.5M18 3.5l.01.01"/>',
  refresh: '<path d="M19.5 11A7.5 7.5 0 0 0 6 6.5L4.5 8M4.5 13A7.5 7.5 0 0 0 18 17.5l1.5-1.5"/><path d="M4.5 4v4h4M19.5 20v-4h-4"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20Z"/>',
};

/** Devuelve el SVG de un icono. `cls` agrega clases (sm, xs, lg, fill). */
export function icon(name, cls = '') {
  const body = P[name] || P.sparkle;
  const filled = cls.includes('fill');
  const inner = body.replace(/class="f"/g, 'fill="currentColor" stroke="none"');
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"${filled ? '' : ''}>${inner}</svg>`;
}

/** Marca "ojalá" con la tilde convertida en destello. */
export function brandMark(cls = '') {
  return `<span class="brand ${cls}" aria-label="Ojalá">ojal<span class="brand-a">a<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="url(#brandGrad)" d="M12 1.5c.7 6.3 3.3 8.9 9.6 9.6-6.3.7-8.9 3.3-9.6 9.6-.7-6.3-3.3-8.9-9.6-9.6C8.7 10.4 11.3 7.8 12 1.5Z"/></svg></span></span>`;
}
