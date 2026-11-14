# PROGRESS — registro por fases

## Resumen de recuperación (leer primero si se retoma)

- Proyecto: `site-regret/` (Next 16, export estático). Ejecutar `npm install`, `npm run dev`; verificación completa `npm run verify`.
- Datos: `npm run data` verifica originales y genera `public/data/site-regret/` (ignorado por git).
- Lógica científica de presentación en `src/lib/science/` (decisiones/regret, estados, métricas). Contrato en `src/lib/contract/`.
- Estado global en `src/lib/state/` (URL `?s&w&h&v&c&t`).
- Ver `TASKS.md` para el estado de cada fase y `DECISIONS.md` para las decisiones.

## F1 — Infraestructura (2026-11-14)

- Implementado: proyecto, datos verificados y divididos, contrato zod+TS, cargador con SHA-256, estado global+URL, sistema de diseño, Dashboard/Explore/Evidencia iniciales, pantallas preparadas, navegación de 7 secciones con Lucide, capa `src/lib/science/`.
- Comprobado: `tsc`, ESLint, 47 tests Vitest, build estático, revisión en navegador (escritorio y 375 px), error de integridad provocado y recuperación.
- Comprobación cruzada sobre el paquete: las 720 métricas (6 × 120 escenarios) se reproducen exactamente desde `state_codes`; los recuentos de `robustness` coinciden con los casos en las 48 familias.
- Pendiente: fases 2–12.

## F2 — Comparador A vs B (2026-11-14)

- Implementado: `src/components/comparador/ComparadorView.tsx` (tarjetas A/B con recorte real de la figura DEM y anillo de fracción REAL de la ventana, diferencias clave, tabla por métrica con barras en horas, conclusión bloqueada hasta elegir criterio, frase `summary_es`, regret A/B, superficie alternativa, matriz de 6 combinaciones, D por superficie, horizontes A/B), exportación JSON/CSV (`src/lib/export.ts`), Tooltip/Button/LinkButton, CriterionPicker, ControlBar, iconos Lucide.
- Corregido: la URL compartida se sobrescribía con valores por defecto en desarrollo (StrictMode); ahora se escribe solo tras restaurar. Tooltips ocultos causaban scroll horizontal; ahora son `fixed` y acotados.
- Comprobado en navegador (1920×1080): W2·0 m·racha sin Sol → B gana (A 38 h 40 min, B 14 h 40 min, frase del motor); `correlated_plus` → gana A, regret de B 16 h 30 min; W1·2 m → empate con regret 0. Sin desbordamiento horizontal.

## F3 — Regret Lab (2026-11-14)

- Implementado: `src/components/regret/RegretLabView.tsx` — KPIs (métrica nominal A/B, elección nominal, «se mantiene» por familia con denominador, peor regret), selector «elección a conservar» (por defecto la nominal; permite medir regret aunque el nominal empate), resultado por superficie agrupado en nominal / 4 propias / 5 clones con escalas por familia, D divergente, ganador, relación con el nominal y regret; panel de superficie seleccionada; mapa de decisiones 6 × 10 interactivo; conclusión determinista + frase del motor; método y límites; caso demostrativo guiado en 6 pasos (también con `#demo`), cuya perturbación relevante se deduce de los datos (`src/lib/science/demo.ts`).
- Pruebas: `tests/export-demo.test.ts` (perturbación relevante = correlated_plus; sin propuesta en empate total; exportes JSON/CSV con valores completos y hash). 58 tests en verde.
- Comprobado en navegador: el recorrido del caso demo produce A 38 h 40 min / B 14 h 40 min → B; correlated_plus → A 32 h 30 min, B 49 h, gana A; regret de conservar B 16 h 30 min; 2/4 propias (1 empate, 1 inversión) y 4/5 clones.

## F4 — Timeline (2026-11-14)

- Implementado: `src/components/timeline/` (TimelineView, TimePlayer) y `src/components/charts/TimeCharts.tsx` (eje UTC común, curvas, franjas por tramos con tooltip de intervalo y censura). Curvas nominales de elevación de Sol/Tierra y del horizonte en su azimut con sombreado de Sol visible; franjas «Sol visible», «Tierra visible», «Estado A», «Estado B»; reproductor (play/pausa, ±10 min, ±1 día, velocidades, deslizador accesible) sobre los 4320 intervalos; lectura del instante (estado de A/B, tramo original, elevación/horizonte/azimut nominales); métricas y tiempo por estado (recuento de state_codes); eventos acotados (original verificado por SHA-256, `loadOriginalJson`); horizonte con trayectorias nominales del cielo. Superficies no nominales: solo estados/métricas y aviso, sin combinar cielo nominal y horizonte alternativo.
- Corregido: escritura de URL con retardo de 180 ms (el navegador limita replaceState durante la reproducción).
- Comprobado en navegador: índice 1200 de W2 = 22 dic 2026 08:00 UTC; reproducción avanza y pausa; A en BOTH con Sol 0,739° > horizonte −1,249° y Tierra 5,536° > −1,038°; sin desbordamiento horizontal.

