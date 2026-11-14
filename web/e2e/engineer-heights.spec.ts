import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./fixtures";
import { trackErrors, waitForData } from "./helpers";

/**
 * Engineer · alturas de 0 a 30 m (paso 0,5 m) del terreno nominal.
 * Cada lectura visible se compara con los BYTES del paquete publicado
 * (public/data/site-regret/engineer-heights/v1), nunca con un valor recalculado.
 */
const PKG = join(import.meta.dirname, "..", "public", "data", "site-regret", "engineer-heights", "v1");
const V01 = join(import.meta.dirname, "..", "public", "data", "site-regret", "v0.1");
const N_T = 4321;
const T = 3200;
const kKey = (h: number) => `k${String(Math.round(h * 2)).padStart(3, "0")}`;

function scenario(w: string, s: string, h: number) {
  const b = readFileSync(join(PKG, "scenarios", `${w}_${s}_${kKey(h)}.bin`));
  const f = new Float64Array(b.buffer.slice(b.byteOffset, b.byteOffset + 6 * 8 * N_T));
  const at = (i: number) => f[i * N_T + T];
  return { sunEl: at(1), earthEl: at(3), sunH: at(4), earthH: at(5), state: b[6 * 8 * N_T + T] };
}
function v01(w: string, s: string, h: number) {
  const e = JSON.parse(readFileSync(join(V01, "ephemerides", `${w}_${s}_h${h}.json`), "utf8")).series;
  return { sunEl: e.bodies.SUN.elevation_deg[T], sunH: e.sun_horizon_deg[T], earthEl: e.bodies.EARTH.elevation_deg[T], earthH: e.earth_horizon_deg[T] };
}

const URL0 = (s = "A", w = "W1", v = "nominal") => `/engineer/?s=${s}&w=${w}&h=10&v=${v}&t=${T}`;
const readout = (page: import("@playwright/test").Page) => page.getByTestId("obstacle-readout");

async function expectReading(page: import("@playwright/test").Page, w: string, s: string, h: number, mode: "sun" | "earth") {
  const r = readout(page);
  await expect(r).toHaveAttribute("data-height", String(h), { timeout: 20_000 });
  await expect(r).toHaveAttribute("data-site", s);
  await expect(r).toHaveAttribute("data-window", w);
  await expect(r).toHaveAttribute("data-mode", mode);
  const x = scenario(w, s, h);
  await expect(r).toHaveAttribute("data-body-el", String(mode === "sun" ? x.sunEl : x.earthEl));
  await expect(r).toHaveAttribute("data-engine-horizon", String(mode === "sun" ? x.sunH : x.earthH));
  await expect(r).toHaveAttribute("data-state", String(x.state));
}

