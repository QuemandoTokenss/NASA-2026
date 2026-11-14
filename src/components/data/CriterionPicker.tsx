"use client";

import { CRITERIA } from "@/lib/contract/constants";
import { CRITERION_META } from "@/lib/labels";
import { METRIC_META, CRITERION_METRIC } from "@/lib/science/metrics";
import { useSelection } from "@/lib/state/SelectionProvider";
import { Icon } from "../ui/Icon";
import { L } from "@/lib/i18n";

/** Estado «01 / CHOOSE»: elegir qué significa «mejor» antes de ver el ganador. */
export function CriterionPicker({ compact = false }: { compact?: boolean }) {
  const { dispatch } = useSelection();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Icon name="lock" className="size-4 text-accent" />
        <span>
          <strong className="text-ink">{L("01 · Elige el criterio", "01 · Choose the criterion")}</strong> {L("antes de ver el resultado.", "before seeing the result.")}
        </span>
      </div>
      <div className={`grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        {CRITERIA.map((c) => {
          const m = METRIC_META[CRITERION_METRIC[c]];
          return (
            <button
              key={c}
              type="button"
              onClick={() => dispatch({ type: "setCriterion", value: c })}
              className="group flex items-start gap-3 rounded-xl border border-line bg-bg-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:bg-surface-2 hover:shadow-[0_8px_24px_-12px_#3a6ff0]"
            >
              <Icon name={m.icon} className="mt-0.5 size-5 shrink-0 text-ink-muted group-hover:text-accent" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{CRITERION_META[c].label}</span>
                <span className="block text-xs text-ink-faint">{CRITERION_META[c].description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
