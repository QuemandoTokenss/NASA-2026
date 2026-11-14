"use client";

import type { SiteId } from "@/lib/contract/constants";
import type { Site } from "@/lib/contract/schema";
import { BASE_PATH } from "@/lib/data/loader";
import { dataUrl } from "@/lib/data/manifest";
import { CONTEXT_FIGURE, figureXY } from "@/lib/figure";
import { SITE_META } from "@/lib/labels";

/**
 * Figura DEM original del motor, sin alterar, con marcadores A/B superpuestos
 * en los colores del sistema. La imagen es contexto visual: no es la entrada
 * del cálculo de horizontes (contexto_2d.json → role).
 */
export function ContextMap({
  sites,
  focusSite,
  showMarkers,
  onSelectSite,
}: {
  sites: Site[];
  focusSite: SiteId;
  showMarkers: boolean;
  onSelectSite: (s: SiteId) => void;
}) {
  const { width, height } = CONTEXT_FIGURE.viewBox;
  return (
    <figure className="flex flex-col gap-3">
      <div className="relative mx-auto w-full max-w-[720px] overflow-hidden rounded-xl border border-line-strong bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- figura original servida tal cual */}
        <img
          src={dataUrl(BASE_PATH, CONTEXT_FIGURE.path)}
          alt="Mapa de elevación DEM LOLA de Connecting Ridge (PGDA78 Site01) con los sitios A (ROI 4) y B (ROI 6). Ejes en metros, proyección estereográfica polar sur."
          width={width}
          height={height}
          className="block h-auto w-full"
        />
        {showMarkers ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full" role="group" aria-label="Marcadores de sitio">
            {sites.map((s) => {
              const id = s.id as SiteId;
              const p = figureXY(s.x_m, s.y_m);
              const focused = id === focusSite;
              const color = SITE_META[id].colorVar;
              return (
                <g
                  key={id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${SITE_META[id].label}: ${s.name}`}
                  aria-pressed={focused}
                  className="cursor-pointer outline-none"
                  onClick={() => onSelectSite(id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelectSite(id))}
                >
                  <circle cx={p.x} cy={p.y} r={focused ? 17 : 13} fill="none" stroke="#050912" strokeWidth={6} opacity={0.55} />
                  <circle cx={p.x} cy={p.y} r={focused ? 17 : 13} fill="none" stroke={color} strokeWidth={focused ? 3.5 : 2.5} />
                  <rect x={p.x - 14} y={p.y - 46} width={28} height={22} rx={6} fill="#050912" stroke={color} strokeWidth={1.5} />
                  <text x={p.x} y={p.y - 30} textAnchor="middle" fontSize={14} fontWeight={700} fill={color} fontFamily="system-ui, sans-serif">
                    {id}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>
      <figcaption className="text-xs leading-relaxed text-ink-faint">
        Figura original <code className="font-mono">figuras/mapa_sitios.svg</code> generada por el motor: DEM PGDA78 Site01 promediado a{" "}
        {CONTEXT_FIGURE.displayPixelSizeM} m/píxel, ejes X/Y estereográficos en metros (MOON_ME_DE421). Solo contexto visual: no es la
        entrada del cálculo de horizontes. Los anillos naranja/cian son una superposición de la interfaz sobre los puntos rojos del motor.
      </figcaption>
    </figure>
  );
}
