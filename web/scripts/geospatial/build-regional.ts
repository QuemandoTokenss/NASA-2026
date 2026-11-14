/**
 * Genera la PIRÁMIDE REGIONAL de terreno para el visor 3D de Engineer a partir de los
 * originales verificados de PGDA 90 (LOLA, polo sur): 80 m/px y 240 m/px, los mismos que
 * usa el motor (`pipeline.py`: `regional`, `distant`) para el horizonte hasta 400 km.
 *
 *   node scripts/geospatial/build-regional.ts [--ring-km=25] [--mid-km=210]
 *        [--sector=A:120-140:150] [--blocks=L0:14_15,N240:3_4]
 *
 * - Comprueba cada original entero (tamaño, firma TIFF y SHA-256) contra el pasaporte del
 *   paquete (`data/source/DERIVADOS_SITE_REGRET/datos/pasaporte.json`) y su
 *   georreferenciación contra lo esperado (misma estereográfica polar del proyecto).
 * - NO remuestrea: cada vértice de cada nivel es una muestra real del original (el centro
 *   de un píxel). Los niveles gruesos son SUBMUESTREOS ANIDADOS (1 de cada 4 o de cada 16
 *   muestras), de modo que los vértices compartidos entre niveles y entre bloques vecinos
 *   son exactamente la misma muestra: no hay costuras de dato.
 * - Cuantiza a int16 con paso fijo de 0,25 m (error ≤ 0,125 m, comprobado aquí) y conserva
 *   el nodata como centinela (−32768), nunca como 0.
 * - Bloques nativos de 80 m solo donde hacen falta: los que contienen los puntos que fijan
 *   el horizonte según el motor (paquete site-regret/0.1, 10 superficies × 0/2/10 m, y
 *   paquete de alturas de Engineer, 61 alturas nominales) más un anillo continuo alrededor
 *   de los sitios. `--sector` y `--blocks` amplían la cobertura.
 * - Contrasta el resultado con el motor: la elevación angular del relieve regional en cada
 *   punto del motor debe reproducir el horizonte del paquete.
 *
 * El resultado es determinista: mismos originales y argumentos → mismos bytes y hashes.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fromFile } from "geotiff";
import { sha256File, signatureOk } from "./fetch-originals.ts";
import { rayPoint, terrainElevationDeg } from "../../src/lib/geospatial/lunar.ts";
import { sampleBilinear, type RasterGrid } from "../../src/lib/geospatial/raster.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const OUT = join(ROOT, "data", "derived", "terrain-regional", "v1");
const RAW = join(ROOT, "data", "raw", "motor");
const SOURCE = join(ROOT, "data", "source", "DERIVADOS_SITE_REGRET");
const HEIGHTS = join(ROOT, "data", "derived", "engineer-heights", "v1");
export const GENERATOR_VERSION = 1;

const SPHERE_RADIUS_M = 1737400;
/** Celdas por lado de bloque (129 × 129 vértices; la última fila/columna se comparte con el vecino). */
const BLOCK_CELLS = 128;
/** Paso de cuantización (m) y centinela de nodata. */
const SCALE_M = 0.25;
const NODATA_Q = -32768;
const N_AZ = 1440;

const sha256 = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
function fail(msg: string): never {
  console.error(`✘ ${msg}`);
  process.exit(1);
}

/* ------------------------------- argumentos -------------------------------- */

const argv = process.argv.slice(2);
const argValue = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ringKm = Number(argValue("ring-km") ?? 25);
const midKm = Number(argValue("mid-km") ?? 210);
const farKm = 400;
const extraSectors = argv.filter((a) => a.startsWith("--sector=")).map((a) => {
  const m = /^--sector=([AB]):([\d.]+)-([\d.]+):([\d.]+)$/.exec(a);
  if (!m) fail(`argumento no válido: ${a} (formato --sector=A:120-140:150 → sitio:azimut inicial-final en grados:distancia en km)`);
  return { site: m[1], az0: Number(m[2]), az1: Number(m[3]), km: Number(m[4]) };
});
const extraBlocks = (argValue("blocks") ?? "")
  .split(",")
  .filter(Boolean)
  .map((s) => {
    const m = /^(\w+):(\d+)_(\d+)$/.exec(s);
    if (!m) fail(`bloque no válido: ${s} (formato --blocks=L0:14_15,N240:3_4)`);
    return { level: m[1], bx: Number(m[2]), by: Number(m[3]) };
  });
if (!(ringKm >= 0) || !(midKm > 0)) fail("--ring-km y --mid-km deben ser números positivos");

/* -------------------------------- productos -------------------------------- */

