# Modelo científico ejecutado: lectura del código y sus salidas

Fuentes internas: `DERIVADOS_SITE_REGRET/motor/pipeline.py` (funciones `prepare`, `radial_grids`, `rays`, `elevation_terrain`, `horizon`, `direction`, `classify`, `compare`, `horizons_reference`), `configuracion.json`, contrato y pasaporte. Las expresiones siguientes transcriben esas operaciones; no son un modelo nuevo.

## Sitios, coordenadas y tiempo

| Sitio | ROI | X / Y polar (m) | Longitud este / latitud (°) | Suelo nominal sobre esfera (m) |
|---|---|---|---|---|
| A | 4 | −11287,5 / −12167,5 | 222,85134734999107 / −89,45267485051369 | 1956,390869140625 |
| B | 6 | −10802,5 / −11737,5 | 222,62462919484165 / −89,47394396023844 | 1948,351318359375 |

Ambos centroides están dentro de sus ROI originales y tienen elevación válida. `LDEC=0` en ambos: el valor está interpolado en el producto, no es un retorno LOLA en ese píxel. RMS vertical publicado: A 0,2713887691497803 m; B 0,3006587624549866 m. No confundir estos RMS del proveedor con el ±1 m hipotético propio.

Marco `MOON_ME_DE421`, id 31007, esfera R=1.737.400 m; estereográfica polar sur con longitud central 0 y polo −90°. Longitude positiva este; latitudes meridionales negativas. W1 = `[2026-11-14T00:00:00Z,2026-12-14T00:00:00Z)` y W2 = `[2026-12-14T00:00:00Z,2027-01-13T00:00:00Z)`. Cada una 720 h. Conversión UTC a ET/TDB mediante LSK; Sol 10, Tierra 399, Luna 301.

## Diez superficies compartidas

`nominal`, `bias_plus`, `bias_minus`, `correlated_plus`, `correlated_minus`, `published_0001` … `published_0005`. Una misma variante espacial se usa para A/B.

El terreno nominal PGDA78 tiene 5 m/píxel y se interpola bilinealmente. Para las cuatro hipótesis propias se genera una máscara de anclaje común a ambos lugares, radio interior 5 m, exterior 50 m, con transición cúbica `u²(3−2u)`, y atenuación de borde de 250 m. La amplitud propia es `X=1 m`. Las variantes de sesgo son nominal ± amplitud atenuada. Las correlacionadas usan el mismo campo PCG64, semilla 20261114, ruido normal float32 filtrado con Gauss de `sigma=100 m / 5 m = 20 píxeles`, modo reflect; normalizado por máximo absoluto antes de aplicar máscara y X. Son hipótesis diferenciales, no distribución calibrada de error.

En estas hipótesis el suelo bajo el observador está anclado al nominal. En los cinco clones publicados, cada raster ya es un DEM completo: el observador se pone a elevación del clone más altura de mástil. No sumar el clone al nominal ni escoger clones independientes para cada sitio. Solo se usan los primeros cinco identificadores de los cien publicados; no son muestra aleatoria representativa garantizada.

## Horizonte con curvatura

Para arco `d`, `theta=d/R`, vector radial local `u` y tangente de azimut `a`, los rayos usan `u(d)=cos(theta)u + sin(theta)(sin(a)e + cos(a)n)`. El terreno se transforma desde la esfera a X/Y del raster y se muestrea sobre sus centros.

Para altura de terreno `z` y altura radial del observador `z_o` (suelo más mástil), el código calcula:

```
vertical = (z − z_o) − (R + z) · 2 sin²(theta/2)
horizontal = (R + z) · sin(theta)
elevation_deg = degrees(atan2(vertical, horizontal))
horizon(a) = max(elevation_deg de muestras válidas del rayo)
```

La forma evita restar radios casi iguales en el campo próximo. Horizonte para 0, 2 y 10 m recalculado, no desplazamiento gráfico de una misma curva. 1.440 azimuts de 0 a 359,75°, paso 0,25°. Distancia mínima 2,5 m, máxima 400 km. Pasos radiales locales entregados: 1,25 m hasta 500 m, 2,5 m hasta 5 km, 5 m hasta 24 km; rejilla regional con 20 m hasta 240 km y 60 m después hasta 400 km, comenzando a 500 m.

El DEM fino sustituye al regional dentro de su huella de centros; fuera se usa PGDA90 a 80 m y apoyo a 240 m donde falta cobertura del primero. `source` 0/1/2 identifica qué resolución fija el máximo angular. Se conserva distancia del obstáculo y máscara de desconocidos; interpolar azimut de forma periódica, y si cualquiera de los vecinos es desconocido la consulta también lo es.

Se midió el solape fino/regional en 40.000 muestras: mediana fino−regional 0,007354736328125 m; RMS 1,2238634824752808 m (ver `validacion/qa_entradas.json`); diferencia máxima absoluta 16,3577880859375 m. No se aplicó corrección vertical. Igual marco no implica ajuste local idéntico.

La exclusión de relieve más allá de 400 km es **condicional** a un techo conservador supuesto de 12 km, superior al máximo LOLA global publicado de 10,792 km. Se calcula su elevación angular en el borde y se verifica inferior al horizonte muestreado. No certifica obstáculos subpíxel ni verdad de cada altitud. El ensayo inicial a menor alcance no justificaba todos los sectores; el producto final usa la extensión adicional. No confundir el archivo de resolución inicial con la entrega vigente.

