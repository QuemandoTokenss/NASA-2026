/**
 * G15 · Clones publicados del ensemble PGDA78 y diferencias con el nominal.
 * Usa los recortes AUTÉNTICOS versionados en data/derived/terrain/clones y los
 * horizontes del paquete. Solo el bloque marcado «SINTÉTICO» usa datos inventados,
 * y únicamente para comprobar el tratamiento de nodata.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VARIANTS, type SiteId } from "@/lib/contract/constants";
import type { HorizonChunk } from "@/lib/contract/schema";
import { chunkPath } from "@/lib/data/split";
import { differenceGrid, differenceStats, horizonDelta, symmetricLimit } from "@/lib/geospatial/difference";
import { horizonObstacle } from "@/lib/geospatial/horizon";
import { sampleBilinear, type RasterGrid } from "@/lib/geospatial/raster";
import { GEO_REGISTRY, TERRAIN_MANIFEST } from "@/lib/geospatial/terrain";
import { ROOT, core, readChunk, sha256 } from "./helpers";

const C = core();
const DERIVED = join(ROOT, "data", "derived", "terrain");
const G = TERRAIN_MANIFEST.georeferencing;
const members = TERRAIN_MANIFEST.ensemble!.members;

function grid(file: string): RasterGrid {
  const buf = readFileSync(join(DERIVED, file));
  return { width: G.width, height: G.height, pixelSizeM: G.pixel_size_m, xmin: G.window_bounds_xy_m[0], ymax: G.window_bounds_xy_m[3], data: new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4) };
}
const nominal = grid("elevation.f32");

describe("clones PGDA78 en el registro y el manifiesto", () => {
  it("hay exactamente los 5 clones que usa el motor (published_0001…0005)", () => {
    expect(members.map((m) => m.variant)).toEqual(VARIANTS.filter((v) => v.startsWith("published_")));
    const reg = GEO_REGISTRY.assets.filter((a) => a.kind === ("ensemble_raster" as never));
    expect(reg.map((a) => a.id)).toEqual(members.map((m) => m.registry_id));
  });

  it("cada recorte tiene el tamaño y el SHA-256 del manifiesto, y el original es el del pasaporte", () => {
    const passport = JSON.parse(readFileSync(join(ROOT, "data", "source", "DERIVADOS_SITE_REGRET", "datos", "pasaporte.json"), "utf8"));
    for (const m of members) {
      const buf = readFileSync(join(DERIVED, m.file));
      expect(buf.length, m.id).toBe(m.bytes);
      expect(sha256(buf), m.id).toBe(m.sha256);
      const p = passport.source_assets.find((s: { url: string }) => s.url === m.source.url);
      expect(p.sha256).toBe(m.source.sha256);
      expect(p.bytes).toBe(m.source.bytes);
      expect(p.id).toBe(`SITE01_CLONE_${m.variant.slice(-4)}`);
    }
  });

  it("la altura de cada clon en A y B reproduce EXACTAMENTE la del observador del paquete", () => {
    for (const m of members) {
      const g = grid(m.file);
      for (const s of C.sites) {
        const engine = C.horizons_index[s.id as SiteId].observer_ground_height_m[m.variant as (typeof VARIANTS)[number]];
        expect(sampleBilinear(g, s.x_m, s.y_m), `${m.variant} ${s.id}`).toBe(engine);
        expect(m.at_sites.find((a) => a.site_id === s.id)!.engine_observer_ground_height_m).toBe(engine);
      }
    }
    // Valores de referencia citados en el relevo.
    expect(C.horizons_index.A.observer_ground_height_m.published_0001).toBe(1956.1689453125);
    expect(C.horizons_index.A.observer_ground_height_m.published_0002).toBe(1955.880126953125);
  });

  it("los clones son DEM completos (alturas de ~2 km), no incrementos", () => {
    for (const m of members) {
      expect(m.stats.min).toBeGreaterThan(1000);
      expect(m.stats.nodata_count).toBe(0);
    }
  });

  it("las estadísticas de la diferencia del manifiesto se reproducen con la misma función", () => {
    for (const m of members) {
      const d = differenceStats(differenceGrid(grid(m.file), nominal).data);
      expect(d).toEqual(m.difference_vs_nominal);
      // Diferencias de metros, no de cientos: mismo terreno con otra realización del ensemble.
      expect(Math.abs(d.mean)).toBeLessThan(0.5);
      expect(d.rms).toBeGreaterThan(0.1);
      expect(d.rms).toBeLessThan(2);
      expect(d.abs_p99).toBeLessThanOrEqual(symmetricLimit(d));
    }
  });
});

describe("diferencias: tratamiento de nodata (SINTÉTICO, solo para esta comprobación)", () => {
  const syn = (data: number[]): RasterGrid => ({ width: 2, height: 2, pixelSizeM: 5, xmin: 0, ymax: 10, data: new Float32Array(data) });
  it("NaN en cualquiera de las dos superficies da NaN; nunca 0", () => {
    const d = differenceGrid(syn([1, NaN, 3, 4]), syn([0.5, 2, NaN, 4]));
    expect(d.data[0]).toBe(0.5);
    expect(Number.isNaN(d.data[1])).toBe(true);
    expect(Number.isNaN(d.data[2])).toBe(true);
    expect(d.data[3]).toBe(0);
    expect(differenceStats(d.data)).toMatchObject({ finite_count: 2, nodata_count: 2, min: 0, max: 0.5 });
  });
  it("rechaza rejillas distintas", () => {
    expect(() => differenceGrid(syn([1, 2, 3, 4]), { ...syn([1, 2, 3, 4]), xmin: 5 })).toThrow();
  });
});

describe("Δ horizonte variante − nominal (leído del paquete)", () => {
  const chunk = (s: SiteId, h: 0 | 2 | 10) => readChunk<HorizonChunk>(chunkPath.horizons(s, String(h)));

  it("nominal frente a sí mismo: cero en todos los azimuts conocidos", () => {
    const h = chunk("A", 0);
    const d = horizonDelta(h.variants.nominal, h.variants.nominal);
    expect(d.maxAbs).toBe(0);
    expect(d.raised + d.lowered + d.sourceChanged).toBe(0);
    expect(d.known).toBe(h.variants.nominal.unknown.filter((u) => !u).length);
  });

  it("cada Δ es la resta de las dos muestras del paquete; desconocido = null (no 0)", () => {
    for (const s of ["A", "B"] as const) {
      const h = chunk(s, 2);
      for (const v of ["published_0001", "bias_plus", "correlated_minus"] as const) {
        const d = horizonDelta(h.variants[v], h.variants.nominal);
        for (let i = 0; i < h.azimuth_deg.length; i += 37) {
          const unk = h.variants[v].unknown[i] || h.variants.nominal.unknown[i];
          expect(d.delta[i]).toBe(unk ? null : h.variants[v].elevation_deg[i] - h.variants.nominal.elevation_deg[i]);
        }
        expect(d.maxIndex).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("el obstáculo de la variante dentro de la ventana cae en un píxel con diferencia de terreno finita", () => {
    const h = chunk("A", 0);
    const site = C.sites.find((s) => s.id === "A")!;
    const ll = { lonEastDeg: site.longitude_east_deg, latDeg: site.latitude_deg };
    const m = members[0];
    const diff = differenceGrid(grid(m.file), nominal);
    const ground = C.horizons_index.A.observer_ground_height_m[m.variant as "published_0001"];
    let local = 0;
    for (let i = 0; i < h.azimuth_deg.length; i += 10) {
      const o = horizonObstacle(h.azimuth_deg, h.variants.published_0001, ll, ground, h.azimuth_deg[i]);
      if (o.unknown || o.source !== 0) continue;
      const [x0, y0, x1, y1] = G.window_bounds_xy_m;
      if (o.point.x < x0 || o.point.x > x1 || o.point.y < y0 || o.point.y > y1) continue;
      local++;
      // En el borde exacto de la ventana el bilineal no tiene 4 vecinos: se exige dato salvo en ese borde.
      const v = sampleBilinear(diff, o.point.x, o.point.y);
      const nearEdge = o.point.x - x0 < 2.5 || x1 - o.point.x < 2.5 || o.point.y - y0 < 2.5 || y1 - o.point.y < 2.5;
      if (!nearEdge) expect(Number.isFinite(v), `az ${h.azimuth_deg[i]}`).toBe(true);
    }
    expect(local).toBeGreaterThan(0);
  });
});

describe("subGrid (recortes del Comparador)", () => {
  it("copia exacta centrada en el sitio, 800 m de lado, con el valor del sitio en su píxel", async () => {
    const { subGrid } = await import("@/lib/geospatial/raster");
    for (const s of C.sites) {
      const sub = subGrid(nominal, s.x_m, s.y_m, 400);
      expect(sub.width).toBe(160);
      expect(sub.height).toBe(160);
      expect(sampleBilinear(sub, s.x_m, s.y_m)).toBe(s.nominal_height_m);
      expect(sub.data.every((v) => Number.isFinite(v))).toBe(true);
    }
  });
});
