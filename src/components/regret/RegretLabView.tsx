"use client";

import { useEffect, useState } from "react";
import {
  HEIGHTS_M,
  SITE_IDS,
  VARIANTS,
  WINDOW_IDS,
  variantFamily,
  type SiteId,
  type Variant,
  type Winner,
} from "@/lib/contract/constants";
import type { Core, CriterionResult } from "@/lib/contract/schema";
import { getCriterionResult, getScenarioSummary } from "@/lib/data/selectors";
import { formatHoursMinutes, formatNumber } from "@/lib/format";
import { CRITERION_META, FAMILY_META, SITE_META, VARIANT_LABEL, WINNER_LABEL } from "@/lib/labels";
import { OUTCOME_LABEL, familyCounts, otherSite, outcomeOf, regretOfKeeping, type FamilyCounts, type Outcome } from "@/lib/science/decision";
import { DEMO_CASE, DEMO_HASH, relevantPerturbation } from "@/lib/science/demo";
import { CRITERION_METRIC, METRIC_META } from "@/lib/science/metrics";
import { useSelection } from "@/lib/state/SelectionProvider";
import { DivergingBar } from "../charts/Bars";
import { ControlBar } from "../data/ControlBar";
import { CriterionPicker } from "../data/CriterionPicker";
import { DataGate } from "../data/DataGate";
import { ExportButtons } from "../data/ExportButtons";
import { CriterionControl, HeightControl, WindowControl } from "../data/SelectionControls";
import { Segmented } from "../ui/Controls";
import { Badge, Callout, NatureBadge, SiteDot, StatTile, WinnerTag } from "../ui/Display";
import { Icon } from "../ui/Icon";
import { Button, InfoTip, LinkButton } from "../ui/Interactive";
import { PageHeader, Panel } from "../ui/Panel";

const OUTCOME_STYLE: Record<Outcome, string> = {
  same: "border-ok/40 bg-ok/10 text-ok",
  tie: "border-line-strong bg-surface-2 text-ink-muted",
  inverted: "border-uncertainty/60 bg-uncertainty-soft text-uncertainty",
  unknown: "border-warn/40 bg-warn/10 text-warn",
  not_applicable: "border-line bg-surface-2 text-ink-faint",
};

