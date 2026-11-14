# SITE REGRET: contexto completo para transferencia

Equipo **QuemandoTokens**, NASA International Space Apps Challenge 2026, sede local Bilbao / 42 Urduliz Bizkaia. Reto: [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/). Este paquete transfiere archivos existentes y documentación de lectura; no desarrolla la web ni recalcula ciencia.

## Problema y propuesta

La disponibilidad geométrica de Sol y Tierra en el polo sur lunar depende de la fecha, el lugar, la altura y el relieve. El DEM es una representación finita y parcialmente interpolada. SITE REGRET pregunta: **¿se mantiene la elección entre dos lugares cuando cambiamos explícitamente nuestras hipótesis sobre el terreno?**

El recorrido previsto compara A/B y dos ventanas UTC, permite elevar un observador a 0/2/10 m, muestra horizonte y línea temporal de cinco estados, fija un criterio y enseña qué superficies mantienen, empatan o invierten el resultado. El REGRET expresa cuánto se pierde al conservar una elección frente a la alternativa en cada variante, en horas de la métrica elegida. Su diferencial propuesto es la decisión explicable bajo incertidumbre del relieve; ni calcular horizontes ni elevar un mástil son descubrimientos nuevos. No se afirma novedad mundial ni aptitud de misión.

## Lo que existe realmente

- Especificación funcional íntegra: los cinco documentos Markdown y tres PDF en `SITE_REGRET_V2/SITE_REGRET_V2/`.
- Investigación y descarga de fuentes oficiales: catálogos, manifiestos, hashes, manuales, artículo, etiquetas y evidencia de Resources en `RECOPILACION_DATOS_2026-11-14/`.
- Motor Python, configuración, resultados derivados, mapas y perfiles SVG, informe HTML y comprobaciones en `DERIVADOS_SITE_REGRET/`.
- `paquete_frontend.json` completo de 12.464.735 bytes: **120 escenarios**, 12 nominales, seis comparaciones A/B y cuatro criterios por comparación. No se ha reducido ni reserializado.
- 414 comprobaciones científicas almacenadas aprobadas y cero fallidas; ocho filas de contraste Horizons, ensayos de convergencia y contrato del consumidor. Estos resultados corresponden a la ejecución anterior: esta transferencia no los vuelve a ejecutar.

No existe todavía la aplicación web interactiva final, un repositorio integrado de producto, un despliegue o una prueba del producto completo en otro portátil sin conexión. El HTML de resultados es un informe estático. Los datos permiten construir un comparador estático con todas las combinaciones entregadas.

## Escenario científico entregado

A = Connecting Ridge, Site01, ROI 4; B = la misma región, ROI 6. Las coordenadas proceden de la tabla 2 de Barker 2021 y del archivo de ROI; se verificó pertenencia y cobertura. W1 = 14/11/2026 00:00Z a 14/12/2026 00:00Z; W2 = 14/12/2026 00:00Z a 13/01/2027 00:00Z. Cada ventana dura 720 horas; son ejemplos de desarrollo, no fechas oficiales de una misión.

Por sitio/ventana/altura hay diez superficies: nominal, cuatro hipótesis propias y cinco clones publicados. **2 × 2 × 3 × 10 = 120**. Las variantes propias comparten campo espacial entre A/B y los clones son superficies completas. El cuerpo visible es su centro geométrico, con SPICE DE421, `MOON_ME_DE421`, aberración `NONE` y paso de diez minutos.

El caso de demostración disponible es W2 a 0 m, criterio de minimizar la mayor racha sin Sol: A = 38 h 40 min, B = 14 h 40 min; gana B nominalmente. Mantiene la elección en 2/4 hipótesis propias, con un empate y una inversión; en los cinco clones, en 4/5. El peor regret de elegir B es 16,5 h en la familia propia y 528,6666666666666 h en el subconjunto publicado. Son resultados condicionados al modelo y a estas superficies, no probabilidades de misión. En los otros cinco pares ventana/altura hay empate nominal para este criterio. Consultar los otros objetivos sin extrapolar el ranking.

## Prioridades de producto

P0: comparador 2D, altura, ventanas disponibles, cinco estados, métricas, criterio previo, regret y frase determinista, pasaporte, URL reproducible, accesibilidad y entrega offline. P1: mapa de cresta de hasta 25 puntos realmente evaluados, ensemble ampliado, explicación, validación visible, exportaciones, ES/EN. P2: 3D coherente con el motor, hipótesis de energía, narración y sonido opcionales. La definición íntegra y los criterios de aceptación están en el plan maestro §§4 y 11; P0 completo sigue pendiente de integración web.

## Cómo resolver documentos de fechas distintas

1. Para interpretar datos existentes: `DERIVADOS_SITE_REGRET/CONTRATO_DATOS.md`, JSON, código y validaciones de esa entrega.
2. Para alcance deseado: plan maestro y atlas funcional V2, conservados sin cambios.
3. Para URLs, copias de proveedor y contexto inicial: manifiestos y dossier de la recopilación.
4. Esta carpeta explica el puente entre los anteriores; no modifica sus resultados.

Los documentos del 13/11 dicen «nada construido», contemplan cinco variantes, paso de 60 minutos y un contrato ilustrativo `1.0.0`. La entrega posterior usa `site-regret/0.1`, diez superficies y diez minutos. Algunos metadatos heredados del catálogo en el pasaporte aún contienen `NOT_RUN`/`NOT_IMPLEMENTED`; describen la fase de descarga, no anulan las validaciones posteriores. La web como producto sí sigue pendiente. Ver la relación de discrepancias en `ESTADO_ACTUAL_Y_PENDIENTES.md`.

El usuario declaró en el chat: **«Tenemos autorización para empezar ahora»**, respecto al comienzo anterior a las 09:00. El registro también figura en `configuration.user_start_authorization`; es una declaración del usuario conservada, no una carta de la organización incorporada al ZIP.

## Continuación

La otra IA debe diseñar la arquitectura y preparar tareas precisas para Claude Code, empezando por un frontend que consuma estas salidas estáticas. No necesita repetir investigación ni cálculos para esa integración. Ver `GUIA_PARA_CHATGPT.md`, `GUIA_INTEGRACION_WEB.md`, `MODELO_CIENTIFICO.md` y `FUENTES_Y_EVIDENCIAS.md`. Para regeneración completa sí habrá que restaurar los originales voluminosos omitidos, identificados uno por uno en el inventario.
