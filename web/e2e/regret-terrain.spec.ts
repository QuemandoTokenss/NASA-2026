import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "./fixtures";
import { core, noHorizontalOverflow, panel, trackErrors, waitForData } from "./helpers";

const WEB = join(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(WEB, "data", "derived", "terrain", "manifest.json"), "utf8"));
const es = (v: number, d: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const TITLE = "Terreno de la superficie: qué cambia y dónde";

test.describe("Regret Lab · terreno de la superficie (G15)", () => {
  test("clon publicado: mapa de diferencia verificado, Δ horizonte y lectura del obstáculo", async ({ page }) => {
    const errors = trackErrors(page);
    const files: string[] = [];
    page.on("response", (r) => r.url().includes("/terrain/clones/") && r.ok() && files.push(r.url()));
    await page.goto("/regret-lab/?s=A&w=W2&h=0&v=published_0002&c=min_longest_dark_hours");
    await waitForData(page);
    const p = panel(page, TITLE);
    await expect(p.getByTestId("regret-diff-map")).toHaveAttribute("data-diff-ready", "true");
    const m = manifest.ensemble.members.find((x: { variant: string }) => x.variant === "published_0002");
    // La leyenda usa el P99 de |Δ| del manifiesto y el resumen da su RMS.
    await expect(p.getByTestId("regret-diff-legend")).toContainText(`${es(m.difference_vs_nominal.abs_p99, 2)} m`);
    await expect(p.getByText(`RMS ${es(m.difference_vs_nominal.rms, 3)} m`)).toBeVisible();
    // Altura del suelo del observador: la del paquete para nominal y clon.
    const g = core.horizons_index.A.observer_ground_height_m;
    const sight = p.getByTestId("regret-sight");
    await expect(sight).toContainText(`${es(g.nominal, 2)} m`);
    await expect(sight).toContainText(`${es(g.published_0002, 2)} m`);
    await expect(sight).toContainText("no demuestra que este azimut explique un cambio de ganador");
    await expect(p.getByTestId("horizon-delta-chart")).toBeVisible();
    // Los 5 clones se descargan (verificados con SHA-256 en el cargador) y se pueden elegir.
    await expect(p.getByTestId("clone-strip").locator("canvas")).toHaveCount(5);
    expect(new Set(files.map((u) => u.split("/").pop())).size).toBe(5);
    await p.getByRole("button", { name: /Clon publicado 0004/ }).click();
    await expect(page).toHaveURL(/v=published_0004/);
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("hipótesis propia: no se inventa su terreno, sí se muestran sus horizontes", async ({ page }) => {
    await page.goto("/regret-lab/?s=B&w=W2&h=0&v=correlated_plus&c=min_longest_dark_hours");
    await waitForData(page);
    const p = panel(page, TITLE);
    await expect(p.getByText("Superficie no reconstruible en la web")).toBeVisible();
    await expect(p.getByTestId("regret-diff-map")).toHaveAttribute("data-diff-ready", "false");
    await expect(p.getByTestId("horizon-delta-chart")).toBeVisible();
  });

  test("el mapa de calor del regret marca filas sin elección nominal", async ({ page }) => {
    await page.goto("/regret-lab/?s=A&w=W2&h=0&v=nominal&c=min_longest_dark_hours");
    await waitForData(page);
    const dm = panel(page, /Mapa de decisiones/);
    await dm.getByRole("radio", { name: "Regret" }).click();
    const heat = panel(page, /Mapa de calor del regret/);
    await expect(heat.getByRole("button", { name: /W2, 0 m, .*correlacionado \+.*regret 16 h 30 min/ })).toBeVisible();
  });
});
