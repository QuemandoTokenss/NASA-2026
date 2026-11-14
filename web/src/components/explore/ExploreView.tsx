"use client";

import { SITE_IDS, variantFamily, type SiteId } from "@/lib/contract/constants";
import type { Site } from "@/lib/contract/schema";
import { useChunk } from "@/lib/data/DataProvider";
import { loadHorizonChunk } from "@/lib/data/loader";
import { getSite } from "@/lib/data/selectors";
import { CONTEXT_LEGEND } from "@/lib/figure";
import { formatDeg, formatLatitude, formatLongitudeEast, formatNumber } from "@/lib/format";
import { FAMILY_META, SITE_META, SITE_VALUE_META, VARIANT_LABEL } from "@/lib/labels";
import { useSelection } from "@/lib/state/SelectionProvider";
import { HorizonChart } from "../charts/HorizonChart";
import { ChunkGate, DataGate } from "../data/DataGate";
import { FocusSiteControl, HeightControl, VariantControl } from "../data/SelectionControls";
import { Badge, Callout, KeyValueList, Legend, MetricRow, NatureBadge, SiteTag, type LegendItem } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { InfoTip, LinkButton } from "../ui/Interactive";
import { PageHeader, Panel, PanelSection } from "../ui/Panel";
import dynamic from "next/dynamic";
import { ContextMap } from "./ContextMap";
import { L } from "@/lib/i18n";

const GeoMap = dynamic(() => import("../maps/GeoMap").then((m) => m.GeoMap), {
  ssr: false,
  loading: () => <div className="h-[560px] animate-pulse rounded-xl border border-line bg-bg-2" aria-busy="true" />,
});

const UNAVAILABLE_LAYERS = () => [
  { label: L("Iluminación media", "Mean illumination"), reason: L("No incluida en el paquete", "Not included in the package") },
  { label: L("Temperatura", "Temperature"), reason: L("Fuera del modelo científico", "Outside the scientific model") },
  { label: L("Zonas de riesgo", "Hazard zones"), reason: L("El modelo no evalúa seguridad", "The model does not assess safety") },
  { label: L("Ortoimagen NAC individual", "Single NAC orthoimage"), reason: L("Sin producto identificado y comprobado", "No product identified and checked") },
];

function SiteSheet({ site, query }: { site: Site; query: string }) {
  const id = site.id as SiteId;
  const v = site.values;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className={`mt-1 grid size-10 shrink-0 place-items-center rounded-full border-2 ${SITE_META[id].borderClass} ${SITE_META[id].textClass} shadow-[0_0_18px_-4px_currentColor]`}>
          <Icon name="pin" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className={`text-xl font-bold ${SITE_META[id].textClass}`}>{SITE_META[id].label}</p>
          <p className="text-sm text-ink">{site.name}</p>
          <p className="tabular text-sm text-ink-muted">
            {formatLatitude(site.latitude_deg)}, {formatLongitudeEast(site.longitude_east_deg)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <LinkButton href={`/comparador/?${query}`} size="sm" variant="primary" icon="compare">
          {L("Comparar A vs B", "Compare A vs B")}
        </LinkButton>
        <LinkButton href={`/timeline/?${query}`} size="sm" icon="timeline">
          {L("Timeline de", "Timeline of")} {id}
        </LinkButton>
      </div>

      <PanelSection title={L("Terreno en el punto", "Terrain at the point")}>
        <MetricRow
          icon="mountain"
          label={L("Altura del suelo", "Ground height")}
          hint={L(`Sobre la esfera de ${formatNumber(1737400, 0)} m (no es la altura del mástil)`, `Above the ${formatNumber(1737400, 0)} m sphere (not the mast height)`)}
          value={`${formatNumber(site.nominal_height_m, 2)} m`}
        />
        {(Object.keys(SITE_VALUE_META) as Array<keyof typeof SITE_VALUE_META>).map((k) => (
          <MetricRow key={k} label={SITE_VALUE_META[k].label} hint={`${L("Capa", "Layer")} ${k} · PGDA78`} value={`${formatNumber(v[k], SITE_VALUE_META[k].digits)}${SITE_VALUE_META[k].unit}`} />
        ))}
      </PanelSection>

      {v.ldec === 0 ? (
        <Callout tone="neutral" icon="info">
          {L("LDEC = 0: el píxel de 5 m de este punto no contiene retornos LOLA; su altura procede de la interpolación del DEM publicado.", "LDEC = 0: the 5 m pixel at this point has no LOLA returns; its height comes from the interpolation of the published DEM.")}
        </Callout>
      ) : null}

      <PanelSection title={L("Posición", "Position")}>
        <KeyValueList
          items={[
            { k: "ROI (Barker et al. 2021)", v: site.roi },
            { k: L("Latitud", "Latitude"), v: `${formatNumber(site.latitude_deg, 6)}°` },
            { k: L("Longitud este", "East longitude"), v: `${formatNumber(site.longitude_east_deg, 6)}°` },
            { k: L("X / Y estereográficos", "Stereographic X / Y"), v: `${formatNumber(site.x_m, 1)} / ${formatNumber(site.y_m, 1)} m` },
            { k: L("Dentro del ROI", "Inside the ROI"), v: site.point_in_roi ? L("Sí (verificado)", "Yes (verified)") : "No" },
            { k: "Marco", v: site.reference_frame, mono: true },
          ]}
        />
      </PanelSection>
      <p className="text-[11px] text-ink-faint">{L("Fuente de la coordenada:", "Coordinate source:")} {site.coordinate_source}</p>
    </div>
  );
}

