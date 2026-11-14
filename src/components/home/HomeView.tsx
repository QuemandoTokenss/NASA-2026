"use client";

import Link from "next/link";
import { HEIGHTS_M, VARIANTS, WINDOW_IDS, type SiteId } from "@/lib/contract/constants";
import type { Core } from "@/lib/contract/schema";
import { getCriterionResult, getScenarioSummary } from "@/lib/data/selectors";
import { formatHoursMinutes, formatLatitude, formatLongitudeEast, formatNumber, formatUtcDate } from "@/lib/format";
import { CRITERION_META, SITE_META, WINNER_LABEL } from "@/lib/labels";
import { NAV } from "@/lib/nav";
import { familyCounts } from "@/lib/science/decision";
import { DEMO_CASE, DEMO_HASH } from "@/lib/science/demo";
import { CRITERION_METRIC, METRIC_META } from "@/lib/science/metrics";
import { useSelection } from "@/lib/state/SelectionProvider";
import { DataGate } from "../data/DataGate";
import { SiteThumb } from "../explore/SiteThumb";
import { Badge, NatureBadge, SiteDot, WinnerTag } from "../ui/Display";
import { Icon, type IconName } from "../ui/Icon";
import { LinkButton } from "../ui/Interactive";
import { Panel } from "../ui/Panel";

/** Luna ilustrativa (no es un mapa): marca aproximada del polo sur. */
function MoonIllustration() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]" aria-hidden>
      <div className="absolute inset-[6%] rounded-full shadow-[0_0_120px_-20px_#3a6ff0]" />
      <svg viewBox="0 0 400 400" className="relative h-full w-full">
        <defs>
          <radialGradient id="moon" cx="38%" cy="32%" r="75%">
            <stop offset="0" stopColor="#e8e6e0" />
            <stop offset="0.45" stopColor="#9a9a98" />
            <stop offset="0.85" stopColor="#3b3f48" />
            <stop offset="1" stopColor="#14171f" />
          </radialGradient>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#a78bfa" stopOpacity="0.9" />
            <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="170" fill="url(#moon)" />
        {[
          [140, 120, 22],
          [250, 95, 14],
          [270, 210, 30],
          [150, 250, 18],
          [215, 165, 10],
          [110, 190, 12],
          [300, 150, 9],
          [230, 300, 16],
        ].map(([x, y, r], i) => (
          <g key={i} opacity={0.35}>
            <circle cx={x} cy={y} r={r} fill="#2a2d33" />
            <circle cx={x - r * 0.15} cy={y - r * 0.15} r={r * 0.82} fill="#7a7a78" opacity={0.35} />
          </g>
        ))}
        <ellipse cx="200" cy="200" rx="170" ry="40" fill="none" stroke="#8fb4ff" strokeOpacity={0.15} />
        <circle cx="200" cy="366" r="26" fill="url(#glow)" className="animate-pulse" />
        <circle cx="200" cy="366" r="5" fill="#a78bfa" />
        <line x1="200" y1="366" x2="300" y2="388" stroke="#a78bfa" strokeOpacity={0.6} />
        <text x="306" y="392" fontSize="12" fill="#c9b8ff">
          Polo sur
        </text>
      </svg>
      <span className="absolute top-2 right-2 rounded-full border border-line-strong bg-bg/80 px-2 py-0.5 text-[10px] text-ink-faint">Ilustración</span>
    </div>
  );
}

const UNIQUE: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: "shuffle", title: "Decisión bajo incertidumbre del relieve", text: "No solo dice qué sitio gana: comprueba si la elección se mantiene, empata o se invierte con otras superficies del terreno." },
  { icon: "lock", title: "Criterio antes que resultado", text: "Primero se fija qué significa «mejor»; después se revela el ganador. Sin puntuaciones opacas." },
  { icon: "shield", title: "Trazable y verificable", text: "120 escenarios precalculados con SPICE y DEM LOLA; cada archivo se verifica con SHA-256 en el navegador." },
];

