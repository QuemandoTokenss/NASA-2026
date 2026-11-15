"""SITE REGRET · Auditoría diagnóstica de la sensibilidad a la altura del observador (0 → 0,5 m).

NO es un escenario oficial ni amplía el contrato `site-regret/0.1`: es un experimento de auditoría.
Importa el motor original (`web/data/source/DERIVADOS_SITE_REGRET/motor/pipeline.py`) en solo lectura,
igual que `engineer_heights.py`, y redirige sus rutas a `web/data/raw/motor/` (originales verificados).

Experimentos (solo superficie nominal, sitios A/B, ventanas W1/W2, paso 10 min, 0,25° de azimut):
  1. Geometría local: cota del observador, 3×3 píxeles vecinos, plano bilineal (pendiente/orientación).
  2. Barrido de altura 0 / 0,1 / 0,25 / 0,5 / 1 / 2 / 5 / 10 m con el muestreo del motor.
  3. Sensibilidad del campo próximo a 0 / 0,5 / 2 m: interpolación (vecino, bilineal, B-spline cúbica),
     desplazamiento subpíxel del observador (±1,25 y ±2,5 m en E/N) y distancia mínima del rayo (2,5 / 5 / 10 m).
  4. Instantes críticos: rachas sin Sol de W2 a 0 m con Sol, horizonte, obstáculo y margen.
  5. Margen solar mínimo (Sol − horizonte) a 2 y 10 m y error vertical equivalente del obstáculo.
  6. Comprobación cartesiana independiente de `elevation_terrain` (vectores 3D, sin la fórmula del motor).

Uso (desde la raíz del repositorio):
  web/data/raw/motor-venv/Scripts/python -I web/scripts/engine/height_audit.py
Salida: web/data/derived/height-audit/v1/audit.json (determinista salvo `generated_at_utc`).
"""
from pathlib import Path
import datetime as dt, hashlib, json, sys

import numpy as np
from scipy.ndimage import map_coordinates

WEB = Path(__file__).resolve().parents[2]
SOURCE = WEB / 'data/source/DERIVADOS_SITE_REGRET'
sys.dont_write_bytecode = True
sys.path.insert(0, str(SOURCE / 'motor'))
import pipeline as P  # noqa: E402  (motor original, solo lectura)

RAW = WEB / 'data/raw/motor'
WORK = RAW / 'work-audit'
OUT = WEB / 'data/derived/height-audit/v1'
P.RAW = RAW
P.ROOT = WORK

SWEEP = [0, 0.1, 0.25, 0.5, 1, 2, 5, 10]
SENS_HEIGHTS = [0, 0.5, 2]
FACTOR = P.CONFIG['base_radial_refinement_factor']
STEP = P.CONFIG['azimuth_step_deg']
AZ = np.arange(0, 360, STEP)
NEAR_M = 50.0
CROP_M = 700.0  # ventana local para la B-spline (sin nodata) — el resto del rayo usa el bilineal del motor


def site_at(site, dx=0.0, dy=0.0):
    """Mismo sitio desplazado dx (E-estereográfico) / dy en metros; lon/lat recalculadas con la proyección del motor."""
    s = dict(site); x = site['x_m'] + dx; y = site['y_m'] + dy
    u = P.xyz_unit(np.array(x), np.array(y))
    s.update(x_m=float(x), y_m=float(y), latitude_deg=float(np.rad2deg(np.arcsin(u[2]))),
             longitude_east_deg=float(np.rad2deg(np.arctan2(u[1], u[0])) % 360))
    return s


class Sampler:
    """Interpolador del raster local: order 0 (vecino), 1 (bilineal del motor) o 3 (B-spline cúbica)."""

    def __init__(self, a, tr, order, center):
        self.a, self.tr, self.order = a, tr, order
        if order == 3:
            c0 = int((center[0] - tr.c) / tr.a); r0 = int((center[1] - tr.f) / tr.e)
            n = int(CROP_M / tr.a)
            self.r0, self.c0 = r0 - n, c0 - n
            sub = a[self.r0:r0 + n, self.c0:c0 + n].astype(np.float64)
            if not np.all(np.isfinite(sub)):
                raise ValueError('nodata en la ventana cúbica')
            self.sub = sub

    def __call__(self, x, y):
        x = np.asarray(x, float); y = np.asarray(y, float)
        if self.order == 1:
            return P.sample(self.a, self.tr, x, y)
        if self.order == -1:  # bilineal idéntico al motor pero con salida float64 (el motor devuelve float32)
            col = (x - self.tr.c) / self.tr.a - 0.5; row = (y - self.tr.f) / self.tr.e - 0.5
            return map_coordinates(self.a, [row, col], order=1, mode='constant', cval=np.nan, prefilter=False, output=np.float64)
        col = (x - self.tr.c) / self.tr.a - 0.5; row = (y - self.tr.f) / self.tr.e - 0.5
        if self.order == 0:
            return map_coordinates(self.a, [np.round(row), np.round(col)], order=0, mode='constant', cval=np.nan)
        out = P.sample(self.a, self.tr, x, y)
        rr = row - self.r0; cc = col - self.c0
        inside = (rr >= 2) & (cc >= 2) & (rr <= self.sub.shape[0] - 3) & (cc <= self.sub.shape[1] - 3)
        if inside.any():
            out = np.array(out, float)
            out[inside] = map_coordinates(self.sub, [rr[inside], cc[inside]], order=3, mode='nearest', prefilter=True)
        return out


