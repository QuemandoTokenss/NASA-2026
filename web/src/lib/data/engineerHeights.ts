/**
 * Paquete ADICIONAL de Engineer: visibilidad del terreno NOMINAL a las 61 alturas del
 * deslizador (0–30 m, paso 0,5 m) para A/B y W1/W2, calculada con el motor original
 * (`scripts/engine/engineer_heights.py`). No forma parte del contrato site-regret/0.1
 * (120 escenarios, alturas 0/2/10), que sigue intacto y es la fuente de las demás vistas.
 *
 * Cada archivo se pide solo cuando hace falta (una altura y un escenario), se comprueba
 * con SHA-256 contra el manifiesto y se guarda en memoria durante la sesión.
 */
import type { SiteId, WindowId } from "../contract/constants";
import { BASE_PATH, DataError, type IntegrityStatus, type Loaded } from "./loader";
import { dataUrl } from "./manifest";

export const ENGINEER_HEIGHTS_DIR = "engineer-heights/v1";
export const HALF_STEP_COUNT = 61; // k = 0…60
export const MAX_TOWER_M = 30;
const N_AZ = 1440;
const N_T = 4321;

/** Índice estable de medio metro: k = 2·h (entero 0…60). */
export const heightToK = (h: number) => Math.round(h * 2);
export const kToHeight = (k: number) => k / 2;
export const kKey = (k: number) => `k${String(k).padStart(3, "0")}`;
export const isHalfStep = (h: number) => Number.isFinite(h) && Math.abs(h * 2 - Math.round(h * 2)) < 1e-9 && h >= 0 && h <= MAX_TOWER_M;

export interface EngineerHeightsManifest {
  schema: "site-regret-engineer-heights/1";
  package_version: string;
  generated_at_utc: string;
  scenario_count: number;
  heights: { positions: Array<{ k: number; key: string; height_m: number }> };
  method: { engine_sha256: string; generator: string; generator_sha256: string };
  files: Record<string, { sha256: string; bytes: number }>;
}

/** Perfil de horizonte con la misma forma que `HorizonProfile` del contrato. */
export interface HeightHorizon {
  azimuth_deg: number[];
  profile: { elevation_deg: number[]; distance_m: number[]; source: number[]; unknown: boolean[]; far_bound_deg: number; tail_below_sampled_horizon: boolean };
  observer_ground_height_m: number;
}

/** Series del escenario con la misma forma que el trozo de efemérides del contrato. */
export interface HeightScenario {
  series: {
    bodies: { SUN: { azimuth_deg: number[]; elevation_deg: number[] }; EARTH: { azimuth_deg: number[]; elevation_deg: number[] } };
    /** `null` = desconocido (igual que en el paquete v0.1). */
    sun_horizon_deg: Array<number | null>;
    earth_horizon_deg: Array<number | null>;
  };
  state_codes: number[];
}

export interface HeightIndexEntry {
  height_m: number;
  status: "READY_WITH_LIMITS" | "PARTIAL";
  metrics: {
    duration_hours: number;
    known_hours: number;
    unknown_hours: number;
    sun_hours: number;
    dte_center_hours: number;
    joint_hours: number;
    longest_dark_hours: number;
    longest_no_earth_hours: number;
  };
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-cache" });
  } catch (e) {
    throw new DataError(`No se pudo descargar ${url}`, "network", [String(e)]);
  }
  if (!res.ok) throw new DataError(`HTTP ${res.status} al descargar ${url}`, "network");
  return res.arrayBuffer();
}

async function sha256Hex(buf: ArrayBuffer): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const url = (path: string) => dataUrl(BASE_PATH, ENGINEER_HEIGHTS_DIR, path);

let manifestPromise: Promise<EngineerHeightsManifest> | null = null;
export function loadEngineerHeightsManifest(): Promise<EngineerHeightsManifest> {
  manifestPromise ??= (async () => {
    const m = JSON.parse(new TextDecoder().decode(await fetchBuffer(url("manifest.json")))) as EngineerHeightsManifest;
    if (m.schema !== "site-regret-engineer-heights/1" || m.heights?.positions?.length !== HALF_STEP_COUNT)
      throw new DataError("Manifiesto de alturas de Engineer con formato desconocido", "contract");
    return m;
  })().catch((e) => {
    manifestPromise = null;
    throw e;
  });
  return manifestPromise;
}

const cache = new Map<string, Promise<Loaded<unknown>>>();

