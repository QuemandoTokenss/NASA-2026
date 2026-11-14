# Encargo vigente

> **Falta el texto literal.** El megaprompt «SITE REGRET: cartografía lunar real, terreno científico y geometría trazable» (19 secciones, fechado 14-11-2026) se pegó en el chat de Hugo y **no está guardado como archivo**. Lo que sigue es un resumen fiel por secciones hecho por la IA. **Hugo: guarda el original como `docs/continuidad/MEGAPROMPT_ORIGINAL.md`**; si hay discrepancia, manda el original. El megaprompt citaba además `fuentes_nasa.json` y un «verificador adjunto» que nunca han estado en este equipo.

## A. Instrucciones del usuario (por orden)

1. **Misión inicial** (mensajes 1–2 de Hugo): web completa de SITE REGRET con el paquete `site-regret/0.1`. Hecho y fusionado en `main` (`987899d`). Reglas científicas: ver `AGENTS.md` y `docs/TRABAJO_REALIZADO.md` §4.
2. **Megaprompt geoespacial** (encargo activo). Resumen:
   - **§1 Misión**: implementar, no listar ideas. Mapa real → sitio → elevación → Sol/Tierra → obstáculo que limita la visión → comparación → robustez → evidencia original. Ningún paisaje, textura o resultado inventado como dato lunar. Sin prometer certificación NASA ni seguridad de alunizaje.
   - **§2 Estado encontrado**: conservar lo correcto (paquete, hashes, contrato, estado global, A = ROI 4 y B = ROI 6); `ContextMap`/`SiteThumb` son derivaciones del DEM (no IA, no foto); `MastScene` es un esquema y es objetivo prioritario de sustitución por terreno del DEM.
   - **§3 Autenticidad**: inventariar todos los assets y clasificarlos en 6 clases (observación instrumental, producto publicado, derivado SITE REGRET, escenario hipotético, ilustración, origen desconocido). Prohibidos: ruido/Perlin, texturas IA, superresolución generativa, valores aleatorios.
   - **§4 Primera entrega vertical obligatoria (Connecting Ridge)**: A mapa georreferenciado (no iframe); B fondo orbital real + DEM Site01 numérico; C marcadores A/B por coordenadas; D capas elevación/pendiente/conteo LOLA/incertidumbre que cambian datos y leyenda; E clic → coordenadas, elevación, fuente, resolución, calidad, cobertura; F Engineer con terreno del mismo sitio en alturas métricas; G Timeline y resultados de referencia sin alterar; H Evidence con procedencia exacta.
   - **§5 Registro de activos** con ID, organismo, instrumento, URLs, CRS, referencia vertical, unidades, nodata, resolución, fechas (adquisición ≠ procesamiento ≠ descarga; `null` si no se publica), estado y checksum completo. Adaptadores: Moon Trek, PDS/ODE, LOLA, PGDA, LROC, NAIF, Horizons, IAU/USGS.
   - **§6 Moon Trek**: WMTS desde GetCapabilities; `EPSG::0` no autoriza a asumir WGS84/Web Mercator; OpenLayers recomendado; LayerManager; capa visual ≠ capa analítica; estados cargando/disponible/fuera de cobertura/no disponible/respuesta inválida; sin proxies públicos.
   - **§7 ODE**: búsqueda por región, huellas, tipos de producto y paginación con el REST documentado; sin scraping.
   - **§8 DEM**: rehidratar originales de Site01 y verificarlos enteros (SHA-256, firma TIFF); 5 m de rejilla ≠ 5 m de error; LDEC = 0 no es elevación cero; conservar el contexto regional 80/240 m; clones son DEM completos, no incrementos.
   - **§9 Imágenes y nomenclatura**: ortoimágenes con huella comprobada; sin estirar previews; las sombras de una foto son las de su adquisición; nombres IAU/USGS; ROI ≠ sitio aprobado.
   - **§10 Mediciones**: radio y proyección lunares; distinguir distancia en esfera, euclídea 3D y sobre el DEM; regla, perfil, lectura bajo cursor accesible por teclado; nodata como huecos.
   - **§11 Engineer 3D**: malla del DEM; exageración desde 1×, solo visual; alturas 0/2/10 m; direcciones reales de Sol/Tierra; función «qué tapa el Sol o la Tierra» con distancia, ángulo y producto, enlazada a mapa y perfil; la sombra de la GPU no es el motor.
   - **§12 Sol/Tierra**: preservar SPICE DE421 / MOON_ME_DE421 / NONE; Horizons solo para contraste fuera de la interfaz, de una en una.
   - **§13 Timeline, Comparador, Regret Lab**: mismo escenario en todas las vistas; conservar UNKNOWN, censura, empates y separación de familias; conectar Regret Lab al mapa solo con atribuciones calculadas.
   - **§14 Estado y arquitectura**: distinguir caso de referencia / exploración cartográfica / escenario calculado nuevo; mover un marcador no reutiliza métricas; sin servidor nuevo ni costes sin autorización.
   - **§15 Evidence**: procedencia desde cada capa, píxel, perfil y resultado.
   - **§16 Pruebas T1–T13**: autenticidad, WMTS, ODE, DEM, corregistro, metrología, 3D, geometría, regresión, interacción, fallos, offline, experiencia.
   - **§17 Fases 0–5** y disciplina: cambios revisables; **no publicar en producción, no borrar assets, no contratar infraestructura sin autorización**.
   - **§18 Entregable**: tabla función/archivos/fuente/prueba/resultado/limitación, capturas reales, distinguir probado / implementado sin prueba / pendiente.
