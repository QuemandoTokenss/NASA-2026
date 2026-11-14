# Historial de puntos de control

| PC | Fecha (+01:00) | Sesión | Qué quedó | HEAD |
|---|---|---|---|---|
| PC-00 | 2026-11-14 ~09:45 | Hugo · Claude Code | Web completa en `main` (PR #9 fusionado), issues #1–#13 preparados, zip del equipo | `987899d` |
| PC-01 | 2026-11-14 ~10:20 | Hugo · Claude Code | Registro de activos, originales PGDA78 verificados, recortes del DEM, geometría lunar, lector WMTS; 21 pruebas | `bdf6c2e` |
| PC-02 | 2026-11-14 ~10:35 | Hugo · Claude Code | Mapa georreferenciado en Explore con teselas reales de Moon Trek y capas numéricas | `2751a55` |
| PC-03 | 2026-11-14 ~10:48 | Hugo · Claude Code | Terreno 3D en Engineer con obstáculo, procedencia por capa, E2E geo (11/12 antes del último arreglo) | `54cda05` |
| PC-04 | 2026-11-14 10:55 | Hugo · Claude Code | Creado el sistema de relevo (`docs/continuidad/`, `CLAUDE.md`). Batería completa aún sin ejecutar | `54cda05` + documentos sin confirmar |
| PC-05 | 2026-11-14 ~11:05 | Hugo · Claude Code | Batería completa con 4 procesos: Vitest 89/89, E2E 54 PASS / 5 FAIL por tiempo | `54cda05` |
| PC-06 | 2026-11-14 11:20 | Hugo · Claude Code | E2E 59/59 con 2 procesos (fijado en la configuración); `web/docs/GEOESPACIAL.md` con inventario. Tarea activa: resto de documentación | commit de PC-06 |
| PC-07 | 2026-11-14 ~11:30 | Hugo · Claude Code | Rama subida a GitHub a petición de Hugo. Sin PR ni despliegue | `b4ced8b` + este apunte |
| PC-08 | 2026-11-14 11:45 | Hugo · Claude Code | G17 documentación terminada; megaprompt literal guardado | `62ca048` |
| PC-09 | 2026-11-14 12:10 | Hugo · Claude Code | G9: corregistro medido (rejilla verificada; mosaico NAC no concluyente). Tarea activa: G10 ODE | commit de PC-09 |
| PC-10 | 2026-11-14 12:40 | Hugo · Claude Code | G10: adaptador ODE REST + panel de productos y huellas en Explore. Batería completa pendiente de re-ejecutar | sin confirmar al escribir esto |
| PC-11 | 2026-11-14 13:00 | Hugo · Claude Code | Batería completa PASS (98 + 62). Panel ODE probado en vivo. LISTO_PARA_RELEVO a Asier; siguiente: G15 | commit de relevo (local, sin subir) |
| PC-12 | 2026-11-14 ~13:10 | Hugo · Claude Code | Commits de PC-08 a PC-11 subidos a GitHub a peticion de Hugo. Sin PR ni despliegue | `ae18165` + este apunte |
| PC-13 | 2026-11-14 | Hugo · Claude Code (Mission Control v2) | `main` = `6e41690` (PR #18). Rama `feat/mission-control-v2`. Bloque A/G15: 5 clones PGDA78 descargados y verificados, recortes + diferencias, Regret Lab con mapa de diferencia, Δ horizonte, obstáculo N/V, miniaturas y mapa de calor del regret. Vitest 108/108 | commit local de PC-13 |
| PC-14 | 2026-11-14 | Hugo · Claude Code (Mission Control v2) | Bloque B: Timeline con esquema orbital (direcciones SPICE del paquete en MOON_ME, no a escala) + cielo local; Vitest 112/112; E2E Timeline 5/5, axe/móvil/i18n 20/20. Siguiente: bloque C (Comparador) | commit local de PC-14 |
| PC-15 | 2026-11-14 | Hugo · Claude Code (Mission Control v2) | Bloque C: Comparador con mapa NAC del par, recortes DEM A/B a la misma escala, lecturas y Δ horizonte A − B. Bloque D: 3D protagonista en Engineer, malla del clon publicado. Vitest 113/113; E2E completo 69 + 1 omitida tras C; E2E Engineer 11/11 tras D. Siguiente: E | commit local de PC-15 |
| PC-16 | 2026-11-14 | Hugo · Claude Code (Mission Control v2) | Bloque E: Dashboard con mapa NAC real y Mission Control; Evidencia con fichas de clones; Historia con mapa real y diferencias de clones. Batería completa anotada en HANDOFF §7. Siguiente: revisión humana de la demo y bloque F | commit local de PC-16 |
| PC-17 | 2026-11-14 | Hugo · Claude Code (Mission Control v2) | Rama `feat/mission-control-v2` subida y PR #19 abierto contra `main` a petición de Hugo. Sin merge ni despliegue | `6dee90d` + este apunte |
| PC-18 | 2026-11-14 | Hugo · Claude Code | Demo interactiva «Where would you land?» en /historia/ (rama local `feat/historia-demo-interactiva`, sin push). Vitest 119/119; E2E 77 + 1 omitida | commit local de PC-18 |
| PC-19 | 2026-11-14 | Hugo · Claude Code | Timeline: mapa NASA Moon Trek en la ficha del sitio (sigue A/B, crédito, relieve DEM rotulado sin conexión). Engineer: torre en celosía, brújula, visual etiquetada y frase explicativa. Vitest 119/119; E2E 79 + 2 fallos por tiempo (pasan con 1 proceso) | rama `feat/timeline-engineer-visual`, commit local de PC-19 |
