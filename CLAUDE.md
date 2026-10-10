# Ojalá · Instrucciones para sesiones de código

Web de listas de deseos estilo iOS 26. En vivo: https://estebi-jr.github.io/ojala/ (GitHub Pages desde `main`, raíz). Contexto completo, diseño, decisiones y pendientes viven en el **Proyecto de Claude "OJALÁ Wishlist"** (`docs/*.md`); léelos antes de cambios grandes.

## Stack
- HTML/CSS/JS modular **sin frameworks ni build**. No agregar dependencias ni bundlers sin decisión explícita de Esteban.
- Router por hash (`js/router.js`). Vistas en `js/views/`. Datos en `js/store/` (adaptador demo con localStorage o Supabase según `js/config.js`).
- Supabase proyecto `iidunkhmjxprjnpxxtvc` (sa-east-1). Esquema en `supabase/schema.sql` (idempotente). Toda la data pasa por funciones RPC con token; nunca exponer tablas ni usar la secret key en el front.

## Reglas
- **No romper:** rutas existentes (`#/l/<slug>`, `#/admin/<slug>/<token>`), formato de localStorage (`ojala.*.v1`), flujo de reservas, enlaces ya compartidos.
- **Diseño:** seguir `docs/DISENO.md` del Proyecto (iOS 26, toque ≥44, escala 11·12·13·15·16·17·20·22·28·34, lista NO CAMBIAR).
- **Cambios de diseño grandes:** en rama aparte, bloques marcados `/* <pase> · Bloque X */`, un commit por bloque, propuesta como artefacto nuevo, merge solo con aprobación.
- **SQL nuevo:** agregarlo a `supabase/schema.sql` manteniéndolo idempotente. Sentencias con REVOKE/DROP las corre Esteban en el SQL Editor (el conector las cancela).
- Commits en español, pequeños y descriptivos. Push a `main` = deploy en producción: probar antes.

## Cómo probar
- Local: `python3 -m http.server 8000` y abrir http://localhost:8000 (sin `supabaseUrl` → modo demo).
- Revisar en 393×852 (claro/oscuro) y desktop, sin errores de consola ni scroll horizontal.
- Lógica de base: `select` de verificación o bloque `do $$ … raise exception … $$` (se deshace solo) vía conector Supabase.

## Al cerrar una sesión con cambios
Actualizar en el Proyecto: `docs/BITACORA.md` (entrada nueva al final), `docs/PENDIENTES.md`, y `docs/DECISIONES.md` si se decidió algo.