interface Product {
  id: "pgda90_80m" | "pgda90_240m";
  passportId: string;
  title: string;
  px: number;
  size: number;
  xmin: number;
  ymax: number;
}
const PRODUCTS: Product[] = [
  { id: "pgda90_80m", passportId: "DEM_REGIONAL_80M", title: "PGDA 90 · LOLA polo sur, 80 m/px (LDEM_80S_80MPP_ADJ)", px: 80, size: 7600, xmin: -304000, ymax: 304000 },
  { id: "pgda90_240m", passportId: "DEM_LEJANO_240M", title: "PGDA 90 · LOLA polo sur, 240 m/px (LDEM_60S_240MPP_ADJ)", px: 240, size: 7760, xmin: -931200, ymax: 931200 },
];

interface PassportAsset {
  id: string;
  url: string;
  path: string;
  bytes: number;
  sha256: string;
  last_modified?: string;
}
function passportAsset(id: string): PassportAsset {
  const passport = JSON.parse(readFileSync(join(SOURCE, "datos", "pasaporte.json"), "utf8")) as { source_assets: PassportAsset[] };
  const a = passport.source_assets.find((x) => x.id === id);
  if (!a?.sha256 || !a.bytes || !a.path) fail(`el pasaporte del paquete no declara ${id}`);
  return a;
}

async function readProduct(p: Product): Promise<{ grid: RasterGrid; asset: PassportAsset; stats: { min: number; max: number; nodata_count: number } }> {
  const asset = passportAsset(p.passportId);
  const path = join(RAW, ...asset.path.split("/"));
  const hint = `Descárgalo con \`python -I scripts/engine/fetch_originals.py ${p.passportId}\` (${asset.url}, ${asset.bytes} bytes).`;
  if (!existsSync(path)) fail(`falta el original ${asset.path} en data/raw/motor/. ${hint}`);
  const size = statSync(path).size;
  if (size !== asset.bytes) fail(`${asset.path}: ${size} bytes, el pasaporte declara ${asset.bytes} (¿truncado?). ${hint}`);
  if (!signatureOk(path, "tiff")) fail(`${asset.path}: no tiene firma TIFF. ${hint}`);
  const digest = await sha256File(path);
  if (digest !== asset.sha256) fail(`${asset.path}: SHA-256 ${digest} ≠ pasaporte ${asset.sha256}. ${hint}`);

  const tiff = await fromFile(path);
  const image = await tiff.getImage();
  const origin = image.getOrigin();
  const res = image.getResolution();
  const keys = image.getGeoKeys() as Record<string, number | string>;
  const nodata = image.getGDALNoData();
  if (image.getWidth() !== p.size || image.getHeight() !== p.size) fail(`${p.id}: dimensiones ${image.getWidth()}×${image.getHeight()}`);
  if (res[0] !== p.px || res[1] !== -p.px) fail(`${p.id}: tamaño de píxel ${res}`);
  if (!image.pixelIsArea() || origin[0] !== p.xmin || origin[1] !== p.ymax) fail(`${p.id}: origen ${origin}`);
  if (keys.ProjCoordTransGeoKey !== 15 || keys.ProjNatOriginLatGeoKey !== -90 || keys.ProjStraightVertPoleLongGeoKey !== 0) fail(`${p.id}: proyección ${JSON.stringify(keys)}`);
  if (keys.ProjScaleAtNatOriginGeoKey !== 1 || keys.ProjLinearUnitsGeoKey !== 9001) fail(`${p.id}: escala/unidades ${JSON.stringify(keys)}`);
  if (keys.GeogSemiMajorAxisGeoKey !== SPHERE_RADIUS_M || keys.GeogSemiMinorAxisGeoKey !== SPHERE_RADIUS_M) fail(`${p.id}: esfera ${JSON.stringify(keys)}`);
  if (image.getSamplesPerPixel() !== 1 || image.getBitsPerSample() !== 32 || image.getSampleFormat() !== 3) fail(`${p.id}: se esperaba 1 banda float32`);
  if (nodata !== null && !Number.isNaN(nodata)) fail(`${p.id}: nodata ${nodata} (se esperaba NaN)`);

  const data = (await image.readRasters({ samples: [0] }))[0] as Float32Array;
  if (!(data instanceof Float32Array) || data.length !== p.size * p.size) fail(`${p.id}: lectura inesperada`);
  let min = Infinity;
  let max = -Infinity;
  let nan = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v === v) {
      if (v < min) min = v;
      if (v > max) max = v;
    } else nan++;
  }
  console.log(`✔ ${p.id}: ${asset.path} verificado (sha256 ${digest.slice(0, 12)}…), ${p.size}×${p.size} px de ${p.px} m, ${min} … ${max} m, nodata ${nan}`);
  return { grid: { width: p.size, height: p.size, pixelSizeM: p.px, xmin: p.xmin, ymax: p.ymax, data }, asset, stats: { min, max, nodata_count: nan } };
}

/* --------------------------------- niveles --------------------------------- */

