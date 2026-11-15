# Auditoría científica · alturas 0 / 2 / 10 m y discontinuidad 0 → 0,5 m

**Fecha:** 2026-11-15 · **Rama:** `fix/regret-lab-height-audit` (desde `origin/main` = `f395794`, producción) · **Autor:** Claude Code (integrador IA), para revisión humana.

## 1. Diagnóstico en una frase

**No hay error en el motor.** Los ceros a 2 y 10 m son defendibles con el modelo usado; lo frágil es el resultado **a 0 m**, donde la sombra de W2 la producen microrrelieves de 3 a 30 cm situados a 25–31 m del punto, por debajo del error vertical del DEM (0,27–0,30 m). Se conservan todos los datos del contrato; se añade una auditoría reproducible y la interfaz lo explica.

## 2. Problema reportado

Regret Lab, W2 (14-12-2026 → 13-01-2027), A = ROI 4, B = ROI 6, criterio `min_longest_dark_hours`, superficie nominal:

| Altura | Racha sin Sol A | Racha sin Sol B | Resultado del motor |
|---|---|---|---|
| 0 m | 38 h 40 min | 14 h 40 min | Gana B |
| 2 m | 0 h | 0 h | Empate |
| 10 m | 0 h | 0 h | Empate |

En el paquete de alturas de Engineer (paso 0,5 m) ya a 0,5 m ambos sitios tienen 720 h de Sol de 720.

## 3. Datos y archivos implicados

| Elemento | Archivo | Uso |
|---|---|---|
| Motor original (solo lectura, SHA-256 `08e52de1…2a54`) | `web/data/source/DERIVADOS_SITE_REGRET/motor/pipeline.py` | `sample`, `radial_grids`, `rays`, `elevation_terrain`, `horizon`, `direction`, `classify`, `compare` |
| DEM local 5 m | `PGDA78_Site01/Site01_final_adj_5mpp_surf.tif` (+ `toterr`, `slp`, `slperr`) | campo próximo hasta ~24 km |
| DEM regional 80 / 240 m | `PGDA90_contexto/LDEM_80S_80MPP_ADJ.TIF`, `LDEM_60S_240MPP_ADJ.TIF` | horizonte lejano hasta 400 km |
| Efemérides | NAIF DE421 + `MOON_ME_DE421`, sin aberración | Sol y Tierra |
| Paquete de alturas | `web/data/derived/engineer-heights/v1/` | mismo motor, 0–30 m cada 0,5 m |
| **Auditoría nueva** | `web/scripts/engine/height_audit.py` → `web/data/derived/height-audit/v1/audit.json` y `summary.json` | experimentos de este documento |

Los originales están en `web/data/raw/motor/` (fuera de Git) con hashes comprobados contra `datos/pasaporte.json`. Reproducir (≈3 min):

```bash
web/data/raw/motor-venv/Scripts/python -I web/scripts/engine/height_audit.py
```

## 4. Cómo calcula el motor (lo comprobado)

- **Altura del observador** (`horizon`, `direction`): `obs = sample(DEM, sitio) + height_m`. `height_m` es altura **sobre el terreno**, no cota absoluta. La cota del suelo es la interpolación bilineal en el sitio: A 1956,391 m, B 1948,351 m (sobre la esfera de 1 737 400 m).
- **Posición del sitio:** las coordenadas de los ROI (`x_m`, `y_m`) caen exactamente en la esquina de 4 píxeles (desplazamiento fraccional 0,0/0,0 en la convención de centros de `sample`): el suelo del observador es la media de 4 centros de píxel.
- **Rayos:** círculos máximos desde el sitio (`rays`), muestreo radial local desde **2,5 m** cada 1,25 m (factor 2) hasta 500 m, luego 2,5 m y 5 m; regional cada 20/60 m hasta 400 km.
- **Elevación** (`elevation_terrain`): ángulo del punto del terreno visto desde el observador sobre una esfera, con la resta estable `(z−z_obs) − (R+z)·2 sin²(θ/2)`.
- **Clasificación** (`classify`): Sol visible si su **centro** está estrictamente por encima del horizonte interpolado en azimut; paso de 10 min, 4 320 intervalos; los desconocidos rompen rachas.

