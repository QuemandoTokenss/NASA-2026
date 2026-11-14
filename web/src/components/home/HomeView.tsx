"use client";

import Link from "next/link";
import { HEIGHTS_M, STATE_SAMPLES, VARIANTS, WINDOW_IDS, variantFamily, type SiteId } from "@/lib/contract/constants";
import type { Core } from "@/lib/contract/schema";
import { getCriterionResult, getScenarioSummary } from "@/lib/data/selectors";
import { formatHoursMinutes, formatLatitude, formatLongitudeEast, formatNumber, formatUtcDate } from "@/lib/format";
import { CRITERION_META, SITE_META, VARIANT_LABEL, WINNER_LABEL } from "@/lib/labels";
import { GEO_REGISTRY, TERRAIN_MANIFEST } from "@/lib/geospatial/terrain";
import { familyCounts } from "@/lib/science/decision";
import { DEMO_CASE, DEMO_HASH } from "@/lib/science/demo";
import { CRITERION_METRIC, METRIC_META } from "@/lib/science/metrics";
import { useSelection } from "@/lib/state/SelectionProvider";
import { Hero } from "./Hero";
import { DataGate } from "../data/DataGate";
import { SiteTerrainThumb } from "../comparador/PairTerrain";
import { GeoMap } from "../maps/GeoMap";
import { siteReading } from "@/lib/science/landingDemo";
import { Badge, NatureBadge, SiteDot, WinnerTag } from "../ui/Display";
import { Icon, type IconName } from "../ui/Icon";
import { LinkButton } from "../ui/Interactive";
import { Panel } from "../ui/Panel";
import { L, R } from "@/lib/i18n";

const UNIQUE = (): Array<{ icon: IconName; title: string; text: string }> => [
  {
    icon: "shuffle",
    title: L("Decisión bajo incertidumbre del relieve", "Decisions under terrain uncertainty"),
    text: L(
      "No solo dice qué sitio gana: comprueba si la elección se mantiene, empata o se invierte con otras superficies del terreno.",
      "It does not just say which site wins: it checks whether the choice holds, ties or flips with other terrain surfaces.",
    ),
  },
  {
    icon: "lock",
    title: L("Criterio antes que resultado", "Criterion before result"),
    text: L("Primero se fija qué significa «mejor»; después se revela el ganador. Sin puntuaciones opacas.", "First you fix what “better” means; then the winner is revealed. No opaque scores."),
  },
  {
    icon: "shield",
    title: L("Trazable y verificable", "Traceable and verifiable"),
    text: L(
      "120 escenarios precalculados con SPICE y DEM LOLA; cada archivo se verifica con SHA-256 en el navegador.",
      "120 scenarios precomputed with SPICE and the LOLA DEM; every file is SHA-256 verified in the browser.",
    ),
  },
];

/**
 * Mission Control: estado del escenario seleccionado (el mismo en todas las vistas)
 * y acceso a cada vista con un dato real de ese escenario. Nada se calcula aquí:
 * todo se lee del paquete, del registro o del manifiesto.
 */
