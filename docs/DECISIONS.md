# Decisions

GitHub issues and pull requests coordinate the team. Agent Orchestrator runs locally on each laptop. Record engineering and scientific decisions here with their rationale and linked evidence.

## 2026-11-14 · Web app

- The web app is a static Next.js export in `web/`; it only reads the precomputed package and verifies hashes in the browser. Full log of decisions D1–D19 with rationale: [`web/DECISIONS.md`](../web/DECISIONS.md).
- Raw NASA downloads (`RECOPILACION_DATOS_2026-11-14`) stay out of Git and are shared in the team zip, as required by `AGENTS.md`.
- Deployed to Vercel (project `site-regret`). Superseded on 2026-11-14: the project is now connected to GitHub and every push to `main` is published to production, so `main` only changes through reviewed pull requests (see `docs/continuidad/HANDOFF.md` §0).
