/**
 * «¿Qué tapa el Sol o la Tierra?» — lectura del horizonte PRECALCULADO por el
 * motor. Para cada azimut el paquete guarda la elevación del horizonte, la
 * distancia (arco) a la muestra de terreno que fija ese máximo y de qué
 * relieve procede (0 = DEM local 5 m, 1 = regional 80 m, 2 = apoyo 240 m).
 * Aquí solo se localiza ese punto con el mismo rayo curvo del motor; no se
 * recalcula la visibilidad.
 */
import { rayPoint, terrainHeightFromElevation, type XY } from "./lunar";

export interface HorizonProfileLike {
  elevation_deg: number[];
  distance_m: number[];
  source: number[];
  unknown: boolean[];
}

export interface HorizonObstacle {
  /** Azimut consultado (°). */
  azimuthDeg: number;
  /** Horizonte interpolado periódicamente en ese azimut, como `horizon_at` del motor (°). `null` si es desconocido. */
  horizonDeg: number | null;
  /** Azimut de la muestra del motor usada para localizar el obstáculo (la más cercana). */
  sampleAzimuthDeg: number;
  /** Elevación del horizonte en esa muestra (°). */
  sampleElevationDeg: number;
  /** Arco sobre la esfera de referencia hasta el obstáculo (m). */
  distanceM: number;
  /** 0 = DEM local 5 m; 1 = regional 80 m; 2 = apoyo 240 m. */
  source: number;
  unknown: boolean;
  /** Posición del obstáculo en X/Y estereográficos. */
  point: XY;
  /** Altura del terreno en el obstáculo deducida de ángulo y distancia (m sobre la esfera). */
  heightM: number;
}

/** Interpolación periódica en azimut (np.interp con cierre en 360°). */
export function horizonAt(azimuthDeg: number[], profile: HorizonProfileLike, queryDeg: number): number | null {
  const n = azimuthDeg.length;
  const step = 360 / n;
  const q = ((queryDeg % 360) + 360) % 360;
  const i = Math.floor(q / step) % n;
  const j = (i + 1) % n;
  if (profile.unknown[i] || profile.unknown[j]) return null;
  const f = (q - azimuthDeg[i]) / step;
  return profile.elevation_deg[i] * (1 - f) + profile.elevation_deg[j] * f;
}

export function horizonObstacle(
  azimuthDeg: number[],
  profile: HorizonProfileLike,
  site: { lonEastDeg: number; latDeg: number },
  observerZ: number,
  queryDeg: number,
): HorizonObstacle {
  const n = azimuthDeg.length;
  const step = 360 / n;
  const q = ((queryDeg % 360) + 360) % 360;
  const k = Math.round(q / step) % n;
  const distanceM = profile.distance_m[k];
  const sampleElevationDeg = profile.elevation_deg[k];
  return {
    azimuthDeg: q,
    horizonDeg: horizonAt(azimuthDeg, profile, q),
    sampleAzimuthDeg: azimuthDeg[k],
    sampleElevationDeg,
    distanceM,
    source: profile.source[k],
    unknown: profile.unknown[k],
    point: rayPoint(site, azimuthDeg[k], distanceM),
    heightM: terrainHeightFromElevation(sampleElevationDeg, observerZ, distanceM),
  };
}

export const HORIZON_SOURCE_RESOLUTION_M = [5, 80, 240] as const;
