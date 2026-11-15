/**
 * PC-28 · Regret Lab: estados de resultado, criterios alternativos, evolución con la altura,
 * auditoría de 0 m y demostración guiada que nunca explica otra configuración.
 */
import { expect, test } from "./fixtures";
import { noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

test.describe("PC-28 · Regret Lab", () => {
  test("W1/W2 a 0/2/10 m: el veredicto distingue empate sin oscuridad de diferencia relevante", async ({ page }) => {
    const errors = trackErrors(page);
    const expected: Record<string, string> = { "W1|0": "tie_no_dark", "W1|2": "tie_no_dark", "W1|10": "tie_no_dark", "W2|0": "decisive", "W2|2": "tie_no_dark", "W2|10": "tie_no_dark" };
    for (const [key, kind] of Object.entries(expected)) {
      const [w, h] = key.split("|");
      await page.goto(`/regret-lab/?w=${w}&h=${h}&v=nominal&c=min_longest_dark_hours`);
      await waitForData(page);
      await expect(page.getByTestId("regret-verdict")).toHaveAttribute("data-kind", kind);
      if (kind === "tie_no_dark") {
        await expect(page.getByTestId("regret-verdict-text")).toContainText("no detectó oscuridad en las 720 h analizadas");
        await expect(page.getByTestId("regret-verdict-text")).toContainText("no garantiza iluminación permanente");
        await expect(page.getByTestId("regret-verdict-hint")).toContainText("Más horas con Tierra");
      }
      await expect(page.getByTestId("regret-criterion-max_sun_hours")).toHaveAttribute("data-kind", kind === "decisive" ? "decisive" : "tie_full");
    }
    expect(errors).toEqual([]);
  });

  test("con el criterio empatado, la Tierra visible diferencia A y B solo si el usuario lo elige", async ({ page }) => {
    await page.goto("/regret-lab/?w=W2&h=2&v=nominal&c=min_longest_dark_hours");
    await waitForData(page);
    // La selección no cambia sola.
    await expect(page).toHaveURL(/c=min_longest_dark_hours/);
    const earth = page.getByTestId("regret-criterion-max_dte_hours");
    await expect(earth).toContainText("398 h 40 min");
    await expect(earth).toContainText("398 h");
    await earth.click();
    await expect(page).toHaveURL(/c=max_dte_hours/);
    await expect(page.getByTestId("regret-verdict")).toHaveAttribute("data-kind", "decisive");
    await expect(page.getByTestId("regret-verdict-text")).toContainText("gana Sitio A por 40 min");
    await expect(page.getByTestId("regret-kpi-choice")).toContainText("Sitio A");
  });

  test("evolución con la altura: el ganador solo cambia entre 0 y 0,5 m; avisos de la auditoría", async ({ page }) => {
    await page.goto("/regret-lab/?w=W2&h=0&v=nominal&c=min_longest_dark_hours");
    await waitForData(page);
    await expect(page.getByTestId("regret-height-changes")).toHaveText(/0 → 0,5 m: Sitio B → Empate/);
    await expect(page.getByTestId("regret-audit-0m")).toContainText("33 h 50 min – 54 h 10 min");
    await expect(page.getByTestId("regret-audit-0m")).toContainText("0 h – 26 h 10 min");
    await expect(page.getByTestId("regret-audit-0m")).toContainText("0,27 m");
    await page.getByTestId("regret-height-2").click();
    await expect(page).toHaveURL(/h=2/);
    await expect(page.getByTestId("regret-audit-margin")).toContainText("1,37°");
    await expect(page.getByTestId("regret-audit-margin")).toContainText("0,90°");
    await expect(page.getByTestId("regret-audit-0m")).toHaveCount(0);
  });

  test("demostración: al cambiar la altura se pausa en vez de explicar otra configuración; vuelve y cierra", async ({ page }) => {
    await page.goto("/regret-lab/?w=W2&h=0&v=nominal&c=min_longest_dark_hours#demo");
    await waitForData(page);
    const guide = page.getByRole("region", { name: "Caso demostrativo guiado" });
    await expect(guide.getByTestId("demo-text")).toContainText("38 h 40 min");
    await page.getByTestId("regret-height-10").click();
    await expect(page).toHaveURL(/h=10/);
    await expect(guide.getByTestId("demo-text")).toHaveCount(0);
    await expect(guide.getByTestId("demo-paused")).toContainText("W2 · 0 m");
    await expect(guide.getByTestId("demo-paused")).toContainText("W2 · 10 m");
    await expect(guide.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    await guide.getByRole("button", { name: /Volver al caso/ }).click();
    await expect(page).toHaveURL(/h=0/);
    await expect(guide.getByTestId("demo-text")).toContainText("38 h 40 min");
    // Paso 3 activa una superficie; elegir otra pausa también.
    await guide.getByRole("button", { name: "Siguiente" }).click();
    await guide.getByRole("button", { name: "Siguiente" }).click();
    await expect(page).toHaveURL(/v=correlated_plus/);
    await page.getByRole("button", { name: /Clon publicado 0001/ }).first().click();
    await expect(guide.getByTestId("demo-paused")).toBeVisible();
    await guide.getByRole("button", { name: /Cerrar la demostración/ }).click();
    await expect(guide).toHaveCount(0);
    await expect(page).toHaveURL(/v=published_0001/);
  });

  test("inglés y móvil: mismo veredicto, sin desbordamiento horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/regret-lab/?w=W2&h=2&v=nominal&c=min_longest_dark_hours&lang=en");
    await waitForData(page);
    await expect(page.getByTestId("regret-verdict-kind")).toHaveText(/Tie · no darkness detected/i);
    await expect(page.getByTestId("regret-verdict-hint")).toContainText("do tell them apart");
    await noHorizontalOverflow(page);
  });
});