## 5. Hipótesis examinadas y experimentos

| # | Hipótesis | Experimento | Resultado | Veredicto |
|---|---|---|---|---|
| H1 | La fórmula de elevación o la proyección estereográfica están mal | Vectores cartesianos 3D independientes (`(R+z)·û` del punto proyectado, `(R+z_obs+h)·û_obs`, ángulo con el eje local) en 8 azimuts × 60 distancias | Diferencia máx. **4,7·10⁻⁹°** (A) y **4,3·10⁻⁹°** (B) | **Descartada** |
| H2 | `height_m` se aplica como cota absoluta | Lectura del código + barrido | Se suma a la cota del terreno en el sitio, igual en horizonte y en efemérides | **Descartada** |
| H3 | Precisión numérica (el motor interpola en float32) | Mismo bilineal con salida float64 | Geometría ≤ 1·10⁻⁶°; métricas idénticas salvo B·W2·0 m: 14 h 40 min → 14 h 30 min (un intervalo) | **Efecto real pero despreciable**; no se corrige (cambiaría el contrato firmado) |
| H4 | El obstáculo de 0 m es un artefacto de la interpolación subpíxel | Vecino más próximo, bilineal (motor), B-spline cúbica | W2·0 m racha A: 121 h 20 min / 38 h 40 min / 40 h 10 min; B: 28 h 30 min / 14 h 40 min / 23 h 20 min | **Sensibilidad confirmada a 0 m**; a ≥ 0,5 m las tres dan 0 h |
| H5 | El obstáculo depende de muestrear a 2,5 m (dentro del píxel) | Distancia mínima del rayo 5 m y 10 m | Mismas rachas que el motor (38 h 40 min / 14 h 40 min) | **Descartada**: el obstáculo no está en el primer píxel |
| H6 | El resultado depende de la posición exacta del observador | Desplazamientos ±1,25 y ±2,5 m en E/N (8 pruebas) | A: 33 h 50 min – 54 h 10 min; B: **0 h – 26 h 10 min** | **Sensibilidad confirmada a 0 m**; a 0,5 y 2 m siempre 0 h |
| H7 | El salto 0 → 0,5 m es físicamente incoherente | Barrido 0 / 0,1 / 0,25 / 0,5 / 1 / 2 / 5 / 10 m e instantes críticos | Coherente con la geometría: subir 0,5 m baja ~0,9° un obstáculo a 31 m; el déficit era 0,23° | **Descartada** (ver §6) |

### 5.1 Barrido de altura (W2, terreno nominal, muestreo del motor)

| Altura | A: racha sin Sol | A: horas con Sol | A: con Tierra | B: racha sin Sol | B: horas con Sol | B: con Tierra | Direcciones con obstáculo ≤ 50 m (A / B, de 1 440) |
|---|---|---|---|---|---|---|---|
| 0 m | 38 h 40 min | 681 h 20 min | 377 h 50 min | 14 h 40 min | 705 h 20 min | 371 h 50 min | 1 302 / 1 429 |
| 0,1 m | 7 h 20 min | 712 h 40 min | 389 h 30 min | 0 h | 720 h | 396 h 50 min | 1 154 / 1 302 |
| 0,25 m | 0 h | 720 h | 397 h 20 min | 0 h | 720 h | 398 h | 845 / 921 |
| 0,5 m | 0 h | 720 h | 398 h 40 min | 0 h | 720 h | 398 h | 510 / 650 |
| 1 m | 0 h | 720 h | 398 h 40 min | 0 h | 720 h | 398 h | 198 / 270 |
| 2 m | 0 h | 720 h | 398 h 40 min | 0 h | 720 h | 398 h | 0 / 0 |
| 5 m | 0 h | 720 h | 398 h 40 min | 0 h | 720 h | 398 h 10 min | 0 / 0 |
| 10 m | 0 h | 720 h | 399 h | 0 h | 720 h | 398 h 10 min | 0 / 0 |

