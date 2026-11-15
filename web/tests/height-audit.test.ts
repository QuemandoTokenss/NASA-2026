/**
 * PC-28 · Auditoría de alturas y lectura de resultados de Regret Lab.
 * - Las cifras que muestra la interfaz (summary.json) salen de audit.json y del motor firmado.
 * - Comprobación geométrica independiente (vectores cartesianos) dentro de 1e-6°.
 * - Ceros válidos ≠ desconocidos; empates, criterios alternativos y regla de empate del motor.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CRITERIA, HEIGHTS_M, WINDOW_IDS } from "@/lib/contract/constants";
import { getCriterionResult } from "@/lib/data/selectors";
import { HEIGHT_AUDIT, packageSeries, packageWinner, packageWinnerChanges } from "@/lib/science/heightAudit";
import { criterionSnapshots, discriminatingCriteria, heightTrack, resultKind } from "@/lib/science/regretSummary";
import { core, ROOT, sha256 } from "./helpers";

const C = core();
const AUDIT_DIR = join(ROOT, "data", "derived", "height-audit", "v1");
const audit = JSON.parse(readFileSync(join(AUDIT_DIR, "audit.json"), "utf8"));
const engineSha = sha256(readFileSync(join(ROOT, "data", "source", "DERIVADOS_SITE_REGRET", "motor", "pipeline.py")));
const heights = (w: string, s: string) => JSON.parse(readFileSync(join(ROOT, "data", "derived", "engineer-heights", "v1", "scenarios", `${w}_${s}.json`), "utf8"));

describe("auditoría de alturas: trazabilidad", () => {
  it("se generó con el motor firmado sin modificar y con el script versionado", () => {
    expect(audit.engine_sha256).toBe(engineSha);
    expect(HEIGHT_AUDIT.engine_sha256).toBe(engineSha);
    expect(HEIGHT_AUDIT.script_sha256).toBe(audit.script_sha256);
    // Finales de línea normalizados a LF (Git puede dar CRLF en Windows).
    expect(audit.script_sha256).toBe(sha256(readFileSync(join(ROOT, "scripts", "engine", "height_audit.py"), "utf8").replace(/\r\n/g, "\n")));
  });

  it("el barrido de la auditoría reproduce el contrato a 0, 2 y 10 m (superficie nominal)", () => {
    for (const s of ["A", "B"] as const)
      for (const w of WINDOW_IDS)
        for (const h of HEIGHTS_M) {
          const m = audit.sites[s].height_sweep[String(h)].windows[w].metrics;
          const ref = C.scenario_summaries.find((x) => x.site_id === s && x.window_id === w && x.height_m === h && x.variant === "nominal")!.metrics;
          for (const k of ["sun_hours", "dte_center_hours", "joint_hours", "longest_dark_hours", "unknown_hours"] as const) expect(m[k]).toBeCloseTo(ref[k], 5);
        }
  });

  it("geometría: la fórmula del motor coincide con vectores 3D independientes (< 1e-6°)", () => {
    for (const s of ["A", "B"]) {
      for (const v of Object.values(audit.sites[s].cartesian_check_max_abs_deg) as Array<Record<string, number>>) {
        expect(v.formula_float64_vs_cartesian_deg).toBeLessThan(1e-6);
        expect(v.engine_float32_vs_cartesian_deg).toBeLessThan(1e-5);
      }
    }
  });

  it("0 m: el obstáculo de la sombra W2 está en campo próximo y asoma menos que el error vertical del DEM", () => {
    for (const s of ["A", "B"] as const) {
      const d = HEIGHT_AUDIT.sites[s].W2_0m_deepest!;
      expect(d.obstacle_distance_m).toBeLessThanOrEqual(50);
      expect(d.sun_minus_horizon_deg).toBeLessThan(0);
      expect(d.equivalent_height_m).toBeLessThan(HEIGHT_AUDIT.sites[s].toterr_m);
    }
  });

  it("0 m: B tiene menos racha sin Sol que A en las 14 configuraciones (empareja cada prueba)", () => {
    const sa = audit.sites.A.near_field_sensitivity;
    const sb = audit.sites.B.near_field_sensitivity;
    expect(Object.keys(sa)).toHaveLength(14);
    for (const n of Object.keys(sa)) expect(sb[n].windows.W2["0"].longest_dark_hours).toBeLessThan(sa[n].windows.W2["0"].longest_dark_hours);
  });

  it("≥ 0,5 m: ninguna configuración (interpolación, desplazamiento, distancia mínima) produce oscuridad", () => {
    for (const s of ["A", "B"] as const) {
      expect(HEIGHT_AUDIT.sites[s].dark_hours_max_at_0_5_and_2m_all_configs).toBe(0);
      for (const w of WINDOW_IDS) for (const h of ["0.5", "2", "10"]) expect(HEIGHT_AUDIT.sites[s].sun_margin_min_deg[h][w]).toBeGreaterThan(0.27);
    }
  });

  it("la sensibilidad a la altura es monótona: subir el observador nunca sube el horizonte medio", () => {
    for (const s of ["A", "B"]) {
      const sw = audit.sites[s].height_sweep;
      const hs = Object.keys(sw).map(Number).sort((a, b) => a - b);
      for (let i = 1; i < hs.length; i++) expect(sw[String(hs[i])].horizon_mean_deg).toBeLessThanOrEqual(sw[String(hs[i - 1])].horizon_mean_deg);
    }
  });
});

describe("Regret Lab: tipos de resultado", () => {
  it("2 y 10 m, racha sin Sol: empate SIN oscuridad (0 h válidas, no desconocidas) en W1 y W2", () => {
    for (const w of WINDOW_IDS)
      for (const h of [2, 10] as const) {
        const s = criterionSnapshots(C, w, h).find((x) => x.criterion === "min_longest_dark_hours")!;
        expect(s).toMatchObject({ a: 0, b: 0, winner: "TIE", kind: "tie_no_dark", unknownHours: 0 });
        expect(criterionSnapshots(C, w, h).find((x) => x.criterion === "max_sun_hours")!.kind).toBe("tie_full");
      }
  });

  it("cuando la racha sin Sol empata, la visibilidad terrestre sí distingue (gana A)", () => {
    const snaps = criterionSnapshots(C, "W2", 2);
    const others = discriminatingCriteria(snaps, "min_longest_dark_hours");
    expect(others.map((o) => o.criterion)).toEqual(["max_dte_hours", "max_joint_hours"]);
    const dte = snaps.find((x) => x.criterion === "max_dte_hours")!;
    expect(dte.winner).toBe("A");
    expect(dte.a! - dte.b!).toBeCloseTo(40 / 60, 9);
  });

  it("W2 0 m: diferencia relevante (B) y cambio de ganador 0 → 2 m", () => {
    const track = heightTrack(C, "W2", "min_longest_dark_hours");
    expect(track.map((t) => t.winner)).toEqual(["B", "TIE", "TIE"]);
    expect(track[0].kind).toBe("decisive");
  });

  it("un desconocido nunca se clasifica como empate ni como cero", () => {
    const r = getCriterionResult(C, "W2", 2, "min_longest_dark_hours")!;
    expect(resultKind({ ...r, nominal_winner: "UNKNOWN" }, 0, 0, 720, 0)).toBe("unknown");
    expect(resultKind(r, 0, 0, 720, 1 / 6)).toBe("unknown");
    expect(resultKind(r, null, 0, 720, 0)).toBe("unknown");
  });

  it("la clasificación coincide con el ganador del motor en las 24 combinaciones", () => {
    for (const w of WINDOW_IDS)
      for (const h of HEIGHTS_M)
        for (const s of criterionSnapshots(C, w, h)) {
          const r = getCriterionResult(C, w, h, s.criterion)!;
          expect(s.kind === "decisive").toBe(r.nominal_winner === "A" || r.nominal_winner === "B");
        }
    expect(CRITERIA).toHaveLength(4);
  });
});

describe("paquete de alturas con la regla de empate del motor", () => {
  it("en 0/2/10 m reproduce el ganador nominal del contrato para los cuatro criterios", () => {
    for (const w of WINDOW_IDS) {
      const ia = heights(w, "A");
      const ib = heights(w, "B");
      for (const c of CRITERIA)
        for (const h of HEIGHTS_M) {
          const k = `k${String(h * 2).padStart(3, "0")}`;
          expect(packageWinner(c, ia[k], ib[k])).toBe(getCriterionResult(C, w, h, c)!.nominal_winner);
        }
    }
  });

  it("W2 · racha sin Sol: el único cambio de ganador está entre 0 y 0,5 m", () => {
    const series = packageSeries("min_longest_dark_hours", heights("W2", "A"), heights("W2", "B"));
    expect(series).toHaveLength(61);
    const ch = packageWinnerChanges(series);
    expect(ch).toHaveLength(1);
    expect([ch[0].from.height_m, ch[0].to.height_m, ch[0].from.winner, ch[0].to.winner]).toEqual([0, 0.5, "B", "TIE"]);
  });
});
