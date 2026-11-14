/**
 * Relieve regional de Engineer (PGDA 90, 80 m y 240 m) por bloques y niveles de detalle.
 * Estas pruebas usan SOLO los bloques versionados (`data/derived/terrain-regional/v1/`),
 * el paquete original y el paquete de alturas de Engineer: no necesitan los GeoTIFF.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { horizonObstacle } from "@/lib/geospatial/horizon";
import { MOON_RADIUS_M, arcDistanceM, azimuthBetween, rayPoint, terrainElevationDeg } from "@/lib/geospatial/lunar";
import { localFrame, toLocal } from "@/lib/geospatial/mesh";
import {
  ENGINE_LOCAL_REGION_BOUNDS,
  REGIONAL_MANIFEST,
  blockAt,
  blockBounds,
  blockForObstacle,
  blocksAlongRay,
  blocksWithinRadius,
  buildRegionalMesh,
  coverageAt,
  coverageOutline,
  decodeRegionalBlock,
  inEngineLocalRegion,
  raySegments,
  regionalBlock,
  regionalBlocks,
  regionalLevel,
  sampleRegional,
  sampleRegionalGrid,
  type RegionalBlockEntry,
  type RegionalGrid,
} from "@/lib/geospatial/regional";
import { TERRAIN_BOUNDS } from "@/lib/geospatial/terrain";
import { ROOT, SOURCE, originalPackage, sha256 } from "./helpers";

const DIR = join(ROOT, "data", "derived", "terrain-regional", "v1");
const HEIGHTS = join(ROOT, "data", "derived", "engineer-heights", "v1");
const N_AZ = 1440;
const DEG = 180 / Math.PI;

const grids = new Map<string, RegionalGrid>();
function grid(entry: RegionalBlockEntry): RegionalGrid {
  let g = grids.get(entry.id);
  if (!g) {
    const b = readFileSync(join(DIR, `${entry.id}.i16`));
    g = decodeRegionalBlock(entry, b.buffer.slice(b.byteOffset, b.byteOffset + b.length) as ArrayBuffer);
    grids.set(entry.id, g);
  }
  return g;
}

interface Site {
  id: "A" | "B";
  x_m: number;
  y_m: number;
  longitude_east_deg: number;
  latitude_deg: number;
}
const pkg = originalPackage();
const sites = pkg.sites as Site[];
const lonLat = (s: Site) => ({ lonEastDeg: s.longitude_east_deg, latDeg: s.latitude_deg });

/** Horizonte nominal del paquete de alturas de Engineer (binario descrito en su manifiesto). */
function heightHorizon(site: string, k: number) {
  const b = readFileSync(join(HEIGHTS, "horizons", `${site}_k${String(k).padStart(3, "0")}.bin`));
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.length) as ArrayBuffer;
  return {
    elevation_deg: Array.from(new Float64Array(ab, 0, N_AZ)),
    distance_m: Array.from(new Float32Array(ab, 8 * N_AZ, N_AZ)),
    source: Array.from(new Uint8Array(ab, 12 * N_AZ, N_AZ)),
    unknown: Array.from(new Uint8Array(ab, 13 * N_AZ, N_AZ), (v) => v === 1),
  };
}

interface Profile {
  elevation_deg: number[];
  distance_m: number[];
  source: number[];
}
/** Todos los horizontes disponibles: paquete v0.1 (10 superficies × 0/2/10 m) y alturas de Engineer (nominal, 61 alturas). */
function* allProfiles(): Generator<{ site: Site; label: string; observerZ: number; profile: Profile }> {
  for (const site of sites) {
    const h = pkg.horizons[site.id];
    for (const [variant, byHeight] of Object.entries(h.variants as Record<string, Record<string, Profile>>))
      for (const [hk, profile] of Object.entries(byHeight)) yield { site, label: `v0.1 ${variant} ${hk} m`, observerZ: h.observer_ground_height_m[variant] + Number(hk), profile };
    for (let k = 0; k <= 60; k++) yield { site, label: `alturas nominal ${k / 2} m`, observerZ: h.observer_ground_height_m.nominal + k / 2, profile: heightHorizon(site.id, k) };
  }
}

