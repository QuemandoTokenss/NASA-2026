/**
 * Geometría lunar del proyecto. Transcribe las operaciones del motor
 * (`motor/pipeline.py`: `xyz_unit`, `stereo`, `basis`, `rays`,
 * `elevation_terrain`) para que mapa, perfil, terreno 3D y obstáculo usen
 * EXACTAMENTE la misma convención que los resultados precalculados:
 *
 * - Esfera de referencia R = 1 737 400 m, marco MOON_ME_DE421.
 * - Estereográfica polar sur, lat0 = −90°, lon0 = 0°, k0 = 1; X/Y en metros.
 * - Longitud positiva al este; azimut 0° = norte local, creciente hacia el este.
 *
 * Nada aquí usa radios o proyecciones terrestres. Los tests contrastan estas
 * funciones con las coordenadas del paquete y con el horizonte del motor.
 */
export const MOON_RADIUS_M = 1737400;
const R = MOON_RADIUS_M;
const RAD = Math.PI / 180;

export type Vec3 = [number, number, number];
export interface XY {
  x: number;
  y: number;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Vector unitario (marco lunar) del punto de la esfera con X/Y estereográficos. */
export function unitFromXY(x: number, y: number): Vec3 {
  const rho = Math.hypot(x, y);
  const lat = -Math.PI / 2 + 2 * Math.atan(rho / (2 * R));
  const lon = Math.atan2(x, y);
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

/** X/Y estereográficos de un vector unitario (inversa de `unitFromXY`). */
export function xyFromUnit(u: Vec3): XY {
  const k = (2 * R) / (1 - u[2]);
  return { x: u[1] * k, y: u[0] * k };
}

/** Longitud este (0…360°) y latitud planetocéntrica (esfera) de un punto X/Y. */
export function xyToLonLat(x: number, y: number): { lonEastDeg: number; latDeg: number } {
  const rho = Math.hypot(x, y);
  const lat = -90 + (2 * Math.atan(rho / (2 * R))) / RAD;
  const lon = Math.atan2(x, y) / RAD;
  return { lonEastDeg: ((lon % 360) + 360) % 360, latDeg: lat };
}

export function lonLatToXY(lonEastDeg: number, latDeg: number): XY {
  const lo = lonEastDeg * RAD;
  const la = latDeg * RAD;
  return xyFromUnit([Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]);
}

/** Base local este / norte / arriba en un punto (convención del motor). */
export function localBasis(lonEastDeg: number, latDeg: number): { e: Vec3; n: Vec3; u: Vec3 } {
  const lo = lonEastDeg * RAD;
  const la = latDeg * RAD;
  return {
    e: [-Math.sin(lo), Math.cos(lo), 0],
    n: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)],
    u: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)],
  };
}

/**
 * Punto de la esfera a un arco `arcM` del sitio en el azimut dado (rayo curvo
 * del motor), en X/Y estereográficos.
 */
export function rayPoint(site: { lonEastDeg: number; latDeg: number }, azimuthDeg: number, arcM: number): XY {
  const { e, n, u } = localBasis(site.lonEastDeg, site.latDeg);
  const az = azimuthDeg * RAD;
  const theta = arcM / R;
  const s = Math.sin(az);
  const c = Math.cos(az);
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  return xyFromUnit([
    ct * u[0] + st * (s * e[0] + c * n[0]),
    ct * u[1] + st * (s * e[1] + c * n[1]),
    ct * u[2] + st * (s * e[2] + c * n[2]),
  ]);
}

/**
 * Elevación angular (°) de un punto del terreno de altura `z` a un arco
 * `arcM`, vista desde un observador de altura radial `observerZ` (suelo +
 * mástil), con curvatura lunar. Igual que `elevation_terrain` del motor.
 */
export function terrainElevationDeg(z: number, observerZ: number, arcM: number): number {
  const theta = arcM / R;
  const vertical = z - observerZ - (R + z) * 2 * Math.sin(theta / 2) ** 2;
  const horizontal = (R + z) * Math.sin(theta);
  return Math.atan2(vertical, horizontal) / RAD;
}

/** Altura del terreno que produce una elevación angular dada (inversa de la anterior). */
export function terrainHeightFromElevation(elevationDeg: number, observerZ: number, arcM: number): number {
  const theta = arcM / R;
  const k = 2 * Math.sin(theta / 2) ** 2 + Math.tan(elevationDeg * RAD) * Math.sin(theta);
  return (observerZ + R * k) / (1 - k);
}

/** Azimut (°, 0 = norte local, hacia el este) de `to` visto desde `from`, ambos en X/Y. */
export function azimuthBetween(from: XY, to: XY): number {
  const ll = xyToLonLat(from.x, from.y);
  const { e, n } = localBasis(ll.lonEastDeg, ll.latDeg);
  const v = unitFromXY(to.x, to.y);
  return ((Math.atan2(dot(v, e), dot(v, n)) / RAD) % 360 + 360) % 360;
}

/** Distancia sobre la esfera de referencia (arco de círculo máximo), en metros. */
export function arcDistanceM(a: XY, b: XY): number {
  const ua = unitFromXY(a.x, a.y);
  const ub = unitFromXY(b.x, b.y);
  const cross: Vec3 = [ua[1] * ub[2] - ua[2] * ub[1], ua[2] * ub[0] - ua[0] * ub[2], ua[0] * ub[1] - ua[1] * ub[0]];
  return R * Math.atan2(Math.hypot(...cross), dot(ua, ub));
}

/** Distancia euclídea 3D entre dos puntos con su altura sobre la esfera, en metros. */
export function chordDistanceM(a: XY & { z: number }, b: XY & { z: number }): number {
  const ua = unitFromXY(a.x, a.y);
  const ub = unitFromXY(b.x, b.y);
  const ra = R + a.z;
  const rb = R + b.z;
  return Math.hypot(ra * ua[0] - rb * ub[0], ra * ua[1] - rb * ub[1], ra * ua[2] - rb * ub[2]);
}

/**
 * Factor de escala local de la proyección (distancia en el mapa / distancia
 * en la esfera). Cerca del polo es ≈ 1: se informa para no ocultarlo.
 */
export function stereographicScale(x: number, y: number): number {
  const { latDeg } = xyToLonLat(x, y);
  return 2 / (1 + Math.sin(Math.abs(latDeg) * RAD));
}
