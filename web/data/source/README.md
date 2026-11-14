# data/source — originales científicos (no editar)

Copia byte a byte de una selección de `SITE_REGRET_TRANSFERENCIA_COMPLETA.zip`, con la misma estructura de rutas que la transferencia. `npm run data` verifica **cada archivo de esta carpeta** contra `SHA256_TRANSFERENCIA.txt` y aborta si alguno no figura en la lista o su hash no coincide. Este README es el único archivo propio y se excluye de la comprobación.

## Qué se incluye

| Ruta | Para qué |
|---|---|
| `DERIVADOS_SITE_REGRET/paquete_frontend.json` | Fuente única de los datos de la web (site-regret/0.1, 12.464.735 bytes) |
| `DERIVADOS_SITE_REGRET/datos/{pasaporte,contexto_2d,eventos_acotados,sitios}.json` | Complementos fuera del JSON raíz y pasaporte |
| `DERIVADOS_SITE_REGRET/{CONTRATO_DATOS.md, README_DESARROLLO.md, RESUMEN.json, configuracion.json, SHA256SUMS.txt, INFORME_RESULTADOS.html}` | Contrato, resumen e informe estático |
| `DERIVADOS_SITE_REGRET/{figuras,validacion,motor,documentacion}/` | Figuras SVG, validaciones, motor Python y documentación de apoyo |
| `00_LEER_PRIMERO/*` | Contexto, guía de integración, modelo científico, fuentes, trazabilidad y script de verificación |
| `SHA256_TRANSFERENCIA.txt` | Lista de hashes de la transferencia (autoridad de integridad) |

## Qué se omite a propósito

- `datos/escenarios.json`, `datos/comparaciones.json`, `datos/efemerides_nominales.json`, `datos/horizonte_A.json`, `datos/horizonte_B.json`: son copias desglosadas del mismo contenido de `paquete_frontend.json`; la guía de integración indica no cargar agregado y duplicados a la vez.
- `RECOPILACION_DATOS_2026-11-14/` y `SITE_REGRET_V2/`: investigación, originales NASA y especificación. No son necesarios para la interfaz; siguen en el ZIP original.

Para regenerar la ciencia hay que restaurar los DEM omitidos según el pasaporte; esta carpeta no sirve para eso y la web nunca ejecuta el motor.
