/**
 * Capturas y medidas de rendimiento reproducibles (Edge del sistema, sin cabecera).
 *
 *   node scripts/qa/capture.mjs <baseUrl> <carpeta de salida> [--only=dashboard,timeline,engineer] [--perf]
 *
 * Captura Dashboard, Timeline y Engineer a 1440×900, 1280×720 y 390×844, más los casos de
 * Engineer con el obstáculo dentro y fuera del recorte. Con --perf mide carga (bytes
 * transferidos, tiempo hasta el contenido útil) y tiempo de fotograma al interactuar.
 * Las medidas solo son comparables entre sí en el mismo equipo y con el mismo navegador.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [base, outDir, ...flags] = process.argv.slice(2);
if (!base || !outDir) {
  console.error("uso: node scripts/qa/capture.mjs <baseUrl> <salida> [--only=a,b] [--perf] [--gpu]");
  process.exit(1);
}
const only = flags.find((f) => f.startsWith("--only="))?.slice(7).split(",");
const perf = flags.includes("--perf");
const gpu = flags.includes("--gpu");
const noShots = flags.includes("--no-shots");
mkdirSync(outDir, { recursive: true });

const SIZES = [
  { tag: "1440x900", width: 1440, height: 900 },
  { tag: "1280x720", width: 1280, height: 720 },
  { tag: "390x844", width: 390, height: 844 },
];
/** Casos de Engineer: obstáculo dentro del recorte local y fuera (relieve regional). */
const ENGINEER = {
  dentro: "/engineer/?s=A&w=W2&h=0&v=nominal&t=3200",
  fuera: "/engineer/?s=A&w=W1&h=10&v=nominal&t=3200",
};
const PAGES = [
  { key: "dashboard", url: "/" },
  { key: "timeline", url: "/timeline/?s=A&w=W2&h=0&v=nominal&t=3200" },
  { key: "engineer", url: ENGINEER.fuera },
];

const args = gpu
  ? ["--use-gl=angle", "--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"]
  : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge", args });

async function settle(page, key) {
  await page.getByText("Cargando y verificando el paquete científico…").waitFor({ state: "detached", timeout: 60_000 }).catch(() => undefined);
  if (key === "engineer") await page.locator("[data-testid=terrain-scene][data-frames]").waitFor({ timeout: 60_000 }).catch(() => undefined);
  if (key === "dashboard" && (await page.locator("[data-testid=moon-globe]").count())) await page.locator("[data-testid=moon-globe][data-ready=true]").waitFor({ timeout: 30_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1800);
}

async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage });
  console.log("captura", name);
}

const results = { base, gpu, renderer: null, pages: {} };

for (const p of PAGES) {
  if (noShots || (only && !only.includes(p.key))) continue;
  for (const s of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(base + p.url, { waitUntil: "domcontentloaded" });
    await settle(page, p.key);
    await shot(page, `${p.key}-${s.tag}`);
    if (s.tag === "1440x900") await shot(page, `${p.key}-${s.tag}-page`, true);
    await ctx.close();
  }
}

if (!noShots && (!only || only.includes("engineer"))) {
  for (const [tag, url] of Object.entries(ENGINEER)) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(base + url, { waitUntil: "domcontentloaded" });
    await settle(page, "engineer");
    await shot(page, `engineer-obstaculo-${tag}-1440x900`);
    const reading = await page.getByTestId("obstacle-readout").innerText().catch(() => "");
    results.pages[`engineer-obstaculo-${tag}`] = { url, lectura: reading.replace(/\s+/g, " ").slice(0, 400) };
    await ctx.close();
  }
}

if (perf) {
  const measure = async (key, url, interact) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    let bytes = 0;
    let requests = 0;
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    cdp.on("Network.loadingFinished", (e) => {
      bytes += e.encodedDataLength;
      requests++;
    });
    const t0 = Date.now();
    await page.goto(base + url, { waitUntil: "domcontentloaded" });
    const cta = key === "dashboard" ? page.getByTestId("hero-cta") : page.locator("main h1").first();
    await cta.waitFor({ timeout: 60_000 });
    const usefulMs = Date.now() - t0;
    await settle(page, key);
    const settledMs = Date.now() - t0;
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null };
    });
    if (!results.renderer)
      results.renderer = await page.evaluate(() => {
        const gl = document.createElement("canvas").getContext("webgl2");
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        return gl && ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "sin WebGL";
      });
    const loadBytes = bytes;
    const loadRequests = requests;
    const frames = interact ? await interact(page) : null;
    results.pages[key] = { url, usefulMs, settledMs, ...nav, transferKB: Math.round(loadBytes / 1024), requests: loadRequests, interaction: frames };
    console.log(key, JSON.stringify(results.pages[key]));
    await ctx.close();
  };

  /** Arrastra sobre un lienzo durante ~3 s y devuelve el intervalo entre fotogramas (rAF) en ms. */
  const dragFrames = async (page, selector) => {
    if (!(await page.locator(selector).count())) return null;
    const box = await page.locator(selector).first().boundingBox();
    if (!box) return null;
    await page.evaluate(() => {
      window.__ft = [];
      let last = performance.now();
      const tick = (t) => {
        window.__ft.push(t - last);
        last = t;
        window.__raf = requestAnimationFrame(tick);
      };
      window.__raf = requestAnimationFrame(tick);
    });
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 0; i < 90; i++) await page.mouse.move(cx + Math.sin(i / 9) * box.width * 0.3, cy + Math.cos(i / 13) * box.height * 0.12);
    await page.mouse.up();
    return page.evaluate(() => {
      cancelAnimationFrame(window.__raf);
      const f = window.__ft.slice(2).sort((a, b) => a - b);
      const q = (p) => Math.round(f[Math.min(f.length - 1, Math.floor(f.length * p))] * 10) / 10;
      return { frames: f.length, medianMs: q(0.5), p95Ms: q(0.95), maxMs: Math.round(f[f.length - 1]) };
    });
  };

  if (!only || only.includes("dashboard")) await measure("dashboard", "/", (page) => dragFrames(page, "[data-testid=moon-globe] canvas"));
  if (!only || only.includes("timeline")) await measure("timeline", "/timeline/?s=A&w=W2&h=0&v=nominal&t=3200", null);
  if (!only || only.includes("engineer"))
    await measure("engineer", ENGINEER.fuera, async (page) => {
      const orbit = await dragFrames(page, "[data-testid=terrain-scene] canvas");
      // Arrastre del deslizador de altura: tiempo hasta que la lectura corresponde a la altura final.
      const slider = page.getByTestId("tower-height-slider");
      const t0 = Date.now();
      for (const v of ["12", "15.5", "19", "23.5", "27", "30"]) await slider.fill(v);
      await page.locator("[data-testid=tower-height-control][data-analysis-height='30'][data-ready=true]").waitFor({ timeout: 30_000 }).catch(() => undefined);
      return { orbit, sliderTo30Ms: Date.now() - t0 };
    });
}

writeFileSync(join(outDir, noShots ? "medidas.json" : "lecturas.json"), JSON.stringify(results, null, 1));
await browser.close();
console.log("hecho →", outDir);
