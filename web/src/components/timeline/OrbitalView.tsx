"use client";

import { useMemo } from "react";
import earthImg from "@/assets/celestial/earth-bluemarble-as17.webp";
import moonImg from "@/assets/celestial/moon-lroc-southpole.webp";
import sunImg from "@/assets/celestial/sun-sdo-aia171.webp";
import { STATE_NAMES, type SiteId } from "@/lib/contract/constants";
import type { EphemerisSiteChunk, Site } from "@/lib/contract/schema";
import { formatDeg, formatNumber, formatUtc } from "@/lib/format";
import { angleBetween, bodyTrack, directionFromAzEl } from "@/lib/geospatial/sky";
import { L } from "@/lib/i18n";
import { SITE_META, STATE_META } from "@/lib/labels";
import { earthVisible, sunVisible } from "@/lib/science/states";

const W = 640;
const H = 400;
const CX = 270;
const CY = 200;
const R_MOON = 92;
const R_EARTH = 142;
const R_SUN = 178;
/** Exageración radial de la declinación en el dibujo (px por grado). Solo visual. */
const LAT_PX = 4;
const SUN_HEX = "#f5c518";
const EARTH_HEX = "#5b8cff";
const OFF_HEX = "#2a3242";

/** Pantalla: igual que el mapa polar sur de Explore (longitud 0° arriba, 90° E a la derecha). */
const pos = (lonDeg: number, r: number) => {
  const a = (lonDeg * Math.PI) / 180;
  return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
};

const fmtKm = (km: number) => (km > 1e7 ? `${formatNumber(km / 1e6, 1)} ${L("M km", "M km")}` : `${formatNumber(Math.round(km), 0)} km`);

