"use client";

/**
 * Veredicto de Regret Lab: qué tipo de resultado da el criterio elegido (gana A/B,
 * empate sin oscuridad, empate con Sol toda la ventana, no determinable…) y cómo
 * se comportan los OTROS tres criterios del motor con la misma ventana, altura y
 * superficie nominal. Cambiar de criterio es una acción explícita del usuario: la
 * selección nunca se altera sola y ningún resultado se oculta.
 */
import type { Criterion } from "@/lib/contract/constants";
import type { Core } from "@/lib/contract/schema";
import { formatHoursMinutes } from "@/lib/format";
import { L, R } from "@/lib/i18n";
import { CRITERION_META, SITE_META } from "@/lib/labels";
import { METRIC_META } from "@/lib/science/metrics";
import { criterionSnapshots, discriminatingCriteria, type CriterionSnapshot, type ResultKind } from "@/lib/science/regretSummary";
import type { MetricKey } from "@/lib/contract/schema";
import { useSelection } from "@/lib/state/SelectionProvider";
import { WinnerTag } from "../ui/Display";
import { Icon, type IconName } from "../ui/Icon";

const KIND_STYLE: Record<ResultKind, { box: string; icon: IconName; iconClass: string }> = {
  decisive: { box: "border-line-strong bg-surface", icon: "compare", iconClass: "text-ink" },
  tie_no_dark: { box: "border-state-sun/40 bg-[#f5c5180d]", icon: "sun", iconClass: "text-state-sun" },
  tie_full: { box: "border-state-sun/40 bg-[#f5c5180d]", icon: "sun", iconClass: "text-state-sun" },
  tie_none: { box: "border-line-strong bg-surface-2", icon: "moon", iconClass: "text-ink-muted" },
  tie: { box: "border-line-strong bg-surface-2", icon: "compare", iconClass: "text-ink-muted" },
  unknown: { box: "border-warn/50 bg-warn/10", icon: "alert", iconClass: "text-warn" },
};

export function kindLabel(kind: ResultKind): string {
  return {
    decisive: L("Diferencia relevante", "Meaningful difference"),
    tie_no_dark: L("Empate · sin oscuridad detectada", "Tie · no darkness detected"),
    tie_full: L("Empate · toda la ventana", "Tie · the whole window"),
    tie_none: L("Empate · 0 h en ambos", "Tie · 0 h at both"),
    tie: L("Empate científico", "Scientific tie"),
    unknown: L("No determinable", "Not determinable"),
  }[kind];
}

function headline(s: CriterionSnapshot, w: string, h: number) {
  const metric = METRIC_META[s.metric as MetricKey].label.toLowerCase();
  switch (s.kind) {
    case "decisive": {
      const site = s.winner as "A" | "B";
      return R(
        "Con «{c}», gana {s} por {d} ({w} · {h} m, superficie nominal).",
        "With “{c}”, {s} wins by {d} ({w} · {h} m, nominal surface).",
        { c: CRITERION_META[s.criterion].label.toLowerCase(), s: <strong className={SITE_META[site].textClass}>{SITE_META[site].label}</strong>, d: <strong className="text-ink">{formatHoursMinutes(s.absD)}</strong>, w, h },
      );
    }
    case "tie_no_dark":
      return R(
        "Ninguno de los dos sitios tiene un tramo sin Sol en {w} a {h} m: el modelo no detectó oscuridad en las {t} analizadas. Es un resultado válido, no falta de datos, pero no garantiza iluminación permanente ni seguridad.",
        "Neither site has a stretch without Sun in {w} at {h} m: the model detected no darkness in the {t} analysed. It is a valid result, not missing data, but it does not guarantee permanent light or safety.",
        { w, h, t: formatHoursMinutes(s.duration) },
      );
    case "tie_full":
      return R(
        "Los dos sitios dan {t} de {t} en «{m}» ({w} · {h} m): el criterio no puede separarlos.",
        "Both sites give {t} of {t} in “{m}” ({w} · {h} m): the criterion cannot separate them.",
        { t: formatHoursMinutes(s.duration), m: metric, w, h },
      );
    case "tie_none":
      return R("Los dos sitios dan 0 h en «{m}» ({w} · {h} m): el criterio no puede separarlos.", "Both sites give 0 h in “{m}” ({w} · {h} m): the criterion cannot separate them.", { m: metric, w, h });
    case "tie":
      return R(
        "A y B difieren {d}, dentro de la tolerancia de empate del motor (10 min): empate científico.",
        "A and B differ by {d}, within the engine's tie tolerance (10 min): scientific tie.",
        { d: formatHoursMinutes(s.absD) },
      );
    case "unknown":
      return L(
        `Hay ${formatHoursMinutes(s.unknownHours)} sin estado determinable en A o B: el motor no declara ganador y esas horas nunca se cuentan como sombra.`,
        `There are ${formatHoursMinutes(s.unknownHours)} without a determinable state at A or B: the engine declares no winner and those hours are never counted as shadow.`,
      );
  }
}

