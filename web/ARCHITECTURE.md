# Arquitectura

## Principio

Dos planos desacoplados: la ciencia (motor Python, ya ejecutado) produce `paquete_frontend.json`; la web solo **selecciona y representa** resultados precalculados. Sin servidor de cálculo, sin APIs externas, sin base de datos. Export estático de Next.js → carpeta `out/` utilizable sin red.

## Flujo de datos

```
data/source/…/paquete_frontend.json  (original, SHA-256 verificado)
        │  npm run data  (scripts/prepare-data.ts)
        ├─ verifica 47 originales contra SHA256_TRANSFERENCIA.txt
        ├─ divide en 27 trozos (src/lib/data/split.ts)
        ├─ relee, reensambla y exige igualdad estricta con el original
        ├─ copia byte a byte los originales descargables/figuras
        └─ escribe manifest.json (sha256 + bytes de cada archivo)
        ▼
public/data/site-regret/{manifest.json, v0.1/**, original/**}   (generado, no versionado)
        │  navegador (src/lib/data/loader.ts)
        ├─ manifest → núcleo (150 kB) al arrancar
        ├─ trozos pesados bajo demanda, cacheados en memoria
        └─ cada archivo: SHA-256 (crypto.subtle) → JSON.parse → validación del contrato
```

### División (carga diferida)

| Trozo | Contenido | Tamaño aprox. | Lo usa |
|---|---|---|---|
| `core.json` | `configuration`, `state_names`, `sites`, `comparisons`, `provenance`, resúmenes de los 120 escenarios (métricas, sin series), índices de horizontes/efemérides | 150 kB | Siempre |
| `scenarios/W{1,2}_h{0,2,10}.json` | `state_codes` + `intervals` de 20 escenarios (A/B × 10 superficies) | 185 kB | Timeline, Engineer |
| `horizons/{A,B}_h{0,2,10}.json` | 10 superficies × 1440 azimuts | 470–500 kB | Explore, Comparador, Timeline, Engineer |
| `ephemerides/W{1,2}_clock.json` | `times_utc`, `et_tdb_seconds_j2000` | 177 kB | Timeline, Engineer |
| `ephemerides/W{1,2}_{A,B}_h{…}.json` | Sol/Tierra nominales y umbrales de horizonte | 654 kB | Timeline, Engineer |

Ningún valor se calcula, redondea o renombra al dividir. `canonicalStringify` conserva `-0` (presente en utilidades del motor) y la representación exacta de los doubles. El test `data-integrity` reensambla y compara con el original.

## Contrato TypeScript

- `src/lib/contract/constants.ts`: dominio cerrado (A/B, W1/W2, 0/2/10, 10 superficies, 4 criterios, 5 estados). Se contrasta con la `configuration` real al cargar: si el motor publica otras opciones, la carga falla de forma visible.
- `src/lib/contract/schema.ts`: esquemas zod con nombres de campo **idénticos** al JSON y tipos inferidos. Se valida, pero la app conserva el objeto original (no la salida de zod).
- `src/lib/contract/validate.ts`: reglas semánticas (120 tuplas únicas, 6 comparaciones, signos de criterios, `known + unknown = duration`, coherencia de alturas de observador, intervalos = codificación por tramos de `state_codes`, longitudes 4320/4321/1440).
- `src/lib/data/selectors.ts`: búsqueda por tupla `(site_id, window_id, height_m, variant)`, nunca por posición.

## Estado global

`src/lib/state/selection.ts` (puro) + `SelectionProvider.tsx` (contexto). Campos: `focusSite`, `windowId`, `heightM`, `variant`, `criterion` (inicia en `null`: se elige antes de ver un ganador), `timeIndex`. Se sincroniza con la URL (`?s=&w=&h=&v=&c=&t=`) mediante `history.replaceState`; parámetros inválidos se rechazan y se avisa. Los enlaces de navegación conservan la selección.

## Sistema de diseño

Tokens en `src/app/globals.css` (`@theme` de Tailwind v4). Interfaz con acento azul acero neutro; colores saturados reservados a datos: A `#ff8a1f`, B `#22d3ee`, incertidumbre `#a78bfa`, estados Sol/Tierra/ambos/ninguno/desconocido (con trama). Componentes en `src/components/ui/` (Panel, PageHeader, Segmented, SelectField, Toggle, Badge, NatureBadge, WinnerTag, MetricRow, StatTile, KeyValueList, Legend, StateLegend, Callout, Skeleton, Icon). Catálogo en `/sistema-diseno/`.

Gráficos: SVG propio (sin biblioteca) para el perfil de horizonte: 1440 muestras exactas, huecos para `unknown`, cierre periódico, lectura por teclado. La timeline de 4320 bins categóricos de la fase 2 también encaja mejor en SVG/canvas propio que en una biblioteca de series; se reevaluará si hace falta otra visualización.

## Accesibilidad

Enlace «saltar al contenido», foco visible, controles con roles nativos o ARIA (`radiogroup`, `switch`), menú móvil con Escape, `aria-live` en lecturas del gráfico, texto alternativo de la figura, leyendas textuales (no solo color), `prefers-reduced-motion`.

## Errores

`DataGate` y `ChunkGate` muestran carga, error de red, integridad, JSON inválido o contrato incumplido, con detalle y «Reintentar». Nunca se sustituyen datos por ceros o aproximaciones.

## Problema conocido de la herramienta

Next 16.4.6 en Windows genera los archivos de prefetch por segmento como carpetas (`__next.explore/__PAGE__.txt`) por usar `\` en las rutas; `scripts/fix-export-segments.ts` (postbuild) los aplana al nombre esperado. En Linux/macOS no hace nada.

## Capas de la aplicación

```
src/app/                 rutas (export estático)
src/components/
  ui/                    sistema de diseño: Panel, Controls, Display, Interactive (Tooltip, Button), Icon (Lucide)
  data/                  DataGate/ChunkGate, controles ligados al estado, ControlBar, CriterionPicker, ExportButtons
  charts/                HorizonChart (perfil + trayectorias), TimeCharts (curvas y franjas por tramos), Bars
  home/ explore/ timeline/ comparador/ engineer/ regret/ evidence/ design/   vistas
src/lib/
  contract/              constantes del dominio, esquemas zod + tipos, validación semántica
  data/                  split/assemble, manifiesto, cargador con SHA-256, selectores por tupla, proveedor
  science/               decision (outcome, recuentos, regret), states (tramos, recuentos), metrics, demo, evidence
  state/                 selección global y sincronización con la URL
  export.ts format.ts labels.ts figure.ts nav.ts
tests/                   Vitest sobre datos auténticos
e2e/                     Playwright sobre el export estático (o un despliegue)
```

## Pruebas

- Unitarias/datos (Vitest): integridad, contrato, coherencia métricas↔estados y robustness↔casos, caso W2·0 m, exportes, evidencias, figura, estado/URL.
- E2E (Playwright, Edge del sistema): rutas, estado compartido, 24 combinaciones del comparador, caso demo, reproductor, mapa, alturas, descargas, integridad, móvil.
