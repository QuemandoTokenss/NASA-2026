"use client";

import Link from "next/link";
import Feature from "ol/Feature";
import OlMap from "ol/Map";
import View from "ol/View";
import ScaleLine from "ol/control/ScaleLine";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import ImageLayer from "ol/layer/Image";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import Projection from "ol/proj/Projection";
import ImageStatic from "ol/source/ImageStatic";
import TileImage from "ol/source/TileImage";
import VectorSource from "ol/source/Vector";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";
import TileGrid from "ol/tilegrid/TileGrid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SiteId } from "@/lib/contract/constants";
import type { Site } from "@/lib/contract/schema";
import { formatNumber } from "@/lib/format";
import { LAYER_STYLE, colorizeRaster, hillshade, rampCss, rgbCss } from "@/lib/geospatial/colormap";
import { arcDistanceM, azimuthBetween, chordDistanceM, stereographicScale, xyToLonLat, type XY } from "@/lib/geospatial/lunar";
import { profileAlong, sampleBilinear, sampleNearest, type RasterGrid } from "@/lib/geospatial/raster";
import { GEO_REGISTRY, TERRAIN_BOUNDS, TERRAIN_MANIFEST, loadRois, loadTerrainLayer, registryAsset, type RegistryAsset, type TerrainLayerId } from "@/lib/geospatial/terrain";
import { checkPolarStereographicGrid, parseWmtsCapabilities, tileUrl, type WmtsCapabilities } from "@/lib/geospatial/wmts";
import { L } from "@/lib/i18n";
import { SITE_META } from "@/lib/labels";
import { Segmented, Toggle } from "../ui/Controls";
import { Badge, Callout } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { ProfileChart } from "./ProfileChart";

/** Estereográfica polar sur lunar en metros (R = 1 737 400 m). No es un CRS terrestre. */
export const PROJECTION = new Projection({ code: "SITE_REGRET:MOON_SOUTH_POLAR_STEREOGRAPHIC", units: "m", extent: [-1095930, -1095930, 1095930, 1095930] });
export const SITE_HEX: Record<SiteId, string> = { A: "#ff8a1f", B: "#22d3ee" };
const UNCERTAINTY_HEX = "#a78bfa";

export type BasemapId = "nac" | "wac" | "relief" | "none";
type AnalyticId = TerrainLayerId | "none";
type TileStatus = "loading" | "available" | "unavailable" | "invalid";

const BASEMAP_ASSET: Record<"nac" | "wac", string> = { nac: "trek.sp.LRO_NAC_Mosaic_1mpp_SP", wac: "trek.sp.LRO_WAC_Mosaic_SPole60_100m_v02" };
const ANALYTIC_LAYERS: TerrainLayerId[] = ["elevation", "slope", "lola_count", "vertical_rms", "slope_rms"];
const layerEntry = (id: TerrainLayerId) => TERRAIN_MANIFEST.layers.find((l) => l.id === id)!;
const assetTitle = (a: RegistryAsset | undefined) => (a ? L(a.title.es, a.title.en) : "");
export const evidenceHref = (registryId: string) => `/evidencia/#geo-${registryId.replaceAll(".", "-")}`;

export interface GeoMapOverlay {
  /** Línea (X/Y) que se dibuja sobre el mapa, p. ej. la visual hacia el obstáculo. */
  line: XY[];
  point?: XY;
  label?: string;
}

export function rgbaToUrl(rgba: Uint8ClampedArray<ArrayBuffer>, w: number, h: number): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.putImageData(new ImageData(rgba, w, h), 0, 0);
  return c.toDataURL("image/png");
}

const unitLabel = (u: string) => (u === "deg" ? "°" : u === "count" ? "" : ` ${u}`);

