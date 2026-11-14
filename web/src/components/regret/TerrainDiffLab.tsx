"use client";

import Link from "next/link";
import Feature from "ol/Feature";
import OlMap from "ol/Map";
import View from "ol/View";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import ImageStatic from "ol/source/ImageStatic";
import VectorSource from "ol/source/Vector";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";
import { useEffect, useMemo, useRef, useState } from "react";
import { SITE_IDS, variantFamily, type SiteId, type Variant } from "@/lib/contract/constants";
import type { Core, HorizonChunk } from "@/lib/contract/schema";
import { useChunk } from "@/lib/data/DataProvider";
import { loadHorizonChunk } from "@/lib/data/loader";
import { formatNumber } from "@/lib/format";
import { DIFFERENCE_STYLE, LAYER_STYLE, colorizeDifference, colorizeRaster, hillshade, rampCss } from "@/lib/geospatial/colormap";
import { blockRms, differenceGrid, horizonDelta, type HorizonDelta } from "@/lib/geospatial/difference";
import { HORIZON_SOURCE_RESOLUTION_M, horizonObstacle, type HorizonObstacle } from "@/lib/geospatial/horizon";
import type { XY } from "@/lib/geospatial/lunar";
import { sampleBilinear, sampleNearest, type RasterGrid } from "@/lib/geospatial/raster";
import { TERRAIN_BOUNDS, TERRAIN_MANIFEST, ensembleMember, loadEnsembleMember, loadTerrainLayer } from "@/lib/geospatial/terrain";
import { L } from "@/lib/i18n";
import { FAMILY_META, SITE_META, VARIANT_LABEL } from "@/lib/labels";
import { useSelection } from "@/lib/state/SelectionProvider";
import { HorizonDeltaChart } from "../charts/HorizonDeltaChart";
import { ChunkGate } from "../data/DataGate";
import { PROJECTION, SITE_HEX, evidenceHref, rgbaToUrl } from "../maps/GeoMap";
import { Badge, Callout, NatureBadge } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { InfoTip } from "../ui/Interactive";
import { Panel } from "../ui/Panel";

