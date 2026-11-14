"use client";

import { memo, useMemo, useState, type PointerEvent } from "react";
import { STATE_NAMES } from "@/lib/contract/constants";
import { dateFormat, formatHoursMinutes, formatNumber, formatUtc } from "@/lib/format";
import { STATE_META } from "@/lib/labels";
import type { IndexedInterval, Run } from "@/lib/science/states";
import { L } from "@/lib/i18n";

/**
 * Geometría común: todos los gráficos temporales comparten ancho y márgenes
 * para que el cursor y las franjas queden alineados verticalmente.
 * Eje X en índices de instante: 0 … N (N = 4320 intervalos, 4321 instantes).
 */
export const TW = 1200;
export const TM = { left: 92, right: 16 };
export const TPW = TW - TM.left - TM.right;
export const tx = (i: number, n: number) => TM.left + (i / n) * TPW;


/** Marcas cada `everyDays` días a las 00:00 UTC. */
export function dayTicks(times: string[], everyDays = 2) {
  const out: Array<{ i: number; label: string }> = [];
  const perDay = 144; // 10 min
  for (let i = 0; i < times.length; i += perDay * everyDays) out.push({ i, label: dateFormat("dayTick", { day: "numeric", month: "short" }).format(new Date(times[i])) });
  return out;
}

/* ----------------------------- Curvas ---------------------------------- */

export interface TimeSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
  dash?: string;
  width?: number;
  opacity?: number;
}

export interface Shade {
  start: number;
  end: number;
  color: string;
}

const H = 300;
const MT = 14;
const MB = 30;
const PH = H - MT - MB;

function pathOf(values: number[], n: number, y: (v: number) => number) {
  let d = "";
  for (let i = 0; i < values.length; i++) d += `${i ? "L" : "M"}${tx(i, n).toFixed(1)},${y(values[i]).toFixed(2)}`;
  return d;
}

const SeriesLayer = memo(function SeriesLayer({ series, n, yMin, yMax, shades, ticks }: { series: TimeSeries[]; n: number; yMin: number; yMax: number; shades: Shade[]; ticks: Array<{ i: number; label: string }> }) {
  const y = (v: number) => MT + ((yMax - v) / (yMax - yMin)) * PH;
  const step = yMax - yMin > 12 ? 4 : yMax - yMin > 6 ? 2 : yMax - yMin > 3 ? 1 : 0.5;
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) yTicks.push(Number(v.toFixed(2)));
  return (
    <g>
      <rect x={TM.left} y={MT} width={TPW} height={PH} rx={6} fill="var(--color-bg-2)" />
      {shades.map((s, k) => (
        <rect key={k} x={tx(s.start, n)} y={MT} width={Math.max(0.6, tx(s.end, n) - tx(s.start, n))} height={PH} fill={s.color} />
      ))}
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={TM.left} x2={TM.left + TPW} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--color-ink-faint)" : "var(--color-line)"} strokeDasharray={t === 0 ? "5 4" : undefined} />
          <text x={TM.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-faint)">
            {formatNumber(t, Number.isInteger(t) ? 0 : 1)}°
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <g key={t.i}>
          <line x1={tx(t.i, n)} x2={tx(t.i, n)} y1={MT} y2={MT + PH} stroke="var(--color-line)" strokeOpacity={0.6} />
          <text x={tx(t.i, n)} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--color-ink-muted)">
            {t.label}
          </text>
        </g>
      ))}
      {series.map((s) => (
        <path
          key={s.key}
          d={pathOf(s.values, n, y)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width ?? 1.6}
          strokeOpacity={s.opacity ?? 1}
          strokeDasharray={s.dash}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
});

/**
 * Curvas temporales (p. ej. elevación nominal de Sol/Tierra y del horizonte
 * en su azimut). `n` = número de intervalos (4320); las series tienen n+1 muestras.
 */
export function TimeSeriesChart({
  series,
  times,
  cursor,
  onPick,
  shades = [],
  title,
}: {
  series: TimeSeries[];
  times: string[];
  cursor: number;
  onPick?: (i: number) => void;
  shades?: Shade[];
  title: string;
}) {
  const n = times.length - 1;
  const [yMin, yMax] = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series)
      for (const v of s.values)
        if (Number.isFinite(v)) {
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
    const pad = Math.max(0.3, (hi - lo) * 0.08);
    return [Math.floor((lo - pad) * 2) / 2, Math.ceil((hi + pad) * 2) / 2];
  }, [series]);
  const ticks = useMemo(() => dayTicks(times), [times]);
  const y = (v: number) => MT + ((yMax - v) / (yMax - yMin)) * PH;
  function pick(e: PointerEvent<SVGSVGElement>) {
    if (!onPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round((((e.clientX - r.left) / r.width) * TW - TM.left) / TPW * n);
    if (i >= 0 && i < n) onPick(i);
  }
  return (
    <svg viewBox={`0 0 ${TW} ${H}`} className="h-auto w-full cursor-crosshair select-none" role="img" aria-label={title} onPointerDown={pick} onPointerMove={(e) => e.buttons === 1 && pick(e)}>
      <SeriesLayer series={series} n={n} yMin={yMin} yMax={yMax} shades={shades} ticks={ticks} />
      <g pointerEvents="none">
        <line x1={tx(cursor, n)} x2={tx(cursor, n)} y1={MT - 4} y2={MT + PH} stroke="#e8eef8" strokeOpacity={0.8} strokeWidth={1.2} />
        {series.map((s) => (s.dash ? null : <circle key={s.key} cx={tx(cursor, n)} cy={y(s.values[cursor])} r={4} fill={s.color} stroke="var(--color-bg)" strokeWidth={1.5} />))}
      </g>
    </svg>
  );
}

