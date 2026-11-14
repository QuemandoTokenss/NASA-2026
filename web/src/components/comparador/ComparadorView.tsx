"use client";

import { useMemo, useState } from "react";
import { HEIGHTS_M, SITE_IDS, WINDOW_IDS, variantFamily, type SiteId, type Variant } from "@/lib/contract/constants";
import type { Core, CriterionResult, HorizonChunk, ScenarioSummary } from "@/lib/contract/schema";
import { horizonDelta } from "@/lib/geospatial/difference";
import { useChunk } from "@/lib/data/DataProvider";
import { loadHorizonChunk } from "@/lib/data/loader";
import { getCriterionResult, getScenarioSummary, getSite, getWindow } from "@/lib/data/selectors";
import { formatHoursMinutes, formatNumber, formatUtcDate } from "@/lib/format";
import { CRITERION_META, FAMILY_META, SITE_META, VARIANT_LABEL, WINNER_LABEL } from "@/lib/labels";
import { advantage } from "@/lib/science/decision";
import { CRITERION_METRIC, DISPLAY_METRICS, METRIC_META } from "@/lib/science/metrics";
import { useSelection } from "@/lib/state/SelectionProvider";
import { HorizonChart } from "../charts/HorizonChart";
import { DivergingBar, PairBars } from "../charts/Bars";
import { ChunkGate, DataGate } from "../data/DataGate";
import { ControlBar } from "../data/ControlBar";
import { CriterionPicker } from "../data/CriterionPicker";
import { ExportButtons } from "../data/ExportButtons";
import { CriterionControl, HeightControl, VariantControl, WindowControl } from "../data/SelectionControls";
import { HorizonDeltaChart } from "../charts/HorizonDeltaChart";
import { PairAtlas, PairContext } from "./PairTerrain";
import { Badge, Callout, NatureBadge, SiteDot, WinnerTag } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { InfoTip, LinkButton } from "../ui/Interactive";
import { PageHeader, Panel } from "../ui/Panel";
import { L, R } from "@/lib/i18n";

/** «Sol visible durante toda la ventana» solo si las horas de Sol = duración y no hay horas desconocidas. */
const fullSun = (sm: ScenarioSummary) => sm.metrics.unknown_hours === 0 && sm.metrics.sun_hours === sm.metrics.duration_hours;
const daysOf = (h: number) => formatNumber(h / 24, 0);