const VIOLET = "#a78bfa";
const PUBLISHED: Variant[] = ["published_0001", "published_0002", "published_0003", "published_0004", "published_0005"];
const inWindow = (p: XY) => p.x >= TERRAIN_BOUNDS[0] && p.x <= TERRAIN_BOUNDS[2] && p.y >= TERRAIN_BOUNDS[1] && p.y <= TERRAIN_BOUNDS[3];
const signed = (v: number, d = 2) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatNumber(Math.abs(v), d)}`;

/* -------------------------------------------------------------------------- */
/* Mapa de diferencias (OpenLayers, misma proyección polar lunar que Explore)  */
/* -------------------------------------------------------------------------- */

interface Sight {
  site: SiteId;
  from: XY;
  nominal: XY | null;
  variant: XY | null;
}

function DiffMap({
  core,
  relief,
  diff,
  limit,
  sight,
  onRead,
}: {
  core: Core;
  relief: RasterGrid | null;
  diff: RasterGrid | null;
  limit: number;
  sight: Sight | null;
  onRead: (p: XY) => void;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const vec = useRef({ sites: new VectorSource(), sight: new VectorSource() });
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  });

  useEffect(() => {
    if (!targetRef.current) return;
    const map = new OlMap({
      target: targetRef.current,
      keyboardEventTarget: targetRef.current,
      controls: [],
      layers: [new VectorLayer({ source: vec.current.sight, zIndex: 11 }), new VectorLayer({ source: vec.current.sites, zIndex: 12 })],
      view: new View({ projection: PROJECTION, center: [(TERRAIN_BOUNDS[0] + TERRAIN_BOUNDS[2]) / 2, (TERRAIN_BOUNDS[1] + TERRAIN_BOUNDS[3]) / 2], resolution: 8, minResolution: 0.8, maxResolution: 40, extent: [TERRAIN_BOUNDS[0] - 2000, TERRAIN_BOUNDS[1] - 2000, TERRAIN_BOUNDS[2] + 2000, TERRAIN_BOUNDS[3] + 2000] }),
    });
    map.getView().fit([...TERRAIN_BOUNDS], { padding: [8, 8, 8, 8] });
    map.on("singleclick", (e) => onReadRef.current({ x: e.coordinate[0], y: e.coordinate[1] }));
    mapRef.current = map;
    for (const s of core.sites) {
      const id = s.id as SiteId;
      const f = new Feature({ geometry: new Point([s.x_m, s.y_m]) });
      f.setStyle(
        new Style({
          image: new CircleStyle({ radius: 8, stroke: new Stroke({ color: SITE_HEX[id], width: 3 }), fill: new Fill({ color: "#05091299" }) }),
          text: new Text({ text: id, font: "700 13px Inter, sans-serif", offsetY: -19, fill: new Fill({ color: SITE_HEX[id] }), stroke: new Stroke({ color: "#050912", width: 4 }) }),
        }),
      );
      vec.current.sites.addFeature(f);
    }
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, [core.sites]);

  // Fondo: relieve sombreado del DEM nominal (luz sintética; solo forma del terreno).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !relief) return;
    const layer = new ImageLayer({ zIndex: 0, opacity: 0.85, source: new ImageStatic({ url: rgbaToUrl(hillshade(relief), relief.width, relief.height), imageExtent: [...TERRAIN_BOUNDS], projection: PROJECTION, interpolate: true }) });
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [relief]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !diff) return;
    const layer = new ImageLayer({ zIndex: 2, opacity: 0.78, source: new ImageStatic({ url: rgbaToUrl(colorizeDifference(diff, limit), diff.width, diff.height), imageExtent: [...TERRAIN_BOUNDS], projection: PROJECTION, interpolate: false }) });
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [diff, limit]);

  const sightKey = JSON.stringify(sight);
  useEffect(() => {
    const src = vec.current.sight;
    src.clear();
    if (!sight) return;
    const add = (to: XY | null, color: string, dash?: number[], label?: string) => {
      if (!to) return;
      const line = new Feature({ geometry: new LineString([[sight.from.x, sight.from.y], [to.x, to.y]]) });
      line.setStyle([new Style({ stroke: new Stroke({ color: "#050912", width: 5 }) }), new Style({ stroke: new Stroke({ color, width: 2.2, lineDash: dash }) })]);
      const pt = new Feature({ geometry: new Point([to.x, to.y]) });
      pt.setStyle(
        new Style({
          image: new CircleStyle({ radius: 6, fill: new Fill({ color }), stroke: new Stroke({ color: "#050912", width: 2 }) }),
          text: label ? new Text({ text: label, font: "600 11px Inter, sans-serif", offsetY: -15, fill: new Fill({ color: "#e8eef8" }), stroke: new Stroke({ color: "#050912", width: 4 }) }) : undefined,
        }),
      );
      src.addFeature(line);
      src.addFeature(pt);
    };
    add(sight.nominal, "#e8eef8", [6, 5], "N");
    add(sight.variant, VIOLET, undefined, "V");
    // `sightKey` resume `sight`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sightKey]);

  return (
    <div
      ref={targetRef}
      tabIndex={0}
      role="group"
      aria-label={L(
        "Mapa de la diferencia de altura entre la superficie seleccionada y la nominal en la ventana de 4 × 4 km de Connecting Ridge. Flechas para desplazar; + y − para ampliar.",
        "Map of the height difference between the selected surface and the nominal one in the 4 × 4 km Connecting Ridge window. Arrow keys to pan; + and − to zoom.",
      )}
      className="geomap h-[340px] w-full overflow-hidden rounded-xl border border-line-strong bg-[#03060d] sm:h-[420px]"
      data-testid="regret-diff-map"
      data-diff-ready={diff ? "true" : "false"}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Miniaturas de los 5 clones (misma escala)                                   */
/* -------------------------------------------------------------------------- */

/** Lado del bloque de las miniaturas: 16 píxeles = 80 m. */
const THUMB_BLOCK = 16;

function CloneThumb({ grid, limit }: { grid: RasterGrid; limit: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // RMS de |Δ| por bloques de 80 m: muestra DÓNDE discrepan las superficies sin el ruido píxel a píxel.
    const small = blockRms(grid, THUMB_BLOCK);
    c.width = small.width;
    c.height = small.height;
    c.getContext("2d")!.putImageData(new ImageData(colorizeRaster(small, 0, limit, LAYER_STYLE.vertical_rms), small.width, small.height), 0, 0);
  }, [grid, limit]);
  return <canvas ref={ref} className="aspect-square w-full rounded-md border border-line bg-[#03060d] [image-rendering:pixelated]" aria-hidden />;
}

function CloneStrip({ nominal, selected, onSelect }: { nominal: RasterGrid | null; selected: Variant; onSelect: (v: Variant) => void }) {
  const [grids, setGrids] = useState<Partial<Record<Variant, RasterGrid>>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    for (const v of PUBLISHED)
      loadEnsembleMember(v)
        .then((g) => alive && setGrids((p) => ({ ...p, [v]: g })))
        .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);
  const members = PUBLISHED.map((v) => ensembleMember(v)!);
  const shared = Math.max(...members.map((m) => m.difference_vs_nominal.rms)) * 2;
  const diffs = useMemo(() => (nominal ? Object.fromEntries(PUBLISHED.filter((v) => grids[v]).map((v) => [v, differenceGrid(grids[v]!, nominal)])) : {}) as Partial<Record<Variant, RasterGrid>>, [grids, nominal]);
  return (
    <div className="flex flex-col gap-2" data-testid="clone-strip">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-ink">{L("Los 5 clones publicados frente al nominal", "The 5 published clones against the nominal")}</h3>
        <span className="text-[11px] text-ink-faint">
          {L(
            `RMS de clon − nominal por bloques de 80 m; misma escala para los cinco (0 → ${formatNumber(shared, 2)} m). Las zonas claras son donde el ensemble discrepa más.`,
            `RMS of clone − nominal per 80 m block; same scale for all five (0 → ${formatNumber(shared, 2)} m). Bright areas are where the ensemble disagrees most.`,
          )}
        </span>
        <span className="ml-auto h-2.5 w-28 rounded-full" style={{ background: rampCss(LAYER_STYLE.vertical_rms.stops) }} aria-hidden />
      </div>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <div className="grid max-w-4xl grid-cols-5 gap-2">
        {members.map((m) => {
          const v = m.variant as Variant;
          const active = v === selected;
          const d = m.difference_vs_nominal;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onSelect(v)}
              aria-pressed={active}
              aria-label={L(`${VARIANT_LABEL[v]}: RMS de la diferencia ${formatNumber(d.rms, 2)} m`, `${VARIANT_LABEL[v]}: RMS of the difference ${formatNumber(d.rms, 2)} m`)}
              className={`flex min-w-0 flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors ${active ? "border-uncertainty bg-uncertainty-soft" : "border-line bg-bg-2/60 hover:border-line-strong"}`}
            >
              {diffs[v] ? <CloneThumb grid={diffs[v]!} limit={shared} /> : <span className="aspect-square w-full animate-pulse rounded-md bg-surface-3/60" />}
              <span className="truncate text-[11px] font-semibold text-ink">P{v.slice(-1)}</span>
              <span className="tabular text-[10px] leading-tight text-ink-faint">RMS {formatNumber(d.rms, 2)} m</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Panel principal                                                            */
/* -------------------------------------------------------------------------- */

function Legend({ limit }: { limit: number }) {
  return (
    <div className="flex flex-col gap-1" data-testid="regret-diff-legend">
      <div className="h-3 rounded-full border border-white/10" style={{ background: rampCss(DIFFERENCE_STYLE.stops) }} />
      <div className="tabular flex justify-between text-[11px] text-ink-muted">
        <span>−{formatNumber(limit, 2)} m · {L("clon más bajo", "clone lower")}</span>
        <span>0</span>
        <span>+{formatNumber(limit, 2)} m · {L("clon más alto", "clone higher")}</span>
      </div>
    </div>
  );
}

function SightTable({ rows }: { rows: Array<{ k: string; n: string; v: string; d?: string }> }) {
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="text-ink-faint">
          <th className="py-1 font-medium" />
          <th className="py-1 text-right font-medium">{L("Nominal", "Nominal")}</th>
          <th className="py-1 text-right font-medium text-uncertainty">{L("Variante", "Variant")}</th>
          <th className="py-1 text-right font-medium">Δ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.k} className="border-t border-line/50">
            <th scope="row" className="py-1 pr-2 font-normal text-ink-muted">{r.k}</th>
            <td className="tabular py-1 text-right text-ink">{r.n}</td>
            <td className="tabular py-1 text-right font-semibold text-ink">{r.v}</td>
            <td className="tabular py-1 text-right text-ink-muted">{r.d ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LabBody({ core, ha, hb }: { core: Core; ha: HorizonChunk; hb: HorizonChunk }) {
  const { selection, dispatch } = useSelection();
  const { variant, heightM, focusSite } = selection;
  const fam = variantFamily(variant);
  const member = ensembleMember(variant);

  const [nominal, setNominal] = useState<RasterGrid | null>(null);
  const [clone, setClone] = useState<{ variant: Variant; grid: RasterGrid } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<{ key: string; index: number } | null>(null);
  const [read, setRead] = useState<XY | null>(null);

  useEffect(() => {
    loadTerrainLayer("elevation").then(setNominal, (e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    if (fam !== "published") return;
    let alive = true;
    loadEnsembleMember(variant).then(
      (g) => alive && setClone({ variant, grid: g }),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [variant, fam]);

  const diff = useMemo(() => (nominal && clone && clone.variant === variant ? differenceGrid(clone.grid, nominal) : null), [nominal, clone, variant]);
  const limit = member?.difference_vs_nominal.abs_p99 ?? 1;

  const chunks: Record<SiteId, HorizonChunk> = { A: ha, B: hb };
  const deltas = useMemo(
    () => Object.fromEntries(SITE_IDS.map((s) => [s, horizonDelta(chunks[s].variants[variant], chunks[s].variants.nominal)])) as Record<SiteId, HorizonDelta>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ha, hb, variant],
  );
  const pickKey = `${variant}|${heightM}|${focusSite}`;
  const index = pick?.key === pickKey ? pick.index : Math.max(0, deltas[focusSite].maxIndex);
  const az = ha.azimuth_deg[index];

  const site = core.sites.find((s) => s.id === focusSite)!;
  const ll = { lonEastDeg: site.longitude_east_deg, latDeg: site.latitude_deg };
  const ground = core.horizons_index[focusSite].observer_ground_height_m;
  const obsN: HorizonObstacle = horizonObstacle(chunks[focusSite].azimuth_deg, chunks[focusSite].variants.nominal, ll, ground.nominal + heightM, az);
  const obsV: HorizonObstacle = horizonObstacle(chunks[focusSite].azimuth_deg, chunks[focusSite].variants[variant], ll, ground[variant] + heightM, az);
  const terrainDiffAt = (p: XY) => (diff && inWindow(p) ? sampleBilinear(diff, p.x, p.y) : null);
  const dAtV = obsV.unknown ? null : terrainDiffAt(obsV.point);
  const dAtN = obsN.unknown ? null : terrainDiffAt(obsN.point);
  const sameObstacle = !obsN.unknown && !obsV.unknown && Math.abs(obsN.distanceM - obsV.distanceM) < 1 && obsN.source === obsV.source;

  const readValue = read && diff ? sampleNearest(diff, read.x, read.y) : null;
  const isNominal = variant === "nominal";

  const fmtDeg = (v: number | null) => (v === null ? L("desconocido", "unknown") : `${formatNumber(v, 3)}°`);
  const fmtKm = (o: HorizonObstacle) => (o.unknown ? "—" : o.distanceM < 1000 ? `${formatNumber(o.distanceM, 1)} m` : `${formatNumber(o.distanceM / 1000, o.distanceM < 10000 ? 2 : 1)} km`);
  const rows = [
    { k: L("Altura del suelo del observador", "Observer ground height"), n: `${formatNumber(ground.nominal, 2)} m`, v: `${formatNumber(ground[variant], 2)} m`, d: `${signed(ground[variant] - ground.nominal, 3)} m` },
    { k: L("Horizonte en este azimut", "Horizon at this azimuth"), n: fmtDeg(obsN.horizonDeg), v: fmtDeg(obsV.horizonDeg), d: obsN.horizonDeg !== null && obsV.horizonDeg !== null ? `${signed(obsV.horizonDeg - obsN.horizonDeg, 4)}°` : "" },
    { k: L("Distancia al terreno que fija el horizonte", "Distance to the terrain that sets the horizon"), n: fmtKm(obsN), v: fmtKm(obsV) },
    { k: L("Relieve de ese punto", "Relief of that point"), n: `${HORIZON_SOURCE_RESOLUTION_M[obsN.source] ?? "?"} m`, v: `${HORIZON_SOURCE_RESOLUTION_M[obsV.source] ?? "?"} m` },
    {
      k: L("Diferencia de terreno (clon − nominal) en ese punto", "Terrain difference (clone − nominal) at that point"),
      n: dAtN === null ? "—" : `${signed(dAtN)} m`,
      v: dAtV === null ? "—" : `${signed(dAtV)} m`,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Mapa */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{L("Terreno: clon − nominal", "Terrain: clone − nominal")}</span>
            {fam === "published" ? <Badge tone="uncertainty">{VARIANT_LABEL[variant]}</Badge> : <Badge tone="neutral">{VARIANT_LABEL[variant]}</Badge>}
            {fam === "published" && member ? (
              <Link href={evidenceHref(member.registry_id)} className="ml-auto text-[11px] text-accent underline-offset-2 hover:underline">
                {L("Procedencia del clon", "Clone provenance")}
              </Link>
            ) : null}
          </div>
          <DiffMap core={core} relief={nominal} diff={fam === "published" ? diff : null} limit={limit} sight={isNominal ? null : { site: focusSite, from: { x: site.x_m, y: site.y_m }, nominal: obsN.unknown ? null : obsN.point, variant: obsV.unknown ? null : obsV.point }} onRead={setRead} />
          {error ? <Callout tone="danger" icon="alert" title={L("Recorte no disponible", "Crop unavailable")}>{error} {L("No se sustituye por valores aproximados.", "It is not replaced by approximate values.")}</Callout> : null}
          {fam === "published" && member ? (
            <>
              <Legend limit={limit} />
              <p className="text-[11px] leading-snug text-ink-faint">
                {L(
                  `Escala ±P99 de |Δ| (${formatNumber(limit, 2)} m); valores mayores se saturan. En la ventana: mín. ${signed(member.difference_vs_nominal.min)} m, máx. ${signed(member.difference_vs_nominal.max)} m, media ${signed(member.difference_vs_nominal.mean, 3)} m, RMS ${formatNumber(member.difference_vs_nominal.rms, 3)} m. Fondo: relieve sombreado del DEM nominal con luz sintética.`,
                  `Scale ±P99 of |Δ| (${formatNumber(limit, 2)} m); larger values saturate. In the window: min ${signed(member.difference_vs_nominal.min)} m, max ${signed(member.difference_vs_nominal.max)} m, mean ${signed(member.difference_vs_nominal.mean, 3)} m, RMS ${formatNumber(member.difference_vs_nominal.rms, 3)} m. Background: shaded relief of the nominal DEM with synthetic light.`,
                )}
              </p>
              <p className="tabular text-xs text-ink-muted" aria-live="polite" data-testid="regret-diff-read">
                {read
                  ? readValue === null
                    ? L("Fuera de la ventana de 4 × 4 km.", "Outside the 4 × 4 km window.")
                    : Number.isFinite(readValue)
                      ? L(`Punto X ${formatNumber(read.x, 0)} · Y ${formatNumber(read.y, 0)} m: clon − nominal = ${signed(readValue, 3)} m`, `Point X ${formatNumber(read.x, 0)} · Y ${formatNumber(read.y, 0)} m: clone − nominal = ${signed(readValue, 3)} m`)
                      : L("Sin dato en ese píxel.", "No data at that pixel.")
                  : L("Pulsa el mapa para leer la diferencia en un punto.", "Click the map to read the difference at a point.")}
              </p>
            </>
          ) : fam === "own" ? (
            <Callout tone="uncertainty" icon="info" title={L("Superficie no reconstruible en la web", "Surface not reconstructible on the web")}>
              {L(
                "Las 4 hipótesis propias se generaron en el motor con un campo pseudoaleatorio (PCG64) y un filtro gaussiano. Reproducirlas aquí exigiría reimplementar ese generador, así que no se dibuja su diferencia de terreno: solo sus horizontes, que sí están en el paquete. El mapa muestra el relieve nominal.",
                "The 4 team hypotheses were generated in the engine with a pseudo-random field (PCG64) and a Gaussian filter. Reproducing them here would require reimplementing that generator, so their terrain difference is not drawn: only their horizons, which are in the package. The map shows the nominal relief.",
              )}
            </Callout>
          ) : (
            <p className="text-sm text-ink-muted">{L("Elige una superficie distinta de la nominal (en la tabla o en las miniaturas) para ver dónde y cuánto cambia el terreno.", "Choose a surface other than the nominal one (in the table or the thumbnails) to see where and by how much the terrain changes.")}</p>
          )}
        </div>

        {/* Horizonte */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{L(`Horizonte: variante − nominal · ${heightM} m`, `Horizon: variant − nominal · ${heightM} m`)}</span>
            <span className="ml-auto inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label={L("Sitio cuyo obstáculo se dibuja", "Site whose obstacle is drawn")}>
              {SITE_IDS.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={focusSite === s} onClick={() => dispatch({ type: "setFocusSite", value: s })} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${focusSite === s ? `bg-surface-3 ${SITE_META[s].textClass}` : "text-ink-faint hover:text-ink"}`}>
                  {s}
                </button>
              ))}
            </span>
          </div>
          {isNominal ? (
            <p className="rounded-xl border border-line bg-bg-2/60 p-4 text-sm text-ink-muted">{L("Con la superficie nominal la diferencia es cero en todos los azimuts.", "With the nominal surface the difference is zero at every azimuth.")}</p>
          ) : (
            <>
              <HorizonDeltaChart
                azimuthDeg={ha.azimuth_deg}
                selected={index}
                onSelect={(i) => setPick({ key: pickKey, index: i })}
                title={L(`Diferencia de horizonte de ${VARIANT_LABEL[variant]} respecto al nominal`, `Horizon difference of ${VARIANT_LABEL[variant]} relative to the nominal`)}
                series={SITE_IDS.map((s) => ({ key: s, label: SITE_META[s].label, color: SITE_HEX[s], delta: deltas[s].delta }))}
              />
              <div className="grid grid-cols-2 gap-2 text-xs">
                {SITE_IDS.map((s) => (
                  <div key={s} className={`rounded-lg border p-2.5 ${s === focusSite ? SITE_META[s].borderClass : "border-line"} bg-bg-2/60`}>
                    <p className={`font-semibold ${SITE_META[s].textClass}`}>{SITE_META[s].label}</p>
                    <p className="tabular text-ink-muted">
                      {L("máx. |Δ|", "max |Δ|")} {formatNumber(deltas[s].maxAbs, 4)}° {L("a", "at")} {formatNumber(ha.azimuth_deg[Math.max(0, deltas[s].maxIndex)], 2)}° · RMS {formatNumber(deltas[s].rms, 4)}°
                    </p>
                    <p className="tabular text-ink-faint">
                      {L(`sube en ${deltas[s].raised}, baja en ${deltas[s].lowered} de ${deltas[s].known} azimuts (>0,01°); cambia el relieve limitante en ${deltas[s].sourceChanged}`, `rises at ${deltas[s].raised}, drops at ${deltas[s].lowered} of ${deltas[s].known} azimuths (>0.01°); limiting relief changes at ${deltas[s].sourceChanged}`)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
          {!isNominal ? (
            <div className="rounded-xl border border-line bg-bg-2/60 p-3" data-testid="regret-sight">
              <p className="mb-1 text-xs font-semibold text-ink">
                {L(`Azimut ${formatNumber(az, 2)}° desde ${SITE_META[focusSite].label}`, `Azimuth ${formatNumber(az, 2)}° from ${SITE_META[focusSite].label}`)}{" "}
                <InfoTip>
                  {L(
                    "Lectura del horizonte PRECALCULADO por el motor para cada superficie: el punto N (nominal) y V (variante) es la muestra de terreno que fija el máximo en ese azimut. La diferencia de terreno solo existe dentro de la ventana de 4 × 4 km y para los clones publicados.",
                    "Reading of the horizon PRECOMPUTED by the engine for each surface: point N (nominal) and V (variant) is the terrain sample that sets the maximum at that azimuth. The terrain difference only exists inside the 4 × 4 km window and for the published clones.",
                  )}
                </InfoTip>
              </p>
              <SightTable rows={rows} />
              <p className="mt-2 text-[11px] leading-snug text-ink-faint">
                {sameObstacle
                  ? L("El horizonte lo fija el mismo punto del terreno en ambas superficies.", "The horizon is set by the same terrain point on both surfaces.")
                  : L("El punto que fija el horizonte cambia de lugar entre ambas superficies.", "The point that sets the horizon moves between the two surfaces.")}{" "}
                {L(
                  "Esto describe el horizonte; no demuestra que este azimut explique un cambio de ganador: el motor no calcula esa atribución.",
                  "This describes the horizon; it does not show that this azimuth explains a change of winner: the engine does not compute that attribution.",
                )}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <CloneStrip nominal={nominal} selected={variant} onSelect={(v) => dispatch({ type: "setVariant", value: v })} />
    </div>
  );
}

export function TerrainDiffLab({ core }: { core: Core }) {
  const { selection, restored } = useSelection();
  const { heightM, variant } = selection;
  const fam = variantFamily(variant);
  const ha = useChunk(restored ? () => loadHorizonChunk("A", heightM) : null, [heightM]);
  const hb = useChunk(restored ? () => loadHorizonChunk("B", heightM) : null, [heightM]);
  const nature = fam === "published" ? "OBSERVED" : fam === "own" ? "MODELED" : "DERIVED";
  return (
    <Panel
      id="terreno-variante"
      title={L("Terreno de la superficie: qué cambia y dónde", "Surface terrain: what changes and where")}
      icon="map"
      className="border-uncertainty/30"
      actions={
        <>
          <span className="text-[11px] text-ink-faint">{FAMILY_META[fam].label}</span>
          <NatureBadge nature={nature} />
        </>
      }
      footer={
        <span className="flex items-start gap-1.5">
          <Icon name="info" className="mt-0.5 size-3.5 shrink-0" />
          {L(
            `Recortes exactos (sin remuestreo) de ${TERRAIN_MANIFEST.ensemble?.members.length ?? 0} clones PGDA78 Site01, verificados con SHA-256; la altura de cada clon en A y B coincide con la del paquete. Los horizontes y las alturas de observador se leen del paquete site-regret/0.1; nada se recalcula en el navegador salvo la resta píxel a píxel y la localización del punto de horizonte.`,
            `Exact crops (no resampling) of ${TERRAIN_MANIFEST.ensemble?.members.length ?? 0} PGDA78 Site01 clones, verified with SHA-256; each clone's height at A and B matches the package. Horizons and observer heights are read from the site-regret/0.1 package; nothing is recomputed in the browser except the pixel-by-pixel subtraction and locating the horizon point.`,
          )}
        </span>
      }
    >
      <ChunkGate state={ha} label={L("horizonte de A", "horizon of A")}>
        {(a) => (
          <ChunkGate state={hb} label={L("horizonte de B", "horizon of B")}>
            {(b) => <LabBody core={core} ha={a} hb={b} />}
          </ChunkGate>
        )}
      </ChunkGate>
    </Panel>
  );
}
