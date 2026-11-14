# HANDOFF · SITE REGRET · capa geoespacial real

**Punto de control:** PC-11 · 2026-11-14 13:00 (+01:00, Europe/Madrid) · **Estado: LISTO_PARA_RELEVO**
Documento principal del relevo. Si contradice al código o a `git status`, mandan el código y Git.

## 1. Dónde se trabaja

| | |
|---|---|
| Directorio de trabajo (raíz Git) | `C:\Users\Hugo\Desktop\Hugo\Proyectos\NASA-SpaceApps-2026\NASA-2026` |
| Aplicación | subcarpeta `web/` (Next.js, export estático) |
| Remoto | `QuemandoTokenss/NASA-2026` (GitHub, privado) |
| Rama | `feat/geo-real-terrain` — subida a GitHub el 2026-11-14 (PC-07); sin PR ni despliegue |
| HEAD | remoto `2ca0a66` (PC-07). **En local hay 4 commits posteriores SIN SUBIR** (`62ca048`, `3d4cf76`, el de ODE y el de este relevo): `git status -sb` debe decir «ahead 4». Base `main` = `987899d` |
| Worktree | único (no hay worktrees separados) |
| Otra copia que NO es la activa | `…\NASA-SpaceApps-2026\site-regret\` (copia antigua previa al repo del equipo; no editar) |

Quien retome en otro equipo: clonar el repo y hacer `git switch feat/geo-real-terrain`. En `main` no hay nada de lo descrito aquí.

## 2. Encargo y decisiones que se conservan

Encargo: ver [ENCARGO_VIGENTE.md](ENCARGO_VIGENTE.md). Reglas del repo: `AGENTS.md`. Decisiones:

- La web solo LEE el paquete precalculado `site-regret/0.1`; no se recalcula visibilidad en el navegador. `web/data/source/` no se toca.
- Geometría lunar transcrita del motor (`web/data/source/DERIVADOS_SITE_REGRET/motor/pipeline.py`) en `web/src/lib/geospatial/lunar.ts`: esfera R = 1 737 400 m, estereográfica polar sur, marco MOON_ME_DE421. Nada terrestre.
- Originales NASA en `web/data/raw/` (ignorado por Git). Derivados ligeros versionados en `web/data/derived/terrain/` (recorte exacto, sin remuestrear) con manifiesto y SHA-256.
- Teselas de Moon Trek: se leen de GetCapabilities; el CRS declarado `EPSG::0` es ambiguo y nunca se trata como terrestre. Si el servicio falla, NO hay imagen de sustitución.
- Con superficies no nominales no se muestran direcciones Sol/Tierra (el paquete solo las trae para la nominal).
- Texto de interfaz bilingüe: `L("es", "en")`.

## 3. Estado por tareas (requisitos del encargo)

| ID | Requisito | Estado | Dónde |
|---|---|---|---|
| G0 | Inventario y clasificación de TODOS los assets visuales (§3) | IMPLEMENTADO (revisión humana pendiente) | `web/docs/GEOESPACIAL.md` |
| G1 | Registro de activos con procedencia (§5) | VERIFICADO (8 activos) | `web/data/geospatial/registry.json` |
| G2 | Descargador verificable de originales (§8) | VERIFICADO | `web/scripts/geospatial/fetch-originals.ts` |
| G3 | Recortes numéricos del DEM + ROI con manifiesto | VERIFICADO | `scripts/geospatial/build-terrain.ts`, `data/derived/terrain/` |
| G4 | Lector WMTS Moon Trek (§6) | VERIFICADO (unit + tesela real) | `src/lib/geospatial/wmts.ts` |
| G5 | Mapa georreferenciado en Explore: fondo orbital, capas numéricas, ROI, A/B, lectura, medida y perfil (§4 A–E, §10) | VERIFICADO (E2E PC-06) | `src/components/maps/GeoMap.tsx`, `ProfileChart.tsx` |
| G6 | Terreno 3D real en Engineer + «qué tapa el Sol/la Tierra» (§4 F, §11) | VERIFICADO (E2E PC-06) | `src/components/terrain/`, `src/lib/geospatial/mesh.ts`, `horizon.ts` |
| G7 | Timeline y resultados de referencia intactos (§4 G, T9) | VERIFICADO: batería completa PASS en PC-06 | — |
| G8 | Evidencia por capa (§4 H, §15) | VERIFICADO (E2E PC-06) | `src/components/evidence/GeoEvidence.tsx` |
| G9 | Corregistro imagen ↔ DEM (T5) | PARCIAL: rejilla de teselas VERIFICADA (NCC 0,95, ~8 m); mosaico fotográfico NO CONCLUYENTE | `scripts/geospatial/check-coregistration.ts`, `data/derived/coregistration.json`, `tests/terrain-mesh.test.ts` |
| G10 | Navegador ODE/PDS de productos y huellas (§7) | VERIFICADO en lo implementado (unit 6/6, E2E 3/3, ejecución en vivo); PARCIAL respecto a §7 (ver §4) | `src/lib/geospatial/ode.ts`, `src/components/maps/OdePanel.tsx`, `tests/ode.test.ts`, `tests/fixtures/ode/` |
| G11 | Ortoimagen NAC concreta de Connecting Ridge (§9) | PENDIENTE (no identificada) | — |
| G12 | Nomenclatura IAU/USGS (§9) | PENDIENTE | — |
| G13 | Relieve regional PGDA90 80/240 m en el mapa (§8) | PENDIENTE (no descargado; ~408 MB) | — |
| G14 | Contraste Horizons/SPICE nuevo (§12) | PENDIENTE (se conserva el del paquete) | — |
| G15 | Regret Lab conectado al mapa; clones descargados (§13) | PENDIENTE | — |
| G16 | Escenarios nuevos calculados (§14, fase 5) | PENDIENTE (requiere servicio de cómputo; no autorizado) | — |
| G17 | Documentación (`web/README`, `QA_REPORT`, `DECISIONS`, `docs/GEOESPACIAL.md`) | VERIFICADO a mano en PC-08 (documentos actualizados con resultados reales) | `web/README.md`, `web/QA_REPORT.md`, `web/DECISIONS.md` D20–D24, `docs/VALIDATION.md`, `docs/STATUS.md` |
| G18 | PR a `main` | PARCIAL: rama subida (PC-07); PR y despliegue pendientes de autorización humana | — |

## 4. Tarea activa

**G15 · Regret Lab conectado al mapa con superficies reales. Estado: SIN EMPEZAR.** No hay ningún cambio parcial pendiente: el árbol queda limpio tras el commit de relevo.

Cerrado antes del relevo (detalle en §3 y §6):
- **G17** documentación (PC-08).
- **G9** PARCIAL (PC-09): rejilla de teselas verificada contra el DEM (NCC 0,95; desfase X −1,7 m, Y −8,3 m ≈ 1 píxel de tesela, uniforme en 4 cuadrantes); mosaico NAC NO CONCLUYENTE. Variantes ya probadas, no repetir: sombreado sin filtrar (máximo en el borde de búsqueda); paso alto de 110 m con sombras excluidas (65 % en sombra, NCC ≈ 0). Origen del píxel de desfase sin determinar (no se probó otro zoom).
- **G10** (PC-10/11): adaptador ODE REST y panel en Explore, probado con respuestas grabadas y una vez en vivo. Parcial respecto al megaprompt §7: caja fija de los sitios (sin región visible ni polígono), 3 tipos de producto fijos comprobados con `query=iipt` (no se descubren en vivo; esa respuesta pesa 385 kB), productos proyectados sin cargar como capa, sin GDS. En el mock E2E `GDRDEM` devuelve el error grabado para ejercitar la ruta de error; en el servicio real ese tipo existe.

Siguiente acción exacta (G15), en `web/`:
1. Añadir a `data/geospatial/registry.json` los 5 clones `Site01_final_adj_5mpp_000N_err.tif` (URL, bytes y SHA-256 están en `data/source/DERIVADOS_SITE_REGRET/datos/pasaporte.json`, ids `SITE01_CLONE_0001…0005`; carpeta remota `…/Site01/Clones/`). `fetch-originals.ts` guarda por nombre de archivo en `data/raw/pgda78_site01/`. Son 5 × 41 MB: comprobar espacio y avisar antes de descargar.
2. Ampliar `scripts/geospatial/build-terrain.ts` para generar, por clon, el recorte de DIFERENCIA (clon − nominal) en la misma ventana, con manifiesto y hash. Comprobar con una prueba que clon(sitio A) = `core.horizons_index.A.observer_ground_height_m.published_000N` (valores ya conocidos: 1956,1689…, 1955,8801…).
3. En el mapa (`GeoMap.tsx`), capa «diferencia clon − nominal» con leyenda divergente; en Regret Lab, enlace a esa capa para la superficie seleccionada y, usando `horizonObstacle` con el perfil de la variante, mostrar qué azimuts cambian de horizonte respecto al nominal. Solo hechos calculados: NO señalar una causa si no se ha calculado.
4. Límite que hay que documentar, no aproximar: las 4 hipótesis propias (`bias_*`, `correlated_*`) no pueden reconstruirse en la web sin reimplementar el generador PCG64 + filtro gaussiano del motor; sus horizontes sí están en el paquete.

Tarea terminada cuando: recortes de diferencia versionados y probados, capa visible con leyenda, vínculo desde Regret Lab, `npm run verify` en verde y resultados anotados aquí.

## 5. Cambios locales

- En el remoto hasta `2ca0a66`: `bdf6c2e`, `2751a55`, `54cda05`, `4b77455`, `b4ced8b`, `2ca0a66`.
- Tras PC-06 se hace un commit local con archivos explícitos (`web/playwright.config.ts`, `web/docs/GEOESPACIAL.md`, `docs/continuidad/*`, `CLAUDE.md`); comprobar con `git status` y `git log -1`.
- No versionado a propósito: `web/data/raw/pgda78_site01/` (6 originales NASA, ~205 MB), `web/node_modules`, `web/out`, `web/public/data`.
- Cambios de otras personas: ninguno en esta rama. PR #7 y #8 de aritzgsc siguen abiertos en GitHub y no se han tocado.

## 6. Comandos (ejecutar en `web/`) y pruebas

Entorno comprobado: Windows 11, Node v24.19.0, npm, Edge (Playwright `channel: msedge`).

```
npm ci
npm run dev          # http://localhost:3000
npm run build && npm run serve   # estático en http://127.0.0.1:4173
npm run geo:fetch    # descarga y verifica originales NASA a data/raw (solo si se van a regenerar derivados)
npm run geo:build    # regenera data/derived/terrain desde data/raw
npm run verify       # typecheck → lint → test → build → test:e2e
E2E_LIVE_TREK=1 npx playwright test e2e/geo.spec.ts -g "en vivo"   # opcional, con red
```

| Prueba | Resultado | Cuándo |
|---|---|---|
| `tsc --noEmit` | PASS | PC-03, antes de `54cda05` (mismos fuentes) |
| `eslint` | PASS (0 errores) | sobre `54cda05` |
| `vitest run tests/geospatial.test.ts tests/terrain-mesh.test.ts` | PASS 26/26 | PC-03 |
| Vitest completo (89) | NO_EJECUTADO tras los cambios geo | RESULTADO_ANTERIOR: 63/63 en `main` |
| `next build` | PASS | PC-03 |
| `playwright test e2e/geo.spec.ts --project=desktop` | 11 PASS, 1 FAIL, 1 omitido | antes del arreglo de `54cda05` |
| Resto de E2E (app, a11y, i18n, story, responsive) | NO_EJECUTADO tras los cambios geo | RESULTADO_ANTERIOR: 47/47 en `main` |
| Tesela real de Moon Trek (curl y navegador) | PASS | 2026-11-14 |
| E2E «en vivo» con `E2E_LIVE_TREK=1` | NO_EJECUTADO | — |
| PC-05 · `tsc`, Vitest completo, `next build` sobre `54cda05` | PASS (89/89) | 2026-11-14 ~11:05 |
| PC-05 · `npx playwright test` completo (4 workers) | 54 PASS, 5 FAIL, 1 omitido (4,9 min) | 2026-11-14 ~11:05 |

| PC-06 · `npx playwright test --workers=2` (completo) | **59 PASS, 0 FAIL, 1 omitido** (2,5 min) | 2026-11-14 ~11:15 |

PC-06: incluye `a11y.spec.ts` (axe WCAG A/AA en las 8 rutas) y `responsive.spec.ts` (375 px) con los componentes nuevos. No se ha vuelto a lanzar `npm run verify` de una sola vez tras fijar `workers: 2`.

| PC-10 · `npm test` (completo) | **98/98 PASS** | 2026-11-14 ~12:50 |
| PC-10 · `npx playwright test` (2 procesos, completo) | **62 PASS, 0 FAIL, 1 omitido** (2,7 min) | 2026-11-14 ~12:50 |
| PC-10 · `npm run geo:coregistration` (con red) | Rejilla CONCLUYENTE; mosaico NAC NO CONCLUYENTE | 2026-11-14 ~12:05 |
| PC-11 · panel ODE contra el servicio real (script puntual de Playwright, sin mock) | PASS: 253 productos, huella dibujada, teselas reales | 2026-11-14 ~12:55; captura `web/docs/capturas/live-ode.png` |

PC-05, fallos: `/comparador/`, `/timeline/`, `/evidencia/` (carga de ruta), «la navegación conserva la selección» y el clic de `geo.spec.ts`. Todos por TIEMPO (40–60 s; `waitForData` agota sus 15 s), en páginas que no usan mapa ni 3D. Hipótesis: saturación de CPU con 4 workers mientras las pruebas de Engineer dibujan la malla de 160 000 vértices con WebGL por software. Confirmado: con `--workers=2` pasan todas; `workers: 2` queda fijado en `web/playwright.config.ts`.

Evidencia numérica clave (Vitest): el DEM muestreado en el punto que el motor señala como obstáculo reproduce su horizonte en 4 636 direcciones (máx. 1,1e-7°); lectura en A y B = valores exactos del paquete; horizonte interpolado = `sun_horizon_deg`/`earth_horizon_deg` del paquete (< 1e-9°).

## 7. Problemas ya investigados (no repetir)

- **Heredocs de bash en esta máquina**: fallan con «unexpected EOF» si el texto lleva comillas simples/acentos. Solución usada: escribir el script a un archivo y ejecutarlo.
- **geotiff.js v3**: `getTiePoints()` es asíncrono y los tags son perezosos. Usar `getOrigin()`, `getResolution()`, `getGeoKeys()`, `pixelIsArea()`.
- **Precisión float32**: el motor guarda las alturas interpoladas en float32; al comparar ángulos hay que aplicar `Math.fround` a la altura muestreada.
- **Vista previa del navegador**: tras cargar `/explore/` las teselas tardan 1–3 s; una captura inmediata sale en negro aunque funcione.
- **Descarga interrumpida**: un `.tif` truncado (7,7 MB de 41 MB) se detecta por tamaño y hash; `geo:fetch` lo repite.
- La página de documentación de Moon Trek lista sus capas mediante un índice (`TrekServices/ws/index/...`). Se usó una vez para DESCUBRIR capas; la app solo usa los documentos WMTS.

## 8. Datos científicos y activos

| Activo | Estado | Ruta |
|---|---|---|
| PGDA78 Site01: surf, ldec, toterr, slp, slperr (5 × 41 MB, float32, 3200², 5 m) y `Site01_ROIs.tgz` | descargado y VERIFICADO entero (SHA-256 = pasaporte) | `web/data/raw/pgda78_site01/` (no en Git) |
| Recortes 800×800 (X −13000…−9000, Y −14000…−10000 m) de esas 5 capas + `rois.json` (7 ROI) | integrado y VERIFICADO | `web/data/derived/terrain/` (en Git, 12,8 MB) |
| Moon Trek `LRO_NAC_Mosaic_1mpp_SP` (zoom 12, ~2,09 m/px) y `LRO_WAC_Mosaic_SPole60_100m_v02` | integrado; probado en vivo; depende de red | registro + `tests/fixtures/trek/` (respuestas reales grabadas) |
| Clones PGDA78 0001–0005, PGDA90 80 m y 240 m, kernels NAIF | identificados (URL y hash en el pasaporte), NO descargados aquí | — |
| Ortoimagen NAC individual, huellas ODE, nomenclatura IAU | no identificados | — |

## 9. Procesos

Servidores estáticos de vista previa lanzados por la sesión de Hugo: `127.0.0.1:4175` (sirve `NASA-2026/web/out`) y `127.0.0.1:4173` (copia antigua `site-regret/out`). No se asume que sobrevivan; se relanzan con `npm run serve`. Sin descargas ni subagentes activos.

## 10. Próximas tres tareas

1. **G15**: Regret Lab ↔ mapa con clones reales (ver §4).
2. **G11/G9**: identificar con ODE una ortoimagen o producto NAC proyectado de Connecting Ridge (probar `pt=SDNDTM` y `BDRROI` en la caja de los sitios) y usarlo para el corregistro del mosaico.
3. **G18**: con autorización de Hugo, push de la rama y PR a `main`. No desplegar a Vercel sin su permiso.
