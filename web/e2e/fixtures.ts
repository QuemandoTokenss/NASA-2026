import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, type Page } from "@playwright/test";

export { expect } from "@playwright/test";

const FIX = join(import.meta.dirname, "..", "tests", "fixtures", "trek");
const CAPABILITIES: Record<string, Buffer> = {
  LRO_NAC_Mosaic_1mpp_SP: readFileSync(join(FIX, "LRO_NAC_Mosaic_1mpp_SP.WMTSCapabilities.xml")),
  LRO_WAC_Mosaic_SPole60_100m_v02: readFileSync(join(FIX, "LRO_WAC_Mosaic_SPole60_100m_v02.WMTSCapabilities.xml")),
};
const TILE = readFileSync(join(FIX, "LRO_NAC_Mosaic_1mpp_SP.z12.r2070.c2026.png"));

export type TrekMode = "recorded" | "offline" | "html" | "live";

/**
 * Las pruebas no dependen de la red: las peticiones a Moon Trek se responden
 * con respuestas REALES grabadas (documento de capacidades y una tesela).
 * - `offline`: se cortan (servidor no disponible).
 * - `html`: 200 con HTML (respuesta no válida).
 * - `live`: sin interceptar (solo con E2E_LIVE_TREK=1).
 */
export async function mockTrek(page: Page, mode: TrekMode) {
  if (mode === "live") return;
  await page.route("https://trek.nasa.gov/**", async (route) => {
    const url = route.request().url();
    if (mode === "offline") return route.abort("internetdisconnected");
    if (mode === "html") return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>Service temporarily unavailable</body></html>" });
    const layer = Object.keys(CAPABILITIES).find((l) => url.includes(`/${l}/`));
    if (layer && url.endsWith("WMTSCapabilities.xml")) return route.fulfill({ status: 200, contentType: "application/xml", headers: { "access-control-allow-origin": "*" }, body: CAPABILITIES[layer] });
    if (layer && /\/\d+\/\d+\/\d+\.png$/.test(url)) return route.fulfill({ status: 200, contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: TILE });
    return route.fulfill({ status: 404, body: "not recorded" });
  });
}

export const test = base.extend<{ trek: TrekMode }>({
  trek: ["recorded", { option: true }],
  page: async ({ page, trek }, run) => {
    await mockTrek(page, trek);
    await run(page);
  },
});
