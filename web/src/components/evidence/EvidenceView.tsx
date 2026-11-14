"use client";

import { useEffect, useState } from "react";
import type { Core } from "@/lib/contract/schema";
import { useChunk } from "@/lib/data/DataProvider";
import { BASE_PATH, loadedChunkStatuses, type IntegrityStatus } from "@/lib/data/loader";
import { dataUrl, type DataManifest } from "@/lib/data/manifest";
import { getSite } from "@/lib/data/selectors";
import { formatBytes, formatHoursMinutes, formatNumber, formatUtc, shortHash } from "@/lib/format";
import {
  CHECK_CATEGORIES,
  REFERENCES,
  categorizeCheck,
  loadChecks,
  loadHorizonsContrast,
  loadRefinementEffect,
  loadSpatialConvergence,
  loadTemporalConvergence,
  type CheckRow,
  type HorizonsRow,
  type RefinementEffect,
  type SpatialRow,
  type TemporalRow,
} from "@/lib/science/evidence";
import { useSelection } from "@/lib/state/SelectionProvider";
import { ChunkGate, DataGate } from "../data/DataGate";
import { Badge, Callout, KeyValueList, NatureBadge, StatTile } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { InfoTip } from "../ui/Interactive";
import { PageHeader, Panel } from "../ui/Panel";
import { GeoEvidence } from "./GeoEvidence";
import { HeightsEvidence } from "./HeightsEvidence";
import { L, R } from "@/lib/i18n";

const arcsec = (deg: number) => `${formatNumber(Math.abs(deg) * 3600, 3)}″`;

/** Traducción de las descripciones del manifiesto (generadas en español por scripts/prepare-data.ts). */
const ORIGINAL_DESC_EN: Record<string, string> = {
  "Paquete científico completo site-regret/0.1 (120 escenarios)": "Complete scientific package site-regret/0.1 (120 scenarios)",
  "Pasaporte científico de la ejecución": "Scientific passport of the run",
  "Cruces nominales acotados a 10 minutos": "Nominal crossings bounded to 10 minutes",
  "Metadatos del mapa de contexto 2D": "2D context map metadata",
  "Contrato de datos site-regret/0.1": "site-regret/0.1 data contract",
  "Resumen numérico de la ejecución": "Numerical summary of the run",
  "Informe estático de resultados": "Static results report",
  "Comprobaciones científicas almacenadas": "Stored scientific checks",
  "Contraste SPICE DE421 frente a JPL Horizons": "SPICE DE421 vs JPL Horizons cross-check",
  "Ensayo de convergencia espacial del horizonte": "Spatial convergence test of the horizon",
  "Ensayo de convergencia temporal (10 frente a 5 min)": "Temporal convergence test (10 vs 5 min)",
  "Efecto del refinamiento espacial sobre métricas y ganadores": "Effect of spatial refinement on metrics and winners",
  "Prueba del contrato del consumidor (120 escenarios)": "Consumer contract test (120 scenarios)",
  "Figura: DEM de Connecting Ridge con A y B": "Figure: Connecting Ridge DEM with A and B",
  "Figura: horizonte de A": "Figure: horizon of A",
  "Figura: horizonte de B": "Figure: horizon of B",
  "Figura: cielo nominal W1, A": "Figure: nominal sky W1, A",
  "Figura: cielo nominal W1, B": "Figure: nominal sky W1, B",
  "Figura: cielo nominal W2, A": "Figure: nominal sky W2, A",
  "Figura: cielo nominal W2, B": "Figure: nominal sky W2, B",
  "Lista de hashes SHA-256 de la transferencia": "SHA-256 hash list of the transfer",
};
const originalDesc = (d: string) => L(d, ORIGINAL_DESC_EN[d] ?? d);

function LoadedChunks() {
  const [rows, setRows] = useState<Array<{ path: string; integrity: IntegrityStatus }>>([]);
  useEffect(() => {
    const id = setTimeout(() => loadedChunkStatuses().then(setRows), 600);
    return () => clearTimeout(id);
  }, []);
  if (!rows.length) return <p className="text-xs text-ink-faint">…</p>;
  return (
    <ul tabIndex={0} aria-label={L("Archivos cargados y su verificación", "Loaded files and their verification")} className="flex max-h-40 flex-col gap-1 overflow-auto rounded-md font-mono text-xs focus-visible:outline-2 focus-visible:outline-accent">
      {rows.map((r) => (
        <li key={r.path} className="flex items-center justify-between gap-3">
          <span className="truncate text-ink-muted">{r.path}</span>
          {r.integrity === "verified" ? <Badge tone="ok" icon="check">SHA-256 OK</Badge> : <Badge tone="warn">{L("sin verificar", "unverified")}</Badge>}
        </li>
      ))}
    </ul>
  );
}

