import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import { ROUTES, core, hm, noHorizontalOverflow, panel, trackErrors, waitForData } from "./helpers";

const DEMO = "?w=W2&h=0&v=nominal&c=min_longest_dark_hours";

test.describe("navegación y rutas", () => {
  for (const r of ROUTES) {
    test(`la ruta ${r} carga sin errores ni desbordamiento`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`${r}${DEMO}`);
      await expect(page.locator("h1").first()).toBeVisible();
      await waitForData(page);
      await page.waitForTimeout(1500); // trozos diferidos
      await expect(page.locator("main [role=alert]")).toHaveCount(0);
      await noHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  }

  test("la navegación conserva la selección compartida", async ({ page }) => {
    await page.goto("/comparador/?s=B&w=W2&h=10&v=published_0003&c=max_joint_hours");
    await waitForData(page);
    await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: /Regret Lab/ }).click();
    await expect(page).toHaveURL(/\/regret-lab\/\?s=B&w=W2&h=10&v=published_0003&c=max_joint_hours/);
    await expect(page.getByRole("heading", { level: 1, name: "Regret Lab" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Criterio de decisión" })).toHaveValue("max_joint_hours");
  });

  test("parámetros de URL inválidos se rechazan con aviso y valores por defecto", async ({ page }) => {
    await page.goto("/comparador/?w=W9&h=7&v=published_0099&c=score");
    await expect(page.getByText("Parámetros de URL ignorados")).toBeVisible();
    await expect(page).toHaveURL(/w=W1&h=0&v=nominal/);
    await expect(page.getByRole("combobox", { name: "Criterio de decisión" })).toHaveValue("");
  });

  test("teclado: enlace de salto y control segmentado con flechas", async ({ page }) => {
    await page.goto("/comparador/");
    await waitForData(page);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
    const w1 = page.getByRole("radio", { name: /^W1/ });
    await w1.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: /^W2/ })).toHaveAttribute("aria-checked", "true");
    await expect(page).toHaveURL(/w=W2/);
  });
});

test.describe("Comparador", () => {
  test("no revela ganador hasta elegir criterio", async ({ page }) => {
    await page.goto("/comparador/?w=W2&h=0&v=nominal");
    await waitForData(page);
    await expect(panel(page, "Conclusión").getByText("01 · Elige el criterio")).toBeVisible();
    await expect(page.getByText("Mejor resultado")).toHaveCount(0);
  });

  test("caso W2 · 0 m: B nominal; correlated_plus invierte con regret de B 16 h 30 min", async ({ page }) => {
    await page.goto(`/comparador/${DEMO}`);
    await waitForData(page);
    const c = panel(page, "Conclusión");
    await expect(c.getByText(/Mejor resultado:\s*Sitio B/)).toBeVisible();
    await expect(page.getByText("38 h 40 min").first()).toBeVisible();
    await expect(page.getByText("14 h 40 min").first()).toBeVisible();
    await page.getByRole("combobox", { name: "Superficie del terreno" }).selectOption("correlated_plus");
    await expect(c.getByText(/Mejor resultado:\s*Sitio A/)).toBeVisible();
    await expect(c.getByText("16 h 30 min").first()).toBeVisible();
    await expect(c.getByText(/cambia la conclusión/)).toBeVisible();
  });

  test("las 24 combinaciones ventana × altura × criterio muestran el ganador del contrato", async ({ page }) => {
    test.slow();
    for (const cmp of core.comparisons) {
      for (const [crit, r] of Object.entries<{ nominal_winner: string }>(cmp.criteria)) {
        await page.goto(`/comparador/?w=${cmp.window_id}&h=${cmp.height_m}&v=nominal&c=${crit}`);
        const expected = r.nominal_winner === "TIE" ? /Empate entre A y B/ : r.nominal_winner === "UNKNOWN" ? /No determinable/ : new RegExp(`Mejor resultado:\\s*Sitio ${r.nominal_winner}`);
        await expect(panel(page, "Conclusión").getByText(expected), `${cmp.window_id} ${cmp.height_m} ${crit}`).toBeVisible();
      }
    }
  });

  test("exportación JSON con valores completos del paquete", async ({ page }) => {
    await page.goto(`/comparador/${DEMO}`);
    await waitForData(page);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "JSON" }).click()]);
    const json = JSON.parse(readFileSync((await download.path())!, "utf8"));
    const a = core.scenario_summaries.find((s: { site_id: string; window_id: string; height_m: number; variant: string }) => s.site_id === "A" && s.window_id === "W2" && s.height_m === 0 && s.variant === "nominal");
    expect(json.scenarios.nominal.A.metrics).toEqual(a.metrics);
    expect(json.comparison.id).toBe("min_longest_dark_hours");
    expect(json.provenance.package.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

test.describe("Regret Lab", () => {
  test("caso demostrativo completo desde el Dashboard", async ({ page }) => {
    await page.goto("/");
    await waitForData(page);
    await page.getByRole("link", { name: "Iniciar caso demostrativo" }).click();
    const guide = page.getByRole("region", { name: "Caso demostrativo guiado" });
    const text = guide.locator("p[aria-live]");
    await expect(text).toContainText("38 h 40 min");
    await expect(text).toContainText("14 h 40 min");
    const next = guide.getByRole("button", { name: "Siguiente" });
    await next.click();
    await expect(text).toContainText("Elegimos Sitio B");
    await next.click();
    await expect(text).toContainText("Campo correlacionado +");
    await next.click();
    await expect(text).toContainText("ahora gana Sitio A");
    await next.click();
    await expect(text).toContainText("16 h 30 min");
    await next.click();
    await expect(text).toContainText("2/4");
    await expect(text).toContainText("4/5");
    await expect(text).toContainText("no probabilidades");
    await expect(page).toHaveURL(/v=correlated_plus/);
    await expect(panel(page, "Superficie seleccionada").getByText("Se invierte")).toBeVisible();
  });

  test("familias separadas y recuentos coherentes con robustness", async ({ page }) => {
    await page.goto(`/regret-lab/${DEMO}`);
    await waitForData(page);
    await expect(page.getByText("Se mantiene 2/4")).toBeVisible();
    await expect(page.getByText("Se mantiene 4/5")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hipótesis propias" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Clones publicados", exact: true })).toBeVisible();
    await expect(page.getByText(/probabilidad de ser mejor/i)).toHaveCount(0);
  });

  test("empate nominal: sin fracción, regret medible si se elige un sitio", async ({ page }) => {
    await page.goto("/regret-lab/?w=W1&h=2&v=nominal&c=min_longest_dark_hours");
    await waitForData(page);
    await expect(page.getByText("El nominal empata: sin fracción (null)")).toBeVisible();
    await page.getByRole("radio", { name: "Conservar Sitio A" }).click();
    await expect(panel(page, "Superficie seleccionada").getByText("REGRET de conservar A")).toBeVisible();
  });

  test("el mapa de decisiones selecciona combinación y superficie", async ({ page }) => {
    await page.goto(`/regret-lab/${DEMO}`);
    await waitForData(page);
    await page.getByRole("button", { name: /^W2, 0 m, Clon publicado 0001: Sitio A, invierte/ }).click();
    await expect(page).toHaveURL(/v=published_0001/);
    const detail = panel(page, "Superficie seleccionada");
    await expect(detail.getByText(hm(528.6666666666666)).first()).toBeVisible();
  });
});

