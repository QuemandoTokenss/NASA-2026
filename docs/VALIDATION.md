# Validation

Log each check with the commit, inputs, command, expected result and observed result. Include a negative case and document the limits of what the check establishes.

| Date | Commit (`web/`) | Command | Expected | Observed |
| --- | --- | --- | --- | --- |
| 2026-11-14 | `3801c17` | `npm run typecheck && npm run lint` | 0 errors | 0 errors |
| 2026-11-14 | `3801c17` | `npm test` (Vitest, 7 files) | All pass | 63/63 — originals match `SHA256_TRANSFERENCIA.txt`; split + reassembly identical; 720 metrics reproduced from `state_codes`; robustness counts match the cases; negative contract cases rejected |
| 2026-11-14 | `3801c17` | `npm run test:e2e` (Playwright, Edge) | All pass | 47/47 — 24 winners match the contract, demo case values, a tampered `core.json` blocks the UI (negative case), axe-core WCAG 2.1 A/AA with 0 violations, story mode and language switch |
| 2026-11-14 | `3801c17` | `E2E_BASE_URL=https://site-regret.vercel.app npx playwright test` | All pass | 47/47 against production; served package SHA-256 = `e7c8984b…`; `qa_entradas.json` not published (404) |

Limits: these checks show that the web app reads and displays the package faithfully. They do not validate the DEM accuracy or the engine itself (see the engine 414 stored checks in `/evidencia/`). Not done yet: screen-reader test and the second offline laptop.
