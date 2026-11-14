import { expect, test } from "./fixtures";
import { core, noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

const es = (v: number, d: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const site = (id: string) => core.sites.find((s: { id: string }) => s.id === id);

test.describe("Timeline · mapa orbital NASA en la ficha del sitio", () => {
  test("teselas de Moon Trek, crédito visible y cambio A ↔ B que conserva el escenario", async ({ page }) => {
    const errors = trackErrors(page);
    const tiles: string[] = [];
    page.on("request", (r) => /trek\.nasa\.gov.*\.png$/.test(r.url()) && tiles.push(r.url()));
    await page.goto("/timeline/?s=A&w=W2&h=2&v=nominal&t=1200");
    await waitForData(page);
    const card = page.getByTestId("timeline-site-map");
    const map = card.getByTestId("geomap");
    await expect(map).toHaveAttribute("data-basemap-status", "available");
    await expect(map).toHaveAttribute("data-focus-site", "A");
    await expect(card.getByTestId("geomap-credit")).toContainText("NASA Moon Trek · LRO/LROC NAC");
    expect(tiles.length).toBeGreaterThan(0);
    await expect(page.getByText(`${es(Math.abs(site("A").latitude_deg), 4)}° S`).first()).toBeVisible();
    await page.getByRole("button", { name: /Cambiar a sitio B/ }).click();
    await expect(map).toHaveAttribute("data-focus-site", "B");
    await expect(page).toHaveURL(/s=B&w=W2&h=2&v=nominal&t=1200/);
    await expect(page.getByText("Connecting Ridge · ROI 6").first()).toBeVisible();
    await expect(page.getByText(`${es(Math.abs(site("B").latitude_deg), 4)}° S`).first()).toBeVisible();
    // El resto del Timeline sigue operativo.
    await expect(page.getByTestId("orbital-view")).toHaveAttribute("data-time-index", "1200");
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test.describe("sin conexión con Moon Trek", () => {
    test.use({ trek: "offline" });
    test("la ficha cae al relieve del DEM rotulado como derivado y el Timeline sigue operativo", async ({ page }) => {
      await page.goto("/timeline/?s=A&w=W2&h=0&v=nominal&t=600");
      await waitForData(page);
      const card = page.getByTestId("timeline-site-map");
      await expect(card.getByTestId("geomap")).toHaveAttribute("data-basemap-status", "relief-fallback");
      await expect(card.getByTestId("geomap-credit")).toContainText("Relieve derivado del DEM PGDA78");
      await expect(card.getByTestId("geomap-credit")).toContainText("Imagen orbital no disponible");
      await expect(page.getByTestId("orbital-view")).toBeVisible();
    });
  });
});

test.describe("Engineer · torre, brújula y visual", () => {
  test("la torre cambia con 0/2/10 m y la explicación precede a la tabla", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/engineer/?s=A&w=W2&h=10&v=nominal&t=3200");
    await waitForData(page);
    const scene = page.getByTestId("terrain-scene");
    await expect(scene.locator("canvas")).toBeVisible({ timeout: 30_000 });
    await expect(scene).toHaveAttribute("data-view", "tower");
    await expect(scene).toHaveAttribute("data-observer-height", "10");
    const explain = page.getByTestId("terrain-explain");
    await expect(explain).toContainText("Desde lo alto de una torre de 10 m en Sitio A, mirando hacia el Sol");
    // La explicación aparece antes que la tabla técnica.
    const ey = (await explain.boundingBox())!.y;
    const ry = (await page.getByTestId("obstacle-readout").boundingBox())!.y;
    expect(ey).toBeLessThan(ry);
    await expect(page.getByTestId("terrain-compass")).toContainText("θ =");
    await page.getByRole("radiogroup", { name: "Altura del observador" }).getByRole("radio", { name: "2 m", exact: true }).click();
    await expect(scene).toHaveAttribute("data-observer-height", "2");
    await expect(explain).toContainText("torre de 2 m");
    await page.getByRole("radiogroup", { name: "Altura del observador" }).getByRole("radio", { name: "0 m", exact: true }).click();
    await expect(scene).toHaveAttribute("data-observer-height", "0");
    await expect(explain).toContainText("Desde el suelo en Sitio A");
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("azimut manual: orientación, origen y relieve que limita la vista (o fin del recorte)", async ({ page }) => {
    await page.goto("/engineer/?s=A&w=W2&h=2&v=nominal&t=3200");
    await waitForData(page);
    await page.getByTestId("terrain-panel").getByRole("radio", { name: "Azimut", exact: true }).click();
    await page.getByTestId("terrain-panel").getByRole("slider", { name: "Azimut" }).fill("60");
    await expect(page.getByTestId("terrain-compass")).toContainText("θ = 60,0°");
    const explain = page.getByTestId("terrain-explain");
    await expect(explain).toContainText("mirando al azimut 60,0°");
    await expect(explain).toContainText("fuera del recorte 3D");
    await expect(page.getByTestId("terrain-scene")).toHaveAttribute("data-view", "tower");
  });
});
