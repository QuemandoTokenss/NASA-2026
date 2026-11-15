// Capturas PC-28 (Regret Lab): node scripts/qa/capture-pc28.mjs <baseURL> <carpeta-salida> [--only=prefijo]
// Edge instalado (channel msedge), igual que la suite E2E. Escribe PNG y log.json con lo leído en la página.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [base, outDir, onlyArg] = process.argv.slice(2);
if (!base || !outDir) throw new Error("uso: capture-pc28.mjs <baseURL> <salida>");
const only = onlyArg?.startsWith("--only=") ? onlyArg.slice(7) : null;
mkdirSync(outDir, { recursive: true });

const cases = [];
for (const w of ["W1", "W2"])
  for (const h of [0, 2, 10]) cases.push({ name: `regret-${w}-${h}m-dark`, path: `/regret-lab/?w=${w}&h=${h}&v=nominal&c=min_longest_dark_hours` });
cases.push({ name: "regret-W2-2m-earth", path: "/regret-lab/?w=W2&h=2&v=nominal&c=max_dte_hours" });
cases.push({ name: "regret-W2-0m-inverted", path: "/regret-lab/?w=W2&h=0&v=correlated_plus&c=min_longest_dark_hours" });
cases.push({ name: "regret-W1-0m-sun-clone", path: "/regret-lab/?w=W1&h=0&v=published_0001&c=max_sun_hours" });
cases.push({ name: "regret-demo", path: "/regret-lab/?w=W2&h=0&v=nominal&c=min_longest_dark_hours#demo", demo: true });
cases.push({ name: "regret-W2-2m-dark-en", path: "/regret-lab/?w=W2&h=2&v=nominal&c=min_longest_dark_hours&lang=en" });

const viewports = [
  { tag: "1440x900", width: 1440, height: 900 },
  { tag: "390x844", width: 390, height: 844, mobile: true },
];

const browser = await chromium.launch({ channel: "msedge" });
const log = [];
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const c of cases) {
    if (only && !c.name.startsWith(only)) continue;
    await page.goto(base + c.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    if (c.demo) {
      // Demo abierta en W2 · 0 m y después el usuario cambia a 2 m: la guía debe pausarse.
      await page.screenshot({ path: join(outDir, `${c.name}-abierta-${vp.tag}.png`) });
      const h2 = page.getByRole("radio", { name: /^2 m$/ }).first();
      if (await h2.count()) {
        await h2.click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: join(outDir, `${c.name}-cambio-altura-${vp.tag}.png`) });
      }
    }
    const shot = join(outDir, `${c.name}-${vp.tag}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    const read = await page.evaluate(() => ({
      url: location.href,
      verdict: document.querySelector('[data-testid="regret-verdict"]')?.getAttribute("data-kind") ?? null,
      verdictText: document.querySelector('[data-testid="regret-verdict-text"]')?.textContent ?? null,
      hint: document.querySelector('[data-testid="regret-verdict-hint"]')?.textContent ?? null,
      changes: document.querySelector('[data-testid="regret-height-changes"]')?.textContent ?? null,
      demoPaused: !!document.querySelector('[data-testid="demo-paused"]'),
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    }));
    log.push({ case: c.name, viewport: vp.tag, ...read });
  }
  log.push({ viewport: vp.tag, consoleErrors: errors });
  await ctx.close();
}
await browser.close();
writeFileSync(join(outDir, "log.json"), JSON.stringify(log, null, 1));
console.log("OK", log.length);
