/**
 * Globo lunar del Dashboard: la colocación de A/B, la textura y la ocultación tras el limbo
 * se contrastan con las coordenadas del paquete y con la proyección del mapa de la app.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLUSTER_PX, detailOpacity, isBehindMoon, isFrontSide, lrocUv, moonToScene, sceneFromLonLat, sceneFromXY, sceneToMoon, shouldCluster } from "@/lib/geospatial/globe";
import { arcDistanceM, MOON_RADIUS_M, type Vec3 } from "@/lib/geospatial/lunar";
import { core as readCore } from "./helpers";

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

describe("globo lunar · marco y textura", () => {
  it("el marco de la escena es una rotación propia del marco lunar (sin espejo)", () => {
    const x = moonToScene([1, 0, 0]);
    const y = moonToScene([0, 1, 0]);
    const z = moonToScene([0, 0, 1]);
    expect(cross(x, y)).toEqual(z);
    expect(sceneToMoon(moonToScene([0.1, 0.2, 0.3]))).toEqual([0.1, 0.2, 0.3]);
    // Cara visible hacia +z, este a la derecha (+x), norte arriba (+y).
    expect(sceneFromLonLat(0, 0)).toEqual([0, 0, 1]);
    expect(sceneFromLonLat(90, 0)[0]).toBeCloseTo(1, 12);
    expect(sceneFromLonLat(0, 90)[1]).toBeCloseTo(1, 12);
  });

  it("la textura LROC tiene 0° en el centro, −180° en la columna 0 y el norte arriba", () => {
    expect(lrocUv(0, 0)).toEqual({ u: 0.5, v: 0.5 });
    expect(lrocUv(-180, 90)).toEqual({ u: 0, v: 1 });
    expect(lrocUv(270, -90).u).toBeCloseTo(0.25, 12);
    // Tycho (348,8° E, 43,3° S): a la izquierda del centro y en la mitad sur.
    const tycho = lrocUv(348.8, -43.3);
    expect(tycho.u).toBeCloseTo(0.4689, 3);
    expect(tycho.v).toBeLessThan(0.5);
  });
});

describe("globo lunar · sitios A y B", () => {
  const core = readCore();
  const [a, b] = core.sites;

  it("X/Y del paquete → esfera coincide con la latitud y longitud del paquete", () => {
    for (const s of core.sites) {
      const fromXY = sceneFromXY(s.x_m, s.y_m);
      const fromLL = sceneFromLonLat(s.longitude_east_deg, s.latitude_deg);
      // Separación en metros sobre la superficie (cuerda): por debajo de 1 mm.
      expect(Math.hypot(fromXY[0] - fromLL[0], fromXY[1] - fromLL[1], fromXY[2] - fromLL[2]) * MOON_RADIUS_M).toBeLessThan(0.001);
    }
  });

  it("A y B están a ~648 m: la misma separación en la esfera del globo que en el mapa", () => {
    const pa = sceneFromXY(a.x_m, a.y_m);
    const pb = sceneFromXY(b.x_m, b.y_m);
    const onGlobe = Math.acos(dot(pa, pb)) * MOON_RADIUS_M;
    const onMap = arcDistanceM({ x: a.x_m, y: a.y_m }, { x: b.x_m, y: b.y_m });
    expect(onGlobe).toBeCloseTo(onMap, 3);
    expect(Math.round(onMap)).toBe(648);
  });

  it("vista del polo con 0° arriba y 90° E a la derecha: B queda arriba a la derecha de A, como en el mapa", () => {
    const up = sceneFromLonLat(0, 0);
    const right = sceneFromLonLat(90, 0);
    const pa = sceneFromXY(a.x_m, a.y_m);
    const pb = sceneFromXY(b.x_m, b.y_m);
    const d: Vec3 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const sx = dot(d, right) * MOON_RADIUS_M;
    const sy = dot(d, up) * MOON_RADIUS_M;
    // En el mapa: Δx = +485 m, Δy = +430 m (la proyección casi no deforma a 16 km del polo).
    expect(sx).toBeCloseTo(b.x_m - a.x_m, 0);
    expect(sy).toBeCloseTo(b.y_m - a.y_m, 0);
  });

  it("se agrupan como «A · B» de lejos y se separan al acercar", () => {
    expect(shouldCluster({ x: 360.9, y: 483 }, { x: 361, y: 483 })).toBe(true);
    expect(shouldCluster({ x: 325.9, y: 317.9 }, { x: 400.1, y: 252.1 })).toBe(false);
    expect(CLUSTER_PX).toBeGreaterThan(30);
  });

  it("los marcadores se ocultan detrás de la Luna", () => {
    const p = sceneFromXY(a.x_m, a.y_m);
    const cam = (dir: Vec3, d: number): Vec3 => [dir[0] * d, dir[1] * d, dir[2] * d];
    expect(isFrontSide(p, cam(sceneFromLonLat(0, -46), 3.9), 0.012)).toBe(true);
    expect(isFrontSide(p, cam(sceneFromLonLat(0, 60), 3.9), 0.012)).toBe(false); // desde el norte
    expect(isFrontSide(p, cam(p, 1.0034), 0.012)).toBe(true); // a 5,9 km sobre el sitio
    // Justo en el limbo geométrico: visible sin margen, oculto con margen.
    const limb = Math.acos(1 / 3.9) * (180 / Math.PI) - 0.2;
    expect(isFrontSide(p, cam(sceneFromLonLat(222.85, -89.45 + limb), 3.9))).toBe(true);
    expect(isFrontSide(p, cam(sceneFromLonLat(222.85, -89.45 + limb), 3.9), 0.012)).toBe(false);
  });
});

describe("globo lunar · cuerpos y detalle", () => {
  it("la Luna tapa un cuerpo lejano solo cuando queda detrás del disco", () => {
    const earth = sceneFromLonLat(0, 0);
    expect(isBehindMoon(earth, [0, 0, -4])).toBe(true); // cámara sobre la cara oculta
    expect(isBehindMoon(earth, [0, 0, 4])).toBe(false); // la Tierra queda a la espalda
    expect(isBehindMoon(earth, [3, 0, -3])).toBe(false); // asoma junto al limbo
  });

  it("cada nivel de detalle polar entra al acercarse y los activos declaran su procedencia", () => {
    expect(detailOpacity(0, 2.9)).toBe(0);
    expect(detailOpacity(0, 0.4)).toBe(1);
    expect(detailOpacity(2, 0.02)).toBe(0);
    expect(detailOpacity(2, 0.0034)).toBe(1);
    const src = JSON.parse(readFileSync(new URL("../src/assets/globe/SOURCES.json", import.meta.url), "utf8"));
    const levels = src.assets.filter((x: { level?: number }) => x.level);
    expect(levels.map((l: { level: number }) => l.level)).toEqual([1, 2, 3]);
    for (const l of levels) {
      const [xmin, ymin, xmax, ymax] = l.bounds_xy_m;
      // Los tres niveles contienen a los dos sitios.
      for (const s of readCore().sites) expect(s.x_m > xmin && s.x_m < xmax && s.y_m > ymin && s.y_m < ymax).toBe(true);
      expect(l.source.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
