"use client";

import { useCallback, useMemo, useState } from "react";
import { CRITERIA, HEIGHTS_M, SITE_IDS, variantFamily, type HeightM, type SiteId } from "@/lib/contract/constants";
import type { Core, EphemerisClockChunk, HorizonChunk, MetricKey, ScenarioChunk } from "@/lib/contract/schema";
import { useChunk, type ChunkState } from "@/lib/data/DataProvider";
import { heightToK, kKey, loadHeightIndex, type HeightIndexEntry } from "@/lib/data/engineerHeights";
import { loadEphemerisClock, loadHorizonChunk, loadScenarioChunk } from "@/lib/data/loader";
import { getCriterionResult, getScenarioSeries, getScenarioSummary } from "@/lib/data/selectors";
import { formatHoursMinutes, formatNumber } from "@/lib/format";
import { CRITERION_META, SITE_META, VARIANT_LABEL, WINNER_LABEL } from "@/lib/labels";
import { DISPLAY_METRICS, METRIC_META } from "@/lib/science/metrics";
import { booleanRuns, earthVisible, sunVisible } from "@/lib/science/states";
import { useSelection } from "@/lib/state/SelectionProvider";
import { HorizonChart } from "../charts/HorizonChart";
import { StateStrips } from "../charts/TimeCharts";
import { ChunkGate, DataGate } from "../data/DataGate";
import { ControlBar } from "../data/ControlBar";
import { ExportButtons } from "../data/ExportButtons";
import { VariantControl, WindowControl } from "../data/SelectionControls";
import { SelectField } from "../ui/Controls";
import { Badge, Callout, Legend, NatureBadge, SiteDot, WinnerTag } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { InfoTip, LinkButton } from "../ui/Interactive";
import { PageHeader, Panel } from "../ui/Panel";
import { TerrainPanel, type EngineerHeightState } from "../terrain/TerrainPanel";
import { MastScene } from "./MastScene";
import { L } from "@/lib/i18n";

const heightColor = (h: HeightM, selected: HeightM, site: SiteId) => (h === selected ? SITE_META[site].colorVar : h === 0 ? "#64748f" : h === 2 ? "#9aaac4" : "#d6deeb");

/** Curva de una métrica del motor frente a la altura (61 alturas del terreno nominal), con la altura actual marcada. */
function HeightCurve({ entries, metric, current, color }: { entries: HeightIndexEntry[]; metric: MetricKey; current: number; color: string }) {
  const W = 240;
  const H = 54;
  const vals = entries.map((e) => e.metrics[metric]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (h: number) => 4 + (h / 30) * (W - 8);
  const y = (v: number) => H - 6 - ((v - lo) / span) * (H - 14);
  const cur = entries.find((e) => e.height_m === current);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full" role="img" aria-label={`${METRIC_META[metric].label}: ${formatHoursMinutes(lo)} – ${formatHoursMinutes(hi)} ${L("entre 0 y 30 m", "between 0 and 30 m")}`}>
      <polyline points={entries.map((e) => `${x(e.height_m)},${y(e.metrics[metric])}`).join(" ")} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      {[0, 2, 10].map((h) => (
        <line key={h} x1={x(h)} x2={x(h)} y1={H - 5} y2={H - 1} stroke="var(--color-ink-faint)" />
      ))}
      {cur ? <circle cx={x(cur.height_m)} cy={y(cur.metrics[metric])} r={3.6} fill={color} stroke="var(--color-bg)" strokeWidth={1.5} /> : null}
    </svg>
  );
}

