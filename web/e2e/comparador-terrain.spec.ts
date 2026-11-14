import { expect, test } from "./fixtures";
import { core, noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

const es = (v: number, d: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const site = (id: string) => core.sites.find((s: { id: string }) => s.id === id);

test.describe("Comparador · terreno real del par (bloque C)", () => {
  test("mapa del par con teselas reales, recortes A/B y lecturas del DEM = paquete", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/comparador/?w=W2&h=0&v=nominal&c=min_longest_dark_hours");
    await waitForData(page);
    const pt = page.getByTestId("pair-terrain");
    await expect(pt.getByTestId("geomap")).toBeVisible();
    await expect(page.getByTestId("site-crop-A")).toBeVisible();
    await expect(page.getByTestId("site-crop-B")).toBeVisible();
    const table = page.getByTestId("pair-terrain-table");
    // Altura y pendiente leídas de los recortes = valores del paquete (sites[]).
    await expect(table).toContainText(`${es(site("A").nominal_height_m, 3)} m`);
    await expect(table).toContainText(`${es(site("B").nominal_height_m, 3)} m`);
    await expect(table).toContainText(`${es(site("A").values.slp, 3)}°`);
    await expect(table).toContainText(`${es(site("B").values.slp, 3)}°`);
    // Δ horizonte A − B con el mismo componente que Regret Lab.
    await expect(page.getByTestId("horizon-ab-delta")).toContainText("comparables");
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("la capa sobre el relieve se puede cambiar sin perder la selección", async ({ page }) => {
    await page.goto("/comparador/?w=W1&h=10&v=published_0001&c=max_sun_hours");
    await waitForData(page);
    await page.getByRole("radio", { name: "Retornos LOLA" }).click();
    await expect(page.getByRole("radio", { name: "Retornos LOLA" })).toHaveAttribute("aria-checked", "true");
    await expect(page).toHaveURL(/w=W1&h=10&v=published_0001&c=max_sun_hours/);
  });
});
