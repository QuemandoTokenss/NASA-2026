"use client";

import { useId } from "react";
import type { SiteId } from "@/lib/contract/constants";
import { formatHoursMinutes, formatUtc } from "@/lib/format";
import { SITE_META } from "@/lib/labels";
import { booleanRuns, longestHiddenRun, samplesToHours, sunVisible } from "@/lib/science/states";
import { dayTicks } from "../charts/TimeCharts";
import { L } from "@/lib/i18n";

const W = 1000;
const LEFT = 64;
const RIGHT = 12;
const PW = W - LEFT - RIGHT;
const ROW = 46;
const GAP = 40;

export interface StreakRow {
  site: SiteId;
  label: string;
  codes: number[];
}

/**
 * Franjas «Sol visible / no visible» por tramos originales y la racha más
 * larga sin Sol resaltada. La racha se localiza en `state_codes` con
 * `longestHiddenRun` (un test comprueba que su duración = `longest_dark_hours`).
 */
export function DarkStreakStrips({ rows, times }: { rows: StreakRow[]; times: string[] }) {
  const titleId = useId();
  const n = times.length - 1;
  const x = (i: number) => LEFT + (i / n) * PW;
  const top = 26;
  const H = top + rows.length * (ROW + GAP) + 6;
  const ticks = dayTicks(times, 5);
  const summary = rows
    .map((r) => {
      const run = longestHiddenRun(r.codes, sunVisible);
      return run
        ? L(
            `${r.label}: racha más larga sin Sol ${formatHoursMinutes(samplesToHours(run.end - run.start))}, de ${formatUtc(times[run.start])} a ${formatUtc(times[run.end])}`,
            `${r.label}: longest stretch without Sun ${formatHoursMinutes(samplesToHours(run.end - run.start))}, from ${formatUtc(times[run.start])} to ${formatUtc(times[run.end])}`,
          )
        : L(`${r.label}: sin rachas sin Sol`, `${r.label}: no stretches without Sun`);
    })
    .join(". ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
      <title id={titleId}>{`${L("Franjas de Sol visible y racha más larga sin Sol.", "Sun-visible strips and longest stretch without Sun.")} ${summary}.`}</title>
      {ticks.map((t) => (
        <g key={t.i}>
          <line x1={x(t.i)} x2={x(t.i)} y1={top - 6} y2={H - 6} stroke="var(--color-line)" strokeDasharray="2 4" />
          <text x={x(t.i)} y={12} textAnchor={x(t.i) > W - 40 ? "end" : "middle"} className="fill-ink-faint text-[12px]">
            {t.label}
          </text>
        </g>
      ))}
      {rows.map((r, k) => {
        const y0 = top + k * (ROW + GAP) + 18;
        const runs = booleanRuns(r.codes, sunVisible);
        const best = longestHiddenRun(r.codes, sunVisible);
        const color = SITE_META[r.site].colorVar;
        const bx0 = best ? x(best.start) : 0;
        const bx1 = best ? x(best.end) : 0;
        const mid = (bx0 + bx1) / 2;
        const label = best ? formatHoursMinutes(samplesToHours(best.end - best.start)) : "";
        const anchor = mid > W - 90 ? "end" : mid < LEFT + 90 ? "start" : "middle";
        return (
          <g key={`${r.site}-${r.label}`}>
            <text x={LEFT - 10} y={y0 + ROW / 2 + 4} textAnchor="end" className="text-[14px] font-semibold" fill={color}>
              {r.label}
            </text>
            {runs.map((run) => (
              <rect
                key={run.start}
                x={x(run.start)}
                y={y0}
                width={Math.max(0.6, x(run.end) - x(run.start))}
                height={ROW}
                fill={run.value ? "var(--color-state-sun)" : "var(--color-state-neither)"}
                opacity={run.value ? 0.9 : 1}
              />
            ))}
            {best ? (
              <g className="story-streak">
                <rect x={bx0 - 1.5} y={y0 - 3} width={bx1 - bx0 + 3} height={ROW + 6} rx={4} fill="none" stroke={color} strokeWidth={2.5} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
                <text x={anchor === "end" ? bx1 : anchor === "start" ? bx0 : mid} y={y0 - 8} textAnchor={anchor} className="text-[16px] font-bold" fill={color}>
                  {label}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
