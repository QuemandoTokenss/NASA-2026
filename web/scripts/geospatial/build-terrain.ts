/**
 * Genera los derivados ligeros de terreno a partir de los ORIGINALES
 * verificados de PGDA78 Site01 (`data/raw/`, ver fetch-originals.ts):
 *
 *   node scripts/geospatial/build-terrain.ts
 *
 * - Comprueba cada original entero (tamaño, firma y SHA-256).
 * - Lee la georreferenciación de las etiquetas GeoTIFF y la contrasta con el
 *   registro (dimensiones, tamaño de píxel, esquina, esfera y polo).
 * - Recorta la ventana de Connecting Ridge SIN remuestrear: cada valor del
 *   derivado es la misma muestra float32 del original (subconjunto exacto).
 * - Extrae los polígonos ROI del .tgz en memoria (no escribe rutas del archivo).
 * - Escribe `data/derived/terrain/` con un manifiesto de procedencia y hashes.
 *
 * El resultado es determinista: mismos originales → mismos bytes y hashes.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { fromFile } from "geotiff";
import { RAW_DIR, rawPathOf, readRegistry, verifyOriginal } from "./fetch-originals.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const OUT = join(ROOT, "data", "derived", "terrain");
export const GENERATOR_VERSION = 1;

/** Ventana de trabajo: la misma que `datos/contexto_2d.json → bounds_xy_m`. */
const WINDOW_BOUNDS = [-13000, -14000, -9000, -10000] as const;
const SPHERE_RADIUS_M = 1737400;

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

interface RasterAsset {
  id: string;
  layer: string;
  kind: string;
  url: string;
  bytes: number;
  sha256: string;
  units: string;
  grid: { width: number; height: number; pixel_size_m: number; bounds_xy_m: number[] };
}

function fail(msg: string): never {
  console.error(`✘ ${msg}`);
  process.exit(1);
}

/* ----------------------------- ROI (shapefile) ----------------------------- */

