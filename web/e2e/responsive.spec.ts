import { expect, test } from "@playwright/test";
import { ROUTES, noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

test.describe("móvil (375 px)", () => {
  for (const r of ROUTES) {
    test(`${r} sin desbordamiento horizontal`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`${r}?w=W2&h=0&v=nominal&c=min_longest_dark_hours`);
      await waitForData(page);
      await page.waitForTimeout(1500);
      await noHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  }

  test("menú móvil abre, navega y se cierra", async ({ page }) => {
    await page.goto("/");
    await waitForData(page);
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const menu = page.locator("#menu-movil");
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: /Timeline/ }).click();
    await expect(page).toHaveURL(/\/timeline\//);
    await expect(menu).toHaveCount(0);
  });
});
