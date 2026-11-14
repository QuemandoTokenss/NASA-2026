# Demo

Working scenario (all values read from `site-regret/0.1`, package SHA-256 `e7c8984b2bcfe804bdabed0d13a9f812d34739b6d1e957466ced784bd86fd936`):

- Window W2 (14 Dec 2026 → 13 Jan 2027), observer at 0 m, criterion *minimise the longest stretch without Sun*.
- Nominal surface: A = 38 h 40 min, B = 14 h 40 min → B wins.
- Team hypothesis `correlated_plus`: A = 32 h 30 min, B = 49 h → A wins; keeping B costs a REGRET of 16 h 30 min.
- B holds in 2/4 team hypotheses and 4/5 published clones (counts, not probabilities).

Where to show it: Dashboard → *Start the demo case* (Regret Lab, 6 steps) or `/historia/` (7 scenes, arrow keys to move, F for full screen). Live: https://site-regret.vercel.app/historia/

Offline replay (results are **replayed** from the package, not recomputed):

```bash
cd web
npm ci
npm run build
npm run serve     # http://127.0.0.1:4173, no network needed
```

The browser checks every data file against its SHA-256 (requires `localhost`/`127.0.0.1` or https). The prebuilt `web-out/` folder in the team zip can be served the same way: `node web/scripts/serve-static.ts <path>/web-out 4173`. Second-laptop test still pending (issue #5).