const PIPELINE = (): Array<{ step: string; detail: string; nature: "OBSERVED" | "DERIVED" | "MODELED" | "SIMULATED" }> => [
  {
    step: L("DEM y capas de calidad", "DEM and quality layers"),
    detail: L(
      "PGDA78 Site01 a 5 m/píxel (superficie, LDEC, RMS vertical, pendiente) + mosaicos PGDA90 de 80 m y 240 m para el horizonte lejano.",
      "PGDA78 Site01 at 5 m/pixel (surface, LDEC, vertical RMS, slope) + PGDA90 80 m and 240 m mosaics for the far horizon.",
    ),
    nature: "OBSERVED",
  },
  {
    step: L("Puntos A y B", "Points A and B"),
    detail: L("ROI 4 y 6 de Connecting Ridge (Barker 2021, tabla 2, y Site01_ROIs.dbf); pertenencia al ROI verificada.", "Connecting Ridge ROI 4 and 6 (Barker 2021, table 2, and Site01_ROIs.dbf); ROI membership verified."),
    nature: "OBSERVED",
  },
  {
    step: L("Horizonte por azimut", "Horizon by azimuth"),
    detail: L(
      "1440 rayos (0,25°) hasta 400 km con tres escalas de relieve, a 0, 2 y 10 m sobre el suelo; interpolación bilineal.",
      "1440 rays (0.25°) up to 400 km with three relief scales, at 0, 2 and 10 m above the ground; bilinear interpolation.",
    ),
    nature: "DERIVED",
  },
  {
    step: L("Sol y Tierra", "Sun and Earth"),
    detail: L("SPICE (SpiceyPy) con DE421, MOON_ME_DE421, aberración NONE, cada 10 min; centro geométrico de cada cuerpo.", "SPICE (SpiceyPy) with DE421, MOON_ME_DE421, aberration NONE, every 10 min; geometric centre of each body."),
    nature: "DERIVED",
  },
  {
    step: L("Estados y métricas", "States and metrics"),
    detail: L("Cinco estados por intervalo de 10 min; horas con Sol/Tierra/ambos y rachas recortadas a la ventana.", "Five states per 10-minute interval; hours with Sun/Earth/both and streaks clipped to the window."),
    nature: "DERIVED",
  },
  {
    step: L("Variantes del terreno", "Terrain variants"),
    detail: L("4 hipótesis propias (±X, campo correlacionado ±) y 5 clones publicados; mismo cálculo en cada superficie.", "4 team hypotheses (±X, correlated field ±) and 5 published clones; same computation on each surface."),
    nature: "MODELED",
  },
  {
    step: L("Comparación y REGRET", "Comparison and REGRET"),
    detail: L(
      "4 criterios por (ventana, altura); empate ≤ 10 min; regret = pérdida por mantener una elección; recuentos por familia.",
      "4 criteria per (window, height); tie ≤ 10 min; regret = loss from keeping a choice; counts per family.",
    ),
    nature: "DERIVED",
  },
];

