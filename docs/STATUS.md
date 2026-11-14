# Project status

Updated 2026-11-14. Detail: [TRABAJO_REALIZADO.md](TRABAJO_REALIZADO.md).

| Gate | Status | Acceptance | Current evidence |
| --- | --- | --- | --- |
| DATA-00 | Partly done · needs human check | Verify an exact NASA challenge resource, terms, metadata and checksum. | Transfer package hashes verified (`web/data/source/SHA256_TRANSFERENCIA.txt`, 47 files) and 18 NASA source assets with URL and hash in the passport. The challenge *Resources* tab entry and its terms are not yet checked by a person. |
| GEO-01 | Evidence available · needs review | Confirm two sites, reference frame, coverage and time conventions. | A = ROI 4 (−89.4527°, 222.8513° E), B = ROI 6 (−89.4739°, 222.6246° E), ROI membership verified; frame `MOON_ME_DE421`; windows W1/W2 in UTC at 10-minute steps. |
| SCI-01 | Evidence available · needs review | Compare geometry against analytical checks and document tolerances. | 414/414 stored engine checks (including analytic sphere and obstacle cases), 8 JPL Horizons cross-checks, spatial and temporal convergence; shown in the web app at `/evidencia/`. |
| P0-E2E | Done · in review | Compare two sites and two windows across three heights using verified inputs. | `web/` app: all 24 window × height × criterion winners match the contract in E2E tests; demo case W2 · 0 m reproduced. |
| OFFLINE | Open | Reproduce the scenario and hash on a second laptop without network access. | Static build served from 127.0.0.1 on one laptop only. |
| SUBMIT | Open | Have two team members review the final submission. | — |
