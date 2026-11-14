"use client";

import { useEffect, useState } from "react";
import { BASE_PATH, loadedChunkStatuses, type IntegrityStatus } from "@/lib/data/loader";
import { dataUrl } from "@/lib/data/manifest";
import { formatBytes, formatNumber, shortHash } from "@/lib/format";
import { DataGate } from "../data/DataGate";
import { Badge, Callout, KeyValueList, StatTile } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { PageHeader, Panel } from "../ui/Panel";

function LoadedChunks() {
  const [rows, setRows] = useState<Array<{ path: string; integrity: IntegrityStatus }>>([]);
  useEffect(() => {
    loadedChunkStatuses().then(setRows);
  }, []);
  if (!rows.length) return null;
  return (
    <ul className="flex flex-col gap-1 font-mono text-xs">
      {rows.map((r) => (
        <li key={r.path} className="flex items-center justify-between gap-3">
          <span className="truncate text-ink-muted">{r.path}</span>
          {r.integrity === "verified" ? <Badge tone="ok" icon="check">SHA-256 OK</Badge> : <Badge tone="warn">sin verificar</Badge>}
        </li>
      ))}
    </ul>
  );
}

export function EvidenceView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Evidencia" title="Pasaporte científico" subtitle="Fuentes, hashes, método, validación y límites de esta entrega" />
      <DataGate>
        {({ core, manifest, integrity }) => {
          const p = core.provenance;
          const cfg = core.configuration;
          return (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile icon="check" label="Comprobaciones superadas" value={p.validation.passed} detail={`${p.validation.failed} fallidas en la ejecución documentada`} />
                <StatTile icon="target" label="Filas de contraste Horizons" value={p.validation.horizons_reference_rows} detail="SPICE DE421 frente a JPL Horizons (DE441)" />
                <StatTile icon="layers" label="Fuentes registradas" value={p.source_assets.length} detail="Con URL, hash y estado de verificación" />
                <StatTile
                  icon="shield"
                  label="Integridad en este navegador"
                  value={integrity === "verified" ? "Verificada" : "No verificable"}
                  detail={integrity === "verified" ? "Cada trozo coincide con su SHA-256" : "crypto.subtle requiere https o localhost"}
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel title="Integridad del paquete" icon="hash">
                  <div className="flex flex-col gap-4">
                    <KeyValueList
                      items={[
                        { k: "Esquema", v: core.schema_version, mono: true },
                        { k: "Archivo original", v: manifest.source.transfer_path, mono: true },
                        { k: "SHA-256", v: manifest.source.sha256, mono: true },
                        { k: "Tamaño", v: formatBytes(manifest.source.bytes) },
                        { k: "Originales verificados", v: `${manifest.source.verified_files} contra ${manifest.source.hash_list}` },
                        { k: "Trozos de carga diferida", v: `${Object.keys(manifest.chunks).length} (reensamblado idéntico comprobado)` },
                      ]}
                    />
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Cargado en esta sesión</p>
                      <LoadedChunks />
                    </div>
                  </div>
                </Panel>

                <Panel title="Motor y entorno" icon="engineer">
                  <KeyValueList
                    items={[
                      { k: "Generado (UTC)", v: p.generated_at_utc, mono: true },
                      { k: "SHA-256 del motor", v: p.engine_sha256, mono: true },
                      { k: "Python", v: p.python.split(" ")[0], mono: true },
                      ...Object.entries(p.software).map(([k, v]) => ({ k, v, mono: true })),
                      { k: "Marco", v: p.kernel_validation.frame, mono: true },
                      ...p.kernel_validation.kernels.map((kr) => ({ k: kr.name, v: shortHash(kr.sha256, 16), mono: true })),
                    ]}
                  />
                </Panel>

                <Panel title="Parámetros modelados" icon="flask" actions={<Badge tone="uncertainty">MODELED</Badge>}>
                  <KeyValueList
                    items={[
                      { k: "Hipótesis X", v: `${formatNumber(cfg.hypothesis_X_m, 1)} m` },
                      { k: "σ del filtro gaussiano", v: `${formatNumber(cfg.gaussian_filter_sigma_m, 0)} m` },
                      { k: "Semilla", v: cfg.seed, mono: true },
                      { k: "Observador en clones", v: cfg.observer_on_published_clone },
                      { k: "Observador en variantes propias", v: cfg.observer_on_synthetic_variant },
                      { k: "Alcance máximo del rayo", v: `${formatNumber(cfg.max_ray_distance_m / 1000, 0)} km` },
                      { k: "Cota de terreno lejano", v: cfg.far_bound_note },
                    ]}
                  />
                </Panel>

                <Panel title="Naturaleza de los datos" icon="info">
                  <KeyValueList items={Object.entries(p.nature).map(([k, v]) => ({ k, v, mono: true }))} />
                  <p className="mt-4 text-sm text-ink-muted">
                    Recurso NASA de la pestaña Resources utilizado: <strong className="text-ink">{p.listed_NASA_resource_effectively_used.name}</strong> —{" "}
                    {p.listed_NASA_resource_effectively_used.role} (evidencia: <code className="font-mono text-xs">{p.listed_NASA_resource_effectively_used.evidence}</code>).
                  </p>
                </Panel>
              </div>

              <Panel title="Límites declarados por el motor" icon="alert" footer="Texto original del pasaporte (inglés), sin reinterpretar.">
                <ul className="grid gap-2 text-sm text-ink-muted md:grid-cols-2">
                  {p.limitations.map((l) => (
                    <li key={l} className="flex gap-2">
                      <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-warn" />
                      <span lang="en">{l}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Fuentes" icon="layers" bodyClassName="p-0 sm:p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <caption className="sr-only">Activos de origen registrados en el pasaporte</caption>
                    <thead className="text-xs uppercase tracking-wide text-ink-faint">
                      <tr className="border-b border-line">
                        <th scope="col" className="px-5 py-2.5 font-semibold">ID</th>
                        <th scope="col" className="px-3 py-2.5 font-semibold">Uso</th>
                        <th scope="col" className="px-3 py-2.5 font-semibold">Verificación</th>
                        <th scope="col" className="px-5 py-2.5 font-semibold">SHA-256</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.source_assets.map((a) => (
                        <tr key={a.id} className="border-b border-line/60 align-top last:border-b-0">
                          <td className="px-5 py-2.5 font-mono text-xs text-ink">
                            {a.url ? (
                              <a href={a.url} className="hover:text-accent hover:underline" rel="noreferrer" target="_blank">
                                {a.id}
                              </a>
                            ) : (
                              a.id
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-ink-muted">{a.purpose ?? "—"}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-ink-muted">{a.verification_status ?? "—"}</td>
                          <td className="px-5 py-2.5 font-mono text-xs text-ink-faint" title={a.sha256 ?? undefined}>
                            {a.sha256 ? shortHash(a.sha256, 16) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Descargas originales (sin modificar)" icon="download">
                <ul className="grid gap-2 md:grid-cols-2">
                  {manifest.originals.map((o) => (
                    <li key={o.path}>
                      <a
                        href={dataUrl(BASE_PATH, o.path)}
                        download
                        className="flex items-start gap-3 rounded-xl border border-line bg-bg-2 p-3 hover:border-line-strong hover:bg-surface-2"
                      >
                        <Icon name="download" className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                        <span className="min-w-0">
                          <span className="block text-sm text-ink">{o.description}</span>
                          <span className="block truncate font-mono text-[11px] text-ink-faint">
                            {o.transfer_path} · {formatBytes(o.bytes)} · {shortHash(o.sha256, 12)}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Callout tone="neutral" title="Declaración conservada">
                <span className="text-ink-muted">{cfg.user_start_authorization as string}</span> — declaración del usuario registrada en la configuración,
                no un documento de la organización.
              </Callout>
            </>
          );
        }}
      </DataGate>
    </div>
  );
}
