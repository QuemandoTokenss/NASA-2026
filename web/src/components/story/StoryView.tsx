"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { VARIANTS, variantFamily, type SiteId, type Variant } from "@/lib/contract/constants";
import type { Core, EphemerisClockChunk, EphemerisSiteChunk, HorizonChunk, ScenarioChunk } from "@/lib/contract/schema";
import { useChunk } from "@/lib/data/DataProvider";
import { loadEphemerisClock, loadEphemerisSite, loadHorizonChunk, loadScenarioChunk } from "@/lib/data/loader";
import { getCriterionResult, getScenarioSeries, getScenarioSummary, getSite } from "@/lib/data/selectors";
import { formatDeg, formatHoursMinutes, formatNumber, shortHash } from "@/lib/format";
import { CRITERION_META, FAMILY_META, SITE_META, VARIANT_LABEL } from "@/lib/labels";
import { familyCounts, otherSite, outcomeOf, regretOfKeeping } from "@/lib/science/decision";
import { DEMO_CASE, relevantPerturbation } from "@/lib/science/demo";
import { CRITERION_METRIC } from "@/lib/science/metrics";
import { HorizonChart, type HorizonSeries } from "../charts/HorizonChart";
import { ChunkGate, DataGate, type ReadyData } from "../data/DataGate";
import { Badge, Legend } from "../ui/Display";
import { Icon, type IconName } from "../ui/Icon";
import { Button, LinkButton } from "../ui/Interactive";
import { DarkStreakStrips } from "./DarkStreakStrips";
import { LandingDemo } from "./LandingDemo";
import { GeoMap } from "../maps/GeoMap";
import { TERRAIN_MANIFEST } from "@/lib/geospatial/terrain";
import { L, R } from "@/lib/i18n";
import { METRIC_META } from "@/lib/science/metrics";

interface Scene {
  id: string;
  eyebrow: string;
  title: ReactNode;
  body: ReactNode;
  visual: ReactNode;
}

const hm = formatHoursMinutes;

function Big({ children, site }: { children: ReactNode; site?: SiteId | "regret" }) {
  const cls = site === "regret" ? "text-uncertainty" : site ? SITE_META[site].textClass : "text-ink";
  return <strong className={`tabular font-bold ${cls}`}>{children}</strong>;
}

function Fact({ value, label, tone }: { value: ReactNode; label: string; tone?: SiteId | "regret" }) {
  const cls = tone === "regret" ? "text-uncertainty" : tone ? SITE_META[tone].textClass : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-bg-2/70 px-4 py-3">
      <p className={`tabular text-2xl font-bold sm:text-3xl ${cls}`}>{value}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
    </div>
  );
}

function VisualFrame({ children, caption }: { children: ReactNode; caption?: ReactNode }) {
  return (
    <figure className="flex w-full flex-col gap-2 rounded-2xl border border-line bg-surface/80 p-4 shadow-[0_30px_80px_-40px_#3a6ff0]">
      {children}
      {caption ? <figcaption className="text-[11px] leading-relaxed text-ink-faint">{caption}</figcaption> : null}
    </figure>
  );
}

const maxOf = (v: number[], skip?: boolean[]) => v.reduce((m, x, i) => (skip?.[i] ? m : Math.max(m, x)), -Infinity);
const minOf = (v: number[]) => v.reduce((m, x) => Math.min(m, x), Infinity);

function useStoryData(core: Core) {
  const { windowId, heightM } = DEMO_CASE;
  return {
    scen: useChunk(() => loadScenarioChunk(core, windowId, heightM), [windowId, heightM]),
    clock: useChunk(() => loadEphemerisClock(core, windowId), [windowId]),
    hzA: useChunk(() => loadHorizonChunk("A", heightM), ["A", heightM]),
    hzB: useChunk(() => loadHorizonChunk("B", heightM), ["B", heightM]),
    ephA: useChunk(() => loadEphemerisSite(windowId, "A", heightM), [windowId, "A", heightM]),
  };
}

