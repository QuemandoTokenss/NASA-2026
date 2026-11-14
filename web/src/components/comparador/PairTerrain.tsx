"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Segmented } from "../ui/Controls";
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
function SiteCrop({ site, grids, rois, overlay }: { site: Site; grids: Partial<Record<TerrainLayerId, RasterGrid>>; rois: RoiPolygon[] | null; overlay: Overlay }) {
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
    const base = hillshade(sub);
    if (over) {
      const st = TERRAIN_MANIFEST.layers.find((l) => l.id === overlay)!.stats;
      const col = colorizeRaster(subGrid(over, site.x_m, site.y_m, HALF_M), st.min, st.max, LAYER_STYLE[overlay as TerrainLayerId]);
      for (let i = 0; i < base.length; i += 4) {
        if (!col[i + 3]) continue;
        const k = 0.55;
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
  }, [elev, over, overlay, rois, site, id]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={L(`Recorte del DEM PGDA78 de 800 × 800 m centrado en ${SITE_META[id].label}`, `800 × 800 m PGDA78 DEM crop centred on ${SITE_META[id].label}`)}
      className="aspect-square w-full rounded-xl border border-line-strong bg-[#03060d]"
      data-testid={`site-crop-${id}`}
    />
  );
}

const unit = (u: string) => (u === "deg" ? "°" : u === "count" ? "" : ` ${u}`);
const signed = (v: number, d: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatNumber(Math.abs(v), d)}`;

export function PairTerrain({ sites }: { sites: Site[] }) {
  const { grids, rois, error } = useLayers();
  const [overlay, setOverlay] = useState<Overlay>("slope");
  const A = sites.find((s) => s.id === "A")!;
  const B = sites.find((s) => s.id === "B")!;
  const rows = useMemo(
    () =>
      LAYERS.map((id) => {
        const g = grids[id];
        const entry = TERRAIN_MANIFEST.layers.find((l) => l.id === id)!;
        const a = g ? sampleBilinear(g, A.x_m, A.y_m) : null;
        const b = g ? sampleBilinear(g, B.x_m, B.y_m) : null;
        return { id, entry, a, b };
      }),
    [grids, A, B],
  );
  const arc = arcDistanceM({ x: A.x_m, y: A.y_m }, { x: B.x_m, y: B.y_m });
  const az = azimuthBetween({ x: A.x_m, y: A.y_m }, { x: B.x_m, y: B.y_m });

  return (
    <Panel
      title={L("Terreno real del par A · B", "Real terrain of the A · B pair")}
      icon="map"
      actions={
        <Segmented
          label={L("Capa sobre el relieve", "Layer over the relief")}
          value={overlay}
          onChange={setOverlay}
          options={[
            { value: "slope", label: L("Pendiente", "Slope") },
            { value: "lola_count", label: L("Retornos LOLA", "LOLA returns") },
            { value: "none", label: L("Solo relieve", "Relief only") },
          ]}
        />
      }
      footer={L(
        "Mapa: teselas reales de Moon Trek (LRO NAC) en la proyección polar lunar de Explore. Recortes: muestras exactas del DEM PGDA78 (5 m) con relieve sombreado de luz sintética; misma escala para A y B. Lecturas en el punto de cada sitio (bilineal, como el motor).",
        "Map: real Moon Trek tiles (LRO NAC) in Explore's lunar polar projection. Crops: exact PGDA78 DEM samples (5 m) with synthetic-light shaded relief; same scale for A and B. Readings at each site point (bilinear, as the engine).",
      )}
    >
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-2" data-testid="pair-terrain">
        <div className="flex min-w-0 flex-col gap-2 lg:col-span-2 2xl:col-span-1">
          <GeoMap sites={sites} focusSite="A" compact overlay={{ line: [{ x: A.x_m, y: A.y_m }, { x: B.x_m, y: B.y_m }], label: `${formatNumber(arc, 0)} m` }} />
          <p className="text-[11px] text-ink-faint">
            {L(
              `A → B: ${formatNumber(arc, 0)} m sobre la esfera lunar, azimut ${formatNumber(az, 1)}°.`,
              `A → B: ${formatNumber(arc, 0)} m on the lunar sphere, azimuth ${formatNumber(az, 1)}°.`,
            )}{" "}
            <Link href="/explore/" className="text-accent underline-offset-2 hover:underline">
              {L("Abrir en Explore", "Open in Explore")}
            </Link>
          </p>
        </div>
        {[A, B].map((s) => (
          <div key={s.id} className="flex min-w-0 flex-col gap-2">
            <p className={`text-sm font-semibold ${SITE_META[s.id as SiteId].textClass}`}>
              {SITE_META[s.id as SiteId].label} · ROI {s.roi}
            </p>
            {grids.elevation ? <SiteCrop site={s} grids={grids} rois={rois} overlay={overlay} /> : <span className="aspect-square w-full animate-pulse rounded-xl bg-surface-3/50" />}
          </div>
        ))}
      </div>
      {overlay !== "none" ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
          <span className="h-2.5 w-32 rounded-full" style={{ background: rampCss(LAYER_STYLE[overlay].stops) }} />
          <span>
            {formatNumber(TERRAIN_MANIFEST.layers.find((l) => l.id === overlay)!.stats.min, overlay === "lola_count" ? 0 : 1)} →{" "}
            {formatNumber(TERRAIN_MANIFEST.layers.find((l) => l.id === overlay)!.stats.max, overlay === "lola_count" ? 0 : 1)}
            {unit(TERRAIN_MANIFEST.layers.find((l) => l.id === overlay)!.units)} {L("(mín./máx. de la ventana de 4 × 4 km)", "(min/max of the 4 × 4 km window)")}
          </span>
        </div>
      ) : null}
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <table className="mt-4 w-full text-left text-sm" data-testid="pair-terrain-table">
        <caption className="sr-only">{L("Lecturas del DEM en A y B", "DEM readings at A and B")}</caption>
        <thead>
          <tr className="text-xs text-ink-faint">
            <th className="py-1.5 font-medium">{L("Capa PGDA78", "PGDA78 layer")}</th>
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
        {L(
          "Son propiedades del terreno en el punto, no métricas de decisión: la elección depende del criterio y de la visibilidad calculada por el motor.",
          "These are terrain properties at the point, not decision metrics: the choice depends on the criterion and on the visibility computed by the engine.",
        )}
      </p>
    </Panel>
  );
}
