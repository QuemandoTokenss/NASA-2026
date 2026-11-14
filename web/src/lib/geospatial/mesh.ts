/**
 * Malla 3D del terreno a partir del raster del DEM. Cada vértice es una
 * MUESTRA REAL del raster (submuestreada 1 de cada `step`, nunca interpolada
 * ni inventada) colocada en su posición física: el punto de la esfera de
 * referencia elevado su altura, expresado en el marco local este/norte/arriba
 * del sitio. Por eso la malla incluye la curvatura lunar y las líneas de
 * visión son rectas. Los vértices sin dato no generan triángulos (hueco).
 *
 * La malla es solo para DIBUJAR: las medidas y la visibilidad se calculan con
 * el raster completo y con el motor, no con estos vértices.
 */
import { MOON_RADIUS_M, localBasis, unitFromXY, xyToLonLat, type Vec3, type XY } from "./lunar";
import type { RasterGrid } from "./raster";

export interface LocalFrame {
  /** Posición del origen (suelo del sitio) en el marco lunar, m. */
  origin: Vec3;
  e: Vec3;
  n: Vec3;
  u: Vec3;
}

export function localFrame(site: XY, groundZ: number): LocalFrame {
  const ll = xyToLonLat(site.x, site.y);
  const { e, n, u } = localBasis(ll.lonEastDeg, ll.latDeg);
  const r = MOON_RADIUS_M + groundZ;
  const p = unitFromXY(site.x, site.y);
  return { origin: [p[0] * r, p[1] * r, p[2] * r], e, n, u };
}

/** Coordenadas locales [este, norte, arriba] (m) de un punto X/Y con altura z. */
export function toLocal(f: LocalFrame, x: number, y: number, z: number): Vec3 {
  const p = unitFromXY(x, y);
  const r = MOON_RADIUS_M + z;
  const d: Vec3 = [p[0] * r - f.origin[0], p[1] * r - f.origin[1], p[2] * r - f.origin[2]];
  return [d[0] * f.e[0] + d[1] * f.e[1] + d[2] * f.e[2], d[0] * f.n[0] + d[1] * f.n[1] + d[2] * f.n[2], d[0] * f.u[0] + d[1] * f.u[1] + d[2] * f.u[2]];
}

/** Vector unitario [este, norte, arriba] de una dirección dada por azimut y elevación. */
export function directionENU(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
}

export interface TerrainMesh {
  /** [este, arriba, −norte] por vértice (convención Y-arriba de la escena). */
  positions: Float32Array;
  /** Altura original del raster en cada vértice (m sobre la esfera). */
  heights: Float32Array;
  indices: Uint32Array;
  cols: number;
  rows: number;
  step: number;
  /** Separación entre vértices (m). */
  spacingM: number;
  nodataVertices: number;
  minHeight: number;
  maxHeight: number;
}

export function buildTerrainMesh(g: RasterGrid, frame: LocalFrame, step = 1): TerrainMesh {
  const cols = Math.floor((g.width - 1) / step) + 1;
  const rows = Math.floor((g.height - 1) / step) + 1;
  const positions = new Float32Array(cols * rows * 3);
  const heights = new Float32Array(cols * rows);
  let nodataVertices = 0;
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (let r = 0; r < rows; r++) {
    const y = g.ymax - (r * step + 0.5) * g.pixelSizeM;
    for (let c = 0; c < cols; c++) {
      const x = g.xmin + (c * step + 0.5) * g.pixelSizeM;
      const z = g.data[r * step * g.width + c * step];
      const i = r * cols + c;
      heights[i] = z;
      if (!Number.isFinite(z)) {
        nodataVertices++;
        positions[3 * i] = positions[3 * i + 1] = positions[3 * i + 2] = NaN;
        continue;
      }
      if (z < minHeight) minHeight = z;
      if (z > maxHeight) maxHeight = z;
      const [east, north, up] = toLocal(frame, x, y, z);
      positions[3 * i] = east;
      positions[3 * i + 1] = up;
      positions[3 * i + 2] = -north;
    }
  }
  const idx: number[] = [];
  for (let r = 0; r + 1 < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      if (Number.isFinite(heights[a]) && Number.isFinite(heights[b]) && Number.isFinite(heights[d]) && Number.isFinite(heights[e])) idx.push(a, d, b, b, d, e);
    }
  }
  return { positions, heights, indices: Uint32Array.from(idx), cols, rows, step, spacingM: step * g.pixelSizeM, nodataVertices, minHeight, maxHeight };
}
