"use client";

import { formatBytes, formatNumber } from "@/lib/format";
import coregistration from "../../../data/derived/coregistration.json";
import { GEO_REGISTRY, TERRAIN_MANIFEST, registryAsset, terrainUrl, type RegistryAsset } from "@/lib/geospatial/terrain";
import { L } from "@/lib/i18n";
import { Badge, Callout } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { Panel } from "../ui/Panel";

const CLASS_LABEL = (): Record<RegistryAsset["class"], string> => ({
  instrument_observation: L("Observación instrumental publicada", "Published instrument observation"),
  published_science_product: L("Producto científico publicado", "Published science product"),
  site_regret_derived: L("Derivado calculado por SITE REGRET", "Derived by SITE REGRET"),
  hypothetical_scenario: L("Escenario hipotético", "Hypothetical scenario"),
  illustration: L("Ilustración no científica", "Non-scientific illustration"),
  unknown_origin: L("Origen desconocido", "Unknown origin"),
});

const anchor = (id: string) => `geo-${id.replaceAll(".", "-")}`;

function Row({ k, v, mono = false }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-3 border-b border-line/50 py-1.5 text-xs last:border-b-0">
      <dt className="text-ink-faint">{k}</dt>
      <dd className={`min-w-0 break-words text-ink-muted ${mono ? "font-mono text-[11px]" : ""}`}>{v}</dd>
    </div>
  );
}

