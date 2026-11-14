"use client";

import { VARIANTS } from "@/lib/contract/constants";
import { useData } from "@/lib/data/DataProvider";
import { buildScenarioCsv, buildScenarioExport, downloadText, exportBaseName } from "@/lib/export";
import { useSelection } from "@/lib/state/SelectionProvider";
import { Button } from "../ui/Interactive";
import { L } from "@/lib/i18n";

/** Exporta la selección actual (JSON con procedencia + CSV largo). */
export function ExportButtons({ page, scope = "scenario" }: { page: string; scope?: "scenario" | "regret" }) {
  const { state } = useData();
  const { selection } = useSelection();
  if (state.status !== "ready") return null;
  const base = exportBaseName(selection, page);
  const variants = scope === "regret" ? VARIANTS : selection.variant === "nominal" ? (["nominal"] as const) : (["nominal", selection.variant] as const);
  return (
    <div className="flex items-center gap-2" role="group" aria-label={L("Exportar selección", "Export selection")}>
      <Button
        size="sm"
        icon="json"
        title={L("JSON con valores completos, selección y procedencia (hashes)", "JSON with full values, selection and provenance (hashes)")}
        onClick={() => downloadText(`${base}.json`, JSON.stringify(buildScenarioExport(state.core, state.manifest, selection, scope), null, 2), "application/json")}
      >
        JSON
      </Button>
      <Button
        size="sm"
        icon="csv"
        title={L("CSV con métricas por sitio y superficie y resultado del criterio", "CSV with metrics per site and surface and the criterion result")}
        onClick={() => downloadText(`${base}.csv`, buildScenarioCsv(state.core, state.manifest, selection, variants, selection.criterion), "text/csv")}
      >
        CSV
      </Button>
    </div>
  );
}
