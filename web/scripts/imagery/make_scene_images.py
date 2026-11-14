"""Imágenes de presentación (portada y cielo de Engineer) a partir de originales NASA.

- Portada: fotograma 413 (18 ene 2024, ~04:00 UT, cuarto creciente) de NASA SVS 5187
  «Moon Phase and Libration, 2024», render con LOLA DEM + LROC WAC Hapke + DE421.
  Se desplaza a la derecha sobre negro para dejar sitio al titular; 2400 px, WebP.
- Cielo: NASA SVS 4851 «Deep Star Maps 2020» (Gaia DR2/Hipparcos/Tycho-2), EXR 4k
  lineal → tono 8 bit oscuro (punto negro, gamma 2.2), JPEG 3072×1536 equirectangular.
uso: python -I make_scene_images.py <dir_originales> <dir_salida>
"""
import hashlib, json, os, sys, zlib
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

def read_exr_zip_half(path):
    """Lector mínimo de OpenEXR escalonado por líneas, compresión ZIP (16 líneas), canales HALF."""
    d = open(path, "rb").read()
    assert d[:4] == b"v/1", "no es OpenEXR"
    i = 8
    attrs = {}
    while d[i] != 0:
        j = d.index(b"\0", i); name = d[i:j].decode()
        k = d.index(b"\0", j + 1)
        size = int.from_bytes(d[k + 1:k + 5], "little")
        attrs[name] = d[k + 5:k + 5 + size]
        i = k + 5 + size
    i += 1
    assert attrs["compression"][0] == 3, "solo ZIP"
    chans = []
    cl = attrs["channels"]; c = 0
    while cl[c] != 0:
        e = cl.index(b"\0", c); chans.append((cl[c:e].decode(), int.from_bytes(cl[e + 1:e + 5], "little"))); c = e + 17
    assert all(t == 1 for _, t in chans), "solo HALF"
    x0, y0, x1, y1 = np.frombuffer(attrs["dataWindow"], "<i4")
    w, h = x1 - x0 + 1, y1 - y0 + 1
    nblocks = (h + 15) // 16
    offsets = np.frombuffer(d, "<u8", count=nblocks, offset=i)
    img = np.zeros((h, len(chans), w), np.float16)
    for off in offsets:
        y = int.from_bytes(d[off:off + 4], "little", signed=True) - y0
        size = int.from_bytes(d[off + 4:off + 8], "little")
        raw = zlib.decompress(d[off + 8:off + 8 + size])
        # predictor (deltas + 128) y desentrelazado de mitades
        t = np.concatenate([[raw[0]], (np.cumsum(np.frombuffer(raw, np.uint8)[1:].astype(np.int32) - 128) + raw[0]) % 256]).astype(np.uint8)
        half = (len(t) + 1) // 2
        u = np.empty_like(t); u[0::2] = t[:half]; u[1::2] = t[half:]
        lines = min(16, h - y)
        block = np.frombuffer(u.tobytes(), "<f2").reshape(lines, len(chans), w)
        img[y:y + lines] = block
    names = [n for n, _ in chans]
    return np.stack([img[:, names.index(ch), :] for ch in "RGB"], axis=2).astype(np.float32)

# Cielo
rgb = read_exr_zip_half(f"{src}/starmap_2020_4k.exr")
lum = rgb.mean(axis=2)
ref = np.percentile(lum, 99.9)
floor = np.percentile(lum, 55) / ref
x = np.clip(rgb / max(ref, 1e-6), 0, 1)
x = np.clip((x - floor * 1.15) / (1 - floor * 1.15), 0, 1) ** (1 / 2.2)   # punto negro: cielo oscuro
x = (x * 0.85 * 255).astype(np.uint8)
Image.fromarray(x).resize((3072, 1536), Image.LANCZOS).save(f"{out}/stars-svs4851-3k.jpg", "JPEG", quality=82, optimize=True, progressive=True)

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
        {
            "file": "stars-svs4851-3k.jpg", "sha256": sha(f"{out}/stars-svs4851-3k.jpg"),
            "source": {"title": "Deep Star Maps 2020 · starmap_2020_4k.exr (coordenadas celestes)", "page": "https://svs.gsfc.nasa.gov/4851/", "url": "https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr", "sha256": sha(f"{src}/starmap_2020_4k.exr")},
            "credit": "NASA/Goddard Space Flight Center Scientific Visualization Studio. Gaia DR2: ESA/Gaia/DPAC.",
            "processing": "Tono 8 bit (normalizado al percentil 99,9, punto negro en 1,15 × percentil 55 para un cielo oscuro, gamma 2,2, ×0,85), JPEG 3072×1536 equirectangular. Fondo ilustrativo: no orientado al cielo real del sitio.",
        },
    ],
}
json.dump(manifest, open(f"{out}/SOURCES.json", "w", encoding="utf8"), ensure_ascii=False, indent=2)
print("ok")
