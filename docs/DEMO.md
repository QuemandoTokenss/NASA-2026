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

The browser checks every data file against its SHA-256 (requires `localhost`/`127.0.0.1` or https). The prebuilt `web-out/` folder in `SITE_REGRET_paquete_equipo.zip` can be served from the repository root without rebuilding:

```text
node web/scripts/serve-static.ts <extracted>/web-out 4173
```

Second-laptop evidence for [issue #5](https://github.com/QuemandoTokenss/NASA-2026/issues/5), recorded 2026-11-14:

- **Human observation, confirmed by Aritz:** on Aritz's Windows laptop, a different laptop from Hugo's, the prebuilt team ZIP export (`web/` commit `3801c17`) was served with the command above at `http://127.0.0.1:4173`. With network connections disabled, the demo loaded in Microsoft Edge, the header displayed the expected package hash `e7c8984b…`, and `/evidencia/` displayed «Verified». The exact browser version was not measured for this human test.
- **Earlier automated browser test:** external requests were blocked. Its negative case was an unknown route returning HTTP 404. Blocking external requests in browser automation is distinct from Aritz's human observation with network connections disabled.

This is **replay of precalculated results** from the package, not a rerun of the scientific engine. The human observation is recorded as reported by Aritz; these documentation edits do not rerun either check. See [VALIDATION.md](VALIDATION.md) for the evidence and limits.
