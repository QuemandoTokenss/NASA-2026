"""Activos del globo lunar del Dashboard (solo PRESENTACIÓN; no intervienen en ningún cálculo).

- Textura global: NASA SVS 4720 · LROC color 2k (equirectangular, lon −180…180 centrada en 0°,
  lat +90 arriba), recodificada a WebP sin cambiar geometría.
- Detalle polar georreferenciado, en la MISMA proyección que el mapa de la app (estereográfica
  polar sur, R = 1 737 400 m, X = 90° E, Y = 0°), como relieve sombreado con luz sintética:
    nivel 1 · LOLA PGDA90 240 m/px, casquete ±480 km,
    nivel 2 · LOLA PGDA90 80 m/px, ±40 km en torno a los sitios (resolución nativa),
    nivel 3 · LOLA PGDA78 5 m/px, el recorte versionado de 4 × 4 km de Connecting Ridge.
  Cada nivel lleva alfa con borde difuminado y transparencia donde el DEM no tiene dato.

uso: python -I make_globe_assets.py <web/data/raw> <web/data/derived/terrain> <dir_salida>
"""
import hashlib
import json
import sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
raw, derived, out = sys.argv[1], sys.argv[2], sys.argv[3]


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def hillshade(z, px_m, exaggeration, az_deg=315.0, alt_deg=38.0):
    """Sombreado clásico (Horn) sobre la rejilla z (fila 0 = Y máxima). Devuelve 0…1; NaN donde falta dato."""
    zz = z * exaggeration
    dzdx = (zz[1:-1, 2:] - zz[1:-1, :-2]) / (2 * px_m)
    dzdy = (zz[:-2, 1:-1] - zz[2:, 1:-1]) / (2 * px_m)  # +Y hacia arriba de la imagen
    az = np.radians(az_deg)
    alt = np.radians(alt_deg)
    lx, ly, lz = np.sin(az) * np.cos(alt), np.cos(az) * np.cos(alt), np.sin(alt)
    shade = (-dzdx * lx - dzdy * ly + lz) / np.sqrt(dzdx ** 2 + dzdy ** 2 + 1)
    full = np.full(z.shape, np.nan, dtype=np.float32)
    full[1:-1, 1:-1] = shade
    return full


def patch(z, px_m, exaggeration, size, feather, name, tone=(0.16, 0.86)):
    sh = hillshade(z, px_m, exaggeration)
    valid = np.isfinite(sh)
    lo, hi = np.nanpercentile(sh, [1.0, 99.5])
    g = np.clip((sh - lo) / max(1e-6, hi - lo), 0, 1) ** 0.9
    g = tone[0] + (tone[1] - tone[0]) * g
    g[~valid] = 0
    grey = Image.fromarray((g * 255).astype(np.uint8), 'L')
    mask = Image.fromarray((valid * 255).astype(np.uint8), 'L')
    if grey.size != (size, size):
        grey = grey.resize((size, size), Image.LANCZOS)
        mask = mask.resize((size, size), Image.BILINEAR)
    a = np.asarray(mask).astype(np.float32) / 255
    # Borde difuminado (coseno) para fundirse con el nivel anterior.
    t = (np.arange(size) + 0.5) / size
    edge = np.clip(np.minimum(t, 1 - t) / feather, 0, 1)
    edge = 0.5 - 0.5 * np.cos(np.pi * edge)
    a = a * np.outer(edge, edge)
    gg = np.asarray(grey).astype(np.float32)
    # Gris ligeramente cálido, como el regolito de la textura global.
    rgba = np.dstack([gg, gg * 0.985, gg * 0.955, a * 255]).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(f'{out}/{name}', 'WEBP', quality=84, method=6)
    return sha(f'{out}/{name}')


def read_window(path, origin_x, origin_y, px_m, xmin, ymin, xmax, ymax):
    """Ventana exacta de muestras de un GeoTIFF (esquina superior izquierda en origin_x/origin_y)."""
    im = Image.open(path)
    c0, c1 = round((xmin - origin_x) / px_m), round((xmax - origin_x) / px_m)
    r0, r1 = round((origin_y - ymax) / px_m), round((origin_y - ymin) / px_m)
    return np.asarray(im.crop((c0, r0, c1, r1))).astype(np.float32)


assets = []