def horizon_cfg(site, surface, tr, regional, rt, distant, dtf, heights, order=1, rmin=2.5):
    """Bucle de `pipeline.horizon` (una superficie) con interpolador local y distancia mínima configurables."""
    dl, dr = P.radial_grids(FACTOR)
    dl = dl[dl >= rmin - 1e-9]
    samp = Sampler(surface, tr, order, (site['x_m'], site['y_m']))
    ground = float(samp(np.array([site['x_m']]), np.array([site['y_m']]))[0])
    res = {h: dict(elevation_deg=np.full(len(AZ), -90.), distance_m=np.zeros(len(AZ)), source=np.zeros(len(AZ), np.int8),
                   unknown=np.zeros(len(AZ), bool)) for h in heights}
    xmin, xmax = tr.c + 2.5, tr.c + tr.a * (surface.shape[1] - .5)
    ymax, ymin = tr.f - 2.5, tr.f + tr.e * (surface.shape[0] - .5)
    for j in range(0, len(AZ), 60):
        ix = slice(j, min(j + 60, len(AZ))); aa = AZ[ix]
        xl, yl = P.rays(site, aa, dl); xr, yr = P.rays(site, aa, dr)
        inside = (xl >= xmin) & (xl <= xmax) & (yl >= ymin) & (yl <= ymax)
        fine = (xr >= xmin) & (xr <= xmax) & (yr >= ymin) & (yr <= ymax)
        rz80 = P.sample(regional, rt, xr, yr); rz240 = P.sample(distant, dtf, xr, yr)
        rz = np.where(np.isfinite(rz80), rz80, rz240); rvalid = np.isfinite(rz) & ~fine
        bad_region = np.any(~np.isfinite(rz) & ~fine, axis=1)
        lz = samp(xl, yl); lvalid = np.isfinite(lz) & inside
        bad = np.any(~np.isfinite(lz) & inside, axis=1) | bad_region
        rr = np.arange(len(aa))
        for h in heights:
            obs = ground + h
            el = np.where(lvalid, P.elevation_terrain(lz, obs, dl), -90)
            er = np.where(rvalid, P.elevation_terrain(rz, obs, dr), -90)
            al = np.argmax(el, axis=1); ar = np.argmax(er, axis=1)
            ml = el[rr, al]; mr = er[rr, ar]; lw = ml >= mr
            r = res[h]
            r['elevation_deg'][ix] = np.maximum(ml, mr)
            r['distance_m'][ix] = np.where(lw, dl[al], dr[ar])
            r['source'][ix] = np.where(lw, 0, np.where(np.isfinite(rz80[rr, ar]), 1, 2))
            r['unknown'][ix] = bad
    for h, r in res.items():
        tail = float(P.elevation_terrain(P.CONFIG['far_terrain_upper_bound_m'], ground + h, P.CONFIG['max_ray_distance_m']))
        if not np.all(r['elevation_deg'] > tail):
            r['unknown'] |= r['elevation_deg'] <= tail
    return ground, res


def hd_of(ground, res):
    return dict(azimuth_deg=AZ, observer_ground_height_m={'nominal': ground},
                variants={'nominal': {str(h): r for h, r in res.items()}}, sampling=dict(azimuth_step_deg=STEP))


def metrics_of(site, ground, res, h, grid):
    m, s, dirs, sh, eh, _ = P.classify(site, hd_of(ground, res), 'nominal', h, grid)
    return {k: round(float(v), 6) for k, v in m.items()}, s, dirs, sh, eh


def hm(x):
    return round(float(x), 4)