function AssetCard({ a }: { a: RegistryAsset }) {
  const derived = TERRAIN_MANIFEST.layers.find((l) => l.registry_id === a.id);
  const rois = TERRAIN_MANIFEST.rois.registry_id === a.id ? TERRAIN_MANIFEST.rois : null;
  const none = L("no publicado por el proveedor", "not published by the provider");
  return (
    <li id={anchor(a.id)} className="scroll-mt-24 rounded-xl border border-line bg-bg-2/60 p-4 target:border-accent target:shadow-[0_0_0_1px_var(--color-accent)]">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">{L(a.title.es, a.title.en)}</h3>
        <Badge tone="neutral">{CLASS_LABEL()[a.class]}</Badge>
        {a.verification.status === "full_file_sha256_verified" ? (
          <Badge tone="ok" icon="check">{L("Archivo completo verificado", "Whole file verified")}</Badge>
        ) : (
          <Badge tone="ok" icon="check">{L(`Servicio probado en vivo · ${a.verification.checked_utc}`, `Service checked live · ${a.verification.checked_utc}`)}</Badge>
        )}
      </div>
      <dl className="mt-2">
        <Row k={L("Proveedor", "Provider")} v={a.provider} />
        <Row k={L("Misión · instrumento", "Mission · instrument")} v={`${a.mission} · ${a.instrument}`} />
        <Row k={L("Producto", "Product")} v={a.product} />
        <Row k={L("Identificador original", "Original identifier")} v={a.original_id} mono />
        <Row
          k={L("Ficha y origen", "Page and source")}
          v={
            <span className="flex flex-col gap-0.5">
              <a href={a.product_page} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {a.product_page}
              </a>
              <a href={a.url ?? a.capabilities_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {a.url ?? a.capabilities_url}
              </a>
            </span>
          }
        />
        <Row k={L("Sistema de coordenadas", "Coordinate system")} v={<span lang="en">{a.crs}</span>} />
        {a.vertical_reference ? <Row k={L("Referencia vertical", "Vertical reference")} v={<span lang="en">{a.vertical_reference}</span>} /> : null}
        <Row k={L("Unidades · nodata", "Units · nodata")} v={`${a.units} · ${a.nodata ?? "—"}`} />
        {a.finest_tile_resolution_m ? <Row k={L("Resolución servida", "Served resolution")} v={`${formatNumber(a.finest_tile_resolution_m, 2)} m/${L("píxel", "pixel")} (zoom ${a.max_zoom})`} /> : null}
        {a.resolution_note ? <Row k={L("Resolución", "Resolution")} v={L(a.resolution_note.es, a.resolution_note.en)} /> : null}
        <Row k={L("Fecha de adquisición", "Acquisition date")} v={`${a.dates.acquisition ?? none}. ${L(a.dates.acquisition_note.es, a.dates.acquisition_note.en)}`} />
        {a.dates.server_last_modified ? <Row k={L("Última modificación (servidor)", "Last modified (server)")} v={a.dates.server_last_modified} /> : null}
        {a.sha256 ? <Row k="SHA-256" v={`${a.sha256} · ${formatBytes(a.bytes ?? 0)}`} mono /> : null}
        <Row k={L("Comprobación", "Check")} v={a.verification.method} />
        <Row k={L("Crédito y condiciones", "Credit and terms")} v={`${a.credit}. ${L(a.terms.es, a.terms.en)}`} />
        {a.note ? <Row k={L("Advertencia", "Caveat")} v={L(a.note.es, a.note.en)} /> : null}
        {derived ? (
          <Row
            k={L("Derivado en la web", "Derived file in the app")}
            v={
              <span className="flex flex-col gap-0.5">
                <a href={terrainUrl(derived.file)} download className="text-accent hover:underline">
                  {derived.file}
                </a>
                <span className="font-mono text-[11px]">{derived.sha256}</span>
                <span>
                  {derived.processing} {L(`Ventana de ${TERRAIN_MANIFEST.georeferencing.width} × ${TERRAIN_MANIFEST.georeferencing.height} píxeles de ${TERRAIN_MANIFEST.georeferencing.pixel_size_m} m; valores ${formatNumber(derived.stats.min, 3)} … ${formatNumber(derived.stats.max, 3)}; ${derived.stats.nodata_count} sin dato.`, `Window of ${TERRAIN_MANIFEST.georeferencing.width} × ${TERRAIN_MANIFEST.georeferencing.height} pixels of ${TERRAIN_MANIFEST.georeferencing.pixel_size_m} m; values ${formatNumber(derived.stats.min, 3)} … ${formatNumber(derived.stats.max, 3)}; ${derived.stats.nodata_count} without data.`)}
                </span>
              </span>
            }
          />
        ) : null}
        {rois ? (
          <Row
            k={L("Derivado en la web", "Derived file in the app")}
            v={
              <span className="flex flex-col gap-0.5">
                <a href={terrainUrl(rois.file)} download className="text-accent hover:underline">
                  {rois.file}
                </a>
                <span className="font-mono text-[11px]">{rois.sha256}</span>
                <span>{rois.processing}</span>
              </span>
            }
          />
        ) : null}
      </dl>
    </li>
  );
}

/** Procedencia de cada capa cartográfica y de terreno usada en Explore y Engineer. */
export function GeoEvidence() {
  const g = TERRAIN_MANIFEST.georeferencing;
  return (
    <Panel
      id="geo"
      title={L("Cartografía y terreno: procedencia por capa", "Mapping and terrain: provenance per layer")}
      icon="map"
      actions={<Badge tone="neutral">{GEO_REGISTRY.assets.length} {L("activos", "assets")}</Badge>}
      footer={L(
        `Registro: data/geospatial/registry.json (${GEO_REGISTRY.updated_utc}). Derivados: ${TERRAIN_MANIFEST.generator}, versión ${TERRAIN_MANIFEST.generator_version}. Las imágenes y el DEM son de sus proveedores; el mapa, los perfiles, la malla 3D y el obstáculo son derivaciones de SITE REGRET, no productos NASA.`,
        `Registry: data/geospatial/registry.json (${GEO_REGISTRY.updated_utc}). Derived files: ${TERRAIN_MANIFEST.generator}, version ${TERRAIN_MANIFEST.generator_version}. Images and DEM belong to their providers; the map, profiles, 3D mesh and obstacle are SITE REGRET derivations, not NASA products.`,
      )}
    >
      <div className="flex flex-col gap-4">
        <Callout tone="neutral" icon="info" title={L("Qué es cada cosa", "What each thing is")}>
          {L(
            "Las teselas de Moon Trek son mosaicos publicados de imágenes orbitales reales (no elevación). El DEM, la pendiente y sus incertidumbres son productos científicos publicados con valores numéricos. El relieve sombreado, los perfiles, la malla 3D y el punto «obstáculo» los calcula SITE REGRET a partir de ellos. Los mástiles de 2 y 10 m son hipótesis. Ninguna textura, cráter o relieve está generado.",
            "Moon Trek tiles are published mosaics of real orbital images (not elevation). The DEM, slope and their uncertainties are published science products with numeric values. The shaded relief, profiles, 3D mesh and “obstacle” point are computed by SITE REGRET from them. The 2 and 10 m masts are hypotheses. No texture, crater or relief is generated.",
          )}
        </Callout>
        <dl className="rounded-xl border border-line bg-bg-2/60 px-4 py-2">
          <Row k={L("Ventana numérica", "Numeric window")} v={`X ${g.window_bounds_xy_m[0]} … ${g.window_bounds_xy_m[2]} m · Y ${g.window_bounds_xy_m[1]} … ${g.window_bounds_xy_m[3]} m · ${g.width} × ${g.height} px · ${g.pixel_size_m} m`} />
          <Row k={L("Proyección y marco", "Projection and frame")} v={`${g.crs} · ${g.frame}`} />
          <Row k={L("Modelo de píxel", "Pixel model")} v={g.pixel_model} />
          <Row k={L("Límites", "Limits")} v={<ul className="list-disc pl-4">{TERRAIN_MANIFEST.limits.map((l) => <li key={l}>{l}</li>)}</ul>} />
        </dl>
        <div id="geo-corregistro" className="scroll-mt-24 rounded-xl border border-line bg-bg-2/60 p-4" data-testid="coregistration">
          <h3 className="text-sm font-semibold text-ink">{L("Corregistro medido entre teselas y DEM", "Measured co-registration between tiles and DEM")}</h3>
          <p className="mt-1 text-xs text-ink-faint">
            {L(
              "Correlación normalizada entre teselas reales de Moon Trek y el relieve sombreado calculado con el DEM, buscando el desplazamiento (±80 m) que la maximiza, en la ventana completa y por cuadrantes. Regla de concluyente: máximo > 0,3, al menos 0,2 sobre el fondo y fuera del borde de búsqueda.",
              "Normalised correlation between real Moon Trek tiles and shaded relief computed from the DEM, searching the shift (±80 m) that maximises it, over the whole window and by quadrant. Conclusive rule: peak > 0.3, at least 0.2 above background and not on the search edge.",
            )}
          </p>
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {coregistration.checks.map((c) => {
              const q = Object.values(c.quadrants);
              return (
                <li key={c.image.layer} className="rounded-lg border border-line/70 p-3 text-xs">
                  <p className="flex flex-wrap items-center gap-2 font-mono text-ink">
                    {c.image.layer}
                    {c.conclusive ? <Badge tone="ok" icon="check">{L("Concluyente", "Conclusive")}</Badge> : <Badge tone="warn" icon="alert">{L("No concluyente", "Inconclusive")}</Badge>}
                  </p>
                  <dl className="mt-1">
                    <Row k={L("Qué comprueba", "What it checks")} v={c.role === "tile_grid_georeferencing" ? L("Georreferenciación de la rejilla de teselas (sombreado del mismo producto PGDA78 servido por Moon Trek)", "Georeferencing of the tile grid (shaded relief of the same PGDA78 product served by Moon Trek)") : L("Registro del mosaico fotográfico frente al DEM", "Registration of the photographic mosaic against the DEM")} />
                    <Row k={L("Correlación máxima · fondo", "Peak correlation · background")} v={`${formatNumber(c.whole_window.peak_ncc, 2)} · ${formatNumber(c.whole_window.background_ncc_at_search_edge, 2)}`} />
                    {c.conclusive ? (
                      <>
                        <Row k={L("Desfase estimado", "Estimated offset")} v={`X ${formatNumber(c.whole_window.offset_x_m, 1)} m · Y ${formatNumber(c.whole_window.offset_y_m, 1)} m (${formatNumber(c.whole_window.offset_m, 1)} m; ${L("tesela", "tile")} ${formatNumber(c.image.tile_resolution_m, 2)} m/px, ${L("celda", "cell")} ${c.analysis.cell_m} m)`} />
                        <Row k={L("Por cuadrantes", "By quadrant")} v={q.map((x) => `${formatNumber(x.offset_x_m, 1)} / ${formatNumber(x.offset_y_m, 1)} m`).join(" · ")} />
                      </>
                    ) : (
                      <Row k={L("Lectura", "Reading")} v={L(`Sin máximo fiable: el mosaico es multitemporal, con luz rasante y un ${formatNumber((1 - c.analysis.valid_image_fraction) * 100, 0)} % de la ventana en sombra. No se da ningún desfase.`, `No reliable peak: the mosaic is multi-temporal, with grazing light and ${formatNumber((1 - c.analysis.valid_image_fraction) * 100, 0)} % of the window in shadow. No offset is given.`)} />
                    )}
                    <Row k={L("Teselas", "Tiles")} v={`${c.image.tiles} · zoom ${c.image.zoom} · ${c.image.fetched_utc_date}`} />
                  </dl>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-ink-faint">
            {L(
              "El desfase de la rejilla equivale a aproximadamente un píxel de tesela y es igual en los cuatro cuadrantes; su origen no está determinado. La alineación del mosaico fotográfico con el DEM NO queda demostrada numéricamente: comparte rejilla y proyección con la capa verificada, pero su propio registro depende del productor. No es una certificación geodésica.",
              "The grid offset is about one tile pixel and equal in all four quadrants; its origin is undetermined. The alignment of the photographic mosaic with the DEM is NOT demonstrated numerically: it shares grid and projection with the verified layer, but its own registration depends on the producer. Not a geodetic certification.",
            )}
          </p>
        </div>
        <ul className="grid gap-3 xl:grid-cols-2">
          {GEO_REGISTRY.assets.map((a) => (
            <AssetCard key={a.id} a={registryAsset(a.id)!} />
          ))}
        </ul>
        <p className="flex items-start gap-2 text-xs text-ink-faint">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-warn" />
          {L(
            "Pendiente: no se ha identificado y comprobado una ortoimagen NAC individual de Connecting Ridge, ni se han consultado todavía huellas de productos en PDS/ODE; la nomenclatura IAU/USGS no está cargada. No se muestra nada de ello como si existiera.",
            "Pending: no single NAC orthoimage of Connecting Ridge has been identified and checked, product footprints from PDS/ODE have not been queried yet, and IAU/USGS nomenclature is not loaded. None of it is shown as if it existed.",
          )}
        </p>
      </div>
    </Panel>
  );
}
