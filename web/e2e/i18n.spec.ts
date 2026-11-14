import { expect, test } from "@playwright/test";
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

  test("Regret Lab en inglés: recuentos por familia sin probabilidades", async ({ page }) => {
    await page.goto("/regret-lab/?lang=en&w=W2&h=0&v=nominal&c=min_longest_dark_hours");
    await expect(page.getByText("Holds 2/4")).toBeVisible();
    await expect(page.getByText("Holds 4/5")).toBeVisible();
    await expect(page.getByText(/probability of being better/i)).toHaveCount(0);
  });
});
