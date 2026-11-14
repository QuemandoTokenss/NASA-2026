"""SITE REGRET · Engineer: visibilidad del terreno NOMINAL a las 61 alturas del deslizador (0–30 m, paso 0,5 m).

Reutiliza el motor original (`web/data/source/DERIVADOS_SITE_REGRET/motor/pipeline.py`) SIN modificarlo:
se importa como módulo, se redirigen sus rutas de entrada (originales NASA en `web/data/raw/motor/`)
y de salida (una carpeta de trabajo no versionada), y se usan sus funciones tal cual:
`prepare`, `rays`, `sample`, `radial_grids`, `elevation_terrain`, `load_kernels`, `sky_grid`,
`classify`, `intervals`. Lo único que se reescribe es el bucle de alturas de `horizon()`, para:

  * aceptar alturas de medio metro (clave estable: índice entero k = 2·h, 0…60);
  * usar la altura REAL en la cota del relieve lejano (el original hace `int(h)`, que para 19,5 m
    usaría 19 m; con las alturas enteras 0/2/10 ambos son idénticos);
  * calcular solo la superficie nominal.

Para cada altura se vuelve a evaluar el horizonte sobre todos los rayos (el punto que fija el horizonte
puede cambiar al subir), con las mismas mallas radiales (factor 2), el mismo paso de azimut (0,25°),
las mismas máscaras de desconocidos y la misma cota de cobertura; después direcciones, estados y
métricas con esa altura y el paso temporal de 10 min.

Uso (desde la raíz del repositorio, con el entorno del motor):
  web/data/raw/motor-venv/Scripts/python -I web/scripts/engine/engineer_heights.py --pilot
  web/data/raw/motor-venv/Scripts/python -I web/scripts/engine/engineer_heights.py --all
"""
from pathlib import Path
import argparse, datetime as dt, hashlib, json, sys, time

import numpy as np

WEB = Path(__file__).resolve().parents[2]
SOURCE = WEB / 'data/source/DERIVADOS_SITE_REGRET'
sys.dont_write_bytecode = True  # no escribir __pycache__ dentro de web/data/source/
sys.path.insert(0, str(SOURCE / 'motor'))
import pipeline as P  # noqa: E402  (motor original, solo lectura)

RAW = WEB / 'data/raw/motor'
WORK = RAW / 'work'
OUT_ALL = WEB / 'data/derived/engineer-heights/v1'
OUT_PILOT = RAW / 'pilot'
V01 = WEB / 'public/data/site-regret/v0.1'

P.RAW = RAW          # originales verificados por fetch_originals.py
P.ROOT = WORK        # prepare() escribe sitios/QA: nunca dentro de web/data/source/

K_ALL = list(range(61))
K_PILOT = [0, 4, 20, 32, 39, 60]  # 0, 2, 10, 16, 19,5 y 30 m
N_AZ = 1440
N_T = 4321


def height_of(k):
    """Altura física de la posición k (en metros). Entera para k par (misma clave que el motor)."""
    return k // 2 if k % 2 == 0 else k / 2


def kname(k):
    return f'k{k:03d}'


def sha(b):
    return hashlib.sha256(b).hexdigest()


