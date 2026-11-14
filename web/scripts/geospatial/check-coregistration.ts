/**
 * Corregistro cuantitativo entre el mosaico orbital de Moon Trek y el DEM
 * PGDA78 (requisito T5 del encargo). Necesita red la primera vez.
 *
 *   node scripts/geospatial/check-coregistration.ts
 *
 * Método (sin datos inventados):
 * 1. Descarga las teselas reales que cubren la ventana del DEM a un nivel de
 *    zoom fijo, verificando la firma PNG, y las guarda en `data/raw/trek/`.
 * 2. Las decodifica y muestrea en los centros de la rejilla de análisis
 *    (1 de cada 2 muestras del DEM: 10 m) con la georreferenciación del
 *    documento WMTS (la misma que usa el mapa).
 * 3. Calcula, para varios azimuts y alturas de luz, la correlación
 *    normalizada (NCC) entre la imagen y el relieve sombreado del DEM,
 *    desplazando la imagen ±MAX_SHIFT píxeles. El máximo estima el desfase.
 * 4. Repite por cuadrantes y escribe `data/derived/coregistration.json`.
 *
 * Límites: el mosaico es multitemporal y con luz rasante; el sombreado
 * lambertiano no modela sombras arrojadas. El resultado es una estimación del
 * desfase global, no una certificación de exactitud geodésica.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { parseWmtsCapabilities, tileForPoint, tileUrl, imageSignature, checkPolarStereographicGrid } from "../../src/lib/geospatial/wmts.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const CACHE = join(ROOT, "data", "raw", "trek");
/**
 * Dos comprobaciones:
 * - `Site01_final_adj_5mpp_Hillshade`: relieve sombreado del MISMO producto PGDA78 servido por Moon Trek.
 *   Valida de forma cuantitativa la georreferenciación de las teselas (rejilla WMTS ↔ rejilla del DEM).
 * - `LRO_NAC_Mosaic_1mpp_SP`: el mosaico fotográfico. Su parecido con un sombreado depende de la luz real.
 */
