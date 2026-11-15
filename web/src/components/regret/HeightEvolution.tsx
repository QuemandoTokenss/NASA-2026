"use client";

/**
 * «¿Qué cambia con la altura?» para el criterio elegido:
 *  1. Las tres alturas del contrato (0/2/10 m, superficie nominal) con ganador del motor.
 *  2. El paquete de alturas de Engineer (0–30 m cada 0,5 m, solo terreno nominal, mismo
 *     motor) como puntos discretos — nada se interpola — y la franja de ganador por altura.
 *  3. Lo que dice la auditoría diagnóstica sobre la fiabilidad del resultado a esa altura.
 */
import { HEIGHTS_M, type HeightM } from "@/lib/contract/constants";
import type { Core, MetricKey } from "@/lib/contract/schema";
import { useChunk } from "@/lib/data/DataProvider";
import { loadHeightIndex } from "@/lib/data/engineerHeights";
import { formatHoursMinutes, formatNumber } from "@/lib/format";
import { L, R } from "@/lib/i18n";
import { CRITERION_META, WINNER_LABEL } from "@/lib/labels";
import { HEIGHT_AUDIT, packageSeries, packageWinnerChanges, sunMargin, type PackagePoint } from "@/lib/science/heightAudit";
import { CRITERION_METRIC, METRIC_META } from "@/lib/science/metrics";
import { heightTrack } from "@/lib/science/regretSummary";
import { useSelection } from "@/lib/state/SelectionProvider";
import { Callout, WinnerTag } from "../ui/Display";
import { InfoTip } from "../ui/Interactive";
import { Panel } from "../ui/Panel";
import { kindLabel } from "./RegretVerdict";

const W = 960;
const H = 230;
const PAD = { l: 78, r: 14, t: 14, b: 34 };
const MAX_H = 30;
// Escala raíz cuadrada (rotulada): deja ver el salto 0 → 0,5 m sin esconder 30 m.
const sx = (h: number) => PAD.l + (Math.sqrt(h) / Math.sqrt(MAX_H)) * (W - PAD.l - PAD.r);
const X_TICKS = [0, 0.5, 1, 2, 5, 10, 20, 30];
const winnerFill = (w: string) => (w === "A" ? "var(--color-site-a)" : w === "B" ? "var(--color-site-b)" : w === "TIE" ? "var(--color-surface-3)" : "url(#hatch-unknown)");

