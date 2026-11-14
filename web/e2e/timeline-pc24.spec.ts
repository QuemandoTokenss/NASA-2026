import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

const URL_NOMINAL = "/timeline/?s=A&w=W2&h=0&v=nominal&t=3200";
const box = async (page: Page, id: string) => (await page.getByTestId(id).boundingBox())!;
const ready = (page: Page) => expect(page.getByTestId("timeline-metrics").getByRole("heading", { name: "Métricas del periodo" })).toBeVisible();

test.describe("PC-24 · Timeline: orden de lectura del escenario", () => {
  test("escritorio: barra → reproductor → gráfico con leyenda + columna Sitio → Instante → Métricas → Eventos", async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(URL_NOMINAL);
    await waitForData(page);
    await ready(page);
    await expect(page.getByTestId("timeline-events").getByRole("heading")).toBeVisible();
    // Una sola instancia de cada panel.
    for (const h of ["Instante seleccionado", "Métricas del periodo", "Salidas y puestas (nominal)", /^Elevación sobre el horizonte/, /^Geometría Sol–Tierra–Luna/, /^Cielo local del observador/])
      await expect(page.getByRole("heading", { name: h })).toHaveCount(1);
    await expect(page.getByTestId("timeline-site-map")).toHaveCount(1);
    const player = (await page.getByRole("button", { name: "Reproducir" }).boundingBox())!;
    const chart = await box(page, "timeline-chart");
    const physical = await box(page, "timeline-physical");
    const site = await box(page, "timeline-site");
    const instant = await box(page, "timeline-instant");
    const metrics = await box(page, "timeline-metrics");
    const events = await box(page, "timeline-events");
    expect(player.y).toBeLessThan(chart.y);
    // Zona principal a la izquierda: el gráfico y, debajo, la geometría.
    expect(chart.y + chart.height).toBeLessThanOrEqual(physical.y);
    expect(chart.x + chart.width).toBeLessThanOrEqual(site.x);
    // Columna de lectura alineada con el gráfico y en el orden pedido.
    expect(Math.abs(site.y - chart.y)).toBeLessThanOrEqual(1);
    for (const b of [instant, metrics, events]) expect(Math.abs(b.x - site.x)).toBeLessThanOrEqual(1);
    expect(site.y).toBeLessThan(instant.y);
    expect(instant.y).toBeLessThan(metrics.y);
    expect(metrics.y).toBeLessThan(events.y);
    // La leyenda va dentro del panel del gráfico, no en un panel aparte.
    await expect(page.getByRole("heading", { name: "Leyenda" })).toHaveCount(0);
    const chartPanel = page.getByTestId("timeline-chart");
    await expect(chartPanel.getByText("Elevación del Sol", { exact: true })).toBeVisible();
    await expect(chartPanel.getByTestId("timeline-legend")).toContainText("Sol y Tierra");
    await expect(chartPanel.getByTestId("timeline-legend")).toContainText("Desconocido");
    await noHorizontalOverflow(page);
    // A 1280×720 la barra no se parte y el gráfico y la ficha del sitio asoman en la primera pantalla.
    await page.setViewportSize({ width: 1280, height: 720 });
    expect((await box(page, "timeline-chart")).y).toBeLessThan(560);
    expect((await box(page, "timeline-site")).y).toBeLessThan(560);
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("móvil: el instante va justo tras el reproductor, sin paneles duplicados", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(URL_NOMINAL);
    await waitForData(page);
    await ready(page);
    await expect(page.getByTestId("timeline-events").getByRole("heading")).toBeVisible();
    let prev = (await page.getByRole("button", { name: "Reproducir" }).boundingBox())!.y;
    for (const id of ["timeline-instant", "timeline-chart", "timeline-physical", "timeline-site", "timeline-metrics", "timeline-events"]) {
      const b = await box(page, id);
      expect(b.y, id).toBeGreaterThan(prev);
      prev = b.y;
    }
    await expect(page.getByRole("heading", { name: "Instante seleccionado" })).toHaveCount(1);
    await expect(page.getByTestId("timeline-site-map")).toHaveCount(1);
    await noHorizontalOverflow(page);
  });

  test("gráfico e instante cambian juntos; eventos de diez minutos, reproducción, A/B y alturas", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(URL_NOMINAL);
    await waitForData(page);
    await ready(page);
    const instant = page.getByTestId("timeline-instant");
    const first = "05 ene 2027, 05:20 UTC → 05 ene 2027, 05:30 UTC";
    await expect(instant).toContainText(first);
    // Pulsar en el gráfico mueve a la vez su cursor, la lectura del instante y la vista orbital.
    const svg = page.getByRole("img", { name: /^Elevación nominal de Sol y Tierra/ });
    const cursorX = () => svg.locator("g[pointer-events=none] line").getAttribute("x1");
    const before = await cursorX();
    const b = (await svg.boundingBox())!;
    await page.mouse.click(b.x + b.width * 0.3, b.y + b.height * 0.5);
    await expect.poll(cursorX).not.toBe(before);
    await expect(instant).not.toContainText(first);
    await expect(page.getByTestId("orbital-view")).not.toHaveAttribute("data-time-index", "3200");
    // Un evento sitúa el cursor en el inicio de su intervalo de diez minutos.
    const ev = page.getByTestId("timeline-events").getByRole("listitem").first().getByRole("button");
    await expect(ev).toContainText("05 ene 2027, 03:20 UTC – 03:30 UTC");
    await ev.click();
    await expect(instant).toContainText("05 ene 2027, 03:20 UTC → 05 ene 2027, 03:30 UTC");
    await expect(page.getByTestId("orbital-view")).toHaveAttribute("data-time-index", "3188");
    // La reproducción avanza el instante en la columna de lectura.
    await page.getByRole("button", { name: "Reproducir" }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Pausar" }).click();
    await expect(instant).not.toContainText("05 ene 2027, 03:20 UTC → 05 ene 2027, 03:30 UTC");
    // A/B y alturas.
    await page.getByRole("button", { name: /Cambiar a sitio B/ }).click();
    await expect(page.getByRole("heading", { name: /^Elevación sobre el horizonte · Sitio B/ })).toBeVisible();
    await expect(page.getByTestId("timeline-site")).toContainText("Connecting Ridge · ROI 6");
    for (const h of ["2", "10"]) {
      await page.getByRole("radiogroup", { name: "Altura del observador" }).getByRole("radio", { name: `${h} m`, exact: true }).click();
      await expect(page.getByRole("heading", { name: new RegExp(`^Cielo local del observador · Sitio B · ${h} m`) })).toBeVisible();
      await expect(page.getByRole("img", { name: /^Elevación nominal de Sol y Tierra/ })).toBeVisible();
    }
  });

  test("superficie alternativa: sin curvas ni eventos, con estados, métricas e instante", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/timeline/?s=B&w=W1&h=2&v=published_0003&t=300");
    await waitForData(page);
    await ready(page);
    const chartPanel = page.getByTestId("timeline-chart");
    await expect(chartPanel.getByText("Sin curvas para esta superficie")).toBeVisible();
    await expect(chartPanel.getByText("Elevación del Sol", { exact: true })).toHaveCount(0);
    await expect(chartPanel.getByRole("img", { name: /Franjas temporales/ })).toBeVisible();
    await expect(chartPanel.getByTestId("timeline-legend")).toContainText("Sol y Tierra");
    await expect(page.getByRole("heading", { name: "Salidas y puestas (nominal)" })).toHaveCount(0);
    await expect(page.getByTestId("timeline-events")).toContainText("Eventos y curvas solo nominales");
    await expect(page.getByTestId("timeline-instant")).toContainText("16 nov 2026, 02:00 UTC → 16 nov 2026, 02:10 UTC");
    await noHorizontalOverflow(page);
  });
});
