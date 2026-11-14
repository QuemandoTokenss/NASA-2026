"use client";

import Link from "next/link";
import { HEIGHTS_M, SITE_IDS, VARIANTS } from "@/lib/contract/constants";
import { formatDeg, formatHoursMinutes, formatLatitude, formatLongitudeEast, formatNumber, formatUtc } from "@/lib/format";
import { CRITERION_META, SITE_META } from "@/lib/labels";
import { NAV } from "@/lib/nav";
import { useSelection } from "@/lib/state/SelectionProvider";
import { DataGate } from "../data/DataGate";
import { Callout, KeyValueList, NatureBadge, SiteDot, StatTile } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { PageHeader, Panel } from "../ui/Panel";

const PRINCIPLES = [
  "Solo dos sitios calculados (A = ROI 4, B = ROI 6), dos ventanas UTC y tres alturas: no hay selección libre de fechas ni coordenadas.",
  "El criterio se elige antes de ver el ganador; los empates usan la tolerancia del motor (10 min) con valores completos.",
  "Las fracciones de variantes no son probabilidades de éxito: se muestran como conteos y por familias separadas.",
  "«Visible» significa centro geométrico sobre el relieve: no implica energía, enlace de radio ni seguridad de alunizaje.",
  "Desconocido (estado 4 o null) nunca se interpreta como sombra ni como cero.",
];

export function HomeView() {
  const { query } = useSelection();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Site Regret"
        title="¿Se mantiene la elección si cambia el terreno?"
        subtitle="Comparación de dos sitios del polo sur lunar con resultados precalculados y trazables"
      />
      <DataGate>
        {({ core, manifest }) => {
          const p = core.provenance;
          const cfg = core.configuration;
          return (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  icon="layers"
                  label="Escenarios calculados"
                  value={p.scenario_count}
                  detail={`${SITE_IDS.length} sitios × ${cfg.windows.length} ventanas × ${cfg.heights_m.length} alturas × ${VARIANTS.length} superficies`}
                />
                <StatTile icon="compare" label="Comparaciones A/B" value={p.comparison_count} detail="Una por ventana y altura, cada una con 4 criterios" />
                <StatTile
                  icon="check"
                  label="Comprobaciones del motor"
                  value={`${p.validation.passed} / ${p.validation.passed + p.validation.failed}`}
                  detail="Superadas en la ejecución documentada; no certifican el producto"
                />
                <StatTile
                  icon="target"
                  label="Contraste JPL Horizons"
                  value={p.validation.horizons_reference_rows}
                  unit="filas"
                  detail={`Δ máx. azimut ${formatNumber(p.validation.max_horizons_az_delta_deg * 3600, 3)}″ · elevación ${formatNumber(p.validation.max_horizons_el_delta_deg * 3600, 3)}″`}
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <Panel title="Escenario científico entregado" icon="map" actions={<NatureBadge nature="DERIVED" />}>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-3">
                      {core.sites.map((s) => (
                        <div key={s.id} className="rounded-xl border border-line bg-bg-2 p-3.5">
                          <p className={`flex items-center gap-2 font-semibold ${SITE_META[s.id].textClass}`}>
                            <SiteDot site={s.id} /> {SITE_META[s.id].label}
                          </p>
                          <p className="text-sm text-ink">{s.name}</p>
                          <p className="tabular text-xs text-ink-muted">
                            {formatLatitude(s.latitude_deg)}, {formatLongitudeEast(s.longitude_east_deg)}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-4">
                      <KeyValueList
                        items={[
                          ...cfg.windows.map((w) => ({ k: `Ventana ${w.id}`, v: `${formatUtc(w.start)} → ${formatUtc(w.stop)}` })),
                          { k: "Alturas del observador", v: HEIGHTS_M.map((h) => `${h} m`).join(" · ") },
                          { k: "Paso temporal", v: `${cfg.time_step_minutes} min` },
                          { k: "Paso de azimut", v: formatDeg(cfg.azimuth_step_deg) },
                          { k: "Marco", v: cfg.frame, mono: true },
                          { k: "Visibilidad", v: cfg.body_visibility, mono: true },
                          { k: "Tolerancia de empate", v: formatHoursMinutes(cfg.tie_tolerance_hours) },
                        ]}
                      />
                      <p className="text-xs text-ink-faint">
                        Ventanas de desarrollo elegidas por el equipo, no fechas oficiales de ninguna misión. Criterio principal del motor:{" "}
                        {CRITERION_META[cfg.primary_criterion].label.toLowerCase()}.
                      </p>
                    </div>
                  </div>
                </Panel>

                <Panel title="Principios de lectura" icon="shield">
                  <ul className="flex flex-col gap-3 text-sm text-ink-muted">
                    {PRINCIPLES.map((t) => (
                      <li key={t} className="flex gap-2.5">
                        <Icon name="check" className="mt-0.5 size-4 shrink-0 text-ok" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>

              <Panel title="Recorrido" icon="arrowRight">
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {NAV.filter((n) => n.href !== "/").map((n) => (
                    <li key={n.href}>
                      <Link
                        href={`${n.href}?${query}`}
                        className="group flex h-full gap-3 rounded-xl border border-line bg-bg-2 p-4 transition-colors hover:border-line-strong hover:bg-surface-2"
                      >
                        <Icon name={n.icon} className="mt-0.5 size-5 shrink-0 text-ink-muted group-hover:text-ink" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="font-semibold text-ink">{n.label}</span>
                            
                          </span>
                          <span className="mt-1 block text-sm text-ink-muted">{n.summary}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Callout tone="neutral" icon="hash" title="Trazabilidad">
                Paquete <code className="font-mono">{manifest.source.transfer_path}</code> · SHA-256{" "}
                <code className="font-mono break-all">{manifest.source.sha256}</code> · {manifest.source.verified_files} originales verificados en la
                preparación. Detalle en <Link href={`/evidencia/?${query}`} className="text-accent underline-offset-2 hover:underline">Evidencia</Link>.
              </Callout>
            </>
          );
        }}
      </DataGate>
    </div>
  );
}