function HorizonSummary() {
  const { selection, restored } = useSelection();
  const { variant, focusSite } = selection;
  const h0 = useChunk(restored ? () => loadHorizonChunk(focusSite, 0) : null, [focusSite, 0]);
  const h2 = useChunk(restored ? () => loadHorizonChunk(focusSite, 2) : null, [focusSite, 2]);
  const h10 = useChunk(restored ? () => loadHorizonChunk(focusSite, 10) : null, [focusSite, 10]);
  const rows = ([0, 2, 10] as const).map((h, k) => {
    const st = [h0, h2, h10][k];
    if (st.status !== "ready") return { h, ready: false, lo: 0, hi: 0, mean: 0 };
    const p = st.data.value.variants[variant];
    let lo = Infinity;
    let hi = -Infinity;
    let sum = 0;
    let n = 0;
    p.elevation_deg.forEach((e, i) => {
      if (p.unknown[i]) return;
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
      sum += e;
      n++;
    });
    return { h, ready: true, lo, hi, mean: sum / n };
  });
  return (
    <Panel title={`${L("Horizonte por altura", "Horizon by height")} · ${SITE_META[focusSite].label}`} icon="height" actions={<InfoTip>{L("Resumen descriptivo de los 1440 azimuts del perfil (mínimo, media y máximo de elevación) para la superficie seleccionada. No es un resultado del motor sino una lectura de sus perfiles.", "Descriptive summary of the 1440 profile azimuths (minimum, mean and maximum elevation) for the selected surface. Not an engine result but a reading of its profiles.")}</InfoTip>}>
      <table className="w-full text-sm">
        <caption className="sr-only">{L("Elevación del horizonte por altura del observador", "Horizon elevation by observer height")}</caption>
        <thead>
          <tr className="text-xs text-ink-faint">
            <th scope="col" className="pb-2 text-left font-medium">{L("Altura", "Height")}</th>
            <th scope="col" className="pb-2 text-right font-medium">{L("Mín.", "Min.")}</th>
            <th scope="col" className="pb-2 text-right font-medium">{L("Media", "Mean")}</th>
            <th scope="col" className="pb-2 text-right font-medium">{L("Máx.", "Max.")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.h} className={`border-t border-line/60 ${r.h === selection.heightM ? "text-ink" : "text-ink-muted"}`}>
              <th scope="row" className="py-2 text-left font-medium">
                {r.h} m {r.h === selection.heightM ? <Badge tone="accent">{L("actual", "current")}</Badge> : null}
              </th>
              <td className="tabular py-2 text-right">{r.ready ? formatDeg(r.lo) : "…"}</td>
              <td className="tabular py-2 text-right">{r.ready ? formatDeg(r.mean) : "…"}</td>
              <td className="tabular py-2 text-right">{r.ready ? formatDeg(r.hi) : "…"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-ink-faint">{L("Elevar el observador baja el horizonte aparente; el efecto sobre Sol y Tierra se estudia en Engineer.", "Raising the observer lowers the apparent horizon; the effect on Sun and Earth is studied in Engineer.")}</p>
    </Panel>
  );
}

export function ExploreView() {
  const { selection, dispatch, query, restored } = useSelection();
  const { heightM, variant, focusSite } = selection;

  const horizonA = useChunk(restored ? () => loadHorizonChunk("A", heightM) : null, [heightM]);
  const horizonB = useChunk(restored ? () => loadHorizonChunk("B", heightM) : null, [heightM]);
  const family = variantFamily(variant);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="Explore" title={L("Selector de sitios lunares", "Lunar site selector")} subtitle={L("Los dos emplazamientos calculados en Connecting Ridge, polo sur lunar", "The two computed sites on Connecting Ridge, lunar south pole")} />

      <DataGate>
        {({ core }) => {
          const focused = getSite(core, focusSite);
          return (
            <>
              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_400px]">
                <Panel
                  title={L("Connecting Ridge · mapa georreferenciado", "Connecting Ridge · georeferenced map")}
                  icon="map"
                  actions={
                    <>
                      <NatureBadge nature="OBSERVED" />
                      <Badge tone="neutral">{L("Imágenes orbitales + DEM numérico", "Orbital images + numeric DEM")}</Badge>
                    </>
                  }
                >
                  <GeoMap sites={core.sites} focusSite={focusSite} onSelectSite={(s) => dispatch({ type: "setFocusSite", value: s })} />
                </Panel>

                <Panel title={L("Ficha del sitio", "Site sheet")} icon="pin" actions={<NatureBadge nature="DERIVED" />}>
                  <div className="flex flex-col gap-5">
                    <FocusSiteControl />
                    {focused ? <SiteSheet site={focused} query={query} /> : <Callout tone="danger">{L("Sitio no encontrado en el paquete.", "Site not found in the package.")}</Callout>}
                  </div>
                </Panel>
              </div>

              <details className="group rounded-2xl border border-line bg-surface/85">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 text-sm font-semibold text-ink">
                  <Icon name="layers" className="size-5 text-ink-muted" />
                  {L("Figura original del motor (referencia)", "Original engine figure (reference)")}
                  <Badge tone="neutral">{L("Derivado del DEM · solo visual", "Derived from the DEM · visual only")}</Badge>
                  <Icon name="chevronDown" className="ml-auto size-4 text-ink-muted transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid gap-5 border-t border-line p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <ContextMap sites={core.sites} focusSite={focusSite} showMarkers showCoords onSelectSite={(s) => dispatch({ type: "setFocusSite", value: s })} />
                  <div className="flex flex-col gap-4">
                    <PanelSection title={L("Leyenda (elevación)", "Legend (elevation)")}>
                      <div className="h-3 rounded-full" style={{ background: `linear-gradient(90deg, ${CONTEXT_LEGEND.stops.join(", ")})` }} />
                      <div className="mt-1.5 flex justify-between text-xs text-ink-muted tabular">
                        <span>{formatNumber(CONTEXT_LEGEND.darkM, 0)} m</span>
                        <span>{formatNumber(CONTEXT_LEGEND.lightM, 0)} m</span>
                      </div>
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {L(
                          "Figura SVG generada por el motor a partir del DEM PGDA78 promediado a 40 m/píxel. No es una fotografía orbital ni una imagen generada: es una representación calculada del DEM, y no es la entrada del cálculo de horizontes.",
                          "SVG figure produced by the engine from the PGDA78 DEM averaged to 40 m/pixel. It is neither an orbital photograph nor a generated image: it is a computed rendering of the DEM, and it is not the input of the horizon computation.",
                        )}
                      </p>
                    </PanelSection>
                    <PanelSection title={L("Aún no disponibles", "Not available yet")}>
                      <ul className="flex flex-col gap-1.5 text-sm">
                        {UNAVAILABLE_LAYERS().map((l) => (
                          <li key={l.label} className="flex items-baseline justify-between gap-3 text-ink-faint">
                            <span className="line-through decoration-ink-faint/50">{l.label}</span>
                            <span className="text-right text-[11px]">{l.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </PanelSection>
                  </div>
                </div>
              </details>

              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_400px]">
                <Panel
                  title={`${L("Perfil del horizonte", "Horizon profile")} · ${heightM} m · ${VARIANT_LABEL[variant]}`}
                  icon="mountain"
                  actions={
                    <div className="flex flex-wrap items-end gap-4">
                      <HeightControl />
                      <VariantControl />
                    </div>
                  }
                  footer={
                    <>
                      {L(
                        "Elevación del horizonte sobre el plano horizontal local, 1440 azimuts cada 0,25° (horizons[S].variants[V][H].elevation_deg). Superficie:",
                        "Horizon elevation above the local horizontal plane, 1440 azimuths every 0.25° (horizons[S].variants[V][H].elevation_deg). Surface:",
                      )}{" "}
                      {FAMILY_META[family].label} — {FAMILY_META[family].description}
                    </>
                  }
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Legend
                        items={[
                          ...SITE_IDS.map(
                            (s): LegendItem => ({ label: `${SITE_META[s].label}${s === focusSite ? L(" (seleccionado)", " (selected)") : ""}`, color: SITE_META[s].colorVar, shape: "line" }),
                          ),
                          { label: L("Horizonte matemático 0°", "Mathematical horizon 0°"), color: "var(--color-ink-faint)", shape: "dash" },
                        ]}
                      />
                      <span className="ml-auto flex gap-1.5">
                        <NatureBadge nature={family === "nominal" ? "DERIVED" : "MODELED"} />
                        {heightM > 0 ? <NatureBadge nature="SIMULATED" /> : null}
                      </span>
                    </div>
                    <ChunkGate state={horizonA} label={L("horizonte de A", "horizon of A")}>
                      {(a) => (
                        <ChunkGate state={horizonB} label={L("horizonte de B", "horizon of B")}>
                          {(b) => (
                            <HorizonChart
                              title={L(`Perfil del horizonte de A y B a ${heightM} m, superficie ${VARIANT_LABEL[variant]}`, `Horizon profile of A and B at ${heightM} m, surface ${VARIANT_LABEL[variant]}`)}
                              series={[a, b]
                                .map((chunk) => {
                                  const id = chunk.site_id as SiteId;
                                  const p = chunk.variants[variant];
                                  return { key: id, label: SITE_META[id].label, color: SITE_META[id].colorVar, azimuthDeg: chunk.azimuth_deg, elevationDeg: p.elevation_deg, unknown: p.unknown, emphasis: id === focusSite };
                                })
                                // El sitio seleccionado se dibuja encima.
                                .sort((p, q) => Number(p.emphasis) - Number(q.emphasis))}
                            />
                          )}
                        </ChunkGate>
                      )}
                    </ChunkGate>
                  </div>
                </Panel>

                <div className="flex flex-col gap-5">
                  <HorizonSummary />
                  <Panel title={L("Propiedades del punto (A y B)", "Point properties (A and B)")} icon="compare" actions={<Badge tone="neutral">{L("Sin clasificación", "No ranking")}</Badge>}>
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-end text-xs font-semibold">
                        <span className="w-24 text-right">
                          <SiteTag site="A">A</SiteTag>
                        </span>
                        <span className="w-24 text-right">
                          <SiteTag site="B">B</SiteTag>
                        </span>
                      </div>
                      {(() => {
                        const a = getSite(core, "A");
                        const b = getSite(core, "B");
                        if (!a || !b) return <Callout tone="danger">{L("Faltan sitios en el paquete.", "Sites missing from the package.")}</Callout>;
                        return (
                          <div>
                            <MetricRow icon="mountain" label={L("Altura del suelo", "Ground height")} hint={L("m sobre esfera", "m above sphere")} a={formatNumber(a.nominal_height_m, 2)} b={formatNumber(b.nominal_height_m, 2)} />
                            <MetricRow label={L("Pendiente", "Slope")} hint={L("grados", "degrees")} a={formatNumber(a.values.slp, 2)} b={formatNumber(b.values.slp, 2)} />
                            <MetricRow label={L("RMS pendiente", "Slope RMS")} hint={L("grados", "degrees")} a={formatNumber(a.values.slperr, 2)} b={formatNumber(b.values.slperr, 2)} />
                            <MetricRow label={L("RMS vertical", "Vertical RMS")} hint="m" a={formatNumber(a.values.toterr, 2)} b={formatNumber(b.values.toterr, 2)} />
                          </div>
                        );
                      })()}
                      <p className="text-xs text-ink-faint">{L("Propiedades publicadas del terreno en cada punto. El ganador depende de la ventana, la altura y el criterio: ver Comparador.", "Published terrain properties at each point. The winner depends on window, height and criterion: see Compare.")}</p>
                    </div>
                  </Panel>
                </div>
              </div>
            </>
          );
        }}
      </DataGate>
    </div>
  );
}
