import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { noHorizontalOverflow, trackErrors, waitForData } from "./helpers";

const URL_NOMINAL = "/timeline/?s=A&w=W2&h=0&v=nominal&t=3200";
const box = async (page: Page, id: string) => (await page.getByTestId(id).boundingBox())!;
const ready = (page: Page) => expect(page.getByTestId("timeline-metrics").getByRole("heading", { name: "Métricas del periodo" })).toBeVisible();

test.describe("PC-24 · Timeline: orden de lectura del escenario", () => {
  for (const [w, h] of [
    [1440, 900],
    [1280, 720],
  ] as const)
    test(`escritorio ${w}×${h}: reproductor → geometría y cielo local juntos → gráfico; columna Sitio → Instante → Métricas → Eventos`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.setViewportSize({ width: w, height: h });
      await page.goto(URL_NOMINAL);
      await waitForData(page);
      await ready(page);
      await expect(page.getByTestId("timeline-events").getByRole("heading")).toBeVisible();
      // Una sola instancia de cada panel.
      for (const t of ["Instante seleccionado", "Métricas del periodo", "Salidas y puestas (nominal)", /^Elevación sobre el horizonte/, /^Geometría Sol–Tierra–Luna/, /^Cielo local del observador/])
        await expect(page.getByRole("heading", { name: t })).toHaveCount(1);
      await expect(page.getByTestId("timeline-site-map")).toHaveCount(1);
      const player = (await page.getByRole("button", { name: "Reproducir" }).boundingBox())!;
      const geometry = (await page.getByRole("heading", { name: /^Geometría Sol–Tierra–Luna/ }).boundingBox())!;
      const sky = (await page.getByRole("heading", { name: /^Cielo local del observador/ }).boundingBox())!;
      const physical = await box(page, "timeline-physical");
      const chart = await box(page, "timeline-chart");
      const site = await box(page, "timeline-site");
      const instant = await box(page, "timeline-instant");
      const metrics = await box(page, "timeline-metrics");
      const events = await box(page, "timeline-events");
      // Los dos paneles físicos, uno al lado del otro, son el primer bloque bajo el reproductor.
      expect(player.y).toBeLessThan(physical.y);
      expect(Math.abs(geometry.y - sky.y)).toBeLessThanOrEqual(1);
      expect(geometry.x).toBeLessThan(sky.x);
      expect(physical.y + physical.height).toBeLessThanOrEqual(chart.y);
      expect(chart.x + chart.width).toBeLessThanOrEqual(site.x);
      // Columna de lectura alineada con el primer bloque y en el orden pedido.
      expect(Math.abs(site.y - physical.y)).toBeLessThanOrEqual(1);
      for (const x of [instant, metrics, events]) expect(Math.abs(x.x - site.x)).toBeLessThanOrEqual(1);
      expect(site.y).toBeLessThan(instant.y);
      expect(instant.y).toBeLessThan(metrics.y);
      expect(metrics.y).toBeLessThan(events.y);
      // El orden del código (lectura y teclado) es el visual: físicos antes que el gráfico.
      const domOrder = await page.evaluate(() =>
        ["timeline-physical", "timeline-chart", "timeline-site", "timeline-instant", "timeline-metrics", "timeline-events"].map((id) => {
          const all = [...document.querySelectorAll("[data-testid]")];
          return all.indexOf(document.querySelector(`[data-testid=${id}]`)!);
        }),
      );
      expect(domOrder).toEqual([...domOrder].sort((x, y) => x - y));
      // La leyenda va dentro del panel del gráfico, no en un panel aparte.
      await expect(page.getByRole("heading", { name: "Leyenda" })).toHaveCount(0);
      const chartPanel = page.getByTestId("timeline-chart");
      await expect(chartPanel.getByText("Elevación del Sol", { exact: true })).toBeVisible();
      await expect(chartPanel.getByTestId("timeline-legend")).toContainText("Sol y Tierra");
      await expect(chartPanel.getByTestId("timeline-legend")).toContainText("Desconocido");
      await noHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });

  test("móvil 390 px: Geometría → Cielo local → Elevación, sin paneles duplicados", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(URL_NOMINAL);
    await waitForData(page);
    await ready(page);
    await expect(page.getByTestId("timeline-events").getByRole("heading")).toBeVisible();
    let prev = (await page.getByRole("button", { name: "Reproducir" }).boundingBox())!.y;
    const order = [
      ["geometría", page.getByRole("heading", { name: /^Geometría Sol–Tierra–Luna/ })],
      ["cielo local", page.getByRole("heading", { name: /^Cielo local del observador/ })],
      ["gráfico", page.getByTestId("timeline-chart")],
      ["sitio", page.getByTestId("timeline-site")],
      ["instante", page.getByTestId("timeline-instant")],
      ["métricas", page.getByTestId("timeline-metrics")],
      ["eventos", page.getByTestId("timeline-events")],
    ] as const;
    for (const [name, loc] of order) {
      const y = (await loc.boundingBox())!.y;
      expect(y, name).toBeGreaterThan(prev);
      prev = y;
    }
    await expect(page.getByRole("heading", { name: "Instante seleccionado" })).toHaveCount(1);
    await expect(page.getByTestId("timeline-site-map")).toHaveCount(1);
    await noHorizontalOverflow(page);
  });

  test("mover el tiempo actualiza a la vez la geometría y el cielo local", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(URL_NOMINAL);
    await waitForData(page);
    await ready(page);
    const orbital = page.getByTestId("orbital-view");
    const sky = page.getByRole("img", { name: /^Horizonte de Sitio A con trayectorias de Sol y Tierra/ });
    const sun = () => sky.locator("image").first().evaluate((e) => `${e.getAttribute("x")},${e.getAttribute("y")}`);
    await expect(orbital).toHaveAttribute("data-time-index", "3200");
    const sunBefore = await sun();
    // Avanzar un día con el reproductor.
    await page.getByRole("button", { name: "Avanzar 1 día" }).click();
    await expect(orbital).not.toHaveAttribute("data-time-index", "3200");
    await expect.poll(sun).not.toBe(sunBefore);
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
    await svg.scrollIntoViewIfNeeded();
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
