/**
 * Direcciones de Sol y Tierra en el marco lunar fijo (MOON_ME_DE421) a partir
 * del azimut/elevación TOPOCÉNTRICOS que trae el paquete (SPICE DE421, sin
 * refracción). Es un cambio de base exacto con la base local del motor
 * (`localBasis`): no se calcula ninguna efeméride nueva ni se interpola.
 *
 * Sirve para la vista orbital del Timeline: dónde están el Sol y la Tierra
 * «alrededor» de la Luna en cada instante. La dirección es la vista DESDE EL
 * SITIO; para la Tierra difiere de la vista desde el centro lunar en menos de
 * R_Luna / distancia ≈ 0,26°.
 */
import { localBasis, type Vec3 } from "./lunar";

const RAD = Math.PI / 180;

/** Vector unitario (marco lunar) de una dirección topocéntrica azimut/elevación. */
export function directionFromAzEl(site: { lonEastDeg: number; latDeg: number }, azimuthDeg: number, elevationDeg: number): Vec3 {
  const { e, n, u } = localBasis(site.lonEastDeg, site.latDeg);
  const az = azimuthDeg * RAD;
  const el = elevationDeg * RAD;
  const ce = Math.cos(el) * Math.sin(az);
  const cn = Math.cos(el) * Math.cos(az);
  const cu = Math.sin(el);
  return [ce * e[0] + cn * n[0] + cu * u[0], ce * e[1] + cn * n[1] + cu * u[1], ce * e[2] + cn * n[2] + cu * u[2]];
}

/** Inversa: azimut/elevación topocéntricos de un vector del marco lunar. */
export function azElFromDirection(site: { lonEastDeg: number; latDeg: number }, v: Vec3): { azimuthDeg: number; elevationDeg: number } {
  const { e, n, u } = localBasis(site.lonEastDeg, site.latDeg);
  const d = (a: Vec3) => a[0] * v[0] + a[1] * v[1] + a[2] * v[2];
  const norm = Math.hypot(v[0], v[1], v[2]);
  const az = Math.atan2(d(e), d(n)) / RAD;
  return { azimuthDeg: ((az % 360) + 360) % 360, elevationDeg: Math.asin(d(u) / norm) / RAD };
}

/**
 * Longitud este (0…360°) y «latitud» (declinación respecto al ecuador lunar)
 * de una dirección del marco lunar.
 */
export function directionLonLat(v: Vec3): { lonEastDeg: number; latDeg: number } {
  const lon = Math.atan2(v[1], v[0]) / RAD;
  return { lonEastDeg: ((lon % 360) + 360) % 360, latDeg: Math.asin(v[2] / Math.hypot(v[0], v[1], v[2])) / RAD };
}

/** Serie completa de longitudes/latitudes de un cuerpo en la ventana. */
export function bodyTrack(site: { lonEastDeg: number; latDeg: number }, azimuthDeg: number[], elevationDeg: number[]): { lonEastDeg: number[]; latDeg: number[] } {
  const lon = new Array<number>(azimuthDeg.length);
  const lat = new Array<number>(azimuthDeg.length);
  for (let i = 0; i < azimuthDeg.length; i++) {
    const ll = directionLonLat(directionFromAzEl(site, azimuthDeg[i], elevationDeg[i]));
    lon[i] = ll.lonEastDeg;
    lat[i] = ll.latDeg;
  }
  return { lonEastDeg: lon, latDeg: lat };
}

/** Ángulo entre dos direcciones (°). */
export function angleBetween(a: Vec3, b: Vec3): number {
  const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
  return Math.acos(Math.min(1, Math.max(-1, c))) / RAD;
}
