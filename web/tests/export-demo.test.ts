import { describe, expect, it } from "vitest";
import { VARIANTS } from "@/lib/contract/constants";
import { getCriterionResult, getScenarioSummary } from "@/lib/data/selectors";
import { buildScenarioCsv, buildScenarioExport } from "@/lib/export";
import { DEMO_CASE, relevantPerturbation } from "@/lib/science/demo";
import { DEFAULT_SELECTION } from "@/lib/state/selection";
import { core, readManifest } from "./helpers";

const C = core();
const M = readManifest();

describe("caso demostrativo", () => {
  it("la perturbación relevante se deduce de los datos: correlated_plus", () => {
    const r = getCriterionResult(C, DEMO_CASE.windowId, DEMO_CASE.heightM, DEMO_CASE.criterion)!;
    expect(r.nominal_winner).toBe("B");
    expect(relevantPerturbation(r, "B")).toBe("correlated_plus");
  });
  it("sin inversión ni regret no propone perturbación (W1 · 2 m, empate total)", () => {
    const r = getCriterionResult(C, "W1", 2, "min_longest_dark_hours")!;
    expect(relevantPerturbation(r, "A")).toBeNull();
  });
});

describe("exportaciones", () => {
  const sel = { ...DEFAULT_SELECTION, windowId: "W2" as const, heightM: 0 as const, variant: "correlated_plus" as const, criterion: "min_longest_dark_hours" as const };

  it("JSON copia valores completos y la procedencia (hash del paquete)", () => {
    const e = buildScenarioExport(C, M, sel, "regret");
    expect(e.provenance.package.sha256).toBe(M.source.sha256);
    expect(Object.keys(e.scenarios)).toEqual([...VARIANTS]);
    const a = (e.scenarios as Record<string, Record<string, { metrics: { longest_dark_hours: number } }>>).nominal.A.metrics.longest_dark_hours;
    expect(a).toBe(getScenarioSummary(C, { siteId: "A", windowId: "W2", heightM: 0, variant: "nominal" })!.metrics.longest_dark_hours);
    expect(e.comparison?.result).toBe(getCriterionResult(C, "W2", 0, "min_longest_dark_hours"));
  });

  it("CSV incluye métricas por sitio y el regret del caso sin redondear", () => {
    const csv = buildScenarioCsv(C, M, sel, ["nominal", "correlated_plus"], sel.criterion);
    expect(csv).toContain("W2,0,correlated_plus,A,longest_dark_hours,32.5,hours");
    expect(csv).toContain("W2,0,min_longest_dark_hours,correlated_plus,A,");
    expect(csv).toMatch(/correlated_plus,A,-32\.5,-49,16\.5,0,16\.5/);
    expect(csv).toContain(M.source.sha256);
  });
});
