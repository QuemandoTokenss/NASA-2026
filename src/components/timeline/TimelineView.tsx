"use client";

import { useMemo } from "react";
import { SITE_IDS, STATE_NAMES, variantFamily, type SiteId } from "@/lib/contract/constants";
import type { Core, EphemerisClockChunk, EphemerisSiteChunk, HorizonChunk, ScenarioChunk } from "@/lib/contract/schema";
import { useChunk } from "@/lib/data/DataProvider";
import { loadBoundedEvents, loadEphemerisClock, loadEphemerisSite, loadHorizonChunk, loadScenarioChunk, type BoundedEvent } from "@/lib/data/loader";
import { getScenarioSeries, getScenarioSummary, getSite, getWindow } from "@/lib/data/selectors";
import { formatDeg, formatHoursMinutes, formatLatitude, formatLongitudeEast, formatNumber, formatUtc } from "@/lib/format";
import { FAMILY_META, SITE_META, STATE_META, VARIANT_LABEL } from "@/lib/labels";
import { METRIC_META } from "@/lib/science/metrics";
import { booleanRuns, countStates, earthVisible, indexIntervals, intervalAt, samplesToHours, sunVisible } from "@/lib/science/states";
import { useSelection } from "@/lib/state/SelectionProvider";
import { HorizonChart } from "../charts/HorizonChart";
import { StateStrips, TimeSeriesChart } from "../charts/TimeCharts";
import { ChunkGate, DataGate } from "../data/DataGate";
import { ControlBar } from "../data/ControlBar";
import { ExportButtons } from "../data/ExportButtons";
import { FocusSiteControl, HeightControl, VariantControl, WindowControl } from "../data/SelectionControls";
import { SiteThumb } from "../explore/SiteThumb";
import { Badge, Callout, Legend, NatureBadge, SiteDot, StateLegend } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { Button, InfoTip } from "../ui/Interactive";
import { PageHeader, Panel } from "../ui/Panel";
import { TimePlayer } from "./TimePlayer";

const SUN = "var(--color-state-sun)";
const EARTH = "var(--color-state-earth)";

