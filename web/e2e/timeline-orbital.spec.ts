import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./fixtures";
import { noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

const OUT = join(import.meta.dirname, "..", "public", "data", "site-regret", "v0.1");
const chunk = (p: string) => JSON.parse(readFileSync(join(OUT, ...p.split("/")), "utf8"));
const es = (v: number, d: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const STATE_ES = ["Ninguno", "Solo Sol", "Solo Tierra", "Sol y Tierra", "Desconocido"];

test.describe("Timeline · geometría Sol–Tierra–Luna (bloque B)", () => {
  test("la vista orbital usa las efemérides del paquete y sigue al instante seleccionado", async ({ page }) => {
    const errors = trackErrors(page);
    const t = 1200;
    await page.goto(`/timeline/?s=A&w=W2&h=0&v=nominal&t=${t}`);
    await waitForData(page);
    const view = page.getByTestId("orbital-view");
    await expect(view).toHaveAttribute("data-time-index", String(t));
    const eph = chunk("ephemerides/W2_A_h0.json");
    await expect(view).toContainText(`az ${es(eph.series.bodies.SUN.azimuth_deg[t], 2)}°`);
    await expect(view).toContainText(`el ${es(eph.series.bodies.EARTH.elevation_deg[t], 3)}°`);
    await expect(view).toContainText(`${es(Math.round(eph.series.bodies.EARTH.range_km[t]), 0)} km`);
    // Estado = código del motor para la superficie seleccionada en ese intervalo.
    const rows = chunk("scenarios/W2_h0.json").rows;
    const code = rows.find((r: { site_id: string; variant: string }) => r.site_id === "A" && r.variant === "nominal").state_codes[t];
    await expect(page.getByTestId("orbital-state")).toContainText(STATE_ES[code]);
    // El reproductor mueve el mismo instante.
    await page.getByRole("button", { name: "Avanzar 1 día" }).click();
    await expect(view).toHaveAttribute("data-time-index", String(t + 144));
    await expect(view).toContainText(`az ${es(eph.series.bodies.SUN.azimuth_deg[t + 144], 2)}°`);
    await expect(page).toHaveURL(new RegExp(`t=${t + 144}`));
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("con una superficie alternativa la vista orbital se mantiene y el cielo local no mezcla trayectorias", async ({ page }) => {
    await page.goto("/timeline/?s=B&w=W1&h=2&v=published_0003&t=300");
    await waitForData(page);
    await expect(page.getByTestId("orbital-view")).toBeVisible();
    await expect(page.getByTestId("orbital-state")).toContainText("Clon publicado 0003");
    await expect(page.getByText("Con superficies alternativas solo se dibuja su horizonte")).toBeVisible();
  });
});
