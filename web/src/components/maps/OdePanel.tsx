"use client";

import { useRef, useState } from "react";
import type { SiteId } from "@/lib/contract/constants";
import type { Site } from "@/lib/contract/schema";
import { formatNumber, formatUtcDate } from "@/lib/format";
import type { XY } from "@/lib/geospatial/lunar";
import { ODE_PRODUCT_TYPES, OdeError, fetchOdeCount, fetchOdePage, footprintContains, nextOffset, type OdeProduct, type OdeProductType } from "@/lib/geospatial/ode";
import { L } from "@/lib/i18n";
import { Badge, Callout } from "../ui/Display";
import { Icon } from "../ui/Icon";

/** Caja lon/lat que contiene los sitios A y B (la misma de las respuestas grabadas para las pruebas). */
export const ODE_SITES_REGION = { westernLon: 222.4, easternLon: 223.1, minLat: -89.48, maxLat: -89.44 };
const PAGE = 5;

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; kind: OdeError["kind"]; message: string }
  | { status: "ready"; total: number; offset: number; products: OdeProduct[] };

/**
 * Navegador de productos del archivo PDS a través de ODE REST: busca en la
 * región de los sitios, pagina y dibuja la huella REAL de cada producto.
 * No carga los productos como capa: los NAC calibrados no están proyectados
 * en mapa. Solo se muestran metadatos, huella y enlaces al original.
 */