function PackageChart({ series, metric, heightM, onPick }: { series: PackagePoint[]; metric: MetricKey; heightM: HeightM; onPick: (h: HeightM) => void }) {
  const vmax = Math.max(...series.flatMap((p) => [p.a, p.b]), 1e-9);
  const vmin = Math.min(...series.flatMap((p) => [p.a, p.b]));
  // Si todo está cerca del máximo (p. ej. 720 h), se muestra el rango real con un eje que no empieza en 0, rotulado.
  const lo = vmin > vmax * 0.6 ? Math.floor(vmin - (vmax - vmin) * 0.15 - 1) : 0;
  const hi = vmax < 1e-6 ? 1 : vmax + (vmax - lo) * 0.08;
  const sy = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b - 12);
  const yTicks = [lo, lo + (hi - lo) / 2, hi].map((v) => Math.round(v * 6) / 6);
  const stripY = H - PAD.b - 6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={L(`${METRIC_META[metric].label} de A y B entre 0 y 30 m (puntos cada 0,5 m)`, `${METRIC_META[metric].label} at A and B from 0 to 30 m (points every 0.5 m)`)}>
      <defs>
        <pattern id="hatch-unknown" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="var(--color-surface-3)" />
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--color-state-unknown)" strokeWidth="2" />
        </pattern>
      </defs>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="var(--color-line)" strokeDasharray="2 4" />
          <text x={PAD.l - 6} y={sy(v) + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-faint)">
            {formatHoursMinutes(v)}
          </text>
        </g>
      ))}
      {X_TICKS.map((h) => (
        <text key={h} x={sx(h)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-ink-faint)">
          {formatNumber(h, h % 1 ? 1 : 0)} m
        </text>
      ))}
      {/* franja de ganador por altura (regla del motor sobre el paquete) */}
      {series.map((p, i) => {
        const x0 = i === 0 ? sx(p.height_m) : (sx(series[i - 1].height_m) + sx(p.height_m)) / 2;
        const x1 = i === series.length - 1 ? sx(p.height_m) + 2 : (sx(p.height_m) + sx(series[i + 1].height_m)) / 2;
        return <rect key={p.height_m} x={x0} y={stripY} width={Math.max(1, x1 - x0)} height={6} fill={winnerFill(p.winner)} opacity={0.9} />;
      })}
      {/* alturas del contrato */}
      {HEIGHTS_M.map((h) => (
        <g key={h}>
          <line x1={sx(h)} x2={sx(h)} y1={PAD.t} y2={stripY} stroke={h === heightM ? "var(--color-uncertainty)" : "var(--color-line-strong)"} strokeWidth={h === heightM ? 1.5 : 1} />
          <rect
            x={sx(h) - 14}
            y={PAD.t}
            width={28}
            height={stripY - PAD.t}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => onPick(h)}
            aria-hidden
          />
        </g>
      ))}
      {series.map((p) => (
        <g key={p.height_m}>
          <circle cx={sx(p.height_m)} cy={sy(p.a)} r={2.6} fill="var(--color-site-a)" />
          <circle cx={sx(p.height_m)} cy={sy(p.b)} r={3.6} fill="none" stroke="var(--color-site-b)" strokeWidth={1.4} />
        </g>
      ))}
    </svg>
  );
}