A 0, 2 y 10 m el barrido reproduce exactamente el contrato (prueba `tests/height-audit.test.ts`). 0,1 y 0,25 m son **diagnóstico**, no escenarios oficiales.

### 5.2 Instantes críticos (W2, 0 m)

| Sitio | Racha | Instante más profundo (UTC) | Sol az / el | Horizonte | Sol − horizonte | Obstáculo | Horizonte en esa dirección a 0,1 / 0,25 / 0,5 / 1 / 2 m |
|---|---|---|---|---|---|---|---|
| A | 2027-01-05 03:30 → 01-06 18:10 (38 h 40 min) | 2027-01-06 07:10 | 335,74° / 1,432° | 1,663° | **−0,231°** | 31,25 m, DEM 5 m | 1,471 / 1,196 / 0,740 / 0,206 / −0,287° |
| B | 2026-12-30 10:00 → 12-31 00:40 (14 h 40 min) | 2026-12-30 12:00 | 58,74° / 1,313° | 1,392° | **−0,079°** | 25 m, DEM 5 m | 1,162 / 0,819 / 0,247 / −0,897 / −1,503° |

Altura equivalente del obstáculo por encima de la línea del Sol: **0,13 m (A)** y **0,03 m (B)**. El error vertical publicado del DEM (`toterr`) en los sitios es **0,27 m (A)** y **0,30 m (B)**; la pendiente `slp` es 1,17° ± 2,45° (A) y 0,95° ± 2,13° (B).

### 5.3 Margen solar a 2 y 10 m

Margen mínimo del centro del Sol sobre el horizonte del modelo en toda la ventana:

| | A W1 | A W2 | B W1 | B W2 |
|---|---|---|---|---|
| 0 m | 0,28° | −0,23° | 0,35° | −0,08° |
| 0,5 m | 1,12° | 0,60° | 1,27° | 0,78° |
| 2 m | 1,86° | 1,37° (obstáculo a 418 m) | 1,39° | 0,90° (obstáculo a 698 m) |
| 10 m | 1,90° | 1,62° (relieve a 134 km, 80 m) | 1,90° | 1,46° |

A 2 m, en W2, un obstáculo tendría que estar **~10–11 m** más alto en el DEM para tapar el Sol; el error vertical del DEM local es de décimas de metro. Además, el margen supera el radio aparente del Sol (≈ 0,27°): el disco entero queda visible.

## 6. Por qué aparece la discontinuidad 0 → 0,5 m

1. Los dos sitios están sobre Connecting Ridge, una cresta elevada: a partir de ~0,5 m el horizonte **lejano** queda por debajo del Sol (que en W2 está a 0,65°–1,52° de elevación) en todas las direcciones relevantes.
2. A 0 m el ojo está *en* la superficie: cualquier ondulación del DEM a pocas decenas de metros que suba más que la elevación solar (≈ 1,3–1,4° en los instantes críticos) tapa el Sol. A 31 m, 1,66° equivale a ~0,9 m de subida.
3. Subir el observador `h` baja el ángulo de un obstáculo a distancia `d` en ≈ `atan(h/d)`: 0,5 m a 31 m son 0,92°, cuatro veces el déficit de A (0,23°) y doce el de B (0,08°). Por eso la transición ocurre ya entre 0,1 y 0,25 m (A) y antes de 0,1 m (B).

Es el comportamiento esperado del modelo geométrico, no un error numérico.

## 7. Contraste con la literatura (sin equiparar cifras)

Los estudios de iluminación del polo sur con topografía LOLA (Mazarico et al., 2011, *Icarus*; Gläser et al., 2014 y 2018; Barker et al., 2021, *Planetary and Space Science*, que publica los DEM de sitios PGDA78 y sus clones de error) describen la zona de Connecting Ridge como una de las mejor iluminadas y muestran que la iluminación crece con la altura sobre el suelo. Sus cifras usan otras coordenadas, épocas, periodos, definiciones (disco parcial, fracción de tiempo anual) y alturas, así que **no se comparan como equivalentes**. Solo se afirma que una racha de un mes sin oscuridad a 2–10 m en una cresta de esa zona es físicamente plausible.

