# Guía de integración web sobre los datos existentes

Procedencia: `DERIVADOS_SITE_REGRET/CONTRATO_DATOS.md`, `paquete_frontend.json`, `datos/*.json`, código `motor/pipeline.py` y `motor/entregar_paquete.py`; alcance en el plan maestro §§2, 4, 8, 9 y 11 y el atlas funcional. Las recomendaciones Next.js de este documento son propuestas de integración, no código ya implementado ni una verificación de versiones actuales de bibliotecas.

## Entrada y arquitectura propuesta

Usar **Next.js/React con TypeScript** si ese es el stack del equipo. El plan original proponía React/Vite; es una decisión abierta, no una obligación científica. Mantener el cálculo Python separado de la presentación. Para el P0 con combinaciones fijas basta alojar archivos estáticos propios: no son necesarios base de datos, autenticación, llamadas NASA en vivo ni servidor de cálculo.

Copiar sin modificar `DERIVADOS_SITE_REGRET/paquete_frontend.json` a una ruta estática propia, por ejemplo `public/data/site-regret/paquete_frontend.json`; cargar una vez al entrar al explorador, gestionar carga/error y mantenerlo en memoria. Tiene unos 12,46 MB sin comprimir: no incrustarlo como literal en cada página ni duplicarlo en varias descargas. La compresión HTTP y una futura separación de carga son decisiones de implementación; si se separa, conservar cada dato y comprobar equivalencia contra el JSON original. No es preciso que el frontend descargue DEM, SPICE o el motor Python.

Conservar también `datos/pasaporte.json`, `CONTRATO_DATOS.md`, `RESUMEN.json`, las validaciones que se quieran mostrar y `figuras/`. `datos/contexto_2d.json` y `datos/eventos_acotados.json` son complementos **fuera del JSON raíz**. Las copias `datos/escenarios.json`, etc., permiten inspección y trazabilidad, pero no hace falta que el navegador cargue a la vez el agregado y sus duplicados.

Estado mínimo de interfaz propuesto: `windowId` W1/W2, `heightM` 0/2/10, `variant` de las diez opciones, `criterion` de cuatro opciones y `timeIndex` dentro de la ventana. Los sitios son A y B fijos. Para comparar ventanas, presentar ambas explícitamente en paneles separados. Seleccionar el criterio antes de revelar el ganador. Cambiar altura/ventana/variante es selección de resultados precalculados, no recálculo remoto.

## Relaciones y campos reales

`schema_version` es `site-regret/0.1`. Las claves raíz exactas son `configuration`, `state_names`, `sites`, `horizons`, `ephemerides`, `scenarios`, `comparisons`, `provenance`, además de esa versión. `sites` es array, `horizons` y `ephemerides` son objetos, `scenarios` y `comparisons` son arrays. Las claves de altura en objetos son cadenas: `"0"`, `"2"`, `"10"`.

Una fila de escenario se identifica por la tupla **`site_id, window_id, height_m, variant`**; no hay un campo `scenario_id` precalculado. Una comparación se busca por `window_id, height_m`; después por `criteria[criterion]`. Las `cases[variant]` comparan A/B usando la misma superficie y criterio. No asociar por posición casual de los arrays. Una clave interna de UI puede unir esa tupla, pero no llamarla hash científico canónico sin definirlo.

Ejemplo de selección, solo guía para el implementador:

```ts
const scenario = data.scenarios.find(s =>
  s.site_id === siteId && s.window_id === windowId &&
  s.height_m === heightM && s.variant === variant);
const comparison = data.comparisons.find(c =>
  c.window_id === windowId && c.height_m === heightM)?.criteria[criterion];
const horizon = data.horizons[siteId].variants[variant][String(heightM)];
const nominalSky = data.ephemerides[windowId].sites[siteId][String(heightM)];
```

## Tabla funcional y disponibilidad

