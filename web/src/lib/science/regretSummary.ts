/**
 * Lectura del resultado de Regret Lab para la interfaz. TODO se consume del
 * contrato `site-regret/0.1` (ganadores, D y métricas del motor); aquí solo se
 * CLASIFICA el tipo de resultado para no confundir un empate válido a 0 h con
 * ausencia de datos o con un resultado no determinable.
 */
import { CRITERIA, HEIGHTS_M, type Criterion, type HeightM, type WindowId, type Winner } from "../contract/constants";
import type { Core, CriterionResult } from "../contract/schema";
import { getCriterionResult, getScenarioSummary } from "../data/selectors";
import { CRITERION_METRIC } from "./metrics";

/**
 * Tipo de resultado nominal de un criterio:
 *  - `decisive`: gana A o B (|D| > tolerancia).
 *  - `tie_no_dark`: racha sin Sol 0 h en ambos sitios y 0 h desconocidas → no se detectó oscuridad.
 *  - `tie_full`: ambos sitios cumplen la métrica toda la ventana (p. ej. 720 h con Sol de 720).
 *  - `tie_none`: ambos sitios dan 0 h en una métrica de «más es mejor» (nunca ven el cuerpo).
 *  - `tie`: empate dentro de la tolerancia con valores intermedios.
 *  - `unknown`: el motor no decide porque hay horas sin estado determinable.
 */
export type ResultKind = "decisive" | "tie_no_dark" | "tie_full" | "tie_none" | "tie" | "unknown";

export interface CriterionSnapshot {
  criterion: Criterion;
  metric: string;
  a: number | null;
  b: number | null;
  winner: Winner;
  /** |D| en horas del criterio (null si UNKNOWN). */
  absD: number | null;
  duration: number;
  unknownHours: number;
  kind: ResultKind;
}

const EPS = 1e-9;

export function resultKind(result: CriterionResult, a: number | null, b: number | null, duration: number, unknownHours: number): ResultKind {
  const w = result.nominal_winner;
  if (w === "UNKNOWN" || unknownHours > 0 || a === null || b === null) return "unknown";
  if (w === "A" || w === "B") return "decisive";
  if (result.metric === "longest_dark_hours" && Math.abs(a) < EPS && Math.abs(b) < EPS) return "tie_no_dark";
  if (result.maximize_sign > 0 && Math.abs(a - duration) < EPS && Math.abs(b - duration) < EPS) return "tie_full";
  if (result.maximize_sign > 0 && Math.abs(a) < EPS && Math.abs(b) < EPS) return "tie_none";
  return "tie";
}

/** Los cuatro criterios del motor para una ventana y altura, con la superficie nominal. */
export function criterionSnapshots(core: Core, windowId: WindowId, heightM: HeightM): CriterionSnapshot[] {
  const sa = getScenarioSummary(core, { siteId: "A", windowId, heightM, variant: "nominal" });
  const sb = getScenarioSummary(core, { siteId: "B", windowId, heightM, variant: "nominal" });
  const unknownHours = (sa?.metrics.unknown_hours ?? 0) + (sb?.metrics.unknown_hours ?? 0);
  const duration = sa?.metrics.duration_hours ?? 0;
  return CRITERIA.map((criterion) => {
    const result = getCriterionResult(core, windowId, heightM, criterion)!;
    const metric = CRITERION_METRIC[criterion];
    const a = sa ? (sa.metrics[metric] ?? null) : null;
    const b = sb ? (sb.metrics[metric] ?? null) : null;
    const d = result.cases.nominal.D_hours;
    return {
      criterion,
      metric,
      a,
      b,
      winner: result.nominal_winner,
      absD: d === null ? null : Math.abs(d),
      duration,
      unknownHours,
      kind: resultKind(result, a, b, duration, unknownHours),
    };
  });
}

/** Criterios (distintos del actual) que SÍ distinguen A de B en la superficie nominal. */
export function discriminatingCriteria(snaps: CriterionSnapshot[], current: Criterion): CriterionSnapshot[] {
  return snaps.filter((s) => s.criterion !== current && s.kind === "decisive");
}

export interface HeightStep {
  heightM: HeightM;
  a: number | null;
  b: number | null;
  winner: Winner;
  kind: ResultKind;
}

/** El mismo criterio en las tres alturas del contrato (superficie nominal). */
export function heightTrack(core: Core, windowId: WindowId, criterion: Criterion): HeightStep[] {
  return HEIGHTS_M.map((heightM) => {
    const s = criterionSnapshots(core, windowId, heightM).find((x) => x.criterion === criterion)!;
    return { heightM, a: s.a, b: s.b, winner: s.winner, kind: s.kind };
  });
}

/** Alturas en las que cambia el ganador nominal respecto a la anterior (p. ej. 0 → 2 m). */
export function winnerChanges(track: HeightStep[]): Array<{ from: HeightStep; to: HeightStep }> {
  const out: Array<{ from: HeightStep; to: HeightStep }> = [];
  for (let i = 1; i < track.length; i++) if (track[i].winner !== track[i - 1].winner) out.push({ from: track[i - 1], to: track[i] });
  return out;
}
