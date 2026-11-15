# Project status

Updated 15 November 2026, Bilbao time. The application release reviewed for judging is `c9749ca` with the four jury fixes from [PR #25](https://github.com/QuemandoTokenss/NASA-2026/pull/25). The map, 3D terrain and Engineer height results are live. [Published application](https://site-regret.vercel.app/?lang=en)

| Area | Verified result |
| --- | --- |
| Data and provenance | The build verified all 47 files in the original transfer package. The passport records 18 source assets with URLs and hashes. [Source register](SOURCES.md) |
| Geography | Connecting Ridge ROI 4 and ROI 6, two UTC windows, frame `MOON_ME_DE421`. |
| Scientific checks | 414 stored checks and eight sampled JPL Horizons comparisons. For the scope of each check, see [Evidence](https://site-regret.vercel.app/evidencia/?lang=en). |
| Web verification | 156 unit tests passed. 122 browser scenarios passed against the published app, including live Moon Trek. The one offline scenario was run separately against the local static build and passed. |
| Reproducible build | A clean anonymous GitHub clone of `c9749ca` passed `npm ci` and `npm run build`. |
| Public submission page | The English summary, figures, source references, AI disclosure, app and source links were checked without signing in. The team will add the video and confirm submission separately. [Public project page](https://www.spaceappschallenge.org/2026/find-a-team/quemandotokens/?tab=project) |

Historical checkpoints are in [HANDOFF.md](continuidad/HANDOFF.md).