/**
 * Esquema geométrico NO A ESCALA en el marco lunar fijo, visto desde debajo del
 * polo sur con la orientación del mapa. Las POSICIONES (direcciones) salen de las
 * efemérides del paquete (SPICE DE421) convertidas al marco lunar, y el COLOR de
 * las trazas es el estado del motor para la superficie elegida. Las imágenes NASA
 * solo dan apariencia a los cuerpos: no muestran la fase, las nubes ni la actividad
 * solar del instante simulado.
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

  // Trazas de toda la ventana, atenuadas: el instante y las direcciones elegidas son lo que destaca.
  const trail = (t: { lonEastDeg: number[]; latDeg: number[] }, r: number, on: (c: number) => boolean, hex: string) => {
    const dots = [];
    for (let k = 0; k < n; k += 12) {
      const c = codes && k < codes.length ? codes[k] : null;
      const p = pos(t.lonEastDeg[k], r - t.latDeg[k] * LAT_PX);
      const lit = c !== null && c !== 4 && on(c);
      dots.push(<circle key={k} cx={p.x} cy={p.y} r={lit ? 1.3 : 1} fill={lit ? hex : OFF_HEX} opacity={lit ? 0.3 : 0.75} />);
    }
    return dots;
  };
  const sunDots = useMemo(() => trail(tracks.sun, R_SUN, sunVisible, SUN_HEX),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, codes]);
  const earthDots = useMemo(() => trail(tracks.earth, R_EARTH, earthVisible, EARTH_HEX),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, codes]);

  const sLon = tracks.sun.lonEastDeg[i];
  const sLat = tracks.sun.latDeg[i];
  const eLon = tracks.earth.lonEastDeg[i];
  const eLat = tracks.earth.latDeg[i];
  const pSun = pos(sLon, R_SUN - sLat * LAT_PX);
  const pEarth = pos(eLon, R_EARTH - eLat * LAT_PX);
  // Hemisferio NOCTURNO de la esfera lunar visto desde el polo sur: semicírculo opuesto al Sol.
  const n0 = pos(sLon + 90, R_MOON);
  const n1 = pos(sLon - 90, R_MOON);
  const sep = angleBetween(directionFromAzEl(ll, sun.azimuth_deg[i], sun.elevation_deg[i]), directionFromAzEl(ll, earth.azimuth_deg[i], earth.elevation_deg[i]));
  const state = code === null ? null : STATE_NAMES[code];
  const siteId = site.id as SiteId;
  const sunOn = code !== null && code !== 4 && sunVisible(code);
  const earthOn = code !== null && code !== 4 && earthVisible(code);
  // Etiquetas hacia fuera del cuerpo para no pisar la Luna.
  const outward = (p: { x: number; y: number }, d: number) => {
    const dx = p.x - CX;
    const dy = p.y - CY;
    const k = Math.hypot(dx, dy) || 1;
    return { x: Math.min(W - 12, Math.max(12, p.x + (dx / k) * d)), y: Math.min(H - 10, Math.max(16, p.y + (dy / k) * d + 4)) };
  };
  const lSun = outward(pSun, 34);
  // Etiqueta de la Tierra al costado opuesto al Sol, para no pisar ni su imagen ni la del Sol.
  const earthLeft = pSun.x >= pEarth.x;
  const lEarth = { x: Math.min(W - 12, Math.max(12, pEarth.x + (earthLeft ? -18 : 18))), y: Math.min(H - 10, Math.max(16, pEarth.y + 4)) };
  const anchor = (p: { x: number }) => (p.x < CX - 20 ? "end" : p.x > CX + 20 ? "start" : "middle");

  const [sMin, sMax] = [Math.min(...tracks.sun.latDeg), Math.max(...tracks.sun.latDeg)];
  const [eMin, eMax] = [Math.min(...tracks.earth.latDeg), Math.max(...tracks.earth.latDeg)];
  const GX = 560;
  const gy = (lat: number) => CY - lat * 12;

  return (
    <figure className="flex flex-col gap-2" data-testid="orbital-view" data-time-index={i}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{L("Esquema geométrico · tamaños y distancias no a escala", "Geometric sketch · sizes and distances not to scale")}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto max-h-[360px] w-full" role="img" aria-labelledby="orbital-title orbital-desc">
        <title id="orbital-title">{L("Esquema geométrico Sol–Tierra–Luna, no a escala", "Sun–Earth–Moon geometric sketch, not to scale")}</title>
        <desc id="orbital-desc">
          {L(
            `Instante ${formatUtc(times[i])}. Sol en longitud ${formatNumber(sLon, 1)}° y declinación ${formatNumber(sLat, 2)}°; Tierra en longitud ${formatNumber(eLon, 1)}° y declinación ${formatNumber(eLat, 2)}°, vistos desde ${SITE_META[siteId].label}.`,
            `Instant ${formatUtc(times[i])}. Sun at longitude ${formatNumber(sLon, 1)}° and declination ${formatNumber(sLat, 2)}°; Earth at longitude ${formatNumber(eLon, 1)}° and declination ${formatNumber(eLat, 2)}°, seen from ${SITE_META[siteId].label}.`,
          )}
        </desc>
        <defs>
          <radialGradient id="orb-sun-glow">
            <stop offset="0%" stopColor={SUN_HEX} stopOpacity="0.55" />
            <stop offset="100%" stopColor={SUN_HEX} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="orb-moon-limb" cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
          </radialGradient>
          <clipPath id="orb-moon-clip">
            <circle cx={CX} cy={CY} r={R_MOON} />
          </clipPath>
        </defs>


        {/* Longitudes de referencia (marco lunar) */}
        {[0, 90, 180, 270].map((lon) => {
          const p = pos(lon, R_SUN + 26);
          return (
            <text key={lon} x={p.x} y={p.y + 4} textAnchor="middle" className="fill-ink-faint text-[10px]" opacity={0.7}>
              {lon}° E
            </text>
          );
        })}

        {/* Trazas de la ventana (atenuadas) */}
        <g data-testid="orbital-sun-trail">{sunDots}</g>
        <g data-testid="orbital-earth-trail">{earthDots}</g>

        {/* Luna (LROC) con su hemisferio nocturno según la dirección del Sol en el instante */}
        <image href={moonImg.src} x={CX - R_MOON} y={CY - R_MOON} width={R_MOON * 2} height={R_MOON * 2} preserveAspectRatio="xMidYMid meet" />
        <path d={`M${n0.x},${n0.y} A${R_MOON},${R_MOON} 0 0 1 ${n1.x},${n1.y} Z`} fill="#02040a" opacity={0.62} clipPath="url(#orb-moon-clip)" />
        <circle cx={CX} cy={CY} r={R_MOON} fill="url(#orb-moon-limb)" />

        {/* Direcciones del instante desde el sitio */}
        <line x1={CX} y1={CY} x2={pSun.x} y2={pSun.y} stroke={SUN_HEX} strokeOpacity={sunOn ? 0.9 : 0.45} strokeWidth={sunOn ? 2 : 1.2} strokeDasharray={sunOn ? undefined : "4 4"} />
        <line x1={CX} y1={CY} x2={pEarth.x} y2={pEarth.y} stroke={EARTH_HEX} strokeOpacity={earthOn ? 0.9 : 0.45} strokeWidth={earthOn ? 2 : 1.2} strokeDasharray={earthOn ? undefined : "4 4"} />
        <circle cx={CX} cy={CY} r={5} fill={SITE_META[siteId].colorVar} stroke="#050912" strokeWidth={2} />
        <text x={CX + 9} y={CY + 16} className="fill-ink text-[11px] font-semibold">
          {siteId} · {L("polo sur", "south pole")}
        </text>

        {/* Cuerpos (apariencia: imágenes NASA) */}
        <circle cx={pSun.x} cy={pSun.y} r={30} fill="url(#orb-sun-glow)" />
        <image href={sunImg.src} x={pSun.x - 19} y={pSun.y - 19} width={38} height={38} opacity={sunOn ? 1 : 0.6} />
        <image href={earthImg.src} x={pEarth.x - 13} y={pEarth.y - 13} width={26} height={26} opacity={earthOn ? 1 : 0.6} />
        <text x={lSun.x} y={lSun.y} textAnchor={anchor(lSun)} className="fill-ink text-[12px] font-semibold">
          {L("Sol", "Sun")} <tspan className="fill-ink-faint font-normal">{fmtKm(sun.range_km[i])}</tspan>
        </text>
        <text x={lEarth.x} y={lEarth.y} textAnchor={earthLeft ? "end" : "start"} className="fill-ink text-[12px] font-semibold">
          {L("Tierra", "Earth")} <tspan className="fill-ink-faint font-normal">{fmtKm(earth.range_km[i])}</tspan>
        </text>

        {/* Declinación respecto al ecuador lunar */}
        <g>
          <text x={GX + 22} y={CY - 112} textAnchor="middle" className="fill-ink-faint text-[10px]">
            {L("Declinación lunar", "Lunar declination")}
          </text>
          {[-8, 0, 8].map((d) => (
            <g key={d}>
              <line x1={GX} x2={GX + 46} y1={gy(d)} y2={gy(d)} stroke={d === 0 ? "#ffffff40" : "#ffffff14"} />
              <text x={GX - 6} y={gy(d) + 3} textAnchor="end" className="fill-ink-faint text-[10px]">
                {d > 0 ? `+${d}°` : `${d}°`}
              </text>
            </g>
          ))}
          <rect x={GX + 6} y={gy(sMax)} width={9} height={Math.max(1, gy(sMin) - gy(sMax))} rx={3} fill={SUN_HEX} opacity={0.22} />
          <rect x={GX + 30} y={gy(eMax)} width={9} height={Math.max(1, gy(eMin) - gy(eMax))} rx={3} fill={EARTH_HEX} opacity={0.25} />
          <circle cx={GX + 10.5} cy={gy(sLat)} r={4.5} fill={SUN_HEX} stroke="#050912" />
          <circle cx={GX + 34.5} cy={gy(eLat)} r={4.5} fill={EARTH_HEX} stroke="#050912" />
          <text x={GX + 10.5} y={gy(-8) + 16} textAnchor="middle" className="fill-ink-faint text-[10px]">
            {L("Sol", "Sun")}
          </text>
          <text x={GX + 34.5} y={gy(-8) + 16} textAnchor="middle" className="fill-ink-faint text-[10px]">
            {L("Tierra", "Earth")}
          </text>
        </g>

      </svg>

      <div className="grid gap-2 text-xs sm:grid-cols-3" aria-live="polite">
        <div className="rounded-lg border border-line bg-bg-2/60 px-2.5 py-2">
          <p className="font-semibold text-ink">{formatUtc(times[i])}</p>
          <p className="text-ink-faint">{L(`Ángulo Sol–${siteId}–Tierra: ${formatNumber(sep, 1)}°`, `Sun–${siteId}–Earth angle: ${formatNumber(sep, 1)}°`)}</p>
        </div>
        <div className="rounded-lg border border-line bg-bg-2/60 px-2.5 py-2">
          <p className="font-semibold" style={{ color: SUN_HEX }}>
            {L("Sol", "Sun")} · {sunOn ? L("visible", "visible") : L("no visible", "not visible")}
          </p>
          <p className="tabular text-ink-muted">
            az {formatDeg(sun.azimuth_deg[i], 2)} · el {formatDeg(sun.elevation_deg[i], 3)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-bg-2/60 px-2.5 py-2">
          <p className="font-semibold" style={{ color: EARTH_HEX }}>
            {L("Tierra", "Earth")} · {earthOn ? L("visible", "visible") : L("no visible", "not visible")} · {fmtKm(earth.range_km[i])}
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
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: SUN_HEX }} />{L("traza: Sol visible (motor)", "trace: Sun visible (engine)")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: EARTH_HEX }} />{L("Tierra visible (motor)", "Earth visible (engine)")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: OFF_HEX }} />{L("oculto o desconocido", "hidden or unknown")}</span>
        <span className="basis-full text-[10px] leading-snug text-ink-faint/80" data-testid="orbital-credits">
          {L(
            "Apariencia de los cuerpos, no su estado en el instante: Luna, NASA SVS · LROC WAC (ASU); Tierra, NASA JSC · Apollo 17, AS17-148-22727 (1972); Sol, NASA/GSFC/SDO · AIA 171 Å, ultravioleta extremo en falso color (2025).",
            "Appearance of the bodies, not their state at the instant: Moon, NASA SVS · LROC WAC (ASU); Earth, NASA JSC · Apollo 17, AS17-148-22727 (1972); Sun, NASA/GSFC/SDO · AIA 171 Å, extreme ultraviolet false colour (2025).",
          )}
        </span>
      </figcaption>
    </figure>
  );
}
