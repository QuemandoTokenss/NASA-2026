# SITE REGRET: cartografía lunar real, terreno científico y geometría trazable
## Prompt maestro de implementación para Claude Code

Fecha de la investigación: 14 de noviembre de 2026.
Repositorio identificado: QuemandoTokenss/NASA-2026.
Snapshot inspeccionado: 987899d133686db47b2df0f3301ae8be7c9f7e3d.
Produccion declarada por el README: https://site-regret.vercel.app/
El commit desplegado NO se ha contrastado independientemente. Antes de editar, identifica tu HEAD y las diferencias respecto a este snapshot. No vuelvas a una versión anterior ni sobrescribas cambios del equipo.

# 1. Misión: implementar, no entregar otra lista de ideas

Transforma la capa geoespacial de SITE REGRET en un sistema que trabaje con observaciones y productos científicos verificables. El objetivo no es decorar el dashboard con fotografías de la Luna: los lugares, el relieve, las imágenes, los perfiles, las distancias y la geometría deben representar el MISMO lugar físico, dentro de sus coberturas y limitaciones.

Trabaja sobre la aplicación existente. Lee AGENTS.md y las instrucciones locales. Inspecciona el código, establece una línea base y ejecuta una primera mejora vertical completa antes de abordar las siguientes. No te limites a redactar una auditoría. No hagas una reescritura total que destruya el motor, los resultados de referencia o las verificaciones de integridad.

Prioridad absoluta: ningún paisaje, cráter, textura topográfica, fotografía orbital o resultado físico inventado debe presentarse como observación lunar. La IA puede ayudar a escribir código o a explicar resultados verificados, pero no generar la geografía ni suplir datos ausentes.

El producto debe permitir recorrer esta cadena:
MAPA REAL -> SITIO -> ELEVACION/TERRENO -> POSICIONES SOL/TIERRA -> OBSTACULO QUE LIMITA LA VISION -> COMPARACION -> ROBUSTEZ -> EVIDENCIA ORIGINAL.

No prometas certificación NASA, seguridad de aterrizaje, precisión total ni originalidad mundial. Nuestra aportación es la integración y la explicabilidad, no atribuirnos las observaciones ni los productos publicados por terceros.

# 2. Estado concreto encontrado: conservar lo correcto, sustituir lo ilustrativo

Lee al menos estos archivos antes de cambiar contratos:
- web/README.md y web/ARCHITECTURE.md.
- web/src/components/explore/ContextMap.tsx.
- web/src/components/explore/SiteThumb.tsx.
- web/src/components/engineer/MastScene.tsx.
- web/src/lib/figure.ts, o el archivo equivalente que resuelva ese import.
- web/src/lib/contract/, web/src/lib/data/ y web/src/lib/state/.
- web/data/source/00_LEER_PRIMERO/MODELO_CIENTIFICO.md.
- web/data/source/00_LEER_PRIMERO/FUENTES_Y_EVIDENCIAS.md.
- web/data/source/00_LEER_PRIMERO/TRAZABILIDAD_ACTIVOS.json.
- El motor, la configuración y las validaciones dentro de DERIVADOS_SITE_REGRET, comprobando que sus archivos existan realmente.

Hechos del snapshot, que debes volver a contrastar con tu copia:

ContextMap.tsx muestra una figura SVG del DEM PGDA78 mediante una imagen con zoom, desplazamiento y marcadores. NO es un motor de mapas WMTS. Pero tampoco debe calificarse falsamente como una imagen generada con IA: declara una derivación científica de un DEM.

SiteThumb.tsx recorta esa misma figura. Es una miniatura de un DEM, no una fotografía orbital. Puedes conservarla como alternativa correctamente identificada, mientras incorporas recortes georreferenciados de imágenes reales con cobertura.

MastScene.tsx es un esquema SVG explicativo. Tiene crestas dibujadas con coordenadas fijas, Tierra y Sol en posiciones fijas y una escala visual del mástil no lineal. El propio componente lo avisa. Este es un objetivo prioritario de sustitución por terreno del DEM y posiciones calculadas; no basta cambiar su estilo o hacer el SVG más bonito.

La aplicación usa resultados precalculados, manifiestos SHA-256, validación del contrato y estado global. No reconstruyas sus métricas a partir de capturas ni introduzcas porcentajes de ejemplo. El README identifica Next.js con exportación estática; una nueva API de servidor no aparecerá por escribir un route handler dentro de un export estático.