3. **Rama**: Hugo eligió trabajar en una rama nueva `feat/geo-real-terrain` (respuesta a la tarjeta de la app).
4. **Protocolo de relevo** (este directorio): mantener `HANDOFF.md`, `ENCARGO_VIGENTE.md`, `CONTINUAR.md`, `HISTORIAL.md`; puntos de control pequeños; **sin commits ni push automáticos por el relevo**, sin `reset --hard`, `clean`, `pull`, `merge`, `stash` ni cambio de rama; sin secretos en los documentos; al recibir `CIERRA_RELEVO`, no empezar nada nuevo y dejar el estado por escrito. Próximo relevo previsto: Asier Comba.

5. **«Mission Control v2» — continuación y transformación de todas las secciones** (encargo ACTIVO desde el 14-11-2026, tras fusionar el PR #18 en `main` = `6e41690`). Resumen fiel:
   - Problema: Explore mejoró mucho, pero Timeline, Comparador, Regret Lab, Dashboard y otras secciones se parecen demasiado a la versión anterior. No reiniciar el proyecto.
   - Principio: MAPA REAL → TERRENO REAL → SOL/TIERRA → COMPARACIÓN → INCERTIDUMBRE → EVIDENCIA, con sitio A/B, ventana, altura, superficie y criterio sincronizados. Prohibido presentar imágenes IA, mapas o relieves inventados o valores simulados como observaciones NASA. Conservar los 120 escenarios; no recalcular métricas en la interfaz.
   - Prioridades: **A** Regret Lab (G15: clones PGDA78 reales comprobados antes de descargar, capas de diferencia con unidades/leyendas/procedencia, enlace al mapa, sin causalidad no calculada, interfaz de laboratorio analítico); **B** Timeline orbital con efemérides reales (distinguir esquema no a escala, geometría del observador y visibilidad respecto al horizonte); **C** Comparador A/B con cartografía real y conclusión dependiente del criterio; **D** Engineer con el 3D del DEM como protagonista y alturas 0/2/10 m; **E** Dashboard como Mission Control, Evidence consultable desde otras vistas, Historia actualizada; **F** pendientes científicos (G9, G11, G10, G12, G13, validaciones). No construir cálculo de escenarios arbitrarios sin arquitectura y autorización.
   - Método: un bloque cada vez (inspeccionar → cambio comprobable → implementar → pruebas → revisión visual → documentos de continuidad → siguiente). Un test que pasa no implica buena experiencia visual.
   - Relevo: actualizar `HANDOFF.md` tras cada cambio significativo y `CONTINUAR.md`; no detenerse tras documentar.
   - Rama: `feat/mission-control-v2` desde `main` limpio.
   - Criterios de fin: Explore sigue funcionando; Regret Lab conectado a superficies reales; Timeline transformado con visualización física respaldada por datos; Comparador con cartografía real; Engineer con 3D protagonista; Dashboard, Historia y Evidence integrados; pruebas en verde; demo completa revisada por el equipo; límites declarados.

## B. Autorizaciones vigentes

- Commits locales en la rama de trabajo: Hugo los pidió en la misión inicial («commit local tras cada fase»). El protocolo de relevo pide no hacerlos *automáticamente por el relevo*: seleccionar archivos explícitos y revisar antes.
- Push y PR de `feat/mission-control-v2`: **autorizados por Hugo** el 14-11-2026 (PR #19). Merge: lo decide el integrador del equipo.
- Merge y despliegue: **no autorizados** (el encargo vigente lo prohíbe sin autorización expresa).
- Descarga de los 5 clones PGDA78 (≈205 MB): autorizada por el encargo vigente tras comprobar metadatos, hashes, tamaño y espacio; hecha en PC-13.

## C. Propuestas de la IA (no son instrucciones del usuario)

- Tabla de tareas G0–G18 de `HANDOFF.md`.
- Versionar los recortes derivados (12,8 MB) en `web/data/derived/terrain/` y dejar los originales fuera de Git.
- PC-13: versionar también los 5 recortes de clones (12,8 MB más, `clones/`) para que las pruebas y la app funcionen sin los originales.
- Interceptar Moon Trek en las pruebas E2E con respuestas reales grabadas, y una prueba opcional en vivo (`E2E_LIVE_TREK=1`).
