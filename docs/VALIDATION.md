# Validation

Log each check with the commit, inputs, command, expected result and observed result. Include a negative case and document the limits of what the check establishes.

| Date | Commit (`web/`) | Command | Expected | Observed |
| --- | --- | --- | --- | --- |
| 2026-11-14 | `3801c17` | `npm run typecheck && npm run lint` | 0 errors | 0 errors |
| 2026-11-14 | `3801c17` | `npm test` (Vitest, 7 files) | All pass | 63/63 — originals match `SHA256_TRANSFERENCIA.txt`; split + reassembly identical; 720 metrics reproduced from `state_codes`; robustness counts match the cases; negative contract cases rejected |
| 2026-11-14 | `3801c17` | `npm run test:e2e` (Playwright, Edge) | All pass | 47/47 — 24 winners match the contract, demo case values, a tampered `core.json` blocks the UI (negative case), axe-core WCAG 2.1 A/AA with 0 violations, story mode and language switch |
| 2026-11-14 | `3801c17` | `E2E_BASE_URL=https://site-regret.vercel.app npx playwright test` | All pass | 47/47 against production; served package SHA-256 = `e7c8984b…`; `qa_entradas.json` not published (404) |

Limits: these checks show that the web app reads and displays the package faithfully. They do not validate the DEM accuracy or the engine itself (see the engine 414 stored checks in `/evidencia/`). Not done yet: screen-reader test and the second offline laptop.

## DEPS-01 audit · 2026-11-14

Audited the lockfile at `987899d` with Node 24.19.0 and npm 11.17.0.

| Check in `web/` | Expected | Observed |
| --- | --- | --- |
| `npm audit --json` | List each advisory and its affected package paths | Exit 1. Seven moderate entries trace to one advisory, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). |
| `npm audit --omit=dev --json` | Identify entries in npm's production dependency tree | Exit 0. Zero entries. |
| `npm audit fix --dry-run --json` | Check whether npm can apply a compatible fix | Exit 1. Seven entries remained; zero packages added, changed or removed. |
| `npm run verify` | Typecheck, lint, 63 unit/data checks, static build, 47 browser checks | Exit 0, 63/63 and 47/47. Negative case: a tampered `core.json` response blocked the UI. |

The affected copy is `web/node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch` (10.2.6). npm also flags six dependent packages at version 8.72.2: `typescript-eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree` and `@typescript-eslint/utils`. Each is installed directly under `web/node_modules/` at the path spelled by its package name. The chain starts with the development dependency `eslint-config-next`. It is used by ESLint during development and CI. The deployed application serves only the generated `out/` export. The other installed copy, `minimatch@3.1.5`, falls outside the advisory range.

The upstream `@typescript-eslint/typescript-estree@8.72.2` requires `minimatch ^10.2.2`; the advisory lists `11.0.1` as the first patched version. Keep the installed versions pending a compatible upstream release. No package manifests or lockfiles changed.