El caso de referencia compara A = Connecting Ridge ROI 4 y B = Connecting Ridge ROI 6, ambos dentro de PGDA78 Site01. No los renombres como Shackleton y Malapert. El paquete tiene dos ventanas, tres alturas y diez superficies. Conserva su significado.

Parte de los originales grandes se omitió de la transferencia optimizada. Un enlace en TRAZABILIDAD_ACTIVOS no demuestra que exista el GeoTIFF local. Localiza, descarga y verifica los originales necesarios antes de afirmar que puedes generar su malla 3D.

# 3. Política de autenticidad visual y científica

Inventaria todos los assets locales, URLs externas, fondos CSS, texturas, SVG, geometría procedural y gráficos de las ocho rutas. Registra origen, uso y acción propuesta.

Clasifica cada recurso como:
1. Observacion instrumental publicada: imagen orbital o medición.
2. Producto científico publicado: mosaico, DEM, pendiente, mapa de error.
3. Derivado calculado por SITE REGRET: perfil, horizonte, malla, hillshade o resultado temporal.
4. Escenario hipotético: mástil, cambio de altura, perturbacion del terreno.
5. Ilustracion no científica: esquema, icono o animación pedagogica.
6. Origen desconocido: no debe pasar a la interfaz científica sin verificar.

No confundir producto real con fotografía. Un DEM procede de mediciones y procesamiento; un hillshade es una representación calculada; un clone de incertidumbre es un terreno alternativo modelizado. Todos pueden ser legitimos con una etiqueta adecuada. No pueden venderse como una fotografía tomada por LRO.

Prohibidos como sustituto de datos: cráteres generados con ruido, terreno Perlin, texturas de IA, imágenes de otra región, superresolucion generativa, sombras decorativas presentadas como físicas, valores aleatorios y resultados de otro sitio reciclados bajo un nuevo marcador.

Puedes conservar iconos y esquemas didacticos fuera de la vista científica, claramente separados. Un mástil nuevo es una hipótesis de infraestructura, no una estructura observada en la Luna. Regret Lab no necesita fotografías ornamentales.

No anadas un asset solo porque esta alojado en nasa.gov. Verifica si representa observación, simulación, ilustración o modelo. Por ejemplo, en PGDA90 hay imágenes NAC map-proyectadas y productos con MODEL en el nombre: estos ultimos no se deben anunciar como fotografías.

# 4. Primera entrega vertical obligatoria

Implementa primero una experiencia acotada y funcional para Connecting Ridge:

A. Explore abre un mapa georreferenciado, no una captura de Moon Trek ni un iframe como solucion principal.
B. Se cargan un fondo orbital real con cobertura comprobada y el DEM Site01 como capa numérica independiente.
C. Los marcadores A/B se colocan mediante sus coordenadas científicas.
D. Activar elevación, pendiente, conteo LOLA o incertidumbre cambia realmente los datos dibujados y la leyenda.
E. Un clic muestra coordenadas, elevación, fuente, resolución, calidad y estado de cobertura.
F. Engineer reconstruye un recorte del terreno de ese mismo sitio, con alturas métricas.
G. Timeline y los resultados de referencia siguen funcionando sin alterar su contrato.
H. Evidence muestra la procedencia exacta de los recursos usados por esa vista.

La carga de una fotografía no completa esta entrega: deben verificarse alineacion, coordenadas, lectura de altura y coherencia entre 2D y 3D. Cuando no exista una ortoimagen adecuada, muestra el relieve derivado del DEM con su etiqueta y registra la falta de cobertura fotográfica. No fabriques el acabado que falta.

# 5. Catalogo de proveedores y registro de activos

Usa los documentos oficiales incluidos en fuentes_nasa.json como puntos de entrada. El registro separa documentacion comprobada de endpoints y archivos cuya respuesta binaria todavía necesita una prueba en vivo. No copies su estado documental como si fuera una prueba de funcionamiento.

Implementa adaptadores pequeños para:
- Moon Trek: descubrimiento y lectura de teselas WMTS.
- PDS/ODE: busqueda y metadatos de productos y huellas.
- LOLA Data Node: archivo y etiquetas de productos altimetricos.
- NASA PGDA: DEMs, calidad, regiones, clones y productos regionales.
- LROC/PDS: imágenes y ortoimagenes adecuadas a cada zona.
- JPL/NAIF: kernels y cálculo reproducible de efemérides.
- JPL Horizons: consultas de contraste o precalculo autorizado; no dependencia del render interactivo.
- IAU/USGS: nomenclatura oficial, como proveedor diferenciado, sin atribuirle a NASA todos los datos.