`site-regret/0.1` y el paquete de Engineer comparten el motor: su igualdad en 0/2/10 m **no** es validación independiente. Lo independiente aquí es: la comprobación cartesiana (H1), los métodos de interpolación alternativos (H4) y el contraste de efemérides con JPL Horizons ya incluido en el paquete original (`validacion/contraste_horizons.json`).

## 8. Conclusiones defendibles con un DEM de 5 m

| Afirmación | ¿Defendible? | Motivo |
|---|---|---|
| A 2 y 10 m no se detecta oscuridad en W1 ni W2 (las 10 superficies) | **Sí**, como resultado del modelo | Margen ≥ 0,90° (2 m) y ≥ 1,46° (10 m); estable con 14 configuraciones de muestreo a 2 m; igual en las 4 hipótesis propias y los 5 clones publicados |
| A 2 y 10 m gana A por visibilidad terrestre (40–50 min) | **Sí, con prudencia** | Gana A en las 10 superficies; la diferencia supera la tolerancia de 10 min pero es pequeña frente a 720 h |
| A 0 m (W2) B tiene una racha sin Sol menor que A | **Sí, cualitativamente** | B < A en las 14 configuraciones de la auditoría |
| A 0 m las cifras «38 h 40 min» y «14 h 40 min» | **No como valores precisos** | Varían 33 h 50 min – 54 h 10 min (A) y 0 h – 26 h 10 min (B) con desplazamientos de ±2,5 m; obstáculo por debajo del error del DEM |
| «Iluminación permanente» o «sitio seguro» | **No** | Solo es geometría del centro del Sol sobre un DEM acotado; sin equipos, rocas < 5 m, refracción, eclipses ni energía |

Distinción de incertidumbres: **numérica** (float32: un intervalo de 10 min en un caso), **resolución espacial** (dominante a 0 m), **perturbaciones propias** (X = 1 m, σ = 100 m; hipótesis editables, no errores NASA medidos) y **clones publicados** (5 de 100 del ensemble PGDA78).

## 9. Decisión: conservar

- **Se conservan** todos los valores del contrato `site-regret/0.1` y del paquete de alturas. No se regenera nada ni se toca `web/data/source/`.
- **Se añade** la auditoría diagnóstica versionada (`height-audit/v1`) con SHA-256 del motor y del script, y pruebas que la ligan al contrato.
- **No corregido a propósito:** la salida float32 del muestreo bilineal del motor (efecto ≤ 10 min en un caso de 0 m); cambiarla rompería la reproducibilidad del paquete firmado. Queda como limitación.

## 10. Cambios en la interfaz que se derivan

Ver el informe de integración en la PR y `docs/continuidad/HANDOFF.md` §0-nonies. Resumen: Regret Lab distingue «empate · sin oscuridad detectada», «empate · toda la ventana», «diferencia relevante» y «no determinable»; muestra los cuatro criterios con sus valores; indica qué criterio sí diferencia; enseña la evolución con la altura (contrato + paquete 0–30 m sin interpolar); avisa de la fragilidad a 0 m y del margen a 2/10 m con las cifras de esta auditoría; y la demo guiada se pausa si la selección deja de coincidir con su caso.

## 11. Limitaciones pendientes

- Sin DEM de mayor resolución (p. ej. 1–2 m) no se puede decidir cuál de las rachas de 0 m es la real; solo que es inestable.
- La auditoría usa el nominal; no repite el barrido fino en los 5 clones ni en las hipótesis propias.
- Criterio de centro del Sol (no fracción de disco); sin refracción ni eclipses (límites del paquete original).
- La revisión bibliográfica es cualitativa; no se han extraído cifras de los artículos para contrastarlas punto a punto.
