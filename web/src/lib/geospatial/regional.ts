/**
 * Relieve REGIONAL para el visor 3D de Engineer: pirámide por bloques y niveles de detalle
 * generada por `scripts/geospatial/build-regional.ts` a partir de los originales PGDA 90
 * (LOLA, 80 m y 240 m), los mismos que usa el motor para el horizonte hasta 400 km. Se
 * publica en `public/data/site-regret/terrain-regional/v1/`.
 *
 * - Mismo marco que el resto del proyecto: X/Y de la estereográfica polar sur lunar
 *   (R = 1 737 400 m, MOON_ME_DE421), alturas en metros sobre esa esfera.
 * - Cada vértice es una muestra real del original (el centro de un píxel). Los niveles
 *   gruesos son submuestreos anidados: los vértices compartidos entre bloques vecinos y
 *   entre niveles son idénticos, así que no hay costuras de dato.
 * - Los bloques se piden bajo demanda, se comprueban con el SHA-256 del manifiesto y se
 *   guardan en memoria. El nodata se conserva como `NaN` (nunca 0) y deja hueco en la malla.
 *
 * Este módulo no usa three.js ni recalcula visibilidad: solo localiza, carga, muestrea y
 * coloca el relieve en el marco local de la escena (este / arriba / −norte, con la
 * curvatura lunar), igual que `mesh.ts` hace con el DEM local de 5 m.
 */
import manifestJson from "../../../data/derived/terrain-regional/v1/manifest.json";
import { BASE_PATH } from "../data/loader";
import { DATA_ROOT } from "../data/manifest";
import { rayPoint, type XY } from "./lunar";
import { toLocal, type LocalFrame } from "./mesh";
import { TerrainError } from "./terrain";

export type RegionalLevelId = "L0" | "L1" | "L2" | "N240" | "F";
/** [xmin, ymin, xmax, ymax] en X/Y estereográficos (m). */
export type Bounds = [number, number, number, number];

export interface RegionalLevel {
  id: RegionalLevelId;
  /** Producto de origen: `pgda90_80m` o `pgda90_240m`. */
  source: string;
  role: "native" | "overview" | "far";
  /** Nivel de visión general pensado para cargarse siempre. */
  preload: boolean;
  /** 1 de cada `stride` muestras del original. */
  stride: number;
  index_offset: number;
  /** Separación entre vértices (m). */
  spacing_m: number;
  /** X del vértice de la columna 0 e Y del vértice de la fila 0 (fila 0 = y máxima). */
  x0_m: number;
  y0_m: number;
  /** Vértices del nivel completo. */
  cols: number;
  rows: number;
  block_cells: number;
  block_size_m: number;
  block_count: number;
  bytes: number;
  description: string;
}

export interface RegionalBlockEntry {
  /** `<nivel>/<bx>_<by>`; el archivo es `<id>.i16`. */
  id: string;
  level: RegionalLevelId;
  bx: number;
  by: number;
  cols: number;
  rows: number;
  bytes: number;
  sha256: string;
  offset_q: number;
  min_m: number;
  max_m: number;
  nodata_fraction: number;
  /** Por qué existe el bloque: `horizon` (punto del motor), `ring`, `mid`, `overview`, `far`, `extra`. */
  why: string[];
  /** Puntos del motor que fijan un horizonte dentro del bloque (todas las superficies y alturas). */
  horizon_points: number;
}

export interface RegionalSource {
  id: string;
  passport_id: string;
  title: string;
  provider: string;
  product_page: string;
  credit: string;
  file: string;
  url: string;
  bytes: number;
  sha256: string;
  server_last_modified: string | null;
  verification: string;
  pixel_size_m: number;
  width: number;
  height: number;
  bounds_xy_m: Bounds;
  stats: { min: number; max: number; nodata_count: number };
}

