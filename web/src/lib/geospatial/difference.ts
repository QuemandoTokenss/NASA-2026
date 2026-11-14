/**
 * Diferencias entre superficies del DEM y entre horizontes del paquete.
 *
 * - `differenceGrid`: clon − nominal, píxel a píxel, sobre dos recortes
 *   EXACTOS de la misma rejilla (mismos bordes, 5 m). No se remuestrea ni se
 *   rellena: si cualquiera de los dos es nodata, el resultado es NaN.
 *   El valor se redondea a float32 (`Math.fround`), igual en Node y en el
 *   navegador, para que las estadísticas del manifiesto se puedan reproducir.
 * - `horizonDelta`: elevación del horizonte de una variante menos la nominal,
 *   azimut a azimut, leída del paquete (no se recalcula ningún horizonte).
 *   Un azimut desconocido en cualquiera de las dos superficies queda `null`.
 *
 * Son DESCRIPCIONES de los datos. No atribuyen la causa de una inversión de la
 * decisión: esa relación no la calcula el motor y aquí no se infiere.
 *
 * Solo importa tipos: lo usan también los scripts de Node (sin alias).
 */
import type { RasterGrid } from "./raster";

export interface DifferenceStats {
  min: number;
  max: number;
  mean: number;
  mean_abs: number;
  rms: number;
  /** Percentil 99 de |valor| (rango de la escala de color que no satura con valores aislados). */
  abs_p99: number;
  finite_count: number;
  nodata_count: number;
}

export function differenceGrid(variant: RasterGrid, nominal: RasterGrid): RasterGrid {
  if (variant.width !== nominal.width || variant.height !== nominal.height || variant.xmin !== nominal.xmin || variant.ymax !== nominal.ymax || variant.pixelSizeM !== nominal.pixelSizeM)
    throw new Error("differenceGrid: las rejillas no coinciden");
  const out = new Float32Array(variant.data.length);
  for (let i = 0; i < out.length; i++) {
    const a = variant.data[i];
    const b = nominal.data[i];
    out[i] = Number.isFinite(a) && Number.isFinite(b) ? Math.fround(a - b) : NaN;
  }
  return { ...nominal, data: out };
}

export function differenceStats(data: ArrayLike<number>): DifferenceStats {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let sumAbs = 0;
  let sumSq = 0;
  let n = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (!Number.isFinite(v)) continue;
    n++;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    sumAbs += Math.abs(v);
    sumSq += v * v;
  }
  if (!n) return { min: NaN, max: NaN, mean: NaN, mean_abs: NaN, rms: NaN, abs_p99: NaN, finite_count: 0, nodata_count: data.length };
  const abs = new Float64Array(n);
  for (let i = 0, k = 0; i < data.length; i++) if (Number.isFinite(data[i])) abs[k++] = Math.abs(data[i]);
  abs.sort();
  // Percentil por el método «nearest rank»: sin interpolar entre muestras.
  const abs_p99 = abs[Math.min(n - 1, Math.ceil(0.99 * n) - 1)];
  return { min, max, mean: sum / n, mean_abs: sumAbs / n, rms: Math.sqrt(sumSq / n), abs_p99, finite_count: n, nodata_count: data.length - n };
}

/** Límite simétrico de la escala divergente: el mayor |valor| finito (0 si no hay datos). */
export function symmetricLimit(stats: Pick<DifferenceStats, "min" | "max">): number {
  const m = Math.max(Math.abs(stats.min), Math.abs(stats.max));
  return Number.isFinite(m) ? m : 0;
}

export interface HorizonLike {
  elevation_deg: number[];
  unknown: boolean[];
  source: number[];
  distance_m: number[];
}

export interface HorizonDelta {
  /** Δ elevación (°) por azimut; `null` si alguna de las dos superficies es desconocida. */
  delta: (number | null)[];
  /** Azimuts comparables (conocidos en ambas). */
  known: number;
  /** Índice del mayor |Δ| (−1 si no hay ninguno comparable). */
  maxIndex: number;
  maxAbs: number;
  rms: number;
  /** Azimuts en que el horizonte sube / baja más de `thresholdDeg`. */
  raised: number;
  lowered: number;
  /** Azimuts en que cambia el relieve que fija el horizonte (5 m / 80 m / 240 m). */
  sourceChanged: number;
}

export function horizonDelta(variant: HorizonLike, nominal: HorizonLike, thresholdDeg = 0.01): HorizonDelta {
  const n = nominal.elevation_deg.length;
  if (variant.elevation_deg.length !== n) throw new Error("horizonDelta: longitudes distintas");
  const delta: (number | null)[] = new Array(n);
  let known = 0;
  let maxIndex = -1;
  let maxAbs = 0;
  let sumSq = 0;
  let raised = 0;
  let lowered = 0;
  let sourceChanged = 0;
  for (let i = 0; i < n; i++) {
    if (variant.unknown[i] || nominal.unknown[i]) {
      delta[i] = null;
      continue;
    }
    const d = variant.elevation_deg[i] - nominal.elevation_deg[i];
    delta[i] = d;
    known++;
    sumSq += d * d;
    if (Math.abs(d) > maxAbs || maxIndex < 0) {
      maxAbs = Math.abs(d);
      maxIndex = i;
    }
    if (d > thresholdDeg) raised++;
    else if (d < -thresholdDeg) lowered++;
    if (variant.source[i] !== nominal.source[i]) sourceChanged++;
  }
  return { delta, known, maxIndex, maxAbs, rms: known ? Math.sqrt(sumSq / known) : NaN, raised, lowered, sourceChanged };
}

/**
 * RMS por bloques de k × k píxeles (bloques incompletos del borde se descartan).
 * Agregado SOLO para dibujar miniaturas: las cifras se dan sobre la rejilla completa.
 */
export function blockRms(g: RasterGrid, k: number): RasterGrid {
  const w = Math.floor(g.width / k);
  const h = Math.floor(g.height / k);
  const data = new Float32Array(w * h);
  for (let br = 0; br < h; br++)
    for (let bc = 0; bc < w; bc++) {
      let sum = 0;
      let n = 0;
      for (let r = br * k; r < br * k + k; r++)
        for (let c = bc * k; c < bc * k + k; c++) {
          const v = g.data[r * g.width + c];
          if (Number.isFinite(v)) {
            sum += v * v;
            n++;
          }
        }
      data[br * w + bc] = n ? Math.sqrt(sum / n) : NaN;
    }
  return { width: w, height: h, pixelSizeM: g.pixelSizeM * k, xmin: g.xmin, ymax: g.ymax, data };
}
