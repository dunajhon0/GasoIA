# GasoIA

Precios oficiales de carburantes en España. Datos del Ministerio de Industria.

## Stack
Astro + React + TypeScript + Tailwind | Cloudflare Pages + Workers + D1 | ECharts + Leaflet

## Variables de entorno

| Variable | Descripción |
|---|---|
| `SITE_URL` | URL del sitio (ej: `https://gasoia.com`) |
| `ADSENSE_PUBLISHER_ID` | Publisher ID de Google AdSense (opcional) |
| `CF_API_TOKEN` | Token API de Cloudflare (GitHub Secret) |
| `CF_ACCOUNT_ID` | Account ID de Cloudflare (GitHub Secret) |
| `D1_DATABASE_ID` | ID de la base de datos D1 (en `wrangler.toml`) |

## Comandos

```bash
npm install              # Instalar dependencias
npm run dev              # Dev local (http://localhost:4321)
npm run build            # Build de producción
npm test                 # Tests unitarios
npm run typecheck        # Verificación TypeScript

bash scripts/bootstrap.sh  # Setup inicial: D1 + migraciones + deploy worker
bash scripts/dev.sh         # Alias para dev local
```

## Deploy

1. `bash scripts/bootstrap.sh` — setup inicial (D1 + worker)
2. Conecta el repo a **Cloudflare Pages** con build cmd `npm run build` y output `dist/`
3. Añade `CF_API_TOKEN` y `CF_ACCOUNT_ID` como GitHub Secrets para CI/CD automático
