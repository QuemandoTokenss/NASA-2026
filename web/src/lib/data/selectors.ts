/**
 * Selectores puros sobre el núcleo. Buscan SIEMPRE por la tupla del contrato
 * (site_id, window_id, height_m, variant) — nunca por posición en el array.
 * Devuelven `undefined` si la combinación no existe; la UI debe mostrar
 * "selección no disponible" y no sustituir el valor por cero.
 */
import type { Criterion, HeightM, SiteId, Variant, WindowId } from "../contract/constants";
import type { Comparison, Core, CriterionResult, ScenarioSeries, ScenarioSummary, Site } from "../contract/schema";

export function getSite(core: Core, siteId: SiteId): Site | undefined {
  return core.sites.find((s) => s.id === siteId);
}

export function getWindow(core: Core, windowId: WindowId) {
  return core.configuration.windows.find((w) => w.id === windowId);
}

export function getScenarioSummary(
  core: Core,
  t: { siteId: SiteId; windowId: WindowId; heightM: HeightM; variant: Variant },
): ScenarioSummary | undefined {
  return core.scenario_summaries.find(
    (s) => s.site_id === t.siteId && s.window_id === t.windowId && s.height_m === t.heightM && s.variant === t.variant,
  );
}

export function getScenarioSeries(rows: ScenarioSeries[], siteId: SiteId, variant: Variant): ScenarioSeries | undefined {
  return rows.find((r) => r.site_id === siteId && r.variant === variant);
}

export function getComparison(core: Core, windowId: WindowId, heightM: HeightM): Comparison | undefined {
  return core.comparisons.find((c) => c.window_id === windowId && c.height_m === heightM);
}

export function getCriterionResult(
  core: Core,
  windowId: WindowId,
  heightM: HeightM,
  criterion: Criterion,
): CriterionResult | undefined {
  return getComparison(core, windowId, heightM)?.criteria[criterion];
}
