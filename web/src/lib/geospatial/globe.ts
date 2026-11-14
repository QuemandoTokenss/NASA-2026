/**
 * Geometría del globo lunar del Dashboard. Funciones puras (sin three.js) para que
 * la colocación de A/B, la textura y la ocultación tras el limbo se puedan contrastar
 * con el paquete y con el mapa de la app en las pruebas.
 *
 * Marco de la escena: unidades de radios lunares, centro en el origen y
 *   x_escena = Y_luna (90° E) · y_escena = Z_luna (norte) · z_escena = X_luna (0°, hacia la Tierra).
 * Es una rotación propia del marco MOON_ME (no hay espejo): visto desde +z con +y arriba,
 * el este queda a la derecha, como la Luna vista desde la Tierra con el norte arriba.
 */
import { unitFromXY, type Vec3 } from "./lunar";

const RAD = Math.PI / 180;

/** Vector unitario lunar (MOON_ME) → coordenadas de la escena del globo. */
export const moonToScene = (m: Vec3): Vec3 => [m[1], m[2], m[0]];
export const sceneToMoon = (s: Vec3): Vec3 => [s[2], s[0], s[1]];

/** Punto de la esfera unidad (escena) de una longitud este y una latitud, en grados. */
export function sceneFromLonLat(lonEastDeg: number, latDeg: number): Vec3 {
  const lo = lonEastDeg * RAD;
  const la = latDeg * RAD;
  return moonToScene([Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]);
}

/** Punto de la esfera unidad (escena) de unas coordenadas X/Y estereográficas del proyecto (m). */
export const sceneFromXY = (x: number, y: number): Vec3 => moonToScene(unitFromXY(x, y));

/**
 * Coordenadas de textura de la LROC global (NASA SVS 4720): equirectangular con la columna 0 en
 * −180°, el centro en 0° y la fila superior en +90°. `v` crece hacia el norte (convención de
 * three.js con `flipY`).
 */
export function lrocUv(lonEastDeg: number, latDeg: number): { u: number; v: number } {
  const lon = ((((lonEastDeg + 180) % 360) + 360) % 360) - 180;
  return { u: (lon + 180) / 360, v: (latDeg + 90) / 180 };
}

/**
 * ¿Se ve un punto de la superficie desde la cámara? `camera` es la posición de la cámara
 * (radios lunares). Un punto p de la esfera unidad es visible si queda delante del limbo:
 * p · ĉ > 1 / |c|. `margin` (fracción del casquete visible, 0…1) retira los puntos que rozan el limbo.
 */
export function isFrontSide(point: Vec3, camera: Vec3, margin = 0): boolean {
  const d = Math.hypot(camera[0], camera[1], camera[2]);
  if (d <= 1) return false;
  return (point[0] * camera[0] + point[1] * camera[1] + point[2] * camera[2]) / d > 1 / d + margin * (1 - 1 / d);
}

/** ¿Tapa la Luna (esfera unidad) un cuerpo lejano en la dirección `dir` visto desde `camera`? */
export function isBehindMoon(dir: Vec3, camera: Vec3): boolean {
  const b = camera[0] * dir[0] + camera[1] * dir[1] + camera[2] * dir[2];
  const c = camera[0] ** 2 + camera[1] ** 2 + camera[2] ** 2 - 1;
  return b < 0 && b * b - c >= 0;
}

/** Separación en pantalla (px) por debajo de la cual A y B se dibujan como un solo marcador «A · B». */
export const CLUSTER_PX = 44;

export const shouldCluster = (a: { x: number; y: number }, b: { x: number; y: number }, thresholdPx = CLUSTER_PX) => Math.hypot(a.x - b.x, a.y - b.y) < thresholdPx;

/** Altura de la cámara sobre la superficie, en km, para un radio de 1 737,4 km. */
export const altitudeKm = (distance: number) => (distance - 1) * 1737.4;

/**
 * Opacidad de cada nivel de detalle polar según la altura de la cámara (radios lunares):
 * entra cuando la textura del nivel anterior ya no da resolución.
 */
export const DETAIL_FADE: Array<{ from: number; to: number }> = [
  { from: 1.25, to: 0.45 },
  { from: 0.13, to: 0.04 },
  { from: 0.013, to: 0.0045 },
];

export function detailOpacity(level: number, altitude: number): number {
  const f = DETAIL_FADE[level];
  const t = Math.min(1, Math.max(0, (Math.log(f.from) - Math.log(altitude)) / (Math.log(f.from) - Math.log(f.to))));
  return t * t * (3 - 2 * t);
}
