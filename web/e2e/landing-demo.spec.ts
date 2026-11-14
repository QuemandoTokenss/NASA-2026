import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { core, hm, noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

const summary = (site: string, h: number, v: string) =>
  core.scenario_summaries.find((s: { site_id: string; window_id: string; height_m: number; variant: string }) => s.site_id === site && s.window_id === "W2" && s.height_m === h && s.variant === v).metrics.longest_dark_hours;
const regretB = core.comparisons.find((c: { window_id: string; height_m: number }) => c.window_id === "W2" && c.height_m === 0).criteria.min_longest_dark_hours.cases.correlated_plus.regret_B_hours;

async function hours(page: Page, site: "A" | "B") {
  return (await page.getByTestId(`demo-hours-${site}`).textContent())?.trim();
}
async function compliance(page: Page) {
  return Promise.all((["A", "B"] as const).map((s) => page.getByTestId(`demo-card-${s}`).locator("[data-compliance]").getAttribute("data-compliance")));
}

test.describe("Historia · demo interactiva «Where would you land?»", () => {
  test("en inglés: elegir B, cambiar el terreno y elevar a 2 m (B → ninguno → ambos)", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/historia/?lang=en");
    await waitForData(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your mission can handle 24 hours without sunlight. Where would you land?");
    await expect(page.getByText("illustrative limit for this demo")).toBeVisible();
    await expect(page.getByText(/14 Dec 2026 – 13 Jan 2027 UTC/)).toBeVisible();
    // Paso 1: valores de referencia a 0 m, del paquete.
    expect(await hours(page, "A")).toBe(hm(summary("A", 0, "nominal")));
    expect(await hours(page, "B")).toBe(hm(summary("B", 0, "nominal")));
    expect(await hours(page, "A")).toBe("38 h 40 min");
    expect(await compliance(page)).toEqual(["exceeds", "meets"]);
    await page.getByTestId("demo-card-B").click();
    await expect(page.getByTestId("demo-choice-B")).toHaveText("Your choice");
    await expect(page.getByTestId("demo-message")).toContainText("Site B stays within the limit");
    // Paso 2: relieve alternativo, misma fecha, altura y elección.
    await page.getByRole("button", { name: "Test another terrain model" }).click();
    await expect(page.getByTestId("demo-scenario")).toContainText("Alternative terrain · team hypothesis");
    await expect(page.getByTestId("demo-scenario")).toContainText("Observer height: 0 m");
    expect(await hours(page, "A")).toBe("32 h 30 min");
    expect(await hours(page, "B")).toBe("49 h");
    expect(await compliance(page)).toEqual(["exceeds", "exceeds"]);
    await expect(page.getByTestId("demo-choice-B")).toBeVisible();
    await expect(page.getByTestId("demo-message")).toContainText(`Keeping B means ${hm(regretB)} more without sunlight than choosing A in this scenario.`);
    await expect(page.getByTestId("demo-message")).toContainText("16 h 30 min");
    // «¿Por qué cambió?»: perfil de horizonte del mismo sitio y altura, enlace a Evidencia.
    await page.getByTestId("demo-why").click();
    await expect(page.getByTestId("demo-why-panel").getByRole("link", { name: /Evidence/ })).toBeVisible();
    // Paso 3: solo cambia la altura.
    await page.getByRole("button", { name: "Raise the observer to 2 m" }).click();
    await expect(page.getByTestId("demo-scenario")).toContainText("Alternative terrain · team hypothesis");
    await expect(page.getByTestId("demo-scenario")).toContainText("Observer height: 2 m");
    expect(await hours(page, "A")).toBe("0 h");
    expect(await hours(page, "B")).toBe("0 h");
    expect(await compliance(page)).toEqual(["meets", "meets"]);
    await expect(page.getByTestId("demo-choice-B")).toBeVisible();
    await expect(page.getByTestId("demo-message")).toContainText("Both sites meet the sunlight limit at 2 m in this test. Earth visibility still comes and goes.");
    await expect(page.getByTestId("demo-surfaces")).toContainText("10 of the 10 terrain scenarios evaluated");
    await expect(page.getByTestId("demo-strips")).toBeVisible();
    // Reiniciar.
    await page.getByRole("button", { name: "Restart demo" }).click();
    await expect(page.getByTestId("landing-demo")).toHaveAttribute("data-phase", "0");
    await expect(page.getByTestId("demo-choice-B")).toHaveCount(0);
    expect(await hours(page, "A")).toBe("38 h 40 min");
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("camino A: la interfaz responde a la elección del juez", async ({ page }) => {
    await page.goto("/historia/");
    await waitForData(page);
    await page.getByTestId("demo-card-A").click();
    await expect(page.getByTestId("demo-message")).toContainText("Sitio A supera el límite");
    await page.getByRole("button", { name: "Prueba otro modelo del terreno" }).click();
    await expect(page.getByTestId("demo-choice-A")).toBeVisible();
    await expect(page.getByTestId("demo-message")).toContainText("Tu elección, A, ahora queda por delante de B (32 h 30 min frente a 49 h), pero aun así supera las 24 h.");
    await page.getByRole("button", { name: "Eleva el observador a 2 m" }).click();
    await expect(page.getByTestId("demo-message")).toContainText("Los dos sitios cumplen el límite de Sol a 2 m en esta prueba.");
    await page.getByRole("button", { name: "Reiniciar demo" }).click();
    await expect(page.getByTestId("landing-demo")).toHaveAttribute("data-phase", "0");
  });

  test("la presentación completa sigue accesible y vuelve a la demo", async ({ page }) => {
    await page.goto("/historia/?lang=en");
    await waitForData(page);
    await page.getByTestId("demo-full-presentation").click();
    await expect(page).toHaveURL(/#pregunta/);
    await expect(page.getByRole("tab", { name: /Scene 1/ })).toBeVisible();
    await page.getByTestId("deck-back-to-demo").click();
    await expect(page.getByTestId("landing-demo")).toBeVisible();
  });

  test("móvil: el botón principal queda junto al resultado", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/historia/?lang=en");
    await waitForData(page);
    await page.getByTestId("demo-card-B").click();
    const cards = await page.getByRole("radiogroup", { name: "Where would you land?" }).boundingBox();
    const button = await page.getByRole("button", { name: "Test another terrain model" }).boundingBox();
    expect(button!.y).toBeGreaterThan(cards!.y + cards!.height);
    expect(button!.y - (cards!.y + cards!.height)).toBeLessThan(260);
    await noHorizontalOverflow(page);
  });
});
