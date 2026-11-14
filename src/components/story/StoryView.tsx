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
import { PairMap } from "./PairMap";

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
      eyebrow: "La pregunta",
      title: (
        <>
          Dos puntos del polo sur lunar. <span className="bg-gradient-to-r from-site-a to-site-b bg-clip-text text-transparent">¿Cuál es mejor?</span>
        </>
      ),
      body: (
        <>
          <p>
            <Big site="A">Sitio A</Big> y <Big site="B">Sitio B</Big> están en Connecting Ridge, a solo{" "}
            <Big>{formatNumber(separation, 0)} m</Big> uno del otro en el plano del mapa. Allí el Sol roza el horizonte: unos metros de
            relieve deciden si un punto lo ve o no.
          </p>
          <p>
            SITE REGRET no se queda en «cuál gana»: comprueba si la elección <strong className="text-ink">sobrevive cuando cambia el terreno</strong>{" "}
            con el que se calculó.
          </p>
        </>
      ),
      visual: (
        <VisualFrame caption="Figura DEM original del paquete (PGDA78, 40 m/píxel; color = altura del terreno) ampliada sin suavizar. Separación medida en el plano estereográfico polar.">
          <PairMap a={siteA} b={siteB} />
        </VisualFrame>
      ),
    },
    {
      id: "horizonte",
      eyebrow: "Por qué importa el relieve",
      title: "El Sol vive pegado al horizonte",
      body: (
        <ChunkGate state={d.ephA} label="efemérides" minHeight="min-h-20">
          {(eph: EphemerisSiteChunk) => {
            const el = eph.series.bodies.SUN.elevation_deg;
            return (
              <ChunkGate state={d.hzA} label="horizonte" minHeight="min-h-20">
                {(hz: HorizonChunk) => (
                  <>
                    <p>
                      En la ventana {windowId} el centro del Sol, visto desde el Sitio A, se mueve solo entre{" "}
                      <Big>{formatDeg(minOf(el))}</Big> y <Big>{formatDeg(maxOf(el))}</Big> de elevación.
                    </p>
                    <p>
                      El relieve que lo rodea llega a <Big>{formatDeg(maxOf(hz.variants.nominal.elevation_deg, hz.variants.nominal.unknown))}</Big>. Cualquier
                      error de pocos metros en el modelo del terreno puede tapar o destapar el Sol durante horas.
                    </p>
                  </>
                )}
              </ChunkGate>
            );
          }}
        </ChunkGate>
      ),
      visual: (
        <ChunkGate state={d.hzA} label="horizonte A" minHeight="min-h-64">
          {(hzA: HorizonChunk) => (
            <ChunkGate state={d.ephA} label="efemérides" minHeight="min-h-64">
              {(eph: EphemerisSiteChunk) => (
                <VisualFrame caption={`Horizonte nominal del Sitio A a ${heightM} m (1440 azimuts) y trayectoria del centro del Sol en ${windowId} (efemérides nominales SPICE DE421). Escala vertical exagerada.`}>
                  <HorizonChart
                    title={`Horizonte del Sitio A y trayectoria del Sol en ${windowId}`}
                    series={[horizonSeries(hzA, "nominal", "A", "Horizonte · A", SITE_META.A.colorVar, true)]}
                    tracks={[{ key: "sun", label: "Sol", color: "var(--color-state-sun)", azimuthDeg: eph.series.bodies.SUN.azimuth_deg, elevationDeg: eph.series.bodies.SUN.elevation_deg }]}
                  />
                  <Legend
                    items={[
                      { label: "Horizonte del Sitio A", color: SITE_META.A.colorVar, shape: "line" },
                      { label: `Centro del Sol en ${windowId}`, color: "var(--color-state-sun)", shape: "line" },
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
      eyebrow: "01 · Elegir antes de mirar",
      title: (
        <>
          Criterio: <span className="text-accent">{CRITERION_META[criterion].label.charAt(0).toLowerCase() + CRITERION_META[criterion].label.slice(1)}</span>
        </>
      ),
      body: (
        <>
          <p>
            Un vehículo sin Sol no carga. Fijamos el criterio <em>antes</em> de ver el ganador: la racha continua más larga sin Sol en{" "}
            {windowId} ({hm((Date.parse(win.stop) - Date.parse(win.start)) / 3_600_000)}), a {heightM} m de altura.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Fact value={hm(val("A", "nominal"))} label="Sitio A · racha más larga sin Sol" tone="A" />
            <Fact value={hm(val("B", "nominal"))} label="Sitio B · racha más larga sin Sol" tone="B" />
          </div>
          <p>
            Con el terreno nominal (DEM LOLA) gana <Big site={keep}>{SITE_META[keep].label}</Big>
            {result.cases.nominal.D_hours !== null ? (
              <>
                {" "}
                por <Big>{hm(Math.abs(result.cases.nominal.D_hours))}</Big>
              </>
            ) : null}
            .
          </p>
        </>
      ),
      visual: (
        <StreakVisual d={d} variant="nominal" caption="Amarillo: Sol visible · gris: sin Sol. Tramos originales del paquete, sin interpolar; el recuadro marca la racha más larga sin Sol." />
      ),
    },
    {
      id: "terreno",
      eyebrow: "02 · Desafiar el terreno",
      title: "¿Y si el relieve fuera un poco distinto?",
      body: (
        <>
          <p>
            El paquete trae, además del nominal, <Big>{own.evaluated}</Big> hipótesis propias y <Big>{pub.evaluated}</Big> clones publicados del
            DEM. Probamos <strong className="text-uncertainty">{VARIANT_LABEL[pert]}</strong>
            {variantFamily(pert) === "own" ? `, una de las ${FAMILY_META.own.label.toLowerCase()}` : ""}.
          </p>
          <ChunkGate state={keep === "A" ? d.hzA : d.hzB} label="horizonte" minHeight="min-h-10">
            {(hz: HorizonChunk) => {
              const a = hz.variants.nominal;
              const b = hz.variants[pert];
              let max = 0;
              a.elevation_deg.forEach((e, i) => {
                if (!a.unknown[i] && !b.unknown[i]) max = Math.max(max, Math.abs(b.elevation_deg[i] - e));
              });
              return (
                <p>
                  En el {SITE_META[keep].label} el horizonte cambia como mucho <Big site="regret">{formatDeg(max, 3)}</Big>. Parece nada… pero el Sol
                  vive en esa franja.
                </p>
              );
            }}
          </ChunkGate>
          <p className="text-sm text-ink-muted">{variantFamily(pert) === "own" ? FAMILY_META.own.description : FAMILY_META.published.description}</p>
        </>
      ),
      visual: (
        <ChunkGate state={keep === "A" ? d.hzA : d.hzB} label="horizontes" minHeight="min-h-64">
          {(hz: HorizonChunk) => (
            <VisualFrame caption={`Horizonte del ${SITE_META[keep].label} a ${heightM} m: superficie nominal frente a «${VARIANT_LABEL[pert]}». Mismos azimuts; sin suavizar.`}>
              <HorizonChart
                title={`Horizonte del ${SITE_META[keep].label}: nominal y ${VARIANT_LABEL[pert]}`}
                series={[
                  horizonSeries(hz, "nominal", "nom", `${SITE_META[keep].short} · nominal`, SITE_META[keep].colorVar),
                  horizonSeries(hz, pert, "pert", `${SITE_META[keep].short} · ${VARIANT_LABEL[pert]}`, "var(--color-uncertainty)", true),
                ]}
              />
              <Legend
                items={[
                  { label: `${SITE_META[keep].label} · nominal (DEM LOLA)`, color: SITE_META[keep].colorVar, shape: "line" },
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
      eyebrow: "03 · El coste de equivocarse",
      title: (
        <>
          {pertWinner === keep ? "La elección se mantiene" : pertWinner === "TIE" ? "La elección empata" : "La elección se invierte"}
        </>
      ),
      body: (
        <>
          <p>Con «{VARIANT_LABEL[pert]}» las rachas cambian:</p>
          <div className="grid grid-cols-2 gap-3">
            <Fact value={hm(val("A", pert))} label="Sitio A" tone="A" />
            <Fact value={hm(val("B", pert))} label="Sitio B" tone="B" />
          </div>
          {pertWinner === rival ? (
            <p>
              Ahora gana <Big site={rival}>{SITE_META[rival].label}</Big>. Si hubiéramos aterrizado en el {SITE_META[keep].label}, el{" "}
              <strong className="text-uncertainty">REGRET</strong> —lo que se pierde frente a la mejor opción— sería{" "}
              <Big site="regret">{hm(regret)}</Big> más de oscuridad continua.
            </p>
          ) : (
            <p>
              REGRET de conservar el {SITE_META[keep].label}: <Big site="regret">{hm(regret)}</Big>.
            </p>
          )}
        </>
      ),
      visual: <StreakVisual d={d} variant={pert} caption={`Superficie «${VARIANT_LABEL[pert]}». Mismas efemérides; cambia solo el relieve.`} />,
    },
    {
      id: "robustez",
      eyebrow: "04 · ¿Cuántas veces aguanta?",
      title: "Robustez: recuentos, no probabilidades",
      body: (
        <>
          <p>
            La elección nominal ({SITE_META[keep].label}) se mantiene en <Big>{`${own.same}/${own.evaluated}`}</Big> hipótesis propias y en{" "}
            <Big>{`${pub.same}/${pub.evaluated}`}</Big> clones publicados. Empates: {own.tie} y {pub.tie}; inversiones: {own.inverted} y {pub.inverted}.
          </p>
          <p className="text-sm text-ink-muted">
            Son {own.evaluated + pub.evaluated} superficies concretas, no un muestreo: no se pueden leer como «probabilidad de acertar». Un solo
            contraejemplo ya indica sensibilidad al relieve.
          </p>
        </>
      ),
      visual: (
        <VisualFrame caption="Ganador con cada superficie del paquete para este criterio. El recuadro violeta marca las que invierten la elección nominal.">
          <SurfaceGrid result={result} keep={keep} />
        </VisualFrame>
      ),
    },
    {
      id: "evidencia",
      eyebrow: "05 · Verificable",
      title: "Cada número es trazable",
      body: (
        <>
          <p>
            Nada se recalcula ni se inventa en el navegador: la web lee un paquete precalculado con datos NASA (PGDA, LRO-LOLA, JPL/NAIF DE421) y
            comprueba su SHA-256 antes de mostrarlo.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href={`/regret-lab/${labQuery}`} variant="regret" icon="flask">
              Abrir este caso en Regret Lab
            </LinkButton>
            <LinkButton href={`/comparador/${labQuery}`} icon="compare">
              Comparador
            </LinkButton>
            <LinkButton href="/evidencia/" icon="file">
              Evidencia
            </LinkButton>
          </div>
        </>
      ),
      visual: (
        <VisualFrame>
          <div className="grid grid-cols-2 gap-3">
            <Fact value={`${v.passed}/${v.passed + v.failed}`} label="comprobaciones superadas" />
            <Fact value={v.horizons_reference_rows} label="contrastes con JPL Horizons" />
            <Fact value={core.provenance.source_assets.length} label="fuentes NASA registradas" />
            <Fact value={core.provenance.comparison_count * 4} label="decisiones A/B precalculadas" />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <Icon name="shield" className="size-4 text-ok" /> Paquete <span className="font-mono text-ink">{core.schema_version}</span> · SHA-256{" "}
            <span className="font-mono text-ink">{shortHash(manifest.source.sha256, 16)}…</span>
            {data.integrity === "verified" ? <Badge tone="ok" icon="check">verificado</Badge> : <Badge tone="warn">sin verificar</Badge>}
          </p>
          <p className="text-[11px] text-ink-faint">
            Visibilidad geométrica del centro del Sol y de la Tierra. No implica energía, enlace de radio, seguridad de alunizaje ni respaldo de la NASA.
          </p>
        </VisualFrame>
      ),
    },
  ];

  return <StoryDeck scenes={scenes} />;
}

function StreakVisual({ d, variant, caption }: { d: ReturnType<typeof useStoryData>; variant: Variant; caption: string }) {
  return (
    <ChunkGate state={d.scen} label="estados" minHeight="min-h-48">
      {(s: ScenarioChunk) => (
        <ChunkGate state={d.clock} label="reloj" minHeight="min-h-48">
          {(c: EphemerisClockChunk) => (
            <VisualFrame caption={caption}>
              <Legend
                items={[
                  { label: "Sol visible", color: "var(--color-state-sun)" },
                  { label: "Sin Sol", color: "var(--color-state-neither)" },
                  { label: "Racha más larga sin Sol", color: "var(--color-ink)", shape: "line" },
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
    { label: "Nominal", vs: VARIANTS.filter((v) => variantFamily(v) === "nominal") },
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
                  <span className="text-sm font-bold">{w === "TIE" ? "Empate" : w === "UNKNOWN" ? "—" : `Gana ${w}`}</span>
                  {inv ? <span className="block text-[10px] font-semibold text-uncertainty">invierte · regret {hm(regretOfKeeping(result.cases[v], keep))}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

const sceneFromHash = (ids: string[]) => {
  if (typeof window === "undefined") return 0;
  const i = ids.indexOf(window.location.hash.slice(1));
  return i >= 0 ? i : 0;
};

function StoryDeck({ scenes }: { scenes: Scene[] }) {
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
        <div className="flex flex-1 gap-1.5" role="tablist" aria-label="Escenas">
          {scenes.map((sc, i) => (
            <button
              key={sc.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Escena ${i + 1}: ${sc.eyebrow}`}
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
        <span className="tabular text-xs text-ink-faint" aria-hidden>
          {idx + 1} / {scenes.length}
        </span>
        <Button size="sm" variant="ghost" icon="maximize" onClick={toggleFull} title="Pantalla completa (F)">
          <span className="hidden sm:inline">{full ? "Salir" : "Pantalla completa"}</span>
        </Button>
      </div>

      <section
        key={s.id}
        id={`escena-${s.id}`}
        role="tabpanel"
        aria-roledescription="escena"
        aria-label={`${idx + 1} de ${scenes.length}`}
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

      <nav aria-label="Navegación de la historia" className="relative mt-6 flex items-center justify-between gap-3">
        <Button icon="stepBack" onClick={() => go(idx - 1)} disabled={idx === 0}>
          Anterior
        </Button>
        <p className="hidden text-xs text-ink-faint md:block">
          <kbd className="rounded border border-line px-1.5">←</kbd> <kbd className="rounded border border-line px-1.5">→</kbd> para avanzar ·{" "}
          <kbd className="rounded border border-line px-1.5">F</kbd> pantalla completa
        </p>
        {idx < last ? (
          <Button variant="primary" iconRight="arrowRight" onClick={() => go(idx + 1)}>
            Siguiente
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
