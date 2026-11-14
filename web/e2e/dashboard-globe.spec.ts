import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { core, noHorizontalOverflow, trackErrors } from "./helpers";

const globe = (page: Page) => page.getByTestId("moon-globe");
const data = (page: Page) => globe(page).evaluate((e) => ({ ...(e as HTMLElement).dataset }));
const xy = (s: string) => s.split(",").map(Number);

/** Espera a que el visor deje de dibujar (vuelo terminado; se renderiza bajo demanda). */
async function still(page: Page) {
  let last = "";
  await expect
    .poll(
      async () => {
        const f = (await data(page)).frames ?? "";
        const same = f === last;
        last = f;
        return same;
      },
      { timeout: 20_000, intervals: [400] },
    )
    .toBe(true);
}

test.describe("PC-24 · Dashboard · globo lunar", () => {
  test("a 1280×720 se ven juntos la Luna, la pregunta y el botón; giro completo, polo, A/B y vuelta", async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    // Texto, botón e imagen local están antes de que llegue el globo.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("¿Dónde alunizarías?");
    await expect(page.getByTestId("hero-cta")).toHaveAttribute("href", /\/historia\/$/);
    await expect(page.locator("[data-testid=moon-globe][data-ready=true]")).toBeVisible({ timeout: 60_000 });
    for (const id of ["hero-cta", "hero-globe-area"]) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(720);
    }
    const h1 = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
    expect(h1.y + h1.height).toBeLessThan(720);
    await expect(page.getByTestId("globe-illustrative")).toContainText("fuera de escala");

    // Vista global: A y B agrupados en el polo sur, visibles.
    await still(page);
    const home = await data(page);
    expect(home.view).toBe("globe");
    expect(home.cluster).toBe("true");
    await expect(page.getByTestId("globe-cluster")).toBeVisible();
    await expect(page.getByTestId("globe-site-A")).toBeHidden();

    // Rotación completa con el teclado (24 × 15°): cara oculta sin marcadores y vuelta al punto de partida.
    await globe(page).getByRole("application").focus();
    const seen: string[] = [];
    for (let i = 1; i <= 24; i++) {
      await page.keyboard.press("ArrowRight");
      if (i % 6 === 0) {
        await still(page);
        seen.push((await data(page)).sitesVisible!);
        if (i === 12) await expect(page.getByTestId("globe-cluster")).toBeHidden();
      }
    }
    expect(seen).toEqual(["false", "false", "false", "true"]);
    const after = xy((await data(page)).camera!);
    xy(home.camera!).forEach((v, k) => expect(after[k]).toBeCloseTo(v, 2));

    // Polo sur: A y B separados, con etiqueta propia y en la posición del mapa (B arriba a la derecha).
    await page.getByTestId("globe-pole").click();
    await expect(globe(page)).toHaveAttribute("data-view", "pole");
    await still(page);
    const pole = await data(page);
    expect(pole.cluster).toBe("false");
    expect(Number(pole.altKm)).toBeLessThan(10);
    const a = xy(pole.siteA!);
    const b = xy(pole.siteB!);
    const dx = core.sites[1].x_m - core.sites[0].x_m;
    const dy = core.sites[1].y_m - core.sites[0].y_m;
    expect(b[0]).toBeGreaterThan(a[0]);
    expect(b[1]).toBeLessThan(a[1]);
    // Misma dirección que en el mapa (0° arriba, 90° E a la derecha), con menos de 1° de diferencia.
    const angle = (Math.atan2(-(b[1] - a[1]), b[0] - a[0]) - Math.atan2(dy, dx)) * (180 / Math.PI);
    expect(Math.abs(angle)).toBeLessThan(1);
    await expect(page.getByTestId("globe-site-A")).toBeVisible();
    await expect(page.getByTestId("globe-site-B")).toBeVisible();

    // Elección en el globo y en los botones de la portada.
    await page.getByTestId("globe-site-B").click();
    await expect(page.getByTestId("hero-site-info")).toContainText("Sitio B");
    await expect(page.getByTestId("hero-site-info")).toContainText("648 m");
    await expect(page.getByTestId("hero-site-B")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("hero-site-A").click();
    await expect(page.getByTestId("globe-site-A")).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/s=A/);

    // Vuelta al globo y render parado.
    await page.getByTestId("globe-reset").click();
    await expect(globe(page)).toHaveAttribute("data-view", "globe");
    await still(page);
    const back = await data(page);
    expect(back.cluster).toBe("true");
    xy(back.camera!).forEach((v, k) => expect(v).toBeCloseTo(xy(home.camera!)[k], 2));
    await page.waitForTimeout(1200);
    expect((await data(page)).frames).toBe(back.frames);
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("elegir un sitio desde la portada lleva al polo; móvil sin desbordamiento", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator("[data-testid=moon-globe][data-ready=true]")).toBeVisible({ timeout: 60_000 });
    const cta = (await page.getByTestId("hero-cta").boundingBox())!;
    expect(cta.y + cta.height).toBeLessThanOrEqual(844);
    await page.getByTestId("hero-site-B").click();
    await expect(globe(page)).toHaveAttribute("data-view", "pole");
    await still(page);
    await expect(page.getByTestId("globe-site-B")).toHaveAttribute("aria-pressed", "true");
    await noHorizontalOverflow(page);
  });

  test("movimiento reducido: el enfoque al polo es un salto, sin animación", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("[data-testid=moon-globe][data-ready=true]")).toBeVisible({ timeout: 60_000 });
    await still(page);
    const before = Number((await data(page)).frames);
    await page.getByTestId("globe-pole").click();
    await still(page);
    const d = await data(page);
    expect(d.view).toBe("pole");
    // Un fotograma por el salto y, como mucho, otro por cada textura de detalle que llega.
    expect(Number(d.frames) - before).toBeLessThanOrEqual(5);
  });

  test("sin WebGL: queda la imagen NASA local y se puede entrar en la demo", async ({ page }) => {
    const errors = trackErrors(page);
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, type: string, ...rest: unknown[]) => unknown;
      (HTMLCanvasElement.prototype as unknown as { getContext: typeof original }).getContext = function (type, ...rest) {
        return /webgl/i.test(type) ? null : original.call(this, type, ...rest);
      };
    });
    await page.goto("/");
    await expect(page.getByTestId("home-hero")).toHaveAttribute("data-globe", "failed", { timeout: 60_000 });
    await expect(page.getByTestId("moon-globe")).toHaveCount(0);
    const img = page.getByTestId("home-hero").locator("img").first();
    await expect(img).toHaveAttribute("src", /hero-moon-svs5187/);
    await expect(img).toHaveCSS("opacity", "1");
    await expect(page.getByTestId("hero-site-info")).toContainText("La misión funciona igual");
    await page.getByTestId("hero-site-A").click();
    await expect(page.getByTestId("hero-site-info")).toContainText("Sitio A");
    await page.getByTestId("hero-cta").click();
    await expect(page).toHaveURL(/\/historia\/(\?.*)?$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // three.js avisa por consola de que no hay WebGL; cualquier otro error sería un fallo.
    expect(errors.filter((e) => !/WebGL/i.test(e))).toEqual([]);
  });
});