interface LevelDef {
  id: string;
  product: Product["id"];
  /** 1 de cada `stride` muestras del original, empezando en el índice `offset`. */
  stride: number;
  offset: number;
  role: "native" | "overview" | "far";
  preload: boolean;
  description: string;
}
const LEVELS: LevelDef[] = [
  { id: "L0", product: "pgda90_80m", stride: 1, offset: 0, role: "native", preload: false, description: "Resolución nativa de 80 m (todas las muestras). Bajo demanda, solo en los sectores listados." },
  { id: "L1", product: "pgda90_80m", stride: 4, offset: 0, role: "overview", preload: false, description: "1 de cada 4 muestras del original de 80 m (vértices cada 320 m). Bajo demanda, hasta el radio medio alrededor de los sitios." },
  { id: "L2", product: "pgda90_80m", stride: 16, offset: 0, role: "overview", preload: true, description: "1 de cada 16 muestras del original de 80 m (vértices cada 1280 m). Cubre todo el producto de 80 m (±304 km): visión general." },
  { id: "N240", product: "pgda90_240m", stride: 1, offset: 0, role: "native", preload: false, description: "Resolución nativa de 240 m. El motor solo usa este producto donde el de 80 m no tiene dato; sin bloques salvo que se pidan con --blocks." },
  { id: "F", product: "pgda90_240m", stride: 16, offset: 5, role: "far", preload: false, description: "1 de cada 16 muestras del original de 240 m (vértices cada 3840 m, coincidentes con vértices de L2). Cubre hasta 400 km de los sitios, más allá del producto de 80 m." },
];

interface Level extends LevelDef {
  grid: RasterGrid;
  spacing: number;
  x0: number;
  y0: number;
  cols: number;
  rows: number;
}

interface BlockOut {
  id: string;
  level: string;
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
  why: string[];
  horizon_points: number;
}

/* --------------------------------- principal -------------------------------- */