function OutcomeTag({ outcome }: { outcome: Outcome }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${OUTCOME_STYLE[outcome]}`}>
      {outcome === "inverted" ? <Icon name="shuffle" className="size-3" /> : outcome === "same" ? <Icon name="check" className="size-3" /> : null}
      {OUTCOME_LABEL[outcome]}
    </span>
  );
}

const fmtMetric = (v: number | undefined) => (v === undefined ? "—" : formatHoursMinutes(v));

/* ------------------------------------------------------------------------ */

function FamilyBlock({
  core,
  result,
  counts,
  keep,
  selected,
  onSelect,
}: {
  core: Core;
  result: CriterionResult;
  counts: FamilyCounts | "nominal";
  keep: SiteId | null;
  selected: Variant;
  onSelect: (v: Variant) => void;
}) {
  const isNominal = counts === "nominal";
  const variants: Variant[] = isNominal ? ["nominal"] : counts.variants;
  const family = isNominal ? "nominal" : counts.family;
  const { selection } = useSelection();
  const metric = CRITERION_METRIC[selection.criterion!];
  const maxD = Math.max(result.tie_tolerance_hours, ...variants.map((v) => Math.abs(result.cases[v].D_hours ?? 0)));
  const maxRegret = keep ? Math.max(0, ...variants.map((v) => regretOfKeeping(result.cases[v], keep) ?? 0)) : 0;
  const nominalAB = result.nominal_winner === "A" || result.nominal_winner === "B";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">{FAMILY_META[family].label}</h3>
        <NatureBadge nature={family === "nominal" ? "DERIVED" : family === "own" ? "MODELED" : "OBSERVED"} />
        {isNominal ? null : (
        <span className="ml-auto flex flex-wrap gap-1.5 text-xs">
          {nominalAB ? (
            <Badge tone="ok">
              Se mantiene {counts.same}/{counts.evaluated}
            </Badge>
          ) : (
            <Badge tone="neutral">Sin elección nominal</Badge>
          )}
          <Badge tone="neutral">Empates {counts.tie}</Badge>
          {nominalAB ? <Badge tone="uncertainty">Inversiones {counts.inverted}</Badge> : null}
        </span>
        )}
      </div>
      <p className="text-xs text-ink-faint">{FAMILY_META[family].description}</p>
      <div className="flex flex-col gap-1" role="group" aria-label="Superficies">
        {variants.map((v) => {
          const cs = result.cases[v];
          const outcome = outcomeOf(result.nominal_winner, cs.winner);
          const a = getScenarioSummary(core, { siteId: "A", windowId: selection.windowId, heightM: selection.heightM, variant: v })?.metrics[metric];
          const b = getScenarioSummary(core, { siteId: "B", windowId: selection.windowId, heightM: selection.heightM, variant: v })?.metrics[metric];
          const r = keep ? regretOfKeeping(cs, keep) : null;
          const active = selected === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onSelect(v)}
              aria-pressed={active}
              className={`grid grid-cols-[minmax(7.5rem,1fr)_4.6rem_4.6rem_minmax(6rem,1.4fr)_3.8rem_6.5rem_minmax(5rem,1fr)] items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                active
                  ? "border-uncertainty/70 bg-gradient-to-r from-uncertainty-soft to-transparent shadow-[0_0_24px_-10px_#a78bfa]"
                  : outcome === "inverted"
                    ? "border-uncertainty/30 bg-bg-2/80 hover:border-uncertainty/60"
                    : "border-line/70 bg-bg-2/60 hover:border-line-strong hover:bg-surface-2"
              }`}
            >
              <span className={`truncate ${active ? "font-semibold text-ink" : "text-ink-muted"}`}>{VARIANT_LABEL[v]}</span>
              <span className="tabular text-right font-semibold text-site-a">{fmtMetric(a)}</span>
              <span className="tabular text-right font-semibold text-site-b">{fmtMetric(b)}</span>
              <DivergingBar value={cs.D_hours} max={maxD} tie={cs.winner === "TIE"} />
              <span className="text-center">
                <WinnerTag winner={cs.winner} short />
              </span>
              <span>
                {v === "nominal" ? <Badge tone="neutral">Referencia</Badge> : <OutcomeTag outcome={outcome} />}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3/70">
                  <span
                    className="block h-full rounded-full bg-uncertainty transition-[width] duration-500"
                    style={{ width: `${r && maxRegret > 0 ? Math.max(3, (r / maxRegret) * 100) : 0}%`, boxShadow: r ? "0 0 10px -2px #a78bfa" : undefined }}
                  />
                </span>
                <span className="tabular w-16 text-right font-semibold text-uncertainty">{r === null ? "—" : formatHoursMinutes(r)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {isNominal ? null : <p className="text-[10px] text-ink-faint">
        Escala de la familia: D máx. {formatHoursMinutes(maxD)} · regret máx. {formatHoursMinutes(maxRegret)}. Las familias usan escalas distintas para no ocultar diferencias pequeñas.
      </p>}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function SurfaceDetail({ core, result, keep }: { core: Core; result: CriterionResult; keep: SiteId | null }) {
  const { selection, query } = useSelection();
  const v = selection.variant;
  const cs = result.cases[v];
  const metric = CRITERION_METRIC[selection.criterion!];
  const outcome = outcomeOf(result.nominal_winner, cs.winner);
  const fam = variantFamily(v);
  const a = getScenarioSummary(core, { siteId: "A", windowId: selection.windowId, heightM: selection.heightM, variant: v })!;
  const b = getScenarioSummary(core, { siteId: "B", windowId: selection.windowId, heightM: selection.heightM, variant: v })!;
  const r = keep ? regretOfKeeping(cs, keep) : null;
  const glow = outcome === "inverted";
  return (
    <Panel
      title="Superficie seleccionada"
      icon="layers"
      className={glow ? "border-uncertainty/60 shadow-[0_0_48px_-18px_#a78bfa]" : ""}
      actions={fam === "nominal" ? <NatureBadge nature="DERIVED" /> : <NatureBadge nature={fam === "own" ? "MODELED" : "OBSERVED"} />}
    >
      <div key={`${v}-${selection.windowId}-${selection.heightM}-${selection.criterion}`} className="animate-rise flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-ink-faint">{FAMILY_META[fam].label}</p>
          <p className="text-2xl font-bold text-ink">{VARIANT_LABEL[v]}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {SITE_IDS.map((s) => (
            <div key={s} className={`rounded-xl border p-3 ${cs.winner === s ? `${SITE_META[s].borderClass} bg-surface-2` : "border-line bg-bg-2/70"}`}>
              <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                <SiteDot site={s} /> {SITE_META[s].label}
              </p>
              <p className={`tabular mt-1 text-xl font-bold ${SITE_META[s].textClass}`}>{formatHoursMinutes((s === "A" ? a : b).metrics[metric])}</p>
              <p className="text-[11px] text-ink-faint">{METRIC_META[metric].label.toLowerCase()}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted">Resultado:</span>
          <WinnerTag winner={cs.winner} />
          <OutcomeTag outcome={outcome} />
        </div>
        <div className="rounded-xl border border-uncertainty/40 bg-uncertainty-soft p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-uncertainty">
            REGRET de conservar {keep ?? "—"}
            <InfoTip>
              regret_{keep ?? "X"}_hours = max(U_A, U_B) − U_{keep ?? "X"}: horas de la métrica del criterio que se pierden por mantener esa elección con esta superficie. 0 si la elección sigue siendo la mejor o empata.
            </InfoTip>
          </p>
          <p className="tabular mt-1 text-3xl font-bold text-ink">{r === null ? "—" : formatHoursMinutes(r)}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {keep === null
              ? "Elige qué sitio conservar para medir su regret."
              : r === 0
                ? `Con esta superficie, ${keep} sigue siendo la mejor opción o empata: no hay pérdida.`
                : `Con esta superficie, mantener ${keep} supone ${formatHoursMinutes(r)} ${METRIC_META[metric].better === "lower" ? "más" : "menos"} de ${METRIC_META[metric].label.toLowerCase()} que elegir ${otherSite(keep)}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/timeline/?${query}`} size="sm" icon="timeline">
            Ver estados en Timeline
          </LinkButton>
          <LinkButton href={`/comparador/?${query}`} size="sm" icon="compare">
            Abrir en Comparador
          </LinkButton>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------------ */

function DecisionMap({ core }: { core: Core }) {
  const { selection, dispatch } = useSelection();
  const criterion = selection.criterion!;
  const cellTone = (w: Winner) =>
    w === "A" ? "bg-site-a/85 text-[#1a0d00]" : w === "B" ? "bg-site-b/85 text-[#00161a]" : w === "TIE" ? "bg-surface-3 text-ink-muted" : "pattern-hatch text-ink";
  return (
    <Panel
      title={`Mapa de decisiones · ${CRITERION_META[criterion].short}`}
      icon="grid"
      actions={<InfoTip>Ganador de cada superficie (columnas) en las 6 combinaciones ventana × altura (filas). El anillo violeta marca superficies que invierten la elección nominal de su fila. Pulsa una celda para seleccionarla.</InfoTip>}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-separate border-spacing-1 text-center text-xs">
          <caption className="sr-only">Ganador por superficie, ventana y altura</caption>
          <thead>
            <tr>
              <th />
              <th colSpan={1} className="pb-1 font-medium text-ink-faint">Nominal</th>
              <th colSpan={4} className="border-b border-uncertainty/40 pb-1 font-medium text-uncertainty">Hipótesis propias</th>
              <th colSpan={5} className="border-b border-line-strong pb-1 font-medium text-ink-muted">Clones publicados</th>
            </tr>
            <tr>
              <th />
              {VARIANTS.map((v) => (
                <th key={v} scope="col" className="px-0.5 font-normal text-ink-faint" title={VARIANT_LABEL[v]}>
                  {v === "nominal" ? "N" : v.startsWith("published_") ? `P${v.slice(-1)}` : v.replace("bias_", "S").replace("correlated_", "CC").replace("plus", "+").replace("minus", "−")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WINDOW_IDS.flatMap((w) =>
              HEIGHTS_M.map((h) => {
                const r = getCriterionResult(core, w, h, criterion)!;
                const rowActive = w === selection.windowId && h === selection.heightM;
                return (
                  <tr key={`${w}${h}`}>
                    <th scope="row" className={`pr-2 text-right font-medium whitespace-nowrap ${rowActive ? "text-ink" : "text-ink-faint"}`}>
                      {w} · {h} m
                    </th>
                    {VARIANTS.map((v) => {
                      const win = r.cases[v].winner;
                      const inv = outcomeOf(r.nominal_winner, win) === "inverted";
                      const active = rowActive && v === selection.variant;
                      return (
                        <td key={v} className="p-0">
                          <button
                            type="button"
                            aria-label={`${w}, ${h} m, ${VARIANT_LABEL[v]}: ${WINNER_LABEL[win]}${inv ? ", invierte la elección nominal" : ""}`}
                            aria-pressed={active}
                            onClick={() => {
                              dispatch({ type: "setWindow", value: w });
                              dispatch({ type: "setHeight", value: h });
                              dispatch({ type: "setVariant", value: v });
                            }}
                            className={`h-8 w-full min-w-8 rounded-md font-bold transition-transform hover:scale-110 ${cellTone(win)} ${
                              inv ? "ring-2 ring-uncertainty ring-offset-1 ring-offset-surface" : ""
                            } ${active ? "outline-2 outline-offset-2 outline-white" : ""} ${v === "nominal" ? "shadow-[inset_0_0_0_2px_#ffffff30]" : ""}`}
                          >
                            {win === "TIE" ? "=" : win === "UNKNOWN" ? "?" : win}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-site-a" />Gana A</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-site-b" />Gana B</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-surface-3" />= Empate (≤ 10 min)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm ring-2 ring-uncertainty" />Invierte la elección nominal</span>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------------ */

const DEMO_STEPS = ["Resultado nominal", "Elegir", "Desafiar el terreno", "Ver el cambio", "Coste REGRET", "Significado y límites"];

function DemoGuide({
  core,
  step,
  setStep,
  setKeep,
  onClose,
}: {
  core: Core;
  step: number;
  setStep: (n: number) => void;
  setKeep: (s: SiteId) => void;
  onClose: () => void;
}) {
  const { dispatch } = useSelection();
  const { windowId, heightM, criterion } = DEMO_CASE;
  const r = getCriterionResult(core, windowId, heightM, criterion)!;
  const nominalWinner = r.nominal_winner;
  const keep: SiteId | null = nominalWinner === "A" || nominalWinner === "B" ? nominalWinner : null;
  const v = keep ? relevantPerturbation(r, keep) : null;
  const metric = CRITERION_METRIC[criterion];
  const val = (s: SiteId, variant: Variant) => getScenarioSummary(core, { siteId: s, windowId, heightM, variant })!.metrics[metric];
  const own = familyCounts(r, "own");
  const pub = familyCounts(r, "published");

  function go(n: number) {
    setStep(n);
    if (n === 0) {
      dispatch({ type: "setWindow", value: windowId });
      dispatch({ type: "setHeight", value: heightM });
      dispatch({ type: "setCriterion", value: criterion });
      dispatch({ type: "setVariant", value: "nominal" });
    }
    if (n === 1 && keep) setKeep(keep);
    if (n === 2 && v) dispatch({ type: "setVariant", value: v });
  }

  const texts = [
    <>
      {windowId} · {heightM} m · <strong>{CRITERION_META[criterion].label.toLowerCase()}</strong>. Con la superficie nominal, la racha más larga sin Sol es{" "}
      <strong className="text-site-a">{formatHoursMinutes(val("A", "nominal"))}</strong> en A y <strong className="text-site-b">{formatHoursMinutes(val("B", "nominal"))}</strong> en B:{" "}
      gana <strong>{WINNER_LABEL[nominalWinner]}</strong>.
    </>,
    <>
      Elegimos <strong className={keep ? SITE_META[keep].textClass : ""}>{keep ? SITE_META[keep].label : "—"}</strong>, el ganador nominal. La pregunta de SITE REGRET: ¿seguiría siendo la mejor elección si el relieve fuese algo distinto?
    </>,
    <>
      Activamos <strong className="text-uncertainty">{v ? VARIANT_LABEL[v] : "—"}</strong>: una de las cuatro hipótesis propias del terreno (X = {formatNumber(core.configuration.hypothesis_X_m, 0)} m, σ = {formatNumber(core.configuration.gaussian_filter_sigma_m, 0)} m, semilla {core.configuration.seed}). Es una hipótesis modelada, no un error NASA medido.
    </>,
    v ? (
      <>
        Con esta superficie, A obtiene <strong className="text-site-a">{formatHoursMinutes(val("A", v))}</strong> y B <strong className="text-site-b">{formatHoursMinutes(val("B", v))}</strong>: ahora gana{" "}
        <strong>{WINNER_LABEL[r.cases[v].winner]}</strong>. La elección se invierte.
      </>
    ) : (
      <>No hay perturbación que cambie el resultado.</>
    ),
    v && keep ? (
      <>
        Conservar {keep} con esta superficie cuesta <strong className="text-uncertainty">{formatHoursMinutes(regretOfKeeping(r.cases[v], keep))}</strong> más de racha sin Sol que cambiar a {otherSite(keep)}. Es el
        peor regret de la familia propia ({formatHoursMinutes(r.robustness.own_sensitivity.worst_regret_of_nominal_choice_hours)}).
      </>
    ) : null,
    <>
      La elección se mantiene en <strong>{own.same}/{own.evaluated}</strong> hipótesis propias ({own.tie} empate, {own.inverted} inversión) y en <strong>{pub.same}/{pub.evaluated}</strong> clones publicados. Son recuentos
      de superficies modeladas, <strong>no probabilidades</strong>; la visibilidad es geométrica y no implica energía ni enlace de radio.
    </>,
  ];

  return (
    <section aria-label="Caso demostrativo guiado" className="animate-rise relative overflow-hidden rounded-2xl border border-uncertainty/50 bg-gradient-to-r from-[#1a1240] via-surface to-surface p-5 shadow-[0_0_60px_-24px_#a78bfa]">
      <div className="flex flex-wrap items-center gap-3">
        <Icon name="sparkles" className="size-5 text-uncertainty" />
        <h2 className="text-lg font-bold text-ink">Caso demostrativo · {windowId} · {heightM} m · {CRITERION_META[criterion].short}</h2>
        <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Cerrar caso demostrativo">
          <Icon name="close" className="size-4" />
        </button>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {DEMO_STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => {
                for (let k = 0; k <= i; k++) go(k);
              }}
              aria-current={i === step ? "step" : undefined}
              className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                i === step ? "border-uncertainty bg-uncertainty-soft text-ink" : i < step ? "border-uncertainty/30 text-ink-muted" : "border-line text-ink-faint hover:text-ink"
              }`}
            >
              <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${i <= step ? "bg-uncertainty text-[#14092e]" : "bg-surface-3"}`}>{i + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <p aria-live="polite" className="mt-4 min-h-12 max-w-5xl text-[15px] leading-relaxed text-ink-muted">
        {texts[step]}
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" icon="stepBack" disabled={step === 0} onClick={() => go(step - 1)}>
          Anterior
        </Button>
        {step < DEMO_STEPS.length - 1 ? (
          <Button size="sm" variant="regret" iconRight="stepForward" onClick={() => go(step + 1)}>
            Siguiente
          </Button>
        ) : (
          <Button size="sm" variant="secondary" icon="reset" onClick={() => go(0)}>
            Repetir
          </Button>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function Conclusion({ result, keep, own, pub }: { result: CriterionResult; keep: SiteId | null; own: FamilyCounts; pub: FamilyCounts }) {
  const { selection } = useSelection();
  const nominalAB = result.nominal_winner === "A" || result.nominal_winner === "B";
  const worst = (fam: FamilyCounts) => (keep ? Math.max(...fam.variants.map((v) => regretOfKeeping(result.cases[v], keep) ?? 0)) : null);
  return (
    <Panel title="Conclusión: robustez de la decisión" icon="shield" className="border-uncertainty/30">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line bg-bg-2/80 p-4 text-[15px] leading-relaxed text-ink-muted">
          {nominalAB ? (
            <>
              Con {selection.windowId}, {selection.heightM} m y el criterio «{CRITERION_META[selection.criterion!].label.toLowerCase()}», la elección nominal es{" "}
              <strong className={SITE_META[result.nominal_winner as SiteId].textClass}>{SITE_META[result.nominal_winner as SiteId].label}</strong>. Se mantiene en{" "}
              <strong className="text-ink">
                {own.same} de {own.evaluated}
              </strong>{" "}
              hipótesis propias ({own.tie} empates, {own.inverted} inversiones) y en{" "}
              <strong className="text-ink">
                {pub.same} de {pub.evaluated}
              </strong>{" "}
              clones publicados ({pub.tie} empates, {pub.inverted} inversiones).
            </>
          ) : (
            <>
              Con {selection.windowId}, {selection.heightM} m y este criterio, la superficie nominal da <strong className="text-ink">{WINNER_LABEL[result.nominal_winner]}</strong>: no hay elección nominal que poner a prueba. Aun así puedes medir el regret de conservar A o B en cada superficie.
            </>
          )}
          {keep ? (
            <>
              {" "}
              Peor regret de conservar <strong className={SITE_META[keep].textClass}>{keep}</strong>: <strong className="text-uncertainty">{formatHoursMinutes(worst(own))}</strong> (propias) y{" "}
              <strong className="text-uncertainty">{formatHoursMinutes(worst(pub))}</strong> (clones).
            </>
          ) : null}
        </div>
        <blockquote className="border-l-2 border-accent pl-3 text-sm leading-relaxed text-ink-muted">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Frase del motor</p>
          {result.summary_es}
        </blockquote>
        <Callout tone="uncertainty" icon="alert" title="Cómo leerlo">
          Son recuentos sobre 4 + 5 superficies concretas, no probabilidades ni percentiles. Una elección estable en esta familia finita también es un hallazgo; un
          contraejemplo indica sensibilidad al relieve, no que el sitio sea inseguro.
        </Callout>
      </div>
    </Panel>
  );
}

function Method({ core }: { core: Core }) {
  const c = core.configuration;
  return (
    <Panel title="Método y límites" icon="book">
      <ul className="flex flex-col gap-2.5 text-sm text-ink-muted">
        <li>
          <strong className="text-ink">Hipótesis propias (4):</strong> sesgo regional ±X y campo correlacionado ±, con X = {formatNumber(c.hypothesis_X_m, 0)} m, σ = {formatNumber(c.gaussian_filter_sigma_m, 0)} m y semilla {c.seed};
          ambos sitios anclados al terreno nominal. Hipótesis editables, no incertidumbre calibrada de LOLA.
        </li>
        <li>
          <strong className="text-ink">Clones publicados (5):</strong> DEM completos del ensemble de PGDA78 Site01 (de 100); el mástil se apoya en la altura del clon. No se suman al nominal.
        </li>
        <li>
          <strong className="text-ink">REGRET:</strong> con utilidad U = signo × métrica, regret_A = max(U_A, U_B) − U_A, en horas del criterio. Empate si |D| ≤ {formatHoursMinutes(c.tie_tolerance_hours)}.
        </li>
        <li>
          <strong className="text-ink">Fracciones:</strong> excluyen el nominal; los empates no cuentan como conservación; si el nominal empata, no se calcula fracción (null).
        </li>
        <li>
          <strong className="text-ink">Sin</strong> Monte Carlo, distribuciones ni probabilidades: el paquete contiene exactamente estas 10 superficies por sitio.
        </li>
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------------ */

function RegretBody({ core }: { core: Core }) {
  const { selection, dispatch } = useSelection();
  const { windowId, heightM, criterion } = selection;
  const [override, setOverride] = useState<{ key: string; site: SiteId } | null>(null);
  const [demoStep, setDemoStep] = useState<number | null>(null);

  // Abrir el caso demostrativo si se llega con #demo (p. ej. desde el Dashboard).
  useEffect(() => {
    if (window.location.hash === DEMO_HASH) {
      const t = setTimeout(() => {
        dispatch({ type: "setWindow", value: DEMO_CASE.windowId });
        dispatch({ type: "setHeight", value: DEMO_CASE.heightM });
        dispatch({ type: "setCriterion", value: DEMO_CASE.criterion });
        dispatch({ type: "setVariant", value: "nominal" });
        setDemoStep(0);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [dispatch]);

  const key = `${windowId}|${heightM}|${criterion}`;
  const result = criterion ? getCriterionResult(core, windowId, heightM, criterion) : undefined;
  const nominalChoice: SiteId | null = result && (result.nominal_winner === "A" || result.nominal_winner === "B") ? result.nominal_winner : null;
  const keep = override?.key === key ? override.site : nominalChoice;
  const setKeep = (s: SiteId) => setOverride({ key, site: s });

  const demo =
    demoStep !== null ? (
      <DemoGuide
        core={core}
        step={demoStep}
        setStep={setDemoStep}
        setKeep={(s) => setOverride({ key: `${DEMO_CASE.windowId}|${DEMO_CASE.heightM}|${DEMO_CASE.criterion}`, site: s })}
        onClose={() => setDemoStep(null)}
      />
    ) : null;

  const startDemo = (
    <Button variant="regret" icon="sparkles" onClick={() => {
      dispatch({ type: "setWindow", value: DEMO_CASE.windowId });
      dispatch({ type: "setHeight", value: DEMO_CASE.heightM });
      dispatch({ type: "setCriterion", value: DEMO_CASE.criterion });
      dispatch({ type: "setVariant", value: "nominal" });
      setDemoStep(0);
    }}>
      <span className="whitespace-nowrap">Caso demostrativo {DEMO_CASE.windowId} · {DEMO_CASE.heightM} m</span>
    </Button>
  );

  const controls = (
    <ControlBar aside={demoStep === null ? startDemo : null}>
      <WindowControl core={core} />
      <HeightControl />
      <CriterionControl />
      {result ? (
        <Segmented
          label="Elección a conservar"
          value={keep ?? "none"}
          onChange={(v) => v !== "none" && setKeep(v)}
          options={[
            ...SITE_IDS.map((s) => ({
              value: s as SiteId | "none",
              ariaLabel: `Conservar ${SITE_META[s].label}`,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <SiteDot site={s} />
                  {s}
                  {s === nominalChoice ? <span className="text-[10px] text-ink-faint">(nominal)</span> : null}
                </span>
              ),
            })),
          ]}
        />
      ) : null}
    </ControlBar>
  );

  if (!criterion || !result)
    return (
      <>
        {demo}
        {controls}
        <Panel title="01 · Elegir el criterio" icon="lock">
          <CriterionPicker />
        </Panel>
      </>
    );

  const own = familyCounts(result, "own");
  const pub = familyCounts(result, "published");
  const metric = CRITERION_METRIC[criterion];
  const nomA = getScenarioSummary(core, { siteId: "A", windowId, heightM, variant: "nominal" })!.metrics[metric];
  const nomB = getScenarioSummary(core, { siteId: "B", windowId, heightM, variant: "nominal" })!.metrics[metric];
  const worstOwn = keep ? Math.max(...own.variants.map((v) => regretOfKeeping(result.cases[v], keep) ?? 0)) : null;
  const worstPub = keep ? Math.max(...pub.variants.map((v) => regretOfKeeping(result.cases[v], keep) ?? 0)) : null;

  return (
    <>
      {demo}
      {controls}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon={METRIC_META[metric].icon} tone="a" label={`${METRIC_META[metric].label} · A (nominal)`} value={formatHoursMinutes(nomA)} detail="Superficie nominal" />
        <StatTile icon={METRIC_META[metric].icon} tone="b" label={`${METRIC_META[metric].label} · B (nominal)`} value={formatHoursMinutes(nomB)} detail="Superficie nominal" />
        <StatTile
          icon="compare"
          label="Elección nominal"
          value={result.nominal_winner === "TIE" ? "Empate" : result.nominal_winner === "UNKNOWN" ? "No determinable" : SITE_META[result.nominal_winner].label}
          detail={`|D| = ${formatHoursMinutes(Math.abs(result.cases.nominal.D_hours ?? 0))} · tolerancia ${formatHoursMinutes(result.tie_tolerance_hours)}`}
        />
        <StatTile
          icon="shuffle"
          tone="uncertainty"
          label="Se mantiene (propias · clones)"
          value={nominalChoice ? `${own.same}/${own.evaluated} · ${pub.same}/${pub.evaluated}` : "No aplica"}
          detail={nominalChoice ? `Empates ${own.tie} · ${pub.tie} — inversiones ${own.inverted} · ${pub.inverted}` : "El nominal empata: sin fracción (null)"}
        />
        <StatTile
          icon="flask"
          tone="uncertainty"
          label={`Peor regret de conservar ${keep ?? "—"}`}
          value={worstOwn === null ? "—" : formatHoursMinutes(worstOwn)}
          detail={worstPub === null ? "Elige un sitio a conservar" : `Propias · clones: ${formatHoursMinutes(worstPub)}`}
        />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Panel
          title="Resultado por superficie"
          icon="layers"
          actions={<InfoTip>Valores de la métrica del criterio para A y B, diferencia D = U_A − U_B (derecha favorece a A, izquierda a B), ganador, relación con la elección nominal y regret de conservar la elección.</InfoTip>}
        >
          <div className="overflow-x-auto">
            <div className="flex min-w-[860px] flex-col gap-5">
              <div className="grid grid-cols-[minmax(7.5rem,1fr)_4.6rem_4.6rem_minmax(6rem,1.4fr)_3.8rem_6.5rem_minmax(5rem,1fr)] gap-2 px-3 text-[11px] text-ink-faint">
                <span>Superficie</span>
                <span className="text-right text-site-a">A</span>
                <span className="text-right text-site-b">B</span>
                <span className="text-center">← B · D · A →</span>
                <span className="text-center">Gana</span>
                <span>Frente al nominal</span>
                <span className="text-right">Regret de conservar {keep ?? "—"}</span>
              </div>
              <FamilyBlock core={core} result={result} counts="nominal" keep={keep} selected={selection.variant} onSelect={(v) => dispatch({ type: "setVariant", value: v })} />
              <FamilyBlock core={core} result={result} counts={own} keep={keep} selected={selection.variant} onSelect={(v) => dispatch({ type: "setVariant", value: v })} />
              <FamilyBlock core={core} result={result} counts={pub} keep={keep} selected={selection.variant} onSelect={(v) => dispatch({ type: "setVariant", value: v })} />
            </div>
          </div>
        </Panel>
        <SurfaceDetail core={core} result={result} keep={keep} />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <DecisionMap core={core} />
        <Conclusion result={result} keep={keep} own={own} pub={pub} />
      </div>
      <Method core={core} />
    </>
  );
}

export function RegretLabView() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Regret Lab"
        title="Regret Lab"
        subtitle="¿Se mantiene la elección cuando cambia la representación del terreno?"
        actions={<ExportButtons page="regret-lab" scope="regret" />}
      />
      <DataGate>{({ core }) => <RegretBody core={core} />}</DataGate>
    </div>
  );
}
