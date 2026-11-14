/** Utilidades de prueba: leen los datos AUTÉNTICOS (originales y trozos generados). */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Core } from "@/lib/contract/schema";
import type { DataManifest } from "@/lib/data/manifest";

export const ROOT = join(import.meta.dirname, "..");
export const SOURCE = join(ROOT, "data", "source");
export const OUT = join(ROOT, "public", "data", "site-regret");

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

let pkgCache: unknown;
/** Paquete original completo (12,46 MB), leído una vez. */
export function originalPackage(): any {
  pkgCache ??= JSON.parse(readFileSync(join(SOURCE, "DERIVADOS_SITE_REGRET", "paquete_frontend.json"), "utf8"));
  return pkgCache;
}

export function readChunk<T = any>(path: string): T {
  return JSON.parse(readFileSync(join(OUT, "v0.1", ...path.split("/")), "utf8")) as T;
}

export function readManifest(): DataManifest {
  return JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf8"));
}

export function core(): Core {
  return readChunk<Core>("core.json");
}

export const clone = <T>(v: T): T => structuredClone(v);
