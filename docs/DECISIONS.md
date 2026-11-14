# Decisions

GitHub issues and pull requests coordinate the team. Agent Orchestrator runs locally on each laptop. Record engineering and scientific decisions here with their rationale and linked evidence.

## 2026-11-14 · Web app

- The web app is a static Next.js export in `web/`; it only reads the precomputed package and verifies hashes in the browser. Full log of decisions D1–D19 with rationale: [`web/DECISIONS.md`](../web/DECISIONS.md).
- Raw NASA downloads (`RECOPILACION_DATOS_2026-11-14`) stay out of Git and are shared in the team zip, as required by `AGENTS.md`.
- Deployed to Vercel from the CLI (project `site-regret`); automatic deploys from GitHub are not configured yet.
