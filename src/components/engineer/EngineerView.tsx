"use client";

import { useMemo, useState } from "react";
import { CRITERIA, HEIGHTS_M, SITE_IDS, variantFamily, type HeightM, type SiteId } from "@/lib/contract/constants";
import type { Core, EphemerisClockChunk, HorizonChunk, MetricKey, ScenarioChunk } from "@/lib/contract/schema";
import { useChunk, type ChunkState } from "@/lib/data/DataProvider";
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
import { FocusSiteControl, VariantControl, WindowControl } from "../data/SelectionControls";
import { SelectField } from "../ui/Controls";
import { Badge, Callout, Legend, NatureBadge, SiteDot, WinnerTag } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { InfoTip, LinkButton } from "../ui/Interactive";
import { PageHeader, Panel } from "../ui/Panel";
import { MastScene } from "./MastScene";

const heightColor = (h: HeightM, selected: HeightM, site: SiteId) => (h === selected ? SITE_META[site].colorVar : h === 0 ? "#64748f" : h === 2 ? "#9aaac4" : "#d6deeb");

function HeightSelector() {
  const { selection, dispatch } = useSelection();
  return (
    <Panel title="Altura del observador" icon="height" actions={<InfoTip>Solo existen tres alturas precalculadas por el motor (configuration.heights_m). No se interpolan valores intermedios.</InfoTip>}>
      <div role="radiogroup" aria-label="Altura del observador" className="flex flex-col gap-2">
        {[...HEIGHTS_M].reverse().map((h) => {
          const active = selection.heightM === h;
          return (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => dispatch({ type: "setHeight", value: h })}
              className={`group flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                active ? "border-uncertainty/70 bg-gradient-to-r from-uncertainty-soft to-transparent shadow-[0_0_28px_-12px_#a78bfa]" : "border-line bg-bg-2/70 hover:border-line-strong"
              }`}
            >
              <span className={`grid size-9 place-items-center rounded-full border text-xs font-bold ${active ? "border-uncertainty bg-uncertainty text-[#14092e]" : "border-line-strong text-ink-muted"}`}>{h}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold text-ink">{h} m</span>
                <span className="block text-xs text-ink-faint">{h === 0 ? "Sobre el terreno" : `Mástil simulado de ${h} m`}</span>
              </span>
              {h > 0 ? <NatureBadge nature="SIMULATED" /> : null}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-ink-faint">No hay deslizador continuo: otras alturas requerirían nuevos cálculos de horizonte, estados y métricas.</p>
    </Panel>
  );
}

function MetricsAtHeight({ core }: { core: Core }) {
  const { selection } = useSelection();
  const { focusSite, windowId, heightM, variant } = selection;
  const s = getScenarioSummary(core, { siteId: focusSite, windowId, heightM, variant })!;
  const base = getScenarioSummary(core, { siteId: focusSite, windowId, heightM: 0, variant })!;
  return (
    <Panel title={`Rendimiento geométrico (altura ${heightM} m)`} icon="activity" actions={<SiteDot site={focusSite} className="size-3" />}>
      <ul className="flex flex-col">
        {DISPLAY_METRICS.map((k) => {
          const d = s.metrics[k] - base.metrics[k];
          return (
            <li key={k} className="flex items-center gap-3 border-b border-line/60 py-2.5 last:border-b-0">
              <Icon name={METRIC_META[k].icon} className="size-[18px] text-ink-faint" />
              <span className="flex-1 text-sm text-ink-muted">{METRIC_META[k].label}</span>
              <span className="tabular text-right text-sm font-semibold text-ink">
                {formatHoursMinutes(s.metrics[k])}
                <span className="block text-[10px] font-normal text-ink-faint">
                  {heightM === 0 ? "referencia 0 m" : `${d > 0 ? "+" : d < 0 ? "−" : "±"}${formatHoursMinutes(Math.abs(d))} vs 0 m`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-ink-faint">Visibilidad geométrica del centro de Sol y Tierra; no equivale a energía generada ni a enlace de radio.</p>
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
  const L = 52;
  const B = 34;
  const xs = (k: number) => L + 40 + k * ((W - L - 80) / 2);
  const ys = (v: number) => 12 + ((y1 - v) / (y1 - y0)) * (H - B - 12);
  return (
    <Panel
      title="Impacto de la altura"
      icon="timeline"
      actions={
        <SelectField
          label="Métrica"
          hideLabel
          value={metric}
          onChange={(v) => v && setMetric(v)}
          groups={[{ label: "Métricas", options: DISPLAY_METRICS.map((k) => ({ value: k, label: METRIC_META[k].label })) }]}
        />
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${METRIC_META[metric].label} de A y B a 0, 2 y 10 m`}>
        <rect x={L} y={12} width={W - L - 12} height={H - B - 12} rx={6} fill="var(--color-bg-2)" />
        {[0, 0.5, 1].map((f) => {
          const v = y0 + f * (y1 - y0);
          return (
            <g key={f}>
              <line x1={L} x2={W - 12} y1={ys(v)} y2={ys(v)} stroke="var(--color-line)" />
              <text x={L - 6} y={ys(v) + 4} textAnchor="end" fontSize={10} fill="var(--color-ink-faint)">
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
      <p className="mt-2 text-[11px] text-ink-faint">Tres puntos calculados por sitio; sin líneas de unión porque no hay datos entre alturas.</p>
    </Panel>
  );
}

function SensitivityTable({ core }: { core: Core }) {
  const { selection } = useSelection();
  return (
    <Panel title={`Análisis de sensibilidad · ${SITE_META[selection.focusSite].label}`} icon="sliders" bodyClassName="p-0 sm:p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Métricas por altura del observador</caption>
          <thead>
            <tr className="border-b border-line text-xs text-ink-faint">
              <th scope="col" className="px-5 py-2.5 text-left font-medium">Altura</th>
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
    <Panel title="Conclusión de ingeniería" icon="check" actions={<InfoTip>Ganador de cada criterio a 0, 2 y 10 m con la superficie seleccionada (comparisons[w,h].criteria[C].cases[V].winner).</InfoTip>}>
      <table className="w-full text-sm">
        <caption className="sr-only">Ganador por criterio y altura</caption>
        <thead>
          <tr className="text-xs text-ink-faint">
            <th scope="col" className="pb-2 text-left font-medium">Criterio</th>
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
                      <Badge tone="uncertainty">cambia con la altura</Badge>
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
        Superficie {VARIANT_LABEL[selection.variant]}, ventana {selection.windowId}. Elevar el observador puede cambiar o igualar la decisión; no existe una «altura óptima» calculada.
      </p>
      <div className="mt-3">
        <LinkButton href={`/comparador/?${query}`} size="sm" icon="compare">
          Abrir en Comparador
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
        { key: `s${h}`, label: `Sol · ${h} m`, runs: booleanRuns(row.state_codes, sunVisible), onColor: "var(--color-state-sun)" },
        { key: `e${h}`, label: `Tierra · ${h} m`, runs: booleanRuns(row.state_codes, earthVisible), onColor: "var(--color-state-earth)" },
      ];
    });
  }, [ready, chunks, selection.focusSite, selection.variant]);
  return (
    <Panel title={`Timeline de visibilidad por altura · ${SITE_META[selection.focusSite].label} · ${selection.windowId}`} icon="calendar" actions={<NatureBadge nature={variantFamily(selection.variant) === "nominal" ? "DERIVED" : "MODELED"} />}>
      {ready ? (
        <StateStrips rows={rows} times={clock.times_utc} cursor={selection.timeIndex} onPick={(i) => dispatch({ type: "setTimeIndex", value: i })} />
      ) : (
        <p className="text-sm text-ink-faint">Cargando estados de las tres alturas…</p>
      )}
      <p className="mt-2 text-[11px] text-ink-faint">Tramos originales de state_codes para 0, 2 y 10 m (sin interpolar). Pulsa para fijar el instante compartido con Timeline.</p>
    </Panel>
  );
}

function EngineerBody({ core }: { core: Core }) {
  const { selection, restored } = useSelection();
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
      <ControlBar aside={<Badge tone="neutral">Alturas calculadas: 0 · 2 · 10 m</Badge>}>
        <FocusSiteControl />
        <WindowControl core={core} />
        <VariantControl />
      </ControlBar>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <HeightSelector />
        <Panel
          title="Vista ilustrativa"
          icon="engineer"
          actions={
            <>
              <Badge tone="warn">Ilustración</Badge>
              <InfoTip>Dibujo explicativo: no representa el relieve real, la posición real del Sol ni sombras calculadas. Los resultados están en los paneles de datos.</InfoTip>
            </>
          }
          bodyClassName="p-0 sm:p-0 overflow-hidden rounded-b-2xl"
        >
          <MastScene heightM={heightM} site={focusSite} />
        </Panel>
        <div className="xl:col-span-2 2xl:col-span-1">
          <MetricsAtHeight core={core} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          title={`Horizonte a 0, 2 y 10 m · ${SITE_META[focusSite].label} · ${VARIANT_LABEL[variant]}`}
          icon="mountain"
          actions={<NatureBadge nature={variant === "nominal" ? "DERIVED" : "MODELED"} />}
          footer="Perfiles reales del paquete para cada altura (horizons[S].variants[V][H]); en color del sitio, la altura seleccionada."
        >
          {horizonsReady ? (
            <HorizonChart
              title={`Horizonte de ${SITE_META[focusSite].label} a 0, 2 y 10 m`}
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
            <p className="text-sm text-ink-faint">Cargando horizontes…</p>
          )}
          <Legend className="mt-2" items={HEIGHTS_M.map((h) => ({ label: `${h} m${h === heightM ? " (seleccionada)" : ""}`, color: heightColor(h, heightM, focusSite), shape: "line" as const }))} />
        </Panel>
        <HeightImpact core={core} />
      </div>

      <ChunkGate state={clock} label="reloj">
        {(c: EphemerisClockChunk) => <HeightStrips chunks={[s0, s2, s10]} clock={c} />}
      </ChunkGate>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <SensitivityTable core={core} />
        <WinnersByHeight core={core} />
      </div>

      <Callout tone="neutral" icon="info" title="Qué no calcula Engineer">
        No hay modelo de estructura, materiales, albedo, potencia eléctrica ni enlace de radio. «Mástil de 2/10 m» es un observador geométrico elevado sobre el terreno
        (configuration.heights_m), etiquetado como SIMULATED.
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
        subtitle="¿Cuánto cambia la visibilidad geométrica al elevar el observador 0, 2 o 10 m?"
        actions={<ExportButtons page="engineer" />}
      />
      <DataGate>{({ core }) => <EngineerBody core={core} />}</DataGate>
    </div>
  );
}
