# SITE REGRET · Datos derivados para desarrollo

Esta entrega convierte los originales reunidos en un paquete reproducible para dos puntos de Connecting Ridge, dos ventanas UTC y tres alturas. La autorización de empezar ahora fue confirmada por el usuario en este chat. No sustituye la revisión humana de la entrega del hackathon.

## Empezar por los resultados

1. Abrir `INFORME_RESULTADOS.html`: informe estático, gráficos y cifras reales. Funciona sin Internet.
2. Leer `CONTRATO_DATOS.md`.
3. Integrar `paquete_frontend.json` en el frontend como archivo estático propio. Permite trabajar con los escenarios entregados sin API NASA en vivo.
4. Conservar `datos/pasaporte.json` y las validaciones junto a cualquier exportación o demo.

Cada sitio tiene diez superficies: nominal, cuatro perturbaciones propias y cinco clones publicados. Se calculan 120 escenarios y seis comparaciones de A/B, cada una con cuatro criterios. Las dos ventanas duran 30 días: 14/11/2026–14/12/2026 y 14/12/2026–13/01/2027, siempre UTC. Son ventanas iniciales para desarrollo, no fechas oficiales de una misión.

## Archivos y funciones

| Ruta | Uso |
|---|---|
| `datos/sitios.json` | Coordenadas verificadas, elevación, conteo y error RMS |
| `datos/horizonte_A.json`, `horizonte_B.json` | Terreno a 0/2/10 m para las diez superficies |
| `datos/efemerides_nominales.json` | Sol y Tierra: azimut, elevación y distancia por instante |
| `datos/escenarios.json` | Estados, intervalos y métricas de cada combinación |
| `datos/comparaciones.json` | Utilidades, elecciones, regret y frases deterministas |
| `datos/eventos_acotados.json` | Cruces con cotas temporales de diez minutos |
| `validacion/` | Pruebas, contraste Horizons, calidad y convergencia |
| `figuras/` | Gráficos SVG de los resultados |
| `motor/` | Código para repetir el procesamiento y la entrega |

## Reproducir el cálculo

El motor espera esta estructura hermana dentro de «Hackaton NASA»:

```
Hackaton NASA/
  RECOPILACION_DATOS_2026-11-14/datos_originales/...
  DERIVADOS_SITE_REGRET/motor/pipeline.py
```

El paquete de resultados permite desarrollar la interfaz sin descargar de nuevo los originales. Para regenerar la ciencia se necesitan los originales del primer paquete. El motor descarga, si falta, el DEM adicional `LDEM_60S_240MPP_ADJ.TIF` desde PGDA 90, con rangos de bytes comprobados. Los demás originales deben coincidir con los hashes del pasaporte.

Con Python compatible, crear un entorno aislado e instalar las versiones de `motor/requirements.lock.txt`. Ejecutar `motor/pipeline.py` y después `motor/entregar_paquete.py`. Las ventanas y parámetros de esta versión se declaran en `motor/pipeline.py`; `configuracion.json` documenta lo ejecutado, no es todavía una API de entrada arbitraria.

En este ordenador se ha usado `.venv/Scripts/python.exe` dentro de esta carpeta. El entorno y la caché no forman parte del ZIP portable. Las respuestas Horizons se conservan y se reutilizan: las solicitudes nuevas se hacen de una en una, con un User-Agent de proyecto y contacto público del equipo.

## Qué falta para vuestra aplicación

La interfaz final debe conectar estas salidas con el comparador, curvas, altura, fechas disponibles y explicación de incertidumbre. Elegir otras fechas requiere volver a generar efemérides y métricas; elegir otros puntos requiere volver a comprobar terreno y horizontes. No es correcto trasladar los resultados de A/B a coordenadas arbitrarias.

Para ampliar la robustez se pueden incorporar los 95 clones de Site01 que no estaban en la selección inicial. Cinco permiten probar el flujo y enseñar sensibilidad, pero no justifican percentiles del ensemble completo. La implementación de esta entrega conserva esa limitación.

La prueba del producto completo sin Internet en otro portátil y las pruebas de uso de la interfaz siguen pendientes: aquí se ha validado el paquete científico y su contrato, no una aplicación web desplegada.

## Validación y límites

El informe muestra los valores medidos de contraste y convergencia, sin sustituirlos por tolerancias deseadas. Se comprueban marcos, bases locales, puntos dentro de ROI, muestras válidas, monotonicidad con altura, contabilidad de intervalos, límites de métricas, regret y hashes.

La fuente externa Horizons devuelve posiciones aparentes DE441; se contrasta contra SPICE DE421 en modo aparente CN+S y se declaran diferencias de modelo y relatividad. Las métricas finales usan el modo geométrico NONE del plan. El acuerdo angular no mide la precisión del DEM.

El terreno se interpola bilinealmente, con tres escalas y sin corrección vertical automática entre mosaicos. El pasaporte incluye el desacuerdo medido en el solape local/regional. Las perturbaciones propias se atenúan en los dos sitios y en el borde del parche para representar error diferencial, sin introducir un salto artificial en la unión con la capa regional.

Fuentes: NASA PGDA 78 y 90, LRO-LOLA, JPL/NAIF DE421 y JPL Horizons. Citar Barker et al. 2021, DOI 10.1016/j.pss.2020.105119; Barker et al. 2023, DOI 10.3847/PSJ/acf3e1; y el conjunto de datos 10.60903/gsfcpgda-lola-spole. No implica respaldo NASA ni aptitud operacional.
