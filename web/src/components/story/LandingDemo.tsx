"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { SiteId } from "@/lib/contract/constants";
import type { Core, EphemerisClockChunk, HorizonChunk, ScenarioChunk } from "@/lib/contract/schema";
import { useChunk } from "@/lib/data/DataProvider";
import { loadEphemerisClock, loadHorizonChunk, loadScenarioChunk } from "@/lib/data/loader";
import { getScenarioSeries, getSite } from "@/lib/data/selectors";
import { formatHoursMinutes, formatUtcDate } from "@/lib/format";
import { L, R } from "@/lib/i18n";
import { SITE_META } from "@/lib/labels";
import {
  DEMO_LIMIT_HOURS,
  LANDING_DEMO,
  earthComesAndGoes,
  regretOfChoice,
  siteReading,
  stepCase,
  zeroStreakSurfaces,
  type Compliance,
  type SiteReading,
} from "@/lib/science/landingDemo";
import { HorizonChart } from "../charts/HorizonChart";
import { ChunkGate } from "../data/DataGate";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Interactive";
import { DemoStrips } from "./DemoStrips";
import { PairMap } from "./PairMap";

const hm = formatHoursMinutes;
const SITES: SiteId[] = ["A", "B"];
/** 0 = elegir (horas ocultas); 1 = descubrir con el relieve de referencia; 2 = relieve alternativo y regret; 3 = extra, observador a 2 m. */
type Phase = 0 | 1 | 2 | 3;
const stepOf = (p: Phase) => (p <= 1 ? 0 : p === 2 ? 1 : 2);

const terrainLabel = (step: number) =>
  LANDING_DEMO.steps[step].variant === "nominal" ? L("Relieve de referencia", "Reference terrain") : L("Relieve alternativo · hipótesis del equipo", "Alternative terrain · team hypothesis");

