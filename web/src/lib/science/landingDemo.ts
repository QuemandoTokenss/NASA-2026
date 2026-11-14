/**
 * Demo interactiva «¿Dónde alunizarías?» de /historia/.
 *
 * Todo se LEE del paquete site-regret/0.1 (métricas, horas desconocidas y
 * regret del motor). El único valor nuevo es el límite ILUSTRATIVO de 24 h sin
 * Sol: no es un requisito de misión ni sale del motor; solo sirve para que la
 * demo tenga una pregunta concreta.
 */
import type { Criterion, HeightM, SiteId, Variant, WindowId } from "../contract/constants";
import { VARIANTS } from "../contract/constants";
import type { Core } from "../contract/schema";
import { getCriterionResult, getScenarioSummary } from "../data/selectors";
import { regretOfKeeping } from "./decision";

/** Límite ilustrativo de la demo (horas seguidas sin Sol que «aguanta» la misión). */
export const DEMO_LIMIT_HOURS = 24;

export const LANDING_DEMO: { windowId: WindowId; criterion: Criterion; steps: ReadonlyArray<{ variant: Variant; heightM: HeightM }> } = {
  windowId: "W2",
  criterion: "min_longest_dark_hours",
  steps: [
    { variant: "nominal", heightM: 0 },
    { variant: "correlated_plus", heightM: 0 },
    { variant: "correlated_plus", heightM: 2 },
  ],
};

export type Compliance = "meets" | "exceeds" | "unknown";

export interface SiteReading {
  site: SiteId;
  /** Racha continua más larga sin el centro del Sol sobre el horizonte (h), del motor. */
  hours: number | null;
  unknownHours: number;
  compliance: Compliance;
}

/**
 * Cumplimiento del límite ilustrativo. Si ya hay una racha conocida mayor que el
 * límite, se supera aunque haya horas desconocidas; si la racha conocida cabe pero
 * hay horas desconocidas, no se puede afirmar que se cumpla (UNKNOWN ≠ sombra ni Sol).
 */
export function complianceOf(hours: number | null, unknownHours: number, limit = DEMO_LIMIT_HOURS): Compliance {
  if (hours === null || !Number.isFinite(hours)) return "unknown";
  if (hours > limit) return "exceeds";
  return unknownHours > 0 ? "unknown" : "meets";
}

export function siteReading(core: Core, site: SiteId, step: number): SiteReading {
  const { variant, heightM } = LANDING_DEMO.steps[step];
  const m = getScenarioSummary(core, { siteId: site, windowId: LANDING_DEMO.windowId, heightM, variant })?.metrics;
  const hours = m ? m.longest_dark_hours : null;
  const unknownHours = m ? m.unknown_hours : 0;
  return { site, hours, unknownHours, compliance: complianceOf(hours, unknownHours) };
}

/** Caso del motor para el paso (ganador y regret de conservar cada sitio). */
export function stepCase(core: Core, step: number) {
  const { variant, heightM } = LANDING_DEMO.steps[step];
  const r = getCriterionResult(core, LANDING_DEMO.windowId, heightM, LANDING_DEMO.criterion);
  return r ? r.cases[variant] : undefined;
}

export function regretOfChoice(core: Core, step: number, choice: SiteId): number | null {
  const c = stepCase(core, step);
  return c ? regretOfKeeping(c, choice) : null;
}

/**
 * ¿En cuántas de las superficies evaluadas para la ventana y altura dan A y B
 * 0 h de racha sin Sol, sin horas desconocidas? Se comprueba sobre el paquete.
 */
export function zeroStreakSurfaces(core: Core, heightM: HeightM): { count: number; total: number } {
  let count = 0;
  for (const v of VARIANTS) {
    const ok = (["A", "B"] as const).every((s) => {
      const m = getScenarioSummary(core, { siteId: s, windowId: LANDING_DEMO.windowId, heightM, variant: v })?.metrics;
      return m !== undefined && m.longest_dark_hours === 0 && m.unknown_hours === 0;
    });
    if (ok) count++;
  }
  return { count, total: VARIANTS.length };
}

/** Hay periodos sin visibilidad geométrica de la Tierra en el escenario del paso. */
export function earthComesAndGoes(core: Core, site: SiteId, step: number): boolean {
  const { variant, heightM } = LANDING_DEMO.steps[step];
  const m = getScenarioSummary(core, { siteId: site, windowId: LANDING_DEMO.windowId, heightM, variant })?.metrics;
  return !!m && m.longest_no_earth_hours > 0 && m.dte_center_hours > 0;
}
