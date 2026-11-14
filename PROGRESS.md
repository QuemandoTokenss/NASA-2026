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
