import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { core, hm, noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

/** Ajustes finales para el jurado: Presentar con foto de Connecting Ridge, cabecera sin etiqueta verde, Regret Lab. */
const META = { width: 1440, height: 900, bounds: [-12095.0, -12608.75, -9995.0, -11296.25] };
const metric = (site: string, w: string, h: number, key: string) =>
  core.scenario_summaries.find((s: { site_id: string; window_id: string; height_m: number; variant: string }) => s.site_id === site && s.window_id === w && s.height_m === h && s.variant === "nominal").metrics[key];

/** Posición de cada marcador en píxeles de la imagen de 1440 × 900, medida en pantalla. */
const markerPixels = (page: Page) =>
  page.evaluate(() => {
    const img = document.querySelector("[data-testid=ridge-map-image]")!.getBoundingClientRect();
    return ["A", "B"].map((id) => {
      const r = document.querySelector(`[data-testid=ridge-marker-${id}]`)!.getBoundingClientRect();
      return [((r.left - img.left) / img.width) * 1440, ((r.top - img.top) / img.height) * 900];
    });
  });
const expected = () =>
  core.sites.map((s: { x_m: number; y_m: number }) => [((s.x_m - META.bounds[0]) / (META.bounds[2] - META.bounds[0])) * META.width, ((META.bounds[3] - s.y_m) / (META.bounds[3] - META.bounds[1])) * META.height]);
const inView = async (page: Page, loc: ReturnType<Page["getByTestId"]>, vh: number) => {
  const b = (await loc.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(vh);
};

test.describe("PC-25 · Presentar con la foto de Connecting Ridge", () => {
  test("1280×720: pregunta, foto, dos opciones y acción del paso juntos; camino B hasta el regret, sin red externa", async ({ page }) => {
    const errors = trackErrors(page);
    const external: string[] = [];
    // Cualquier petición fuera del servidor local se corta: la demo no depende de la red.
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => {
      external.push(r.request().url());
      return r.abort("internetdisconnected");
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/historia/");
    await waitForData(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("¿Dónde alunizarías?");
    await expect(page.getByTestId("demo-subtitle")).toContainText("Tu misión de ejemplo aguanta hasta 24 horas seguidas sin Sol.");
    const map = page.getByTestId("ridge-map");
    await expect(map).toHaveAttribute("data-source", "orbital");
    await expect.poll(() => page.getByTestId("ridge-map-image").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1440);
    await expect(page.getByTestId("ridge-map-caption")).toContainText("Las sombras de la imagen orbital corresponden a su adquisición");
    await expect(map).toContainText("NASA Moon Trek · LRO/LROC NAC");
    // Dos controles claros, sin cifras ni «?» antes de elegir.
    await expect(page.getByTestId("demo-card-A")).toHaveAttribute("data-revealed", "false");
    await expect(page.getByTestId("demo-hours-A")).toHaveCount(0);
    for (const id of ["ridge-map-image", "demo-card-A", "demo-card-B"]) await inView(page, page.getByTestId(id), 720);
    await inView(page, page.getByRole("heading", { level: 1 }) as never, 720);
    // Marcadores sobre el píxel del metadato (= coordenadas del paquete), con error < 1 px de la imagen.
    const want = expected();
    (await markerPixels(page)).forEach(([x, y], i) => {
      expect(Math.abs(x - want[i][0])).toBeLessThan(1);
      expect(Math.abs(y - want[i][1])).toBeLessThan(1);
    });
    // Camino B.
    await page.getByTestId("demo-card-B").click();
    await expect(page.getByTestId("ridge-marker-B")).toHaveAttribute("data-chosen", "true");
    await expect(page.getByTestId("ridge-marker-B")).toContainText("tu elección");
    await expect(page.getByTestId("demo-hours-A")).toHaveText("38 h 40 min");
    await expect(page.getByTestId("demo-hours-B")).toHaveText("14 h 40 min");
    await inView(page, page.getByRole("button", { name: "Prueba otro mapa del terreno" }) as never, 720);
    await page.getByRole("button", { name: "Prueba otro mapa del terreno" }).click();
    await expect(page.getByTestId("demo-scenario")).toContainText("Relieve alternativo · hipótesis del equipo");
    await expect(page.getByTestId("demo-hours-A")).toHaveText("32 h 30 min");
    await expect(page.getByTestId("demo-hours-B")).toHaveText("49 h");
    await expect(page.getByTestId("demo-message")).toContainText("Conservar B supone 16 h 30 min más sin Sol que elegir A en este escenario.");
    await inView(page, page.getByRole("button", { name: "Eleva el observador a 2 m" }) as never, 720);
    // El mapa se conserva al elegir y avanzar.
    await expect(map).toBeVisible();
    await page.getByRole("button", { name: "Eleva el observador a 2 m" }).click();
    await expect(page.getByTestId("demo-hours-B")).toHaveText("0 h");
    await page.getByRole("button", { name: "Reiniciar demo" }).click();
    await expect(page.getByTestId("ridge-marker-B")).toHaveAttribute("data-chosen", "false");
    // Explicación larga y evidencia siguen accesibles.
    await page.getByTestId("demo-why").click();
    await expect(page.getByTestId("demo-plain-explanation")).toContainText("Racha sin Sol = el mayor tramo continuo");
    await expect(page.getByTestId("demo-evidence")).toHaveAttribute("href", /\/evidencia\/$/);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("camino A y marcadores alineados al cambiar el tamaño de pantalla", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/historia/");
    await waitForData(page);
    await page.getByTestId("demo-card-A").click();
    await expect(page.getByTestId("ridge-marker-A")).toHaveAttribute("data-chosen", "true");
    await expect(page.getByTestId("demo-best-reference")).toHaveText("Con este mapa del terreno, Sitio B era mejor opción.");
    await page.getByRole("button", { name: "Prueba otro mapa del terreno" }).click();
    await expect(page.getByTestId("demo-regret-value")).toHaveText("0 h");
    const want = expected();
    for (const [w, h] of [
      [1440, 900],
      [1280, 720],
      [1024, 768],
      [390, 844],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(150);
      const ratio = await page.getByTestId("ridge-map-image").evaluate((i) => i.getBoundingClientRect().width / i.getBoundingClientRect().height);
      expect(ratio).toBeCloseTo(1440 / 900, 2);
      (await markerPixels(page)).forEach(([x, y], i) => {
        expect(Math.abs(x - want[i][0]), `${w}×${h} ${i}`).toBeLessThan(1);
        expect(Math.abs(y - want[i][1]), `${w}×${h} ${i}`).toBeLessThan(1);
      });
    }
    await noHorizontalOverflow(page);
  });

  test("si la foto no carga, se ve el relieve calculado, rotulado, con el mismo encuadre", async ({ page }) => {
    await page.route("**/*connecting-ridge-orbital*", (r) => r.abort());
    await page.goto("/historia/");
    await waitForData(page);
    await expect(page.getByTestId("ridge-map")).toHaveAttribute("data-source", "relief");
    await expect(page.getByTestId("ridge-map-caption")).toContainText("relieve calculado a partir del DEM LOLA PGDA78 (5 m) con luz ilustrativa");
    await expect.poll(() => page.getByTestId("ridge-map-image").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1440);
  });

  test("móvil: los botones quedan junto a la pregunta y la foto es legible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/historia/");
    await waitForData(page);
    const h1 = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    const a = (await page.getByTestId("demo-card-A").boundingBox())!;
    expect(a.y - (h1.y + h1.height)).toBeLessThan(160);
    await inView(page, page.getByTestId("demo-card-B"), 844);
    const img = (await page.getByTestId("ridge-map-image").boundingBox())!;
    expect(img.width).toBeGreaterThan(300);
    await noHorizontalOverflow(page);
  });
});

test.describe("PC-25 · Cabecera sin etiqueta verde", () => {
  test("ES/EN y Presentar alineados; el hash sigue en Evidencia; un dato alterado sigue bloqueando", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/evidencia/");
    await waitForData(page);
    const header = page.locator("header").first();
    await expect(header.getByText(/e7c8984b/)).toHaveCount(0);
    const present = (await header.getByRole("link", { name: "Presentar" }).boundingBox())!;
    const lang = (await header.getByRole("group", { name: "Idioma" }).boundingBox())!;
    expect(Math.abs(present.y + present.height / 2 - (lang.y + lang.height / 2))).toBeLessThan(2);
    await expect(page.getByText(/e7c8984b/).first()).toBeVisible();
    await page.route("**/v0.1/core.json", async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: (await res.text()) + " " });
    });
    await page.goto("/timeline/");
    await expect(page.locator("main [role=alert]")).toContainText("Integridad fallida en core.json");
  });
});

