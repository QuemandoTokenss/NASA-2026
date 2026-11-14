/**
 * Coherencia interna del paquete y de la capa de presentación científica.
 * Si alguna falla, la interfaz estaría contando una historia distinta del motor.
 */
import { describe, expect, it } from "vitest";
import { CRITERIA, HEIGHTS_M, WINDOW_IDS } from "@/lib/contract/constants";
import type { ScenarioChunk } from "@/lib/contract/schema";
import { getCriterionResult, getScenarioSummary } from "@/lib/data/selectors";
import { chunkPath } from "@/lib/data/split";
import { advantage, familyCounts, outcomeOf, regretOfKeeping } from "@/lib/science/decision";
import { CRITERION_METRIC } from "@/lib/science/metrics";
import { countStates, indexIntervals, intervalAt, longestHiddenRun, samplesToHours, sunVisible, earthVisible } from "@/lib/science/states";
import { core, readChunk } from "./helpers";

const C = core();
const chunks = new Map<string, ScenarioChunk>();
for (const w of WINDOW_IDS) for (const h of HEIGHTS_M) chunks.set(`${w}|${h}`, readChunk(chunkPath.scenarios(w, String(h))));

const longestRun = (codes: number[], visible: (c: number) => boolean) => {
  const r = longestHiddenRun(codes, visible);
  return r ? r.end - r.start : 0;
};

describe("métricas = estados (120 escenarios)", () => {
  it("horas con Sol/Tierra/ambos/desconocido y rachas se reproducen desde state_codes", () => {
    let checked = 0;
    for (const [, chunk] of chunks)
      for (const row of chunk.rows) {
        const m = getScenarioSummary(C, { siteId: row.site_id, windowId: row.window_id, heightM: row.height_m, variant: row.variant })!.metrics;
        const n = countStates(row.state_codes);
        expect(samplesToHours(n[1] + n[3])).toBeCloseTo(m.sun_hours, 9);
        expect(samplesToHours(n[2] + n[3])).toBeCloseTo(m.dte_center_hours, 9);
        expect(samplesToHours(n[3])).toBeCloseTo(m.joint_hours, 9);
        expect(samplesToHours(n[4])).toBeCloseTo(m.unknown_hours, 9);
        expect(samplesToHours(longestRun(row.state_codes, sunVisible))).toBeCloseTo(m.longest_dark_hours, 9);
        expect(samplesToHours(longestRun(row.state_codes, earthVisible))).toBeCloseTo(m.longest_no_earth_hours, 9);
        checked++;
      }
    expect(checked).toBe(120);
  });

  it("el paquete no contiene estados UNKNOWN (y la UI no los convierte en sombra)", () => {
    for (const [, chunk] of chunks) for (const row of chunk.rows) expect(countStates(row.state_codes)[4]).toBe(0);
  });

  it("intervalAt localiza el intervalo de cualquier índice", () => {
    const row = chunks.get("W2|0")!.rows.find((r) => r.site_id === "A" && r.variant === "nominal")!;
    const list = indexIntervals("2026-12-14T00:00:00Z", row.intervals);
    for (const i of [0, 1, 777, 2500, 4319]) {
      const iv = intervalAt(list, i)!;
      expect(iv.startIndex).toBeLessThanOrEqual(i);
      expect(iv.endIndex).toBeGreaterThan(i);
      expect(["NEITHER", "SUN_ONLY", "EARTH_ONLY", "BOTH", "UNKNOWN"][row.state_codes[i]]).toBe(iv.state);
    }
    expect(intervalAt(list, 4320)).toBeUndefined();
  });
});

describe("decisiones y regret (6 comparaciones × 4 criterios)", () => {
  it("cada criterio usa la métrica esperada", () => {
    for (const w of WINDOW_IDS) for (const h of HEIGHTS_M) for (const c of CRITERIA) expect(getCriterionResult(C, w, h, c)!.metric).toBe(CRITERION_METRIC[c]);
  });

  it("los recuentos por familia coinciden con robustness del motor", () => {
    for (const w of WINDOW_IDS)
      for (const h of HEIGHTS_M)
        for (const c of CRITERIA) {
          const r = getCriterionResult(C, w, h, c)!;
          for (const [fam, key] of [
            ["own", "own_sensitivity"],
            ["published", "published_subset"],
          ] as const) {
            const counts = familyCounts(r, fam);
            const rob = r.robustness[key];
            expect(counts.evaluated).toBe(rob.evaluated_count);
            expect(counts.tie).toBe(rob.ties);
            if (r.nominal_winner === "A" || r.nominal_winner === "B") {
              expect(counts.same).toBe(rob.same_winner_count);
              expect(counts.same / counts.evaluated).toBeCloseTo(rob.same_winner_fraction!, 12);
              const worst = Math.max(...counts.variants.map((v) => regretOfKeeping(r.cases[v], r.nominal_winner as "A" | "B")!));
              expect(worst).toBe(rob.worst_regret_of_nominal_choice_hours);
            } else {
              expect(rob.same_winner_count).toBeNull();
              expect(rob.worst_regret_of_nominal_choice_hours).toBeNull();
            }
          }
        }
  });

  it("D = U_A − U_B y el regret es no negativo y nulo para el ganador", () => {
    for (const w of WINDOW_IDS)
      for (const h of HEIGHTS_M)
        for (const c of CRITERIA)
          for (const cs of Object.values(getCriterionResult(C, w, h, c)!.cases)) {
            expect(cs.D_hours).toBeCloseTo(cs.utility_A! - cs.utility_B!, 9);
            expect(cs.regret_A_hours!).toBeGreaterThanOrEqual(0);
            expect(cs.regret_B_hours!).toBeGreaterThanOrEqual(0);
            if (cs.winner === "A") expect(cs.regret_A_hours).toBe(0);
            if (cs.winner === "B") expect(cs.regret_B_hours).toBe(0);
            if (cs.winner === "TIE") expect(Math.abs(cs.D_hours!)).toBeLessThanOrEqual(1 / 6 + 1e-12);
            const adv = advantage(cs);
            if (cs.winner === "A" || cs.winner === "B") expect(adv.favored).toBe(cs.winner);
          }
  });

  it("caso estrella: correlated_plus invierte la elección B y conservar B cuesta 16,5 h", () => {
    const r = getCriterionResult(C, "W2", 0, "min_longest_dark_hours")!;
    expect(outcomeOf(r.nominal_winner, r.cases.correlated_plus.winner)).toBe("inverted");
    expect(regretOfKeeping(r.cases.correlated_plus, "B")).toBe(16.5);
    expect(outcomeOf(r.nominal_winner, r.cases.bias_minus.winner)).toBe("tie");
    expect(outcomeOf("TIE", "A")).toBe("not_applicable");
  });
});
