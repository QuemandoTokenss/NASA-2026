/**
 * Validación del paquete: estructura (zod) + reglas semánticas del contrato
 * (cardinalidades, unicidad de tuplas, coherencia entre secciones).
 * Nunca corrige datos: informa errores y la UI se niega a mostrar resultados.
 */
import {
  AZIMUTH_SAMPLES,
  CLOCK_SAMPLES,
  COMPARISON_COUNT,
  CRITERIA,
  HEIGHTS_M,
  SCENARIO_COUNT,
  SCHEMA_VERSION,
  SITE_IDS,
  STATE_NAMES,
  STATE_SAMPLES,
  VARIANTS,
  WINDOW_IDS,
  type HeightM,
  type WindowId,
} from "./constants";
import {
  coreSchema,
  type Core,
  type EphemerisClockChunk,
  type EphemerisSiteChunk,
  type HorizonChunk,
  type ScenarioChunk,
} from "./schema";

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const sameList = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

const EPS = 1e-9;

export function validateCore(raw: unknown): ValidationReport & { core?: Core } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if ((raw as { schema_version?: unknown })?.schema_version !== SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`schema_version esperado "${SCHEMA_VERSION}", recibido ${JSON.stringify((raw as { schema_version?: unknown })?.schema_version)}`],
      warnings,
    };
  }

  const parsed = coreSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 12)) {
      errors.push(`${issue.path.join(".") || "(raíz)"}: ${issue.message}`);
    }
    if (parsed.error.issues.length > 12) errors.push(`… y ${parsed.error.issues.length - 12} incidencias más`);
    return { ok: false, errors, warnings };
  }
  // Se conserva el objeto ORIGINAL, no la salida de zod.
  const core = raw as Core;
  const cfg = core.configuration;

  // Dominio cerrado: la configuración real debe coincidir con lo que la UI ofrece.
  if (!sameList(cfg.windows.map((w) => w.id), WINDOW_IDS)) errors.push(`configuration.windows ≠ ${WINDOW_IDS.join("/")}`);
  if (!sameList(cfg.heights_m, HEIGHTS_M)) errors.push(`configuration.heights_m ≠ ${HEIGHTS_M.join("/")}`);
  if (cfg.time_step_minutes !== 10) errors.push("configuration.time_step_minutes ≠ 10");
  if (!sameList(core.sites.map((s) => s.id), SITE_IDS)) errors.push("sites debe contener A y B en ese orden");
  if (!sameList(core.state_names, STATE_NAMES)) errors.push("state_names no coincide con 0..4 del contrato");

  for (const w of cfg.windows) {
    const idx = core.ephemerides_index[w.id]?.window;
    if (!idx || idx.start !== w.start || idx.stop !== w.stop) errors.push(`ventana ${w.id} incoherente entre configuration y ephemerides`);
    const hours = (Date.parse(w.stop) - Date.parse(w.start)) / 3.6e6;
    if (hours !== (CLOCK_SAMPLES - 1) * (cfg.time_step_minutes / 60))
      errors.push(`ventana ${w.id}: ${hours} h no corresponde a ${CLOCK_SAMPLES} muestras`);
  }

  // Escenarios: 120 tuplas únicas = producto completo.
  const seen = new Set<string>();
  for (const s of core.scenario_summaries) {
    const key = `${s.site_id}|${s.window_id}|${s.height_m}|${s.variant}`;
    if (seen.has(key)) errors.push(`tupla de escenario duplicada: ${key}`);
    seen.add(key);
    const m = s.metrics;
    if (Math.abs(m.known_hours + m.unknown_hours - m.duration_hours) > EPS)
      errors.push(`${key}: known_hours + unknown_hours ≠ duration_hours`);
    const ground = core.horizons_index[s.site_id]?.observer_ground_height_m?.[s.variant];
    if (ground === undefined || !Object.is(ground, s.observer_ground_height_m))
      errors.push(`${key}: observer_ground_height_m incoherente con horizons`);
    if (s.status !== "READY_WITH_LIMITS") warnings.push(`${key}: estado ${s.status} (resultados restringidos)`);
  }
  if (core.scenario_summaries.length !== SCENARIO_COUNT)
    errors.push(`se esperaban ${SCENARIO_COUNT} escenarios, hay ${core.scenario_summaries.length}`);
  for (const site of SITE_IDS)
    for (const w of WINDOW_IDS)
      for (const h of HEIGHTS_M)
        for (const v of VARIANTS) if (!seen.has(`${site}|${w}|${h}|${v}`)) errors.push(`falta escenario ${site}|${w}|${h}|${v}`);

  // Comparaciones: 6 pares (ventana, altura) únicos, cuatro criterios cada uno.
  const seenCmp = new Set<string>();
  const metricKeys = new Set(Object.keys(core.scenario_summaries[0]?.metrics ?? {}));
  for (const c of core.comparisons) {
    const key = `${c.window_id}|${c.height_m}`;
    if (seenCmp.has(key)) errors.push(`comparación duplicada ${key}`);
    seenCmp.add(key);
    for (const crit of CRITERIA) {
      const r = c.criteria[crit];
      if (!metricKeys.has(r.metric)) errors.push(`${key}/${crit}: métrica ${r.metric} inexistente`);
      const expectedSign = crit.startsWith("min_") ? -1 : 1;
      if (r.maximize_sign !== expectedSign) errors.push(`${key}/${crit}: maximize_sign incoherente con el nombre del criterio`);
      if (!Object.is(r.tie_tolerance_hours, cfg.tie_tolerance_hours)) errors.push(`${key}/${crit}: tolerancia de empate distinta de la configuración`);
    }
  }
  if (core.comparisons.length !== COMPARISON_COUNT) errors.push(`se esperaban ${COMPARISON_COUNT} comparaciones, hay ${core.comparisons.length}`);
  for (const w of WINDOW_IDS) for (const h of HEIGHTS_M) if (!seenCmp.has(`${w}|${h}`)) errors.push(`falta comparación ${w}|${h}`);

  if (core.provenance.scenario_count !== core.scenario_summaries.length) errors.push("provenance.scenario_count incoherente");
  if (core.provenance.comparison_count !== core.comparisons.length) errors.push("provenance.comparison_count incoherente");
  if (core.provenance.validation.failed > 0) warnings.push(`El pasaporte registra ${core.provenance.validation.failed} comprobaciones fallidas`);

  return { ok: errors.length === 0, errors, warnings, core: errors.length === 0 ? core : undefined };
}

