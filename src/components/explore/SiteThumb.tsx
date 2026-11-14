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
 * Recorte de la figura DEM ORIGINAL centrado en el sitio (no es una foto).
 * `scale` = píxeles de pantalla por unidad de la figura.
 */
export function SiteThumb({ site, size = 136, scale = 1.1 }: { site: Site; size?: number; scale?: number }) {
  const id = site.id as SiteId;
  const p = figureXY(site.x_m, site.y_m);
  const { width, height } = CONTEXT_FIGURE.viewBox;
  const spanM = size / scale / FIGURE_PX_PER_M;
  const color = SITE_META[id].colorVar;
  // El rótulo «A · ROI 4» de la figura original queda a la derecha del punto:
  // se desplaza el encuadre para que no aparezca cortado.
  const cx = Math.round(size * 0.24);
  const cy = size / 2;
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
          style={{ width: width * scale, height: height * scale, left: cx - p.x * scale, top: cy - p.y * scale }}
        />
        <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden>
          <circle cx={cx} cy={cy} r={15} fill="none" stroke="#050912" strokeOpacity={0.6} strokeWidth={5} />
          <circle cx={cx} cy={cy} r={15} fill="none" stroke={color} strokeWidth={2.5} />
          <path d={`M${cx} ${cy - 26}v8M${cx} ${cy + 18}v8M${cx - 26} ${cy}h8M${cx + 18} ${cy}h8`} stroke={color} strokeWidth={2} />
        </svg>
      </div>
      <figcaption className="text-center text-[10px] leading-tight text-ink-faint">
        {L("Recorte DEM PGDA78", "PGDA78 DEM crop")} · ≈ {formatNumber(spanM, 0)} {L("m de lado", "m wide")}
      </figcaption>
    </figure>
  );
}
