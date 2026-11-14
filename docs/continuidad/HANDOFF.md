# HANDOFF · SITE REGRET · Mission Control v2

**Punto de control:** PC-16 · 2026-11-14 (+01:00, Europe/Madrid) · **Estado: EN_CURSO (bloques A–E implementados; pendiente revisión humana de la demo y bloque F)**
Documento principal del relevo. Si contradice al código o a `git status`, mandan el código y Git.

## 1. Dónde se trabaja

| | |
|---|---|
| Directorio de trabajo (raíz Git) | `C:\Users\Hugo\Projects\NASA-2026` (clon del equipo; antes estaba 29 commits por detrás y se avanzó con `merge --ff-only origin/main`, sin pérdidas) |
| Aplicación | subcarpeta `web/` (Next.js, export estático) |
| Remoto | `QuemandoTokenss/NASA-2026` (GitHub, privado) |
| Rama | `feat/mission-control-v2`, creada desde `main` = `6e41690` («Merge #18: integrate real lunar terrain and geospatial layers») |
| HEAD | `6dee90d` (E) sobre `8c2d682` (C + D), `0785e45` (B), `ca684bf` (A). **Subida a GitHub a petición de Hugo (2026-11-14); PR #19 abierto contra `main`** (https://github.com/QuemandoTokenss/NASA-2026/pull/19). Merge: lo decide el integrador. Sin despliegue |
| Otra copia | `C:\Users\Hugo\Desktop\Hugo\Proyectos\NASA-SpaceApps-2026\NASA-2026` (rama `feat/geo-real-terrain`, `47844ba`, ya fusionada en `main` por el PR #18). No se ha tocado; sus originales NASA de `web/data/raw/` se COPIARON a esta carpeta |

**Reconciliación de documentos antiguos:** el HANDOFF anterior (PC-11/12) decía que `feat/geo-real-terrain` no estaba fusionada. Ya lo está: `main` contiene el PR #18 (`6e41690`). En `main` SÍ está la capa geoespacial (G0–G10). `01_REANUDAR_IMPLEMENTACION.md` es histórico (relevo Hugo → Asier) y sus referencias de rama/HEAD están superadas.

## 2. Encargo y decisiones que se conservan

Encargo vigente: ver [ENCARGO_VIGENTE.md](ENCARGO_VIGENTE.md) §A.5 («Mission Control v2»: transformar Regret Lab, Timeline, Comparador, Engineer, Dashboard, Evidence e Historia). Reglas: `AGENTS.md`. Decisiones:

- La web solo LEE el paquete precalculado `site-regret/0.1`; no se recalcula visibilidad ni métricas en el navegador. `web/data/source/` no se toca.
- Geometría lunar del motor en `web/src/lib/geospatial/lunar.ts`: esfera R = 1 737 400 m, estereográfica polar sur, MOON_ME_DE421. Nada terrestre.
- Originales NASA en `web/data/raw/` (ignorado por Git). Derivados versionados en `web/data/derived/terrain/` con manifiesto y SHA-256.
- Con superficies no nominales no hay direcciones Sol/Tierra (el paquete solo las trae para la nominal). Nunca combinar efemérides nominales con horizontes de variantes.
- **Nuevo (PC-13):** la diferencia clon − nominal se calcula píxel a píxel en float32 con `src/lib/geospatial/difference.ts`, la misma función en Node (manifiesto) y en el navegador (mapa). Es una descripción del terreno, no una atribución causal de la inversión.
- **Nuevo (PC-13):** las 4 hipótesis propias (`bias_*`, `correlated_*`) NO se reconstruyen en la web (PCG64 + filtro gaussiano del motor). Solo se muestran sus horizontes.
- Texto de interfaz bilingüe: `L("es", "en")`.

## 3. Estado por bloques del encargo vigente

| Bloque | Requisito | Estado | Dónde |
|---|---|---|---|
| A · G15 | Regret Lab con clones reales, capas de diferencia y enlace al mapa | **HECHO (PC-13)**, verificado con Vitest + E2E + revisión visual en navegador | ver §4 |
| B | Timeline orbital con efemérides reales | **HECHO (PC-14)**, Vitest + E2E + revisión visual | ver §4 bis |
| C | Comparador A/B con cartografía real | **HECHO (PC-15)** | ver §4 ter |
| D | Engineer con 3D protagonista y alturas 0/2/10 | **HECHO (PC-15)** | ver §4 ter |
| E | Dashboard → Mission Control, Evidence, Historia | **HECHO (PC-16)** | ver §4 quater |
| F | G9 mosaico, G11 NAC, G10 mejoras ODE, G12 IAU, G13 PGDA90 | PENDIENTE (siguiente; sin cambios desde PC-11) | ver §5 |

Tabla G0–G18 heredada: G0–G8 VERIFICADO, G9 PARCIAL, G10 VERIFICADO en lo implementado, **G15 HECHO**, G11–G14 PENDIENTE, G16 no autorizado, G17 actualizado en PC-13 para G15, G18: rama nueva sin subir.

## 4. Bloque A terminado (PC-13): Regret Lab ↔ terreno real

Hecho:
1. **Registro**: 5 activos `pgda78.site01.clone_0001…0005` (`kind: "ensemble_raster"`, `variant: published_000N`) en `web/data/geospatial/registry.json`, con URL, bytes, SHA-256 y fechas del pasaporte. Disponibilidad comprobada antes de descargar (HTTP 200, `Content-Length` = pasaporte, `Last-Modified` = pasaporte), 277 GB libres.
2. **Descarga**: `npm run geo:fetch` descargó los 5 clones (5 × ~41 MB, 4 min 45 s) y los verificó enteros (tamaño, firma TIFF, SHA-256 = pasaporte). En `web/data/raw/pgda78_site01/` (no versionado).
3. **Recortes**: `scripts/geospatial/build-terrain.ts` (generator_version 2) recorta cada clon en la misma ventana 800×800 sin remuestrear → `web/data/derived/terrain/clones/clone_000N.f32` (5 × 2,56 MB, versionados). El manifiesto lleva `ensemble.members[]` con hash, estadísticas, `difference_vs_nominal` (mín, máx, media, media |Δ|, RMS, P99 |Δ|) y `at_sites`. **El script falla si la altura bilineal del clon en A o B no es exactamente `horizons_index.<sitio>.observer_ground_height_m.published_000N`**: coincide en los 10 casos. Las capas nominales se regeneraron byte a byte idénticas.
   - Resultado: Δ clon − nominal entre −3,70 y +4,57 m; RMS 0,44–0,45 m en los 5 clones; media ≈ 0.
4. **App**: `src/lib/geospatial/difference.ts` (`differenceGrid`, `differenceStats`, `horizonDelta`, `blockRms`), `terrain.ts` (`loadEnsembleMember`, verificación SHA-256), `colormap.ts` (`DIFFERENCE_STYLE` divergente azul-blanco-rojo, opacidad ∝ |Δ|), `publish-terrain.ts` copia `clones/`.
5. **Regret Lab** (`src/components/regret/TerrainDiffLab.tsx`, insertado en `RegretLabView.tsx` tras «Resultado por superficie»):
   - Mapa OpenLayers (misma proyección polar que Explore) con relieve sombreado del DEM nominal + capa clon − nominal, leyenda ±P99, lectura por clic, marcadores A/B y procedencia.
   - Gráfico Δ horizonte variante − nominal (1 440 azimuts, A y B; `src/components/charts/HorizonDeltaChart.tsx`), con selección de azimut por puntero/teclado.
   - Tabla del azimut elegido: altura de suelo del observador, horizonte, distancia y relieve (5/80/240 m) del punto que fija el horizonte en nominal y variante, y diferencia de terreno en ese punto; líneas N/V en el mapa. Texto explícito: no demuestra la causa de un cambio de ganador.
   - Miniaturas de los 5 clones (RMS de Δ por bloques de 80 m, misma escala), seleccionables.
   - Hipótesis propias: aviso «no reconstruible», sin terreno inventado; sí Δ horizonte.
   - «Mapa de decisiones» con modo **mapa de calor del regret** (regret de conservar la elección nominal de cada fila, en horas; filas sin elección nominal rayadas).
6. Hallazgo visible en la UI: en W2·0 m con `published_0001`, el mayor |Δ horizonte| de A es 2,05° a 5,25° y lo fija terreno a 7,5–30 m del observador: las variaciones del ensemble actúan sobre todo en campo cercano. Es una lectura de datos, no una causa demostrada.

## 4 bis. Bloque B terminado (PC-14): Timeline con geometría física

- `src/lib/geospatial/sky.ts`: cambio de base exacto azimut/elevación topocéntricos del paquete → vector en MOON_ME_DE421 con la base local del motor (`localBasis`); longitud y declinación lunar de la dirección; `bodyTrack`; `angleBetween`. No calcula efemérides nuevas.
- `tests/sky.test.ts` (4, datos reales): ida y vuelta az/el (< 1e-7°); la Tierra queda a < 9° de la longitud 0° y < 7,5° de declinación (libración); el Sol barre 360–380° de longitud en W1 (30 días) con declinación < 1,6°; A y B ven la Tierra en la misma dirección (< 0,01°).
- `src/components/timeline/OrbitalView.tsx`: esquema NO A ESCALA visto desde debajo del polo sur con la orientación del mapa (0° arriba, 90° E derecha): Luna con hemisferio iluminado según la dirección solar (iluminación global de la esfera, rotulada), trayectorias de Sol y Tierra de toda la ventana coloreadas por el ESTADO DEL MOTOR para la superficie seleccionada, cuerpos en el instante, líneas de visión desde el sitio, medidor de declinación lunar y lecturas reales (distancia km, az/el, ángulo Sol–sitio–Tierra, estado del intervalo).
- `TimelineView.tsx`: primera fila física = «Geometría Sol–Tierra–Luna» (esquema) + «Cielo local del observador» (horizonte del paquete con trayectorias nominales: geometría real), luego el reproductor y debajo las curvas/franjas existentes. Las efemérides se cargan siempre para la vista orbital; las curvas sobre el horizonte siguen solo con la nominal (no se mezclan con horizontes de variantes).
- Tres niveles rotulados: esquema no a escala / geometría real del observador / visibilidad respecto al horizonte (estado del motor).

## 4 ter. Bloques C y D terminados (PC-15)

**C · Comparador** (`src/components/comparador/PairTerrain.tsx`, `ComparadorView.tsx`):
- Nuevo primer panel «Terreno real del par A · B»: `GeoMap` compacto de Explore (teselas reales Moon Trek LRO NAC, proyección polar lunar) con la línea A→B y su distancia sobre la esfera; recortes del DEM PGDA78 de 800 × 800 m centrados en A y B a la MISMA escala (muestras exactas con `subGrid`, relieve sombreado de luz sintética + capa elegida: pendiente / retornos LOLA / solo relieve, ROI publicadas, barra de 200 m); tabla de lecturas de las 5 capas en A y B y A − B (iguales al paquete; enlaces a Evidencia). Rotulado: propiedades del terreno, no métricas de decisión.
- Se retiró `SiteThumb` de las tarjetas de sitio (el terreno real está en el panel nuevo).
- «Horizontes»: además de las dos curvas, Δ horizonte A − B por azimut (`HorizonDeltaChart` con rótulos configurables) y resumen de azimuts donde cada sitio está más tapado (> 0,1°).
- Se conservan conclusión dependiente del criterio, empates, UNKNOWN, 24 combinaciones y D por superficie.

**D · Engineer** (`EngineerView.tsx`, `terrain/TerrainPanel.tsx`):
- El panel 3D del DEM pasa a ser la vista principal (primera fila, ancho completo) con el selector de altura 0/2/10 m y «Rendimiento geométrico» a su lado: cambiar la altura actualiza a la vez el mástil, el obstáculo y las métricas del escenario.
- Con un clon publicado la malla 3D es el recorte de ESE clon (verificado con SHA-256) y el origen vertical es la altura de suelo del clon del paquete; con hipótesis propias se dibuja el nominal con aviso explícito. `data-mesh-surface` en el panel.
- `MastScene` sigue plegado y rotulado como ilustración.

## 4 quater. Bloque E terminado (PC-16)

- **Dashboard** (`home/HomeView.tsx`): la luna ilustrada del héroe se sustituyó por el `GeoMap` compacto con imágenes reales LRO NAC (Moon Trek) de Connecting Ridge, A, B y la línea entre ambos. Nuevo panel **Mission Control** con el escenario sincronizado (sitio, ventana, altura, superficie, criterio) y una tarjeta por vista con un dato real de ese escenario (resultado del Comparador si hay criterio, «se mantiene x/y» de Regret Lab, clones verificados, intervalo del Timeline, altura y malla de Engineer, comprobaciones de Evidencia). Sustituye a los 3 pasos y a la navegación duplicada del pie. Las miniaturas `SiteThumb` de los sitios se sustituyeron por recortes reales del DEM (`SiteTerrainThumb`).
- **Evidencia** (`evidence/GeoEvidence.tsx`): las fichas de los 5 clones muestran su recorte descargable, SHA-256, estadísticas clon − nominal y la comprobación de altura en A/B; anclas `#geo-pgda78-site01-clone_000N` (Regret Lab enlaza a ellas).
- **Historia** (`story/StoryView.tsx`): la escena 1 usa el mapa NAC real (antes la figura `PairMap`); la escena «Desafiar el terreno» cita la RMS real de los clones (manifiesto) y enlaza al mapa de diferencias de Regret Lab.
- `PairMap.tsx` y `SiteThumb.tsx` siguen en el código (los usan otras vistas: `ContextMap` en Explore plegado y la figura del paquete), rotulados como derivados del motor.

## 5. Siguiente tarea exacta: revisión humana de la demo y bloque F

1. **Revisión humana** (bloqueo NO técnico): el equipo debe recorrer Dashboard → Explore → Timeline → Comparador → Engineer → Regret Lab → Evidencia → Historia con `npm run build && npm run serve` y anotar problemas visuales. Ninguna IA puede dar por buena la experiencia visual sola.
2. **Bloque F** (por orden de valor): G11/G9 producto NAC proyectado concreto de Connecting Ridge (ODE `pt=SDNDTM`/`BDRROI` en la caja de los sitios) y corregistro del mosaico; G12 nomenclatura IAU/USGS (Gazetteer of Planetary Nomenclature, solo con fuente verificada); G13 PGDA90 regional solo si aporta (≈408 MB: comprobar espacio y avisar); mejoras ODE (región visible / polígono).
3. **G18**: PR #19 abierto (push autorizado por Hugo). Pendiente: revisión del equipo, CI y merge por el integrador. No desplegar sin autorización.

### Antiguo §5 (bloque E) — HECHO en PC-16

En `web/`:
1. Dashboard (`src/components/home/HomeView.tsx`): sustituir la luna ilustrada del héroe por un mapa real (GeoMap compacto con NAC o el relieve del DEM) de Connecting Ridge con A/B; convertir el resto en «Mission Control»: estado del escenario seleccionado (ventana, altura, superficie, criterio), accesos directos a cada vista con su estado real (p. ej. ganador si hay criterio, número de clones verificados, instante de Timeline) y al caso demostrativo. Las tarjetas `SiteThumb` del Dashboard son derivados del motor: sustituir por recortes del DEM (`subGrid`) o rotular.
2. Evidence (`src/components/evidence/`): sección de procedencia de los 5 clones (ya hay entradas en el registro → comprobar que `GeoEvidence` las lista con hash) y de las nuevas vistas (diferencias, efemérides convertidas, recortes del Comparador); anclas `#geo-…` enlazables desde Regret Lab, Timeline y Comparador.
3. Historia (`src/components/story/`): actualizar escenas para enseñar mapa real, terreno 3D, diferencias de clones y vista orbital; las estrellas/luna ilustradas se rotulan o se sustituyen.
4. Pruebas E2E por vista y revisión visual.

### Antiguo §5 (bloque C) — HECHO en PC-15

En `web/`:
1. Leer `src/components/comparador/ComparadorView.tsx` (Conclusión, matriz de 24 combinaciones, `HorizonPair`, `PairMap`).
2. Sustituir el par de miniaturas/figura por cartografía real: `GeoMap` en modo compacto (o un mapa OpenLayers como `DiffMap` de `TerrainDiffLab.tsx`) con A y B, ROI y la capa numérica elegida; recortes georreferenciados de cada sitio lado a lado (misma escala) con lecturas del DEM en A y B (altura, pendiente, retornos LOLA, RMS) leídas de los recortes.
3. Tabla de métricas contrastadas A vs B para la ventana/altura/superficie, con diferencia explícita y conclusión que dependa del criterio elegido (conservar empates, UNKNOWN y la regla de tolerancia del motor).
4. Δ de horizonte A − B por azimut (mismo componente `HorizonDeltaChart`) en lugar de dos curvas sueltas, manteniendo la vista superpuesta.
5. Mantener la prueba de 24 combinaciones (`e2e/app.spec.ts`) y añadir E2E del mapa del comparador; revisión visual.

### Antiguo §5 (bloque B) — HECHO en PC-14

En `web/`:
1. Leer `src/components/timeline/TimelineView.tsx`, `TimePlayer.tsx` y `src/lib/data/loader.ts` (`loadEphemerisClock`, `loadEphemerisSite`). Las efemérides del paquete dan, por sitio, ventana y altura, azimut/elevación/distancia (km) de Sol y Tierra en 4 321 instantes (SPICE DE421, MOON_ME_DE421) — ver `EphemerisSiteChunk` en `src/lib/contract/schema.ts`.
2. Construir una vista «cielo local» (proyección azimut-elevación del observador): trayectorias reales de Sol y Tierra en la ventana, horizonte del paquete del sitio/altura como silueta, instante actual sincronizado con `timeIndex`, y estado (código del escenario) del instante. Rotular: geometría real del observador.
3. Panel aparte «geometría orbital no a escala»: Luna-Tierra-Sol a partir de las direcciones y distancias (`range_km`) del paquete en el instante (solo direcciones relativas desde el sitio; rotular «no a escala»). No inventar trayectorias: si falta un dato, no se dibuja.
4. Mantener las curvas/franjas actuales debajo, sincronizadas con el mismo `timeIndex`.
5. Pruebas: Vitest para cualquier transformación de coordenadas; E2E de sincronización instante ↔ cielo ↔ curvas; revisión visual.

Después: bloque C (Comparador con `GeoMap` compacto o recortes A/B), D (Engineer), E (Dashboard/Evidence/Historia), F.

## 6. Cambios locales y archivos de PC-13

Archivos nuevos o modificados (todo en `web/` salvo docs):
`data/geospatial/registry.json`, `data/derived/terrain/manifest.json`, `data/derived/terrain/clones/*.f32` (nuevo), `scripts/geospatial/build-terrain.ts`, `scripts/geospatial/publish-terrain.ts`, `src/lib/geospatial/difference.ts` (nuevo), `src/lib/geospatial/terrain.ts`, `src/lib/geospatial/colormap.ts`, `src/components/maps/GeoMap.tsx` (solo exporta `PROJECTION`, `SITE_HEX`, `rgbaToUrl`), `src/components/charts/HorizonDeltaChart.tsx` (nuevo), `src/components/regret/TerrainDiffLab.tsx` (nuevo), `src/components/regret/RegretLabView.tsx`, `tests/ensemble.test.ts` (nuevo), `e2e/regret-terrain.spec.ts` (nuevo), PC-16: `home/HomeView.tsx`, `evidence/GeoEvidence.tsx`, `story/StoryView.tsx`, `comparador/PairTerrain.tsx` (`SiteTerrainThumb`), `e2e/mission-control.spec.ts` (nuevo); PC-15: `src/components/comparador/PairTerrain.tsx` (nuevo), `ComparadorView.tsx`, `charts/HorizonDeltaChart.tsx`, `src/lib/geospatial/raster.ts` (`subGrid`), `engineer/EngineerView.tsx`, `terrain/TerrainPanel.tsx`, `e2e/comparador-terrain.spec.ts` (nuevo), `e2e/geo.spec.ts`, `tests/ensemble.test.ts`; PC-14: `src/lib/geospatial/sky.ts`, `src/components/timeline/OrbitalView.tsx`, `src/components/timeline/TimelineView.tsx`, `tests/sky.test.ts`, `e2e/timeline-orbital.spec.ts`, `docs/GEOESPACIAL.md`, `.claude/launch.json` (raíz; servidor de desarrollo para la vista previa), `docs/continuidad/*`.

No versionado a propósito: `web/data/raw/pgda78_site01/` (6 originales + 5 clones, ~410 MB), `web/node_modules`, `web/out`, `web/public/data`.

## 7. Comandos (en `web/`) y pruebas

Entorno: Windows 11, Node v24, npm, Edge (Playwright `channel: msedge`).

```
npm ci
npm run dev                         # http://localhost:3000
npm run build && npm run serve      # estático en http://127.0.0.1:4173
npm run geo:fetch                   # originales + 5 clones a data/raw (≈410 MB), verificados
npm run geo:build                   # regenera data/derived/terrain (incluye clones/ y diferencias)
npm run verify                      # typecheck → lint → test → build → test:e2e
```

| Prueba (PC-13, esta sesión) | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 avisos) |
| `npm test` (Vitest completo) | **108/108 PASS** (98 previas + 10 de `ensemble.test.ts`) |
| `npm run geo:fetch` | PASS: 5 clones descargados y verificados; 6 originales ya verificados |
| `npm run geo:build` | PASS: 5 capas idénticas + 5 clones; alturas A/B = paquete |
| `npm run build` | PASS |
| `npx playwright test` completo (2 procesos, 3,0 min) | **64 PASS, 1 FAIL, 1 omitida**. El fallo es «Comparador · las 24 combinaciones…» por TIEMPO (W2·2 m·max_joint_hours, 15 s); Comparador no se ha tocado. Re-ejecutada sola: PASS (11,3 s). Las 3 nuevas de `regret-terrain.spec.ts`: PASS |
| Revisión visual en navegador (dev, 1440×900) | HECHO: mapa de diferencia, Δ horizonte, tabla del obstáculo, miniaturas y mapa de calor visibles y coherentes. **Pendiente revisión humana del equipo** |
| PC-14 · `npm test` | **112/112 PASS** (+4 `sky.test.ts`) |
| PC-14 · `npm run lint`, `tsc`, `npm run build` | PASS |
| PC-14 · E2E Timeline (`timeline-orbital.spec.ts` 2 + 3 de `app.spec.ts`) | 5/5 PASS |
| PC-14 · E2E `a11y.spec.ts` (axe WCAG A/AA, 8 rutas) + `responsive.spec.ts` (375 px) + `i18n.spec.ts` | 20/20 PASS |
| PC-16 · lint, `tsc`, `npm test`, `npm run build` | PASS · Vitest **113/113** |
| PC-16 · `npx playwright test` completo (2 procesos, 4,0 min) | **73 PASS, 0 FAIL, 1 omitida** (incluye `mission-control.spec.ts` 3/3). Un primer intento quedó colgado ~17 min con 3 fallos: 2 por carga (pasan solos) y 1 real de localizador ambiguo (`heading 'Clones publicados'` también encontraba «Los 5 clones publicados…»), corregido con `exact: true` en `e2e/app.spec.ts`. Tras abortar una ejecución, matar el `serve-static` del puerto 4174 antes de relanzar |
| PC-16 · revisión visual Dashboard (dev, 1600×1000) | HECHO: mapa NAC real con A/B en el héroe, Mission Control con escenario sincronizado. Historia y Evidencia comprobadas solo por E2E. **Pendiente revisión humana** |
| PC-15 · `npm test` | **113/113 PASS** (+1 `subGrid`) |
| PC-15 · batería E2E completa tras C (2 procesos, 3,6 min) | **69 PASS, 0 FAIL, 1 omitida** |
| PC-15 · E2E Engineer/superficies tras D (`geo.spec.ts` + `app.spec.ts`) | 11/11 PASS (incluye la nueva «hipótesis propia») |
| PC-15 · revisión visual Comparador y Engineer (dev, 1600×1000) | HECHO: mapa NAC del par, recortes A/B, tabla, Δ A − B; 3D de Engineer en primera fila con malla del clon. **Pendiente revisión humana** |
| PC-14 · revisión visual Timeline (dev, 1600×1000) | HECHO: esquema orbital, trayectorias coloreadas por estado, hemisferio iluminado orientado al Sol, cielo local. **Pendiente revisión humana**. Batería E2E completa no re-ejecutada tras PC-14 (sí las afectadas) |

Resultados históricos (no re-ejecutados aquí antes de PC-13): Vitest 98/98 y Playwright 62 + 1 omitida (PC-10/11).

## 8. Problemas ya investigados (no repetir)

- **Heredocs de bash en esta máquina**: fallan con «unexpected EOF» si el texto lleva comillas o acentos. Escribir el script a un archivo (p. ej. Python) y ejecutarlo.
- **geotiff.js v3**: `getTiePoints()` es asíncrono; usar `getOrigin()`, `getResolution()`, `getGeoKeys()`, `pixelIsArea()`.
- **Precisión float32**: comparar alturas del motor sin pasar por double; en los centros de píxel la bilineal devuelve el valor exacto.
- **Vista previa**: tras cargar un mapa las teselas tardan 1–3 s; las capturas del panel pueden agotar el tiempo si la ventana no está al frente: reintentar.
- **`npm run build` con `npm run dev` abierto**: ambos usan `.next`; parar el servidor de desarrollo antes de compilar.
- **Miniaturas de clones**: el campo Δ es casi incorrelado a escala de píxel; submuestrear da «ruido de televisión». Se usa RMS por bloques de 80 m.
- E2E con 4 procesos agota tiempos (WebGL por software); `workers: 2` fijado. Con 2 procesos la prueba de 24 combinaciones del Comparador puede agotar tiempo de forma intermitente (PC-13); sola pasa.

## 9. Datos científicos y activos

| Activo | Estado | Ruta |
|---|---|---|
| PGDA78 Site01 surf, ldec, toterr, slp, slperr + ROI | VERIFICADO | `web/data/raw/pgda78_site01/` (no en Git); recortes en `web/data/derived/terrain/` |
| **PGDA78 Site01 clones 0001–0005** | **descargados y VERIFICADOS (SHA-256 = pasaporte); recortes y diferencias integrados** | raw no versionado; `web/data/derived/terrain/clones/` |
| Moon Trek NAC/WAC | integrado; en línea | registro |
| PGDA90 80/240 m, kernels NAIF | identificados, NO descargados | — |
| Ortoimagen NAC individual, nomenclatura IAU | no identificados | — |

## 10. Procesos

El servidor de desarrollo de la vista previa (`.claude/launch.json` → `site-regret-dev`, puerto 3000) se paró antes de compilar. Playwright levanta su propio servidor estático en 4174 y lo cierra al terminar. Sin descargas activas.