const STEPS: Array<{ n: string; t: string; d: string; href: string; icon: IconName }> = [
  { n: "01", t: "Elige qué significa «mejor»", d: "Menor racha sin Sol, más horas con Sol, con Tierra o con ambos.", href: "/comparador/", icon: "lock" },
  { n: "02", t: "Compara A y B", d: "Mismo periodo, misma altura y misma superficie; empates explícitos.", href: "/comparador/", icon: "compare" },
  { n: "03", t: "Desafía el terreno", d: "4 hipótesis propias y 5 clones publicados: ¿se mantiene la elección?", href: "/regret-lab/", icon: "flask" },
];

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

  const facts = [
    { v: core.sites.length, l: "sitios calculados" },
    { v: cfg.windows.length, l: "ventanas de 30 días" },
    { v: cfg.heights_m.length, l: "alturas del observador" },
    { v: VARIANTS.length, l: "superficies por sitio" },
    { v: p.scenario_count, l: "escenarios" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-[#0b1730] via-surface to-[#120c2a] p-6 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-[radial-gradient(circle,#3a6ff033,transparent_60%)]" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="animate-rise">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">NASA Space Apps 2026 · Lunar Landing Site Navigator</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
              ¿Hasta qué punto podemos confiar en que un sitio lunar es{" "}
              <span className="bg-gradient-to-r from-site-a to-site-b bg-clip-text text-transparent">mejor que otro</span>?
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
              En el polo sur lunar, unos metros de relieve deciden si un punto ve el Sol o la Tierra. SITE REGRET compara dos emplazamientos reales y comprueba si la elección
              <strong className="text-ink"> sigue siendo la mejor cuando el terreno cambia</strong>.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href={demoHref} variant="regret" icon="sparkles">
                Iniciar caso demostrativo
              </LinkButton>
              <LinkButton href={`/explore/?${query}`} variant="secondary" icon="map">
                Explorar los sitios
              </LinkButton>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
              {facts.map((f) => (
                <li key={f.l} className="flex items-baseline gap-2">
                  <span className="tabular text-2xl font-bold text-ink">{f.v}</span>
                  <span className="text-xs text-ink-muted">{f.l}</span>
                </li>
              ))}
            </ul>
          </div>
          <MoonIllustration />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <Link
            key={s.n}
            href={`${s.href}?${query}`}
            className="group rounded-2xl border border-line bg-surface/85 p-5 transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_12px_32px_-16px_#3a6ff0]"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-ink-faint transition-colors group-hover:text-accent">{s.n}</span>
              <Icon name={s.icon} className="size-5 text-ink-muted" />
            </div>
            <p className="mt-2 text-lg font-semibold text-ink">{s.t}</p>
            <p className="mt-1 text-sm text-ink-muted">{s.d}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        {core.sites.map((s) => {
          const id = s.id as SiteId;
          return (
            <Panel key={id} title={`${SITE_META[id].label} · ROI ${s.roi}`} icon="pin" actions={<NatureBadge nature="OBSERVED" />}>
              <div className="flex gap-4">
                <SiteThumb site={s} size={112} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className={`font-semibold ${SITE_META[id].textClass}`}>{s.name}</p>
                  <p className="tabular text-ink-muted">
                    {formatLatitude(s.latitude_deg)}, {formatLongitudeEast(s.longitude_east_deg)}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    Suelo {formatNumber(s.nominal_height_m, 1)} m · pendiente {formatNumber(s.values.slp, 2)}°
                  </p>
                </div>
              </div>
              <table className="mt-4 w-full text-xs">
                <caption className="sr-only">Métricas nominales a 0 m</caption>
                <thead>
                  <tr className="text-ink-faint">
                    <th scope="col" className="pb-1 text-left font-medium">Nominal · 0 m</th>
                    <th scope="col" className="pb-1 text-right font-medium">Con Sol</th>
                    <th scope="col" className="pb-1 text-right font-medium">Con Tierra</th>
                    <th scope="col" className="pb-1 text-right font-medium">Racha sin Sol</th>
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

        <section aria-label="Caso demostrativo" className="relative overflow-hidden rounded-2xl border border-uncertainty/50 bg-gradient-to-br from-[#1a1240] to-surface p-5 shadow-[0_0_60px_-28px_#a78bfa]">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-uncertainty">
            <Icon name="sparkles" className="size-4" /> Caso demostrativo
          </p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {DEMO_CASE.windowId} · {DEMO_CASE.heightM} m · {CRITERION_META[DEMO_CASE.criterion].label.toLowerCase()}
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
            Nominalmente gana <strong className="text-ink">{WINNER_LABEL[demo.nominal_winner]}</strong>. ¿Se mantiene? En{" "}
            <strong className="text-ink">
              {own.same}/{own.evaluated}
            </strong>{" "}
            hipótesis propias y{" "}
            <strong className="text-ink">
              {pub.same}/{pub.evaluated}
            </strong>{" "}
            clones publicados; {own.inverted + pub.inverted} superficies la invierten.
          </p>
          <LinkButton href={demoHref} variant="regret" icon="play" className="mt-4">
            Ver la inversión paso a paso
          </LinkButton>
          <p className="mt-2 text-[11px] text-ink-faint">Recuentos de superficies modeladas, no probabilidades.</p>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel title="Ventanas disponibles (UTC)" icon="calendar">
          <ul className="flex flex-col gap-3">
            {cfg.windows.map((w) => (
              <li key={w.id} className="flex items-center gap-4 rounded-xl border border-line bg-bg-2/70 p-3">
                <span className="grid size-11 place-items-center rounded-xl bg-accent-surface text-sm font-bold text-accent">{w.id}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">
                    {formatUtcDate(w.start)} → {formatUtcDate(w.stop)}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {formatNumber((Date.parse(w.stop) - Date.parse(w.start)) / 3.6e6, 0)} h · intervalos de {cfg.time_step_minutes} min · ventana de desarrollo, no fecha de misión
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Ganador nominal · {CRITERION_META[cfg.primary_criterion].short}</p>
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

        <Panel title="Indicadores del paquete científico" icon="activity" actions={<Badge tone="neutral">{core.schema_version}</Badge>}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { v: `${p.validation.passed}/${p.validation.passed + p.validation.failed}`, l: "comprobaciones superadas", d: "ejecución documentada" },
              {
                v: p.validation.horizons_reference_rows,
                l: "contrastes con JPL Horizons",
                d: `Δ máx. ${formatNumber(Math.max(p.validation.max_horizons_az_delta_deg, p.validation.max_horizons_el_delta_deg) * 3600, 3)}″`,
              },
              { v: p.source_assets.length, l: "fuentes NASA registradas", d: "PGDA 78/90 · NAIF" },
              { v: p.comparison_count * 4, l: "decisiones A/B", d: `${p.comparison_count} comparaciones × 4 criterios` },
            ].map((k) => (
              <div key={k.l} className="rounded-xl border border-line bg-bg-2/70 p-3">
                <p className="tabular text-2xl font-bold text-ink">{k.v}</p>
                <p className="text-xs text-ink-muted">{k.l}</p>
                <p className="text-[10px] text-ink-faint">{k.d}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Qué hace única a SITE REGRET</h3>
          <ul className="grid gap-3 md:grid-cols-3">
            {UNIQUE.map((u) => (
              <li key={u.title} className="rounded-xl border border-line bg-bg-2/60 p-3">
                <Icon name={u.icon} className="size-5 text-accent" />
                <p className="mt-2 text-sm font-semibold text-ink">{u.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{u.text}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <nav aria-label="Secciones de la aplicación" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {NAV.filter((n) => n.href !== "/").map((n) => (
          <Link key={n.href} href={`${n.href}?${query}`} className="group flex flex-col gap-2 rounded-2xl border border-line bg-surface/85 p-4 transition-all hover:-translate-y-0.5 hover:border-accent/50">
            <span className="flex items-center gap-2 font-semibold text-ink">
              <Icon name={n.icon} className="size-5 text-ink-muted group-hover:text-accent" />
              {n.label}
            </span>
            <span className="text-xs text-ink-muted">{n.summary}</span>
          </Link>
        ))}
      </nav>

      <p className="text-center text-[11px] text-ink-faint">
        Resultados condicionados al modelo y a estas superficies: visibilidad geométrica del centro de Sol y Tierra. No implica energía, enlace de radio, seguridad de alunizaje
        ni respaldo de la NASA.
      </p>
    </div>
  );
}

export function HomeView() {
  return <DataGate>{({ core }) => <Body core={core} />}</DataGate>;
}
