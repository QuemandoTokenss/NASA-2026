"use client";

import { useState } from "react";
import { SITE_IDS, variantFamily, type SiteId } from "@/lib/contract/constants";
import type { Site } from "@/lib/contract/schema";
import { useChunk } from "@/lib/data/DataProvider";
import { loadHorizonChunk } from "@/lib/data/loader";
import { getSite } from "@/lib/data/selectors";
import { formatLatitude, formatLongitudeEast, formatNumber } from "@/lib/format";
import { FAMILY_META, SITE_META, SITE_VALUE_META, VARIANT_LABEL } from "@/lib/labels";
import { useSelection } from "@/lib/state/SelectionProvider";
import { HorizonChart } from "../charts/HorizonChart";
import { ChunkGate, DataGate } from "../data/DataGate";
import { FocusSiteControl, HeightControl, VariantControl } from "../data/SelectionControls";
import { Toggle } from "../ui/Controls";
import { Badge, Callout, KeyValueList, Legend, MetricRow, NatureBadge, SiteTag, type LegendItem } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { PageHeader, Panel, PanelSection } from "../ui/Panel";
import { ContextMap } from "./ContextMap";

const UNAVAILABLE_LAYERS = [
  { label: "Iluminación media", reason: "No incluida en el paquete" },
  { label: "Temperatura", reason: "Fuera del modelo científico" },
  { label: "Pendiente (ráster)", reason: "Solo el valor en cada punto" },
  { label: "Zonas de riesgo de alunizaje", reason: "El modelo no evalúa seguridad" },
  { label: "Vista 3D", reason: "Prioridad P2" },
];

function SiteSheet({ site }: { site: Site }) {
  const id = site.id as SiteId;
  const v = site.values;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className={`mt-1 grid size-9 shrink-0 place-items-center rounded-full border ${SITE_META[id].borderClass} ${SITE_META[id].textClass}`}>
          <Icon name="pin" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className={`text-lg font-bold ${SITE_META[id].textClass}`}>{SITE_META[id].label}</p>
          <p className="text-sm text-ink">{site.name}</p>
          <p className="tabular text-sm text-ink-muted">
            {formatLatitude(site.latitude_deg)}, {formatLongitudeEast(site.longitude_east_deg)}
          </p>
        </div>
      </div>

      <PanelSection title="Posición">
        <KeyValueList
          items={[
            { k: "ROI (Barker 2021)", v: site.roi },
            { k: "Latitud", v: `${formatNumber(site.latitude_deg, 6)}°` },
            { k: "Longitud este", v: `${formatNumber(site.longitude_east_deg, 6)}°` },
            { k: "X / Y estereográficos", v: `${formatNumber(site.x_m, 1)} / ${formatNumber(site.y_m, 1)} m` },
            { k: "Dentro del ROI", v: site.point_in_roi ? "Sí (verificado)" : "No" },
            { k: "Marco", v: site.reference_frame, mono: true },
          ]}
        />
      </PanelSection>

      <PanelSection title="Terreno en el punto">
        <MetricRow
          icon="mountain"
          label="Altura del suelo"
          hint={`Sobre la esfera de ${formatNumber(1737400, 0)} m (no es la altura del mástil)`}
          value={`${formatNumber(site.nominal_height_m, 2)} m`}
        />
        {(Object.keys(SITE_VALUE_META) as Array<keyof typeof SITE_VALUE_META>).map((k) => (
          <MetricRow
            key={k}
            label={SITE_VALUE_META[k].label}
            hint={`Capa ${k} · PGDA78`}
            value={`${formatNumber(v[k], SITE_VALUE_META[k].digits)}${SITE_VALUE_META[k].unit}`}
          />
        ))}
      </PanelSection>

      {v.ldec === 0 ? (
        <Callout tone="neutral" icon="info">
          LDEC = 0: el píxel de 5 m de este punto no contiene retornos LOLA, así que su altura procede de la interpolación del DEM publicado.
        </Callout>
      ) : null}
      <p className="text-xs text-ink-faint">Fuente de la coordenada: {site.coordinate_source}</p>
    </div>
  );
}

