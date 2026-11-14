# Respuestas reales de ODE REST (no son datos sintéticos)

Descargadas tal cual de `https://oderest.rsl.wustl.edu/live2/` (ODE V2.1.5) el **14 de noviembre de 2026**. Consulta base:

`?query=product&target=moon&ihid=LRO&iid=LROC&pt=CDRNAC4&output=JSON&westernlon=222.4&easternlon=223.1&minlat=-89.48&maxlat=-89.44&loc=f`

| Archivo | Parámetros añadidos |
|---|---|
| `product_CDRNAC4_count.json` | `results=c` (total: 253) |
| `product_CDRNAC4_offset1_limit5.json` | `results=copm&limit=5&offset=1` |
| `product_CDRNAC4_offset6_limit5.json` | `results=copm&limit=5&offset=6` |
| `product_invalid_iipt_error.json` | misma consulta con `pt=CDRNAC` (tipo inexistente): HTTP 200 con `Status: "ERROR"` |

El recuento y los productos pueden cambiar cuando ODE actualice su catálogo; estas respuestas fijan las pruebas, no el estado actual del archivo.
