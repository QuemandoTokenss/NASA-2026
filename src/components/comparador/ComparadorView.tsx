"use client";

import { HEIGHTS_M, SITE_IDS, WINDOW_IDS, variantFamily, type SiteId } from "@/lib/contract/constants";
import type { Core, CriterionResult, MetricKey, ScenarioSummary, Site } from "@/lib/contract/schema";
import { useChunk } from "@/lib/data/DataProvider";
import { loadHorizonChunk } from "@/lib/data/loader";
import { getCriterionResult, getScenarioSummary, getSite, getWindow } from "@/lib/data/selectors";
import { formatHoursMinutes, formatLatitude, formatLongitudeEast, formatNumber, formatUtcDate } from "@/lib/format";
import { CRITERION_META, FAMILY_META, SITE_META, VARIANT_LABEL, WINNER_LABEL } from "@/lib/labels";
import { advantage } from "@/lib/science/decision";
import { CRITERION_METRIC, DISPLAY_METRICS, METRIC_META } from "@/lib/science/metrics";
import { useSelection } from "@/lib/state/SelectionProvider";
import { HorizonChart } from "../charts/HorizonChart";
import { DivergingBar, PairBars, WindowRing } from "../charts/Bars";
import { ChunkGate, DataGate } from "../data/DataGate";
import { ControlBar } from "../data/ControlBar";
import { CriterionPicker } from "../data/CriterionPicker";
import { ExportButtons } from "../data/ExportButtons";
import { CriterionControl, HeightControl, VariantControl, WindowControl } from "../data/SelectionControls";
import { SiteThumb } from "../explore/SiteThumb";
import { Badge, Callout, NatureBadge, SiteDot, WinnerTag } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { InfoTip, LinkButton } from "../ui/Interactive";
import { PageHeader, Panel } from "../ui/Panel";

function roleOf(site: SiteId, winner: string | undefined) {
  if (!winner) return { label: "Criterio sin elegir", tone: "neutral" as const };
  if (winner === "TIE") return { label: "Empate", tone: "neutral" as const };
  if (winner === "UNKNOWN") return { label: "No determinable", tone: "warn" as const };
  return winner === site ? { label: "Ganador con este criterio", tone: site === "A" ? ("a" as const) : ("b" as const) } : { label: "Alternativa", tone: "neutral" as const };
}

