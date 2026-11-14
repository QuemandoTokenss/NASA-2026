/**
 * Malla 3D y direcciones: los vértices son muestras reales del DEM en su
 * posición física, y el horizonte consultado coincide con el que el motor
 * guardó para el Sol y la Tierra.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EphemerisSiteChunk, HorizonChunk } from "@/lib/contract/schema";
import { chunkPath } from "@/lib/data/split";
import { horizonAt, horizonObstacle } from "@/lib/geospatial/horizon";
import { MOON_RADIUS_M, terrainElevationDeg } from "@/lib/geospatial/lunar";
import { buildTerrainMesh, directionENU, localFrame, toLocal } from "@/lib/geospatial/mesh";
import type { RasterGrid } from "@/lib/geospatial/raster";
import { TERRAIN_MANIFEST } from "@/lib/geospatial/terrain";
import { ROOT, core, readChunk } from "./helpers";

const C = core();
const g0 = TERRAIN_MANIFEST.georeferencing;
const buf = readFileSync(join(ROOT, "data", "derived", "terrain", "elevation.f32"));
const grid: RasterGrid = { width: g0.width, height: g0.height, pixelSizeM: g0.pixel_size_m, xmin: g0.window_bounds_xy_m[0], ymax: g0.window_bounds_xy_m[3], data: new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4) };
const A = C.sites.find((s) => s.id === "A")!;
const frame = localFrame({ x: A.x_m, y: A.y_m }, A.nominal_height_m);

describe("malla 3D del terreno", () => {
  const mesh = buildTerrainMesh(grid, frame, 2);

  it("cada vértice es una muestra del raster, sin interpolar ni rellenar", () => {
    expect(mesh.cols).toBe(400);
    expect(mesh.rows).toBe(400);
    expect(mesh.spacingM).toBe(10);
    expect(mesh.nodataVertices).toBe(0);
    for (const [r, c] of [[0, 0], [17, 233], [399, 399], [200, 171]]) expect(mesh.heights[r * mesh.cols + c]).toBe(grid.data[r * 2 * grid.width + c * 2]);
    expect(mesh.indices.length).toBe(399 * 399 * 6);
  });

  it("la posición 3D reproduce la altura radial del vértice (geometría con curvatura)", () => {
    const P0 = frame.origin;
    for (const i of [0, 12345, 80000, 159999]) {
      const east = mesh.positions[3 * i];
      const up = mesh.positions[3 * i + 1];
      const north = -mesh.positions[3 * i + 2];
      const p = [0, 1, 2].map((k) => P0[k] + east * frame.e[k] + north * frame.n[k] + up * frame.u[k]);
      // float32 de las posiciones: precisión de centímetros a 2 km.
      expect(Math.hypot(p[0], p[1], p[2]) - MOON_RADIUS_M).toBeCloseTo(mesh.heights[i], 1);
    }
    // El propio sitio queda en el origen.
    const o = toLocal(frame, A.x_m, A.y_m, A.nominal_height_m);
    expect(Math.hypot(...o)).toBeLessThan(1e-6);
    // La superficie cae por curvatura: un punto a la misma altura a 2 km queda ~1,15 m por debajo del plano tangente.
    const far = toLocal(frame, A.x_m + 2000, A.y_m, A.nominal_height_m);
    expect(far[2]).toBeCloseTo(-(2000 ** 2) / (2 * (MOON_RADIUS_M + A.nominal_height_m)), 1);
  });

  it("los huecos del raster no generan triángulos", () => {
    const holed: RasterGrid = { ...grid, data: Float32Array.from(grid.data) };
    holed.data[100 * holed.width + 100] = NaN;
    const m = buildTerrainMesh(holed, frame, 2);
    expect(m.nodataVertices).toBe(1);
    expect(m.indices.length).toBe((399 * 399 - 4) * 6);
    expect(Array.from(m.indices).includes(50 * 400 + 50)).toBe(false);
  });

  it("la elevación de un obstáculo en la escena coincide con la del motor", () => {
    const chunk = readChunk<HorizonChunk>(chunkPath.horizons("A", "2"));
    const zo = A.nominal_height_m + 2;
    for (const az of [10, 123.5, 200, 348.75]) {
      const o = horizonObstacle(chunk.azimuth_deg, chunk.variants.nominal, { lonEastDeg: A.longitude_east_deg, latDeg: A.latitude_deg }, zo, az);
      const p = toLocal(frame, o.point.x, o.point.y, o.heightM);
      // Ángulo de la recta observador → obstáculo en el marco local = horizonte del motor.
      const el = (Math.atan2(p[2] - 2, Math.hypot(p[0], p[1])) * 180) / Math.PI;
      expect(el).toBeCloseTo(o.sampleElevationDeg, 6);
      expect(terrainElevationDeg(o.heightM, zo, o.distanceM)).toBeCloseTo(o.sampleElevationDeg, 9);
      const d = directionENU(o.sampleAzimuthDeg, o.sampleElevationDeg);
      const len = Math.hypot(p[0], p[1], p[2] - 2);
      expect(p[0] / len).toBeCloseTo(d[0], 6);
      expect(p[1] / len).toBeCloseTo(d[1], 6);
    }
  });
});

describe("Sol y Tierra frente al horizonte del motor", () => {
  it("el horizonte interpolado en el azimut del cuerpo = el que guarda el paquete (nominal)", () => {
    let worst = 0;
    let n = 0;
    for (const site of ["A", "B"] as const)
      for (const h of [0, 10] as const) {
        const hz = readChunk<HorizonChunk>(chunkPath.horizons(site, String(h)));
        const eph = readChunk<EphemerisSiteChunk>(chunkPath.ephemerisSite("W2", site, String(h)));
        for (let i = 0; i < eph.series.bodies.SUN.azimuth_deg.length; i += 7) {
          for (const [body, stored] of [[eph.series.bodies.SUN, eph.series.sun_horizon_deg], [eph.series.bodies.EARTH, eph.series.earth_horizon_deg]] as const) {
            const mine = horizonAt(hz.azimuth_deg, hz.variants.nominal, body.azimuth_deg[i]);
            expect(mine).not.toBeNull();
            worst = Math.max(worst, Math.abs(mine! - stored[i]));
            n++;
          }
        }
      }
    expect(n).toBeGreaterThan(4000);
    expect(worst).toBeLessThan(1e-9);
  });
});

describe("corregistro medido teselas ↔ DEM (resultado guardado de una ejecución real)", () => {
  const co = JSON.parse(readFileSync(join(ROOT, "data", "derived", "coregistration.json"), "utf8"));
  const by = (layer: string) => co.checks.find((c: { image: { layer: string } }) => c.image.layer === layer);

  it("usa el DEM versionado y teselas identificadas por hash", () => {
    for (const c of co.checks) {
      expect(c.dem.sha256).toBe(TERRAIN_MANIFEST.layers[0].sha256);
      expect(Object.keys(c.image.tile_sha256).length).toBe(c.image.tiles);
      for (const h of Object.values<string>(c.image.tile_sha256)) expect(h).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("la rejilla de teselas queda registrada con el DEM dentro de la tolerancia", () => {
    const c = by("Site01_final_adj_5mpp_Hillshade");
    expect(c.conclusive).toBe(true);
    expect(c.whole_window.peak_ncc).toBeGreaterThan(0.9);
    // Tolerancia justificada por las fuentes: un píxel de tesela (8,36 m) más media celda de análisis (5 m).
    const tolerance = c.image.tile_resolution_m + c.analysis.cell_m / 2;
    expect(c.whole_window.offset_m).toBeLessThan(tolerance);
    // Desfase uniforme: sin rotación ni escala apreciables en la ventana.
    for (const q of Object.values<{ offset_x_m: number; offset_y_m: number; peak_at_search_edge: boolean }>(c.quadrants)) {
      expect(q.peak_at_search_edge).toBe(false);
      expect(Math.abs(q.offset_x_m - c.whole_window.offset_x_m)).toBeLessThan(1);
      expect(Math.abs(q.offset_y_m - c.whole_window.offset_y_m)).toBeLessThan(1);
    }
  });

  it("el mosaico fotográfico se declara NO concluyente (no se fuerza un número)", () => {
    const c = by("LRO_NAC_Mosaic_1mpp_SP");
    expect(c.conclusive).toBe(false);
    expect(c.whole_window.peak_ncc).toBeLessThan(0.3);
  });
});
