/**
 * Adaptador ODE REST sobre RESPUESTAS REALES grabadas el 14-11-2026
 * (tests/fixtures/ode/, ver su README). No hay datos sintéticos de producto.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lonLatToXY } from "@/lib/geospatial/lunar";
import { ODE_PRODUCT_TYPES, OdeError, footprintContains, nextOffset, odeQueryUrl, parseOdeResponse, parseWktPolygons } from "@/lib/geospatial/ode";
import { ROOT, core } from "./helpers";

const FIX = join(ROOT, "tests", "fixtures", "ode");
const load = (f: string) => JSON.parse(readFileSync(join(FIX, f), "utf8"));
const REGION = { westernLon: 222.4, easternLon: 223.1, minLat: -89.48, maxLat: -89.44 };
const C = core();

describe("ODE REST (respuestas reales)", () => {
  const page1 = parseOdeResponse(load("product_CDRNAC4_offset1_limit5.json"));
  const page2 = parseOdeResponse(load("product_CDRNAC4_offset6_limit5.json"));

  it("la consulta sale de parámetros documentados y acota la región de los sitios", () => {
    const url = new URL(odeQueryUrl(ODE_PRODUCT_TYPES[0], REGION, { offset: 0, limit: 5 }));
    expect(url.origin + url.pathname).toBe("https://oderest.rsl.wustl.edu/live2/");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ query: "product", target: "moon", ihid: "LRO", iid: "LROC", pt: "CDRNAC4", output: "JSON", results: "copm", limit: "5", offset: "1", westernlon: "222.4", maxlat: "-89.44" });
    expect(new URL(odeQueryUrl(ODE_PRODUCT_TYPES[0], REGION, { countOnly: true })).searchParams.get("results")).toBe("c");
    for (const s of C.sites) {
      expect(s.longitude_east_deg).toBeGreaterThan(REGION.westernLon);
      expect(s.longitude_east_deg).toBeLessThan(REGION.easternLon);
      expect(s.latitude_deg).toBeGreaterThan(REGION.minLat);
      expect(s.latitude_deg).toBeLessThan(REGION.maxLat);
    }
  });

  it("recuento total y paginación con offset en base 1, sin repetir productos", () => {
    expect(parseOdeResponse(load("product_CDRNAC4_count.json")).count).toBe(253);
    expect(page1.offset).toBe(1);
    expect(page2.offset).toBe(6);
    expect(nextOffset(1, 5, 253)).toBe(6);
    expect(nextOffset(251, 5, 253)).toBeNull();
    const ids = [...page1.products, ...page2.products].map((p) => p.pdsId);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
    expect(ids[0]).toBe("nac.m101350392lc");
  });

  it("conserva identificadores, fechas, ángulos y enlaces originales", () => {
    const p = page1.products[0];
    expect(p).toMatchObject({ pdsId: "nac.m101350392lc", productType: "CDRNAC4", dataSetId: "lro-l-lroc-3-cdr" });
    expect(p.observationTime).toMatch(/^2009-/);
    expect(p.incidenceDeg).toBeGreaterThan(80);
    expect(p.labelUrl).toMatch(/^https:\/\/pds\.lroc\./);
    expect(p.productUrl).toMatch(/^https:\/\/ode\.rsl\.wustl\.edu\/moon\//);
    for (const q of [...page1.products, ...page2.products]) expect(q.footprint.length).toBeGreaterThan(0);
  });

  it("la huella polar de ODE usa la misma proyección que el proyecto", () => {
    const raw = load("product_CDRNAC4_offset1_limit5.json").ODEResults.Products.Product[0];
    const lonLat = parseWktPolygons(raw.Footprint_C0_geometry)[0][0];
    const sp = parseWktPolygons(raw.Footprint_SP_geometry)[0][0];
    const mine = lonLatToXY(lonLat.x, lonLat.y);
    // Las coordenadas lon/lat de ODE vienen redondeadas a 0,01°: decenas de metros a esta latitud.
    expect(Math.hypot(mine.x - sp.x, mine.y - sp.y)).toBeLessThan(5);
  });

  it("la caja lon/lat no basta en el polo: se decide con la huella real", () => {
    const all = [...page1.products, ...page2.products];
    const a = C.sites.find((s) => s.id === "A")!;
    const containing = all.filter((p) => footprintContains(p.footprint, { x: a.x_m, y: a.y_m }));
    // Los 10 productos «tocan» la caja de búsqueda, pero no todos contienen el sitio A.
    expect(containing.length).toBeLessThan(all.length);
    expect(footprintContains(all[0].footprint, { x: 5e6, y: 5e6 })).toBe(false);
  });

  it("errores del servicio con HTTP 200, respuestas ajenas y WKT no válido", () => {
    expect(() => parseOdeResponse(load("product_invalid_iipt_error.json"))).toThrow(/Invalid IIPT/);
    try {
      parseOdeResponse(load("product_invalid_iipt_error.json"));
    } catch (e) {
      expect((e as OdeError).kind).toBe("service");
    }
    expect(() => parseOdeResponse({ hello: "world" })).toThrow(OdeError);
    expect(() => parseOdeResponse({ ODEResults: { Status: "Success" } })).toThrow(/recuento/);
    expect(parseWktPolygons("POINT (1 2)")).toEqual([]);
    expect(parseWktPolygons(null)).toEqual([]);
    // Cero resultados no es un error ni autoriza a inventar productos.
    expect(parseOdeResponse({ ODEResults: { Status: "Success", Count: "0", QuerySummary: {} } }).products).toEqual([]);
  });
});