// ---------------------------------------------------------------------------
// Trozos pesados: comprobaciones rápidas en bucle, sin zod por elemento.

function isUtcAdd(a: string, minutes: number, b: string) {
  return Date.parse(a) + minutes * 60000 === Date.parse(b);
}

export function validateScenarioChunk(
  chunk: ScenarioChunk,
  windowId: WindowId,
  heightM: HeightM,
  window: { start: string; stop: string },
  stepMinutes: number,
): ValidationReport {
  const errors: string[] = [];
  const rows = chunk?.rows;
  if (!Array.isArray(rows)) return { ok: false, errors: ["trozo de escenarios sin filas"], warnings: [] };
  if (rows.length !== SITE_IDS.length * VARIANTS.length) errors.push(`se esperaban ${SITE_IDS.length * VARIANTS.length} filas, hay ${rows.length}`);
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.site_id}|${r.variant}`;
    if (r.window_id !== windowId || r.height_m !== heightM) errors.push(`${key}: fila de otra ventana/altura`);
    if (seen.has(key)) errors.push(`${key}: duplicada`);
    seen.add(key);
    const codes = r.state_codes;
    if (!Array.isArray(codes) || codes.length !== STATE_SAMPLES) {
      errors.push(`${key}: state_codes debe tener ${STATE_SAMPLES} valores`);
      continue;
    }
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (!Number.isInteger(c) || c < 0 || c > 4) {
        errors.push(`${key}: código de estado inválido en ${i}`);
        break;
      }
    }
    // Los intervalos deben ser la codificación por tramos de state_codes.
    let cursor = 0;
    let t = window.start;
    for (const iv of r.intervals) {
      const run = iv.duration_minutes / stepMinutes;
      if (!Number.isInteger(run) || run <= 0 || iv.start !== t || !isUtcAdd(iv.start, iv.duration_minutes, iv.stop)) {
        errors.push(`${key}: intervalo no contiguo en ${iv.start}`);
        break;
      }
      const code = STATE_NAMES.indexOf(iv.state);
      for (let i = cursor; i < cursor + run; i++) {
        if (codes[i] !== code) {
          errors.push(`${key}: intervalo ${iv.start} no coincide con state_codes`);
          break;
        }
      }
      cursor += run;
      t = iv.stop;
    }
    if (cursor !== STATE_SAMPLES || t !== window.stop) errors.push(`${key}: los intervalos no cubren la ventana completa`);
  }
  return { ok: errors.length === 0, errors, warnings: [] };
}

export function validateHorizonChunk(chunk: HorizonChunk, siteId: string, heightM: HeightM): ValidationReport {
  const errors: string[] = [];
  if (chunk?.site_id !== siteId || chunk?.height_key !== String(heightM)) errors.push("trozo de horizonte de otro sitio/altura");
  if (!Array.isArray(chunk?.azimuth_deg) || chunk.azimuth_deg.length !== AZIMUTH_SAMPLES) errors.push(`azimuth_deg debe tener ${AZIMUTH_SAMPLES} valores`);
  for (const v of VARIANTS) {
    const p = chunk?.variants?.[v];
    if (!p) {
      errors.push(`falta la superficie ${v}`);
      continue;
    }
    for (const field of ["elevation_deg", "distance_m", "source", "unknown"] as const) {
      if (!Array.isArray(p[field]) || p[field].length !== AZIMUTH_SAMPLES) errors.push(`${v}.${field} debe tener ${AZIMUTH_SAMPLES} valores`);
    }
  }
  return { ok: errors.length === 0, errors, warnings: [] };
}

export function validateEphemerisClock(chunk: EphemerisClockChunk, window: { id: string; start: string; stop: string }): ValidationReport {
  const errors: string[] = [];
  const t = chunk?.times_utc;
  if (chunk?.window_id !== window.id) errors.push("reloj de otra ventana");
  if (!Array.isArray(t) || t.length !== CLOCK_SAMPLES) errors.push(`times_utc debe tener ${CLOCK_SAMPLES} instantes`);
  else if (t[0] !== window.start || t[t.length - 1] !== window.stop) errors.push("times_utc no empieza/termina en los bordes de la ventana");
  if (!Array.isArray(chunk?.et_tdb_seconds_j2000) || chunk.et_tdb_seconds_j2000.length !== CLOCK_SAMPLES) errors.push("et_tdb_seconds_j2000 con longitud incorrecta");
  return { ok: errors.length === 0, errors, warnings: [] };
}

export function validateEphemerisSite(chunk: EphemerisSiteChunk): ValidationReport {
  const errors: string[] = [];
  const s = chunk?.series;
  const arrays = s
    ? [
        s.bodies?.SUN?.azimuth_deg,
        s.bodies?.SUN?.elevation_deg,
        s.bodies?.SUN?.range_km,
        s.bodies?.EARTH?.azimuth_deg,
        s.bodies?.EARTH?.elevation_deg,
        s.bodies?.EARTH?.range_km,
        s.sun_horizon_deg,
        s.earth_horizon_deg,
      ]
    : [];
  if (arrays.length === 0 || arrays.some((a) => !Array.isArray(a) || a.length !== CLOCK_SAMPLES))
    errors.push(`series de efemérides incompletas (se esperan ${CLOCK_SAMPLES} muestras)`);
  return { ok: errors.length === 0, errors, warnings: [] };
}