export interface RegionalManifest {
  schema: "site-regret-terrain-regional/1";
  version: string;
  generator: string;
  generator_version: number;
  generator_sha256: string;
  build_args: string[];
  region: string;
  georeferencing: { crs: string; frame: string; sphere_radius_m: number; vertical_reference: string; vertex_model: string };
  encoding: { dtype: "int16-le"; scale_m: number; nodata: number; formula: string; block_cells: number; max_quantization_error_m: number; quantization_bound_m: number };
  sources: RegionalSource[];
  engine_convention: { description: string; local_region_bounds_xy_m: Bounds; regional_min_distance_m: number; max_ray_distance_m: number; source_codes: Record<string, string> };
  levels: RegionalLevel[];
  blocks: RegionalBlockEntry[];
  coverage: {
    sites: Array<{ id: string; x_m: number; y_m: number }>;
    ring_km: number;
    mid_km: number;
    far_km: number;
    rules: string[];
    horizon_sectors: Array<{ site: string; azimuth_deg: [number, number]; engine_points: number; distance_km: [number, number]; blocks: string[] }>;
  };
  validation: {
    engine_points: number;
    engine_points_by_source: { regional_80m: number; far_240m: number };
    engine_point_distance_m: [number, number];
    max_horizon_delta_deg_original: number;
    max_horizon_delta_deg_blocks: number;
    horizon_tolerance_deg: number;
    horizon_tolerance_note: string;
    worst_point: { site: string; set: string; azimuth_deg: number; distance_m: number; delta_deg: number } | null;
    shared_edge_vertices_checked: number;
    nested_level_vertices_checked: number;
    vs_local_dem_window: { description: string; samples: number; mean_m: number; rms_m: number; max_abs_m: number } | null;
  };
  total_bytes: number;
  limits: string[];
}

export const REGIONAL_MANIFEST = manifestJson as unknown as RegionalManifest;
export const REGIONAL_DIR = "terrain-regional/v1";
export const regionalUrl = (file: string) => `${BASE_PATH}/${DATA_ROOT}/${REGIONAL_DIR}/${file}`;
/** URL pública del manifiesto (el mismo contenido viaja dentro de la aplicación). */
export const REGIONAL_MANIFEST_URL = regionalUrl("manifest.json");

/**
 * Orden de preferencia al elegir relieve en un punto: primero el producto de 80 m, del más
 * fino al más grueso, y después el de 240 m. Es la convención del motor (80 m donde tiene
 * dato; 240 m solo donde no), aplicada además de fino a grueso.
 */
export const REGIONAL_LEVEL_ORDER: RegionalLevelId[] = ["L0", "L1", "L2", "N240", "F"];

const LEVELS = new Map(REGIONAL_MANIFEST.levels.map((l) => [l.id, l]));
const BLOCKS = new Map(REGIONAL_MANIFEST.blocks.map((b) => [b.id, b]));

export function regionalLevel(id: RegionalLevelId): RegionalLevel {
  const l = LEVELS.get(id);
  if (!l) throw new TerrainError(`Nivel regional ${id} desconocido`, "format");
  return l;
}
export const regionalBlock = (id: string): RegionalBlockEntry | undefined => BLOCKS.get(id);
export const regionalBlocks = (level: RegionalLevelId): RegionalBlockEntry[] => REGIONAL_MANIFEST.blocks.filter((b) => b.level === level);

/** Zona en la que el motor usa el DEM local de 5 m (tesela PGDA78 Site01) y NO el relieve regional. */
export const ENGINE_LOCAL_REGION_BOUNDS: Bounds = REGIONAL_MANIFEST.engine_convention.local_region_bounds_xy_m;
export const inEngineLocalRegion = (x: number, y: number) =>
  x >= ENGINE_LOCAL_REGION_BOUNDS[0] && x <= ENGINE_LOCAL_REGION_BOUNDS[2] && y >= ENGINE_LOCAL_REGION_BOUNDS[1] && y <= ENGINE_LOCAL_REGION_BOUNDS[3];

/* ------------------------------ geometría de bloques ------------------------------ */

/** Posición del primer vértice (noroeste) de un bloque. */
export function blockOrigin(b: RegionalBlockEntry): { x0: number; y0: number } {
  const l = regionalLevel(b.level);
  return { x0: l.x0_m + b.bx * l.block_cells * l.spacing_m, y0: l.y0_m - b.by * l.block_cells * l.spacing_m };
}

