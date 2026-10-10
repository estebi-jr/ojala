# Ojalá ✦ tu lista de deseos

**Sitio:** https://estebi-jr.github.io/ojala/

Crea una lista de deseos para tu cumpleaños, Navidad, amigo secreto, baby shower, matrimonio o lo que celebres. Pega links de cualquier tienda (la foto, el nombre y el precio se cargan solos), compártela por WhatsApp y deja que tus invitados reserven lo que van a regalar. Nadie repite regalos y tú no te enteras de nada hasta el gran día.

![Ojalá](assets/og-image.png)

## Qué trae

| Función | Detalle |
|---|---|
| Listas por ocasión | Cumpleaños, Navidad, amigo secreto, baby shower, cumple infantil, matrimonio, graduación, casa nueva y otra. Cada una con sus colores. |
| Varias listas | Todas las que quieras, en "Mis listas". También guarda las listas de otros que visitaste. |
| Agregar con un link | Pegas el link y aparecen la foto, el nombre limpio y el precio (pesos chilenos bien leídos: `18.990` = $18.990). |
| Ideas sin link | "Una Bip cargada", "Plata para el viaje": con emoji automático o foto propia. |
| Comentarios | Cada deseo lleva tu comentario (talla, color, "cualquier marca") como burbuja de iMessage. |
| Favoritos, cantidad y ocultar | Estrella para lo que más quieres, cantidad (ej. 6 copas) y deseos ocultos para los invitados. |
| Reservas sin cuenta | Los invitados tocan "Lo regalo yo", ponen su nombre (opcional) y pueden deshacerlo. |
| Modo sorpresa | El dueño no ve qué le reservaron (se puede apagar). |
| Compartir | Copiar enlace, WhatsApp, Telegram, correo, SMS, hoja nativa del iPhone y código QR descargable para invitaciones. |
| Edición en pareja | Un "enlace para editar" para administrar la lista desde otro celular o entre dos. |
| Orden y filtros | Por orden propio, favoritos, precio, A–Z o tienda; ver todos o solo disponibles; grilla o lista. |
| Instalable | Se agrega a la pantalla de inicio como app (ícono propio). En Android se puede "compartir" un producto directo a Ojalá. |
| Botón para el navegador | En computador, un botón en favoritos agrega la página que estás viendo. |
| Diseño iOS 26 | Liquid Glass en la navegación, tipografía San Francisco, colores del sistema, modo oscuro real y accesibilidad (movimiento y transparencia reducidos). |

## Cómo está hecho

Sitio estático (HTML, CSS y JavaScript sin frameworks ni compilación) + base de datos en **Supabase** (gratis). Así se publica tal cual en **GitHub Pages**.

```
index.html               Página única de la app
css/app.css              Todo el diseño (tokens de color, vidrio, componentes)
js/config.js             ← lo único que tienes que editar para conectar la base de datos
js/app.js                Arranque y rutas (#/l/codigo, #/nueva, …)
js/views/*.js            Pantallas: portada, mis listas, crear, lista, deseos, compartir, ajustes
js/store/                Datos: modo demo (navegador) o Supabase
js/preview.js            Lectura de links (foto, nombre, precio)
supabase/schema.sql      Tablas + funciones seguras (pegar en Supabase)
supabase/functions/      Función opcional para leer links desde tu propio servidor
```

Hay dos modos:

- **Demo** (sin configurar nada): todo funciona, pero las listas viven solo en tu navegador. Sirve para probar.
- **Real** (con Supabase): las listas se comparten con cualquiera que tenga el enlace y las reservas se sincronizan.

## Publicarla (unos 15 minutos)

### 1. Base de datos en Supabase

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo (plan Free, región São Paulo es la más cercana a Chile).
2. Abre **SQL Editor → New query**, pega todo el contenido de `supabase/schema.sql` y presiona **Run**. Debe decir "Success".
3. Ve a **Settings → API Keys** (o al botón **Connect** del proyecto) y copia:
   - la **Project URL** (algo como `https://abcd1234.supabase.co`)
   - la **publishable key** (empieza con `sb_publishable_`)
4. Pégalas en `js/config.js`:

