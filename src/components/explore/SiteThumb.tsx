"use client";

import type { SiteId } from "@/lib/contract/constants";
import type { Site } from "@/lib/contract/schema";
import { BASE_PATH } from "@/lib/data/loader";
import { dataUrl } from "@/lib/data/manifest";
import { CONTEXT_FIGURE, FIGURE_PX_PER_M, figureXY } from "@/lib/figure";
import { formatNumber } from "@/lib/format";
import { SITE_META } from "@/lib/labels";

/**
 * Recorte de la figura DEM ORIGINAL centrado en el sitio (no es una foto).
 * `scale` = píxeles de pantalla por unidad de la figura.
 */
export function SiteThumb({ site, size = 136, scale = 1.1 }: { site: Site; size?: number; scale?: number }) {
  const id = site.id as SiteId;
  const p = figureXY(site.x_m, site.y_m);
  const { width, height } = CONTEXT_FIGURE.viewBox;
  const spanM = size / scale / FIGURE_PX_PER_M;
  const color = SITE_META[id].colorVar;
  return (
    <figure className="flex flex-col items-center gap-1.5">
      <div
        className="relative overflow-hidden rounded-xl border border-line-strong bg-white shadow-[0_0_0_1px_#ffffff08_inset]"
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- figura original del motor */}
        <img
          src={dataUrl(BASE_PATH, CONTEXT_FIGURE.path)}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ width: width * scale, height: height * scale, left: size / 2 - p.x * scale, top: size / 2 - p.y * scale }}
        />
        <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={15} fill="none" stroke="#050912" strokeOpacity={0.6} strokeWidth={5} />
          <circle cx={size / 2} cy={size / 2} r={15} fill="none" stroke={color} strokeWidth={2.5} />
          <path d={`M${size / 2} ${size / 2 - 26}v8M${size / 2} ${size / 2 + 18}v8M${size / 2 - 26} ${size / 2}h8M${size / 2 + 18} ${size / 2}h8`} stroke={color} strokeWidth={2} />
        </svg>
      </div>
      <figcaption className="text-center text-[10px] leading-tight text-ink-faint">
        Recorte DEM PGDA78 · ≈ {formatNumber(spanM, 0)} m de lado
      </figcaption>
    </figure>
  );
}
