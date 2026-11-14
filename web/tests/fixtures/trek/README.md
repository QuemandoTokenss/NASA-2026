# Respuestas reales de Moon Trek (no son datos sintéticos)

Archivos descargados tal cual del servicio WMTS público de NASA Solar System Treks el **14 de noviembre de 2026**, para probar el lector de capacidades y servir de respuesta fija en las pruebas de navegador (que no deben depender de la red).

| Archivo | URL de origen |
|---|---|
| `LRO_NAC_Mosaic_1mpp_SP.WMTSCapabilities.xml` | https://trek.nasa.gov/tiles/Moon/SP/LRO_NAC_Mosaic_1mpp_SP/1.0.0/WMTSCapabilities.xml |
| `LRO_WAC_Mosaic_SPole60_100m_v02.WMTSCapabilities.xml` | https://trek.nasa.gov/tiles/Moon/SP/LRO_WAC_Mosaic_SPole60_100m_v02/1.0.0/WMTSCapabilities.xml |
| `LRO_NAC_Mosaic_1mpp_SP.z12.r2070.c2026.png` | https://trek.nasa.gov/tiles/Moon/SP/LRO_NAC_Mosaic_1mpp_SP/1.0.0//default/default028mm/12/2070/2026.png (tesela que contiene el sitio A) |

En las pruebas E2E esa única tesela real se devuelve para cualquier fila/columna: sirve para comprobar que el mapa pide y dibuja teselas, **no** para comprobar la alineación de la imagen. La alineación se comprueba con la red real (ver `docs/GEOESPACIAL.md`).
