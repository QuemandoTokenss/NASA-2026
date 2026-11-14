import { defineConfig, devices } from "@playwright/test";

/**
 * E2E sobre el export estático (`out/`), servido sin red por el servidor
 * propio. Usa el navegador del sistema (Edge por defecto; PW_CHANNEL=chrome
 * para Chrome) para no descargar navegadores.
 */
const PORT = 4174;
const channel = process.env.PW_CHANNEL ?? "msedge";
/** E2E_BASE_URL=https://… prueba un despliegue en lugar del export local. */
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [["list"]],
  use: {
    baseURL: remote ?? `http://127.0.0.1:${PORT}`,
    channel,
    trace: "off",
    // WebGL por software para la escena 3D en modo sin cabecera.
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: remote
    ? undefined
    : {
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
