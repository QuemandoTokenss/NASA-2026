/**
 * Descarga los originales NASA que necesita la capa geoespacial y los
 * verifica ENTEROS (tamaño, firma del formato y SHA-256 del archivo completo)
 * contra `data/geospatial/registry.json`, cuyos hashes proceden del pasaporte
 * del paquete site-regret/0.1.
 *
 *   node scripts/geospatial/fetch-originals.ts
 *
 * Los archivos se guardan en `data/raw/` (no versionado). Una respuesta 200
 * con HTML, un archivo truncado o un hash distinto se rechazan: nunca se deja
 * un archivo sin verificar con el nombre definitivo.
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const ROOT = join(import.meta.dirname, "..", "..");
export const RAW_DIR = join(ROOT, "data", "raw", "pgda78_site01");

interface RegistryAsset {
  id: string;
  url?: string;
  bytes?: number;
  sha256?: string;
  signature?: "tiff" | "gzip";
}

export function readRegistry(): { assets: RegistryAsset[] } {
  return JSON.parse(readFileSync(join(ROOT, "data", "geospatial", "registry.json"), "utf8"));
}

export const rawPathOf = (a: RegistryAsset) => join(RAW_DIR, a.url!.split("/").pop()!);

export async function sha256File(path: string): Promise<string> {
  const h = createHash("sha256");
  await pipeline(createReadStream(path), h);
  return h.digest("hex");
}

/** Firma del formato en los primeros bytes (un 200 con HTML no la supera). */
export function signatureOk(path: string, kind: "tiff" | "gzip"): boolean {
  const b = readFileSync(path).subarray(0, 4);
  if (kind === "gzip") return b[0] === 0x1f && b[1] === 0x8b;
  const le = b[0] === 0x49 && b[1] === 0x49 && (b[2] === 42 || b[2] === 43) && b[3] === 0;
  const be = b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && (b[3] === 42 || b[3] === 43);
  return le || be;
}

export async function verifyOriginal(a: RegistryAsset, path = rawPathOf(a)): Promise<string | null> {
  if (!existsSync(path)) return "no descargado";
  const size = statSync(path).size;
  if (size !== a.bytes) return `tamaño ${size} ≠ ${a.bytes} (¿truncado?)`;
  if (!signatureOk(path, a.signature!)) return `firma ${a.signature} no válida`;
  const digest = await sha256File(path);
  if (digest !== a.sha256) return `SHA-256 ${digest.slice(0, 12)}… ≠ ${a.sha256!.slice(0, 12)}…`;
  return null;
}

async function main() {
  const assets = readRegistry().assets.filter((a) => a.url && a.sha256);
  mkdirSync(RAW_DIR, { recursive: true });
  let failed = 0;
  for (const a of assets) {
    const target = rawPathOf(a);
    if ((await verifyOriginal(a)) === null) {
      console.log(`✔ ${a.id}: ya verificado`);
      continue;
    }
    const tmp = `${target}.part`;
    rmSync(tmp, { force: true });
    try {
      const res = await fetch(a.url!, { redirect: "follow" });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      mkdirSync(dirname(tmp), { recursive: true });
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
      const problem = await verifyOriginal(a, tmp);
      if (problem) throw new Error(problem);
      rmSync(target, { force: true });
      renameSync(tmp, target);
      console.log(`✔ ${a.id}: descargado y verificado (${a.bytes} bytes, sha256 ${a.sha256!.slice(0, 12)}…)`);
    } catch (e) {
      rmSync(tmp, { force: true });
      failed++;
      console.error(`✘ ${a.id}: ${(e as Error).message} — ${a.url}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} original(es) sin verificar. No se generan derivados a partir de archivos no verificados.`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) await main();
