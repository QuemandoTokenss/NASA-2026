import type { IconName } from "@/components/ui/Icon";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: IconName;
  summary: string;
}

/** Orden de navegación acordado (misión de desarrollo, §6). */
export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Dashboard", icon: "grid", summary: "Centro de control: el problema, los dos sitios y el caso demostrativo." },
  { href: "/explore/", label: "Explore", short: "Explore", icon: "map", summary: "Los dos sitios calculados en Connecting Ridge, su contexto DEM y su horizonte." },
  { href: "/timeline/", label: "Timeline", short: "Timeline", icon: "timeline", summary: "Estados de visibilidad Sol/Tierra cada 10 minutos y curvas nominales." },
  { href: "/comparador/", label: "Comparador A vs B", short: "Comparador", icon: "compare", summary: "A frente a B con un criterio fijado antes de ver el ganador." },
  { href: "/engineer/", label: "Engineer", short: "Engineer", icon: "engineer", summary: "Efecto del mástil de 0, 2 y 10 m sobre horizonte y métricas." },
  { href: "/regret-lab/", label: "Regret Lab", short: "Regret Lab", icon: "flask", summary: "¿Se mantiene la elección con otras superficies del terreno?" },
  { href: "/evidencia/", label: "Evidencia científica", short: "Evidencia", icon: "file", summary: "Fuentes, método, validaciones, límites y descargas reproducibles." },
];

export function normalizePath(p: string) {
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}