function StatusTag({ c }: { c: Compliance }) {
  const meta =
    c === "meets"
      ? { cls: "border-ok/50 bg-ok/15 text-ok", icon: "check" as const, text: L(`Cumple el límite de ${DEMO_LIMIT_HOURS} h`, `Within the ${DEMO_LIMIT_HOURS} h limit`) }
      : c === "exceeds"
        ? { cls: "border-warn/60 bg-warn/15 text-warn", icon: "alert" as const, text: L(`Supera el límite de ${DEMO_LIMIT_HOURS} h`, `Over the ${DEMO_LIMIT_HOURS} h limit`) }
        : { cls: "border-line-strong bg-surface-2 text-ink-muted", icon: "info" as const, text: L("No determinable: hay horas desconocidas", "Not determinable: some hours are unknown") };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold ${meta.cls}`} data-compliance={c}>
      <Icon name={meta.icon} className="size-4" />
      {meta.text}
    </span>
  );
}

function SiteCard({ r, prev, chosen, revealed, onChoose, roi }: { r: SiteReading; prev: SiteReading | null; chosen: boolean; revealed: boolean; onChoose: () => void; roi: number }) {
  const meta = SITE_META[r.site];
  const changed = prev && prev.hours !== r.hours;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      onClick={onChoose}
      data-testid={`demo-card-${r.site}`}
      className={`relative flex min-w-0 flex-col items-start gap-2 rounded-2xl border-2 bg-surface/90 p-4 text-left transition-all sm:p-5 ${
        chosen ? `${meta.borderClass} ${r.site === "A" ? "shadow-[0_0_40px_-12px_#ff8a1f]" : "shadow-[0_0_40px_-12px_#22d3ee]"}` : "border-line hover:border-line-strong"
      }`}
    >
      <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`inline-block size-3 rounded-full ${meta.bgClass}`} aria-hidden />
        <span className={`text-lg font-bold whitespace-nowrap ${meta.textClass}`}>{meta.label}</span>
        <span className="hidden text-xs text-ink-faint sm:inline">ROI {roi}</span>
      </span>
      {chosen ? (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold text-[#050912] ${meta.bgClass}`} data-testid={`demo-choice-${r.site}`}>
          {L("Tu elección", "Your choice")}
        </span>
      ) : (
        <span className="rounded-full border border-dashed border-line-strong px-2.5 py-0.5 text-xs text-ink-faint">{L("Pulsa para elegir", "Tap to choose")}</span>
      )}
      <span key={revealed ? `${r.hours}` : "hidden"} className={`animate-rise tabular flex flex-wrap gap-x-3 text-4xl leading-none font-bold sm:text-5xl 2xl:text-6xl ${meta.textClass}`} data-testid={`demo-hours-${r.site}`} data-revealed={revealed ? "true" : "false"}>
        {revealed ? (
          (r.hours === null ? "—" : hm(r.hours)).split(/(?<=h) /).map((part, i) => (
            <Fragment key={part}>
              {i ? " " : null}
              <span className="whitespace-nowrap">{part}</span>
            </Fragment>
          ))
        ) : (
          <span>?</span>
        )}
      </span>
      <span className="text-sm text-ink-muted">{revealed ? L("Mayor racha sin Sol", "Longest stretch without sunlight") : L("¿Cuántas horas seguidas sin Sol? Elige para descubrirlo", "How many hours in a row without sunlight? Choose to find out")}</span>
      {revealed ? <StatusTag c={r.compliance} /> : null}
      {revealed && changed && prev?.hours !== null ? (
        <span className="text-xs text-ink-faint">
          {L("antes", "before")}: {hm(prev!.hours!)}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Salidas «Ver explicación» y «Ver evidencia» de cada paso. Antes de cambiar el terreno explica,
 * sin gráficos, por qué una montaña tapa el Sol en el polo; después compara el horizonte del
 * paquete del mismo sitio y altura con los dos terrenos.
 */
function Explain({ site, step, compare }: { site: SiteId; step: number; compare: boolean }) {
  const [open, setOpen] = useState(false);
  const { variant, heightM } = LANDING_DEMO.steps[step];
  const hz = useChunk(open && compare ? () => loadHorizonChunk(site, heightM) : null, [site, heightM, open, compare]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-fit text-sm text-accent underline underline-offset-2" data-testid="demo-why">
          {open ? L("Ocultar explicación", "Hide explanation") : L("Ver explicación", "See the explanation")}
        </button>
        <Link href="/evidencia/" className="text-sm text-accent underline underline-offset-2" data-testid="demo-evidence">
          {L("Ver evidencia", "See the evidence")}
        </Link>
      </div>
      {open ? (
        <div className="rounded-xl border border-line bg-bg-2/80 p-3" data-testid="demo-why-panel">
          {compare ? (
            <>
              <p className="mb-2 text-xs text-ink-muted">
                {L(
                  `Horizonte de ${SITE_META[site].label} a ${heightM} m con el relieve de referencia y con el alternativo: mismo sitio y misma altura del observador; solo cambia la estimación del terreno. Un horizonte unas décimas de grado más alto tapa el Sol, que en el polo pasa rozándolo. El relieve alternativo es una hipótesis del equipo, no una medida de la NASA.`,
                  `${SITE_META[site].label} horizon at ${heightM} m with the reference and the alternative terrain: same site and observer height; only the terrain estimate changes. A horizon a few tenths of a degree higher hides the Sun, which grazes it at the pole. The alternative terrain is a team hypothesis, not a NASA measurement.`,
                )}
              </p>
              <ChunkGate state={hz} label={L("horizonte", "horizon")}>
                {(h: HorizonChunk) => (
                  <HorizonChart
                    title={L(`Horizonte de ${SITE_META[site].label}: referencia frente a alternativo`, `${SITE_META[site].label} horizon: reference vs alternative`)}
                    series={[
                      { key: "ref", label: L("Referencia", "Reference"), color: "var(--color-ink-muted)", azimuthDeg: h.azimuth_deg, elevationDeg: h.variants.nominal.elevation_deg, unknown: h.variants.nominal.unknown },
                      { key: "alt", label: L("Alternativo", "Alternative"), color: "var(--color-uncertainty)", azimuthDeg: h.azimuth_deg, elevationDeg: h.variants[variant].elevation_deg, unknown: h.variants[variant].unknown, emphasis: true },
                    ]}
                  />
                )}
              </ChunkGate>
            </>
          ) : (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-muted" data-testid="demo-plain-explanation">
              <li>{L("En el polo sur de la Luna el Sol nunca sube: da la vuelta casi a ras del horizonte.", "At the Moon's south pole the Sun never climbs: it circles almost level with the horizon.")}</li>
              <li>{L("Por eso cualquier montaña que quede delante puede taparlo durante horas o días.", "So any mountain in the way can hide it for hours or days.")}</li>
              <li>
                {L(
                  "Aquí contamos el tramo seguido más largo en que el centro del Sol queda oculto, en 30 días concretos. Sale de un cálculo con el relieve medido por la sonda LRO de la NASA; la web no lo recalcula.",
                  "Here we count the longest unbroken stretch with the Sun's centre hidden, over 30 specific days. It comes from a computation on the relief measured by NASA's LRO spacecraft; the website does not recompute it.",
                )}
              </li>
              <li>{L("Es visibilidad geométrica: no dice cuánta energía hay ni si el sitio es seguro para alunizar.", "This is geometric visibility: it says nothing about available power or whether the site is safe to land on.")}</li>
            </ul>
          )}
          <p className="mt-2 flex flex-wrap gap-x-4 text-xs">
            {compare ? (
              <Link href={`/regret-lab/?s=${site}&w=${LANDING_DEMO.windowId}&h=${heightM}&v=${variant}&c=${LANDING_DEMO.criterion}#terreno-variante`} className="text-accent underline underline-offset-2">
                {L("Ver el terreno en Regret Lab", "See the terrain in Regret Lab")}
              </Link>
            ) : null}
            <Link href="/evidencia/" className="text-accent underline underline-offset-2">
              {L("Fuentes y método (Evidencia)", "Sources and method (Evidence)")}
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * El giro de la demo: el regret del motor al pasar del relieve de referencia al alternativo,
 * explicado sin jerga. Las horas son `regret_A_hours` / `regret_B_hours` del paquete y los
 * mejores sitios son los `winner` del motor; aquí no se calcula nada.
 */
function RegretReveal({ core, choice }: { core: Core; choice: SiteId }) {
  const other: SiteId = choice === "A" ? "B" : "A";
  const mine = regretOfChoice(core, 1, choice);
  const theirs = regretOfChoice(core, 1, other);
  const best0 = stepCase(core, 0)?.winner;
  const best1 = stepCase(core, 1)?.winner;
  const name = (w: string | undefined) => (w === "A" || w === "B" ? SITE_META[w].label : w === "TIE" ? L("empate", "a tie") : L("no determinable", "not determinable"));
  return (
    <div className="animate-rise rounded-2xl border border-uncertainty/60 bg-uncertainty-soft p-4" data-testid="demo-regret" data-regret-hours={mine ?? ""}>
      <p className="text-xs font-bold tracking-[0.18em] text-uncertainty uppercase">{L("Regret · el coste de equivocarse de mapa", "Regret · the cost of trusting the wrong map")}</p>
      <p className="tabular mt-1 text-3xl leading-none font-bold text-uncertainty sm:text-4xl" data-testid="demo-regret-value">
        {mine === null ? "—" : hm(mine)}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink">
        {mine === null
          ? L("Con horas desconocidas no se puede calcular.", "It cannot be computed with unknown hours.")
          : mine > 0
            ? L(
                `Es el precio de haber elegido con un mapa del terreno que resultó ser distinto: ${hm(mine)} seguidas de más sin Sol respecto al sitio que habría sido mejor.`,
                `It is the price of having chosen with a terrain map that turned out to be different: ${hm(mine)} more in a row without sunlight than the site that would have been best.`,
              )
            : theirs !== null && theirs > 0
              ? L(
                  `Tu sitio aguanta el cambio de mapa: no pagas nada. Quien se hubiera quedado con ${SITE_META[other].label} pagaría ${hm(theirs)} de más sin Sol. Ese precio de elegir con un mapa que resultó distinto es el «regret».`,
                  `Your site survives the map change: you pay nothing. Whoever had kept ${SITE_META[other].label} would pay ${hm(theirs)} more without sunlight. That price of choosing with a map that turned out different is the “regret”.`,
                )
              : L("En este escenario ninguna de las dos elecciones cuesta horas de más.", "In this scenario neither choice costs extra hours.")}
      </p>
      <p className="mt-2 text-sm text-ink-muted" data-testid="demo-best-choice">
        {L("Mejor elección con el mapa de referencia: ", "Best choice with the reference map: ")}
        <strong className="text-ink">{name(best0)}</strong>
        {L(" · con el mapa alternativo: ", " · with the alternative map: ")}
        <strong className="text-ink">{name(best1)}</strong>
      </p>
    </div>
  );
}

export function LandingDemo({ core }: { core: Core }) {
  const [phase, setPhase] = useState<Phase>(0);
  const [choice, setChoice] = useState<SiteId | null>(null);
  const step = stepOf(phase);
  const { windowId } = LANDING_DEMO;
  const { heightM } = LANDING_DEMO.steps[step];
  const win = core.configuration.windows.find((w) => w.id === windowId)!;
  const scen = useChunk(() => loadScenarioChunk(core, windowId, heightM), [windowId, heightM]);
  const clock = useChunk(() => loadEphemerisClock(core, windowId), [windowId]);

  const readings = SITES.map((s) => siteReading(core, s, step));
  const prevStep = phase === 2 ? 0 : phase === 3 ? 1 : null;
  const prev = (s: SiteId) => (prevStep === null ? null : siteReading(core, s, prevStep));
  const choose = (s: SiteId) => {
    setChoice(s);
    if (phase === 0) setPhase(1);
  };
  const reset = () => {
    setChoice(null);
    setPhase(0);
  };

  const read = (s: SiteId) => readings.find((r) => r.site === s)!;
  const other = (s: SiteId): SiteId => (s === "A" ? "B" : "A");

  // Un solo mensaje principal y una sola acción por paso.
  let message: React.ReactNode;
  let action: { label: string; onClick: () => void; icon: "arrowRight" | "height" | "reset" } | null = null;
  if (phase === 0 || !choice) {
    message = L("Pulsa Sitio A o Sitio B para elegir dónde alunizar. Después verás cuántas horas seguidas se queda cada uno sin Sol.", "Tap Site A or Site B to choose where to land. Then you will see how many hours in a row each one goes without sunlight.");
  } else if (phase === 1) {
    const c = read(choice);
    message =
      c.compliance === "meets"
        ? R("Con el relieve de referencia, {s} cumple el límite: su mayor racha sin Sol es {h}.", "With the reference terrain, {s} stays within the limit: its longest stretch without sunlight is {h}.", { s: <strong>{SITE_META[choice].label}</strong>, h: <strong>{hm(c.hours!)}</strong> })
        : c.compliance === "exceeds"
          ? R("Con el relieve de referencia, {s} supera el límite: {h} seguidas sin Sol.", "With the reference terrain, {s} goes over the limit: {h} in a row without sunlight.", { s: <strong>{SITE_META[choice].label}</strong>, h: <strong>{hm(c.hours!)}</strong> })
          : L("Con estos datos no se puede afirmar si cumple el límite.", "With these data it cannot be stated whether it stays within the limit.");
    const best = stepCase(core, 0)?.winner;
    if (best === "A" || best === "B")
      message = (
        <>
          {message}{" "}
          <span className="font-normal text-ink-muted" data-testid="demo-best-reference">
            {best === choice
              ? L("Con este mapa del terreno es la mejor de las dos opciones.", "With this terrain map it is the better of the two options.")
              : L(`Con este mapa del terreno, ${SITE_META[best].label} era mejor opción.`, `With this terrain map, ${SITE_META[best].label} was the better option.`)}
          </span>
        </>
      );
    action = { label: L("Prueba otro modelo del terreno", "Test another terrain model"), onClick: () => setPhase(2), icon: "arrowRight" };
  } else if (phase === 2) {
    const regret = regretOfChoice(core, 1, choice);
    const c = read(choice);
    const winner = stepCase(core, 1)?.winner;
    const over = c.compliance === "exceeds";
    message =
      regret !== null && regret > 0
        ? R(
            "Conservar {s} supone {r} más sin Sol que elegir {o} en este escenario.",
            "Keeping {s} means {r} more without sunlight than choosing {o} in this scenario.",
            { s: <strong>{choice}</strong>, r: <strong className="text-uncertainty">{hm(regret)}</strong>, o: <strong>{other(choice)}</strong> },
          )
        : winner === choice
          ? over
            ? R("Tu elección, {s}, ahora queda por delante de {o} ({a} frente a {b}), pero aun así supera las {l} h.", "Your choice, {s}, is now ahead of {o} ({a} vs {b}), but it still goes over {l} h.", {
                s: <strong>{choice}</strong>,
                o: <strong>{other(choice)}</strong>,
                a: <strong>{hm(c.hours!)}</strong>,
                b: <strong>{hm(read(other(choice)).hours!)}</strong>,
                l: DEMO_LIMIT_HOURS,
              })
            : R("Tu elección, {s}, ahora queda por delante de {o}.", "Your choice, {s}, is now ahead of {o}.", { s: <strong>{choice}</strong>, o: <strong>{other(choice)}</strong> })
          : L("Con este relieve los dos sitios quedan empatados.", "With this terrain the two sites are tied.");
    action = { label: L("Eleva el observador a 2 m", "Raise the observer to 2 m"), onClick: () => setPhase(3), icon: "height" };
  } else {
    const z = zeroStreakSurfaces(core, 2);
    const earth = SITES.every((s) => earthComesAndGoes(core, s, 2));
    const both = readings.every((r) => r.compliance === "meets");
    message = (
      <>
        {both
          ? L(
              `Los dos sitios cumplen el límite de Sol a 2 m en esta prueba.${earth ? " La visibilidad de la Tierra sigue apareciendo y desapareciendo." : ""}`,
              `Both sites meet the sunlight limit at 2 m in this test.${earth ? " Earth visibility still comes and goes." : ""}`,
            )
          : L("A 2 m no se cumple el límite en ambos sitios.", "At 2 m the limit is not met at both sites.")}
        <span className="mt-1 block text-sm font-normal text-ink-muted" data-testid="demo-surfaces">
          {L(
            `0 h sin Sol en A y B en ${z.count} de las ${z.total} superficies evaluadas para esta ventana a 2 m (comprobado en el paquete).`,
            `0 h without sunlight at A and B in ${z.count} of the ${z.total} terrain scenarios evaluated for this window at 2 m (checked in the package).`,
          )}
        </span>
      </>
    );
    action = { label: L("Reiniciar demo", "Restart demo"), onClick: reset, icon: "reset" };
  }

  // Tres pasos: elegir, descubrir y cambiar el terreno (el giro: regret). Subir el observador es un extra.
  const stepNames = [L("Elige", "Choose"), L("Descubre", "Discover"), L("Cambia el terreno", "Change the terrain")];
  const activeStep = Math.min(phase, 2);
  const revealed = phase > 0 && choice !== null;

  return (
    <section className="story-root relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-[#0a1430] via-bg to-[#120c2c] p-4 sm:p-7" data-testid="landing-demo" data-phase={phase} data-step={step}>
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Connecting Ridge · {windowId} · {formatUtcDate(win.start)} – {formatUtcDate(win.stop)} UTC
        </p>
        <a href="#pregunta" className="ml-auto text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline" data-testid="demo-full-presentation">
          {L("Presentación completa", "Full presentation")}
        </a>
      </div>

      <div className="relative">
        <h1 className="story-heading max-w-5xl text-3xl font-bold leading-tight text-ink sm:text-4xl xl:text-5xl">
          {L(`Tu misión puede aguantar ${DEMO_LIMIT_HOURS} horas sin Sol. ¿Dónde alunizarías?`, `Your mission can handle ${DEMO_LIMIT_HOURS} hours without sunlight. Where would you land?`)}
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-ink-faint">
          {L(
            `Las ${DEMO_LIMIT_HOURS} h son un límite ilustrativo de esta demo, no un requisito de misión. Racha sin Sol = el mayor tramo continuo sin el centro del Sol por encima del horizonte, según el motor de SITE REGRET.`,
            `The ${DEMO_LIMIT_HOURS} h is an illustrative limit for this demo, not a mission requirement. Stretch without sunlight = the longest continuous period without the Sun's centre above the horizon, as computed by the SITE REGRET engine.`,
          )}
        </p>
      </div>

      <ol className="relative flex flex-wrap gap-2" aria-label={L("Pasos de la demo", "Demo steps")}>
        {stepNames.map((n, i) => (
          <li key={n} aria-current={i === activeStep && phase < 3 ? "step" : undefined} className={`rounded-full border px-3 py-1 text-xs font-semibold ${i === activeStep && phase < 3 ? "border-accent bg-accent-surface text-ink" : i < activeStep ? "border-accent/40 text-ink-muted" : "border-line text-ink-faint"}`}>
            {i + 1} · {n}
          </li>
        ))}
        {phase === 3 ? (
          <li aria-current="step" className="rounded-full border border-accent bg-accent-surface px-3 py-1 text-xs font-semibold text-ink" data-testid="demo-extra-step">
            {L("Extra · Observador a 2 m", "Extra · Observer at 2 m")}
          </li>
        ) : null}
        <li className="ml-auto flex flex-wrap gap-2 text-xs" data-testid="demo-scenario">
          <span className={`rounded-full border px-3 py-1 ${step > 0 ? "border-uncertainty/60 bg-uncertainty-soft text-uncertainty" : "border-line text-ink-muted"}`}>{terrainLabel(step)}</span>
          <span className={`rounded-full border px-3 py-1 ${heightM > 0 ? "border-accent bg-accent-surface text-ink" : "border-line text-ink-muted"}`}>
            {L("Altura del observador", "Observer height")}: {heightM} m
          </span>
        </li>
      </ol>

      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div role="radiogroup" aria-label={L("¿Dónde alunizarías?", "Where would you land?")} className="grid grid-cols-2 gap-3">
            {readings.map((r) => (
              <SiteCard key={r.site} r={r} prev={prev(r.site)} chosen={choice === r.site} revealed={revealed} onChoose={() => choose(r.site)} roi={getSite(core, r.site)!.roi} />
            ))}
          </div>
          {phase === 2 && choice ? <RegretReveal core={core} choice={choice} /> : null}
          <div className="rounded-2xl border border-accent/40 bg-bg-2/90 p-4" aria-live="polite" data-testid="demo-message">
            <p className="text-lg font-semibold leading-snug text-ink sm:text-xl">{message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {action ? (
                <Button variant={action.icon === "reset" ? "secondary" : "primary"} className="px-5! py-3! text-base! font-semibold" icon={action.icon === "reset" ? "reset" : action.icon === "height" ? "height" : undefined} iconRight={action.icon === "arrowRight" ? "arrowRight" : undefined} onClick={action.onClick}>
                  {action.label}
                </Button>
              ) : null}
              {phase > 0 && action?.icon !== "reset" ? (
                <button type="button" onClick={reset} className="text-sm text-ink-faint underline-offset-2 hover:text-ink hover:underline" data-testid="demo-reset">
                  {L("Reiniciar demo", "Restart demo")}
                </button>
              ) : null}
            </div>
            <div className="mt-3">
              <Explain key={phase >= 2 ? "compare" : "plain"} site={choice ?? "A"} step={step} compare={phase >= 2 && choice !== null} />
            </div>
          </div>
        </div>
        <figure className="flex min-w-0 flex-col gap-2 lg:order-first">
          <PairMap a={getSite(core, "A")!} b={getSite(core, "B")!} />
          <figcaption className="text-[11px] text-ink-faint">
            {L(
              "Relieve de Connecting Ridge (figura DEM PGDA78 del paquete, 40 m/píxel; color = altura). Funciona sin conexión.",
              "Connecting Ridge relief (PGDA78 DEM figure from the package, 40 m/pixel; colour = height). Works offline.",
            )}
          </figcaption>
        </figure>
      </div>

      {revealed ? (
      <div className="animate-rise relative rounded-2xl border border-line bg-surface/80 p-3 sm:p-4" data-testid="demo-strips-panel">
        <p className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span className="font-semibold text-ink">{L("30 días de la ventana, cada 10 min", "30 days of the window, every 10 min")}</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "var(--color-state-sun)" }} />{L("Sol visible", "Sun visible")}</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "var(--color-state-earth)" }} />{L("Tierra visible (geométrica)", "Earth visible (geometric)")}</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "var(--color-state-neither)" }} />{L("No visible", "Not visible")}</span>
          <span className="inline-flex items-center gap-1.5"><span className="pattern-hatch inline-block h-2.5 w-4 rounded-sm" />{L("Desconocido", "Unknown")}</span>
          <span>{L("Recuadro = mayor racha sin Sol", "Box = longest stretch without sunlight")}</span>
        </p>
        <ChunkGate state={clock} label={L("reloj", "clock")} minHeight="min-h-24">
          {(c: EphemerisClockChunk) => (
            <ChunkGate state={scen} label={L("estados", "states")} minHeight="min-h-24">
              {(s: ScenarioChunk) => (
                <DemoStrips times={c.times_utc} rows={SITES.map((site) => ({ site, codes: getScenarioSeries(s.rows, site, LANDING_DEMO.steps[step].variant)!.state_codes }))} />
              )}
            </ChunkGate>
          )}
        </ChunkGate>
      </div>
      ) : null}
    </section>
  );
}
