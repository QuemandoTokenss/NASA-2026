# QA_REPORT — SITE REGRET web

> Las secciones de abajo describen `main` (commit `3801c17`). Los resultados de la rama `feat/geo-real-terrain` están al final, en «Capa geoespacial».

Fecha: 2026-11-14. Entorno: Windows 11, Node 24.19, Next 16.4.6, Microsoft Edge (Playwright `channel: "msedge"`).
Solo se declara lo que se ha ejecutado. Comando completo: `npm run verify` (typecheck → lint → tests → build → E2E).

## Resultado

| Comprobación | Herramienta | Resultado |
|---|---|---|
| Tipos | `tsc --noEmit` (strict) | 0 errores |
| Estilo y reglas React/a11y | ESLint (next core-web-vitals + TS) | 0 errores, 0 avisos |
| Datos, contrato y ciencia | Vitest — 7 archivos | **63/63** |
| Build de producción | `next build` (export estático) + `fix-export-segments` | Correcto, 9 rutas estáticas |
| Funcionales / integración / visuales | Playwright sobre `out/` servido sin red | **47/47** (39 escritorio 1920×1080, 8 móvil 375×812) |
| Accesibilidad automática | axe-core WCAG 2.1 A/AA (en Playwright) | 0 infracciones en las 8 rutas |

## Pruebas de datos (Vitest, datos auténticos)

- Integridad: 47 originales contra `SHA256_TRANSFERENCIA.txt`; `paquete_frontend.json` = `e7c8984b…` y 12.464.735 bytes (= RESUMEN.json).
- Transformación: dividir + serializar + reensamblar = original con igualdad estricta (incluido `-0`); falta de un trozo detectada; cada trozo servido coincide con su SHA-256; originales publicados byte a byte.
- Contrato: versión `site-regret/0.1`; 120 tuplas únicas = producto completo; 6 comparaciones × 4 criterios; casos negativos (versión, duplicados, comparación ausente, alturas no calculadas, signo de criterio, métricas incoherentes, ganador fuera de dominio, superficie ausente); trozos de escenarios/horizontes/efemérides válidos y negativos (código de estado, intervalos ≠ estados, altura equivocada, horizonte truncado).
- Ciencia: las 720 métricas (120 × 6) se reproducen exactamente desde `state_codes`; no hay estados UNKNOWN en el paquete; `robustness` = recuento por familia en las 48 familias (mantiene, empates, fracción, peor regret; `null` si el nominal empata); D = U_A − U_B, regret ≥ 0 y 0 para el ganador, empate solo con |D| ≤ 10 min.
- Caso de aceptación W2 · 0 m · menor racha sin Sol: A 38 h 40 min, B 14 h 40 min, gana B; 2/4 propias (1 empate, correlated_plus invierte), 4/5 clones; regret de conservar B con correlated_plus = 16,5 h; peores regrets 16,5 h y 528,67 h; los otros 5 pares ventana/altura = empate nominal.
- Caso demostrativo: la perturbación relevante se deduce de los datos (correlated_plus); sin propuesta en un empate total.
- Exportaciones JSON/CSV: valores completos y hash del paquete.
- Evidencias: 414 = 8 + 4 + 2 + 40 + 120 + 240 por categoría; máximo del contraste Horizons = pasaporte.
- Figura: marcadores calculados = círculos del motor en el SVG; inversa X/Y exacta; leyenda presente en el SVG.
- Estado/URL y formato: ida y vuelta, rechazo de valores no calculados, reinicio de `t` al cambiar de ventana, límites 0…4319; formato h/min sin alterar decisiones.

## Pruebas E2E (Playwright)

