"use client";

import { formatDeg } from "@/lib/format";
import { L } from "@/lib/i18n";

const SUN_HEX = "#f5c518";
const EARTH_HEX = "#4f7cff";

/**
 * Brújula fija (norte local arriba) superpuesta a la escena 3D: azimut consultado
 * y, si el paquete trae direcciones para esta superficie, Sol y Tierra.
 * Azimut medido desde el norte local en sentido horario (convención del motor).
 */
export function CompassBadge({ azimuthDeg, sunAz, earthAz }: { azimuthDeg: number | null; sunAz: number | null; earthAz: number | null }) {
  const R = 34;
  const C = 46;
  const at = (az: number, r: number) => ({ x: C + r * Math.sin((az * Math.PI) / 180), y: C - r * Math.cos((az * Math.PI) / 180) });
  const tip = azimuthDeg === null ? null : at(azimuthDeg, R);
  return (
    <div className="pointer-events-none absolute right-2 bottom-2 flex flex-col items-center rounded-xl border border-line-strong bg-[#08101ee0] px-1.5 pt-1 pb-1.5 sm:right-3 sm:bottom-3 sm:px-2 sm:pt-1.5 sm:pb-2" data-testid="terrain-compass">
      <svg viewBox="0 0 92 92" className="size-[60px] sm:size-[92px]" role="img" aria-label={azimuthDeg === null ? L("Brújula", "Compass") : L(`Brújula: dirección de mirada ${formatDeg(azimuthDeg, 1)} desde el norte`, `Compass: viewing direction ${formatDeg(azimuthDeg, 1)} from north`)}>
        <circle cx={C} cy={C} r={R} fill="none" stroke="#e8eef8" strokeOpacity={0.5} />
        {[0, 90, 180, 270].map((a) => {
          const o = at(a, R);
          const i = at(a, R - (a === 0 ? 9 : 5));
          return <line key={a} x1={i.x} y1={i.y} x2={o.x} y2={o.y} stroke={a === 0 ? "#ff5b5b" : "#e8eef8"} strokeWidth={a === 0 ? 2.5 : 1.2} />;
        })}
        <text x={C} y={8} textAnchor="middle" fontSize={10} fontWeight={700} fill="#ff5b5b">
          N
        </text>
        <text x={C + R + 7} y={C + 3} textAnchor="middle" fontSize={8} fill="#9aa7bd">
          E
        </text>
        {azimuthDeg !== null ? (
          <path d={`M${C},${C - 16} A16,16 0 ${azimuthDeg > 180 ? 1 : 0} 1 ${at(azimuthDeg, 16).x},${at(azimuthDeg, 16).y}`} fill="none" stroke="#a78bfa" strokeWidth={2} />
        ) : null}
        {sunAz !== null ? <circle cx={at(sunAz, R).x} cy={at(sunAz, R).y} r={4.5} fill={SUN_HEX} stroke="#050912" /> : null}
        {earthAz !== null ? <circle cx={at(earthAz, R).x} cy={at(earthAz, R).y} r={4} fill={EARTH_HEX} stroke="#050912" /> : null}
        {tip ? <line x1={C} y1={C} x2={tip.x} y2={tip.y} stroke="#a78bfa" strokeWidth={3} strokeLinecap="round" /> : null}
        <circle cx={C} cy={C} r={3} fill="#e8eef8" />
      </svg>
      <span className="tabular text-[11px] font-semibold text-ink">{azimuthDeg === null ? "—" : `θ = ${formatDeg(azimuthDeg, 1)}`}</span>
      <span className="text-[9px] text-ink-faint">{L("desde el norte", "from north")}</span>
    </div>
  );
}
