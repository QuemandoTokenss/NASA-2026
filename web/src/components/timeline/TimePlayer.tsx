"use client";

import { useEffect, useId, useRef, useState } from "react";
import { STATE_SAMPLES } from "@/lib/contract/constants";
import { formatUtc } from "@/lib/format";
import { useSelection } from "@/lib/state/SelectionProvider";
import { Icon } from "../ui/Icon";
import { L } from "@/lib/i18n";

/** Velocidades en intervalos de 10 min por segundo (no se interpola nada). */
const SPEEDS = [
  { label: "1 h/s", steps: 6 },
  { label: "6 h/s", steps: 36 },
  { label: "1 día/s", steps: 144 },
  { label: "3 días/s", steps: 432 },
];

/**
 * Reproductor sobre los instantes reales de la ventana: avanza de 10 en 10
 * minutos (índices de intervalo 0…4319). Comparte `timeIndex` global.
 */
export function TimePlayer({ times }: { times: string[] }) {
  const { selection, dispatch } = useSelection();
  const i = selection.timeIndex;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const acc = useRef(0);
  const indexRef = useRef(i);
  useEffect(() => {
    indexRef.current = i;
  }, [i]);
  const sliderId = useId();
  const last = STATE_SAMPLES - 1;

  useEffect(() => {
    if (!playing) return;
    const tick = 80; // ms
    const id = setInterval(() => {
      acc.current += (SPEEDS[speed].steps * tick) / 1000;
      const whole = Math.floor(acc.current);
      if (!whole) return;
      acc.current -= whole;
      const next = indexRef.current + whole;
      indexRef.current = Math.min(next, last);
      if (next >= last) {
        dispatch({ type: "setTimeIndex", value: last });
        setPlaying(false);
      } else dispatch({ type: "setTimeIndex", value: next });
    }, tick);
    return () => clearInterval(id);
  }, [playing, speed, dispatch, last]);

  const set = (v: number) => dispatch({ type: "setTimeIndex", value: v });
  const btn = "grid size-9 place-items-center rounded-xl border border-line-strong bg-surface-2 text-ink-muted transition-colors hover:border-accent/50 hover:text-ink disabled:opacity-40";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-gradient-to-r from-surface/90 to-bg-2/80 p-4 lg:flex-row lg:items-center lg:gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (!playing && i >= last) set(0);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? L("Pausar", "Pause") : L("Reproducir", "Play")}
          className="grid size-12 shrink-0 place-items-center rounded-full border border-accent/60 bg-gradient-to-b from-accent-surface to-[#0b1a36] text-ink shadow-[0_0_24px_-6px_#3a6ff0] transition-transform hover:scale-105"
        >
          <Icon name={playing ? "pause" : "play"} className="size-5" />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{L("Simulación temporal", "Time playback")}</p>
          <p aria-live="off" className="tabular text-xs text-ink-muted">
            {formatUtc(times[i])} → {formatUtc(times[i + 1])}
          </p>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label htmlFor={sliderId} className="sr-only">
          {L("Instante de la ventana", "Instant in the window")}
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={last}
          step={1}
          value={i}
          onChange={(e) => set(Number(e.target.value))}
          aria-valuetext={formatUtc(times[i])}
          className="w-full accent-[#8fb4ff]"
        />
        <div className="flex justify-between text-[10px] text-ink-faint">
          <span>{formatUtc(times[0])}</span>
          <span>
            {L("Intervalo", "Interval")} {i + 1} {L("de", "of")} {STATE_SAMPLES} · {L("paso 10 min", "10 min step")}
          </span>
          <span>{formatUtc(times[times.length - 1])}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} onClick={() => set(Math.max(0, i - 144))} aria-label={L("Retroceder 1 día", "Back 1 day")} title={L("−1 día", "−1 day")}>
          <Icon name="skipBack" className="size-4" />
        </button>
        <button type="button" className={btn} onClick={() => set(Math.max(0, i - 1))} aria-label={L("Retroceder 10 minutos", "Back 10 minutes")} title="−10 min">
          <Icon name="stepBack" className="size-4" />
        </button>
        <button type="button" className={btn} onClick={() => set(Math.min(last, i + 1))} aria-label={L("Avanzar 10 minutos", "Forward 10 minutes")} title="+10 min">
          <Icon name="stepForward" className="size-4" />
        </button>
        <button type="button" className={btn} onClick={() => set(Math.min(last, i + 144))} aria-label={L("Avanzar 1 día", "Forward 1 day")} title={L("+1 día", "+1 day")}>
          <Icon name="skipForward" className="size-4" />
        </button>
        <label className="sr-only" htmlFor={`${sliderId}-speed`}>
          {L("Velocidad", "Speed")}
        </label>
        <select
          id={`${sliderId}-speed`}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="rounded-xl border border-line-strong bg-surface-2 px-2 py-2 text-xs text-ink"
        >
          {SPEEDS.map((s, k) => (
            <option key={s.label} value={k}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
