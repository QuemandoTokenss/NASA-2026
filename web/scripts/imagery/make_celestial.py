"""Optimiza las imágenes NASA para el esquema orbital del Timeline.

- Luna: textura LROC (NASA SVS 4720, equirectangular, lon −180…180, lat +90 arriba)
  reproyectada a una vista ORTOGRÁFICA desde debajo del polo sur, con la misma
  orientación que el mapa polar de la app (longitud 0° arriba, 90° E a la derecha).
- Tierra: Blue Marble AS17-148-22727 recortada al disco.
- Sol: SDO/AIA 171 Å (PIA26681) recortado al disco con un margen de corona.
uso: python -I make_celestial.py <dir_originales> <dir_salida>
"""
import json, math, sys, hashlib
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]

def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()

# ---------------- Luna ----------------
tex = np.asarray(Image.open(f'{src}/lroc_color_2k.jpg').convert('RGB')).astype(np.float32)
H, W, _ = tex.shape
N = 512
R = N / 2 - 2
ys, xs = np.mgrid[0:N, 0:N]
px = (xs + 0.5 - N / 2) / R          # derecha = +
py = (N / 2 - (ys + 0.5)) / R        # arriba = +
r = np.sqrt(px ** 2 + py ** 2)
inside = r <= 1
rr = np.clip(r, 0, 1)
lat = -90 + np.degrees(np.arcsin(rr))            # ortográfica centrada en el polo sur
lon = np.degrees(np.arctan2(px, py))             # 0° arriba, 90° E a la derecha (como el mapa)
u = ((lon + 180) / 360 * W) % W
v = np.clip((90 - lat) / 180 * H, 0, H - 1)
u0 = np.floor(u).astype(int) % W
v0 = np.floor(v).astype(int)
u1 = (u0 + 1) % W
v1 = np.clip(v0 + 1, 0, H - 1)
fu = (u - np.floor(u))[..., None]
fv = (v - np.floor(v))[..., None]
img = (tex[v0, u0] * (1 - fu) * (1 - fv) + tex[v0, u1] * fu * (1 - fv) + tex[v1, u0] * (1 - fu) * fv + tex[v1, u1] * fu * fv)
alpha = np.clip((1 - r) * R, 0, 1) * 255     # borde suavizado de 1 px
moon = np.dstack([img, alpha]).astype(np.uint8)
Image.fromarray(moon, 'RGBA').save(f'{out}/moon-lroc-southpole.webp', 'WEBP', quality=82, method=6)

# --------------- discos ---------------
def disc(path, size, margin, fade, name, threshold):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    lum = a.mean(axis=2)
    mask = lum > threshold
    mask[int(mask.shape[0] * 0.9):, :] = False  # ignora rótulos al pie de la imagen
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    cy = (rows[0] + rows[-1]) / 2
    cx = (cols[0] + cols[-1]) / 2
    rad = max(rows[-1] - rows[0], cols[-1] - cols[0]) / 2
    half = rad * margin
    box = (int(cx - half), int(cy - half), int(cx + half), int(cy + half))
    crop = im.crop(box).resize((size, size), Image.LANCZOS)
    c = np.asarray(crop).astype(np.float32)
    yy, xx = np.mgrid[0:size, 0:size]
    d = np.sqrt((xx + 0.5 - size / 2) ** 2 + (yy + 0.5 - size / 2) ** 2) / (size / 2) * margin   # en radios del disco
    al = np.clip((margin - d) / max(1e-6, margin - fade), 0, 1) if margin > 1 else np.clip((1 - d) * size / 2, 0, 1)
    out_arr = np.dstack([c, al * 255]).astype(np.uint8)
    Image.fromarray(out_arr, 'RGBA').save(f'{out}/{name}', 'WEBP', quality=84, method=6)
    return {'center_px': [float(cx), float(cy)], 'radius_px': float(rad), 'crop_box_px': list(box)}

earth = disc(f'{src}/IMG004849.jpg', 256, 1.0, 1.0, 'earth-bluemarble-as17.webp', 40)
sun = disc(f'{src}/PIA26681.jpg', 256, 1.12, 1.0, 'sun-sdo-aia171.webp', 110)

manifest = {
    'description': 'Imágenes NASA optimizadas para el esquema orbital del Timeline (apariencia de los cuerpos; posiciones y estados salen del motor).',
    'generator': 'make_celestial.py (Pillow + NumPy); se documenta en docs/continuidad/HANDOFF.md',
    'assets': [
        {
            'file': 'moon-lroc-southpole.webp', 'sha256': sha(f'{out}/moon-lroc-southpole.webp'),
            'source': {'title': 'CGI Moon Kit · LROC color map (2k JPEG)', 'page': 'https://svs.gsfc.nasa.gov/4720/', 'url': 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg', 'sha256': sha(f'{src}/lroc_color_2k.jpg'), 'bytes': 457942},
            'credit': "NASA's Scientific Visualization Studio · LROC WAC (Arizona State University)",
            'processing': 'Reproyección ortográfica desde debajo del polo sur (lon 0° arriba, 90° E a la derecha, como el mapa de la app), 512 px, borde con alfa. El proveedor indica que el mapa está optimizado para estética, no para ciencia.',
        },
        {
            'file': 'earth-bluemarble-as17.webp', 'sha256': sha(f'{out}/earth-bluemarble-as17.webp'),
            'source': {'title': 'The Blue Marble (AS17-148-22727)', 'page': 'https://science.nasa.gov/resource/the-blue-marble/', 'url': 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/i/IMG004849.jpg', 'sha256': sha(f'{src}/IMG004849.jpg'), 'bytes': 344828},
            'credit': 'NASA Johnson Space Center · Apollo 17 (7 dic 1972)',
            'processing': 'Recorte al disco, 256 px, máscara circular. Fotografía histórica: no representa nubes ni fase del instante simulado.',
            'geometry': earth,
        },
        {
            'file': 'sun-sdo-aia171.webp', 'sha256': sha(f'{out}/sun-sdo-aia171.webp'),
            'source': {'title': 'Image of Sun from NASA’s Solar Dynamics Observatory (PIA26681)', 'page': 'https://science.nasa.gov/photojournal/image-of-sun-from-nasas-solar-dynamics-observatory/', 'url': 'https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia26/pia26681/PIA26681.jpg', 'sha256': sha(f'{src}/PIA26681.jpg'), 'bytes': 1316280},
            'credit': 'NASA/GSFC/Solar Dynamics Observatory',
            'processing': 'Recorte al disco con 12 % de corona y desvanecido radial, 256 px. La propia imagen rotula «SDO/AIA 171 2025-09-10 15:55:22 UT»: ultravioleta extremo (171 Å) en falso color; el rótulo queda fuera del recorte. No representa la actividad solar del instante simulado.',
            'geometry': sun,
        },
    ],
}
json.dump(manifest, open(f'{out}/SOURCES.json', 'w', encoding='utf8'), ensure_ascii=False, indent=2)
print('ok')