/* --------------------------- Franjas de estado -------------------------- */

const StripRects = memo(function StripRects({ items, n, y, h }: { items: Array<{ start: number; end: number; fill: string; hatch?: boolean }>; n: number; y: number; h: number }) {
  return (
    <g>
      {items.map((it, k) => (
        <rect key={k} x={tx(it.start, n)} y={y} width={Math.max(0.5, tx(it.end, n) - tx(it.start, n))} height={h} fill={it.hatch ? "url(#sr-hatch)" : it.fill} />
      ))}
    </g>
  );
});

export interface StripRow {
  key: string;
  label: string;
  /** Tramos categóricos (cinco estados) o booleanos (visible/oculto). */
  intervals?: IndexedInterval[];
  runs?: Run[];
  onColor?: string;
}

/**
 * Franjas temporales por tramos (no por muestra): unas decenas de rectángulos
 * por fila. Pasar el puntero muestra el intervalo original (inicio, fin, estado,
 * duración y censura en los bordes).
 */
export function StateStrips({ rows, times, cursor, onPick, showAxis = true }: { rows: StripRow[]; times: string[]; cursor: number; onPick?: (i: number) => void; showAxis?: boolean }) {
  const n = times.length - 1;
  const rowH = 22;
  const gap = 10;
  const top = 6;
  const axisH = showAxis ? 26 : 4;
  const height = top + rows.length * (rowH + gap) + axisH;
  const ticks = useMemo(() => dayTicks(times), [times]);
  const [hover, setHover] = useState<{ row: number; i: number } | null>(null);

  const rowItems = useMemo(
    () =>
      rows.map((r) =>
        r.intervals
          ? r.intervals.map((iv) => ({ start: iv.startIndex, end: iv.endIndex, fill: STATE_META[iv.state].colorVar, hatch: iv.state === "UNKNOWN" }))
          : (r.runs ?? []).map((run) => ({ start: run.start, end: run.end, fill: run.value ? (r.onColor ?? "var(--color-accent)") : "var(--color-surface-3)" })),
      ),
    [rows],
  );

  function locate(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * TW;
    const sy = ((e.clientY - rect.top) / rect.height) * height;
    const i = Math.floor(((sx - TM.left) / TPW) * n);
    const row = Math.floor((sy - top) / (rowH + gap));
    if (i < 0 || i >= n || row < 0 || row >= rows.length) return null;
    return { row, i };
  }

  const hovered = hover ? rows[hover.row] : null;
  const hoveredInterval = hover && hovered?.intervals ? hovered.intervals.find((iv) => hover.i >= iv.startIndex && hover.i < iv.endIndex) : null;
  const hoveredRun = hover && hovered?.runs ? hovered.runs.find((r) => hover.i >= r.start && hover.i < r.end) : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${TW} ${height}`}
        className="h-auto w-full cursor-crosshair select-none"
        role="img"
        aria-label={`Franjas temporales: ${rows.map((r) => r.label).join(", ")}`}
        onPointerMove={(e) => {
          setHover(locate(e));
          if (e.buttons === 1 && onPick) {
            const l = locate(e);
            if (l) onPick(l.i);
          }
        }}
        onPointerDown={(e) => {
          const l = locate(e);
          if (l && onPick) onPick(l.i);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <pattern id="sr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--color-surface-3)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-state-unknown)" strokeWidth="3" />
          </pattern>
        </defs>
        {rows.map((r, k) => {
          const y = top + k * (rowH + gap);
          return (
            <g key={r.key}>
              <text x={TM.left - 8} y={y + rowH / 2 + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-muted)">
                {r.label}
              </text>
              <rect x={TM.left} y={y} width={TPW} height={rowH} rx={5} fill="var(--color-bg-2)" />
              <StripRects items={rowItems[k]} n={n} y={y} h={rowH} />
            </g>
          );
        })}
        {showAxis
          ? ticks.map((t) => (
              <text key={t.i} x={tx(t.i, n)} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--color-ink-muted)">
                {t.label}
              </text>
            ))
          : null}
        <line x1={tx(cursor + 0.5, n)} x2={tx(cursor + 0.5, n)} y1={2} y2={height - axisH + 2} stroke="#e8eef8" strokeWidth={1.4} pointerEvents="none" />
      </svg>
      {hover && (hoveredInterval || hoveredRun) ? (
        <div
          role="status"
          className="pointer-events-none absolute z-20 w-72 rounded-lg border border-line-strong bg-[#0a1426f5] px-3 py-2 text-xs text-ink-muted shadow-[0_12px_32px_-8px_#000]"
          style={{ left: `min(calc(${(tx(hover.i, n) / TW) * 100}% + 12px), calc(100% - 18.5rem))`, top: 0 }}
        >
          <p className="font-semibold text-ink">{hovered?.label}</p>
          {hoveredInterval ? (
            <>
              <p>
                <span style={{ color: STATE_META[hoveredInterval.state].colorVar }}>■</span> {STATE_META[hoveredInterval.state].label} ({hoveredInterval.state})
              </p>
              <p className="tabular">
                {formatUtc(hoveredInterval.start)} → {formatUtc(hoveredInterval.stop)}
              </p>
              <p>
                {L("Duración", "Duration")} {formatHoursMinutes(hoveredInterval.duration_minutes / 60)}
                {hoveredInterval.left_censored ? L(" · empieza antes de la ventana (censurado)", " · starts before the window (censored)") : ""}
                {hoveredInterval.right_censored ? L(" · continúa tras la ventana (censurado)", " · continues after the window (censored)") : ""}
              </p>
            </>
          ) : hoveredRun ? (
            <>
              <p>{hoveredRun.value ? "Visible" : L("No visible", "Not visible")}</p>
              <p className="tabular">
                {formatUtc(times[hoveredRun.start])} → {formatUtc(times[hoveredRun.end])}
              </p>
              <p>{L("Duración", "Duration")} {formatHoursMinutes(((hoveredRun.end - hoveredRun.start) * 10) / 60)}</p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const stateLabel = (code: number) => STATE_META[STATE_NAMES[code]].label;