def local_geometry(site, a, tr):
    col = (site['x_m'] - tr.c) / tr.a - 0.5; row = (site['y_m'] - tr.f) / tr.e - 0.5
    r0, c0 = int(np.floor(row)), int(np.floor(col))
    win = a[r0 - 1:r0 + 3, c0 - 1:c0 + 3].astype(float)
    fr, fc = row - r0, col - c0
    z00, z01, z10, z11 = a[r0, c0], a[r0, c0 + 1], a[r0 + 1, c0], a[r0 + 1, c0 + 1]
    # gradiente del parche bilineal en el punto (x hacia +col, y hacia −row porque e < 0)
    dzdc = ((z01 - z00) * (1 - fr) + (z11 - z10) * fr) / tr.a
    dzdr = ((z10 - z00) * (1 - fc) + (z11 - z01) * fc) / tr.e
    gx, gy = float(dzdc), float(dzdr)  # dz/dx, dz/dy en metros de la rejilla estereográfica
    slope = float(np.rad2deg(np.arctan(np.hypot(gx, gy))))
    return dict(pixel_row=row, pixel_col=col, fractional_offset_px=[round(fr, 3), round(fc, 3)],
                window_4x4_m=np.round(win, 3).tolist(), window_relief_m=hm(np.nanmax(win) - np.nanmin(win)),
                bilinear_gradient_xy=[gx, gy], bilinear_slope_deg=round(slope, 4),
                note='x_m/y_m caen en el borde entre píxeles (offset 0,5 px): el observador se interpola entre 4 centros de píxel')


def plane_horizon(site, grad, az):
    """Elevación que verla un observador de 0 m sobre un plano con el gradiente dado, en cada azimut (ENU del sitio)."""
    # dirección de cada azimut en la rejilla estereográfica, medida con los propios rayos del motor a 1 m
    x, y = P.rays(site, np.asarray(az, float), np.array([0.0, 1.0]))
    dx = x[:, 1] - x[:, 0]; dy = y[:, 1] - y[:, 0]
    return np.rad2deg(np.arctan((grad[0] * dx + grad[1] * dy) / np.hypot(dx, dy)))


def cartesian_check(site, a, tr, ground, h):
    """Elevación de puntos del rayo calculada con vectores 3D independientes de `elevation_terrain`."""
    dl, _ = P.radial_grids(FACTOR); dl = dl[:60]
    worst = (0.0, 0.0)
    for azd in [0, 45, 90, 135, 180, 225, 270, 315]:
        x, y = P.rays(site, np.array([float(azd)]), dl)
        z32 = P.sample(a, tr, x, y)[0]  # float32, como en el motor
        z = z32.astype(np.float64)
        unit_t = P.xyz_unit(x[0], y[0])
        e, n, u = P.basis(site['longitude_east_deg'], site['latitude_deg'])
        obs = (P.R + ground + h) * u
        pts = (P.R + z)[:, None] * unit_t
        v = pts - obs
        el_cart = np.rad2deg(np.arcsin((v @ u) / np.linalg.norm(v, axis=1)))
        el_f64 = P.elevation_terrain(z, ground + h, dl)
        el_f32 = P.elevation_terrain(z32, ground + h, dl)
        worst = max(worst[0], float(np.max(np.abs(el_cart - el_f64)))), max(worst[1], float(np.max(np.abs(el_cart - el_f32))))
    return dict(formula_float64_vs_cartesian_deg=worst[0], engine_float32_vs_cartesian_deg=worst[1])


def streaks(mask):
    t = np.diff(np.r_[False, mask, False].astype(np.int8))
    return list(zip(np.flatnonzero(t == 1), np.flatnonzero(t == -1)))