export function ExploreView() {
  const { selection, dispatch, restored } = useSelection();
  const [showMarkers, setShowMarkers] = useState(true);
  const { heightM, variant, focusSite } = selection;

  // Esperar a la selección de la URL para no descargar trozos de la selección por defecto.
  const horizonA = useChunk(restored ? () => loadHorizonChunk("A", heightM) : null, [heightM]);
  const horizonB = useChunk(restored ? () => loadHorizonChunk("B", heightM) : null, [heightM]);
  const family = variantFamily(variant);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Explore"
        title="Selector de sitios lunares"
        subtitle="Dos ubicaciones calculadas en Connecting Ridge, polo sur lunar"
      />

      <DataGate>
        {({ core }) => {
          const focused = getSite(core, focusSite);
          return (
            <>
              <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_380px]">
                {/* Columna izquierda: capas y controles */}
                <Panel title="Capas del mapa" icon="layers" className="lg:row-span-2 2xl:row-span-1">
                  <div className="flex flex-col gap-5">
                    <PanelSection title="Capa base">
                      <div className="flex items-center gap-3 rounded-xl border border-line bg-bg-2 p-3">
                        <Icon name="mountain" className="size-5 text-ink-muted" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink">DEM LOLA · PGDA78 Site01</p>
                          <p className="text-xs text-ink-faint">Figura del motor, 40 m/píxel</p>
                        </div>
                        <Icon name="lock" className="size-4 text-ink-faint" title="Siempre visible" />
                      </div>
                    </PanelSection>
                    <PanelSection title="Superposición">
                      <Toggle label="Marcadores A/B" checked={showMarkers} onChange={setShowMarkers} />
                    </PanelSection>
                    <PanelSection title="No disponibles en este paquete">
                      <ul className="flex flex-col gap-1.5 text-sm">
                        {UNAVAILABLE_LAYERS.map((l) => (
                          <li key={l.label} className="flex items-baseline justify-between gap-3 text-ink-faint">
                            <span className="line-through decoration-ink-faint/50">{l.label}</span>
                            <span className="text-right text-[11px]">{l.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </PanelSection>
                    <PanelSection title="Datos del horizonte">
                      <div className="flex flex-col gap-4">
                        <HeightControl />
                        <VariantControl />
                      </div>
                    </PanelSection>
                  </div>
                </Panel>

                {/* Centro: mapa */}
                <Panel
                  title="Contexto de Connecting Ridge"
                  icon="map"
                  className="order-first lg:order-none"
                  actions={
                    <>
                      <NatureBadge nature="OBSERVED" />
                      <Badge tone="neutral">Solo visual</Badge>
                    </>
                  }
                >
                  <ContextMap
                    sites={core.sites}
                    focusSite={focusSite}
                    showMarkers={showMarkers}
                    onSelectSite={(s) => dispatch({ type: "setFocusSite", value: s })}
                  />
                </Panel>

                {/* Derecha: ficha */}
                <Panel title="Ficha del sitio" icon="pin" className="lg:col-start-2 2xl:col-start-auto" actions={<NatureBadge nature="DERIVED" />}>
                  <div className="flex flex-col gap-5">
                    <FocusSiteControl />
                    {focused ? <SiteSheet site={focused} /> : <Callout tone="danger">Sitio no encontrado en el paquete.</Callout>}
                  </div>
                </Panel>
              </div>

              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
                <Panel
                  title={`Perfil del horizonte · ${heightM} m · ${VARIANT_LABEL[variant]}`}
                  icon="mountain"
                  actions={
                    <>
                      <NatureBadge nature={family === "nominal" ? "DERIVED" : "MODELED"} />
                      {heightM > 0 ? <NatureBadge nature="SIMULATED" /> : null}
                    </>
                  }
                  footer={
                    <>
                      Elevación del horizonte sobre el plano horizontal local, 1440 azimuts cada 0,25° (horizons[S].variants[V][H].elevation_deg).
                      Superficie: {FAMILY_META[family].label} — {FAMILY_META[family].description}
                    </>
                  }
                >
                  <div className="flex flex-col gap-3">
                    <Legend
                      items={[
                        ...SITE_IDS.map(
                          (s): LegendItem => ({
                            label: `${SITE_META[s].label}${s === focusSite ? " (seleccionado)" : ""}`,
                            color: SITE_META[s].colorVar,
                            shape: "line",
                          }),
                        ),
                        { label: "Horizonte matemático 0°", color: "var(--color-ink-faint)", shape: "dash" },
                      ]}
                    />
                    <ChunkGate state={horizonA} label="horizonte de A">
                      {(a) => (
                        <ChunkGate state={horizonB} label="horizonte de B">
                          {(b) => (
                            <HorizonChart
                              title={`Perfil del horizonte de A y B a ${heightM} m, superficie ${VARIANT_LABEL[variant]}`}
                              series={[a, b]
                                .map((chunk) => {
                                  const id = chunk.site_id as SiteId;
                                  const p = chunk.variants[variant];
                                  return {
                                    key: id,
                                    label: SITE_META[id].label,
                                    color: SITE_META[id].colorVar,
                                    azimuthDeg: chunk.azimuth_deg,
                                    elevationDeg: p.elevation_deg,
                                    unknown: p.unknown,
                                    emphasis: id === focusSite,
                                  };
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

                <Panel title="Propiedades del punto (A y B)" icon="compare" actions={<Badge tone="neutral">Sin clasificación</Badge>}>
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-end gap-0 text-xs font-semibold">
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
                      if (!a || !b) return <Callout tone="danger">Faltan sitios en el paquete.</Callout>;
                      return (
                        <div>
                          <MetricRow icon="mountain" label="Altura del suelo" hint="m sobre esfera de referencia" a={formatNumber(a.nominal_height_m, 2)} b={formatNumber(b.nominal_height_m, 2)} />
                          <MetricRow label="Pendiente publicada" hint="grados" a={formatNumber(a.values.slp, 2)} b={formatNumber(b.values.slp, 2)} />
                          <MetricRow label="RMS pendiente" hint="grados" a={formatNumber(a.values.slperr, 2)} b={formatNumber(b.values.slperr, 2)} />
                          <MetricRow label="RMS vertical" hint="m" a={formatNumber(a.values.toterr, 2)} b={formatNumber(b.values.toterr, 2)} />
                        </div>
                      );
                    })()}
                    <Callout tone="neutral">
                      Son propiedades del terreno publicadas en cada punto, no una comparación de visibilidad. El ganador depende de la ventana, la
                      altura y el criterio elegido: se mostrará en el Comparador (fase 2).
                    </Callout>
                  </div>
                </Panel>
              </div>
            </>
          );
        }}
      </DataGate>
    </div>
  );
}