## F5 — Explore (2026-11-14)

- Implementado: `ContextMap` con zoom (botones, Ctrl+rueda), desplazamiento por arrastre, centrar en sitio, vista completa, escala dinámica y lectura X/Y estereográfica al pasar el puntero (inversa exacta de la figura); marcadores de tamaño constante. Panel de capas con solo capas reales y su procedencia, leyenda de elevación tomada de la figura original (1227–1958 m), capas no disponibles tachadas con motivo; ficha con accesos a Comparador y Timeline; resumen de horizonte por altura; perfiles A/B por altura y superficie.
- Pruebas: leyenda presente en el SVG original; `figureToXY` inversa exacta. 
- Comprobado en navegador: centrar en B a ×3,5 mantiene los anillos sobre los puntos del motor y la escala pasa a 250 m.

## F6 — Engineer (2026-11-14)

- Implementado: `src/components/engineer/` — selector discreto 0/2/10 m (radiogroup), escena 2D rotulada «ILUSTRACIÓN · no a escala · sin cálculo de sombras», métricas a la altura seleccionada con Δ frente a 0 m, horizontes 0/2/10 m superpuestos, gráfico de impacto (3 puntos por sitio, sin líneas de unión), franjas de Sol/Tierra por altura, tabla de sensibilidad, ganador de cada criterio por altura (desde comparisons).
- Comprobado en navegador: W2, A nominal — racha sin Sol 38 h 40 min a 0 m y 0 h a 2/10 m; criterios de Sol: B a 0 m → empate a 2/10 m; Tierra: A en las tres alturas.

## F7 — Evidencia científica (2026-11-14)

- Implementado: `EvidenceView` reescrita + `src/lib/science/evidence.ts`: KPIs reales, inventario de 18 fuentes agrupado con enlaces y hashes, metodología en 7 pasos con etiquetas de naturaleza, 414 comprobaciones clasificadas en 6 categorías (8/4/2/40/120/240), tabla de contraste con Horizons (Δ en segundos de arco), convergencia espacial y temporal y efecto del refinamiento, parámetros e hipótesis, explicación de qué representa y qué no el RMS, naturaleza de los datos, referencias con DOI, límites del pasaporte, integridad y descargas (21 originales + manifest). Se publican además 4 JSON de validación originales.
- Pruebas: `tests/evidence.test.ts` (414 = categorías; máximo del contraste = pasaporte). 63 tests.
- Comprobado en navegador: sin errores; convergencia espacial máx. 0,0549° (B · 0 m), temporal 5 min, refinamiento 50 min y 6/6 ganadores sin cambios.

## F8 — Dashboard y F9 — Integración (2026-11-14)

- Dashboard (`HomeView`): hero con la pregunta del proyecto y luna ILUSTRATIVA rotulada, cifras reales del paquete (2 sitios, 2 ventanas, 3 alturas, 10 superficies, 120 escenarios), recorrido 01/02/03, fichas de A y B con recorte DEM real y métricas nominales a 0 m por ventana, tarjeta del caso demostrativo con valores del paquete y CTA a `/regret-lab/…#demo`, ventanas y ganadores nominales del criterio principal, indicadores (414, 8, 18, 24) y qué hace única la aplicación, accesos a las 6 secciones.
- Integración: al navegar internamente hacia una URL con parámetros explícitos, el estado adopta esa selección (antes se ignoraba); enlaces sin parámetros conservan la selección. Exportación JSON/CSV en Comparador, Regret Lab, Timeline y Engineer. Eliminadas las pantallas provisionales `phase2/`.
- Comprobado en navegador: desde el Dashboard (estado W1·2 m·published_0002) «Iniciar caso demostrativo» abre Regret Lab con W2·0 m·criterio y la guía en el paso 1 con A 38 h 40 min / B 14 h 40 min.
- No abordado: bilingüismo ES/EN (P2).
