"use client";

import { useMemo } from "react";
import { STATE_NAMES, type SiteId } from "@/lib/contract/constants";
import type { EphemerisSiteChunk, Site } from "@/lib/contract/schema";
import { formatDeg, formatNumber, formatUtc } from "@/lib/format";
import { angleBetween, bodyTrack, directionFromAzEl } from "@/lib/geospatial/sky";
import { L } from "@/lib/i18n";
import { SITE_META, STATE_META } from "@/lib/labels";
import { earthVisible, sunVisible } from "@/lib/science/states";

const W = 600;
const H = 470;
const CX = 250;
const CY = 235;
const R_MOON = 86;
const R_EARTH = 146;
const R_SUN = 205;
/** Exageración radial de la declinación en el dibujo (px por grado). Solo visual. */
const LAT_PX = 5;
const SUN_HEX = "#f5c518";
const EARTH_HEX = "#4f7cff";
const OFF_HEX = "#3a4459";

/** Pantalla: igual que el mapa polar sur de Explore (longitud 0° arriba, 90° E a la derecha). */
const pos = (lonDeg: number, r: number) => {
  const a = (lonDeg * Math.PI) / 180;
  return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
};

const fmtKm = (km: number) =>
  km > 1e7 ? `${formatNumber(km / 1e6, 1)} ${L("millones de km", "million km")}` : `${formatNumber(Math.round(km), 0)} km`;

/**
 * Esquema orbital NO A ESCALA en el marco lunar fijo, visto desde debajo del
 * polo sur con la misma orientación que el mapa. Las direcciones de Sol y Tierra
 * son las del paquete (topocéntricas, SPICE DE421) convertidas al marco lunar;
 * las distancias del dibujo son simbólicas y las reales se rotulan. El color de
 * las trayectorias es el estado CALCULADO POR EL MOTOR para la superficie
 * seleccionada; aquí no se decide ninguna visibilidad.
 */