def summarize(out):
    """Cifras mínimas que muestra la interfaz (Regret Lab), derivadas de audit.json sin redondeos ocultos."""
    sm = dict(schema='site-regret-height-audit-summary/1', nature=out['nature'], engine_sha256=out['engine_sha256'],
              script_sha256=out['script_sha256'], sites={})
    for sid, S in out['sites'].items():
        sens = S['near_field_sensitivity']
        dark = lambda name, w, h: sens[name]['windows'][w][str(h)]['longest_dark_hours']
        shifts = [n for n in sens if n.startswith('shift_')]
        st = S['W2_0m_dark_streaks']
        deepest = min(st, key=lambda c: c['sun_minus_horizon_deg']) if st else None
        above = [dark(n, w, h) for n in sens for w in ('W1', 'W2') for h in (0.5, 2)]
        sm['sites'][sid] = dict(
            toterr_m=S['published_slope_product']['toterr_m'],
            W2_0m_dark_engine_h=dark('engine_bilinear', 'W2', 0),
            W2_0m_dark_shift_range_h=[min(dark(n, 'W2', 0) for n in shifts), max(dark(n, 'W2', 0) for n in shifts)],
            W2_0m_dark_nearest_h=dark('nearest', 'W2', 0), W2_0m_dark_cubic_h=dark('cubic_bspline', 'W2', 0),
            W2_0m_deepest=None if deepest is None else dict(utc=deepest['deepest_utc'], sun_minus_horizon_deg=deepest['sun_minus_horizon_deg'],
                obstacle_distance_m=deepest['obstacle_distance_m'],
                equivalent_height_m=round(abs(np.tan(np.deg2rad(deepest['sun_minus_horizon_deg']))) * deepest['obstacle_distance_m'], 4)),
            dark_hours_max_at_0_5_and_2m_all_configs=max(above), configs_tested=len(sens),
            sun_margin_min_deg={h: {w: S['height_sweep'][h]['windows'][w]['sun_margin_min_deg'] for w in ('W1', 'W2')} for h in ('0', '0.5', '2', '10')},
            first_height_without_dark_W2_m=next((float(h) for h, r in S['height_sweep'].items() if r['windows']['W2']['metrics']['longest_dark_hours'] == 0), None))
    return sm


