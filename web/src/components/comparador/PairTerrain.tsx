"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SiteId } from "@/lib/contract/constants";
import type { Site } from "@/lib/contract/schema";
import { formatNumber } from "@/lib/format";
import { LAYER_STYLE, colorizeRaster, hillshade, rampCss } from "@/lib/geospatial/colormap";
import { arcDistanceM, azimuthBetween } from "@/lib/geospatial/lunar";
import { sampleBilinear, subGrid, type RasterGrid } from "@/lib/geospatial/raster";
import { TERRAIN_MANIFEST, loadRois, loadTerrainLayer, registryAsset, type RoiPolygon, type TerrainLayerId } from "@/lib/geospatial/terrain";
import { L } from "@/lib/i18n";
import { SITE_META } from "@/lib/labels";
import { GeoMap, SITE_HEX, evidenceHref } from "../maps/GeoMap";
import { Callout } from "../ui/Display";
import { Panel } from "../ui/Panel";

/** Lado del recorte de cada sitio: 800 m (160 píxeles de 5 m), igual para A y B. */
const HALF_M = 400;
const LAYERS: TerrainLayerId[] = ["elevation", "slope", "lola_count", "vertical_rms", "slope_rms"];
type Overlay = "slope" | "lola_count" | "none";

function useLayers() {
  const [grids, setGrids] = useState<Partial<Record<TerrainLayerId, RasterGrid>>>({});
  const [rois, setRois] = useState<RoiPolygon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    for (const id of LAYERS) loadTerrainLayer(id).then((g) => alive && setGrids((p) => ({ ...p, [id]: g })), (e: Error) => alive && setError(e.message));
    loadRois().then((r) => alive && setRois(r), (e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);
  return { grids, rois, error };
}

/** Recorte georreferenciado del DEM alrededor de un sitio (misma escala para A y B). */
/**
 * Relieve en gris mineral: mismo sombreado (luz sintética NO, 45°) y la MISMA curva
 * de contraste para A y B, de modo que los dos recortes se comparan con justicia.
 */
function mineralize(rgba: Uint8ClampedArray<ArrayBuffer>) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (!rgba[i + 3]) continue;
    const t = Math.min(1, Math.max(0, (rgba[i] - 30) / 225));
    const v = Math.pow(t, 1.35);
    rgba[i] = 16 + 214 * v;
    rgba[i + 1] = 17 + 211 * v;
    rgba[i + 2] = 20 + 202 * v;
  }
}