function MissionControl({ core }: { core: Core }) {
  const { selection, query } = useSelection();
  const { focusSite, windowId, heightM, variant, criterion, timeIndex } = selection;
  const result = criterion ? getCriterionResult(core, windowId, heightM, criterion) : undefined;
  const winner = result?.cases[variant].winner;
  const own = result ? familyCounts(result, "own") : null;
  const pub = result ? familyCounts(result, "published") : null;
  const nominalAB = result && (result.nominal_winner === "A" || result.nominal_winner === "B");
  const clones = TERRAIN_MANIFEST.ensemble?.members.length ?? 0;
  const cards: Array<{ href: string; icon: IconName; title: string; status: string; detail: string }> = [
    { href: "/explore/", icon: "map", title: "Explore", status: L("Mapa real · Moon Trek NAC + DEM 5 m", "Real map · Moon Trek NAC + 5 m DEM"), detail: L(`${GEO_REGISTRY.assets.length} activos con procedencia · foco ${focusSite}`, `${GEO_REGISTRY.assets.length} assets with provenance · focus ${focusSite}`) },
    { href: "/timeline/", icon: "orbit", title: "Timeline", status: L(`${windowId} · intervalo ${timeIndex + 1} de ${STATE_SAMPLES}`, `${windowId} · interval ${timeIndex + 1} of ${STATE_SAMPLES}`), detail: L("Geometría Sol–Tierra–Luna y cielo local", "Sun–Earth–Moon geometry and local sky") },
    {
      href: "/comparador/",
      icon: "compare",
      title: L("Comparador A vs B", "Compare A vs B"),
      status: winner ? `${L("Resultado", "Result")}: ${WINNER_LABEL[winner]}` : L("Elige un criterio para ver el resultado", "Choose a criterion to see the result"),
      detail: L("Terreno real del par y Δ de horizonte", "Real terrain of the pair and horizon Δ"),
    },
    { href: "/engineer/", icon: "engineer", title: "Engineer", status: L(`Observador a ${heightM} m · terreno 3D`, `Observer at ${heightM} m · 3D terrain`), detail: variantFamily(variant) === "published" ? L(`Malla del ${VARIANT_LABEL[variant].toLowerCase()}`, `Mesh of ${VARIANT_LABEL[variant]}`) : L("Malla del DEM nominal", "Nominal DEM mesh") },
    {
      href: "/regret-lab/",
      icon: "flask",
      title: "Regret Lab",
      status: nominalAB && own && pub ? L(`Se mantiene ${own.same}/${own.evaluated} · ${pub.same}/${pub.evaluated}`, `Holds ${own.same}/${own.evaluated} · ${pub.same}/${pub.evaluated}`) : result ? L("Sin elección nominal (empate o desconocido)", "No nominal choice (tie or unknown)") : L("Elige un criterio", "Choose a criterion"),
      detail: L(`${clones} clones PGDA78 verificados · diferencias de terreno`, `${clones} verified PGDA78 clones · terrain differences`),
    },
    { href: "/evidencia/", icon: "file", title: L("Evidencia", "Evidence"), status: L(`${core.provenance.validation.passed} comprobaciones superadas`, `${core.provenance.validation.passed} checks passed`), detail: L("Fuentes, hashes y límites", "Sources, hashes and limits") },
  ];
  return (
    <section aria-label="Mission Control" className="rounded-2xl border border-line bg-surface/85 p-4 sm:p-5" data-testid="mission-control">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-accent">Mission Control</h2>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted" data-testid="mission-scenario">
          <Badge tone={focusSite === "A" ? "a" : "b"}>{SITE_META[focusSite].label}</Badge>
          <Badge tone="neutral">{windowId}</Badge>
          <Badge tone="neutral">{heightM} m</Badge>
          <Badge tone={variant === "nominal" ? "neutral" : "uncertainty"}>{VARIANT_LABEL[variant]}</Badge>
          <Badge tone="neutral">{criterion ? CRITERION_META[criterion].short : L("criterio sin elegir", "no criterion yet")}</Badge>
        </span>
        <span className="text-[11px] text-ink-faint">{L("El mismo escenario se mantiene al cambiar de vista.", "The same scenario is kept when switching views.")}</span>
      </div>
      <nav aria-label={L("Vistas del escenario", "Scenario views")} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((c) => (
          <Link key={c.href} href={`${c.href}?${query}`} className="group flex flex-col gap-1.5 rounded-xl border border-line bg-bg-2/70 p-3.5 transition-all hover:-translate-y-0.5 hover:border-accent/50">
            <span className="flex items-center gap-2 font-semibold text-ink">
              <Icon name={c.icon} className="size-5 text-ink-muted group-hover:text-accent" />
              {c.title}
            </span>
            <span className="text-sm text-ink">{c.status}</span>
            <span className="text-[11px] text-ink-faint">{c.detail}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

function Body({ core }: { core: Core }) {
  const { query } = useSelection();
  const p = core.provenance;
  const cfg = core.configuration;
  const demo = getCriterionResult(core, DEMO_CASE.windowId, DEMO_CASE.heightM, DEMO_CASE.criterion)!;
  const metric = CRITERION_METRIC[DEMO_CASE.criterion];
  const demoVal = (s: SiteId) => getScenarioSummary(core, { siteId: s, windowId: DEMO_CASE.windowId, heightM: DEMO_CASE.heightM, variant: "nominal" })!.metrics[metric];
  const own = familyCounts(demo, "own");
  const pub = familyCounts(demo, "published");
  const demoHref = `/regret-lab/?w=${DEMO_CASE.windowId}&h=${DEMO_CASE.heightM}&v=nominal&c=${DEMO_CASE.criterion}${DEMO_HASH}`;

  // Caso de la portada: W2 · 0 m, referencia → hipótesis del equipo (correlated_plus), leído del paquete.
  const why = {
    a0: siteReading(core, "A", 0).hours ?? 0,
    b0: siteReading(core, "B", 0).hours ?? 0,
    a1: siteReading(core, "A", 1).hours ?? 0,
    b1: siteReading(core, "B", 1).hours ?? 0,
  };
  const hm = formatHoursMinutes;
  const facts = [
    { v: core.sites.length, l: L("sitios calculados", "computed sites") },
    { v: cfg.windows.length, l: L("ventanas de 30 días", "30-day windows") },
    { v: cfg.heights_m.length, l: L("alturas del observador", "observer heights") },
    { v: VARIANTS.length, l: L("superficies por sitio", "surfaces per site") },
    { v: p.scenario_count, l: L("escenarios", "scenarios") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-5 rounded-3xl border border-line bg-surface/85 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]" data-testid="home-why" aria-labelledby="home-why-title">
        <div className="flex flex-col justify-center gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-uncertainty">{L("Por qué existe SITE REGRET", "Why SITE REGRET exists")}</p>
          <h2 id="home-why-title" className="text-2xl leading-tight font-bold text-ink sm:text-3xl">
            {L("La mejor elección puede cambiar si el terreno es un poco distinto", "The best choice can change if the terrain is slightly different")}
          </h2>
          <div className="flex flex-wrap items-end gap-3" data-testid="home-why-b">
            <div>
              <p className="text-xs text-ink-faint">{L("Sitio B · relieve de referencia", "Site B · reference terrain")}</p>
              <p className="tabular text-4xl font-bold text-site-b sm:text-5xl">{hm(why.b0)}</p>
            </div>
            <Icon name="arrowRight" className="mb-3 size-7 text-ink-faint" />
            <div>
              <p className="text-xs text-ink-faint">{L("Sitio B · otro modelo del terreno", "Site B · another terrain model")}</p>
              <p className="tabular text-4xl font-bold text-uncertainty sm:text-5xl">{hm(why.b1)}</p>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-ink-muted sm:text-base">
            {L(
              `Mayor racha seguida sin Sol en la ventana W2 (14 dic 2026 – 13 ene 2027), con el observador a ras del suelo. Con el relieve de referencia, B (${hm(why.b0)}) gana a A (${hm(why.a0)}). Con una hipótesis del equipo sobre el terreno, B pasa a ${hm(why.b1)} y A queda por delante (${hm(why.a1)}). Ese cambio de decisión es lo que mide SITE REGRET.`,
              `Longest continuous stretch without sunlight in window W2 (14 Dec 2026 – 13 Jan 2027), observer at ground level. With the reference terrain, B (${hm(why.b0)}) beats A (${hm(why.a0)}). With a team hypothesis about the terrain, B goes to ${hm(why.b1)} and A takes the lead (${hm(why.a1)}). That change of decision is what SITE REGRET measures.`,
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/historia/" className="inline-flex items-center gap-2 rounded-xl bg-uncertainty px-5 py-2.5 text-sm font-bold text-[#14092e] hover:brightness-110">
              <Icon name="play" className="size-4" /> {L("Compruébalo en la misión", "See it in the mission")}
            </Link>
            <Link href={`/comparador/?w=W2&h=0&v=nominal&c=min_longest_dark_hours`} className="inline-flex items-center gap-2 rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2">
              {L("Ver la comparación", "See the comparison")}
            </Link>
            <Link href={`/explore/?${query}`} className="inline-flex items-center gap-2 rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2">
              <Icon name="map" className="size-4" /> {L("Explorar el polo sur", "Explore the south pole")}
            </Link>
            <Link href="/historia/#pregunta" className="self-center text-sm text-ink-muted underline underline-offset-4 hover:text-ink">
              {L("Presentación en 7 escenas", "7-scene presentation")}
            </Link>
          </div>
        </div>
        <figure className="flex min-w-0 flex-col gap-2" data-testid="hero-map">
          <GeoMap sites={core.sites} focusSite="A" compact compactHeightClass="h-[300px] sm:h-[360px]" showCredit reliefFallback overlay={{ line: [{ x: core.sites[0].x_m, y: core.sites[0].y_m }, { x: core.sites[1].x_m, y: core.sites[1].y_m }] }} />
          <figcaption className="text-[11px] text-ink-faint">
            {L(
              "Los dos sitios reales en Connecting Ridge: A (ROI 4) y B (ROI 6), a 648 m, sobre imágenes orbitales LRO NAC (NASA Moon Trek). Sin conexión se muestra el relieve calculado del DEM, rotulado.",
              "The two real sites on Connecting Ridge: A (ROI 4) and B (ROI 6), 648 m apart, over LRO NAC orbital images (NASA Moon Trek). Offline, the computed DEM relief is shown, labelled.",
            )}
          </figcaption>
        </figure>
      </section>

      <ul className="flex flex-wrap gap-x-6 gap-y-2 px-1" aria-label={L("El paquete científico en cifras", "The scientific package in numbers")}>
        {facts.map((f) => (
          <li key={f.l} className="flex items-baseline gap-2">
            <span className="tabular text-xl font-bold text-ink">{f.v}</span>
            <span className="text-xs text-ink-muted">{f.l}</span>
          </li>
        ))}
      </ul>

      <MissionControl core={core} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        {core.sites.map((s) => {
          const id = s.id as SiteId;
          return (
            <Panel key={id} title={`${SITE_META[id].label} · ROI ${s.roi}`} icon="pin" actions={<NatureBadge nature="OBSERVED" />}>
              <div className="flex gap-4">
                <SiteTerrainThumb site={s} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className={`font-semibold ${SITE_META[id].textClass}`}>{s.name}</p>
                  <p className="tabular text-ink-muted">
                    {formatLatitude(s.latitude_deg)}, {formatLongitudeEast(s.longitude_east_deg)}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {L("Suelo", "Ground")} {formatNumber(s.nominal_height_m, 1)} m · {L("pendiente", "slope")} {formatNumber(s.values.slp, 2)}°
                  </p>
                </div>
              </div>
              <table className="mt-4 w-full text-xs">
                <caption className="sr-only">{L("Métricas nominales a 0 m", "Nominal metrics at 0 m")}</caption>
                <thead>
                  <tr className="text-ink-faint">
                    <th scope="col" className="pb-1 text-left font-medium">Nominal · 0 m</th>
                    <th scope="col" className="pb-1 text-right font-medium">{METRIC_META.sun_hours.short}</th>
                    <th scope="col" className="pb-1 text-right font-medium">{METRIC_META.dte_center_hours.short}</th>
                    <th scope="col" className="pb-1 text-right font-medium">{METRIC_META.longest_dark_hours.short}</th>
                  </tr>
                </thead>
                <tbody>
                  {WINDOW_IDS.map((w) => {
                    const m = getScenarioSummary(core, { siteId: id, windowId: w, heightM: 0, variant: "nominal" })!.metrics;
                    return (
                      <tr key={w} className="border-t border-line/60 text-ink-muted">
                        <th scope="row" className="py-1.5 text-left font-normal text-ink">
                          {w}
                        </th>
                        <td className="tabular py-1.5 text-right">{formatHoursMinutes(m.sun_hours)}</td>
                        <td className="tabular py-1.5 text-right">{formatHoursMinutes(m.dte_center_hours)}</td>
                        <td className="tabular py-1.5 text-right">{formatHoursMinutes(m.longest_dark_hours)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          );
        })}

        <section aria-label={L("Caso demostrativo", "Demo case")} className="relative overflow-hidden rounded-2xl border border-uncertainty/50 bg-gradient-to-br from-[#1a1240] to-surface p-5 shadow-[0_0_60px_-28px_#a78bfa]">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-uncertainty">
            <Icon name="sparkles" className="size-4" /> {L("Caso demostrativo", "Demo case")}
          </p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {DEMO_CASE.windowId} · {DEMO_CASE.heightM} m · {CRITERION_META[DEMO_CASE.criterion].label}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(["A", "B"] as const).map((s) => (
              <div key={s} className={`rounded-xl border p-3 ${demo.nominal_winner === s ? `${SITE_META[s].borderClass} bg-surface-2` : "border-line bg-bg-2/60"}`}>
                <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <SiteDot site={s} /> {METRIC_META[metric].short} · {s}
                </p>
                <p className={`tabular mt-1 text-2xl font-bold ${SITE_META[s].textClass}`}>{formatHoursMinutes(demoVal(s))}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            {R(
              "Nominalmente gana {w}. ¿Se mantiene? En {own} hipótesis propias y {pub} clones publicados; {inv} superficies la invierten.",
              "Nominal winner: {w}. Does it hold? In {own} team hypotheses and {pub} published clones; {inv} surfaces flip it.",
              {
                w: <strong className="text-ink">{WINNER_LABEL[demo.nominal_winner]}</strong>,
                own: <strong className="text-ink">{`${own.same}/${own.evaluated}`}</strong>,
                pub: <strong className="text-ink">{`${pub.same}/${pub.evaluated}`}</strong>,
                inv: own.inverted + pub.inverted,
              },
            )}
          </p>
          <LinkButton href={demoHref} variant="regret" icon="play" className="mt-4">
            {L("Ver la inversión paso a paso", "See the flip step by step")}
          </LinkButton>
          <p className="mt-2 text-[11px] text-ink-faint">{L("Recuentos de superficies modeladas, no probabilidades.", "Counts of modelled surfaces, not probabilities.")}</p>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel title={L("Ventanas disponibles (UTC)", "Available windows (UTC)")} icon="calendar">
          <ul className="flex flex-col gap-3">
            {cfg.windows.map((w) => (
              <li key={w.id} className="flex items-center gap-4 rounded-xl border border-line bg-bg-2/70 p-3">
                <span className="grid size-11 place-items-center rounded-xl bg-accent-surface text-sm font-bold text-accent">{w.id}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">
                    {formatUtcDate(w.start)} → {formatUtcDate(w.stop)}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {formatNumber((Date.parse(w.stop) - Date.parse(w.start)) / 3.6e6, 0)} h · {L("intervalos de", "intervals of")} {cfg.time_step_minutes} min · {L("ventana de desarrollo, no fecha de misión", "development window, not a mission date")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{L("Ganador nominal", "Nominal winner")} · {CRITERION_META[cfg.primary_criterion].short}</p>
          <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-2 text-xs">
            <span />
            {HEIGHTS_M.map((h) => (
              <span key={h} className="text-center text-ink-faint">
                {h} m
              </span>
            ))}
            {WINDOW_IDS.map((w) => (
              <div key={w} className="contents">
                <span className="self-center text-ink-faint">{w}</span>
                {HEIGHTS_M.map((h) => (
                  <span key={h} className="text-center">
                    <WinnerTag winner={getCriterionResult(core, w, h, cfg.primary_criterion)!.nominal_winner} short />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={L("Indicadores del paquete científico", "Scientific package indicators")} icon="activity" actions={<Badge tone="neutral">{core.schema_version}</Badge>}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { v: `${p.validation.passed}/${p.validation.passed + p.validation.failed}`, l: L("comprobaciones superadas", "checks passed"), d: L("ejecución documentada", "documented run") },
              {
                v: p.validation.horizons_reference_rows,
                l: L("contrastes con JPL Horizons", "JPL Horizons cross-checks"),
                d: `${L("Δ máx.", "max Δ")} ${formatNumber(Math.max(p.validation.max_horizons_az_delta_deg, p.validation.max_horizons_el_delta_deg) * 3600, 3)}″`,
              },
              { v: p.source_assets.length, l: L("fuentes NASA registradas", "registered NASA sources"), d: "PGDA 78/90 · NAIF" },
              { v: p.comparison_count * 4, l: L("decisiones A/B", "A/B decisions"), d: `${p.comparison_count} ${L("comparaciones × 4 criterios", "comparisons × 4 criteria")}` },
            ].map((k) => (
              <div key={k.l} className="rounded-xl border border-line bg-bg-2/70 p-3">
                <p className="tabular text-2xl font-bold text-ink">{k.v}</p>
                <p className="text-xs text-ink-muted">{k.l}</p>
                <p className="text-[10px] text-ink-faint">{k.d}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{L("Qué hace única a SITE REGRET", "What makes SITE REGRET unique")}</h3>
          <ul className="grid gap-3 md:grid-cols-3">
            {UNIQUE().map((u) => (
              <li key={u.title} className="rounded-xl border border-line bg-bg-2/60 p-3">
                <Icon name={u.icon} className="size-5 text-accent" />
                <p className="mt-2 text-sm font-semibold text-ink">{u.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{u.text}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>


      <p className="text-center text-[11px] text-ink-faint">
        {L(
          "Resultados condicionados al modelo y a estas superficies: visibilidad geométrica del centro de Sol y Tierra. No implica energía, enlace de radio, seguridad de alunizaje ni respaldo de la NASA.",
          "Results conditioned on the model and on these surfaces: geometric visibility of the Sun and Earth centres. Does not imply power, radio link, landing safety or NASA endorsement.",
        )}
      </p>
    </div>
  );
}

export function HomeView() {
  return (
    <div className="flex flex-col gap-6">
      <Hero />
      <DataGate>{({ core }) => <Body core={core} />}</DataGate>
    </div>
  );
}