test.describe("Engineer · visibilidad a cualquier altura del deslizador (nominal)", () => {
  test("19,5 m, 16 m y 30 m muestran su propio resultado y cambian con sitio, ventana y cuerpo", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(URL0());
    await waitForData(page);
    const slider = page.getByTestId("tower-height-slider");
    await expect(page.getByTestId("terrain-conclusion")).toBeVisible({ timeout: 30_000 });
    await slider.fill("19.5");
    await expectReading(page, "W1", "A", 19.5, "sun");
    await expect(page.getByTestId("tower-preview-banner")).toHaveCount(0);
    await expect(page.getByTestId("terrain-conclusion")).toBeVisible();
    await expect(page.getByTestId("terrain-scene")).toHaveAttribute("data-observer-height", "19.5");
    await expect(page.getByTestId("metrics-at-height")).toHaveAttribute("data-height", "19.5");
    // La URL analítica sigue en 0/2/10; la altura de Engineer va aparte.
    await expect(page).toHaveURL(/h=10/);
    await expect(page).toHaveURL(/torre=19\.5/);
    await expect(page.getByTestId("height-range-note")).toContainText("de 0 a 30 m cada 0,5 m");

    await page.getByRole("radio", { name: "Tierra", exact: true }).click();
    await expectReading(page, "W1", "A", 19.5, "earth");
    await slider.fill("16");
    await expectReading(page, "W1", "A", 16, "earth");
    await page.getByRole("radio", { name: "Sitio B" }).click();
    await expectReading(page, "W1", "B", 16, "earth");
    await page.getByRole("radio", { name: "Sol", exact: true }).click();
    await expectReading(page, "W1", "B", 16, "sun");
    await page.goto("/engineer/?s=B&w=W2&h=10&v=nominal&t=3200&torre=30");
    await waitForData(page);
    await expectReading(page, "W2", "B", 30, "sun");
    await expect(page.getByTestId("tower-height-slider")).toHaveValue("30");
    expect(errors).toEqual([]);
  });

  test("una respuesta lenta de una altura anterior nunca sustituye a la altura actual", async ({ page }) => {
    let slowServed = false;
    await page.route(/engineer-heights\/v1\/scenarios\/W1_A_k039\.bin$/, async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      slowServed = true;
      await route.continue();
    });
    await page.goto(URL0());
    await waitForData(page);
    await expect(page.getByTestId("terrain-conclusion")).toBeVisible({ timeout: 30_000 });
    const slider = page.getByTestId("tower-height-slider");
    await slider.fill("19.5"); // se pide y tarda
    await expect(page.getByTestId("height-loading")).toContainText("Cargando visibilidad a 19,5 m");
    // Mientras carga no queda ninguna visual ni conclusión anterior.
    await expect(page.getByTestId("terrain-conclusion")).toHaveCount(0);
    await page.waitForTimeout(400);
    await slider.fill("30");
    await expectReading(page, "W1", "A", 30, "sun");
    await expect.poll(() => slowServed, { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(800);
    await expectReading(page, "W1", "A", 30, "sun");
    // Arrastre rápido en ambos sentidos: solo se pide la altura donde se para.
    const asked: string[] = [];
    page.on("request", (r) => {
      const m = r.url().match(/scenarios\/W1_A_(k\d{3})\.bin/);
      if (m) asked.push(m[1]);
    });
    for (const v of ["29", "27.5", "24", "21", "18.5", "22", "25.5", "26"]) await slider.fill(v);
    await expectReading(page, "W1", "A", 26, "sun");
    expect(asked).toEqual(["k052"]);
  });

  test("volver a 10 m recupera el resultado original del paquete v0.1", async ({ page }) => {
    await page.goto("/engineer/?s=A&w=W1&h=10&v=nominal&t=3200&torre=19.5");
    await waitForData(page);
    await expectReading(page, "W1", "A", 19.5, "sun");
    await page.getByRole("radio", { name: "10 m" }).click();
    const r = readout(page);
    await expect(r).toHaveAttribute("data-height", "10", { timeout: 20_000 });
    const x = v01("W1", "A", 10);
    await expect(r).toHaveAttribute("data-body-el", String(x.sunEl));
    await expect(r).toHaveAttribute("data-engine-horizon", String(x.sunH));
    await expect(page).toHaveURL(/h=10/);
    await expect(page).not.toHaveURL(/torre=/);
    // El paquete de alturas es idéntico al original en 0/2/10 (contraste del piloto).
    const y = scenario("W1", "A", 10);
    expect(y.sunEl).toBe(x.sunEl);
    expect(y.sunH).toBe(x.sunH);
  });

  test("en una superficie alternativa, 19,5 m sigue en vista previa y 10 m recupera sus datos", async ({ page }) => {
    await page.goto(URL0("A", "W1", "published_0001"));
    await waitForData(page);
    await expect(page.getByTestId("terrain-conclusion")).toBeVisible({ timeout: 30_000 });
    const asked: string[] = [];
    page.on("request", (r) => r.url().includes("engineer-heights") && asked.push(r.url()));
    await page.getByTestId("tower-height-slider").fill("19.5");
    await expect(page.getByTestId("tower-preview-banner")).toContainText("Vista previa de la torre · sin cálculo de visibilidad a esta altura");
    await expect(page.getByTestId("terrain-conclusion")).toHaveCount(0);
    expect(asked).toEqual([]);
    await page.getByTestId("tower-preview-banner").getByRole("button", { name: "Ir a 10 m" }).click();
    await expect(page.getByTestId("tower-preview-banner")).toHaveCount(0);
    await expect(page.getByTestId("terrain-conclusion")).toBeVisible();
    await expect(readout(page)).toHaveAttribute("data-height", "10");
    await expect(readout(page)).toHaveAttribute("data-variant", "published_0001");
  });

  test("si una altura falla se muestra el error y «Reintentar» la recupera", async ({ page }) => {
    let fail = true;
    await page.route(/engineer-heights\/v1\/horizons\/A_k033\.bin$/, (route) => (fail ? route.fulfill({ status: 503, body: "no" }) : route.continue()));
    await page.goto(URL0());
    await waitForData(page);
    await expect(page.getByTestId("terrain-conclusion")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("tower-height-slider").fill("16.5");
    await expect(page.getByTestId("height-error")).toContainText("No se pudo cargar la visibilidad a 16,5 m");
    fail = false;
    await page.getByTestId("height-error").getByRole("button", { name: "Reintentar" }).click();
    await expectReading(page, "W1", "A", 16.5, "sun");
  });
});