function MetricsAtHeight({ core, hs }: { core: Core; hs: EngineerHeightState | null }) {
  const { selection, restored } = useSelection();
  const { focusSite, windowId, heightM, variant } = selection;
  const extended = hs?.kind === "extended";
  const index = useChunk(restored && variant === "nominal" ? () => loadHeightIndex(windowId, focusSite) : null, [windowId, focusSite, variant === "nominal"]);
  const idx = index.status === "ready" ? index.data.value : null;
  const entries = useMemo(() => (idx ? Object.values(idx).sort((p, q) => p.height_m - q.height_m) : null), [idx]);
  const h = extended && hs ? hs.analysisH : heightM;
  const ext = extended && idx ? idx[kKey(heightToK(h))] : null;
  const base = getScenarioSummary(core, { siteId: focusSite, windowId, heightM: 0, variant })!;
  const metrics = extended ? (ext?.metrics ?? null) : getScenarioSummary(core, { siteId: focusSite, windowId, heightM, variant })!.metrics;
  const hTxt = formatNumber(h, h % 1 ? 1 : 0);
  return (
    <Panel
      title={L(`Rendimiento geométrico (altura ${hTxt} m)`, `Geometric performance (height ${hTxt} m)`)}
      icon="activity"
      actions={
        <span className="flex items-center gap-2">
          {extended ? <Badge tone="neutral">{L("Paquete de alturas · nominal", "Heights package · nominal")}</Badge> : null}
          <SiteDot site={focusSite} className="size-3" />
        </span>
      }
    >
      {metrics ? (
        <ul className="flex flex-col" data-testid="metrics-at-height" data-height={h}>
          {DISPLAY_METRICS.map((k) => {
            const d = metrics[k] - base.metrics[k];
            return (
              <li key={k} className="flex items-center gap-3 border-b border-line/60 py-2.5 last:border-b-0">
                <Icon name={METRIC_META[k].icon} className="size-[18px] text-ink-faint" />
                <span className="flex-1 text-sm text-ink-muted">{METRIC_META[k].label}</span>
                {entries && variant === "nominal" ? (
                  <span className="hidden w-40 sm:block">
                    <HeightCurve entries={entries} metric={k} current={h} color={SITE_META[focusSite].colorVar} />
                  </span>
                ) : null}
                <span className="tabular w-28 text-right text-sm font-semibold text-ink">
                  {formatHoursMinutes(metrics[k])}
                  <span className="block text-[10px] font-normal text-ink-faint">
                    {h === 0 ? L("referencia 0 m", "0 m reference") : `${d > 0 ? "+" : d < 0 ? "−" : "±"}${formatHoursMinutes(Math.abs(d))} vs 0 m`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-faint">{L(`Cargando métricas a ${hTxt} m…`, `Loading metrics at ${hTxt} m…`)}</p>
      )}
      <p className="mt-3 text-[11px] text-ink-faint">
        {variant === "nominal"
          ? L("Curvas: la misma métrica del motor en las 61 alturas del terreno nominal (0–30 m cada 0,5 m); marcas en 0, 2 y 10 m; punto = altura actual. ", "Curves: the same engine metric at the 61 heights of the nominal terrain (0–30 m every 0.5 m); ticks at 0, 2 and 10 m; dot = current height. ")
          : null}
        {L("Visibilidad geométrica del centro de Sol y Tierra; no equivale a energía generada ni a enlace de radio.", "Geometric visibility of the Sun and Earth centres; not the same as power generated or a radio link.")}
      </p>
    </Panel>
  );
}

function HeightImpact({ core }: { core: Core }) {
  const { selection } = useSelection();
  const [metric, setMetric] = useState<MetricKey>("sun_hours");
  const vals = SITE_IDS.map((s) => HEIGHTS_M.map((h) => getScenarioSummary(core, { siteId: s, windowId: selection.windowId, heightM: h, variant: selection.variant })!.metrics[metric]));
  const all = vals.flat();
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = Math.max(1, (hi - lo) * 0.15);
  const y0 = Math.max(0, lo - pad);
  const y1 = hi + pad;
  const W = 420;
  const H = 230;
  const LM = 52;
  const B = 34;
  const xs = (k: number) => LM + 40 + k * ((W - LM - 80) / 2);
  const ys = (v: number) => 12 + ((y1 - v) / (y1 - y0)) * (H - B - 12);
  return (
    <Panel
      title={L("Impacto de la altura", "Height impact")}
      icon="timeline"
      actions={
        <SelectField
          label={L("Métrica", "Metric")}
          hideLabel
          value={metric}
          onChange={(v) => v && setMetric(v)}
          groups={[{ label: L("Métricas", "Metrics"), options: DISPLAY_METRICS.map((k) => ({ value: k, label: METRIC_META[k].label })) }]}
        />
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={L(`${METRIC_META[metric].label} de A y B a 0, 2 y 10 m`, `${METRIC_META[metric].label} of A and B at 0, 2 and 10 m`)}>
        <rect x={LM} y={12} width={W - LM - 12} height={H - B - 12} rx={6} fill="var(--color-bg-2)" />
        {[0, 0.5, 1].map((f) => {
          const v = y0 + f * (y1 - y0);
          return (
            <g key={f}>
              <line x1={LM} x2={W - 12} y1={ys(v)} y2={ys(v)} stroke="var(--color-line)" />
              <text x={LM - 6} y={ys(v) + 4} textAnchor="end" fontSize={10} fill="var(--color-ink-faint)">
                {formatNumber(v, 0)} h
              </text>
            </g>
          );
        })}
        {HEIGHTS_M.map((h, k) => (
          <g key={h}>
            <line x1={xs(k)} x2={xs(k)} y1={12} y2={H - B} stroke={h === selection.heightM ? "#a78bfa" : "var(--color-line)"} strokeDasharray={h === selection.heightM ? undefined : "3 4"} />
            <text x={xs(k)} y={H - 12} textAnchor="middle" fontSize={12} fontWeight={h === selection.heightM ? 700 : 400} fill={h === selection.heightM ? "#e8eef8" : "var(--color-ink-muted)"}>
              {h} m
            </text>
          </g>
        ))}
        {SITE_IDS.map((s, si) =>
          vals[si].map((v, k) => (
            <g key={`${s}${k}`}>
              <circle cx={xs(k) + (si ? 9 : -9)} cy={ys(v)} r={HEIGHTS_M[k] === selection.heightM ? 7 : 5} fill={SITE_META[s].colorVar} stroke="var(--color-bg)" strokeWidth={2} className="transition-all duration-500" />
              <text x={xs(k) + (si ? 20 : -20)} y={ys(v) + 4} textAnchor={si ? "start" : "end"} fontSize={10} fill={SITE_META[s].colorVar}>
                {formatNumber(v, 1)}
              </text>
            </g>
          )),
        )}
      </svg>
      <p className="mt-2 text-[11px] text-ink-faint">
        {L(
          "Tres alturas del contrato site-regret/0.1 por sitio (0, 2 y 10 m), las únicas calculadas para todas las superficies; sin líneas de unión. Para el terreno nominal, las 61 alturas calculadas (0–30 m cada 0,5 m) están en «Rendimiento geométrico».",
          "Three heights of the site-regret/0.1 contract per site (0, 2 and 10 m), the only ones computed for every surface; no joining lines. For the nominal terrain, the 61 computed heights (0–30 m every 0.5 m) are under “Geometric performance”.",
        )}
      </p>
    </Panel>
  );
}

function SensitivityTable({ core }: { core: Core }) {
  const { selection } = useSelection();
  return (
    <Panel title={`${L("Análisis de sensibilidad", "Sensitivity analysis")} · ${SITE_META[selection.focusSite].label}`} icon="sliders" bodyClassName="p-0 sm:p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">{L("Métricas por altura del observador", "Metrics by observer height")}</caption>
          <thead>
            <tr className="border-b border-line text-xs text-ink-faint">
              <th scope="col" className="px-5 py-2.5 text-left font-medium">{L("Altura", "Height")}</th>
              {DISPLAY_METRICS.map((k) => (
                <th key={k} scope="col" className="px-3 py-2.5 text-right font-medium">
                  {METRIC_META[k].short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEIGHTS_M.map((h) => {
              const s = getScenarioSummary(core, { siteId: selection.focusSite, windowId: selection.windowId, heightM: h, variant: selection.variant })!;
              const active = h === selection.heightM;
              return (
                <tr key={h} className={`border-b border-line/60 last:border-b-0 ${active ? "bg-gradient-to-r from-uncertainty-soft to-transparent text-ink" : "text-ink-muted"}`}>
                  <th scope="row" className="px-5 py-3 text-left font-semibold">
                    {h} m
                  </th>
                  {DISPLAY_METRICS.map((k) => (
                    <td key={k} className="tabular px-3 py-3 text-right">
                      {formatHoursMinutes(s.metrics[k])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function WinnersByHeight({ core }: { core: Core }) {
  const { selection, query } = useSelection();
  return (
    <Panel title={L("Conclusión de ingeniería", "Engineering conclusion")} icon="check" actions={<InfoTip>{L("Ganador de cada criterio a 0, 2 y 10 m con la superficie seleccionada (comparisons[w,h].criteria[C].cases[V].winner).", "Winner of each criterion at 0, 2 and 10 m with the selected surface (comparisons[w,h].criteria[C].cases[V].winner).")}</InfoTip>}>
      <table className="w-full text-sm">
        <caption className="sr-only">{L("Ganador por criterio y altura", "Winner by criterion and height")}</caption>
        <thead>
          <tr className="text-xs text-ink-faint">
            <th scope="col" className="pb-2 text-left font-medium">{L("Criterio", "Criterion")}</th>
            {HEIGHTS_M.map((h) => (
              <th key={h} scope="col" className="pb-2 text-center font-medium">
                {h} m
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CRITERIA.map((c) => {
            const winners = HEIGHTS_M.map((h) => getCriterionResult(core, selection.windowId, h, c)!.cases[selection.variant].winner);
            const changes = new Set(winners).size > 1;
            return (
              <tr key={c} className={`border-t border-line/60 ${c === selection.criterion ? "text-ink" : "text-ink-muted"}`}>
                <th scope="row" className="py-2 pr-2 text-left font-normal">
                  {CRITERION_META[c].short}
                  {changes ? (
                    <span className="ml-2">
                      <Badge tone="uncertainty">{L("cambia con la altura", "changes with height")}</Badge>
                    </span>
                  ) : null}
                </th>
                {winners.map((w, k) => (
                  <td key={k} className="py-2 text-center" title={WINNER_LABEL[w]}>
                    <WinnerTag winner={w} short />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-ink-muted">
        {L(
          `Superficie ${VARIANT_LABEL[selection.variant]}, ventana ${selection.windowId}. Elevar el observador puede cambiar o igualar la decisión; no existe una «altura óptima» calculada.`,
          `Surface ${VARIANT_LABEL[selection.variant]}, window ${selection.windowId}. Raising the observer can change or even out the decision; no “optimal height” is computed.`,
        )}
      </p>
      <div className="mt-3">
        <LinkButton href={`/comparador/?${query}`} size="sm" icon="compare">
          {L("Abrir en Comparador", "Open in Compare")}
        </LinkButton>
      </div>
    </Panel>
  );
}

function HeightStrips({ chunks, clock }: { chunks: ChunkState<ScenarioChunk>[]; clock: EphemerisClockChunk }) {
  const { selection, dispatch } = useSelection();
  const ready = chunks.every((c) => c.status === "ready");
  const rows = useMemo(() => {
    if (!ready) return [];
    return HEIGHTS_M.flatMap((h, k) => {
      const c = chunks[k] as { status: "ready"; data: { value: ScenarioChunk } };
      const row = getScenarioSeries(c.data.value.rows, selection.focusSite, selection.variant)!;
      return [
        { key: `s${h}`, label: `${L("Sol", "Sun")} · ${h} m`, runs: booleanRuns(row.state_codes, sunVisible), onColor: "var(--color-state-sun)" },
        { key: `e${h}`, label: `${L("Tierra", "Earth")} · ${h} m`, runs: booleanRuns(row.state_codes, earthVisible), onColor: "var(--color-state-earth)" },
      ];
    });
  }, [ready, chunks, selection.focusSite, selection.variant]);
  return (
    <Panel title={`${L("Timeline de visibilidad por altura", "Visibility timeline by height")} · ${SITE_META[selection.focusSite].label} · ${selection.windowId}`} icon="calendar" actions={<NatureBadge nature={variantFamily(selection.variant) === "nominal" ? "DERIVED" : "MODELED"} />}>
      {ready ? (
        <StateStrips rows={rows} times={clock.times_utc} cursor={selection.timeIndex} onPick={(i) => dispatch({ type: "setTimeIndex", value: i })} />
      ) : (
        <p className="text-sm text-ink-faint">{L("Cargando estados de las tres alturas…", "Loading states for the three heights…")}</p>
      )}
      <p className="mt-2 text-[11px] text-ink-faint">{L("Tramos originales de state_codes para 0, 2 y 10 m (sin interpolar). Pulsa para fijar el instante compartido con Timeline.", "Original state_codes runs for 0, 2 and 10 m (not interpolated). Click to set the instant shared with Timeline.")}</p>
    </Panel>
  );
}

function EngineerBody({ core }: { core: Core }) {
  const { selection, restored } = useSelection();
  const [hs, setHs] = useState<EngineerHeightState | null>(null);
  const onHeightState = useCallback((v: EngineerHeightState) => setHs(v), []);
  const isPreview = hs?.kind === "preview";
  const pending = hs !== null && hs.kind !== "preview" && !hs.ready;
  const { windowId, focusSite, heightM, variant } = selection;
  const s0 = useChunk(restored ? () => loadScenarioChunk(core, windowId, 0) : null, [windowId, 0]);
  const s2 = useChunk(restored ? () => loadScenarioChunk(core, windowId, 2) : null, [windowId, 2]);
  const s10 = useChunk(restored ? () => loadScenarioChunk(core, windowId, 10) : null, [windowId, 10]);
  const clock = useChunk(restored ? () => loadEphemerisClock(core, windowId) : null, [windowId]);
  const h0 = useChunk(restored ? () => loadHorizonChunk(focusSite, 0) : null, [focusSite, 0]);
  const h2 = useChunk(restored ? () => loadHorizonChunk(focusSite, 2) : null, [focusSite, 2]);
  const h10 = useChunk(restored ? () => loadHorizonChunk(focusSite, 10) : null, [focusSite, 10]);
  const horizons = [h0, h2, h10];
  const horizonsReady = horizons.every((h) => h.status === "ready");

  return (
    <>
      <div data-testid="engineer-hero">
        <TerrainPanel core={core} onHeightState={onHeightState} />
      </div>

      <ControlBar aside={<Badge tone="neutral">{L("Calculadas: 0–30 m cada 0,5 m (nominal) · 0, 2 y 10 m (resto)", "Computed: 0–30 m every 0.5 m (nominal) · 0, 2 and 10 m (others)")}</Badge>}>
        <WindowControl core={core} />
        <VariantControl />
      </ControlBar>

      <div className={isPreview || pending ? "opacity-55" : undefined} data-testid="engineer-metrics" data-preview={isPreview ? "true" : "false"} data-pending={pending ? "true" : "false"}>
        {isPreview ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-warn">{L(`Último análisis calculado · ${selection.heightM} m (la torre en pantalla es una vista previa)`, `Last computed analysis · ${selection.heightM} m (the tower on screen is a preview)`)}</p>
        ) : pending && hs ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{L(`Actualizando a ${formatNumber(hs.towerH, 1)} m…`, `Updating to ${formatNumber(hs.towerH, 1)} m…`)}</p>
        ) : null}
        <MetricsAtHeight core={core} hs={isPreview ? null : hs} />
      </div>

      <details className="group rounded-2xl border border-line bg-surface/85">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 text-sm font-semibold text-ink">
          <Icon name="engineer" className="size-5 text-ink-muted" />
          {L("Esquema didáctico del mástil", "Explanatory mast sketch")}
          <Badge tone="warn">{L("Ilustración · no es terreno real", "Illustration · not real terrain")}</Badge>
          <Icon name="chevronDown" className="ml-auto size-4 text-ink-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-line">
          <p className="px-5 pt-3 text-xs text-ink-faint">
            {L(
              "Dibujo explicativo conservado como referencia: sus crestas, el Sol y la Tierra están dibujados a mano y no representan el relieve ni las posiciones reales. El terreno real es el panel 3D de arriba.",
              "Explanatory drawing kept for reference: its ridges, Sun and Earth are hand-drawn and do not represent the real relief or positions. The real terrain is the 3D panel above.",
            )}
          </p>
          <MastScene heightM={heightM} site={focusSite} />
        </div>
      </details>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          title={`${L("Horizonte a 0, 2 y 10 m", "Horizon at 0, 2 and 10 m")} · ${SITE_META[focusSite].label} · ${VARIANT_LABEL[variant]}`}
          icon="mountain"
          actions={<NatureBadge nature={variant === "nominal" ? "DERIVED" : "MODELED"} />}
          footer={L("Perfiles reales del paquete para cada altura (horizons[S].variants[V][H]); en color del sitio, la altura seleccionada.", "Real package profiles for each height (horizons[S].variants[V][H]); the selected height in the site colour.")}
        >
          {horizonsReady ? (
            <HorizonChart
              title={L(`Horizonte de ${SITE_META[focusSite].label} a 0, 2 y 10 m`, `${SITE_META[focusSite].label} horizon at 0, 2 and 10 m`)}
              series={HEIGHTS_M.map((h, k) => {
                const chunk = (horizons[k] as { status: "ready"; data: { value: HorizonChunk } }).data.value;
                const p = chunk.variants[variant];
                return {
                  key: String(h),
                  label: `${h} m`,
                  color: heightColor(h, heightM, focusSite),
                  azimuthDeg: chunk.azimuth_deg,
                  elevationDeg: p.elevation_deg,
                  unknown: p.unknown,
                  emphasis: h === heightM,
                };
              }).sort((p, q) => Number(p.emphasis) - Number(q.emphasis))}
            />
          ) : (
            <p className="text-sm text-ink-faint">{L("Cargando horizontes…", "Loading horizons…")}</p>
          )}
          <Legend className="mt-2" items={HEIGHTS_M.map((h) => ({ label: `${h} m${h === heightM ? L(" (seleccionada)", " (selected)") : ""}`, color: heightColor(h, heightM, focusSite), shape: "line" as const }))} />
        </Panel>
        <HeightImpact core={core} />
      </div>

      <ChunkGate state={clock} label={L("reloj", "clock")}>
        {(c: EphemerisClockChunk) => <HeightStrips chunks={[s0, s2, s10]} clock={c} />}
      </ChunkGate>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <SensitivityTable core={core} />
        <WinnersByHeight core={core} />
      </div>

      <Callout tone="neutral" icon="info" title={L("Qué no calcula Engineer", "What Engineer does not compute")}>
        {L(
          "No hay modelo de estructura, materiales, cargas, cimentación, albedo, potencia eléctrica ni enlace de radio. Una «torre de h m» es solo un observador geométrico elevado h metros sobre el terreno (etiquetado SIMULATED): que la visibilidad mejore a cierta altura no dice que esa torre sea construible ni segura, y aquí no se recomienda ninguna altura. Las 61 alturas de 0 a 30 m solo existen para el terreno nominal (paquete adicional, calculado con el motor original); con otras superficies solo hay 0, 2 y 10 m.",
          "There is no model of structure, materials, loads, foundations, albedo, electrical power or radio link. An “h m tower” is only a geometric observer raised h metres above the terrain (labelled SIMULATED): better visibility at some height does not mean that tower is buildable or safe, and no height is recommended here. The 61 heights from 0 to 30 m exist only for the nominal terrain (additional package, computed with the original engine); other surfaces only have 0, 2 and 10 m.",
        )}
      </Callout>
    </>
  );
}

export function EngineerView() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Engineer"
        title="Engineer Mode"
        subtitle={L("¿Cuánto cambia la visibilidad geométrica al elevar el observador de 0 a 30 m?", "How much does geometric visibility change when the observer is raised from 0 to 30 m?")}
        actions={<ExportButtons page="engineer" />}
      />
      <DataGate>{({ core }) => <EngineerBody core={core} />}</DataGate>
    </div>
  );
}