function MetricTable({ a, b, criterionMetric }: { a: ScenarioSummary; b: ScenarioSummary; criterionMetric: string | null }) {
  const scale = a.metrics.duration_hours;
  return (
    <Panel
      title={L("Comparación por métrica", "Comparison by metric")}
      icon="activity"
      actions={
        <span className="flex items-center gap-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5"><SiteDot site="A" />{SITE_META.A.label}</span>
          <span className="flex items-center gap-1.5"><SiteDot site="B" />{SITE_META.B.label}</span>
        </span>
      }
      footer={L(`Barras en horas sobre la duración de la ventana (${formatNumber(scale, 0)} h); valores completos del paquete, redondeados solo en pantalla.`, `Bars in hours over the window duration (${formatNumber(scale, 0)} h); full package values, rounded only on screen.`)}
      bodyClassName="p-0 sm:p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">{L("Métricas de visibilidad de A y B", "Visibility metrics of A and B")}</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th scope="col" className="px-5 py-2.5 font-medium">{L("Métrica", "Metric")}</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">{SITE_META.A.label}</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">{SITE_META.B.label}</th>
              <th scope="col" className="w-[38%] px-3 py-2.5 font-medium">{L("Comparación (horas)", "Comparison (hours)")}</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">Δ A − B</th>
            </tr>
          </thead>
          <tbody>
            {DISPLAY_METRICS.map((k) => {
              const d = a.metrics[k] - b.metrics[k];
              const active = criterionMetric === k;
              return (
                <tr key={k} className={`border-b border-line/60 last:border-b-0 transition-colors ${active ? "bg-gradient-to-r from-accent-surface/80 to-transparent" : "hover:bg-surface-2/50"}`}>
                  <th scope="row" className="px-5 py-3 text-left font-normal">
                    <span className="flex items-center gap-2.5 text-ink">
                      <Icon name={METRIC_META[k].icon} className="size-[18px] text-ink-faint" />
                      {METRIC_META[k].label}
                      {active ? <Badge tone="accent">{L("Criterio", "Criterion")}</Badge> : null}
                    </span>
                    {k === "sun_hours" && fullSun(a) && fullSun(b) ? (
                      <span className="mt-0.5 block pl-7 text-xs text-ok" data-testid="full-sun-row">
                        {L(`Sol visible durante toda la ventana en A y B · ${daysOf(a.metrics.sun_hours)} de ${daysOf(a.metrics.duration_hours)} días`, `Sun visible for the whole window at A and B · ${daysOf(a.metrics.sun_hours)} of ${daysOf(a.metrics.duration_hours)} days`)}
                      </span>
                    ) : null}
                  </th>
                  <td className="tabular px-3 py-3 text-right font-semibold text-site-a">{formatHoursMinutes(a.metrics[k])}</td>
                  <td className="tabular px-3 py-3 text-right font-semibold text-site-b">{formatHoursMinutes(b.metrics[k])}</td>
                  <td className="px-3 py-3">
                    <PairBars a={a.metrics[k]} b={b.metrics[k]} max={scale} />
                  </td>
                  <td className="tabular px-5 py-3 text-right text-ink-muted">
                    {d > 0 ? "+" : d < 0 ? "−" : ""}
                    {formatHoursMinutes(Math.abs(d))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Conclusion({ result, query }: { result: CriterionResult | undefined; query: string }) {
  const { selection } = useSelection();
  const { criterion, variant } = selection;
  if (!criterion || !result)
    return (
      <Panel title={L("Conclusión", "Conclusion")} icon="check" className="border-accent/30">
        <CriterionPicker compact />
      </Panel>
    );
  const cs = result.cases[variant];
  const nominal = result.cases.nominal;
  const adv = advantage(cs);
  const winner = cs.winner;
  const isNominal = variant === "nominal";
  const tone = winner === "A" ? "text-site-a" : winner === "B" ? "text-site-b" : "text-ink";
  return (
    <Panel
      title={L("Conclusión", "Conclusion")}
      icon="check"
      className={winner === "A" ? "border-site-a/40" : winner === "B" ? "border-site-b/40" : "border-line-strong"}
      actions={isNominal ? <NatureBadge nature="DERIVED" /> : <NatureBadge nature={variantFamily(variant) === "own" ? "MODELED" : "OBSERVED"} />}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line bg-bg-2/80 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-faint">
            {CRITERION_META[criterion].short} · {selection.windowId} · {selection.heightM} m · {VARIANT_LABEL[variant]}
          </p>
          <p className="mt-2 text-2xl font-bold leading-tight text-ink">
            {winner === "A" || winner === "B" ? (
              <>
                {L("Mejor resultado:", "Best result:")} <span className={tone}>{SITE_META[winner].label}</span>
              </>
            ) : winner === "TIE" ? (
              <>{L("Empate entre A y B", "Tie between A and B")}</>
            ) : (
              <>{L("No determinable", "Not determinable")}</>
            )}
          </p>
          {adv.hours !== null ? (
            <p className="mt-1 text-sm text-ink-muted">
              {winner === "TIE"
                ? L(
                    `Diferencia de ${formatHoursMinutes(adv.hours)}, dentro de la tolerancia de ${formatHoursMinutes(result.tie_tolerance_hours)}.`,
                    `Difference of ${formatHoursMinutes(adv.hours)}, within the ${formatHoursMinutes(result.tie_tolerance_hours)} tolerance.`,
                  )
                : L(
                    `Ventaja de ${formatHoursMinutes(adv.hours)} en ${METRIC_META[CRITERION_METRIC[criterion]].label.toLowerCase()}.`,
                    `Advantage of ${formatHoursMinutes(adv.hours)} in ${METRIC_META[CRITERION_METRIC[criterion]].label.toLowerCase()}.`,
                  )}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {SITE_IDS.map((s) => (
            <div key={s} className="rounded-xl border border-line bg-bg-2/60 p-3">
              <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                {L("Regret de elegir", "Regret of choosing")} <SiteDot site={s} /> {s}
                <InfoTip>
                  {L(
                    `Horas de la métrica del criterio que se pierden si se elige ${s} y la mejor opción es la otra (regret_${s}_hours).`,
                    `Hours of the criterion metric lost if ${s} is chosen and the best option is the other one (regret_${s}_hours).`,
                  )}
                </InfoTip>
              </p>
              <p className="tabular mt-1 text-lg font-bold text-uncertainty">{formatHoursMinutes(s === "A" ? cs.regret_A_hours : cs.regret_B_hours)}</p>
            </div>
          ))}
        </div>

        {isNominal ? (
          <details className="group rounded-lg border border-line bg-bg-2/60 px-3 py-2" data-testid="engine-sentence">
            <summary className="cursor-pointer text-xs font-semibold text-ink-muted">{L("Cómo se obtuvo", "How it was obtained")}</summary>
            <blockquote className="mt-2 border-l-2 border-accent pl-3 text-sm leading-relaxed text-ink-muted">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{L("Frase del motor (determinista, sin IA)", "Engine sentence (deterministic, no AI · original Spanish)")}</p>
              <span lang="es">{result.summary_es}</span>
            </blockquote>
          </details>
        ) : (
          <Callout tone="uncertainty" icon="shuffle" title={`${L("Superficie", "Surface")}: ${VARIANT_LABEL[variant]}`}>
            {FAMILY_META[variantFamily(variant)].description}{" "}
            {R("Con la superficie nominal el resultado es {w}", "With the nominal surface the result is {w}", { w: <strong className="text-ink">{WINNER_LABEL[nominal.winner]}</strong> })}
            {nominal.winner !== winner
              ? L(" — esta superficie cambia la conclusión.", " — this surface changes the conclusion.")
              : L(" — esta superficie no cambia la conclusión.", " — this surface does not change the conclusion.")}
          </Callout>
        )}

        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/regret-lab/?${query}`} variant="regret" icon="flask">
            {L("Poner a prueba en Regret Lab", "Stress-test in Regret Lab")}
          </LinkButton>
          <LinkButton href={`/timeline/?${query}`} size="md" icon="timeline">
            {L("Ver en Timeline", "View in Timeline")}
          </LinkButton>
        </div>
      </div>
    </Panel>
  );
}

function AllCombinations({ core }: { core: Core }) {
  const { selection, dispatch } = useSelection();
  const criterion = selection.criterion;
  if (!criterion) return null;
  return (
    <Panel
      title={`${L("Las 6 combinaciones", "The 6 combinations")} · ${CRITERION_META[criterion].short}`}
      icon="grid"
      actions={<InfoTip>{L("Ganador con la superficie seleccionada para cada ventana y altura (comparisons[].criteria[C].cases[V].winner). Pulsa una celda para seleccionarla.", "Winner with the selected surface for each window and height (comparisons[].criteria[C].cases[V].winner). Click a cell to select it.")}</InfoTip>}
    >
      <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-2 text-sm">
        <span />
        {HEIGHTS_M.map((h) => (
          <span key={h} className="text-center text-xs text-ink-faint">{h} m</span>
        ))}
        {WINDOW_IDS.map((w) => (
          <div key={w} className="contents">
            <span className="self-center pr-2 text-xs text-ink-faint">
              {w}
              <span className="block text-[10px]">{formatUtcDate(getWindow(core, w)!.start)}</span>
            </span>
            {HEIGHTS_M.map((h) => {
              const r = getCriterionResult(core, w, h, criterion)!;
              const win = r.cases[selection.variant].winner;
              const active = w === selection.windowId && h === selection.heightM;
              const tone = win === "A" ? "border-site-a/50 bg-site-a-soft text-site-a" : win === "B" ? "border-site-b/50 bg-site-b-soft text-site-b" : win === "TIE" ? "border-line-strong bg-surface-2 text-ink-muted" : "pattern-hatch text-ink";
              return (
                <button
                  key={h}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${w}, ${h} m: ${WINNER_LABEL[win]}`}
                  onClick={() => {
                    dispatch({ type: "setWindow", value: w });
                    dispatch({ type: "setHeight", value: h });
                  }}
                  className={`rounded-lg border px-2 py-2.5 text-center font-semibold transition-all hover:-translate-y-0.5 ${tone} ${active ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}`}
                >
                  {win === "TIE" ? L("Empate", "Tie") : win === "UNKNOWN" ? "?" : win}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function HorizonPairDelta({ ha, hb, variant }: { ha: HorizonChunk; hb: HorizonChunk; variant: Variant }) {
  const d = useMemo(() => horizonDelta(ha.variants[variant], hb.variants[variant], 0.1), [ha, hb, variant]);
  const [sel, setSel] = useState<number | null>(null);
  const i = sel ?? Math.max(0, d.maxIndex);
  return (
    <div className="mt-4 flex flex-col gap-2" data-testid="horizon-ab-delta">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{L("Diferencia de horizonte A − B", "Horizon difference A − B")}</p>
      <HorizonDeltaChart
        azimuthDeg={ha.azimuth_deg}
        selected={i}
        onSelect={setSel}
        title={L("Horizonte de A menos horizonte de B por azimut", "Horizon of A minus horizon of B by azimuth")}
        series={[{ key: "AB", label: L("A − B (positivo: A tiene el horizonte más alto)", "A − B (positive: A has the higher horizon)"), color: "#e8eef8", delta: d.delta }]}
        upLabel={L("▲ A más tapado que B", "▲ A more obstructed than B")}
        downLabel={L("▼ B más tapado que A", "▼ B more obstructed than A")}
        caption={L(
          "Δ = horizonte de A − horizonte de B (°) en el mismo azimut y con la misma superficie, leído del paquete. Huecos = desconocido en algún sitio. Flechas para mover el azimut.",
          "Δ = horizon of A − horizon of B (°) at the same azimuth and with the same surface, read from the package. Gaps = unknown at either site. Arrow keys move the azimuth.",
        )}
      />
      <p className="tabular text-xs text-ink-muted">
        {L(
          `Azimut ${formatNumber(ha.azimuth_deg[i], 2)}°: A ${formatNumber(ha.variants[variant].elevation_deg[i], 3)}°, B ${formatNumber(hb.variants[variant].elevation_deg[i], 3)}°. A tiene el horizonte más alto en ${d.raised} azimuts y B en ${d.lowered} (diferencia > 0,1°) de ${d.known} comparables.`,
          `Azimuth ${formatNumber(ha.azimuth_deg[i], 2)}°: A ${formatNumber(ha.variants[variant].elevation_deg[i], 3)}°, B ${formatNumber(hb.variants[variant].elevation_deg[i], 3)}°. A has the higher horizon at ${d.raised} azimuths and B at ${d.lowered} (difference > 0.1°) out of ${d.known} comparable.`,
        )}
      </p>
    </div>
  );
}

function HorizonPair() {
  const { selection, restored } = useSelection();
  const { heightM, variant } = selection;
  const a = useChunk(restored ? () => loadHorizonChunk("A", heightM) : null, [heightM]);
  const b = useChunk(restored ? () => loadHorizonChunk("B", heightM) : null, [heightM]);
  return (
    <Panel title={`${L("Horizontes", "Horizons")} · ${heightM} m · ${VARIANT_LABEL[variant]}`} icon="mountain" actions={<NatureBadge nature={variant === "nominal" ? "DERIVED" : "MODELED"} />}>
      <ChunkGate state={a} label={L("horizonte de A", "horizon of A")}>
        {(ha) => (
          <ChunkGate state={b} label={L("horizonte de B", "horizon of B")}>
            {(hb) => (
              <>
              <HorizonChart
                title={L(`Horizonte de A y B a ${heightM} m`, `Horizon of A and B at ${heightM} m`)}
                series={[ha, hb].map((h) => ({
                  key: h.site_id,
                  label: SITE_META[h.site_id as SiteId].label,
                  color: SITE_META[h.site_id as SiteId].colorVar,
                  azimuthDeg: h.azimuth_deg,
                  elevationDeg: h.variants[variant].elevation_deg,
                  unknown: h.variants[variant].unknown,
                }))}
              />
              <HorizonPairDelta ha={ha} hb={hb} variant={variant} />
              </>
            )}
          </ChunkGate>
        )}
      </ChunkGate>
    </Panel>
  );
}

export function ComparadorView() {
  const { selection, query } = useSelection();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={L("Comparador", "Compare")}
        title={L("Comparador A vs B", "Compare A vs B")}
        subtitle={L("Mismo periodo, misma altura, misma superficie y un criterio fijado antes de ver el ganador", "Same period, same height, same surface and a criterion fixed before seeing the winner")}
        actions={<ExportButtons page="comparador" />}
      />
      <DataGate>
        {({ core }) => {
          const { windowId, heightM, variant, criterion } = selection;
          const a = getScenarioSummary(core, { siteId: "A", windowId, heightM, variant });
          const b = getScenarioSummary(core, { siteId: "B", windowId, heightM, variant });
          const siteA = getSite(core, "A");
          const siteB = getSite(core, "B");
          if (!a || !b || !siteA || !siteB) return <Callout tone="danger">{L("Selección no disponible en el paquete.", "Selection not available in the package.")}</Callout>;
          const result = criterion ? getCriterionResult(core, windowId, heightM, criterion) : undefined;
          const metric = criterion ? CRITERION_METRIC[criterion] : null;
          return (
            <>
              <ControlBar aside={variant !== "nominal" ? <Badge tone="uncertainty" icon="shuffle">{L("Superficie alternativa", "Alternative surface")}</Badge> : <Badge tone="neutral">{L("Superficie nominal", "Nominal surface")}</Badge>}>
                <WindowControl core={core} />
                <HeightControl />
                <VariantControl />
                <CriterionControl />
              </ControlBar>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                <PairAtlas
                  sites={core.sites}
                  reading={{
                    label: metric ? METRIC_META[metric].label : METRIC_META.sun_hours.label,
                    a: (metric ?? "sun_hours") === "sun_hours" && fullSun(a) ? L(`${daysOf(a.metrics.sun_hours)} de ${daysOf(a.metrics.duration_hours)} días`, `${daysOf(a.metrics.sun_hours)} of ${daysOf(a.metrics.duration_hours)} days`) : formatHoursMinutes(a.metrics[metric ?? "sun_hours"]),
                    b: (metric ?? "sun_hours") === "sun_hours" && fullSun(b) ? L(`${daysOf(b.metrics.sun_hours)} de ${daysOf(b.metrics.duration_hours)} días`, `${daysOf(b.metrics.sun_hours)} of ${daysOf(b.metrics.duration_hours)} days`) : formatHoursMinutes(b.metrics[metric ?? "sun_hours"]),
                    note:
                      (metric ?? "sun_hours") === "sun_hours" && fullSun(a) && fullSun(b)
                        ? L(`Sol visible durante toda la ventana en A y B · ${daysOf(a.metrics.sun_hours)} de ${daysOf(a.metrics.duration_hours)} días (${formatNumber(a.metrics.sun_hours, 0)} h). Visibilidad geométrica del centro del Sol según el modelo.`, `Sun visible for the whole window at A and B · ${daysOf(a.metrics.sun_hours)} of ${daysOf(a.metrics.duration_hours)} days (${formatNumber(a.metrics.sun_hours, 0)} h). Geometric visibility of the Sun's centre according to the model.`)
                        : a.metrics.unknown_hours > 0 || b.metrics.unknown_hours > 0
                        ? L(`Horas desconocidas: A ${formatHoursMinutes(a.metrics.unknown_hours)}, B ${formatHoursMinutes(b.metrics.unknown_hours)} (no cuentan como sombra).`, `Unknown hours: A ${formatHoursMinutes(a.metrics.unknown_hours)}, B ${formatHoursMinutes(b.metrics.unknown_hours)} (not counted as shadow).`)
                        : undefined,
                  }}
                />
                <Conclusion result={result} query={query} />
              </div>

              <MetricTable a={a} b={b} criterionMetric={metric} />

              <PairContext sites={core.sites} />

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <HorizonPair />
                <div className="flex flex-col gap-5">
                  <AllCombinations core={core} />
                  {result ? (
                    <Panel title={L("Diferencia D por superficie", "Difference D by surface")} icon="shuffle" actions={<InfoTip>{L("D = U_A − U_B en horas del criterio. Derecha: favorece a A; izquierda: a B. Detalle completo en Regret Lab.", "D = U_A − U_B in criterion hours. Right: favours A; left: favours B. Full detail in Regret Lab.")}</InfoTip>}>
                      <ul className="flex flex-col gap-2">
                        {(Object.keys(result.cases) as Array<keyof typeof result.cases>).map((v) => {
                          const c = result.cases[v];
                          const max = Math.max(...Object.values(result.cases).map((x) => Math.abs(x.D_hours ?? 0)), result.tie_tolerance_hours);
                          return (
                            <li key={v} className={`grid grid-cols-[9.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-xs ${v === variant ? "font-semibold text-ink" : "text-ink-muted"}`}>
                              <span className="truncate">{VARIANT_LABEL[v]}</span>
                              <DivergingBar value={c.D_hours} max={max} tie={c.winner === "TIE"} />
                              <span className="text-right"><WinnerTag winner={c.winner} short /></span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="mt-3 flex justify-between text-[10px] text-ink-faint">
                        <span>{L("← favorece a B", "← favours B")}</span>
                        <span>{L("favorece a A →", "favours A →")}</span>
                      </p>
                    </Panel>
                  ) : null}
                </div>
              </div>
            </>
          );
        }}
      </DataGate>
    </div>
  );
}