function Sources({ core }: { core: Core }) {
  const assets = core.provenance.source_assets;
  const groups = [
    { title: L("Topografía local LOLA · PGDA78 Site01", "Local LOLA topography · PGDA78 Site01"), match: (id: string) => id.startsWith("SITE01_") && !id.includes("CLONE") },
    { title: L("Clones publicados (ensemble Site01)", "Published clones (Site01 ensemble)"), match: (id: string) => id.includes("CLONE") },
    { title: L("Relieve regional y lejano · PGDA90", "Regional and far relief · PGDA90"), match: (id: string) => id.startsWith("DEM_") },
    { title: L("Efemérides y marcos · NASA/JPL NAIF", "Ephemerides and frames · NASA/JPL NAIF"), match: (id: string) => ["LSK", "SPK_DE421", "PCK_MOON_DE421", "FK_MOON_DE421", "PCK_CONSTANTS"].includes(id) },
  ];
  return (
    <Panel title={L("Inventario de fuentes", "Source inventory")} icon="database" actions={<Badge tone="neutral">{assets.length} {L("activos", "assets")}</Badge>}>
      <div className="flex flex-col gap-4">
        {groups.map((g) => {
          const list = assets.filter((a) => g.match(a.id));
          return (
            <div key={g.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{g.title}</h3>
              <ul className="flex flex-col gap-1">
                {list.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-lg border border-line/70 bg-bg-2/60 px-3 py-1.5 text-xs">
                    <span className="w-36 shrink-0 truncate font-mono text-ink">{a.id}</span>
                    <span lang="es" className="min-w-0 flex-1 truncate text-ink-muted" title={a.purpose ?? undefined}>
                      {a.purpose}
                    </span>
                    <span className="hidden font-mono text-[10px] text-ink-faint sm:inline" title={a.sha256 ?? undefined}>
                      {a.sha256 ? shortHash(a.sha256, 10) : "—"}
                    </span>
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-accent hover:text-ink" aria-label={`${L("Abrir fuente", "Open source")} ${a.id}`}>
                        <Icon name="external" className="size-3.5" />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <p className="text-[11px] text-ink-faint">
          {L(
            "URL, hash SHA-256 y estado de verificación de cada activo según el pasaporte. Algunas etiquetas de catálogo (p. ej. HEADER_INSPECTED) describen la fase de descarga, no la validación posterior.",
            "URL, SHA-256 hash and verification status of each asset according to the passport. Some catalogue labels (e.g. HEADER_INSPECTED) describe the download phase, not the later validation.",
          )}
        </p>
      </div>
    </Panel>
  );
}

function ChecksPanel({ checks }: { checks: CheckRow[] }) {
  const counts = CHECK_CATEGORIES.map((c) => {
    const rows = checks.filter((r) => categorizeCheck(r.name) === c.id);
    return { ...c, total: rows.length, passed: rows.filter((r) => r.passed).length };
  }).filter((c) => c.total > 0);
  const max = Math.max(...counts.map((c) => c.total));
  const passed = checks.filter((c) => c.passed).length;
  return (
    <Panel title={`${L("Comprobaciones guardadas", "Stored checks")} · ${passed}/${checks.length}`} icon="check" actions={<InfoTip>{L("validacion/pruebas.json de la ejecución documentada. Demuestran coherencia interna de aquella ejecución; no certifican la exactitud del DEM ni el producto web.", "validacion/pruebas.json from the documented run. They show the internal consistency of that run; they do not certify the DEM accuracy or the web product.")}</InfoTip>}>
      <ul className="flex flex-col gap-3">
        {counts.map((c) => (
          <li key={c.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink">{c.label}</span>
              <span className="tabular text-ink-muted">
                {c.passed}/{c.total}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3/70">
              <div className="h-full rounded-full bg-ok/80" style={{ width: `${(c.total / max) * 100}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-ink-faint">{c.description}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function HorizonsPanel({ rows }: { rows: HorizonsRow[] }) {
  return (
    <Panel title={L("Contraste con JPL Horizons", "JPL Horizons cross-check")} icon="target" bodyClassName="p-0 sm:p-0" footer={L("Horizons devuelve posiciones aparentes (DE441); se comparan con SPICE DE421 en modo aparente CN+S. Las métricas usan el modo geométrico NONE. El acuerdo angular no mide la precisión del DEM.", "Horizons returns apparent positions (DE441); they are compared with SPICE DE421 in apparent CN+S mode. Metrics use geometric mode NONE. Angular agreement does not measure DEM accuracy.")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">{L("Diferencias angulares SPICE frente a Horizons", "SPICE vs Horizons angular differences")}</caption>
          <thead>
            <tr className="border-b border-line text-xs text-ink-faint">
              <th scope="col" className="px-5 py-2.5 text-left font-medium">{L("Sitio", "Site")}</th>
              <th scope="col" className="px-3 py-2.5 text-left font-medium">{L("Cuerpo", "Body")}</th>
              <th scope="col" className="px-3 py-2.5 text-left font-medium">{L("Instante (UTC)", "Instant (UTC)")}</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">{L("Elevación Horizons", "Horizons elevation")}</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">|Δ az|</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">|Δ el|</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={k} className="border-b border-line/60 last:border-b-0 text-ink-muted">
                <td className="px-5 py-2 font-semibold text-ink">{r.site}</td>
                <td className="px-3 py-2">{r.target === "SUN" ? L("Sol", "Sun") : L("Tierra", "Earth")}</td>
                <td className="tabular px-3 py-2">{formatUtc(r.utc.replace(".000Z", "Z"))}</td>
                <td className="tabular px-3 py-2 text-right">{formatNumber(r.horizons_el_deg, 4)}°</td>
                <td className="tabular px-3 py-2 text-right">{arcsec(r.delta_az_deg)}</td>
                <td className="tabular px-5 py-2 text-right">{arcsec(r.delta_el_deg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ConvergencePanel({ spatial, temporal, effect }: { spatial: SpatialRow[]; temporal: TemporalRow[]; effect: RefinementEffect }) {
  const maxTemporal = Math.max(...temporal.flatMap((t) => Object.values(t.differences_hours).map(Math.abs)));
  return (
    <Panel title={L("Ensayos de convergencia", "Convergence tests")} icon="sliders" actions={<InfoTip>{L("Cambios medidos al refinar el muestreo. No son cotas de error total: no incluyen la incertidumbre epistémica del DEM.", "Changes measured when refining the sampling. They are not total error bounds: they do not include the epistemic uncertainty of the DEM.")}</InfoTip>}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{L("Espacial (horizonte)", "Spatial (horizon)")}</h3>
          <table className="w-full text-xs">
            <caption className="sr-only">{L("Convergencia espacial del horizonte", "Spatial convergence of the horizon")}</caption>
            <thead>
              <tr className="text-ink-faint">
                <th scope="col" className="pb-1 text-left font-medium">{L("Sitio · altura", "Site · height")}</th>
                <th scope="col" className="pb-1 text-right font-medium">{L("Máx. |Δ|", "Max |Δ|")}</th>
                <th scope="col" className="pb-1 text-right font-medium">RMS</th>
              </tr>
            </thead>
            <tbody>
              {spatial.map((r) => (
                <tr key={`${r.site}${r.height_m}`} className="border-t border-line/60 text-ink-muted">
                  <td className="py-1.5">
                    {r.site} · {r.height_m} m
                  </td>
                  <td className="tabular py-1.5 text-right">{formatNumber(r.angular_and_radial_refinement_max_abs_deg, 4)}°</td>
                  <td className="tabular py-1.5 text-right">{formatNumber(r.rms_deg, 4)}°</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{L("Temporal y efecto en decisiones", "Temporal and effect on decisions")}</h3>
          <KeyValueList
            items={[
              { k: L("Paso 10 min frente a 5 min", "10 min vs 5 min step"), v: `${temporal.length} ${L("escenarios nominales", "nominal scenarios")}` },
              { k: L("Máx. diferencia de métrica", "Max metric difference"), v: formatHoursMinutes(maxTemporal) },
              { k: L("Refinamiento espacial: máx. cambio", "Spatial refinement: max change"), v: formatHoursMinutes(effect.max_abs_metric_change_hours) },
              { k: L("Ganador principal sin cambios", "Main winner unchanged"), v: `${effect.primary_winner_unchanged_count} ${L("de", "of")} ${effect.comparison_count}` },
            ]}
          />
          <p className="text-[11px] text-ink-faint" lang="en">
            {effect.interpretation}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function RmsPanel({ core }: { core: Core }) {
  const a = getSite(core, "A")!;
  const b = getSite(core, "B")!;
  return (
    <Panel title={L("Qué representa el RMS", "What the RMS represents")} icon="info">
      <div className="flex flex-col gap-3 text-sm text-ink-muted">
        <p>
          {R(
            "{t} es el error RMS formal de altura que publica PGDA78 para cada píxel de 5 m (A: {ta} m · B: {tb} m). {s} es el RMS de la pendiente (A: {sa}° · B: {sb}°).",
            "{t} is the formal height RMS error published by PGDA78 for each 5 m pixel (A: {ta} m · B: {tb} m). {s} is the slope RMS (A: {sa}° · B: {sb}°).",
            {
              t: <strong className="text-ink">toterr</strong>,
              s: <strong className="text-ink">slperr</strong>,
              ta: formatNumber(a.values.toterr, 2),
              tb: formatNumber(b.values.toterr, 2),
              sa: formatNumber(a.values.slperr, 2),
              sb: formatNumber(b.values.slperr, 2),
            },
          )}
        </p>
        <p>
          {R(
            "Representan la incertidumbre estimada por el productor del DEM en ese punto. {no} son el error total del horizonte, no cubren obstáculos más pequeños que la resolución y no se usan para fijar X = {x} m de las hipótesis propias, que es un parámetro editable.",
            "They represent the uncertainty estimated by the DEM producer at that point. They are {no} the total horizon error, they do not cover obstacles smaller than the resolution and they are not used to set X = {x} m of the team hypotheses, which is an editable parameter.",
            { no: <strong className="text-ink">{L("No", "not")}</strong>, x: formatNumber(core.configuration.hypothesis_X_m, 0) },
          )}
        </p>
        <p>
          {L(
            "Con LDEC = 0 (sin retornos LOLA en el píxel) la altura del punto procede de interpolación; ambos sitios están en ese caso. El solape local/regional mide un RMS de 1,22 m (qa_entradas.json) sin corrección vertical automática.",
            "With LDEC = 0 (no LOLA returns in the pixel) the point height comes from interpolation; both sites are in that case. The local/regional overlap measures an RMS of 1.22 m (qa_entradas.json) with no automatic vertical correction.",
          )}
        </p>
      </div>
    </Panel>
  );
}

function Downloads({ manifest }: { manifest: DataManifest }) {
  return (
    <Panel title={L("Información reproducible (originales sin modificar)", "Reproducible information (unmodified originals)")} icon="download" footer={L(`Cada archivo coincide con su SHA-256 en ${manifest.source.hash_list}. manifest.json documenta la división del paquete y su verificación.`, `Each file matches its SHA-256 in ${manifest.source.hash_list}. manifest.json documents how the package is split and verified.`)}>
      <ul className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
        <li className="min-w-0">
          <a href={dataUrl(BASE_PATH, "manifest.json")} download className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent-surface/40 p-3 hover:border-accent">
            <Icon name="json" className="mt-0.5 size-4 shrink-0 text-accent" />
            <span className="min-w-0">
              <span className="block text-sm text-ink">{L("Manifiesto de datos servidos", "Served data manifest")}</span>
              <span className="block truncate font-mono text-[11px] text-ink-faint">manifest.json · {L("trozos + hashes", "chunks + hashes")}</span>
            </span>
          </a>
        </li>
        {manifest.originals.map((o) => (
          <li key={o.path} className="min-w-0">
            <a href={dataUrl(BASE_PATH, o.path)} download className="flex items-start gap-3 rounded-xl border border-line bg-bg-2 p-3 hover:border-line-strong hover:bg-surface-2">
              <Icon name="download" className="mt-0.5 size-4 shrink-0 text-ink-muted" />
              <span className="min-w-0">
                <span className="block text-sm text-ink">{originalDesc(o.description)}</span>
                <span className="block truncate font-mono text-[11px] text-ink-faint">
                  {o.transfer_path.split("/").pop()} · {formatBytes(o.bytes)} · {shortHash(o.sha256, 10)}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function EvidenceBody({ core, manifest, integrity }: { core: Core; manifest: DataManifest; integrity: IntegrityStatus }) {
  const { restored } = useSelection();
  const checks = useChunk(restored ? loadChecks : null, ["checks"]);
  const horizons = useChunk(restored ? loadHorizonsContrast : null, ["horizons"]);
  const spatial = useChunk(restored ? loadSpatialConvergence : null, ["spatial"]);
  const temporal = useChunk(restored ? loadTemporalConvergence : null, ["temporal"]);
  const effect = useChunk(restored ? loadRefinementEffect : null, ["effect"]);
  const p = core.provenance;
  const cfg = core.configuration;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon="check" label={L("Comprobaciones guardadas", "Stored checks")} value={`${p.validation.passed}/${p.validation.passed + p.validation.failed}`} detail={L("De la ejecución documentada; no certifican el producto", "From the documented run; they do not certify the product")} />
        <StatTile icon="target" label={L("Contraste JPL Horizons", "JPL Horizons cross-check")} value={`${p.validation.horizons_reference_rows} ${L("filas", "rows")}`} detail={`${L("Δ máx.", "max Δ")} ${arcsec(p.validation.max_horizons_az_delta_deg)} az · ${arcsec(p.validation.max_horizons_el_delta_deg)} el`} />
        <StatTile icon="database" label={L("Activos de origen", "Source assets")} value={p.source_assets.length} detail={L("URL, hash y estado en el pasaporte", "URL, hash and status in the passport")} />
        <StatTile icon="layers" label={L("Escenarios del contrato", "Contract scenarios")} value={p.scenario_count} detail={L(`${p.comparison_count} comparaciones · contrato del consumidor superado`, `${p.comparison_count} comparisons · consumer contract passed`)} />
        <StatTile
          icon="shield"
          label={L("Integridad en este navegador", "Integrity in this browser")}
          value={integrity === "verified" ? L("Verificada", "Verified") : L("No verificable", "Not verifiable")}
          detail={integrity === "verified" ? L("Cada archivo coincide con su SHA-256", "Each file matches its SHA-256") : L("crypto.subtle requiere https o localhost", "crypto.subtle requires https or localhost")}
        />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] xl:grid-cols-2">
        <Sources core={core} />
        <Panel title={L("Metodología", "Methodology")} icon="book" actions={<InfoTip>{L("Cadena del motor Python (motor/pipeline.py). La web solo representa sus salidas.", "Python engine pipeline (motor/pipeline.py). The website only displays its outputs.")}</InfoTip>}>
          <ol className="relative flex flex-col gap-3 border-l border-line-strong pl-5">
            {PIPELINE().map((s, k) => (
              <li key={s.step} className="relative">
                <span className="absolute -left-[27px] grid size-[14px] place-items-center rounded-full border border-accent bg-bg text-[8px] font-bold text-accent">{k + 1}</span>
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {s.step} <NatureBadge nature={s.nature} />
                </p>
                <p className="text-xs leading-relaxed text-ink-muted">{s.detail}</p>
              </li>
            ))}
          </ol>
        </Panel>
        <div className="flex flex-col gap-5 xl:col-span-2 2xl:col-span-1">
          <ChunkGate state={checks} label={L("comprobaciones", "checks")}>
            {(c: CheckRow[]) => <ChecksPanel checks={c} />}
          </ChunkGate>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChunkGate state={horizons} label={L("contraste Horizons", "Horizons cross-check")}>
          {(r: HorizonsRow[]) => <HorizonsPanel rows={r} />}
        </ChunkGate>
        <ChunkGate state={spatial} label={L("convergencia", "convergence")}>
          {(s: SpatialRow[]) => (
            <ChunkGate state={temporal} label={L("convergencia temporal", "temporal convergence")}>
              {(t: TemporalRow[]) => (
                <ChunkGate state={effect} label={L("efecto del refinamiento", "refinement effect")}>
                  {(e: RefinementEffect) => <ConvergencePanel spatial={s} temporal={t} effect={e} />}
                </ChunkGate>
              )}
            </ChunkGate>
          )}
        </ChunkGate>
      </div>

      <GeoEvidence />

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title={L("Parámetros e hipótesis", "Parameters and hypotheses")} icon="flask" actions={<Badge tone="uncertainty">MODELED</Badge>}>
          <KeyValueList
            items={[
              { k: L("Hipótesis X", "Hypothesis X"), v: `${formatNumber(cfg.hypothesis_X_m, 1)} m` },
              { k: L("σ del filtro gaussiano", "Gaussian filter σ"), v: `${formatNumber(cfg.gaussian_filter_sigma_m, 0)} m` },
              { k: L("Semilla", "Seed"), v: cfg.seed, mono: true },
              { k: L("Paso temporal / azimutal", "Time / azimuth step"), v: `${cfg.time_step_minutes} min · ${formatNumber(cfg.azimuth_step_deg, 2)}°` },
              { k: L("Alcance del rayo", "Ray range"), v: `${formatNumber(cfg.max_ray_distance_m / 1000, 0)} km` },
              { k: L("Visibilidad", "Visibility"), v: cfg.body_visibility, mono: true },
              { k: L("Aberración", "Aberration"), v: cfg.aberration, mono: true },
              { k: L("Tolerancia de empate", "Tie tolerance"), v: formatHoursMinutes(cfg.tie_tolerance_hours) },
              { k: L("Observador en clones", "Observer on clones"), v: cfg.observer_on_published_clone },
              { k: L("Observador en variantes propias", "Observer on team variants"), v: cfg.observer_on_synthetic_variant },
            ]}
          />
        </Panel>
        <RmsPanel core={core} />
        <Panel title={L("Naturaleza de los datos", "Nature of the data")} icon="info">
          <ul className="flex flex-col gap-2.5 text-sm text-ink-muted">
            <li className="flex gap-2"><NatureBadge nature="OBSERVED" /> {L("DEM, capas de calidad, clones y kernels publicados por NASA.", "DEM, quality layers, clones and kernels published by NASA.")}</li>
            <li className="flex gap-2"><NatureBadge nature="DERIVED" /> {L("Horizontes, direcciones, estados, métricas y comparaciones calculados por el equipo.", "Horizons, directions, states, metrics and comparisons computed by the team.")}</li>
            <li className="flex gap-2"><NatureBadge nature="MODELED" /> {L("Cuatro hipótesis propias del terreno (X, σ, semilla).", "Four team terrain hypotheses (X, σ, seed).")}</li>
            <li className="flex gap-2"><NatureBadge nature="SIMULATED" /> {L("Observador a 2 y 10 m; ventanas de desarrollo W1/W2.", "Observer at 2 and 10 m; W1/W2 development windows.")}</li>
          </ul>
          <p className="mt-3 text-xs text-ink-faint">
            {L("Pasaporte:", "Passport:")} {Object.entries(p.nature).map(([k, v]) => `${k}=${v}`).join(" · ")}.{" "}
            {L("Los resultados son cálculos del equipo QuemandoTokens con datos NASA; no son productos NASA.", "Results are computations by team QuemandoTokens using NASA data; they are not NASA products.")}
          </p>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel title={L("Referencias", "References")} icon="book">
          <ul className="flex flex-col gap-3">
            {REFERENCES.map((r) => (
              <li key={r.id} className="text-sm">
                <p className="text-ink">{r.text}</p>
                <p className="text-xs text-ink-faint">
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {r.label}
                  </a>{" "}
                  · {r.use}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={L("Límites declarados", "Declared limits")} icon="alert" footer={L("Texto original del pasaporte (inglés). No se reinterpreta.", "Original passport text (English). Not reinterpreted.")}>
          <ul className="flex flex-col gap-2 text-sm text-ink-muted">
            {p.limitations.map((l) => (
              <li key={l} className="flex gap-2">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-warn" />
                <span lang="en">{l}</span>
              </li>
            ))}
          </ul>
          <Callout tone="warn" icon="alert">
            {L(
              "Sin modelos de energía, enlace de radio, temperatura, radiación ni seguridad de alunizaje. Las frecuencias de variantes no son probabilidades.",
              "No models of power, radio link, temperature, radiation or landing safety. Variant frequencies are not probabilities.",
            )}
          </Callout>
        </Panel>
      </div>

      <HeightsEvidence core={core} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title={L("Integridad y ejecución", "Integrity and run")} icon="hash">
          <KeyValueList
            items={[
              { k: L("Esquema", "Schema"), v: core.schema_version, mono: true },
              { k: L("Paquete (SHA-256)", "Package (SHA-256)"), v: shortHash(manifest.source.sha256, 24), mono: true },
              { k: L("Tamaño", "Size"), v: formatBytes(manifest.source.bytes) },
              { k: L("Originales verificados", "Verified originals"), v: `${manifest.source.verified_files}` },
              { k: L("Motor (SHA-256)", "Engine (SHA-256)"), v: shortHash(p.engine_sha256, 24), mono: true },
              { k: L("Generado (UTC)", "Generated (UTC)"), v: p.generated_at_utc.slice(0, 19).replace("T", " "), mono: true },
              { k: "Python", v: p.python.split(" ")[0], mono: true },
              ...Object.entries(p.software).map(([k, v]) => ({ k, v, mono: true })),
            ]}
          />
          <h3 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{L("Archivos cargados en esta sesión", "Files loaded in this session")}</h3>
          <LoadedChunks />
        </Panel>
        <Downloads manifest={manifest} />
      </div>

      <Callout tone="neutral" title={L("Declaración conservada", "Preserved statement")}>
        {String(cfg.user_start_authorization)} —{" "}
        {L("declaración del usuario registrada en la configuración, no un documento de la organización.", "user statement recorded in the configuration, not an organisation document.")}
      </Callout>
    </>
  );
}

export function EvidenceView() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={L("Evidencia científica", "Scientific evidence")} title="Scientific Evidence" subtitle={L("Fuentes, método, validaciones, límites y descargas reproducibles", "Sources, method, validations, limits and reproducible downloads")} />
      <DataGate>{({ core, manifest, integrity }) => <EvidenceBody core={core} manifest={manifest} integrity={integrity} />}</DataGate>
    </div>
  );
}
