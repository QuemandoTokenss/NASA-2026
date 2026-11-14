"use client";

import type { Core } from "@/lib/contract/schema";
import { useChunk } from "@/lib/data/DataProvider";
import { ENGINEER_HEIGHTS_DIR, loadEngineerHeightsManifest, type EngineerHeightsManifest } from "@/lib/data/engineerHeights";
import { BASE_PATH } from "@/lib/data/loader";
import { dataUrl } from "@/lib/data/manifest";
import { formatNumber, shortHash } from "@/lib/format";
import { L } from "@/lib/i18n";
import { useSelection } from "@/lib/state/SelectionProvider";
import { ChunkGate } from "../data/DataGate";
import { Badge, KeyValueList } from "../ui/Display";
import { Panel } from "../ui/Panel";

/**
 * Procedencia del paquete ADICIONAL de alturas de Engineer (0–30 m cada 0,5 m, terreno nominal).
 * Todo se lee de su manifiesto; la única comprobación hecha aquí es que el SHA-256 del motor que
 * declara es el mismo que el del paquete site-regret/0.1 (mismo motor, sin modificar).
 */
export function HeightsEvidence({ core }: { core: Core }) {
  const { restored } = useSelection();
  // El manifiesto es la raíz de confianza del paquete adicional: no tiene un hash propio contra el que compararlo.
  const state = useChunk<EngineerHeightsManifest>(
    restored ? async () => ({ value: await loadEngineerHeightsManifest(), path: `${ENGINEER_HEIGHTS_DIR}/manifest.json`, integrity: "unverifiable", sha256: "", bytes: 0 }) : null,
    ["engineer-heights-manifest"],
  );
  return (
    <section id="alturas-engineer" className="scroll-mt-24" data-testid="heights-evidence">
      <Panel
        title={L("Paquete adicional · alturas de Engineer (0–30 m)", "Additional package · Engineer heights (0–30 m)")}
        icon="engineer"
        actions={<Badge tone="neutral">{L("Solo terreno nominal", "Nominal terrain only")}</Badge>}
        footer={L(
          "No sustituye ni amplía el contrato site-regret/0.1 (120 escenarios, alturas 0/2/10 m), que sigue siendo la fuente de las demás vistas. La altura es un observador geométrico elevado (SIMULATED): no hay modelo de estructura y no se recomienda ninguna altura.",
          "It neither replaces nor extends the site-regret/0.1 contract (120 scenarios, heights 0/2/10 m), which remains the source for the other views. Height is a raised geometric observer (SIMULATED): there is no structural model and no height is recommended.",
        )}
      >
        <ChunkGate state={state} label={L("manifiesto de alturas", "heights manifest")}>
          {(m: EngineerHeightsManifest) => {
            const sameEngine = m.method.engine_sha256 === core.provenance.engine_sha256;
            const v = m.validation;
            return (
              <div className="grid gap-5 lg:grid-cols-2">
                <KeyValueList
                  items={[
                    { k: L("Esquema", "Schema"), v: `${m.schema} · v${m.package_version}`, mono: true },
                    { k: L("Escenarios", "Scenarios"), v: L(`${m.scenario_count} = ${m.heights.positions.length} alturas × 2 sitios × 2 ventanas`, `${m.scenario_count} = ${m.heights.positions.length} heights × 2 sites × 2 windows`) },
                    { k: L("Alturas", "Heights"), v: L("0 a 30 m cada 0,5 m, todas calculadas (ninguna interpolada)", "0 to 30 m every 0.5 m, all computed (none interpolated)") },
                    { k: L("Generado (UTC)", "Generated (UTC)"), v: m.generated_at_utc.slice(0, 19).replace("T", " "), mono: true },
                    { k: L("Archivos con SHA-256", "Files with SHA-256"), v: formatNumber(Object.keys(m.files).length, 0) },
                    { k: L("Generador", "Generator"), v: m.method.generator, mono: true },
                    { k: L("Generador (SHA-256)", "Generator (SHA-256)"), v: shortHash(m.method.generator_sha256, 24), mono: true },
                  ]}
                />
                <div className="flex flex-col gap-3 text-sm text-ink-muted">
                  <p data-testid="heights-engine-match" data-match={sameEngine ? "true" : "false"}>
                    <Badge tone={sameEngine ? "ok" : "warn"}>{sameEngine ? L("Mismo motor", "Same engine") : L("Motor distinto", "Different engine")}</Badge>{" "}
                    {sameEngine
                      ? L(
                          `El SHA-256 del motor que declara este paquete (${shortHash(m.method.engine_sha256, 12)}) es el mismo que el del paquete site-regret/0.1.`,
                          `The engine SHA-256 declared by this package (${shortHash(m.method.engine_sha256, 12)}) is the same as that of the site-regret/0.1 package.`,
                        )
                      : L("El SHA-256 del motor declarado NO coincide con el del paquete site-regret/0.1.", "The declared engine SHA-256 does NOT match that of the site-regret/0.1 package.")}
                  </p>
                  {v ? (
                    <p data-testid="heights-validation">
                      {L(
                        `Al generarlo: ${v.contrast_passed} de ${v.contrast_passed + v.contrast_failed} contrastes con site-regret/0.1 en 0, 2 y 10 m sin diferencias (horizonte, direcciones, estados, intervalos y métricas) y ${v.passed} de ${v.passed + v.failed} comprobaciones internas superadas (el horizonte no sube al elevar el observador; horas acotadas por la ventana).`,
                        `When generated: ${v.contrast_passed} of ${v.contrast_passed + v.contrast_failed} cross-checks against site-regret/0.1 at 0, 2 and 10 m with no differences (horizon, directions, states, intervals and metrics) and ${v.passed} of ${v.passed + v.failed} internal checks passed (the horizon does not rise when the observer is raised; hours bounded by the window).`,
                      )}
                    </p>
                  ) : null}
                  {m.method.differences_from_engine?.length ? (
                    <p>
                      <span className="font-semibold text-ink">{L("Diferencias respecto al motor original (texto del manifiesto): ", "Differences from the original engine (manifest text, Spanish): ")}</span>
                      {m.method.differences_from_engine.join(" · ")}
                    </p>
                  ) : null}
                  <p className="text-xs text-ink-faint">
                    {L(
                      "Con superficies alternativas (hipótesis propias y clones publicados) no existe un cálculo equivalente: allí Engineer solo ofrece 0, 2 y 10 m y cualquier otra altura es una vista previa sin cálculo.",
                      "For alternative surfaces (team hypotheses and published clones) there is no equivalent computation: there Engineer only offers 0, 2 and 10 m, and any other height is a preview without computation.",
                    )}
                  </p>
                  <a href={dataUrl(BASE_PATH, ENGINEER_HEIGHTS_DIR, "manifest.json")} className="w-fit text-accent underline underline-offset-2" download>
                    {L("Descargar el manifiesto (hashes, método, activos de origen)", "Download the manifest (hashes, method, source assets)")}
                  </a>
                </div>
              </div>
            );
          }}
        </ChunkGate>
      </Panel>
    </section>
  );
}