Cada activo necesita un ID estable, tipo, organismo, instrumento cuando proceda, URL de ficha, URL de archivo o servicio, identificador original, condiciones de uso, crédito, cobertura, sistema de coordenadas, referencia vertical, unidades, nodata, escala/offset, resolución nominal y efectiva si existe, fechas disponibles, estado de verificación y checksum del archivo completo cuando se haya descargado.

No inventes una fecha única de observación para un mosaico multitemporal. Fecha de descarga, fecha de procesamiento y fecha de adquisición son campos distintos. Guarda null y una explicación cuando el proveedor no publique un dato.

# 6. Moon Trek: conectar mapas reales correctamente

Documentacion: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon
Portal: https://trek.nasa.gov/moon/

Integra WMTS a partir de GetCapabilities. No adivines un esquema XYZ terrestre. Lee el identificador de capa, estilos, formatos, ResourceURL, TileMatrixSet, matrices, TileWidth/Height, MatrixWidth/Height, TopLeftCorner, ScaleDenominator, CRS, límites y cobertura.

Hay servicios PNG y JPEG. La extension se obtiene del documento, no de una constante. Un XML con un identificador de CRS ambiguo, incluido EPSG::0, NO autoriza a tratar la capa como WGS84 ni Web Mercator. Revisa la documentación del servicio y contrasta coordenadas conocidas antes de habilitarla.

Candidato de mosaico global documentado: LRO_WAC_Mosaic_Global_303ppd_v02. La URL candidata del registro debe someterse a comprobacion actual; si ha cambiado, redescubrela desde el catálogo oficial. No concluyas que una capa polar existe o funciona solo porque su nombre parece plausible.

Recomendacion de implementación: OpenLayers con proyecciones explicitamente registradas, y proj4 si hace falta. Revisa las versiones compatibles con el proyecto y fija el lockfile. El ejemplo oficial de lectura WMTS sirve como patron de parseo, NO como autorización para copiar su EPSG:3857 terrestre.

Crea un LayerManager con visibilidad, orden, opacidad, leyenda, crédito, cobertura y estado. Diferencia capa visual de capa analítica. Una tesela coloreada de elevación no sustituye un raster numérico. No leas alturas desde colores de un PNG.

No intentes extraer funciones privadas de Moon Trek ni reproducir endpoints internos no documentados. Algunas herramientas avanzadas requieren acceso registrado. Usar sus servicios públicos documentados no implica tener acceso programatico a cada boton de su interfaz. Nuestra visibilidad de terreno puede calcularse con el motor propio.

Estados obligatorios: cargando, disponible, fuera de cobertura, servidor no disponible y respuesta invalida. Un error no debe convertirse en una textura inventada. Comprueba CORS desde el origen final autorizado; no uses proxies públicos para eludir políticas.

# 7. Lunar Orbital Data Explorer: Map Search, Data Sets y productos

Portal: https://ode.rsl.wustl.edu/moon/
REST: https://oderest.rsl.wustl.edu/
Manual: https://oderest.rsl.wustl.edu/ODE_REST_V2.1.6.pdf
Base REST: https://oderest.rsl.wustl.edu/live2/

Implementa la función equivalente que necesita SITE REGRET, no scraping de pantallas:

Map Search: consulta la región visible o un poligono dibujado; representa huellas de productos; permite filtrar y abrir su ficha. Diferencia intersección del bounding box de intersección real de la huella. Soporta cruces de longitud y la convencion 0-360 este cuando corresponda.

Data Sets: muestra procedencia, mision, instrumento, nivel/product type y cobertura. Usa query=iipt para descubrir combinaciones validas actuales. No construyas un listado de instrumentos inventado ni mezcles datos de una mision distinta por tener una foto mas atractiva.

Product Sets: agrupa los resultados científicos seleccionados por tipo y uso: imágenes, DEM, calidad, regiones y observaciones altimetricas. Conserva los identificadores originales; no inventes que existe un endpoint llamado productSets. El API documentado consulta productos y tipos.

Consulta inicial orientativa, que debes probar contra la documentación vigente:
query=product&target=moon&ihid=LRO&iid=LOLA&pt=GDRDEM&results=copmf&output=JSON&limit=10

Usa results=copmf para obtener recuento/IDs/metadatos/archivos según el manual. Implementa paginación con los parámetros documentados y conserva el total y los productos realmente recibidos. Una respuesta HTTP 200 vacia o con un error interno no demuestra exito.

