# SITE REGRET

QuemandoTokens · NASA Space Apps Challenge Bilbao 2026 · [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/)

SITE REGRET compares two candidate sites near the Moon’s south pole. It shows when terrain blocks the Sun or Earth and how a change in the terrain model can change which site you would pick.

[Open the app in English](https://site-regret.vercel.app/?lang=en) · [Try the guided scenario](https://site-regret.vercel.app/historia/?lang=en) · [See scientific evidence](https://site-regret.vercel.app/evidencia/?lang=en) · [Space Apps project page](https://www.spaceappschallenge.org/2026/find-a-team/quemandotokens/?tab=project)

## What changes the decision

In the December–January test window at ground level, Site B’s longest stretch without sunlight is **14 h 40 min** on the reference terrain, compared with **38 h 40 min** for A. One team-defined terrain hypothesis reverses the choice. Keeping B instead of choosing A under that hypothesis costs **16 h 30 min** of additional uninterrupted darkness. The simulation uses the geometric visibility of the Sun’s center. [Scenario and reproducibility](docs/DEMO.md)

## Data and scope

NASA LRO/LOLA terrain and NASA/JPL SPICE geometry feed a Python engine. The browser displays its precomputed results and checks the package integrity. The calculations cover two fixed locations near Connecting Ridge and two 30-day windows. They provide geometric visibility estimates for preliminary exploration and education. [Sources and credits](docs/SOURCES.md) · [Technical architecture](web/ARCHITECTURE.md) · [Project status](docs/STATUS.md) · [AI disclosure](docs/AI_USE.md)

## Run from a checkout

Requires Node.js 22.18 or newer. The E2E tests use Microsoft Edge by default.

```bash
cd web
npm ci
npm run build
npm run serve
```

Open `http://127.0.0.1:4173/?lang=en`. Run `npm run verify` for type checks, lint, unit tests, a build, and the browser suite.

## License

The original software contributed by the SITE REGRET team is licensed under [Apache License 2.0](LICENSE). Third-party data, imagery, libraries, and other materials are provided under their applicable source terms. See the [third-party credits and terms](docs/SOURCES.md#third-party-terms).
