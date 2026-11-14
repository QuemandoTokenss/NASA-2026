"use client";

import { useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { SiteId } from "@/lib/contract/constants";
import type { Site } from "@/lib/contract/schema";
import { BASE_PATH } from "@/lib/data/loader";
import { dataUrl } from "@/lib/data/manifest";
import { CONTEXT_FIGURE, FIGURE_PX_PER_M, figureToXY, figureXY } from "@/lib/figure";
import { formatNumber } from "@/lib/format";
import { SITE_META } from "@/lib/labels";
import { Icon } from "../ui/Icon";

const MIN_Z = 1;
const MAX_Z = 6;

/**
 * Figura DEM ORIGINAL del motor con zoom y desplazamiento. Imagen y
 * marcadores comparten la misma transformación, de modo que las posiciones
 * siguen siendo exactas (ver test de alineación con los círculos del motor).
 */
export function ContextMap({
  sites,
  focusSite,
  showMarkers,
  showCoords,
  onSelectSite,
}: {
  sites: Site[];
  focusSite: SiteId;
  showMarkers: boolean;
  showCoords: boolean;
  onSelectSite: (s: SiteId) => void;
}) {
  const { width, height } = CONTEXT_FIGURE.viewBox;
  const [z, setZ] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // en unidades de la figura
  const [hover, setHover] = useState<{ xM: number; yM: number } | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const clampPan = (p: { x: number; y: number }, zoom: number) => {
    const maxX = (width * (zoom - 1)) / (2 * zoom);
    const maxY = (height * (zoom - 1)) / (2 * zoom);
    return { x: Math.max(-maxX, Math.min(maxX, p.x)), y: Math.max(-maxY, Math.min(maxY, p.y)) };
  };
  const zoomTo = (next: number, center?: { x: number; y: number }) => {
    const nz = Math.max(MIN_Z, Math.min(MAX_Z, next));
    const target = center ? { x: width / 2 - center.x, y: height / 2 - center.y } : pan;
    setZ(nz);
    setPan(clampPan(target, nz));
  };
  const focusOn = (s: SiteId) => {
    const site = sites.find((x) => x.id === s);
    if (!site) return;
    zoomTo(Math.max(z, 3.5), figureXY(site.x_m, site.y_m));
  };

  /** Puntero → unidades de la figura (deshaciendo zoom y desplazamiento). */
  const toFigure = (clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * width;
    const sy = ((clientY - r.top) / r.height) * height;
    return { fx: (sx - width / 2) / z + width / 2 - pan.x, fy: (sy - height / 2) / z + height / 2 - pan.y };
  };

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey && z === 1 && e.deltaY > 0) return;
    e.preventDefault();
    const { fx, fy } = toFigure(e.clientX, e.clientY);
    zoomTo(z * (e.deltaY < 0 ? 1.25 : 0.8), z === 1 && e.deltaY < 0 ? { x: fx, y: fy } : undefined);
  }
  function onDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as Element).closest("[data-marker]")) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (showCoords) {
      const { fx, fy } = toFigure(e.clientX, e.clientY);
      const c = figureToXY(fx, fy);
      setHover(c.inside ? { xM: c.xM, yM: c.yM } : null);
    }
    if (!drag.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.x) / r.width) * (width / z);
    const dy = ((e.clientY - drag.current.y) / r.height) * (height / z);
    setPan(clampPan({ x: drag.current.px + dx, y: drag.current.py + dy }, z));
  }

  // Barra de escala: 1 km (o 250 m con mucho zoom) en unidades de pantalla.
  const scaleM = z >= 3 ? 250 : z >= 1.8 ? 500 : 1000;
  const scalePct = ((scaleM * FIGURE_PX_PER_M * z) / width) * 100;
  const tf = `translate(${width / 2}px, ${height / 2}px) scale(${z}) translate(${-width / 2 + pan.x}px, ${-height / 2 + pan.y}px)`;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={box}
        className={`relative mx-auto w-full max-w-[860px] touch-none overflow-hidden rounded-xl border border-line-strong bg-white select-none ${z > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ aspectRatio: `${width} / ${height}` }}
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => {
          drag.current = null;
          setDragging(false);
        }}
        onPointerLeave={() => {
          drag.current = null;
          setDragging(false);
          setHover(null);
        }}
      >
        <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full" role="group" aria-label="Figura DEM y marcadores de sitio">
            <g style={{ transform: tf, transition: dragging ? "none" : "transform 220ms ease-out" }}>
              <image href={dataUrl(BASE_PATH, CONTEXT_FIGURE.path)} x={0} y={0} width={width} height={height} />
              {showMarkers
                ? sites.map((s) => {
                    const id = s.id as SiteId;
                    const p = figureXY(s.x_m, s.y_m);
                    const focused = id === focusSite;
                    const color = SITE_META[id].colorVar;
                    const k = 1 / z; // tamaño constante en pantalla
                    return (
                      <g
                        key={id}
                        data-marker
                        role="button"
                        tabIndex={0}
                        aria-label={`${SITE_META[id].label}: ${s.name}`}
                        aria-pressed={focused}
                        className="cursor-pointer outline-none"
                        onClick={() => onSelectSite(id)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelectSite(id))}
                      >
                        {focused ? <circle cx={p.x} cy={p.y} r={26 * k} fill={color} opacity={0.18} className="animate-pulse" /> : null}
                        <circle cx={p.x} cy={p.y} r={(focused ? 15 : 12) * k} fill="none" stroke="#050912" strokeWidth={6 * k} opacity={0.55} />
                        <circle cx={p.x} cy={p.y} r={(focused ? 15 : 12) * k} fill="none" stroke={color} strokeWidth={(focused ? 3.5 : 2.5) * k} />
                        <g transform={`translate(${p.x} ${p.y - 40 * k}) scale(${k})`}>
                          <rect x={-15} y={-12} width={30} height={23} rx={6} fill="#050912" stroke={color} strokeWidth={1.5} />
                          <text y={5} textAnchor="middle" fontSize={14} fontWeight={700} fill={color} fontFamily="system-ui, sans-serif">
                            {id}
                          </text>
                        </g>
                      </g>
                    );
                  })
                : null}
            </g>
          </svg>

        {/* Controles de mapa (estilo mockup) */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
          {(
            [
              ["zoomIn", "Acercar", () => zoomTo(z * 1.5)],
              ["zoomOut", "Alejar", () => zoomTo(z / 1.5)],
              ["target", `Centrar en ${SITE_META[focusSite].label}`, () => focusOn(focusSite)],
              ["reset", "Vista completa", () => zoomTo(1, { x: width / 2, y: height / 2 })],
            ] as const
          ).map(([icon, label, fn]) => (
            <button
              key={icon}
              type="button"
              onClick={fn}
              aria-label={label}
              title={label}
              className="grid size-9 place-items-center rounded-lg border border-line-strong bg-[#08101ee6] text-ink shadow-lg backdrop-blur transition-colors hover:border-accent/60 hover:text-accent"
            >
              <Icon name={icon} className="size-[18px]" />
            </button>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-3">
          <div className="inline-block rounded-lg border border-line-strong bg-[#08101ee6] px-3 py-2 text-[11px] text-ink-muted backdrop-blur" style={{ minWidth: `calc(${scalePct}% + 1.5rem)` }}>
            <div className="mb-1 h-1.5 border-x-2 border-b-2 border-ink" style={{ width: "100%" }} />
            <span className="tabular">
              {scaleM >= 1000 ? `${scaleM / 1000} km` : `${scaleM} m`} · zoom ×{formatNumber(z, 1)}
            </span>
          </div>
        </div>

        {showCoords && hover ? (
          <div className="pointer-events-none absolute right-3 bottom-3 rounded-lg border border-line-strong bg-[#08101ee6] px-3 py-2 font-mono text-[11px] text-ink-muted">
            X {formatNumber(hover.xM, 0)} m · Y {formatNumber(hover.yM, 0)} m
          </div>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-ink-faint">
        Figura original <code className="font-mono">figuras/mapa_sitios.svg</code> del motor: DEM PGDA78 Site01 promediado a {CONTEXT_FIGURE.displayPixelSizeM} m/píxel; ejes X/Y
        estereográficos polares en metros (MOON_ME_DE421). Solo contexto visual: no es la entrada del cálculo de horizontes. Rueda + Ctrl o botones para ampliar;
        arrastra para desplazar. Los anillos naranja/cian se superponen a los puntos rojos dibujados por el motor.
      </p>
    </div>
  );
}