Para Connecting Ridge inicia una consulta espacial acotada, no el archivo lunar completo. Los parámetros westernlon, easternlon, minlat y maxlat deben salir del area real. Inspecciona etiquetas y archivos antes de activar una capa.

GDS tiene un servicio distinto para consultas granulares de retornos LOLA RDR. Usalo, si se necesita, para inspeccionar puntos y densidad de observaciones; no confundas esos puntos con un DEM continuo. Aplaza consultas enormes y respeta las restricciones del proveedor.

El navegador de productos debe ofrecer: huella, fecha o intervalo disponible, escala, ángulos de observación disponibles, identificador, enlace a etiqueta, enlace al original y boton para cargar como capa SOLO cuando el formato y la georreferenciación esten soportados.

# 8. DEMs: empezar por los sitios reales del proyecto

Producto local: https://pgda.gsfc.nasa.gov/products/78
Producto regional: https://pgda.gsfc.nasa.gov/products/90
Archivo LOLA: https://imbrium.mit.edu/

Rehidrata los originales requeridos para Site01 desde las URLs registradas. Empieza por el DEM surf, LDEC, pendiente, RMS vertical y RMS de pendiente. Extrae los ROI de manera segura, sin seguir enlaces simbolicos inesperados ni permitir rutas fuera de la carpeta de destino.

El DEM Site01 que usa la documentación del proyecto tiene rejilla de 5 m. Este espaciado NO significa error de 5 m ni que cada pixel sea un retorno laser observado. Usa la capa de conteo y la incertidumbre publicada para explicar que partes estan interpoladas. No trates LDEC=0 como elevación cero.

Verifica CRS, dimensiones, centros de pixel, orientacion, bounds, unidades, nodata, escala y offset con las etiquetas y un lector geoespacial. No confundas latitud planetocéntrica con planetográfica ni marco ME con PA. El paquete nominal usa MOON_ME_DE421 y esfera de 1.737.400 m: conserva la coherencia o versiona y valida cualquier transformacion.

La documentación de referencia usa rasters regionales de 80 y 240 m para el horizonte lejano. Conserva ese contexto: una bonita malla de unos kilometros no permite afirmar que no hay una montaña que oculte el Sol fuera del recorte. Comprueba ajuste vertical y cobertura al unir productos; no disimules un escalon alterando la ciencia para mejorar la imagen.

No descargues toda la Luna a máxima resolución. Construye una piramide multiescala y recortes con overviews, caches y límites de memoria. Guarda originales inmutables fuera del bundle cliente; genera derivados ligeros con procedencia. Si produces COG, conserva CRS, nodata y compresión numericamente adecuada; no uses JPEG para alturas científicas.

Calcula SHA-256 sobre el archivo completo. Una sonda Range de 16 bytes solo verifica una cabecera, no integridad del GeoTIFF. Verifica firma TIFF/BigTIFF ademas del status HTTP: hay servidores que devuelven HTML con código 200.

Los clones publicados son DEMs alternativos completos, no incrementos para sumar al nominal. Las hipótesis propias y las familias publicadas se mantienen separadas. Usa una misma realizacion espacial para A y B cuando así lo define el modelo; no elijas terrenos independientes arbitrarios que rompan la comparación.

# 9. Imagenes reales, alta resolución y nomenclatura

Para la vista global usa un mosaico orbital documentado. Para los sitios locales busca productos LROC NAC con cobertura efectiva y, preferentemente, ortorrectificados/map-proyectados. Descubre productos actuales mediante ODE y sus etiquetas. No afirmes que has elegido una ortoimagen de Connecting Ridge hasta comprobar un identificador concreto y su huella.

No estires un JPEG de preview sobre el mapa como si fuera una ortofoto. Un producto sin georreferenciación adecuada puede mostrarse en un visor documental, pero no como capa cartográfica medida. Una imagen de máxima resolución nominal puede no ser la más util por sombras, iluminación o ángulo; ofrece esas propiedades cuando existan.

Si no hay cobertura apropiada, conserva un hillshade o elevación del DEM y explica el motivo. Aumentar el zoom no crea detalle nuevo. Informa del límite de resolución y evita filtros de IA que inventen rocas o cráteres.

Las sombras presentes en una fotografía corresponden al momento de adquisición. No anuncies que esa fotografía muestra la iluminación del instante seleccionado en Timeline. Separa modo imagen adquirida de modo iluminación simulada sobre DEM, con rayo solar calculado y supuestos visibles.

Usa nombres de IAU/USGS para cráteres y accidentes. Una región de interes científico no equivale a un lugar de aterrizaje aprobado por NASA. Identifica si una capa representa nomenclatura, región candidata publicada, sitio histórico o selección propia.

