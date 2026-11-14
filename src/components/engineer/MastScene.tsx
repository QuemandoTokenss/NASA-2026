"use client";

import type { HeightM, SiteId } from "@/lib/contract/constants";
import { SITE_META } from "@/lib/labels";
import { L } from "@/lib/i18n";

/**
 * ESCENA ILUSTRATIVA (no a escala, sin cálculo de sombras): explica qué
 * significa «elevar el observador». Los resultados científicos están en los
 * paneles de datos, no en este dibujo.
 */
export function MastScene({ heightM, site }: { heightM: HeightM; site: SiteId }) {
  const color = SITE_META[site].colorVar;
  // Altura visual del mástil (no lineal, ilustrativa).
  const px = heightM === 0 ? 0 : heightM === 2 ? 70 : 170;
  const baseX = 380;
  const groundY = 330;
  const eyeY = groundY - 6 - px;
  const ridgeY = 262; // cresta lejana
  // Línea de visión rasante: del ojo a la cresta, prolongada.
  const tx = 860;
  const slope = (ridgeY - eyeY) / (tx - 120 - baseX);
  const endX = 960;
  const endY = eyeY + slope * (endX - baseX);
  return (
    <svg viewBox="0 0 960 400" className="h-auto w-full" role="img" aria-label={L(`Ilustración: observador a ${heightM} m sobre el terreno y su línea de visión al horizonte`, `Illustration: observer ${heightM} m above the ground and its line of sight to the horizon`)}>
      <defs>
        <linearGradient id="ms-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#02040a" />
          <stop offset="0.75" stopColor="#081428" />
          <stop offset="1" stopColor="#0d1f3d" />
        </linearGradient>
        <linearGradient id="ms-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4150" />
          <stop offset="1" stopColor="#14171f" />
        </linearGradient>
        <radialGradient id="ms-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="0.35" stopColor="#f5c518" />
          <stop offset="1" stopColor="#f5c51800" />
        </radialGradient>
        <linearGradient id="ms-beam" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#f5c518" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f5c518" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="960" height="400" fill="url(#ms-sky)" />
      {Array.from({ length: 70 }, (_, i) => (
        <circle key={i} cx={(i * 137.5) % 960} cy={(i * 59.3) % 230} r={i % 7 === 0 ? 1.3 : 0.7} fill="#cfe0ff" opacity={0.25 + ((i * 13) % 50) / 100} />
      ))}
      {/* Tierra (ilustración) */}
      <circle cx="120" cy="90" r="34" fill="#1f4e9c" opacity="0.9" />
      <path d="M100 76c10-6 24-4 30 4s-6 18-14 16-22-12-16-20z" fill="#3ccf7a" opacity="0.55" />
      {/* Sol rasante (ilustración) */}
      <circle cx="905" cy="238" r="70" fill="url(#ms-sun)" />
      <path d={`M905 238 L ${baseX + 8} ${eyeY - 2} L ${baseX + 8} ${eyeY + 8} Z`} fill="url(#ms-beam)" opacity={heightM === 0 ? 0.35 : 0.7} className="transition-all duration-700" />
      {/* Cresta lejana */}
      <path d="M0 300 L120 288 L240 296 L330 284 L470 290 L600 276 L700 268 L760 262 L820 270 L960 282 L960 400 L0 400 Z" fill="#20252f" />
      {/* Terreno cercano */}
      <path d="M0 340 L140 334 L260 338 L380 330 L520 336 L700 330 L960 342 L960 400 L0 400 Z" fill="url(#ms-ground)" />
      {/* Línea de visión al horizonte */}
      <line x1={baseX} y1={eyeY} x2={endX} y2={endY} stroke={color} strokeWidth={1.6} strokeDasharray="6 5" className="transition-all duration-700" />
      {/* Mástil */}
      <g className="transition-all duration-700">
        {px > 0 ? (
          <>
            <line x1={baseX - 9} y1={groundY} x2={baseX - 2} y2={eyeY} stroke="#c8d2e4" strokeWidth={2} />
            <line x1={baseX + 9} y1={groundY} x2={baseX + 2} y2={eyeY} stroke="#c8d2e4" strokeWidth={2} />
            {Array.from({ length: Math.max(1, Math.round(px / 18)) }, (_, k) => {
              const y1 = groundY - (k * px) / Math.max(1, Math.round(px / 18));
              const y2 = groundY - ((k + 1) * px) / Math.max(1, Math.round(px / 18));
              return <line key={k} x1={baseX - 8} y1={y1} x2={baseX + 8} y2={y2} stroke="#8fa0bd" strokeWidth={1} />;
            })}
          </>
        ) : null}
        <circle cx={baseX} cy={eyeY} r={7} fill={color} stroke="#050912" strokeWidth={2} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      </g>
      {/* Cota */}
      <g>
        <line x1={baseX - 40} y1={groundY} x2={baseX - 40} y2={eyeY} stroke="#e8eef8" strokeWidth={1} />
        <line x1={baseX - 46} y1={groundY} x2={baseX - 34} y2={groundY} stroke="#e8eef8" />
        <line x1={baseX - 46} y1={eyeY} x2={baseX - 34} y2={eyeY} stroke="#e8eef8" />
        <rect x={baseX - 112} y={(groundY + eyeY) / 2 - 15} width={60} height={28} rx={8} fill="#0b1424" stroke="#a78bfa" />
        <text x={baseX - 82} y={(groundY + eyeY) / 2 + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill="#e8eef8">
          {heightM} m
        </text>
      </g>
      <g>
        <rect x="16" y="356" width="292" height="28" rx="8" fill="#0b1424e6" stroke="#2a3f63" />
        <text x="30" y="375" fontSize="12.5" fill="#9aaac4">
          {L("ILUSTRACIÓN · no a escala · sin cálculo de sombras", "ILLUSTRATION · not to scale · no shadow computation")}
        </text>
      </g>
    </svg>
  );
}