function SiteCard({
  site,
  summary,
  winner,
  ringMetric,
  highlightMetric,
}: {
  site: Site;
  summary: ScenarioSummary;
  winner: string | undefined;
  ringMetric: MetricKey;
  highlightMetric: string | null;
}) {
  const id = site.id as SiteId;
  const role = roleOf(id, winner);
  const isWinner = winner === id;
  const m = summary.metrics;
  return (
    <section
      aria-label={`${SITE_META[id].label}: ${site.name}`}
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-surface/85 transition-shadow duration-500 ${
        isWinner ? SITE_META[id].borderClass : "border-line"
      }`}
      style={isWinner ? { boxShadow: `0 0 44px -14px ${id === "A" ? "#ff8a1f" : "#22d3ee"}` } : undefined}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-30" style={{ background: `radial-gradient(60% 100% at 20% 0%, ${SITE_META[id].colorVar}, transparent)` }} />
      <header className="relative flex items-center gap-3 border-b border-line px-5 py-3.5">
        <SiteDot site={id} className="size-3.5 shadow-[0_0_10px_currentColor]" />
        <h2 className={`flex-1 text-xl font-bold ${SITE_META[id].textClass}`}>{SITE_META[id].label}</h2>
        <Badge tone={role.tone}>{role.label}</Badge>
      </header>
      <div className="relative grid gap-x-6 gap-y-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <div className="flex flex-col items-center gap-2">
          <SiteThumb site={site} size={124} scale={0.85} />
          <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg-2 px-2 py-1 text-[11px] text-ink-muted tabular">
            <Icon name="pin" className="size-3.5" />
            {formatLatitude(site.latitude_deg, 3)}, {formatLongitudeEast(site.longitude_east_deg, 2)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <WindowRing value={m[ringMetric]} total={m.duration_hours} color={SITE_META[id].colorVar} label={METRIC_META[ringMetric].short} size={148} />
          <p className="mt-1 max-w-44 text-center text-[11px] text-ink-faint">Fracción real de la ventana ({METRIC_META[ringMetric].label.toLowerCase()}), no una puntuación</p>
        </div>
        <ul className="min-w-0 sm:col-span-2">
          {DISPLAY_METRICS.map((k) => (
            <li key={k} className={`flex items-center gap-2.5 border-b border-line/60 py-2 last:border-b-0 ${highlightMetric === k ? "rounded-md bg-accent-surface/60 px-2" : ""}`}>
              <Icon name={METRIC_META[k].icon} className="size-4 shrink-0 text-ink-faint" />
              <span className="min-w-0 flex-1 text-sm text-ink-muted">{METRIC_META[k].label}</span>
              <span className="tabular text-right text-sm font-semibold text-ink">
                {formatHoursMinutes(m[k])}
                <span className="block text-[10px] font-normal text-ink-faint">{formatNumber((m[k] / m.duration_hours) * 100, 1)} % de la ventana</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <footer className="relative mt-auto flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-5 py-2.5 text-xs text-ink-faint">
        <span>{site.name}</span>
        <span>Suelo {formatNumber(site.nominal_height_m, 1)} m</span>
        <span>Pendiente {formatNumber(site.values.slp, 2)}° (±{formatNumber(site.values.slperr, 2)}° RMS)</span>
      </footer>
    </section>
  );
}

function KeyDifferences({ a, b, tol }: { a: ScenarioSummary; b: ScenarioSummary; tol: number }) {
  return (
    <Panel title="Diferencias clave" icon="compare" actions={<InfoTip>Δ = A − B con valores completos. La flecha indica qué sitio queda mejor solo en métricas con sentido definido por un criterio del motor.</InfoTip>}>
      <ul className="flex flex-col">
        {DISPLAY_METRICS.map((k) => {
          const d = a.metrics[k] - b.metrics[k];
          const meta = METRIC_META[k];
          const within = Math.abs(d) <= tol + 1e-12;
          const favored: SiteId | null = !meta.better || within ? null : (meta.better === "higher" ? d > 0 : d < 0) ? "A" : "B";
          return (
            <li key={k} className="flex items-center gap-3 border-b border-line/60 py-2.5 last:border-b-0">
              <Icon name={meta.icon} className="size-[18px] shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{meta.label}</p>
                <p className="text-[11px] text-ink-faint">{meta.better ? (meta.better === "higher" ? "Más es mejor (criterio del motor)" : "Menos es mejor (criterio del motor)") : "Sin sentido de decisión definido"}</p>
              </div>
              <span className="tabular w-24 text-right text-sm font-semibold text-ink">
                {d > 0 ? "+" : d < 0 ? "−" : ""}
                {formatHoursMinutes(Math.abs(d))}
              </span>
              <span className="w-24 text-right">
                {within ? (
                  <Badge tone="neutral">≤ 10 min</Badge>
                ) : favored ? (
                  <Badge tone={favored === "A" ? "a" : "b"}>{favored} mejor</Badge>
                ) : (
                  <Badge tone="neutral">informativa</Badge>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function MetricTable({ a, b, criterionMetric }: { a: ScenarioSummary; b: ScenarioSummary; criterionMetric: string | null }) {
  const scale = a.metrics.duration_hours;
  return (
    <Panel
      title="Comparación por métrica"
      icon="activity"
      actions={
        <span className="flex items-center gap-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5"><SiteDot site="A" />Sitio A</span>
          <span className="flex items-center gap-1.5"><SiteDot site="B" />Sitio B</span>
        </span>
      }
      footer={`Barras en horas sobre la duración de la ventana (${formatNumber(scale, 0)} h); valores completos del paquete, redondeados solo en pantalla.`}
      bodyClassName="p-0 sm:p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Métricas de visibilidad de A y B</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th scope="col" className="px-5 py-2.5 font-medium">Métrica</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Sitio A</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Sitio B</th>
              <th scope="col" className="w-[38%] px-3 py-2.5 font-medium">Comparación (horas)</th>
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
                      {active ? <Badge tone="accent">Criterio</Badge> : null}
                    </span>
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
      <Panel title="Conclusión" icon="check" className="border-accent/30">
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
      title="Conclusión"
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
                Mejor resultado: <span className={tone}>{SITE_META[winner].label}</span>
              </>
            ) : winner === "TIE" ? (
              <>Empate entre A y B</>
            ) : (
              <>No determinable</>
            )}
          </p>
          {adv.hours !== null ? (
            <p className="mt-1 text-sm text-ink-muted">
              {winner === "TIE"
                ? `Diferencia de ${formatHoursMinutes(adv.hours)}, dentro de la tolerancia de ${formatHoursMinutes(result.tie_tolerance_hours)}.`
                : `Ventaja de ${formatHoursMinutes(adv.hours)} en ${METRIC_META[CRITERION_METRIC[criterion]].label.toLowerCase()}.`}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {SITE_IDS.map((s) => (
            <div key={s} className="rounded-xl border border-line bg-bg-2/60 p-3">
              <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                Regret de elegir <SiteDot site={s} /> {s}
                <InfoTip>Horas de la métrica del criterio que se pierden si se elige {s} y la mejor opción es la otra (regret_{s}_hours).</InfoTip>
              </p>
              <p className="tabular mt-1 text-lg font-bold text-uncertainty">{formatHoursMinutes(s === "A" ? cs.regret_A_hours : cs.regret_B_hours)}</p>
            </div>
          ))}
        </div>

        {isNominal ? (
          <blockquote className="border-l-2 border-accent pl-3 text-sm leading-relaxed text-ink-muted">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Frase del motor (determinista, sin IA)</p>
            {result.summary_es}
          </blockquote>
        ) : (
          <Callout tone="uncertainty" icon="shuffle" title={`Superficie: ${VARIANT_LABEL[variant]}`}>
            {FAMILY_META[variantFamily(variant)].description} Con la superficie nominal el resultado es{" "}
            <strong className="text-ink">{WINNER_LABEL[nominal.winner]}</strong>
            {nominal.winner !== winner ? " — esta superficie cambia la conclusión." : " — esta superficie no cambia la conclusión."}
          </Callout>
        )}

        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/regret-lab/?${query}`} variant="regret" icon="flask">
            Poner a prueba en Regret Lab
          </LinkButton>
          <LinkButton href={`/timeline/?${query}`} size="md" icon="timeline">
            Ver en Timeline
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
      title={`Las 6 combinaciones · ${CRITERION_META[criterion].short}`}
      icon="grid"
      actions={<InfoTip>Ganador con la superficie seleccionada para cada ventana y altura (comparisons[].criteria[C].cases[V].winner). Pulsa una celda para seleccionarla.</InfoTip>}
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
                  {win === "TIE" ? "Empate" : win === "UNKNOWN" ? "?" : win}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function HorizonPair() {
  const { selection, restored } = useSelection();
  const { heightM, variant } = selection;
  const a = useChunk(restored ? () => loadHorizonChunk("A", heightM) : null, [heightM]);
  const b = useChunk(restored ? () => loadHorizonChunk("B", heightM) : null, [heightM]);
  return (
    <Panel title={`Horizontes · ${heightM} m · ${VARIANT_LABEL[variant]}`} icon="mountain" actions={<NatureBadge nature={variant === "nominal" ? "DERIVED" : "MODELED"} />}>
      <ChunkGate state={a} label="horizonte de A">
        {(ha) => (
          <ChunkGate state={b} label="horizonte de B">
            {(hb) => (
              <HorizonChart
                title={`Horizonte de A y B a ${heightM} m`}
                series={[ha, hb].map((h) => ({
                  key: h.site_id,
                  label: SITE_META[h.site_id as SiteId].label,
                  color: SITE_META[h.site_id as SiteId].colorVar,
                  azimuthDeg: h.azimuth_deg,
                  elevationDeg: h.variants[variant].elevation_deg,
                  unknown: h.variants[variant].unknown,
                }))}
              />
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
        eyebrow="Comparador"
        title="Comparador A vs B"
        subtitle="Mismo periodo, misma altura, misma superficie y un criterio fijado antes de ver el ganador"
        actions={<ExportButtons page="comparador" />}
      />
      <DataGate>
        {({ core }) => {
          const { windowId, heightM, variant, criterion } = selection;
          const a = getScenarioSummary(core, { siteId: "A", windowId, heightM, variant });
          const b = getScenarioSummary(core, { siteId: "B", windowId, heightM, variant });
          const siteA = getSite(core, "A");
          const siteB = getSite(core, "B");
          if (!a || !b || !siteA || !siteB) return <Callout tone="danger">Selección no disponible en el paquete.</Callout>;
          const result = criterion ? getCriterionResult(core, windowId, heightM, criterion) : undefined;
          const winner = result?.cases[variant].winner;
          const metric = criterion ? CRITERION_METRIC[criterion] : null;
          return (
            <>
              <ControlBar aside={variant !== "nominal" ? <Badge tone="uncertainty" icon="shuffle">Superficie alternativa</Badge> : <Badge tone="neutral">Superficie nominal</Badge>}>
                <WindowControl core={core} />
                <HeightControl />
                <VariantControl />
                <CriterionControl />
              </ControlBar>

              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)] xl:grid-cols-2">
                <SiteCard site={siteA} summary={a} winner={winner} ringMetric={metric ?? "sun_hours"} highlightMetric={metric} />
                <SiteCard site={siteB} summary={b} winner={winner} ringMetric={metric ?? "sun_hours"} highlightMetric={metric} />
                <div className="xl:col-span-2 2xl:col-span-1">
                  <KeyDifferences a={a} b={b} tol={core.configuration.tie_tolerance_hours} />
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <MetricTable a={a} b={b} criterionMetric={metric} />
                <Conclusion result={result} query={query} />
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <HorizonPair />
                <div className="flex flex-col gap-5">
                  <AllCombinations core={core} />
                  {result ? (
                    <Panel title="Diferencia D por superficie" icon="shuffle" actions={<InfoTip>D = U_A − U_B en horas del criterio. Derecha: favorece a A; izquierda: a B. Detalle completo en Regret Lab.</InfoTip>}>
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
                        <span>← favorece a B</span>
                        <span>favorece a A →</span>
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
