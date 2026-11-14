import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { core, hm, noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

const summary = (site: string, h: number, v: string) =>
  core.scenario_summaries.find((s: { site_id: string; window_id: string; height_m: number; variant: string }) => s.site_id === site && s.window_id === "W2" && s.height_m === h && s.variant === v).metrics.longest_dark_hours;
const regretB = core.comparisons.find((c: { window_id: string; height_m: number }) => c.window_id === "W2" && c.height_m === 0).criteria.min_longest_dark_hours.cases.correlated_plus.regret_B_hours;

/** Horas mostradas; antes de elegir no se enseña ninguna cifra (devuelve "?"). */
async function hours(page: Page, site: "A" | "B") {
  if ((await page.getByTestId(`demo-card-${site}`).getAttribute("data-revealed")) !== "true") return "?";
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where would you land?");
    await expect(page.getByTestId("demo-subtitle")).toContainText("Your example mission can handle up to 24 hours in a row without sunlight.");
    await expect(page.getByText("Illustrative limit for this demo")).toBeVisible();
    await expect(page.getByText(/14 Dec 2026 – 13 Jan 2027 UTC/)).toBeVisible();
    // Paso 1 · Elegir: antes de elegir no se enseña ninguna cifra, ningún veredicto ni ningún gráfico.
    expect(await hours(page, "A")).toBe("?");
    expect(await hours(page, "B")).toBe("?");
    await expect(page.getByTestId("demo-hours-A")).toHaveCount(0);
    await expect(page.locator("[data-compliance]")).toHaveCount(0);
    await expect(page.getByTestId("demo-strips-panel")).toHaveCount(0);
    await expect(page.getByTestId("demo-regret")).toHaveCount(0);
    await expect(page.getByRole("listitem").filter({ hasText: "1 · Choose" })).toHaveAttribute("aria-current", "step");
    // Salidas de cada pantalla: explicación en lenguaje llano y evidencia.
    await expect(page.getByTestId("demo-evidence")).toHaveAttribute("href", /\/evidencia\/$/);
    await page.getByTestId("demo-why").click();
    await expect(page.getByTestId("demo-plain-explanation")).toContainText("any mountain in the way can hide it");
    await page.getByTestId("demo-why").click();
    await expect(page.getByTestId("demo-why-panel")).toHaveCount(0);
    // Paso 2 · Descubrir: valores de referencia a 0 m, del paquete.
    await page.getByTestId("demo-card-B").click();
    await expect(page.getByTestId("demo-choice-B")).toHaveText("Your choice");
    await expect(page.getByRole("listitem").filter({ hasText: "2 · Discover" })).toHaveAttribute("aria-current", "step");
    expect(await hours(page, "A")).toBe(hm(summary("A", 0, "nominal")));
    expect(await hours(page, "B")).toBe(hm(summary("B", 0, "nominal")));
    expect(await hours(page, "A")).toBe("38 h 40 min");
    expect(await compliance(page)).toEqual(["exceeds", "meets"]);
    await expect(page.getByTestId("demo-message")).toContainText("Site B stays within the limit");
    await expect(page.getByTestId("demo-best-reference")).toHaveText("With this terrain map it is the better of the two options.");
    await expect(page.getByTestId("demo-strips")).toBeVisible();
    // Paso 3 · Cambiar el terreno: relieve alternativo, misma fecha, altura y elección. El giro es el regret.
    await page.getByRole("button", { name: "Try a different terrain map" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "3 · Change the terrain" })).toHaveAttribute("aria-current", "step");
    await expect(page.getByTestId("demo-scenario")).toContainText("Alternative terrain · team hypothesis");
    await expect(page.getByTestId("demo-scenario")).toContainText("Observer height: 0 m");
    expect(await hours(page, "A")).toBe("32 h 30 min");
    expect(await hours(page, "B")).toBe("49 h");
    expect(await compliance(page)).toEqual(["exceeds", "exceeds"]);
    await expect(page.getByTestId("demo-choice-B")).toBeVisible();
    await expect(page.getByTestId("demo-message")).toContainText(`Keeping B means ${hm(regretB)} more without sunlight than choosing A in this scenario.`);
    await expect(page.getByTestId("demo-message")).toContainText("16 h 30 min");
    await expect(page.getByTestId("demo-both-exceed")).toHaveText("In this test, both sites are over the 24 h limit.");
    await expect(page.getByTestId("demo-regret-value")).toHaveText(hm(regretB));
    await expect(page.getByTestId("demo-regret")).toContainText("the price of having chosen with a terrain map that turned out to be different");
    await expect(page.getByTestId("demo-best-choice")).toHaveText("Best choice with the reference map: Site B · with the alternative map: Site A");
    // «¿Por qué cambió?»: perfil de horizonte del mismo sitio y altura, enlace a Evidencia.
    await page.getByTestId("demo-why").click();
    await expect(page.getByTestId("demo-why-panel").getByRole("link", { name: /Evidence/ })).toBeVisible();
    // Extra: solo cambia la altura.
    await page.getByRole("button", { name: "Raise the observer to 2 m" }).click();
    await expect(page.getByTestId("demo-extra-step")).toHaveAttribute("aria-current", "step");
    await expect(page.getByTestId("demo-regret")).toHaveCount(0);
    await expect(page.getByTestId("demo-both-exceed")).toHaveCount(0);
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
    expect(await hours(page, "A")).toBe("?");
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("camino A: la interfaz responde a la elección del juez", async ({ page }) => {
    await page.goto("/historia/");
    await waitForData(page);
    await page.getByTestId("demo-card-A").click();
    await expect(page.getByTestId("demo-message")).toContainText("Sitio A supera el límite");
    await expect(page.getByTestId("demo-both-exceed")).toHaveCount(0);
    await expect(page.getByTestId("demo-best-reference")).toHaveText("Con este mapa del terreno, Sitio B era mejor opción.");
    await page.getByRole("button", { name: "Prueba otro mapa del terreno" }).click();
    await expect(page.getByTestId("demo-choice-A")).toBeVisible();
    await expect(page.getByTestId("demo-message")).toContainText("Tu elección, A, ahora queda por delante de B (32 h 30 min frente a 49 h), pero aun así supera las 24 h.");
    await expect(page.getByTestId("demo-both-exceed")).toHaveText("En esta prueba, ambos sitios superan el límite de 24 h.");
    await expect(page.getByTestId("demo-scenario")).toContainText("hipótesis del equipo");
    // Quien elige A no paga regret, pero ve el del sitio que era mejor con el primer mapa (valores del motor).
    await expect(page.getByTestId("demo-regret-value")).toHaveText("0 h");
    await expect(page.getByTestId("demo-regret")).toContainText(`Quien se hubiera quedado con Sitio B pagaría ${hm(regretB)} de más sin Sol.`);
    await expect(page.getByTestId("demo-best-choice")).toHaveText("Mejor elección con el mapa de referencia: Sitio B · con el mapa alternativo: Sitio A");
    await page.getByRole("button", { name: "Eleva el observador a 2 m" }).click();
    await expect(page.getByTestId("demo-message")).toContainText("Los dos sitios cumplen el límite de Sol a 2 m en esta prueba.");
    await page.getByRole("button", { name: "Reiniciar demo" }).click();
    await expect(page.getByTestId("landing-demo")).toHaveAttribute("data-phase", "0");
  });

  test("teclado: las tarjetas A/B son un grupo de opciones (flechas, Tab, Enter, Espacio) y el resultado se anuncia aparte", async ({ page }) => {
    await page.goto("/historia/");
    await waitForData(page);
    const a = page.getByTestId("demo-card-A");
    const b = page.getByTestId("demo-card-B");
    // Sin elección, Tab entra por la primera tarjeta; la otra queda fuera del orden de tabulación.
    await expect(a).toHaveAttribute("tabindex", "0");
    await expect(b).toHaveAttribute("tabindex", "-1");
    await a.focus();
    await page.keyboard.press("ArrowRight");
    await expect(b).toBeFocused();
    await expect(b).toHaveAttribute("aria-checked", "true");
    await expect(a).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("landing-demo")).toHaveAttribute("data-phase", "1");
    await page.keyboard.press("ArrowLeft");
    await expect(a).toBeFocused();
    await expect(a).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowDown");
    await expect(b).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(a).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(b).toBeFocused();
    // Las flechas no sacan de la demo (la presentación de 7 escenas no las recibe).
    await expect(page.getByTestId("landing-demo")).toBeVisible();
    // Tab sale del grupo hacia la acción principal; Mayús+Tab vuelve a la tarjeta elegida.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Prueba otro mapa del terreno" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(b).toBeFocused();
    // El resultado es una región viva de solo texto: los botones quedan fuera.
    const result = page.getByTestId("demo-result");
    await expect(result).toHaveAttribute("aria-live", "polite");
    await expect(result).toHaveAttribute("aria-atomic", "true");
    await expect(page.getByTestId("landing-demo").locator("[aria-live] button, [role=status] button")).toHaveCount(0);
    await expect(page.getByTestId("landing-demo").locator("[aria-live], [role=status]")).toHaveCount(1);
    await expect(result).toContainText("Sitio B cumple el límite");
    // Enter avanza de paso y el foco sigue en la acción principal, que cambia de etiqueta.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("landing-demo")).toHaveAttribute("data-phase", "2");
    await expect(page.getByRole("button", { name: "Eleva el observador a 2 m" })).toBeFocused();
    await expect(result).toContainText("Conservar B supone 16 h 30 min más sin Sol que elegir A en este escenario.");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("landing-demo")).toHaveAttribute("data-phase", "3");
    await expect(page.getByRole("button", { name: "Reiniciar demo" })).toBeFocused();
    // Al reiniciar, el foco vuelve a la primera tarjeta; Espacio y Enter eligen.
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("landing-demo")).toHaveAttribute("data-phase", "0");
    await expect(a).toBeFocused();
    await page.keyboard.press("Space");
    await expect(a).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("landing-demo")).toHaveAttribute("data-phase", "1");
    await page.getByTestId("demo-reset").click();
    await expect(a).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(a).toHaveAttribute("aria-checked", "true");
    // Clic directo en la otra tarjeta.
    await b.click();
    await expect(b).toHaveAttribute("aria-checked", "true");
    await expect(b).toHaveAttribute("tabindex", "0");
    await expect(a).toHaveAttribute("tabindex", "-1");
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
    const button = await page.getByRole("button", { name: "Try a different terrain map" }).boundingBox();
    expect(button!.y).toBeGreaterThan(cards!.y + cards!.height);
    expect(button!.y - (cards!.y + cards!.height)).toBeLessThan(260);
    await noHorizontalOverflow(page);
  });
});
