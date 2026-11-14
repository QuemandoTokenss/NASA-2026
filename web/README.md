# SITE REGRET · web

Comparador de dos emplazamientos del polo sur lunar —**A = Connecting Ridge ROI 4**, **B = ROI 6**— sobre resultados científicos precalculados y trazables (`site-regret/0.1`: 120 escenarios, 6 comparaciones × 4 criterios). Equipo **QuemandoTokens**, NASA International Space Apps Challenge 2026 (Bilbao) · reto *Lunar Landing Site Navigator*.

> ¿Hasta qué punto podemos confiar en que un emplazamiento es mejor que otro si el relieve usado en el cálculo contiene incertidumbre?

**Producción:** https://site-regret.vercel.app (Vercel publica automáticamente cada push a `main`). Estado vigente, propietarios y pendientes: [`../docs/continuidad/HANDOFF.md`](../docs/continuidad/HANDOFF.md) §0.

> `main` incluye la capa geoespacial real (mapa con imágenes orbitales de NASA Moon Trek, capas numéricas del DEM PGDA78 y terreno 3D), Mission Control v2, la demo guiada de `/historia/` y el paquete adicional de alturas de Engineer (0–30 m). Lo pendiente del encargo geoespacial está en [docs/GEOESPACIAL.md](docs/GEOESPACIAL.md).


## Secciones

| Ruta | Qué hace |
|---|---|
| `/` Dashboard | Pregunta, cifras reales del paquete, fichas A/B, caso demostrativo, accesos |
| `/explore/` | Mapa georreferenciado (teselas WMTS de Moon Trek: mosaicos LRO NAC/WAC) con capas numéricas del DEM PGDA78, ROI publicados, lectura de punto, medida y perfil; figura original del motor como referencia; ficha del sitio, horizontes |
| `/timeline/` | Estados Sol/Tierra cada 10 min, curvas nominales, reproductor sobre instantes reales, eventos acotados |
| `/comparador/` | A vs B con criterio previo, métricas reales, empates, regret, superficies alternativas, exportación |
| `/engineer/` | Comparación 0/2/10 m: horizontes, métricas, franjas y ganadores por altura; terreno 3D del DEM con «qué tapa el Sol o la Tierra» (obstáculo del horizonte del motor) |
| `/regret-lab/` | Mantener/empatar/invertir por familia de superficies, regret, mapa de decisiones, caso guiado (`#demo`) |
| `/evidencia/` | Fuentes, método, 414 comprobaciones, Horizons, convergencia, RMS, referencias, límites, descargas |
| `/historia/` | Modo presentación: el caso demostrativo en 7 escenas (flechas para avanzar, F pantalla completa) |

**Idiomas:** español e inglés (selector ES/EN en la cabecera, o `?lang=en` en cualquier URL).

## Requisitos

- Node.js ≥ 22.18 (probado con 24.19) y npm. Sin Python, sin APIs externas en tiempo de ejecución.
- Para E2E: Microsoft Edge o Chrome instalados (Playwright usa el navegador del sistema).

## Ejecutar

```bash
npm install
```

```bash
npm run dev
```

Versión estática (la que se despliega), servida sin red en http://127.0.0.1:4173:

```bash
npm run build
```

```bash
npm run serve
```

## Verificar

```bash
npm run verify
```

Encadena `typecheck → lint → test (Vitest) → build → test:e2e (Playwright, con una prueba opcional en vivo e incluida la auditoría axe-core WCAG A/AA)`; los recuentos vigentes están en `../docs/continuidad/HANDOFF.md` §0.5. Con la máquina cargada algunas pruebas de navegador agotan sus 15 s: repetir las afectadas con `--workers=1` antes de darlas por fallidas. Las pruebas de navegador no usan la red: Moon Trek se responde con respuestas reales grabadas (`tests/fixtures/trek/`). Prueba opcional contra el servicio real: `E2E_LIVE_TREK=1 npx playwright test e2e/geo.spec.ts -g "en vivo"`. Detalle en [QA_REPORT.md](QA_REPORT.md). Para probar un despliegue: `E2E_BASE_URL=https://site-regret.vercel.app npx playwright test`. Con Chrome: `PW_CHANNEL=chrome`.

