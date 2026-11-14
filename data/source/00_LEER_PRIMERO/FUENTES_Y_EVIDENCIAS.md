# Fuentes, trazabilidad y evidencias

Se transfiere evidencia local y documentación original; no se han repetido búsquedas online ni cálculos durante este empaquetado. Rutas de esta guía parten de la raíz del ZIP. Fechas de descarga no son fechas de adquisición de observaciones ni ventanas de misión.

## Cadena de procedencia

**Proveedor externo → archivo publicado → hash/metadatos → motor propio → resultado derivado → futura interfaz**. La palabra «original» en la recopilación significa copia intacta del producto publicado; un DEM publicado ya es una elaboración científica y no telemetría cruda. El pasaporte lo rotula `DERIVED_PUBLISHED`; las efemérides son `DERIVED_SPICE`, alturas `SIMULATED`, perturbaciones propias `MODELED`, clones `PUBLISHED_MODELED_ENSEMBLE`. No atribuir resultados SITE REGRET a NASA ni insinuar respaldo.

En `RECOPILACION_DATOS_2026-11-14/manifest_integrado.json` hay una instantánea inicial de 56 archivos y 792.869.066 bytes. El DEM lejano adicional de 218.961.039 bytes se descargó después y está en `DERIVADOS_SITE_REGRET/documentacion/descarga_regional_ampliado.json`, su sidecar original y `datos/pasaporte.json`. El registro inicial no se ha reescrito. Las fechas UTC, `last_modified`, URLs originales/finales, tamaño, checksum y estado de descarga aparecen en los manifiestos y sidecars. La fecha de modificación HTTP es del archivo servidor, no necesariamente de medición.

`TRAZABILIDAD_ACTIVOS.json` conserva los **18 registros de entradas identificadas por el motor** y añade solamente si sus bytes se incluyen en la transferencia. Relación con resultados: DEM nominal, ROI y calidad → sitios y contexto; nominal/clones + regionales → horizontes; kernels → direcciones; horizontes + direcciones + configuración → escenarios y eventos; métricas → comparaciones/regret; hashes/versiones → pasaporte. Horizons es referencia externa de contraste, no entrada que sustituya las efemérides del motor.

## NASA PGDA 78 / LOLA

