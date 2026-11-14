# Capa geoespacial real · estado y evidencia

Fecha: 2026-11-14 · rama `feat/geo-real-terrain`. Primera entrega vertical del encargo «cartografía lunar real» para Connecting Ridge. Solo se declara lo ejecutado.

## Qué hay

| Función | Archivos | Fuente real | Prueba | Resultado | Limitación |
|---|---|---|---|---|---|
| Registro de activos | `data/geospatial/registry.json` | Pasaporte del paquete; catálogo y WMTS de Moon Trek | Vitest: hashes = pasaporte | PASS | 8 activos; sin ODE, LROC individual ni IAU |
| Descarga verificable | `scripts/geospatial/fetch-originals.ts` (`npm run geo:fetch`) | `pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/` | Ejecución real: 6 archivos, tamaño + firma + SHA-256 completo | PASS | Clones y PGDA90 no incluidos |
| Recortes numéricos | `scripts/geospatial/build-terrain.ts`, `data/derived/terrain/` | PGDA78 Site01 (surf, ldec, toterr, slp, slperr), ROI | Vitest: subconjunto exacto del TIFF; lectura en A/B = paquete | PASS | Ventana de 4 × 4 km |
| Geometría lunar | `src/lib/geospatial/lunar.ts`, `horizon.ts`, `mesh.ts` | `motor/pipeline.py` | Vitest: 4 636 obstáculos (máx. 1,1e-7°); horizonte Sol/Tierra < 1e-9° | PASS | Lee el horizonte del motor; no lo recalcula |
| WMTS Moon Trek | `src/lib/geospatial/wmts.ts` | GetCapabilities reales (`tests/fixtures/trek/`) | Vitest + tesela real recibida (PNG, CORS `*`) | PASS | CRS declarado ambiguo: se valida la rejilla polar en metros |
| Mapa en Explore | `src/components/maps/GeoMap.tsx`, `ProfileChart.tsx` | Moon Trek NAC/WAC + recortes PGDA78 | E2E `geo.spec.ts` (teselas, capas, lectura, medida, fuera de cobertura, sin red, HTML con 200) | PASS | Alineación imagen↔DEM solo comprobada a la vista |
| Terreno 3D + obstáculo en Engineer | `src/components/terrain/` | Recorte del DEM, horizontes y efemérides del paquete | E2E (lienzo con terreno, lectura = cálculo en Node, 10 m, superficie alternativa) | PASS | Malla a 10 m; solo DEM nominal; sin sombras arrojadas |
| Corregistro teselas ↔ DEM | `scripts/geospatial/check-coregistration.ts` (`npm run geo:coregistration`), `data/derived/coregistration.json` | Teselas reales de Moon Trek (hillshade PGDA78 y mosaico NAC) y recorte del DEM | Ejecución real + Vitest sobre el resultado | Rejilla: PASS (NCC 0,95; desfase −1,7 / −8,3 m, uniforme). Mosaico NAC: NO CONCLUYENTE | El registro propio del mosaico fotográfico no queda demostrado; origen del píxel de desfase sin determinar |
| Productos y huellas PDS (ODE) | `src/lib/geospatial/ode.ts`, `src/components/maps/OdePanel.tsx` | ODE REST `query=product` (PDS Geosciences Node) | Vitest sobre respuestas reales grabadas; E2E; ejecución en vivo con captura (`docs/capturas/live-ode.png`) | PASS (253 productos NAC en la caja de los sitios) | Caja fija de los sitios; 3 tipos de producto; sin carga como capa; sin GDS |
| Clones PGDA78 y diferencias (G15) | `data/derived/terrain/clones/`, `src/lib/geospatial/difference.ts`, `src/components/regret/TerrainDiffLab.tsx` | PGDA78 Site01 Clones 0001–0005 (pasaporte) | Vitest `ensemble.test.ts` (hash, altura en A/B = paquete, estadísticas reproducidas, Δ horizonte); E2E `regret-terrain.spec.ts` | PASS (Vitest) | Hipótesis propias no reconstruibles en la web; la diferencia describe el terreno, no atribuye la inversión |
| Geometría Sol–Tierra–Luna en Timeline (bloque B) | `src/lib/geospatial/sky.ts`, `src/components/timeline/OrbitalView.tsx` | Efemérides topocéntricas del paquete (SPICE DE421, MOON_ME_DE421) | Vitest `sky.test.ts` (libración de la Tierra, vuelta solar, ida y vuelta); E2E `timeline-orbital.spec.ts` | PASS | Esquema no a escala; direcciones del observador nominal; color = estado del motor |
| Comparador con terreno real (bloque C) | `src/components/comparador/PairTerrain.tsx`, `raster.ts` (`subGrid`) | Moon Trek NAC + recortes PGDA78 | E2E `comparador-terrain.spec.ts` (lecturas = paquete); Vitest `subGrid` | PASS | Recortes de 800 m; luz del relieve sintética |
| Malla 3D del clon publicado en Engineer (bloque D) | `src/components/terrain/TerrainPanel.tsx` | Recortes de clones PGDA78 | E2E `geo.spec.ts` (`data-mesh-surface`) | PASS | Hipótesis propias: malla nominal con aviso |
| Procedencia por capa | `src/components/evidence/GeoEvidence.tsx` | Registro y manifiesto | E2E (enlace desde la leyenda, hash completo) | PASS | — |