/** Extensión del bloque, de vértice a vértice (los bordes se comparten con los vecinos). */
export function blockBounds(b: RegionalBlockEntry): Bounds {
  const l = regionalLevel(b.level);
  const { x0, y0 } = blockOrigin(b);
  return [x0, y0 - (b.rows - 1) * l.spacing_m, x0 + (b.cols - 1) * l.spacing_m, y0];
}

/**
 * Bloque PUBLICADO de un nivel que contiene la celda de interpolación del punto, o `null`
 * si el punto cae fuera del nivel o ese bloque no se ha generado.
 */
export function blockAt(level: RegionalLevelId, x: number, y: number): RegionalBlockEntry | null {
  const l = regionalLevel(level);
  const c = (x - l.x0_m) / l.spacing_m;
  const r = (l.y0_m - y) / l.spacing_m;
  if (!(c >= 0 && r >= 0 && c <= l.cols - 1 && r <= l.rows - 1)) return null;
  const bx = Math.floor(Math.min(Math.floor(c), l.cols - 2) / l.block_cells);
  const by = Math.floor(Math.min(Math.floor(r), l.rows - 2) / l.block_cells);
  return BLOCKS.get(`${level}/${bx}_${by}`) ?? null;
}

/** Mejor nivel con bloque publicado en un punto (ver `REGIONAL_LEVEL_ORDER`), o `null` sin cobertura. */
export function coverageAt(x: number, y: number, levels: RegionalLevelId[] = REGIONAL_LEVEL_ORDER): { level: RegionalLevel; block: RegionalBlockEntry } | null {
  for (const id of levels) {
    const block = blockAt(id, x, y);
    if (block) return { level: regionalLevel(id), block };
  }
  return null;
}

/**
 * Bloque nativo que contiene el punto que fija el horizonte según el motor.
 * `source`: 0 = DEM local de 5 m (no es relieve regional → `null`), 1 = 80 m, 2 = 240 m.
 */
export function blockForObstacle(point: XY, source: number): RegionalBlockEntry | null {
  if (source === 1) return blockAt("L0", point.x, point.y);
  if (source === 2) return blockAt("N240", point.x, point.y);
  return null;
}

const distanceToBounds = (b: Bounds, p: XY) => Math.hypot(p.x - Math.max(b[0], Math.min(b[2], p.x)), p.y - Math.max(b[1], Math.min(b[3], p.y)));

/**
 * Bloques publicados de un nivel a menos de `radiusM` de alguno de los centros (distancia
 * en el plano X/Y del mapa; cerca del polo difiere de la distancia sobre la esfera en
 * menos de un 0,4 % a 200 km). Ordenados del más cercano al más lejano.
 */
export function blocksWithinRadius(centers: XY | XY[], radiusM: number, level: RegionalLevelId): RegionalBlockEntry[] {
  const cs = Array.isArray(centers) ? centers : [centers];
  return regionalBlocks(level)
    .map((b) => ({ b, d: Math.min(...cs.map((c) => distanceToBounds(blockBounds(b), c))) }))
    .filter((e) => e.d <= radiusM)
    .sort((a, b) => a.d - b.d)
    .map((e) => e.b);
}

export interface RaySegment {
  /** Bloque publicado que atraviesa el rayo en este tramo, o `null` si no hay cobertura en los niveles pedidos. */
  block: RegionalBlockEntry | null;
  /** Arco sobre la esfera (m) en el que empieza y acaba el tramo. */
  fromM: number;
  toM: number;
}

/**
 * Tramos del rayo curvo del motor (`rayPoint`: mismo azimut y arco sobre la esfera) desde
 * el sitio hasta `distanceM`, con el bloque publicado que pisa cada uno. Por defecto busca
 * relieve nativo de 80 m (`["L0"]`); los tramos con `block: null` son el límite de cobertura.
 */
