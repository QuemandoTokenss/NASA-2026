import { expect, test } from "./fixtures";
import { core, hm, noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

test.describe("Historia (modo presentación)", () => {
  test("recorre las 7 escenas con teclado y muestra valores del paquete", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/historia/");
    await waitForData(page);
    const r = core.comparisons.find((c: { window_id: string; height_m: number }) => c.window_id === "W2" && c.height_m === 0).criteria.min_longest_dark_hours;
    await expect(page.getByRole("heading", { level: 1 })).toContainText("¿Cuál es mejor?");
    await expect(page.getByText("648 m").first()).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#horizonte/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("El Sol vive pegado al horizonte");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("38 h 40 min").first()).toBeVisible();
    await expect(page.getByText("14 h 40 min").first()).toBeVisible();
    await expect(page.getByRole("img", { name: /racha más larga sin Sol 38 h 40 min/ })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Campo correlacionado +").first()).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("La elección se invierte");
    await expect(page.getByText(hm(r.cases.correlated_plus.regret_B_hours)).first()).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("2/4").first()).toBeVisible();
    await expect(page.getByText("4/5").first()).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("414/414")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/#robustez/);
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("un enlace con #escena abre directamente esa escena", async ({ page }) => {
    await page.goto("/historia/#inversion");
    await waitForData(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("La elección se invierte");
    await page.getByRole("tab", { name: /Escena 1/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("¿Cuál es mejor?");
  });
});
