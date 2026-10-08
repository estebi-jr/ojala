// =====================================================================
// Configuración de Ojalá
// Este es el único archivo que necesitas tocar para pasar del modo demo
// al modo real (con base de datos para compartir listas de verdad).
// =====================================================================

export const CONFIG = {
  // Nombre de la marca (aparece en títulos y textos)
  brand: 'Ojalá',

  // --- Supabase (base de datos gratis) ---
  // Déjalos vacíos para el modo demo (todo se guarda en el navegador).
  // Para el modo real: Supabase → Project Settings → API.
  //   supabaseUrl: 'https://xxxxxxxx.supabase.co'
  //   supabaseKey: la "publishable key" (sb_publishable_...) o la "anon key".
  // Ambas son públicas por diseño: la seguridad la ponen las funciones SQL.
  supabaseUrl: 'https://iidunkhmjxprjnpxxtvc.supabase.co',
  supabaseKey: 'sb_publishable_AV3N2M7WRlriM09hMLpMaQ_aw0C2b2A',

  // --- Lectura automática de links (foto, nombre y precio) ---
  linkPreview: {
    microlink: true,     // servicio gratuito (≈50 links al día por persona)
    edgeFunction: false, // true = usa tu función propia de Supabase como respaldo
  },

  // Achica las fotos pesadas de las tiendas con un CDN gratuito (más rápido en celular)
  imageProxy: true,

  // Moneda y formato por defecto
  defaultCurrency: 'CLP',
  locale: 'es-CL',

  // Si algún día usas dominio propio (ej. https://ojala.cl/), ponlo aquí
  // para que los links compartidos usen ese dominio.
  publicUrl: '',
};