Batería completa (PC-10, tras corregistro y ODE): `tsc` y ESLint limpios, Vitest 98/98, build correcto, Playwright 62/62 + 1 omitida (en vivo), con 2 procesos. Con 4 procesos fallaban 5 por tiempo (WebGL por software).

## Inventario de recursos visuales (clases del encargo)

| Recurso | Dónde | Clase | Acción |
|---|---|---|---|
| Teselas LRO NAC / WAC de Moon Trek | Explore, inserto de Engineer | 2 · producto publicado (mosaico de imágenes orbitales) | Nuevo; fondo por defecto |
| Capas elevación, pendiente, retornos LOLA, RMS | Explore | 2 · producto publicado, valores numéricos | Nuevo |
| Polígonos ROI de Site01 | Explore | 2 · producto publicado | Nuevo |
| Relieve sombreado del DEM | Explore (fondo sin red) | 3 · derivado SITE REGRET, luz sintética | Nuevo, rotulado |
| Perfil de elevación, distancias | Explore | 3 · derivado SITE REGRET | Nuevo |
| Malla 3D y línea al obstáculo | Engineer | 3 · derivado SITE REGRET | Nuevo; sustituye a `MastScene` como vista principal; desde PC-15 en primera fila y con la malla del clon publicado si se elige |
| Mapa de diferencia clon − nominal, Δ horizonte, miniaturas RMS por bloque | Regret Lab | 3 · derivado SITE REGRET de productos publicados | Nuevo (PC-13) |
| Mástil de 2 y 10 m | Engineer | 4 · escenario hipotético | Rotulado SIMULATED |
| Figura `figuras/mapa_sitios.svg` (`ContextMap`, `SiteThumb`, `PairMap`) | Explore (plegada), Dashboard, Comparador, Timeline, Historia | 3 · derivado del DEM por el motor (no es foto ni IA) | Conservada y rotulada |
| Gráficos de horizonte, franjas y curvas | Timeline, Comparador, Engineer, Regret Lab | 3 · derivado del paquete | Conservados |
| `MastScene` (crestas, Sol y Tierra dibujados a mano) | Engineer (plegado) | 5 · ilustración | Retirada de la vista principal; rotulada |
| Luna del Dashboard, estrellas de Historia, logotipo, iconos Lucide | Dashboard, Historia, cabecera | 5 · ilustración | Conservadas; la luna lleva el rótulo «Ilustración» |
| Origen desconocido | — | 6 | Ninguno encontrado |

No hay imágenes rasterizadas en `public/` ni URLs externas de imagen aparte de Moon Trek.

## Pendiente (no se muestra como si existiera)

Búsqueda ODE por región visible o polígono y carga de productos proyectados como capa; corregistro numérico del mosaico fotográfico; ortoimagen NAC concreta; nomenclatura IAU/USGS; relieve regional PGDA90 en el mapa; clones en 3D; prueba en vivo automatizada (`E2E_LIVE_TREK=1`) y prueba sin red en otro portátil; escenarios nuevos calculados. Tampoco se ha desplegado ni subido la rama.

## Reproducir

```
cd web
npm ci
npm run verify
npm run geo:fetch && npm run geo:build   # solo para regenerar los recortes (205 MB de descarga)
```
