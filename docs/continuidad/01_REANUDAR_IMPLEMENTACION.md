# SITE REGRET - REANUDAR LA IMPLEMENTACION REAL (HUGO -> ASIER)

Eres el siguiente agente de Claude Code/Fable para el proyecto SITE REGRET. Esto NO es un encargo nuevo ni un cierre: debes CONTINUAR el megaprompt original de 19 secciones, empezando por el estado real que dejo Hugo. No repitas el prototipo ni una auditoria general. No declares el trabajo completo simplemente porque el primer mapa y el terreno 3D funcionan.

## La referencia de trabajo

- Repositorio privado: `QuemandoTokenss/NASA-2026`.
- Rama de trabajo del relevo: `feat/geo-real-terrain`, no `main`.
- Ultimo commit remoto comprobado en esta auditoria: `2ca0a661cacfec24f1fc9aafa22ec41f3991dda6` (podria haber commits posteriores; compruebalo).
- Carpeta activa documentada por Hugo: `C:\Users\Hugo\Desktop\Hugo\Proyectos\NASA-SpaceApps-2026\NASA-2026`, aplicacion en `web/`.
- Copia antigua que NO debes usar: `...\NASA-SpaceApps-2026\site-regret\`.
- Documentos de continuidad: `docs/continuidad/HANDOFF.md`, `CONTINUAR.md`, `ENCARGO_VIGENTE.md`, `HISTORIAL.md`.
- Fuente normativa de alcance: `docs/continuidad/MEGAPROMPT_ORIGINAL.md` (si no existe, el usuario te entrega el archivo de esta carpeta: `MEGAPROMPT_ORIGINAL.md`; copia intacta verificada con SHA256 `1b19e4f8490b7f90723d96b84f58b9043077eb3fbdf59b5c4fb7ba3eed2e6f34`).

## Antes de modificar nada (solo lectura)

1. Asegurate de que el agente anterior y sus subagentes ya no estan escribiendo en esta copia.
2. Comprueba `git rev-parse --show-toplevel`, `git branch --show-current`, `git rev-parse HEAD`, `git status --short --branch` y `git log --oneline -8`.
3. Lee `AGENTS.md`, `CLAUDE.md`, el megaprompt LITERAL y los cuatro documentos de continuidad.
4. Si estas en el equipo de Hugo, NO reclones por sistema: abre la carpeta activa para conservar los 205 MB de originales NASA que son locales y no versionados. En un equipo distinto, clona y selecciona la rama remota. Los 12,8 MB de recortes derivados si estan versionados.
5. No cambies de rama ni ejecutes reset/clean/pull/merge/stash automaticamente. Si tu copia local esta detras del remoto o tiene cambios, explica el estado y usa una actualizacion no destructiva solamente cuando sea seguro y autorizado.
6. Reconcila el handoff con Git: PC-07 indica que la rama ya se SUBIO a GitHub y el commit `2ca0a66` lo confirma; corrige afirmaciones obsoletas como 'sin push', 'HEAD 4b77455' y 'G18 no hay push'. NO se ha abierto PR ni desplegado esta rama segun el ultimo relevo.

## Lo que YA existe (no reimplementes)

- Primera vista georreferenciada de Connecting Ridge con OpenLayers y teselas de Moon Trek (`web/src/components/maps/GeoMap.tsx`).
- Capas numericas PGDA78 (`surf`, conteos LOLA, pendiente, RMS vertical y RMS de pendiente), recortes verificados en `web/data/derived/terrain/` y `manifest.json`.
- Medidas y perfil, marcadores A/B y ROI.
- Terreno 3D Three.js (`web/src/components/terrain/`), con malla derivada del DEM y direccion/obstaculo del motor existente. Luz visual de escena NO es simulacion fisica de sombras.
- Evidencia geoespacial por capa.
- El relevo reporta Vitest 89/89, Playwright 59/59 y 1 omitida con 2 workers. Son resultados anteriores documentados; verifica al modificar.

## Lo que FALTA del megaprompt y NO debe darse por terminado

- G9: prueba cuantitativa de corregistro entre mosaico orbital, DEM, ROI y A/B con puntos de control, tolerancias y pruebas reales.
- G10: navegador ODE/PDS de Map Search, Data Sets, Product Sets, huellas de producto y paginacion documentada.
- G11: ortoimagen LROC NAC especifica para Connecting Ridge, identificador y footprint comprobados; solo como capa si georreferenciada.
- G12: nomenclatura IAU/USGS.
- G13: relieve PGDA90 regional en cartografia (ya utilizado en el horizonte cientifico precalculado, pero aun no integrado como capa regional del mapa). No descargar cientos de MB sin verificar disponibilidad, espacio y necesidad.
- G14: nuevo contraste SPICE/Horizons, si es necesario y compatible con fuentes y politicas; ya hay uno de referencia, no repetirlo sin valor.
- G15: Regret Lab conectado a superficies/diferencias y mapa con atribucion comprobable, sin causalidad imaginaria.
- G16: calculo de nuevos escenarios arbitrarios, NO prometido ni autorizado como un backend nuevo; tratarlos como fase futura dependiente de infraestructura.
- G17: terminar actualizacion de `web/README.md`, `web/QA_REPORT.md`, `web/DECISIONS.md`, `docs/VALIDATION.md`, `docs/STATUS.md`; reflejar pruebas reales y limites.
- G18: rama subida a GitHub, pero PR y despliegue siguen pendientes de autorizacion.

## Plan de ejecucion - no te detengas al terminar documentacion

1. En una pasada breve, termina G17: corrige docs para que nadie crea que el proyecto actual es el `main` anterior o que el megaprompt entero esta completado. Registra las pruebas observadas sin inventar cifras. Actualiza `HANDOFF.md` con PC-07 y la tarea siguiente.
2. Continua IMPLEMENTANDO, empezando por G9 (corregistro real, error/limites) y G10 (ODE/PDS) conforme al megaprompt. No te limites a un plan. En caso de que los servicios externos no permitan completar G10, crea un adaptador robusto, pruebas con respuestas reales identificadas y una UI que explique la indisponibilidad. Nunca inventes datos.
3. Si G9/G10 quedan verificados, pasa a G15 (Regret Lab geoespacial). Prioriza para la demostracion lo que sea seguro y reproducible por encima de ampliar regiones al azar.
4. Conserva motor `site-regret/0.1`, criterios de empate, UNKNOWN, coordenadas lunares, referencias NASA y sincronizacion del escenario. No uses datasets de otro sitio como si fueran Connecting Ridge.
5. Mantiene pruebas unitarias y E2E, escenarios sin red, datos y evidencias. Actualiza `HANDOFF.md` tras cada unidad pequena y redacta la siguiente accion de forma operativa.
6. NO hagas push, PR, merge ni despliegue salvo autorizacion humana expresa para esa accion. No hagas gastos, contratos, backups invasivos ni operaciones destructivas.

## Resultado que quiero VER, no solo que me CUENTES

- Codigo realmente implementado para la siguiente funcion pendiente que puedas terminar.
- Pruebas ejecutadas y resultados con comandos y fechas (distingue las reportadas anteriormente de las que ejecutaste tu).
- Captura de la interfaz real cuando sea viable, no mockup.
- Tabla de G0-G18: HECHO / IMPLEMENTADO SIN PRUEBA / PARCIAL / PENDIENTE / BLOQUEADO, enlazando archivos y pruebas.
- `HANDOFF.md` actualizado, especificando la siguiente accion exacta si hay un nuevo relevo.

**Empieza por leer los archivos y continuar la siguiente accion; NO respondas solo con un resumen o una promesa de trabajar.**