export function raySegments(
  site: { lonEastDeg: number; latDeg: number },
  azimuthDeg: number,
  distanceM: number,
  opts: { levels?: RegionalLevelId[]; fromM?: number; stepM?: number } = {},
): RaySegment[] {
  const levels = opts.levels ?? ["L0"];
  const from = Math.min(opts.fromM ?? REGIONAL_MANIFEST.engine_convention.regional_min_distance_m, distanceM);
  const step = opts.stepM ?? regionalLevel(levels[0]).spacing_m / 2;
  const out: RaySegment[] = [];
  const n = Math.max(1, Math.ceil((distanceM - from) / step));
  for (let i = 0; i <= n; i++) {
    const d = i === n ? distanceM : from + i * step;
    const p = rayPoint(site, azimuthDeg, d);
    const block = coverageAt(p.x, p.y, levels)?.block ?? null;
    const last = out[out.length - 1];
    if (last && last.block === block) last.toM = d;
    else out.push({ block, fromM: last ? last.toM : d, toM: d });
  }
  return out;
}

/** Bloques publicados (sin repetir, en orden de aparición) que atraviesa el rayo del motor. */
export function blocksAlongRay(
  site: { lonEastDeg: number; latDeg: number },
  azimuthDeg: number,
  distanceM: number,
  opts: { levels?: RegionalLevelId[]; fromM?: number; stepM?: number } = {},
): RegionalBlockEntry[] {
  const seen = new Set<RegionalBlockEntry>();
  for (const s of raySegments(site, azimuthDeg, distanceM, opts)) if (s.block) seen.add(s.block);
  return [...seen];
}

/* ------------------------------------ carga ------------------------------------ */

/** Bloque decodificado: rejilla de vértices con alturas en metros (`NaN` = sin dato). */
export interface RegionalGrid {
  entry: RegionalBlockEntry;
  level: RegionalLevel;
  cols: number;
  rows: number;
  spacingM: number;
  /** Posición del vértice (0, 0): esquina noroeste. */
  x0: number;
  y0: number;
  heights: Float32Array;
}

/** Decodifica un bloque int16 (little-endian) del manifiesto. No comprueba el hash. */
export function decodeRegionalBlock(entry: RegionalBlockEntry, buf: ArrayBuffer): RegionalGrid {
  const n = entry.cols * entry.rows;
  if (buf.byteLength !== n * 2 || buf.byteLength !== entry.bytes) throw new TerrainError(`${entry.id}: tamaño incoherente con la rejilla`, "format");
  const enc = REGIONAL_MANIFEST.encoding;
  const dv = new DataView(buf);
  const heights = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const q = dv.getInt16(i * 2, true);
    heights[i] = q === enc.nodata ? NaN : (q + entry.offset_q) * enc.scale_m;
  }
  const level = regionalLevel(entry.level);
  return { entry, level, cols: entry.cols, rows: entry.rows, spacingM: level.spacing_m, ...blockOrigin(entry), heights };
}

async function sha256Hex(buf: ArrayBuffer): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

const cache = new Map<string, Promise<RegionalGrid>>();

/** Descarga (una vez), verifica con SHA-256 y decodifica un bloque publicado. */
export function loadRegionalBlock(block: RegionalBlockEntry | string, signal?: AbortSignal): Promise<RegionalGrid> {
  const entry = typeof block === "string" ? BLOCKS.get(block) : block;
  if (!entry) return Promise.reject(new TerrainError(`Bloque regional ${String(block)} no publicado`, "format"));
  let p = cache.get(entry.id);
  if (!p) {
    const file = `${entry.id}.i16`;
    p = (async () => {
      let res: Response;
      try {
        res = await fetch(regionalUrl(file), { cache: "no-cache", signal });
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        throw new TerrainError(`No se pudo descargar ${file}`, "network");
      }
      if (!res.ok) throw new TerrainError(`${file}: HTTP ${res.status}`, "network");
      const buf = await res.arrayBuffer();
      if (buf.byteLength !== entry.bytes) throw new TerrainError(`${file}: ${buf.byteLength} bytes, se esperaban ${entry.bytes}`, "integrity");
      const digest = await sha256Hex(buf);
      if (digest !== null && digest !== entry.sha256) throw new TerrainError(`${file}: SHA-256 no coincide con el manifiesto`, "integrity");
      return decodeRegionalBlock(entry, buf);
    })();
    p.catch(() => cache.delete(entry.id)); // un fallo (o una cancelación) no queda en caché
    cache.set(entry.id, p);
  }
  return p;
}

