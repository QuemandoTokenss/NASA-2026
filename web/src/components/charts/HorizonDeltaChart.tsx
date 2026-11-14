"use client";

import { useId, useMemo, type KeyboardEvent, type PointerEvent } from "react";
import { formatNumber } from "@/lib/format";
import { L } from "@/lib/i18n";

export interface DeltaSeries {
  key: string;
  label: string;
  color: string;
  /** Δ elevación del horizonte (°) por azimut; `null` = desconocido en alguna superficie (hueco). */
  delta: (number | null)[];
}

const W = 900;
const H = 230;
const M = { top: 14, right: 16, bottom: 30, left: 56 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

/**
 * Diferencia de horizonte variante − nominal por azimut (0° = norte, horario).
 * Sin suavizado; los azimuts desconocidos quedan como huecos. Se puede elegir un
 * azimut con el puntero o con las flechas (Mayús = 5°).
 */
export function HorizonDeltaChart({
  azimuthDeg,
  series,
  selected,
  onSelect,
  title,
}: {
  azimuthDeg: number[];
  series: DeltaSeries[];
  selected: number;
  onSelect: (i: number) => void;
  title: string;
}) {
  const descId = useId();
  const n = azimuthDeg.length;
  const limit = useMemo(() => {
    let m = 0;
    for (const s of series) for (const d of s.delta) if (d !== null && Math.abs(d) > m) m = Math.abs(d);
    return m > 0 ? m * 1.08 : 0.01;
  }, [series]);
  const x = (az: number) => M.left + (az / 360) * PW;
  const y = (d: number) => M.top + PH / 2 - (d / limit) * (PH / 2);

  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = "";
        let open = false;
        for (let i = 0; i <= n; i++) {
          const k = i % n;
          const v = s.delta[k];
          if (v === null || v === undefined) {
            open = false;
            continue;
          }
          const az = i === n ? 360 : azimuthDeg[k];
          d += `${open ? "L" : "M"}${x(az).toFixed(1)},${y(v).toFixed(1)}`;
          open = true;
        }
        return d;
      }),
    // x/y dependen solo de `limit`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, azimuthDeg, n, limit],
  );

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const az = Math.min(359.999, Math.max(0, ((px - M.left) / PW) * 360));
    onSelect(Math.round(az / (360 / n)) % n);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const stepN = e.shiftKey ? Math.round(5 / (360 / n)) : 1;
    if (e.key === "ArrowRight") onSelect((selected + stepN) % n);
    else if (e.key === "ArrowLeft") onSelect((selected - stepN + n) % n);
    else return;
    e.preventDefault();
  };

  const ticks = [-limit, -limit / 2, 0, limit / 2, limit].map((v) => v / 1.08);
  const sel = azimuthDeg[selected];
  return (
    <figure className="flex flex-col gap-2" data-testid="horizon-delta-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none rounded-xl border border-line bg-bg-2/60 focus-visible:outline-2 focus-visible:outline-accent"
        role="slider"
        tabIndex={0}
        aria-label={title}
        aria-describedby={descId}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={sel}
        aria-valuetext={`${formatNumber(sel, 2)}° · ${series.map((s) => `${s.label}: ${s.delta[selected] === null ? L("desconocido", "unknown") : `${formatNumber(s.delta[selected]!, 4)}°`}`).join(" · ")}`}
        onPointerDown={pick}
        onPointerMove={(e) => e.buttons === 1 && pick(e)}
        onKeyDown={onKey}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#e8eef8" : "#ffffff14"} strokeWidth={t === 0 ? 1 : 1} strokeDasharray={t === 0 ? "4 4" : undefined} />
            <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="fill-ink-faint text-[11px]">
              {t > 0 ? "+" : ""}
              {formatNumber(t, Math.abs(limit) < 0.05 ? 3 : 2)}°
            </text>
          </g>
        ))}
        {[0, 90, 180, 270, 360].map((az) => (
          <g key={az}>
            <line x1={x(az)} x2={x(az)} y1={M.top} y2={H - M.bottom} stroke="#ffffff10" />
            <text x={x(az)} y={H - 10} textAnchor="middle" className="fill-ink-faint text-[11px]">
              {az}° {az === 0 || az === 360 ? "N" : az === 90 ? "E" : az === 180 ? "S" : L("O", "W")}
            </text>
          </g>
        ))}
        {paths.map((d, i) => (
          <path key={series[i].key} d={d} fill="none" stroke={series[i].color} strokeWidth={1.4} strokeLinejoin="round" />
        ))}
        <line x1={x(sel)} x2={x(sel)} y1={M.top} y2={H - M.bottom} stroke="#a78bfa" strokeWidth={1.5} />
        {series.map((s) => (s.delta[selected] === null ? null : <circle key={s.key} cx={x(sel)} cy={y(s.delta[selected]!)} r={4} fill={s.color} stroke="#050912" strokeWidth={1.5} />))}
        <text x={M.left + 6} y={M.top + 12} className="fill-ink-faint text-[11px]">
          {L("▲ horizonte más alto en la variante", "▲ horizon higher in the variant")}
        </text>
        <text x={M.left + 6} y={H - M.bottom - 6} className="fill-ink-faint text-[11px]">
          {L("▼ más bajo", "▼ lower")}
        </text>
      </svg>
      <figcaption id={descId} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-faint">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span>
          {L(
            "Δ = horizonte de la variante − horizonte nominal (°), leído de los 1 440 azimuts del paquete. Huecos = desconocido. Flechas para mover el azimut.",
            "Δ = variant horizon − nominal horizon (°), read from the package's 1,440 azimuths. Gaps = unknown. Arrow keys move the azimuth.",
          )}
        </span>
      </figcaption>
    </figure>
  );
}
