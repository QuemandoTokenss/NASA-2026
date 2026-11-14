import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { ROUTES, waitForData } from "./helpers";

/**
 * Auditoría automática WCAG 2.1 A/AA con axe-core (incluye contraste).
 * No sustituye a una prueba con lector de pantalla real.
 */
for (const r of ROUTES) {
  test(`accesibilidad WCAG A/AA en ${r}`, async ({ page }) => {
    await page.goto(`${r}?w=W2&h=0&v=nominal&c=min_longest_dark_hours`);
    await waitForData(page);
    await page.waitForTimeout(1500);
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const summary = res.violations.map((v) => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}