## Cielo y clasificación

SPICE `spkpos(target, et, MOON_ME_DE421, NONE, MOON)` proporciona posiciones geométricas lunares; se resta el observador `(R+suelo+mástil)/1000 * u`, en km. En base local este/norte/arriba:

```
azimut = degrees(atan2(v·e, v·n)) mod 360
elevación = degrees(atan2(v·u, hypot(v·e, v·n)))
visible = elevación_del_centro > horizonte(azimut)
```

Igualdad geométrica no satisface el `>` estricto. No hay margen positivo extra en esta ejecución. Se producen 0 NEITHER, 1 SUN_ONLY, 2 EARTH_ONLY, 3 BOTH, 4 UNKNOWN. Los 4.321 instantes de cada ventana delimitan 4.320 intervalos de diez minutos; manda el estado del extremo izquierdo. El extremo final no suma duración.

Horas Sol = conteo estados 1 o 3 × 10/60; Tierra = 2 o 3; conjuntas = 3. Horas conocidas y desconocidas se conservan por separado. La máxima oscuridad es la máxima racha consecutiva 0 o 2 válida; ausencia terrestre 0 o 1 válida. Desconocidos cortan rachas y bloquean comparación si hay horas incompletas. Los flags de censura indican intervalos que tocan los extremos; una racha observada no demuestra su duración física completa. Los eventos nominales son cotas de diez minutos.

## Criterio, utilidad y regret

Principal `min_longest_dark_hours`: `U = −longest_dark_hours`. Alternativos `max_sun_hours`, `max_dte_hours` (métrica `dte_center_hours`), `max_joint_hours`, con utilidad positiva. Por variante:

```
D = U_A − U_B
regret_A = max(U_A,U_B) − U_A
regret_B = max(U_A,U_B) − U_B
```

Empate si `abs(D) <= 1/6 h + 1e−10` en el código; tolerancia declarada diez minutos, la suma pequeña evita ruido de flotantes. El regret usa utilidades completas y puede ser no cero incluso si una diferencia cae dentro de tolerancia de empate. No mezclar regret de objetivos distintos.

Las fracciones excluyen el nominal: familia propia cuatro variantes; publicada cinco. Denominador = variantes evaluables, con generadas/invalidas aparte. Los empates no son conservación inequívoca. Si el nominal empata o es desconocido, conservación y peor regret de la elección nominal son `null`; no inventar un ganador. La frase española de `summary_es` la forma `compare`, sin modelo generativo.

## Resultado que demuestra una inversión

W2, 0 m, criterio principal: nominal B, `D=-24 h`; A tiene racha 38,666666666666664 h y B 14,666666666666666 h. `correlated_plus` da A con `D=16,5 h`; conservar B implica regret de 16,5 h. `bias_minus` empata. En `published_0001` gana A y el regret de B es 528,6666666666666 h; los otros cuatro clones favorecen B. Son resultados existentes del JSON, no valores generados para esta transferencia. W1 nominal y W2 a 2/10 m empatan en el criterio principal. La web debe permitir esos empates y no prometer una reversión en todas las combinaciones.

## Validación y alcance

Resultados anteriores: 414 pruebas aprobadas / 0 fallidas, incluyendo base ENU, conversión de proyección, geometría analítica, monotonicidad con altura, contabilidad temporal, límites de métricas, regret y hashes. Consultar nombres y umbrales reales en `validacion/pruebas.json`; no inferir que todo requisito de la especificación se ha ensayado ni que la web pasó E2E.

Horizons: cuatro respuestas almacenadas, ocho filas efectivamente contrastadas, dos sitios × dos cuerpos × dos instantes. Contraste aparente mediante `spkcpo` CN+S contra Horizons DE441, mientras la ciencia nominal usa DE421 NONE. Las peticiones reales en `validacion/*_peticion.json` usan TT y paso 12h; el ejemplo UT del dossier anterior era una propuesta. Diferencias máximas de azimut 4,221103836243856e−6° y elevación 9,660818442558394e−6°. Es acuerdo entre modelos con convenciones y diferencias declaradas; no error total ni exactitud del DEM.

Convergencia espacial nominal entregada frente a 0,125° y pasos radiales divididos por dos: máximo 0,05487851329812404°, máximo RMS 0,007138050665183521°. Convergencia temporal nominal 10 frente a 5 min: mayor diferencia medida en métricas 0,08333333333337123 h. La mejora desde la resolución espacial inicial cambió una métrica hasta 0,8333333333333712 h (50 min); mantuvo las seis decisiones nominales principales. Son diferencias de ensayos concretos, no cotas universales ni certificados para las diez superficies.

Límites: resolución efectiva y obstáculos subpíxel; terreno interpolado; muestreo temporal; cota lejana condicionada; un subconjunto pequeño de clones; hipótesis no calibradas; visibilidad del centro, sin disco completo ni eclipses; sin potencia eléctrica, térmica, seguridad de aterrizaje o presupuesto RF. Ver Tierra no asegura enlace con una estación. Ninguna frecuencia de variantes es probabilidad de éxito. Cero horas desconocidas entregadas significa cobertura bajo este modelo, no certeza física absoluta.
