"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatDeg, formatNumber } from "@/lib/format";
import { L } from "@/lib/i18n";

export interface HorizonSeries {
  key: string;
  label: string;
  color: string;
  azimuthDeg: number[];
  elevationDeg: number[];
  unknown: boolean[];
  emphasis?: boolean;
}

const DEFAULT_W = 900;
const M0 = { top: 16, right: 16, bottom: 34, left: 48 };
const CARDINALS = [
  { az: 0, label: "N" },
  { az: 90, label: "E" },
  { az: 180, label: "S" },
  { az: 270, label: "O" },
  { az: 360, label: "N" },
];

/**
 * Perfil de horizonte por azimut (0° = norte, sentido horario hacia el este).
 * Dibuja las muestras del paquete sin suavizar; el cierre 359,75° → 360° usa la
 * muestra de 0° (interpolación periódica documentada en el contrato).
 * Las muestras `unknown` se dejan como huecos, nunca como 0°.
 */
export interface SkyTrack {
  key: string;
  label: string;
  color: string;
  azimuthDeg: number[];
  elevationDeg: number[];
  cursor?: number;
  /** Opcional: imagen del cuerpo (centrada en el punto real) en lugar del punto genérico. */
  iconHref?: string;
}

export function HorizonChart({
  series,
  title,
  tracks = [],
  height = 300,
  fill = false,
}: {
  series: HorizonSeries[];
  title: string;
  tracks?: SkyTrack[];
  height?: number;
  /**
   * Ocupa todo el alto y el ancho de su contenedor (que debe tener altura propia, p. ej. una tarjeta
   * estirada por la rejilla). El dibujo se hace en píxeles reales: crecer da más resolución angular,
   * no letra más grande.
   */
  fill?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!fill || !el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      const h = Math.round(e.contentRect.height);
      setBox((b) => (b && b.w === w && b.h === h ? b : w > 0 && h > 0 ? { w, h } : b));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);
  const W = fill && box ? box.w : DEFAULT_W;
  const H = fill && box ? box.h : height;
  // Con iconos de cuerpos se deja aire arriba para que el disco no quede cortado en el borde.
  const M = { ...M0, top: tracks.some((t) => t.iconHref) ? 34 : M0.top };
  const PW = W - M.left - M.right;
  const PH = H - M.top - M.bottom;
  const descId = useId();
  const [cursor, setCursor] = useState<number | null>(null); // índice de azimut

  const n = series[0]?.azimuthDeg.length ?? 0;
  const step = n > 0 ? 360 / n : 0.25;

  const [yMin, yMax] = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series)
      s.elevationDeg.forEach((v, i) => {
        if (!s.unknown[i]) {
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      });
    for (const t of tracks)
      for (const v of t.elevationDeg) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    if (!Number.isFinite(lo)) return [-1, 1];
    return [Math.floor(lo - 0.25), Math.ceil(hi + 0.25)];
  }, [series, tracks]);


  const x = (az: number) => M.left + (az / 360) * PW;
  const y = (el: number) => M.top + ((yMax - el) / (yMax - yMin)) * PH;

  // Trayectorias en el cielo (nominal): se corta el trazo al cruzar 360° → 0°.
  const trackPaths = useMemo(
    () =>
      tracks.map((t) => {
        let d = "";
        for (let i = 0; i < t.azimuthDeg.length; i++) {
          const jump = i > 0 && Math.abs(t.azimuthDeg[i] - t.azimuthDeg[i - 1]) > 180;
          d += `${i === 0 || jump ? "M" : "L"}${x(t.azimuthDeg[i]).toFixed(1)},${y(t.elevationDeg[i]).toFixed(2)}`;
        }
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, yMin, yMax, W, H],
  );

  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = "";
        let pen = false;
        const len = s.azimuthDeg.length;
        for (let i = 0; i <= len; i++) {
          const j = i % len;
          const az = i === len ? 360 : s.azimuthDeg[j];
          if (s.unknown[j]) {
            pen = false;
            continue;
          }
          d += `${pen ? "L" : "M"}${x(az).toFixed(2)},${y(s.elevationDeg[j]).toFixed(2)}`;
          pen = true;
        }
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, yMin, yMax, W, H],
  );

  const yTicks = useMemo(() => {
    const span = yMax - yMin;
    const tickStep = span > 8 ? 2 : span > 4 ? 1 : 0.5;
    const out: number[] = [];
    for (let v = Math.ceil(yMin / tickStep) * tickStep; v <= yMax + 1e-9; v += tickStep) out.push(Number(v.toFixed(2)));
    return out;
  }, [yMin, yMax]);

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const az = ((px - M.left) / PW) * 360;
    if (az < 0 || az > 360) return setCursor(null);
    setCursor(Math.round(az / step) % n);
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    const delta = e.key === "ArrowRight" ? 4 : e.key === "ArrowLeft" ? -4 : e.key === "PageUp" ? 40 : e.key === "PageDown" ? -40 : 0;
    if (!delta) return;
    e.preventDefault();
    setCursor((c) => ((c ?? 0) + delta + n) % n);
  }

  const summary = series
    .map((s) => {
      const vals = s.elevationDeg.filter((_, i) => !s.unknown[i]);
      const unknown = s.unknown.filter(Boolean).length;
      return `${s.label}: ${L("mínimo", "minimum")} ${formatDeg(Math.min(...vals))}, ${L("máximo", "maximum")} ${formatDeg(Math.max(...vals))}${unknown ? `, ${unknown} ${L("azimuts desconocidos", "unknown azimuths")}` : ""}`;
    })
    .join(". ");

  return (
    <div className={`flex flex-col gap-2 ${fill ? "h-full min-h-0" : ""}`} data-chart-size={`${W}x${H}`}>
      <p id={descId} className="sr-only">
        {title}. {summary}. {L("Use las flechas izquierda y derecha para recorrer el azimut.", "Use the left and right arrows to move along the azimuth.")}
      </p>
      <div ref={boxRef} className={fill ? "relative min-h-[260px] flex-1" : "contents"}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={`${fill ? "absolute inset-0 h-full" : "h-auto"} w-full touch-none select-none`}
        role="img"
        aria-label={title}
        aria-describedby={descId}
        tabIndex={0}
        onPointerMove={onPointer}
        onPointerLeave={() => setCursor(null)}
        onKeyDown={onKey}
        onBlur={() => setCursor(null)}
      >
        <rect x={M.left} y={M.top} width={PW} height={PH} fill="var(--color-bg-2)" rx={6} />
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + PW} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--color-ink-faint)" : "var(--color-line)"} strokeDasharray={t === 0 ? "5 4" : undefined} />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill="var(--color-ink-faint)" className="tabular">
              {formatNumber(t, Number.isInteger(t) ? 0 : 1)}°
            </text>
          </g>
        ))}
        {CARDINALS.map((c) => (
          <g key={c.az}>
            <line x1={x(c.az)} x2={x(c.az)} y1={M.top} y2={M.top + PH} stroke="var(--color-line)" />
            <text x={x(c.az)} y={H - 12} textAnchor="middle" fontSize={12} fill="var(--color-ink-muted)">
              {c.label} · {c.az}°
            </text>
          </g>
        ))}
        {series.map((s, i) => (
          <path
            key={s.key}
            d={paths[i]}
            fill="none"
            stroke={s.color}
            strokeWidth={s.emphasis ? 2 : 1.3}
            strokeOpacity={s.emphasis ? 1 : 0.75}
            strokeLinejoin="round"
          />
        ))}
        {tracks.map((t, k) => (
          <g key={t.key} pointerEvents="none">
            <path d={trackPaths[k]} fill="none" stroke={t.color} strokeWidth={1.4} strokeOpacity={0.7} />
            {t.cursor !== undefined && t.iconHref ? (
              (() => {
                const cx = x(t.azimuthDeg[t.cursor]);
                const cy = y(t.elevationDeg[t.cursor]);
                const r = 20;
                // Etiquetas separadas si dos cuerpos coinciden: la segunda baja con una guía.
                const other = tracks.find((o, j) => j !== k && o.cursor !== undefined && o.iconHref && Math.abs(x(o.azimuthDeg[o.cursor!]) - cx) < 70 && Math.abs(y(o.elevationDeg[o.cursor!]) - cy) < 40);
                const dy = other && k > 0 ? 40 : -29;
                const ly = Math.min(M.top + PH - 4, Math.max(M.top + 10, cy + dy));
                return (
                  <g data-testid={`sky-body-${t.key}`}>
                    <circle cx={cx} cy={cy} r={r + 3} fill="var(--color-bg)" opacity={0.65} />
                    <image href={t.iconHref} x={cx - r} y={cy - r} width={r * 2} height={r * 2} />
                    <circle cx={cx} cy={cy} r={r + 1.5} fill="none" stroke={t.color} strokeWidth={1.5} />
                    {Math.abs(ly - cy) > 26 ? <line x1={cx} y1={cy + (ly > cy ? r + 2 : -r - 2)} x2={cx} y2={ly + (ly > cy ? -10 : 2)} stroke={t.color} strokeOpacity={0.6} /> : null}
                    <text x={cx} y={ly} textAnchor="middle" className="text-[12px] font-semibold" fill="var(--color-ink)" stroke="var(--color-bg)" strokeWidth={3} paintOrder="stroke">
                      {t.label}
                    </text>
                  </g>
                );
              })()
            ) : t.cursor !== undefined ? (
              <circle cx={x(t.azimuthDeg[t.cursor])} cy={y(t.elevationDeg[t.cursor])} r={6} fill={t.color} stroke="var(--color-bg)" strokeWidth={2} style={{ filter: `drop-shadow(0 0 6px ${t.color})` }} />
            ) : null}
          </g>
        ))}
        {cursor !== null ? (
          <g pointerEvents="none">
            <line x1={x(cursor * step)} x2={x(cursor * step)} y1={M.top} y2={M.top + PH} stroke="var(--color-ink-muted)" strokeDasharray="3 3" />
            {series.map((s) =>
              s.unknown[cursor] ? null : (
                <circle key={s.key} cx={x(s.azimuthDeg[cursor])} cy={y(s.elevationDeg[cursor])} r={4} fill={s.color} stroke="var(--color-bg)" strokeWidth={1.5} />
              ),
            )}
          </g>
        ) : null}
      </svg>
      </div>
      <div aria-live="polite" className="tabular flex min-h-5 flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
        {cursor !== null ? (
          <>
            <span>
              Azimut <strong className="text-ink">{formatNumber(series[0].azimuthDeg[cursor], 2)}°</strong>
            </span>
            {series.map((s) => (
              <span key={s.key}>
                <span style={{ color: s.color }}>{s.label}</span>:{" "}
                <strong className="text-ink">{s.unknown[cursor] ? "desconocido" : formatDeg(s.elevationDeg[cursor], 3)}</strong>
              </span>
            ))}
          </>
        ) : (
          <span>{L("Pasa el puntero o usa las flechas sobre el gráfico para leer valores exactos del paquete.", "Hover or use the arrow keys on the chart to read exact package values.")}</span>
        )}
      </div>
    </div>
  );
}
