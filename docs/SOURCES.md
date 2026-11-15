# Sources, credits and third-party terms

## Scientific inputs

| Source | Use in SITE REGRET |
| --- | --- |
| [NASA Goddard PGDA 78 / LRO-LOLA Site01](https://pgda.gsfc.nasa.gov/products/78) | Connecting Ridge 5 m terrain, regions of interest, quality layers and five published terrain alternatives. Data and methodology credit: NASA GSFC / LRO LOLA and [Barker et al. (2021)](https://doi.org/10.1016/j.pss.2020.105119). |
| [NASA Goddard PGDA 90 / LRO-LOLA](https://pgda.gsfc.nasa.gov/products/90) | Regional and distant terrain at 80 m and 240 m; [Barker et al. (2023)](https://doi.org/10.3847/PSJ/acf3e1). |
| [NASA/JPL NAIF SPICE kernels](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/) | DE421 ephemerides and lunar reference frames used for the geometric Sun and Earth directions. |
| [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Eight sampled cross-checks of apparent-position calculations. |
| [NASA PDS Geosciences Node](https://pds-geosciences.wustl.edu/dataserv/moon.html) | Product metadata and footprints through the Lunar Orbital Data Explorer. |

The [data passport](../web/data/source/DERIVADOS_SITE_REGRET/datos/pasaporte.json) lists the 18 source assets with their identifiers, URLs and hashes. The [transfer checksums](../web/data/source/SHA256_TRANSFERENCIA.txt) cover 47 delivered files. [Scientific model and assumptions](../web/data/source/00_LEER_PRIMERO/MODELO_CIENTIFICO.md) · [Project sources on NASA Space Apps](https://www.spaceappschallenge.org/2026/find-a-team/quemandotokens/?tab=project#dataReferences)

The links above identify the provider records used in the project. Matching them to the exact entries in the challenge’s *Resources* tab remains unverified.

## Imagery and visual assets

| Material | Source and credit |
| --- | --- |
| Connecting Ridge orbital mosaic | [NASA/JPL Moon Trek](https://trek.nasa.gov/moon/), LRO/LROC NAC south-pole layer `LRO_NAC_Mosaic_1mpp_SP`. NASA/GSFC/Arizona State University. The image shows shadows from acquisition. [Map manifest](../web/src/assets/presentar/SOURCES.json) |
| Lunar textures and geographic context | [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), NASA Scientific Visualization Studio and LROC WAC/Arizona State University. Polar terrain insets use LOLA/PGDA. [Globe manifest](../web/src/assets/globe/SOURCES.json) |
| Moon rendering and star field | [NASA SVS 5187](https://svs.gsfc.nasa.gov/5187/) and [NASA SVS 4851](https://svs.gsfc.nasa.gov/4851/), NASA Goddard Scientific Visualization Studio. Star data credit: ESA/Gaia/DPAC. [Scene manifest](../web/src/assets/scene/SOURCES.json) |
| Earth and Sun | [The Blue Marble](https://science.nasa.gov/resource/the-blue-marble/), NASA Johnson Space Center / Apollo 17. [Solar Dynamics Observatory PIA26681](https://science.nasa.gov/photojournal/image-of-sun-from-nasas-solar-dynamics-observatory/), NASA/GSFC/SDO. [Celestial image manifest](../web/src/assets/celestial/SOURCES.json) |

## Third-party terms

The project’s [Apache 2.0 license](../LICENSE) applies to team-authored software. Refer to each provider’s terms and credit line for third-party materials, including [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) and the [JPL Image Use Policy](https://www.jpl.nasa.gov/jpl-image-use-policy/). The manifests above retain provenance and describe processing where applicable.

The [web manifest](../web/package.json) and [npm lockfile](../web/package-lock.json) identify dependencies and record their declared licenses. The [Python dependency lock](../web/data/source/DERIVADOS_SITE_REGRET/motor/requirements.lock.txt) identifies the scientific engine’s pinned packages. Those components remain under their respective licenses.

| Python package | License metadata for the pinned release |
| --- | --- |
| [NumPy 2.5.4](https://pypi.org/project/numpy/2.5.4/) | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 |
| [SciPy 1.18.1](https://pypi.org/project/scipy/1.18.1/) | BSD |
| [Rasterio 1.5.2](https://pypi.org/project/rasterio/1.5.2/) | BSD-3-Clause |
| [pyproj 3.8.0](https://pypi.org/project/pyproj/3.8.0/) | MIT |
| [SpiceyPy 8.4.0](https://pypi.org/project/spiceypy/8.4.0/) | MIT |
| [PyShp 3.1.8](https://pypi.org/project/pyshp/3.1.8/) | MIT |

Credit the music, footage and other third-party assets actually used in the final submission video under their applicable terms.
