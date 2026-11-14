/**
 * Raster numérico georreferenciado (capa ANALÍTICA). Las lecturas, perfiles
 * y mallas se hacen sobre estos valores float32, nunca sobre los colores de
 * una imagen. `NaN` es nodata y se conserva: no se convierte en cero.
 */
import type { XY } from "./lunar";

export interface RasterGrid {
  width: number;
  height: number;
  pixelSizeM: number;
  /** Borde oeste de la rejilla (m). */
  xmin: number;
  /** Borde norte de la rejilla (y máxima, m). Fila 0 = y máxima. */
  ymax: number;
  data: Float32Array;
}

export type Coverage = "inside" | "outside";

export const gridBounds = (g: RasterGrid): [number, number, number, number] => [
  g.xmin,
  g.ymax - g.height * g.pixelSizeM,
  g.xmin + g.width * g.pixelSizeM,
  g.ymax,
];

export function pixelAt(g: RasterGrid, x: number, y: number): { col: number; row: number } | null {
  const col = Math.floor((x - g.xmin) / g.pixelSizeM);
  const row = Math.floor((g.ymax - y) / g.pixelSizeM);
  return col >= 0 && row >= 0 && col < g.width && row < g.height ? { col, row } : null;
}

export const pixelCenter = (g: RasterGrid, col: number, row: number): XY => ({
  x: g.xmin + (col + 0.5) * g.pixelSizeM,
  y: g.ymax - (row + 0.5) * g.pixelSizeM,
});

/** Valor del píxel que contiene el punto. `null` = fuera de cobertura; `NaN` = nodata. */
export function sampleNearest(g: RasterGrid, x: number, y: number): number | null {
  const p = pixelAt(g, x, y);
  return p ? g.data[p.row * g.width + p.col] : null;
}

/**
 * Interpolación bilineal entre centros de píxel, como `sample` del motor
 * (scipy `map_coordinates`, orden 1). Devuelve `NaN` fuera de los centros o
 * si algún vecino es nodata: no se rellena.
 */
export function sampleBilinear(g: RasterGrid, x: number, y: number): number {
  const c = (x - g.xmin) / g.pixelSizeM - 0.5;
  const r = (g.ymax - y) / g.pixelSizeM - 0.5;
  if (!(c >= 0 && r >= 0 && c <= g.width - 1 && r <= g.height - 1)) return NaN;
  const c0 = Math.min(Math.floor(c), g.width - 2);
  const r0 = Math.min(Math.floor(r), g.height - 2);
  const fc = c - c0;
  const fr = r - r0;
  const i = r0 * g.width + c0;
  const v00 = g.data[i];
  const v01 = g.data[i + 1];
  const v10 = g.data[i + g.width];
  const v11 = g.data[i + g.width + 1];
  return v00 * (1 - fc) * (1 - fr) + v01 * fc * (1 - fr) + v10 * (1 - fc) * fr + v11 * fc * fr;
}

export interface RasterStats {
  min: number;
  max: number;
  finiteCount: number;
  nodataCount: number;
}

export function rasterStats(data: ArrayLike<number>): RasterStats {
  let min = Infinity;
  let max = -Infinity;
  let finiteCount = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (Number.isFinite(v)) {
      finiteCount++;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return { min, max, finiteCount, nodataCount: data.length - finiteCount };
}

export interface ProfileSample {
  /** Distancia acumulada sobre la esfera de referencia (m). */
  distanceM: number;
  x: number;
  y: number;
  /** Altura interpolada (m) o `null` si no hay dato (fuera de cobertura o nodata). */
  value: number | null;
}

/**
 * Perfil a lo largo de una polilínea en X/Y, muestreando el raster cada
 * `stepM` (por defecto el tamaño de píxel). Los huecos se conservan como `null`.
 * `distance(a, b)` debe devolver la distancia sobre la esfera entre dos puntos.
 */
export function profileAlong(g: RasterGrid, line: XY[], distance: (a: XY, b: XY) => number, stepM = g.pixelSizeM): ProfileSample[] {
  const out: ProfileSample[] = [];
  let acc = 0;
  for (let s = 0; s + 1 < line.length; s++) {
    const a = line[s];
    const b = line[s + 1];
    const len = distance(a, b);
    const n = Math.max(1, Math.ceil(len / stepM));
    for (let k = s === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const v = sampleBilinear(g, x, y);
      out.push({ distanceM: acc + len * t, x, y, value: Number.isFinite(v) ? v : null });
    }
    acc += len;
  }
  return out;
}
