/**
 * Acceso a los derivados de terreno (`data/derived/terrain/`, publicados en
 * `public/data/site-regret/terrain/`). El manifiesto y el registro de activos
 * viajan dentro de la aplicación; cada raster se descarga bajo demanda y se
 * comprueba con el SHA-256 del manifiesto antes de usarse.
 */
import manifestJson from "../../../data/derived/terrain/manifest.json";
import registryJson from "../../../data/geospatial/registry.json";
import { BASE_PATH } from "../data/loader";
import { DATA_ROOT } from "../data/manifest";
import type { RasterGrid } from "./raster";

export type TerrainLayerId = "elevation" | "slope" | "lola_count" | "vertical_rms" | "slope_rms";

export interface TerrainLayerEntry {
  id: TerrainLayerId;
  registry_id: string;
  file: string;
  dtype: string;
  units: string;
  nodata: string;
  bytes: number;
  sha256: string;
  stats: { min: number; max: number; finite_count: number; nodata_count: number };
  source: { file: string; url: string; bytes: number; sha256: string };
  processing: string;
}

export interface TerrainManifest {
  schema: string;
  generator: string;
  generator_version: number;
  region: string;
  georeferencing: {
    window_bounds_xy_m: [number, number, number, number];
    width: number;
    height: number;
    pixel_size_m: number;
    source_col_offset: number;
    source_row_offset: number;
    pixel_model: string;
    crs: string;
    frame: string;
    sphere_radius_m: number;
  };
  layers: TerrainLayerEntry[];
  rois: { file: string; bytes: number; sha256: string; count: number; registry_id: string; source: { file: string; url: string; bytes: number; sha256: string }; processing: string };
  limits: string[];
}

export const TERRAIN_MANIFEST = manifestJson as unknown as TerrainManifest;
export const TERRAIN_BOUNDS = TERRAIN_MANIFEST.georeferencing.window_bounds_xy_m;

type Bi = { es: string; en: string };
export interface RegistryAsset {
  id: string;
  class: "instrument_observation" | "published_science_product" | "site_regret_derived" | "hypothetical_scenario" | "illustration" | "unknown_origin";
  kind: "numeric_raster" | "vector" | "wmts_tiles";
  layer: string;
  title: Bi;
  provider: string;
  mission: string;
  instrument: string;
  product: string;
  original_id: string;
  product_page: string;
  url?: string;
  capabilities_url?: string;
  bytes?: number;
  sha256?: string;
  crs: string;
  vertical_reference: string | null;
  units: string;
  nodata: string | null;
  max_zoom?: number;
  finest_tile_resolution_m?: number;
  resolution_note?: Bi;
  dates: { acquisition: string | null; acquisition_note: Bi; server_last_modified?: string | null; first_downloaded_utc?: string | null };
  credit: string;
  terms: Bi;
  note?: Bi;
  verification: { status: string; method: string; checked_utc?: string; example_tile?: string };
}

export const GEO_REGISTRY = registryJson as unknown as { schema: string; updated_utc: string; assets: RegistryAsset[] };
export const registryAsset = (id: string) => GEO_REGISTRY.assets.find((a) => a.id === id);

export const terrainUrl = (file: string) => `${BASE_PATH}/${DATA_ROOT}/terrain/${file}`;

export class TerrainError extends Error {
  kind: "network" | "integrity" | "format";
  constructor(message: string, kind: "network" | "integrity" | "format") {
    super(message);
    this.kind = kind;
  }
}

async function sha256Hex(buf: ArrayBuffer): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchVerified(file: string, bytes: number, sha256: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetch(terrainUrl(file), { cache: "no-cache", signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new TerrainError(`No se pudo descargar ${file}`, "network");
  }
  if (!res.ok) throw new TerrainError(`${file}: HTTP ${res.status}`, "network");
  const buf = await res.arrayBuffer();
  if (buf.byteLength !== bytes) throw new TerrainError(`${file}: ${buf.byteLength} bytes, se esperaban ${bytes}`, "integrity");
  const digest = await sha256Hex(buf);
  if (digest !== null && digest !== sha256) throw new TerrainError(`${file}: SHA-256 no coincide con el manifiesto`, "integrity");
  return buf;
}

const cache = new Map<string, Promise<RasterGrid>>();

/** Raster numérico de una capa (cacheado). */
export function loadTerrainLayer(id: TerrainLayerId): Promise<RasterGrid> {
  let p = cache.get(id);
  if (!p) {
    const entry = TERRAIN_MANIFEST.layers.find((l) => l.id === id);
    if (!entry) return Promise.reject(new TerrainError(`Capa ${id} no preparada`, "format"));
    const g = TERRAIN_MANIFEST.georeferencing;
    p = fetchVerified(entry.file, entry.bytes, entry.sha256).then((buf) => {
      if (buf.byteLength !== g.width * g.height * 4) throw new TerrainError(`${entry.file}: tamaño incoherente con la rejilla`, "format");
      return { width: g.width, height: g.height, pixelSizeM: g.pixel_size_m, xmin: g.window_bounds_xy_m[0], ymax: g.window_bounds_xy_m[3], data: new Float32Array(buf) };
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

export interface RoiPolygon {
  roi: number;
  attributes: Record<string, string>;
  rings: number[][][];
}

let roisPromise: Promise<RoiPolygon[]> | null = null;
export function loadRois(): Promise<RoiPolygon[]> {
  roisPromise ??= fetchVerified(TERRAIN_MANIFEST.rois.file, TERRAIN_MANIFEST.rois.bytes, TERRAIN_MANIFEST.rois.sha256).then(
    (buf) => (JSON.parse(new TextDecoder().decode(buf)) as { rois: RoiPolygon[] }).rois,
  );
  roisPromise.catch(() => (roisPromise = null));
  return roisPromise;
}
