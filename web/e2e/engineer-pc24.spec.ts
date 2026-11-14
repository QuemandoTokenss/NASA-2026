import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { trackErrors, waitForData } from "./helpers";

/**
 * PC-24 · Engineer: la luz y la sombra de la torre siguen al Sol del motor (no a la mirada) y el relieve
 * regional (PGDA90) lleva la visual hasta la cresta que fija el horizonte. Cuatro casos reproducibles
 * con comprobaciones numéricas de dirección y posición.
 */
const readout = (page: Page) => page.getByTestId("obstacle-readout").evaluate((e) => ({ ...(e as HTMLElement).dataset }));
const scene = (page: Page) => page.getByTestId("terrain-scene").evaluate((e) => ({ ...(e as HTMLElement).dataset }));
const ready = async (page: Page) => {
  await waitForData(page);
  await expect(page.locator("[data-testid=tower-height-control][data-ready=true]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-testid=terrain-scene][data-sun-light]")).toBeVisible({ timeout: 60_000 });
};
const angleDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

test.describe("PC-24 · Engineer · sombra solar y relieve regional", () => {
  test("caso 1 · Sol visible: luz en la dirección del Sol del motor y sombra en sentido opuesto", async ({ page }) => {
    const errors = trackErrors(page);
    // Sitio A · W1 · 2026-12-06 05:20 UTC (t = 3200) · 10 m · superficie nominal.
    await page.goto("/engineer/?s=A&w=W1&h=10&v=nominal&t=3200");
    await ready(page);
    const r = await readout(page);
    expect(r.timeUtc).toBe("2026-12-06T05:20:00Z");
    expect(r.sunLit).toBe("true");
    expect(r.state).not.toBe("4");
    await expect(page.getByTestId("terrain-scene")).toHaveAttribute("data-sun-light", "on");
    const s = await scene(page);
    // La luz de three.js coincide con el azimut y la elevación REALES del Sol del paquete (sin elevación mínima).
    expect(angleDiff(Number(s.lightAz), Number(r.sunAz))).toBeLessThan(0.001);
    expect(Math.abs(Number(s.lightEl) - Number(r.sunEl))).toBeLessThan(0.001);
    expect(Number(s.lightEl)).toBeLessThan(3);
    // Sombra de la torre: opuesta al azimut solar; longitud = altura / tan(elevación).
    expect(angleDiff(Number(s.shadowAz), Number(r.sunAz) + 180)).toBeLessThan(0.001);
    expect(Number(s.shadowLengthM)).toBeCloseTo(10 / Math.tan((Number(r.sunEl) * Math.PI) / 180), 0);
    await expect(page.getByTestId("scene-light")).toContainText("dirección del Sol del motor");
    expect(errors).toEqual([]);
  });

  test("caso 2 · Sol oculto: sin luz directa ni sombra solar, iluminación neutra", async ({ page }) => {
    // Sitio A · W2 · 2027-01-05 05:20 UTC (t = 3200) · 0 m · superficie nominal: el motor da el Sol por tapado.
    await page.goto("/engineer/?s=A&w=W2&h=0&v=nominal&t=3200");
    await ready(page);
    const r = await readout(page);
    expect(r.timeUtc).toBe("2027-01-05T05:20:00Z");
    expect(r.sunLit).toBe("false");
    expect(Number(r.bodyEl)).toBeLessThan(Number(r.engineHorizon));
    const s = await scene(page);
    expect(s.sunLight).toBe("off");
    expect(s.lightAz).toBeUndefined();
    expect(s.shadowAz).toBeUndefined();
    await expect(page.getByTestId("scene-light")).toContainText("luz neutra, sin sombra solar");
    // Superficie sin efemérides compatibles (clon publicado): también luz neutra.
    await page.goto("/engineer/?s=A&w=W1&h=10&v=published_0001&t=3200");
    await ready(page);
    expect((await scene(page)).sunLight).toBe("off");
    await expect(page.getByTestId("scene-light")).toContainText("sin dirección solar calculada");
  });

  test("caso 3 · cambiar la mirada, el azimut manual o la cámara no mueve la sombra; cambiar el instante sí", async ({ page }) => {
    await page.goto("/engineer/?s=A&w=W1&h=10&v=nominal&t=3200");
    await ready(page);
    const before = await scene(page);
    const panel = page.getByTestId("terrain-panel");
    // Mirar a la Tierra.
    await panel.getByRole("radio", { name: "Tierra", exact: true }).click();
    await expect(page.getByTestId("obstacle-readout")).toHaveAttribute("data-mode", "earth");
    await expect(page.locator("[data-testid=tower-height-control][data-ready=true]")).toBeVisible();
    let now = await scene(page);
    expect([now.sunLight, now.lightAz, now.lightEl, now.shadowAz]).toEqual([before.sunLight, before.lightAz, before.lightEl, before.shadowAz]);
    // Azimut manual a 90° y a 250°.
    await panel.getByRole("radio", { name: "Azimut", exact: true }).click();
    for (const az of ["90", "250"]) {
      await panel.getByRole("slider", { name: "Azimut" }).fill(az);
      await expect(page.getByTestId("terrain-compass")).toContainText(`θ = ${az},0°`);
      now = await scene(page);
      expect([now.sunLight, now.lightAz, now.lightEl, now.shadowAz]).toEqual([before.sunLight, before.lightAz, before.lightEl, before.shadowAz]);
    }
    // Orbitar la cámara.
    const box = (await page.locator("[data-testid=terrain-scene] canvas").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 260, box.y + box.height / 2 + 30, { steps: 10 });
    await page.mouse.up();
    now = await scene(page);
    expect(Number(now.frames)).toBeGreaterThan(Number(before.frames));
    expect([now.sunLight, now.lightAz, now.lightEl, now.shadowAz]).toEqual([before.sunLight, before.lightAz, before.lightEl, before.shadowAz]);
    // Cambiar el instante (+1 día) sí mueve el Sol y, con él, la sombra.
    await panel.getByRole("radio", { name: "Sol", exact: true }).click();
    await panel.getByRole("button", { name: "+1 día" }).click();
    await expect(page.getByTestId("obstacle-readout")).toHaveAttribute("data-time-utc", "2026-12-07T05:20:00Z");
    await expect.poll(async () => (await scene(page)).lightAz).not.toBe(before.lightAz);
    const r = await readout(page);
    now = await scene(page);
    if (r.sunLit === "true") expect(angleDiff(Number(now.shadowAz), Number(r.sunAz) + 180)).toBeLessThan(0.001);
  });

  test("caso 4 · cresta regional: el final de la visual, la cresta dibujada y el punto del mapa coinciden", async ({ page }) => {
    const errors = trackErrors(page);
    // Sitio A · W1 · 2026-11-18 08:50 UTC (t = 629) · 10 m · nominal: el Sol es visible y el horizonte lo fija relieve a 8,74 km.
    await page.goto("/engineer/?s=A&w=W1&h=10&v=nominal&t=629");
    await ready(page);
    await expect(page.getByTestId("obstacle-readout")).toHaveAttribute("data-regional", "ready", { timeout: 60_000 });
    const r = await readout(page);
    expect(r.timeUtc).toBe("2026-11-18T08:50:00Z");
    expect(r.insideCrop).toBe("false");
    expect(Number(r.obstacleDistance)).toBe(8740);
    expect(r.regionalBlock).toBe("L0/29_30");
    // El relieve regional dibujado en el punto del motor coincide con la altura que implica el horizonte (cuantización 0,25 m).
    expect(Math.abs(Number(r.regionalDeltaM))).toBeLessThan(0.5);
    // Mapa y 3D usan el mismo punto del motor.
    expect(r.mapPoint).toBe(`${r.obstacleX},${r.obstacleY}`);
    expect(Number(r.mapCoverage)).toBeGreaterThan(1);
    await expect(page.locator("[data-testid=terrain-scene][data-sight-reaches=true]")).toBeVisible();
    const s = await scene(page);
    expect(s.sightEnd).toBe(r.obstacleLocal);
    expect(Number(s.regionalBlocks)).toBeGreaterThan(10);
    // Posición local: distancia horizontal ≈ (R + z)·sin(d/R) y azimut = el de la muestra del motor.
    const [e, n, u] = s.sightEnd!.split(",").map(Number);
    expect(Math.hypot(e, n)).toBeGreaterThan(8700);
    expect(Math.hypot(e, n)).toBeLessThan(8760);
    expect(angleDiff((Math.atan2(e, n) * 180) / Math.PI, Number(r.obstacleAzimuth))).toBeLessThan(0.05);
    // Elevación de la visual desde el remate de la torre (10 m) = horizonte del motor.
    const el = (Math.atan2(u - 10, Math.hypot(e, n)) * 180) / Math.PI;
    expect(Math.abs(el - Number(r.engineHorizon))).toBeLessThan(0.02);
    await expect(page.getByTestId("terrain-conclusion")).toContainText("cresta regional");
    await expect(page.getByTestId("terrain-explain")).toContainText("la visual llega hasta la cresta");
    // Sol visible también aquí: sombra opuesta.
    expect(angleDiff(Number(s.shadowAz), Number(r.sunAz) + 180)).toBeLessThan(0.001);
    expect(errors).toEqual([]);
  });
});
