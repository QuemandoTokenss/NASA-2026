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
import { Segmented } from "../ui/Controls";
import { Badge, Callout, NatureBadge } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { InfoTip } from "../ui/Interactive";
import { Panel } from "../ui/Panel";
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

export function TerrainPanel({ core }: { core: Core }) {
  const { selection, dispatch, query, restored } = useSelection();
  const { focusSite, windowId, heightM, variant, timeIndex } = selection;
  const isNominal = variant === "nominal";
  const [grids, setGrids] = useState<Record<string, RasterGrid>>({});
  const [gridError, setGridError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("sun");
  const [manualAz, setManualAz] = useState(0);
  const [exaggeration, setExaggeration] = useState(1);
  const [preset, setPreset] = useState<{ view: ViewPreset; nonce: number }>({ view: "tower", nonce: 0 });
  // Al cambiar de altura o de sitio se reencuadra la vista actual (la torre cambia de tamaño).
  useEffect(() => {
    const t = setTimeout(() => setPreset((p) => ({ view: p.view, nonce: p.nonce + 1 })), 0);
    return () => clearTimeout(t);
  }, [heightM, focusSite]);

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
    const s = ephData.series.bodies;
    return [
      { enu: directionENU(s.SUN.azimuth_deg[timeIndex], s.SUN.elevation_deg[timeIndex]), color: SUN_HEX, label: L("Sol", "Sun") },
      { enu: directionENU(s.EARTH.azimuth_deg[timeIndex], s.EARTH.elevation_deg[timeIndex]), color: EARTH_HEX, label: L("Tierra", "Earth") },
    ];
  }, [ephData, timeIndex]);
  // Luz de la escena: desde el azimut real del Sol pero a 25° de altura fija, para que el relieve se lea.
  const lightEnu = useMemo(() => (ephData ? directionENU(ephData.series.bodies.SUN.azimuth_deg[timeIndex], 25) : null), [ephData, timeIndex]);

  const overlay = useMemo(() => (obstacle ? { line: [{ x: site.x_m, y: site.y_m }, obstacle.point], point: obstacle.point, label: L("Obstáculo", "Obstacle") } : undefined), [obstacle, site.x_m, site.y_m]);

  const times = clock.status === "ready" ? clock.data.value.times_utc : null;
  const stateCode = scen.status === "ready" ? getScenarioSeries(scen.data.value.rows, focusSite, variant)?.state_codes[timeIndex] : undefined;
  const engineVisible = stateCode === undefined || effectiveMode === "manual" ? null : effectiveMode === "sun" ? sunVisible(stateCode) : earthVisible(stateCode);
  const bodyName = effectiveMode === "sun" ? L("Sol", "Sun") : L("Tierra", "Earth");
  const obstacleLonLat = obstacle ? xyToLonLat(obstacle.point.x, obstacle.point.y) : null;
  const step = (d: number) => dispatch({ type: "setTimeIndex", value: Math.max(0, Math.min(4319, timeIndex + d)) });

  const sceneLabels = useMemo<SceneLabels>(
    () => ({ observer: heightM > 0 ? `${L("Observador", "Observer")} · ${heightM} m` : `${L("Observador", "Observer")} · ${L("a ras del suelo", "at ground level")}`, sight: `${L("Dirección de mirada", "Viewing direction")} · ${azimuth === null ? "—" : formatDeg(azimuth, 1)}` }),
    [heightM, azimuth],
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

  return (
    <Panel
      title={`${L("Terreno 3D del DEM y obstáculo del horizonte", "3D DEM terrain and horizon obstacle")} · ${SITE_META[focusSite].label} · ${heightM} m`}
      icon="mountain"
      actions={
        <>
          <NatureBadge nature="DERIVED" />
          <InfoTip>
            {L(
              "Malla construida con muestras reales del DEM PGDA78 (una de cada dos: vértices cada 10 m), en su posición física con curvatura lunar. La visibilidad no se calcula aquí: se lee del motor.",
              "Mesh built from real PGDA78 DEM samples (every other one: vertices every 10 m), at their physical position with lunar curvature. Visibility is not computed here: it is read from the engine.",
            )}
          </InfoTip>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-testid="terrain-panel" data-preset={preset.view} data-mesh-surface={meshSurface} data-mesh-ready={mesh ? "true" : "false"}>
        <div className="flex flex-wrap items-end gap-4">
          <Segmented
            label={L("¿Qué tapa…?", "What blocks…?")}
            value={effectiveMode}
            onChange={setMode}
            options={[
              { value: "sun", label: L("el Sol", "the Sun"), disabled: !isNominal },
              { value: "earth", label: L("la Tierra", "the Earth"), disabled: !isNominal },
              { value: "manual", label: L("un azimut", "an azimuth") },
            ]}
          />
          {effectiveMode === "manual" ? (
            <label className="flex min-w-56 flex-1 items-center gap-3 text-xs text-ink-muted">
              {L("Azimut", "Azimuth")}
              <input type="range" min={0} max={359.75} step={0.25} value={manualAz} onChange={(e) => setManualAz(Number(e.target.value))} className="flex-1 accent-[#a78bfa]" aria-valuetext={`${manualAz}°`} />
              <span className="tabular w-16 text-right text-ink">{formatDeg(manualAz, 2)}</span>
            </label>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
              <span className="tabular mr-1 text-ink">{times ? formatUtc(times[timeIndex]) : "…"}</span>
              {(
                [
                  [-144, L("−1 día", "−1 day")],
                  [-6, "−1 h"],
                  [6, "+1 h"],
                  [144, L("+1 día", "+1 day")],
                ] as const
              ).map(([d, label]) => (
                <button key={d} type="button" onClick={() => step(d)} className="rounded-lg border border-line-strong bg-surface-2 px-2 py-1 font-medium text-ink hover:bg-surface-3">
                  {label}
                </button>
              ))}
              <Link href={`/timeline/?${query}`} className="ml-1 text-accent underline-offset-2 hover:underline">
                Timeline
              </Link>
            </div>
          )}
          <label className="ml-auto flex items-center gap-2 text-xs text-ink-muted">
            {L("Exageración vertical", "Vertical exaggeration")}
            <select value={exaggeration} onChange={(e) => setExaggeration(Number(e.target.value))} className="rounded-lg border border-line-strong bg-surface-2 px-2 py-1 text-ink">
              {[1, 2, 5].map((x) => (
                <option key={x} value={x}>
                  ×{x}
                </option>
              ))}
            </select>
          </label>
        </div>

        {explain ? (
          <p className="rounded-xl border border-accent/30 bg-accent-surface/40 px-4 py-3 text-base leading-relaxed text-ink" data-testid="terrain-explain" aria-live="polite">
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

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            {gridError ? (
              <Callout tone="danger" icon="alert" title={L("DEM no disponible", "DEM unavailable")}>
                {gridError} {L("No se dibuja un terreno de sustitución.", "No substitute terrain is drawn.")}
              </Callout>
            ) : mesh ? (
              <div className="relative">
              <TerrainScene
                mesh={mesh}
                observerHeightM={heightM}
                siteColor={SITE_HEX[focusSite]}
                directions={directions}
                sightLine={sightLine}
                exaggeration={exaggeration}
                preset={preset}
                lightEnu={lightEnu}
                azimuthDeg={azimuth}
                labels={sceneLabels}
                label={L(
                  `Terreno 3D real de Connecting Ridge alrededor de ${SITE_META[focusSite].label}, con el observador a ${heightM} m y la línea de visión hacia el obstáculo del horizonte.`,
                  `Real 3D terrain of Connecting Ridge around ${SITE_META[focusSite].label}, with the observer at ${heightM} m and the line of sight to the horizon obstacle.`,
                )}
              />
              <CompassBadge azimuthDeg={azimuth} sunAz={ephData ? ephData.series.bodies.SUN.azimuth_deg[timeIndex] : null} earthAz={ephData ? ephData.series.bodies.EARTH.azimuth_deg[timeIndex] : null} />
              </div>
            ) : (
              <div className="h-[520px] animate-pulse rounded-xl border border-line bg-bg-2" aria-busy="true" />
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(
                [
                  ["tower", L("Torre y visual", "Tower and sightline")],
                  ["overview", L("Vista amplia del recorte", "Wide view of the crop")],
                  ["behind", L("Mirar hacia el relieve", "Look towards the terrain")],
                ] as const
              ).map(([v, label]) => (
                <button key={v} type="button" aria-pressed={preset.view === v} onClick={() => setPreset((p) => ({ view: v, nonce: p.nonce + 1 }))} className={`rounded-lg border px-2.5 py-1.5 font-medium text-ink hover:bg-surface-3 ${preset.view === v ? "border-accent bg-accent-surface" : "border-line-strong bg-surface-2"}`}>
                  {label}
                </button>
              ))}
              <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-muted">
                <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: SUN_HEX }} />{L("hacia el Sol", "to the Sun")}</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: EARTH_HEX }} />{L("hacia la Tierra", "to the Earth")}</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-uncertainty" />{L("dirección de mirada hasta el relieve que limita la vista", "viewing direction to the terrain that limits the view")}</span>
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-ink-faint">
              {mesh
                ? L(
                    `${formatNumber(mesh.cols * mesh.rows, 0)} vértices = muestras reales del DEM cada ${mesh.spacingM} m (ventana de 4 × 4 km, ${mesh.nodataVertices} sin dato). Color por altura (${formatNumber(mesh.minHeight, 0)}–${formatNumber(mesh.maxHeight, 0)} m). Exageración ×${exaggeration}${exaggeration > 1 ? " solo en el dibujo" : " (escala real)"}. La torre en celosía es infraestructura ilustrativa (forma estilizada); su remate está a la altura real del observador, ${heightM} m, que es el origen de la visual. El anillo y la brújula son marcadores. La luz de la escena viene del azimut solar con altura fija y no proyecta sombras: no es el cálculo de visibilidad. Las flechas indican direcciones; el Sol y la Tierra no están a esa distancia.`,
                    `${formatNumber(mesh.cols * mesh.rows, 0)} vertices = real DEM samples every ${mesh.spacingM} m (4 × 4 km window, ${mesh.nodataVertices} without data). Colour by height (${formatNumber(mesh.minHeight, 0)}–${formatNumber(mesh.maxHeight, 0)} m). Exaggeration ×${exaggeration}${exaggeration > 1 ? " in the drawing only" : " (true scale)"}. The lattice tower is illustrative infrastructure (stylised shape); its top is at the real observer height, ${heightM} m, which is where the sightline starts. The ring and compass are markers. The scene light comes from the solar azimuth at a fixed height and casts no shadows: it is not the visibility computation. Arrows show directions; the Sun and Earth are not at that distance.`,
                  )
                : null}{" "}
              <Link href={evidenceHref("pgda78.site01.elevation")} className="text-accent underline-offset-2 hover:underline">
                {L("Procedencia del DEM", "DEM provenance")}
              </Link>
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="rounded-xl border border-uncertainty/40 bg-uncertainty-soft p-4" data-testid="obstacle-readout" aria-live="polite">
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-uncertainty">
                <Icon name="eye" className="size-4" />
                {effectiveMode === "manual" ? L("Horizonte en el azimut elegido", "Horizon at the chosen azimuth") : L(`Qué limita la visión de ${bodyName}`, `What limits the view of the ${bodyName}`)}
                {engineVisible === null ? null : engineVisible ? <Badge tone="ok" icon="check">{L("Centro visible (motor)", "Centre visible (engine)")}</Badge> : <Badge tone="neutral">{L("Centro oculto (motor)", "Centre hidden (engine)")}</Badge>}
              </p>
              {obstacle ? (
                obstacle.unknown ? (
                  <p className="mt-2 text-sm text-ink-muted">{L("El motor marca este azimut como desconocido: no se señala ningún obstáculo.", "The engine marks this azimuth as unknown: no obstacle is shown.")}</p>
                ) : (
                  <dl className="mt-2 flex flex-col text-sm">
                    {rows.map(([k, v]) => (
                      <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-uncertainty/15 py-1.5 last:border-b-0">
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
                    : L("El obstáculo está FUERA del recorte 3D de 4 km: la línea discontinua solo indica la dirección; su posición real aparece en el mapa.", "The obstacle is OUTSIDE the 4 km 3D crop: the dashed line only shows the direction; its real position is on the map.")}{" "}
                  {L(
                    `Se usa la muestra del horizonte del motor más cercana (azimut ${formatDeg(obstacle.sampleAzimuthDeg, 2)}), localizada con su mismo rayo curvo.`,
                    `The nearest engine horizon sample is used (azimuth ${formatDeg(obstacle.sampleAzimuthDeg, 2)}), located with the same curved ray.`,
                  )}
                </p>
              ) : null}
            </div>
            {overlay && !obstacle?.unknown ? <GeoMap key={obstacle && obstacle.distanceM > 30000 ? "wac" : "nac"} compact sites={core.sites} focusSite={focusSite} overlay={overlay} initialBasemap={obstacle && obstacle.distanceM > 30000 ? "wac" : "nac"} /> : null}
            <p className="text-[11px] text-ink-faint">
              {L("Mapa: imágenes orbitales reales (NASA Moon Trek) con la visual desde el sitio hasta el obstáculo.", "Map: real orbital images (NASA Moon Trek) with the line from the site to the obstacle.")}{" "}
              <Link href={`/explore/?${query}`} className="text-accent underline-offset-2 hover:underline">
                {L("Abrir en Explore", "Open in Explore")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
