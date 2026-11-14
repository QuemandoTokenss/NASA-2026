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
    test(`escritorio ${w}×${h}: Geometría │ Cielo local │ Métricas, y Elevación │ Sitio │ Salidas y puestas + Instante`, async ({ page }) => {
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
      const [geo, sky, met, ele, site, events, instant] = await Promise.all(
        ["timeline-geometry", "timeline-sky", "timeline-metrics", "timeline-chart", "timeline-site", "timeline-events", "timeline-instant"].map((id) => box(page, id)),
      );
      // Fila superior bajo el reproductor: Geometría · Cielo local · Métricas, alineadas por arriba y de la misma altura.
      expect(player.y).toBeLessThan(geo.y);
      for (const b of [sky, met]) {
        expect(Math.abs(b.y - geo.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(b.height - geo.height)).toBeLessThanOrEqual(1);
      }
      expect(geo.x + geo.width).toBeLessThanOrEqual(sky.x);
      expect(sky.x + sky.width).toBeLessThanOrEqual(met.x);
      // El cielo local es claramente la columna más ancha y su gráfico ocupa la tarjeta (no queda espacio vacío).
      expect(sky.width).toBeGreaterThan(geo.width * 1.4);
      expect(sky.width).toBeGreaterThan(met.width * 1.4);
      const skySvg = (await page.getByRole("img", { name: /^Horizonte de Sitio A con trayectorias de Sol y Tierra/ }).boundingBox())!;
      expect(skySvg.height).toBeGreaterThan(sky.height * 0.55);
      // Fila inferior: Elevación · Sitio · (Salidas y puestas sobre Instante).
      for (const b of [ele, site, events]) expect(b.y).toBeGreaterThanOrEqual(geo.y + geo.height);
      expect(Math.abs(site.y - ele.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(events.y - ele.y)).toBeLessThanOrEqual(1);
      expect(ele.x + ele.width).toBeLessThanOrEqual(site.x);
      expect(site.x + site.width).toBeLessThanOrEqual(events.x);
      expect(Math.abs(events.x - met.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(instant.x - events.x)).toBeLessThanOrEqual(1);
      expect(instant.y).toBeGreaterThanOrEqual(events.y + events.height);
      // El orden del código (lectura y teclado) es el visual.
      const domOrder = await page.evaluate(() =>
        ["timeline-geometry", "timeline-sky", "timeline-metrics", "timeline-chart", "timeline-site", "timeline-events", "timeline-instant"].map((id) => {
          const all = [...document.querySelectorAll("[data-testid]")];
          return all.indexOf(document.querySelector(`[data-testid=${id}]`)!);
        }),
      );
      expect(domOrder).toEqual([...domOrder].sort((x, y) => x - y));
      // La leyenda va dentro del panel del gráfico de elevación.
      await expect(page.getByRole("heading", { name: "Leyenda" })).toHaveCount(0);
      const chartPanel = page.getByTestId("timeline-chart");
      await expect(chartPanel.getByText("Elevación del Sol", { exact: true })).toBeVisible();
      await expect(chartPanel.getByTestId("timeline-legend")).toContainText("Sol y Tierra");
      await expect(chartPanel.getByTestId("timeline-legend")).toContainText("Desconocido");
      await expect(page.getByTestId("local-sky-legend")).toContainText("Horizonte real del relieve");
      await noHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });

  test("móvil 390 px: Geometría → Cielo local → Métricas → Elevación → Sitio → Salidas y puestas → Instante", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(URL_NOMINAL);
    await waitForData(page);
    await ready(page);
    await expect(page.getByTestId("timeline-events").getByRole("heading")).toBeVisible();
    let prev = (await page.getByRole("button", { name: "Reproducir" }).boundingBox())!.y;
    for (const id of ["timeline-geometry", "timeline-sky", "timeline-metrics", "timeline-chart", "timeline-site", "timeline-events", "timeline-instant"]) {
      const y = (await box(page, id)).y;
      expect(y, id).toBeGreaterThan(prev);
      prev = y;
    }
    await expect(page.getByRole("heading", { name: "Instante seleccionado" })).toHaveCount(1);
    await expect(page.getByTestId("timeline-site-map")).toHaveCount(1);
    await noHorizontalOverflow(page);
  });

  test("superficie alternativa: el instante va justo debajo del aviso que sustituye a los eventos", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/timeline/?s=B&w=W1&h=2&v=published_0003&t=300");
    await waitForData(page);
    await ready(page);
    await expect(page.getByTestId("timeline-events")).toContainText("Eventos y curvas solo nominales");
    const events = await box(page, "timeline-events");
    const instant = await box(page, "timeline-instant");
    expect(Math.abs(instant.x - events.x)).toBeLessThanOrEqual(1);
    expect(instant.y - (events.y + events.height)).toBeLessThanOrEqual(24);
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
