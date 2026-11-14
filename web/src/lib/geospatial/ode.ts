/**
 * Adaptador del REST documentado del Lunar Orbital Data Explorer (PDS
 * Geosciences Node): https://oderest.rsl.wustl.edu/ (manual ODE REST v2.1).
 * Solo consultas `query=product` acotadas a una región; sin scraping.
 *
 * Hechos comprobados contra el servicio real (14-11-2026, ODE V2.1.5):
 * - Responde JSON con CORS abierto; un error llega con HTTP 200 y `Status: "ERROR"`.
 * - `offset` empieza en 1 (offset=0 se trata como 1): la página siguiente es offset + limit.
 * - `results=c` devuelve el total; con productos, `Count` es el nº devuelto.
 * - La búsqueda espacial es por caja lon/lat: cerca del polo devuelve productos
 *   cuya huella real NO contiene el punto. `Footprint_SP_geometry` trae la
 *   huella real en estereográfica polar sur (metros, misma convención que el
 *   proyecto), y con ella se decide la intersección.
 */
import type { XY } from "./lunar";

export const ODE_ENDPOINT = "https://oderest.rsl.wustl.edu/live2/";

/** Combinaciones instrumento/tipo comprobadas con `query=iipt` el 14-11-2026 (nº de productos lunares en ODE). */
export const ODE_PRODUCT_TYPES = [
  { ihid: "LRO", iid: "LROC", pt: "CDRNAC4", name: "LROC NAC · Calibrated Data Record (PDS4)", products: 2928547, mapProjected: false },
  { ihid: "LRO", iid: "LROC", pt: "SDNDTM", name: "LROC NAC · Digital Terrain Map (PDS4)", products: 668, mapProjected: true },
  { ihid: "LRO", iid: "LOLA", pt: "GDRDEM", name: "LOLA · Gridded Data Record Shape Map (PDS4)", products: 270, mapProjected: true },
] as const;
export type OdeProductType = (typeof ODE_PRODUCT_TYPES)[number]["pt"];

export interface OdeRegion {
  westernLon: number;
  easternLon: number;
  minLat: number;
  maxLat: number;
}

export interface OdeProduct {
  pdsId: string;
  odeId: string;
  productType: string;
  title: string;
  dataSetId: string;
  /** Instante de observación (UTC) o `null` si el producto no lo publica. */
  observationTime: string | null;
  creationTime: string | null;
  mapResolutionM: number | null;
  incidenceDeg: number | null;
  emissionDeg: number | null;
  phaseDeg: number | null;
  labelUrl: string | null;
  productUrl: string | null;
  externalUrl: string | null;
  filesUrl: string | null;
  /** Huella real en estereográfica polar sur (m). Vacía si el producto no la trae. */
  footprint: XY[][];
}

export interface OdeResult {
  /** Nº devuelto en esta respuesta (o total si se pidió `results=c`). */
  count: number;
  offset: number | null;
  limit: number | null;
  products: OdeProduct[];
  serviceVersionNote: string | null;
}

export class OdeError extends Error {
  kind: "network" | "service" | "format";
  constructor(message: string, kind: "network" | "service" | "format") {
    super(message);
    this.kind = kind;
  }
}

export function odeQueryUrl(type: (typeof ODE_PRODUCT_TYPES)[number], region: OdeRegion, opts: { countOnly?: boolean; limit?: number; offset?: number } = {}): string {
  const p = new URLSearchParams({
    query: "product",
    target: "moon",
    ihid: type.ihid,
    iid: type.iid,
    pt: type.pt,
    output: "JSON",
    westernlon: String(region.westernLon),
    easternlon: String(region.easternLon),
    minlat: String(region.minLat),
    maxlat: String(region.maxLat),
    loc: "f",
    results: opts.countOnly ? "c" : "copm",
  });
  if (!opts.countOnly) {
    p.set("limit", String(opts.limit ?? 5));
    p.set("offset", String(Math.max(1, opts.offset ?? 1)));
  }
  return `${ODE_ENDPOINT}?${p}`;
}

