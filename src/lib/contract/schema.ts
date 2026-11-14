/**
 * Contrato TypeScript + esquemas de validación de site-regret/0.1.
 *
 * Los nombres de campo son EXACTAMENTE los del paquete científico
 * (`DERIVADOS_SITE_REGRET/CONTRATO_DATOS.md`). No se renombra nada: si la UI
 * necesita otro nombre, se crea un selector/adaptador explícito.
 *
 * Los esquemas solo validan; la app conserva el objeto original parseado
 * (no la salida transformada de zod) para no alterar ningún valor.
 * Se usan objetos "loose" para que campos adicionales del motor se
 * conserven y no se descarten en silencio.
 */
import { z } from "zod";
import { CRITERIA, HEIGHTS_M, SITE_IDS, STATE_NAMES, VARIANTS, WINDOW_IDS, WINNERS } from "./constants";

const utc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, "instante UTC terminado en Z");
const finite = z.number().refine(Number.isFinite, "número finito");

export const siteIdSchema = z.enum(SITE_IDS);
export const windowIdSchema = z.enum(WINDOW_IDS);
export const heightSchema = z.union(HEIGHTS_M.map((h) => z.literal(h)) as [z.ZodLiteral<0>, z.ZodLiteral<2>, z.ZodLiteral<10>]);
export const variantSchema = z.enum(VARIANTS);
export const criterionSchema = z.enum(CRITERIA);
export const winnerSchema = z.enum(WINNERS);
export const stateNameSchema = z.enum(STATE_NAMES);

export const windowSchema = z.looseObject({ id: windowIdSchema, start: utc, stop: utc });

export const configurationSchema = z.looseObject({
  version: z.string(),
  frame: z.literal("MOON_ME_DE421"),
  reference_radius_m: finite,
  heights_m: z.array(heightSchema),
  windows: z.array(windowSchema),
  time_step_minutes: finite,
  azimuth_step_deg: finite,
  max_ray_distance_m: finite,
  body_visibility: z.string(),
  aberration: z.string(),
  azimuth: z.string(),
  hypothesis_X_m: finite,
  gaussian_filter_sigma_m: finite,
  seed: z.number().int(),
  observer_on_published_clone: z.string(),
  observer_on_synthetic_variant: z.string(),
  primary_criterion: criterionSchema,
  tie_tolerance_hours: finite,
  far_terrain_upper_bound_m: finite,
  far_bound_note: z.string(),
});

export const siteSchema = z.looseObject({
  id: siteIdSchema,
  name: z.string(),
  roi: z.number().int(),
  x_m: finite,
  y_m: finite,
  longitude_east_deg: finite,
  longitude_signed_deg: finite,
  latitude_deg: finite,
  nominal_height_m: finite,
  point_in_roi: z.boolean(),
  reference_frame: z.string(),
  height_datum: z.string(),
  values: z.looseObject({ ldec: finite, toterr: finite, slp: finite, slperr: finite }),
  coordinate_source: z.string(),
});