# ---------------- textura global ----------------
src_tex = f'{raw}/imagery/lroc_color_2k.jpg'
tex = Image.open(src_tex).convert('RGB')
assert tex.size == (2048, 1024)
tex.save(f'{out}/moon-lroc-color-2k.webp', 'WEBP', quality=86, method=6)
tex.resize((1024, 512), Image.LANCZOS).save(f'{out}/moon-lroc-color-1k.webp', 'WEBP', quality=82, method=6)
assets.append({
    'file': 'moon-lroc-color-2k.webp', 'also': 'moon-lroc-color-1k.webp', 'sha256': sha(f'{out}/moon-lroc-color-2k.webp'),
    'source': {'title': 'CGI Moon Kit · LROC color map (2k JPEG)', 'page': 'https://svs.gsfc.nasa.gov/4720/', 'url': 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg', 'sha256': sha(src_tex)},
    'credit': "NASA's Scientific Visualization Studio · LROC WAC (Arizona State University)",
    'georeferencing': 'Equirectangular: columna 0 = longitud −180°, centro = 0° (cara visible), fila 0 = +90°. Orientación comprobada con Tycho, Mare Crisium, Mare Imbrium, Mare Orientale y Tsiolkovskiy.',
    'processing': 'Recodificación a WebP (2048×1024 y 1024×512), sin reproyectar. El proveedor indica que el mapa está optimizado para estética, no para ciencia.',
})

# ---------------- detalle polar ----------------
ctx = f'{raw}/motor/datos_originales/PGDA90_contexto'
SITES_CENTER = (-11045.0, -11952.5)  # punto medio de A y B (X/Y del paquete), m

# Nivel 1 · 240 m, casquete ±480 km → 1024 px (≈ 937,5 m/px por media de bloques).
half1 = 480000.0
z1 = read_window(f'{ctx}/LDEM_60S_240MPP_ADJ.TIF', -931200.0, 931200.0, 240.0, -half1, -half1, half1, half1)
assert z1.shape == (4000, 4000), z1.shape
k = 4  # media 4×4 → 960 m/px, 1000 px
z1d = np.nanmean(z1.reshape(1000, k, 1000, k), axis=(1, 3))
h1 = patch(z1d, 240.0 * k, 3.0, 1000, 0.10, 'pole-lola240-cap.webp')
assets.append({
    'file': 'pole-lola240-cap.webp', 'sha256': h1, 'level': 1,
    'bounds_xy_m': [-half1, -half1, half1, half1], 'pixel_size_m': 960.0,
    'source': {'title': 'LOLA south-pole DEM 240 m/px (PGDA product 90) · LDEM_60S_240MPP_ADJ.TIF', 'page': 'https://pgda.gsfc.nasa.gov/products/90', 'sha256': sha(f'{ctx}/LDEM_60S_240MPP_ADJ.TIF')},
    'credit': 'NASA GSFC · LOLA / PGDA (Barker et al.)',
    'processing': 'Ventana exacta ±480 km, media de bloques 4×4 (960 m/px), relieve sombreado con luz sintética (acimut 315°, altura 38°, exageración ×3 solo del sombreado), alfa con borde difuminado.',
})

# Nivel 2 · 80 m, ±40 km en torno a los sitios, resolución nativa (rejilla alineada a 80 m).
cx, cy = round(SITES_CENTER[0] / 80) * 80.0, round(SITES_CENTER[1] / 80) * 80.0
half2 = 40000.0
z2 = read_window(f'{ctx}/LDEM_80S_80MPP_ADJ.TIF', -304000.0, 304000.0, 80.0, cx - half2, cy - half2, cx + half2, cy + half2)
assert z2.shape == (1000, 1000), z2.shape
h2 = patch(z2, 80.0, 2.0, 1000, 0.10, 'pole-lola80-ridge.webp')
assets.append({
    'file': 'pole-lola80-ridge.webp', 'sha256': h2, 'level': 2,
    'bounds_xy_m': [cx - half2, cy - half2, cx + half2, cy + half2], 'pixel_size_m': 80.0,
    'source': {'title': 'LOLA south-pole DEM 80 m/px (PGDA product 90) · LDEM_80S_80MPP_ADJ.TIF', 'page': 'https://pgda.gsfc.nasa.gov/products/90', 'sha256': sha(f'{ctx}/LDEM_80S_80MPP_ADJ.TIF')},
    'credit': 'NASA GSFC · LOLA / PGDA (Barker et al.)',
    'processing': 'Ventana exacta de 80 × 80 km a resolución nativa, relieve sombreado con luz sintética (acimut 315°, altura 38°, exageración ×2 solo del sombreado), alfa con borde difuminado.',
})

# Nivel 3 · 5 m, recorte versionado de Connecting Ridge (800 × 800 muestras, 4 × 4 km).
man = json.load(open(f'{derived}/manifest.json', encoding='utf-8'))
geo = man['georeferencing']
layer = next(l for l in man['layers'] if l['id'] == 'elevation')
assert sha(f'{derived}/elevation.f32') == layer['sha256']
z3 = np.fromfile(f'{derived}/elevation.f32', dtype='<f4').reshape(geo['height'], geo['width'])
h3 = patch(z3, float(geo['pixel_size_m']), 1.5, 800, 0.06, 'pole-pgda78-site01.webp')
assets.append({
    'file': 'pole-pgda78-site01.webp', 'sha256': h3, 'level': 3,
    'bounds_xy_m': geo['window_bounds_xy_m'], 'pixel_size_m': geo['pixel_size_m'],
    'source': {'title': 'LOLA 5 m/px DEM, Site01 Connecting Ridge (PGDA product 78) · recorte versionado web/data/derived/terrain/elevation.f32', 'page': 'https://pgda.gsfc.nasa.gov/products/78', 'sha256': layer['source']['sha256'], 'derived_sha256': layer['sha256']},
    'credit': 'NASA GSFC · LOLA / PGDA (Barker et al. 2021)',
    'processing': 'Relieve sombreado con luz sintética (acimut 315°, altura 38°, exageración ×1,5 solo del sombreado) de las 800 × 800 muestras del recorte, alfa con borde difuminado.',
})

json.dump({
    'description': 'Activos del globo lunar del Dashboard. Solo presentación: la textura es apariencia y los relieves sombreados usan luz sintética; ninguna decisión ni métrica sale de aquí.',
    'generator': 'web/scripts/imagery/make_globe_assets.py',
    'projection': 'Detalle polar: estereográfica polar sur lunar, esfera R = 1737400 m, lat0 = −90°, lon0 = 0°, X hacia 90° E, Y hacia 0° (misma que el mapa de la app).',
    'assets': assets,
}, open(f'{out}/SOURCES.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
for a in assets:
    print(a['file'], a['sha256'][:12])
