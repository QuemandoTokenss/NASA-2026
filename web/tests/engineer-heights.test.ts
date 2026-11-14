/**
 * Paquete adicional de Engineer (alturas 0–30 m cada 0,5 m, terreno nominal).
 * Se comprueba sobre los archivos versionados (data/derived/engineer-heights/v1):
 * integridad, cobertura de las 61 alturas × 4 escenarios, igualdad EXACTA con el
 * paquete v0.1 en 0/2/10 m y coherencia física (el horizonte no sube al subir).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { heightToK, isHalfStep, kKey, kToHeight } from "@/lib/data/engineerHeights";

const PKG = join(import.meta.dirname, "..", "data", "derived", "engineer-heights", "v1");
const V01 = join(import.meta.dirname, "..", "public", "data", "site-regret", "v0.1");
const N_AZ = 1440;
const N_T = 4321;
const manifest = JSON.parse(readFileSync(join(PKG, "manifest.json"), "utf8"));
const f64 = (b: Buffer, off: number, n: number) => new Float64Array(b.buffer.slice(b.byteOffset + off, b.byteOffset + off + 8 * n));
const horizon = (s: string, k: number) => {
  const b = readFileSync(join(PKG, "horizons", `${s}_${kKey(k)}.bin`));
  return { el: f64(b, 0, N_AZ), unknown: Array.from(b.subarray(13 * N_AZ, 14 * N_AZ)), dist: new Float32Array(b.buffer.slice(b.byteOffset + 8 * N_AZ, b.byteOffset + 12 * N_AZ)) };
};

describe("índice estable de medio metro", () => {
  it("k = 2·h para las 61 posiciones y solo medios metros válidos", () => {
    expect(heightToK(19.5)).toBe(39);
    expect(kToHeight(39)).toBe(19.5);
    expect(kKey(39)).toBe("k039");
    expect(isHalfStep(19.5)).toBe(true);
    expect(isHalfStep(19.25)).toBe(false);
    expect(isHalfStep(30.5)).toBe(false);
    expect(manifest.heights.positions.map((p: { k: number; height_m: number }) => p.height_m)).toEqual(Array.from({ length: 61 }, (_, k) => k / 2));
  });
});

describe("paquete de alturas de Engineer", () => {
  it("cada archivo coincide con el SHA-256 y el tamaño del manifiesto (244 escenarios + 122 horizontes)", () => {
    const files = Object.entries(manifest.files as Record<string, { sha256: string; bytes: number }>);
    expect(manifest.scenario_count).toBe(244);
    expect(files.filter(([p]) => p.startsWith("scenarios/") && p.endsWith(".bin"))).toHaveLength(244);
    expect(files.filter(([p]) => p.startsWith("horizons/") && p.endsWith(".bin"))).toHaveLength(122);
    for (const [p, f] of files) {
      const buf = readFileSync(join(PKG, p));
      expect(buf.length, p).toBe(f.bytes);
      expect(createHash("sha256").update(buf).digest("hex"), p).toBe(f.sha256);
    }
    expect(manifest.validation.failed).toBe(0);
    expect(manifest.validation.contrast_failed).toBe(0);
  });

  it("en 0, 2 y 10 m es idéntico, bit a bit, al paquete v0.1 (horizonte, direcciones y estados)", () => {
    for (const s of ["A", "B"]) {
      for (const h of [0, 2, 10]) {
        const ref = JSON.parse(readFileSync(join(V01, "horizons", `${s}_h${h}.json`), "utf8")).variants.nominal;
        const x = horizon(s, heightToK(h));
        expect(Array.from(x.el)).toEqual(ref.elevation_deg);
        expect(Array.from(x.dist)).toEqual(ref.distance_m);
        expect(x.unknown.map((v) => v === 1)).toEqual(ref.unknown);
        for (const w of ["W1", "W2"]) {
          const b = readFileSync(join(PKG, "scenarios", `${w}_${s}_${kKey(heightToK(h))}.bin`));
          const e = JSON.parse(readFileSync(join(V01, "ephemerides", `${w}_${s}_h${h}.json`), "utf8")).series;
          expect(Array.from(f64(b, 0, N_T))).toEqual(e.bodies.SUN.azimuth_deg);
          expect(Array.from(f64(b, 3 * 8 * N_T, N_T))).toEqual(e.bodies.EARTH.elevation_deg);
          expect(Array.from(f64(b, 4 * 8 * N_T, N_T), (v) => (Number.isFinite(v) ? v : null))).toEqual(e.sun_horizon_deg);
          const rows = JSON.parse(readFileSync(join(V01, "scenarios", `${w}_h${h}.json`), "utf8")).rows;
          const row = rows.find((r: { site_id: string; variant: string }) => r.site_id === s && r.variant === "nominal");
          expect(Array.from(b.subarray(6 * 8 * N_T))).toEqual(row.state_codes);
        }
      }
    }
  });

  it("al subir el observador el horizonte nunca sube (61 alturas, A y B)", () => {
    for (const s of ["A", "B"]) {
      let prev = horizon(s, 0).el;
      for (let k = 1; k <= 60; k++) {
        const cur = horizon(s, k).el;
        let worst = -Infinity;
        for (let i = 0; i < N_AZ; i++) worst = Math.max(worst, cur[i] - prev[i]);
        expect(worst, `${s} ${kKey(k)}`).toBeLessThanOrEqual(1e-10);
        prev = cur;
      }
    }
  });

  it("en 0, 2 y 10 m coincide con el contrato en TODOS los campos: origen del horizonte, cota lejana, las seis series, intervalos, métricas y estado", () => {
    const core = JSON.parse(readFileSync(join(V01, "core.json"), "utf8"));
    const hIndex = JSON.parse(readFileSync(join(PKG, "horizons", "index.json"), "utf8"));
    const nullable = (b: Buffer, i: number) => Array.from(f64(b, i * 8 * N_T, N_T), (v) => (Number.isFinite(v) ? v : null));
    for (const s of ["A", "B"]) {
      for (const h of [0, 2, 10]) {
        const k = kKey(heightToK(h));
        const chunk = JSON.parse(readFileSync(join(V01, "horizons", `${s}_h${h}.json`), "utf8"));
        const ref = chunk.variants.nominal;
        const hb = readFileSync(join(PKG, "horizons", `${s}_${k}.bin`));
        expect(Array.from(hb.subarray(12 * N_AZ, 13 * N_AZ)), `${s} ${h} source`).toEqual(ref.source);
        expect(hIndex[s].heights[k].far_bound_deg).toBe(ref.far_bound_deg);
        expect(hIndex[s].heights[k].tail_below_sampled_horizon).toBe(ref.tail_below_sampled_horizon);
        expect(hIndex[s].observer_ground_height_m).toBe(core.horizons_index[s].observer_ground_height_m.nominal);
        for (const w of ["W1", "W2"]) {
          const b = readFileSync(join(PKG, "scenarios", `${w}_${s}_${k}.bin`));
          const e = JSON.parse(readFileSync(join(V01, "ephemerides", `${w}_${s}_h${h}.json`), "utf8")).series;
          expect(Array.from(f64(b, 1 * 8 * N_T, N_T))).toEqual(e.bodies.SUN.elevation_deg);
          expect(Array.from(f64(b, 2 * 8 * N_T, N_T))).toEqual(e.bodies.EARTH.azimuth_deg);
          expect(nullable(b, 5)).toEqual(e.earth_horizon_deg);
          const entry = JSON.parse(readFileSync(join(PKG, "scenarios", `${w}_${s}.json`), "utf8"))[k];
          const row = JSON.parse(readFileSync(join(V01, "scenarios", `${w}_h${h}.json`), "utf8")).rows.find((r: { site_id: string; variant: string }) => r.site_id === s && r.variant === "nominal");
          const summary = core.scenario_summaries.find((q: { site_id: string; window_id: string; height_m: number; variant: string }) => q.site_id === s && q.window_id === w && q.height_m === h && q.variant === "nominal");
          expect(entry.intervals, `${w} ${s} ${h} intervals`).toEqual(row.intervals);
          expect(entry.metrics, `${w} ${s} ${h} metrics`).toEqual(summary.metrics);
          expect(entry.status).toBe(summary.status);
        }
      }
    }
  });

  it("las métricas de las 244 alturas salen del recuento de sus propios estados (nada interpolado entre alturas)", () => {
    for (const w of ["W1", "W2"]) {
      for (const s of ["A", "B"]) {
        const ix = JSON.parse(readFileSync(join(PKG, "scenarios", `${w}_${s}.json`), "utf8"));
        for (let k = 0; k <= 60; k++) {
          const codes = readFileSync(join(PKG, "scenarios", `${w}_${s}_${kKey(k)}.bin`)).subarray(6 * 8 * N_T);
          expect(codes).toHaveLength(N_T - 1);
          const n = [0, 0, 0, 0, 0];
          let dark = 0;
          let run = 0;
          for (const c of codes) {
            expect(c).toBeLessThanOrEqual(4);
            n[c]++;
            run = c === 0 || c === 2 ? run + 1 : 0;
            if (run > dark) dark = run;
          }
          const m = ix[kKey(k)].metrics;
          const label = `${w} ${s} ${kKey(k)}`;
          expect(m.sun_hours, label).toBeCloseTo((n[1] + n[3]) / 6, 9);
          expect(m.dte_center_hours, label).toBeCloseTo((n[2] + n[3]) / 6, 9);
          expect(m.joint_hours, label).toBeCloseTo(n[3] / 6, 9);
          expect(m.unknown_hours, label).toBeCloseTo(n[4] / 6, 9);
          // Sin intervalos desconocidos, la racha más larga sin Sol es la de los estados.
          if (n[4] === 0) expect(m.longest_dark_hours, label).toBeCloseTo(dark / 6, 9);
        }
      }
    }
  });

  it("19,5 m tiene métricas propias del motor, con horas acotadas por la ventana", () => {
    for (const key of ["W1_A", "W1_B", "W2_A", "W2_B"]) {
      const ix = JSON.parse(readFileSync(join(PKG, "scenarios", `${key}.json`), "utf8"));
      expect(Object.keys(ix)).toHaveLength(61);
      const m = ix.k039.metrics;
      expect(ix.k039.height_m).toBe(19.5);
      expect(m.known_hours + m.unknown_hours).toBeCloseTo(720, 9);
      expect(m.joint_hours).toBeLessThanOrEqual(Math.min(m.sun_hours, m.dte_center_hours) + 1e-9);
    }
  });
});
