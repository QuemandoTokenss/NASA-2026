"use client";

import { useId } from "react";
import { formatNumber } from "@/lib/format";
import type { ProfileSample } from "@/lib/geospatial/raster";
import { L } from "@/lib/i18n";

const W = 640;
const H = 180;
const M = { l: 52, r: 10, t: 10, b: 26 };

/** Perfil de elevación muestreado del DEM. Los huecos (sin dato) se dejan en blanco. */
export function ProfileChart({ samples }: { samples: ProfileSample[] }) {
  const titleId = useId();
  const valid = samples.filter((s) => s.value !== null) as Array<ProfileSample & { value: number }>;
  if (valid.length < 2) return <p className="text-xs text-ink-faint">{L("Sin datos de elevación en este trazado.", "No elevation data along this line.")}</p>;
  const dMax = samples[samples.length - 1].distanceM || 1;
  const zMin = Math.min(...valid.map((s) => s.value));
  const zMax = Math.max(...valid.map((s) => s.value));
  const pad = Math.max(0.5, (zMax - zMin) * 0.08);
  const x = (d: number) => M.l + (d / dMax) * (W - M.l - M.r);
  const y = (z: number) => M.t + ((zMax + pad - z) / (zMax - zMin + 2 * pad)) * (H - M.t - M.b);
  let path = "";
  let pen = false;
  for (const s of samples) {
    if (s.value === null) {
      pen = false;
      continue;
    }
    path += `${pen ? "L" : "M"}${x(s.distanceM).toFixed(1)} ${y(s.value).toFixed(1)}`;
    pen = true;
  }
  const gaps = samples.length - valid.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
      <title id={titleId}>
        {L(
          `Perfil de elevación: ${formatNumber(dMax, 0)} m de longitud, de ${formatNumber(zMin, 1)} a ${formatNumber(zMax, 1)} m; ${gaps} muestras sin dato.`,
          `Elevation profile: ${formatNumber(dMax, 0)} m long, from ${formatNumber(zMin, 1)} to ${formatNumber(zMax, 1)} m; ${gaps} samples without data.`,
        )}
      </title>
      <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} rx={4} fill="var(--color-bg-2)" />
      {[zMin, (zMin + zMax) / 2, zMax].map((z) => (
        <g key={z}>
          <line x1={M.l} x2={W - M.r} y1={y(z)} y2={y(z)} stroke="var(--color-line)" strokeDasharray="3 4" />
          <text x={M.l - 6} y={y(z) + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-faint)">
            {formatNumber(z, 1)}
          </text>
        </g>
      ))}
      {[0, dMax / 2, dMax].map((d) => (
        <text key={d} x={x(d)} y={H - 8} textAnchor={d === 0 ? "start" : d === dMax ? "end" : "middle"} fontSize={11} fill="var(--color-ink-faint)">
          {formatNumber(d, 0)} m
        </text>
      ))}
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}
