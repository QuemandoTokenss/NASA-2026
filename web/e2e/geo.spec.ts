import { readFileSync } from "node:fs";
import { join } from "node:path";
import { horizonObstacle } from "../src/lib/geospatial/horizon";
import { arcDistanceM } from "../src/lib/geospatial/lunar";
import { sampleBilinear, type RasterGrid } from "../src/lib/geospatial/raster";
import { expect, test } from "./fixtures";
import { core, noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

const WEB = join(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(WEB, "data", "derived", "terrain", "manifest.json"), "utf8"));
const registry = JSON.parse(readFileSync(join(WEB, "data", "geospatial", "registry.json"), "utf8"));
const g = manifest.georeferencing;
const buf = readFileSync(join(WEB, "data", "derived", "terrain", "elevation.f32"));
const elevation: RasterGrid = { width: g.width, height: g.height, pixelSizeM: g.pixel_size_m, xmin: g.window_bounds_xy_m[0], ymax: g.window_bounds_xy_m[3], data: new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4) };
const chunk = (path: string) => JSON.parse(readFileSync(join(WEB, "public", "data", "site-regret", "v0.1", ...path.split("/")), "utf8"));
const A = core.sites.find((s: { id: string }) => s.id === "A");
const B = core.sites.find((s: { id: string }) => s.id === "B");
/** Número con formato es-ES → number. */
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".").replace("−", "-"));
const es = (v: number, d: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

test.describe("Explore · mapa georreferenciado", () => {
  test("pide teselas WMTS reales de Moon Trek según el documento de capacidades", async ({ page }) => {
    const errors = trackErrors(page);
    const tiles: string[] = [];
    page.on("request", (r) => r.url().includes("trek.nasa.gov") && tiles.push(r.url()));
    await page.goto("/explore/?s=A");
    await waitForData(page);
    const map = page.getByTestId("geomap");
    await expect(map).toHaveAttribute("data-basemap-status", "available");
    await expect(page.getByText("Teselas reales recibidas")).toBeVisible();
    expect(tiles.some((u) => u.endsWith("LRO_NAC_Mosaic_1mpp_SP/1.0.0/WMTSCapabilities.xml"))).toBe(true);
    const tileUrls = tiles.filter((u) => /default\/default028mm\/\d+\/\d+\/\d+\.png$/.test(u));
    expect(tileUrls.length).toBeGreaterThan(3);
    // A la resolución inicial (2,5 m/px) el mapa usa el nivel más fino y la tesela del sitio A.
    expect(tileUrls).toContain(registry.assets.find((a: { id: string }) => a.id === "trek.sp.LRO_NAC_Mosaic_1mpp_SP").verification.example_tile);
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("cambiar de capa numérica cambia los datos dibujados y la leyenda", async ({ page }) => {
    await page.goto("/explore/?s=A");
    await waitForData(page);
    const map = page.getByTestId("geomap");
    await expect(map).toHaveAttribute("data-analytic", "none");
    await expect(page.getByTestId("geomap-legend")).toHaveCount(0);
    await expect(map).toHaveAttribute("data-basemap-status", "available");
    await page.waitForTimeout(800);
    const before = await page.locator(".geomap").screenshot();
    for (const id of ["slope", "elevation"] as const) {
      await page.selectOption("#geomap-analytic", id);
      await expect(map).toHaveAttribute("data-analytic", id);
      await expect(map).toHaveAttribute("data-analytic-ready", "true");
      const st = manifest.layers.find((l: { id: string }) => l.id === id).stats;
      await expect(page.getByTestId("geomap-legend")).toContainText(es(st.max, 2));
      await expect(page.getByTestId("geomap-legend")).toContainText(es(st.min, 2));
    }
    await page.waitForTimeout(600);
    const after = await page.locator(".geomap").screenshot();
    expect(Buffer.compare(before, after)).not.toBe(0);
    await page.selectOption("#geomap-analytic", "lola_count");
    await expect(page.getByTestId("geomap-legend")).toContainText("interpolado");
  });

  test("la lectura del punto sale del raster: sitio A = valores del paquete", async ({ page }) => {
    await page.goto("/explore/?s=B");
    await waitForData(page);
    await page.getByRole("button", { name: "Ir y leer en Sitio A" }).click();
    const ins = page.getByTestId("geomap-inspector");
    await expect(page).toHaveURL(/s=A/);
    await expect(ins.getByTestId("geomap-xy")).toContainText(`X ${es(A.x_m, 1)} m`);
    await expect(ins.locator("[data-layer=elevation] dd")).toHaveText(`${es(A.nominal_height_m, 3)} m`);
    await expect(ins.locator("[data-layer=slope] dd")).toHaveText(`${es(A.values.slp, 3)}°`);
    await expect(ins.locator("[data-layer=vertical_rms] dd")).toHaveText(`${es(A.values.toterr, 3)} m`);
    await expect(ins.locator("[data-layer=lola_count] dd")).toHaveText(es(A.values.ldec, 0));
    await expect(ins.getByText("Dentro de la ventana del DEM")).toBeVisible();
  });

  test("un clic en el mapa lee la altura interpolada del DEM en esa coordenada", async ({ page }) => {
    await page.goto("/explore/?s=A");
    await waitForData(page);
    const box = (await page.locator(".geomap").boundingBox())!;
    await page.waitForTimeout(800);
    await page.mouse.click(box.x + box.width / 2 + 90, box.y + box.height / 2 - 60);
    const ins = page.getByTestId("geomap-inspector");
    const xy = await ins.getByTestId("geomap-xy").innerText();
    const [, xs, ys] = xy.match(/X\s+(\S+)\s+m\s+·\s+Y\s+(\S+)\s+m/)!;
    const x = num(xs);
    const y = num(ys);
    // 2,5 m por píxel: 90 px al este y 60 px al norte del punto medio entre A y B.
    expect(x).toBeCloseTo((A.x_m + B.x_m) / 2 + 225, 0);
    expect(y).toBeCloseTo((A.y_m + B.y_m) / 2 + 150, 0);
    const shown = num((await ins.locator("[data-layer=elevation] dd").innerText()).replace(" m", ""));
    // La coordenada se muestra con un decimal: la altura puede variar unos centímetros.
    expect(Math.abs(shown - sampleBilinear(elevation, x, y))).toBeLessThan(0.05);
  });

  test("medir entre A y B: distancia sobre la esfera lunar y perfil del DEM", async ({ page }) => {
    await page.goto("/explore/?s=A");
    await waitForData(page);
    await page.getByRole("radio", { name: "Medir y perfil" }).click();
    const add = page.getByRole("button", { name: "Añadir el centro como punto" });
    await page.getByRole("button", { name: "Ir y leer en Sitio A" }).click();
    await page.waitForTimeout(700);
    await add.click();
    await page.getByRole("button", { name: "Ir y leer en Sitio B" }).click();
    await page.waitForTimeout(700);
    await add.click();
    const panel = page.getByTestId("geomap-measure");
    const arc = arcDistanceM({ x: A.x_m, y: A.y_m }, { x: B.x_m, y: B.y_m });
    await expect(panel).toContainText(`${es(arc, 1)} m`);
    await expect(panel).toContainText(`${es(B.nominal_height_m - A.nominal_height_m, 2)} m`);
    await expect(panel.getByRole("img", { name: /Perfil de elevación/ })).toBeVisible();
    await expect(panel).toContainText("0 muestras sin dato");
  });

  test("fuera de la ventana preparada no se inventan valores", async ({ page }) => {
    await page.goto("/explore/?s=A");
    await waitForData(page);
    await page.getByRole("button", { name: "Alejar" }).first().click();
    await page.getByRole("button", { name: "Alejar" }).first().click();
    await page.getByRole("button", { name: "Alejar" }).first().click();
    await page.waitForTimeout(600);
    const box = (await page.locator(".geomap").boundingBox())!;
    await page.mouse.click(box.x + 12, box.y + 12);
    const ins = page.getByTestId("geomap-inspector");
    await expect(ins.getByText("Fuera de la cobertura preparada")).toBeVisible();
    await expect(ins.locator("[data-layer=elevation] dd")).toHaveText("sin cobertura");
  });
});

test.describe("Explore · productos del archivo PDS (ODE)", () => {
  test("busca en la región, pagina y dibuja la huella real de un producto", async ({ page }) => {
    const errors = trackErrors(page);
    const queries: URL[] = [];
    page.on("request", (r) => r.url().includes("oderest.rsl.wustl.edu") && queries.push(new URL(r.url())));
    await page.goto("/explore/?s=A");
    await waitForData(page);
    const ode = page.getByTestId("ode-panel");
    await expect(ode.getByText("Aún no se ha consultado el archivo")).toBeVisible();
    await ode.getByRole("button", { name: "Buscar productos" }).click();
    await expect(ode.getByTestId("ode-summary")).toContainText("253 productos");
    await expect(ode.getByTestId("ode-summary")).toContainText("mostrando 1–5");
    await expect(ode.getByText("nac.m101350392lc")).toBeVisible();
    expect(queries.every((q) => q.searchParams.get("query") === "product" && q.searchParams.get("westernlon") === "222.4")).toBe(true);
    await ode.getByRole("button", { name: "Siguientes" }).click();
    await expect(ode.getByTestId("ode-summary")).toContainText("mostrando 6–10");
    await expect(ode.getByText("nac.m105688564rc")).toBeVisible();
    expect(queries.some((q) => q.searchParams.get("offset") === "6")).toBe(true);
    await ode.getByRole("listitem").filter({ hasText: "nac.m105688564rc" }).getByRole("button", { name: "Ver huella en el mapa" }).click();
    await expect(page.getByTestId("geomap").first()).toHaveAttribute("data-footprint", "nac.m105688564rc");
    await expect(ode.getByRole("link", { name: "Etiqueta PDS" }).first()).toHaveAttribute("href", /^https:\/\/pds\.lroc\./);
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("un tipo de producto que ODE rechaza se muestra como error del servicio", async ({ page }) => {
    await page.goto("/explore/?s=A");
    await waitForData(page);
    const ode = page.getByTestId("ode-panel");
    await ode.getByRole("combobox", { name: "Tipo de producto" }).selectOption("GDRDEM");
    await ode.getByRole("button", { name: "Buscar productos" }).click();
    await expect(ode.getByText("ODE rechazó la consulta")).toBeVisible();
    await expect(ode.getByText(/No se muestra ningún producto de sustitución/)).toBeVisible();
  });

  test.describe("sin red", () => {
    test.use({ trek: "offline" });
    test("ODE no disponible no bloquea el mapa ni inventa productos", async ({ page }) => {
      await page.goto("/explore/?s=A");
      await waitForData(page);
      const ode = page.getByTestId("ode-panel");
      await ode.getByRole("button", { name: "Buscar productos" }).click();
      await expect(ode.getByText("ODE no disponible")).toBeVisible();
      await expect(ode.getByRole("listitem")).toHaveCount(0);
      await page.getByRole("button", { name: "Ir y leer en Sitio A" }).click();
      await expect(page.getByTestId("geomap-inspector").getByText("Dentro de la ventana del DEM")).toBeVisible();
    });
  });
});

test.describe("Explore · fallos del servicio de mapas", () => {
  test.describe("sin red", () => {
    test.use({ trek: "offline" });
    test("no hay imagen de sustitución; el DEM local sigue funcionando", async ({ page }) => {
      await page.goto("/explore/?s=A");
      await waitForData(page);
      const map = page.getByTestId("geomap");
      await expect(map).toHaveAttribute("data-basemap-status", "unavailable");
      await expect(page.getByText("Servidor no disponible")).toBeVisible();
      await expect(page.getByText(/No se muestra ninguna imagen de sustitución/)).toBeVisible();
      await page.getByRole("radio", { name: /Relieve sombreado del DEM/ }).check();
      await expect(map).toHaveAttribute("data-basemap-status", "available");
      await page.getByRole("button", { name: "Ir y leer en Sitio A" }).click();
      await expect(page.getByTestId("geomap-inspector").locator("[data-layer=elevation] dd")).toHaveText(`${es(A.nominal_height_m, 3)} m`);
    });
  });
  test.describe("200 con HTML", () => {
    test.use({ trek: "html" });
    test("una respuesta que no es WMTS se rechaza", async ({ page }) => {
      await page.goto("/explore/?s=A");
      await waitForData(page);
      await expect(page.getByTestId("geomap")).toHaveAttribute("data-basemap-status", "invalid");
      await expect(page.getByText("Respuesta no válida")).toBeVisible();
    });
  });
});

test.describe("Engineer · terreno 3D y obstáculo", () => {
  const obstacleFor = (h: 0 | 10, t: number) => {
    const hz = chunk(`horizons/A_h${h}.json`);
    const eph = chunk(`ephemerides/W2_A_h${h}.json`);
    const az = eph.series.bodies.SUN.azimuth_deg[t];
    const o = horizonObstacle(hz.azimuth_deg, hz.variants.nominal, { lonEastDeg: A.longitude_east_deg, latDeg: A.latitude_deg }, A.nominal_height_m + h, az);
    return { o, el: eph.series.bodies.SUN.elevation_deg[t], horizon: eph.series.sun_horizon_deg[t] };
  };

  test("dibuja la malla del DEM y explica qué limita la visión del Sol", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/engineer/?s=A&w=W2&h=0&v=nominal&t=3200");
    await waitForData(page);
    const scene = page.getByTestId("terrain-scene");
    await expect(scene.locator("canvas")).toBeVisible({ timeout: 30_000 });
    // La escena tiene terreno dibujado (no un lienzo vacío).
    await expect
      .poll(() =>
        scene.locator("canvas").evaluate((c: HTMLCanvasElement) => {
          const k = document.createElement("canvas");
          k.width = 64;
          k.height = 64;
          const ctx = k.getContext("2d")!;
          ctx.drawImage(c, 0, 0, 64, 64);
          const d = ctx.getImageData(0, 0, 64, 64).data;
          let lit = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] > 60) lit++;
          return lit / (64 * 64);
        }),
      )
      .toBeGreaterThan(0.15);
    const { o, el, horizon } = obstacleFor(0, 3200);
    const readout = page.getByTestId("obstacle-readout");
    await expect(readout).toContainText(`${es(o.distanceM, 1)} m`);
    await expect(readout).toContainText(`${es(horizon, 3)}°`);
    await expect(readout).toContainText(el > horizon ? "Centro visible (motor)" : "Centro oculto (motor)");
    await expect(readout).toContainText("DEM local PGDA78 · 5 m");
    await expect(page.getByTestId("terrain-panel")).toContainText("160.000 vértices");
    await expect(page.getByTestId("terrain-panel").getByTestId("geomap")).toBeVisible();
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("con el mástil de 10 m cambia el obstáculo; el instante se comparte con Timeline", async ({ page }) => {
    await page.goto("/engineer/?s=A&w=W2&h=10&v=nominal&t=3200");
    await waitForData(page);
    const ten = obstacleFor(10, 3200);
    const readout = page.getByTestId("obstacle-readout");
    await expect(readout).toContainText(ten.o.distanceM >= 1000 ? `${es(ten.o.distanceM / 1000, 2)} km` : `${es(ten.o.distanceM, 1)} m`);
    await expect(readout).toContainText(ten.el > ten.horizon ? "Centro visible (motor)" : "Centro oculto (motor)");
    await page.getByTestId("terrain-panel").getByRole("button", { name: "+1 h" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("t")).toBe("3206");
    const next = obstacleFor(10, 3206);
    await expect(readout).toContainText(`${es(next.horizon, 3)}°`);
  });

  test("con otra superficie no se mezclan direcciones nominales: solo consulta por azimut", async ({ page }) => {
    await page.goto("/engineer/?s=A&w=W2&h=0&v=published_0001&t=3200");
    await waitForData(page);
    const panel = page.getByTestId("terrain-panel");
    await expect(panel.getByRole("radio", { name: "Sol", exact: true })).toBeDisabled();
    await expect(panel.getByRole("radio", { name: "Azimut", exact: true })).toHaveAttribute("aria-checked", "true");
    // PC-15: con un clon publicado la malla es la de ese clon (recorte verificado).
    await expect(panel.getByText(/La malla dibujada es el recorte de este clon publicado/)).toBeVisible();
    await expect(panel).toHaveAttribute("data-mesh-surface", "published_0001");
    await expect(panel).toHaveAttribute("data-mesh-ready", "true");
    const hz = chunk("horizons/A_h0.json");
    const z = core.horizons_index.A.observer_ground_height_m.published_0001;
    const o = horizonObstacle(hz.azimuth_deg, hz.variants.published_0001, { lonEastDeg: A.longitude_east_deg, latDeg: A.latitude_deg }, z, 0);
    await expect(page.getByTestId("obstacle-readout")).toContainText(o.distanceM >= 1000 ? `${es(o.distanceM / 1000, 2)} km` : `${es(o.distanceM, 1)} m`);
  });
});

test.describe("Engineer · hipótesis propia", () => {
  test("no se inventa su terreno: malla nominal con aviso", async ({ page }) => {
    await page.goto("/engineer/?s=B&w=W1&h=2&v=correlated_minus&t=100");
    await waitForData(page);
    const panel = page.getByTestId("terrain-panel");
    await expect(panel).toHaveAttribute("data-mesh-surface", "nominal");
    await expect(panel.getByText(/esta hipótesis propia no se reconstruye en la web/)).toBeVisible();
    await expect(page.getByTestId("engineer-hero")).toBeVisible();
  });
});

test.describe("Evidencia · procedencia por capa", () => {
  test("cada capa del mapa enlaza con su ficha, con hash completo y origen", async ({ page }) => {
    await page.goto("/explore/?s=A");
    await waitForData(page);
    await page.selectOption("#geomap-analytic", "elevation");
    await page.getByTestId("geomap-legend").getByRole("link", { name: "Procedencia" }).click();
    await expect(page).toHaveURL(/\/evidencia\/#geo-pgda78-site01-elevation/);
    const card = page.locator("#geo-pgda78-site01-elevation");
    const asset = registry.assets.find((a: { id: string }) => a.id === "pgda78.site01.elevation");
    await expect(card).toContainText(asset.sha256);
    await expect(card).toContainText("Site01_final_adj_5mpp_surf.tif");
    await expect(card).toContainText("Archivo completo verificado");
    await expect(card).toContainText(manifest.layers[0].sha256);
    await expect(page.locator("#geo-trek-sp-LRO_NAC_Mosaic_1mpp_SP")).toContainText("Mosaico multitemporal");
    await expect(page.locator("#geo li[id^=geo-]")).toHaveCount(registry.assets.length);
  });
});

test.describe("Moon Trek en vivo (opcional: E2E_LIVE_TREK=1)", () => {
  test.skip(!process.env.E2E_LIVE_TREK, "requiere red; ejecutar con E2E_LIVE_TREK=1");
  test.use({ trek: "live" });
  test("el servidor real entrega capacidades y teselas PNG con CORS", async ({ page }) => {
    const ok: string[] = [];
    page.on("response", (r) => r.url().includes("trek.nasa.gov") && r.url().endsWith(".png") && r.status() === 200 && ok.push(r.headers()["content-type"] ?? ""));
    await page.goto("/explore/?s=A");
    await waitForData(page);
    await expect(page.getByTestId("geomap")).toHaveAttribute("data-basemap-status", "available", { timeout: 30_000 });
    await page.waitForTimeout(3000);
    expect(ok.length).toBeGreaterThan(3);
    expect(ok.every((t) => t.startsWith("image/png"))).toBe(true);
    await page.getByTestId("geomap").screenshot({ path: "test-results/live-trek-explore.png" });
  });
});
