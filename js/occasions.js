// Ocasiones: cada una trae su emoji, colores (claro/oscuro) y textos sugeridos
export const OCCASIONS = [
  {
    id: 'cumple', label: 'Cumpleaños', emoji: '🎂', hint: 'Tu día, tus reglas',
    light: ['#FF2D55', '#FFFFFF'], dark: ['#FF375F', '#FFFFFF'], aurora: ['#FF8D28', '#FF2D55', '#CB30E0'],
    title: (n) => (n ? `El cumple de ${n}` : 'Mi cumpleaños'),
    share: 'Esta es mi lista de deseos para mi cumpleaños 🎂',
    message: '¡Hola! Armé esta lista para que no tengan que adivinar. Lo más importante es que estén ese día 🫶',
  },
  {
    id: 'navidad', label: 'Navidad', emoji: '🎄', hint: 'Para el viejito pascuero',
    light: ['#E9152D', '#FFFFFF'], dark: ['#FF4245', '#FFFFFF'], aurora: ['#FF383C', '#34C759', '#FFCC00'],
    title: (n) => (n ? `La Navidad de ${n}` : 'Mi lista de Navidad'),
    share: 'Mi lista de deseos para esta Navidad 🎄',
    message: '¡Jo, jo, jo! Por si el viejito pascuero necesita ideas 🎅',
  },
  {
    id: 'amigo', label: 'Amigo secreto', emoji: '🎁', hint: 'Ideas para quien te toque',
    light: ['#B02FC2', '#FFFFFF'], dark: ['#DB34F2', '#FFFFFF'], aurora: ['#CB30E0', '#6155F5', '#FF2D55'],
    title: (n) => (n ? `Amigo secreto de ${n}` : 'Mi amigo secreto'),
    share: 'Si te toqué en el amigo secreto, aquí van ideas 🤫🎁',
    message: 'Si te toqué, aquí van algunas ideas. ¡Cualquier cosa de la lista me hace feliz!',
  },
  {
    id: 'baby', label: 'Baby shower', emoji: '🍼', hint: 'Para la guagua que viene',
    light: ['#007EAE', '#FFFFFF'], dark: ['#3CD3FE', '#00131D'], aurora: ['#3CD3FE', '#00C8B3', '#FFC6DD'],
    title: (n) => (n ? `Baby shower de ${n}` : 'Nuestro baby shower'),
    share: 'Esta es la lista para el baby shower 🍼',
    message: '¡Gracias por acompañarnos en esta etapa! Armamos esta lista con lo que más vamos a necesitar 💛',
  },
  {
    id: 'infantil', label: 'Cumple infantil', emoji: '🎈', hint: 'Para los más chicos',
    light: ['#C55300', '#FFFFFF'], dark: ['#FF9230', '#1F1300'], aurora: ['#FFCC00', '#FF8D28', '#00C0E8'],
    title: (n) => (n ? `El cumple de ${n}` : 'Cumpleaños'),
    share: 'Ideas de regalo para el cumpleaños 🎈',
    message: '¡Gracias por venir a celebrar! Aquí van algunas ideas que le encantarían 🎈',
  },
  {
    id: 'boda', label: 'Matrimonio', emoji: '💍', hint: 'Lista de novios',
    light: ['#956D51', '#FFFFFF'], dark: ['#DBA679', '#1E1404'], aurora: ['#F4D9C6', '#E2C29B', '#D7C3F2'],
    title: (n) => (n ? `El matrimonio de ${n}` : 'Nuestro matrimonio'),
    share: 'Nuestra lista de regalos de matrimonio 💍',
    message: 'Su compañía es el mejor regalo. Si además quieren regalarnos algo, aquí van algunas ideas para nuestro nuevo hogar 🤍',
  },
  {
    id: 'grado', label: 'Graduación', emoji: '🎓', hint: 'Cerrando una etapa',
    light: ['#6155F5', '#FFFFFF'], dark: ['#6D7CFF', '#FFFFFF'], aurora: ['#6155F5', '#0088FF', '#00C0E8'],
    title: (n) => (n ? `La graduación de ${n}` : 'Mi graduación'),
    share: 'Mi lista de deseos para la graduación 🎓',
    message: '¡Por fin! Gracias por acompañarme en el camino 🎓',
  },
  {
    id: 'casa', label: 'Casa nueva', emoji: '🏡', hint: 'Para el nuevo hogar',
    light: ['#008198', '#FFFFFF'], dark: ['#00D2E0', '#00171B'], aurora: ['#34C759', '#00C3D0', '#00C8B3'],
    title: (n) => (n ? `La casa nueva de ${n}` : 'Nuestro nuevo hogar'),
    share: 'Ideas para nuestra casa nueva 🏡',
    message: '¡Nos cambiamos! Aquí van algunas cosas que nos ayudarían a armar el hogar 🏡',
  },
  {
    id: 'otra', label: 'Otra ocasión', emoji: '✨', hint: 'Lo que tú quieras',
    light: ['#0088FF', '#FFFFFF'], dark: ['#0091FF', '#FFFFFF'], aurora: ['#0088FF', '#6155F5', '#00C0E8'],
    title: (n) => (n ? `La lista de ${n}` : 'Mi lista de deseos'),
    share: 'Esta es mi lista de deseos ✨',
    message: '¡Hola! Aquí van algunas cosas que me encantaría tener ✨',
  },
];

/** Colores de la marca (landing, inicio y ajustes) */
export const BRAND_THEME = {
  light: ['#FF2D55', '#FFFFFF'], dark: ['#FF375F', '#FFFFFF'], aurora: ['#FF8D28', '#FF2D55', '#CB30E0'],
};

export const getOccasion = (id) => OCCASIONS.find((o) => o.id === id) || OCCASIONS[OCCASIONS.length - 1];

/** Pinta la app con los colores de una ocasión (o de la marca). */
export function applyTheme(occasionId) {
  const t = occasionId ? getOccasion(occasionId) : BRAND_THEME;
  const s = document.documentElement.style;
  s.setProperty('--accent-l', t.light[0]);
  s.setProperty('--on-accent-l', t.light[1]);
  s.setProperty('--accent-d', t.dark[0]);
  s.setProperty('--on-accent-d', t.dark[1]);
  s.setProperty('--a1', t.aurora[0]);
  s.setProperty('--a2', t.aurora[1]);
  s.setProperty('--a3', t.aurora[2]);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.light[0]);
}

/** Estilo en línea con los colores de una ocasión (para miniaturas). */
export function occasionVars(occasionId) {
  const o = getOccasion(occasionId);
  return `--c1:${o.aurora[0]};--c2:${o.aurora[1]};--c3:${o.aurora[2]};--chip-tint:color-mix(in srgb, ${o.aurora[1]} 18%, transparent)`;
}

export function thumbBackground(occasionId) {
  const o = getOccasion(occasionId);
  return `background: radial-gradient(90% 90% at 20% 15%, ${o.aurora[0]}, transparent 70%), radial-gradient(90% 90% at 90% 90%, ${o.aurora[2]}, transparent 70%), ${o.aurora[1]};`;
}