export const metricsSchema = z.looseObject({
  duration_hours: finite,
  known_hours: finite,
  unknown_hours: finite,
  sun_hours: finite,
  dte_center_hours: finite,
  joint_hours: finite,
  longest_dark_hours: finite,
  longest_no_earth_hours: finite,
});
export const METRIC_KEYS = [
  "duration_hours",
  "known_hours",
  "unknown_hours",
  "sun_hours",
  "dte_center_hours",
  "joint_hours",
  "longest_dark_hours",
  "longest_no_earth_hours",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export const intervalSchema = z.looseObject({
  start: utc,
  stop: utc,
  state: stateNameSchema,
  duration_minutes: finite,
  left_censored: z.boolean(),
  right_censored: z.boolean(),
});

/** Escenario sin las series pesadas (lo que viaja en el núcleo). */
export const scenarioSummarySchema = z.looseObject({
  site_id: siteIdSchema,
  window_id: windowIdSchema,
  height_m: heightSchema,
  variant: variantSchema,
  status: z.string(),
  metrics: metricsSchema,
  observer_ground_height_m: finite,
});

const nullableFinite = finite.nullable();

export const caseSchema = z.looseObject({
  winner: winnerSchema,
  utility_A: nullableFinite,
  utility_B: nullableFinite,
  D_hours: nullableFinite,
  regret_A_hours: nullableFinite,
  regret_B_hours: nullableFinite,
});

export const robustnessFamilySchema = z.looseObject({
  perturbations_exclude_nominal: z.boolean(),
  generated_count: z.number().int(),
  evaluated_count: z.number().int(),
  ties: z.number().int(),
  invalid_count: z.number().int(),
  same_winner_count: z.number().int().nullable(),
  same_winner_fraction: nullableFinite,
  interpretation: z.string(),
  worst_regret_of_nominal_choice_hours: nullableFinite,
});

export const criterionResultSchema = z.looseObject({
  nominal_winner: winnerSchema,
  metric: z.string(),
  maximize_sign: z.union([z.literal(1), z.literal(-1)]),
  tie_tolerance_hours: finite,
  cases: z.record(variantSchema, caseSchema),
  robustness: z.looseObject({ own_sensitivity: robustnessFamilySchema, published_subset: robustnessFamilySchema }),
  summary_es: z.string(),
});

export const comparisonSchema = z.looseObject({
  window_id: windowIdSchema,
  height_m: heightSchema,
  criteria: z.record(criterionSchema, criterionResultSchema),
});

export const provenanceSchema = z.looseObject({
  generated_at_utc: z.string(),
  nature: z.record(z.string(), z.string()),
  kernel_validation: z.looseObject({
    frame: z.string(),
    kernels: z.array(z.looseObject({ name: z.string(), sha256: z.string() })),
  }),
  source_assets: z.array(
    z.looseObject({
      id: z.string(),
      url: z.string().nullable().optional(),
      purpose: z.string().nullable().optional(),
      sha256: z.string().nullable().optional(),
      provider: z.string().nullable().optional(),
      verification_status: z.string().nullable().optional(),
      scientific_nature: z.string().nullable().optional(),
    }),
  ),
  software: z.record(z.string(), z.string()),
  python: z.string(),
  engine_sha256: z.string(),
  listed_NASA_resource_effectively_used: z.looseObject({ name: z.string(), role: z.string(), evidence: z.string() }),
  limitations: z.array(z.string()),
  scenario_count: z.number().int(),
  comparison_count: z.number().int(),
  validation: z.looseObject({
    passed: z.number().int(),
    failed: z.number().int(),
    horizons_reference_rows: z.number().int(),
    max_horizons_az_delta_deg: finite,
    max_horizons_el_delta_deg: finite,
  }),
});

/** Núcleo servido en `core.json` (ver src/lib/data/split.ts). */
export const coreSchema = z.looseObject({
  schema_version: z.literal("site-regret/0.1"),
  configuration: configurationSchema,
  state_names: z.tuple([
    z.literal("NEITHER"),
    z.literal("SUN_ONLY"),
    z.literal("EARTH_ONLY"),
    z.literal("BOTH"),
    z.literal("UNKNOWN"),
  ]),
  sites: z.array(siteSchema),
  comparisons: z.array(comparisonSchema),
  provenance: provenanceSchema,
  scenario_summaries: z.array(scenarioSummarySchema),
  horizons_index: z.record(
    siteIdSchema,
    z.looseObject({ observer_ground_height_m: z.record(variantSchema, finite) }),
  ),
  ephemerides_index: z.record(windowIdSchema, z.looseObject({ window: windowSchema })),
});

export type Configuration = z.infer<typeof configurationSchema>;
export type Site = z.infer<typeof siteSchema>;
export type Metrics = z.infer<typeof metricsSchema>;
export type Interval = z.infer<typeof intervalSchema>;
export type ScenarioSummary = z.infer<typeof scenarioSummarySchema>;
export type CaseResult = z.infer<typeof caseSchema>;
export type RobustnessFamily = z.infer<typeof robustnessFamilySchema>;
export type CriterionResult = z.infer<typeof criterionResultSchema>;
export type Comparison = z.infer<typeof comparisonSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type Core = z.infer<typeof coreSchema>;

// ---- Trozos de carga diferida (validación manual rápida en validate.ts) ----

export interface ScenarioSeries {
  site_id: (typeof SITE_IDS)[number];
  window_id: (typeof WINDOW_IDS)[number];
  height_m: (typeof HEIGHTS_M)[number];
  variant: (typeof VARIANTS)[number];
  /** 4320 códigos 0..4; el código i describe [times_utc[i], times_utc[i+1]). */
  state_codes: number[];
  intervals: Interval[];
}
export interface ScenarioChunk {
  rows: ScenarioSeries[];
}

export interface HorizonProfile {
  elevation_deg: number[];
  distance_m: number[];
  /** 0 relieve local 5 m; 1 regional 80 m; 2 apoyo 240 m. */
  source: number[];
  unknown: boolean[];
  far_bound_deg: number;
  tail_below_sampled_horizon: boolean;
}
export interface HorizonChunk {
  site_id: string;
  height_key: string;
  azimuth_deg: number[];
  variants: Record<(typeof VARIANTS)[number], HorizonProfile>;
}

export interface BodySeries {
  azimuth_deg: number[];
  elevation_deg: number[];
  range_km: number[];
}
export interface EphemerisSiteChunk {
  window_id: string;
  site_id: string;
  height_key: string;
  series: {
    bodies: { SUN: BodySeries; EARTH: BodySeries };
    sun_horizon_deg: number[];
    earth_horizon_deg: number[];
  };
}
export interface EphemerisClockChunk {
  window_id: string;
  times_utc: string[];
  et_tdb_seconds_j2000: number[];
}
