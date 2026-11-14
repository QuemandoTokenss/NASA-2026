/**
 * División del paquete científico `paquete_frontend.json` (site-regret/0.1)
 * en trozos de carga diferida, y su reensamblado exacto.
 *
 * Reglas:
 * - No se calcula, redondea ni renombra ningún valor: solo se reparten
 *   subárboles del JSON original entre archivos.
 * - `assemblePackage(splitPackage(p))` debe ser profundamente igual a `p`
 *   (`deepEqualStrict`, que distingue -0 de 0). El script `prepare-data`
 *   y los tests lo comprueban contra el original verificado por SHA-256.
 * - Código puro (sin APIs de Node ni del navegador): lo usan el script
 *   de preparación, los tests y el cliente.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export const SPLIT_LAYOUT_VERSION = 1;

/** Rutas de los trozos, relativas a la carpeta de datos versionada. */
export const chunkPath = {
  core: () => "core.json",
  scenarios: (windowId: string, heightKey: string) => `scenarios/${windowId}_h${heightKey}.json`,
  horizons: (siteId: string, heightKey: string) => `horizons/${siteId}_h${heightKey}.json`,
  ephemerisClock: (windowId: string) => `ephemerides/${windowId}_clock.json`,
  ephemerisSite: (windowId: string, siteId: string, heightKey: string) =>
    `ephemerides/${windowId}_${siteId}_h${heightKey}.json`,
} as const;

const SCENARIO_HEAVY_KEYS = ["state_codes", "intervals"] as const;

function omit(obj: Record<string, Json>, keys: readonly string[]): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const k of Object.keys(obj)) if (!keys.includes(k)) out[k] = obj[k];
  return out;
}

export function scenarioKey(s: { site_id: string; window_id: string; height_m: number; variant: string }) {
  return `${s.site_id}|${s.window_id}|${s.height_m}|${s.variant}`;
}

/** Divide el paquete. Devuelve un mapa ruta → objeto JSON. */
export function splitPackage(pkg: Json): Map<string, Json> {
  const out = new Map<string, Json>();
  const rootKeys = Object.keys(pkg);
  const known = [
    "schema_version",
    "configuration",
    "state_names",
    "sites",
    "horizons",
    "ephemerides",
    "scenarios",
    "comparisons",
    "provenance",
  ];
  const unexpected = rootKeys.filter((k) => !known.includes(k));
  if (unexpected.length) throw new Error(`Claves raíz no contempladas: ${unexpected.join(", ")}`);

  // --- Núcleo: todo lo ligero + resúmenes de escenarios sin series pesadas.
  const horizonsIndex: Record<string, Json> = {};
  for (const [siteId, h] of Object.entries<Json>(pkg.horizons)) {
    horizonsIndex[siteId] = omit(h, ["azimuth_deg", "variants"]);
  }
  const ephemeridesIndex: Record<string, Json> = {};
  for (const [windowId, e] of Object.entries<Json>(pkg.ephemerides)) {
    ephemeridesIndex[windowId] = omit(e, ["times_utc", "et_tdb_seconds_j2000", "sites"]);
  }
  out.set(chunkPath.core(), {
    schema_version: pkg.schema_version,
    configuration: pkg.configuration,
    state_names: pkg.state_names,
    sites: pkg.sites,
    comparisons: pkg.comparisons,
    provenance: pkg.provenance,
    scenario_summaries: pkg.scenarios.map((s: Json) => omit(s, SCENARIO_HEAVY_KEYS)),
    horizons_index: horizonsIndex,
    ephemerides_index: ephemeridesIndex,
  });

  // --- Escenarios: estados e intervalos por ventana y altura (20 filas: A/B × 10 superficies).
  const scenarioGroups = new Map<string, Json[]>();
  for (const s of pkg.scenarios) {
    const path = chunkPath.scenarios(s.window_id, String(s.height_m));
    const rows = scenarioGroups.get(path) ?? [];
    rows.push({
      site_id: s.site_id,
      window_id: s.window_id,
      height_m: s.height_m,
      variant: s.variant,
      state_codes: s.state_codes,
      intervals: s.intervals,
    });
    scenarioGroups.set(path, rows);
  }
  for (const [path, rows] of scenarioGroups) out.set(path, { rows });

  // --- Horizontes: por sitio y altura (10 superficies).
  for (const [siteId, h] of Object.entries<Json>(pkg.horizons)) {
    const byHeight = new Map<string, Record<string, Json>>();
    for (const [variant, heights] of Object.entries<Json>(h.variants)) {
      for (const [heightKey, profile] of Object.entries<Json>(heights)) {
        const m = byHeight.get(heightKey) ?? {};
        m[variant] = profile;
        byHeight.set(heightKey, m);
      }
    }
    for (const [heightKey, variants] of byHeight) {
      out.set(chunkPath.horizons(siteId, heightKey), {
        site_id: siteId,
        height_key: heightKey,
        azimuth_deg: h.azimuth_deg,
        variants,
      });
    }
  }

  // --- Efemérides nominales: reloj por ventana + series por sitio y altura.
  for (const [windowId, e] of Object.entries<Json>(pkg.ephemerides)) {
    out.set(chunkPath.ephemerisClock(windowId), {
      window_id: windowId,
      times_utc: e.times_utc,
      et_tdb_seconds_j2000: e.et_tdb_seconds_j2000,
    });
    for (const [siteId, heights] of Object.entries<Json>(e.sites)) {
      for (const [heightKey, series] of Object.entries<Json>(heights)) {
        out.set(chunkPath.ephemerisSite(windowId, siteId, heightKey), {
          window_id: windowId,
          site_id: siteId,
          height_key: heightKey,
          series,
        });
      }
    }
  }
  return out;
}