/** Carga varios bloques en paralelo; devuelve los que llegan y los errores de los que no. */
export async function loadRegionalBlocks(blocks: Array<RegionalBlockEntry | string>, signal?: AbortSignal): Promise<{ grids: RegionalGrid[]; errors: Array<{ id: string; error: unknown }> }> {
  const settled = await Promise.allSettled(blocks.map((b) => loadRegionalBlock(b, signal)));
  const grids: RegionalGrid[] = [];
  const errors: Array<{ id: string; error: unknown }> = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") grids.push(s.value);
    else errors.push({ id: typeof blocks[i] === "string" ? (blocks[i] as string) : (blocks[i] as RegionalBlockEntry).id, error: s.reason });
  });
  return { grids, errors };
}

/* ----------------------------------- muestreo ----------------------------------- */

/**
 * Altura bilineal entre los cuatro vértices que rodean el punto, como `sample` del motor
 * (los vértices son centros de píxel). `NaN` fuera del bloque o si algún vértice no tiene dato.
 */
export function sampleRegionalGrid(g: RegionalGrid, x: number, y: number): number {
  const c = (x - g.x0) / g.spacingM;
  const r = (g.y0 - y) / g.spacingM;
  if (!(c >= 0 && r >= 0 && c <= g.cols - 1 && r <= g.rows - 1)) return NaN;
  const c0 = Math.min(Math.floor(c), g.cols - 2);
  const r0 = Math.min(Math.floor(r), g.rows - 2);
  const fc = c - c0;
  const fr = r - r0;
  const i = r0 * g.cols + c0;
  return g.heights[i] * (1 - fc) * (1 - fr) + g.heights[i + 1] * fc * (1 - fr) + g.heights[i + g.cols] * (1 - fc) * fr + g.heights[i + g.cols + 1] * fc * fr;
}

/**
 * Altura en un punto con los bloques YA cargados, eligiendo el mejor nivel disponible
 * (`REGIONAL_LEVEL_ORDER`). `null` si ningún bloque cargado tiene dato ahí.
 */
export function sampleRegional(grids: Iterable<RegionalGrid>, x: number, y: number): { heightM: number; grid: RegionalGrid } | null {
  let best: { heightM: number; grid: RegionalGrid; rank: number } | null = null;
  for (const g of grids) {
    const rank = REGIONAL_LEVEL_ORDER.indexOf(g.level.id);
    if (best && rank >= best.rank) continue;
    const z = sampleRegionalGrid(g, x, y);
    if (Number.isFinite(z)) best = { heightM: z, grid: g, rank };
  }
  return best ? { heightM: best.heightM, grid: best.grid } : null;
}

/* ------------------------------------- malla ------------------------------------- */

export interface RegionalMesh {
  /** [este, arriba, −norte] por vértice (convención Y-arriba de la escena), en metros desde el suelo del sitio. */
  positions: Float32Array;
  /** Altura del original en cada vértice (m sobre la esfera); los vértices del faldón repiten la de su borde. */
  heights: Float32Array;
  /** Triángulos del relieve seguidos de los del faldón (ver `skirtIndexStart`). */
  indices: Uint32Array;
  /** Vértices de relieve por lado (tras submuestrear con `step`). */
  cols: number;
  rows: number;
  step: number;
  /** Separación entre vértices dibujados (m). */
  spacingM: number;
  nodataVertices: number;
  /** Celdas no dibujadas por caer dentro de una zona de `exclude`. */
  excludedCells: number;
  minHeight: number;
  maxHeight: number;
  /** Primer vértice del faldón (= nº de vértices de relieve) y primer índice de sus triángulos. */
  skirtVertexStart: number;
  skirtIndexStart: number;
}

