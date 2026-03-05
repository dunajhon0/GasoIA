---
description: general
---

Eres CloudSonnet 4.6 actuando como “builder agent” (no como profesor). OBJETIVO: entregar un repositorio COMPLETO y funcional (código final, no explicaciones) para una web llamada “GasoIA” (puedes parametrizar el nombre) que muestra precios oficiales de carburantes en España, con UX moderna 2026, responsive (móvil + desktop), y actualización automática diaria, lista para desplegarse mediante GitHub -> Cloudflare.

REGLAS IMPORTANTES:
- No me pidas que yo investigue documentación ni que yo “haga pasos manuales” fuera de lo inevitable (credenciales). Debes crear TODO el código y archivos finales.
- Devuelve: 1) árbol de archivos, 2) contenido íntegro de cada archivo (en bloques de código con su ruta), 3) un “Self-check report” final indicando qué validaste (tests/lint/build) y qué endpoints/páginas revisaste.
- Debe estar listo para Cloudflare: Cloudflare Pages (frontend) + Cloudflare Workers (API + cron) + Cloudflare D1 (base de datos). Incluye wrangler.toml, migraciones D1, scripts, y configuración para despliegue reproducible.
- Todo debe cumplir con políticas típicas de Google AdSense/Ads: páginas legales (Privacidad, Cookies, Términos, Contacto), banner de cookies con consentimiento, ads.txt, robots.txt, sitemap.xml, y componente para insertar AdSense (con ID por ENV).
- Rendimiento: caching (Cache API/headers), SSR/edge cuando convenga, y UI fluida.
- Seguridad: sanitizar entradas, rate limit básico en API, CORS correcto, CSP/headers.
- Accesibilidad: AA razonable, teclado, contrastes, aria-labels.
- Diseño: elegante, moderno, 2026, dark mode + light mode, tipografía limpia, gráficas bonitas.

DATOS (OFICIAL):
- Usa la fuente oficial del Ministerio (dataset público) para estaciones terrestres:
  URL: https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/
  Debes solicitar JSON con cabecera: Accept: application/json (si falla, fallback XML y conviertes).
- No scraping de webs de terceros. Solo esta fuente oficial.

FUNCIONALIDADES OBLIGATORIAS (todas con UI):
1) Home dashboard:
   - Precio medio nacional HOY y AYER de: Gasolina 95 (SP95) y Gasóleo A (Diesel A). Mostrar variación (€, %) y un mini-sparkline.
   - “Última actualización” y disclaimer “Datos oficiales”.

2) Histórico 365 días:
   - Gráfico de línea moderno con tendencia últimos 365 días para Gasolina 95 y Gasóleo A (selector).
   - Debe actualizarse automáticamente cada día (cron) y guardar serie histórica en D1.
   - Permitir cambiar: rango (30/90/365), combustible, y ver tooltip con fecha/precio.

3) Calculadora de viaje (moderna):
   - Inputs: combustible, opción de precio (usar precio medio actual o introducir mi precio), kilómetros, y (para que sea real) consumo L/100km (con presets típicos + manual).
   - Output: coste estimado del viaje + coste por 100 km + comparación si usas “precio medio hoy” vs “tu precio”.

4) Buscador de gasolineras cercanas:
   - Opción A: por geolocalización del navegador (si el usuario acepta), ordenar por distancia y mostrar mapa + lista.
   - Opción B: por ciudad/pueblo (busca por campos Municipio/Localidad/Provincia del dataset). Permite filtros por combustible, marca (rótulo), y ordenar por precio.
   - Cada gasolinera: dirección, marca, horario si existe, coordenadas, y precios HOY por combustible disponible (de la fuente oficial).

5) Top 10 ciudades:
   - Tabla de 10 principales ciudades de España con su precio medio HOY de Gasolina 95 y Gasóleo A. (Define lista fija por población: Madrid, Barcelona, Valencia, Sevilla, Zaragoza, Málaga, Murcia, Palma, Las Palmas, Bilbao; si falta alguna en dataset, sustituye por otra grande).
   - Tabla ordenable y con búsqueda.

