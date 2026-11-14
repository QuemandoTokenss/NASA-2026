/**
 * Textos y semántica visual. Los colores de datos se definen como tokens
 * CSS en globals.css; aquí solo se referencian por nombre.
 *
 * Asignación fija (no cambiar por pantalla):
 *   A = naranja · B = cian · incertidumbre/variantes = violeta.
 *   Sol = amarillo · Tierra = azul · Sol+Tierra = verde · Ninguno = pizarra
 *   · Desconocido = trama gris (nunca solo color).
 * Los mockups usaban naranja/cian para Sol/Tierra: se reasignan para no
 * confundirlos con los sitios A/B.
 */
import type { Criterion, SiteId, StateName, Variant, VariantFamily, Winner } from "./contract/constants";

export const SITE_META: Record<SiteId, { label: string; short: string; colorVar: string; textClass: string; bgClass: string; borderClass: string }> = {
  A: { label: "Sitio A", short: "A", colorVar: "var(--color-site-a)", textClass: "text-site-a", bgClass: "bg-site-a", borderClass: "border-site-a" },
  B: { label: "Sitio B", short: "B", colorVar: "var(--color-site-b)", textClass: "text-site-b", bgClass: "bg-site-b", borderClass: "border-site-b" },
};

export const VARIANT_LABEL: Record<Variant, string> = {
  nominal: "Nominal (DEM LOLA)",
  bias_plus: "Sesgo regional +X",
  bias_minus: "Sesgo regional −X",
  correlated_plus: "Campo correlacionado +",
  correlated_minus: "Campo correlacionado −",
  published_0001: "Clon publicado 0001",
  published_0002: "Clon publicado 0002",
  published_0003: "Clon publicado 0003",
  published_0004: "Clon publicado 0004",
  published_0005: "Clon publicado 0005",
};

export const FAMILY_META: Record<VariantFamily, { label: string; description: string }> = {
  nominal: { label: "Nominal", description: "Superficie DEM LOLA de referencia (PGDA78 Site01)." },
  own: {
    label: "Hipótesis propias",
    description: "Cuatro perturbaciones modeladas por el equipo (X, σ y semilla en el pasaporte). No son errores NASA medidos.",
  },
  published: {
    label: "Clones publicados",
    description: "Cinco DEM completos del ensemble publicado de Site01. No se suman al nominal; no justifican percentiles.",
  },
};

export const CRITERION_META: Record<Criterion, { label: string; short: string; description: string }> = {
  min_longest_dark_hours: {
    label: "Minimizar la racha más larga sin Sol",
    short: "Menor racha sin Sol",
    description: "Métrica longest_dark_hours (horas), recortada a la ventana. Criterio principal del motor.",
  },
  max_sun_hours: { label: "Maximizar horas con Sol", short: "Más horas con Sol", description: "Métrica sun_hours: centro geométrico del Sol sobre el relieve." },
  max_dte_hours: {
    label: "Maximizar horas con Tierra visible",
    short: "Más horas con Tierra",
    description: "Métrica dte_center_hours: centro de la Tierra sobre el relieve. No garantiza enlace de radio.",
  },
  max_joint_hours: { label: "Maximizar horas con Sol y Tierra", short: "Más horas Sol + Tierra", description: "Métrica joint_hours: intersección de ambas visibilidades." },
};

export const STATE_META: Record<StateName, { label: string; colorVar: string; description: string; pattern?: "hatch" }> = {
  NEITHER: { label: "Ninguno", colorVar: "var(--color-state-neither)", description: "Ni Sol ni Tierra sobre el relieve" },
  SUN_ONLY: { label: "Solo Sol", colorVar: "var(--color-state-sun)", description: "Centro del Sol visible; Tierra oculta" },
  EARTH_ONLY: { label: "Solo Tierra", colorVar: "var(--color-state-earth)", description: "Centro de la Tierra visible; Sol oculto" },
  BOTH: { label: "Sol y Tierra", colorVar: "var(--color-state-both)", description: "Ambos centros visibles" },
  UNKNOWN: { label: "Desconocido", colorVar: "var(--color-state-unknown)", description: "Sin datos suficientes: no equivale a sombra", pattern: "hatch" },
};

export const WINNER_LABEL: Record<Winner, string> = {
  A: "Sitio A",
  B: "Sitio B",
  TIE: "Empate (tolerancia 10 min)",
  UNKNOWN: "No determinable",
};

/** Etiquetas de naturaleza del plan maestro §0.2. */
export const NATURE_META = {
  OBSERVED: { label: "OBSERVED", description: "Dato publicado u observado, con fuente y metadatos" },
  DERIVED: { label: "DERIVED", description: "Transformación reproducible de datos verificados" },
  MODELED: { label: "MODELED", description: "Cálculo sujeto a hipótesis y parámetros" },
  SIMULATED: { label: "SIMULATED", description: "Escenario hipotético (p. ej. mástil de 2/10 m)" },
} as const;
export type Nature = keyof typeof NATURE_META;

/** Capas de calidad PGDA78 en el punto (PGDA78_README.txt). */
export const SITE_VALUE_META = {
  ldec: { label: "Retornos LOLA en el píxel (LDEC)", unit: "", digits: 0 },
  toterr: { label: "Incertidumbre vertical (RMS)", unit: " m", digits: 2 },
  slp: { label: "Pendiente publicada", unit: "°", digits: 2 },
  slperr: { label: "Incertidumbre de pendiente (RMS)", unit: "°", digits: 2 },
} as const;
