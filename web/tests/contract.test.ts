import { describe, expect, it } from "vitest";
import { HEIGHTS_M, SITE_IDS, WINDOW_IDS } from "@/lib/contract/constants";
import {
  validateCore,
  validateEphemerisClock,
  validateEphemerisSite,
  validateHorizonChunk,
  validateScenarioChunk,
} from "@/lib/contract/validate";
import { chunkPath } from "@/lib/data/split";
import { clone, core, readChunk } from "./helpers";

const C = core();
const win = (id: string) => C.configuration.windows.find((w) => w.id === id)!;

describe("núcleo auténtico", () => {
  it("cumple el contrato sin errores ni avisos", () => {
    const r = validateCore(C);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("la validación devuelve el objeto original, no una copia transformada", () => {
    expect(validateCore(C).core).toBe(C);
  });
});

describe("núcleo: casos negativos", () => {
  const broken = (mutate: (c: any) => void) => {
    const c = clone(C) as any;
    mutate(c);
    return validateCore(c);
  };

  it("rechaza otra versión de esquema", () => {
    const r = broken((c) => (c.schema_version = "site-regret/0.2"));
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/schema_version/);
  });
  it("rechaza tuplas de escenario duplicadas", () => {
    const r = broken((c) => (c.scenario_summaries[1] = clone(c.scenario_summaries[0])));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/duplicada/);
  });
  it("rechaza una comparación ausente", () => {
    const r = broken((c) => c.comparisons.pop());
    expect(r.ok).toBe(false);
  });
  it("rechaza alturas no calculadas", () => {
    const r = broken((c) => (c.configuration.heights_m = [0, 2, 10, 20]));
    expect(r.ok).toBe(false);
  });
  it("rechaza un criterio con signo incoherente", () => {
    const r = broken((c) => (c.comparisons[0].criteria.max_sun_hours.maximize_sign = -1));
    expect(r.errors.join(" ")).toMatch(/maximize_sign/);
  });
  it("rechaza métricas inconsistentes (known + unknown ≠ duration)", () => {
    const r = broken((c) => (c.scenario_summaries[0].metrics.unknown_hours = 1));
    expect(r.ok).toBe(false);
  });
  it("rechaza un ganador fuera del dominio", () => {
    const r = broken((c) => (c.comparisons[0].criteria.max_sun_hours.nominal_winner = "C"));
    expect(r.ok).toBe(false);
  });
  it("rechaza que falte una superficie en los casos de un criterio", () => {
    const r = broken((c) => delete c.comparisons[0].criteria.max_sun_hours.cases.published_0005);
    expect(r.ok).toBe(false);
  });
  it("acepta robustez null (nominal en empate) sin convertirla en 0", () => {
    const rob = C.comparisons.find((c) => c.window_id === "W1" && c.height_m === 0)!.criteria.min_longest_dark_hours.robustness;
    expect(rob.own_sensitivity.same_winner_fraction).toBeNull();
    expect(validateCore(C).ok).toBe(true);
  });
});

describe("trozos de carga diferida auténticos", () => {
  it("6 trozos de escenarios: 20 filas, 4320 estados, intervalos = codificación por tramos", () => {
    for (const w of WINDOW_IDS)
      for (const h of HEIGHTS_M) {
        const r = validateScenarioChunk(readChunk(chunkPath.scenarios(w, String(h))), w, h, win(w), 10);
        expect(r.errors, `${w} ${h}`).toEqual([]);
      }
  });
  it("6 trozos de horizontes: 10 superficies × 1440 azimuts", () => {
    for (const s of SITE_IDS)
      for (const h of HEIGHTS_M) expect(validateHorizonChunk(readChunk(chunkPath.horizons(s, String(h))), s, h).errors).toEqual([]);
  });
  it("relojes y series de efemérides con 4321 muestras", () => {
    for (const w of WINDOW_IDS) {
      expect(validateEphemerisClock(readChunk(chunkPath.ephemerisClock(w)), win(w)).errors).toEqual([]);
      for (const s of SITE_IDS)
        for (const h of HEIGHTS_M) expect(validateEphemerisSite(readChunk(chunkPath.ephemerisSite(w, s, String(h)))).errors).toEqual([]);
    }
  });
});

describe("trozos: casos negativos", () => {
  const chunk = () => clone(readChunk(chunkPath.scenarios("W2", "0")));
  it("detecta un código de estado inválido", () => {
    const c = chunk();
    c.rows[0].state_codes[5] = 7;
    expect(validateScenarioChunk(c, "W2", 0, win("W2"), 10).ok).toBe(false);
  });
  it("detecta intervalos que no coinciden con state_codes", () => {
    const c = chunk();
    const i = c.rows[0].state_codes.length - 1;
    c.rows[0].state_codes[i] = (c.rows[0].state_codes[i] + 1) % 4;
    expect(validateScenarioChunk(c, "W2", 0, win("W2"), 10).ok).toBe(false);
  });
  it("detecta un trozo servido con otra altura", () => {
    expect(validateScenarioChunk(chunk(), "W2", 2, win("W2"), 10).ok).toBe(false);
  });
  it("detecta un horizonte truncado", () => {
    const h = clone(readChunk(chunkPath.horizons("A", "0")));
    h.variants.nominal.elevation_deg.pop();
    expect(validateHorizonChunk(h, "A", 0).ok).toBe(false);
  });
});