6) Tabla “Todos los combustibles” (sección aparte):
   - Mostrar HOY, AYER, MÍNIMO HISTÓRICO y MÁXIMO HISTÓRICO (con fecha del min/max) para:
     Sin plomo 95, Sin plomo 98, Gasóleo A, Gasóleo A+, Gasóleo B, Gasóleo C, Biodiésel, Autogás/GLP, GNC.
   - Además mostrar “PVP medio Península y Baleares” (filtrando Ceuta/Melilla/Canarias fuera), y si Baleares separado, incluirlo (si posible) como submétrica.

7) Marcas/surtidores (sección):
   - Cards o ranking de marcas relevantes: Moeve/Cepsa, Repsol, BP, Shell, Alcampo, Petroprix, Plenoil, Ballenoil, Galp, Carrefour (y otras low cost si aparecen).
   - Para una marca seleccionada: promedio nacional hoy de Gasolina 95 y Gasóleo A y comparación vs media nacional (delta).
   - Gráfico (bar/box) elegante para comparar marcas.

8) Contenido para “40 minutos” sin relleno:
   - Incluye interactividad real: filtros avanzados, comparador (Ciudad A vs Ciudad B), favoritos (guardado local), y un “modo ahorro” que sugiere las N gasolineras más baratas cerca (con filtros).

ARQUITECTURA / ACTUALIZACIÓN AUTOMÁTICA:
- Worker con Cron Trigger diario (UTC) que:
  a) descarga el dataset oficial,
  b) guarda un snapshot diario normalizado en D1 (tabla estaciones y tabla precios diarios agregados),
  c) calcula agregados: medias nacionales por combustible, medias por ciudad, medias por marca, min/max históricos por combustible.
- API (Worker o Pages Functions) con endpoints:
  /api/summary?date=YYYY-MM-DD
  /api/history?fuel=...&days=...
  /api/cities/top10?date=...
  /api/fuels/table?date=...
  /api/stations/search?... (q, city, lat/lon, radius, fuel, brand, sort)
  /api/brands?date=...
- Frontend consume esos endpoints con caching y estados de carga.

STACK (elige uno y ejecútalo):
- Preferencia: Astro + React + Tailwind + TypeScript (Cloudflare adapter) O Next.js compatible con Cloudflare. Decide y entrega repo listo.
- Charts: ECharts o Chart.js (bonito y moderno).
- Map: Leaflet o MapLibre (ligero) con clustering opcional.

SEO / ARCHIVOS OBLIGATORIOS:
- robots.txt, sitemap.xml generado (estático) + metadata OpenGraph, JSON-LD, canonical, páginas indexables.
- ads.txt en raíz (con placeholder del publisher id por env).
- /legal/privacidad, /legal/cookies, /legal/terminos, /contacto.
- Banner de cookies con modo “aceptar/rechazar/ajustes” y almacenamiento del consentimiento.

DEPLOY (sin sermones):
- Incluye scripts automatizados:
  - scripts/bootstrap.sh (crea D1, aplica migraciones, configura vars, despliega worker).
  - scripts/dev.sh (dev local con wrangler).
- Incluye GitHub Actions:
  - CI: lint + test + typecheck + build.
  - Deploy opcional: si hay CF_API_TOKEN y CF_ACCOUNT_ID en secrets, despliega automáticamente.
- Incluye README mínimo con 6–10 líneas máximo: variables ENV y comandos, sin links externos.

VERIFICACIÓN (OBLIGATORIA):
- Incluye tests unitarios (parsing + agregación) y al menos 3 smoke tests para endpoints.
- Al final, entrega un “Self-check report” confirmando:
  - build ok,
  - endpoints responden,
  - cron job idempotente,
  - UI responsive,
  - accesibilidad base.

FORMATO DE SALIDA:
1) “FILE TREE”
2) Para cada archivo: “PATH: …” + bloque de código con su contenido.
3) “SELF-CHECK REPORT”
No incluyas texto fuera de ese formato.