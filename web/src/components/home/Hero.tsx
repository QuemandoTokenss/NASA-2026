"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SiteId } from "@/lib/contract/constants";
import { useData } from "@/lib/data/DataProvider";
import { formatLatitude, formatLongitudeEast, formatNumber } from "@/lib/format";
import { arcDistanceM } from "@/lib/geospatial/lunar";
import { L } from "@/lib/i18n";
import { SITE_META } from "@/lib/labels";
import { useSelection } from "@/lib/state/SelectionProvider";
import heroImg from "@/assets/scene/hero-moon-svs5187.webp";
import heroSmall from "@/assets/scene/hero-moon-svs5187-1200.webp";
import { Icon } from "../ui/Icon";

// El globo (three.js) llega en su propio trozo, después del texto, el botón y la imagen local.
const MoonGlobe = dynamic(() => import("./MoonGlobe"), { ssr: false });

type GlobeState = "idle" | "loading" | "ready" | "failed";

/**
 * Portada: la pregunta, una frase y «Probar la misión» sobre la imagen NASA local, que es la
 * vista inicial y el respaldo. El globo 3D se añade cuando el paquete y WebGL están listos;
 * si no lo están, la portada funciona igual (el botón no depende de nada de esto).
 */
export function Hero() {
  const { state } = useData();
  const { dispatch } = useSelection();
  const core = state.status === "ready" ? state.core : null;
  const [globe, setGlobe] = useState<GlobeState>("idle");
  const [picked, setPicked] = useState<SiteId | null>(null);

  useEffect(() => {
    if (!core || globe !== "idle") return;
    // Tras el primer pintado: no compite con el texto ni con la imagen.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => setGlobe("loading"), { timeout: 800 });
    return () => cancel(id);
  }, [core, globe]);

  const pick = (id: SiteId) => {
    setPicked(id);
    dispatch({ type: "setFocusSite", value: id });
  };
  const sites = core?.sites ?? [];
  const pickedSite = sites.find((s) => s.id === picked);
  const separationM = sites.length === 2 ? arcDistanceM({ x: sites[0].x_m, y: sites[0].y_m }, { x: sites[1].x_m, y: sites[1].y_m }) : null;
  const showGlobe = (globe === "loading" || globe === "ready") && core;

  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-line bg-black" data-testid="home-hero" data-globe={globe}>
      {/* Luna real (NASA SVS 5187, LOLA + LROC WAC), imagen local optimizada: vista inicial y respaldo sin WebGL */}
      {/* eslint-disable-next-line @next/next/no-img-element -- export estático: imagen local ya optimizada */}
      <img
        src={heroImg.src}
        srcSet={`${heroSmall.src} 1200w, ${heroImg.src} 2400w`}
        sizes="(max-width: 768px) 100vw, 1400px"
        alt={L("La Luna en cuarto creciente, con relieve y luz cenicienta (render NASA a partir de datos de LRO)", "The Moon at first quarter, with relief and earthshine (NASA render from LRO data)")}
        className={`absolute inset-0 -z-10 h-full w-full object-cover object-[72%_50%] transition-opacity duration-700 sm:object-[62%_50%] ${globe === "ready" ? "opacity-0" : "opacity-100"}`}
        fetchPriority="high"
      />
      <div aria-hidden className={`absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/75 to-black/0 transition-opacity duration-700 sm:via-black/55 ${globe === "ready" ? "opacity-0" : ""}`} />

      <div className="grid lg:min-h-[clamp(470px,calc(100dvh-150px),640px)] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="relative z-10 order-2 flex flex-col [@media(max-height:500px)]:order-1 justify-center gap-4 px-6 pt-5 pb-8 sm:px-10 lg:order-1 lg:py-10 lg:pr-2">
          <p className="text-xs font-bold tracking-[0.22em] text-accent uppercase">{L("Polo sur lunar · NASA Space Apps 2026", "Lunar south pole · NASA Space Apps 2026")}</p>
          <h1 className="text-5xl leading-[1.02] font-bold tracking-tight text-ink sm:text-6xl xl:text-7xl">{L("¿Dónde alunizarías?", "Where would you land?")}</h1>
          <p className="max-w-md text-lg leading-snug text-ink sm:text-xl" data-testid="hero-pitch">
            {L("En el polo sur de la Luna, el relieve decide cuándo se ven el Sol y la Tierra desde cada sitio.", "At the Moon’s south pole, the terrain decides when the Sun and the Earth can be seen from each site.")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/historia/" className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3.5 text-base font-bold text-bg shadow-[0_10px_40px_-10px_#8fb4ff] transition-transform hover:-translate-y-0.5" data-testid="hero-cta">
              <Icon name="play" className="size-5" /> {L("Probar la misión", "Try the mission")}
            </Link>
          </div>
          <ul className="flex flex-wrap gap-2.5" aria-label={L("Los dos sitios reales que se comparan", "The two real sites being compared")} data-testid="hero-sites">
            {(["A", "B"] as const).map((id) => {
              const s = sites.find((x) => x.id === id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => pick(id)}
                    aria-pressed={picked === id}
                    className={`flex items-center gap-2.5 rounded-2xl border bg-black/55 py-2 pr-4 pl-3 text-left backdrop-blur-sm transition-colors hover:bg-white/10 ${SITE_META[id].borderClass} ${picked === id ? "ring-2 ring-white/80" : ""}`}
                    data-testid={`hero-site-${id}`}
                  >
                    <span aria-hidden className={`size-3.5 rounded-full ${id === "A" ? "bg-site-a" : "bg-site-b"}`} />
                    <span className="flex flex-col leading-tight">
                      <span className={`text-base font-bold ${SITE_META[id].textClass}`}>{SITE_META[id].label}</span>
                      <span className="text-xs text-ink-muted">Connecting Ridge{s ? ` · ROI ${s.roi}` : ""}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="min-h-10 max-w-md text-sm leading-snug text-ink-muted" aria-live="polite" data-testid="hero-site-info">
            {pickedSite ? (
              <>
                <strong className={SITE_META[pickedSite.id as SiteId].textClass}>{SITE_META[pickedSite.id as SiteId].label}</strong>
                {` · ${formatLatitude(pickedSite.latitude_deg)}, ${formatLongitudeEast(pickedSite.longitude_east_deg)}. `}
                {separationM !== null
                  ? L(`Está a ${formatNumber(separationM, 0)} m del otro sitio: de lejos son un solo punto.`, `It is ${formatNumber(separationM, 0)} m from the other site: from afar they are a single dot.`)
                  : null}
              </>
            ) : globe === "failed" ? (
              L("La vista 3D no está disponible en este navegador; se muestra la imagen de la NASA. La misión funciona igual.", "The 3D view is not available in this browser; the NASA image is shown. The mission works just the same.")
            ) : (
              L("Gira la Luna, acércate al polo sur y elige A o B.", "Spin the Moon, fly to the south pole and pick A or B.")
            )}
          </p>
        </div>

        {/* Pantallas bajas: la Luna cede altura (235 px a 375×667) para que el botón quede a la vista; por debajo de 500 px de alto, la pregunta y el botón van antes. */}
        <div className="relative order-1 h-[clamp(200px,calc(100dvh-432px),360px)] sm:h-[clamp(200px,calc(100dvh-432px),440px)] lg:order-2 lg:h-auto [@media(max-height:500px)]:order-2" data-testid="hero-globe-area">
          {showGlobe ? (
            <div className="absolute inset-0 lg:[mask-image:linear-gradient(to_right,transparent,black_16%)]">
              <MoonGlobe
                sites={sites.map((s) => ({ id: s.id as SiteId, x: s.x_m, y: s.y_m }))}
                selected={picked}
                onSelect={pick}
                onState={(s) => setGlobe(s)}
              />
            </div>
          ) : null}
        </div>
      </div>

      <details className="relative z-10 px-6 pb-3 text-[11px] text-white/75 sm:px-10">
        <summary className="cursor-pointer select-none hover:text-white">
          {L("Imágenes y créditos", "Images and credits")}
          {globe === "ready" ? (
            <span className="ml-2 text-white/75" data-testid="globe-illustrative">
              {L("· Composición ilustrativa: Sol, Tierra y luz fuera de escala", "· Illustrative composition: Sun, Earth and light not to scale")}
            </span>
          ) : null}
        </summary>
        <p className="mt-1 max-w-4xl leading-relaxed">
          {L(
            "Globo: mapa de color LROC WAC (NASA SVS 4720; optimizado para apariencia, no para ciencia). Detalle del polo: relieve sombreado con luz sintética a partir de los DEM de LOLA (NASA GSFC · PGDA 90 y 78). A y B están en sus coordenadas del paquete. Sol: NASA/SDO, AIA 171 Å en falso color. Tierra: NASA, Apollo 17. Estrellas y Vía Láctea: NASA SVS 4851 (Gaia DR2), sin orientar al cielo real. La Tierra está en su dirección media; el Sol, sus tamaños, distancias y la luz son ilustrativos. Imagen inicial: NASA SVS 5187 (LRO LOLA + LROC WAC), Luna entera, no Connecting Ridge.",
            "Globe: LROC WAC colour map (NASA SVS 4720; optimised for appearance, not for science). Polar detail: shaded relief with synthetic light from the LOLA DEMs (NASA GSFC · PGDA 90 and 78). A and B are at their package coordinates. Sun: NASA/SDO, AIA 171 Å false colour. Earth: NASA, Apollo 17. Stars and Milky Way: NASA SVS 4851 (Gaia DR2), not oriented to the real sky. The Earth is in its mean direction; the Sun, the sizes, distances and light are illustrative. Initial image: NASA SVS 5187 (LRO LOLA + LROC WAC), whole Moon, not Connecting Ridge.",
          )}
        </p>
      </details>
    </section>
  );
}