export function OrbitalView({
  site,
  eph,
  codes,
  times,
  index,
  surfaceLabel,
}: {
  site: Site;
  eph: EphemerisSiteChunk;
  codes: number[] | null;
  times: string[];
  index: number;
  surfaceLabel: string;
}) {
  const ll = { lonEastDeg: site.longitude_east_deg, latDeg: site.latitude_deg };
  const sun = eph.series.bodies.SUN;
  const earth = eph.series.bodies.EARTH;
  const tracks = useMemo(
    () => ({ sun: bodyTrack(ll, sun.azimuth_deg, sun.elevation_deg), earth: bodyTrack(ll, earth.azimuth_deg, earth.elevation_deg) }),
    // ll deriva de `site`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [site, sun, earth],
  );
  const n = sun.azimuth_deg.length;
  const i = Math.min(Math.max(0, index), n - 1);
  const code = codes && i < codes.length ? codes[i] : null;

  const trail = (t: { lonEastDeg: number[]; latDeg: number[] }, r: number, on: (c: number) => boolean, hex: string, step: number) => {
    const dots = [];
    for (let k = 0; k < n; k += step) {
      const c = codes && k < codes.length ? codes[k] : null;
      // Declinación sur (negativa) hacia fuera: en el polo sur eleva el cuerpo sobre el horizonte.
      const p = pos(t.lonEastDeg[k], r - t.latDeg[k] * LAT_PX);
      const color = c === null || c === 4 ? OFF_HEX : on(c) ? hex : OFF_HEX;
      dots.push(<circle key={k} cx={p.x} cy={p.y} r={c !== null && c !== 4 && on(c) ? 1.7 : 1.1} fill={color} opacity={c === 4 ? 0.4 : 0.9} />);
    }
    return dots;
  };
  const sunDots = useMemo(() => trail(tracks.sun, R_SUN, sunVisible, SUN_HEX, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, codes]);
  const earthDots = useMemo(() => trail(tracks.earth, R_EARTH, earthVisible, EARTH_HEX, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, codes]);

  const sLon = tracks.sun.lonEastDeg[i];
  const sLat = tracks.sun.latDeg[i];
  const eLon = tracks.earth.lonEastDeg[i];
  const eLat = tracks.earth.latDeg[i];
  const pSun = pos(sLon, R_SUN - sLat * LAT_PX);
  const pEarth = pos(eLon, R_EARTH - eLat * LAT_PX);
  // Hemisferio iluminado de la esfera lunar (vista desde el polo sur): semicírculo orientado al Sol.
  const a0 = pos(sLon - 90, R_MOON);
  const a1 = pos(sLon + 90, R_MOON);
  const sep = angleBetween(directionFromAzEl(ll, sun.azimuth_deg[i], sun.elevation_deg[i]), directionFromAzEl(ll, earth.azimuth_deg[i], earth.elevation_deg[i]));

  const latRange = (v: number[]) => [Math.min(...v), Math.max(...v)];
  const [sMin, sMax] = latRange(tracks.sun.latDeg);
  const [eMin, eMax] = latRange(tracks.earth.latDeg);
  const GX = 520;
  const gy = (lat: number) => CY - lat * 14; // norte arriba, sur abajo
  const state = code === null ? null : STATE_NAMES[code];
  const siteId = site.id as SiteId;

  return (
    <figure className="flex flex-col gap-3" data-testid="orbital-view" data-time-index={i}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="orbital-title orbital-desc">
        <title id="orbital-title">{L("Esquema orbital no a escala: Sol y Tierra alrededor de la Luna", "Orbital sketch not to scale: Sun and Earth around the Moon")}</title>
        <desc id="orbital-desc">
          {L(
            `Instante ${formatUtc(times[i])}. Sol en longitud ${formatNumber(sLon, 1)}° y declinación ${formatNumber(sLat, 2)}°; Tierra en longitud ${formatNumber(eLon, 1)}° y declinación ${formatNumber(eLat, 2)}°, vistos desde ${SITE_META[siteId].label}.`,
            `Instant ${formatUtc(times[i])}. Sun at longitude ${formatNumber(sLon, 1)}° and declination ${formatNumber(sLat, 2)}°; Earth at longitude ${formatNumber(eLon, 1)}° and declination ${formatNumber(eLat, 2)}°, seen from ${SITE_META[siteId].label}.`,
          )}
        </desc>
        <defs>
          <radialGradient id="orb-sun-glow">
            <stop offset="0%" stopColor={SUN_HEX} stopOpacity="0.9" />
            <stop offset="100%" stopColor={SUN_HEX} stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Anillos de referencia (simbólicos) */}
        <circle cx={CX} cy={CY} r={R_SUN} fill="none" stroke="#ffffff10" strokeDasharray="2 5" />
        <circle cx={CX} cy={CY} r={R_EARTH} fill="none" stroke="#ffffff10" strokeDasharray="2 5" />
        {[0, 90, 180, 270].map((lon) => {
          const p = pos(lon, R_SUN + 20);
          const q = pos(lon, R_MOON + 4);
          const o = pos(lon, R_SUN + 8);
          return (
            <g key={lon}>
              <line x1={q.x} y1={q.y} x2={o.x} y2={o.y} stroke="#ffffff12" />
              <text x={p.x} y={p.y + 4} textAnchor="middle" className="fill-ink-faint text-[11px]">
                {lon}° E
              </text>
            </g>
          );
        })}
        {/* Trayectorias de la ventana */}
        <g data-testid="orbital-sun-trail">{sunDots}</g>
        <g data-testid="orbital-earth-trail">{earthDots}</g>
        {/* Luna: hemisferio de noche y de día (iluminación global de la esfera, no la del sitio) */}
        <circle cx={CX} cy={CY} r={R_MOON} fill="#151b26" stroke="#ffffff22" />
        <path d={`M${a0.x},${a0.y} A${R_MOON},${R_MOON} 0 0 1 ${a1.x},${a1.y} Z`} transform="" fill="#c9c3b0" opacity="0.32" />
        <path d={`M${a0.x},${a0.y} A${R_MOON},${R_MOON} 0 0 1 ${a1.x},${a1.y}`} fill="none" stroke="#e9e1c6" strokeOpacity="0.35" />
        <text x={CX} y={CY + R_MOON - 14} textAnchor="middle" className="fill-ink-faint text-[10px]">{L("Luna · polo sur al centro", "Moon · south pole at centre")}</text>
        {/* Líneas de visión desde el sitio */}
        <line x1={CX} y1={CY} x2={pSun.x} y2={pSun.y} stroke={SUN_HEX} strokeOpacity="0.55" strokeDasharray="4 4" />
        <line x1={CX} y1={CY} x2={pEarth.x} y2={pEarth.y} stroke={EARTH_HEX} strokeOpacity="0.7" strokeDasharray="4 4" />
        <circle cx={CX} cy={CY} r={5} fill={SITE_META[siteId].colorVar} stroke="#050912" strokeWidth={2} />
        <text x={CX + 9} y={CY - 7} className="fill-ink text-[11px] font-semibold">{siteId}</text>
        {/* Cuerpos en el instante */}
        <circle cx={pSun.x} cy={pSun.y} r={22} fill="url(#orb-sun-glow)" />
        <circle cx={pSun.x} cy={pSun.y} r={9} fill={SUN_HEX} stroke="#050912" strokeWidth={1.5} />
        <circle cx={pEarth.x} cy={pEarth.y} r={7} fill={EARTH_HEX} stroke="#050912" strokeWidth={1.5} />
        <text x={pSun.x} y={pSun.y - 15} textAnchor="middle" className="fill-ink text-[11px] font-semibold">{L("Sol", "Sun")}</text>
        <text x={pEarth.x} y={pEarth.y - 12} textAnchor="middle" className="fill-ink text-[11px] font-semibold">{L("Tierra", "Earth")}</text>

        {/* Declinación respecto al ecuador lunar */}
        <g>
          <text x={GX + 25} y={26} textAnchor="middle" className="fill-ink-faint text-[10px]">{L("Declinación", "Declination")}</text>
          <text x={GX + 25} y={38} textAnchor="middle" className="fill-ink-faint text-[10px]">{L("lunar (°)", "lunar (°)")}</text>
          {[-8, -4, 0, 4, 8].map((d) => (
            <g key={d}>
              <line x1={GX - 4} x2={GX + 54} y1={gy(d)} y2={gy(d)} stroke={d === 0 ? "#ffffff40" : "#ffffff10"} />
              <text x={GX - 8} y={gy(d) + 3} textAnchor="end" className="fill-ink-faint text-[10px]">{d > 0 ? `+${d}` : d}</text>
            </g>
          ))}
          <rect x={GX + 6} y={gy(sMax)} width={10} height={Math.max(1, gy(sMin) - gy(sMax))} rx={3} fill={SUN_HEX} opacity={0.25} />
          <rect x={GX + 34} y={gy(eMax)} width={10} height={Math.max(1, gy(eMin) - gy(eMax))} rx={3} fill={EARTH_HEX} opacity={0.3} />
          <circle cx={GX + 11} cy={gy(sLat)} r={5} fill={SUN_HEX} stroke="#050912" />
          <circle cx={GX + 39} cy={gy(eLat)} r={5} fill={EARTH_HEX} stroke="#050912" />
          <text x={GX + 11} y={gy(-8) + 18} textAnchor="middle" className="fill-ink-faint text-[10px]">{L("Sol", "Sun")}</text>
          <text x={GX + 39} y={gy(-8) + 18} textAnchor="middle" className="fill-ink-faint text-[10px]">{L("Tierra", "Earth")}</text>
        </g>
        <text x={14} y={H - 12} className="fill-ink-faint text-[10px]">
          {L("NO A ESCALA · direcciones reales (marco MOON_ME_DE421) · radio desplazado ×5 px/° según la declinación", "NOT TO SCALE · real directions (MOON_ME_DE421 frame) · radius shifted ×5 px/° by declination")}
        </text>
      </svg>

      <div className="grid gap-2 text-xs sm:grid-cols-3" aria-live="polite">
        <div className="rounded-lg border border-line bg-bg-2/60 p-2.5">
          <p className="font-semibold text-ink">{formatUtc(times[i])}</p>
          <p className="text-ink-faint">{L(`Ángulo Sol–${siteId}–Tierra: ${formatNumber(sep, 1)}°`, `Sun–${siteId}–Earth angle: ${formatNumber(sep, 1)}°`)}</p>
        </div>
        <div className="rounded-lg border border-line bg-bg-2/60 p-2.5">
          <p className="font-semibold" style={{ color: SUN_HEX }}>
            {L("Sol", "Sun")} · {fmtKm(sun.range_km[i])}
          </p>
          <p className="tabular text-ink-muted">
            az {formatDeg(sun.azimuth_deg[i], 2)} · el {formatDeg(sun.elevation_deg[i], 3)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-bg-2/60 p-2.5">
          <p className="font-semibold" style={{ color: EARTH_HEX }}>
            {L("Tierra", "Earth")} · {fmtKm(earth.range_km[i])}
          </p>
          <p className="tabular text-ink-muted">
            az {formatDeg(earth.azimuth_deg[i], 2)} · el {formatDeg(earth.elevation_deg[i], 3)}
          </p>
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-faint" data-testid="orbital-state">
        <span>
          {L("Estado del motor en este intervalo", "Engine state in this interval")} ({surfaceLabel}):{" "}
          <strong className="text-ink">{state ? STATE_META[state].label : L("sin intervalo (último instante)", "no interval (last instant)")}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: SUN_HEX }} />{L("Sol visible (motor)", "Sun visible (engine)")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: EARTH_HEX }} />{L("Tierra visible (motor)", "Earth visible (engine)")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: OFF_HEX }} />{L("oculto o desconocido", "hidden or unknown")}</span>
      </figcaption>
    </figure>
  );
}
