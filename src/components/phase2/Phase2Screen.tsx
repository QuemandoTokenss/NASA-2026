"use client";

import { variantFamily } from "@/lib/contract/constants";
import { getComparison, getScenarioSummary, getWindow } from "@/lib/data/selectors";
import { formatUtc } from "@/lib/format";
import { CRITERION_META, FAMILY_META, VARIANT_LABEL } from "@/lib/labels";
import { useSelection } from "@/lib/state/SelectionProvider";
import { DataGate } from "../data/DataGate";
import { CriterionControl, FocusSiteControl, HeightControl, VariantControl, WindowControl } from "../data/SelectionControls";
import { Badge, Callout, KeyValueList } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { PageHeader, Panel } from "../ui/Panel";

type ControlKey = "window" | "height" | "variant" | "criterion" | "site";

export interface Phase2Spec {
  eyebrow: string;
  title: string;
  subtitle: string;
  purpose: string;
  controls: ControlKey[];
  dataFields: Array<{ path: string; use: string }>;
  mockupGaps: Array<{ mockup: string; reality: string }>;
  rules: string[];
}

/**
 * Pantalla preparada para la fase 2: comparte el estado global y comprueba
 * que la selección existe en el paquete, pero NO muestra métricas todavía.
 */
export function Phase2Screen({ spec }: { spec: Phase2Spec }) {
  const { selection } = useSelection();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={spec.eyebrow} title={spec.title} subtitle={spec.subtitle} actions={<Badge tone="neutral" icon="clock">Fase 2</Badge>} />
      <DataGate>
        {({ core }) => {
          const w = getWindow(core, selection.windowId);
          const comparison = getComparison(core, selection.windowId, selection.heightM);
          const scenarioA = getScenarioSummary(core, { siteId: "A", ...selection });
          const scenarioB = getScenarioSummary(core, { siteId: "B", ...selection });
          const available = Boolean(w && comparison && scenarioA && scenarioB);
          return (
            <>
              <Panel title="Controles compartidos" icon="target">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
                  {spec.controls.includes("site") ? <FocusSiteControl /> : null}
                  {spec.controls.includes("window") ? <WindowControl core={core} /> : null}
                  {spec.controls.includes("height") ? <HeightControl /> : null}
                  {spec.controls.includes("variant") ? <VariantControl /> : null}
                  {spec.controls.includes("criterion") ? <CriterionControl /> : null}
                </div>
                <p className="mt-4 text-xs text-ink-faint">
                  El estado es común a todas las pantallas y se refleja en la URL; cambiarlo selecciona resultados precalculados, no recalcula.
                </p>
              </Panel>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Panel title="Qué mostrará esta pantalla" icon="info">
                  <p className="text-sm leading-relaxed text-ink-muted">{spec.purpose}</p>
                  <ul className="mt-4 flex flex-col gap-2 text-sm text-ink-muted">
                    {spec.rules.map((r) => (
                      <li key={r} className="flex gap-2">
                        <Icon name="shield" className="mt-0.5 size-4 shrink-0 text-accent" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>

                <Panel
                  title="Selección activa"
                  icon="hash"
                  actions={available ? <Badge tone="ok" icon="check">Existe en el paquete</Badge> : <Badge tone="danger" icon="alert">No disponible</Badge>}
                >
                  <KeyValueList
                    items={[
                      { k: "Ventana", v: w ? `${w.id} · ${formatUtc(w.start)} → ${formatUtc(w.stop)}` : "—" },
                      { k: "Altura", v: `${selection.heightM} m` },
                      spec.controls.includes("variant")
                        ? { k: "Superficie", v: `${VARIANT_LABEL[selection.variant]} (${FAMILY_META[variantFamily(selection.variant)].label})` }
                        : { k: "Superficie", v: "Todas las de la comparación (nominal + variantes)" },
                      ...(spec.controls.includes("criterion")
                        ? [{ k: "Criterio", v: selection.criterion ? CRITERION_META[selection.criterion].label : "Sin elegir" }]
                        : []),
                      { k: "Comparación", v: `${selection.windowId} · ${selection.heightM} m`, mono: true },
                    ]}
                  />
                  {!selection.criterion && spec.controls.includes("criterion") ? (
                    <div className="mt-4">
                      <Callout tone="neutral" icon="lock">
                        El ganador permanecerá oculto hasta elegir el criterio (01 / CHOOSE).
                      </Callout>
                    </div>
                  ) : null}
                </Panel>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel title="Campos reales que consumirá" icon="layers" footer="Rutas del contrato site-regret/0.1, sin renombrar.">
                  <ul className="flex flex-col gap-2.5">
                    {spec.dataFields.map((f) => (
                      <li key={f.path} className="text-sm">
                        <code className="font-mono text-xs break-words text-accent">{f.path}</code>
                        <p className="text-ink-muted">{f.use}</p>
                      </li>
                    ))}
                  </ul>
                </Panel>
                <Panel title="Diferencias con el mockup" icon="alert">
                  <ul className="flex flex-col divide-y divide-line/70">
                    {spec.mockupGaps.map((g) => (
                      <li key={g.mockup} className="grid gap-1 py-2.5 text-sm first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-4">
                        <span className="text-ink-faint line-through decoration-danger/50">{g.mockup}</span>
                        <span className="text-ink-muted">{g.reality}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </>
          );
        }}
      </DataGate>
    </div>
  );
}
