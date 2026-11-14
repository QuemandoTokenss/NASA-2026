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

const arcsec = (deg: number) => `${formatNumber(Math.abs(deg) * 3600, 3)}″`;

function LoadedChunks() {
  const [rows, setRows] = useState<Array<{ path: string; integrity: IntegrityStatus }>>([]);
  useEffect(() => {
    const id = setTimeout(() => loadedChunkStatuses().then(setRows), 600);
    return () => clearTimeout(id);
  }, []);
  if (!rows.length) return <p className="text-xs text-ink-faint">…</p>;
  return (
    <ul tabIndex={0} aria-label="Archivos cargados y su verificación" className="flex max-h-40 flex-col gap-1 overflow-auto rounded-md font-mono text-xs focus-visible:outline-2 focus-visible:outline-accent">
      {rows.map((r) => (
        <li key={r.path} className="flex items-center justify-between gap-3">
          <span className="truncate text-ink-muted">{r.path}</span>
          {r.integrity === "verified" ? <Badge tone="ok" icon="check">SHA-256 OK</Badge> : <Badge tone="warn">sin verificar</Badge>}
        </li>
      ))}
    </ul>
  );
}

const PIPELINE: Array<{ step: string; detail: string; nature: "OBSERVED" | "DERIVED" | "MODELED" | "SIMULATED" }> = [
  { step: "DEM y capas de calidad", detail: "PGDA78 Site01 a 5 m/píxel (superficie, LDEC, RMS vertical, pendiente) + mosaicos PGDA90 de 80 m y 240 m para el horizonte lejano.", nature: "OBSERVED" },
  { step: "Puntos A y B", detail: "ROI 4 y 6 de Connecting Ridge (Barker 2021, tabla 2, y Site01_ROIs.dbf); pertenencia al ROI verificada.", nature: "OBSERVED" },
  { step: "Horizonte por azimut", detail: "1440 rayos (0,25°) hasta 400 km con tres escalas de relieve, a 0, 2 y 10 m sobre el suelo; interpolación bilineal.", nature: "DERIVED" },
  { step: "Sol y Tierra", detail: "SPICE (SpiceyPy) con DE421, MOON_ME_DE421, aberración NONE, cada 10 min; centro geométrico de cada cuerpo.", nature: "DERIVED" },
  { step: "Estados y métricas", detail: "Cinco estados por intervalo de 10 min; horas con Sol/Tierra/ambos y rachas recortadas a la ventana.", nature: "DERIVED" },
  { step: "Variantes del terreno", detail: "4 hipótesis propias (±X, campo correlacionado ±) y 5 clones publicados; mismo cálculo en cada superficie.", nature: "MODELED" },
  { step: "Comparación y REGRET", detail: "4 criterios por (ventana, altura); empate ≤ 10 min; regret = pérdida por mantener una elección; recuentos por familia.", nature: "DERIVED" },
];

