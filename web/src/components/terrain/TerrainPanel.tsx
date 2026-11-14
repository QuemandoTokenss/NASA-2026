"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { variantFamily, type SiteId } from "@/lib/contract/constants";
import type { Core } from "@/lib/contract/schema";
import { useChunk } from "@/lib/data/DataProvider";
import { loadEphemerisClock, loadEphemerisSite, loadHorizonChunk, loadScenarioChunk } from "@/lib/data/loader";
import { getScenarioSeries, getSite } from "@/lib/data/selectors";
import { formatDeg, formatNumber, formatUtc } from "@/lib/format";
import { HORIZON_SOURCE_RESOLUTION_M, horizonObstacle } from "@/lib/geospatial/horizon";
import { rayPoint, xyToLonLat } from "@/lib/geospatial/lunar";
import { buildTerrainMesh, directionENU, localFrame, toLocal } from "@/lib/geospatial/mesh";
import type { RasterGrid } from "@/lib/geospatial/raster";
import { TERRAIN_BOUNDS, ensembleMember, loadEnsembleMember, loadTerrainLayer } from "@/lib/geospatial/terrain";
import { L } from "@/lib/i18n";
import { SITE_META, VARIANT_LABEL } from "@/lib/labels";
import { earthVisible, sunVisible } from "@/lib/science/states";
import { useSelection } from "@/lib/state/SelectionProvider";
import { evidenceHref } from "../maps/GeoMap";
import { Badge, Callout, NatureBadge } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { InfoTip } from "../ui/Interactive";
import { CompassBadge } from "./CompassBadge";
import type { SceneDirection, SceneLabels, SceneSightLine, ViewPreset } from "./TerrainScene";

const TerrainScene = dynamic(() => import("./TerrainScene").then((m) => m.TerrainScene), { ssr: false, loading: () => <div className="h-[520px] animate-pulse rounded-xl border border-line bg-bg-2" aria-busy="true" /> });
const GeoMap = dynamic(() => import("../maps/GeoMap").then((m) => m.GeoMap), { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-xl border border-line bg-bg-2" aria-busy="true" /> });

const SITE_HEX: Record<SiteId, string> = { A: "#ff8a1f", B: "#22d3ee" };
const SUN_HEX = "#f5c518";
const EARTH_HEX = "#4f7cff";
/** 1 de cada 2 muestras del DEM de 5 m: vértices reales cada 10 m. */
const MESH_STEP = 2;
type Mode = "sun" | "earth" | "manual";

const toolBtn = (active: boolean, disabled = false) =>
  `whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${active ? "bg-ink text-bg" : disabled ? "cursor-not-allowed text-ink-faint/50" : "text-ink-muted hover:bg-surface-3 hover:text-ink"}`;
function Tool<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ v: T; text: string; disabled?: boolean }>; onChange: (v: T) => void }) {
  return (
  <div role="radiogroup" aria-label={label} className="flex items-center gap-0.5 rounded-lg border border-line-strong bg-bg/80 p-0.5">
    {options.map((o) => (
      <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} disabled={o.disabled} onClick={() => onChange(o.v)} className={toolBtn(value === o.v, o.disabled)}>
        {o.text}
      </button>
    ))}
  </div>
);
}


const COMPUTED_HEIGHTS = [0, 2, 10] as const;
const NO_DIRECTIONS: SceneDirection[] = [];