async function main() {
  const loaded = new Map<Product["id"], Awaited<ReturnType<typeof readProduct>>>();
  for (const p of PRODUCTS) loaded.set(p.id, await readProduct(p));

  const levels: Level[] = LEVELS.map((d) => {
    const { grid } = loaded.get(d.product)!;
    const n = Math.floor((grid.width - 1 - d.offset) / d.stride) + 1;
    return { ...d, grid, spacing: grid.pixelSizeM * d.stride, x0: grid.xmin + (d.offset + 0.5) * grid.pixelSizeM, y0: grid.ymax - (d.offset + 0.5) * grid.pixelSizeM, cols: n, rows: n };
  });
  const level = (id: string) => levels.find((l) => l.id === id) ?? fail(`nivel desconocido: ${id}`);
  const L0 = level("L0");
  const L2 = level("L2");
  const F = level("F");
  // Los vértices de F (240 m) caen sobre vértices de L2 (80 m): misma posición, producto distinto.
  if (!Number.isInteger((F.x0 - L2.x0) / L2.spacing) || !Number.isInteger((L2.y0 - F.y0) / L2.spacing) || F.spacing % L2.spacing !== 0) fail("los vértices de F no coinciden con los de L2");

  /** Bloque que contiene la celda de interpolación bilineal del punto (x, y). */
  const blockOf = (l: Level, x: number, y: number): { bx: number; by: number } | null => {
    const c = (x - l.x0) / l.spacing;
    const r = (l.y0 - y) / l.spacing;
    if (!(c >= 0 && r >= 0 && c <= l.cols - 1 && r <= l.rows - 1)) return null;
    return { bx: Math.floor(Math.min(Math.floor(c), l.cols - 2) / BLOCK_CELLS), by: Math.floor(Math.min(Math.floor(r), l.rows - 2) / BLOCK_CELLS) };
  };
  const blockRect = (l: Level, bx: number, by: number) => {
    const c0 = bx * BLOCK_CELLS;
    const r0 = by * BLOCK_CELLS;
    const cols = Math.min(BLOCK_CELLS + 1, l.cols - c0);
    const rows = Math.min(BLOCK_CELLS + 1, l.rows - r0);
    return { c0, r0, cols, rows, xmin: l.x0 + c0 * l.spacing, xmax: l.x0 + (c0 + cols - 1) * l.spacing, ymax: l.y0 - r0 * l.spacing, ymin: l.y0 - (r0 + rows - 1) * l.spacing };
  };
  const blocksNear = (l: Level, centers: Array<{ x: number; y: number }>, radiusM: number) => {
    const out: Array<{ bx: number; by: number }> = [];
    const nb = Math.ceil((l.cols - 1) / BLOCK_CELLS);
    for (let by = 0; by < nb; by++)
      for (let bx = 0; bx < nb; bx++) {
        const b = blockRect(l, bx, by);
        if (b.cols < 2 || b.rows < 2) continue;
        const hit = centers.some((c) => Math.hypot(c.x - Math.max(b.xmin, Math.min(b.xmax, c.x)), c.y - Math.max(b.ymin, Math.min(b.ymax, c.y))) <= radiusM);
        if (hit) out.push({ bx, by });
      }
    return out;
  };

  /* ---- puntos del motor que fijan el horizonte con relieve regional ---- */
  const pkg = JSON.parse(readFileSync(join(SOURCE, "paquete_frontend.json"), "utf8")) as {
    sites: Array<{ id: string; x_m: number; y_m: number; longitude_east_deg: number; latitude_deg: number }>;
    horizons: Record<string, { observer_ground_height_m: Record<string, number>; variants: Record<string, Record<string, { elevation_deg: number[]; distance_m: number[]; source: number[]; unknown: boolean[] }>> }>;
  };
  interface EnginePoint {
    site: string;
    set: string;
    az: number;
    d: number;
    source: number;
    el: number;
    obs: number;
    x: number;
    y: number;
  }
  const points: EnginePoint[] = [];
  for (const s of pkg.sites) {
    const ll = { lonEastDeg: s.longitude_east_deg, latDeg: s.latitude_deg };
    const h = pkg.horizons[s.id];
    const push = (set: string, obs: number, el: ArrayLike<number>, dist: ArrayLike<number>, src: ArrayLike<number>) => {
      for (let k = 0; k < N_AZ; k++) {
        if (src[k] === 0) continue;
        const p = rayPoint(ll, k * 0.25, dist[k]);
        points.push({ site: s.id, set, az: k * 0.25, d: dist[k], source: src[k], el: el[k], obs, x: p.x, y: p.y });
      }
    };
    for (const [variant, byHeight] of Object.entries(h.variants))
      for (const [hk, prof] of Object.entries(byHeight)) push(`v0.1 ${variant} ${hk} m`, h.observer_ground_height_m[variant] + Number(hk), prof.elevation_deg, prof.distance_m, prof.source);
    // Paquete de alturas de Engineer (nominal, 0–30 m cada 0,5 m): binarios descritos en su manifiesto.
    for (let k = 0; k <= 60; k++) {
      const buf = readFileSync(join(HEIGHTS, "horizons", `${s.id}_k${String(k).padStart(3, "0")}.bin`));
      if (buf.length !== N_AZ * 14) fail(`horizonte de alturas con tamaño inesperado: ${s.id} k${k}`);
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
      push(`alturas nominal ${k / 2} m`, h.observer_ground_height_m.nominal + k / 2, new Float64Array(ab, 0, N_AZ), new Float32Array(ab, 8 * N_AZ, N_AZ), new Uint8Array(ab, 12 * N_AZ, N_AZ));
    }
  }
  const N240 = level("N240");

  /* ---- selección de bloques ---- */
  const wanted = new Map<string, { level: Level; bx: number; by: number; why: Set<string>; horizon: number }>();
  const want = (l: Level, bx: number, by: number, why: string, horizon = 0) => {
    const b = blockRect(l, bx, by);
    if (b.cols < 2 || b.rows < 2 || bx < 0 || by < 0) fail(`bloque fuera del nivel: ${l.id}:${bx}_${by}`);
    const key = `${l.id}/${bx}_${by}`;
    const e = wanted.get(key) ?? { level: l, bx, by, why: new Set<string>(), horizon: 0 };
    e.why.add(why);
    e.horizon += horizon;
    wanted.set(key, e);
  };
  for (const p of points) {
    const l = p.source === 1 ? L0 : N240;
    const b = blockOf(l, p.x, p.y);
    if (!b) fail(`punto del motor fuera del producto: ${p.site} ${p.set} az ${p.az}`);
    want(l, b.bx, b.by, "horizon", 1);
  }
  const centers = pkg.sites.map((s) => ({ x: s.x_m, y: s.y_m }));
  for (const b of blocksNear(L0, centers, ringKm * 1000)) want(L0, b.bx, b.by, "ring");
  for (const sec of extraSectors) {
    const s = pkg.sites.find((x) => x.id === sec.site)!;
    const ll = { lonEastDeg: s.longitude_east_deg, latDeg: s.latitude_deg };
    for (let az = sec.az0; az <= sec.az1 + 1e-9; az += 0.25)
      for (let d = 500; d <= sec.km * 1000; d += 40) {
        const p = rayPoint(ll, az, d);
        const b = blockOf(L0, p.x, p.y);
        if (b) want(L0, b.bx, b.by, "extra");
      }
  }
  for (const b of extraBlocks) want(level(b.level), b.bx, b.by, "extra");
  for (const b of blocksNear(level("L1"), centers, midKm * 1000)) want(level("L1"), b.bx, b.by, "mid");
  for (const b of blocksNear(L2, centers, Infinity)) want(L2, b.bx, b.by, "overview");
  for (const b of blocksNear(F, centers, farKm * 1000)) want(F, b.bx, b.by, "far");

  /* ---- escritura ---- */
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const decoded = new Map<string, { rect: ReturnType<typeof blockRect>; z: Float32Array }>();
  const blocks: BlockOut[] = [];
  let maxQuantError = 0;
  const order = [...wanted.values()].sort((a, b) => levels.indexOf(a.level) - levels.indexOf(b.level) || a.by - b.by || a.bx - b.bx);
  for (const w of order) {
    const l = w.level;
    const rect = blockRect(l, w.bx, w.by);
    const n = rect.cols * rect.rows;
    const src = new Float32Array(n);
    let min = Infinity;
    let max = -Infinity;
    let nan = 0;
    for (let r = 0; r < rect.rows; r++)
      for (let c = 0; c < rect.cols; c++) {
        const v = l.grid.data[(l.offset + (rect.r0 + r) * l.stride) * l.grid.width + l.offset + (rect.c0 + c) * l.stride];
        src[r * rect.cols + c] = v;
        if (v === v) {
          if (v < min) min = v;
          if (v > max) max = v;
        } else nan++;
      }
    // Desplazamiento entero en pasos de 0,25 m: el valor decodificado no depende del bloque.
    const offsetQ = nan === n ? 0 : Math.round((min + max) / 2 / SCALE_M);
    const q = new Int16Array(n);
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = src[i];
      if (v !== v) {
        q[i] = NODATA_Q;
        z[i] = NaN;
        continue;
      }
      const qi = Math.round(v / SCALE_M) - offsetQ;
      if (qi <= NODATA_Q || qi > 32767) fail(`${l.id}/${w.bx}_${w.by}: el rango de alturas no cabe en int16`);
      q[i] = qi;
      z[i] = (qi + offsetQ) * SCALE_M;
      const err = Math.abs(z[i] - v);
      if (err > maxQuantError) maxQuantError = err;
    }
    const bytes = new Uint8Array(n * 2);
    const dv = new DataView(bytes.buffer);
    for (let i = 0; i < n; i++) dv.setInt16(i * 2, q[i], true);
    const id = `${l.id}/${w.bx}_${w.by}`;
    mkdirSync(join(OUT, l.id), { recursive: true });
    writeFileSync(join(OUT, `${id}.i16`), bytes);
    decoded.set(id, { rect, z });
    blocks.push({ id, level: l.id, bx: w.bx, by: w.by, cols: rect.cols, rows: rect.rows, bytes: bytes.length, sha256: sha256(bytes), offset_q: offsetQ, min_m: min, max_m: max, nodata_fraction: nan / n, why: [...w.why].sort(), horizon_points: w.horizon });
  }
  if (maxQuantError > SCALE_M / 2 + 1e-4) fail(`error de cuantización ${maxQuantError} m > ${SCALE_M / 2} m`);
  console.log(`✔ ${blocks.length} bloques escritos; error máximo de cuantización ${maxQuantError.toFixed(4)} m (límite ${SCALE_M / 2} m)`);

  /* ---- comprobación 1: bordes compartidos idénticos (entre bloques y entre niveles) ---- */
  let sharedChecked = 0;
  for (const b of blocks) {
    const me = decoded.get(b.id)!;
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      const other = decoded.get(`${b.level}/${b.bx + dx}_${b.by + dy}`);
      if (!other) continue;
      const len = dx ? Math.min(me.rect.rows, other.rect.rows) : Math.min(me.rect.cols, other.rect.cols);
      for (let k = 0; k < len; k++) {
        const a = dx ? me.z[k * me.rect.cols + me.rect.cols - 1] : me.z[(me.rect.rows - 1) * me.rect.cols + k];
        const o = dx ? other.z[k * other.rect.cols] : other.z[k];
        if (!Object.is(a, o)) fail(`costura entre ${b.id} y su vecino (${dx},${dy}) en ${k}: ${a} ≠ ${o}`);
        sharedChecked++;
      }
    }
  }
  /** Altura decodificada del vértice global (c, r) de un nivel, o undefined si su bloque no existe. */
  const vertexOf = (l: Level, c: number, r: number): number | undefined => {
    const bx = Math.min(Math.floor(c / BLOCK_CELLS), Math.ceil((l.cols - 1) / BLOCK_CELLS) - 1);
    const by = Math.min(Math.floor(r / BLOCK_CELLS), Math.ceil((l.rows - 1) / BLOCK_CELLS) - 1);
    const d = decoded.get(`${l.id}/${bx}_${by}`);
    if (!d) return undefined;
    const cc = c - d.rect.c0;
    const rr = r - d.rect.r0;
    return cc < d.rect.cols && rr < d.rect.rows ? d.z[rr * d.rect.cols + cc] : undefined;
  };
  let nestedChecked = 0;
  for (const [fine, coarse] of [[L0, level("L1")], [level("L1"), L2]] as const) {
    const k = coarse.stride / fine.stride;
    for (const b of blocks.filter((x) => x.level === coarse.id)) {
      const d = decoded.get(b.id)!;
      for (let r = 0; r < d.rect.rows; r += 7)
        for (let c = 0; c < d.rect.cols; c += 7) {
          const f = vertexOf(fine, (d.rect.c0 + c) * k, (d.rect.r0 + r) * k);
          if (f === undefined) continue;
          if (!Object.is(f, d.z[r * d.rect.cols + c])) fail(`niveles ${fine.id}/${coarse.id} no anidados en ${b.id} (${c},${r})`);
          nestedChecked++;
        }
    }
  }
  console.log(`✔ sin costuras: ${sharedChecked} vértices de borde compartidos idénticos; ${nestedChecked} vértices anidados entre niveles idénticos`);

  /* ---- comprobación 2: el relieve regional reproduce el horizonte del motor ---- */
  const sampleBlocks = (l: Level, x: number, y: number): number => {
    const c = (x - l.x0) / l.spacing;
    const r = (l.y0 - y) / l.spacing;
    if (!(c >= 0 && r >= 0 && c <= l.cols - 1 && r <= l.rows - 1)) return NaN;
    const c0 = Math.min(Math.floor(c), l.cols - 2);
    const r0 = Math.min(Math.floor(r), l.rows - 2);
    const v00 = vertexOf(l, c0, r0);
    const v01 = vertexOf(l, c0 + 1, r0);
    const v10 = vertexOf(l, c0, r0 + 1);
    const v11 = vertexOf(l, c0 + 1, r0 + 1);
    if (v00 === undefined || v01 === undefined || v10 === undefined || v11 === undefined) return NaN;
    const fc = c - c0;
    const fr = r - r0;
    return v00 * (1 - fc) * (1 - fr) + v01 * fc * (1 - fr) + v10 * (1 - fc) * fr + v11 * fc * fr;
  };
  let maxOriginalDeg = 0;
  let maxBlocksDeg = 0;
  let worst: (EnginePoint & { delta: number }) | null = null;
  let minDist = Infinity;
  let maxDist = 0;
  const bySource = [0, 0, 0];
  for (const p of points) {
    const l = p.source === 1 ? L0 : N240;
    const zOrig = sampleBilinear(l.grid, p.x, p.y);
    const zBlock = sampleBlocks(l, p.x, p.y);
    if (!Number.isFinite(zOrig) || !Number.isFinite(zBlock)) fail(`punto del motor sin dato regional: ${p.site} ${p.set} az ${p.az} d ${p.d}`);
    const dOrig = Math.abs(terrainElevationDeg(zOrig, p.obs, p.d) - p.el);
    const dBlock = Math.abs(terrainElevationDeg(zBlock, p.obs, p.d) - p.el);
    if (dOrig > maxOriginalDeg) maxOriginalDeg = dOrig;
    if (dBlock > maxBlocksDeg) {
      maxBlocksDeg = dBlock;
      worst = { ...p, delta: dBlock };
    }
    minDist = Math.min(minDist, p.d);
    maxDist = Math.max(maxDist, p.d);
    bySource[p.source]++;
  }
  // Tolerancia: 0,125 m de cuantización vistos a la distancia mínima, más el redondeo float32 del motor.
  const tolDeg = (Math.atan((SCALE_M / 2 + 0.01) / minDist) * 180) / Math.PI;
  if (maxOriginalDeg > 1e-4) fail(`el original no reproduce el horizonte del motor: Δ máx ${maxOriginalDeg}°`);
  if (maxBlocksDeg > tolDeg) fail(`los bloques no reproducen el horizonte del motor: Δ máx ${maxBlocksDeg}° > ${tolDeg}°`);
  console.log(`✔ motor: ${points.length} puntos regionales (${bySource[1]} de 80 m, ${bySource[2]} de 240 m, ${Math.round(minDist)}–${Math.round(maxDist)} m); Δ horizonte máx con el original ${maxOriginalDeg.toExponential(2)}°, con los bloques ${maxBlocksDeg.toExponential(2)}° (tolerancia ${tolDeg.toExponential(2)}°)`);

  /* ---- comparación informativa con el DEM local de 5 m (ventana versionada) ---- */
  let vsLocal: Record<string, number | string> | null = null;
  const localManifestPath = join(ROOT, "data", "derived", "terrain", "manifest.json");
  if (existsSync(localManifestPath)) {
    const lm = JSON.parse(readFileSync(localManifestPath, "utf8")) as { georeferencing: { window_bounds_xy_m: number[]; width: number; height: number; pixel_size_m: number } };
    const g = lm.georeferencing;
    const buf = readFileSync(join(ROOT, "data", "derived", "terrain", "elevation.f32"));
    const local: RasterGrid = { width: g.width, height: g.height, pixelSizeM: g.pixel_size_m, xmin: g.window_bounds_xy_m[0], ymax: g.window_bounds_xy_m[3], data: new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)) };
    let n = 0;
    let sum = 0;
    let sum2 = 0;
    let maxAbs = 0;
    for (let r = 0; r < L0.rows; r++) {
      const y = L0.y0 - r * L0.spacing;
      if (y < g.window_bounds_xy_m[1] || y > g.window_bounds_xy_m[3]) continue;
      for (let c = 0; c < L0.cols; c++) {
        const x = L0.x0 + c * L0.spacing;
        if (x < g.window_bounds_xy_m[0] || x > g.window_bounds_xy_m[2]) continue;
        const zl = sampleBilinear(local, x, y);
        const zr = L0.grid.data[r * L0.grid.width + c];
        if (!Number.isFinite(zl) || !Number.isFinite(zr)) continue;
        const d = zr - zl;
        n++;
        sum += d;
        sum2 += d * d;
        if (Math.abs(d) > maxAbs) maxAbs = Math.abs(d);
      }
    }
    vsLocal = {
      description: "PGDA90 80 m − PGDA78 5 m (bilineal) en los centros de píxel de 80 m dentro de la ventana local de 4 × 4 km. Productos distintos: el de 80 m es la media por celda.",
      samples: n,
      mean_m: Number((sum / n).toFixed(3)),
      rms_m: Number(Math.sqrt(sum2 / n).toFixed(3)),
      max_abs_m: Number(maxAbs.toFixed(3)),
    };
    console.log(`✔ 80 m frente al DEM local de 5 m en la ventana: ${n} muestras, media ${vsLocal.mean_m} m, RMS ${vsLocal.rms_m} m, máx |Δ| ${vsLocal.max_abs_m} m`);
  }

  /* ---- sectores cubiertos (por sitio y sector de 15° de azimut) ---- */
  const sectors: Array<{ site: string; azimuth_deg: [number, number]; engine_points: number; distance_km: [number, number]; blocks: string[] }> = [];
  for (const s of pkg.sites)
    for (let a0 = 0; a0 < 360; a0 += 15) {
      const ps = points.filter((p) => p.site === s.id && p.az >= a0 && p.az < a0 + 15);
      if (!ps.length) continue;
      const ids = new Set<string>();
      for (const p of ps) {
        const l = p.source === 1 ? L0 : N240;
        const b = blockOf(l, p.x, p.y)!;
        ids.add(`${l.id}/${b.bx}_${b.by}`);
      }
      sectors.push({ site: s.id, azimuth_deg: [a0, a0 + 15], engine_points: ps.length, distance_km: [Number((Math.min(...ps.map((p) => p.d)) / 1000).toFixed(2)), Number((Math.max(...ps.map((p) => p.d)) / 1000).toFixed(2))], blocks: [...ids].sort() });
    }

  /* ---- manifiesto ---- */
  const generatorSource = readFileSync(import.meta.filename, "utf8").replace(/\r\n/g, "\n");
  const totalBytes = blocks.reduce((a, b) => a + b.bytes, 0);
  const manifest = {
    schema: "site-regret-terrain-regional/1",
    version: "v1",
    generator: "scripts/geospatial/build-regional.ts",
    generator_version: GENERATOR_VERSION,
    generator_sha256: sha256(generatorSource),
    generator_sha256_note: "SHA-256 del script con finales de línea normalizados a LF.",
    build_args: argv,
    region: "Polo sur lunar alrededor de Connecting Ridge (sitios A y B): relieve regional PGDA 90 hasta 400 km",
    georeferencing: {
      crs: "Estereográfica polar sur lunar: esfera R = 1737400 m, lat0 = −90°, lon0 = 0°, k0 = 1 (etiquetas GeoTIFF comprobadas)",
      frame: "MOON_ME_DE421 (según el proveedor)",
      sphere_radius_m: SPHERE_RADIUS_M,
      vertical_reference: "Altura sobre la esfera de 1737400 m, en metros (valores del original, sin escala ni desplazamiento)",
      vertex_model:
        "Cada vértice es el CENTRO de un píxel del original. Vértice (c, r) de un nivel: x = x0_m + c·spacing_m; y = y0_m − r·spacing_m (fila 0 al norte de la rejilla). Bloque (bx, by): vértices c = bx·block_cells … bx·block_cells + cols − 1 (ídem filas); la última columna/fila es la primera del bloque vecino.",
    },
    encoding: {
      dtype: "int16-le",
      scale_m: SCALE_M,
      nodata: NODATA_Q,
      formula: "altura_m = (valor + offset_q) · scale_m; valor = nodata → sin dato (NaN, nunca 0)",
      block_cells: BLOCK_CELLS,
      max_quantization_error_m: Number(maxQuantError.toFixed(6)),
      quantization_bound_m: SCALE_M / 2,
    },
    sources: PRODUCTS.map((p) => {
      const { asset, stats, grid } = loaded.get(p.id)!;
      return {
        id: p.id,
        passport_id: p.passportId,
        title: p.title,
        provider: "NASA GSFC Planetary Geodesy Data Archive (PGDA) · LRO/LOLA",
        product_page: "https://pgda.gsfc.nasa.gov/products/90",
        credit: "NASA/GSFC/LOLA · Barker, M. K. et al. (2023), Planetary Science Journal, doi:10.3847/PSJ/acf3e1 · datos: doi:10.60903/gsfcpgda-lola-spole",
        file: asset.path.split("/").pop(),
        url: asset.url,
        bytes: asset.bytes,
        sha256: asset.sha256,
        server_last_modified: asset.last_modified ?? null,
        verification: "Archivo completo: tamaño, firma TIFF y SHA-256 iguales a los del pasaporte del paquete site-regret/0.1 (datos/pasaporte.json)",
        pixel_size_m: p.px,
        width: grid.width,
        height: grid.height,
        bounds_xy_m: [p.xmin, p.ymax - p.size * p.px, p.xmin + p.size * p.px, p.ymax],
        stats,
      };
    }),
    engine_convention: {
      description:
        "Como `horizon` de motor/pipeline.py: la altura regional es la bilineal entre centros de píxel del producto de 80 m y, solo donde este no tiene dato, la del de 240 m. El motor usa el relieve regional fuera de la tesela local PGDA78 Site01 (dentro usa el DEM de 5 m hasta 24 km) y entre 500 m y 400 km del sitio.",
      local_region_bounds_xy_m: [-18997.5, -19997.5, -3002.5, -4002.5],
      regional_min_distance_m: 500,
      max_ray_distance_m: 400000,
      source_codes: { "0": "DEM local 5 m (PGDA78 Site01)", "1": "regional 80 m (PGDA90)", "2": "apoyo 240 m (PGDA90)" },
    },
    levels: levels.map((l) => {
      const own = blocks.filter((b) => b.level === l.id);
      return {
        id: l.id,
        source: l.product,
        role: l.role,
        preload: l.preload,
        stride: l.stride,
        index_offset: l.offset,
        spacing_m: l.spacing,
        x0_m: l.x0,
        y0_m: l.y0,
        cols: l.cols,
        rows: l.rows,
        block_cells: BLOCK_CELLS,
        block_size_m: BLOCK_CELLS * l.spacing,
        block_count: own.length,
        bytes: own.reduce((a, b) => a + b.bytes, 0),
        description: l.description,
      };
    }),
    blocks,
    coverage: {
      sites: pkg.sites.map((s) => ({ id: s.id, x_m: s.x_m, y_m: s.y_m })),
      ring_km: ringKm,
      mid_km: midKm,
      far_km: farKm,
      rules: [
        "L0 (80 m nativo): bloques que contienen algún punto que fija el horizonte según el motor (paquete v0.1: 10 superficies × 0/2/10 m; paquete de alturas de Engineer: nominal, 61 alturas) + bloques a menos de ring_km de A o B + los pedidos con --sector/--blocks.",
        "L1 (320 m): bloques a menos de mid_km de A o B.",
        "L2 (1280 m): todo el producto de 80 m.",
        "F (3840 m, producto de 240 m): bloques a menos de far_km de A o B.",
        "N240 (240 m nativo): solo si el motor fija algún horizonte con el producto de 240 m (no ocurre en estos paquetes) o se pide con --blocks.",
      ],
      horizon_sectors: sectors,
    },
    validation: {
      engine_points: points.length,
      engine_points_by_source: { regional_80m: bySource[1], far_240m: bySource[2] },
      engine_point_distance_m: [minDist, maxDist],
      max_horizon_delta_deg_original: maxOriginalDeg,
      max_horizon_delta_deg_blocks: maxBlocksDeg,
      horizon_tolerance_deg: tolDeg,
      horizon_tolerance_note: "atan((0,125 m de cuantización + 0,01 m) / distancia mínima de un punto regional del motor)",
      worst_point: worst ? { site: worst.site, set: worst.set, azimuth_deg: worst.az, distance_m: worst.d, delta_deg: worst.delta } : null,
      shared_edge_vertices_checked: sharedChecked,
      nested_level_vertices_checked: nestedChecked,
      vs_local_dem_window: vsLocal,
    },
    total_bytes: totalBytes,
    limits: [
      "Los niveles L1, L2 y F son submuestreos (1 de cada 4 o 16 muestras): cada vértice es real, pero las crestas entre vértices no están; solo L0 (y N240) tienen todas las muestras del original.",
      "Fuera de los bloques L0 listados no hay relieve nativo de 80 m en la web: el visor debe indicar el límite de cobertura y conservar el punto real del motor en el mapa.",
      "Dentro de la tesela local PGDA78 Site01 (16 × 16 km) el motor usa el DEM de 5 m, no este producto; la web solo publica de ese DEM la ventana de 4 × 4 km. Entre ambas, el relieve de 80 m es contexto, no el dato que usó el motor.",
      "El relieve a más de ~250 km queda bajo el horizonte geométrico por la curvatura; el nivel F existe para acreditar la cobertura hasta 400 km, no porque llegue a verse.",
      "Cuantización: paso de 0,25 m (error ≤ 0,125 m). Es una malla para DIBUJAR y localizar; la visibilidad y las métricas siguen saliendo del motor.",
    ],
  };
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n", "utf8");
  for (const l of manifest.levels) console.log(`  ${l.id}: ${l.block_count} bloques, ${(l.bytes / 1e6).toFixed(2)} MB, vértices cada ${l.spacing_m} m, bloque de ${l.block_size_m / 1000} km`);
  console.log(`✔ manifest.json: ${blocks.length} bloques, ${(totalBytes / 1e6).toFixed(2)} MB → data/derived/terrain-regional/v1/`);
}

await main();
