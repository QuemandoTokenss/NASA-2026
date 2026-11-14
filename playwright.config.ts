import { defineConfig, devices } from "@playwright/test";

/**
 * E2E sobre el export estático (`out/`), servido sin red por el servidor
 * propio. Usa el navegador del sistema (Edge por defecto; PW_CHANNEL=chrome
 * para Chrome) para no descargar navegadores.
 */
const PORT = 4174;
const channel = process.env.PW_CHANNEL ?? "msedge";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel,
    trace: "off",
  },
  webServer: {
    command: `node scripts/serve-static.ts out ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1920, height: 1080 } }, testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { channel, viewport: { width: 375, height: 812 }, isMobile: false, hasTouch: true }, testMatch: /responsive\.spec\.ts/ },
  ],
});
