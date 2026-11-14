"use client";

import { formatHoursMinutes, formatNumber } from "@/lib/format";

/**
 * Anillo de fracción REAL de la ventana (p. ej. horas con Sol / 720 h).
 * No es una puntuación: la etiqueta muestra el denominador.
 */
export function WindowRing({
  value,
  total,
  color,
  label,
  size = 132,
}: {
  value: number;
  total: number;
  color: string;
  label: string;
  size?: number;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 128 128" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth="9" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dasharray 600ms cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      <div className="relative text-center">
        <div className="tabular text-xl font-bold leading-none text-ink">{formatHoursMinutes(value)}</div>
        <div className="mt-1 text-[10px] leading-tight text-ink-faint">
          {label}
          <br />
          de {formatNumber(total, 0)} h ({formatNumber(frac * 100, 1)} %)
        </div>
      </div>
    </div>
  );
}

/** Dos barras A/B en horas sobre una escala común explícita. */
export function PairBars({ a, b, max, unitLabel = "h" }: { a: number; b: number; max: number; unitLabel?: string }) {
  const w = (v: number) => `${max > 0 ? Math.max(0.5, (v / max) * 100) : 0}%`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5" aria-hidden>
      {(
        [
          ["A", a, "var(--color-site-a)"],
          ["B", b, "var(--color-site-b)"],
        ] as const
      ).map(([k, v, color]) => (
        <div key={k} className="flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3/70">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: w(v), background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 10px -2px ${color}` }}
            />
          </div>
          <span className="tabular w-16 shrink-0 text-right text-[11px] text-ink-muted">
            {formatNumber(v, 1)} {unitLabel}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Barra divergente centrada en 0 para D = U_A − U_B (horas del criterio):
 * a la izquierda favorece a B (cian), a la derecha a A (naranja).
 */
export function DivergingBar({ value, max, tie }: { value: number | null; max: number; tie?: boolean }) {
  if (value === null) return <div className="h-3 rounded-full pattern-hatch opacity-60" aria-hidden />;
  const pct = max > 0 ? Math.min(50, (Math.abs(value) / max) * 50) : 0;
  const color = tie ? "var(--color-ink-faint)" : value > 0 ? "var(--color-site-a)" : "var(--color-site-b)";
  return (
    <div className="relative h-3 rounded-full bg-surface-3/60" aria-hidden>
      <div className="absolute inset-y-[-3px] left-1/2 w-px bg-line-strong" />
      <div
        className="absolute inset-y-0 rounded-full transition-all duration-500 ease-out"
        style={{
          left: value >= 0 ? "50%" : `${50 - pct}%`,
          width: `${Math.max(tie ? 0.8 : 0.5, pct)}%`,
          background: color,
          boxShadow: tie ? undefined : `0 0 10px -2px ${color}`,
        }}
      />
    </div>
  );
}