test.describe("PC-25 · Regret Lab: empates a 0 h y control de otras métricas", () => {
  test("racha sin Sol a 2 y 10 m: empate explicado; Tierra visible lee sus valores; W2 0 m distingue A y B", async ({ page }) => {
    for (const [w, h] of [
      ["W1", 2],
      ["W1", 10],
      ["W2", 2],
      ["W2", 10],
    ] as const) {
      expect(metric("A", w, h, "longest_dark_hours")).toBe(0);
      expect(metric("B", w, h, "longest_dark_hours")).toBe(0);
      await page.goto(`/regret-lab/?w=${w}&h=${h}&v=nominal&c=min_longest_dark_hours`);
      await waitForData(page);
      await expect(page.getByTestId("regret-kpi-choice")).toContainText("Empate");
      await expect(page.getByTestId("regret-zero-tie")).toHaveText(/En esta ventana y a esta altura, ninguno de los dos sitios tiene un tramo sin Sol según el modelo\. Por eso empatan en este criterio\./);
      await expect(page.getByText("El escenario de referencia empata, así que no hay una elección inicial que comparar")).toBeVisible();
      await expect(page.getByText("Elige un sitio a conservar")).toBeVisible();
    }
    // Mismo escenario W2 · 10 m, criterio de Tierra visible elegido en la interfaz: sus propios valores, sin empate a 0 h.
    await page.getByLabel("Criterio de decisión").selectOption("max_dte_hours");
    await expect(page).toHaveURL(/c=max_dte_hours/);
    expect(metric("A", "W2", 10, "dte_center_hours")).toBe(399);
    await expect(page.getByTestId("regret-kpi-a")).toContainText("399 h");
    await expect(page.getByTestId("regret-kpi-b")).toContainText("398 h 10 min");
    await expect(page.getByTestId("regret-zero-tie")).toHaveCount(0);
    // W2 · 0 m · racha sin Sol: 38 h 40 min frente a 14 h 40 min, sin texto de empate.
    await page.goto("/regret-lab/?w=W2&h=0&v=nominal&c=min_longest_dark_hours");
    await waitForData(page);
    await expect(page.getByTestId("regret-kpi-a")).toContainText(hm(metric("A", "W2", 0, "longest_dark_hours")));
    await expect(page.getByTestId("regret-kpi-a")).toContainText("38 h 40 min");
    await expect(page.getByTestId("regret-kpi-b")).toContainText("14 h 40 min");
    await expect(page.getByTestId("regret-zero-tie")).toHaveCount(0);
  });
});
