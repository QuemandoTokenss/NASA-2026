# SITE REGRET · Trabajo realizado hasta ahora

Quemando Tokens · NASA International Space Apps Challenge 2026 (Bilbao) · reto *Lunar Landing Site Navigator*
Fecha de este resumen: 14 de noviembre de 2026 · Autor: Hugo (con Claude Code como asistente de desarrollo; ver [AI_USE.md](AI_USE.md))

> **Pregunta del proyecto:** ¿hasta qué punto podemos confiar en que un emplazamiento lunar es mejor que otro si el relieve con el que se calculó contiene incertidumbre?

## 1. Resumen en 30 segundos

- Hay una **aplicación web completa** en [`web/`](../web) que compara dos sitios del polo sur lunar —**A = Connecting Ridge ROI 4** y **B = Connecting Ridge ROI 6**— usando un paquete científico **precalculado y verificado** (`site-regret/0.1`: 120 escenarios, 6 comparaciones × 4 criterios).
- **Producción:** https://site-regret.vercel.app (modo presentación: https://site-regret.vercel.app/historia/ · inglés: añadir `?lang=en`).
- **Calidad comprobada:** TypeScript estricto y ESLint sin errores · 63 tests de datos/ciencia (Vitest) · 47 tests de navegador (Playwright: escritorio, móvil, accesibilidad WCAG A/AA con axe-core, historia e idioma), en local y contra producción.
- **Caso demostrativo** (todo sale de los datos): ventana W2 · 0 m · criterio «minimizar la racha más larga sin Sol». Nominal: A = 38 h 40 min, B = 14 h 40 min → **gana B**. Con la hipótesis propia `correlated_plus` la elección **se invierte** y conservar B cuesta un **REGRET de 16 h 30 min**. B se mantiene en 2/4 hipótesis propias y en 4/5 clones publicados (recuentos, **no** probabilidades).

## 2. De dónde salen los datos

- El paquete de transferencia `SITE_REGRET_TRANSFERENCIA_COMPLETA.zip` (motor Python ya ejecutado) contiene los resultados derivados y su trazabilidad. En el repo están, **byte a byte**, las partes que usa la web: [`web/data/source/`](../web/data/source) (`DERIVADOS_SITE_REGRET`, `00_LEER_PRIMERO`, `SHA256_TRANSFERENCIA.txt`).
- `paquete_frontend.json`: SHA-256 `e7c8984b2bcfe804bdabed0d13a9f812d34739b6d1e957466ced784bd86fd936`, 12 464 735 bytes.
- Fuentes NASA del motor: LOLA PGDA78 Site01 (DEM 5 m, capas de error, ROI, clones publicados), mosaicos PGDA90 (80 m y 240 m), JPL/NAIF SPICE DE421 (efemérides y marcos `MOON_ME_DE421`) y contraste con JPL Horizons. Referencias con DOI en la sección «Evidencia científica» de la web.
- **No** está en el repo (va en el zip del equipo, ver §8): los datos brutos (`RECOPILACION_DATOS_2026-11-14`: kernel `de421.bsp`, artículos PDF, catálogos) — `AGENTS.md` pide no versionar descargas brutas.

## 3. Qué hace la web (8 rutas)