test.describe("Timeline", () => {
  test("reproductor sobre instantes reales y lectura UTC", async ({ page }) => {
    await page.goto("/timeline/?s=A&w=W2&h=0&v=nominal&t=1200");
    await waitForData(page);
    await expect(page.getByText("22 dic 2026, 08:00 UTC → 22 dic 2026, 08:10 UTC").first()).toBeVisible();
    await page.getByRole("button", { name: "Avanzar 1 día" }).click();
    await expect(page.getByText("23 dic 2026, 08:00 UTC → 23 dic 2026, 08:10 UTC").first()).toBeVisible();
    await page.getByRole("button", { name: "Reproducir" }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Pausar" }).click();
    // La URL se escribe con un breve retardo tras el último cambio.
    await expect.poll(() => Number(new URL(page.url()).searchParams.get("t"))).toBeGreaterThan(1344);
  });

  test("superficies alternativas: sin curvas inventadas, con estados", async ({ page }) => {
    await page.goto("/timeline/?s=B&w=W1&h=0&v=published_0002");
    await waitForData(page);
    await expect(page.getByText("Sin curvas para esta superficie")).toBeVisible();
    await expect(page.getByRole("img", { name: /Franjas temporales/ })).toBeVisible();
  });
});

test.describe("Explore, Engineer y Evidencia", () => {
  test("Explore: zoom y cambio de sitio desde el mapa", async ({ page }) => {
    await page.goto("/explore/?s=A&w=W1&h=0&v=nominal");
    await waitForData(page);
    // La figura original del motor se conserva como referencia, plegada.
    const figure = page.locator("details").filter({ hasText: "Figura original del motor" });
    await figure.locator("summary").click();
    await figure.getByRole("button", { name: "Acercar" }).click();
    await expect(figure.getByText(/zoom ×1,5/)).toBeVisible();
    await figure.getByRole("button", { name: /^Sitio B: Connecting Ridge/ }).click();
    await expect(page).toHaveURL(/s=B/);
    await expect(panel(page, "Ficha del sitio").getByText("Connecting Ridge · ROI 6")).toBeVisible();
  });

  test("Engineer: las tres alturas cambian métricas y ganadores", async ({ page }) => {
    await page.goto("/engineer/?s=A&w=W2&h=0&v=nominal");
    await waitForData(page);
    await expect(page.getByRole("heading", { name: "Rendimiento geométrico (altura 0 m)" })).toBeVisible();
    await page.getByRole("radio", { name: /^10 10 m/ }).click();
    await expect(page.getByRole("heading", { name: "Rendimiento geométrico (altura 10 m)" })).toBeVisible();
    await expect(panel(page, "Conclusión de ingeniería").getByText("cambia con la altura").first()).toBeVisible();
  });

  test("Evidencia: 414 comprobaciones, 8 contrastes y descarga íntegra del paquete", async ({ page, request }) => {
    await page.goto("/evidencia/");
    await waitForData(page);
    await expect(page.getByRole("heading", { name: "Comprobaciones guardadas · 414/414" })).toBeVisible();
    await expect(panel(page, "Contraste con JPL Horizons").locator("tbody tr")).toHaveCount(8);
    const href = await page.getByRole("link", { name: /Paquete científico completo/ }).getAttribute("href");
    const body = await (await request.get(href!)).body();
    expect(createHash("sha256").update(body).digest("hex")).toBe("e7c8984b2bcfe804bdabed0d13a9f812d34739b6d1e957466ced784bd86fd936");
  });

  test("integridad: un trozo alterado bloquea la interfaz", async ({ page }) => {
    await page.route("**/v0.1/core.json", async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: (await res.text()) + " " });
    });
    await page.goto("/comparador/");
    await expect(page.locator("main [role=alert]")).toContainText("Integridad fallida en core.json");
    await expect(page.getByText("Mejor resultado")).toHaveCount(0);
  });
});
