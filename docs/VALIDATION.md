# Validation

Log each check with the commit, inputs, command, expected result and observed result. Include a negative case and document the limits of what the check establishes.

| Date | Commit (`web/`) | Command | Expected | Observed |
| --- | --- | --- | --- | --- |
| 2026-11-14 | `3801c17` | `npm run typecheck && npm run lint` | 0 errors | 0 errors |
| 2026-11-14 | `3801c17` | `npm test` (Vitest, 7 files) | All pass | 63/63 — originals match `SHA256_TRANSFERENCIA.txt`; split + reassembly identical; 720 metrics reproduced from `state_codes`; robustness counts match the cases; negative contract cases rejected |
| 2026-11-14 | `3801c17` | `npm run test:e2e` (Playwright, Edge) | All pass | 47/47 — 24 winners match the contract, demo case values, a tampered `core.json` blocks the UI (negative case), axe-core WCAG 2.1 A/AA with 0 violations, story mode and language switch |
| 2026-11-14 | `3801c17` | `E2E_BASE_URL=https://site-regret.vercel.app npx playwright test` | All pass | 47/47 against production; served package SHA-256 = `e7c8984b…`; `qa_entradas.json` not published (404) |

Limits: these checks show that the web app reads and displays the package faithfully. They do not validate the DEM accuracy or the engine itself (see the engine 414 stored checks in `/evidencia/`). Not done yet: screen-reader test and the second offline laptop.

## Independent review of P0-E2E · 2026-11-14

Base commit `987899d`. Windows, Node 24.19.0, npm 11.17.0 and system Microsoft Edge.

| Check | Expected | Observed |
| --- | --- | --- |
| `cd web && npm ci && npm run verify` | Clean install, typecheck, lint, unit tests, static build and browser suite | Exit 0. 63/63 Vitest and 47/47 Playwright. All 24 winner combinations matched the data. The demo from the Dashboard and all seven presentation scenes passed. npm reported seven moderate advisories (issue #11). |
| Negative case in Playwright | A tampered `core.json` blocks the UI | Passed. The altered response was rejected. The original transfer files were preserved. |
| Team ZIP export (web commit `3801c17`), served on loopback | Dashboard demo and seven presentation scenes work from the provided export | The two targeted Playwright tests passed. The two nested ZIP hashes and the frontend package hash matched `LEEME_ZIP.md`. Edge showed Verified and the `e7c8984b…` hash with external requests blocked in the browser. An unknown route returned 404. |

The export replays the precalculated package. Physical network disconnection is a separate check under issue #5.
