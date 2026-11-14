import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { categorizeCheck, type CheckRow } from "@/lib/science/evidence";
import { SOURCE, core } from "./helpers";

const V = join(SOURCE, "DERIVADOS_SITE_REGRET", "validacion");
const checks: CheckRow[] = JSON.parse(readFileSync(join(V, "pruebas.json"), "utf8"));

describe("evidencias de la ejecución", () => {
  it("414 comprobaciones, todas superadas, coherentes con el pasaporte", () => {
    const p = core().provenance.validation;
    expect(checks).toHaveLength(p.passed + p.failed);
    expect(checks.filter((c) => c.passed)).toHaveLength(p.passed);
  });
  it("todas se clasifican en una categoría conocida con los recuentos esperados", () => {
    const n = (cat: string) => checks.filter((c) => categorizeCheck(c.name) === cat).length;
    expect(n("other")).toBe(0);
    expect([n("frames"), n("analytic"), n("time"), n("height"), n("bounds"), n("regret")]).toEqual([8, 4, 2, 40, 120, 240]);
  });
  it("el contraste con Horizons tiene 8 filas y su máximo coincide con el pasaporte", () => {
    const rows = JSON.parse(readFileSync(join(V, "contraste_horizons.json"), "utf8")) as Array<{ delta_az_deg: number; delta_el_deg: number }>;
    const p = core().provenance.validation;
    expect(rows).toHaveLength(p.horizons_reference_rows);
    expect(Math.max(...rows.map((r) => Math.abs(r.delta_az_deg)))).toBeCloseTo(p.max_horizons_az_delta_deg, 15);
    expect(Math.max(...rows.map((r) => Math.abs(r.delta_el_deg)))).toBeCloseTo(p.max_horizons_el_delta_deg, 15);
  });
});