function Sources({ core }: { core: Core }) {
  const assets = core.provenance.source_assets;
  const groups = [
    { title: "Topografía local LOLA · PGDA78 Site01", match: (id: string) => id.startsWith("SITE01_") && !id.includes("CLONE") },
    { title: "Clones publicados (ensemble Site01)", match: (id: string) => id.includes("CLONE") },
    { title: "Relieve regional y lejano · PGDA90", match: (id: string) => id.startsWith("DEM_") },
    { title: "Efemérides y marcos · NASA/JPL NAIF", match: (id: string) => ["LSK", "SPK_DE421", "PCK_MOON_DE421", "FK_MOON_DE421", "PCK_CONSTANTS"].includes(id) },
  ];
  return (
    <Panel title="Inventario de fuentes" icon="database" actions={<Badge tone="neutral">{assets.length} activos</Badge>}>
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
                    <span className="min-w-0 flex-1 truncate text-ink-muted" title={a.purpose ?? undefined}>
                      {a.purpose}
                    </span>
                    <span className="hidden font-mono text-[10px] text-ink-faint sm:inline" title={a.sha256 ?? undefined}>
                      {a.sha256 ? shortHash(a.sha256, 10) : "—"}
                    </span>
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-accent hover:text-ink" aria-label={`Abrir fuente ${a.id}`}>
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
          URL, hash SHA-256 y estado de verificación de cada activo según el pasaporte. Algunas etiquetas de catálogo (p. ej. HEADER_INSPECTED) describen la fase de descarga, no la
          validación posterior.
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
    <Panel title={`Comprobaciones guardadas · ${passed}/${checks.length}`} icon="check" actions={<InfoTip>validacion/pruebas.json de la ejecución documentada. Demuestran coherencia interna de aquella ejecución; no certifican la exactitud del DEM ni el producto web.</InfoTip>}>
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
    <Panel title="Contraste con JPL Horizons" icon="target" bodyClassName="p-0 sm:p-0" footer="Horizons devuelve posiciones aparentes (DE441); se comparan con SPICE DE421 en modo aparente CN+S. Las métricas usan el modo geométrico NONE. El acuerdo angular no mide la precisión del DEM.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Diferencias angulares SPICE frente a Horizons</caption>
          <thead>
            <tr className="border-b border-line text-xs text-ink-faint">
              <th scope="col" className="px-5 py-2.5 text-left font-medium">Sitio</th>
              <th scope="col" className="px-3 py-2.5 text-left font-medium">Cuerpo</th>
              <th scope="col" className="px-3 py-2.5 text-left font-medium">Instante (UTC)</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Elevación Horizons</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">|Δ az|</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">|Δ el|</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={k} className="border-b border-line/60 last:border-b-0 text-ink-muted">
                <td className="px-5 py-2 font-semibold text-ink">{r.site}</td>
                <td className="px-3 py-2">{r.target === "SUN" ? "Sol" : "Tierra"}</td>
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
    <Panel title="Ensayos de convergencia" icon="sliders" actions={<InfoTip>Cambios medidos al refinar el muestreo. No son cotas de error total: no incluyen la incertidumbre epistémica del DEM.</InfoTip>}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Espacial (horizonte)</h3>
          <table className="w-full text-xs">
            <caption className="sr-only">Convergencia espacial del horizonte</caption>
            <thead>
              <tr className="text-ink-faint">
                <th scope="col" className="pb-1 text-left font-medium">Sitio · altura</th>
                <th scope="col" className="pb-1 text-right font-medium">Máx. |Δ|</th>
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
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Temporal y efecto en decisiones</h3>
          <KeyValueList
            items={[
              { k: "Paso 10 min frente a 5 min", v: `${temporal.length} escenarios nominales` },
              { k: "Máx. diferencia de métrica", v: formatHoursMinutes(maxTemporal) },
              { k: "Refinamiento espacial: máx. cambio", v: formatHoursMinutes(effect.max_abs_metric_change_hours) },
              { k: "Ganador principal sin cambios", v: `${effect.primary_winner_unchanged_count} de ${effect.comparison_count}` },
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
    <Panel title="Qué representa el RMS" icon="info">
      <div className="flex flex-col gap-3 text-sm text-ink-muted">
        <p>
          <strong className="text-ink">toterr</strong> es el error RMS formal de altura que publica PGDA78 para cada píxel de 5 m (A: {formatNumber(a.values.toterr, 2)} m · B:{" "}
          {formatNumber(b.values.toterr, 2)} m). <strong className="text-ink">slperr</strong> es el RMS de la pendiente (A: {formatNumber(a.values.slperr, 2)}° · B:{" "}
          {formatNumber(b.values.slperr, 2)}°).
        </p>
        <p>
          Representan la incertidumbre estimada por el productor del DEM en ese punto. <strong className="text-ink">No</strong> son el error total del horizonte, no cubren obstáculos más
          pequeños que la resolución y no se usan para fijar X = {formatNumber(core.configuration.hypothesis_X_m, 0)} m de las hipótesis propias, que es un parámetro editable.
        </p>
        <p>
          Con LDEC = 0 (sin retornos LOLA en el píxel) la altura del punto procede de interpolación; ambos sitios están en ese caso. El solape local/regional mide un RMS de 1,22 m
          (qa_entradas.json) sin corrección vertical automática.
        </p>
      </div>
    </Panel>
  );
}

function Downloads({ manifest }: { manifest: DataManifest }) {
  return (
    <Panel title="Información reproducible (originales sin modificar)" icon="download" footer={`Cada archivo coincide con su SHA-256 en ${manifest.source.hash_list}. manifest.json documenta la división del paquete y su verificación.`}>
      <ul className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
        <li className="min-w-0">
          <a href={dataUrl(BASE_PATH, "manifest.json")} download className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent-surface/40 p-3 hover:border-accent">
            <Icon name="json" className="mt-0.5 size-4 shrink-0 text-accent" />
            <span className="min-w-0">
              <span className="block text-sm text-ink">Manifiesto de datos servidos</span>
              <span className="block truncate font-mono text-[11px] text-ink-faint">manifest.json · trozos + hashes</span>
            </span>
          </a>
        </li>
        {manifest.originals.map((o) => (
          <li key={o.path} className="min-w-0">
            <a href={dataUrl(BASE_PATH, o.path)} download className="flex items-start gap-3 rounded-xl border border-line bg-bg-2 p-3 hover:border-line-strong hover:bg-surface-2">
              <Icon name="download" className="mt-0.5 size-4 shrink-0 text-ink-muted" />
              <span className="min-w-0">
                <span className="block text-sm text-ink">{o.description}</span>
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
        <StatTile icon="check" label="Comprobaciones guardadas" value={`${p.validation.passed}/${p.validation.passed + p.validation.failed}`} detail="De la ejecución documentada; no certifican el producto" />
        <StatTile icon="target" label="Contraste JPL Horizons" value={`${p.validation.horizons_reference_rows} filas`} detail={`Δ máx. ${arcsec(p.validation.max_horizons_az_delta_deg)} az · ${arcsec(p.validation.max_horizons_el_delta_deg)} el`} />
        <StatTile icon="database" label="Activos de origen" value={p.source_assets.length} detail="URL, hash y estado en el pasaporte" />
        <StatTile icon="layers" label="Escenarios del contrato" value={p.scenario_count} detail={`${p.comparison_count} comparaciones · contrato del consumidor superado`} />
        <StatTile
          icon="shield"
          label="Integridad en este navegador"
          value={integrity === "verified" ? "Verificada" : "No verificable"}
          detail={integrity === "verified" ? "Cada archivo coincide con su SHA-256" : "crypto.subtle requiere https o localhost"}
        />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] xl:grid-cols-2">
        <Sources core={core} />
        <Panel title="Metodología" icon="book" actions={<InfoTip>Cadena del motor Python (motor/pipeline.py). La web solo representa sus salidas.</InfoTip>}>
          <ol className="relative flex flex-col gap-3 border-l border-line-strong pl-5">
            {PIPELINE.map((s, k) => (
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
          <ChunkGate state={checks} label="comprobaciones">
            {(c: CheckRow[]) => <ChecksPanel checks={c} />}
          </ChunkGate>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChunkGate state={horizons} label="contraste Horizons">
          {(r: HorizonsRow[]) => <HorizonsPanel rows={r} />}
        </ChunkGate>
        <ChunkGate state={spatial} label="convergencia">
          {(s: SpatialRow[]) => (
            <ChunkGate state={temporal} label="convergencia temporal">
              {(t: TemporalRow[]) => (
                <ChunkGate state={effect} label="efecto del refinamiento">
                  {(e: RefinementEffect) => <ConvergencePanel spatial={s} temporal={t} effect={e} />}
                </ChunkGate>
              )}
            </ChunkGate>
          )}
        </ChunkGate>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Parámetros e hipótesis" icon="flask" actions={<Badge tone="uncertainty">MODELED</Badge>}>
          <KeyValueList
            items={[
              { k: "Hipótesis X", v: `${formatNumber(cfg.hypothesis_X_m, 1)} m` },
              { k: "σ del filtro gaussiano", v: `${formatNumber(cfg.gaussian_filter_sigma_m, 0)} m` },
              { k: "Semilla", v: cfg.seed, mono: true },
              { k: "Paso temporal / azimutal", v: `${cfg.time_step_minutes} min · ${formatNumber(cfg.azimuth_step_deg, 2)}°` },
              { k: "Alcance del rayo", v: `${formatNumber(cfg.max_ray_distance_m / 1000, 0)} km` },
              { k: "Visibilidad", v: cfg.body_visibility, mono: true },
              { k: "Aberración", v: cfg.aberration, mono: true },
              { k: "Tolerancia de empate", v: formatHoursMinutes(cfg.tie_tolerance_hours) },
              { k: "Observador en clones", v: cfg.observer_on_published_clone },
              { k: "Observador en variantes propias", v: cfg.observer_on_synthetic_variant },
            ]}
          />
        </Panel>
        <RmsPanel core={core} />
        <Panel title="Naturaleza de los datos" icon="info">
          <ul className="flex flex-col gap-2.5 text-sm text-ink-muted">
            <li className="flex gap-2"><NatureBadge nature="OBSERVED" /> DEM, capas de calidad, clones y kernels publicados por NASA.</li>
            <li className="flex gap-2"><NatureBadge nature="DERIVED" /> Horizontes, direcciones, estados, métricas y comparaciones calculados por el equipo.</li>
            <li className="flex gap-2"><NatureBadge nature="MODELED" /> Cuatro hipótesis propias del terreno (X, σ, semilla).</li>
            <li className="flex gap-2"><NatureBadge nature="SIMULATED" /> Observador a 2 y 10 m; ventanas de desarrollo W1/W2.</li>
          </ul>
          <p className="mt-3 text-xs text-ink-faint">
            Pasaporte: {Object.entries(p.nature).map(([k, v]) => `${k}=${v}`).join(" · ")}. Los resultados son cálculos del equipo QuemandoTokens con datos NASA; no son productos NASA.
          </p>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel title="Referencias" icon="book">
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
        <Panel title="Límites declarados" icon="alert" footer="Texto original del pasaporte (inglés). No se reinterpreta.">
          <ul className="flex flex-col gap-2 text-sm text-ink-muted">
            {p.limitations.map((l) => (
              <li key={l} className="flex gap-2">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-warn" />
                <span lang="en">{l}</span>
              </li>
            ))}
          </ul>
          <Callout tone="warn" icon="alert">
            Sin modelos de energía, enlace de radio, temperatura, radiación ni seguridad de alunizaje. Las frecuencias de variantes no son probabilidades.
          </Callout>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title="Integridad y ejecución" icon="hash">
          <KeyValueList
            items={[
              { k: "Esquema", v: core.schema_version, mono: true },
              { k: "Paquete (SHA-256)", v: shortHash(manifest.source.sha256, 24), mono: true },
              { k: "Tamaño", v: formatBytes(manifest.source.bytes) },
              { k: "Originales verificados", v: `${manifest.source.verified_files}` },
              { k: "Motor (SHA-256)", v: shortHash(p.engine_sha256, 24), mono: true },
              { k: "Generado (UTC)", v: p.generated_at_utc.slice(0, 19).replace("T", " "), mono: true },
              { k: "Python", v: p.python.split(" ")[0], mono: true },
              ...Object.entries(p.software).map(([k, v]) => ({ k, v, mono: true })),
            ]}
          />
          <h3 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Archivos cargados en esta sesión</h3>
          <LoadedChunks />
        </Panel>
        <Downloads manifest={manifest} />
      </div>

      <Callout tone="neutral" title="Declaración conservada">
        {String(cfg.user_start_authorization)} — declaración del usuario registrada en la configuración, no un documento de la organización.
      </Callout>
    </>
  );
}

export function EvidenceView() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="Evidencia científica" title="Scientific Evidence" subtitle="Fuentes, método, validaciones, límites y descargas reproducibles" />
      <DataGate>{({ core, manifest, integrity }) => <EvidenceBody core={core} manifest={manifest} integrity={integrity} />}</DataGate>
    </div>
  );
}
