/**
 * Caso demostrativo: su CONFIGURACIÓN está fijada de antemano (plan maestro:
 * W2, 0 m, minimizar la racha más larga sin Sol); todo lo demás —valores,
 * ganador, perturbación relevante y regret— se lee del paquete.
 */
import { VARIANTS, variantFamily, type Criterion, type HeightM, type SiteId, type Variant, type WindowId } from "../contract/constants";
import type { CriterionResult } from "../contract/schema";
import { outcomeOf, regretOfKeeping } from "./decision";

export const DEMO_CASE: { windowId: WindowId; heightM: HeightM; criterion: Criterion } = {
  windowId: "W2",
  heightM: 0,
  criterion: "min_longest_dark_hours",
};

export const DEMO_HASH = "#demo";

/**
 * Perturbación propia «relevante» para desafiar la elección nominal: la que
 * invierte el ganador con mayor regret; si ninguna invierte, la de mayor
 * regret. Se busca primero en la familia propia (hipótesis explícitas).
 */
export function relevantPerturbation(result: CriterionResult, keep: SiteId): Variant | null {
  const pick = (family: "own" | "published") => {
    const vs = VARIANTS.filter((v) => variantFamily(v) === family);
    const inverted = vs.filter((v) => outcomeOf(result.nominal_winner, result.cases[v].winner) === "inverted");
    const pool = inverted.length ? inverted : vs;
    let best: Variant | null = null;
    let bestRegret = -1;
    for (const v of pool) {
      const r = regretOfKeeping(result.cases[v], keep) ?? -1;
      if (r > bestRegret) {
        best = v;
        bestRegret = r;
      }
    }
    return bestRegret > 0 ? best : null;
  };
  return pick("own") ?? pick("published");
}
