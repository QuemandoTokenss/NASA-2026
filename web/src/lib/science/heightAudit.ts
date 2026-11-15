/**
 * Auditoría diagnóstica de alturas (`scripts/engine/height_audit.py` →
 * `data/derived/height-audit/v1/`). NO es un escenario del contrato: sirve para
 * explicar en la interfaz cuánto depende el resultado a 0 m del microrrelieve y
 * qué margen angular tiene el Sol a 2 y 10 m. Las cifras se leen tal cual del
 * resumen generado; `tests/height-audit.test.ts` las contrasta con `audit.json`.
 */
import summaryJson from "../../../data/derived/height-audit/v1/summary.json";
import type { Criterion, HeightM, SiteId, WindowId, Winner } from "../contract/constants";
import type { HeightIndexEntry } from "../data/engineerHeights";
import { CRITERION_METRIC } from "./metrics";

export interface HeightAuditSite {
  toterr_m: number;
  W2_0m_dark_engine_h: number;
  W2_0m_dark_shift_range_h: [number, number];
  W2_0m_dark_nearest_h: number;
  W2_0m_dark_cubic_h: number;
  W2_0m_deepest: { utc: string; sun_minus_horizon_deg: number; obstacle_distance_m: number; equivalent_height_m: number } | null;
  dark_hours_max_at_0_5_and_2m_all_configs: number;
  configs_tested: number;
  sun_margin_min_deg: Record<string, Record<WindowId, number>>;
  first_height_without_dark_W2_m: number | null;
}

export const HEIGHT_AUDIT = summaryJson as unknown as {
  schema: string;
  nature: string;
  engine_sha256: string;
  script_sha256: string;
  sites: Record<SiteId, HeightAuditSite>;
};

/** Margen mínimo Sol − horizonte (grados) de la auditoría para una altura del contrato, si se midió. */
export function sunMargin(site: SiteId, windowId: WindowId, heightM: HeightM): number | null {
  return HEIGHT_AUDIT.sites[site].sun_margin_min_deg[String(heightM)]?.[windowId] ?? null;
}

export const TIE_TOLERANCE_H = 10 / 60;

/**
 * Ganador con la MISMA regla del motor (`compare` de pipeline.py: U = signo × métrica,
 * empate si |D| ≤ 10 min, UNKNOWN si hay horas desconocidas) aplicada a las métricas del
 * paquete de alturas de Engineer, que no trae comparaciones. Solo superficie nominal.
 */
export function packageWinner(criterion: Criterion, a: HeightIndexEntry, b: HeightIndexEntry, tolerance = TIE_TOLERANCE_H): Winner {
  if (a.metrics.unknown_hours || b.metrics.unknown_hours) return "UNKNOWN";
  const metric = CRITERION_METRIC[criterion] as keyof HeightIndexEntry["metrics"];
  const sign = criterion === "min_longest_dark_hours" ? -1 : 1;
  const d = sign * a.metrics[metric] - sign * b.metrics[metric];
  if (Math.abs(d) <= tolerance + 1e-10) return "TIE";
  return d > 0 ? "A" : "B";
}

export interface PackagePoint {
  height_m: number;
  a: number;
  b: number;
  winner: Winner;
}

/** Serie por altura (0–30 m, 0,5 m) del criterio elegido para A y B con el ganador de la regla del motor. */
export function packageSeries(criterion: Criterion, idxA: Record<string, HeightIndexEntry>, idxB: Record<string, HeightIndexEntry>): PackagePoint[] {
  const metric = CRITERION_METRIC[criterion] as keyof HeightIndexEntry["metrics"];
  return Object.keys(idxA)
    .filter((k) => idxB[k])
    .map((k) => ({ height_m: idxA[k].height_m, a: idxA[k].metrics[metric], b: idxB[k].metrics[metric], winner: packageWinner(criterion, idxA[k], idxB[k]) }))
    .sort((p, q) => p.height_m - q.height_m);
}

/** Alturas del paquete en las que cambia el ganador respecto al escalón anterior. */
export function packageWinnerChanges(series: PackagePoint[]): Array<{ from: PackagePoint; to: PackagePoint }> {
  const out: Array<{ from: PackagePoint; to: PackagePoint }> = [];
  for (let i = 1; i < series.length; i++) if (series[i].winner !== series[i - 1].winner) out.push({ from: series[i - 1], to: series[i] });
  return out;
}
