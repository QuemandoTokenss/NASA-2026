"""Cielo de Engineer a partir de NASA SVS 4851 «Deep Star Maps 2020» (EXR 4k lineal, coordenadas celestes).

Separa el mapa en dos piezas que se dibujan por separado en la escena 3D:
  1. Brillo difuso (Vía Láctea y fondo) sin estrellas: mediana local + suavizado, tono oscuro,
     2048×1024 equirectangular (JPEG 4:4:4). Se amplía bien porque no tiene detalle puntual.
  2. Estrellas como PUNTOS: máximos locales del residuo (mapa − difuso) con centroide subpíxel,
     brillo y color, las N más brillantes, guardadas como direcciones unitarias (binario).
     En pantalla se dibujan con 1–3 px: nítidas a cualquier zoom, sin bloques de compresión.

Convención de direcciones = la de `EquirectangularReflectionMapping` de three.js
(u = atan2(z, x)/2π + 0,5; v = asin(y)/π + 0,5), para que puntos y brillo coincidan.
Fondo ILUSTRATIVO: no está orientado al cielo real del sitio en el instante.

uso: python -I make_sky_points.py <starmap_2020_4k.exr> <dir_assets> <dir_public>
"""
import hashlib, importlib.util, json, os, struct, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, maximum_filter, median_filter, uniform_filter

exr, out_assets, out_public = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out_assets, exist_ok=True); os.makedirs(out_public, exist_ok=True)
spec = importlib.util.spec_from_file_location("msi_exr", os.path.join(os.path.dirname(__file__), "exr_reader.py"))
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
rgb = mod.read_exr_zip_half(exr)
H, W, _ = rgb.shape
lum = rgb.mean(axis=2)
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()

# 1 · Brillo difuso: mediana 9×9 (quita las estrellas) y suavizado; tono con punto negro alto.
bg_full = np.stack([median_filter(rgb[..., c], size=9, mode="wrap") for c in range(3)], axis=2)
bg_full = np.stack([gaussian_filter(bg_full[..., c], 2.0, mode="wrap") for c in range(3)], axis=2)
bl = bg_full.mean(axis=2)
ref = np.percentile(bl, 99.7)
floor = np.percentile(bl, 72)
x = np.clip((bg_full - floor) / max(ref - floor, 1e-9), 0, 1) ** 0.75 * 0.55
glow = Image.fromarray((x * 255 + 0.5).astype(np.uint8)).resize((2048, 1024), Image.LANCZOS)
glow_path = f"{out_assets}/sky-glow-svs4851-2k.jpg"
glow.save(glow_path, "JPEG", quality=90, subsampling=0, optimize=True)

# 2 · Estrellas: máximos locales 3×3 del residuo por encima del umbral.
res = lum - bl
peak = (maximum_filter(res, size=3, mode="wrap") == res) & (res > 0)
flux = uniform_filter(np.clip(res, 0, None), size=3, mode="wrap") * 9
ys, xs = np.nonzero(peak)
f = flux[ys, xs]
N = 9000
order = np.argsort(-f)[:N]
ys, xs, f = ys[order], xs[order], f[order]
# Centroide subpíxel 3×3 (con envoltura en x).
dx = np.zeros(len(xs)); dy = np.zeros(len(xs)); wsum = np.zeros(len(xs))
for oy in (-1, 0, 1):
    for ox in (-1, 0, 1):
        yy = np.clip(ys + oy, 0, H - 1); xx = (xs + ox) % W
        w = np.clip(res[yy, xx], 0, None)
        dx += w * ox; dy += w * oy; wsum += w
cx = xs + dx / np.maximum(wsum, 1e-12); cy = ys + dy / np.maximum(wsum, 1e-12)
u = (cx + 0.5) / W
v = 1 - (cy + 0.5) / H
lon = (u - 0.5) * 2 * np.pi
lat = (v - 0.5) * np.pi
dirs = np.stack([np.cos(lat) * np.cos(lon), np.sin(lat), np.cos(lat) * np.sin(lon)], axis=1).astype("<f4")
# Brillo relativo (raíz del flujo, normalizado a la estrella 30ª para no saturar) y color del pico.
b = np.clip(np.sqrt(f / f[min(30, len(f) - 1)]), 0, 1)
col = rgb[ys, xs] / np.maximum(rgb[ys, xs].max(axis=1, keepdims=True), 1e-9)
col = 0.55 + 0.45 * col  # color suave (las estrellas casi blancas)
rgba = np.concatenate([(col * 255 + 0.5).astype(np.uint8), (b[:, None] * 255 + 0.5).astype(np.uint8)], axis=1)
pts_path = f"{out_public}/stars-svs4851-v1.bin"
with open(pts_path, "wb") as fh:
    fh.write(b"STR1"); fh.write(struct.pack("<I", len(dirs)))
    fh.write(dirs.tobytes()); fh.write(rgba.tobytes())

src = json.load(open(f"{out_assets}/SOURCES.json", encoding="utf8"))
src["assets"] = [a for a in src["assets"] if a["file"] not in ("sky-glow-svs4851-2k.jpg", "public/scene/stars-svs4851-v1.bin")]
common = {"title": "Deep Star Maps 2020 · starmap_2020_4k.exr (coordenadas celestes)", "page": "https://svs.gsfc.nasa.gov/4851/",
          "url": "https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr", "sha256": sha(exr)}
credit = "NASA/Goddard Space Flight Center Scientific Visualization Studio. Gaia DR2: ESA/Gaia/DPAC."
src["assets"] += [
    {"file": "sky-glow-svs4851-2k.jpg", "sha256": sha(glow_path), "source": common, "credit": credit,
     "processing": "Brillo difuso sin estrellas: mediana 9×9 por canal y gaussiana σ = 2 px sobre el EXR lineal 4096×2048; punto negro en el percentil 72, normalizado al percentil 99,7, curva x^0,75, ×0,55; 2048×1024, JPEG calidad 90 sin submuestreo de color. Fondo ilustrativo: no orientado al cielo real del sitio."},
    {"file": "public/scene/stars-svs4851-v1.bin", "sha256": sha(pts_path), "source": common, "credit": credit,
     "processing": f"{len(dirs)} estrellas más brillantes: máximos locales 3×3 del residuo (mapa − difuso), centroide subpíxel, flujo 3×3. Binario: 'STR1', uint32 N, N×3 float32 (dirección unitaria, convención equirectangular de three.js), N×4 uint8 (color RGB suavizado, brillo relativo). Ilustrativo: no orientado al cielo real del sitio."},
]
json.dump(src, open(f"{out_assets}/SOURCES.json", "w", encoding="utf8"), ensure_ascii=False, indent=2)
print("ok", W, H, "stars", len(dirs), "glow", os.path.getsize(glow_path), "points", os.path.getsize(pts_path), "faint/bright flux", float(f[-1]), float(f[0]))