# 10. Mediciones y proyecciones lunares

La proyección y la escala deben ser lunares. No uses el radio de la Tierra, EPSG:3857 por defecto ni funciones de distancia configuradas para WGS84 terrestre. Deriva las transformaciones de los metadatos del producto y documenta el datum.

Separa distancia sobre la superficie de referencia, distancia euclidea 3D y longitud de una trayectoria sobre el DEM. Presenta la magnitud elegida. En el polo el azimut y los ejes locales requieren una convencion explícita; prueba singularidades y longitud envuelta.

Herramientas requeridas:
- Regla de dos puntos, con unidades y método.
- Perfil de elevación de una polilinea, muestreando el DEM, no sus colores.
- Lectura de elevación y calidad bajo cursor o selección accesible por teclado.
- Pendiente y desnivel con escala de análisis y cobertura declaradas.
- Coordenadas de los sitios e información del producto activo.

Conserva nodata en perfiles: muestra huecos, no ceros interpolados silenciosamente. La malla de visualizacion puede tener menor detalle para rendimiento; las mediciones deben usar el raster analítico apropiado, no vertices simplificados sin advertencia.

# 11. Engineer: terreno 3D auténtico y explicación del obstaculo

Sustituye la escena principal de MastScene por un visor de terreno local derivado del DEM. Una opcion adecuada es Three.js en coordenadas locales con origen flotante; justifica y prueba otra biblioteca si la eliges. No actives terreno terrestre de una plataforma de globos como sustituto lunar.

Cada vertice debe tener una posición procedente de muestras del terreno y una transformacion conocida. Guarda identificador y hash del DEM, bounding box, resolución de muestreo y referencia vertical. No rellenes bordes desconocidos con superficies decorativas.

La exageración vertical empieza en 1x; cualquier cambio se anuncia y afecta solo al render, nunca al cálculo físico. La textura, cuando exista, debe estar corregistrada y con la resolución declarada. Los modos de color por elevación, pendiente y error llevan sus propias leyendas.

Coloca el observador en suelo local más altura radial/normal según el modelo explicitado. Para el caso actual habilita 0, 2 y 10 m con los resultados existentes. Un slider continuo solo se habilita cuando exista recalculo real, no interpolando afirmaciones de visibilidad entre esos tres valores.

Representa direcciones Sol/Tierra usando los vectores del escenario y de la convencion elegida. Un icono de la Tierra puede ser un marcador angular, pero no simular una fotografía desde el sitio. Los discos sobredimensionados para legibilidad deben avisarse; su tamaño visual no interviene en la clasificación de centro visible.

Función diferencial: 'Que tapa el Sol o la Tierra'. Al seleccionar un instante, dibuja el azimut hacia el cuerpo, la línea de visión y el punto o sector del terreno que controla el horizonte. Muestra distancia al obstaculo, elevación angular y producto usado. Vincula este punto al mapa y al perfil. Si el obstaculo esta fuera de la malla local, muestra su posición en el mapa regional y explica el límite del encuadre 3D.

No equipares la sombra producida por la iluminación gráfica de Three.js con el motor científico: el mapa de sombras de GPU puede tener límites distintos. Las clasificaciones y métricas deben seguir saliendo del motor validado.

# 12. Sol y Tierra: SPICE, Horizons y horizonte local

No existe en la documentación revisada una llamada única que sustituya toda la cadena de SITE REGRET. Horizons aporta efemérides; la obstrucción por terreno requiere DEM y cálculo del horizonte. El motor del proyecto ya contiene esa separación.

Preserva primero la referencia SPICE DE421, MOON_ME_DE421 y corrección NONE que declara el paquete. No cambies a una efemeride más nueva solo para decir que es la ultima. Una nueva versión debe declararse y compararse, sin alterar los resultados históricos de referencia.

Ecuacion conceptual del criterio actual de centro:
visible(t) = elevacion_del_centro(t) > horizonte_local(azimut(t), sitio, altura, terreno).

El horizonte debe incorporar curvatura lunar, cobertura local y regional, y posiciones del observador. El modelo vigente ya usa rayos curvos y un horizonte multiescala; reutilizalo y revisa sus límites antes de reimplementar nada.

Horizons documenta este endpoint:
https://ssd.jpl.nasa.gov/api/horizons.api

