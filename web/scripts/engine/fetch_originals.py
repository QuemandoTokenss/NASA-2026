"""Prepara los originales NASA que necesita el motor para las alturas de Engineer.

Lee la lista de originales (URL, bytes, SHA-256) del pasaporte del motor
(`web/data/source/DERIVADOS_SITE_REGRET/datos/pasaporte.json`, solo lectura) y deja
cada archivo en `web/data/raw/motor/<path del pasaporte>` (no versionado):

- si ya existe ahí con el SHA-256 correcto, no hace nada;
- si existe en `web/data/raw/pgda78_site01/` (descarga anterior del equipo) con el
  SHA-256 correcto, crea un enlace duro (sin copiar bytes);
- si falta, lo descarga de la URL documentada y comprueba tamaño y SHA-256.

Uso:  python -I web/scripts/engine/fetch_originals.py [ids...]
"""
from pathlib import Path
import hashlib, json, os, sys, time, urllib.request

WEB = Path(__file__).resolve().parents[2]
PASSPORT = WEB / 'data/source/DERIVADOS_SITE_REGRET/datos/pasaporte.json'
DEST = WEB / 'data/raw/motor'
LOCAL_SITE01 = WEB / 'data/raw/pgda78_site01'
NEEDED = ['SITE01_surf', 'SITE01_ldec', 'SITE01_toterr', 'SITE01_slp', 'SITE01_slperr', 'SITE01_ROIS',
          'DEM_REGIONAL_80M', 'DEM_LEJANO_240M', 'LSK', 'SPK_DE421', 'PCK_MOON_DE421', 'FK_MOON_DE421', 'PCK_CONSTANTS'] + \
         [f'SITE01_CLONE_{i:04d}' for i in range(1, 6)]


def digest(p):
    h = hashlib.sha256()
    with Path(p).open('rb') as f:
        for v in iter(lambda: f.read(1 << 20), b''):
            h.update(v)
    return h.hexdigest()


def main(ids):
    assets = {a['id']: a for a in json.loads(PASSPORT.read_text(encoding='utf8'))['source_assets']}
    log = []
    for aid in ids or NEEDED:
        a = assets[aid]
        dest = DEST / a['path']
        dest.parent.mkdir(parents=True, exist_ok=True)
        t = time.time()
        if dest.exists() and dest.stat().st_size == a['bytes'] and digest(dest) == a['sha256']:
            log.append(dict(id=aid, action='present', path=str(dest)))
            continue
        local = LOCAL_SITE01 / Path(a['path']).name
        if local.exists() and local.stat().st_size == a['bytes'] and digest(local) == a['sha256']:
            if dest.exists():
                dest.unlink()
            os.link(local, dest)
            log.append(dict(id=aid, action='hardlink', source=str(local)))
            print('LINK', aid, flush=True)
            continue
        tmp = dest.with_name(dest.name + '.part')
        req = urllib.request.Request(a['url'], headers={'User-Agent': 'SiteRegret/0.1 scientific data download'})
        with urllib.request.urlopen(req, timeout=120) as r, tmp.open('wb') as out:
            for v in iter(lambda: r.read(1 << 20), b''):
                out.write(v)
        if tmp.stat().st_size != a['bytes']:
            raise ValueError(f'{aid}: size {tmp.stat().st_size} != {a["bytes"]}')
        if digest(tmp) != a['sha256']:
            raise ValueError(f'{aid}: SHA-256 mismatch')
        tmp.replace(dest)
        log.append(dict(id=aid, action='downloaded', url=a['url'], bytes=a['bytes'], seconds=round(time.time() - t, 1)))
        print('DOWNLOADED', aid, a['bytes'], round(time.time() - t, 1), 's', flush=True)
    (DEST / 'fetch_log.json').write_text(json.dumps(log, indent=2), encoding='utf8')
    print('ORIGINALS_READY', len(log), flush=True)


if __name__ == '__main__':
    main(sys.argv[1:])
