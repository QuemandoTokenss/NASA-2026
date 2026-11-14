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
import { TerrainDiffLab } from "./TerrainDiffLab";
import { L, R } from "@/lib/i18n";

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
              {L("Se mantiene", "Holds")} {counts.same}/{counts.evaluated}
            </Badge>
          ) : (
            <Badge tone="neutral">{L("Sin elección nominal", "No nominal choice")}</Badge>
          )}
          <Badge tone="neutral">{L("Empates", "Ties")} {counts.tie}</Badge>
          {nominalAB ? <Badge tone="uncertainty">{L("Inversiones", "Flips")} {counts.inverted}</Badge> : null}
        </span>
        )}
      </div>
      <p className="text-xs text-ink-faint">{FAMILY_META[family].description}</p>
      <div className="flex flex-col gap-1" role="group" aria-label={L("Superficies", "Surfaces")}>
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
                {v === "nominal" ? <Badge tone="neutral">{L("Referencia", "Reference")}</Badge> : <OutcomeTag outcome={outcome} />}
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
        {L(
          `Escala de la familia: D máx. ${formatHoursMinutes(maxD)} · regret máx. ${formatHoursMinutes(maxRegret)}. Las familias usan escalas distintas para no ocultar diferencias pequeñas.`,
          `Family scale: max D ${formatHoursMinutes(maxD)} · max regret ${formatHoursMinutes(maxRegret)}. Families use different scales so small differences are not hidden.`,
        )}
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
      title={L("Superficie seleccionada", "Selected surface")}
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
          <span className="text-sm text-ink-muted">{L("Resultado:", "Result:")}</span>
          <WinnerTag winner={cs.winner} />
          <OutcomeTag outcome={outcome} />
        </div>
        <div className="rounded-xl border border-uncertainty/40 bg-uncertainty-soft p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-uncertainty">
            {L("REGRET de conservar", "REGRET of keeping")} {keep ?? "—"}
            <InfoTip>
              regret_{keep ?? "X"}_hours = max(U_A, U_B) − U_{keep ?? "X"}:{" "}
              {L(
                "horas de la métrica del criterio que se pierden por mantener esa elección con esta superficie. 0 si la elección sigue siendo la mejor o empata.",
                "hours of the criterion metric lost by keeping that choice with this surface. 0 if the choice is still the best or ties.",
              )}
            </InfoTip>
          </p>
          <p className="tabular mt-1 text-3xl font-bold text-ink">{r === null ? "—" : formatHoursMinutes(r)}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {keep === null
              ? L("Elige qué sitio conservar para medir su regret.", "Choose which site to keep to measure its regret.")
              : r === 0
                ? L(`Con esta superficie, ${keep} sigue siendo la mejor opción o empata: no hay pérdida.`, `With this surface, ${keep} is still the best option or ties: no loss.`)
                : L(
                    `Con esta superficie, mantener ${keep} supone ${formatHoursMinutes(r)} ${METRIC_META[metric].better === "lower" ? "más" : "menos"} de ${METRIC_META[metric].label.toLowerCase()} que elegir ${otherSite(keep)}.`,
                    `With this surface, keeping ${keep} means ${formatHoursMinutes(r)} ${METRIC_META[metric].better === "lower" ? "more" : "less"} ${METRIC_META[metric].label.toLowerCase()} than choosing ${otherSite(keep)}.`,
                  )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/timeline/?${query}`} size="sm" icon="timeline">
            {L("Ver estados en Timeline", "View states in Timeline")}
          </LinkButton>
          <LinkButton href={`/comparador/?${query}`} size="sm" icon="compare">
            {L("Abrir en Comparador", "Open in Compare")}
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
  const [mode, setMode] = useState<"winner" | "regret">("winner");
  const cellTone = (w: Winner) =>
    w === "A" ? "bg-site-a/85 text-[#1a0d00]" : w === "B" ? "bg-site-b/85 text-[#00161a]" : w === "TIE" ? "bg-surface-3 text-ink-muted" : "pattern-hatch text-ink";
  // Regret de conservar la elección nominal de cada fila (null si la fila no tiene elección nominal A/B o el caso es desconocido).
  const regretCell = (w: (typeof WINDOW_IDS)[number], h: (typeof HEIGHTS_M)[number], v: Variant) => {
    const r = getCriterionResult(core, w, h, criterion)!;
    const keepRow = r.nominal_winner === "A" || r.nominal_winner === "B" ? r.nominal_winner : null;
    return keepRow ? regretOfKeeping(r.cases[v], keepRow) : null;
  };
  const maxRegret = Math.max(0, ...WINDOW_IDS.flatMap((w) => HEIGHTS_M.flatMap((h) => VARIANTS.map((v) => regretCell(w, h, v) ?? 0))));
  return (
    <Panel
      title={`${mode === "winner" ? L("Mapa de decisiones", "Decision map") : L("Mapa de calor del regret", "Regret heat map")} · ${CRITERION_META[criterion].short}`}
      icon="grid"
      actions={<>
        <Segmented
          label={L("Color de las celdas", "Cell colour")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "winner", label: L("Ganador", "Winner") },
            { value: "regret", label: L("Regret", "Regret") },
          ]}
        />
        <InfoTip>{L("Ganador de cada superficie (columnas) en las 6 combinaciones ventana × altura (filas). El anillo violeta marca superficies que invierten la elección nominal de su fila. Pulsa una celda para seleccionarla.", "Winner for each surface (columns) in the 6 window × height combinations (rows). The violet ring marks surfaces that flip the nominal choice of their row. Click a cell to select it.")} {L("En modo «Regret», la intensidad violeta es el regret (horas) de conservar la elección nominal de la fila; filas sin elección nominal quedan rayadas.", "In “Regret” mode, the violet intensity is the regret (hours) of keeping the row's nominal choice; rows without a nominal choice are hatched.")}</InfoTip>
      </>}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-separate border-spacing-1 text-center text-xs">
          <caption className="sr-only">{L("Ganador por superficie, ventana y altura", "Winner by surface, window and height")}</caption>
          <thead>
            <tr>
              <th />
              <th colSpan={1} className="pb-1 font-medium text-ink-faint">{FAMILY_META.nominal.label}</th>
              <th colSpan={4} className="border-b border-uncertainty/40 pb-1 font-medium text-uncertainty">{FAMILY_META.own.label}</th>
              <th colSpan={5} className="border-b border-line-strong pb-1 font-medium text-ink-muted">{FAMILY_META.published.label}</th>
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
                      const reg = mode === "regret" ? regretCell(w, h, v) : null;
                      return (
                        <td key={v} className="p-0">
                          <button
                            type="button"
                            aria-label={`${w}, ${h} m, ${VARIANT_LABEL[v]}: ${WINNER_LABEL[win]}${inv ? L(", invierte la elección nominal", ", flips the nominal choice") : ""}${mode === "regret" ? ` · regret ${reg === null ? "—" : formatHoursMinutes(reg)}` : ""}`}
                            style={mode === "regret" && reg !== null ? { background: `rgba(167, 139, 250, ${(0.08 + 0.85 * (maxRegret > 0 ? reg / maxRegret : 0)).toFixed(3)})` } : undefined}
                            aria-pressed={active}
                            onClick={() => {
                              dispatch({ type: "setWindow", value: w });
                              dispatch({ type: "setHeight", value: h });
                              dispatch({ type: "setVariant", value: v });
                            }}
                            className={`h-8 w-full min-w-8 rounded-md font-bold transition-transform hover:scale-110 ${mode === "regret" ? (reg === null ? "pattern-hatch text-ink-faint" : "tabular text-[11px] text-ink") : cellTone(win)} ${
                              inv ? "ring-2 ring-uncertainty ring-offset-1 ring-offset-surface" : ""
                            } ${active ? "outline-2 outline-offset-2 outline-white" : ""} ${v === "nominal" ? "shadow-[inset_0_0_0_2px_#ffffff30]" : ""}`}
                          >
                            {mode === "regret" ? (reg === null ? "?" : v === "nominal" ? "N" : formatNumber(reg, 1)) : win === "TIE" ? "=" : win === "UNKNOWN" ? "?" : win}
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
      {mode === "regret" ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
          <span className="h-2.5 w-32 rounded-full" style={{ background: "linear-gradient(90deg, rgba(167,139,250,0.08), rgba(167,139,250,0.93))" }} />
          <span>0 → {formatHoursMinutes(maxRegret)} {L("(máximo de la matriz) · cifras en horas", "(matrix maximum) · figures in hours")}</span>
          <span className="flex items-center gap-1.5"><span className="pattern-hatch inline-block size-3 rounded-sm" />{L("Sin elección nominal (empate o desconocido)", "No nominal choice (tie or unknown)")}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm ring-2 ring-uncertainty" />{L("Invierte la elección nominal", "Flips the nominal choice")}</span>
        </div>
      ) : (
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-site-a" />{L("Gana A", "A wins")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-site-b" />{L("Gana B", "B wins")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-surface-3" />{L("= Empate (≤ 10 min)", "= Tie (≤ 10 min)")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm ring-2 ring-uncertainty" />{L("Invierte la elección nominal", "Flips the nominal choice")}</span>
      </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------------ */

const DEMO_STEPS = () => [
  L("Resultado nominal", "Nominal result"),
  L("Elegir", "Choose"),
  L("Desafiar el terreno", "Challenge the terrain"),
  L("Ver el cambio", "See the change"),
  L("Coste REGRET", "REGRET cost"),
  L("Significado y límites", "Meaning and limits"),
];

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
      {windowId} · {heightM} m · <strong>{CRITERION_META[criterion].label.toLowerCase()}</strong>.{" "}
      {R(
        "Con la superficie nominal, la racha más larga sin Sol es {a} en A y {b} en B: gana {w}.",
        "With the nominal surface, the longest stretch without Sun is {a} at A and {b} at B: {w} wins.",
        {
          a: <strong className="text-site-a">{formatHoursMinutes(val("A", "nominal"))}</strong>,
          b: <strong className="text-site-b">{formatHoursMinutes(val("B", "nominal"))}</strong>,
          w: <strong>{WINNER_LABEL[nominalWinner]}</strong>,
        },
      )}
    </>,
    <>
      {R(
        "Elegimos {k}, el ganador nominal. La pregunta de SITE REGRET: ¿seguiría siendo la mejor elección si el relieve fuese algo distinto?",
        "We choose {k}, the nominal winner. The SITE REGRET question: would it still be the best choice if the relief were slightly different?",
        { k: <strong className={keep ? SITE_META[keep].textClass : ""}>{keep ? SITE_META[keep].label : "—"}</strong> },
      )}
    </>,
    <>
      {R(
        "Activamos {v}: una de las cuatro hipótesis propias del terreno (X = {x} m, σ = {s} m, semilla {seed}). Es una hipótesis modelada, no un error NASA medido.",
        "We switch on {v}: one of the four team terrain hypotheses (X = {x} m, σ = {s} m, seed {seed}). It is a modelled hypothesis, not a measured NASA error.",
        {
          v: <strong className="text-uncertainty">{v ? VARIANT_LABEL[v] : "—"}</strong>,
          x: formatNumber(core.configuration.hypothesis_X_m, 0),
          s: formatNumber(core.configuration.gaussian_filter_sigma_m, 0),
          seed: core.configuration.seed,
        },
      )}
    </>,
    v ? (
      <>
        {R(
          "Con esta superficie, A obtiene {a} y B {b}: ahora gana {w}. La elección se invierte.",
          "With this surface, A gets {a} and B {b}: now {w} wins. The choice flips.",
          {
            a: <strong className="text-site-a">{formatHoursMinutes(val("A", v))}</strong>,
            b: <strong className="text-site-b">{formatHoursMinutes(val("B", v))}</strong>,
            w: <strong>{WINNER_LABEL[r.cases[v].winner]}</strong>,
          },
        )}
      </>
    ) : (
      <>{L("No hay perturbación que cambie el resultado.", "No perturbation changes the result.")}</>
    ),
    v && keep ? (
      <>
        {R(
          "Conservar {k} con esta superficie cuesta {c} más de racha sin Sol que cambiar a {o}. Es el peor regret de la familia propia ({w}).",
          "Keeping {k} with this surface costs {c} more of dark streak than switching to {o}. It is the worst regret of the team family ({w}).",
          {
            k: keep,
            c: <strong className="text-uncertainty">{formatHoursMinutes(regretOfKeeping(r.cases[v], keep))}</strong>,
            o: otherSite(keep),
            w: formatHoursMinutes(r.robustness.own_sensitivity.worst_regret_of_nominal_choice_hours),
          },
        )}
      </>
    ) : null,
    <>
      {R(
        "La elección se mantiene en {own} hipótesis propias ({t} empate, {i} inversión) y en {pub} clones publicados. Son recuentos de superficies modeladas, {np}; la visibilidad es geométrica y no implica energía ni enlace de radio.",
        "The choice holds in {own} team hypotheses ({t} tie, {i} flip) and in {pub} published clones. These are counts of modelled surfaces, {np}; visibility is geometric and does not imply power or radio link.",
        {
          own: <strong>{`${own.same}/${own.evaluated}`}</strong>,
          t: own.tie,
          i: own.inverted,
          pub: <strong>{`${pub.same}/${pub.evaluated}`}</strong>,
          np: <strong>{L("no probabilidades", "not probabilities")}</strong>,
        },
      )}
    </>,
  ];

  return (
    <section aria-label={L("Caso demostrativo guiado", "Guided demo case")} className="animate-rise relative overflow-hidden rounded-2xl border border-uncertainty/50 bg-gradient-to-r from-[#1a1240] via-surface to-surface p-5 shadow-[0_0_60px_-24px_#a78bfa]">
      <div className="flex flex-wrap items-center gap-3">
        <Icon name="sparkles" className="size-5 text-uncertainty" />
        <h2 className="text-lg font-bold text-ink">{L("Caso demostrativo", "Demo case")} · {windowId} · {heightM} m · {CRITERION_META[criterion].short}</h2>
        <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label={L("Cerrar caso demostrativo", "Close demo case")}>
          <Icon name="close" className="size-4" />
        </button>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {DEMO_STEPS().map((label, i) => (
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
          {L("Anterior", "Previous")}
        </Button>
        {step < DEMO_STEPS().length - 1 ? (
          <Button size="sm" variant="regret" iconRight="stepForward" onClick={() => go(step + 1)}>
            {L("Siguiente", "Next")}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" icon="reset" onClick={() => go(0)}>
            {L("Repetir", "Replay")}
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
    <Panel title={L("Conclusión: robustez de la decisión", "Conclusion: robustness of the decision")} icon="shield" className="border-uncertainty/30">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line bg-bg-2/80 p-4 text-[15px] leading-relaxed text-ink-muted">
          {nominalAB ? (
            <>
              {R(
                "Con {w}, {h} m y el criterio «{c}», la elección nominal es {n}. Se mantiene en {own} hipótesis propias ({ot} empates, {oi} inversiones) y en {pub} clones publicados ({pt} empates, {pi} inversiones).",
                "With {w}, {h} m and the criterion “{c}”, the nominal choice is {n}. It holds in {own} team hypotheses ({ot} ties, {oi} flips) and in {pub} published clones ({pt} ties, {pi} flips).",
                {
                  w: selection.windowId,
                  h: selection.heightM,
                  c: CRITERION_META[selection.criterion!].label.toLowerCase(),
                  n: <strong className={SITE_META[result.nominal_winner as SiteId].textClass}>{SITE_META[result.nominal_winner as SiteId].label}</strong>,
                  own: <strong className="text-ink">{L(`${own.same} de ${own.evaluated}`, `${own.same} of ${own.evaluated}`)}</strong>,
                  ot: own.tie,
                  oi: own.inverted,
                  pub: <strong className="text-ink">{L(`${pub.same} de ${pub.evaluated}`, `${pub.same} of ${pub.evaluated}`)}</strong>,
                  pt: pub.tie,
                  pi: pub.inverted,
                },
              )}
            </>
          ) : (
            <>
              {R(
                "Con {w}, {h} m y este criterio, la superficie nominal da {r}: no hay elección nominal que poner a prueba. Aun así puedes medir el regret de conservar A o B en cada superficie.",
                "With {w}, {h} m and this criterion, the nominal surface gives {r}: there is no nominal choice to test. You can still measure the regret of keeping A or B for each surface.",
                { w: selection.windowId, h: selection.heightM, r: <strong className="text-ink">{WINNER_LABEL[result.nominal_winner]}</strong> },
              )}
            </>
          )}
          {keep ? (
            <>
              {" "}
              {R("Peor regret de conservar {k}: {a} (propias) y {b} (clones).", "Worst regret of keeping {k}: {a} (team) and {b} (clones).", {
                k: <strong className={SITE_META[keep].textClass}>{keep}</strong>,
                a: <strong className="text-uncertainty">{formatHoursMinutes(worst(own))}</strong>,
                b: <strong className="text-uncertainty">{formatHoursMinutes(worst(pub))}</strong>,
              })}
            </>
          ) : null}
        </div>
        <blockquote className="border-l-2 border-accent pl-3 text-sm leading-relaxed text-ink-muted">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{L("Frase del motor", "Engine sentence (original Spanish)")}</p>
          <span lang="es">{result.summary_es}</span>
        </blockquote>
        <Callout tone="uncertainty" icon="alert" title={L("Cómo leerlo", "How to read it")}>
          {L(
            "Son recuentos sobre 4 + 5 superficies concretas, no probabilidades ni percentiles. Una elección estable en esta familia finita también es un hallazgo; un contraejemplo indica sensibilidad al relieve, no que el sitio sea inseguro.",
            "These are counts over 4 + 5 specific surfaces, not probabilities or percentiles. A stable choice in this finite family is also a finding; a counter-example shows sensitivity to the relief, not that the site is unsafe.",
          )}
        </Callout>
      </div>
    </Panel>
  );
}

function Method({ core }: { core: Core }) {
  const c = core.configuration;
  return (
    <Panel title={L("Método y límites", "Method and limits")} icon="book">
      <ul className="flex flex-col gap-2.5 text-sm text-ink-muted">
        <li>
          {R(
            "{t} sesgo regional ±X y campo correlacionado ±, con X = {x} m, σ = {s} m y semilla {seed}; ambos sitios anclados al terreno nominal. Hipótesis editables, no incertidumbre calibrada de LOLA.",
            "{t} regional bias ±X and correlated field ±, with X = {x} m, σ = {s} m and seed {seed}; both sites anchored to the nominal terrain. Editable hypotheses, not calibrated LOLA uncertainty.",
            {
              t: <strong className="text-ink">{L("Hipótesis propias (4):", "Team hypotheses (4):")}</strong>,
              x: formatNumber(c.hypothesis_X_m, 0),
              s: formatNumber(c.gaussian_filter_sigma_m, 0),
              seed: c.seed,
            },
          )}
        </li>
        <li>
          <strong className="text-ink">{L("Clones publicados (5):", "Published clones (5):")}</strong>{" "}
          {L(
            "DEM completos del ensemble de PGDA78 Site01 (de 100); el mástil se apoya en la altura del clon. No se suman al nominal.",
            "complete DEMs from the PGDA78 Site01 ensemble (of 100); the mast stands on the clone height. They are not added to the nominal.",
          )}
        </li>
        <li>
          <strong className="text-ink">REGRET:</strong>{" "}
          {L(
            `con utilidad U = signo × métrica, regret_A = max(U_A, U_B) − U_A, en horas del criterio. Empate si |D| ≤ ${formatHoursMinutes(c.tie_tolerance_hours)}.`,
            `with utility U = sign × metric, regret_A = max(U_A, U_B) − U_A, in criterion hours. Tie if |D| ≤ ${formatHoursMinutes(c.tie_tolerance_hours)}.`,
          )}
        </li>
        <li>
          <strong className="text-ink">{L("Fracciones:", "Fractions:")}</strong>{" "}
          {L(
            "excluyen el nominal; los empates no cuentan como conservación; si el nominal empata, no hay una elección inicial que comparar y no se calcula fracción.",
            "exclude the nominal; ties do not count as holding; if the nominal ties, there is no initial choice to compare and no fraction is computed.",
          )}
        </li>
        <li>
          <strong className="text-ink">{L("Sin", "No")}</strong>{" "}
          {L(
            "Monte Carlo, distribuciones ni probabilidades: el paquete contiene exactamente estas 10 superficies por sitio.",
            "Monte Carlo, distributions or probabilities: the package contains exactly these 10 surfaces per site.",
          )}
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
      <span className="whitespace-nowrap">{L("Caso demostrativo", "Demo case")} {DEMO_CASE.windowId} · {DEMO_CASE.heightM} m</span>
    </Button>
  );

  const controls = (
    <ControlBar aside={demoStep === null ? startDemo : null}>
      <WindowControl core={core} />
      <HeightControl />
      <CriterionControl />
      {result ? (
        <Segmented
          label={L("Elección a conservar", "Choice to keep")}
          value={keep ?? "none"}
          onChange={(v) => v !== "none" && setKeep(v)}
          options={[
            ...SITE_IDS.map((s) => ({
              value: s as SiteId | "none",
              ariaLabel: L(`Conservar ${SITE_META[s].label}`, `Keep ${SITE_META[s].label}`),
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
        <Panel title={L("01 · Elegir el criterio", "01 · Choose the criterion")} icon="lock">
          <CriterionPicker />
        </Panel>
      </>
    );

  const own = familyCounts(result, "own");
  const pub = familyCounts(result, "published");
  const metric = CRITERION_METRIC[criterion];
  const nomA = getScenarioSummary(core, { siteId: "A", windowId, heightM, variant: "nominal" })!.metrics[metric];
  const nomB = getScenarioSummary(core, { siteId: "B", windowId, heightM, variant: "nominal" })!.metrics[metric];
  // Empate porque los dos valores nominales son 0 h y están completos (sin horas desconocidas): se explica en llano.
  const nomUnknown = (["A", "B"] as const).reduce((acc, s) => acc + (getScenarioSummary(core, { siteId: s, windowId, heightM, variant: "nominal" })!.metrics.unknown_hours ?? 0), 0);
  const zeroTie = result.nominal_winner === "TIE" && nomA === 0 && nomB === 0 && nomUnknown === 0;
  const ZERO_TIE: Record<string, [string, string]> = {
    longest_dark_hours: ["En esta ventana y a esta altura, ninguno de los dos sitios tiene un tramo sin Sol según el modelo. Por eso empatan en este criterio.", "In this window and at this height, neither site has a stretch without sunlight according to the model. That is why they tie on this criterion."],
    sun_hours: ["En esta ventana y a esta altura, ninguno de los dos sitios ve el Sol según el modelo. Por eso empatan en este criterio.", "In this window and at this height, neither site sees the Sun according to the model. That is why they tie on this criterion."],
    dte_center_hours: ["En esta ventana y a esta altura, ninguno de los dos sitios ve la Tierra según el modelo. Por eso empatan en este criterio.", "In this window and at this height, neither site sees the Earth according to the model. That is why they tie on this criterion."],
    joint_hours: ["En esta ventana y a esta altura, ninguno de los dos sitios ve a la vez el Sol y la Tierra según el modelo. Por eso empatan en este criterio.", "In this window and at this height, neither site sees the Sun and the Earth at the same time according to the model. That is why they tie on this criterion."],
  };
  const zeroTieText = zeroTie ? L(...(ZERO_TIE[metric] ?? ["Los dos sitios dan 0 h en esta métrica según el modelo. Por eso empatan.", "Both sites give 0 h on this metric according to the model. That is why they tie."])) : null;
  const worstOwn = keep ? Math.max(...own.variants.map((v) => regretOfKeeping(result.cases[v], keep) ?? 0)) : null;
  const worstPub = keep ? Math.max(...pub.variants.map((v) => regretOfKeeping(result.cases[v], keep) ?? 0)) : null;

  return (
    <>
      {demo}
      {controls}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile testId="regret-kpi-a" icon={METRIC_META[metric].icon} tone="a" label={`${METRIC_META[metric].label} · A (nominal)`} value={formatHoursMinutes(nomA)} detail={L("Superficie nominal", "Nominal surface")} />
        <StatTile testId="regret-kpi-b" icon={METRIC_META[metric].icon} tone="b" label={`${METRIC_META[metric].label} · B (nominal)`} value={formatHoursMinutes(nomB)} detail={L("Superficie nominal", "Nominal surface")} />
        <StatTile
          testId="regret-kpi-choice"
          icon="compare"
          label={L("Elección nominal", "Nominal choice")}
          value={result.nominal_winner === "TIE" ? L("Empate", "Tie") : result.nominal_winner === "UNKNOWN" ? L("No determinable", "Not determinable") : SITE_META[result.nominal_winner].label}
          detail={`|D| = ${formatHoursMinutes(Math.abs(result.cases.nominal.D_hours ?? 0))} · ${L("tolerancia", "tolerance")} ${formatHoursMinutes(result.tie_tolerance_hours)}`}
        />
        <StatTile
          icon="shuffle"
          tone="uncertainty"
          label={L("Se mantiene (propias · clones)", "Holds (team · clones)")}
          value={nominalChoice ? `${own.same}/${own.evaluated} · ${pub.same}/${pub.evaluated}` : L("No aplica", "Not applicable")}
          detail={
            nominalChoice
              ? L(`Empates ${own.tie} · ${pub.tie} — inversiones ${own.inverted} · ${pub.inverted}`, `Ties ${own.tie} · ${pub.tie} — flips ${own.inverted} · ${pub.inverted}`)
              : L("El escenario de referencia empata, así que no hay una elección inicial que comparar", "The reference scenario is a tie, so there is no initial choice to compare")
          }
        />
        <StatTile
          icon="flask"
          tone="uncertainty"
          label={L(`Peor regret de conservar ${keep ?? "—"}`, `Worst regret of keeping ${keep ?? "—"}`)}
          value={worstOwn === null ? "—" : formatHoursMinutes(worstOwn)}
          detail={worstPub === null ? L("Elige un sitio a conservar", "Choose a site to keep") : `${L("Propias · clones", "Team · clones")}: ${formatHoursMinutes(worstPub)}`}
        />
      </div>

      {zeroTieText ? (
        <p className="-mt-1 rounded-xl border border-line bg-bg-2/70 px-4 py-2.5 text-sm text-ink" data-testid="regret-zero-tie">
          <Icon name="info" className="mr-1.5 inline size-4 align-[-3px] text-accent" />
          {zeroTieText}
        </p>
      ) : null}

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Panel
          title={L("Resultado por superficie", "Result by surface")}
          icon="layers"
          actions={<InfoTip>{L("Valores de la métrica del criterio para A y B, diferencia D = U_A − U_B (derecha favorece a A, izquierda a B), ganador, relación con la elección nominal y regret de conservar la elección.", "Criterion metric values for A and B, difference D = U_A − U_B (right favours A, left favours B), winner, relation to the nominal choice and regret of keeping the choice.")}</InfoTip>}
        >
          <div className="overflow-x-auto">
            <div className="flex min-w-[860px] flex-col gap-5">
              <div className="grid grid-cols-[minmax(7.5rem,1fr)_4.6rem_4.6rem_minmax(6rem,1.4fr)_3.8rem_6.5rem_minmax(5rem,1fr)] gap-2 px-3 text-[11px] text-ink-faint">
                <span>{L("Superficie", "Surface")}</span>
                <span className="text-right text-site-a">A</span>
                <span className="text-right text-site-b">B</span>
                <span className="text-center">← B · D · A →</span>
                <span className="text-center">{L("Gana", "Winner")}</span>
                <span>{L("Frente al nominal", "Vs nominal")}</span>
                <span className="text-right">{L("Regret de conservar", "Regret of keeping")} {keep ?? "—"}</span>
              </div>
              <FamilyBlock core={core} result={result} counts="nominal" keep={keep} selected={selection.variant} onSelect={(v) => dispatch({ type: "setVariant", value: v })} />
              <FamilyBlock core={core} result={result} counts={own} keep={keep} selected={selection.variant} onSelect={(v) => dispatch({ type: "setVariant", value: v })} />
              <FamilyBlock core={core} result={result} counts={pub} keep={keep} selected={selection.variant} onSelect={(v) => dispatch({ type: "setVariant", value: v })} />
            </div>
          </div>
        </Panel>
        <SurfaceDetail core={core} result={result} keep={keep} />
      </div>

      <TerrainDiffLab core={core} />

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
        subtitle={L("¿Se mantiene la elección cuando cambia la representación del terreno?", "Does the choice hold when the terrain representation changes?")}
        actions={<ExportButtons page="regret-lab" scope="regret" />}
      />
      <DataGate>{({ core }) => <RegretBody core={core} />}</DataGate>
    </div>
  );
}