function Legend({ id }: { id: TerrainLayerId }) {
  const entry = layerEntry(id);
  const style = LAYER_STYLE[id];
  const asset = registryAsset(entry.registry_id);
  return (
    <div className="flex flex-col gap-1.5" data-testid="geomap-legend">
      <p className="text-xs font-semibold text-ink">{assetTitle(asset)}</p>
      {style.discrete ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
          {style.stops.map((c, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm border border-white/15" style={{ background: rgbCss(c) }} />
              {entry.stats.min + i}
              {i === 0 ? ` · ${L("interpolado", "interpolated")}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="h-3 rounded-full border border-white/10" style={{ background: rampCss(style.stops) }} />
          <div className="tabular flex justify-between text-[11px] text-ink-muted">
            <span>
              {formatNumber(entry.stats.min, 2)}
              {unitLabel(entry.units)}
            </span>
            <span>
              {formatNumber(entry.stats.max, 2)}
              {unitLabel(entry.units)}
            </span>
          </div>
        </>
      )}
      <p className="text-[11px] leading-snug text-ink-faint">
        {L("Mínimo y máximo reales de la ventana. Rejilla de 5 m.", "Actual minimum and maximum of the window. 5 m grid.")}{" "}
        <Link href={evidenceHref(entry.registry_id)} className="text-accent underline-offset-2 hover:underline">
          {L("Procedencia", "Provenance")}
        </Link>
      </p>
    </div>
  );
}

function MapButton({ icon, label, onClick }: { icon: "zoomIn" | "zoomOut" | "maximize"; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="grid size-9 place-items-center rounded-lg border border-line-strong bg-[#08101ee6] text-ink hover:bg-surface-3">
      <Icon name={icon} className="size-4" />
    </button>
  );
}

export function GeoMap({
  sites,
  focusSite,
  onSelectSite,
  overlay,
  footprint,
  compact = false,
  initialBasemap = "nac",
  compactHeightClass = "h-[300px]",
  followFocus = false,
  showCredit = false,
  reliefFallback = false,
}: {
  sites: Site[];
  focusSite: SiteId;
  onSelectSite?: (s: SiteId) => void;
  overlay?: GeoMapOverlay;
  /** Huella de un producto (anillos en X/Y) que se dibuja y encuadra. */
  footprint?: { rings: XY[][]; label: string } | null;
  compact?: boolean;
  initialBasemap?: BasemapId;
  /** Solo modo compacto: altura del mapa. */
  compactHeightClass?: string;
  /** Solo modo compacto: centra el sitio activo (y lo sigue al cambiar) con el otro sitio dentro del encuadre. */
  followFocus?: boolean;
  /** Solo modo compacto: crédito y estado de la capa visibles sobre el mapa. */
  showCredit?: boolean;
  /** Solo modo compacto: si las teselas fallan, usa el relieve del DEM rotulado como derivado. */
  reliefFallback?: boolean;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const layersRef = useRef<{ base?: TileLayer | ImageLayer<ImageStatic>; analytic?: ImageLayer<ImageStatic> }>({});
  const sourcesRef = useRef({ sites: new VectorSource(), rois: new VectorSource(), measure: new VectorSource(), overlay: new VectorSource(), inspect: new VectorSource(), footprint: new VectorSource() });
  const onSelectRef = useRef(onSelectSite);
  const toolRef = useRef<"inspect" | "measure">("inspect");

  const [basemap, setBasemap] = useState<BasemapId>(initialBasemap);
  const [analytic, setAnalytic] = useState<AnalyticId>("none");
  const [opacity, setOpacity] = useState(0.7);
  const [showRois, setShowRois] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [tool, setTool] = useState<"inspect" | "measure">("inspect");
  const [grids, setGrids] = useState<Partial<Record<TerrainLayerId, RasterGrid>>>({});
  const [terrainError, setTerrainError] = useState<string | null>(null);
  const [tiles, setTiles] = useState<{ key: string; status: TileStatus; detail?: string; cap?: WmtsCapabilities; loaded: number }>({ key: "", status: "loading", loaded: 0 });
  const [view, setView] = useState<{ resolution: number; center: XY }>({ resolution: 3, center: { x: 0, y: 0 } });
  const [hover, setHover] = useState<XY | null>(null);
  const [inspected, setInspected] = useState<XY | null>(null);
  const [measure, setMeasure] = useState<XY[]>([]);

  useEffect(() => {
    onSelectRef.current = onSelectSite;
    toolRef.current = tool;
  });

  const ensureLayer = useCallback((id: TerrainLayerId) => {
    loadTerrainLayer(id)
      .then((g) => setGrids((prev) => (prev[id] ? prev : { ...prev, [id]: g })))
      .catch((e: Error) => setTerrainError(e.message));
  }, []);

  /* ------------------------------ mapa base ------------------------------ */
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    const s = sourcesRef.current;
    const mid = { x: (sites[0].x_m + sites[1].x_m) / 2, y: (sites[0].y_m + sites[1].y_m) / 2 };
    const vector = (source: VectorSource, zIndex: number) => new VectorLayer({ source, zIndex, updateWhileInteracting: true });
    const map = new OlMap({
      target: el,
      keyboardEventTarget: el,
      controls: scaleRef.current ? [new ScaleLine({ target: scaleRef.current, units: "metric", minWidth: 90 })] : [],
      layers: [vector(s.footprint, 9), vector(s.rois, 10), vector(s.overlay, 11), vector(s.measure, 12), vector(s.inspect, 13), vector(s.sites, 14)],
      view: new View({ projection: PROJECTION, center: [mid.x, mid.y], resolution: compact ? 6 : 2.5, minResolution: 0.4, maxResolution: 400, extent: [-160000, -160000, 160000, 160000] }),
    });
    mapRef.current = map;
    const sync = () => {
      const v = map.getView();
      const c = v.getCenter() ?? [0, 0];
      setView({ resolution: v.getResolution() ?? 1, center: { x: c[0], y: c[1] } });
    };
    map.on("moveend", sync);
    map.once("postrender", sync);
    map.on("singleclick", (evt) => {
      const site = map.forEachFeatureAtPixel(evt.pixel, (f) => f.get("siteId") as SiteId | undefined, { hitTolerance: 6 });
      if (site) {
        const st = sites.find((x) => x.id === site)!;
        onSelectRef.current?.(site);
        setInspected({ x: st.x_m, y: st.y_m });
        return;
      }
      const p = { x: evt.coordinate[0], y: evt.coordinate[1] };
      if (toolRef.current === "measure") setMeasure((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
      else setInspected(p);
    });
    let raf = 0;
    map.on("pointermove", (evt) => {
      if (evt.dragging) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setHover({ x: evt.coordinate[0], y: evt.coordinate[1] }));
    });
    return () => {
      cancelAnimationFrame(raf);
      map.setTarget(undefined);
      mapRef.current = null;
      layersRef.current = {};
    };
    // El mapa se crea una vez; sitios y modo compacto no cambian durante su vida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => ensureLayer("elevation"), [ensureLayer]);

  useEffect(() => {
    if (!compact || !followFocus) return;
    const map = mapRef.current;
    const el = targetRef.current;
    const st = sites.find((x) => x.id === focusSite);
    const other = sites.find((x) => x.id !== focusSite);
    if (!map || !el || !st) return;
    const span = other ? Math.hypot(other.x_m - st.x_m, other.y_m - st.y_m) : 300;
    // Ancho útil sin la columna de botones de zoom (≈ 56 px).
    const px = Math.max(140, Math.min((el.clientWidth || 300) - 56, el.clientHeight || 300));
    // Activo cerca del centro (desplazado un 25 % hacia el otro) y el otro dentro del encuadre con margen;
    // nunca por debajo del detalle servido (~2 m/px).
    const resolution = Math.max(2.2, (2.6 * span) / px);
    const cx = other ? st.x_m + 0.25 * (other.x_m - st.x_m) : st.x_m;
    const cy = other ? st.y_m + 0.25 * (other.y_m - st.y_m) : st.y_m;
    map.getView().animate({ center: [cx + 28 * resolution, cy], resolution, duration: 250 });
  }, [compact, followFocus, focusSite, sites]);

  /* ------------------------- fondo: teselas o relieve ------------------------ */
  const elevation = grids.elevation;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const drop = () => {
      if (layersRef.current.base) map.removeLayer(layersRef.current.base);
      layersRef.current.base = undefined;
    };
    drop();
    if (basemap === "none") return;
    if (basemap === "relief") {
      if (!elevation) return;
      const layer = new ImageLayer({
        zIndex: 0,
        source: new ImageStatic({ url: rgbaToUrl(hillshade(elevation), elevation.width, elevation.height), imageExtent: [...TERRAIN_BOUNDS], projection: PROJECTION, interpolate: true }),
      });
      layersRef.current.base = layer;
      map.addLayer(layer);
      return drop;
    }
    const asset = registryAsset(BASEMAP_ASSET[basemap])!;
    const key = `${basemap}`;
    const ctrl = new AbortController();
    let loaded = 0;
    let errors = 0;
    fetch(asset.capabilities_url!, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((xml) => {
        let cap: WmtsCapabilities;
        try {
          cap = parseWmtsCapabilities(xml);
          const issues = checkPolarStereographicGrid(cap);
          if (issues.length) throw new Error(issues.join("; "));
        } catch (e) {
          setTiles({ key, status: "invalid", detail: (e as Error).message, loaded: 0 });
          return;
        }
        const grid = new TileGrid({
          origin: cap.matrices[0].topLeft,
          resolutions: cap.matrices.map((m) => m.resolution),
          tileSize: [cap.matrices[0].tileWidth, cap.matrices[0].tileHeight],
          extent: cap.bbox,
        });
        const source = new TileImage({
          projection: PROJECTION,
          tileGrid: grid,
          crossOrigin: "anonymous",
          tileUrlFunction: ([z, col, row]) => {
            const m = cap.matrices[z];
            return m && col >= 0 && row >= 0 && col < m.matrixWidth && row < m.matrixHeight ? tileUrl(cap, m.id, row, col) : undefined;
          },
        });
        source.on("tileloadend", () => {
          loaded++;
          if (loaded === 1 || loaded % 8 === 0) setTiles({ key, status: "available", cap, loaded });
        });
        source.on("tileloaderror", () => {
          errors++;
          if (loaded === 0 && errors >= 3) setTiles({ key, status: "unavailable", detail: L("Las teselas no se pudieron descargar.", "Tiles could not be downloaded."), cap, loaded: 0 });
        });
        const layer = new TileLayer({ source, zIndex: 0 });
        layersRef.current.base = layer;
        map.addLayer(layer);
        setTiles({ key, status: "loading", cap, loaded: 0 });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setTiles({ key, status: "unavailable", detail: e.message, loaded: 0 });
      });
    return () => {
      ctrl.abort();
      drop();
    };
  }, [basemap, elevation]);

  /* ----------------------------- capa analítica ----------------------------- */
  const analyticGrid = analytic === "none" ? undefined : grids[analytic];
  useEffect(() => {
    if (analytic !== "none" && !analyticGrid) ensureLayer(analytic);
  }, [analytic, analyticGrid, ensureLayer]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || analytic === "none" || !analyticGrid) return;
    const st = layerEntry(analytic).stats;
    const layer = new ImageLayer({
      zIndex: 2,
      source: new ImageStatic({ url: rgbaToUrl(colorizeRaster(analyticGrid, st.min, st.max, LAYER_STYLE[analytic]), analyticGrid.width, analyticGrid.height), imageExtent: [...TERRAIN_BOUNDS], projection: PROJECTION, interpolate: false }),
    });
    layersRef.current.analytic = layer;
    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
      layersRef.current.analytic = undefined;
    };
  }, [analytic, analyticGrid]);
  useEffect(() => {
    layersRef.current.analytic?.setOpacity(opacity);
  }, [opacity, analytic, analyticGrid]);

  /* ------------------------------- vectores ------------------------------- */
  useEffect(() => {
    const src = sourcesRef.current.sites;
    src.clear();
    if (!showMarkers) return;
    for (const s of sites) {
      const id = s.id as SiteId;
      const focused = id === focusSite;
      const f = new Feature({ geometry: new Point([s.x_m, s.y_m]), siteId: id });
      f.setStyle([
        new Style({ image: new CircleStyle({ radius: focused ? 13 : 10, stroke: new Stroke({ color: "#050912cc", width: 6 }) }) }),
        new Style({
          image: new CircleStyle({ radius: focused ? 13 : 10, stroke: new Stroke({ color: SITE_HEX[id], width: 3 }), fill: new Fill({ color: focused ? `${SITE_HEX[id]}33` : "#00000000" }) }),
          text: new Text({ text: id, font: "700 13px Inter, sans-serif", offsetY: -24, fill: new Fill({ color: SITE_HEX[id] }), stroke: new Stroke({ color: "#050912", width: 4 }) }),
        }),
        new Style({ image: new CircleStyle({ radius: 2.5, fill: new Fill({ color: SITE_HEX[id] }) }) }),
      ]);
      src.addFeature(f);
    }
  }, [sites, focusSite, showMarkers]);

  useEffect(() => {
    const src = sourcesRef.current.rois;
    src.clear();
    if (!showRois) return;
    let alive = true;
    loadRois()
      .then((rois) => {
        if (!alive) return;
        for (const r of rois) {
          const site = sites.find((s) => s.roi === r.roi);
          const color = site ? SITE_HEX[site.id as SiteId] : "#e8eef8";
          const f = new Feature({ geometry: new Polygon(r.rings) });
          f.setStyle(
            new Style({
              stroke: new Stroke({ color: site ? color : "#e8eef8aa", width: site ? 2 : 1.2, lineDash: site ? undefined : [5, 4] }),
              fill: new Fill({ color: site ? `${color}14` : "#e8eef808" }),
              text: new Text({ text: `ROI ${r.roi}`, font: "600 11px Inter, sans-serif", fill: new Fill({ color: "#e8eef8" }), stroke: new Stroke({ color: "#050912", width: 3 }), overflow: false }),
            }),
          );
          src.addFeature(f);
        }
      })
      .catch((e: Error) => setTerrainError(e.message));
    return () => {
      alive = false;
    };
  }, [showRois, sites]);

  useEffect(() => {
    const src = sourcesRef.current.measure;
    src.clear();
    if (!measure.length) return;
    const dot = new Style({ image: new CircleStyle({ radius: 4.5, fill: new Fill({ color: "#ffffff" }), stroke: new Stroke({ color: "#050912", width: 2 }) }) });
    for (const p of measure) {
      const f = new Feature({ geometry: new Point([p.x, p.y]) });
      f.setStyle(dot);
      src.addFeature(f);
    }
    if (measure.length === 2) {
      const f = new Feature({ geometry: new LineString(measure.map((p) => [p.x, p.y])) });
      f.setStyle([new Style({ stroke: new Stroke({ color: "#050912", width: 5 }) }), new Style({ stroke: new Stroke({ color: "#ffffff", width: 2, lineDash: [7, 5] }) })]);
      src.addFeature(f);
    }
  }, [measure]);

  useEffect(() => {
    const src = sourcesRef.current.inspect;
    src.clear();
    if (!inspected) return;
    const f = new Feature({ geometry: new Point([inspected.x, inspected.y]) });
    f.setStyle(new Style({ image: new CircleStyle({ radius: 6, stroke: new Stroke({ color: "#ffffff", width: 2 }), fill: new Fill({ color: "#3a6ff0aa" }) }) }));
    src.addFeature(f);
  }, [inspected]);

  const footprintKey = footprint ? `${footprint.label}|${footprint.rings.length}|${footprint.rings[0]?.[0]?.x}` : "";
  useEffect(() => {
    const src = sourcesRef.current.footprint;
    src.clear();
    if (!footprint || !footprint.rings.length) return;
    const f = new Feature({ geometry: new Polygon(footprint.rings.map((r) => r.map((p) => [p.x, p.y]))) });
    f.setStyle(
      new Style({
        stroke: new Stroke({ color: "#f5c518", width: 2 }),
        fill: new Fill({ color: "#f5c51814" }),
        text: new Text({ text: footprint.label, font: "600 11px Inter, sans-serif", fill: new Fill({ color: "#f5c518" }), stroke: new Stroke({ color: "#050912", width: 3 }), overflow: true }),
      }),
    );
    src.addFeature(f);
    const ext = src.getExtent();
    if (ext) mapRef.current?.getView().fit(ext, { padding: [30, 30, 30, 30], duration: 250 });
    // `footprintKey` resume el contenido de `footprint`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [footprintKey]);

  const overlayKey = overlay ? JSON.stringify(overlay) : "";
  useEffect(() => {
    const src = sourcesRef.current.overlay;
    src.clear();
    if (!overlay) return;
    const line = new Feature({ geometry: new LineString(overlay.line.map((p) => [p.x, p.y])) });
    line.setStyle([new Style({ stroke: new Stroke({ color: "#050912", width: 5 }) }), new Style({ stroke: new Stroke({ color: UNCERTAINTY_HEX, width: 2.5 }) })]);
    src.addFeature(line);
    if (overlay.point) {
      const pt = new Feature({ geometry: new Point([overlay.point.x, overlay.point.y]) });
      pt.setStyle(
        new Style({
          image: new CircleStyle({ radius: 7, fill: new Fill({ color: UNCERTAINTY_HEX }), stroke: new Stroke({ color: "#050912", width: 2 }) }),
          text: overlay.label ? new Text({ text: overlay.label, font: "600 12px Inter, sans-serif", offsetY: -18, fill: new Fill({ color: "#e8eef8" }), stroke: new Stroke({ color: "#050912", width: 4 }) }) : undefined,
        }),
      );
      src.addFeature(pt);
    }
    if (compact) {
      const ext = src.getExtent();
      if (ext) mapRef.current?.getView().fit(ext, { padding: [40, 40, 40, 40], duration: 200 });
    }
    // `overlayKey` resume el contenido del objeto `overlay`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayKey, compact]);

  const tileFailed = (basemap === "nac" || basemap === "wac") && tiles.key === basemap && (tiles.status === "unavailable" || tiles.status === "invalid");
  const [fellBack, setFellBack] = useState(false);
  useEffect(() => {
    if (!compact || !reliefFallback || !tileFailed) return;
    const t = setTimeout(() => {
      setFellBack(true);
      setBasemap("relief");
    }, 0);
    return () => clearTimeout(t);
  }, [compact, reliefFallback, tileFailed]);

  /* ------------------------------- acciones ------------------------------- */
  const zoomBy = (f: number) => {
    const v = mapRef.current?.getView();
    if (v) v.animate({ resolution: (v.getResolution() ?? 1) * f, duration: 180 });
  };
  const centerOn = (p: XY, resolution?: number) => mapRef.current?.getView().animate({ center: [p.x, p.y], resolution, duration: 250 });
  const fitWindow = () => mapRef.current?.getView().fit([...TERRAIN_BOUNDS], { padding: [16, 16, 16, 16], duration: 250 });

  /* ------------------------------- lecturas ------------------------------- */
  const tileState: TileStatus | null = basemap === "nac" || basemap === "wac" ? (tiles.key === basemap ? tiles.status : "loading") : null;
  const tileAsset = basemap === "nac" || basemap === "wac" ? registryAsset(BASEMAP_ASSET[basemap])! : null;
  const cap = tiles.key === basemap ? tiles.cap : undefined;
  const outOfTileCoverage = cap ? view.center.x < cap.bbox[0] || view.center.x > cap.bbox[2] || view.center.y < cap.bbox[1] || view.center.y > cap.bbox[3] : false;
  const beyondDetail = tileAsset?.finest_tile_resolution_m ? view.resolution < tileAsset.finest_tile_resolution_m * 0.75 : false;

  const reading = useMemo(() => {
    if (!inspected) return null;
    const { lonEastDeg, latDeg } = xyToLonLat(inspected.x, inspected.y);
    const [xmin, ymin, xmax, ymax] = TERRAIN_BOUNDS;
    const inside = inspected.x >= xmin && inspected.x <= xmax && inspected.y >= ymin && inspected.y <= ymax;
    const values = ANALYTIC_LAYERS.map((id) => {
      const g = grids[id];
      if (!g) return { id, state: "loading" as const };
      const v = id === "elevation" ? sampleBilinear(g, inspected.x, inspected.y) : sampleNearest(g, inspected.x, inspected.y);
      if (v === null || !inside) return { id, state: "outside" as const };
      if (!Number.isFinite(v)) {
        // En el borde de la ventana la interpolación bilineal no tiene los cuatro vecinos: se usa el píxel.
        const px = sampleNearest(g, inspected.x, inspected.y);
        return px !== null && Number.isFinite(px) ? { id, state: "ok" as const, value: px } : { id, state: "nodata" as const };
      }
      return { id, state: "ok" as const, value: v };
    });
    return { lonEastDeg, latDeg, inside, values };
  }, [inspected, grids]);

  useEffect(() => {
    if (inspected) for (const id of ANALYTIC_LAYERS) if (!grids[id]) ensureLayer(id);
  }, [inspected, grids, ensureLayer]);

  const measured = useMemo(() => {
    if (measure.length !== 2) return null;
    const [a, b] = measure;
    const arc = arcDistanceM(a, b);
    const g = grids.elevation;
    const za = g ? sampleBilinear(g, a.x, a.y) : NaN;
    const zb = g ? sampleBilinear(g, b.x, b.y) : NaN;
    const both = Number.isFinite(za) && Number.isFinite(zb);
    const profile = g ? profileAlong(g, [a, b], arcDistanceM) : [];
    return {
      arc,
      planar: Math.hypot(a.x - b.x, a.y - b.y),
      scale: stereographicScale((a.x + b.x) / 2, (a.y + b.y) / 2),
      azimuth: azimuthBetween(a, b),
      chord: both ? chordDistanceM({ ...a, z: za }, { ...b, z: zb }) : null,
      dz: both ? zb - za : null,
      profile,
      gaps: profile.filter((s) => s.value === null).length,
    };
  }, [measure, grids.elevation]);

  const fmtXY = (p: XY) => `X ${formatNumber(p.x, 1)} m · Y ${formatNumber(p.y, 1)} m`;
  const statusBadge = (s: TileStatus) =>
    s === "available" ? (
      <Badge tone="ok" icon="check">{L("Teselas reales recibidas", "Real tiles received")}</Badge>
    ) : s === "loading" ? (
      <Badge tone="neutral">{L("Cargando…", "Loading…")}</Badge>
    ) : s === "invalid" ? (
      <Badge tone="warn" icon="alert">{L("Respuesta no válida", "Invalid response")}</Badge>
    ) : (
      <Badge tone="warn" icon="alert">{L("Servidor no disponible", "Server unavailable")}</Badge>
    );

  const mapBox = (
    <div className="relative">
      <div
        ref={targetRef}
        tabIndex={0}
        role="group"
        aria-label={L(
          "Mapa georreferenciado de Connecting Ridge. Con el foco en el mapa: flechas para desplazar, + y − para ampliar. Usa «Leer el centro» para inspeccionar sin ratón.",
          "Georeferenced map of Connecting Ridge. With focus on the map: arrow keys to pan, + and − to zoom. Use “Read the centre” to inspect without a mouse.",
        )}
        className={`geomap w-full overflow-hidden rounded-xl border border-line-strong bg-[#03060d] ${compact ? compactHeightClass : "h-[440px] sm:h-[560px]"} ${tool === "measure" ? "cursor-crosshair" : ""}`}
      />
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 opacity-70">
        <span className="absolute top-1/2 left-0 h-px w-full bg-white" />
        <span className="absolute top-0 left-1/2 h-full w-px bg-white" />
      </div>
      <div className="absolute top-3 right-3 flex flex-col gap-1.5">
        <MapButton icon="zoomIn" label={L("Acercar", "Zoom in")} onClick={() => zoomBy(0.5)} />
        <MapButton icon="zoomOut" label={L("Alejar", "Zoom out")} onClick={() => zoomBy(2)} />
        <MapButton icon="maximize" label={L("Ver toda la ventana del DEM", "Show the whole DEM window")} onClick={() => fitWindow()} />
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-line-strong bg-[#08101ee6] px-2.5 py-1.5 text-[11px] text-ink-muted">
        <div ref={scaleRef} className="geomap-scale" />
        {compact && showCredit ? null : <span className="tabular">≈ {formatNumber(view.resolution, 2)} {L("m por píxel de pantalla", "m per screen pixel")}</span>}
      </div>
      {hover && !compact ? (
        <div className="pointer-events-none absolute right-3 bottom-3 hidden rounded-lg border border-line-strong bg-[#08101ee6] px-2.5 py-1.5 font-mono text-[11px] text-ink-muted sm:block">{fmtXY(hover)}</div>
      ) : null}
    </div>
  );

  if (compact) {
    const status: string = fellBack ? "relief-fallback" : tileState ?? (basemap === "relief" ? "relief" : "none");
    return (
      <div data-testid="geomap" data-basemap={basemap} data-basemap-status={status} data-focus-site={focusSite} className="flex flex-col gap-2">
        <div className="relative">
          {mapBox}
          {showCredit ? (
            <div className="pointer-events-none absolute top-2 left-2 flex max-w-[75%] flex-col items-start gap-1" data-testid="geomap-credit" aria-live="polite">
              <span className="rounded-md border border-line-strong bg-[#08101ee6] px-2 py-0.5 text-[10px] font-semibold text-ink">
                {basemap === "relief" ? L("Relieve derivado del DEM PGDA78 · luz sintética", "Shaded relief derived from the PGDA78 DEM · synthetic light") : "NASA Moon Trek · LRO/LROC NAC"}
              </span>
              {fellBack ? (
                <span className="rounded-md border border-warn/50 bg-[#08101ee6] px-2 py-0.5 text-[10px] text-warn">{L("Imagen orbital no disponible (sin conexión)", "Orbital image unavailable (offline)")}</span>
              ) : tileState === "loading" ? (
                <span className="rounded-md bg-[#08101ee6] px-2 py-0.5 text-[10px] text-ink-faint">{L("Cargando teselas…", "Loading tiles…")}</span>
              ) : tileState === "unavailable" || tileState === "invalid" ? (
                <span className="rounded-md border border-warn/50 bg-[#08101ee6] px-2 py-0.5 text-[10px] text-warn">{L("Imagen orbital no disponible", "Orbital image unavailable")}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {terrainError ? <Callout tone="danger">{terrainError}</Callout> : null}
      </div>
    );
  }

  return (
    <div
      data-testid="geomap"
      data-basemap={basemap}
      data-basemap-status={tileState ?? (basemap === "relief" ? (elevation ? "available" : "loading") : "none")}
      data-analytic={analytic}
      data-analytic-ready={analytic !== "none" && analyticGrid ? "true" : "false"}
      data-tiles-loaded={tiles.key === basemap ? tiles.loaded : 0}
      data-footprint={footprint?.label ?? ""}
      className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{L("Imagen de fondo", "Background image")}</legend>
          {(
            [
              ["nac", assetTitle(registryAsset(BASEMAP_ASSET.nac)), L("Imágenes orbitales reales · NASA Moon Trek · en línea", "Real orbital images · NASA Moon Trek · online")],
              ["wac", assetTitle(registryAsset(BASEMAP_ASSET.wac)), L("Imágenes orbitales reales · 100 m · en línea", "Real orbital images · 100 m · online")],
              ["relief", L("Relieve sombreado del DEM", "Shaded relief from the DEM"), L("Derivado calculado por SITE REGRET · luz sintética · sin red", "Derived by SITE REGRET · synthetic light · offline")],
              ["none", L("Sin fondo", "No background"), ""],
            ] as const
          ).map(([id, title, sub]) => (
            <label key={id} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-sm transition-colors ${basemap === id ? "border-accent/60 bg-accent-surface/40" : "border-line bg-bg-2/70 hover:border-line-strong"}`}>
              <input type="radio" name="geomap-basemap" value={id} checked={basemap === id} onChange={() => setBasemap(id)} className="mt-1 accent-[#8fb4ff]" />
              <span className="min-w-0">
                <span className="block text-ink">{title}</span>
                {sub ? <span className="block text-[11px] text-ink-faint">{sub}</span> : null}
              </span>
            </label>
          ))}
          {tileState && tileAsset ? (
            <div className="flex flex-col gap-1.5 text-[11px] text-ink-faint" aria-live="polite">
              <span>{statusBadge(tileState)}</span>
              {tileState === "unavailable" || tileState === "invalid" ? (
                <span className="text-warn">
                  {L("No se muestra ninguna imagen de sustitución. Puedes usar el relieve del DEM, que no necesita red.", "No substitute image is shown. You can use the DEM relief, which needs no network.")}
                  {tiles.detail ? ` (${tiles.detail})` : ""}
                </span>
              ) : null}
              {outOfTileCoverage ? <span className="text-warn">{L("El centro del mapa está fuera de la cobertura de esta capa.", "The map centre is outside this layer's coverage.")}</span> : null}
              {beyondDetail ? (
                <span>
                  {L(
                    `Ampliación por encima del detalle servido (${formatNumber(tileAsset.finest_tile_resolution_m ?? 0, 2)} m/píxel): no aparece detalle nuevo.`,
                    `Zoomed beyond the served detail (${formatNumber(tileAsset.finest_tile_resolution_m ?? 0, 2)} m/pixel): no new detail appears.`,
                  )}
                </span>
              ) : null}
              <span>
                {L("Mosaico multitemporal: sus sombras son las de cada adquisición, no las del instante elegido en Timeline.", "Multi-temporal mosaic: its shadows are those of each acquisition, not of the instant chosen in Timeline.")}{" "}
                <Link href={evidenceHref(tileAsset.id)} className="text-accent underline-offset-2 hover:underline">
                  {L("Procedencia", "Provenance")}
                </Link>
              </span>
              <span>{tileAsset.credit}</span>
            </div>
          ) : basemap === "relief" ? (
            <p className="text-[11px] text-ink-faint">
              {L("Sombreado calculado con el DEM PGDA78 (5 m). La luz no representa al Sol real.", "Shading computed from the PGDA78 DEM (5 m). The light does not represent the real Sun.")}{" "}
              <Link href={evidenceHref("pgda78.site01.elevation")} className="text-accent underline-offset-2 hover:underline">
                {L("Procedencia", "Provenance")}
              </Link>
            </p>
          ) : null}
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{L("Capa numérica del DEM (PGDA78)", "Numeric DEM layer (PGDA78)")}</legend>
          <label className="sr-only" htmlFor="geomap-analytic">
            {L("Capa numérica", "Numeric layer")}
          </label>
          <select id="geomap-analytic" value={analytic} onChange={(e) => setAnalytic(e.target.value as AnalyticId)} className="w-full min-w-0 rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink">
            <option value="none">{L("Ninguna", "None")}</option>
            {ANALYTIC_LAYERS.map((id) => (
              <option key={id} value={id}>
                {assetTitle(registryAsset(layerEntry(id).registry_id))}
              </option>
            ))}
          </select>
          {analytic !== "none" ? (
            <>
              <label className="flex items-center gap-3 text-xs text-ink-muted">
                {L("Opacidad", "Opacity")}
                <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="flex-1 accent-[#8fb4ff]" aria-valuetext={`${Math.round(opacity * 100)} %`} />
                <span className="tabular w-9 text-right">{Math.round(opacity * 100)} %</span>
              </label>
              {analyticGrid ? <Legend id={analytic} /> : <p className="text-xs text-ink-faint">{L("Cargando y verificando la capa…", "Loading and verifying the layer…")}</p>}
            </>
          ) : (
            <p className="text-[11px] text-ink-faint">{L("Valores float32 del producto publicado, sin remuestrear. Cubre la ventana de 4 × 4 km.", "float32 values of the published product, not resampled. Covers the 4 × 4 km window.")}</p>
          )}
        </fieldset>

        <div className="flex flex-col gap-3">
          <Toggle label={L("Sitios A / B", "Sites A / B")} description={L("Coordenadas del paquete (sites[].x_m, y_m)", "Package coordinates (sites[].x_m, y_m)")} checked={showMarkers} onChange={setShowMarkers} />
          <Toggle label={L("Regiones de interés publicadas", "Published regions of interest")} description={L("7 ROI de PGDA78 Site01; no son sitios aprobados", "7 PGDA78 Site01 ROIs; not approved sites")} checked={showRois} onChange={setShowRois} />
        </div>

        <Segmented
          label={L("Herramienta", "Tool")}
          value={tool}
          onChange={(v) => {
            setTool(v);
            if (v === "inspect") setMeasure([]);
          }}
          options={[
            { value: "inspect", label: L("Leer punto", "Read point") },
            { value: "measure", label: L("Medir y perfil", "Measure & profile") },
          ]}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {mapBox}
        <div className="flex flex-wrap gap-2">
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onSelectSite?.(s.id as SiteId);
                centerOn({ x: s.x_m, y: s.y_m }, Math.min(view.resolution, 2.5));
                setInspected({ x: s.x_m, y: s.y_m });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-3"
            >
              <span className="inline-block size-2.5 rounded-full" style={{ background: SITE_HEX[s.id as SiteId] }} />
              {L(`Ir y leer en ${SITE_META[s.id as SiteId].label}`, `Go to and read ${SITE_META[s.id as SiteId].label}`)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => (tool === "measure" ? setMeasure((prev) => (prev.length >= 2 ? [view.center] : [...prev, view.center])) : setInspected(view.center))}
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-3"
          >
            <Icon name="target" className="size-3.5" />
            {tool === "measure" ? L("Añadir el centro como punto", "Add the centre as a point") : L("Leer el centro", "Read the centre")}
          </button>
        </div>

        {terrainError ? (
          <Callout tone="danger" icon="alert" title={L("Capa numérica no disponible", "Numeric layer unavailable")}>
            {terrainError} {L("No se sustituye por valores aproximados.", "It is not replaced by approximate values.")}
          </Callout>
        ) : null}

        {tool === "inspect" ? (
          <div className="rounded-xl border border-line bg-bg-2/70 p-4" data-testid="geomap-inspector" aria-live="polite">
            {reading && inspected ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="tabular font-mono text-ink" data-testid="geomap-xy">{fmtXY(inspected)}</span>
                  <span className="tabular text-ink-muted">
                    {formatNumber(Math.abs(reading.latDeg), 5)}° S · {formatNumber(reading.lonEastDeg, 5)}° E
                  </span>
                  {reading.inside ? <Badge tone="ok">{L("Dentro de la ventana del DEM", "Inside the DEM window")}</Badge> : <Badge tone="warn" icon="alert">{L("Fuera de la cobertura preparada", "Outside the prepared coverage")}</Badge>}
                </div>
                <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  {reading.values.map((v) => {
                    const entry = layerEntry(v.id);
                    return (
                      <div key={v.id} className="flex items-baseline justify-between gap-3 border-b border-line/50 py-1" data-layer={v.id}>
                        <dt className="min-w-0 text-ink-muted">
                          <Link href={evidenceHref(entry.registry_id)} className="hover:text-accent hover:underline">
                            {assetTitle(registryAsset(entry.registry_id))}
                          </Link>
                        </dt>
                        <dd className="tabular shrink-0 font-semibold text-ink">
                          {v.state === "ok"
                            ? `${formatNumber(v.value, v.id === "lola_count" ? 0 : 3)}${unitLabel(entry.units)}`
                            : v.state === "loading"
                              ? "…"
                              : v.state === "nodata"
                                ? L("sin dato", "no data")
                                : L("sin cobertura", "no coverage")}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="text-[11px] text-ink-faint">
                  {L(
                    "Altura: interpolación bilineal entre centros de píxel (como el motor). Resto: valor del píxel de 5 m. Marco MOON_ME_DE421, esfera de 1 737 400 m. Un valor de 0 retornos LOLA indica altura interpolada por el proveedor.",
                    "Height: bilinear interpolation between pixel centres (as the engine does). Others: value of the 5 m pixel. Frame MOON_ME_DE421, 1,737,400 m sphere. 0 LOLA returns means the height was interpolated by the provider.",
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">{L("Pulsa el mapa, un sitio o «Leer el centro» para ver coordenadas, altura, calidad y cobertura del punto.", "Click the map, a site or “Read the centre” to see the point's coordinates, height, quality and coverage.")}</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-bg-2/70 p-4" data-testid="geomap-measure" aria-live="polite">
            {measured ? (
              <div className="flex flex-col gap-3">
                <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  {(
                    [
                      [L("Distancia sobre la esfera de referencia", "Distance on the reference sphere"), `${formatNumber(measured.arc, 1)} m`],
                      [L("Distancia 3D entre los dos puntos", "3D distance between the two points"), measured.chord === null ? L("sin dato", "no data") : `${formatNumber(measured.chord, 1)} m`],
                      [L("Desnivel (final − inicio)", "Height difference (end − start)"), measured.dz === null ? L("sin dato", "no data") : `${formatNumber(measured.dz, 2)} m`],
                      [L("Azimut desde el primer punto", "Azimuth from the first point"), `${formatNumber(measured.azimuth, 2)}°`],
                      [L("Distancia en el plano del mapa", "Distance on the map plane"), `${formatNumber(measured.planar, 1)} m (×${formatNumber(measured.scale, 6)})`],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line/50 py-1">
                      <dt className="text-ink-muted">{k}</dt>
                      <dd className="tabular font-semibold text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                <ProfileChart samples={measured.profile} />
                <p className="text-[11px] text-ink-faint">
                  {L(
                    `Perfil muestreado del DEM cada 5 m (interpolación bilineal), no de los colores del mapa. ${measured.gaps} muestras sin dato se dejan en blanco. Radio lunar 1 737 400 m.`,
                    `Profile sampled from the DEM every 5 m (bilinear), not from the map colours. ${measured.gaps} samples without data are left blank. Lunar radius 1,737,400 m.`,
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                {L(`Marca dos puntos en el mapa (${measure.length} de 2).`, `Mark two points on the map (${measure.length} of 2).`)}
              </p>
            )}
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-ink-faint">
          {L(
            `Proyección estereográfica polar sur lunar (R = 1 737 400 m), no una proyección terrestre. ${GEO_REGISTRY.assets.length} activos registrados; ventana numérica: X ${TERRAIN_BOUNDS[0]}…${TERRAIN_BOUNDS[2]} m, Y ${TERRAIN_BOUNDS[1]}…${TERRAIN_BOUNDS[3]} m.`,
            `Lunar south polar stereographic projection (R = 1,737,400 m), not a terrestrial one. ${GEO_REGISTRY.assets.length} registered assets; numeric window: X ${TERRAIN_BOUNDS[0]}…${TERRAIN_BOUNDS[2]} m, Y ${TERRAIN_BOUNDS[1]}…${TERRAIN_BOUNDS[3]} m.`,
          )}
        </p>
      </div>
    </div>
  );
}
