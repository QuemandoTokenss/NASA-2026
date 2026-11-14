/**
 * Carga de datos en el navegador:
 *   manifest.json → núcleo (siempre) → trozos pesados bajo demanda.
 * Cada archivo se comprueba con SHA-256 contra el manifiesto ANTES de
 * interpretarlo y después se valida contra el contrato. Los resultados se
 * guardan en memoria (una descarga por trozo y sesión).
 */
import { CLOCK_SAMPLES, heightKey, type HeightM, type SiteId, type WindowId } from "../contract/constants";
import type {
  Core,
  EphemerisClockChunk,
  EphemerisSiteChunk,
  HorizonChunk,
  ScenarioChunk,
} from "../contract/schema";
import {
  validateCore,
  validateEphemerisClock,
  validateEphemerisSite,
  validateHorizonChunk,
  validateScenarioChunk,
  type ValidationReport,
} from "../contract/validate";
import { DATA_VERSION_DIR, dataUrl, type DataManifest } from "./manifest";
import { chunkPath } from "./split";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type IntegrityStatus = "verified" | "unverifiable";

export class DataError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "integrity" | "parse" | "contract",
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "DataError";
  }
}

export interface Loaded<T> {
  value: T;
  path: string;
  integrity: IntegrityStatus;
  sha256: string;
  bytes: number;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string | null> {
  // crypto.subtle solo existe en contextos seguros (https o localhost).
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  let res: Response;
  try {
    // "no-cache": revalidar siempre con el servidor (304 si no cambió), para que
    // manifiesto y trozos nunca procedan de versiones distintas del paquete.
    res = await fetch(url, { cache: "no-cache" });
  } catch (e) {
    throw new DataError(`No se pudo descargar ${url}`, "network", [String(e)]);
  }
  if (!res.ok) throw new DataError(`HTTP ${res.status} al descargar ${url}`, "network");
  return res.arrayBuffer();
}

function parseJson<T>(buf: ArrayBuffer, path: string): T {
  try {
    return JSON.parse(new TextDecoder("utf-8").decode(buf)) as T;
  } catch (e) {
    throw new DataError(`JSON inválido en ${path}`, "parse", [String(e)]);
  }
}

function assertValid(report: ValidationReport, what: string) {
  if (!report.ok) throw new DataError(`${what} no cumple el contrato site-regret/0.1`, "contract", report.errors);
}

// ---------------------------------------------------------------------------

let manifestPromise: Promise<DataManifest> | null = null;

export function loadManifest(): Promise<DataManifest> {
  manifestPromise ??= (async () => {
    const buf = await fetchBuffer(dataUrl(BASE_PATH, "manifest.json"));
    const m = parseJson<DataManifest>(buf, "manifest.json");
    if (m.manifest_version !== 1 || !m.chunks?.["core.json"])
      throw new DataError("manifest.json con formato desconocido", "contract");
    return m;
  })().catch((e) => {
    manifestPromise = null; // permitir reintento
    throw e;
  });
  return manifestPromise;
}

const chunkCache = new Map<string, Promise<Loaded<unknown>>>();

async function loadChunk<T>(path: string, validate: (value: T) => ValidationReport, label: string): Promise<Loaded<T>> {
  const cached = chunkCache.get(path);
  if (cached) return cached as Promise<Loaded<T>>;
  const p = (async () => {
    const manifest = await loadManifest();
    const entry = manifest.chunks[path];
    if (!entry) throw new DataError(`El manifiesto no declara ${path}`, "integrity");
    const buf = await fetchBuffer(dataUrl(BASE_PATH, DATA_VERSION_DIR, path));
    const digest = await sha256Hex(buf);
    if (digest !== null && digest !== entry.sha256)
      throw new DataError(`Integridad fallida en ${path}`, "integrity", [`esperado ${entry.sha256}`, `obtenido ${digest}`]);
    const value = parseJson<T>(buf, path);
    assertValid(validate(value), label);
    return {
      value,
      path,
      integrity: digest === null ? "unverifiable" : "verified",
      sha256: entry.sha256,
      bytes: entry.bytes,
    } satisfies Loaded<T>;
  })();
  chunkCache.set(path, p);
  p.catch(() => chunkCache.delete(path));
  return p;
}

let coreReport: ValidationReport | null = null;

export async function loadCore(): Promise<Loaded<Core> & { report: ValidationReport }> {
  const loaded = await loadChunk<Core>(
    chunkPath.core(),
    (raw) => {
      coreReport = validateCore(raw);
      return coreReport;
    },
    "El núcleo de datos",
  );
  return { ...loaded, report: coreReport ?? validateCore(loaded.value) };
}

function windowOf(core: Core, windowId: WindowId) {
  const w = core.configuration.windows.find((x) => x.id === windowId);
  if (!w) throw new DataError(`Ventana ${windowId} inexistente`, "contract");
  return w;
}

export function loadScenarioChunk(core: Core, windowId: WindowId, heightM: HeightM) {
  const w = windowOf(core, windowId);
  return loadChunk<ScenarioChunk>(
    chunkPath.scenarios(windowId, heightKey(heightM)),
    (c) => validateScenarioChunk(c, windowId, heightM, w, core.configuration.time_step_minutes),
    `Escenarios ${windowId} · ${heightM} m`,
  );
}

export function loadHorizonChunk(siteId: SiteId, heightM: HeightM) {
  return loadChunk<HorizonChunk>(
    chunkPath.horizons(siteId, heightKey(heightM)),
    (c) => validateHorizonChunk(c, siteId, heightM),
    `Horizonte ${siteId} · ${heightM} m`,
  );
}

export function loadEphemerisClock(core: Core, windowId: WindowId) {
  const w = windowOf(core, windowId);
  return loadChunk<EphemerisClockChunk>(
    chunkPath.ephemerisClock(windowId),
    (c) => validateEphemerisClock(c, w),
    `Reloj ${windowId}`,
  );
}

export function loadEphemerisSite(windowId: WindowId, siteId: SiteId, heightM: HeightM) {
  return loadChunk<EphemerisSiteChunk>(
    chunkPath.ephemerisSite(windowId, siteId, heightKey(heightM)),
    validateEphemerisSite,
    `Efemérides nominales ${windowId} · ${siteId} · ${heightM} m (${CLOCK_SAMPLES} muestras)`,
  );
}

/** Rutas ya cargadas en esta sesión (para el panel de integridad). */
export async function loadedChunkStatuses(): Promise<Array<{ path: string; integrity: IntegrityStatus }>> {
  const out: Array<{ path: string; integrity: IntegrityStatus }> = [];
  for (const [path, p] of chunkCache) {
    try {
      const l = await p;
      out.push({ path, integrity: l.integrity });
    } catch {
      /* los fallidos no se listan */
    }
  }
  return out;
}