export function TerrainPanel({ core, onPreviewChange }: { core: Core; onPreviewChange?: (h: number | null) => void }) {
  const { selection, dispatch, query, restored } = useSelection();
  const { focusSite, windowId, heightM, variant, timeIndex } = selection;
  const isNominal = variant === "nominal";
  const [grids, setGrids] = useState<Record<string, RasterGrid>>({});
  const [gridError, setGridError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("sun");
  const [manualAz, setManualAz] = useState(0);
  const [exaggeration, setExaggeration] = useState(1);
  const [preset, setPreset] = useState<{ view: ViewPreset; nonce: number }>({ view: "tower", nonce: 0 });
  // Altura de la torre en VISTA PREVIA (estado local, fuera del contrato): null = altura calculada de la selección.
  const [previewH, setPreviewHState] = useState<number | null>(null);
  const setPreviewH = (h: number | null) => {
    setPreviewHState(h);
    onPreviewChange?.(h);
  };
  const isPreview = previewH !== null;
  const visualH = previewH ?? heightM;
  const onSlider = (raw: number) => {
    const v = Math.round(raw * 2) / 2;
    const computed = COMPUTED_HEIGHTS.find((h) => h === v);
    if (computed !== undefined) {
      setPreviewH(null);
      if (computed !== heightM) dispatch({ type: "setHeight", value: computed });
    } else setPreviewH(v);
  };
  // Al cambiar de altura o de sitio se reencuadra la vista actual (la torre cambia de tamaño).
  useEffect(() => {
    const t = setTimeout(() => setPreset((p) => ({ view: p.view, nonce: p.nonce + 1 })), 0);
    return () => clearTimeout(t);
  }, [heightM, focusSite, visualH]);

  // Malla: DEM nominal, o el recorte del clon publicado si esa es la superficie elegida
  // (las hipótesis propias no se reconstruyen en la web: se dibuja el nominal y se avisa).
  const meshSurface = variantFamily(variant) === "published" && ensembleMember(variant) ? variant : "nominal";
  useEffect(() => {
    let alive = true;
    (meshSurface === "nominal" ? loadTerrainLayer("elevation") : loadEnsembleMember(meshSurface))
      .then((g) => alive && setGrids((p) => ({ ...p, [meshSurface]: g })))
      .catch((e: Error) => alive && setGridError(e.message));
    return () => {
      alive = false;
    };
  }, [meshSurface]);
  const grid = grids[meshSurface] ?? null;

  const horizon = useChunk(restored ? () => loadHorizonChunk(focusSite, heightM) : null, [focusSite, heightM]);
  const eph = useChunk(restored && isNominal ? () => loadEphemerisSite(windowId, focusSite, heightM) : null, [windowId, focusSite, heightM, isNominal]);
  const clock = useChunk(restored ? () => loadEphemerisClock(core, windowId) : null, [windowId]);
  const scen = useChunk(restored ? () => loadScenarioChunk(core, windowId, heightM) : null, [windowId, heightM]);

  const site = getSite(core, focusSite)!;
  const nominalGround = site.nominal_height_m;
  const groundZ = core.horizons_index[focusSite].observer_ground_height_m[variant];
  // Origen vertical en el suelo de la superficie dibujada (para el nominal, nominal_height_m).
  const frameGround = meshSurface === "nominal" ? nominalGround : groundZ;
  const frame = useMemo(() => localFrame({ x: site.x_m, y: site.y_m }, frameGround), [site.x_m, site.y_m, frameGround]);
  const mesh = useMemo(() => (grid ? buildTerrainMesh(grid, frame, MESH_STEP) : null), [grid, frame]);

  const ephData = eph.status === "ready" ? eph.data.value : null;
  const horizonData = horizon.status === "ready" ? horizon.data.value : null;
  const effectiveMode: Mode = mode !== "manual" && !isNominal ? "manual" : mode;
  const body = effectiveMode === "sun" ? ephData?.series.bodies.SUN : effectiveMode === "earth" ? ephData?.series.bodies.EARTH : null;
  const bodyAz = body ? body.azimuth_deg[timeIndex] : null;
  const bodyEl = body ? body.elevation_deg[timeIndex] : null;
  const engineHorizon = ephData && effectiveMode !== "manual" ? (effectiveMode === "sun" ? ephData.series.sun_horizon_deg : ephData.series.earth_horizon_deg)[timeIndex] : null;
  const azimuth = effectiveMode === "manual" ? manualAz : bodyAz;

  // El encuadre de la torre (o «mirar hacia el relieve») sigue la dirección de mirada.
  useEffect(() => {
    if (azimuth === null) return;
    const t = setTimeout(() => setPreset((p) => (p.view === "tower" || p.view === "behind" ? { view: p.view, nonce: p.nonce + 1 } : p)), 200);
    return () => clearTimeout(t);
  }, [azimuth]);

  const obstacle = useMemo(() => {
    if (!horizonData || azimuth === null) return null;
    return horizonObstacle(horizonData.azimuth_deg, horizonData.variants[variant], { lonEastDeg: site.longitude_east_deg, latDeg: site.latitude_deg }, groundZ + heightM, azimuth);
  }, [horizonData, azimuth, variant, site.longitude_east_deg, site.latitude_deg, groundZ, heightM]);

  const insideWindow = obstacle ? obstacle.point.x >= TERRAIN_BOUNDS[0] && obstacle.point.x <= TERRAIN_BOUNDS[2] && obstacle.point.y >= TERRAIN_BOUNDS[1] && obstacle.point.y <= TERRAIN_BOUNDS[3] : false;

  const fmtDist = (m: number) => (m >= 1000 ? `${formatNumber(m / 1000, 2)} km` : `${formatNumber(m, 0)} m`);
  const sightLine = useMemo<SceneSightLine | null>(() => {
    if (!obstacle || obstacle.unknown) return null;
    if (insideWindow)
      return { end: toLocal(frame, obstacle.point.x, obstacle.point.y, obstacle.heightM), reachesObstacle: true, endLabel: `${L("Relieve que limita la vista", "Terrain that limits the view")} · ${fmtDist(obstacle.distanceM)}` };
    // Fuera del recorte: la visual discontinua termina donde el rayo sale de la ventana del DEM.
    const ll = { lonEastDeg: site.longitude_east_deg, latDeg: site.latitude_deg };
    const inside = (m: number) => {
      const q = rayPoint(ll, obstacle.sampleAzimuthDeg, m);
      return q.x >= TERRAIN_BOUNDS[0] && q.x <= TERRAIN_BOUNDS[2] && q.y >= TERRAIN_BOUNDS[1] && q.y <= TERRAIN_BOUNDS[3];
    };
    let lo = 0;
    let hi = 6000;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      if (inside(mid)) lo = mid;
      else hi = mid;
    }
    const d = directionENU(obstacle.sampleAzimuthDeg, obstacle.sampleElevationDeg);
    const exit = lo / Math.cos((obstacle.sampleElevationDeg * Math.PI) / 180);
    return {
      end: [d[0] * exit, d[1] * exit, d[2] * exit + heightM],
      reachesObstacle: false,
      endLabel: `${L("Fin del recorte 3D", "End of the 3D crop")} · ${L("relieve a", "terrain at")} ${fmtDist(obstacle.distanceM)}`,
    };
  }, [obstacle, insideWindow, frame, heightM, site.longitude_east_deg, site.latitude_deg]);

  const directions = useMemo<SceneDirection[]>(() => {
    if (!ephData) return [];
    // Si un cuerpo está a < 12° de la dirección de mirada, su etiqueta se integra en la de la visual.
    const near = (az: number) => azimuth !== null && Math.abs(((az - azimuth + 540) % 360) - 180) < 12;
    const s = ephData.series.bodies;
    return [
      { enu: directionENU(s.SUN.azimuth_deg[timeIndex], s.SUN.elevation_deg[timeIndex]), color: SUN_HEX, body: "sun", label: near(s.SUN.azimuth_deg[timeIndex]) ? undefined : L("Sol", "Sun") },
      { enu: directionENU(s.EARTH.azimuth_deg[timeIndex], s.EARTH.elevation_deg[timeIndex]), color: EARTH_HEX, body: "earth", label: near(s.EARTH.azimuth_deg[timeIndex]) ? undefined : L("Tierra", "Earth") },
    ];
  }, [ephData, timeIndex, azimuth]);
  // Luz de la escena: desde el azimut real del Sol pero a 25° de altura fija, para que el relieve se lea.
  // Luz de la escena: rasante y lateral respecto a la dirección de mirada, solo para leer el relieve y la torre.
  const lightEnu = useMemo(() => directionENU((azimuth ?? 0) + 115, 15), [azimuth]);

  const overlay = useMemo(() => (obstacle ? { line: [{ x: site.x_m, y: site.y_m }, obstacle.point], point: obstacle.point, label: L("Obstáculo", "Obstacle") } : undefined), [obstacle, site.x_m, site.y_m]);

  const times = clock.status === "ready" ? clock.data.value.times_utc : null;
  const stateCode = scen.status === "ready" ? getScenarioSeries(scen.data.value.rows, focusSite, variant)?.state_codes[timeIndex] : undefined;
  const engineVisible = stateCode === undefined || effectiveMode === "manual" ? null : effectiveMode === "sun" ? sunVisible(stateCode) : earthVisible(stateCode);
  const bodyName = effectiveMode === "sun" ? L("Sol", "Sun") : L("Tierra", "Earth");
  const obstacleLonLat = obstacle ? xyToLonLat(obstacle.point.x, obstacle.point.y) : null;
  const step = (d: number) => dispatch({ type: "setTimeIndex", value: Math.max(0, Math.min(4319, timeIndex + d)) });

  const sceneLabels = useMemo<SceneLabels>(
    () => ({
      observer: heightM > 0 ? `${L("Observador", "Observer")} · ${heightM} m` : `${L("Observador", "Observer")} · ${L("a ras del suelo", "at ground level")}`,
      sight: `${L("Dirección de mirada", "Viewing direction")}${effectiveMode === "manual" ? "" : effectiveMode === "sun" ? L(" (Sol)", " (Sun)") : L(" (Tierra)", " (Earth)")} · ${azimuth === null ? "—" : formatDeg(azimuth, 1)}`,
    }),
    [heightM, azimuth, effectiveMode],
  );
  const explain = (() => {
    if (!obstacle || azimuth === null) return null;
    const who = heightM > 0 ? L(`Desde lo alto de una torre de ${heightM} m en ${SITE_META[focusSite].label}`, `From the top of a ${heightM} m tower at ${SITE_META[focusSite].label}`) : L(`Desde el suelo en ${SITE_META[focusSite].label}`, `From the ground at ${SITE_META[focusSite].label}`);
    const where = effectiveMode === "manual" ? L(`mirando al azimut ${formatDeg(azimuth, 1)}`, `looking at azimuth ${formatDeg(azimuth, 1)}`) : L(`mirando hacia ${effectiveMode === "sun" ? "el Sol" : "la Tierra"} (azimut ${formatDeg(azimuth, 1)})`, `looking towards the ${effectiveMode === "sun" ? "Sun" : "Earth"} (azimuth ${formatDeg(azimuth, 1)})`);
    if (obstacle.unknown) return `${who}, ${where}: ${L("el motor marca este azimut como desconocido.", "the engine marks this azimuth as unknown.")}`;
    const hz = obstacle.horizonDeg === null ? L("desconocido", "unknown") : formatDeg(obstacle.horizonDeg, 2);
    const lim = L(`el horizonte está a ${hz} y lo fija relieve a ${fmtDist(obstacle.distanceM)}`, `the horizon is at ${hz}, set by terrain ${fmtDist(obstacle.distanceM)} away`);
    const vis =
      engineVisible === null
        ? ""
        : engineVisible
          ? L(` El centro ${effectiveMode === "sun" ? "del Sol" : "de la Tierra"} está por encima: visible según el motor.`, ` The ${bodyName} centre is above it: visible according to the engine.`)
          : L(` El centro ${effectiveMode === "sun" ? "del Sol" : "de la Tierra"} queda tapado según el motor.`, ` The ${bodyName} centre is hidden according to the engine.`);
    const crop = insideWindow ? "" : L(" Ese relieve queda fuera del recorte 3D: la visual discontinua acaba en el borde del recorte y el mapa muestra dónde está.", " That terrain lies outside the 3D crop: the dashed line ends at the crop edge and the map shows where it is.");
    return `${who}, ${where}, ${lim}.${vis}${crop}`;
  })();

  const rows: Array<[string, string]> = [];
  if (obstacle) {
    if (bodyAz !== null && bodyEl !== null) {
      rows.push([L(`Dirección del centro de ${bodyName}`, `Direction of the ${bodyName} centre`), `${L("azimut", "azimuth")} ${formatDeg(bodyAz, 2)} · ${L("elevación", "elevation")} ${formatDeg(bodyEl, 3)}`]);
      if (engineHorizon !== null) {
        rows.push([L("Horizonte del motor en ese azimut", "Engine horizon at that azimuth"), formatDeg(engineHorizon, 3)]);
        rows.push([L("Margen (elevación − horizonte)", "Margin (elevation − horizon)"), `${bodyEl - engineHorizon >= 0 ? "+" : "−"}${formatDeg(Math.abs(bodyEl - engineHorizon), 3)}`]);
      }
    } else rows.push([L("Azimut consultado", "Queried azimuth"), `${formatDeg(obstacle.azimuthDeg, 2)} · ${L("horizonte", "horizon")} ${obstacle.horizonDeg === null ? L("desconocido", "unknown") : formatDeg(obstacle.horizonDeg, 3)}`]);
    rows.push([L("Distancia al terreno que fija el horizonte", "Distance to the terrain that sets the horizon"), obstacle.distanceM >= 1000 ? `${formatNumber(obstacle.distanceM / 1000, 2)} km` : `${formatNumber(obstacle.distanceM, 1)} m`]);
    rows.push([L("Altura de ese terreno (sobre la esfera)", "Height of that terrain (above the sphere)"), `${formatNumber(obstacle.heightM, 1)} m`]);
    rows.push([L("Relieve que lo determina", "Relief that determines it"), [L("DEM local PGDA78", "Local PGDA78 DEM"), L("Regional PGDA90", "Regional PGDA90"), L("Apoyo PGDA90", "PGDA90 support")][obstacle.source] + ` · ${HORIZON_SOURCE_RESOLUTION_M[obstacle.source]} m`]);
    rows.push([L("Posición del obstáculo", "Obstacle position"), `X ${formatNumber(obstacle.point.x, 0)} m · Y ${formatNumber(obstacle.point.y, 0)} m (${formatNumber(Math.abs(obstacleLonLat!.latDeg), 4)}° S, ${formatNumber(obstacleLonLat!.lonEastDeg, 3)}° E)`]);
  }

  const conclusion = (() => {
    if (!obstacle || azimuth === null) return null;
    const title =
      effectiveMode === "manual"
        ? `${L("Azimut", "Azimuth")} ${formatDeg(azimuth, 1)}`
        : engineVisible === null
          ? `${bodyName} · ${formatDeg(azimuth, 1)}`
          : engineVisible
            ? L(`${effectiveMode === "sun" ? "Sol visible" : "Tierra visible"}`, `${bodyName} visible`)
            : L(`${effectiveMode === "sun" ? "Sol tapado" : "Tierra tapada"}`, `${bodyName} hidden`);
    if (obstacle.unknown) return { title, tone: "neutral" as const, line: L("Horizonte desconocido en este azimut", "Unknown horizon at this azimuth") };
    const hz = obstacle.horizonDeg === null ? "—" : formatDeg(obstacle.horizonDeg, 2);
    return {
      title,
      tone: engineVisible === null ? ("neutral" as const) : engineVisible ? ("ok" as const) : ("hidden" as const),
      line: `${L("Horizonte", "Horizon")} ${hz} · ${L("relieve a", "terrain at")} ${fmtDist(obstacle.distanceM)}${insideWindow ? "" : ` · ${L("fuera del recorte", "outside the crop")}`}`,
      margin: bodyEl !== null && engineHorizon !== null ? bodyEl - engineHorizon : null,
    };
  })();

  return (
    <section aria-label={L("Terreno 3D, torre y línea de visión", "3D terrain, tower and line of sight")} className="flex flex-col gap-4" data-testid="terrain-panel" data-preset={preset.view} data-mesh-surface={meshSurface} data-mesh-ready={mesh ? "true" : "false"}>
      <div className="overflow-hidden rounded-2xl border border-line bg-[#03060d]">
        {/* Barra compacta: lo que cambia la escena, junto a la escena */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface/80 px-3 py-2">
          <Tool label={L("Sitio", "Site")} value={focusSite} onChange={(v) => dispatch({ type: "setFocusSite", value: v as SiteId })} options={(["A", "B"] as const).map((s) => ({ v: s, text: SITE_META[s].label }))} />
          <div className="flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-line-strong bg-bg/80 py-0.5 pr-2 pl-0.5 sm:gap-2" data-testid="tower-height-control" data-preview={isPreview ? "true" : "false"}>
            <Tool label={L("Altura del observador", "Observer height")} value={isPreview ? -1 : heightM} onChange={(v) => onSlider(v as number)} options={COMPUTED_HEIGHTS.map((h) => ({ v: h, text: `${h} m` }))} />
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-ink-muted sm:flex-none">
              <span className="sr-only">{L("Altura de la torre (0 a 30 m)", "Tower height (0 to 30 m)")}</span>
              <input
                type="range"
                min={0}
                max={30}
                step={0.5}
                value={visualH}
                onChange={(e) => onSlider(Number(e.target.value))}
                list="tower-computed-heights"
                className="w-full min-w-14 accent-[#a78bfa] sm:w-40"
                aria-label={L("Altura de la torre (0 a 30 m)", "Tower height (0 to 30 m)")}
                aria-valuetext={`${formatNumber(visualH, 1)} m${isPreview ? L(" · vista previa", " · preview") : L(" · calculada", " · computed")}`}
                data-testid="tower-height-slider"
              />
              <datalist id="tower-computed-heights">
                {COMPUTED_HEIGHTS.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
              <span className={`tabular w-12 shrink-0 text-right font-semibold sm:w-14 ${isPreview ? "text-warn" : "text-ink"}`}>{formatNumber(visualH, visualH % 1 ? 1 : 0)} m</span>
            </label>
          </div>
          <Tool
            label={L("Dirección", "Direction")}
            value={effectiveMode}
            onChange={(v) => setMode(v as Mode)}
            options={[
              { v: "sun" as Mode, text: L("Sol", "Sun"), disabled: !isNominal },
              { v: "earth" as Mode, text: L("Tierra", "Earth"), disabled: !isNominal },
              { v: "manual" as Mode, text: L("Azimut", "Azimuth") },
            ]}
          />
          {effectiveMode === "manual" ? (
            <label className="flex min-w-48 flex-1 items-center gap-2 text-xs text-ink-muted">
              <span className="sr-only">{L("Azimut", "Azimuth")}</span>
              <input type="range" min={0} max={359.75} step={0.25} value={manualAz} onChange={(e) => setManualAz(Number(e.target.value))} className="flex-1 accent-[#a78bfa]" aria-label={L("Azimut", "Azimuth")} aria-valuetext={`${manualAz}°`} />
              <span className="tabular w-14 text-right font-semibold text-ink">{formatDeg(manualAz, 1)}</span>
            </label>
          ) : (
            <div className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
              <span className="tabular mr-1 text-ink">{times ? formatUtc(times[timeIndex]) : "…"}</span>
              {(
                [
                  [-144, L("−1 día", "−1 day")],
                  [-6, "−1 h"],
                  [6, "+1 h"],
                  [144, L("+1 día", "+1 day")],
                ] as const
              ).map(([d, label]) => (
                <button key={d} type="button" onClick={() => step(d)} className="rounded-md border border-line-strong px-1.5 py-0.5 font-medium text-ink hover:bg-surface-3">
                  {label}
                </button>
              ))}
              <Link href={`/timeline/?${query}`} className="ml-1 text-accent underline-offset-2 hover:underline">
                Timeline
              </Link>
            </div>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-faint">
            {L("Exag.", "Exag.")}
            <select value={exaggeration} onChange={(e) => setExaggeration(Number(e.target.value))} className="rounded-md border border-line-strong bg-surface-2 px-1.5 py-0.5 text-ink" aria-label={L("Exageración vertical", "Vertical exaggeration")}>
              {[1, 2, 5].map((x) => (
                <option key={x} value={x}>
                  ×{x}
                </option>
              ))}
            </select>
          </label>
        </div>

        {gridError ? (
          <Callout tone="danger" icon="alert" title={L("DEM no disponible", "DEM unavailable")}>
            {gridError} {L("No se dibuja un terreno de sustitución.", "No substitute terrain is drawn.")}
          </Callout>
        ) : mesh ? (
          <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="relative">
            <TerrainScene
              mesh={mesh}
              observerHeightM={visualH}
              siteColor={SITE_HEX[focusSite]}
              directions={isPreview ? NO_DIRECTIONS : directions}
              sightLine={isPreview ? null : sightLine}
              exaggeration={exaggeration}
              preset={preset}
              lightEnu={lightEnu}
              azimuthDeg={isPreview ? null : azimuth}
              labels={isPreview ? { observer: "", sight: "" } : sceneLabels}
              label={L(
                `Terreno 3D real de Connecting Ridge alrededor de ${SITE_META[focusSite].label}, con el observador a ${heightM} m y la línea de visión hacia el obstáculo del horizonte.`,
                `Real 3D terrain of Connecting Ridge around ${SITE_META[focusSite].label}, with the observer at ${heightM} m and the line of sight to the horizon obstacle.`,
              )}
            />
            {isPreview ? (
              <div className="absolute top-3 left-3 max-w-[min(24rem,80%)] rounded-xl border border-warn/60 bg-[#14100ae6] px-3 py-2" data-testid="tower-preview-banner" role="status">
                <p className="text-sm font-bold text-warn sm:text-base">{L("Vista previa de la torre · sin cálculo de visibilidad a esta altura", "Tower preview · no visibility computed at this height")}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{L("Solo hay resultados calculados a 0, 2 y 10 m.", "Computed results exist only at 0, 2 and 10 m.")}</p>
                <div className="mt-1.5 flex gap-1.5">
                  {COMPUTED_HEIGHTS.map((h) => (
                    <button key={h} type="button" onClick={() => onSlider(h)} className="rounded-md border border-line-strong px-2 py-0.5 text-xs font-semibold text-ink hover:bg-surface-3">
                      {L(`Ir a ${h} m`, `Go to ${h} m`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : conclusion ? (
              <div className="pointer-events-none absolute top-3 left-3 max-w-[min(22rem,70%)] rounded-xl border border-line-strong bg-[#050912d9] px-3 py-2 backdrop-blur-sm" data-testid="terrain-conclusion" aria-live="polite">
                <p className={`text-base font-bold sm:text-lg ${conclusion.tone === "ok" ? "text-ok" : conclusion.tone === "hidden" ? "text-warn" : "text-ink"}`}>{conclusion.title}</p>
                <p className="tabular text-xs text-ink-muted sm:text-sm">{conclusion.line}</p>
                {"margin" in conclusion && conclusion.margin !== null && conclusion.margin !== undefined ? (
                  <p className="tabular text-[11px] text-ink-faint">
                    {L("Margen sobre el horizonte", "Margin above the horizon")} {conclusion.margin >= 0 ? "+" : "−"}
                    {formatDeg(Math.abs(conclusion.margin), 2)}
                  </p>
                ) : null}
              </div>
            ) : null}
            <CompassBadge azimuthDeg={isPreview ? null : azimuth} sunAz={!isPreview && ephData ? ephData.series.bodies.SUN.azimuth_deg[timeIndex] : null} earthAz={!isPreview && ephData ? ephData.series.bodies.EARTH.azimuth_deg[timeIndex] : null} />
          </div>
          {/* Mapa orbital real en planta: posición del observador y dirección hasta el relieve */}
          <figure className="flex min-w-0 flex-col gap-1.5 border-t border-line p-2 lg:border-t-0 lg:border-l" data-testid="terrain-map">
            {!isPreview && overlay && !obstacle?.unknown ? (
              <GeoMap key={obstacle && obstacle.distanceM > 30000 ? "wac" : "nac"} compact compactHeightClass="h-[300px] lg:h-[clamp(320px,calc(100dvh-320px),560px)]" sites={core.sites} focusSite={focusSite} overlay={overlay} initialBasemap={obstacle && obstacle.distanceM > 30000 ? "wac" : "nac"} />
            ) : (
              <GeoMap key="nac-site" compact compactHeightClass="h-[300px] lg:h-[clamp(320px,calc(100dvh-320px),560px)]" sites={core.sites} focusSite={focusSite} followFocus showCredit />
            )}
            <figcaption className="px-1 text-[11px] leading-snug text-ink-faint">
              {isPreview
                ? L("Vista en planta del sitio (NASA Moon Trek). Sin dirección dibujada: esta altura no tiene cálculo.", "Plan view of the site (NASA Moon Trek). No direction drawn: this height has no computation.")
                : L("En planta (NASA Moon Trek): del sitio al relieve que fija el horizonte, también fuera del recorte 3D.", "Plan view (NASA Moon Trek): from the site to the terrain that sets the horizon, also outside the 3D crop.")}{" "}
              <Link href={`/explore/?${query}`} className="text-accent underline underline-offset-2">
                {L("Abrir en Explore", "Open in Explore")}
              </Link>
            </figcaption>
          </figure>
          </div>
        ) : (
          <div className="h-[clamp(360px,calc(100dvh-250px),600px)] animate-pulse bg-bg-2" aria-busy="true" />
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface/80 px-3 py-2 text-xs">
          {(
            [
              ["tower", L("Torre y visual", "Tower and sightline")],
              ["overview", L("Vista amplia del recorte", "Wide view of the crop")],
              ["behind", L("Mirar hacia el relieve", "Look towards the terrain")],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={preset.view === v} onClick={() => setPreset((p) => ({ view: v, nonce: p.nonce + 1 }))} className={toolBtn(preset.view === v)}>
              {label}
            </button>
          ))}
          <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-muted">
            <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: SUN_HEX }} />{L("Sol", "Sun")}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: EARTH_HEX }} />{L("Tierra", "Earth")}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-1 w-4 rounded bg-uncertainty" />{L("visual hasta el relieve que fija el horizonte", "sightline to the terrain that sets the horizon")}</span>
            <NatureBadge nature="DERIVED" />
          </span>
        </div>
      </div>

      {explain && !isPreview ? (
        <p className="text-sm leading-relaxed text-ink-muted" data-testid="terrain-explain">
          {explain}
        </p>
      ) : null}

      {!isNominal ? (
        <Callout tone="uncertainty" icon="info">
          {L(
            `Superficie «${VARIANT_LABEL[variant]}»: el paquete solo trae direcciones de Sol y Tierra para la superficie nominal, así que aquí se consulta el horizonte de esta superficie por azimut. ${meshSurface === "nominal" ? "La malla dibujada es el DEM nominal: esta hipótesis propia no se reconstruye en la web." : "La malla dibujada es el recorte de este clon publicado (verificado con SHA-256)."}`,
            `Surface “${VARIANT_LABEL[variant]}”: the package only carries Sun and Earth directions for the nominal surface, so here this surface's horizon is queried by azimuth. ${meshSurface === "nominal" ? "The mesh drawn is the nominal DEM: this team hypothesis is not reconstructed on the web." : "The mesh drawn is the crop of this published clone (verified with SHA-256)."}`,
          )}
        </Callout>
      ) : null}


      {isPreview ? (
        <p className="rounded-lg border border-line bg-bg-2/70 px-3 py-2 text-xs text-ink-muted" data-testid="last-computed">
          {L(`Debajo: último análisis CALCULADO, a ${heightM} m. No corresponde a la torre de ${formatNumber(visualH, 1)} m de la vista previa.`, `Below: last COMPUTED analysis, at ${heightM} m. It does not correspond to the ${formatNumber(visualH, 1)} m preview tower.`)}
        </p>
      ) : null}
      <div className={`rounded-xl border border-uncertainty/40 bg-uncertainty-soft p-4 ${isPreview ? "opacity-55" : ""}`} data-testid="obstacle-readout" aria-live="polite">
        <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-uncertainty">
          <Icon name="eye" className="size-4" />
          {effectiveMode === "manual" ? L("Horizonte en el azimut elegido", "Horizon at the chosen azimuth") : L(`Qué limita la visión de ${bodyName}`, `What limits the view of the ${bodyName}`)}
          {engineVisible === null ? null : engineVisible ? <Badge tone="ok" icon="check">{L("Centro visible (motor)", "Centre visible (engine)")}</Badge> : <Badge tone="neutral">{L("Centro oculto (motor)", "Centre hidden (engine)")}</Badge>}
          <InfoTip>
            {L(
              "Malla construida con muestras reales del DEM PGDA78 (una de cada dos: vértices cada 10 m), en su posición física con curvatura lunar. La visibilidad no se calcula aquí: se lee del motor.",
              "Mesh built from real PGDA78 DEM samples (every other one: vertices every 10 m), at their physical position with lunar curvature. Visibility is not computed here: it is read from the engine.",
            )}
          </InfoTip>
        </p>
        {obstacle ? (
          obstacle.unknown ? (
            <p className="mt-2 text-sm text-ink-muted">{L("El motor marca este azimut como desconocido: no se señala ningún obstáculo.", "The engine marks this azimuth as unknown: no obstacle is shown.")}</p>
          ) : (
            <dl className="mt-2 grid text-sm sm:grid-cols-2 sm:gap-x-8">
              {rows.map(([k, v]) => (
                <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-uncertainty/15 py-1.5">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="tabular text-right font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )
        ) : (
          <p className="mt-2 text-sm text-ink-muted">{L("Cargando horizonte y direcciones…", "Loading horizon and directions…")}</p>
        )}
        {obstacle && !obstacle.unknown ? (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            {insideWindow
              ? L("El obstáculo está dentro del recorte 3D: la línea violeta llega hasta él.", "The obstacle is inside the 3D crop: the violet line reaches it.")
              : L("El obstáculo está FUERA del recorte 3D de 4 km: la línea discontinua termina en el borde del recorte; su posición real aparece en el mapa.", "The obstacle is OUTSIDE the 4 km 3D crop: the dashed line ends at the crop edge; its real position is on the map.")}{" "}
            {L(
              `Se usa la muestra del horizonte del motor más cercana (azimut ${formatDeg(obstacle.sampleAzimuthDeg, 2)}), localizada con su mismo rayo curvo.`,
              `The nearest engine horizon sample is used (azimuth ${formatDeg(obstacle.sampleAzimuthDeg, 2)}), located with the same curved ray.`,
            )}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
          {mesh
            ? L(
                `${formatNumber(mesh.cols * mesh.rows, 0)} vértices = muestras reales del DEM cada ${mesh.spacingM} m (ventana de 4 × 4 km, ${mesh.nodataVertices} sin dato), sombreado en gris mineral por una luz de escena rasante y lateral a la mirada, que no proyecta sombras ni representa al Sol: no es el cálculo de visibilidad. Exageración ×${exaggeration}${exaggeration > 1 ? " solo en el dibujo" : " (escala real)"}. La torre en celosía es infraestructura ilustrativa (forma estilizada); su remate está a la altura real del observador, ${heightM} m, que es el origen de la visual. Las flechas indican direcciones; el Sol y la Tierra no están a esa distancia.`,
                `${formatNumber(mesh.cols * mesh.rows, 0)} vertices = real DEM samples every ${mesh.spacingM} m (4 × 4 km window, ${mesh.nodataVertices} without data), shaded in mineral grey by a grazing scene light from the side of the view, which casts no shadows and does not represent the Sun: it is not the visibility computation. Exaggeration ×${exaggeration}${exaggeration > 1 ? " in the drawing only" : " (true scale)"}. The lattice tower is illustrative infrastructure (stylised shape); its top is at the real observer height, ${heightM} m, which is where the sightline starts. Arrows show directions; the Sun and Earth are not at that distance.`,
              )
            : null}{" "}
          <Link href={evidenceHref("pgda78.site01.elevation")} className="text-accent underline-offset-2 hover:underline">
            {L("Procedencia del DEM", "DEM provenance")}
          </Link>
        </p>
      </div>
    </section>
  );
}
