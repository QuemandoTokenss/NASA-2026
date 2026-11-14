"""Lector mínimo de OpenEXR (ZIP, HALF) en NumPy, compartido por los scripts de imágenes."""
import zlib
import numpy as np


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
