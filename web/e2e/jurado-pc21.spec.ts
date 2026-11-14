import { expect, test } from "./fixtures";
import { core, hm, noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

const summary = (site: string, h: number, v: string) =>
  core.scenario_summaries.find((s: { site_id: string; window_id: string; height_m: number; variant: string }) => s.site_id === site && s.window_id === "W2" && s.height_m === h && s.variant === v).metrics;

test.describe("PC-21 · Portada", () => {
  test("Luna local, pregunta, botón de la misión y el caso de B leído del paquete", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await waitForData(page);
    const hero = page.getByTestId("home-hero");
    await expect(hero.getByRole("heading", { level: 1 })).toHaveText("¿Dónde alunizarías?");
    const img = hero.locator("img").first();
    await expect(img).toHaveAttribute("src", /hero-moon-svs5187/);
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByTestId("hero-cta")).toHaveAttribute("href", /\/historia\/$/);
    // PC-24: una frase breve (el relieve cambia cuándo se ven el Sol y la Tierra); A y B señalados.
    await expect(page.getByTestId("hero-pitch")).toHaveText("En el polo sur de la Luna, el relieve decide cuándo se ven el Sol y la Tierra desde cada sitio.");
    await expect(page.getByTestId("hero-sites").getByRole("listitem")).toHaveText([/Sitio A.*ROI 4/, /Sitio B.*ROI 6/]);
    const why = page.getByTestId("home-why-b");
    await expect(why).toContainText(hm(summary("B", 0, "nominal").longest_dark_hours));
    await expect(why).toContainText(hm(summary("B", 0, "correlated_plus").longest_dark_hours));
    await expect(why).toContainText("14 h 40 min");
    await expect(why).toContainText("49 h");
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test.describe("sin Moon Trek", () => {
    test.use({ trek: "offline" });
    test("la imagen de portada es local y carga igual", async ({ page }) => {
      await page.goto("/");
      await waitForData(page);
      await expect.poll(() => page.getByTestId("home-hero").locator("img").first().evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    });
  });
});

test.describe("PC-21 · Explore", () => {
  test("mapa primero con «Imagen lunar», ficha simple y datos técnicos plegados", async ({ page }) => {
    await page.goto("/explore/?s=A");
    await waitForData(page);
    const map = page.getByTestId("geomap").first();
    await expect(map).toHaveAttribute("data-basemap-status", "available");
    await expect(page.getByRole("radio", { name: /Imagen lunar/ })).toBeChecked();
    await expect(page.getByRole("radio", { name: /Sin fondo/ })).toHaveCount(0);
    await expect(page.getByTestId("site-reading")).toContainText("La altura de este punto se estimó a partir de las medidas cercanas");
    await expect(page.locator("#datos-fuentes")).not.toHaveAttribute("open", "");
    await page.getByRole("radio", { name: /Vista regional/ }).check();
    await expect(map).toHaveAttribute("data-basemap", "wac");
  });
});

test.describe("PC-21/22 · Engineer: deslizador de 0 a 30 m", () => {
  test("en nominal todas las posiciones tienen cálculo; la URL analítica solo guarda 0/2/10", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/engineer/?s=A&w=W2&h=10&v=nominal&t=3200");
    await waitForData(page);
    const slider = page.getByTestId("tower-height-slider");
    await expect(page.getByTestId("terrain-scene").locator("canvas")).toBeVisible({ timeout: 30_000 });
    await expect(slider).toHaveValue("10");
    await expect(page.getByTestId("terrain-conclusion")).toBeVisible();
    // 30 m: resultado propio del paquete de alturas (sin aviso de «sin cálculo»); `h` sigue en 10.
    await slider.fill("30");
    await expect(page.getByTestId("obstacle-readout")).toHaveAttribute("data-height", "30", { timeout: 20_000 });
    await expect(page.getByTestId("tower-preview-banner")).toHaveCount(0);
    await expect(page.getByTestId("terrain-scene")).toHaveAttribute("data-observer-height", "30");
    await expect(page.getByTestId("terrain-conclusion")).toBeVisible();
    await expect(page.getByTestId("terrain-explain")).toContainText("torre de 30 m");
    await expect(page.getByRole("heading", { name: "Rendimiento geométrico (altura 30 m)" })).toBeVisible();
    await expect(page).toHaveURL(/h=10/);
    await expect(page).toHaveURL(/torre=30/);
    // Acceso rápido a 2 m: escenario original sincronizado.
    await page.getByRole("radio", { name: "2 m" }).click();
    await expect(page).toHaveURL(/h=2/);
    await expect(page).not.toHaveURL(/torre=/);
    await expect(page.getByTestId("terrain-scene")).toHaveAttribute("data-observer-height", "2");
    await expect(page.getByRole("heading", { name: "Rendimiento geométrico (altura 2 m)" })).toBeVisible();
    // 0 m por el deslizador.
    await slider.fill("0");
    await expect(page).toHaveURL(/h=0/);
    await expect(page.getByTestId("terrain-explain")).toContainText("Desde el suelo");
    // 6,5 m: calculado, sin tocar la URL analítica.
    await slider.fill("6.5");
    await expect(page.getByTestId("obstacle-readout")).toHaveAttribute("data-height", "6.5", { timeout: 20_000 });
    await expect(page).toHaveURL(/h=0/);
    await expect(page).toHaveURL(/torre=6\.5/);
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });
});

test.describe("PC-21 · Timeline: cielo local con Sol y Tierra reconocibles", () => {
  test("los iconos siguen al instante", async ({ page }) => {
    await page.goto("/timeline/?s=A&w=W2&h=2&v=nominal&t=1200");
    await waitForData(page);
    const sun = page.getByTestId("sky-body-sun");
    const earth = page.getByTestId("sky-body-earth");
    await expect(sun.locator("image")).toHaveAttribute("href", /sun-sdo-aia171/);
    await expect(earth.locator("image")).toHaveAttribute("href", /earth-bluemarble/);
    const before = await sun.locator("image").getAttribute("x");
    await page.getByRole("button", { name: "Avanzar 1 día" }).click();
    await expect.poll(() => sun.locator("image").getAttribute("x")).not.toBe(before);
  });
});

test.describe("PC-21 · Comparador", () => {
  test("control W2 · 0 m y Sol durante toda la ventana a 2 m (empate)", async ({ page }) => {
    await page.goto("/comparador/?w=W2&h=0&v=nominal&c=min_longest_dark_hours");
    await waitForData(page);
    await expect(page.getByTestId("twin-reading-A")).toHaveText("38 h 40 min");
    await expect(page.getByTestId("twin-reading-B")).toHaveText("14 h 40 min");
    await expect(page.getByTestId("engine-sentence")).not.toHaveAttribute("open", "");
    await page.goto("/comparador/?w=W2&h=2&v=nominal&c=max_sun_hours");
    await waitForData(page);
    expect(summary("A", 2, "nominal").sun_hours).toBe(720);
    await expect(page.getByTestId("twin-reading-A")).toHaveText("30 de 30 días");
    await expect(page.getByTestId("pair-legend")).toContainText("(720 h)");
    await expect(page.getByText(/Empate entre A y B/)).toBeVisible();
    await expect(page.getByTestId("full-sun-row")).toContainText("30 de 30 días");
  });
});