function SiteCrop({ site, grids, rois, overlay, tone = "classic" }: { site: Site; grids: Partial<Record<TerrainLayerId, RasterGrid>>; rois: RoiPolygon[] | null; overlay: Overlay; tone?: "classic" | "mineral" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const id = site.id as SiteId;
  const elev = grids.elevation;
  const over = overlay === "none" ? undefined : grids[overlay];
  useEffect(() => {
    const c = ref.current;
    if (!c || !elev) return;
    const sub = subGrid(elev, site.x_m, site.y_m, HALF_M);
    const n = sub.width;
    const scale = 3;
    c.width = n * scale;
    c.height = n * scale;
    const ctx = c.getContext("2d")!;
    const tmp = document.createElement("canvas");
    tmp.width = n;
    tmp.height = n;
    // Ficha mineral: el sombreado exagera ×3 las pendientes (solo visual, igual en A y B) para leer crestas y cráteres.
    const base = tone === "mineral" ? hillshade({ ...sub, data: sub.data.map((v) => v * 3) }) : hillshade(sub);
    if (tone === "mineral") mineralize(base);
    if (over) {
      const st = TERRAIN_MANIFEST.layers.find((l) => l.id === overlay)!.stats;
      const col = colorizeRaster(subGrid(over, site.x_m, site.y_m, HALF_M), st.min, st.max, LAYER_STYLE[overlay as TerrainLayerId]);
      for (let i = 0; i < base.length; i += 4) {
        if (!col[i + 3]) continue;
        const k = tone === "mineral" ? 0.45 : 0.55;
        base[i] = base[i] * (1 - k) + col[i] * k;
        base[i + 1] = base[i + 1] * (1 - k) + col[i + 1] * k;
        base[i + 2] = base[i + 2] * (1 - k) + col[i + 2] * k;
      }
    }
    tmp.getContext("2d")!.putImageData(new ImageData(base, n, n), 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, n * scale, n * scale);
    const toPx = (x: number, y: number) => [((x - sub.xmin) / sub.pixelSizeM) * scale, ((sub.ymax - y) / sub.pixelSizeM) * scale] as const;
    // ROI del sitio y vecinas (polígonos publicados, sin modificar).
    for (const r of rois ?? []) {
      const own = r.roi === site.roi;
      ctx.strokeStyle = own ? SITE_HEX[id] : "#e8eef888";
      ctx.lineWidth = own ? 2.5 : 1;
      ctx.setLineDash(own ? [] : [5, 4]);
      for (const ring of r.rings) {
        ctx.beginPath();
        ring.forEach(([x, y], k) => (k ? ctx.lineTo(...toPx(x, y)) : ctx.moveTo(...toPx(x, y))));
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    const [px, py] = toPx(site.x_m, site.y_m);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#050912";
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = SITE_HEX[id];
    ctx.stroke();
    // Barra de escala de 200 m.
    const bar = (200 / sub.pixelSizeM) * scale;
    ctx.fillStyle = "#050912cc";
    ctx.fillRect(10, n * scale - 30, bar + 16, 22);
    ctx.fillStyle = "#e8eef8";
    ctx.fillRect(18, n * scale - 16, bar, 3);
    ctx.font = "600 12px Inter, sans-serif";
    ctx.fillText("200 m", 18, n * scale - 19);
  }, [elev, over, overlay, rois, site, id, tone]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={L(`Recorte del DEM PGDA78 de 800 × 800 m centrado en ${SITE_META[id].label}`, `800 × 800 m PGDA78 DEM crop centred on ${SITE_META[id].label}`)}
      className="aspect-square w-full rounded-xl border border-line bg-[#03060d]"
      data-testid={`site-crop-${id}`}
    />
  );
}

const unit = (u: string) => (u === "deg" ? "°" : u === "count" ? "" : ` ${u}`);
const signed = (v: number, d: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatNumber(Math.abs(v), d)}`;

export interface TwinReading {
  label: string;
  a: string;
  b: string;
  note?: string;
}

const OVERLAY_LABEL = (): Record<Overlay, string> => ({ none: L("Relieve", "Relief"), slope: L("Pendiente", "Slope"), lola_count: L("Retornos LOLA", "LOLA returns") });

/**
 * Fichas gemelas A/B: mismo recorte (800 m), misma luz y misma curva de contraste;
 * capa opcional con leyenda y escala comunes; lectura principal bajo cada terreno.
 */
export function PairAtlas({ sites, reading }: { sites: Site[]; reading: TwinReading }) {
  const { grids, rois, error } = useLayers();
  const [overlay, setOverlay] = useState<Overlay>("none");
  const A = sites.find((s) => s.id === "A")!;
  const B = sites.find((s) => s.id === "B")!;
  const entry = overlay === "none" ? null : TERRAIN_MANIFEST.layers.find((l) => l.id === overlay)!;
  return (
    <section aria-label={L("Fichas de terreno A y B", "A and B terrain cards")} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface/85 p-4" data-testid="pair-terrain">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-[15px] font-semibold text-ink">{L("Terreno de A y B · misma escala", "A and B terrain · same scale")}</h2>
        <div role="radiogroup" aria-label={L("Capa sobre el relieve", "Layer over the relief")} className="ml-auto flex items-center gap-0.5 rounded-lg border border-line-strong bg-bg/80 p-0.5">
          {(["none", "slope", "lola_count"] as Overlay[]).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={overlay === o}
              onClick={() => setOverlay(o)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${overlay === o ? "bg-ink text-bg" : "text-ink-muted hover:bg-surface-3 hover:text-ink"}`}
            >
              {OVERLAY_LABEL()[o]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[A, B].map((s) => {
          const id = s.id as SiteId;
          return (
            <article key={s.id} className={`flex min-w-0 flex-col gap-2 rounded-xl border bg-bg-2/60 p-2 sm:p-3 ${id === "A" ? "border-site-a/35" : "border-site-b/35"}`} data-testid={`twin-${id}`}>
              <header className="flex flex-wrap items-baseline gap-x-2">
                <span className={`inline-block size-2.5 rounded-full ${SITE_META[id].bgClass}`} aria-hidden />
                <h3 className={`text-base font-bold ${SITE_META[id].textClass}`}>{SITE_META[id].label}</h3>
                <span className="text-xs text-ink-faint">ROI {s.roi}</span>
              </header>
              <div className="mx-auto w-full max-w-[175px] 2xl:max-w-[250px]">
                {grids.elevation ? <SiteCrop site={s} grids={grids} rois={rois} overlay={overlay} tone="mineral" /> : <span className="block aspect-square w-full animate-pulse rounded-xl bg-surface-3/50" />}
              </div>
              <div className="text-center">
                <p className="text-[11px] text-ink-faint">{reading.label}</p>
                <p className={`tabular text-2xl font-bold sm:text-3xl ${SITE_META[id].textClass}`} data-testid={`twin-reading-${id}`}>
                  {id === "A" ? reading.a : reading.b}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-faint" data-testid="pair-legend">
        {entry ? (
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-28 rounded-full" style={{ background: rampCss(LAYER_STYLE[overlay as TerrainLayerId].stops) }} />
            {formatNumber(entry.stats.min, overlay === "lola_count" ? 0 : 1)} → {formatNumber(entry.stats.max, overlay === "lola_count" ? 0 : 1)}
            {unit(entry.units)} · {L("misma escala en A y B (mín./máx. de la ventana de 4 × 4 km)", "same scale for A and B (min/max of the 4 × 4 km window)")}
          </span>
        ) : null}
        <span>{L("Relieve sombreado derivado del DEM PGDA78 (5 m): luz sintética del noroeste y relieve exagerado ×3 solo en el sombreado, idénticos en A y B. Recortes de 800 × 800 m; barra = 200 m.", "Shaded relief derived from the PGDA78 DEM (5 m): synthetic north-west light and ×3 relief exaggeration in the shading only, identical for A and B. 800 × 800 m crops; bar = 200 m.")}</span>
        {reading.note ? <span className="basis-full">{reading.note}</span> : null}
      </div>
      {error ? <Callout tone="danger">{error}</Callout> : null}
    </section>
  );
}

/** Contexto compacto: imagen orbital conjunta y lecturas del DEM en A y B. */
export function PairContext({ sites }: { sites: Site[] }) {
  const { grids } = useLayers();
  const A = sites.find((s) => s.id === "A")!;
  const B = sites.find((s) => s.id === "B")!;
  const rows = LAYERS.map((id) => {
    const g = grids[id];
    const entry = TERRAIN_MANIFEST.layers.find((l) => l.id === id)!;
    return { id, entry, a: g ? sampleBilinear(g, A.x_m, A.y_m) : null, b: g ? sampleBilinear(g, B.x_m, B.y_m) : null };
  });
  const arc = arcDistanceM({ x: A.x_m, y: A.y_m }, { x: B.x_m, y: B.y_m });
  const az = azimuthBetween({ x: A.x_m, y: A.y_m }, { x: B.x_m, y: B.y_m });
  return (
    <Panel title={L("Contexto: imagen orbital y terreno en el punto", "Context: orbital image and terrain at the point")} icon="map" bodyClassName="p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <figure className="flex min-w-0 flex-col gap-1.5">
          <GeoMap sites={sites} focusSite="A" compact compactHeightClass="h-[220px]" overlay={{ line: [{ x: A.x_m, y: A.y_m }, { x: B.x_m, y: B.y_m }], label: `${formatNumber(arc, 0)} m` }} />
          <figcaption className="text-[11px] text-ink-faint">
            {L(`NASA Moon Trek · LRO NAC. A → B: ${formatNumber(arc, 0)} m sobre la esfera lunar, azimut ${formatNumber(az, 1)}°.`, `NASA Moon Trek · LRO NAC. A → B: ${formatNumber(arc, 0)} m on the lunar sphere, azimuth ${formatNumber(az, 1)}°.`)}{" "}
            <Link href="/explore/" className="text-accent underline-offset-2 hover:underline">
              {L("Abrir en Explore", "Open in Explore")}
            </Link>
          </figcaption>
        </figure>
        <div className="min-w-0">
          <table className="w-full text-left text-sm" data-testid="pair-terrain-table">
            <caption className="sr-only">{L("Lecturas del DEM en A y B", "DEM readings at A and B")}</caption>
            <thead>
              <tr className="text-xs text-ink-faint">
                <th className="py-1.5 font-medium">{L("Capa PGDA78 en el punto", "PGDA78 layer at the point")}</th>
                <th className="py-1.5 text-right font-medium text-site-a">A</th>
                <th className="py-1.5 text-right font-medium text-site-b">B</th>
                <th className="py-1.5 text-right font-medium">A − B</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = r.id === "lola_count" ? 0 : 3;
                const ok = r.a !== null && r.b !== null && Number.isFinite(r.a) && Number.isFinite(r.b);
                return (
                  <tr key={r.id} className="border-t border-line/60">
                    <th scope="row" className="py-1.5 pr-2 font-normal text-ink-muted">
                      <Link href={evidenceHref(r.entry.registry_id)} className="hover:text-accent hover:underline">
                        {L(registryAsset(r.entry.registry_id)!.title.es, registryAsset(r.entry.registry_id)!.title.en)}
                      </Link>
                    </th>
                    <td className="tabular py-1.5 text-right font-semibold text-ink">{ok ? `${formatNumber(r.a!, d)}${unit(r.entry.units)}` : "…"}</td>
                    <td className="tabular py-1.5 text-right font-semibold text-ink">{ok ? `${formatNumber(r.b!, d)}${unit(r.entry.units)}` : "…"}</td>
                    <td className="tabular py-1.5 text-right text-ink-muted">{ok ? `${signed(r.a! - r.b!, d)}${unit(r.entry.units)}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-ink-faint">
            {L("Propiedades del terreno en el punto (bilineal, como el motor), no métricas de decisión.", "Terrain properties at the point (bilinear, as the engine), not decision metrics.")}
          </p>
        </div>
      </div>
    </Panel>
  );
}

/** Miniatura del DEM real alrededor de un sitio (relieve + ROI), sin depender del Comparador. */
export function SiteTerrainThumb({ site }: { site: Site }) {
  const [elev, setElev] = useState<RasterGrid | null>(null);
  const [rois, setRois] = useState<RoiPolygon[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadTerrainLayer("elevation").then((g) => alive && setElev(g), () => undefined);
    loadRois().then((r) => alive && setRois(r), () => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="w-28 shrink-0">
      {elev ? <SiteCrop site={site} grids={{ elevation: elev }} rois={rois} overlay="none" /> : <span className="block aspect-square w-full animate-pulse rounded-xl bg-surface-3/50" />}
      <span className="mt-1 block text-center text-[10px] leading-tight text-ink-faint">{L("DEM PGDA78 · 800 m", "PGDA78 DEM · 800 m")}</span>
    </div>
  );
}