export function RegretVerdict({ core }: { core: Core }) {
  const { selection, dispatch } = useSelection();
  const { windowId, heightM, criterion } = selection;
  if (!criterion) return null;
  const snaps = criterionSnapshots(core, windowId, heightM);
  const current = snaps.find((s) => s.criterion === criterion)!;
  const others = discriminatingCriteria(snaps, criterion);
  const style = KIND_STYLE[current.kind];
  const allTie = snaps.every((s) => s.kind !== "decisive" && s.kind !== "unknown");
  const choose = (c: Criterion) => dispatch({ type: "setCriterion", value: c });

  return (
    <section
      aria-label={L("Veredicto del criterio", "Criterion verdict")}
      data-testid="regret-verdict"
      data-kind={current.kind}
      className={`rounded-2xl border p-4 sm:p-5 ${style.box}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <Icon name={style.icon} className={`mt-0.5 size-6 shrink-0 ${style.iconClass}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${style.iconClass}`} data-testid="regret-verdict-kind">
            {kindLabel(current.kind)}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink" data-testid="regret-verdict-text">
            {headline(current, windowId, heightM)}
          </p>
          {current.kind !== "decisive" && current.kind !== "unknown" ? (
            <p className="mt-1.5 text-sm text-ink-muted" data-testid="regret-verdict-hint">
              {others.length
                ? R(
                    others.length > 1
                      ? "Con este criterio ambos emplazamientos empatan. {list} sí permiten diferenciarlos (mismos datos; la selección solo cambia si eliges uno)."
                      : "Con este criterio ambos emplazamientos empatan. {list} sí permite diferenciarlos (mismos datos; la selección solo cambia si lo eliges).",
                    others.length > 1
                      ? "With this criterion both sites tie. {list} do tell them apart (same data; the selection only changes if you pick one)."
                      : "With this criterion both sites tie. {list} does tell them apart (same data; the selection only changes if you pick it).",
                    {
                      list: (
                        <strong className="text-ink">
                          {others.map((o) => CRITERION_META[o.criterion].short).join(L(" y ", " and "))}
                        </strong>
                      ),
                    },
                  )
                : allTie
                  ? L(
                      `Ninguno de los cuatro criterios distingue A y B en ${windowId} · ${heightM} m con la superficie nominal.`,
                      `None of the four criteria tells A and B apart in ${windowId} · ${heightM} m on the nominal surface.`,
                    )
                  : null}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          {L(`Los cuatro criterios · ${windowId} · ${heightM} m · superficie nominal`, `All four criteria · ${windowId} · ${heightM} m · nominal surface`)}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label={L("Cambiar de criterio", "Switch criterion")}>
          {snaps.map((s) => {
            const active = s.criterion === criterion;
            const max = Math.max(s.a ?? 0, s.b ?? 0, 1e-9);
            const meta = METRIC_META[s.metric as MetricKey];
            return (
              <button
                key={s.criterion}
                type="button"
                aria-pressed={active}
                data-testid={`regret-criterion-${s.criterion}`}
                data-kind={s.kind}
                onClick={() => choose(s.criterion)}
                className={`flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  active ? "border-uncertainty/70 bg-uncertainty-soft" : s.kind === "decisive" ? "border-line-strong bg-bg-2/70 hover:border-ink-faint" : "border-line bg-bg-2/50 hover:border-line-strong"
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Icon name={meta.icon} className="size-3.5 text-ink-muted" />
                  {CRITERION_META[s.criterion].short}
                  <span className="ml-auto">
                    <WinnerTag winner={s.winner} short />
                  </span>
                </span>
                {(["A", "B"] as const).map((site) => {
                  const v = site === "A" ? s.a : s.b;
                  return (
                    <span key={site} className="flex items-center gap-2 text-[11px]">
                      <span className={`w-3 font-bold ${SITE_META[site].textClass}`}>{site}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3/70" aria-hidden>
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${v ? Math.max(2, (v / max) * 100) : 0}%`, background: `var(--color-site-${site.toLowerCase()})` }}
                        />
                      </span>
                      <span className="tabular w-[5.5rem] text-right text-ink">{v === null ? "—" : formatHoursMinutes(v)}</span>
                    </span>
                  );
                })}
                <span className="text-[10px] text-ink-faint">
                  {kindLabel(s.kind)}
                  {s.kind === "decisive" ? ` · |D| ${formatHoursMinutes(s.absD)}` : ""}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-ink-faint">
          {L(
            "Visibilidad geométrica del centro del Sol o de la Tierra sobre el relieve; no es energía ni enlace de radio. Empate si |D| ≤ 10 min.",
            "Geometric visibility of the centre of the Sun or Earth above the terrain; not power or a radio link. Tie if |D| ≤ 10 min.",
          )}
        </p>
      </div>
    </section>
  );
}