- Las 7 rutas cargan sin errores de consola, sin alertas y sin desbordamiento horizontal (1920 y 375 px).
- La navegación conserva la selección; parámetros inválidos → aviso y valores por defecto; teclado (enlace de salto, flechas en control segmentado).
- Comparador: no revela ganador sin criterio; W2·0 m (B; con correlated_plus gana A y regret de B 16 h 30 min); **las 24 combinaciones ventana × altura × criterio** muestran el ganador del contrato; exportación JSON = métricas del núcleo.
- Regret Lab: caso demostrativo completo desde el Dashboard (6 pasos, textos con valores del paquete, URL final con correlated_plus, «Se invierte»); familias separadas «Se mantiene 2/4» y «4/5»; ausencia de «probabilidad de ser mejor»; empate nominal sin fracción y regret medible; mapa de decisiones selecciona superficie (528 h 40 min).
- Timeline: lectura UTC (índice 1200 = 22 dic 2026 08:00), +1 día, reproducción/pausa avanza el índice; superficies alternativas sin curvas inventadas.
- Explore: zoom (×1,5) y selección de sitio pulsando el marcador. Engineer: alturas 0/10 m y «cambia con la altura». Evidencia: 414/414, 8 filas Horizons y descarga del paquete con SHA-256 correcto.
- Integridad: un `core.json` alterado bloquea la interfaz con «Integridad fallida».
- Menú móvil abre, navega y se cierra.
- Historia: las 7 escenas con teclado, valores del paquete (648 m, 38 h 40 min / 14 h 40 min, 16 h 30 min, 2/4 y 4/5, 414/414), enlace directo por escena.
- Idioma: el selector cambia a inglés, conserva la selección, persiste al recargar y vuelve a español; `?lang=en` en la historia y en Regret Lab («Holds 2/4», sin «probability»).
- Accesibilidad: axe-core sin infracciones WCAG 2.1 A/AA en las 8 rutas (incluye contraste).
- Barrido de idioma: recorrido automático de todas las rutas en inglés buscando texto en español; solo quedan, a propósito, la frase del motor y las descripciones de las fuentes del pasaporte (marcadas `lang="es"`).

## Defectos encontrados y corregidos durante QA

1. La URL compartida se sobrescribía con la selección por defecto en desarrollo (StrictMode).
2. Tooltips ocultos provocaban scroll horizontal.
3. Prefetch 404 en el export estático bajo Windows (bug de Next) → `fix-export-segments`.
4. Enlaces internos con parámetros distintos (caso demo) no actualizaban el estado.
5. Desbordamiento móvil en cabeceras de panel con controles y en tarjetas de descarga.
6. El interior del anillo de un marcador del mapa no era clicable.
7. `replaceState` demasiado frecuente durante la reproducción → escritura con retardo.

## No verificado / pendiente

- Prueba en **otro portátil sin red** y en Firefox/Safari (solo Edge en este equipo; Chrome disponible con `PW_CHANNEL=chrome`).
- Auditoría con lector de pantalla real — no ejecutada (la auditoría automática axe-core sí).
- Rendimiento medido (Lighthouse) — no ejecutado; los trozos pesados se cargan bajo demanda y las franjas se dibujan por tramos.
- Despliegue público: ver `README.md` (sección Despliegue).

## Capa geoespacial (rama `feat/geo-real-terrain`, 2026-11-14)

Ejecutado sobre el commit `54cda05` + `workers: 2` (equipo de Hugo, Windows 11, Node 24.19, Edge):

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit`, ESLint | 0 errores |
| Vitest (10 archivos) | **89/89** (63 anteriores + 21 `geospatial` + 5 `terrain-mesh`) |
| `next build` | Correcto |
| Playwright, 2 procesos | **59/59**, 1 omitida (en vivo). Con 4 procesos: 54/59, 5 fallos por tiempo |

Qué establecen las pruebas nuevas: originales y recortes con SHA-256 = pasaporte/manifiesto; recorte = subconjunto exacto del TIFF; lectura en A y B = valores del paquete; proyección ida/vuelta, base local, distancias con radio lunar; lector WMTS sobre documentos reales y rechazo de respuestas no válidas; el DEM en el punto que el motor señala como obstáculo reproduce su horizonte (4 636 direcciones, máx. 1,1e-7°); horizonte interpolado = el guardado para Sol y Tierra; malla 3D = muestras del raster; en navegador, teselas pedidas según capacidades, cambio de capa y leyenda, lectura por clic, medida A–B, fuera de cobertura, sin red, HTML con 200, escena 3D dibujada y lectura del obstáculo = cálculo independiente, procedencia por capa.

No verificado: alineación imagen↔DEM con puntos de control (solo a la vista), prueba en vivo automatizada, segundo portátil sin red, lector de pantalla. Lista completa de pendientes: [docs/GEOESPACIAL.md](docs/GEOESPACIAL.md).
