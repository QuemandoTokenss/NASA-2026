# Contrato de datos · site-regret/0.1

El punto de entrada es `paquete_frontend.json`. Contiene todas las entradas calculadas que necesita la interfaz para los escenarios de esta entrega. Se puede servir como archivo estático propio; no necesita consultar NASA en cada interacción.

| Campo raíz | Contenido |
|---|---|
| `schema_version` | Identificador de esta estructura |
| `configuration` | Ventanas, alturas, pasos, marco, criterio y parámetros modelados |
| `state_names` | Código 0 NEITHER; 1 SUN_ONLY; 2 EARTH_ONLY; 3 BOTH; 4 UNKNOWN |
| `sites` | Puntos A/B y propiedades del archivo de origen |
| `horizons.A` / `.B` | Azimuts y horizontes de cada superficie a cada altura |
| `ephemerides.W1` / `.W2` | Reloj común y direcciones geométricas nominales |
| `scenarios` | Estados, intervalos y métricas de las 120 combinaciones |
| `comparisons` | Elección, utilidades y regret por ventana, altura y criterio |
| `provenance` | Fuentes, hashes, herramientas, método y limitaciones |

## Unidades y referencias

- Longitud en grados positivos al este, latitud sur negativa, marco **MOON_ME_DE421**.
- X/Y proyectados en metros, proyección estereográfica polar sur. No WGS84.
- `nominal_height_m`: altura sobre esfera de radio 1.737.400 m. `height_m` en un escenario: altura del mástil sobre el terreno, otra magnitud distinta.
- Azimut en grados desde norte hacia este. Elevación en grados sobre el plano horizontal radial local.
- Métricas en horas; duraciones de intervalos en minutos. Instantes terminados en `Z`: UTC.
- `et_tdb_seconds_j2000`: segundos ET/TDB desde J2000 usados por SPICE, no segundos Unix.

## Índices y extremos de ventana

Cada ventana tiene **4.321 instantes** y **4.320 intervalos**. La muestra i clasifica el intervalo `[times_utc[i], times_utc[i+1])`, de diez minutos. El último instante es un borde; no suma duración. Las matrices de efemérides y umbrales tienen 4.321 valores; `state_codes` tiene 4.320.

No interpolar estados como si fueran números continuos. `4` o `null` nunca significan sombra. Si aparecen desconocidos, conservarlos y no mostrar recomendaciones para métricas incompletas. Las rachas máximas se recortan a la ventana; los flags `left_censored` y `right_censored` indican que un intervalo toca un borde de consulta.

## Horizonte y variantes

`horizons[site].variants[variant][height]` contiene `elevation_deg`, `distance_m`, `source` y `unknown`, con 1.440 elementos. Los azimuts van de 0 a 359,75°. La interpolación es periódica entre el último y el primero.

`source`: 0 relieve local de 5 m; 1 regional de 80 m; 2 apoyo de 240 m. `distance_m` es la distancia de arco al obstáculo que fija el máximo muestreado. El análisis termina a 400 km y aplica una comprobación condicional para el terreno más lejano, documentada en el pasaporte.

Variantes: `nominal`; `bias_plus`, `bias_minus`, `correlated_plus`, `correlated_minus`; `published_0001` a `published_0005`. Las cuatro primeras perturbaciones son hipótesis propias, no errores NASA medidos. Las últimas son cinco DEM completos publicados; no se suman al nominal. Se usa la misma superficie para ambos sitios. En los clones publicados se coloca el mástil sobre la elevación del clone en el punto; en las perturbaciones propias se mantienen anclados ambos sitios al terreno nominal.

`ephemerides` incluye las direcciones de la superficie nominal. Las métricas de cada clone se calcularon con su posición de observador correspondiente; no combinar la curva nominal con otro horizonte para inventar su métrica. Los estados y métricas de `scenarios` son la salida autorizada del motor para cada variante.

## Comparación y REGRET

El criterio principal minimiza `longest_dark_hours`. También se incluyen criterios de maximizar Sol, Tierra e intersección. La tolerancia de empate es diez minutos, aplicada con valores completos.

Con utilidad orientada a maximizar: `D=U_A-U_B`; `regret_A=max(U_A,U_B)-U_A`, y análogo para B. El regret es no negativo y tiene unidades de horas de la métrica elegida; no agregar objetivos distintos.

Las fracciones de conservación excluyen el nominal del denominador. Se presentan por separado las cuatro perturbaciones propias y los cinco clones. Los empates no cuentan como conservación inequívoca. Si el nominal es empate, esa fracción es `null` y se explica como no aplicable. Ninguna fracción es probabilidad de éxito de misión.

## Estado de producto

`READY_WITH_LIMITS` indica que el escenario se calculó bajo el modelo documentado, no que se certificara su realidad física. Hay visibilidad del centro geométrico del Sol/Tierra respecto al relieve: no fracción de disco, eclipses, vatios ni enlace de radio garantizado. Los eventos se entregan como intervalos de cruce de diez minutos, no tiempos exactos.
