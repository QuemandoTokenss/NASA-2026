# Estado actual y pendientes

Este estado se basa en los archivos inspeccionados para la transferencia. No declara aprobados gates organizativos, PR fusionadas o pruebas humanas que no tengan evidencia.

## Completado y transferido

- Especificación y guion conceptual originales completos.
- Catálogos de fuentes, URLs, versiones, metadatos, manifiestos de descarga y hashes. Evidencias locales del reto/Resources/Bilbao y documentación NASA conservada.
- Selección de A/B verificada sobre ROI/DEM; diez superficies por sitio, dos ventanas, tres alturas, 120 escenarios, seis comparaciones con cuatro criterios.
- Motor científico, dependencias fijadas, configuración, horizonte/efemérides/estados/métricas/regret y pasaporte de la ejecución existente.
- Informe HTML y figuras SVG, 414 comprobaciones guardadas aprobadas, contraste con ocho filas Horizons, convergencia y contrato consumidor.
- JSON frontend completo y copias desglosadas. No se han ejecutado nuevos cálculos en esta transferencia.

## Parcialmente realizado

| Elemento | Existe | Falta |
|---|---|---|
| P0 científico | Datos y motor para combinaciones fijas | Integración UI y aceptación conjunta; no declarar P0-E2E verde |
| Fechas y alturas | W1/W2 y 0/2/10 m | Flujo para fechas/puntos/alturas arbitrarios y su nuevo cálculo |
| Sensibilidad | ±1 m, campo correlacionado y cinco clones | Control X/semilla/sigma real y ensemble ampliado si se decide |
| Offline | Pack de datos y reporte estático | Aplicación cacheada/portable y ensayo en segundo equipo sin red |
| Trazabilidad | Pasaporte, hashes de fuentes y motor | ID canónico/URL de escenario implementados; revisión de etiquetas históricas en la presentación |
| Validación | Resultados numéricos y referencias guardadas | Ensayos de producto, accesibilidad, otro navegador/portátil, repetición científica independiente si se requiere |
| Diseño | Recorrido, diagramas Mermaid y especificaciones | Mockups visuales de producto y diseño UI final |

## No existe en las carpetas inspeccionadas

Aplicación Next.js/React final, API de producto, despliegue, repositorio de web integrado, 3D final, mapa de cresta calculado para hasta 25 puntos, modelo de energía/RF, grabación auténtica de demo, envío del formulario y pruebas de uso del producto completo. No se han encontrado archivos de mockup/wireframe dedicados: se conservan diagramas conceptuales Mermaid en Markdown y los PDF originales. Los SVG y el HTML de derivados son evidencia de resultados, no capturas de una aplicación implementada.

## Discrepancias históricas y cómo leerlas

| Archivo/afirmación | Evidencia posterior / estado real |
|---|---|
| V2: «CONCEPTO Y ESPECIFICACIÓN; NADA CONSTRUIDO» | Correcto para su edición anterior. Ahora existe ciencia derivada; la aplicación final sigue pendiente |
| V2: no comenzar antes de 09:00 | El usuario declaró autorización de la organización para comenzar ahora; configuración y contexto registran esa declaración. No se adjunta prueba escrita externa |
| V2 `RESOURCE_TAB_UNVERIFIED` | La recopilación incorpora captura y texto de Resources; el motor posterior utilizó Horizons efectivamente. No atribuir pertenencia a Resources a todos los assets PGDA |
| Dossier de recopilación: puntos, SPICE y Horizons pendientes | Después se ejecutaron y se guardan en DERIVADOS; leer `qa_entradas`, `contraste_horizons`, pasaporte y pruebas |
| `manifest_integrado.json` y algunos `provenance.source_assets`: `NOT_RUN`, `NOT_IMPLEMENTED`, «pendiente» | Etiquetas históricas heredadas de descarga. La validación de ejecución está en `provenance.validation`; la aplicación interactiva sigue sin implementarse |
| Manifiesto inicial: 56 archivos, 792.869.066 bytes | Instantánea de descarga inicial. Se añadió después `LDEM_60S_240MPP_ADJ.TIF` de 218.961.039 bytes; figura en documentación suplementaria y pasaporte. No interpretar 793 MB como volumen actual exhaustivo |
| V2: cinco superficies, 60 min, 360 bins, contrato ilustrativo `1.0.0` | Ejecución actual: diez superficies, diez min, 1.440 azimuts y `site-regret/0.1`; usar contrato real |
| V2 `scenario_id`, `algorithm_git_sha`, URL canónica, frase EN | Son requisitos propuestos; no están todos materializados. Existe `engine_sha256`, tuplas de selección y frase ES |
| V2: fechas seleccionables, X elegible | Paquete actual fija ventanas y X=1 m. No presentar controles continuos como resultados ya disponibles |
| Plan: stack React/Vite | Esta petición solicita guía Next.js/React. Ambas son opciones; no existe migración porque no hay web final |
| Ensayo temporal: diferencia máxima 5 min | No equivale a error total de 5 min: también hay diferencias espaciales y error epistémico; la mejora espacial previa cambió hasta 50 min una métrica |
| Ensayos / resolución inicial | Son historia de convergencia. Los resultados que debe mostrar la UI están en `paquete_frontend.json` vigente |
| Documentos de reproducción mencionan ejecutar scripts | Hacerlo solo si se quiere regenerar ciencia y se restauran originales. Este ZIP es suficiente para UI pero no contiene todos los DEM necesarios para regeneración offline |

No se han alterado originales para reconciliar esos estados. Tampoco se ha auditado de nuevo el reglamento o disponibilidad online del evento durante esta operación; se transfieren evidencias locales de la investigación realizada.

## Orden de trabajo recomendado para arquitectura y Claude Code

1. Acordar stack y alcance P0 con combinaciones estáticas; leer contrato real y diseñar tipos/adaptadores.
2. Diseñar comparador 2D con criterio previo, W1/W2, tres alturas, cinco estados y perfiles nominales.
3. Incorporar las diez superficies y separar familias de sensibilidad; regret, empates, desconocidos, frase ES y pasaporte.
4. Implementar URL reproducible/exportación, accesibilidad y errores sin depender de APIs externas.
5. Verificar concordancia UI/JSON y offline en otro portátil; solo después declarar P0 completo y valorar P1/P2.
6. Preparar grabación auténtica, fuentes y submission. Publicación y decisiones del equipo no se han efectuado en esta transferencia.