def horizon_heights(site, surface, tr, regional, rt, distant, dtf, ks, factor):
    """Copia del bucle de `pipeline.horizon` para UNA superficie y alturas arbitrarias.

    Mismas mallas, mismo muestreo y mismas fórmulas; la única diferencia es `float(h)` en la cota lejana.
    """
    step = P.CONFIG['azimuth_step_deg']
    az = np.arange(0, 360, step); dl, dr = P.radial_grids(factor)
    res = {k: dict(elevation_deg=np.full(len(az), -90.), distance_m=np.zeros(len(az)), source=np.zeros(len(az), dtype=np.int8),
                   unknown=np.zeros(len(az), dtype=bool)) for k in ks}
    ground = float(P.sample(surface, tr, np.array([site['x_m']]), np.array([site['y_m']]))[0])
    xmin, xmax = tr.c + 2.5, tr.c + tr.a * (surface.shape[1] - .5)
    ymax, ymin = tr.f - 2.5, tr.f + tr.e * (surface.shape[0] - .5)
    for j in range(0, len(az), 60):
        ix = slice(j, min(j + 60, len(az))); aa = az[ix]
        xl, yl = P.rays(site, aa, dl); xr, yr = P.rays(site, aa, dr)
        inside = (xl >= xmin) & (xl <= xmax) & (yl >= ymin) & (yl <= ymax)
        fine_region = (xr >= xmin) & (xr <= xmax) & (yr >= ymin) & (yr <= ymax)
        rz80 = P.sample(regional, rt, xr, yr); rz240 = P.sample(distant, dtf, xr, yr)
        rz = np.where(np.isfinite(rz80), rz80, rz240); rvalid = np.isfinite(rz) & ~fine_region
        bad_region = np.any(~np.isfinite(rz) & ~fine_region, axis=1)
        lz = P.sample(surface, tr, xl, yl); lvalid = np.isfinite(lz) & inside
        bad = np.any(~np.isfinite(lz) & inside, axis=1) | bad_region
        for k in ks:
            obs = ground + height_of(k)
            el = P.elevation_terrain(lz, obs, dl); er = P.elevation_terrain(rz, obs, dr)
            el = np.where(lvalid, el, -90); er = np.where(rvalid, er, -90)
            al = np.argmax(el, axis=1); ar = np.argmax(er, axis=1); rr = np.arange(len(aa))
            ml = el[rr, al]; mr = er[rr, ar]; local_wins = ml >= mr
            r = res[k]
            r['elevation_deg'][ix] = np.maximum(ml, mr)
            r['distance_m'][ix] = np.where(local_wins, dl[al], dr[ar])
            r['source'][ix] = np.where(local_wins, 0, np.where(np.isfinite(rz80[rr, ar]), 1, 2))
            r['unknown'][ix] = bad
    for k, r in res.items():
        tail = float(P.elevation_terrain(P.CONFIG['far_terrain_upper_bound_m'], ground + float(height_of(k)), P.CONFIG['max_ray_distance_m']))
        r['far_bound_deg'] = tail
        r['tail_below_sampled_horizon'] = bool(np.all(r['elevation_deg'] > tail))
        if not r['tail_below_sampled_horizon']:
            r['unknown'] |= r['elevation_deg'] <= tail
    return az, ground, res


def as_engine_hd(az, ground, res):
    """Estructura que esperan `pipeline.horizon_at` y `pipeline.classify` (claves str(altura))."""
    return dict(azimuth_deg=az, observer_ground_height_m={'nominal': ground},
                variants={'nominal': {str(height_of(k)): r for k, r in res.items()}},
                sampling=dict(azimuth_step_deg=P.CONFIG['azimuth_step_deg']))


def horizon_bin(r):
    d32 = r['distance_m'].astype('<f4')
    if not np.array_equal(d32.astype(np.float64), r['distance_m']):
        raise ValueError('distance_m no cabe exacto en float32')
    return (r['elevation_deg'].astype('<f8').tobytes() + d32.tobytes() + r['source'].astype(np.uint8).tobytes()
            + r['unknown'].astype(np.uint8).tobytes())


def scenario_bin(dirs, sh, eh, states):
    arrs = [dirs['SUN']['azimuth_deg'], dirs['SUN']['elevation_deg'], dirs['EARTH']['azimuth_deg'], dirs['EARTH']['elevation_deg'], sh, eh]
    for a in arrs:
        if len(a) != N_T:
            raise ValueError('serie temporal inesperada')
    return b''.join(np.asarray(a, dtype='<f8').tobytes() for a in arrs) + np.asarray(states, dtype=np.uint8).tobytes()