function loadFile<T>(path: string, parse: (buf: ArrayBuffer) => T): Promise<Loaded<T>> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<Loaded<T>>;
  const p = (async () => {
    const m = await loadEngineerHeightsManifest();
    const entry = m.files[path];
    if (!entry) throw new DataError(`El manifiesto de alturas no declara ${path}`, "integrity");
    const buf = await fetchBuffer(url(path));
    if (buf.byteLength !== entry.bytes) throw new DataError(`Tamaño inesperado en ${path}`, "integrity", [`esperado ${entry.bytes}`, `obtenido ${buf.byteLength}`]);
    const digest = await sha256Hex(buf);
    if (digest !== null && digest !== entry.sha256) throw new DataError(`Integridad fallida en ${path}`, "integrity", [`esperado ${entry.sha256}`, `obtenido ${digest}`]);
    const integrity: IntegrityStatus = digest === null ? "unverifiable" : "verified";
    return { value: parse(buf), path: `${ENGINEER_HEIGHTS_DIR}/${path}`, integrity, sha256: entry.sha256, bytes: entry.bytes } satisfies Loaded<T>;
  })();
  cache.set(path, p);
  p.catch(() => cache.delete(path)); // un fallo no queda en caché: «Reintentar» vuelve a pedirlo
  return p;
}

const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
function f64(buf: ArrayBuffer, offset: number, n: number): Float64Array {
  if (LITTLE_ENDIAN) return new Float64Array(buf, offset, n);
  const dv = new DataView(buf);
  return Float64Array.from({ length: n }, (_, i) => dv.getFloat64(offset + 8 * i, true));
}
function f32(buf: ArrayBuffer, offset: number, n: number): Float32Array {
  if (LITTLE_ENDIAN) return new Float32Array(buf, offset, n);
  const dv = new DataView(buf);
  return Float32Array.from({ length: n }, (_, i) => dv.getFloat32(offset + 4 * i, true));
}

/** Horizonte nominal de un sitio a la altura k (binario) con su cota lejana y suelo del índice. */
export async function loadHeightHorizon(site: SiteId, k: number): Promise<Loaded<HeightHorizon>> {
  const [index, raw] = await Promise.all([
    loadHeightHorizonIndex(),
    loadFile(`horizons/${site}_${kKey(k)}.bin`, (buf) => {
      if (buf.byteLength !== N_AZ * (8 + 4 + 1 + 1)) throw new DataError("Horizonte binario con tamaño inesperado", "parse");
      return {
        elevation_deg: Array.from(f64(buf, 0, N_AZ)),
        distance_m: Array.from(f32(buf, 8 * N_AZ, N_AZ)),
        source: Array.from(new Uint8Array(buf, 12 * N_AZ, N_AZ)),
        unknown: Array.from(new Uint8Array(buf, 13 * N_AZ, N_AZ), (v) => v === 1),
      };
    }),
  ]);
  const meta = index.value[site]?.heights[kKey(k)];
  if (!meta) throw new DataError(`El índice de horizontes no declara ${site} · ${kKey(k)}`, "integrity");
  return {
    ...raw,
    value: {
      azimuth_deg: AZIMUTHS,
      profile: { ...raw.value, far_bound_deg: meta.far_bound_deg, tail_below_sampled_horizon: meta.tail_below_sampled_horizon },
      observer_ground_height_m: index.value[site].observer_ground_height_m,
    },
  };
}
const AZIMUTHS = Array.from({ length: N_AZ }, (_, i) => i * 0.25);

/** Índice de horizontes (cota lejana y bandera de cola por altura, suelo del observador). */
export function loadHeightHorizonIndex() {
  return loadFile<Record<SiteId, { observer_ground_height_m: number; heights: Record<string, { height_m: number; far_bound_deg: number; tail_below_sampled_horizon: boolean; unknown_azimuths: number }> }>>(
    "horizons/index.json",
    (buf) => JSON.parse(new TextDecoder().decode(buf)),
  );
}

/** Direcciones, horizonte en cada cuerpo y estados del motor (ventana · sitio · altura k). */
export function loadHeightScenario(window: WindowId, site: SiteId, k: number) {
  return loadFile<HeightScenario>(`scenarios/${window}_${site}_${kKey(k)}.bin`, (buf) => {
    if (buf.byteLength !== 6 * 8 * N_T + (N_T - 1)) throw new DataError("Escenario binario con tamaño inesperado", "parse");
    const a = (i: number) => Array.from(f64(buf, i * 8 * N_T, N_T));
    const nullable = (i: number) => Array.from(f64(buf, i * 8 * N_T, N_T), (v) => (Number.isFinite(v) ? v : null));
    return {
      series: { bodies: { SUN: { azimuth_deg: a(0), elevation_deg: a(1) }, EARTH: { azimuth_deg: a(2), elevation_deg: a(3) } }, sun_horizon_deg: nullable(4), earth_horizon_deg: nullable(5) },
      state_codes: Array.from(new Uint8Array(buf, 6 * 8 * N_T, N_T - 1)),
    };
  });
}

/** Métricas del motor de las 61 alturas de una ventana y un sitio (archivo pequeño). */
export function loadHeightIndex(window: WindowId, site: SiteId) {
  return loadFile<Record<string, HeightIndexEntry>>(`scenarios/${window}_${site}.json`, (buf) => JSON.parse(new TextDecoder().decode(buf)));
}