[Ficha PGDA 78](https://pgda.gsfc.nasa.gov/products/78), [README](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README), [Barker 2021](https://doi.org/10.1016/j.pss.2020.105119). Artículo completo NASA NTRS conservado en `RECOPILACION_DATOS_2026-11-14/documentacion/articulos/Barker_2021_LOLA_incertidumbre.pdf`.

Site01 Connecting Ridge: 3200×3200, 5 m/píxel, Float32, nodata NaN; X −19000 a −3000 m, Y −20000 a −4000 m, polar sur, R=1737400 m, MOON_ME de DE421. DEM, LDEC, RMS vertical, pendiente, RMS pendiente, ROI, nube ajustada y cinco clones se descargaron realmente. El motor utiliza DEM, cuatro capas de calidad, ROI y cinco clones; no necesita la nube XYZI para esta ejecución. XYZI binario del proveedor usa X/Y/Z en km y cuatro columnas float64 X/Y/Z/RDRid, no CSV. Los clones son DEM completos publicados; no residuales.

Se conserva el TGZ de ROI, que contiene componentes shapefile válidos y un enlace `.gmt` roto; no seguir ese enlace al extraer. Site04 Shackleton es respaldo descargado, no sitio de los 120 escenarios. Los otros 95 clones Site01 y regiones alternativas son enlaces catalogados, no datos procesados en esta entrega. Los metadatos y el artículo documentan ajuste/cobertura de las observaciones; no se asigna una fecha de adquisición única inventada a todo el DEM.

## NASA PGDA 90: regional y horizonte lejano

[Ficha PGDA 90](https://pgda.gsfc.nasa.gov/products/90), [datos DOI 10.60903/gsfcpgda-lola-spole](https://doi.org/10.60903/gsfcpgda-lola-spole), [Barker 2023](https://doi.org/10.3847/PSJ/acf3e1).

`LDEM_80S_80MPP_ADJ.TIF`, 7600×7600, 80 m/píxel, 189.158.392 bytes; más `LDEM_60S_240MPP_ADJ.TIF`, 240 m/píxel, 218.961.039 bytes. Ambos se descargaron y usaron en el horizonte multiescala; el segundo amplía cobertura hasta el radio justificado de 400 km. Sin corrección vertical automática en solape. Metadatos de la ejecución en `validacion/qa_entradas.json`; el inventario antiguo de 15 rasters es anterior al raster adicional.

## JPL/NAIF y geometría

[Directorio de kernels NAIF](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/), [crédito SPICE](https://naif.jpl.nasa.gov/naif/credit.html). Se incluyen los **cinco kernels completos**: `naif0012.tls`, `de421.bsp`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`, `pck00011.tpc`, con sus sidecars. Su tamaño es razonable para esta transferencia y conserva definiciones/efemérides originales; aun así faltan DEM para repetir todo offline.

Frame efectivo MOON_ME_DE421, id 31007; mantener separado de MOON_PA. Coberturas efectivas en `provenance.kernel_validation.coverage_utc`. Parámetros, modo NONE y elevación sobre esfera en contrato/modelo. Se eligió DE421 por coherencia del marco con el terreno, sin afirmar que sea la versión más reciente.

## Horizons: evidencia de uso efectivo

[Sistema Horizons](https://ssd.jpl.nasa.gov/horizons/), [API](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [política SSD](https://ssd-api.jpl.nasa.gov/doc/). Cuatro respuestas y cuatro peticiones conservadas en `DERIVADOS_SITE_REGRET/validacion/horizons_*.json`; contraste en `contraste_horizons.json`. Ocho filas comparadas. Modelo aparente Horizons DE441 frente a SPICE DE421 CN+S para el contraste; métricas geométricas finales DE421 NONE. Las peticiones reales usan TT; leerlas antes de copiar un ejemplo genérico del dossier inicial.

El acuerdo angular no mide error del relieve. La API no requiere clave; no hace falta consultarla desde la web. Si en el futuro hay nuevas consultas, respetar política guardada: serialización, caché, User-Agent/contacto de proyecto y evitar acceso directo del navegador no admitido por CORS. No ejecutar aquí nuevas consultas.

La pestaña oficial [Resources](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=resources) se documentó con Quickmap, Moon Trek y Horizons; las evidencias están en `RECOPILACION_DATOS_2026-11-14/evidencias/`. El motor usó Horizons para contraste y lo identifica en el pasaporte como recurso listado utilizado. Esa evidencia no convierte cada asset PGDA en miembro de Resources ni certifica elegibilidad final del producto sin revisión humana.

## Otras fuentes descargadas o catalogadas

| Fuente | Estado real y uso |
|---|---|
| [PGDA 69](https://pgda.gsfc.nasa.gov/products/69) | Tres TIFF descargados y sus etiquetas PDS conservadas; contexto de iluminación/visibilidad/sombra, **no cálculo de las ventanas entregadas**. TIFF omitidos del ZIP optimizado. 60 m; nodata −32768; escala Sol/Tierra DN×0,00004 y PSR DN×0,000025+0,5. Criterio publicado de disco distinto al centro del motor; START/STOP en etiquetas no son fechas de W1/W2 |
| [Moon Trek](https://trek.nasa.gov/moon/) | Dos GetCapabilities y dos pequeñas teselas descargadas e incluidas como muestras; imágenes de visualización, no relieve numérico ni entrada del horizonte. XML EPSG::0 no equivale a WGS84 |
| [QuickMap](https://quickmap.lroc.asu.edu/) | Recurso oficial de contexto, no API de extracción masiva implementada |
| NASA/LROC | PNG de iluminación polar incluido, imagen global color omitida por tamaño relativo y falta de uso en cálculos; páginas de origen/crédito incluidas. Crédito NASA/Goddard/ASU, sujeto a guía de uso de medios conservada |
| [IAU/USGS nomenclatura](https://planetarynames.wr.usgs.gov/GIS_Downloads) | ZIP original descargado de 23,85 MB, omitido; nombres/centros no se usan en métricas de A/B |
| [PGDA 104](https://pgda.gsfc.nasa.gov/products/104), [Zenodo 17954508](https://doi.org/10.5281/zenodo.17954508) | Registro y README conservados; alternativa SfS catalogada. Connecting Ridge ZIP de 2.206.485.514 bytes **no descargado**; no es dato usado. Licencia declarada CC BY 4.0 para ese depósito |

Catálogo de enlaces: `03_CATALOGO_ACTIVOS.json/.html` (3.128 enlaces en la recopilación), fichas de fuentes en `02_CATALOGO_FUENTES.json`. No confundir esos enlaces con archivos transferidos ni con datos usados en escenarios. `_COG.TIF` de PGDA69 devolvía HTML pese a HTTP 200; se descargaron los `.TIF` válidos. Las incidencias originales se conservan.

## Validaciones propias y límites

`DERIVADOS_SITE_REGRET/validacion/pruebas.json`: 414 aprobadas, 0 fallidas. `contraste_horizons.json`: ocho filas, máximos azimut 4,221103836243856e−6° y elevación 9,660818442558394e−6°. `convergencia_espacial.json`: máximo 0,05487851329812404°; `convergencia_temporal.json`: diferencia nominal máxima 5 min en ensayos 10/5. `efecto_refinamiento_espacial.json`: cambio inicial→entrega hasta 50 min, seis decisiones nominales principales conservadas. Son ensayos concretos, no incertidumbre física total, validación de web o aval NASA.

Conservar las tres familias: incertidumbre epistémica del DEM; diferencias numéricas de discretización; hipótesis de parámetros/superficies. No sumar todo a un único porcentaje. Cinco clones no calibran probabilidades; el techo lejano de 12 km es supuesto conservador y condicionado. Centro geométrico visible no equivale a disco completo, energía, eclipse, enlace de radio ni seguridad de aterrizaje.

## Referencias originales, fechas y hashes por entrada usada

Los registros completos con adquisición/metadatos disponibles, descarga UTC, condiciones HTTP y hashes están en `TRAZABILIDAD_ACTIVOS.json`, pasaporte, manifiestos y sidecars; no se omite ni sustituye una fecha desconocida. La tabla da acceso a cada original:

| ID | Ruta dentro de datos de origen | Bytes | Transferencia | URL original |
|---|---|---:|---|---|
| `SITE01_surf` | `datos_originales/PGDA78_Site01/Site01_final_adj_5mpp_surf.tif` | 40980810 | Original omitido; resultado incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_surf.tif) |
| `SITE01_ldec` | `datos_originales/PGDA78_Site01/Site01_final_adj_5mpp_ldec.tif` | 40980744 | Original omitido; resultado incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_ldec.tif) |
| `SITE01_toterr` | `datos_originales/PGDA78_Site01/Site01_final_adj_5mpp_toterr.tif` | 40980810 | Original omitido; resultado incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_toterr.tif) |
| `SITE01_slp` | `datos_originales/PGDA78_Site01/Site01_final_adj_5mpp_slp.tif` | 40980776 | Original omitido; resultado incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_slp.tif) |
| `SITE01_slperr` | `datos_originales/PGDA78_Site01/Site01_final_adj_5mpp_slperr.tif` | 40980810 | Original omitido; resultado incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_slperr.tif) |
| `SITE01_ROIS` | `datos_originales/PGDA78_Site01/Site01_ROIs.tgz` | 2934 | Incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_ROIs.tgz) |
| `SITE01_CLONE_0001` | `datos_originales/PGDA78_Site01/Clones/Site01_final_adj_5mpp_0001_err.tif` | 40987165 | Original omitido; resultado incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Clones/Site01_final_adj_5mpp_0001_err.tif) |
| `SITE01_CLONE_0002` | `datos_originales/PGDA78_Site01/Clones/Site01_final_adj_5mpp_0002_err.tif` | 40987165 | Original omitido; resultado incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Clones/Site01_final_adj_5mpp_0002_err.tif) |
| `SITE01_CLONE_0003` | `datos_originales/PGDA78_Site01/Clones/Site01_final_adj_5mpp_0003_err.tif` | 40987165 | Original omitido; resultado incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Clones/Site01_final_adj_5mpp_0003_err.tif) |
| `SITE01_CLONE_0004` | `datos_originales/PGDA78_Site01/Clones/Site01_final_adj_5mpp_0004_err.tif` | 40987161 | Original omitido; resultado incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Clones/Site01_final_adj_5mpp_0004_err.tif) |
| `SITE01_CLONE_0005` | `datos_originales/PGDA78_Site01/Clones/Site01_final_adj_5mpp_0005_err.tif` | 40987163 | Original omitido; resultado incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Clones/Site01_final_adj_5mpp_0005_err.tif) |
| `DEM_REGIONAL_80M` | `datos_originales/PGDA90_contexto/LDEM_80S_80MPP_ADJ.TIF` | 189158392 | Original omitido; resultado incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF) |
| `LSK` | `datos_originales/NAIF_DE421/naif0012.tls` | 5257 | Incluido | [Descarga](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls) |
| `SPK_DE421` | `datos_originales/NAIF_DE421/de421.bsp` | 16790528 | Incluido | [Descarga](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/de421.bsp) |
| `PCK_MOON_DE421` | `datos_originales/NAIF_DE421/moon_pa_de421_1900-2050.bpc` | 1770496 | Incluido | [Descarga](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de421_1900-2050.bpc) |
| `FK_MOON_DE421` | `datos_originales/NAIF_DE421/moon_080317.tf` | 21437 | Incluido | [Descarga](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf) |
| `PCK_CONSTANTS` | `datos_originales/NAIF_DE421/pck00011.tpc` | 131226 | Incluido | [Descarga](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc) |
| `DEM_LEJANO_240M` | `datos_originales/PGDA90_contexto/LDEM_60S_240MPP_ADJ.TIF` | 218961039 | Original omitido; resultado incluido | [Descarga](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF) |

Los `SHA256SUMS.txt` originales se preservan intactos y pueden referir archivos omitidos. Para verificar **este ZIP** usar `SHA256_TRANSFERENCIA.txt` y el verificador nuevo. Integridad de bytes no equivale a validez de un modelo. No se inventa licencia SPDX para archivos cuya ficha no la declara; conservar citas Barker 2021/2023, Mazarico 2011 cuando se usen sus mapas, NAIF/Horizons y créditos de imagen según su origen.