export function OdePanel({ sites, selected, onSelect }: { sites: Site[]; selected: string | null; onSelect: (f: { rings: XY[][]; label: string } | null) => void }) {
  const [pt, setPt] = useState<OdeProductType>("CDRNAC4");
  const [state, setState] = useState<State>({ status: "idle" });
  const ctrl = useRef<AbortController | null>(null);
  const type = ODE_PRODUCT_TYPES.find((t) => t.pt === pt)!;

  const load = async (offset: number, knownTotal?: number) => {
    ctrl.current?.abort(); // se cancela la petición anterior
    const c = new AbortController();
    ctrl.current = c;
    setState({ status: "loading" });
    try {
      const total = knownTotal ?? (await fetchOdeCount(type, ODE_SITES_REGION, c.signal));
      const page = total > 0 ? await fetchOdePage(type, ODE_SITES_REGION, offset, PAGE, c.signal) : { products: [] };
      setState({ status: "ready", total, offset, products: page.products });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const err = e instanceof OdeError ? e : new OdeError((e as Error).message, "network");
      setState({ status: "error", kind: err.kind, message: err.message });
    }
  };

  const next = state.status === "ready" ? nextOffset(state.offset, PAGE, state.total) : null;
  return (
    <section aria-label={L("Productos del archivo PDS (ODE)", "PDS archive products (ODE)")} data-testid="ode-panel" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{L("Productos del archivo PDS sobre los sitios", "PDS archive products over the sites")}</h3>
          <p className="text-[11px] text-ink-faint">
            {L("Consulta en vivo a ODE REST (PDS Geosciences Node), acotada a", "Live query to ODE REST (PDS Geosciences Node), bounded to")} {ODE_SITES_REGION.westernLon}–{ODE_SITES_REGION.easternLon}° E, {Math.abs(ODE_SITES_REGION.maxLat)}–{Math.abs(ODE_SITES_REGION.minLat)}° S.
          </p>
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-ink-muted">
          {L("Tipo de producto", "Product type")}
          <select
            value={pt}
            onChange={(e) => {
              setPt(e.target.value as OdeProductType);
              setState({ status: "idle" });
              onSelect(null);
            }}
            className="max-w-64 rounded-lg border border-line-strong bg-surface-2 px-2 py-1.5 text-ink"
          >
            {ODE_PRODUCT_TYPES.map((t) => (
              <option key={t.pt} value={t.pt}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => load(1)} disabled={state.status === "loading"} className="inline-flex items-center gap-2 rounded-xl border border-accent-strong/70 bg-accent-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-3 disabled:opacity-50">
          <Icon name="database" className="size-4" />
          {L("Buscar productos", "Search products")}
        </button>
      </div>

      <div aria-live="polite">
        {state.status === "idle" ? (
          <p className="text-xs text-ink-muted">{L("Aún no se ha consultado el archivo. La búsqueda necesita conexión; el mapa y el DEM funcionan sin ella.", "The archive has not been queried yet. The search needs a connection; the map and DEM work without it.")}</p>
        ) : state.status === "loading" ? (
          <p className="text-xs text-ink-muted">{L("Consultando ODE…", "Querying ODE…")}</p>
        ) : state.status === "error" ? (
          <Callout tone="warn" icon="alert" title={state.kind === "service" ? L("ODE rechazó la consulta", "ODE rejected the query") : state.kind === "format" ? L("Respuesta de ODE no válida", "Invalid ODE response") : L("ODE no disponible", "ODE unavailable")}>
            {state.message}. {L("No se muestra ningún producto de sustitución.", "No substitute product is shown.")}
          </Callout>
        ) : state.total === 0 ? (
          <p className="text-xs text-ink-muted">{L("ODE no devuelve productos de este tipo en la región. Cero resultados no es un error.", "ODE returns no products of this type in the region. Zero results is not an error.")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-ink-muted" data-testid="ode-summary">
              {L(
                `${formatNumber(state.total, 0)} productos cuya caja de coordenadas toca la región; mostrando ${state.offset}–${state.offset + state.products.length - 1}.`,
                `${formatNumber(state.total, 0)} products whose coordinate box touches the region; showing ${state.offset}–${state.offset + state.products.length - 1}.`,
              )}{" "}
              {L("Cerca del polo esa caja es muy amplia: «contiene A/B» se decide con la huella real.", "Near the pole that box is very wide: “contains A/B” is decided with the real footprint.")}
            </p>
            <ul className="flex flex-col gap-1.5">
              {state.products.map((p) => {
                const hits = sites.filter((s) => footprintContains(p.footprint, { x: s.x_m, y: s.y_m })).map((s) => s.id as SiteId);
                const active = selected === p.pdsId;
                return (
                  <li key={p.odeId} className={`rounded-xl border p-2.5 text-xs ${active ? "border-[#f5c518]/70 bg-[#f5c518]/5" : "border-line bg-bg-2/60"}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono font-semibold text-ink">{p.pdsId}</span>
                      {hits.length ? hits.map((h) => <Badge key={h} tone={h === "A" ? "a" : "b"}>{L(`contiene ${h}`, `contains ${h}`)}</Badge>) : <Badge tone="neutral">{L("no contiene A ni B", "contains neither A nor B")}</Badge>}
                      <span className="text-ink-muted">{p.observationTime ? formatUtcDate(p.observationTime) : L("fecha no publicada", "date not published")}</span>
                      {p.mapResolutionM !== null ? <span className="tabular text-ink-muted">{formatNumber(p.mapResolutionM, 2)} m/px</span> : null}
                      {p.incidenceDeg !== null ? (
                        <span className="tabular text-ink-muted">
                          {L("incidencia", "incidence")} {formatNumber(p.incidenceDeg, 1)}° · {L("emisión", "emission")} {formatNumber(p.emissionDeg ?? NaN, 1)}° · {L("fase", "phase")} {formatNumber(p.phaseDeg ?? NaN, 1)}°
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        aria-pressed={active}
                        disabled={!p.footprint.length}
                        onClick={() => onSelect(active ? null : { rings: p.footprint, label: p.pdsId })}
                        className="rounded-lg border border-line-strong bg-surface-2 px-2 py-1 font-medium text-ink hover:bg-surface-3 disabled:opacity-40"
                      >
                        {active ? L("Quitar huella", "Remove footprint") : L("Ver huella en el mapa", "Show footprint on the map")}
                      </button>
                      {p.labelUrl ? <a href={p.labelUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{L("Etiqueta PDS", "PDS label")}</a> : null}
                      {p.productUrl ? <a href={p.productUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{L("Ficha en ODE", "ODE page")}</a> : null}
                      {p.externalUrl ? <a href={p.externalUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{L("Original en LROC", "Original at LROC")}</a> : null}
                      <span className="text-ink-faint">{p.dataSetId}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-2">
              <button type="button" disabled={state.offset <= 1} onClick={() => load(Math.max(1, state.offset - PAGE), state.total)} className="rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-3 disabled:opacity-40">
                {L("Anteriores", "Previous")}
              </button>
              <button type="button" disabled={next === null} onClick={() => next !== null && load(next, state.total)} className="rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-3 disabled:opacity-40">
                {L("Siguientes", "Next")}
              </button>
              <span className="text-[11px] text-ink-faint">
                {type.mapProjected
                  ? L("Producto proyectado en mapa; aún no se carga como capa (formato sin integrar).", "Map-projected product; not yet loaded as a layer (format not integrated).")
                  : L("Imágenes calibradas sin proyectar: se muestra su huella, no se estiran sobre el mapa.", "Calibrated, unprojected images: their footprint is shown; they are not stretched over the map.")}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
