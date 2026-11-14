/**
 * Evidencias de la ejecución documentada (validacion/*.json). Se presentan
 * tal cual: son comprobaciones de aquella ejecución, no una certificación
 * del producto ni una medida de exactitud del terreno.
 */
import type { ValidationReport } from "../contract/validate";
import { loadOriginalJson } from "../data/loader";

export interface CheckRow {
  name: string;
  passed: boolean;
  error?: number;
  limit?: number;
}

export const CHECK_CATEGORIES = [
  { id: "frames", label: "Marcos y proyección", description: "Bases ENU ortonormales y dextrógiras, ida y vuelta estereográfica, contraste con pyproj." },
  { id: "analytic", label: "Referencias analíticas", description: "Esfera sin relieve, obstáculo aislado cartesiano, invariancia por traslación, cruce de azimut 360°." },
  { id: "time", label: "Contabilidad temporal", description: "Desconocido rompe rachas; 6 intervalos no son 7 horas." },
  { id: "height", label: "Monotonía con la altura", description: "Elevar el observador no sube el horizonte (0→2→10 m) en cada sitio y superficie." },
  { id: "bounds", label: "Límites de métricas", description: "Horas y rachas dentro de la duración de la ventana en los 120 escenarios." },
  { id: "regret", label: "Regret no negativo", description: "regret ≥ 0 en 6 comparaciones × 4 criterios × 10 superficies." },
  { id: "other", label: "Otras", description: "Comprobaciones no clasificadas." },
] as const;
export type CheckCategory = (typeof CHECK_CATEGORIES)[number]["id"];

export function categorizeCheck(name: string): CheckCategory {
  if (/regret_nonnegative$/.test(name)) return "regret";
  if (/metric_bounds$/.test(name)) return "bounds";
  if (/height_monotonic_/.test(name)) return "height";
  if (/(ENU_orthonormal|ENU_handedness|stereographic_roundtrip|projection_vs_pyproj)/.test(name)) return "frames";
  if (/(unknown_breaks_dark_streak|six_intervals_not_seven)/.test(name)) return "time";
  if (/(sphere_zero_height|isolated_obstacle|translation_invariant|azimuth_wrap)/.test(name)) return "analytic";
  return "other";
}

export interface HorizonsRow {
  site: string;
  target: string;
  utc: string;
  horizons_az_deg: number;
  horizons_el_deg: number;
  spice_CN_S_az_deg: number;
  spice_CN_S_el_deg: number;
  delta_az_deg: number;
  delta_el_deg: number;
}

export interface SpatialRow {
  site: string;
  height_m: number;
  radial_refinement_max_abs_deg: number;
  angular_and_radial_refinement_max_abs_deg: number;
  rms_deg: number;
}

export interface TemporalRow {
  site: string;
  window: string;
  height_m: number;
  coarse_minutes: number;
  fine_minutes: number;
  differences_hours: Record<string, number>;
}

export interface RefinementEffect {
  primary_winner_unchanged_count: number;
  comparison_count: number;
  max_abs_metric_change_hours: number;
  interpretation: string;
}

const isArray = (label: string) => (v: unknown): ValidationReport =>
  Array.isArray(v) ? { ok: true, errors: [], warnings: [] } : { ok: false, errors: [`${label} no es un array`], warnings: [] };

const V = "DERIVADOS_SITE_REGRET/validacion/";

export const loadChecks = () => loadOriginalJson<CheckRow[]>(`${V}pruebas.json`, isArray("pruebas.json"), "Comprobaciones");
export const loadHorizonsContrast = () => loadOriginalJson<HorizonsRow[]>(`${V}contraste_horizons.json`, isArray("contraste_horizons.json"), "Contraste Horizons");
export const loadSpatialConvergence = () => loadOriginalJson<SpatialRow[]>(`${V}convergencia_espacial.json`, isArray("convergencia_espacial.json"), "Convergencia espacial");
export const loadTemporalConvergence = () => loadOriginalJson<TemporalRow[]>(`${V}convergencia_temporal.json`, isArray("convergencia_temporal.json"), "Convergencia temporal");
export const loadRefinementEffect = () =>
  loadOriginalJson<RefinementEffect>(
    `${V}efecto_refinamiento_espacial.json`,
    (v) => (typeof v?.comparison_count === "number" ? { ok: true, errors: [], warnings: [] } : { ok: false, errors: ["formato inesperado"], warnings: [] }),
    "Efecto del refinamiento",
  );

/** Referencias bibliográficas y de datos citadas por el paquete (README_DESARROLLO, FUENTES_Y_EVIDENCIAS). */
export const REFERENCES = [
  {
    id: "barker2021",
    text: "Barker, M. K. et al. (2021). Planetary and Space Science — mapas LOLA de 5 m de sitios del polo sur y sus estimaciones de error.",
    url: "https://doi.org/10.1016/j.pss.2020.105119",
    label: "DOI 10.1016/j.pss.2020.105119",
    use: "DEM de 5 m de Site01, capas de error, ROI 4 y 6 (tabla 2) y clones.",
  },
  {
    id: "barker2023",
    text: "Barker, M. K. et al. (2023). The Planetary Science Journal — mosaicos LOLA del polo sur lunar.",
    url: "https://doi.org/10.3847/PSJ/acf3e1",
    label: "DOI 10.3847/PSJ/acf3e1",
    use: "Mosaicos regionales LOLA del polo sur (80 m y 240 m) para el horizonte lejano.",
  },
  {
    id: "pgda-spole",
    text: "LOLA south pole products, NASA Planetary Geodesy Data Archive (PGDA).",
    url: "https://doi.org/10.60903/gsfcpgda-lola-spole",
    label: "DOI 10.60903/gsfcpgda-lola-spole",
    use: "Conjunto de datos citado para los mosaicos PGDA 90.",
  },
  { id: "pgda78", text: "NASA GSFC PGDA, producto 78: LOLA 5 m/píxel en sitios de alunizaje del polo sur.", url: "https://pgda.gsfc.nasa.gov/products/78", label: "pgda.gsfc.nasa.gov/products/78", use: "Fuente de Site01." },
  { id: "pgda90", text: "NASA GSFC PGDA, producto 90: mosaicos LOLA del polo sur.", url: "https://pgda.gsfc.nasa.gov/products/90", label: "pgda.gsfc.nasa.gov/products/90", use: "Relieve regional y lejano." },
  { id: "naif", text: "NASA/JPL NAIF: SPICE Toolkit y kernels genéricos (DE421, PCK lunar DE421, LSK).", url: "https://naif.jpl.nasa.gov/naif/", label: "naif.jpl.nasa.gov", use: "Direcciones de Sol y Tierra (SpiceyPy), marco MOON_ME_DE421." },
  { id: "horizons", text: "NASA/JPL Horizons System.", url: "https://ssd.jpl.nasa.gov/horizons/", label: "ssd.jpl.nasa.gov/horizons", use: "Contraste independiente de 8 direcciones (recurso de la pestaña Resources del reto)." },
] as const;