export interface RegionalMeshOptions {
  /** Dibuja 1 de cada `step` vértices (1, 2, 4…). El último vértice de cada lado se conserva siempre para no abrir costuras. */
  step?: number;
  /**
   * Zonas que ya dibuja otra malla más fina (la ventana local de 5 m, bloques de un nivel
   * más detallado…). Con `"contained"` (por defecto) se omiten las celdas ENTERAMENTE
   * dentro de una zona; con `"intersecting"`, también las que la tocan (deja hueco en el borde).
   */
  exclude?: Bounds[];
  excludeMode?: "contained" | "intersecting";
  /**
   * Faldón (m): tira vertical que cuelga del borde del bloque para tapar las rendijas entre
   * niveles de detalle distintos. Es geometría auxiliar bajo la superficie, no relieve.
   */
  skirtM?: number;
}

/**
 * Malla de un bloque regional en el marco local de la escena. Cada vértice se coloca como
 * en `buildTerrainMesh`: el punto de la esfera de referencia elevado su altura, expresado
 * en este/norte/arriba del sitio (`toLocal`), de modo que la curvatura lunar está incluida
 * (un punto a 100 km queda ~2,9 km por debajo del plano horizontal del sitio). Las celdas
 * con algún vértice sin dato no generan triángulos.
 */
