"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { variantFamily, type HeightM, type SiteId } from "@/lib/contract/constants";
import type { Core } from "@/lib/contract/schema";
import { useChunk } from "@/lib/data/DataProvider";
import { heightToK, isHalfStep, loadHeightHorizon, loadHeightScenario } from "@/lib/data/engineerHeights";
import { loadEphemerisClock, loadEphemerisSite, loadHorizonChunk, loadScenarioChunk } from "@/lib/data/loader";
import { getScenarioSeries, getSite } from "@/lib/data/selectors";
import { formatDeg, formatNumber, formatUtc } from "@/lib/format";
import { HORIZON_SOURCE_RESOLUTION_M, horizonObstacle } from "@/lib/geospatial/horizon";
import { rayPoint, xyToLonLat } from "@/lib/geospatial/lunar";
import { buildTerrainMesh, directionENU, localFrame, toLocal } from "@/lib/geospatial/mesh";
import type { RasterGrid } from "@/lib/geospatial/raster";
import { blockBounds, blockForObstacle, sampleRegional } from "@/lib/geospatial/regional";
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
import { useRegionalTerrain } from "./useRegionalTerrain";

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
const NO_LABELS: SceneLabels = { observer: "", sight: "" };

/** Estado de la altura de Engineer que se comparte con la página (métricas de debajo). */
export interface EngineerHeightState {
  /** Altura de la torre dibujada (sigue al deslizador sin esperar). */
  towerH: number;
  /** Altura cuyo resultado se pide y se muestra (tras una pausa breve o al soltar). */
  analysisH: number;
  /** v01: 0/2/10 del paquete original · extended: paquete de alturas de Engineer (nominal) · preview: sin cálculo. */
  kind: "v01" | "extended" | "preview";
  /** `true` cuando lo visible corresponde a `analysisH` (datos cargados y sin arrastre pendiente). */
  ready: boolean;
}

const isV01 = (h: number): h is HeightM => h === 0 || h === 2 || h === 10;
/** Pausa del deslizador antes de pedir el resultado de una altura (el arrastre no hace peticiones). */
const SETTLE_MS = 180;