```js
supabaseUrl: 'https://abcd1234.supabase.co',
supabaseKey: 'sb_publishable_xxxxxxxxxxxx',
```

Ambas son públicas por diseño: nadie puede leer ni escribir las tablas directo. Todo pasa por funciones que revisan el enlace para editar.

### 2. GitHub Pages

1. Sube esta carpeta a un repositorio (por ejemplo `ojala`).
2. En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
3. En un par de minutos queda en `https://TU-USUARIO.github.io/ojala/`.
4. Si el repositorio no se llama `ojala`, cambia la URL de `og:image` en `index.html` para que la vista previa de WhatsApp muestre la imagen.

### 3. Lectura de links propia

La app consulta en paralelo [Microlink](https://microlink.io) (gratis, unas 50 lecturas al día por persona) y una función propia de Supabase, y junta lo que traiga cada una. La función lee la API de tiendas VTEX (Levi's, AE y muchas chilenas), Shopify, JSON-LD y og:*, y entra como bot de vista previa a tiendas que bloquean servidores (Zara).

1. Supabase → **Edge Functions → Deploy a new function → Via Editor**, nombre `link-preview`, pega `supabase/functions/link-preview/index.ts`, desactiva "Verify JWT" (la función valida la llave publicable) y **Deploy**.
2. En `js/config.js`: `linkPreview: { microlink: true, edgeFunction: true }`.
3. Para depurar una tienda: `…/functions/v1/link-preview?apikey=<llave publicable>&debug=1&url=<link>`. Cada lectura deja en los logs de la función qué recibió de la tienda (estado, tamaño y título).
4. **Mercado Libre** bloquea a los servidores, así que se lee con su API oficial: crea una app en [developers.mercadolibre.cl](https://developers.mercadolibre.cl/devcenter) con Redirect URI `https://<proyecto>.supabase.co/functions/v1/link-preview/ml-callback` (sin PKCE; en *Flujos Oauth* marcar Authorization Code, Refresh Token y Client Credentials; permisos solo de lectura), guarda `ML_CLIENT_ID` y `ML_CLIENT_SECRET` en **Edge Functions → Secrets** y abre `…/functions/v1/link-preview/ml-login` una vez para autorizar. El token queda en `private.ml_token` y se renueva solo.

## Probarla en tu computador

```bash
cd ojala
python3 -m http.server 8000
# abre http://localhost:8000
```

## Personalizar

- **Nombre**: `brand` en `js/config.js`, `<title>` en `index.html` y `manifest.webmanifest`.
- **Ocasiones, colores y textos sugeridos**: `js/occasions.js`.
- **Dominio propio** (ej. `ojala.cl`): configúralo en GitHub Pages y ponlo en `publicUrl` de `js/config.js`.

## Seguridad, en simple

- Sin cuentas: al crear una lista se genera un **enlace para editar** secreto. Se guarda en tu navegador y puedes copiarlo para abrir la lista en otro dispositivo.
- En la base de datos solo se guarda el *hash* (sha256) de ese enlace, nunca el enlace.
- Las tablas tienen RLS activado y sin políticas: la API solo puede ejecutar las funciones de `schema.sql`.
- Las reservas también tienen su propio token para que solo quien reservó pueda deshacer.

## Ojo con

- **Pausa del plan gratis**: Supabase puede pausar proyectos Free con poca actividad durante 7 días. Te avisa por correo y se reactiva con **Resume project** sin perder datos.
- **Vista previa en WhatsApp**: al compartir una lista se ve la imagen general de Ojalá, no la portada de esa lista. Para eso hace falta un servidor (ver próximos pasos).

## Próximos pasos sugeridos

1. Dominio propio corto (`ojala.cl` o similar) para que el link se vea confiable.
2. Vista previa personalizada por lista en WhatsApp (Cloudflare Workers o Vercel).
3. Monetización como Wishbob: links de afiliado en los "Ver en la tienda" (Soicos, Skimlinks, programas de Falabella o Mercado Libre).
4. Recordatorio por correo una semana antes del evento.
5. Extensión de navegador y atajo de iPhone para agregar productos desde cualquier app.

---

Hecho en Chile 🇨🇱 · Código QR con [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT).
