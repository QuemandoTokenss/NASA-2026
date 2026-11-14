# Source verification

Current state: `RESOURCE_TAB_UNVERIFIED`. For each verified resource, record the exact challenge Resources entry, product URL, identifier, terms of use, download date, original checksum and the calculation that uses it.

## Package traceability (2026-11-14)

The derived package used by the web app carries its own provenance: `web/data/source/00_LEER_PRIMERO/` (asset traceability and JSON map), `web/data/source/SHA256_TRANSFERENCIA.txt` (47 files, checked by the tests) and the passport `web/data/source/DERIVADOS_SITE_REGRET/datos/pasaporte.json` (18 source assets with URL, SHA-256 and status). Main sources: LOLA PGDA78 Site01 (5 m DEM, error layers, ROIs, published clones), PGDA90 mosaics (80 m and 240 m), NASA/JPL NAIF SPICE DE421 kernels and a JPL Horizons cross-check. The state above stays `RESOURCE_TAB_UNVERIFIED` until a teammate confirms the exact challenge Resources entry and its terms (issue #1).
