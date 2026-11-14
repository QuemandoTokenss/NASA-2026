/**
 * Mapa fotográfico de «Presentar»: el encuadre y las posiciones de A y B del metadato del ZIP
 * coinciden con las X/Y del paquete, y las imágenes versionadas son las declaradas.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ridgeFraction } from "@/components/story/RidgePhotoMap";
import { core, ROOT, sha256 } from "./helpers";

const DIR = join(ROOT, "src", "assets", "presentar");
const META = JSON.parse(readFileSync(join(DIR, "connecting-ridge-metadata.json"), "utf8"));
const SOURCES = JSON.parse(readFileSync(join(DIR, "SOURCES.json"), "utf8"));

describe("Presentar · mapa fotográfico de Connecting Ridge", () => {
  it("encuadre 1440 × 900 con la misma escala en X e Y", () => {
    const [x0, y0, x1, y1] = META.map.bounds_xy_m;
    expect([META.map.width, META.map.height]).toEqual([1440, 900]);
    expect((x1 - x0) / 1440).toBeCloseTo(META.map.raster_metres_per_output_pixel, 9);
    expect((y1 - y0) / 900).toBeCloseTo(META.map.raster_metres_per_output_pixel, 9);
    expect(200 / META.map.raster_metres_per_output_pixel).toBeCloseTo(META.map.scale_bar_200m_px, 6);
  });

  it("A y B del metadato son los sitios del paquete y caen en sus píxeles", () => {
    for (const s of core().sites) {
      const m = META.sites.find((x: { id: string }) => x.id === s.id);
      expect([m.x_m, m.y_m, m.roi]).toEqual([s.x_m, s.y_m, s.roi]);
      const { fx, fy } = ridgeFraction(s.x_m, s.y_m);
      expect(fx).toBeCloseTo(m.fraction_xy[0], 9);
      expect(fy).toBeCloseTo(m.fraction_xy[1], 9);
      expect(fx * 1440).toBeCloseTo(m.pixel_xy[0], 6);
      expect(fy * 900).toBeCloseTo(m.pixel_xy[1], 6);
    }
  });

  it("imágenes versionadas = hashes declarados; el relieve procede del DEM local versionado", () => {
    for (const a of SOURCES.assets) expect(sha256(readFileSync(join(DIR, a.file)))).toBe(a.sha256);
    const terrain = JSON.parse(readFileSync(join(ROOT, "data", "derived", "terrain", "manifest.json"), "utf8"));
    const elevation = terrain.layers.find((l: { id: string }) => l.id === "elevation");
    expect(META.sources.relief.input_sha256).toBe(elevation.sha256);
  });
});