const TARGETS = [
  { layer: "Site01_final_adj_5mpp_Hillshade", zoom: "10", shadowLevel: 0, role: "tile_grid_georeferencing" },
  { layer: "LRO_NAC_Mosaic_1mpp_SP", zoom: "11", shadowLevel: 12, role: "orbital_image_registration" },
] as const;
const STEP = 2; // 1 de cada 2 muestras del DEM → 10 m
const MAX_SHIFT = 8; // ±80 m
const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** Decodificador PNG mínimo (8 bits, sin entrelazado): devuelve gris y alfa. */
function decodePng(buf: Buffer): { width: number; height: number; gray: Uint8Array; alpha: Uint8Array } {
  if (imageSignature(buf) !== "png") throw new Error("no es PNG");
  let off = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
      if (data[8] !== 8 || data[12] !== 0) throw new Error("PNG no soportado (profundidad o entrelazado)");
    } else if (type === "PLTE") palette = Buffer.from(data);
    else if (type === "tRNS") trns = Buffer.from(data);
    else if (type === "IDAT") idat.push(Buffer.from(data));
    off += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`tipo de color ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= channels ? px[y * stride + x - channels] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
      let pred = 0;
      if (f === 1) pred = a;
      else if (f === 2) pred = b;
      else if (f === 3) pred = (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = (v + pred) & 255;
    }
  }
  const gray = new Uint8Array(width * height);
  const alpha = new Uint8Array(width * height).fill(255);
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    if (colorType === 0) gray[i] = px[p];
    else if (colorType === 4) {
      gray[i] = px[p];
      alpha[i] = px[p + 1];
    } else if (colorType === 3) {
      const k = px[p] * 3;
      gray[i] = Math.round(0.299 * palette![k] + 0.587 * palette![k + 1] + 0.114 * palette![k + 2]);
      if (trns && px[p] < trns.length) alpha[i] = trns[px[p]];
    } else {
      gray[i] = Math.round(0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2]);
      if (colorType === 6) alpha[i] = px[p + 3];
    }
  }
  return { width, height, gray, alpha };
}

async function getCached(url: string, file: string): Promise<Buffer> {
  const path = join(CACHE, file);
  if (existsSync(path)) return readFileSync(path);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(path, buf);
  return buf;
}

/** NCC entre a y b (desplazando b) sobre los píxeles válidos de ambas. */
function ncc(a: Float32Array, b: Float32Array, valid: Uint8Array, w: number, h: number, dx: number, dy: number, x0: number, y0: number, x1: number, y1: number): number {
  let n = 0;
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  for (let y = Math.max(y0, MAX_SHIFT); y < Math.min(y1, h - MAX_SHIFT); y++) {
    for (let x = Math.max(x0, MAX_SHIFT); x < Math.min(x1, w - MAX_SHIFT); x++) {
      const j = (y + dy) * w + x + dx;
      if (!valid[j]) continue;
      const va = a[y * w + x];
      const vb = b[j];
      n++;
      sa += va;
      sb += vb;
      saa += va * va;
      sbb += vb * vb;
      sab += va * vb;
    }
  }
  const cov = sab - (sa * sb) / n;
  const den = Math.sqrt((saa - (sa * sa) / n) * (sbb - (sb * sb) / n));
  return den > 0 ? cov / den : 0;
}

/** Paso alto: resta la media local (caja de radio `r` celdas) para quitar la iluminación a gran escala. */
function highPass(a: Float32Array, w: number, h: number, r: number): Float32Array {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += a[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const y0 = Math.max(0, y - r);
      const x1 = Math.min(w, x + r + 1);
      const y1 = Math.min(h, y + r + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      out[y * w + x] = a[y * w + x] - sum / ((x1 - x0) * (y1 - y0));
    }
  return out;
}

const HIGH_PASS_RADIUS = 5; // celdas: quita estructura de más de ~110 m

async function analyse(LAYER: string, ZOOM: string, SHADOW_LEVEL: number, role: string) {
  mkdirSync(CACHE, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(ROOT, "data", "derived", "terrain", "manifest.json"), "utf8"));
  const g = manifest.georeferencing;
  const [xmin, ymin, xmax, ymax] = g.window_bounds_xy_m as number[];
  const elevBuf = readFileSync(join(ROOT, "data", "derived", "terrain", "elevation.f32"));
  const elev = new Float32Array(elevBuf.buffer, elevBuf.byteOffset, elevBuf.byteLength / 4);

  const capUrl = `https://trek.nasa.gov/tiles/Moon/SP/${LAYER}/1.0.0/WMTSCapabilities.xml`;
  const capXml = (await getCached(capUrl, `${LAYER}.WMTSCapabilities.xml`)).toString("utf8");
  const cap = parseWmtsCapabilities(capXml);
  const issues = checkPolarStereographicGrid(cap);
  // Una capa local no contiene el polo en su cobertura: esa comprobación no aplica.
  const blocking = issues.filter((i) => !i.includes("cobertura declarada"));
  if (blocking.length) throw new Error(blocking.join("; "));
  const m = cap.matrices.find((x) => x.id === ZOOM)!;
  const tl = tileForPoint(m, xmin, ymax);
  const br = tileForPoint(m, xmax - 1e-6, ymin + 1e-6);
  const tiles = new Map<string, ReturnType<typeof decodePng>>();
  const tileHashes: Record<string, string> = {};
  for (let row = tl.row; row <= br.row; row++)
    for (let col = tl.col; col <= br.col; col++) {
      const url = tileUrl(cap, m.id, row, col);
      const buf = await getCached(url, `${LAYER}.z${ZOOM}.r${row}.c${col}.png`);
      tiles.set(`${row}/${col}`, decodePng(buf));
      tileHashes[`${row}/${col}`] = sha256(buf);
    }
  console.log(`✔ ${tiles.size} teselas reales (zoom ${ZOOM}, ${m.resolution.toFixed(4)} m/px)`);

  // Rejilla de análisis: centros de 1 de cada STEP muestras del DEM.
  const w = Math.floor(g.width / STEP);
  const h = Math.floor(g.height / STEP);
  const cell = g.pixel_size_m * STEP;
  const z = new Float32Array(w * h);
  const img = new Float32Array(w * h);
  const valid = new Uint8Array(w * h);
  const tileSpan = m.tileWidth * m.resolution;
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      z[r * w + c] = elev[r * STEP * g.width + c * STEP];
      const x = xmin + (c * STEP + 0.5) * g.pixel_size_m;
      const y = ymax - (r * STEP + 0.5) * g.pixel_size_m;
      // Media de la imagen sobre la celda de análisis (3×3 puntos).
      let sum = 0;
      let n = 0;
      for (const oy of [-1, 0, 1])
        for (const ox of [-1, 0, 1]) {
          const px = x + (ox * cell) / 3;
          const py = y + (oy * cell) / 3;
          const t = tileForPoint(m, px, py);
          const tile = tiles.get(`${t.row}/${t.col}`);
          if (!tile) continue;
          const u = Math.min(tile.width - 1, Math.floor((px - (m.topLeft[0] + t.col * tileSpan)) / m.resolution));
          const v = Math.min(tile.height - 1, Math.floor((m.topLeft[1] - t.row * tileSpan - py) / m.resolution));
          if (tile.alpha[v * tile.width + u] === 0) continue;
          sum += tile.gray[v * tile.width + u];
          n++;
        }
      if (n === 9) {
        img[r * w + c] = sum / n;
        valid[r * w + c] = sum / n >= SHADOW_LEVEL ? 1 : 0;
      }
    }
  const validFraction = valid.reduce((s, v) => s + v, 0) / valid.length;
  const imgRaw = img;
  const imgHp = highPass(imgRaw, w, h, HIGH_PASS_RADIUS);

  // Gradientes del DEM en la rejilla de análisis.
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let r = 1; r < h - 1; r++)
    for (let c = 1; c < w - 1; c++) {
      gx[r * w + c] = (z[r * w + c + 1] - z[r * w + c - 1]) / (2 * cell);
      gy[r * w + c] = (z[(r - 1) * w + c] - z[(r + 1) * w + c]) / (2 * cell);
    }
  const shade = (azDeg: number, altDeg: number) => {
    const az = (azDeg * Math.PI) / 180;
    const alt = (altDeg * Math.PI) / 180;
    const lx = Math.sin(az) * Math.cos(alt);
    const ly = Math.cos(az) * Math.cos(alt);
    const lz = Math.sin(alt);
    const out = new Float32Array(w * h);
    for (let i = 0; i < out.length; i++) out[i] = Math.max(0, (-gx[i] * lx - gy[i] * ly + lz) / Math.hypot(gx[i], gy[i], 1));
    return highPass(out, w, h, HIGH_PASS_RADIUS);
  };

  const search = (x0: number, y0: number, x1: number, y1: number) => {
    let best = { ncc: -2, az: 0, alt: 0, dx: 0, dy: 0 };
    let zeroBest = -2;
    for (const alt of [3, 8, 20, 45])
      for (let az = 0; az < 360; az += 15) {
        const s = shade(az, alt);
        const zero = ncc(s, imgHp, valid, w, h, 0, 0, x0, y0, x1, y1);
        if (zero > zeroBest) zeroBest = zero;
        for (let dy = -MAX_SHIFT; dy <= MAX_SHIFT; dy++)
          for (let dx = -MAX_SHIFT; dx <= MAX_SHIFT; dx++) {
            const v = ncc(s, imgHp, valid, w, h, dx, dy, x0, y0, x1, y1);
            if (v > best.ncc) best = { ncc: v, az, alt, dx, dy };
          }
      }
    // Refinado subpíxel (parábola) y nivel de fondo en el borde de la búsqueda.
    const s = shade(best.az, best.alt);
    const at = (dx: number, dy: number) => ncc(s, imgHp, valid, w, h, Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, dx)), Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, dy)), x0, y0, x1, y1);
    const sub = (m1: number, c0: number, p1: number) => (m1 - 2 * c0 + p1 === 0 ? 0 : (0.5 * (m1 - p1)) / (m1 - 2 * c0 + p1));
    const sx = Math.abs(best.dx) < MAX_SHIFT ? sub(at(best.dx - 1, best.dy), best.ncc, at(best.dx + 1, best.dy)) : 0;
    const sy = Math.abs(best.dy) < MAX_SHIFT ? sub(at(best.dx, best.dy - 1), best.ncc, at(best.dx, best.dy + 1)) : 0;
    const ring: number[] = [];
    for (let k = -MAX_SHIFT; k <= MAX_SHIFT; k += 2) ring.push(at(k, -MAX_SHIFT), at(k, MAX_SHIFT), at(-MAX_SHIFT, k), at(MAX_SHIFT, k));
    const background = ring.reduce((a, b) => a + b, 0) / ring.length;
    return {
      peak_ncc: best.ncc,
      ncc_at_zero_shift_best_light: zeroBest,
      background_ncc_at_search_edge: background,
      light_azimuth_map_deg: best.az,
      light_altitude_deg: best.alt,
      // dx > 0: la imagen está desplazada hacia +X (este del mapa) respecto al DEM; dy > 0 en filas = hacia −Y.
      offset_x_m: (best.dx + sx) * cell,
      offset_y_m: -(best.dy + sy) * cell,
      offset_m: Math.hypot((best.dx + sx) * cell, (best.dy + sy) * cell),
      peak_at_search_edge: Math.abs(best.dx) === MAX_SHIFT || Math.abs(best.dy) === MAX_SHIFT,
    };
  };

  const whole = search(0, 0, w, h);
  const quadrants = {
    north_west: search(0, 0, w / 2, h / 2),
    north_east: search(w / 2, 0, w, h / 2),
    south_west: search(0, h / 2, w / 2, h),
    south_east: search(w / 2, h / 2, w, h),
  };
  const result = {
    role,
    image: { layer: LAYER, capabilities_url: capUrl, capabilities_sha256: sha256(Buffer.from(capXml, "utf8")), zoom: ZOOM, tile_resolution_m: m.resolution, tiles: tiles.size, tile_sha256: tileHashes, fetched_utc_date: new Date().toISOString().slice(0, 10) },
    dem: { file: "elevation.f32", sha256: manifest.layers[0].sha256, source_sha256: manifest.layers[0].source.sha256 },
    analysis: { cell_m: cell, grid: [w, h], window_bounds_xy_m: [xmin, ymin, xmax, ymax], max_shift_m: MAX_SHIFT * cell, light_azimuths_step_deg: 15, light_altitudes_deg: [3, 8, 20, 45], valid_image_fraction: validFraction, shadow_level_excluded_below: SHADOW_LEVEL, high_pass_radius_cells: HIGH_PASS_RADIUS, method: "Normalized cross-correlation between the high-passed image (cell mean, shadows excluded) and the high-passed Lambertian shaded relief of the DEM; peak over light direction and integer shifts, parabolic sub-cell refinement." },
    whole_window: whole,
    quadrants,
    limits: [
      "Mosaico multitemporal con luz rasante: el sombreado lambertiano no modela sombras arrojadas ni cambios de iluminación entre imágenes.",
      "Estima un desfase traslacional; no mide rotación, escala ni distorsión local.",
      "No es una certificación de exactitud geodésica del mosaico ni del DEM.",
    ],
  };
  const f = (v: number) => v.toFixed(2);
  console.log(`${LAYER} · ventana: NCC máx ${f(whole.peak_ncc)} (fondo ${f(whole.background_ncc_at_search_edge)}) · desfase X ${f(whole.offset_x_m)} m, Y ${f(whole.offset_y_m)} m · luz az ${whole.light_azimuth_map_deg}° alt ${whole.light_altitude_deg}° · válido ${f(validFraction * 100)} %`);
  for (const [k, q] of Object.entries(quadrants)) console.log(`  ${k}: NCC ${f(q.peak_ncc)} · X ${f(q.offset_x_m)} m, Y ${f(q.offset_y_m)} m${q.peak_at_search_edge ? " (máximo en el borde: no concluyente)" : ""}`);
  return result;
}

const checks: Array<Awaited<ReturnType<typeof analyse>>> = [];
for (const t of TARGETS) checks.push(await analyse(t.layer, t.zoom, t.shadowLevel, t.role));
const conclusive = (c: (typeof checks)[number]) => !c.whole_window.peak_at_search_edge && c.whole_window.peak_ncc > 0.3 && c.whole_window.peak_ncc - c.whole_window.background_ncc_at_search_edge > 0.2;
writeFileSync(
  join(ROOT, "data", "derived", "coregistration.json"),
  JSON.stringify(
    {
      schema: "site-regret-coregistration/2",
      generator: "scripts/geospatial/check-coregistration.ts",
      conclusive_rule: "peak NCC > 0.3, at least 0.2 above the search-edge background, and not on the search edge",
      checks: checks.map((c) => ({ ...c, conclusive: conclusive(c) })),
    },
    null,
    2,
  ) + "\n",
  "utf8",
);
for (const c of checks) console.log(`${c.image.layer}: ${conclusive(c) ? "CONCLUYENTE" : "NO CONCLUYENTE"}`);
