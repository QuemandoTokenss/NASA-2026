/**
 * Bloque B · vista orbital: cambio de base de las efemérides TOPOCÉNTRICAS del
 * paquete (SPICE DE421) al marco lunar. Datos auténticos del paquete.
 */
import { describe, expect, it } from "vitest";
import type { EphemerisSiteChunk } from "@/lib/contract/schema";
import { chunkPath } from "@/lib/data/split";
import { angleBetween, azElFromDirection, bodyTrack, directionFromAzEl, directionLonLat } from "@/lib/geospatial/sky";
import { core, readChunk } from "./helpers";

const C = core();
const site = (id: string) => {
  const s = C.sites.find((x) => x.id === id)!;
  return { lonEastDeg: s.longitude_east_deg, latDeg: s.latitude_deg };
};
const eph = (w: string, s: string, h: string) => readChunk<EphemerisSiteChunk>(chunkPath.ephemerisSite(w, s, h));

describe("direcciones de Sol y Tierra en el marco lunar", () => {
  it("ida y vuelta azimut/elevación ↔ vector reproduce los valores del paquete", () => {
    const e = eph("W1", "A", "0");
    for (const body of ["SUN", "EARTH"] as const) {
      const b = e.series.bodies[body];
      for (let i = 0; i < b.azimuth_deg.length; i += 97) {
        const back = azElFromDirection(site("A"), directionFromAzEl(site("A"), b.azimuth_deg[i], b.elevation_deg[i]));
        expect(back.elevationDeg).toBeCloseTo(b.elevation_deg[i], 9);
        const dAz = Math.abs(((back.azimuthDeg - b.azimuth_deg[i] + 540) % 360) - 180);
        expect(dAz).toBeLessThan(1e-7);
      }
    }
  });

  it("la Tierra queda cerca de la longitud 0° (cara visible) y dentro de la libración en latitud", () => {
    for (const w of ["W1", "W2"]) {
      const b = eph(w, "B", "2").series.bodies.EARTH;
      const t = bodyTrack(site("B"), b.azimuth_deg, b.elevation_deg);
      for (let i = 0; i < t.lonEastDeg.length; i += 11) {
        const signed = t.lonEastDeg[i] > 180 ? t.lonEastDeg[i] - 360 : t.lonEastDeg[i];
        expect(Math.abs(signed)).toBeLessThan(9); // libración en longitud ≈ ±8°
        expect(Math.abs(t.latDeg[i])).toBeLessThan(7.5); // libración en latitud ≈ ±6,7°
      }
    }
  });

  it("el Sol da una vuelta en longitud en la ventana de 30 días y su declinación lunar es < 1,6°", () => {
    const b = eph("W1", "A", "0").series.bodies.SUN;
    const t = bodyTrack(site("A"), b.azimuth_deg, b.elevation_deg);
    let swept = 0;
    for (let i = 1; i < t.lonEastDeg.length; i++) swept += ((t.lonEastDeg[i] - t.lonEastDeg[i - 1] + 540) % 360) - 180;
    // 30 días frente a un mes sinódico de 29,53 días: algo más de una vuelta, en sentido de longitud decreciente.
    expect(Math.abs(swept)).toBeGreaterThan(360);
    expect(Math.abs(swept)).toBeLessThan(380);
    for (const lat of t.latDeg) expect(Math.abs(lat)).toBeLessThan(1.6);
  });

  it("A y B ven la Tierra en la misma dirección salvo paralaje (< 0,01°)", () => {
    const a = eph("W2", "A", "0").series.bodies.EARTH;
    const b = eph("W2", "B", "0").series.bodies.EARTH;
    for (let i = 0; i < a.azimuth_deg.length; i += 200) {
      const va = directionFromAzEl(site("A"), a.azimuth_deg[i], a.elevation_deg[i]);
      const vb = directionFromAzEl(site("B"), b.azimuth_deg[i], b.elevation_deg[i]);
      expect(angleBetween(va, vb)).toBeLessThan(0.01);
    }
    expect(directionLonLat([1, 0, 0])).toEqual({ lonEastDeg: 0, latDeg: 0 });
  });
});
