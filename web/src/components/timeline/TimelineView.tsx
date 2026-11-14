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
import { GeoMap } from "../maps/GeoMap";
import { Badge, Callout, Legend, NatureBadge, SiteDot, StateLegend } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { Button, InfoTip } from "../ui/Interactive";
import { PageHeader, Panel } from "../ui/Panel";
import earthImg from "@/assets/celestial/earth-bluemarble-as17.webp";
import sunImg from "@/assets/celestial/sun-sdo-aia171.webp";
import { OrbitalView } from "./OrbitalView";
import { TimePlayer } from "./TimePlayer";
import { L } from "@/lib/i18n";

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
      <div className="flex flex-col gap-3">
        <p className="tabular text-center text-sm text-ink-muted">
          {formatLatitude(site.latitude_deg)}, {formatLongitudeEast(site.longitude_east_deg)}
        </p>
        <figure className="flex flex-col gap-1.5" data-testid="timeline-site-map">
          <GeoMap sites={core.sites} focusSite={id} compact compactHeightClass="h-[220px] sm:h-[260px] xl:h-[210px]" followFocus showCredit reliefFallback />
          <figcaption className="text-[10px] leading-snug text-ink-faint">
            {L(
              "Con conexión: mosaico orbital real de NASA Moon Trek (LRO/LROC NAC); sus sombras son las de cada adquisición, no las del instante del reproductor. Sin conexión: relieve derivado del DEM, rotulado en el mapa. Marcador grande: sitio activo; el otro, de referencia.",
              "Online: real orbital mosaic from NASA Moon Trek (LRO/LROC NAC); its shadows are those of each acquisition, not of the player instant. Offline: relief derived from the DEM, labelled on the map. Large marker: active site; the other one for reference.",
            )}
          </figcaption>
        </figure>
        <Button icon="swap" onClick={() => dispatch({ type: "setFocusSite", value: id === "A" ? "B" : "A" })}>
          {L("Cambiar a sitio", "Switch to site")} {id === "A" ? "B" : "A"}
        </Button>
        <dl className="flex flex-col gap-1.5 text-[13px]">
          {[
            [L("Sitio", "Site"), site.name],
            [L("Suelo (esfera 1 737,4 km)", "Ground (1,737.4 km sphere)"), `${formatNumber(site.nominal_height_m, 1)} m`],
            [L("Pendiente publicada", "Published slope"), `${formatNumber(site.values.slp, 2)}°`],
            [L("Altura del observador", "Observer height"), `${selection.heightM} m`],
            [L("Horizonte (mín / máx)", "Horizon (min / max)"), profile ? `${formatDeg(lo, 2)} / ${formatDeg(hi, 2)}` : "…"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-line/60 pb-1.5 last:border-b-0 last:pb-0">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="tabular text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[11px] text-ink-faint">{L(`Horizonte de la superficie «${VARIANT_LABEL[selection.variant]}» a ${selection.heightM} m (1440 azimuts).`, `Horizon of the “${VARIANT_LABEL[selection.variant]}” surface at ${selection.heightM} m (1440 azimuths).`)}</p>
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
    <Panel title={L("Métricas del periodo", "Period metrics")} icon="activity" actions={<NatureBadge nature={variantFamily(selection.variant) === "nominal" ? "DERIVED" : "MODELED"} />}>
      <ul className="flex flex-col">
        {(["sun_hours", "dte_center_hours", "joint_hours", "longest_dark_hours", "longest_no_earth_hours", "unknown_hours"] as const).map((k) => (
          <li key={k} className="flex items-center gap-3 border-b border-line/60 py-2 first:pt-0 last:border-b-0">
            <Icon name={METRIC_META[k].icon} className="size-[18px] shrink-0 text-ink-faint" />
            <span className="flex-1 text-sm text-ink-muted">{METRIC_META[k].label}</span>
            <span className="tabular text-right text-sm font-semibold text-ink">
              {formatHoursMinutes(m[k])}
              <span className="block text-[10px] font-normal text-ink-faint">{formatNumber((m[k] / m.duration_hours) * 100, 1)} %</span>
            </span>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{L("Tiempo por estado", "Time by state")}</h3>
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
        {L(`Recuento de los ${total} intervalos de 10 min de state_codes; coincide con las métricas del motor.`, `Count of the ${total} 10-minute intervals in state_codes; it matches the engine metrics.`)}
      </p>
    </Panel>
  );
}

function Readout({ core, scen, eph, times }: { core: Core; scen: ScenarioChunk; eph: EphemerisSiteChunk | null; times: string[] }) {
  const { selection } = useSelection();
  const i = selection.timeIndex;
  const w = getWindow(core, selection.windowId)!;
  return (
    <Panel title={L("Instante seleccionado", "Selected instant")} icon="clock" actions={<InfoTip>{L("El estado describe el intervalo [t, t + 10 min). Se muestran los intervalos originales, sin interpolar.", "The state describes the interval [t, t + 10 min). Original intervals are shown, not interpolated.")}</InfoTip>}>
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
                  {L("Tramo", "Run")} {formatUtc(iv.start)} → {formatUtc(iv.stop)} ({formatHoursMinutes(iv.duration_minutes / 60)}
                  {iv.left_censored || iv.right_censored ? L(", censurado en el borde", ", censored at the edge") : ""})
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
              <Icon name="sun" className="size-4 text-state-sun" /> {L("Sol", "Sun")} · {SITE_META[selection.focusSite].short}
            </p>
            <p className="tabular mt-1 text-ink">{L("Elevación", "Elevation")} {formatDeg(eph.series.bodies.SUN.elevation_deg[i], 3)}</p>
            <p className="tabular text-ink-faint">{L("Horizonte", "Horizon")} {formatDeg(eph.series.sun_horizon_deg[i], 3)}</p>
            <p className="tabular text-ink-faint">{L("Azimut", "Azimuth")} {formatDeg(eph.series.bodies.SUN.azimuth_deg[i], 2)}</p>
          </div>
          <div className="rounded-xl border border-line bg-bg-2/70 p-3">
            <p className="flex items-center gap-1.5 text-ink-muted">
              <Icon name="earth" className="size-4 text-state-earth" /> {L("Tierra", "Earth")} · {SITE_META[selection.focusSite].short}
            </p>
            <p className="tabular mt-1 text-ink">{L("Elevación", "Elevation")} {formatDeg(eph.series.bodies.EARTH.elevation_deg[i], 3)}</p>
            <p className="tabular text-ink-faint">{L("Horizonte", "Horizon")} {formatDeg(eph.series.earth_horizon_deg[i], 3)}</p>
            <p className="tabular text-ink-faint">{L("Azimut", "Azimuth")} {formatDeg(eph.series.bodies.EARTH.azimuth_deg[i], 2)}</p>
          </div>
          <p className="col-span-2 text-[10px] text-ink-faint">{L("Valores en el instante t (nominal, centro geométrico, SPICE DE421, aberración NONE).", "Values at instant t (nominal, geometric centre, SPICE DE421, aberration NONE).")}</p>
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
    <Panel title={L("Salidas y puestas (nominal)", "Rises and sets (nominal)")} icon="sunrise" actions={<InfoTip>{L("datos/eventos_acotados.json: cada cruce se acota en un intervalo de 10 minutos; no es un instante exacto.", "datos/eventos_acotados.json: each crossing is bounded within a 10-minute interval; it is not an exact instant.")}</InfoTip>}>
      {list.length === 0 ? (
        <p className="text-sm text-ink-muted">{L(`Sin cruces del horizonte para ${SITE_META[selection.focusSite].label} en esta ventana y altura.`, `No horizon crossings for ${SITE_META[selection.focusSite].label} in this window and height.`)}</p>
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
                  {e.target === "SUN" ? L("Sol", "Sun") : L("Tierra", "Earth")} · {e.event === "RISE" ? L("aparece", "rises") : L("se oculta", "sets")}
                </span>
                <span className="tabular flex-1 text-right text-ink-muted">
                  {formatUtc(e.earliest_utc)} – {formatUtc(e.latest_utc).slice(-9)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-faint">{L("Solo superficie nominal. Pulsa un evento para situar el cursor en el inicio de su intervalo.", "Nominal surface only. Click an event to move the cursor to the start of its interval.")}</p>
    </Panel>
  );
}

function TimelineBody({ core }: { core: Core }) {
  const { selection, restored, dispatch } = useSelection();
  const { windowId, heightM, variant, focusSite } = selection;
  const isNominal = variant === "nominal";

  const scen = useChunk(restored ? () => loadScenarioChunk(core, windowId, heightM) : null, [windowId, heightM]);
  const clock = useChunk(restored ? () => loadEphemerisClock(core, windowId) : null, [windowId]);
  // Efemérides nominales del sitio: siempre para la vista orbital (no dependen del horizonte);
  // las curvas sobre el horizonte solo se dibujan con la superficie nominal.
  const eph = useChunk(restored ? () => loadEphemerisSite(windowId, focusSite, heightM) : null, [windowId, focusSite, heightM]);
  const horizon = useChunk(restored ? () => loadHorizonChunk(focusSite, heightM) : null, [focusSite, heightM]);
  const events = useChunk(restored ? () => loadBoundedEvents() : null, ["events"]);

  const ephAll = eph.status === "ready" ? eph.data.value : null;
  const ephData = isNominal ? ephAll : null;
  const horizonData = horizon.status === "ready" ? horizon.data.value : null;

  return (
    <>
      <ControlBar
        aside={
          // Solo donde cabe sin partir la barra en dos filas; el panel del gráfico repite el mismo aviso.
          <span className="hidden min-[1500px]:inline-flex">
            {isNominal ? (
              <Badge tone="neutral">{L("Superficie nominal · curvas disponibles", "Nominal surface · curves available")}</Badge>
            ) : (
              <Badge tone="uncertainty" icon="shuffle">
                {FAMILY_META[variantFamily(variant)].label}: {L("estados y métricas", "states and metrics")}
              </Badge>
            )}
          </span>
        }
      >
        <FocusSiteControl />
        <WindowControl core={core} />
        <HeightControl />
        <VariantControl />
      </ControlBar>

      <ChunkGate state={clock} label={L("reloj", "clock")}>
        {(c: EphemerisClockChunk) => <TimePlayer times={c.times_utc} />}
      </ChunkGate>

      {/*
        Zona principal: primero la geometría (Sol–Tierra–Luna y cielo local, juntos en escritorio) y debajo
        «Elevación sobre el horizonte» con sus franjas. A la derecha, la columna de lectura
        (sitio → instante → métricas → eventos). Sin `order-*`: el orden visual, de lectura y de teclado es
        el del código; en móvil se apila Geometría → Cielo local → Elevación → lectura.
      */}
      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_380px] min-[1700px]:grid-cols-[minmax(0,1fr)_740px]!" data-testid="timeline-layout">
      <div className="flex min-w-0 flex-col gap-5" data-testid="timeline-main">

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-2" data-testid="timeline-physical">
        <Panel
          title={`${L("Geometría Sol–Tierra–Luna", "Sun–Earth–Moon geometry")} · ${SITE_META[focusSite].label}`}
          icon="orbit"
          bodyClassName="p-3 sm:p-4"
          footer={L(
            "Direcciones reales del paquete (SPICE DE421, MOON_ME_DE421, observador nominal) convertidas al marco lunar; distancias del dibujo simbólicas, las reales se rotulan. El color de las trayectorias es el estado calculado por el motor, no una decisión de esta vista.",
            "Real directions from the package (SPICE DE421, MOON_ME_DE421, nominal observer) converted to the lunar frame; drawing distances are symbolic, real ones are labelled. Path colour is the state computed by the engine, not a decision of this view.",
          )}
        >
          <ChunkGate state={eph} label={L("efemérides", "ephemerides")} minHeight="min-h-80">
            {(e: EphemerisSiteChunk) => (
              <ChunkGate state={clock} label={L("reloj", "clock")}>
                {(c: EphemerisClockChunk) => (
                  <ChunkGate state={scen} label={L("estados", "states")}>
                    {(sc: ScenarioChunk) => (
                      <OrbitalView
                        site={getSite(core, focusSite)!}
                        eph={e}
                        codes={getScenarioSeries(sc.rows, focusSite, variant)?.state_codes ?? null}
                        times={c.times_utc}
                        index={selection.timeIndex}
                        surfaceLabel={VARIANT_LABEL[variant]}
                      />
                    )}
                  </ChunkGate>
                )}
              </ChunkGate>
            )}
          </ChunkGate>
        </Panel>
        <Panel
          title={`${L("Cielo local del observador", "Observer local sky")} · ${SITE_META[focusSite].label} · ${heightM} m`}
          icon="eye"
          actions={<NatureBadge nature={isNominal ? "DERIVED" : "MODELED"} />}
          footer={
            isNominal
              ? L("Trayectorias nominales de Sol y Tierra (azimut, elevación) de toda la ventana; el punto grande marca el instante seleccionado.", "Nominal Sun and Earth paths (azimuth, elevation) for the whole window; the large dot marks the selected instant.")
              : L("Con superficies alternativas solo se dibuja su horizonte: el paquete no incluye trayectorias para ellas y no se combinan con el cielo nominal.", "With alternative surfaces only their horizon is drawn: the package has no paths for them and they are not mixed with the nominal sky.")
          }
        >
          <ChunkGate state={horizon} label={L("horizonte", "horizon")}>
            {(h: HorizonChunk) => (
              <>
              <HorizonChart
                height={470}
                title={L(`Horizonte de ${SITE_META[focusSite].label} con trayectorias de Sol y Tierra`, `${SITE_META[focusSite].label} horizon with Sun and Earth paths`)}
                series={[
                  {
                    key: focusSite,
                    label: `${L("Horizonte", "Horizon")} ${focusSite}`,
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
                        { key: "sun", label: L("Sol", "Sun"), color: "#f5c518", azimuthDeg: ephData.series.bodies.SUN.azimuth_deg, elevationDeg: ephData.series.bodies.SUN.elevation_deg, cursor: selection.timeIndex, iconHref: sunImg.src },
                        { key: "earth", label: L("Tierra", "Earth"), color: "#4f7cff", azimuthDeg: ephData.series.bodies.EARTH.azimuth_deg, elevationDeg: ephData.series.bodies.EARTH.elevation_deg, cursor: selection.timeIndex, iconHref: earthImg.src },
                      ]
                    : []
                }
              />
              <ul className="mt-3 grid gap-1.5 text-xs text-ink-muted sm:grid-cols-2" data-testid="local-sky-legend">
                <li className="flex items-center gap-2"><span className="inline-block h-0.5 w-5" style={{ background: SITE_META[focusSite].colorVar }} />{L("Horizonte real del relieve desde el sitio", "Real terrain horizon from the site")}</li>
                <li className="flex items-center gap-2"><span className="inline-block h-0 w-5 border-t border-dashed border-ink-faint" />{L("0°: horizonte ideal sin relieve", "0°: ideal horizon without relief")}</li>
                <li className="flex items-center gap-2"><span className="inline-block size-3 rounded-full bg-[#f5c518]" />{ephData ? L("Sol en el instante (traza: toda la ventana)", "Sun at the instant (trace: whole window)") : L("Sin trayectorias para esta superficie", "No paths for this surface")}</li>
                <li className="flex items-center gap-2"><span className="inline-block size-3 rounded-full bg-[#4f7cff]" />{ephData ? L("Tierra en el instante (visibilidad geométrica)", "Earth at the instant (geometric visibility)") : L("Solo el horizonte de la superficie", "Only the surface horizon")}</li>
              </ul>
              </>
            )}
          </ChunkGate>
        </Panel>
      </div>

        <div className="min-w-0" data-testid="timeline-chart">
          <ChunkGate state={clock} label={L("reloj UTC de la ventana", "window UTC clock")} minHeight="min-h-80">
            {(c: EphemerisClockChunk) => (
              <ChunkGate state={scen} label={L("estados de los escenarios", "scenario states")} minHeight="min-h-80">
                {(s: ScenarioChunk) => <MainCharts core={core} scen={s} times={c.times_utc} eph={ephData} ephState={eph.status} />}
              </ChunkGate>
            )}
          </ChunkGate>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5 min-[1700px]:grid! min-[1700px]:grid-cols-2 min-[1700px]:items-start" data-testid="timeline-reading">
        <div className="flex min-w-0 flex-col gap-5">
        <div className="min-w-0" data-testid="timeline-site">
          <SiteSidebar core={core} horizon={horizonData} />
        </div>
        <div className="min-w-0" data-testid="timeline-instant">
          <ChunkGate state={clock} label={L("reloj", "clock")}>
            {(c: EphemerisClockChunk) => (
              <ChunkGate state={scen} label={L("estados", "states")}>
                {(s: ScenarioChunk) => <Readout core={core} scen={s} eph={ephData} times={c.times_utc} />}
              </ChunkGate>
            )}
          </ChunkGate>
        </div>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
        <div className="min-w-0" data-testid="timeline-metrics">
          <ChunkGate state={scen} label={L("métricas", "metrics")}>
            {(s: ScenarioChunk) => <Metrics core={core} scen={s} />}
          </ChunkGate>
        </div>
        <div className="min-w-0" data-testid="timeline-events">
          {isNominal ? (
            <ChunkGate state={events} label={L("eventos acotados", "bounded events")}>
              {(e: BoundedEvent[]) => <Events core={core} events={e} />}
            </ChunkGate>
          ) : (
            <Callout tone="uncertainty" icon="shuffle" title={L("Eventos y curvas solo nominales", "Events and curves are nominal only")}>
              {L(
                `Para «${VARIANT_LABEL[variant]}» se muestran los estados y métricas precalculados por el motor con su propia superficie.`,
                `For “${VARIANT_LABEL[variant]}” the states and metrics precomputed by the engine with its own surface are shown.`,
              )}{" "}
              <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => dispatch({ type: "setVariant", value: "nominal" })}>
                {L("Volver a la superficie nominal", "Back to the nominal surface")}
              </button>
            </Callout>
          )}
        </div>
        </div>
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
      { key: "sun", label: `${L("Sol visible", "Sun visible")} · ${focusSite}`, runs: booleanRuns(rowFocus.state_codes, sunVisible), onColor: SUN },
      { key: "earth", label: `${L("Tierra visible", "Earth visible")} · ${focusSite}`, runs: booleanRuns(rowFocus.state_codes, earthVisible), onColor: EARTH },
      { key: "A", label: `${L("Estado", "State")} · A`, intervals: indexIntervals(w.start, a.intervals) },
      { key: "B", label: `${L("Estado", "State")} · B`, intervals: indexIntervals(w.start, b.intervals) },
    ];
  }, [scen, variant, focusSite, rowFocus, w.start]);

  const series = useMemo(
    () =>
      eph
        ? [
            { key: "sunH", label: L("Horizonte (Sol)", "Horizon (Sun)"), color: SUN, values: eph.series.sun_horizon_deg, dash: "5 4", width: 1.1, opacity: 0.65 },
            { key: "earthH", label: L("Horizonte (Tierra)", "Horizon (Earth)"), color: EARTH, values: eph.series.earth_horizon_deg, dash: "5 4", width: 1.1, opacity: 0.65 },
            { key: "sun", label: L("Sol", "Sun"), color: SUN, values: eph.series.bodies.SUN.elevation_deg, width: 2 },
            { key: "earth", label: L("Tierra", "Earth"), color: EARTH, values: eph.series.bodies.EARTH.elevation_deg, width: 2 },
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
      title={`${L("Elevación sobre el horizonte", "Elevation above the horizon")} · ${SITE_META[focusSite].label}`}
      icon="timeline"
      actions={variant === "nominal" ? <NatureBadge nature="DERIVED" /> : <Badge tone="uncertainty">{L("Curvas solo nominales", "Nominal curves only")}</Badge>}
    >
      <div className="flex flex-col gap-3">
        {variant === "nominal" ? (
          <Legend
            className="sm:justify-end"
            items={[
              { label: L("Elevación del Sol", "Sun elevation"), color: SUN, shape: "line" },
              { label: L("Elevación de la Tierra", "Earth elevation"), color: EARTH, shape: "line" },
              { label: L("Horizonte en el azimut del Sol", "Horizon at the Sun azimuth"), color: SUN, shape: "dash" },
              { label: L("Horizonte en el azimut de la Tierra", "Horizon at the Earth azimuth"), color: EARTH, shape: "dash" },
            ]}
          />
        ) : null}
        {variant === "nominal" ? (
          eph ? (
            <TimeSeriesChart
              height={360}
              fontSize={13}
              title={L(`Elevación nominal de Sol y Tierra y del horizonte en su azimut, ${SITE_META[focusSite].label}, ${windowId}`, `Nominal elevation of Sun and Earth and of the horizon at their azimuth, ${SITE_META[focusSite].label}, ${windowId}`)}
              series={series}
              times={times}
              cursor={timeIndex}
              onPick={pick}
              shades={shades}
            />
          ) : (
            <div className="grid min-h-60 place-items-center text-sm text-ink-faint">{ephState === "error" ? L("No se pudieron cargar las efemérides.", "Could not load the ephemerides.") : L("Cargando efemérides nominales…", "Loading nominal ephemerides…")}</div>
          )
        ) : (
          <Callout tone="uncertainty" icon="info" title={L("Sin curvas para esta superficie", "No curves for this surface")}>
            {L(
              `El paquete solo contiene direcciones de Sol y Tierra para la superficie nominal. Para «${VARIANT_LABEL[variant]}» se muestran a continuación los estados calculados por el motor con su propio terreno; no se combinan curvas nominales con este horizonte.`,
              `The package only contains Sun and Earth directions for the nominal surface. For “${VARIANT_LABEL[variant]}” the states computed by the engine with its own terrain are shown below; nominal curves are not mixed with this horizon.`,
            )}
          </Callout>
        )}
        <StateStrips rows={rows} times={times} cursor={timeIndex} onPick={pick} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="timeline-legend">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{L("Estados", "States")}</span>
          <StateLegend />
        </div>
        <p className="text-[11px] text-ink-faint">
          {L(
            "Franjas dibujadas por tramos originales (`intervals`) sin interpolar. Visible = centro geométrico por encima del relieve. Pulsa o arrastra para mover el cursor.",
            "Strips drawn from the original runs (`intervals`) without interpolation. Visible = geometric centre above the relief. Click or drag to move the cursor.",
          )}
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
        title={L("Timeline de Sol y Tierra", "Sun and Earth timeline")}
        subtitle={L("Evolución de la visibilidad geométrica cada 10 minutos en la ventana seleccionada (UTC)", "Geometric visibility every 10 minutes in the selected window (UTC)")}
        actions={<ExportButtons page="timeline" />}
      />
      <DataGate>{({ core }) => <TimelineBody core={core} />}</DataGate>
    </div>
  );
}
