/**
 * Dominio cerrado del contrato site-regret/0.1.
 *
 * Estos valores NO son una fuente de datos: son el conjunto de opciones que
 * la entrega científica calculó. Al cargar el paquete se comprueba que la
 * `configuration` real coincide exactamente con ellos (ver validate.ts);
 * si el motor publica otras ventanas/alturas, la carga falla de forma visible
 * en lugar de mostrar combinaciones que no existen.
 */

export const SCHEMA_VERSION = "site-regret/0.1" as const;

export const SITE_IDS = ["A", "B"] as const;
export type SiteId = (typeof SITE_IDS)[number];

export const WINDOW_IDS = ["W1", "W2"] as const;
export type WindowId = (typeof WINDOW_IDS)[number];

export const HEIGHTS_M = [0, 2, 10] as const;
export type HeightM = (typeof HEIGHTS_M)[number];
/** Las claves de altura en objetos del JSON son cadenas. */
export type HeightKey = `${HeightM}`;
export const heightKey = (h: HeightM) => String(h) as HeightKey;

export const VARIANTS = [
  "nominal",
  "bias_plus",
  "bias_minus",
  "correlated_plus",
  "correlated_minus",
  "published_0001",
  "published_0002",
  "published_0003",
  "published_0004",
  "published_0005",
] as const;
export type Variant = (typeof VARIANTS)[number];

/** Familias de superficie: nunca se mezclan en fracciones ni en recuentos. */
export type VariantFamily = "nominal" | "own" | "published";
export function variantFamily(v: Variant): VariantFamily {
  if (v === "nominal") return "nominal";
  return v.startsWith("published_") ? "published" : "own";
}

export const CRITERIA = ["min_longest_dark_hours", "max_sun_hours", "max_dte_hours", "max_joint_hours"] as const;
export type Criterion = (typeof CRITERIA)[number];

export const STATE_NAMES = ["NEITHER", "SUN_ONLY", "EARTH_ONLY", "BOTH", "UNKNOWN"] as const;
export type StateName = (typeof STATE_NAMES)[number];
export type StateCode = 0 | 1 | 2 | 3 | 4;

export const WINNERS = ["A", "B", "TIE", "UNKNOWN"] as const;
export type Winner = (typeof WINNERS)[number];

export const SCENARIO_STATUSES = ["READY_WITH_LIMITS"] as const;

/** Muestras por ventana: 4321 instantes de reloj y 4320 intervalos de 10 min. */
export const CLOCK_SAMPLES = 4321;
export const STATE_SAMPLES = 4320;
export const AZIMUTH_SAMPLES = 1440;
export const SCENARIO_COUNT = SITE_IDS.length * WINDOW_IDS.length * HEIGHTS_M.length * VARIANTS.length; // 120
export const COMPARISON_COUNT = WINDOW_IDS.length * HEIGHTS_M.length; // 6

export const isWindowId = (v: unknown): v is WindowId => WINDOW_IDS.includes(v as WindowId);
export const isHeightM = (v: unknown): v is HeightM => HEIGHTS_M.includes(v as HeightM);
export const isVariant = (v: unknown): v is Variant => VARIANTS.includes(v as Variant);
export const isCriterion = (v: unknown): v is Criterion => CRITERIA.includes(v as Criterion);
export const isSiteId = (v: unknown): v is SiteId => SITE_IDS.includes(v as SiteId);