function SiteSidebar({ core, horizon }: { core: Core; horizon: HorizonChunk | null }) {
  const { selection, dispatch } = useSelection();
  const site = getSite(core, selection.focusSite)!;
  const profile = horizon?.variants[selection.variant];
  let lo = Infinity;
  let hi = -Infinity;
  if (profile) profile.elevation_deg.forEach((v, k) => !profile.unknown[k] && ((lo = Math.min(lo, v)), (hi = Math.max(hi, v))));
  const id = site.id as SiteId;
  return (
    <Panel title={SITE_META[id].label} icon="pin" className={SITE_META[id].borderClass + "/40"}>
      <div className="flex flex-col gap-4">
        <p className="tabular text-center text-sm text-ink-muted">
          {formatLatitude(site.latitude_deg)}, {formatLongitudeEast(site.longitude_east_deg)}
        </p>
        <SiteThumb site={site} size={200} scale={1.3} />
        <Button icon="swap" onClick={() => dispatch({ type: "setFocusSite", value: id === "A" ? "B" : "A" })}>
          Cambiar a sitio {id === "A" ? "B" : "A"}
        </Button>
        <dl className="flex flex-col gap-2 text-sm">
          {[
            ["Sitio", site.name],
            ["Suelo (esfera 1 737,4 km)", `${formatNumber(site.nominal_height_m, 1)} m`],
            ["Pendiente publicada", `${formatNumber(site.values.slp, 2)}°`],
            ["Altura del observador", `${selection.heightM} m`],
            ["Horizonte (mín / máx)", profile ? `${formatDeg(lo, 2)} / ${formatDeg(hi, 2)}` : "…"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-line/60 pb-2 last:border-b-0">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="tabular text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[11px] text-ink-faint">Horizonte de la superficie «{VARIANT_LABEL[selection.variant]}» a {selection.heightM} m (1440 azimuts).</p>
      </div>
    </Panel>
  );
}

function Metrics({ core, scen }: { core: Core; scen: ScenarioChunk }) {
  const { selection } = useSelection();
  const s = getScenarioSummary(core, { siteId: selection.focusSite, windowId: selection.windowId, heightM: selection.heightM, variant: selection.variant })!;
  const row = getScenarioSeries(scen.rows, selection.focusSite, selection.variant)!;
  const counts = countStates(row.state_codes);
  const total = row.state_codes.length;
  const m = s.metrics;
  return (
    <Panel title="Métricas del periodo" icon="activity" actions={<NatureBadge nature={variantFamily(selection.variant) === "nominal" ? "DERIVED" : "MODELED"} />}>
      <ul className="flex flex-col">
        {(["sun_hours", "dte_center_hours", "joint_hours", "longest_dark_hours", "longest_no_earth_hours", "unknown_hours"] as const).map((k) => (
          <li key={k} className="flex items-center gap-3 border-b border-line/60 py-2.5 last:border-b-0">
            <Icon name={METRIC_META[k].icon} className="size-[18px] shrink-0 text-ink-faint" />
            <span className="flex-1 text-sm text-ink-muted">{METRIC_META[k].label}</span>
            <span className="tabular text-right text-sm font-semibold text-ink">
              {formatHoursMinutes(m[k])}
              <span className="block text-[10px] font-normal text-ink-faint">{formatNumber((m[k] / m.duration_hours) * 100, 1)} %</span>
            </span>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Tiempo por estado</h3>
      <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
        {counts.map((c, code) =>
          c ? <span key={code} className={STATE_NAMES[code] === "UNKNOWN" ? "pattern-hatch" : ""} style={{ width: `${(c / total) * 100}%`, background: STATE_NAMES[code] === "UNKNOWN" ? undefined : STATE_META[STATE_NAMES[code]].colorVar }} /> : null,
        )}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {counts.map((c, code) => (
          <li key={code} className="flex justify-between gap-2 text-ink-muted">
            <span>{STATE_META[STATE_NAMES[code]].label}</span>
            <span className="tabular text-ink">{formatHoursMinutes(samplesToHours(c))}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-ink-faint">
        Recuento de los {total} intervalos de 10 min de state_codes; coincide con las métricas del motor.
      </p>
    </Panel>
  );
}

function Readout({ core, scen, eph, times }: { core: Core; scen: ScenarioChunk; eph: EphemerisSiteChunk | null; times: string[] }) {
  const { selection } = useSelection();
  const i = selection.timeIndex;
  const w = getWindow(core, selection.windowId)!;
  return (
    <Panel title="Instante seleccionado" icon="clock" actions={<InfoTip>El estado describe el intervalo [t, t + 10 min). Se muestran los intervalos originales, sin interpolar.</InfoTip>}>
      <p className="tabular text-sm text-ink">
        {formatUtc(times[i])} <span className="text-ink-faint">→</span> {formatUtc(times[i + 1])}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {SITE_IDS.map((s) => {
          const row = getScenarioSeries(scen.rows, s, selection.variant)!;
          const iv = intervalAt(indexIntervals(w.start, row.intervals), i);
          const st = STATE_NAMES[row.state_codes[i]];
          return (
            <li key={s} className="rounded-xl border border-line bg-bg-2/70 p-3 text-xs">
              <p className="flex items-center gap-2 text-sm">
                <SiteDot site={s} />
                <span className="font-semibold text-ink">{SITE_META[s].label}</span>
                <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2 py-0.5 ${st === "UNKNOWN" ? "pattern-hatch" : ""}`}>
                  <span className="inline-block size-2.5 rounded-full" style={{ background: STATE_META[st].colorVar }} />
                  {STATE_META[st].label}
                </span>
              </p>
              {iv ? (
                <p className="mt-1 text-ink-faint">
                  Tramo {formatUtc(iv.start)} → {formatUtc(iv.stop)} ({formatHoursMinutes(iv.duration_minutes / 60)}
                  {iv.left_censored || iv.right_censored ? ", censurado en el borde" : ""})
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {eph ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-line bg-bg-2/70 p-3">
            <p className="flex items-center gap-1.5 text-ink-muted">
              <Icon name="sun" className="size-4 text-state-sun" /> Sol · {SITE_META[selection.focusSite].short}
            </p>
            <p className="tabular mt-1 text-ink">Elevación {formatDeg(eph.series.bodies.SUN.elevation_deg[i], 3)}</p>
            <p className="tabular text-ink-faint">Horizonte {formatDeg(eph.series.sun_horizon_deg[i], 3)}</p>
            <p className="tabular text-ink-faint">Azimut {formatDeg(eph.series.bodies.SUN.azimuth_deg[i], 2)}</p>
          </div>
          <div className="rounded-xl border border-line bg-bg-2/70 p-3">
            <p className="flex items-center gap-1.5 text-ink-muted">
              <Icon name="earth" className="size-4 text-state-earth" /> Tierra · {SITE_META[selection.focusSite].short}
            </p>
            <p className="tabular mt-1 text-ink">Elevación {formatDeg(eph.series.bodies.EARTH.elevation_deg[i], 3)}</p>
            <p className="tabular text-ink-faint">Horizonte {formatDeg(eph.series.earth_horizon_deg[i], 3)}</p>
            <p className="tabular text-ink-faint">Azimut {formatDeg(eph.series.bodies.EARTH.azimuth_deg[i], 2)}</p>
          </div>
          <p className="col-span-2 text-[10px] text-ink-faint">Valores en el instante t (nominal, centro geométrico, SPICE DE421, aberración NONE).</p>
        </div>
      ) : null}
    </Panel>
  );
}

function Events({ core, events }: { core: Core; events: BoundedEvent[] }) {
  const { selection, dispatch } = useSelection();
  const list = events.filter((e) => e.site === selection.focusSite && e.window === selection.windowId && e.height_m === selection.heightM);
  const start = Date.parse(getWindow(core, selection.windowId)!.start);
  return (
    <Panel title="Salidas y puestas (nominal)" icon="sunrise" actions={<InfoTip>datos/eventos_acotados.json: cada cruce se acota en un intervalo de 10 minutos; no es un instante exacto.</InfoTip>}>
      {list.length === 0 ? (
        <p className="text-sm text-ink-muted">Sin cruces del horizonte para {SITE_META[selection.focusSite].label} en esta ventana y altura.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {list.map((e) => (
            <li key={`${e.target}${e.event}${e.earliest_utc}`}>
              <button
                type="button"
                onClick={() => dispatch({ type: "setTimeIndex", value: Math.round((Date.parse(e.earliest_utc) - start) / 600000) })}
                className="flex w-full items-center gap-3 rounded-lg border border-line bg-bg-2/60 px-3 py-2 text-left text-xs hover:border-line-strong hover:bg-surface-2"
              >
                <Icon name={e.event === "RISE" ? "sunrise" : "sunset"} className={`size-4 ${e.target === "SUN" ? "text-state-sun" : "text-state-earth"}`} />
                <span className="w-28 text-ink">
                  {e.target === "SUN" ? "Sol" : "Tierra"} · {e.event === "RISE" ? "aparece" : "se oculta"}
                </span>
                <span className="tabular flex-1 text-right text-ink-muted">
                  {formatUtc(e.earliest_utc)} – {formatUtc(e.latest_utc).slice(-9)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-faint">Solo superficie nominal. Pulsa un evento para situar el cursor en el inicio de su intervalo.</p>
    </Panel>
  );
}

function TimelineBody({ core }: { core: Core }) {
  const { selection, restored, dispatch } = useSelection();
  const { windowId, heightM, variant, focusSite } = selection;
  const isNominal = variant === "nominal";

  const scen = useChunk(restored ? () => loadScenarioChunk(core, windowId, heightM) : null, [windowId, heightM]);
  const clock = useChunk(restored ? () => loadEphemerisClock(core, windowId) : null, [windowId]);
  const eph = useChunk(restored && isNominal ? () => loadEphemerisSite(windowId, focusSite, heightM) : null, [windowId, focusSite, heightM, isNominal]);
  const horizon = useChunk(restored ? () => loadHorizonChunk(focusSite, heightM) : null, [focusSite, heightM]);
  const events = useChunk(restored ? () => loadBoundedEvents() : null, ["events"]);

  const ephData = eph.status === "ready" ? eph.data.value : null;
  const horizonData = horizon.status === "ready" ? horizon.data.value : null;

  return (
    <>
      <ControlBar
        aside={
          isNominal ? (
            <Badge tone="neutral">Superficie nominal · curvas disponibles</Badge>
          ) : (
            <Badge tone="uncertainty" icon="shuffle">
              {FAMILY_META[variantFamily(variant)].label}: estados y métricas
            </Badge>
          )
        }
      >
        <FocusSiteControl />
        <WindowControl core={core} />
        <HeightControl />
        <VariantControl />
      </ControlBar>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <SiteSidebar core={core} horizon={horizonData} />

        <div className="flex min-w-0 flex-col gap-5">
          <ChunkGate state={clock} label="reloj UTC de la ventana" minHeight="min-h-80">
            {(c: EphemerisClockChunk) => (
              <ChunkGate state={scen} label="estados de los escenarios" minHeight="min-h-80">
                {(s: ScenarioChunk) => <MainCharts core={core} scen={s} times={c.times_utc} eph={ephData} ephState={eph.status} />}
              </ChunkGate>
            )}
          </ChunkGate>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-2 2xl:col-span-1">
          <ChunkGate state={scen} label="métricas">
            {(s: ScenarioChunk) => <Metrics core={core} scen={s} />}
          </ChunkGate>
          <Panel title="Leyenda" icon="info">
            <StateLegend />
            <Legend
              className="mt-3"
              items={[
                { label: "Elevación del Sol", color: SUN, shape: "line" },
                { label: "Elevación de la Tierra", color: EARTH, shape: "line" },
                { label: "Horizonte en el azimut del Sol", color: SUN, shape: "dash" },
                { label: "Horizonte en el azimut de la Tierra", color: EARTH, shape: "dash" },
              ]}
            />
          </Panel>
        </div>
      </div>

      <ChunkGate state={clock} label="reloj">
        {(c: EphemerisClockChunk) => <TimePlayer times={c.times_utc} />}
      </ChunkGate>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          title={`Horizonte y trayectorias · ${SITE_META[focusSite].label} · ${heightM} m`}
          icon="orbit"
          actions={<NatureBadge nature={isNominal ? "DERIVED" : "MODELED"} />}
          footer={isNominal ? "Trayectorias nominales de Sol y Tierra (azimut, elevación) de toda la ventana; el punto grande marca el instante seleccionado." : "Con superficies alternativas solo se dibuja su horizonte: el paquete no incluye trayectorias para ellas y no se combinan con el cielo nominal."}
        >
          <ChunkGate state={horizon} label="horizonte">
            {(h: HorizonChunk) => (
              <HorizonChart
                title={`Horizonte de ${SITE_META[focusSite].label} con trayectorias de Sol y Tierra`}
                series={[
                  {
                    key: focusSite,
                    label: `Horizonte ${focusSite}`,
                    color: SITE_META[focusSite].colorVar,
                    azimuthDeg: h.azimuth_deg,
                    elevationDeg: h.variants[variant].elevation_deg,
                    unknown: h.variants[variant].unknown,
                    emphasis: true,
                  },
                ]}
                tracks={
                  ephData
                    ? [
                        { key: "sun", label: "Sol", color: "#f5c518", azimuthDeg: ephData.series.bodies.SUN.azimuth_deg, elevationDeg: ephData.series.bodies.SUN.elevation_deg, cursor: selection.timeIndex },
                        { key: "earth", label: "Tierra", color: "#4f7cff", azimuthDeg: ephData.series.bodies.EARTH.azimuth_deg, elevationDeg: ephData.series.bodies.EARTH.elevation_deg, cursor: selection.timeIndex },
                      ]
                    : []
                }
              />
            )}
          </ChunkGate>
        </Panel>
        <div className="flex flex-col gap-5">
          <ChunkGate state={clock} label="reloj">
            {(c: EphemerisClockChunk) => (
              <ChunkGate state={scen} label="estados">
                {(s: ScenarioChunk) => <Readout core={core} scen={s} eph={ephData} times={c.times_utc} />}
              </ChunkGate>
            )}
          </ChunkGate>
          {isNominal ? (
            <ChunkGate state={events} label="eventos acotados">
              {(e: BoundedEvent[]) => <Events core={core} events={e} />}
            </ChunkGate>
          ) : (
            <Callout tone="uncertainty" icon="shuffle" title="Eventos y curvas solo nominales">
              Para «{VARIANT_LABEL[variant]}» se muestran los estados y métricas precalculados por el motor con su propia superficie.{" "}
              <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => dispatch({ type: "setVariant", value: "nominal" })}>
                Volver a la superficie nominal
              </button>
            </Callout>
          )}
        </div>
      </div>
    </>
  );
}

function MainCharts({ core, scen, times, eph, ephState }: { core: Core; scen: ScenarioChunk; times: string[]; eph: EphemerisSiteChunk | null; ephState: string }) {
  const { selection, dispatch } = useSelection();
  const { windowId, variant, focusSite, timeIndex } = selection;
  const w = getWindow(core, windowId)!;
  const pick = (i: number) => dispatch({ type: "setTimeIndex", value: i });

  const rowFocus = getScenarioSeries(scen.rows, focusSite, variant)!;
  const rows = useMemo(() => {
    const a = getScenarioSeries(scen.rows, "A", variant)!;
    const b = getScenarioSeries(scen.rows, "B", variant)!;
    return [
      { key: "sun", label: `Sol visible · ${focusSite}`, runs: booleanRuns(rowFocus.state_codes, sunVisible), onColor: SUN },
      { key: "earth", label: `Tierra visible · ${focusSite}`, runs: booleanRuns(rowFocus.state_codes, earthVisible), onColor: EARTH },
      { key: "A", label: "Estado · A", intervals: indexIntervals(w.start, a.intervals) },
      { key: "B", label: "Estado · B", intervals: indexIntervals(w.start, b.intervals) },
    ];
  }, [scen, variant, focusSite, rowFocus, w.start]);

  const series = useMemo(
    () =>
      eph
        ? [
            { key: "sunH", label: "Horizonte (Sol)", color: SUN, values: eph.series.sun_horizon_deg, dash: "5 4", width: 1.1, opacity: 0.65 },
            { key: "earthH", label: "Horizonte (Tierra)", color: EARTH, values: eph.series.earth_horizon_deg, dash: "5 4", width: 1.1, opacity: 0.65 },
            { key: "sun", label: "Sol", color: SUN, values: eph.series.bodies.SUN.elevation_deg, width: 2 },
            { key: "earth", label: "Tierra", color: EARTH, values: eph.series.bodies.EARTH.elevation_deg, width: 2 },
          ]
        : [],
    [eph],
  );
  const shades = useMemo(
    () => booleanRuns(rowFocus.state_codes, sunVisible).filter((r) => r.value).map((r) => ({ start: r.start, end: r.end, color: "#f5c51812" })),
    [rowFocus],
  );

  return (
    <Panel
      title={`Elevación sobre el horizonte · ${SITE_META[focusSite].label}`}
      icon="timeline"
      actions={variant === "nominal" ? <NatureBadge nature="DERIVED" /> : <Badge tone="uncertainty">Curvas solo nominales</Badge>}
    >
      <div className="flex flex-col gap-3">
        {variant === "nominal" ? (
          eph ? (
            <TimeSeriesChart
              title={`Elevación nominal de Sol y Tierra y del horizonte en su azimut, ${SITE_META[focusSite].label}, ${windowId}`}
              series={series}
              times={times}
              cursor={timeIndex}
              onPick={pick}
              shades={shades}
            />
          ) : (
            <div className="grid min-h-60 place-items-center text-sm text-ink-faint">{ephState === "error" ? "No se pudieron cargar las efemérides." : "Cargando efemérides nominales…"}</div>
          )
        ) : (
          <Callout tone="uncertainty" icon="info" title="Sin curvas para esta superficie">
            El paquete solo contiene direcciones de Sol y Tierra para la superficie nominal. Para «{VARIANT_LABEL[variant]}» se muestran a continuación los
            estados calculados por el motor con su propio terreno; no se combinan curvas nominales con este horizonte.
          </Callout>
        )}
        <StateStrips rows={rows} times={times} cursor={timeIndex} onPick={pick} />
        <p className="text-[11px] text-ink-faint">
          Franjas dibujadas por tramos originales (`intervals`) sin interpolar. Visible = centro geométrico por encima del relieve. Pulsa o arrastra para mover el cursor.
        </p>
      </div>
    </Panel>
  );
}

export function TimelineView() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Timeline"
        title="Timeline de Sol y Tierra"
        subtitle="Evolución de la visibilidad geométrica cada 10 minutos en la ventana seleccionada (UTC)"
        actions={<ExportButtons page="timeline" />}
      />
      <DataGate>{({ core }) => <TimelineBody core={core} />}</DataGate>
    </div>
  );
}