/** Lee un .tar en memoria y devuelve solo archivos regulares por nombre base. */
function untar(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (let off = 0; off + 512 <= buf.length; ) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const size = parseInt(header.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim() || "0", 8);
    const type = String.fromCharCode(header[156] || 48);
    if (type === "0" || type === "\0") files.set(name.split("/").pop()!, buf.subarray(off + 512, off + 512 + size));
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

function readShpPolygons(shp: Buffer): number[][][][] {
  const shapes: number[][][][] = [];
  for (let off = 100; off < shp.length; ) {
    const contentBytes = shp.readInt32BE(off + 4) * 2;
    const rec = shp.subarray(off + 8, off + 8 + contentBytes);
    const type = rec.readInt32LE(0);
    if (type !== 5 && type !== 15) fail(`ROI: tipo de geometría ${type} no soportado`);
    const numParts = rec.readInt32LE(36);
    const numPoints = rec.readInt32LE(40);
    const parts = Array.from({ length: numParts }, (_, i) => rec.readInt32LE(44 + 4 * i));
    const base = 44 + 4 * numParts;
    const rings: number[][][] = parts.map((start, i) => {
      const end = i + 1 < numParts ? parts[i + 1] : numPoints;
      return Array.from({ length: end - start }, (_, k) => [rec.readDoubleLE(base + 16 * (start + k)), rec.readDoubleLE(base + 16 * (start + k) + 8)]);
    });
    shapes.push(rings);
    off += 8 + contentBytes;
  }
  return shapes;
}

function readDbf(dbf: Buffer): Array<Record<string, string>> {
  const n = dbf.readUInt32LE(4);
  const headerLen = dbf.readUInt16LE(8);
  const recLen = dbf.readUInt16LE(10);
  const fields: Array<{ name: string; len: number }> = [];
  for (let off = 32; dbf[off] !== 0x0d; off += 32) fields.push({ name: dbf.subarray(off, off + 11).toString("latin1").replace(/\0.*$/, ""), len: dbf[off + 16] });
  return Array.from({ length: n }, (_, i) => {
    let off = headerLen + i * recLen + 1;
    const row: Record<string, string> = {};
    for (const f of fields) {
      row[f.name] = dbf.subarray(off, off + f.len).toString("latin1").trim();
      off += f.len;
    }
    return row;
  });
}

/* --------------------------------- principal -------------------------------- */

async function main() {
  const registry = readRegistry() as unknown as { assets: RasterAsset[] };
  const rasters = registry.assets.filter((a) => a.kind === "numeric_raster");
  const roisAsset = registry.assets.find((a) => a.kind === "vector")!;

  for (const a of [...rasters, roisAsset]) {
    const problem = await verifyOriginal(a as never);
    if (problem) fail(`${a.id}: ${problem}. Ejecuta antes \`node scripts/geospatial/fetch-originals.ts\`.`);
  }

  mkdirSync(OUT, { recursive: true });
  const [xmin, ymin, xmax, ymax] = WINDOW_BOUNDS;
  const layers = [];
  let georef: Record<string, unknown> | null = null;

  for (const a of rasters) {
    const tiff = await fromFile(rawPathOf(a as never));
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const origin = image.getOrigin();
    const resolution = image.getResolution();
    const tie = { x: origin[0], y: origin[1] };
    const scale = [resolution[0], -resolution[1]];
    const keys = image.getGeoKeys() as Record<string, number | string>;
    const nodata = image.getGDALNoData();
    const px = a.grid.pixel_size_m;

    // Georreferenciación leída de las etiquetas frente al registro.
    if (width !== a.grid.width || height !== a.grid.height) fail(`${a.id}: dimensiones ${width}×${height}`);
    if (scale[0] !== px || scale[1] !== px) fail(`${a.id}: tamaño de píxel ${scale}`);
    if (!image.pixelIsArea() || tie.x !== a.grid.bounds_xy_m[0] || tie.y !== a.grid.bounds_xy_m[3]) fail(`${a.id}: origen ${JSON.stringify(tie)}`);
    if (keys.ProjScaleAtNatOriginGeoKey !== 1 || keys.ProjLinearUnitsGeoKey !== 9001) fail(`${a.id}: escala/unidades ${JSON.stringify(keys)}`);
    if (keys.ProjNatOriginLatGeoKey !== -90 || keys.ProjStraightVertPoleLongGeoKey !== 0) fail(`${a.id}: polo/meridiano ${JSON.stringify(keys)}`);
    if (keys.GeogSemiMajorAxisGeoKey !== SPHERE_RADIUS_M || keys.GeogSemiMinorAxisGeoKey !== SPHERE_RADIUS_M) fail(`${a.id}: esfera ${JSON.stringify(keys)}`);
    if (keys.ProjCoordTransGeoKey !== 15) fail(`${a.id}: proyección ${keys.ProjCoordTransGeoKey} (se esperaba 15 = estereográfica polar)`);
    if (image.getSamplesPerPixel() !== 1 || image.getBitsPerSample() !== 32 || image.getSampleFormat() !== 3) fail(`${a.id}: se esperaba 1 banda float32`);
    if (nodata !== null && !Number.isNaN(nodata)) fail(`${a.id}: nodata ${nodata} (se esperaba NaN)`);

    const col0 = (xmin - tie.x) / px;
    const row0 = (tie.y - ymax) / px;
    const w = (xmax - xmin) / px;
    const h = (ymax - ymin) / px;
    if (![col0, row0, w, h].every(Number.isInteger)) fail(`${a.id}: la ventana no cae en bordes de píxel`);
    const data = (await image.readRasters({ window: [col0, row0, col0 + w, row0 + h], samples: [0] }))[0] as Float32Array;
    if (!(data instanceof Float32Array) || data.length !== w * h) fail(`${a.id}: lectura inesperada`);

    let min = Infinity;
    let max = -Infinity;
    let finite = 0;
    for (const v of data) {
      if (Number.isFinite(v)) {
        finite++;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const file = `${a.layer}.f32`;
    writeFileSync(join(OUT, file), bytes);
    layers.push({
      id: a.layer,
      registry_id: a.id,
      file,
      dtype: "float32-le",
      units: a.units,
      nodata: "NaN",
      bytes: bytes.length,
      sha256: sha256(bytes),
      stats: { min, max, finite_count: finite, nodata_count: data.length - finite },
      source: { file: a.url.split("/").pop(), url: a.url, bytes: a.bytes, sha256: a.sha256 },
      processing: "Subconjunto exacto de muestras (sin remuestreo, sin escala, sin relleno de nodata).",
    });
    georef ??= {
      window_bounds_xy_m: [xmin, ymin, xmax, ymax],
      width: w,
      height: h,
      pixel_size_m: px,
      source_col_offset: col0,
      source_row_offset: row0,
      pixel_model: "area: x_centro(i) = xmin + (i + 0.5)·px; y_centro(j) = ymax − (j + 0.5)·px; fila 0 al norte de la rejilla (y máxima)",
      crs: "Estereográfica polar sur lunar: esfera R = 1737400 m, lat0 = −90°, lon0 = 0°, k0 = 1 (etiquetas GeoTIFF comprobadas)",
      frame: "MOON_ME_DE421 (según el proveedor)",
      sphere_radius_m: SPHERE_RADIUS_M,
    };
    console.log(`✔ ${a.layer}: ${w}×${h} px, ${min} … ${max} ${a.units}, nodata ${data.length - finite}`);
  }

  // ROI: se leen del .tgz en memoria.
  const tar = untar(gunzipSync(readFileSync(join(RAW_DIR, "Site01_ROIs.tgz"))));
  const shp = tar.get("Site01_ROIs.shp");
  const dbf = tar.get("Site01_ROIs.dbf");
  if (!shp || !dbf) fail("ROI: faltan Site01_ROIs.shp/.dbf en el .tgz");
  const polygons = readShpPolygons(shp);
  const records = readDbf(dbf);
  if (polygons.length !== records.length) fail("ROI: nº de polígonos ≠ nº de registros");
  const rois = polygons.map((rings, i) => ({ roi: i + 1, attributes: records[i], rings }));
  const roisJson = Buffer.from(JSON.stringify({ crs: georef!.crs, units: "m", rois }), "utf8");
  writeFileSync(join(OUT, "rois.json"), roisJson);
  console.log(`✔ rois: ${rois.length} polígonos`);

  const manifest = {
    schema: "site-regret-terrain/1",
    generator: "scripts/geospatial/build-terrain.ts",
    generator_version: GENERATOR_VERSION,
    region: "Connecting Ridge (PGDA78 Site01), ventana que contiene los sitios A (ROI 4) y B (ROI 6)",
    georeferencing: georef,
    layers,
    rois: {
      file: "rois.json",
      bytes: roisJson.length,
      sha256: sha256(roisJson),
      count: rois.length,
      registry_id: roisAsset.id,
      source: { file: "Site01_ROIs.tgz", url: roisAsset.url, bytes: roisAsset.bytes, sha256: roisAsset.sha256 },
      processing: "Polígonos y atributos leídos del shapefile sin modificar coordenadas.",
    },
    limits: [
      "La ventana cubre 4 × 4 km; fuera de ella la aplicación no tiene raster numérico preparado.",
      "El horizonte del motor usa además relieve regional (PGDA90, 80 m y 240 m) hasta 400 km, que no está en esta ventana.",
      "Rejilla de 5 m: parte de las alturas están interpoladas (ver la capa de retornos LOLA).",
    ],
  };
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`✔ manifest.json (${layers.length} capas)`);
}

await main();