/** Reconstruye el paquete completo a partir de los trozos. Lanza si falta alguno. */
export function assemblePackage(get: (path: string) => Json): Json {
  const core = get(chunkPath.core());
  const configuration = core.configuration;
  const heightKeys: string[] = configuration.heights_m.map((h: number) => String(h));
  const siteIds: string[] = core.sites.map((s: Json) => s.id);

  // Escenarios: orden original guardado en scenario_summaries.
  const heavy = new Map<string, Json>();
  for (const w of configuration.windows) {
    for (const hk of heightKeys) {
      for (const row of get(chunkPath.scenarios(w.id, hk)).rows) heavy.set(scenarioKey(row), row);
    }
  }
  const scenarios = core.scenario_summaries.map((summary: Json) => {
    const row = heavy.get(scenarioKey(summary));
    if (!row) throw new Error(`Falta la serie del escenario ${scenarioKey(summary)}`);
    return { ...summary, state_codes: row.state_codes, intervals: row.intervals };
  });
  if (heavy.size !== scenarios.length) throw new Error("Hay series de escenario sin resumen asociado");

  // Horizontes.
  const horizons: Record<string, Json> = {};
  for (const siteId of Object.keys(core.horizons_index)) {
    let azimuth: Json = null;
    const variants: Record<string, Record<string, Json>> = {};
    for (const hk of heightKeys) {
      const chunk = get(chunkPath.horizons(siteId, hk));
      if (azimuth === null) azimuth = chunk.azimuth_deg;
      else if (!deepEqualStrict(azimuth, chunk.azimuth_deg))
        throw new Error(`Azimuts inconsistentes entre alturas en ${siteId}`);
      for (const [variant, profile] of Object.entries<Json>(chunk.variants)) {
        (variants[variant] ??= {})[hk] = profile;
      }
    }
    horizons[siteId] = { ...core.horizons_index[siteId], azimuth_deg: azimuth, variants };
  }

  // Efemérides.
  const ephemerides: Record<string, Json> = {};
  for (const windowId of Object.keys(core.ephemerides_index)) {
    const clock = get(chunkPath.ephemerisClock(windowId));
    const sites: Record<string, Record<string, Json>> = {};
    for (const siteId of siteIds) {
      sites[siteId] = {};
      for (const hk of heightKeys) sites[siteId][hk] = get(chunkPath.ephemerisSite(windowId, siteId, hk)).series;
    }
    ephemerides[windowId] = {
      ...core.ephemerides_index[windowId],
      times_utc: clock.times_utc,
      et_tdb_seconds_j2000: clock.et_tdb_seconds_j2000,
      sites,
    };
  }

  return {
    schema_version: core.schema_version,
    configuration,
    state_names: core.state_names,
    sites: core.sites,
    horizons,
    ephemerides,
    scenarios,
    comparisons: core.comparisons,
    provenance: core.provenance,
  };
}

/**
 * Igualdad profunda estricta: mismos conjuntos de claves, mismo orden en
 * arrays y `Object.is` en primitivos (distingue -0 de 0 y trata NaN = NaN).
 * El orden de claves de los objetos no se considera significativo.
 */
export function deepEqualStrict(a: Json, b: Json, path = "$", diffs?: string[]): boolean {
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    const ok = Object.is(a, b);
    if (!ok) diffs?.push(path);
    return ok;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    diffs?.push(path);
    return false;
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length) {
      diffs?.push(`${path}.length`);
      return false;
    }
    for (let i = 0; i < a.length; i++) if (!deepEqualStrict(a[i], b[i], `${path}[${i}]`, diffs)) return false;
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length || ka.some((k) => !Object.prototype.hasOwnProperty.call(b, k))) {
    diffs?.push(`${path}{keys}`);
    return false;
  }
  for (const k of ka) if (!deepEqualStrict(a[k], b[k], `${path}.${k}`, diffs)) return false;
  return true;
}

/**
 * Serialización JSON determinista que conserva -0 (JSON.stringify(-0) da "0").
 * Los números finitos usan la representación más corta de ida y vuelta de JS,
 * por lo que `JSON.parse` devuelve exactamente el mismo double.
 */
export function canonicalStringify(v: Json): string {
  if (v === null) return "null";
  switch (typeof v) {
    case "number":
      if (!Number.isFinite(v)) throw new Error("Número no finito: el contrato exige JSON estricto");
      return Object.is(v, -0) ? "-0.0" : JSON.stringify(v);
    case "string":
    case "boolean":
      return JSON.stringify(v);
    case "object":
      if (Array.isArray(v)) return `[${v.map(canonicalStringify).join(",")}]`;
      return `{${Object.keys(v)
        .map((k) => `${JSON.stringify(k)}:${canonicalStringify(v[k])}`)
        .join(",")}}`;
    default:
      throw new Error(`Tipo no serializable: ${typeof v}`);
  }
}