def compare_v01(sid, wid, k, r, dirs, sh, eh, states, metrics, ints):
    """Contraste con el paquete publicado (0, 2 y 10 m): igualdad y máxima diferencia absoluta."""
    h = height_of(k)
    hz = json.loads((V01 / f'horizons/{sid}_h{h}.json').read_text(encoding='utf8'))['variants']['nominal']
    eph = json.loads((V01 / f'ephemerides/{wid}_{sid}_h{h}.json').read_text(encoding='utf8'))['series']
    rows = json.loads((V01 / f'scenarios/{wid}_h{h}.json').read_text(encoding='utf8'))['rows']
    row = next(x for x in rows if x['site_id'] == sid and x['variant'] == 'nominal')
    core = json.loads((V01 / 'core.json').read_text(encoding='utf8'))
    summ = next(s for s in core['scenario_summaries'] if s['site_id'] == sid and s['window_id'] == wid and s['height_m'] == h and s['variant'] == 'nominal')

    def mad(a, b):
        a = np.asarray([np.nan if v is None else v for v in a], float); b = np.asarray(b, float)
        both = np.isfinite(a) & np.isfinite(b)
        if not np.array_equal(np.isfinite(a), np.isfinite(b)):
            return float('inf')
        return float(np.max(np.abs(a[both] - b[both]))) if both.any() else 0.0

    out = dict(site=sid, window=wid, height_m=h,
               horizon_elevation_max_abs_deg=mad(hz['elevation_deg'], r['elevation_deg']),
               horizon_distance_equal=bool(np.array_equal(np.asarray(hz['distance_m'], float), r['distance_m'])),
               horizon_source_equal=bool(np.array_equal(np.asarray(hz['source']), r['source'])),
               horizon_unknown_equal=bool(np.array_equal(np.asarray(hz['unknown']), r['unknown'])),
               far_bound_abs_deg=abs(hz['far_bound_deg'] - r['far_bound_deg']),
               tail_flag_equal=hz['tail_below_sampled_horizon'] == r['tail_below_sampled_horizon'],
               sun_az_max_abs_deg=mad(eph['bodies']['SUN']['azimuth_deg'], dirs['SUN']['azimuth_deg']),
               sun_el_max_abs_deg=mad(eph['bodies']['SUN']['elevation_deg'], dirs['SUN']['elevation_deg']),
               earth_az_max_abs_deg=mad(eph['bodies']['EARTH']['azimuth_deg'], dirs['EARTH']['azimuth_deg']),
               earth_el_max_abs_deg=mad(eph['bodies']['EARTH']['elevation_deg'], dirs['EARTH']['elevation_deg']),
               sun_horizon_max_abs_deg=mad(eph['sun_horizon_deg'], sh), earth_horizon_max_abs_deg=mad(eph['earth_horizon_deg'], eh),
               states_equal=row['state_codes'] == [int(s) for s in states],
               intervals_equal=row['intervals'] == ints,
               metrics_max_abs_hours=max(abs(summ['metrics'][m] - metrics[m]) for m in metrics),
               status_equal=summ['status'] == ('READY_WITH_LIMITS' if metrics['unknown_hours'] == 0 else 'PARTIAL'))
    angular = [v for kk, v in out.items() if kk.endswith('_deg')]
    out['passed'] = bool(max(angular) <= 1e-9 and out['horizon_distance_equal'] and out['horizon_source_equal'] and out['horizon_unknown_equal']
                         and out['tail_flag_equal'] and out['states_equal'] and out['intervals_equal'] and out['metrics_max_abs_hours'] <= 1e-9 and out['status_equal'])
    return out