Ejemplo de parámetros para contrastar posiciones aparentes sin refracción en A, observador a 2 m sobre su suelo nominal:
format=json
COMMAND='10'
MAKE_EPHEM='YES'
EPHEM_TYPE='OBSERVER'
CENTER='coord@301'
COORD_TYPE='GEODETIC'
SITE_COORD='222.85134734999107,-89.45267485051369,1.958390869140625'
START_TIME='2026-11-14 00:00'
STOP_TIME='2026-11-14 01:00'
STEP_SIZE='10 m'
TIME_TYPE='UT'
QUANTITIES='4'
APPARENT='AIRLESS'
CSV_FORMAT='YES'
ELEV_CUT='-90'

Repite de manera serializada con COMMAND='399' para Tierra. El ejemplo es documental y requiere ejecución/validación; NO se presenta como resultado obtenido. SITE_COORD usa altura en km sobre la referencia de Horizons: el valor del ejemplo combina suelo nominal y mástil bajo la compatibilidad de datum que debe verificarse. No pasar simplemente 0.002 km por confundir altura sobre terreno con altura sobre referencia.

AIRLESS no convierte una posición aparente en geometrica NONE: sigue siendo una salida aparente sin refracción. El contraste existente usa otras convenciones y peticiones TT guardadas. Para reproducirlo lee esas peticiones, alinea instante y convenciones y compara contra el modo SPICE correspondiente, no contra el nominal indiscriminadamente.

El JSON de Horizons contiene la respuesta textual en result; no presupongas un array azimuth/elevation. Comprueba error, signature/versión, encabezado, cuerpo/centro, unidades, tiempos y delimitadores $$SOE/$$EOE. Conserva la respuesta original y la petición exacta.

Respeta la política SSD: solicitudes de API de una en una; no incrustar estas APIs directamente en la web. Preferimos SPICE local y consultas de Horizons fuera de la interfaz para precalculo/validación. No hagas un proxy público para eludir la política. Cualquier servicio propio será acotado, autorizado, con cache y límites, y no dependera de consultar JPL por cada frame del reproductor.

Separa centro visible, disco parcial/completo, eclipses, energia eléctrica y enlace RF. El modelo vigente no resuelve automáticamente todos esos fenomenos. Las mejoras de disco/eclipses se implementan como capacidades nuevas con pruebas; no se anuncian por mejorar el render del Sol.

# 13. Timeline, Comparador y Regret Lab

Timeline debe compartir sitio, ventana, altura, superficie e instante con Explore/Engineer. El reproductor cambia datos del escenario, no una animación orbital arbitraria. Una vista orbital puede ser esquematica en escala, pero debe respetar direcciones y llevar esa etiqueta. La vista de horizonte local es la referencia para explicar la ocultación.

Conserva los intervalos temporales, UNKNOWN y censura en los extremos. Una racha de sombra observada durante una ventana no demuestra la duracion completa de un evento que empieza antes o termina después. Refina los eventos cerca del horizonte solo mediante una ejecución versionada; no atribuyas precisión de segundos a bins de diez minutos.

Comparador conserva empates y criterio antes del ganador. Une cada diferencia a la métrica, ventana, altura y familia de escenarios. No mezcles unidades ni conviertas diferentes objetivos en una puntuacion sin definir normalizacion y pesos.

Regret Lab debe explicar cuando cambia la preferencia al cambiar terreno o parámetros. Conserva separación de nominal, hipótesis propias y clones publicados. La frecuencia de victorias entre cinco clones no es una probabilidad calibrada de exito.

Conecta el laboratorio con el mapa: mostrar la diferencia de elevación entre dos superficies o el sector del horizonte responsable de un cambio es más util que una foto. Si esa atribucion causal no se ha calculado, no marques una montaña aleatoria como causa. El análisis de sensibilidad debe mostrar exactamente que cambio y que se mantuvo fijo.

# 14. Estado, computación y arquitectura sin resultados falsos

Conserva SelectionProvider y la sincronización URL existente en la medida compatible. Introduce un modelo espacial versionado que distinga:
- Caso de referencia: A/B, W1/W2, alturas 0/2/10, superficies disponibles.
- Exploracion cartográfica: coordenada arbitraria y capas consultables, sin prometer métricas calculadas.
- Escenario calculado nuevo: parámetros completos, job terminado y artefactos científicos asociados.

Mover un marcador a otro lugar NO autoriza a seguir mostrando métricas del sitio anterior. Invalida los resultados o indica claramente que son una comparación de referencia distinta. Nunca conviertas calculando en cero ni uses datos antiguos sin etiqueta.

