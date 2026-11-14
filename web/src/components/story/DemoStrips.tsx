"use client";

import { useId } from "react";
import type { SiteId } from "@/lib/contract/constants";
import { formatHoursMinutes } from "@/lib/format";
import { L } from "@/lib/i18n";
import { SITE_META } from "@/lib/labels";
import { booleanRuns, earthVisible, longestHiddenRun, samplesToHours, sunVisible } from "@/lib/science/states";
import { dayTicks } from "../charts/TimeCharts";

const W = 1000;
const LEFT = 118;
const RIGHT = 10;
const PW = W - LEFT - RIGHT;
const ROW = 22;
const SITE_GAP = 26;
const SUN = "var(--color-state-sun)";
const EARTH = "var(--color-state-earth)";
const OFF = "var(--color-state-neither)";
const UNKNOWN = 4;

/**
 * Franjas estables de la demo: por sitio, «Sol visible» y «Tierra visible»
 * (visibilidad geométrica del centro) por tramos originales de `state_codes`.
 * Los intervalos UNKNOWN se dibujan rayados, nunca como sombra. La racha más
 * larga sin Sol se recuadra con su duración.
 */
export function DemoStrips({ rows, times }: { rows: Array<{ site: SiteId; codes: number[] }>; times: string[] }) {
  const pid = useId().replace(/:/g, "");
  const n = times.length - 1;
  const x = (i: number) => LEFT + (i / n) * PW;
  const top = 22;
  const block = 2 * ROW + 6;
  const H = top + rows.length * block + (rows.length - 1) * SITE_GAP + 4;
  const ticks = dayTicks(times, 5);

  const strip = (codes: number[], visible: (c: number) => boolean, on: string, y: number, key: string) =>
    booleanRuns(codes, (c) => (c === UNKNOWN ? false : visible(c)))
      .flatMap((run): Array<{ start: number; end: number; kind: "on" | "off" | "unknown" }> => {
        // Separa los tramos desconocidos dentro de un tramo «no visible».
        if (run.value) return [{ start: run.start, end: run.end, kind: "on" }];
        const out: Array<{ start: number; end: number; kind: "on" | "off" | "unknown" }> = [];
        let s = run.start;
        for (let i = run.start + 1; i <= run.end; i++) {
          if (i === run.end || (codes[i] === UNKNOWN) !== (codes[s] === UNKNOWN)) {
            out.push({ start: s, end: i, kind: codes[s] === UNKNOWN ? "unknown" : "off" });
            s = i;
          }
        }
        return out;
      })
      .map((r) => (
        <rect
          key={`${key}-${r.start}`}
          x={x(r.start)}
          y={y}
          width={Math.max(0.6, x(r.end) - x(r.start))}
          height={ROW}
          fill={r.kind === "on" ? on : r.kind === "unknown" ? `url(#${pid}-hatch)` : OFF}
        />
      ));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={L("Franjas de visibilidad del Sol y de la Tierra para A y B en la ventana W2", "Sun and Earth visibility strips for A and B in window W2")} data-testid="demo-strips">
      <defs>
        <pattern id={`${pid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--color-state-unknown)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff55" strokeWidth="2" />
        </pattern>
      </defs>
      {ticks.map((t) => (
        <g key={t.i}>
          <line x1={x(t.i)} x2={x(t.i)} y1={top - 4} y2={H - 2} stroke="var(--color-line)" strokeDasharray="2 4" />
          <text x={x(t.i)} y={12} textAnchor={x(t.i) > W - 40 ? "end" : "middle"} className="fill-ink-faint text-[12px]">
            {t.label}
          </text>
        </g>
      ))}
      {rows.map((r, k) => {
        const y0 = top + k * (block + SITE_GAP);
        const color = SITE_META[r.site].colorVar;
        const best = longestHiddenRun(r.codes, sunVisible);
        return (
          <g key={r.site}>
            <text x={8} y={y0 + ROW - 6} className="text-[14px] font-bold" fill={color}>
              {SITE_META[r.site].label}
            </text>
            <text x={LEFT - 8} y={y0 + ROW - 6} textAnchor="end" className="fill-ink-muted text-[12px]">
              {L("Sol", "Sun")}
            </text>
            <text x={LEFT - 8} y={y0 + 2 * ROW} textAnchor="end" className="fill-ink-muted text-[12px]">
              {L("Tierra", "Earth")}
            </text>
            {strip(r.codes, sunVisible, SUN, y0, `${r.site}-sun`)}
            {strip(r.codes, earthVisible, EARTH, y0 + ROW + 6, `${r.site}-earth`)}
            {best ? (
              <g>
                <rect x={x(best.start) - 1.5} y={y0 - 2} width={x(best.end) - x(best.start) + 3} height={ROW + 4} rx={3} fill="none" stroke={color} strokeWidth={2.5} />
                <text x={x(best.end) > W - 110 ? x(best.start) - 6 : x(best.end) + 6} y={y0 + ROW - 6} textAnchor={x(best.end) > W - 110 ? "end" : "start"} className="text-[13px] font-bold" fill={color}>
                  {formatHoursMinutes(samplesToHours(best.end - best.start))}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