/** Offset (base 1) de la página siguiente, o `null` si no quedan productos. */
export function nextOffset(offset: number, limit: number, total: number): number | null {
  const next = Math.max(1, offset) + limit;
  return next <= total ? next : null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/** Anillos exteriores de un WKT `POLYGON`/`MULTIPOLYGON` (pares «x y»). */
export function parseWktPolygons(wkt: unknown): XY[][] {
  if (typeof wkt !== "string" || !/^\s*(MULTI)?POLYGON/i.test(wkt)) return [];
  const rings: XY[][] = [];
  for (const m of wkt.matchAll(/\(([^()]+)\)/g)) {
    const ring = m[1].split(",").map((pair) => {
      const [x, y] = pair.trim().split(/\s+/).map(Number);
      return { x, y };
    });
    if (ring.length >= 4 && ring.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) rings.push(ring);
  }
  return rings;
}

export function parseOdeResponse(json: unknown): OdeResult {
  const r = (json as { ODEResults?: Record<string, unknown> })?.ODEResults;
  if (!r || typeof r !== "object") throw new OdeError("La respuesta no tiene el formato de ODE REST", "format");
  if (r.Status !== "Success") throw new OdeError(str(r.Error) ?? `ODE devolvió el estado ${String(r.Status)}`, "service");
  const summary = (r.QuerySummary ?? {}) as Record<string, unknown>;
  const raw = (r.Products as { Product?: unknown } | undefined)?.Product;
  const list = raw === undefined || raw === null ? [] : Array.isArray(raw) ? raw : [raw];
  const products = (list as Array<Record<string, unknown>>).map((p) => ({
    pdsId: String(p.pdsid ?? ""),
    odeId: String(p.ode_id ?? ""),
    productType: String(p.pt ?? ""),
    title: str(p.Product_title) ?? str(p.Description) ?? String(p.pdsid ?? ""),
    dataSetId: String(p.Data_Set_Id ?? ""),
    observationTime: str(p.Observation_time) ?? str(p.UTC_start_time),
    creationTime: str(p.Product_creation_time),
    mapResolutionM: num(p.Map_resolution),
    incidenceDeg: num(p.Incidence_angle),
    emissionDeg: num(p.Emission_angle),
    phaseDeg: num(p.Phase_angle),
    labelUrl: str(p.LabelURL),
    productUrl: str(p.ProductURL),
    externalUrl: str(p.External_url),
    filesUrl: str(p.FilesURL),
    footprint: parseWktPolygons(p.Footprint_SP_geometry),
  }));
  if (products.some((p) => !p.pdsId)) throw new OdeError("Producto sin identificador en la respuesta de ODE", "format");
  const count = num(r.Count);
  if (count === null) throw new OdeError("La respuesta de ODE no indica el recuento", "format");
  return { count, offset: num(summary.offset), limit: num(summary.limit), products, serviceVersionNote: str(summary.Date) };
}

/** ¿La huella REAL (no su caja lon/lat) contiene el punto? */
export function footprintContains(footprint: XY[][], p: XY): boolean {
  return footprint.some((ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  });
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new OdeError("No se pudo contactar con ODE", "network");
  }
  if (!res.ok) throw new OdeError(`ODE respondió HTTP ${res.status}`, "network");
  try {
    return await res.json();
  } catch {
    throw new OdeError("La respuesta de ODE no es JSON", "format");
  }
}

/** Total de productos cuya caja lon/lat toca la región. */
export async function fetchOdeCount(type: (typeof ODE_PRODUCT_TYPES)[number], region: OdeRegion, signal?: AbortSignal): Promise<number> {
  return parseOdeResponse(await getJson(odeQueryUrl(type, region, { countOnly: true }), signal)).count;
}

export async function fetchOdePage(type: (typeof ODE_PRODUCT_TYPES)[number], region: OdeRegion, offset: number, limit: number, signal?: AbortSignal): Promise<OdeResult> {
  return parseOdeResponse(await getJson(odeQueryUrl(type, region, { offset, limit }), signal));
}
