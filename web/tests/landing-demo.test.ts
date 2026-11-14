/**
 * Demo «¿Dónde alunizarías?»: los valores que muestra salen del paquete y los
 * estados de cumplimiento siguen la secuencia B → ninguno → ambos.
 */
import { describe, expect, it } from "vitest";
import { DEMO_LIMIT_HOURS, LANDING_DEMO, complianceOf, earthComesAndGoes, regretOfChoice, siteReading, zeroStreakSurfaces } from "@/lib/science/landingDemo";
import { core } from "./helpers";

const C = core();
const meets = (step: number) => (["A", "B"] as const).filter((s) => siteReading(C, s, step).compliance === "meets");

describe("demo de alunizaje (W2)", () => {
  it("usa W2, el criterio de racha sin Sol y los tres pasos pedidos", () => {
    expect(LANDING_DEMO.windowId).toBe("W2");
    expect(LANDING_DEMO.steps).toEqual([
      { variant: "nominal", heightM: 0 },
      { variant: "correlated_plus", heightM: 0 },
      { variant: "correlated_plus", heightM: 2 },
    ]);
    expect(DEMO_LIMIT_HOURS).toBe(24);
  });

  it("valores esperados del encargo, leídos del paquete", () => {
    expect([siteReading(C, "A", 0).hours, siteReading(C, "B", 0).hours]).toEqual([38 + 40 / 60, 14 + 40 / 60]);
    expect([siteReading(C, "A", 1).hours, siteReading(C, "B", 1).hours]).toEqual([32.5, 49]);
    expect([siteReading(C, "A", 2).hours, siteReading(C, "B", 2).hours]).toEqual([0, 0]);
  });

  it("cumplimiento: solo B → ninguno → ambos", () => {
    expect(meets(0)).toEqual(["B"]);
    expect(meets(1)).toEqual([]);
    expect(meets(2)).toEqual(["A", "B"]);
  });

  it("regret del motor: conservar B con el relieve alternativo cuesta 16 h 30 min; conservar A, nada", () => {
    expect(regretOfChoice(C, 1, "B")).toBe(16.5);
    expect(regretOfChoice(C, 1, "A")).toBe(0);
  });

  it("a 2 m, las 10 superficies evaluadas dan 0 h en A y B; la Tierra sigue apareciendo y desapareciendo", () => {
    expect(zeroStreakSurfaces(C, 2)).toEqual({ count: 10, total: 10 });
    expect(earthComesAndGoes(C, "A", 2)).toBe(true);
    expect(earthComesAndGoes(C, "B", 2)).toBe(true);
  });

  it("las horas desconocidas no se convierten en cumplimiento", () => {
    expect(complianceOf(10, 0)).toBe("meets");
    expect(complianceOf(10, 0.5)).toBe("unknown");
    expect(complianceOf(30, 5)).toBe("exceeds");
    expect(complianceOf(null, 0)).toBe("unknown");
  });
});
