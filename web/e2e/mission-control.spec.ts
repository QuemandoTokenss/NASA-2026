import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./fixtures";
import { noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

const manifest = JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "derived", "terrain", "manifest.json"), "utf8"));

test.describe("Dashboard · Mission Control, Evidencia e Historia (bloque E)", () => {
  test("el Dashboard muestra el mapa real y el estado del escenario que se conserva al navegar", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/?s=B&w=W2&h=0&v=published_0001&c=min_longest_dark_hours");
    await waitForData(page);
    await expect(page.getByTestId("hero-map").getByTestId("geomap")).toBeVisible();
    await expect(page.getByText("Ilustración", { exact: true })).toHaveCount(0);
    const mc = page.getByTestId("mission-control");
    await expect(page.getByTestId("mission-scenario")).toContainText("Clon publicado 0001");
    await expect(mc).toContainText(`${manifest.ensemble.members.length} clones PGDA78 verificados`);
    await mc.getByRole("link", { name: /Regret Lab/ }).click();
    await expect(page).toHaveURL(/\/regret-lab\/\?.*s=B.*w=W2.*h=0.*v=published_0001.*c=min_longest_dark_hours/);
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("Evidencia enlaza cada clon con su recorte, hash y comprobación en A/B", async ({ page }) => {
    await page.goto("/evidencia/#geo-pgda78-site01-clone_0003");
    await waitForData(page);
    const m = manifest.ensemble.members.find((x: { variant: string }) => x.variant === "published_0003");
    const row = page.getByTestId("evidence-clone-published_0003");
    await expect(row).toContainText(m.sha256);
    await expect(row).toContainText("clones/clone_0003.f32");
  });

  test("la presentación de Historia abre con el mapa real", async ({ page }) => {
    await page.goto("/historia/#pregunta");
    await waitForData(page);
    await expect(page.getByTestId("geomap").first()).toBeVisible();
  });
});
