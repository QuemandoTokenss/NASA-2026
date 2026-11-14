/**
 * Copia los derivados de terreno versionados (`data/derived/terrain/`) a
 * `public/data/site-regret/terrain/` comprobando cada archivo contra el
 * manifiesto. Se ejecuta dentro de `npm run data` (después de prepare-data,
 * que regenera la carpeta pública).
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const SRC = join(ROOT, "data", "derived", "terrain");
const OUT = join(ROOT, "public", "data", "site-regret", "terrain");

const manifest = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8"));
const files: Array<{ file: string; bytes: number; sha256: string }> = [...manifest.layers, ...(manifest.ensemble?.members ?? []), manifest.rois];
mkdirSync(OUT, { recursive: true });
for (const f of files) {
  const buf = readFileSync(join(SRC, f.file));
  const digest = createHash("sha256").update(buf).digest("hex");
  if (buf.length !== f.bytes || digest !== f.sha256) {
    console.error(`✘ terreno: ${f.file} no coincide con su manifiesto (¿archivo alterado?). Regenera con scripts/geospatial/build-terrain.ts.`);
    process.exit(1);
  }
  mkdirSync(dirname(join(OUT, f.file)), { recursive: true });
  copyFileSync(join(SRC, f.file), join(OUT, f.file));
}
copyFileSync(join(SRC, "manifest.json"), join(OUT, "manifest.json"));
console.log(`✔ terreno: ${files.length} archivos verificados → public/data/site-regret/terrain/`);