describe("pirámide regional: manifiesto y archivos", () => {
  const m = REGIONAL_MANIFEST;

  it("declara esquema, codificación y niveles esperados", () => {
    expect(m.schema).toBe("site-regret-terrain-regional/1");
    expect(m.encoding).toMatchObject({ dtype: "int16-le", scale_m: 0.25, nodata: -32768, block_cells: 128 });
    expect(m.encoding.max_quantization_error_m).toBeLessThanOrEqual(0.125);
    expect(m.levels.map((l) => `${l.id}:${l.spacing_m}`)).toEqual(["L0:80", "L1:320", "L2:1280", "N240:240", "F:3840"]);
    expect(m.georeferencing.sphere_radius_m).toBe(MOON_RADIUS_M);
    // El generador registrado es el script actual (finales de línea normalizados).
    const script = readFileSync(join(ROOT, "scripts", "geospatial", "build-regional.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(m.generator_sha256).toBe(sha256(script));
  });

  it("los originales declarados son los del pasaporte del paquete (URL, bytes y SHA-256)", () => {
    const passport = JSON.parse(readFileSync(join(SOURCE, "DERIVADOS_SITE_REGRET", "datos", "pasaporte.json"), "utf8")) as { source_assets: Array<{ id: string; url: string; bytes: number; sha256: string }> };
    expect(m.sources.map((s) => s.passport_id)).toEqual(["DEM_REGIONAL_80M", "DEM_LEJANO_240M"]);
    for (const s of m.sources) {
      const p = passport.source_assets.find((a) => a.id === s.passport_id)!;
      expect({ url: s.url, bytes: s.bytes, sha256: s.sha256 }).toEqual({ url: p.url, bytes: p.bytes, sha256: p.sha256 });
      expect(s.stats.nodata_count).toBe(0);
    }
  });

  it("cada bloque del manifiesto existe con sus bytes y su SHA-256, y no sobra ningún archivo", () => {
    let total = 0;
    for (const b of m.blocks) {
      const buf = readFileSync(join(DIR, `${b.id}.i16`));
      expect(buf.length, b.id).toBe(b.bytes);
      expect(buf.length).toBe(b.cols * b.rows * 2);
      expect(sha256(buf), b.id).toBe(b.sha256);
      total += buf.length;
    }
    expect(total).toBe(m.total_bytes);
    expect(total).toBeLessThan(25e6); // presupuesto del relevo
    expect(Math.max(...m.blocks.map((b) => b.bytes))).toBeLessThanOrEqual(400e3);
    const onDisk = m.levels.flatMap((l) => (l.block_count ? readdirSync(join(DIR, l.id)).map((f) => `${l.id}/${f.replace(/\.i16$/, "")}`) : []));
    expect(onDisk.sort()).toEqual(m.blocks.map((b) => b.id).sort());
    for (const l of m.levels) expect(regionalBlocks(l.id)).toHaveLength(l.block_count);
  });

  it("los valores decodificados respetan min/max del manifiesto y no hay ceros de relleno", () => {
    for (const b of m.blocks) {
      const g = grid(b);
      let min = Infinity;
      let max = -Infinity;
      let nan = 0;
      for (const v of g.heights) {
        if (Number.isNaN(v)) nan++;
        else {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      }
      expect(nan / g.heights.length).toBe(b.nodata_fraction);
      expect(Math.abs(min - b.min_m)).toBeLessThanOrEqual(0.125);
      expect(Math.abs(max - b.max_m)).toBeLessThanOrEqual(0.125);
    }
  });
});

describe("pirámide regional: sin costuras", () => {
  it("los bordes compartidos entre bloques vecinos son idénticos", () => {
    let checked = 0;
    for (const b of REGIONAL_MANIFEST.blocks) {
      const me = grid(b);
      const east = regionalBlock(`${b.level}/${b.bx + 1}_${b.by}`);
      if (east) {
        const o = grid(east);
        for (let r = 0; r < Math.min(me.rows, o.rows); r++, checked++) if (!Object.is(me.heights[r * me.cols + me.cols - 1], o.heights[r * o.cols])) throw new Error(`costura ${b.id} | ${east.id} fila ${r}`);
        expect(blockBounds(b)[2]).toBe(blockBounds(east)[0]);
      }
      const south = regionalBlock(`${b.level}/${b.bx}_${b.by + 1}`);
      if (south) {
        const o = grid(south);
        for (let c = 0; c < Math.min(me.cols, o.cols); c++, checked++) if (!Object.is(me.heights[(me.rows - 1) * me.cols + c], o.heights[c])) throw new Error(`costura ${b.id} | ${south.id} columna ${c}`);
        expect(blockBounds(b)[1]).toBe(blockBounds(south)[3]);
      }
    }
    expect(checked).toBe(REGIONAL_MANIFEST.validation.shared_edge_vertices_checked);
    expect(checked).toBeGreaterThan(40000);
  });

  it("los niveles están anidados: un vértice de L1 o L2 es el mismo vértice del nivel más fino", () => {
    let checked = 0;
    for (const [fine, coarse] of [["L0", "L1"], ["L1", "L2"]] as const) {
      const lf = regionalLevel(fine);
      const lc = regionalLevel(coarse);
      const k = lc.spacing_m / lf.spacing_m;
      expect(Number.isInteger(k)).toBe(true);
      for (const b of regionalBlocks(coarse)) {
        const g = grid(b);
        for (let r = 0; r < g.rows; r++)
          for (let c = 0; c < g.cols; c++) {
            const x = g.x0 + c * g.spacingM;
            const y = g.y0 - r * g.spacingM;
            const fb = blockAt(fine, x, y);
            if (!fb) continue;
            const f = grid(fb);
            const fc = (x - f.x0) / f.spacingM;
            const fr = (f.y0 - y) / f.spacingM;
            if (!Number.isInteger(fc) || !Number.isInteger(fr)) throw new Error(`vértice de ${coarse} no alineado con ${fine}`);
            if (!Object.is(f.heights[fr * f.cols + fc], g.heights[r * g.cols + c])) throw new Error(`${b.id} (${c},${r}) ≠ ${fb.id}`);
            checked++;
          }
      }
    }
    expect(checked).toBeGreaterThan(100000);
  });

  it("el nivel lejano (240 m) cae sobre vértices de la visión general de 80 m", () => {
    const f = regionalLevel("F");
    const l2 = regionalLevel("L2");
    expect(Number.isInteger((f.x0_m - l2.x0_m) / l2.spacing_m)).toBe(true);
    expect(Number.isInteger((l2.y0_m - f.y0_m) / l2.spacing_m)).toBe(true);
    expect(f.spacing_m % l2.spacing_m).toBe(0);
  });
});

describe("pirámide regional frente al motor", () => {
  it("todo horizonte fijado a más de 2 km procede del relieve regional de 80 m y su bloque nativo está publicado", () => {
    let regional = 0;
    let localMax = 0;
    for (const { site, label, profile } of allProfiles()) {
      for (let k = 0; k < N_AZ; k++) {
        if (profile.source[k] === 0) {
          localMax = Math.max(localMax, profile.distance_m[k]);
          continue;
        }
        expect(profile.source[k], `${site.id} ${label}`).toBe(1); // nunca el producto de 240 m
        regional++;
      }
    }
    expect(localMax).toBeLessThan(2000); // el DEM local solo fija horizontes cercanos (dentro del recorte de 4 km)
    expect(regional).toBe(REGIONAL_MANIFEST.validation.engine_points);
    expect(regional).toBe(178675);
  });

  it("la elevación del relieve regional en el punto del motor reproduce el horizonte del paquete (Δ ≤ 0,00095°)", () => {
    // Tolerancia por punto: 0,125 m de cuantización (+0,01 m del redondeo float32 del motor) vistos a su distancia.
    // El peor caso es el punto más cercano (8,18 km): atan(0,135 / 8180) = 0,00095°.
    let maxDelta = 0;
    let minDistance = Infinity;
    let n = 0;
    for (const { site, label, observerZ, profile } of allProfiles()) {
      const ll = lonLat(site);
      for (let k = 0; k < N_AZ; k++) {
        if (profile.source[k] === 0) continue;
        const d = profile.distance_m[k];
        const p = rayPoint(ll, k * 0.25, d);
        const block = blockForObstacle(p, profile.source[k]);
        if (!block) throw new Error(`sin bloque nativo: ${site.id} ${label} az ${k * 0.25}`);
        const z = sampleRegionalGrid(grid(block), p.x, p.y);
        const delta = Math.abs(terrainElevationDeg(z, observerZ, d) - profile.elevation_deg[k]);
        if (!(delta <= Math.atan(0.135 / d) * DEG)) throw new Error(`${site.id} ${label} az ${k * 0.25}: Δ ${delta}° a ${d} m`);
        maxDelta = Math.max(maxDelta, delta);
        minDistance = Math.min(minDistance, d);
        n++;
      }
    }
    expect(n).toBe(178675);
    expect(minDistance).toBe(8180);
    expect(maxDelta).toBeLessThan(0.00095);
    expect(maxDelta).toBeCloseTo(REGIONAL_MANIFEST.validation.max_horizon_delta_deg_blocks, 9);
  });

  /**
   * Punto que fija el horizonte hacia un cuerpo en un instante (como hace Engineer) y, si es
   * regional, altura del relieve publicado en ese punto frente a la que implica el motor.
   */
  function crest(siteId: "A" | "B", windowId: "W1" | "W2", heightKey: "0" | "2" | "10", t: number, body: "SUN" | "EARTH") {
    const site = sites.find((s) => s.id === siteId)!;
    const eph = pkg.ephemerides[windowId].sites[siteId][heightKey];
    const bodyAz = eph.bodies[body].azimuth_deg[t] as number;
    const h = pkg.horizons[siteId];
    const observerZ = h.observer_ground_height_m.nominal + Number(heightKey);
    const o = horizonObstacle(h.azimuth_deg, h.variants.nominal[heightKey], lonLat(site), observerZ, bodyAz);
    const inWindow = o.point.x >= TERRAIN_BOUNDS[0] && o.point.x <= TERRAIN_BOUNDS[2] && o.point.y >= TERRAIN_BOUNDS[1] && o.point.y <= TERRAIN_BOUNDS[3];
    const block = blockForObstacle(o.point, o.source);
    const z = block ? sampleRegionalGrid(grid(block), o.point.x, o.point.y) : NaN;
    const deltaDeg = block ? terrainElevationDeg(z, observerZ, o.distanceM) - o.sampleElevationDeg : NaN;
    return { site, o, inWindow, block, z, deltaDeg, utc: pkg.ephemerides[windowId].times_utc[t] as string, bodyAz };
  }

  it("URL de la captura «fuera» (A · W1 · 10 m · t = 3200): hacia el Sol el obstáculo es LOCAL (450 m, dentro del recorte); hacia la Tierra, regional a 134,2 km", () => {
    // El instante es el mismo en el paquete v0.1 y en el paquete de alturas de Engineer.
    const scen = readFileSync(join(HEIGHTS, "scenarios", "W1_A_k020.bin"));
    const sunAz = new Float64Array(scen.buffer.slice(scen.byteOffset, scen.byteOffset + 8 * 4321))[3200];
    const sun = crest("A", "W1", "10", 3200, "SUN");
    expect(sun.bodyAz).toBe(sunAz);
    expect(sun.utc).toBe("2026-12-06T05:20:00Z");
    expect(sun.bodyAz).toBeCloseTo(353.636, 3);
    // Mirando al Sol: relieve local a 450 m (fuente 0), dentro de la ventana de 4 × 4 km. No es un caso regional.
    expect({ source: sun.o.source, distanceM: sun.o.distanceM, inWindow: sun.inWindow, block: sun.block }).toEqual({ source: 0, distanceM: 450, inWindow: true, block: null });

    // Mirando a la Tierra en ese mismo instante: cresta regional de 80 m a 134,2 km, azimut 142,25°.
    const earth = crest("A", "W1", "10", 3200, "EARTH");
    expect(earth.o.source).toBe(1);
    expect(earth.o.sampleAzimuthDeg).toBe(142.25);
    expect(earth.o.distanceM).toBe(134200);
    expect(earth.inWindow).toBe(false);
    expect(inEngineLocalRegion(earth.o.point.x, earth.o.point.y)).toBe(false);
    expect(earth.o.point.x).toBeCloseTo(664.83, 1);
    expect(earth.o.point.y).toBeCloseTo(121549.62, 1);
    expect(earth.block?.id).toBe("L0/29_17");
    expect(earth.block?.why).toContain("horizon");
    // La altura publicada en ese punto es la que el motor implica con su ángulo y su distancia.
    expect(Math.abs(earth.z - earth.o.heightM)).toBeLessThan(0.14);
    expect(Math.abs(earth.deltaDeg)).toBeLessThan(Math.atan(0.135 / earth.o.distanceM) * DEG); // < 0,00006°
  });

  it("cresta regional hacia el Sol (A · W1 · 10 m · t = 629, 18 nov 2026 08:50 UTC): a 8,74 km, azimut 210,5°; mapa, 3D y motor coinciden", () => {
    const c = crest("A", "W1", "10", 629, "SUN");
    const A = { x: c.site.x_m, y: c.site.y_m };
    expect(c.utc).toBe("2026-11-18T08:50:00Z");
    expect(c.bodyAz).toBeCloseTo(210.58, 2);
    expect(c.o.source).toBe(1);
    expect(c.o.unknown).toBe(false);
    expect(c.o.sampleAzimuthDeg).toBe(210.5);
    expect(c.o.distanceM).toBe(8740);
    expect(c.inWindow).toBe(false); // fuera del recorte local de 4 km
    expect(inEngineLocalRegion(c.o.point.x, c.o.point.y)).toBe(false); // y fuera de la tesela local del motor
    expect(c.block?.why).toEqual(expect.arrayContaining(["horizon", "ring"]));
    const numbers = { x: c.o.point.x, y: c.o.point.y, engineHeightM: c.o.heightM, regionalHeightM: c.z, deltaDeg: c.deltaDeg, horizonDeg: c.o.sampleElevationDeg, block: c.block?.id };
    console.info("cresta regional A·W1·10 m·t=629 (Sol)", JSON.stringify(numbers));
    // Altura del relieve publicado = altura que implica el motor (ángulo + distancia), salvo la cuantización.
    expect(Math.abs(c.z - c.o.heightM)).toBeLessThan(0.14);
    expect(Math.abs(c.deltaDeg)).toBeLessThan(Math.atan(0.135 / c.o.distanceM) * DEG); // < 0,0009°
    // Mapa y 3D: el punto se localiza con el mismo azimut y el mismo arco sobre la esfera.
    expect(arcDistanceM(A, c.o.point)).toBeCloseTo(c.o.distanceM, 3);
    expect(azimuthBetween(A, c.o.point)).toBeCloseTo(c.o.sampleAzimuthDeg, 6);
    // En la malla de la escena, la cresta queda donde acaba la visual: a d·sin/cos del azimut y a la altura del motor.
    const frame = localFrame(A, pkg.horizons.A.observer_ground_height_m.nominal);
    const end = toLocal(frame, c.o.point.x, c.o.point.y, c.o.heightM);
    const onMesh = toLocal(frame, c.o.point.x, c.o.point.y, c.z);
    expect(Math.hypot(end[0] - onMesh[0], end[1] - onMesh[1], end[2] - onMesh[2])).toBeLessThan(0.14);
    // Distancia horizontal en la escena: (R + z)·sin(arco / R) = 8748,3 m (el arco de 8740 m se mide sobre la esfera de referencia).
    expect(Math.hypot(end[0], end[1])).toBeCloseTo((MOON_RADIUS_M + c.o.heightM) * Math.sin(c.o.distanceM / MOON_RADIUS_M), 3);
    expect(Math.atan2(end[0], end[1]) * DEG + 360).toBeCloseTo(c.o.sampleAzimuthDeg, 6);
    // El rayo hasta la cresta: el último tramo pisa el bloque nativo y todo el trayecto tiene relieve publicado.
    const native = raySegments(lonLat(c.site), c.o.sampleAzimuthDeg, c.o.distanceM);
    expect(native[native.length - 1].block?.id).toBe(c.block?.id);
    expect(native.every((s) => s.block)).toBe(true); // dentro del anillo nativo de 25 km
    expect(blocksAlongRay(lonLat(c.site), c.o.sampleAzimuthDeg, c.o.distanceM).map((b) => b.id)).toContain(c.block?.id);
  });

  it("un rayo largo declara dónde falta relieve nativo y siempre tiene visión general", () => {
    const earth = crest("A", "W1", "10", 3200, "EARTH");
    const native = raySegments(lonLat(earth.site), earth.o.sampleAzimuthDeg, earth.o.distanceM);
    expect(native[0].block).not.toBeNull(); // anillo cercano
    expect(native.some((s) => s.block === null)).toBe(true); // tramo intermedio sin bloques de 80 m
    expect(native[native.length - 1].block?.id).toBe(earth.block?.id); // la cresta sí está
    expect(native[0].fromM).toBe(500);
    expect(native[native.length - 1].toM).toBe(earth.o.distanceM);
    for (let i = 1; i < native.length; i++) expect(native[i].fromM).toBe(native[i - 1].toM);
    expect(raySegments(lonLat(earth.site), earth.o.sampleAzimuthDeg, earth.o.distanceM, { levels: ["L0", "L1", "L2"] }).every((s) => s.block)).toBe(true);
    expect(blocksAlongRay(lonLat(earth.site), earth.o.sampleAzimuthDeg, earth.o.distanceM, { levels: ["L1"] }).length).toBeGreaterThanOrEqual(3);
  });
});

describe("pirámide regional: cobertura y selección", () => {
  const centers = sites.map((s) => ({ x: s.x_m, y: s.y_m }));

  it("hay un anillo nativo continuo alrededor de los sitios más allá del recorte de 4 km", () => {
    const ring = REGIONAL_MANIFEST.coverage.ring_km * 1000;
    for (const s of sites)
      for (let az = 0; az < 360; az += 1)
        for (const d of [500, 2000, 5000, 10000, 20000, ring - 1]) {
          const p = rayPoint(lonLat(s), az, d);
          const c = coverageAt(p.x, p.y);
          if (c?.level.id !== "L0") throw new Error(`sin relieve nativo en ${s.id} az ${az} d ${d}`);
        }
    for (const b of blocksWithinRadius(centers, ring, "L0")) expect(b.why).toContain("ring");
    // Las cuatro esquinas del recorte local quedan dentro del relieve nativo.
    for (const [x, y] of [[TERRAIN_BOUNDS[0], TERRAIN_BOUNDS[1]], [TERRAIN_BOUNDS[2], TERRAIN_BOUNDS[1]], [TERRAIN_BOUNDS[0], TERRAIN_BOUNDS[3]], [TERRAIN_BOUNDS[2], TERRAIN_BOUNDS[3]]]) expect(blockAt("L0", x, y)).not.toBeNull();
  });

  it("elige el mejor nivel disponible: nativo, intermedio, visión general y lejano", () => {
    const A = sites[0];
    const at = (az: number, d: number) => {
      const p = rayPoint(lonLat(A), az, d);
      return coverageAt(p.x, p.y)?.level.id ?? null;
    };
    expect(at(0, 10000)).toBe("L0");
    // Hasta el radio medio siempre hay al menos L1; hasta el borde del producto de 80 m, L2; más allá, el de 240 m.
    for (let az = 0; az < 360; az += 5) {
      expect(["L0", "L1"]).toContain(at(az, 205000));
      expect(["L0", "L1", "L2"]).toContain(at(az, 285000));
      expect(at(az, 399000)).not.toBeNull();
    }
    expect(coverageAt(-360000, 0)?.level.id).toBe("F"); // fuera del producto de 80 m (±304 km)
    expect(coverageAt(-900000, 0)).toBeNull();
    expect(inEngineLocalRegion(A.x_m, A.y_m)).toBe(true);
    expect(ENGINE_LOCAL_REGION_BOUNDS).toEqual([-18997.5, -19997.5, -3002.5, -4002.5]);
  });

  it("con bloques de varios niveles cargados, el muestreo usa el más fino que tiene dato", () => {
    const p = rayPoint(lonLat(sites[0]), 40, 12000);
    const l0 = grid(blockAt("L0", p.x, p.y)!);
    const l1 = grid(blockAt("L1", p.x, p.y)!);
    const l2 = grid(blockAt("L2", p.x, p.y)!);
    expect(sampleRegional([l2, l1, l0], p.x, p.y)?.grid).toBe(l0);
    expect(sampleRegional([l2, l1], p.x, p.y)?.grid).toBe(l1);
    expect(sampleRegional([l2], p.x, p.y)?.heightM).toBe(sampleRegionalGrid(l2, p.x, p.y));
    expect(sampleRegional([l0], -900000, 0)).toBeNull();
    // En un vértice común los tres niveles dan exactamente la misma altura.
    const vx = l2.x0 + 3 * l2.spacingM;
    const vy = l2.y0 - 5 * l2.spacingM;
    const fine = blockAt("L1", vx, vy);
    if (fine) expect(sampleRegionalGrid(grid(fine), vx, vy)).toBe(sampleRegionalGrid(l2, vx, vy));
  });

  it("el contorno de la cobertura nativa encierra exactamente la unión de sus bloques", () => {
    const rings = coverageOutline("L0");
    expect(rings.length).toBeGreaterThan(0);
    let signed = 0;
    for (const ring of rings) {
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      for (let i = 0; i + 1 < ring.length; i++) signed += ring[i].x * ring[i + 1].y - ring[i + 1].x * ring[i].y;
    }
    const blocksArea = regionalBlocks("L0").reduce((a, b) => {
      const [x0, y0, x1, y1] = blockBounds(b);
      return a + (x1 - x0) * (y1 - y0);
    }, 0);
    expect(Math.abs(signed) / 2).toBeCloseTo(blocksArea, 0);
    // Cada vértice del contorno es una esquina de bloque.
    const corners = new Set(regionalBlocks("L0").flatMap((b) => { const [x0, y0, x1, y1] = blockBounds(b); return [`${x0},${y0}`, `${x1},${y0}`, `${x0},${y1}`, `${x1},${y1}`]; }));
    for (const ring of rings) for (const p of ring) expect(corners.has(`${p.x},${p.y}`)).toBe(true);
  });
});

describe("pirámide regional: malla en el marco local de la escena", () => {
  const A = sites.find((s) => s.id === "A")!;
  const ground = pkg.horizons.A.observer_ground_height_m.nominal as number;
  const frame = localFrame({ x: A.x_m, y: A.y_m }, ground);

  it("coloca cada vértice a su distancia y azimut del sitio, con la caída por curvatura", () => {
    const block = blocksWithinRadius({ x: A.x_m, y: A.y_m }, 150000, "L1").at(-1)!; // un bloque lejano
    const g = grid(block);
    const mesh = buildRegionalMesh(g, frame);
    expect(mesh.positions.length).toBe(g.cols * g.rows * 3);
    let farthest = 0;
    for (const [c, r] of [[0, 0], [g.cols - 1, 0], [40, 77], [g.cols - 1, g.rows - 1]]) {
      const i = r * g.cols + c;
      const p = { x: g.x0 + c * g.spacingM, y: g.y0 - r * g.spacingM };
      const z = g.heights[i];
      const d = arcDistanceM({ x: A.x_m, y: A.y_m }, p);
      const az = azimuthBetween({ x: A.x_m, y: A.y_m }, p) / DEG;
      const theta = d / MOON_RADIUS_M;
      const [east, up, minusNorth] = [mesh.positions[3 * i], mesh.positions[3 * i + 1], mesh.positions[3 * i + 2]];
      // Exacto: punto de la esfera elevado z, visto desde el suelo del sitio.
      expect(east).toBeCloseTo((MOON_RADIUS_M + z) * Math.sin(theta) * Math.sin(az), 0);
      expect(-minusNorth).toBeCloseTo((MOON_RADIUS_M + z) * Math.sin(theta) * Math.cos(az), 0);
      expect(up).toBeCloseTo((MOON_RADIUS_M + z) * Math.cos(theta) - (MOON_RADIUS_M + ground), 0);
      // Aproximación: (d·sin az, d·cos az) y altura relativa menos la caída d²/2R.
      expect(Math.abs(east - d * Math.sin(az))).toBeLessThan(0.004 * d);
      expect(Math.abs(-minusNorth - d * Math.cos(az))).toBeLessThan(0.004 * d);
      expect(Math.abs(up - (z - ground - (d * d) / (2 * MOON_RADIUS_M)))).toBeLessThan(0.002 * d);
      farthest = Math.max(farthest, d);
    }
    expect(farthest).toBeGreaterThan(100000);
    // A 150 km la caída por curvatura es de kilómetros: la malla no es plana.
    expect((farthest * farthest) / (2 * MOON_RADIUS_M)).toBeGreaterThan(2800);
  });

  it("submuestrea sin abrir los bordes, omite las celdas excluidas y cuelga el faldón bajo el borde", () => {
    const local = blockAt("L0", A.x_m, A.y_m)!;
    const g = grid(local);
    const full = buildRegionalMesh(g, frame);
    expect(full.indices.length).toBe((g.cols - 1) * (g.rows - 1) * 6);
    expect(full.nodataVertices).toBe(0);
    expect(full.skirtIndexStart).toBe(full.indices.length);

    const half = buildRegionalMesh(g, frame, { step: 4 });
    expect(half.cols).toBe((g.cols - 1) / 4 + 1);
    expect(half.spacingM).toBe(320);
    // Los vértices del borde submuestreado son vértices del borde completo (misma posición).
    for (let c = 0; c < half.cols; c++) for (let k = 0; k < 3; k++) expect(half.positions[3 * c + k]).toBe(full.positions[3 * (c * 4) + k]);

    // Hueco para la ventana local de 4 × 4 km: solo se quitan las celdas enteramente dentro.
    const hole = buildRegionalMesh(g, frame, { exclude: [TERRAIN_BOUNDS] });
    const [bx0, by0, bx1, by1] = blockBounds(local);
    const inside = (lo: number, hi: number, origin: number, sign: 1 | -1, n: number) => {
      let cells = 0;
      for (let i = 0; i + 1 < n; i++) {
        const a = origin + sign * i * 80;
        const b = origin + sign * (i + 1) * 80;
        if (Math.min(a, b) >= lo && Math.max(a, b) <= hi) cells++;
      }
      return cells;
    };
    const expected = inside(TERRAIN_BOUNDS[0], TERRAIN_BOUNDS[2], bx0, 1, g.cols) * inside(TERRAIN_BOUNDS[1], TERRAIN_BOUNDS[3], by1, -1, g.rows);
    expect(bx0 <= TERRAIN_BOUNDS[0] && bx1 >= TERRAIN_BOUNDS[0]).toBe(true);
    expect(by0).toBeLessThan(by1);
    expect(hole.excludedCells).toBe(expected);
    expect(hole.indices.length).toBe(full.indices.length - expected * 6);
    const touching = buildRegionalMesh(g, frame, { exclude: [TERRAIN_BOUNDS], excludeMode: "intersecting" });
    expect(touching.excludedCells).toBeGreaterThan(hole.excludedCells);

    const skirted = buildRegionalMesh(g, frame, { skirtM: 150 });
    const perimeter = 2 * (g.cols + g.rows);
    expect(skirted.positions.length).toBe((g.cols * g.rows + perimeter) * 3);
    expect(skirted.indices.length - skirted.skirtIndexStart).toBe((perimeter - 4) * 6);
    const s = skirted.skirtVertexStart; // primer vértice del faldón: bajo el vértice (0, 0)
    expect(skirted.positions[3 * s]).toBe(skirted.positions[0]);
    expect(skirted.positions[3 * s + 1]).toBeCloseTo(skirted.positions[1] - 150, 3);
    for (const i of skirted.indices) expect(Number.isFinite(skirted.positions[3 * i + 1])).toBe(true);
  });
});