| Ruta | Qué hace |
|---|---|
| `/` Dashboard | La pregunta, cifras reales del paquete, fichas de A y B con recorte DEM real, caso demostrativo, indicadores (414 comprobaciones, 8 contrastes Horizons, 18 fuentes, 24 decisiones) |
| `/explore/` | Figura DEM original con zoom/desplazamiento, marcadores exactos (comprobados con test), coordenadas X/Y, capas con procedencia y capas **no disponibles** declaradas |
| `/timeline/` | Estados Sol/Tierra cada 10 min por tramos (sin interpolar), curvas solo para la superficie nominal, reproductor sobre instantes reales, salidas/puestas acotadas a 10 min |
| `/comparador/` | A vs B: el ganador **no se muestra hasta elegir criterio**; métricas reales, empates (≤ 10 min), regret, superficies alternativas, las 6 combinaciones, frase del motor, exportación JSON/CSV |
| `/engineer/` | Observador a 0/2/10 m (sin deslizador continuo): horizontes, métricas, franjas y ganador por altura; escena del mástil rotulada como ilustración |
| `/regret-lab/` | Mantener/empatar/invertir por familia (4 hipótesis propias y 5 clones publicados, **separadas**), regret, mapa de decisiones 6 × 10, caso demostrativo guiado en 6 pasos (`#demo`) |
| `/evidencia/` | 414 comprobaciones por categoría, contraste con JPL Horizons, convergencia, qué significa el RMS, fuentes con hash, referencias DOI, límites, 21 originales descargables |
| `/historia/` | **Modo presentación** para el jurado: 7 escenas a pantalla completa con teclado (← →, F) |

Común a todas: selección compartida en la URL (`?s&w&h&v&c&t`) validada al cargar · cada trozo de datos se verifica con SHA-256 en el navegador antes de usarse (un archivo alterado bloquea la interfaz) · estados de carga/error · navegación por teclado · **español e inglés** (selector ES/EN o `?lang=en`).

## 4. Reglas científicas que respeta (no romper)

Estas reglas vienen del brief del equipo y están cubiertas por tests:

1. Solo A/B (ROI 4 y 6), W1/W2 y 0/2/10 m: no se inventan sitios, fechas, coordenadas ni métricas.
2. Las frecuencias de variantes **no** son probabilidades; familias propias y clones publicados **separadas**.
3. Sin Monte Carlo, ni modelos de energía, enlace de radio, temperatura, radiación, seguridad de alunizaje o estructura; sin puntuaciones 0–100.
4. No se interpolan estados categóricos; `UNKNOWN`/`null` nunca se tratan como sombra o cero.
5. No se combinan efemérides nominales con horizontes de variantes (curvas Sol/Tierra solo en la superficie nominal).
6. Criterio antes que ganador; empate si |D| ≤ 10 min sobre valores completos.
7. Colores fijos: A naranja, B cian, incertidumbre/regret violeta.
8. Los datos originales no se modifican; la frase del motor (`summary_es`) se muestra tal cual.

## 5. Cómo está hecho

- Next.js 16 (App Router, export estático) · React 19 · TypeScript estricto · Tailwind 4 · zod · lucide-react · Vitest · Playwright (usa el Edge/Chrome instalado).
- `web/scripts/prepare-data.ts` verifica los originales contra `SHA256_TRANSFERENCIA.txt`, divide el paquete en 27 trozos y comprueba que el reensamblado es idéntico (incluido `-0`). Genera `web/public/data/site-regret/` (no versionado).
- Código: contrato y validación en `web/src/lib/contract/`, carga y verificación en `web/src/lib/data/`, lógica de presentación científica en `web/src/lib/science/`, estado ↔ URL en `web/src/lib/state/`, idiomas en `web/src/lib/i18n.ts`.
- Detalle técnico: [`web/ARCHITECTURE.md`](../web/ARCHITECTURE.md) · decisiones D1–D19: [`web/DECISIONS.md`](../web/DECISIONS.md) · registro por fases: [`web/PROGRESS.md`](../web/PROGRESS.md) · QA: [`web/QA_REPORT.md`](../web/QA_REPORT.md) · incompatibilidades con los mockups: [`web/docs/INCOMPATIBILIDADES_MOCKUPS.md`](../web/docs/INCOMPATIBILIDADES_MOCKUPS.md).

## 6. Cómo ejecutarlo

Requisitos: Node.js ≥ 22.18 (probado con 24.19) y npm. Para E2E, Microsoft Edge o Chrome.

```bash
cd web
npm ci
npm run dev            # http://localhost:3000
npm run build && npm run serve   # versión estática sin red en http://127.0.0.1:4173
npm run verify         # typecheck → lint → 63 tests → build → 47 E2E
```

