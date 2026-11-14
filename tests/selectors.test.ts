/**
 * Concordancia con los hechos documentados del paquete
 * (00_LEER_PRIMERO/CONTEXTO_COMPLETO.md, «caso de demostración»).
 * Valores comparados con el JSON completo, no con textos redondeados.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HEIGHTS_M, SITE_IDS, VARIANTS, WINDOW_IDS, variantFamily } from "@/lib/contract/constants";
import { getComparison, getCriterionResult, getScenarioSeries, getScenarioSummary, getSite } from "@/lib/data/selectors";
import { CONTEXT_FIGURE, figureXY } from "@/lib/figure";
import { SOURCE, core, readChunk } from "./helpers";

const C = core();

describe("selección por tupla", () => {
  it("encuentra las 120 combinaciones sin depender del orden del array", () => {
    let n = 0;
    for (const siteId of SITE_IDS)
      for (const windowId of WINDOW_IDS)
        for (const heightM of HEIGHTS_M)
          for (const variant of VARIANTS) {
            const s = getScenarioSummary(C, { siteId, windowId, heightM, variant });
            expect(s?.site_id).toBe(siteId);
            expect(s?.variant).toBe(variant);
            n++;
          }
    expect(n).toBe(120);
  });

  it("devuelve undefined para combinaciones inexistentes (no un valor por defecto)", () => {
    expect(getScenarioSummary(C, { siteId: "A", windowId: "W1", heightM: 5 as never, variant: "nominal" })).toBeUndefined();
    expect(getComparison(C, "W3" as never, 0)).toBeUndefined();
  });

  it("las familias de superficie son 1 nominal + 4 propias + 5 publicadas", () => {
    const count = (f: string) => VARIANTS.filter((v) => variantFamily(v) === f).length;
    expect([count("nominal"), count("own"), count("published")]).toEqual([1, 4, 5]);
  });
});

describe("caso de demostración W2 · 0 m · menor racha sin Sol", () => {
  const r = getCriterionResult(C, "W2", 0, "min_longest_dark_hours")!;

  it("gana B nominalmente: A = 38 h 40 min, B = 14 h 40 min", () => {
    expect(r.nominal_winner).toBe("B");
    expect(getScenarioSummary(C, { siteId: "A", windowId: "W2", heightM: 0, variant: "nominal" })!.metrics.longest_dark_hours).toBeCloseTo(38 + 40 / 60, 12);
    expect(getScenarioSummary(C, { siteId: "B", windowId: "W2", heightM: 0, variant: "nominal" })!.metrics.longest_dark_hours).toBeCloseTo(14 + 40 / 60, 12);
  });

  it("hipótesis propias: se mantiene en 2/4, con 1 empate; peor regret 16,5 h", () => {
    const own = r.robustness.own_sensitivity;
    expect([own.same_winner_count, own.evaluated_count, own.ties]).toEqual([2, 4, 1]);
    expect(own.worst_regret_of_nominal_choice_hours).toBe(16.5);
    expect(r.cases.correlated_plus.winner).toBe("A"); // la inversión real
    expect(r.cases.bias_minus.winner).toBe("TIE");
  });

  it("clones publicados: 4/5, peor regret 528,666… h (familia separada)", () => {
    const pub = r.robustness.published_subset;
    expect([pub.same_winner_count, pub.evaluated_count]).toEqual([4, 5]);
    expect(pub.worst_regret_of_nominal_choice_hours).toBe(528.6666666666666);
  });

  it("los otros cinco pares ventana/altura son empate nominal para este criterio", () => {
    for (const w of WINDOW_IDS)
      for (const h of HEIGHTS_M) {
        if (w === "W2" && h === 0) continue;
        const res = getCriterionResult(C, w, h, "min_longest_dark_hours")!;
        expect(res.nominal_winner, `${w} ${h}`).toBe("TIE");
        expect(res.robustness.own_sensitivity.same_winner_fraction).toBeNull();
      }
  });

  it("las series del trozo corresponden a la tupla pedida", () => {
    const rows = readChunk("scenarios/W2_h0.json").rows;
    const s = getScenarioSeries(rows, "B", "published_0003")!;
    expect([s.site_id, s.window_id, s.height_m, s.variant]).toEqual(["B", "W2", 0, "published_0003"]);
  });
});

describe("figura de contexto", () => {
  it("los marcadores calculados coinciden con los círculos dibujados por el motor", () => {
    const svg = readFileSync(join(SOURCE, "DERIVADOS_SITE_REGRET", "figuras", "mapa_sitios.svg"), "utf8");
    const circles = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    expect(circles).toHaveLength(2);
    for (const [i, id] of (["A", "B"] as const).entries()) {
      const site = getSite(C, id)!;
      const p = figureXY(site.x_m, site.y_m);
      expect(p.x).toBeCloseTo(circles[i].x, 6);
      expect(p.y).toBeCloseTo(circles[i].y, 6);
    }
  });

  it("los límites de la figura coinciden con contexto_2d.json", () => {
    const ctx = JSON.parse(readFileSync(join(SOURCE, "DERIVADOS_SITE_REGRET", "datos", "contexto_2d.json"), "utf8"));
    expect(ctx.bounds_xy_m).toEqual([...CONTEXT_FIGURE.boundsXY]);
    expect(ctx.display_pixel_size_m).toBe(CONTEXT_FIGURE.displayPixelSizeM);
  });
});
