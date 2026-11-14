# SITE REGRET · web

Comparador de dos emplazamientos del polo sur lunar —**A = Connecting Ridge ROI 4**, **B = ROI 6**— sobre resultados científicos precalculados y trazables (`site-regret/0.1`: 120 escenarios, 6 comparaciones × 4 criterios). Equipo **QuemandoTokens**, NASA International Space Apps Challenge 2026 (Bilbao) · reto *Lunar Landing Site Navigator*.

> ¿Hasta qué punto podemos confiar en que un emplazamiento es mejor que otro si el relieve usado en el cálculo contiene incertidumbre?

**Producción:** https://site-regret.vercel.app (desplegado con Vercel; versión de `main`, sin la capa geoespacial).

> **Rama `feat/geo-real-terrain` (14-11-2026):** añade la capa geoespacial real (mapa con imágenes orbitales de NASA Moon Trek, capas numéricas del DEM PGDA78 y terreno 3D). No está en `main` ni desplegada: https://site-regret.vercel.app muestra la versión anterior. El encargo geoespacial NO está completo; estado y pendientes en [docs/GEOESPACIAL.md](docs/GEOESPACIAL.md) y `../docs/continuidad/HANDOFF.md`.


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

Encadena `typecheck → lint → test (Vitest, 89) → build → test:e2e (Playwright, 59 + 1 opcional en vivo, incluida la auditoría axe-core WCAG A/AA)`. Las pruebas de navegador no usan la red: Moon Trek se responde con respuestas reales grabadas (`tests/fixtures/trek/`). Prueba opcional contra el servicio real: `E2E_LIVE_TREK=1 npx playwright test e2e/geo.spec.ts -g "en vivo"`. Detalle en [QA_REPORT.md](QA_REPORT.md). Para probar un despliegue: `E2E_BASE_URL=https://site-regret.vercel.app npx playwright test`. Con Chrome: `PW_CHANNEL=chrome`.

## Despliegue (Vercel)

`vercel.json` define `npm ci`, `npm run build` y la carpeta `out/` (sitio estático). `.vercelignore` excluye resultados locales y `qa_entradas.json` (contiene rutas de un equipo del autor). Con la CLI autenticada:

```bash
vercel deploy --prod --yes
```

El despliegue actual es https://site-regret.vercel.app.

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