export function HeightEvolution({ core }: { core: Core }) {
  const { selection, dispatch } = useSelection();
  const { windowId, heightM, criterion } = selection;
  const ia = useChunk(criterion ? () => loadHeightIndex(windowId, "A") : null, [windowId, "A", criterion !== null]);
  const ib = useChunk(criterion ? () => loadHeightIndex(windowId, "B") : null, [windowId, "B", criterion !== null]);
  if (!criterion) return null;
  const metric = CRITERION_METRIC[criterion];
  const track = heightTrack(core, windowId, criterion);
  const series = ia.status === "ready" && ib.status === "ready" ? packageSeries(criterion, ia.data.value, ib.data.value) : null;
  const changes = series ? packageWinnerChanges(series) : [];
  const pick = (h: HeightM) => dispatch({ type: "setHeight", value: h });
  const sunCriterion = criterion === "min_longest_dark_hours" || criterion === "max_sun_hours" || criterion === "max_joint_hours";
  const A = HEIGHT_AUDIT.sites.A;
  const B = HEIGHT_AUDIT.sites.B;
  const mA = sunMargin("A", windowId, heightM);
  const mB = sunMargin("B", windowId, heightM);

  return (
    <Panel
      title={L("¿Qué cambia con la altura del observador?", "What changes with observer height?")}
      icon="height"
      actions={
        <InfoTip>
          {L(
            "Arriba: las tres alturas del contrato site-regret/0.1 (decisión del motor). Gráfico: paquete de alturas de Engineer, generado con el mismo motor solo para el terreno nominal, 61 alturas de 0 a 30 m; cada punto es un cálculo, nada se interpola. La franja inferior aplica la regla de empate del motor (10 min) a esas métricas. Eje horizontal en raíz cuadrada.",
            "Top: the three heights of the site-regret/0.1 contract (engine decision). Chart: the Engineer heights package, generated with the same engine for the nominal terrain only, 61 heights from 0 to 30 m; each point is a calculation, nothing is interpolated. The bottom strip applies the engine tie rule (10 min) to those metrics. Square-root horizontal axis.",
          )}
        </InfoTip>
      }
    >
      <div className="flex flex-col gap-4" data-testid="regret-height-evolution">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label={L("Altura del contrato", "Contract height")}>
          {track.map((t) => {
            const active = t.heightM === heightM;
            return (
              <button
                key={t.heightM}
                type="button"
                aria-pressed={active}
                data-testid={`regret-height-${t.heightM}`}
                onClick={() => pick(t.heightM)}
                className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-left text-xs ${active ? "border-uncertainty/70 bg-uncertainty-soft" : "border-line bg-bg-2/60 hover:border-line-strong"}`}
              >
                <span className="flex items-center gap-2 font-semibold text-ink">
                  {t.heightM} m <span className="ml-auto"><WinnerTag winner={t.winner} short /></span>
                </span>
                <span className="tabular flex gap-3">
                  <span className="text-site-a">A {formatHoursMinutes(t.a)}</span>
                  <span className="text-site-b">B {formatHoursMinutes(t.b)}</span>
                </span>
                <span className="text-[10px] text-ink-faint">{kindLabel(t.kind)}</span>
              </button>
            );
          })}
        </div>

        <div>
          <p className="mb-1 flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
            <span>
              {METRIC_META[metric].label} · {windowId} · {L("terreno nominal · paquete de alturas", "nominal terrain · heights package")}
            </span>
            <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-site-a" /> A</span>
            <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-full border border-site-b" /> B</span>
            <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-4 rounded-sm bg-surface-3" /> {L("empate", "tie")}</span>
          </p>
          {series ? (
            <div className="overflow-x-auto"><div className="min-w-[600px]"><PackageChart series={series} metric={metric} heightM={heightM} onPick={pick} /></div></div>
          ) : ia.status === "error" || ib.status === "error" ? (
            <p className="text-xs text-warn">{L("No se pudo cargar el paquete de alturas; las tres alturas del contrato siguen arriba.", "The heights package could not be loaded; the three contract heights are still shown above.")}</p>
          ) : (
            <p className="text-xs text-ink-faint">{L("Cargando el paquete de alturas…", "Loading the heights package…")}</p>
          )}
          {series ? (
            <p className="mt-1 text-xs text-ink-muted" data-testid="regret-height-changes">
              {changes.length === 0
                ? L(
                    `Entre 0 y 30 m el ganador con «${CRITERION_META[criterion].short}» no cambia: ${WINNER_LABEL[series[0].winner]}.`,
                    `Between 0 and 30 m the winner on “${CRITERION_META[criterion].short}” does not change: ${WINNER_LABEL[series[0].winner]}.`,
                  )
                : L("Cambios del ganador entre alturas consecutivas: ", "Winner changes between consecutive heights: ") +
                  changes
                    .slice(0, 4)
                    .map((c) => `${formatNumber(c.from.height_m, c.from.height_m % 1 ? 1 : 0)} → ${formatNumber(c.to.height_m, c.to.height_m % 1 ? 1 : 0)} m: ${WINNER_LABEL[c.from.winner]} → ${WINNER_LABEL[c.to.winner]}`)
                    .join(" · ") +
                  (changes.length > 4 ? L(` · y ${changes.length - 4} más`, ` · and ${changes.length - 4} more`) : "")}
            </p>
          ) : null}
        </div>

        {sunCriterion && heightM === 0 ? (
          <Callout tone="uncertainty" icon="alert" title={L("A 0 m el resultado depende de microrrelieve", "At 0 m the result hinges on micro-relief")}>
            <span data-testid="regret-audit-0m">
              {R(
                "En W2 la sombra a ras de suelo la produce relieve a {da} (A) y {db} (B) del punto, que asoma solo {ha} y {hb} sobre la línea del Sol: menos que el error vertical del DEM en esos puntos ({ea} y {eb}). Al mover el observador ±2,5 m la racha de A va de {ra} y la de B de {rb}. B sale mejor en las {n} pruebas, pero las horas no son precisas. Desde {fa} (A) y {fb} (B) de altura ya no se detecta oscuridad; a 0,5 y 2 m ninguna prueba da sombra.",
                "In W2 the ground-level shadow comes from relief {da} (A) and {db} (B) from the point, rising only {ha} and {hb} above the Sun line: less than the DEM vertical error there ({ea} and {eb}). Moving the observer ±2.5 m, A's streak ranges {ra} and B's {rb}. B comes out better in all {n} tests, but the hours are not precise. From {fa} (A) and {fb} (B) height no darkness is detected; at 0.5 and 2 m no test gives shadow.",
                {
                  da: `${formatNumber(A.W2_0m_deepest?.obstacle_distance_m ?? null, 0)} m`,
                  db: `${formatNumber(B.W2_0m_deepest?.obstacle_distance_m ?? null, 0)} m`,
                  ha: `${formatNumber(A.W2_0m_deepest?.equivalent_height_m ?? null, 2)} m`,
                  hb: `${formatNumber(B.W2_0m_deepest?.equivalent_height_m ?? null, 2)} m`,
                  ea: `${formatNumber(A.toterr_m, 2)} m`,
                  eb: `${formatNumber(B.toterr_m, 2)} m`,
                  ra: <strong className="text-site-a">{`${formatHoursMinutes(A.W2_0m_dark_shift_range_h[0])} – ${formatHoursMinutes(A.W2_0m_dark_shift_range_h[1])}`}</strong>,
                  rb: <strong className="text-site-b">{`${formatHoursMinutes(B.W2_0m_dark_shift_range_h[0])} – ${formatHoursMinutes(B.W2_0m_dark_shift_range_h[1])}`}</strong>,
                  n: A.configs_tested,
                  fa: `${formatNumber(A.first_height_without_dark_W2_m, 2)} m`,
                  fb: `${formatNumber(B.first_height_without_dark_W2_m, 2)} m`,
                },
              )}{" "}
              {L("Auditoría diagnóstica, no escenario oficial.", "Diagnostic audit, not an official scenario.")}
            </span>
          </Callout>
        ) : null}
        {sunCriterion && heightM > 0 && mA !== null && mB !== null ? (
          <Callout tone="ok" icon="shield" title={L(`A ${heightM} m la ausencia de sombra es holgada`, `At ${heightM} m the absence of shadow has margin`)}>
            <span data-testid="regret-audit-margin">
              {R(
                "En {w} el centro del Sol nunca baja de {ma} (A) ni de {mb} (B) por encima del horizonte del modelo: más que el radio aparente del Sol (≈0,27°), así que el disco entero queda a la vista. En la auditoría, a 0,5 y 2 m tampoco aparece oscuridad con vecino más próximo, B-spline cúbica ni desplazamientos de ±2,5 m. No es iluminación garantizada: el modelo no incluye obstáculos menores que el DEM de 5 m ni equipos propios.",
                "In {w} the Sun centre never drops below {ma} (A) or {mb} (B) above the model horizon: more than the Sun's apparent radius (≈0.27°), so the whole disc stays visible. In the audit, at 0.5 and 2 m nearest-neighbour, cubic B-spline and ±2.5 m shifts show no darkness either. This is not guaranteed light: the model excludes obstacles smaller than the 5 m DEM and the lander's own hardware.",
                {
                  w: windowId,
                  ma: <strong className="text-site-a">{`${formatNumber(mA, 2)}°`}</strong>,
                  mb: <strong className="text-site-b">{`${formatNumber(mB, 2)}°`}</strong>,
                },
              )}
            </span>
          </Callout>
        ) : null}
        {!sunCriterion ? (
          <p className="text-xs text-ink-faint">
            {L(
              "Desde estos sitios la Tierra oscila entre unos −7° y +6° de elevación en las dos ventanas (efemérides del paquete): pasa mucho tiempo rozando el relieve, así que su visibilidad depende de crestas lejanas y cambia con la altura. Visibilidad geométrica, no enlace de radio.",
              "From these sites the Earth swings between about −7° and +6° elevation in both windows (package ephemerides): it spends a lot of time grazing the relief, so its visibility depends on distant ridges and changes with height. Geometric visibility, not a radio link.",
            )}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
