import { expect, test } from "./fixtures";
import { noHorizontalOverflow, trackErrors } from "./helpers";

test.describe("Idioma (ES/EN)", () => {
  test("el selector cambia a inglés, conserva la selección y persiste al recargar", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/comparador/?w=W2&h=0&v=nominal&c=min_longest_dark_hours");
    await expect(page.getByText(/Mejor resultado:\s*Sitio B/)).toBeVisible();
    await page.getByRole("button", { name: "English" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1, name: "Compare A vs B" })).toBeVisible();
    await expect(page.getByText(/Best result:\s*Site B/)).toBeVisible();
    await expect(page.getByText("38 h 40 min").first()).toBeVisible();
    await expect(page).toHaveURL(/c=min_longest_dark_hours/);
    await page.reload();
    await expect(page.getByText(/Best result:\s*Site B/)).toBeVisible();
    await page.getByRole("button", { name: "Español" }).first().click();
    await expect(page.getByText(/Mejor resultado:\s*Sitio B/)).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    expect(errors).toEqual([]);
  });

  test("?lang=en abre la historia en inglés con los mismos datos", async ({ page }) => {
    await page.goto("/historia/?lang=en#inversion");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The choice flips");
    await expect(page.getByText("16 h 30 min").first()).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Robustness: counts, not probabilities");
    await noHorizontalOverflow(page);
  });

  test("un enlace con ?lang=en sigue en inglés al navegar y recargar; ?lang=es vuelve al español", async ({ page }) => {
    await page.goto("/?lang=en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.getByRole("link", { name: "Try the mission" }).click();
    await expect(page).toHaveURL(/\/historia\/(\?|$)/); // la selección se añade a la URL ~180 ms después
    await page.getByTestId("demo-evidence").click();
    await expect(page).toHaveURL(/\/evidencia\/(\?|$)/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText("Scientific evidence", { exact: true }).first()).toBeVisible();
    // La URL explícita manda sobre la preferencia guardada y la sustituye.
    await page.goto("/?lang=es");
    await expect(page.getByRole("link", { name: "Probar la misión" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    // El HTML estático ya está en español: se espera a que la página hidrate y guarde la preferencia.
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("site-regret-lang"))).toBe("es");
    await page.goto("/evidencia/");
    await expect(page.getByText("Evidencia científica", { exact: true }).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    // Un valor no válido no cambia la preferencia.
    await page.goto("/?lang=en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.goto("/?lang=fr");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("Regret Lab en inglés: recuentos por familia sin probabilidades", async ({ page }) => {
    await page.goto("/regret-lab/?lang=en&w=W2&h=0&v=nominal&c=min_longest_dark_hours");
    await expect(page.getByText("Holds 2/4")).toBeVisible();
    await expect(page.getByText("Holds 4/5")).toBeVisible();
    await expect(page.getByText(/probability of being better/i)).toHaveCount(0);
  });
});
