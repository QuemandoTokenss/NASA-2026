# Validation

Log each check with the commit, inputs, command, expected result and observed result. Include a negative case and document the limits of what the check establishes.

| Date | Commit (`web/`) | Command | Expected | Observed |
| --- | --- | --- | --- | --- |
| 2026-11-14 | `3801c17` | `npm run typecheck && npm run lint` | 0 errors | 0 errors |
| 2026-11-14 | `3801c17` | `npm test` (Vitest, 7 files) | All pass | 63/63 — originals match `SHA256_TRANSFERENCIA.txt`; split + reassembly identical; 720 metrics reproduced from `state_codes`; robustness counts match the cases; negative contract cases rejected |
| 2026-11-14 | `3801c17` | `npm run test:e2e` (Playwright, Edge) | All pass | 47/47 — 24 winners match the contract, demo case values, a tampered `core.json` blocks the UI (negative case), axe-core WCAG 2.1 A/AA with 0 violations, story mode and language switch |
| 2026-11-14 | `3801c17` | `E2E_BASE_URL=https://site-regret.vercel.app npx playwright test` | All pass | 47/47 against production; served package SHA-256 = `e7c8984b…`; `qa_entradas.json` not published (404) |

Offline evidence for [issue #5](https://github.com/QuemandoTokenss/NASA-2026/issues/5), recorded 2026-11-14. These are reports of earlier checks, not checks rerun during this documentation update:

| Evidence | Commit / input | Laptop, OS and browser | Command / procedure | Expected | Observed |
| --- | --- | --- | --- | --- | --- |
| Human observation confirmed by Aritz | `web/` commit `3801c17`; prebuilt `web-out/` from `SITE_REGRET_paquete_equipo.zip` | Aritz's laptop, different from Hugo's; Windows 10 build 19045.2965; Node 24.19.0; Microsoft Edge (exact version not measured) | From the repository root: `node web/scripts/serve-static.ts <extracted>/web-out 4173`; disable network connections and open the demo at `http://127.0.0.1:4173` and `/evidencia/` | Demo loads; header shows `e7c8984b…`; `/evidencia/` shows «Verified» | Aritz confirmed the demo loaded and the expected hash and verification were displayed with network connections disabled |
| Earlier automated browser test (separate evidence) | Local static export; separate automated check | Browser automation with external requests blocked | Request an unknown route on the local static server | Unknown route returns HTTP 404 | Unknown route returned HTTP 404 (automated negative case) |

The offline scenario **replays precalculated results** from the package; it does not recompute the scientific engine. Aritz's confirmation is a human observation on the second laptop. The earlier automated test blocked external requests in the browser; it is not evidence that the laptop's network connections were disabled. The automated 404 result is not attributed to the human test. See [DEMO.md](DEMO.md) for the scenario and serving instructions.

Limits: these checks show that the web app reads and displays the package faithfully. They do not validate the DEM accuracy or the engine itself (see the engine 414 stored checks in `/evidencia/`). The exact browser version for Aritz's human test was not measured. The screen-reader test remains pending.