| Funcionalidad prevista | Campos/archivos reales necesarios | Qué puede construirse ahora / trabajo adicional |
|---|---|---|
| Fichas A/B, mapa 2D | `sites[]`: `id`, `roi`, `x_m`, `y_m`, `longitude_east_deg`, `latitude_deg`, `nominal_height_m`, `values`; `datos/contexto_2d.json`, `figuras/mapa_sitios.svg` | Disponible para dos puntos; no es mapa mundial interactivo ni certificado de posado |
| Dos ventanas / fechas | `configuration.windows[]` y `ephemerides[W].window` | Selector W1/W2 disponible. Fechas arbitrarias necesitan nuevas efemérides, clasificación y métricas; un recorte cambia rachas y ranking y no debe conservar el resumen de la ventana completa |
| Mástil 0/2/10 m | `configuration.heights_m`, `scenarios[].height_m`, `horizons[S].variants[V][H]` | Tres alturas reales precalculadas; slider continuo o más alturas requieren cálculo adicional |
| Perfil topográfico | `horizons[S].azimuth_deg`, `.variants[V][H].elevation_deg`, `.distance_m`, `.source`, `.unknown` | Disponible en las diez superficies y tres alturas; interpolación periódica para visualizar |
| Curvas Sol/Tierra | `ephemerides[W].times_utc`, `.sites[S][H].bodies.SUN/EARTH.azimuth_deg`, `.elevation_deg`, `.range_km`, `.sun_horizon_deg`, `.earth_horizon_deg` | Disponibles para **nominal**. No hay curvas completas por clone en este agregado; no combinar cielo nominal y horizonte de clone para inventar sus estados |
| Calendario / timeline cinco estados | `scenarios[].state_codes`, `.intervals`, `state_names`, reloj `ephemerides[W].times_utc` | Disponible para los 120 escenarios; estados categóricos, nunca interpolados |
| Horas y rachas | `scenarios[].metrics.duration_hours`, `.known_hours`, `.unknown_hours`, `.sun_hours`, `.dte_center_hours`, `.joint_hours`, `.longest_dark_hours`, `.longest_no_earth_hours` | Disponible. Rachas recortadas a la ventana, sin extrapolar a duración física total |
| Tooltip de calendario | `intervals[].start`, `.stop`, `.state`, `.duration_minutes`, `.left_censored`, `.right_censored` | Disponible. Elevación/umbral instantáneo detallado solo nominal con las series presentes |
| Instantes de aparición/ocultación | `datos/eventos_acotados.json`: `site`, `window`, `height_m`, `target`, `event`, `earliest_utc`, `latest_utc` | Archivo complementario nominal; son intervalos de diez minutos, no instantes exactos |
| Elegir objetivo | `comparisons[].criteria.min_longest_dark_hours/max_sun_hours/max_dte_hours/max_joint_hours`: `metric`, `maximize_sign`, `tie_tolerance_hours` | Cuatro criterios separados disponibles. Pareto, pesos o nuevas reglas multicriterio no están entregados |
| Ganador y ventaja | `criteria[C].nominal_winner`, `.cases[V].winner`, `.utility_A`, `.utility_B`, `.D_hours` | Disponible; respetar `TIE`/`UNKNOWN`, sin decidir por redondeo visual |
| Gráfico REGRET | `criteria[C].cases[V].regret_A_hours`, `.regret_B_hours`, `.D_hours`, `.winner` | Disponible para diez superficies; unidades horas del criterio, sin mezclar objetivos |
| Robustez propia / publicada | `criteria[C].robustness.own_sensitivity/published_subset`: `generated_count`, `evaluated_count`, `same_winner_count`, `same_winner_fraction`, `ties`, `invalid_count`, `worst_regret_of_nominal_choice_hours` | Dos familias separadas disponibles; `null` = no aplicable si nominal empate, no 0 % |
| Frase explicativa | `criteria[C].summary_es`, `configuration` y metadatos del criterio | Plantilla española existente, sin LLM. Traducción fiel EN pendiente |
| Incertidumbre y controles X/semilla/sigma | `configuration.hypothesis_X_m`, `.seed`, `.gaussian_filter_sigma_m`; variantes en horizontes/escenarios | Visualizar parámetros existentes. Editarlos no crea nuevos resultados: requiere motor |
| Pasaporte / procedencia | `provenance`, `datos/pasaporte.json`, manifiestos y `00_LEER_PRIMERO/TRAZABILIDAD_ACTIVOS.json` | Panel y descarga posibles; etiquetas de catálogo históricas necesitan contexto, no alteración silenciosa |
| Validación visible | `provenance.validation`, `validacion/*.json`, `RESUMEN.json` | Disponible como evidencia; no certifica precisión del terreno ni producto completo |
| Compartir URL + hash | Tupla de selección + hash de bytes del paquete en `SHA256_TRANSFERENCIA.txt` | Diseñar URL/validación de selección en frontend. Hash canónico de escenario del plan aún no implementado |
| Export JSON/CSV/informe | `scenarios`, `comparisons`, `provenance` y originales completos | JSON ya disponible; funciones de exportación CSV/informe de una página de la web pendientes |
| Offline y accesibilidad | Datos estáticos auténticos + componentes web futuros | Pack de datos disponible; caché/app, teclado, foco, contraste, textos y prueba segundo portátil pendientes |
| EXPLAIN / glosario | Atlas, límites del contrato, perfiles y estados | Texto y diagrama 2D construibles con datos actuales; experiencia final pendiente |
| CREST MAP hasta 25 puntos | No hay array de candidatos con sus comparaciones | Requiere nuevos puntos verificados, horizontes y escenarios compartidos. No colorear áreas a partir de A/B |
| Ensemble ampliado / X configurable | Cinco clones publicados y cuatro variantes propias | Los 95 clones restantes y nuevas realizaciones requieren descarga/procesamiento; no hay percentiles calibrados |
| 3D, energía, RF, audio | El paquete no contiene malla 3D de aplicación ni modelo de energía/RF | P2. 3D fiel requiere datos/transformación adicionales; vatios y enlace real requieren otros modelos y entradas |
| Vídeo ≤30 s y submission | Guion conceptual en documento 04, cifras del paquete y futura app | Grabación auténtica, créditos y formulario aún pendientes |