## Despliegue (Vercel)

`vercel.json` define `npm ci`, `npm run build` y la carpeta `out/` (sitio estático). `.vercelignore` excluye resultados locales y `qa_entradas.json` (contiene rutas de un equipo del autor).

El proyecto de Vercel `site-regret` está conectado al repositorio de GitHub: **cada push a `main` se publica en producción** (https://site-regret.vercel.app) y cada rama recibe una vista previa. Por eso `main` solo se actualiza mediante PR revisada y con `npm run verify` en verde. Para saber qué commit sirve producción: `vercel inspect https://site-regret.vercel.app` y el campo `githubCommitSha` de `vercel api "/v6/deployments?app=site-regret&target=production&limit=3"`. Para volver a un despliegue anterior: `vercel promote <url-del-despliegue>` y revertir el commit en `main`.

Despliegue manual (solo si falla la integración con GitHub; sube la carpeta de trabajo, no un commit):

```bash
vercel deploy --prod --yes
```

## Demostración local sin conexión

`npm run build` y `npm run serve` sirven `out/` desde 127.0.0.1 sin dependencias de red; todos los datos y figuras son archivos propios verificados por SHA-256 (la verificación necesita `http://localhost`/`127.0.0.1` o https, no `file://`). Probado en este equipo con la red disponible pero sin usarla; **pendiente** la prueba en un segundo portátil desconectado.

## Datos

- `data/source/` — originales intactos (ver su README); `npm run data` los verifica y genera `public/data/site-regret/` (no versionado): 27 trozos de carga diferida con reensamblado idéntico comprobado y 21 originales publicados.
- Contrato y validación: `src/lib/contract/`. Lógica de presentación científica: `src/lib/science/`. Estado global ↔ URL (`?s&w&h&v&c&t`): `src/lib/state/`.

## Mapa y terreno reales

- `data/geospatial/registry.json`: registro de activos (proveedor, producto, CRS, unidades, fechas, hash, estado de verificación).
- `npm run geo:fetch`: descarga a `data/raw/` (no versionado, ~205 MB) los originales PGDA78 Site01 y los verifica enteros (tamaño, firma y SHA-256 del pasaporte).
- `npm run geo:build`: genera `data/derived/terrain/` (versionado, 12,8 MB): recorte exacto de 4 × 4 km de cinco rasters float32 y los 7 ROI, con manifiesto. `npm run data` los publica comprobando hashes.
- Para trabajar o probar NO hace falta descargar nada: los recortes están en el repositorio. El fondo orbital sí necesita red; sin ella el mapa lo indica y ofrece el relieve sombreado del DEM.
- Geometría: `src/lib/geospatial/` (proyección lunar, raster, WMTS, horizonte, malla). Componentes: `src/components/maps/`, `src/components/terrain/`.

## Reglas que respeta la web

Solo W1/W2, 0/2/10 m y A/B. Criterio antes del ganador. Empate ≤ 10 min sobre valores completos. Frecuencias de variantes ≠ probabilidades; familias propias y publicadas separadas. `UNKNOWN`/`null` nunca son sombra ni cero. Curvas Sol/Tierra solo para la superficie nominal. Visibilidad geométrica ≠ energía, enlace o seguridad. Resultados del equipo con datos NASA; no implican respaldo de la NASA.

## Documentación

[docs/GEOESPACIAL.md](docs/GEOESPACIAL.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DECISIONS.md](DECISIONS.md) · [TASKS.md](TASKS.md) · [PROGRESS.md](PROGRESS.md) · [QA_REPORT.md](QA_REPORT.md) · [docs/INCOMPATIBILIDADES_MOCKUPS.md](docs/INCOMPATIBILIDADES_MOCKUPS.md)
