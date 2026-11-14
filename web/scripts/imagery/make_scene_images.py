"""Imágenes de presentación (portada y cielo de Engineer) a partir de originales NASA.

- Portada: fotograma 413 (18 ene 2024, ~04:00 UT, cuarto creciente) de NASA SVS 5187
  «Moon Phase and Libration, 2024», render con LOLA DEM + LROC WAC Hapke + DE421.
  Se desplaza a la derecha sobre negro para dejar sitio al titular; 2400 px, WebP.
- El cielo de Engineer (NASA SVS 4851) lo genera `make_sky_points.py` (ejecutar DESPUÉS de este
  script: añade sus entradas a SOURCES.json).
uso: python -I make_scene_images.py <dir_originales> <dir_salida>
"""
import hashlib, json, os, sys
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()

# Portada
moon = Image.open(f"{src}/svs5187_moon.0413.tif").convert("RGBA")
W, H = moon.size
canvas = Image.new("RGBA", (W, H), (0, 0, 0, 255))
canvas.alpha_composite(moon, (int(W * 0.17), 0))
hero = canvas.convert("RGB").resize((2400, 1350), Image.LANCZOS)
hero.save(f"{out}/hero-moon-svs5187.webp", "WEBP", quality=80, method=6)
hero.resize((1200, 675), Image.LANCZOS).save(f"{out}/hero-moon-svs5187-1200.webp", "WEBP", quality=78, method=6)

manifest = {
    "description": "Imágenes de PRESENTACIÓN (portada y cielo de Engineer). No intervienen en ningún cálculo.",
    "generator": "web/scripts/imagery/make_scene_images.py",
    "assets": [
        {
            "file": "hero-moon-svs5187.webp", "also": "hero-moon-svs5187-1200.webp", "sha256": sha(f"{out}/hero-moon-svs5187.webp"),
            "source": {"title": "Moon Phase and Libration, 2024 · frame 413 (plain 3840×2160)", "page": "https://svs.gsfc.nasa.gov/5187/", "url": "https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005187/frames/3840x2160_16x9_30p/plain/moon.0413.tif", "sha256": sha(f"{src}/svs5187_moon.0413.tif")},
            "credit": "NASA's Scientific Visualization Studio (E. Wright, N. Petro) · datos LRO LOLA, LROC WAC (ASU), JPL DE421",
            "processing": "Desplazamiento a la derecha sobre negro (17 % del ancho) y reescalado a 2400 y 1200 px, WebP. Muestra la Luna entera vista desde la Tierra (cuarto creciente), no Connecting Ridge.",
        },
    ],
}
json.dump(manifest, open(f"{out}/SOURCES.json", "w", encoding="utf8"), ensure_ascii=False, indent=2)
print("ok")
