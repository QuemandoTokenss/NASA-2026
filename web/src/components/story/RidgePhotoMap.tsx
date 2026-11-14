"use client";

import { useState, type ReactNode } from "react";
import type { SiteId } from "@/lib/contract/constants";
import type { Site } from "@/lib/contract/schema";
import { L } from "@/lib/i18n";
import { SITE_META } from "@/lib/labels";
import META from "@/assets/presentar/connecting-ridge-metadata.json";
import orbitalImg from "@/assets/presentar/connecting-ridge-orbital.webp";
import reliefImg from "@/assets/presentar/connecting-ridge-relieve.webp";

const [XMIN, YMIN, XMAX, YMAX] = META.map.bounds_xy_m;
const W = META.map.width;
const H = META.map.height;

/** Posición (fracción 0…1 del ancho y del alto) de un punto X/Y del proyecto en el encuadre de la imagen. */
export function ridgeFraction(x: number, y: number): { fx: number; fy: number } {
  return { fx: (x - XMIN) / (XMAX - XMIN), fy: (YMAX - y) / (YMAX - YMIN) };
}
/** Barra de 200 m como fracción del ancho de la imagen. */
const BAR_200 = 200 / (XMAX - XMIN);

/**
 * Mapa fotográfico estático de Connecting Ridge (NASA Moon Trek · LRO/LROC NAC, recurso local) con una capa
 * de marcadores en el mismo encuadre. La relación de aspecto se fija en 1440:900, así que las fracciones
 * calculadas con los límites del metadato quedan alineadas a cualquier tamaño. Si la foto no carga, se usa
 * el relieve sombreado del DEM con el mismo encuadre, rotulado.
 */
export function RidgePhotoMap({ sites, chosen, badges }: { sites: Site[]; chosen: SiteId | null; badges?: ReactNode }) {
  const [fallback, setFallback] = useState(false);
  const pts = sites.map((s) => ({ id: s.id as SiteId, ...ridgeFraction(s.x_m, s.y_m) }));
  const [a, b] = pts;
  return (
    <figure className="flex min-w-0 flex-col gap-1.5" data-testid="ridge-map" data-source={fallback ? "relief" : "orbital"}>
      {/* Sin borde (un anillo no ocupa espacio): la caja interior mantiene exactamente 1440:900. */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-black ring-1 ring-line" style={{ aspectRatio: `${W} / ${H}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- export estático: imagen local ya optimizada */}
        <img
          src={fallback ? reliefImg.src : orbitalImg.src}
          alt={
            fallback
              ? L("Relieve sombreado de Connecting Ridge calculado a partir del DEM LOLA, con luz ilustrativa", "Shaded relief of Connecting Ridge computed from the LOLA DEM, with illustrative lighting")
              : L("Imagen orbital de Connecting Ridge (polo sur lunar), mosaico LRO NAC de NASA Moon Trek", "Orbital image of Connecting Ridge (lunar south pole), LRO NAC mosaic from NASA Moon Trek")
          }
          width={W}
          height={H}
          className="absolute inset-0 h-full w-full"
          onError={() => setFallback(true)}
          data-testid="ridge-map-image"
        />
        {/* Línea A–B en el mismo sistema de coordenadas que la imagen. */}
        <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <line x1={a.fx * W} y1={a.fy * H} x2={b.fx * W} y2={b.fy * H} stroke="#e8eef8" strokeOpacity="0.85" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
        {pts.map((p) => {
          const meta = SITE_META[p.id];
          const isChosen = chosen === p.id;
          return (
            <div
              key={p.id}
              className="pointer-events-none absolute"
              style={{ left: `${p.fx * 100}%`, top: `${p.fy * 100}%` }}
              data-testid={`ridge-marker-${p.id}`}
              data-fx={p.fx.toFixed(5)}
              data-fy={p.fy.toFixed(5)}
              data-chosen={isChosen ? "true" : "false"}
            >
              <span
                className={`absolute top-0 left-0 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 ${p.id === "A" ? "border-site-a" : "border-site-b"} ${isChosen ? "size-8 bg-black/40 shadow-[0_0_0_4px_rgba(255,255,255,0.35)]" : "size-6"}`}
              >
                <span className={`block size-2 rounded-full ${meta.bgClass}`} />
              </span>
              <span
                className={`absolute top-0 flex -translate-y-1/2 items-center gap-1.5 rounded-md bg-[#0b1220e6] px-2 py-0.5 text-sm font-bold whitespace-nowrap sm:text-base ${meta.textClass} ${p.id === "A" ? "right-5 sm:right-6" : "left-5 sm:left-6"}`}
              >
                {p.id}
                {isChosen ? <span className="rounded-sm bg-white/90 px-1 text-[10px] font-bold text-[#050912] uppercase sm:text-[11px]">{L("tu elección", "your choice")}</span> : null}
              </span>
            </div>
          );
        })}
        {badges ? <div className="absolute top-2 left-2 sm:top-3 sm:left-3">{badges}</div> : null}
        {/* Barra de escala: su ancho es un porcentaje del mapa, así que sigue siendo 200 m a cualquier tamaño. */}
        <div className="pointer-events-none absolute bottom-2 left-2 box-content rounded-lg bg-[#0b1220d9] px-2.5 py-1.5 text-[11px] text-ink sm:bottom-3 sm:left-3" style={{ width: `${BAR_200 * 100}%` }} aria-hidden data-testid="ridge-scale">
          <span className="block h-0.5 w-full bg-ink" />
          <span className="mt-1 block">200 m</span>
        </div>
        <span className="pointer-events-none absolute right-2 bottom-2 rounded-lg bg-[#0b1220d9] px-2.5 py-1 text-[11px] text-ink sm:right-3 sm:bottom-3">
          {fallback ? L("Relieve calculado · DEM LOLA PGDA78", "Computed relief · LOLA DEM PGDA78") : "NASA Moon Trek · LRO/LROC NAC"}
        </span>
      </div>
      <figcaption className="text-[11px] leading-snug text-ink-faint" data-testid="ridge-map-caption">
        {fallback
          ? L(
              "La imagen orbital no ha cargado: relieve calculado a partir del DEM LOLA PGDA78 (5 m) con luz ilustrativa, mismo encuadre. ",
              "The orbital image did not load: relief computed from the LOLA PGDA78 DEM (5 m) with illustrative lighting, same framing. ",
            )
          : L("Las sombras de la imagen orbital corresponden a su adquisición, no a la fecha de la prueba. ", "The shadows in the orbital image are those of its acquisition, not of the test date. ")}
        {L("A y B, en sus coordenadas del paquete (648 m entre ambos). Funciona sin conexión.", "A and B at their package coordinates (648 m apart). Works offline.")}
        {chosen ? <span className="sr-only">{L(`Sitio elegido: ${SITE_META[chosen].label}.`, `Chosen site: ${SITE_META[chosen].label}.`)}</span> : null}
      </figcaption>
    </figure>
  );
}
