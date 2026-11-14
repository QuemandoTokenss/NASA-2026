import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export const ROUTES = ["/", "/explore/", "/timeline/", "/comparador/", "/engineer/", "/regret-lab/", "/evidencia/"] as const;

/** Núcleo generado por `npm run data` (fuente de verdad para comparar con la UI). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const core: any = JSON.parse(readFileSync(join(import.meta.dirname, "..", "public", "data", "site-regret", "v0.1", "core.json"), "utf8"));

export function hm(h: number) {
  const total = Math.round(Math.abs(h) * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (mm === 0) return `${hh} h`;
  return hh === 0 ? `${mm} min` : `${hh} h ${mm} min`;
}

/** Recoge errores de consola y de página durante la prueba. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

export async function waitForData(page: Page) {
  await expect(page.getByText("Cargando y verificando el paquete científico…")).toHaveCount(0);
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
}

export async function noHorizontalOverflow(page: Page) {
  const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(sw, "desbordamiento horizontal").toBeLessThanOrEqual(w);
}

export function panel(page: Page, title: string | RegExp) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: title }) });
}
