# NASA-2026 · SITE REGRET

Quemando Tokens · NASA Space Apps Challenge Bilbao 2026

SITE REGRET is a prototype for comparing two candidate lunar landing sites across two time windows and three observer heights. The team will document the source and uncertainty behind each comparison.

## Start here

1. Clone this repository and open the local copy in Agent Orchestrator.
2. Choose a GitHub issue and create a Codex worker in its own branch.
3. Open a pull request with the checks you ran. A teammate reviews the result before it goes into `main`.

See [project status](docs/STATUS.md) and [source verification](docs/SOURCES.md).

## Web app

The working prototype is in [`web/`](web) — live at https://site-regret.vercel.app (presentation mode: `/historia/`, English: `?lang=en`).

```bash
cd web
npm ci
npm run dev       # http://localhost:3000
npm run verify    # typecheck, lint, unit tests, build and browser tests
```

What has been done so far, how it was checked and what is left: [docs/TRABAJO_REALIZADO.md](docs/TRABAJO_REALIZADO.md).