## Tiempo, estados y unidades

Cada ventana tiene 4.321 muestras de reloj y 4.320 intervalos. `state_codes[i]` describe `[times_utc[i], times_utc[i+1])`. La muestra final no suma diez minutos. `state_names` ordena 0 `NEITHER`, 1 `SUN_ONLY`, 2 `EARTH_ONLY`, 3 `BOTH`, 4 `UNKNOWN`. Mostrar leyenda textual y patrón para desconocido, sin depender solo del color. No convertir `null` o estado 4 en oscuridad.

UTC se reconoce por `Z`; indicar explícitamente UTC. ET/TDB desde J2000 no es Unix. Horas para métricas, minutos para duración de intervalos, metros para posición/altura y kilómetros para distancias celestes. `nominal_height_m` es elevación del suelo sobre esfera de 1.737.400 m, mientras que `height_m` es altura del observador sobre ese suelo. Coordenadas lunares MOON_ME_DE421; no usar WGS84 ni Web Mercator terrestre.

Las series celestes incluidas son nominales. Los clones usan su elevación de suelo propia para el observador, por lo que los estados y métricas ya calculados son la referencia correcta para variantes. Si se muestra la curva nominal junto a otro perfil, rotularla como ilustración nominal y no usar ese cruce como validación de la variante; preferiblemente limitar ese gráfico al modo nominal.

## Calidad de interfaz a exigir a Claude Code

Validar versión, unicidad de tuplas, cardinalidades y estados; mostrar carga, JSON inválido, selección ausente y resultado desconocido. Mantener valores completos para decisiones; redondear solo etiquetas. El empate tiene tolerancia diez minutos, no igualdad de textos redondeados. Si hay horas desconocidas, evitar rankings que requieran cobertura completa. No traducir `READY_WITH_LIMITS` como «certificado».

Pruebas de integración necesarias: recorrer A/B × W1/W2 × 0/2/10 y las diez superficies; comprobar correspondencia visual con JSON, leyenda/censura, empate nominal, inversión real W2-0m y separación de familias; probar errores, teclado y cambio de controles. Verificar URL/restauración/exportación. Al existir la web, probar con red desconectada en otro portátil. No ejecutar el motor para probar componentes de presentación.
