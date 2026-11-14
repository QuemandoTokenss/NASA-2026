/**
 * Capa geoespacial: geometría lunar, lector WMTS, rasters derivados y
 * coherencia con el motor. Usa datos AUTÉNTICOS: el paquete, los recortes del
 * DEM PGDA78 y respuestas reales de Moon Trek guardadas como fixtures.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { HorizonChunk } from "@/lib/contract/schema";
import { chunkPath } from "@/lib/data/split";
import { horizonAt, horizonObstacle } from "@/lib/geospatial/horizon";
import {
  MOON_RADIUS_M,
  arcDistanceM,
  azimuthBetween,
  chordDistanceM,
  localBasis,
  lonLatToXY,
  rayPoint,
  stereographicScale,
  terrainElevationDeg,
  terrainHeightFromElevation,
  xyToLonLat,
} from "@/lib/geospatial/lunar";
import { gridBounds, pixelAt, profileAlong, rasterStats, sampleBilinear, sampleNearest, type RasterGrid } from "@/lib/geospatial/raster";
import { GEO_REGISTRY, TERRAIN_MANIFEST } from "@/lib/geospatial/terrain";
import { WmtsError, checkPolarStereographicGrid, imageSignature, parseWmtsCapabilities, tileForPoint, tileUrl } from "@/lib/geospatial/wmts";
import { OUT, ROOT, core, readChunk, sha256 } from "./helpers";

const C = core();
const FIX = join(ROOT, "tests", "fixtures", "trek");
const DERIVED = join(ROOT, "data", "derived", "terrain");

function grid(layer: string): RasterGrid {
  const g = TERRAIN_MANIFEST.georeferencing;
  const buf = readFileSync(join(DERIVED, `${layer}.f32`));
  return { width: g.width, height: g.height, pixelSizeM: g.pixel_size_m, xmin: g.window_bounds_xy_m[0], ymax: g.window_bounds_xy_m[3], data: new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4) };
}
const siteOf = (id: string) => C.sites.find((s) => s.id === id)!;
const ll = (id: string) => ({ lonEastDeg: siteOf(id).longitude_east_deg, latDeg: siteOf(id).latitude_deg });

describe("geometría lunar (misma convención que el motor)", () => {
  it("usa el radio lunar del paquete, no uno terrestre", () => {
    expect(MOON_RADIUS_M).toBe(1737400);
    expect(TERRAIN_MANIFEST.georeferencing.sphere_radius_m).toBe(MOON_RADIUS_M);
  });

  it("X/Y ↔ longitud/latitud reproduce las coordenadas de A y B del paquete", () => {
    for (const s of C.sites) {
      const g = xyToLonLat(s.x_m, s.y_m);
      expect(g.lonEastDeg).toBeCloseTo(s.longitude_east_deg, 9);
      expect(g.latDeg).toBeCloseTo(s.latitude_deg, 9);
      const xy = lonLatToXY(s.longitude_east_deg, s.latitude_deg);
      expect(xy.x).toBeCloseTo(s.x_m, 5);
      expect(xy.y).toBeCloseTo(s.y_m, 5);
    }
  });

  it("ida y vuelta de la proyección, incluido el cruce de longitud y el polo", () => {
    for (const [x, y] of [[-11287.5, -12167.5], [9000, -4000], [-0.001, 5], [250000, 180000], [0, -1], [0, 0]]) {
      const g = xyToLonLat(x, y);
      const back = lonLatToXY(g.lonEastDeg, g.latDeg);
      expect(back.x).toBeCloseTo(x, 5);
      expect(back.y).toBeCloseTo(y, 5);
      expect(g.lonEastDeg).toBeGreaterThanOrEqual(0);
      expect(g.lonEastDeg).toBeLessThan(360);
    }
    expect(xyToLonLat(0, 0).latDeg).toBe(-90);
  });

  it("la base local es ortonormal y dextrógira (este × norte = arriba)", () => {
    const { e, n, u } = localBasis(ll("A").lonEastDeg, ll("A").latDeg);
    const d = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(d(e, e)).toBeCloseTo(1, 12);
    expect(d(n, n)).toBeCloseTo(1, 12);
    expect(d(e, n)).toBeCloseTo(0, 12);
    expect(e[1] * n[2] - e[2] * n[1]).toBeCloseTo(u[0], 12);
    expect(e[2] * n[0] - e[0] * n[2]).toBeCloseTo(u[1], 12);
  });

  it("rayo y azimut son inversos y el azimut es periódico", () => {
    const a = { x: siteOf("A").x_m, y: siteOf("A").y_m };
    for (const az of [0, 37.25, 90, 180, 269.75, 359.75]) {
      const p = rayPoint(ll("A"), az, 1500);
      const back = azimuthBetween(a, p);
      expect(Math.min(Math.abs(back - az), 360 - Math.abs(back - az))).toBeLessThan(1e-6);
      expect(arcDistanceM(a, p)).toBeCloseTo(1500, 5);
    }
    const p0 = rayPoint(ll("A"), 0, 800);
    const p360 = rayPoint(ll("A"), 360, 800);
    expect(p360.x).toBeCloseTo(p0.x, 6);
    // En el polo sur, el norte local se aleja del polo.
    expect(Math.hypot(p0.x, p0.y)).toBeGreaterThan(Math.hypot(a.x, a.y));
  });

  it("distancias: arco sobre la esfera, cuerda 3D y escala del mapa son magnitudes distintas", () => {
    const a = siteOf("A");
    const b = siteOf("B");
    const arc = arcDistanceM({ x: a.x_m, y: a.y_m }, { x: b.x_m, y: b.y_m });
    const planar = Math.hypot(a.x_m - b.x_m, a.y_m - b.y_m);
    const k = stereographicScale(a.x_m, a.y_m);
    expect(k).toBeGreaterThan(1);
    expect(k - 1).toBeLessThan(1e-4);
    expect(planar / arc).toBeCloseTo(k, 5);
    const chord = chordDistanceM({ x: a.x_m, y: a.y_m, z: a.nominal_height_m }, { x: b.x_m, y: b.y_m, z: b.nominal_height_m });
    expect(chord).toBeGreaterThan(arc);
    expect(chord - arc).toBeLessThan(2);
    // Un cuarto de circunferencia con el radio lunar.
    expect(arcDistanceM(lonLatToXY(0, -90), lonLatToXY(0, 0))).toBeCloseTo((Math.PI / 2) * 1737400, 3);
  });

  it("elevación del terreno con curvatura y su inversa", () => {
    expect(terrainElevationDeg(0, 0, 1e-9)).toBeCloseTo(0, 6);
    // Esfera sin relieve: el horizonte queda por debajo de 0° y baja con la altura.
    expect(terrainElevationDeg(0, 2, 5000)).toBeLessThan(terrainElevationDeg(0, 0, 5000));
    for (const [z, zo, d] of [[1900, 1956.39, 800], [2500, 1958, 60000], [1200, 1966, 2.5]]) {
      expect(terrainHeightFromElevation(terrainElevationDeg(z, zo, d), zo, d)).toBeCloseTo(z, 6);
    }
  });
});

describe("WMTS de Moon Trek (documentos reales)", () => {
  const nac = parseWmtsCapabilities(readFileSync(join(FIX, "LRO_NAC_Mosaic_1mpp_SP.WMTSCapabilities.xml"), "utf8"));
  const wac = parseWmtsCapabilities(readFileSync(join(FIX, "LRO_WAC_Mosaic_SPole60_100m_v02.WMTSCapabilities.xml"), "utf8"));

  it("lee capa, estilo, formato, plantilla y matrices del documento", () => {
    expect(nac.layerId).toBe("LRO_NAC_Mosaic_1mpp_SP");
    expect(nac.style).toBe("default");
    expect(nac.format).toBe("image/png");
    expect(nac.tileMatrixSet).toBe("default028mm");
    expect(nac.matrices).toHaveLength(13);
    expect(wac.matrices).toHaveLength(6);
    expect(nac.matrices[0]).toMatchObject({ id: "0", topLeft: [-1095930, 1095930], tileWidth: 256, matrixWidth: 2, matrixHeight: 1 });
    expect(nac.matrices[12].resolution).toBeCloseTo(2.0903, 3);
    expect(nac.template.endsWith(".png")).toBe(true);
  });

  it("el CRS declarado es ambiguo y la rejilla se valida como polar en metros", () => {
    expect(nac.declaredCrs).toBe("urn:ogc:def:crs:EPSG::0");
    expect(checkPolarStereographicGrid(nac)).toEqual([]);
    expect(checkPolarStereographicGrid(wac)).toEqual([]);
    const broken = structuredClone(nac);
    broken.matrices[0].topLeft = [-180, 90];
    expect(checkPolarStereographicGrid(broken).length).toBeGreaterThan(0);
  });

  it("la tesela del sitio A coincide con la solicitada al servidor real", () => {
    const a = siteOf("A");
    const m = nac.matrices[12];
    const t = tileForPoint(m, a.x_m, a.y_m);
    expect(t).toEqual({ row: 2070, col: 2026, inside: true });
    const url = tileUrl(nac, m.id, t.row, t.col);
    expect(url).toBe(GEO_REGISTRY.assets.find((x) => x.id === "trek.sp.LRO_NAC_Mosaic_1mpp_SP")!.verification.example_tile);
    expect(imageSignature(readFileSync(join(FIX, "LRO_NAC_Mosaic_1mpp_SP.z12.r2070.c2026.png")))).toBe("png");
  });

  it("respuestas no válidas se rechazan (HTML con 200, XML sin capas, formato desconocido)", () => {
    expect(() => parseWmtsCapabilities("<html><body>503 Service Unavailable</body></html>")).toThrow(WmtsError);
    expect(() => parseWmtsCapabilities('<Capabilities version="1.0.0"><Contents></Contents></Capabilities>')).toThrow(WmtsError);
    const xml = readFileSync(join(FIX, "LRO_NAC_Mosaic_1mpp_SP.WMTSCapabilities.xml"), "utf8");
    expect(() => parseWmtsCapabilities(xml.replaceAll("image/png", "image/tiff"))).toThrow(/Formato/);
    expect(imageSignature(new TextEncoder().encode("<html>"))).toBeNull();
    expect(tileForPoint(nac.matrices[3], 5e6, 0).inside).toBe(false);
  });
});

describe("rasters derivados del DEM PGDA78 Site01", () => {
  it("cada archivo coincide con el manifiesto (tamaño y SHA-256), en origen y publicado", () => {
    for (const f of [...TERRAIN_MANIFEST.layers, TERRAIN_MANIFEST.rois]) {
      for (const dir of [DERIVED, join(OUT, "terrain")]) {
        const buf = readFileSync(join(dir, f.file));
        expect(buf.length, f.file).toBe(f.bytes);
        expect(sha256(buf), f.file).toBe(f.sha256);
      }
    }
  });

  it("los originales citados son los del pasaporte del paquete (mismo SHA-256 y tamaño)", () => {
    const passport = JSON.parse(readFileSync(join(ROOT, "data", "source", "DERIVADOS_SITE_REGRET", "datos", "pasaporte.json"), "utf8"));
    for (const a of GEO_REGISTRY.assets.filter((x) => x.sha256)) {
      const p = passport.source_assets.find((s: { url: string }) => s.url === a.url);
      expect(p, a.id).toBeTruthy();
      expect(a.sha256).toBe(p.sha256);
      expect(a.bytes).toBe(p.bytes);
    }
    for (const l of TERRAIN_MANIFEST.layers) expect(GEO_REGISTRY.assets.find((a) => a.id === l.registry_id)!.sha256).toBe(l.source.sha256);
  });

  it("la ventana coincide con el contexto 2D del paquete y cae en bordes de píxel", () => {
    const ctx = JSON.parse(readFileSync(join(ROOT, "data", "source", "DERIVADOS_SITE_REGRET", "datos", "contexto_2d.json"), "utf8"));
    expect(TERRAIN_MANIFEST.georeferencing.window_bounds_xy_m).toEqual(ctx.bounds_xy_m);
    expect(gridBounds(grid("elevation"))).toEqual(ctx.bounds_xy_m);
    expect(TERRAIN_MANIFEST.georeferencing).toMatchObject({ width: 800, height: 800, pixel_size_m: 5, source_col_offset: 1200, source_row_offset: 1200 });
  });

  it("la lectura en A y B reproduce EXACTAMENTE la altura y las capas de calidad del paquete", () => {
    const layers = { elevation: grid("elevation"), ldec: grid("lola_count"), toterr: grid("vertical_rms"), slp: grid("slope"), slperr: grid("slope_rms") };
    for (const s of C.sites) {
      expect(sampleBilinear(layers.elevation, s.x_m, s.y_m)).toBe(s.nominal_height_m);
      expect(sampleNearest(layers.elevation, s.x_m, s.y_m)).toBe(s.nominal_height_m);
      for (const k of ["ldec", "toterr", "slp", "slperr"] as const) expect(sampleBilinear(layers[k], s.x_m, s.y_m), `${s.id} ${k}`).toBe(s.values[k]);
      expect(C.horizons_index[s.id as "A" | "B"].observer_ground_height_m.nominal).toBe(s.nominal_height_m);
    }
  });

  it("estadísticas del manifiesto = recuento sobre los valores; sin nodata en la ventana", () => {
    for (const l of TERRAIN_MANIFEST.layers) {
      const st = rasterStats(grid(l.id).data);
      expect(st.min).toBe(l.stats.min);
      expect(st.max).toBe(l.stats.max);
      expect(st.nodataCount).toBe(l.stats.nodata_count);
    }
    // LDEC = 0 es «sin retornos LOLA», no elevación cero ni nodata.
    expect(rasterStats(grid("lola_count").data).min).toBe(0);
    expect(rasterStats(grid("elevation").data).min).toBeGreaterThan(1000);
  });

  it("fuera de cobertura y nodata no se convierten en ceros (lectura y perfil)", () => {
    const g = grid("elevation");
    expect(sampleNearest(g, -20000, -12000)).toBeNull();
    expect(Number.isNaN(sampleBilinear(g, -12999.9, -12000))).toBe(true);
    expect(pixelAt(g, -13000, -10000.0001)).toEqual({ col: 0, row: 0 });
    const holed: RasterGrid = { ...g, data: Float32Array.from(g.data) };
    const p = pixelAt(holed, -11000, -12000)!;
    holed.data[p.row * holed.width + p.col] = NaN;
    expect(Number.isNaN(sampleBilinear(holed, -11000, -12000))).toBe(true);
    const prof = profileAlong(holed, [{ x: -11100, y: -12000 }, { x: -8900, y: -12000 }], arcDistanceM);
    expect(prof.some((s) => s.value === null)).toBe(true);
    expect(prof.filter((s) => s.value === null).every((s) => s.value !== 0)).toBe(true);
    expect(prof[prof.length - 1].distanceM).toBeCloseTo(arcDistanceM({ x: -11100, y: -12000 }, { x: -8900, y: -12000 }), 6);
    expect(prof[prof.length - 1].value).toBeNull(); // fuera de la ventana
  });

  it("los ROI publicados contienen los centroides A (ROI 4) y B (ROI 6)", () => {
    const rois = JSON.parse(readFileSync(join(DERIVED, "rois.json"), "utf8")).rois as Array<{ roi: number; attributes: Record<string, string>; rings: number[][][] }>;
    expect(rois).toHaveLength(7);
    const inside = (x: number, y: number, ring: number[][]) => {
      let c = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    for (const s of C.sites) {
      const r = rois.find((x) => x.roi === s.roi)!;
      expect(Number(r.attributes.X)).toBe(s.x_m);
      expect(Number(r.attributes.Y)).toBe(s.y_m);
      expect(inside(s.x_m, s.y_m, r.rings[0])).toBe(true);
    }
  });
});

describe("obstáculo del horizonte: coherencia DEM ↔ motor", () => {
  it("el DEM, muestreado en el punto que el motor señala como obstáculo, reproduce su horizonte", () => {
    const g = grid("elevation");
    const [xmin, ymin, xmax, ymax] = gridBounds(g);
    let checked = 0;
    let worst = 0;
    let worstHeight = 0;
    for (const id of ["A", "B"] as const) {
      const zGround = C.horizons_index[id].observer_ground_height_m.nominal;
      for (const h of [0, 2, 10] as const) {
        const chunk = readChunk<HorizonChunk>(chunkPath.horizons(id, String(h)));
        const prof = chunk.variants.nominal;
        for (let k = 0; k < chunk.azimuth_deg.length; k++) {
          if (prof.source[k] !== 0 || prof.unknown[k]) continue;
          const o = horizonObstacle(chunk.azimuth_deg, prof, ll(id), zGround + h, chunk.azimuth_deg[k]);
          // Solo donde el obstáculo cae dentro de la ventana preparada (con margen de un píxel).
          if (o.point.x < xmin + 5 || o.point.x > xmax - 5 || o.point.y < ymin + 5 || o.point.y > ymax - 5) continue;
          // El motor guarda la altura interpolada en float32 (salida de scipy sobre un raster float32).
          const z = Math.fround(sampleBilinear(g, o.point.x, o.point.y));
          const el = terrainElevationDeg(z, zGround + h, o.distanceM);
          worst = Math.max(worst, Math.abs(el - prof.elevation_deg[k]));
          worstHeight = Math.max(worstHeight, Math.abs(o.heightM - z));
          checked++;
        }
      }
    }
    // Miles de direcciones contrastadas; el acuerdo es numérico, no aproximado.
    expect(checked).toBeGreaterThan(2000);
    console.info(`obstáculos contrastados: ${checked}; peor diferencia angular ${worst}°; peor diferencia de altura ${worstHeight} m`);
    // La altura deducida del horizonte y la del DEM coinciden dentro de la resolución float32 (~1,2e-4 m a 2 km de altura).
    expect(worstHeight).toBeLessThan(1e-4);
    expect(worst).toBeLessThan(1e-6);
  });

  it("horizonte interpolado periódico y desconocidos que contaminan la consulta", () => {
    const chunk = readChunk<HorizonChunk>(chunkPath.horizons("A", "0"));
    const prof = chunk.variants.nominal;
    expect(horizonAt(chunk.azimuth_deg, prof, 0)).toBe(prof.elevation_deg[0]);
    expect(horizonAt(chunk.azimuth_deg, prof, 360)).toBe(prof.elevation_deg[0]);
    expect(horizonAt(chunk.azimuth_deg, prof, 359.875)).toBeCloseTo((prof.elevation_deg[1439] + prof.elevation_deg[0]) / 2, 12);
    const withUnknown = { ...prof, unknown: prof.unknown.map((u, i) => (i === 10 ? true : u)) };
    expect(horizonAt(chunk.azimuth_deg, withUnknown, 2.4)).toBeNull();
    expect(horizonAt(chunk.azimuth_deg, withUnknown, 2.6)).toBeNull();
    expect(horizonAt(chunk.azimuth_deg, withUnknown, 3)).not.toBeNull();
  });

  it("si existen los originales descargados, el derivado es un subconjunto exacto y reproducible", () => {
    const raw = join(ROOT, "data", "raw", "pgda78_site01", "Site01_final_adj_5mpp_surf.tif");
    if (!existsSync(raw)) return; // los originales (205 MB) no se versionan
    const buf = readFileSync(raw);
    expect(sha256(buf)).toBe(TERRAIN_MANIFEST.layers[0].source.sha256);
    // TIFF sin compresión por filas de 3200 float32: se compara la fila central de la ventana.
    const off = buf.readUInt32LE(4);
    const n = buf.readUInt16LE(off);
    let strips = 0;
    for (let i = 0; i < n; i++) if (buf.readUInt16LE(off + 2 + 12 * i) === 273) strips = buf.readUInt32LE(off + 2 + 12 * i + 8);
    const g = grid("elevation");
    const { source_col_offset: c0, source_row_offset: r0 } = TERRAIN_MANIFEST.georeferencing;
    for (const row of [0, 400, 799]) {
      const stripOffset = buf.readUInt32LE(strips + 4 * (r0 + row));
      for (const col of [0, 123, 799]) expect(buf.readFloatLE(stripOffset + 4 * (c0 + col))).toBe(g.data[row * 800 + col]);
    }
  });
});