Con Chrome en lugar de Edge: `PW_CHANNEL=chrome npm run test:e2e`. Contra producción: `E2E_BASE_URL=https://site-regret.vercel.app npx playwright test`.

## 7. Historia de commits (carpeta `web/`)

| Commit | Contenido |
|---|---|
| `2120890` | Arquitectura inicial: datos verificados, contrato TS, estado ↔ URL, diseño base |
| `738d1cb` | Comparador A vs B |
| `b167267` | Regret Lab |
| `f7671e5` | Timeline Sol/Tierra |
| `2b9f93f` | Explore |
| `96b4b1e` | Engineer (alturas) |
| `c0bd783` | Evidencia científica |
| `e9bb38d` | Dashboard |
| `c170d33` | Pulido visual |
| `58a3430` | Tests de datos e interacción |
| `515c006` | Preparación de producción (Vercel) |
| `32372c9` | Modo historia + auditoría de accesibilidad |
| `f7ae63d` | Versión en inglés |
| `3801c17` | Registro del despliegue |

## 8. Zip para el equipo (fuera de GitHub)

`SITE_REGRET_paquete_equipo.zip` (lo comparte Hugo) contiene lo que no conviene versionar:

- `SITE_REGRET_TRANSFERENCIA_COMPLETA.zip` original e intacto (incluye `RECOPILACION_DATOS_2026-11-14` con el kernel DE421, artículos y catálogos, y el motor derivado).
- `SITE_REGRET_V3.zip` (plan maestro y guías; parte de ello está también en la rama `docs/site-regret-snapshot`).
- `web-out/`: la web ya compilada, lista para servir sin red (`node web/scripts/serve-static.ts <ruta>/web-out 4173`).
- `LEEME_ZIP.md` con el SHA-256 de cada archivo.

## 9. Despliegue

- Vercel, proyecto `site-regret` (cuenta de Hugo), con `web/` como raíz: `vercel.json` define `npm ci`, `npm run build` y la carpeta `out/`. Los primeros despliegues se hicieron desde la CLI.
- `.vercelignore` excluye `qa_entradas.json` (contiene rutas locales de un equipo). Aun así ese archivo **está en el repo** (privado) dentro de los originales.
- **Actualizado el 14-11-2026 (PC-23):** el proyecto está conectado a GitHub y **cada push a `main` se publica en producción**; las ramas reciben vista previa. Estado vigente del despliegue y del proyecto: [`continuidad/HANDOFF.md`](continuidad/HANDOFF.md) §0. Las secciones 1–8 y 10 de este documento describen la primera entrega (commits `2120890` … `3801c17`) y no recogen la capa geoespacial, Mission Control v2, la demo guiada ni el paquete de alturas de Engineer.

## 10. Qué falta / límites conocidos

- Prueba de la versión estática en un **segundo portátil sin red** (issue OFFLINE).
- Prueba con **lector de pantalla real** (la auditoría automática axe-core sí pasa).
- `npm ci` avisa de **7 vulnerabilidades moderadas** en dependencias; sin revisar.
- La verificación de la pestaña *Resources* del reto (DATA-00) sigue pendiente de revisión humana.
- Sin escena 3D (prioridad P2).
- Límites científicos: visibilidad geométrica del centro del Sol y de la Tierra; no implica energía, enlace, seguridad ni respaldo de la NASA.

## 11. Cómo trabajar ahora (Agent Orchestrator)

1. Clona el repo y ábrelo en Agent Orchestrator (ver README).
2. Elige un issue; un worker por issue, cada uno en su rama y worktree.
3. Dentro de `web/`, ejecuta `npm ci` y, antes del PR, `npm run verify` (o al menos `npm run typecheck && npm run lint && npm test`).
4. Abre un PR con los comandos ejecutados y su resultado; otro compañero revisa antes de `main`.
5. Respeta las reglas científicas de §4 y las de [`AGENTS.md`](../AGENTS.md).