def run(ks, out_dir, per_height_timing):
    t0 = time.time(); log = {}
    sites, surfaces, tr, regional, rt, distant, dtf = P.prepare()
    log['prepare_seconds'] = round(time.time() - t0, 1)
    kern = P.load_kernels()
    factor = P.CONFIG['base_radial_refinement_factor']
    out_dir.mkdir(parents=True, exist_ok=True); (out_dir / 'horizons').mkdir(exist_ok=True); (out_dir / 'scenarios').mkdir(exist_ok=True)
    files = {}; hds = {}; timing = dict(horizon_seconds={}, horizon_per_height_seconds={}, classify_seconds={})
    horizon_index = {}; tests = []
    for site in sites:
        sid = site['id']
        t = time.time()
        az, ground, res = horizon_heights(site, surfaces['nominal'], tr, regional, rt, distant, dtf, ks, factor)
        timing['horizon_seconds'][sid] = round(time.time() - t, 2)
        if per_height_timing:
            for k in ks:
                t = time.time(); horizon_heights(site, surfaces['nominal'], tr, regional, rt, distant, dtf, [k], factor)
                timing['horizon_per_height_seconds'][f'{sid}_{kname(k)}'] = round(time.time() - t, 2)
        print('HORIZON', sid, len(ks), 'heights', timing['horizon_seconds'][sid], 's', flush=True)
        # Monotonía física: al subir el observador el horizonte no puede subir.
        for a, b in zip(ks[:-1], ks[1:]):
            err = float(np.max(res[b]['elevation_deg'] - res[a]['elevation_deg']))
            tests.append(dict(name=f'{sid}_{kname(a)}_{kname(b)}_horizon_monotonic', error=err, limit=1e-10, passed=err <= 1e-10))
        hds[sid] = as_engine_hd(az, ground, res)
        horizon_index[sid] = dict(observer_ground_height_m=ground, heights={})
        for k in ks:
            b = horizon_bin(res[k]); p = f'horizons/{sid}_{kname(k)}.bin'
            (out_dir / p).write_bytes(b); files[p] = dict(sha256=sha(b), bytes=len(b))
            horizon_index[sid]['heights'][kname(k)] = dict(height_m=height_of(k), far_bound_deg=res[k]['far_bound_deg'],
                                                            tail_below_sampled_horizon=res[k]['tail_below_sampled_horizon'],
                                                            unknown_azimuths=int(res[k]['unknown'].sum()))
    scen_index = {}; contrast = []
    for window in P.WINDOWS:
        wid = window['id']; grid = P.sky_grid(window)
        if len(grid['times']) != N_T:
            raise ValueError('reloj inesperado')
        clock = json.loads((V01 / f'ephemerides/{wid}_clock.json').read_text(encoding='utf8'))
        if clock['times_utc'] != grid['times'] or not np.array_equal(np.asarray(clock['et_tdb_seconds_j2000']), grid['et']):
            raise ValueError(f'el reloj de {wid} no coincide con el del paquete v0.1')
        for site in sites:
            sid = site['id']; key = f'{wid}_{sid}'; scen_index[key] = {}
            t = time.time()
            for k in ks:
                h = height_of(k)
                metrics, s, dirs, sh, eh, states = P.classify(site, hds[sid], 'nominal', h, grid)
                ints = P.intervals(s, grid['times'])
                ints = json.loads(json.dumps(P.clean(ints)))
                b = scenario_bin(dirs, sh, eh, s); p = f'scenarios/{key}_{kname(k)}.bin'
                (out_dir / p).write_bytes(b); files[p] = dict(sha256=sha(b), bytes=len(b))
                m = json.loads(json.dumps(P.clean(metrics)))
                scen_index[key][kname(k)] = dict(height_m=h, status='READY_WITH_LIMITS' if metrics['unknown_hours'] == 0 else 'PARTIAL', metrics=m, intervals=ints)
                good = abs(m['known_hours'] + m['unknown_hours'] - 720) < 1e-8 and m['joint_hours'] <= min(m['sun_hours'], m['dte_center_hours']) + 1e-8
                tests.append(dict(name=f'{key}_{kname(k)}_metric_bounds', passed=bool(good)))
                if k in (0, 4, 20):
                    contrast.append(compare_v01(sid, wid, k, hds[sid]['variants']['nominal'][str(h)], dirs, sh, eh, s, m, ints))
            timing['classify_seconds'][key] = round(time.time() - t, 2)
        print('WINDOW', wid, 'READY', flush=True)
    # Índices pequeños: uno para los horizontes y uno por ventana y sitio (métricas e intervalos de sus 61 alturas).
    for name, obj in [('horizons/index.json', horizon_index)] + [(f'scenarios/{key}.json', v) for key, v in scen_index.items()]:
        b = json.dumps(obj, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode('utf8')
        (out_dir / name).write_bytes(b); files[name] = dict(sha256=sha(b), bytes=len(b))
    timing['total_seconds'] = round(time.time() - t0, 1)
    passport = json.loads((SOURCE / 'datos/pasaporte.json').read_text(encoding='utf8'))
    used = [a for a in passport['source_assets'] if a['id'] in ['SITE01_surf', 'SITE01_ROIS', 'DEM_REGIONAL_80M', 'DEM_LEJANO_240M', 'LSK', 'SPK_DE421', 'PCK_MOON_DE421', 'FK_MOON_DE421', 'PCK_CONSTANTS']]
    for a in used:
        if hashlib.sha256((RAW / a['path']).read_bytes()).hexdigest() != a['sha256']:
            raise ValueError('Source checksum mismatch ' + a['id'])
    manifest = dict(
        schema='site-regret-engineer-heights/1', package_version='1.0.0',
        generated_at_utc=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
        scope='Solo Engineer. Superficie nominal (DEM LOLA PGDA78 Site01 + apoyo PGDA90 80/240 m), sitios A y B, ventanas W1 y W2. No sustituye ni amplía el contrato site-regret/0.1 (120 escenarios), que sigue intacto.',
        heights=dict(key='k = 2 × altura (m); entero 0…60', count=len(ks), positions=[dict(k=k, key=kname(k), height_m=height_of(k)) for k in ks]),
        scenario_count=len(ks) * 4, nature=dict(terrain='DERIVED_PUBLISHED', ephemerides='DERIVED_SPICE', heights='SIMULATED'),
        clock=dict(shared_with='site-regret/0.1 ephemerides/<W>_clock.json (verificado igual muestra a muestra)', samples=N_T, step_minutes=P.CONFIG['time_step_minutes']),
        layouts={
            'horizons/<S>_<k>.bin': [dict(name='elevation_deg', dtype='<f8', length=N_AZ), dict(name='distance_m', dtype='<f4', length=N_AZ, note='exacto: verificado al escribir'),
                                    dict(name='source', dtype='u1', length=N_AZ, note='0 local 5 m · 1 regional 80 m · 2 lejano 240 m'), dict(name='unknown', dtype='u1', length=N_AZ)],
            'scenarios/<W>_<S>_<k>.bin': [dict(name='sun_azimuth_deg', dtype='<f8', length=N_T), dict(name='sun_elevation_deg', dtype='<f8', length=N_T),
                                         dict(name='earth_azimuth_deg', dtype='<f8', length=N_T), dict(name='earth_elevation_deg', dtype='<f8', length=N_T),
                                         dict(name='sun_horizon_deg', dtype='<f8', length=N_T, note='NaN = desconocido'), dict(name='earth_horizon_deg', dtype='<f8', length=N_T, note='NaN = desconocido'),
                                         dict(name='state_codes', dtype='u1', length=N_T - 1, note='0 NEITHER · 1 SUN_ONLY · 2 EARTH_ONLY · 3 BOTH · 4 UNKNOWN')],
            'azimuth_deg': 'k · 0,25°, k = 0…1439 (igual que v0.1)'},
        method=dict(engine='web/data/source/DERIVADOS_SITE_REGRET/motor/pipeline.py (importado sin modificar)', engine_sha256=hashlib.sha256((SOURCE / 'motor/pipeline.py').read_bytes()).hexdigest(),
                    generator='web/scripts/engine/engineer_heights.py', generator_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                    differences_from_engine=['Bucle de alturas reescrito para k = 2·h (medios metros); cota lejana con la altura real (float) en lugar de int(h); solo superficie nominal'],
                    reused_from_engine=['prepare', 'radial_grids', 'rays', 'sample', 'elevation_terrain', 'load_kernels', 'sky_grid', 'classify', 'intervals', 'CONFIG'],
                    configuration={k: P.CONFIG[k] for k in ['frame', 'reference_radius_m', 'time_step_minutes', 'azimuth_step_deg', 'max_ray_distance_m', 'minimum_ray_distance_m',
                                                           'base_radial_refinement_factor', 'body_visibility', 'aberration', 'far_terrain_upper_bound_m']}),
        kernel_validation=kern, source_assets=used,
        software={p: __import__('importlib.metadata').metadata.version(p) for p in ['numpy', 'scipy', 'rasterio', 'pyproj', 'spiceypy', 'pyshp']}, python=sys.version,
        timing=timing, contrast_with_v0_1=contrast,
        validation=dict(passed=sum(t['passed'] for t in tests), failed=sum(not t['passed'] for t in tests),
                        contrast_passed=sum(c['passed'] for c in contrast), contrast_failed=sum(not c['passed'] for c in contrast)),
        files=files)
    (out_dir / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1, allow_nan=False), encoding='utf8')
    (out_dir / 'tests.json').write_text(json.dumps(tests, separators=(',', ':')), encoding='utf8')
    print('COMPLETE', json.dumps(manifest['validation']), timing['total_seconds'], 's', flush=True)
    if manifest['validation']['failed'] or manifest['validation']['contrast_failed']:
        raise SystemExit('VALIDATION_FAILED')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--pilot', action='store_true'); g.add_argument('--all', action='store_true')
    a = ap.parse_args()
    if a.pilot:
        run(K_PILOT, OUT_PILOT, per_height_timing=True)
    else:
        run(K_ALL, OUT_ALL, per_height_timing=False)