export function buildRegionalMesh(g: RegionalGrid, frame: LocalFrame, opts: RegionalMeshOptions = {}): RegionalMesh {
  const step = Math.max(1, Math.round(opts.step ?? 1));
  const axis = (n: number) => {
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i += step) idx.push(i);
    idx.push(n - 1);
    return idx;
  };
  const cIdx = axis(g.cols);
  const rIdx = axis(g.rows);
  const cols = cIdx.length;
  const rows = rIdx.length;
  const exclude = opts.exclude ?? [];
  const intersecting = opts.excludeMode === "intersecting";
  const eps = 1e-6;

  const surface = cols * rows;
  const skirt = opts.skirtM && opts.skirtM > 0 ? opts.skirtM : 0;
  const perimeter = skirt ? 2 * (cols + rows) : 0;
  const positions = new Float32Array((surface + perimeter) * 3);
  const heights = new Float32Array(surface + perimeter);
  let nodataVertices = 0;
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (let r = 0; r < rows; r++) {
    const y = g.y0 - rIdx[r] * g.spacingM;
    for (let c = 0; c < cols; c++) {
      const x = g.x0 + cIdx[c] * g.spacingM;
      const z = g.heights[rIdx[r] * g.cols + cIdx[c]];
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
  let excludedCells = 0;
  for (let r = 0; r + 1 < rows; r++) {
    const yTop = g.y0 - rIdx[r] * g.spacingM;
    const yBottom = g.y0 - rIdx[r + 1] * g.spacingM;
    for (let c = 0; c + 1 < cols; c++) {
      const xLeft = g.x0 + cIdx[c] * g.spacingM;
      const xRight = g.x0 + cIdx[c + 1] * g.spacingM;
      const out = exclude.some((b) =>
        intersecting ? xRight > b[0] + eps && xLeft < b[2] - eps && yTop > b[1] + eps && yBottom < b[3] - eps : xLeft >= b[0] - eps && xRight <= b[2] + eps && yBottom >= b[1] - eps && yTop <= b[3] + eps,
      );
      if (out) {
        excludedCells++;
        continue;
      }
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      if (Number.isFinite(heights[a]) && Number.isFinite(heights[b]) && Number.isFinite(heights[d]) && Number.isFinite(heights[e])) idx.push(a, d, b, b, d, e);
    }
  }
  const skirtIndexStart = idx.length;

  if (skirt) {
    // Recorrido del perímetro en el sentido norte → este → sur → oeste; cada vértice de borde
    // se duplica `skirt` metros más abajo y se une a su vecino con dos triángulos.
    const ring: number[] = [];
    for (let c = 0; c < cols; c++) ring.push(c);
    for (let r = 0; r < rows; r++) ring.push(r * cols + cols - 1);
    for (let c = cols - 1; c >= 0; c--) ring.push((rows - 1) * cols + c);
    for (let r = rows - 1; r >= 0; r--) ring.push(r * cols);
    ring.forEach((v, k) => {
      const s = surface + k;
      heights[s] = heights[v];
      positions[3 * s] = positions[3 * v];
      positions[3 * s + 1] = positions[3 * v + 1] - skirt;
      positions[3 * s + 2] = positions[3 * v + 2];
    });
    for (let k = 0; k + 1 < ring.length; k++) {
      const a = ring[k];
      const b = ring[k + 1];
      if (a === b || !Number.isFinite(heights[a]) || !Number.isFinite(heights[b])) continue;
      idx.push(a, b, surface + k, b, surface + k + 1, surface + k);
    }
  }

  return {
    positions,
    heights,
    indices: Uint32Array.from(idx),
    cols,
    rows,
    step,
    spacingM: step * g.spacingM,
    nodataVertices,
    excludedCells,
    minHeight,
    maxHeight,
    skirtVertexStart: surface,
    skirtIndexStart,
  };
}

/* ---------------------------------- cobertura ---------------------------------- */

/**
 * Contorno de la cobertura publicada de un nivel (por defecto el relieve nativo de 80 m),
 * como anillos cerrados en X/Y (el primer punto se repite al final): la unión de los
 * rectángulos de sus bloques, sin las líneas interiores. Para dibujarla en el mapa 2D.
 */
export function coverageOutline(level: RegionalLevelId = "L0"): XY[][] {
  const l = regionalLevel(level);
  const blocks = regionalBlocks(level);
  const has = new Set(blocks.map((b) => `${b.bx},${b.by}`));
  // Aristas de borde en coordenadas de retícula de bloques (bx crece al este, by al sur).
  const edges = new Map<string, Array<[number, number]>>();
  const add = (ax: number, ay: number, bx: number, by: number) => {
    const k = `${ax},${ay}`;
    const list = edges.get(k) ?? [];
    list.push([bx, by]);
    edges.set(k, list);
  };
  for (const b of blocks) {
    if (!has.has(`${b.bx},${b.by - 1}`)) add(b.bx, b.by, b.bx + 1, b.by); // norte
    if (!has.has(`${b.bx + 1},${b.by}`)) add(b.bx + 1, b.by, b.bx + 1, b.by + 1); // este
    if (!has.has(`${b.bx},${b.by + 1}`)) add(b.bx + 1, b.by + 1, b.bx, b.by + 1); // sur
    if (!has.has(`${b.bx - 1},${b.by}`)) add(b.bx, b.by + 1, b.bx, b.by); // oeste
  }
  const toXY = (cx: number, cy: number): XY => ({
    x: l.x0_m + Math.min(cx * l.block_cells, l.cols - 1) * l.spacing_m,
    y: l.y0_m - Math.min(cy * l.block_cells, l.rows - 1) * l.spacing_m,
  });
  const rings: XY[][] = [];
  for (const [startKey, list] of edges) {
    while (list.length) {
      const [sx, sy] = startKey.split(",").map(Number);
      const corners: Array<[number, number]> = [[sx, sy]];
      let [cx, cy] = list.pop()!;
      while (cx !== sx || cy !== sy) {
        corners.push([cx, cy]);
        const next = edges.get(`${cx},${cy}`);
        if (!next?.length) break;
        [cx, cy] = next.pop()!;
      }
      // Quita los vértices alineados y cierra el anillo.
      const ring = corners.filter((p, i) => {
        const a = corners[(i + corners.length - 1) % corners.length];
        const b = corners[(i + 1) % corners.length];
        return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0]);
      });
      if (ring.length >= 4) rings.push([...ring, ring[0]].map(([x, y]) => toXY(x, y)));
    }
  }
  return rings;
}

/** Rectángulos de los bloques publicados de un nivel (alternativa simple al contorno). */
export const coverageRects = (level: RegionalLevelId = "L0"): Bounds[] => regionalBlocks(level).map(blockBounds);
