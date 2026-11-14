/**
 * Lectura de decisiones y REGRET del contrato. Todo se CONSUME de
 * `comparisons[].criteria[C]`: ganadores, D_hours y regret_*_hours ya vienen
 * calculados por el motor. Aquí solo se clasifican y agrupan para la interfaz.
 */
import { VARIANTS, variantFamily, type SiteId, type Variant, type VariantFamily, type Winner } from "../contract/constants";
import type { CaseResult, CriterionResult } from "../contract/schema";

export type Outcome = "same" | "tie" | "inverted" | "unknown" | "not_applicable";

/** Relación entre el ganador de una superficie y la elección nominal. */
export function outcomeOf(nominalWinner: Winner, caseWinner: Winner): Outcome {
  if (nominalWinner !== "A" && nominalWinner !== "B") return "not_applicable";
  if (caseWinner === "TIE") return "tie";
  if (caseWinner === "UNKNOWN") return "unknown";
  return caseWinner === nominalWinner ? "same" : "inverted";
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  same: "Se mantiene",
  tie: "Empate",
  inverted: "Se invierte",
  unknown: "No determinable",
  not_applicable: "Sin elección nominal",
};

export interface FamilyCounts {
  family: Exclude<VariantFamily, "nominal">;
  variants: Variant[];
  evaluated: number;
  same: number;
  tie: number;
  inverted: number;
  unknown: number;
}

/** Recuento por familia a partir de los casos (se contrasta con `robustness` en los tests). */
export function familyCounts(result: CriterionResult, family: Exclude<VariantFamily, "nominal">): FamilyCounts {
  const variants = VARIANTS.filter((v) => variantFamily(v) === family);
  const c: FamilyCounts = { family, variants, evaluated: 0, same: 0, tie: 0, inverted: 0, unknown: 0 };
  for (const v of variants) {
    const w = result.cases[v].winner;
    c.evaluated++;
    // Empates y desconocidos se cuentan siempre (como `robustness.ties` del motor);
    // mantener/invertir solo tiene sentido si la elección nominal es A o B.
    if (w === "TIE") c.tie++;
    else if (w === "UNKNOWN") c.unknown++;
    else {
      const o = outcomeOf(result.nominal_winner, w);
      if (o === "same") c.same++;
      else if (o === "inverted") c.inverted++;
    }
  }
  return c;
}

/** Regret (horas de la métrica del criterio) de conservar `choice` con la superficie del caso. */
export function regretOfKeeping(c: CaseResult, choice: SiteId): number | null {
  return choice === "A" ? c.regret_A_hours : c.regret_B_hours;
}

/** Ventaja con signo del contrato: D = U_A − U_B (positivo favorece a A). */
export function advantage(c: CaseResult): { favored: SiteId | null; hours: number | null } {
  if (c.D_hours === null) return { favored: null, hours: null };
  if (c.winner === "TIE") return { favored: null, hours: Math.abs(c.D_hours) };
  return { favored: c.D_hours > 0 ? "A" : c.D_hours < 0 ? "B" : null, hours: Math.abs(c.D_hours) };
}

export function otherSite(s: SiteId): SiteId {
  return s === "A" ? "B" : "A";
}