function horizonSeries(chunk: HorizonChunk, v: Variant, key: string, label: string, color: string, emphasis = false): HorizonSeries {
  const p = chunk.variants[v];
  return { key, label, color, azimuthDeg: chunk.azimuth_deg, elevationDeg: p.elevation_deg, unknown: p.unknown, emphasis };
}

function Story({ data }: { data: ReadyData }) {
  const { core, manifest } = data;
  const { windowId, heightM, criterion } = DEMO_CASE;
  const result = getCriterionResult(core, windowId, heightM, criterion)!;
  const metric = CRITERION_METRIC[criterion];
  const nominal = result.nominal_winner;
  const keep: SiteId = nominal === "A" || nominal === "B" ? nominal : "B";
  const rival = otherSite(keep);
  const pert = relevantPerturbation(result, keep) ?? "correlated_plus";
  const pertCase = result.cases[pert];
  const pertWinner = pertCase.winner;
  const regret = regretOfKeeping(pertCase, keep);
  const own = familyCounts(result, "own");
  const pub = familyCounts(result, "published");
  const val = (site: SiteId, v: Variant) => getScenarioSummary(core, { siteId: site, windowId, heightM, variant: v })?.metrics[metric] ?? null;
  const siteA = getSite(core, "A")!;
  const siteB = getSite(core, "B")!;
  const separation = Math.hypot(siteA.x_m - siteB.x_m, siteA.y_m - siteB.y_m);
  const win = core.configuration.windows.find((w) => w.id === windowId)!;
  const d = useStoryData(core);
  const v = core.provenance.validation;
  const labQuery = `?s=${keep}&w=${windowId}&h=${heightM}&v=${pert}&c=${criterion}`;

  const scenes: Scene[] = [
    {
      id: "pregunta",
      eyebrow: L("La pregunta", "The question"),
      title: (
        <>
          {L("Dos puntos del polo sur lunar.", "Two points at the lunar south pole.")}{" "}
          <span className="bg-gradient-to-r from-site-a to-site-b bg-clip-text text-transparent">{L("¿Cuál es mejor?", "Which one is better?")}</span>
        </>
      ),
      body: (
        <>
          <p>
            {R(
              "{a} y {b} están en Connecting Ridge, a solo {d} uno del otro en el plano del mapa. Allí el Sol roza el horizonte: unos metros de relieve deciden si un punto lo ve o no.",
              "{a} and {b} sit on Connecting Ridge, only {d} apart on the map plane. There the Sun grazes the horizon: a few metres of relief decide whether a point sees it or not.",
              { a: <Big site="A">{SITE_META.A.label}</Big>, b: <Big site="B">{SITE_META.B.label}</Big>, d: <Big>{formatNumber(separation, 0)} m</Big> },
            )}
          </p>
          <p>
            {R(
              "SITE REGRET no se queda en «cuál gana»: comprueba si la elección {s} con el que se calculó.",
              "SITE REGRET does not stop at “which one wins”: it checks whether the choice {s} it was computed with.",
              { s: <strong className="text-ink">{L("sobrevive cuando cambia el terreno", "survives when you change the terrain")}</strong> },
            )}
          </p>
        </>
      ),
      visual: (
        <VisualFrame caption={L("Imágenes orbitales reales LRO NAC (NASA Moon Trek) en la proyección polar lunar, con A, B y la línea entre ambos. Es el mismo mapa de Explore, el Comparador y el Dashboard; sin red no se sustituye por otra imagen.", "Real LRO NAC orbital images (NASA Moon Trek) in the lunar polar projection, with A, B and the line between them. It is the same map as in Explore, Compare and the Dashboard; offline it is not replaced by another image.")}>
          <GeoMap sites={[siteA, siteB]} focusSite="A" compact overlay={{ line: [{ x: siteA.x_m, y: siteA.y_m }, { x: siteB.x_m, y: siteB.y_m }] }} />
        </VisualFrame>
      ),
    },
    {
      id: "horizonte",
      eyebrow: L("Por qué importa el relieve", "Why the relief matters"),
      title: L("El Sol vive pegado al horizonte", "The Sun lives on the horizon"),
      body: (
        <ChunkGate state={d.ephA} label={L("efemérides", "ephemerides")} minHeight="min-h-20">
          {(eph: EphemerisSiteChunk) => {
            const el = eph.series.bodies.SUN.elevation_deg;
            return (
              <ChunkGate state={d.hzA} label={L("horizonte", "horizon")} minHeight="min-h-20">
                {(hz: HorizonChunk) => (
                  <>
                    <p>
                      {R(
                        "En la ventana {w} el centro del Sol, visto desde el Sitio A, se mueve solo entre {min} y {max} de elevación.",
                        "In window {w} the centre of the Sun, seen from Site A, only moves between {min} and {max} of elevation.",
                        { w: windowId, min: <Big>{formatDeg(minOf(el))}</Big>, max: <Big>{formatDeg(maxOf(el))}</Big> },
                      )}
                    </p>
                    <p>
                      {R(
                        "El relieve que lo rodea llega a {h}. Cualquier error de pocos metros en el modelo del terreno puede tapar o destapar el Sol durante horas.",
                        "The surrounding relief reaches {h}. An error of a few metres in the terrain model can hide or reveal the Sun for hours.",
                        { h: <Big>{formatDeg(maxOf(hz.variants.nominal.elevation_deg, hz.variants.nominal.unknown))}</Big> },
                      )}
                    </p>
                  </>
                )}
              </ChunkGate>
            );
          }}
        </ChunkGate>
      ),
      visual: (
        <ChunkGate state={d.hzA} label={L("horizonte A", "horizon A")} minHeight="min-h-64">
          {(hzA: HorizonChunk) => (
            <ChunkGate state={d.ephA} label={L("efemérides", "ephemerides")} minHeight="min-h-64">
              {(eph: EphemerisSiteChunk) => (
                <VisualFrame caption={L(`Horizonte nominal del Sitio A a ${heightM} m (1440 azimuts) y trayectoria del centro del Sol en ${windowId} (efemérides nominales SPICE DE421). Escala vertical exagerada.`, `Nominal horizon of Site A at ${heightM} m (1440 azimuths) and path of the Sun centre in ${windowId} (nominal SPICE DE421 ephemerides). Vertical scale exaggerated.`)}>
                  <HorizonChart
                    title={L(`Horizonte del Sitio A y trayectoria del Sol en ${windowId}`, `Site A horizon and Sun path in ${windowId}`)}
                    series={[horizonSeries(hzA, "nominal", "A", L("Horizonte · A", "Horizon · A"), SITE_META.A.colorVar, true)]}
                    tracks={[{ key: "sun", label: L("Sol", "Sun"), color: "var(--color-state-sun)", azimuthDeg: eph.series.bodies.SUN.azimuth_deg, elevationDeg: eph.series.bodies.SUN.elevation_deg }]}
                  />
                  <Legend
                    items={[
                      { label: L("Horizonte del Sitio A", "Site A horizon"), color: SITE_META.A.colorVar, shape: "line" },
                      { label: L(`Centro del Sol en ${windowId}`, `Sun centre in ${windowId}`), color: "var(--color-state-sun)", shape: "line" },
                    ]}
                  />
                </VisualFrame>
              )}
            </ChunkGate>
          )}
        </ChunkGate>
      ),
    },
    {
      id: "criterio",
      eyebrow: L("01 · Elegir antes de mirar", "01 · Choose before looking"),
      title: (
        <>
          {L("Criterio:", "Criterion:")} <span className="text-accent">{CRITERION_META[criterion].label.charAt(0).toLowerCase() + CRITERION_META[criterion].label.slice(1)}</span>
        </>
      ),
      body: (
        <>
          <p>
            {R(
              "Un vehículo sin Sol no carga. Fijamos el criterio {before} de ver el ganador: la racha continua más larga sin Sol en {w} ({d}), a {h} m de altura.",
              "A rover without Sun cannot charge. We fix the criterion {before} seeing the winner: the longest continuous stretch without Sun in {w} ({d}), at {h} m height.",
              { before: <em>{L("antes", "before")}</em>, w: windowId, d: hm((Date.parse(win.stop) - Date.parse(win.start)) / 3_600_000), h: heightM },
            )}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Fact value={hm(val("A", "nominal"))} label={`${SITE_META.A.label} · ${METRIC_META.longest_dark_hours.label}`} tone="A" />
            <Fact value={hm(val("B", "nominal"))} label={`${SITE_META.B.label} · ${METRIC_META.longest_dark_hours.label}`} tone="B" />
          </div>
          <p>
            {R("Con el terreno nominal (DEM LOLA) gana {w}{by}.", "With the nominal terrain (LOLA DEM) {w} wins{by}.", {
              w: <Big site={keep}>{SITE_META[keep].label}</Big>,
              by:
                result.cases.nominal.D_hours !== null ? (
                  <>
                    {" "}
                    {L("por", "by")} <Big>{hm(Math.abs(result.cases.nominal.D_hours))}</Big>
                  </>
                ) : null,
            })}
          </p>
        </>
      ),
      visual: (
        <StreakVisual d={d} variant="nominal" caption={L("Amarillo: Sol visible · gris: sin Sol. Tramos originales del paquete, sin interpolar; el recuadro marca la racha más larga sin Sol.", "Yellow: Sun visible · grey: no Sun. Original package runs, not interpolated; the box marks the longest stretch without Sun.")} />
      ),
    },
    {
      id: "terreno",
      eyebrow: L("02 · Desafiar el terreno", "02 · Challenge the terrain"),
      title: L("¿Y si el relieve fuera un poco distinto?", "What if the relief were slightly different?"),
      body: (
        <>
          <p>
            {R(
              "El paquete trae, además del nominal, {own} hipótesis propias y {pub} clones publicados del DEM. Probamos {p}{fam}.",
              "Besides the nominal, the package carries {own} team hypotheses and {pub} published DEM clones. We try {p}{fam}.",
              {
                own: <Big>{own.evaluated}</Big>,
                pub: <Big>{pub.evaluated}</Big>,
                p: <strong className="text-uncertainty">{VARIANT_LABEL[pert]}</strong>,
                fam: variantFamily(pert) === "own" ? L(`, una de las ${FAMILY_META.own.label.toLowerCase()}`, `, one of the ${FAMILY_META.own.label.toLowerCase()}`) : "",
              },
            )}
          </p>
          <p>
            {R(
              "Los clones son DEM completos publicados por la NASA: frente al nominal difieren {rms} de media cuadrática en la ventana de 4 × 4 km. En {lab} se ve dónde, en un mapa de diferencias, y qué punto del terreno fija el horizonte con cada superficie.",
              "The clones are complete DEMs published by NASA: against the nominal they differ by {rms} RMS over the 4 × 4 km window. {lab} shows where, on a difference map, and which terrain point sets the horizon with each surface.",
              {
                rms: <Big>{`${formatNumber(Math.min(...(TERRAIN_MANIFEST.ensemble?.members ?? []).map((m) => m.difference_vs_nominal.rms)), 2)}–${formatNumber(Math.max(...(TERRAIN_MANIFEST.ensemble?.members ?? []).map((m) => m.difference_vs_nominal.rms)), 2)} m`}</Big>,
                lab: <Link href="/regret-lab/#terreno-variante" className="text-accent underline-offset-2 hover:underline">Regret Lab</Link>,
              },
            )}
          </p>
          <ChunkGate state={keep === "A" ? d.hzA : d.hzB} label={L("horizonte", "horizon")} minHeight="min-h-10">
            {(hz: HorizonChunk) => {
              const a = hz.variants.nominal;
              const b = hz.variants[pert];
              let max = 0;
              a.elevation_deg.forEach((e, i) => {
                if (!a.unknown[i] && !b.unknown[i]) max = Math.max(max, Math.abs(b.elevation_deg[i] - e));
              });
              return (
                <p>
                  {R(
                    "En el {s} el horizonte cambia como mucho {d}. Parece nada… pero el Sol vive en esa franja.",
                    "At {s} the horizon changes by at most {d}. It looks like nothing… but the Sun lives in that band.",
                    { s: SITE_META[keep].label, d: <Big site="regret">{formatDeg(max, 3)}</Big> },
                  )}
                </p>
              );
            }}
          </ChunkGate>
          <p className="text-sm text-ink-muted">{variantFamily(pert) === "own" ? FAMILY_META.own.description : FAMILY_META.published.description}</p>
        </>
      ),
      visual: (
        <ChunkGate state={keep === "A" ? d.hzA : d.hzB} label={L("horizontes", "horizons")} minHeight="min-h-64">
          {(hz: HorizonChunk) => (
            <VisualFrame caption={L(`Horizonte del ${SITE_META[keep].label} a ${heightM} m: superficie nominal frente a «${VARIANT_LABEL[pert]}». Mismos azimuts; sin suavizar.`, `${SITE_META[keep].label} horizon at ${heightM} m: nominal surface vs “${VARIANT_LABEL[pert]}”. Same azimuths; no smoothing.`)}>
              <HorizonChart
                title={L(`Horizonte del ${SITE_META[keep].label}: nominal y ${VARIANT_LABEL[pert]}`, `${SITE_META[keep].label} horizon: nominal and ${VARIANT_LABEL[pert]}`)}
                series={[
                  horizonSeries(hz, "nominal", "nom", `${SITE_META[keep].short} · nominal`, SITE_META[keep].colorVar),
                  horizonSeries(hz, pert, "pert", `${SITE_META[keep].short} · ${VARIANT_LABEL[pert]}`, "var(--color-uncertainty)", true),
                ]}
              />
              <Legend
                items={[
                  { label: `${SITE_META[keep].label} · ${VARIANT_LABEL.nominal}`, color: SITE_META[keep].colorVar, shape: "line" },
                  { label: `${SITE_META[keep].label} · ${VARIANT_LABEL[pert]}`, color: "var(--color-uncertainty)", shape: "line" },
                ]}
              />
            </VisualFrame>
          )}
        </ChunkGate>
      ),
    },
    {
      id: "inversion",
      eyebrow: L("03 · El coste de equivocarse", "03 · The cost of being wrong"),
      title: (
        <>
          {pertWinner === keep
            ? L("La elección se mantiene", "The choice holds")
            : pertWinner === "TIE"
              ? L("La elección empata", "The choice ties")
              : L("La elección se invierte", "The choice flips")}
        </>
      ),
      body: (
        <>
          <p>{L(`Con «${VARIANT_LABEL[pert]}» las rachas cambian:`, `With “${VARIANT_LABEL[pert]}” the streaks change:`)}</p>
          <div className="grid grid-cols-2 gap-3">
            <Fact value={hm(val("A", pert))} label={SITE_META.A.label} tone="A" />
            <Fact value={hm(val("B", pert))} label={SITE_META.B.label} tone="B" />
          </div>
          {pertWinner === rival ? (
            <p>
              {R(
                "Ahora gana {r}. Si hubiéramos aterrizado en el {k}, el {regret} —lo que se pierde frente a la mejor opción— sería {v} más de oscuridad continua.",
                "Now {r} wins. Had we landed at {k}, the {regret} — what is lost against the best option — would be {v} more of continuous darkness.",
                {
                  r: <Big site={rival}>{SITE_META[rival].label}</Big>,
                  k: SITE_META[keep].label,
                  regret: <strong className="text-uncertainty">REGRET</strong>,
                  v: <Big site="regret">{hm(regret)}</Big>,
                },
              )}
            </p>
          ) : (
            <p>
              {R("REGRET de conservar el {k}: {v}.", "REGRET of keeping {k}: {v}.", { k: SITE_META[keep].label, v: <Big site="regret">{hm(regret)}</Big> })}
            </p>
          )}
        </>
      ),
      visual: <StreakVisual d={d} variant={pert} caption={L(`Superficie «${VARIANT_LABEL[pert]}». Mismas efemérides; cambia solo el relieve.`, `Surface “${VARIANT_LABEL[pert]}”. Same ephemerides; only the relief changes.`)} />,
    },
    {
      id: "robustez",
      eyebrow: L("04 · ¿Cuántas veces aguanta?", "04 · How often does it hold?"),
      title: L("Robustez: recuentos, no probabilidades", "Robustness: counts, not probabilities"),
      body: (
        <>
          <p>
            {R(
              "La elección nominal ({k}) se mantiene en {own} hipótesis propias y en {pub} clones publicados. Empates: {t1} y {t2}; inversiones: {i1} y {i2}.",
              "The nominal choice ({k}) holds in {own} team hypotheses and in {pub} published clones. Ties: {t1} and {t2}; flips: {i1} and {i2}.",
              {
                k: SITE_META[keep].label,
                own: <Big>{`${own.same}/${own.evaluated}`}</Big>,
                pub: <Big>{`${pub.same}/${pub.evaluated}`}</Big>,
                t1: own.tie,
                t2: pub.tie,
                i1: own.inverted,
                i2: pub.inverted,
              },
            )}
          </p>
          <p className="text-sm text-ink-muted">
            {L(
              `Son ${own.evaluated + pub.evaluated} superficies concretas, no un muestreo: no se pueden leer como «probabilidad de acertar». Un solo contraejemplo ya indica sensibilidad al relieve.`,
              `These are ${own.evaluated + pub.evaluated} specific surfaces, not a sample: they cannot be read as a “probability of being right”. A single counter-example already shows sensitivity to the relief.`,
            )}
          </p>
        </>
      ),
      visual: (
        <VisualFrame caption={L("Ganador con cada superficie del paquete para este criterio. El recuadro violeta marca las que invierten la elección nominal.", "Winner with each package surface for this criterion. The violet outline marks those that flip the nominal choice.")}>
          <SurfaceGrid result={result} keep={keep} />
        </VisualFrame>
      ),
    },
    {
      id: "evidencia",
      eyebrow: L("05 · Verificable", "05 · Verifiable"),
      title: L("Cada número es trazable", "Every number is traceable"),
      body: (
        <>
          <p>
            {L(
              "Nada se recalcula ni se inventa en el navegador: la web lee un paquete precalculado con datos NASA (PGDA, LRO-LOLA, JPL/NAIF DE421) y comprueba su SHA-256 antes de mostrarlo.",
              "Nothing is recomputed or made up in the browser: the site reads a package precomputed from NASA data (PGDA, LRO-LOLA, JPL/NAIF DE421) and checks its SHA-256 before showing it.",
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href={`/regret-lab/${labQuery}`} variant="regret" icon="flask">
              {L("Abrir este caso en Regret Lab", "Open this case in Regret Lab")}
            </LinkButton>
            <LinkButton href={`/comparador/${labQuery}`} icon="compare">
              {L("Comparador", "Compare")}
            </LinkButton>
            <LinkButton href="/evidencia/" icon="file">
              {L("Evidencia", "Evidence")}
            </LinkButton>
          </div>
        </>
      ),
      visual: (
        <VisualFrame>
          <div className="grid grid-cols-2 gap-3">
            <Fact value={`${v.passed}/${v.passed + v.failed}`} label={L("comprobaciones superadas", "checks passed")} />
            <Fact value={v.horizons_reference_rows} label={L("contrastes con JPL Horizons", "JPL Horizons cross-checks")} />
            <Fact value={core.provenance.source_assets.length} label={L("fuentes NASA registradas", "registered NASA sources")} />
            <Fact value={core.provenance.comparison_count * 4} label={L("decisiones A/B precalculadas", "precomputed A/B decisions")} />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <Icon name="shield" className="size-4 text-ok" /> {L("Paquete", "Package")} <span className="font-mono text-ink">{core.schema_version}</span> · SHA-256{" "}
            <span className="font-mono text-ink">{shortHash(manifest.source.sha256, 16)}…</span>
            {data.integrity === "verified" ? <Badge tone="ok" icon="check">{L("verificado", "verified")}</Badge> : <Badge tone="warn">{L("sin verificar", "unverified")}</Badge>}
          </p>
          <p className="text-[11px] text-ink-faint">
            {L(
              "Visibilidad geométrica del centro del Sol y de la Tierra. No implica energía, enlace de radio, seguridad de alunizaje ni respaldo de la NASA.",
              "Geometric visibility of the Sun and Earth centres. Does not imply power, radio link, landing safety or NASA endorsement.",
            )}
          </p>
        </VisualFrame>
      ),
    },
  ];

  return <StoryModes core={core} scenes={scenes} />;
}

function StreakVisual({ d, variant, caption }: { d: ReturnType<typeof useStoryData>; variant: Variant; caption: string }) {
  return (
    <ChunkGate state={d.scen} label={L("estados", "states")} minHeight="min-h-48">
      {(s: ScenarioChunk) => (
        <ChunkGate state={d.clock} label={L("reloj", "clock")} minHeight="min-h-48">
          {(c: EphemerisClockChunk) => (
            <VisualFrame caption={caption}>
              <Legend
                items={[
                  { label: L("Sol visible", "Sun visible"), color: "var(--color-state-sun)" },
                  { label: L("Sin Sol", "No Sun"), color: "var(--color-state-neither)" },
                  { label: METRIC_META.longest_dark_hours.label, color: "var(--color-ink)", shape: "line" },
                ]}
              />
              <DarkStreakStrips
                times={c.times_utc}
                rows={(["A", "B"] as SiteId[]).map((site) => ({
                  site,
                  label: SITE_META[site].label,
                  codes: getScenarioSeries(s.rows, site, variant)!.state_codes,
                }))}
              />
            </VisualFrame>
          )}
        </ChunkGate>
      )}
    </ChunkGate>
  );
}

function SurfaceGrid({ result, keep }: { result: NonNullable<ReturnType<typeof getCriterionResult>>; keep: SiteId }) {
  const groups: Array<{ label: string; vs: Variant[] }> = [
    { label: FAMILY_META.nominal.label, vs: VARIANTS.filter((v) => variantFamily(v) === "nominal") },
    { label: FAMILY_META.own.label, vs: VARIANTS.filter((v) => variantFamily(v) === "own") },
    { label: FAMILY_META.published.label, vs: VARIANTS.filter((v) => variantFamily(v) === "published") },
  ];
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{g.label}</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {g.vs.map((v) => {
              const w = result.cases[v].winner;
              const inv = v !== "nominal" && outcomeOf(result.nominal_winner, w) === "inverted";
              const tone =
                w === "A" ? "border-site-a/60 bg-site-a-soft text-site-a" : w === "B" ? "border-site-b/60 bg-site-b-soft text-site-b" : "border-line-strong bg-surface-2 text-ink-muted";
              return (
                <li
                  key={v}
                  className={`rounded-lg border px-2.5 py-2 text-xs ${tone} ${inv ? "outline-2 outline-offset-2 outline-uncertainty" : ""}`}
                >
                  <span className="block leading-snug text-ink-muted">{VARIANT_LABEL[v]}</span>
                  <span className="text-sm font-bold">{w === "TIE" ? L("Empate", "Tie") : w === "UNKNOWN" ? "—" : L(`Gana ${w}`, `${w} wins`)}</span>
                  {inv ? <span className="block text-[10px] font-semibold text-uncertainty">{L("invierte", "flips")} · regret {hm(regretOfKeeping(result.cases[v], keep))}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * /historia/ abre la demo interactiva. La presentación de siete escenas sigue
 * disponible con «Presentación completa» y con sus enlaces directos (#pregunta,
 * #inversion…): si el hash es el de una escena, se abre el modo presentación.
 */
function StoryModes({ core, scenes }: { core: Core; scenes: Scene[] }) {
  const ids = useMemo(() => scenes.map((s) => s.id), [scenes]);
  const [deck, setDeck] = useState(false);
  useEffect(() => {
    const sync = () => setDeck(ids.includes(window.location.hash.slice(1)));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [ids]);
  const exit = useCallback(() => {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setDeck(false);
    window.scrollTo({ top: 0 });
  }, []);
  return deck ? <StoryDeck scenes={scenes} onExit={exit} /> : <LandingDemo core={core} />;
}

const sceneFromHash = (ids: string[]) => {
  if (typeof window === "undefined") return 0;
  const i = ids.indexOf(window.location.hash.slice(1));
  return i >= 0 ? i : 0;
};

function StoryDeck({ scenes, onExit }: { scenes: Scene[]; onExit: () => void }) {
  const ids = useMemo(() => scenes.map((s) => s.id), [scenes]);
  const [idx, setIdx] = useState(0);
  const [full, setFull] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const last = scenes.length - 1;

  useEffect(() => {
    const sync = () => setIdx(sceneFromHash(ids));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [ids]);

  const go = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(last, i));
      setIdx(next);
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${ids[next]}`);
      requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    },
    [ids, last],
  );

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "SELECT" || t.tagName === "INPUT" || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && t?.tagName !== "BUTTON" && t?.tagName !== "A")) {
        e.preventDefault();
        go(idx + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(idx - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(last);
      else if (e.key.toLowerCase() === "f") toggleFull();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, idx, last, toggleFull]);

  const s = scenes[idx];
  return (
    <div
      ref={rootRef}
      className={`story-root relative flex flex-col overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-[#0a1430] via-bg to-[#120c2c] ${
        full ? "h-dvh rounded-none border-0 p-6 sm:p-10" : "min-h-[calc(100dvh-9rem)] p-5 sm:p-8"
      }`}
    >
      <div aria-hidden className="story-stars pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" role="tablist" aria-label={L("Escenas", "Scenes")}>
          {scenes.map((sc, i) => (
            <button
              key={sc.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`${L("Escena", "Scene")} ${i + 1}: ${sc.eyebrow}`}
              onClick={() => go(i)}
              className="group h-6 flex-1 py-2.5"
            >
              <span
                className={`block h-1 rounded-full transition-all duration-300 ${
                  i < idx ? "bg-accent/70" : i === idx ? "bg-accent shadow-[0_0_10px_#8fb4ff]" : "bg-line-strong group-hover:bg-ink-faint"
                }`}
              />
            </button>
          ))}
        </div>
        <button type="button" onClick={onExit} className="text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline" data-testid="deck-back-to-demo">
          {L("← Demo interactiva", "← Interactive demo")}
        </button>
        <span className="tabular text-xs text-ink-faint" aria-hidden>
          {idx + 1} / {scenes.length}
        </span>
        <Button size="sm" variant="ghost" icon="maximize" onClick={toggleFull} title={L("Pantalla completa (F)", "Full screen (F)")}>
          <span className="hidden sm:inline">{full ? L("Salir", "Exit") : L("Pantalla completa", "Full screen")}</span>
        </Button>
      </div>

      <section
        key={s.id}
        id={`escena-${s.id}`}
        role="tabpanel"
        aria-roledescription={L("escena", "scene")}
        aria-label={`${idx + 1} ${L("de", "of")} ${scenes.length}`}
        className="animate-rise relative mt-6 grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">{s.eyebrow}</p>
          <h1 ref={headingRef} tabIndex={-1} className="story-heading text-3xl font-bold leading-tight text-ink sm:text-4xl xl:text-5xl">
            {s.title}
          </h1>
          <div className="flex flex-col gap-4 text-base leading-relaxed text-ink-muted sm:text-lg">{s.body}</div>
        </div>
        <div className="min-w-0">{s.visual}</div>
      </section>

      <nav aria-label={L("Navegación de la historia", "Story navigation")} className="relative mt-6 flex items-center justify-between gap-3">
        <Button icon="stepBack" onClick={() => go(idx - 1)} disabled={idx === 0}>
          {L("Anterior", "Previous")}
        </Button>
        <p className="hidden text-xs text-ink-faint md:block">
          <kbd className="rounded border border-line px-1.5">←</kbd> <kbd className="rounded border border-line px-1.5">→</kbd> {L("para avanzar", "to move")} ·{" "}
          <kbd className="rounded border border-line px-1.5">F</kbd> {L("pantalla completa", "full screen")}
        </p>
        {idx < last ? (
          <Button variant="primary" iconRight="arrowRight" onClick={() => go(idx + 1)}>
            {L("Siguiente", "Next")}
          </Button>
        ) : (
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-4 py-2 text-sm font-medium text-ink hover:bg-surface-3">
            <Icon name={"grid" as IconName} className="size-4" /> Dashboard
          </Link>
        )}
      </nav>
    </div>
  );
}

export function StoryView() {
  return <DataGate>{(d) => <Story data={d} />}</DataGate>;
}