export function TerrainPanel({ core, onHeightState }: { core: Core; onHeightState?: (s: EngineerHeightState) => void }) {
  const { selection, dispatch, query, restored } = useSelection();
  const { focusSite, windowId, heightM, variant, timeIndex } = selection;
  const isNominal = variant === "nominal";
  const [grids, setGrids] = useState<Record<string, RasterGrid>>({});
  const [gridError, setGridError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("sun");
  const [manualAz, setManualAz] = useState(0);
  const [exaggeration, setExaggeration] = useState(1);
  const [preset, setPreset] = useState<{ view: ViewPreset; nonce: number }>({ view: "tower", nonce: 0 });
  // Torre (inmediata) y altura de análisis (asentada). Fuera de 0/2/10 no se toca la URL analítica (`h`).
  const [towerH, setTowerH] = useState<number>(heightM);
  const [analysisH, setAnalysisH] = useState<number>(heightM);
  const [retry, setRetry] = useState(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = (v: number) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    setTowerH(v);
    setAnalysisH(v);
    if (isV01(v) && v !== heightM) dispatch({ type: "setHeight", value: v });
  };
  const onSlider = (raw: number, immediate = false) => {
    const v = Math.round(raw * 2) / 2;
    setTowerH(v);
    if (immediate) return commit(v);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => commit(v), SETTLE_MS);
  };
  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);
  // La URL (atrás/adelante, enlaces) manda sobre 0/2/10: si cambia `h`, se adopta.
  const [seenHeight, setSeenHeight] = useState(heightM);
  if (seenHeight !== heightM) {
    setSeenHeight(heightM);
    if (isV01(analysisH) && analysisH !== heightM) {
      setTowerH(heightM);
      setAnalysisH(heightM);
    }
  }
  // Apertura directa de una altura de Engineer: `?torre=19.5` (solo lectura al restaurar).
  const [torreRead, setTorreRead] = useState(false);
  if (restored && !torreRead) {
    setTorreRead(true);
    const t = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("torre");
    const v = t === null ? NaN : Number(t);
    if (isHalfStep(v) && !isV01(v)) {
      setTowerH(v);
      setAnalysisH(v);
    }
  }
  const extended = isNominal && !isV01(analysisH);
  const isPreview = !isNominal && !isV01(analysisH);
  const settled = towerH === analysisH;
  const k = heightToK(analysisH);
  // Reflejar la altura de Engineer en `torre` (y quitarla en 0/2/10 o fuera del nominal).
  useEffect(() => {
    if (!restored || !torreRead) return;
    const u = new URL(window.location.href);
    if (extended) u.searchParams.set("torre", String(analysisH));
    else u.searchParams.delete("torre");
    if (u.search !== window.location.search) window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}${u.hash}`);
  }, [restored, torreRead, extended, analysisH]);
  // Al cambiar de altura o de sitio se reencuadra la vista actual (la torre cambia de tamaño).
  useEffect(() => {
    const t = setTimeout(() => setPreset((p) => ({ view: p.view, nonce: p.nonce + 1 })), 0);
    return () => clearTimeout(t);
  }, [focusSite, towerH]);

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

  // 0/2/10: paquete original (todas las superficies). Resto en nominal: paquete de alturas de Engineer.
  const v01H: HeightM | null = isV01(analysisH) ? analysisH : null;
  const horizon = useChunk(restored && v01H !== null ? () => loadHorizonChunk(focusSite, v01H) : null, [focusSite, v01H]);
  const eph = useChunk(restored && isNominal && v01H !== null ? () => loadEphemerisSite(windowId, focusSite, v01H) : null, [windowId, focusSite, v01H, isNominal]);
  const clock = useChunk(restored ? () => loadEphemerisClock(core, windowId) : null, [windowId]);
  const scen = useChunk(restored && v01H !== null ? () => loadScenarioChunk(core, windowId, v01H) : null, [windowId, v01H]);
  // La clave incluye sitio, ventana y altura: una respuesta de otra altura nunca se muestra (useChunk devuelve «loading»).
  const xh = useChunk(restored && extended ? () => loadHeightHorizon(focusSite, k) : null, [focusSite, k, extended, retry]);
  const xs = useChunk(restored && extended ? () => loadHeightScenario(windowId, focusSite, k) : null, [windowId, focusSite, k, extended, retry]);

  const site = getSite(core, focusSite)!;
  const nominalGround = site.nominal_height_m;
  const groundZ = core.horizons_index[focusSite].observer_ground_height_m[variant];
  // Origen vertical en el suelo de la superficie dibujada (para el nominal, nominal_height_m).
  const frameGround = meshSurface === "nominal" ? nominalGround : groundZ;
  const frame = useMemo(() => localFrame({ x: site.x_m, y: site.y_m }, frameGround), [site.x_m, site.y_m, frameGround]);
  const mesh = useMemo(() => (grid ? buildTerrainMesh(grid, frame, MESH_STEP) : null), [grid, frame]);

  const ephData = extended ? (xs.status === "ready" ? xs.data.value : null) : eph.status === "ready" ? eph.data.value : null;
  const xhValue = xh.status === "ready" ? xh.data.value : null;
  const v01Horizon = horizon.status === "ready" ? horizon.data.value : null;
  const horizonData = useMemo(
    () =>
      extended
        ? xhValue && { azimuth_deg: xhValue.azimuth_deg, profile: xhValue.profile }
        : v01Horizon && { azimuth_deg: v01Horizon.azimuth_deg, profile: v01Horizon.variants[variant] },
    [extended, xhValue, v01Horizon, variant],
  );
  const extError = extended ? (xh.status === "error" ? xh.error : xs.status === "error" ? xs.error : null) : null;
  const dataReady = !isPreview && horizonData !== null && (!isNominal || ephData !== null);
  // Lo visible solo se dibuja cuando corresponde exactamente a la altura de la torre.
  const showData = dataReady && settled;
  const loading = !isPreview && !showData && !extError;
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
    return horizonObstacle(horizonData.azimuth_deg, horizonData.profile, { lonEastDeg: site.longitude_east_deg, latDeg: site.latitude_deg }, groundZ + analysisH, azimuth);
  }, [horizonData, azimuth, site.longitude_east_deg, site.latitude_deg, groundZ, analysisH]);

  const insideWindow = obstacle ? obstacle.point.x >= TERRAIN_BOUNDS[0] && obstacle.point.x <= TERRAIN_BOUNDS[2] && obstacle.point.y >= TERRAIN_BOUNDS[1] && obstacle.point.y <= TERRAIN_BOUNDS[3] : false;

  // Relieve regional (PGDA90): anillos fijos alrededor del sitio y, bajo demanda, los bloques nativos de la visual.
  const siteGeo = useMemo(() => ({ x: site.x_m, y: site.y_m, lonEastDeg: site.longitude_east_deg, latDeg: site.latitude_deg }), [site.x_m, site.y_m, site.longitude_east_deg, site.latitude_deg]);
  const regionalRay = useMemo(
    () => (obstacle && !obstacle.unknown && !insideWindow ? { azimuthDeg: obstacle.sampleAzimuthDeg, distanceM: obstacle.distanceM } : null),
    [obstacle, insideWindow],
  );
  const regional = useRegionalTerrain(frame, siteGeo, regionalRay);
  // El obstáculo fuera del recorte local: ¿hay relieve NATIVO cargado en ese punto? (el mismo punto X/Y del motor que usa el mapa)
  const regionalHit = useMemo(() => {
    if (!obstacle || obstacle.unknown || insideWindow) return null;
    const block = blockForObstacle(obstacle.point, obstacle.source);
    if (!block) return { status: "uncovered" as const };
    const grid = regional.grids.find((g) => g.entry.id === block.id);
    if (!grid) return { status: "loading" as const, blockId: block.id };
    const s = sampleRegional([grid], obstacle.point.x, obstacle.point.y);
    if (!s || !Number.isFinite(s.heightM)) return { status: "uncovered" as const };
    return { status: "ready" as const, blockId: block.id, heightM: s.heightM, deltaM: s.heightM - obstacle.heightM, spacingM: grid.spacingM };
  }, [obstacle, insideWindow, regional.grids]);

  const fmtDist = (m: number) => (m >= 1000 ? `${formatNumber(m / 1000, 2)} km` : `${formatNumber(m, 0)} m`);
  const sightLine = useMemo<SceneSightLine | null>(() => {
    if (!obstacle || obstacle.unknown) return null;
    if (insideWindow)
      return { end: toLocal(frame, obstacle.point.x, obstacle.point.y, obstacle.heightM), reachesObstacle: true, endLabel: `${L("Relieve que limita la vista", "Terrain that limits the view")} · ${fmtDist(obstacle.distanceM)}` };
    // Fuera del recorte local pero con el bloque regional nativo cargado: la visual llega hasta la cresta.
    if (regionalHit?.status === "ready")
      return { end: toLocal(frame, obstacle.point.x, obstacle.point.y, obstacle.heightM), reachesObstacle: true, endLabel: `${L("Cresta regional que limita la vista", "Regional ridge that limits the view")} · ${fmtDist(obstacle.distanceM)}` };
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
      end: [d[0] * exit, d[1] * exit, d[2] * exit + analysisH],
      reachesObstacle: false,
      endLabel: `${regionalHit?.status === "loading" ? L("Cargando relieve regional", "Loading regional terrain") : L("Límite del visor 3D", "3D viewer limit")} · ${L("relieve a", "terrain at")} ${fmtDist(obstacle.distanceM)}`,
    };
  }, [obstacle, insideWindow, regionalHit, frame, analysisH, site.longitude_east_deg, site.latitude_deg]);

  const stateCode = extended ? (xs.status === "ready" ? xs.data.value.state_codes[timeIndex] : undefined) : scen.status === "ready" ? getScenarioSeries(scen.data.value.rows, focusSite, variant)?.state_codes[timeIndex] : undefined;
  const directions = useMemo<SceneDirection[]>(() => {
    if (!ephData) return [];
    // Si un cuerpo está a < 12° de la dirección de mirada, su etiqueta se integra en la de la visual.
    const near = (az: number) => azimuth !== null && Math.abs(((az - azimuth + 540) % 360) - 180) < 12;
    const s = ephData.series.bodies;
    return [
      // Marcador atenuado si el motor da el centro por tapado (estado 4 = desconocido: sin atenuar ni afirmar).
      { enu: directionENU(s.SUN.azimuth_deg[timeIndex], s.SUN.elevation_deg[timeIndex]), color: SUN_HEX, body: "sun", ray: effectiveMode === "sun", occluded: stateCode !== undefined && stateCode !== 4 && !sunVisible(stateCode), label: near(s.SUN.azimuth_deg[timeIndex]) ? undefined : L("Sol", "Sun") },
      { enu: directionENU(s.EARTH.azimuth_deg[timeIndex], s.EARTH.elevation_deg[timeIndex]), color: EARTH_HEX, body: "earth", ray: effectiveMode === "earth", occluded: stateCode !== undefined && stateCode !== 4 && !earthVisible(stateCode), label: near(s.EARTH.azimuth_deg[timeIndex]) ? undefined : L("Tierra", "Earth") },
    ];
  }, [ephData, timeIndex, azimuth, stateCode, effectiveMode]);
  // Luz de la escena = Sol del motor para ESTE sitio, instante, altura y superficie (misma transformación
  // ENU que su marcador), y solo si el motor lo da por visible. No depende de la mirada ni de la cámara.
  // Sol oculto, estado desconocido, carga o superficie sin efemérides compatibles → luz neutra, sin sombra solar.
  const sunAz = ephData ? ephData.series.bodies.SUN.azimuth_deg[timeIndex] : null;
  const sunEl = ephData ? ephData.series.bodies.SUN.elevation_deg[timeIndex] : null;
  const sunLit = showData && sunAz !== null && sunEl !== null && stateCode !== undefined && stateCode !== 4 && sunVisible(stateCode);
  const lightEnu = useMemo(() => (sunLit && sunAz !== null && sunEl !== null ? directionENU(sunAz, sunEl) : null), [sunLit, sunAz, sunEl]);

  // Cobertura del visor 3D en el mapa: recorte local de 5 m y bloques regionales nativos (80 m) cargados.
  const coverage = useMemo(() => [TERRAIN_BOUNDS as [number, number, number, number], ...regional.grids.filter((g) => g.entry.level === "L0").map((g) => blockBounds(g.entry))], [regional.grids]);
  const overlay = useMemo(
    () => (obstacle ? { line: [{ x: site.x_m, y: site.y_m }, obstacle.point], point: obstacle.point, label: regionalHit?.status === "ready" ? L("Cresta", "Ridge") : L("Obstáculo", "Obstacle"), areas: coverage } : undefined),
    [obstacle, site.x_m, site.y_m, coverage, regionalHit?.status],
  );

  const times = clock.status === "ready" ? clock.data.value.times_utc : null;
  const engineVisible = stateCode === undefined || effectiveMode === "manual" ? null : effectiveMode === "sun" ? sunVisible(stateCode) : earthVisible(stateCode);
  const bodyName = effectiveMode === "sun" ? L("Sol", "Sun") : L("Tierra", "Earth");
  const obstacleLonLat = obstacle ? xyToLonLat(obstacle.point.x, obstacle.point.y) : null;
  const step = (d: number) => dispatch({ type: "setTimeIndex", value: Math.max(0, Math.min(4319, timeIndex + d)) });

  const sceneLabels = useMemo<SceneLabels>(
    () => ({
      observer: analysisH > 0 ? `${L("Observador", "Observer")} · ${formatNumber(analysisH, analysisH % 1 ? 1 : 0)} m` : `${L("Observador", "Observer")} · ${L("a ras del suelo", "at ground level")}`,
      sight: `${L("Dirección de mirada", "Viewing direction")}${effectiveMode === "manual" ? "" : effectiveMode === "sun" ? L(" (Sol)", " (Sun)") : L(" (Tierra)", " (Earth)")} · ${azimuth === null ? "—" : formatDeg(azimuth, 1)}`,
    }),
    [analysisH, azimuth, effectiveMode],
  );
  const explain = (() => {
    if (!obstacle || azimuth === null) return null;
    const hTxt = formatNumber(analysisH, analysisH % 1 ? 1 : 0);
    const who = analysisH > 0 ? L(`Desde lo alto de una torre de ${hTxt} m en ${SITE_META[focusSite].label}`, `From the top of a ${hTxt} m tower at ${SITE_META[focusSite].label}`) : L(`Desde el suelo en ${SITE_META[focusSite].label}`, `From the ground at ${SITE_META[focusSite].label}`);
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
    const crop = insideWindow
      ? ""
      : regionalHit?.status === "ready"
        ? L(" Ese relieve está fuera del recorte local de 5 m: se dibuja con el DEM regional de 80 m y la visual llega hasta la cresta, el mismo punto que marca el mapa.", " That terrain lies outside the local 5 m crop: it is drawn with the 80 m regional DEM and the line reaches the ridge, the same point marked on the map.")
        : L(" Ese relieve queda fuera de lo que dibuja el visor 3D: la visual discontinua acaba en el límite del visor y el mapa muestra dónde está.", " That terrain lies outside what the 3D viewer draws: the dashed line ends at the viewer limit and the map shows where it is.");
    return `${who}, ${where}, ${lim}.${vis}${crop}`;
  })();

  const kind: EngineerHeightState["kind"] = isPreview ? "preview" : extended ? "extended" : "v01";
  // Mapa en planta: se mantiene montado durante el arrastre y la carga (solo se retira la dirección);
  // la capa (NAC cercana o WAC regional) se elige con el último resultado mostrado.
  const nextBase = showData && obstacle && !obstacle.unknown ? (obstacle.distanceM > 30000 ? "wac" : "nac") : null;
  const [mapBase, setMapBase] = useState<"wac" | "nac">("nac");
  if (nextBase && nextBase !== mapBase) setMapBase(nextBase);
  useEffect(() => {
    onHeightState?.({ towerH, analysisH, kind, ready: showData });
  }, [onHeightState, towerH, analysisH, kind, showData]);

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
    if (regionalHit?.status === "ready")
      rows.push([L("Altura del relieve dibujado en ese punto", "Height of the drawn terrain at that point"), `${formatNumber(regionalHit.heightM, 1)} m (Δ ${regionalHit.deltaM >= 0 ? "+" : "−"}${formatNumber(Math.abs(regionalHit.deltaM), 2)} m · ${L("bloque", "block")} ${regionalHit.blockId})`]);
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
      line: `${L("Horizonte", "Horizon")} ${hz} · ${L("relieve a", "terrain at")} ${fmtDist(obstacle.distanceM)}${insideWindow ? "" : regionalHit?.status === "ready" ? ` · ${L("cresta regional", "regional ridge")}` : ` · ${L("fuera del visor 3D", "outside the 3D viewer")}`}`,
      margin: bodyEl !== null && engineHorizon !== null ? bodyEl - engineHorizon : null,
    };
  })();

  return (
    <section aria-label={L("Terreno 3D, torre y línea de visión", "3D terrain, tower and line of sight")} className="flex flex-col gap-4" data-testid="terrain-panel" data-preset={preset.view} data-mesh-surface={meshSurface} data-mesh-ready={mesh ? "true" : "false"}>
      <div className="overflow-hidden rounded-2xl border border-line bg-[#03060d]">
        {/* Barra compacta: lo que cambia la escena, junto a la escena */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface/80 px-3 py-2">
          <Tool label={L("Sitio", "Site")} value={focusSite} onChange={(v) => dispatch({ type: "setFocusSite", value: v as SiteId })} options={(["A", "B"] as const).map((s) => ({ v: s, text: SITE_META[s].label }))} />
          <div className="flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-line-strong bg-bg/80 py-0.5 pr-2 pl-0.5 sm:gap-2" data-testid="tower-height-control" data-preview={isPreview ? "true" : "false"} data-kind={kind} data-analysis-height={analysisH} data-ready={showData ? "true" : "false"}>
            <Tool label={L("Altura del observador", "Observer height")} value={isV01(towerH) ? towerH : -1} onChange={(v) => onSlider(v as number, true)} options={COMPUTED_HEIGHTS.map((h) => ({ v: h, text: `${h} m` }))} />
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-ink-muted sm:flex-none">
              <span className="sr-only">{L("Altura de la torre (0 a 30 m)", "Tower height (0 to 30 m)")}</span>
              <input
                type="range"
                min={0}
                max={30}
                step={0.5}
                value={towerH}
                onChange={(e) => onSlider(Number(e.target.value))}
                onPointerUp={(e) => onSlider(Number((e.target as HTMLInputElement).value), true)}
                onKeyUp={(e) => onSlider(Number((e.target as HTMLInputElement).value), true)}
                list="tower-computed-heights"
                className="w-full min-w-14 accent-[#a78bfa] sm:w-40"
                aria-label={L("Altura de la torre (0 a 30 m)", "Tower height (0 to 30 m)")}
                aria-valuetext={`${formatNumber(towerH, 1)} m${isPreview ? L(" · vista previa sin cálculo", " · preview, not computed") : showData ? L(" · calculada", " · computed") : L(" · cargando", " · loading")}`}
                data-testid="tower-height-slider"
              />
              <datalist id="tower-computed-heights">
                {COMPUTED_HEIGHTS.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
              <span className={`tabular w-12 shrink-0 text-right font-semibold sm:w-14 ${isPreview ? "text-warn" : "text-ink"}`}>{formatNumber(towerH, towerH % 1 ? 1 : 0)} m</span>
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
          <p className="w-full text-[11px] leading-snug text-ink-faint" data-testid="height-range-note">
            {L(
              "Terreno nominal: visibilidad calculada por el motor de 0 a 30 m cada 0,5 m. Otras superficies: 0, 2 y 10 m (el resto, vista previa de la torre).",
              "Nominal terrain: visibility computed by the engine from 0 to 30 m every 0.5 m. Other surfaces: 0, 2 and 10 m (other heights are a tower preview).",
            )}
          </p>
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
              observerHeightM={towerH}
              siteColor={SITE_HEX[focusSite]}
              directions={showData ? directions : NO_DIRECTIONS}
              sightLine={showData ? sightLine : null}
              exaggeration={exaggeration}
              preset={preset}
              lightEnu={lightEnu}
              regional={regional.pieces}
              azimuthDeg={showData ? azimuth : null}
              labels={showData ? sceneLabels : NO_LABELS}
              label={L(
                `Terreno 3D real de Connecting Ridge alrededor de ${SITE_META[focusSite].label}, con el observador a ${formatNumber(towerH, 1)} m y la línea de visión hacia el obstáculo del horizonte.`,
                `Real 3D terrain of Connecting Ridge around ${SITE_META[focusSite].label}, with the observer at ${formatNumber(towerH, 1)} m and the line of sight to the horizon obstacle.`,
              )}
            />
            {isPreview ? (
              <div className="absolute top-3 left-3 max-w-[min(24rem,80%)] rounded-xl border border-warn/60 bg-[#14100ae6] px-3 py-2" data-testid="tower-preview-banner" role="status">
                <p className="text-sm font-bold text-warn sm:text-base">{L("Vista previa de la torre · sin cálculo de visibilidad a esta altura", "Tower preview · no visibility computed at this height")}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{L("Con esta superficie solo hay resultados calculados a 0, 2 y 10 m (el rango completo es del terreno nominal).", "With this surface computed results exist only at 0, 2 and 10 m (the full range is for the nominal terrain).")}</p>
                <div className="mt-1.5 flex gap-1.5">
                  {COMPUTED_HEIGHTS.map((h) => (
                    <button key={h} type="button" onClick={() => onSlider(h, true)} className="rounded-md border border-line-strong px-2 py-0.5 text-xs font-semibold text-ink hover:bg-surface-3">
                      {L(`Ir a ${h} m`, `Go to ${h} m`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : extError ? (
              <div className="absolute top-3 left-3 max-w-[min(24rem,80%)] rounded-xl border border-danger/60 bg-[#160a0ce6] px-3 py-2" data-testid="height-error" role="alert">
                <p className="text-sm font-bold text-danger sm:text-base">{L(`No se pudo cargar la visibilidad a ${formatNumber(analysisH, 1)} m`, `Could not load visibility at ${formatNumber(analysisH, 1)} m`)}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{extError.message}</p>
                <button type="button" onClick={() => setRetry((r) => r + 1)} className="mt-1.5 rounded-md border border-line-strong px-2 py-0.5 text-xs font-semibold text-ink hover:bg-surface-3">
                  {L("Reintentar", "Retry")}
                </button>
              </div>
            ) : loading ? (
              <div className="pointer-events-none absolute top-3 left-3 rounded-xl border border-line-strong bg-[#050912d9] px-3 py-2" data-testid="height-loading" role="status">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="inline-block size-3 animate-spin rounded-full border-2 border-ink-faint border-t-transparent" aria-hidden="true" />
                  {L(`Cargando visibilidad a ${formatNumber(towerH, towerH % 1 ? 1 : 0)} m`, `Loading visibility at ${formatNumber(towerH, towerH % 1 ? 1 : 0)} m`)}
                </p>
              </div>
            ) : showData && conclusion ? (
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
            <p className="pointer-events-none absolute bottom-2 left-3 rounded-md bg-[#050912c0] px-2 py-1 text-[11px] text-ink-muted" data-testid="scene-light" data-sun-lit={sunLit ? "true" : "false"}>
              {sunLit
                ? L(`Luz y sombra: dirección del Sol del motor (azimut ${formatDeg(sunAz!, 1)}, elevación ${formatDeg(sunEl!, 2)})`, `Light and shadow: the engine's Sun direction (azimuth ${formatDeg(sunAz!, 1)}, elevation ${formatDeg(sunEl!, 2)})`)
                : showData && isNominal && stateCode !== undefined && stateCode !== 4
                  ? L("Sol tapado según el motor: luz neutra, sin sombra solar", "Sun hidden according to the engine: neutral light, no solar shadow")
                  : L("Luz neutra, sin sombra solar (sin dirección solar calculada para esta vista)", "Neutral light, no solar shadow (no Sun direction computed for this view)")}
            </p>
            <CompassBadge azimuthDeg={showData ? azimuth : null} sunAz={showData && ephData ? ephData.series.bodies.SUN.azimuth_deg[timeIndex] : null} earthAz={showData && ephData ? ephData.series.bodies.EARTH.azimuth_deg[timeIndex] : null} />
          </div>
          {/* Mapa orbital real en planta: posición del observador y dirección hasta el relieve */}
          <figure className="flex min-w-0 flex-col gap-1.5 border-t border-line p-2 lg:border-t-0 lg:border-l" data-testid="terrain-map">
            {!isPreview ? (
              <GeoMap key={mapBase} compact compactHeightClass="h-[300px] lg:h-[clamp(320px,calc(100dvh-320px),560px)]" sites={core.sites} focusSite={focusSite} overlay={showData && !obstacle?.unknown ? overlay : undefined} initialBasemap={mapBase} />
            ) : (
              <GeoMap key="nac-site" compact compactHeightClass="h-[300px] lg:h-[clamp(320px,calc(100dvh-320px),560px)]" sites={core.sites} focusSite={focusSite} followFocus showCredit />
            )}
            <figcaption className="px-1 text-[11px] leading-snug text-ink-faint">
              {isPreview
                ? L("Vista en planta del sitio (NASA Moon Trek). Sin dirección dibujada: esta altura no tiene cálculo.", "Plan view of the site (NASA Moon Trek). No direction drawn: this height has no computation.")
                : !showData
                  ? L("Vista en planta del sitio (NASA Moon Trek). La dirección aparece cuando llega el resultado de esta altura.", "Plan view of the site (NASA Moon Trek). The direction appears when this height's result arrives.")
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
              ["overview", L("Vista amplia", "Wide view")],
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

      {explain && showData ? (
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
          {L(`Debajo: último análisis CALCULADO, a ${heightM} m. No corresponde a la torre de ${formatNumber(towerH, 1)} m de la vista previa.`, `Below: last COMPUTED analysis, at ${heightM} m. It does not correspond to the ${formatNumber(towerH, 1)} m preview tower.`)}
        </p>
      ) : null}
      <div className={`rounded-xl border border-uncertainty/40 bg-uncertainty-soft p-4 ${isPreview ? "opacity-55" : ""}`} data-testid="obstacle-readout"
        data-height={showData ? analysisH : undefined}
        data-site={focusSite}
        data-window={windowId}
        data-variant={variant}
        data-mode={effectiveMode}
        data-body-el={showData && bodyEl !== null ? String(bodyEl) : undefined}
        data-engine-horizon={showData && engineHorizon !== null ? String(engineHorizon) : undefined}
        data-state={showData && stateCode !== undefined ? String(stateCode) : undefined}
        data-time-utc={times ? times[timeIndex] : undefined}
        data-sun-az={showData && sunAz !== null ? String(sunAz) : undefined}
        data-sun-el={showData && sunEl !== null ? String(sunEl) : undefined}
        data-sun-lit={showData ? String(sunLit) : undefined}
        data-obstacle-x={showData && obstacle && !obstacle.unknown ? String(obstacle.point.x) : undefined}
        data-obstacle-y={showData && obstacle && !obstacle.unknown ? String(obstacle.point.y) : undefined}
        data-obstacle-distance={showData && obstacle && !obstacle.unknown ? String(obstacle.distanceM) : undefined}
        data-obstacle-azimuth={showData && obstacle && !obstacle.unknown ? String(obstacle.sampleAzimuthDeg) : undefined}
        data-obstacle-height={showData && obstacle && !obstacle.unknown ? String(obstacle.heightM) : undefined}
        data-obstacle-local={showData && obstacle && !obstacle.unknown ? toLocal(frame, obstacle.point.x, obstacle.point.y, obstacle.heightM).map((v) => v.toFixed(2)).join(",") : undefined}
        data-inside-crop={showData && obstacle ? String(insideWindow) : undefined}
        data-regional={showData && regionalHit ? regionalHit.status : undefined}
        data-regional-block={showData && regionalHit && "blockId" in regionalHit ? regionalHit.blockId : undefined}
        data-regional-delta-m={showData && regionalHit?.status === "ready" ? regionalHit.deltaM.toFixed(3) : undefined}
        data-map-point={showData && overlay?.point ? `${overlay.point.x},${overlay.point.y}` : undefined}
        data-map-coverage={String(coverage.length)}
        aria-live="polite"
      >
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
        {obstacle && (showData || isPreview) ? (
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
          <p className="mt-2 text-sm text-ink-muted">{L(`Cargando horizonte y direcciones a ${formatNumber(towerH, 1)} m…`, `Loading horizon and directions at ${formatNumber(towerH, 1)} m…`)}</p>
        )}
        {obstacle && !obstacle.unknown && (showData || isPreview) ? (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            {insideWindow
              ? L("El obstáculo está dentro del recorte 3D: la línea violeta llega hasta él.", "The obstacle is inside the 3D crop: the violet line reaches it.")
              : regionalHit?.status === "ready"
                ? L("El obstáculo está fuera del recorte local de 4 km, dentro del relieve regional de 80 m cargado: la línea violeta llega hasta la cresta, en el mismo punto que marca el mapa.", "The obstacle is outside the local 4 km crop, inside the loaded 80 m regional terrain: the violet line reaches the ridge, at the same point marked on the map.")
                : regionalHit?.status === "loading"
                  ? L("El obstáculo está fuera del recorte local: se está cargando el bloque regional que lo contiene; mientras, la línea discontinua termina en el límite del visor y su posición real aparece en el mapa.", "The obstacle is outside the local crop: the regional block that contains it is loading; meanwhile the dashed line ends at the viewer limit and its real position is on the map.")
                  : L("El obstáculo está FUERA del relieve nativo que dibuja el visor 3D: la línea discontinua termina en el límite del visor; su posición real aparece en el mapa.", "The obstacle is OUTSIDE the native terrain drawn by the 3D viewer: the dashed line ends at the viewer limit; its real position is on the map.")}{" "}
            {L(
              `Se usa la muestra del horizonte del motor más cercana (azimut ${formatDeg(obstacle.sampleAzimuthDeg, 2)}), localizada con su mismo rayo curvo.`,
              `The nearest engine horizon sample is used (azimuth ${formatDeg(obstacle.sampleAzimuthDeg, 2)}), located with the same curved ray.`,
            )}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
          {mesh
            ? L(
                `${formatNumber(mesh.cols * mesh.rows, 0)} vértices = muestras reales del DEM cada ${mesh.spacingM} m (ventana de 4 × 4 km, ${mesh.nodataVertices} sin dato). Presentación ilustrativa, no medida: grano y manchas del regolito procedurales a dos escalas (sin cráteres, rocas ni desplazamientos añadidos), la luz y la sombra de la torre siguen la dirección del Sol del motor solo cuando este lo da por visible (si no, luz neutra); la sombra dibujada no es el cálculo de visibilidad. Cielo: brillo de la Vía Láctea y estrellas de NASA SVS 4851 (Gaia DR2, ESA/Gaia/DPAC), no orientado al cielo real del sitio. Sol (NASA/SDO AIA 171) y Tierra (Blue Marble, NASA JSC) son marcadores ampliados en su dirección del paquete, atenuados si el motor da su centro por tapado. Exageración ×${exaggeration}${exaggeration > 1 ? " solo en el dibujo" : " (escala real)"}. La torre en celosía es infraestructura ilustrativa; su remate está a la altura real del observador, ${formatNumber(analysisH, 1)} m, que es el origen de la visual.`,
                `${formatNumber(mesh.cols * mesh.rows, 0)} vertices = real DEM samples every ${mesh.spacingM} m (4 × 4 km window, ${mesh.nodataVertices} without data). Illustrative presentation, not measurement: procedural two-scale regolith grain and mottling (no craters, rocks or displacement added), light and the tower shadow follow the engine's Sun direction only when it reports the Sun visible (otherwise neutral light); the drawn shadow is not the visibility computation. Sky: Milky Way glow and stars from NASA SVS 4851 (Gaia DR2, ESA/Gaia/DPAC), not oriented to the site's real sky. Sun (NASA/SDO AIA 171) and Earth (Blue Marble, NASA JSC) are enlarged markers at their package direction, dimmed when the engine marks their centre as hidden. Exaggeration ×${exaggeration}${exaggeration > 1 ? " in the drawing only" : " (true scale)"}. The lattice tower is illustrative infrastructure; its top is at the real observer height, ${formatNumber(analysisH, 1)} m, which is where the sightline starts.`,
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