Las claves de cache incorporan sitio/coordenadas, alturas, fechas, paso temporal, variante, hashes de DEM, cobertura, referencia, kernels, correcciones y versión del algoritmo. Cambiar un parámetro físico invalida los derivados afectados. Cambiar opacidad o exageración visual no recalcula la física.

Arquitectura inicial recomendada:
1. Frontend estático actual para la demostración reproducible.
2. Proceso de preparacion geoespacial que descarga, verifica y genera recortes, teselas y mallas.
3. Servicios públicos de mapas consultados según sus políticas y con alternativa local real para la zona preparada.
4. Solo después, servicio de computación propio para escenarios arbitrarios, con trabajos, límites, cache y versionado.

No metas gigabytes de DEM en JavaScript ni calcules todos los horizontes durante una petición de página. No afirmes que Vercel ejecuta Python o un worker geoespacial si el despliegue sigue siendo un export estático. Si necesitas cambiar el despliegue, documenta la decisión y manten la versión reproducible independiente. No contrates servicios ni anadas costes sin autorización.

# 15. Scientific Evidence: procedencia accesible desde cada resultado

Cada capa, pixel inspeccionado, perfil y resultado debe enlazar a evidencia relacionada, no a una bibliografia generica desconectada.

Panel mínimo: producto, proveedor, instrumento/misión, identificador, observación/procesamiento/descarga disponibles, resolución, CRS, referencia vertical, cobertura, unidades, nodata, advertencias, URL original, licencia/crédito y checksum completo cuando proceda. Un resultado derivado incluye configuración, algoritmos, kernels y cadena de entradas.

Distingue NASA/PDS original, derivación SITE REGRET e hipótesis del usuario. El hecho de que una fuente sea oficial no convierte nuestro cálculo en un producto certificado por NASA. Conserva terminos, atribucion y restricciones de cada proveedor; no asumas una licencia universal para todo lo encontrado en Internet.

Exporta un pequeño expediente reproducible con selección, manifiestos, referencias, métricas disponibles y límites. No incluyas rutas personales, tokens de descarga temporal, credenciales ni secretos en el bundle o en el informe.

# 16. Pruebas obligatorias y criterios de aceptación

Ejecuta primero la batería existente y conserva los resultados. Si no puedes ejecutarla, registra el motivo; no declares los tests verdes por leer README.

T1 Autenticidad: inventario de assets completo; ningún paisaje inventado aparece como dato lunar. Cada capa tiene procedencia.
T2 WMTS: capacidades parseadas, matrices/formatos correctos, al menos una tesela real recibida, verificación de firma y prueba visual de alineacion. Una respuesta XML no prueba que una tesela funcione.
T3 ODE: consulta documentada con productos reales, identificadores, etiquetas y huellas; paginación comprobada; cero resultados no significa error ni autoriza a inventar productos.
T4 DEM: archivo completo verificable, lectura numérica, nodata/escala/CRS correctos y muestras reproducibles en A/B; una cabecera TIFF no completa la prueba.
T5 Corregistro: A/B, ROI, DEM e imagen coinciden bajo una transformacion demostrada; comprobar esquinas, centros de pixel y varios puntos de control, con tolerancias justificadas por fuente.
T6 Metrologia: pruebas de radio lunar, unidades, coordenadas, ida/vuelta de proyección y perfiles con nodata. No copiar tolerancias terrestres sin razonamiento.
T7 3D: alturas del mesh coinciden con el raster de origen dentro del error de muestreo declarado; exageración visual no cambia resultados; no calcular sobre alturas simplificadas sin documentación.
T8 Geometria: dirección ENU, periodicidad de azimut, curvatura, altura del observador, horizonte regional y convenciones temporales/correcciones validadas. Comparacion Horizons/SPICE bajo convenciones compatibles.
T9 Regresion: el paquete de referencia y sus hashes no cambian por incorporar mapas. Cualquier nueva ciencia genera nueva versión, no sobrescribe la referencia.
T10 Interaccion: al cambiar sitio/fecha/altura, todas las vistas muestran el mismo escenario o un estado pendiente explícito. Cambiar una capa cambia realmente la imagen, no solo un checkbox.
T11 Fallos: HTTP200 con HTML, timeout, CORS no permitido, archivo truncado, versión API distinta, fuera de cobertura y datos desconocidos no producen resultados falsos.
T12 Offline: la zona preparada abre desde servidor local sin red con datos reales; lo no almacenado indica no disponible. No declarar una prueba sin desconexión efectiva.
T13 Experiencia: carga diferida, cancelación de peticiones obsoletas, memoria acotada, interacción por teclado, leyendas legibles, ES/EN y pruebas de pantalla pequeña. Informar medidas reales, no puntuaciones Lighthouse inventadas.

