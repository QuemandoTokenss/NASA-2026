"use client";

import type { SiteId } from "@/lib/contract/constants";
import type { Site } from "@/lib/contract/schema";
import { BASE_PATH } from "@/lib/data/loader";
import { dataUrl } from "@/lib/data/manifest";
import { CONTEXT_FIGURE, FIGURE_PX_PER_M, figureXY } from "@/lib/figure";
import { formatNumber } from "@/lib/format";
import { SITE_META } from "@/lib/labels";
import { L } from "@/lib/i18n";

/**
 * Recorte de la figura DEM ORIGINAL (40 m/píxel) que contiene ambos sitios,
 * con la separación medida en el plano estereográfico (`sites[].x_m/y_m`).
 */
export function PairMap({ a, b, width = 640, height = 360, scale = 1.8 }: { a: Site; b: Site; width?: number; height?: number; scale?: number }) {
  const pa = figureXY(a.x_m, a.y_m);
  const pb = figureXY(b.x_m, b.y_m);
  const cx = (pa.x + pb.x) / 2;
  const cy = (pa.y + pb.y) / 2;
  const toScreen = (p: { x: number; y: number }) => ({ x: width / 2 + (p.x - cx) * scale, y: height / 2 + (p.y - cy) * scale });
  const sa = toScreen(pa);
  const sb = toScreen(pb);
  const dist = Math.hypot(a.x_m - b.x_m, a.y_m - b.y_m);
  const barM = 200;
  const barPx = barM * FIGURE_PX_PER_M * scale;
  const { width: fw, height: fh } = CONTEXT_FIGURE.viewBox;
  const marker = (s: { x: number; y: number }, id: SiteId) => {
    const c = SITE_META[id].colorVar;
    return (
      <g key={id}>
        <circle cx={s.x} cy={s.y} r={22} fill="none" stroke="#050912" strokeOpacity={0.55} strokeWidth={7} />
        <circle cx={s.x} cy={s.y} r={22} fill="none" stroke={c} strokeWidth={3} style={{ filter: `drop-shadow(0 0 8px ${c})` }} />
        <circle cx={s.x} cy={s.y} r={4} fill={c} />
      </g>
    );
  };
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-line-strong bg-white" style={{ aspectRatio: `${width} / ${height}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- figura original del motor */}
      <img
        src={dataUrl(BASE_PATH, CONTEXT_FIGURE.path)}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute max-w-none select-none"
        style={{
          width: `${((fw * scale) / width) * 100}%`,
          left: `${((width / 2 - cx * scale) / width) * 100}%`,
          top: `${((height / 2 - cy * scale) / height) * 100}%`,
          height: "auto",
          aspectRatio: `${fw} / ${fh}`,
        }}
      />
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full" role="img" aria-label={L(`Sitio A y Sitio B separados ${formatNumber(dist, 0)} m en el plano del mapa`, `Site A and Site B ${formatNumber(dist, 0)} m apart on the map plane`)}>
        <line x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} stroke="#050912" strokeWidth={4} strokeOpacity={0.5} />
        <line x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} stroke="#e8eef8" strokeWidth={2} strokeDasharray="6 5" />
        <g>
          <rect x={(sa.x + sb.x) / 2 - 36} y={(sa.y + sb.y) / 2 - 13} width={72} height={26} rx={13} fill="#050912e0" stroke="#e8eef880" />
          <text x={(sa.x + sb.x) / 2} y={(sa.y + sb.y) / 2 + 5} textAnchor="middle" className="text-[13px] font-bold" fill="#e8eef8">
            {formatNumber(dist, 0)} m
          </text>
        </g>
        {marker(sa, "A")}
        {marker(sb, "B")}
        <g transform={`translate(${16} ${height - 22})`}>
          <rect x={-6} y={-16} width={barPx + 64} height={28} rx={6} fill="#050912c0" />
          <line x1={0} x2={barPx} y1={0} y2={0} stroke="#e8eef8" strokeWidth={3} />
          <line x1={0} x2={0} y1={-5} y2={5} stroke="#e8eef8" strokeWidth={2} />
          <line x1={barPx} x2={barPx} y1={-5} y2={5} stroke="#e8eef8" strokeWidth={2} />
          <text x={barPx + 8} y={4} className="text-[12px]" fill="#e8eef8">
            {barM} m
          </text>
        </g>
      </svg>
    </div>
  );
}
