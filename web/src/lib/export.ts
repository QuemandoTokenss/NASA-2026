/**
 * Exportaciones reproducibles (JSON y CSV) de la selección actual.
 * Solo copian valores del paquete con precisión completa y su procedencia;
 * no añaden resultados.
 */
import { SITE_IDS, VARIANTS, type Criterion } from "./contract/constants";
import type { Core } from "./contract/schema";
import type { DataManifest } from "./data/manifest";
import { getCriterionResult, getScenarioSummary, getWindow } from "./data/selectors";
import { DISPLAY_METRICS } from "./science/metrics";
import type { Selection } from "./state/selection";

export const EXPORT_NOTES = [
  "Valores copiados del paquete site-regret/0.1 sin redondear.",
  "Visibilidad geométrica del centro de Sol/Tierra: no implica energía, enlace de radio ni seguridad de alunizaje.",
  "Las fracciones de variantes no son probabilidades de éxito de misión.",
  "Las cuatro perturbaciones propias son hipótesis modeladas; los cinco clones son DEM publicados. Familias separadas.",
];

function provenance(core: Core, manifest: DataManifest) {
  return {
    schema_version: core.schema_version,
    package: { path: manifest.source.transfer_path, sha256: manifest.source.sha256, bytes: manifest.source.bytes },
    engine_sha256: core.provenance.engine_sha256,
    generated_at_utc: core.provenance.generated_at_utc,
    frame: core.configuration.frame,
  };
}

export function buildScenarioExport(core: Core, manifest: DataManifest, sel: Selection, scope: "scenario" | "regret" = "scenario") {
  const scenario = (variant: (typeof VARIANTS)[number]) =>
    Object.fromEntries(SITE_IDS.map((s) => [s, getScenarioSummary(core, { siteId: s, windowId: sel.windowId, heightM: sel.heightM, variant }) ?? null]));
  const criterion = sel.criterion
    ? { id: sel.criterion, result: getCriterionResult(core, sel.windowId, sel.heightM, sel.criterion) ?? null }
    : null;
  return {
    exported_by: "SITE REGRET web",
    exported_at_utc: new Date().toISOString(),
    selection: {
      window_id: sel.windowId,
      height_m: sel.heightM,
      variant: sel.variant,
      criterion: sel.criterion,
      focus_site: sel.focusSite,
    },
    window: getWindow(core, sel.windowId) ?? null,
    sites: core.sites,
    scenarios: scope === "regret" ? Object.fromEntries(VARIANTS.map((v) => [v, scenario(v)])) : { [sel.variant]: scenario(sel.variant), ...(sel.variant !== "nominal" ? { nominal: scenario("nominal") } : {}) },
    comparison: criterion,
    configuration_parameters: {
      hypothesis_X_m: core.configuration.hypothesis_X_m,
      gaussian_filter_sigma_m: core.configuration.gaussian_filter_sigma_m,
      seed: core.configuration.seed,
      tie_tolerance_hours: core.configuration.tie_tolerance_hours,
      time_step_minutes: core.configuration.time_step_minutes,
    },
    provenance: provenance(core, manifest),
    limitations: core.provenance.limitations,
    notes: EXPORT_NOTES,
  };
}

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? (Object.is(v, -0) ? "0" : String(v)) : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";

/** CSV largo: una fila por superficie, sitio y métrica (+ resultado del criterio si existe). */
export function buildScenarioCsv(core: Core, manifest: DataManifest, sel: Selection, variants: readonly (typeof VARIANTS)[number][], criterion: Criterion | null) {
  const rows: unknown[][] = [["window_id", "height_m", "variant", "site_id", "metric", "value", "unit"]];
  for (const v of variants)
    for (const s of SITE_IDS) {
      const sc = getScenarioSummary(core, { siteId: s, windowId: sel.windowId, heightM: sel.heightM, variant: v });
      if (!sc) continue;
      for (const m of DISPLAY_METRICS) rows.push([sel.windowId, sel.heightM, v, s, m, sc.metrics[m], "hours"]);
    }
  if (criterion) {
    const r = getCriterionResult(core, sel.windowId, sel.heightM, criterion);
    if (r) {
      rows.push([]);
      rows.push(["window_id", "height_m", "criterion", "variant", "winner", "utility_A", "utility_B", "D_hours", "regret_A_hours", "regret_B_hours"]);
      for (const v of variants) {
        const c = r.cases[v];
        rows.push([sel.windowId, sel.heightM, criterion, v, c.winner, c.utility_A, c.utility_B, c.D_hours, c.regret_A_hours, c.regret_B_hours]);
      }
    }
  }
  rows.push([]);
  rows.push(["package_sha256", manifest.source.sha256]);
  rows.push(["engine_sha256", core.provenance.engine_sha256]);
  return toCsv(rows);
}

export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportBaseName(sel: Selection, page: string) {
  return `site-regret_${page}_${sel.windowId}_${sel.heightM}m_${sel.variant}${sel.criterion ? `_${sel.criterion}` : ""}`;
}