Construye pruebas unitarias para transformaciones/parsers/estados, integración sobre fixtures reales versionados y E2E del flujo completo. Los fixtures artificiales de parsers deben estar en tests y marcados como tales; nunca publicarse como datos científicos.

# 17. Secuencia de implementación y disciplina de trabajo

Fase 0: leer instrucciones, identificar HEAD, inventariar assets, comprobar scripts y capturar línea base. Preservar cambios de otras personas.
Fase 1: registro de fuentes, descargador verificable, adaptador WMTS y mapa 2D de Connecting Ridge con A/B. Sustituir ContextMap como vista principal, conservar la figura como referencia.
Fase 2: capas numéricas DEM/calidad y perfil/medidas; recortes de SiteThumb ligados a la misma región. Implementar navegador ODE para buscar imágenes/huellas, sin bloquear el mapa si el catálogo falla.
Fase 3: malla local de DEM y sustitución de MastScene; direcciones reales y vinculación mapa-perfil-obstaculo.
Fase 4: sincronización Timeline/Engineer, Evidence por elemento y Regret Lab conectado a las superficies reales.
Fase 5: cálculo de escenarios nuevos donde haya cobertura y recursos; separar claramente la capacidad nueva del caso fijo. Optimizar, validar y documentar.

Cada fase entrega código ejecutable, pruebas y evidencia. No declares completada la plataforma entera por mostrar una tesela. Tampoco retrases todo esperando tener una API perfecta para cada fuente: integra primero el caso concreto con datos verificados y deja visibles los límites.

Puedes proponer nuevas carpetas como src/lib/geospatial/, src/components/maps/, src/components/terrain/ y scripts/geospatial/, pero adapta nombres a la arquitectura encontrada. Mantiene tipos separados para observación, raster numérico, render y resultado científico. No metas toda la implementación en un componente gigantesco.

No publiques en producción, borres assets irreversiblemente, cambies permisos o contrates infraestructura sin autorización. Trabaja en cambios revisables. Los archivos ilustrativos retirados pueden archivarse fuera de la vista científica para no perder historia.

# 18. Formato del resultado que debes entregar

Entrega cambios implementados, instrucciones para ejecutarlos y una tabla con función, archivos modificados, fuente real, prueba realizada, resultado y limitacion pendiente. Adjunta capturas reales de tu ejecución, no mockups. Distingue probado, implementado sin prueba en vivo y pendiente.

El resumen debe responder: que recursos falsos/ilustrativos se sustituyeron; que recursos científicos existentes se conservaron; que productos concretos se descargaron; que capas y mediciones funcionan; como se obtiene la geometría; que no esta calculado; y que debe revisar el equipo antes de desplegar.

No respondas solo con un plan ni con una lista de APIs. Implementa el primer recorrido vertical, verifica su funcionamiento y continua con las fases que puedas completar sin inventar resultados.

# 19. Referencias de entrada y alcance de esta investigación

Fuentes oficiales para comprobar contratos y productos:
- https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon
- https://trek.nasa.gov/moon/
- https://api.nasa.gov/
- https://imbrium.mit.edu/
- https://ode.rsl.wustl.edu/moon/
- https://ode.rsl.wustl.edu/odeholdings/Moon_holdings.html
- https://oderest.rsl.wustl.edu/
- https://oderest.rsl.wustl.edu/ODE_REST_V2.1.6.pdf
- https://pgda.gsfc.nasa.gov/products/78
- https://pgda.gsfc.nasa.gov/products/90
- https://pds.lroc.asu.edu/
- https://planetarynames.wr.usgs.gov/GIS_Downloads
- https://ssd-api.jpl.nasa.gov/doc/horizons.html
- https://ssd.jpl.nasa.gov/horizons/manual.html
- https://ssd-api.jpl.nasa.gov/doc/
- https://naif.jpl.nasa.gov/pub/naif/generic_kernels/
- https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/azlcpo_c.html
- https://openlayers.org/en/latest/examples/wmts-layer-from-capabilities.html

Se han revisado documentación oficial y archivos del repositorio. No se ha ejecutado aqui una integración de la web, una auditoría visual completa del despliegue, una descarga completa de los DEM ni una prueba exitosa de los endpoints binarios. El verificador adjunto es una herramienta para obtener esa evidencia en un entorno con red, no evidencia de que ya se haya conseguido.