def main():
    sites, surfaces, tr, regional, rt, distant, dtf = P.prepare()
    nominal = surfaces['nominal']
    P.load_kernels()
    grids = {w['id']: P.sky_grid(w) for w in P.WINDOWS}
    out = dict(schema='site-regret-height-audit/1', nature='DIAGNOSTIC_AUDIT · no es un escenario del contrato site-regret/0.1',
               engine_sha256=hashlib.sha256((SOURCE / 'motor/pipeline.py').read_bytes()).hexdigest(),
               script_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
               generated_at_utc=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
               config=dict(sweep_heights_m=SWEEP, sensitivity_heights_m=SENS_HEIGHTS, azimuth_step_deg=STEP,
                           radial_factor=FACTOR, near_field_m=NEAR_M, time_step_minutes=10, surface='nominal'),
               sites={})
    for site in sites:
        sid = site['id']; print('SITE', sid, flush=True)
        S = out['sites'][sid] = {}
        geo = local_geometry(site, nominal, tr)
        S['local_geometry'] = geo
        S['published_slope_product'] = dict(slp_deg=site['values']['slp'], slperr_deg=site['values']['slperr'],
                                            toterr_m=site['values']['toterr'], ldec=site['values']['ldec'])
        # 2. barrido de altura (muestreo del motor)
        ground, res = horizon_cfg(site, nominal, tr, regional, rt, distant, dtf, SWEEP)
        S['observer_ground_height_m'] = ground
        S['cartesian_check_max_abs_deg'] = {str(h): cartesian_check(site, nominal, tr, ground, h) for h in [0, 0.5, 2]}
        ph = plane_horizon(site, geo['bilinear_gradient_xy'], AZ)
        r0 = res[0]; near0 = (r0['distance_m'] <= NEAR_M) & (r0['source'] == 0)
        S['facet_explanation_0m'] = dict(
            near_directions=int(near0.sum()),
            near_directions_at_2_5m=int(np.sum(near0 & (r0['distance_m'] == 2.5))),
            median_abs_diff_plane_vs_engine_deg_near=hm(np.median(np.abs(ph[near0] - r0['elevation_deg'][near0]))) if near0.any() else None,
            max_plane_horizon_deg=hm(ph.max()), azimuth_of_max_plane_deg=float(AZ[np.argmax(ph)]))
        sweep = {}
        for h in SWEEP:
            r = res[h]; near = (r['distance_m'] <= NEAR_M) & (r['source'] == 0)
            row = dict(near_field_directions=int(near.sum()), horizon_mean_deg=hm(np.mean(r['elevation_deg'])),
                       horizon_max_deg=hm(np.max(r['elevation_deg'])), unknown_directions=int(r['unknown'].sum()), windows={})
            for wid, grid in grids.items():
                m, s, dirs, sh, eh = metrics_of(site, ground, res, h, grid)
                sun = dirs['SUN']['elevation_deg'][:-1]; margin = sun - sh[:-1]
                k = int(np.nanargmin(margin))
                azs = dirs['SUN']['azimuth_deg'][k]; ia = int(np.floor(azs / STEP)) % len(AZ)
                row['windows'][wid] = dict(metrics=m,
                    sun_margin_min_deg=hm(margin[k]), sun_margin_min_utc=grid['times'][k],
                    sun_margin_min_azimuth_deg=hm(azs), sun_elevation_deg=hm(sun[k]),
                    obstacle_distance_m=float(r['distance_m'][ia]), obstacle_source=['PGDA78_5m', 'PGDA90_80m', 'PGDA90_240m'][int(r['source'][ia])],
                    equivalent_obstacle_height_error_m=hm(np.tan(np.deg2rad(abs(margin[k]))) * r['distance_m'][ia]),
                    sun_elevation_range_deg=[hm(np.min(sun)), hm(np.max(sun))])
            sweep[str(h)] = row
        S['height_sweep'] = sweep
        # 4. instantes críticos W2 a 0 m
        grid = grids['W2']
        m, s, dirs, sh, eh = metrics_of(site, ground, res, 0, grid)
        state_at = {h: metrics_of(site, ground, res, h, grid)[1] for h in [0.1, 0.25, 0.5, 1, 2]}
        dark = ((s == 0) | (s == 2))
        crit = []
        for a, b in streaks(dark):
            sun = dirs['SUN']['elevation_deg'][a:b]; hz = sh[a:b]; marg = sun - hz
            k = a + int(np.argmin(marg))  # instante más profundo de la sombra
            azs = dirs['SUN']['azimuth_deg'][k]; ia = int(np.floor(azs / STEP)) % len(AZ)
            sunlit = {str(h): int(np.sum((state_at[h][a:b] == 1) | (state_at[h][a:b] == 3))) for h in state_at}
            crit.append(dict(start_utc=grid['times'][a], stop_utc=grid['times'][b], hours=hm((b - a) / 6),
                             deepest_utc=grid['times'][k], sun_azimuth_deg=hm(azs), sun_elevation_deg=hm(dirs['SUN']['elevation_deg'][k]),
                             horizon_elevation_deg=hm(sh[k]), sun_minus_horizon_deg=hm(sun.min() - 0 if False else marg.min()),
                             obstacle_distance_m=float(res[0]['distance_m'][ia]), obstacle_source=['PGDA78_5m', 'PGDA90_80m', 'PGDA90_240m'][int(res[0]['source'][ia])],
                             facet_plane_horizon_deg=hm(ph[ia]),
                             horizon_at_heights_deg={str(h): hm(res[h]['elevation_deg'][ia]) for h in [0.1, 0.25, 0.5, 1, 2]},
                             sunlit_samples_of_streak_at_height={**sunlit, 'samples': int(b - a)}))
        S['W2_0m_dark_streaks'] = crit
        # 3. sensibilidad del campo próximo
        configs = [('engine_bilinear', dict()), ('nearest', dict(order=0)), ('cubic_bspline', dict(order=3)), ('bilinear_float64', dict(order=-1)),
                   ('rmin_5m', dict(rmin=5.0)), ('rmin_10m', dict(rmin=10.0))]
        for d in [1.25, 2.5]:
            for name, (dx, dy) in [('E', (d, 0)), ('W', (-d, 0)), ('N', (0, d)), ('S', (0, -d))]:
                configs.append((f'shift_{name}_{d}m', dict(shift=(dx, dy))))
        sens = {}
        for name, cfg in configs:
            shift = cfg.pop('shift', (0, 0)); st = site_at(site, *shift)
            g, rs = horizon_cfg(st, nominal, tr, regional, rt, distant, dtf, SENS_HEIGHTS, **cfg)
            row = dict(observer_ground_height_m=hm(g), windows={})
            for h in SENS_HEIGHTS:
                row[f'near_field_directions_{h}m'] = int(np.sum((rs[h]['distance_m'] <= NEAR_M) & (rs[h]['source'] == 0)))
            for wid, gr in grids.items():
                row['windows'][wid] = {str(h): {k: v for k, v in metrics_of(st, g, rs, h, gr)[0].items()
                                                if k in ('sun_hours', 'longest_dark_hours', 'dte_center_hours', 'joint_hours', 'unknown_hours')}
                                       for h in SENS_HEIGHTS}
            sens[name] = row; print(' ', name, flush=True)
        S['near_field_sensitivity'] = sens
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'summary.json').write_text(json.dumps(P.clean(summarize(out)), ensure_ascii=False, indent=1, allow_nan=False), encoding='utf8')
    (OUT / 'audit.json').write_text(json.dumps(P.clean(out), ensure_ascii=False, indent=1, allow_nan=False), encoding='utf8')
    print('WROTE', OUT / 'audit.json')


if __name__ == '__main__':
    main()
