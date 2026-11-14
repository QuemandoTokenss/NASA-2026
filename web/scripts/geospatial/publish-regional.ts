/**
 * Copia la pirámide regional versionada (`data/derived/terrain-regional/v1/`) a
 * `public/data/site-regret/terrain-regional/v1/`, comprobando tamaño y SHA-256 de cada
 * bloque contra su manifiesto. Se ejecuta dentro de `npm run data` (después de
 * prepare-data, que regenera la carpeta pública).
 *
 * Regenerar la pirámide (originales PGDA 90 en web/data/raw/motor, no versionados):
 *   python -I web/scripts/engine/fetch_originals.py DEM_REGIONAL_80M DEM_LEJANO_240M
 *   node scripts/geospatial/build-regional.ts
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const SRC = join(ROOT, "data", "derived", "terrain-regional", "v1");
const OUT = join(ROOT, "public", "data", "site-regret", "terrain-regional", "v1");

if (!existsSync(join(SRC, "manifest.json"))) {
  console.error("✘ terreno regional: falta data/derived/terrain-regional/v1/manifest.json. Regenera con scripts/geospatial/build-regional.ts.");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8")) as { schema: string; blocks: Array<{ id: string; bytes: number; sha256: string }> };
if (manifest.schema !== "site-regret-terrain-regional/1") {
  console.error(`✘ terreno regional: esquema inesperado ${manifest.schema}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
let total = 0;
for (const b of manifest.blocks) {
  const file = `${b.id}.i16`;
  const buf = readFileSync(join(SRC, file));
  const digest = createHash("sha256").update(buf).digest("hex");
  if (buf.length !== b.bytes || digest !== b.sha256) {
    console.error(`✘ terreno regional: ${file} no coincide con su manifiesto (¿archivo alterado?). Regenera con scripts/geospatial/build-regional.ts.`);
    process.exit(1);
  }
  mkdirSync(dirname(join(OUT, file)), { recursive: true });
  copyFileSync(join(SRC, file), join(OUT, file));
  total += buf.length;
}
copyFileSync(join(SRC, "manifest.json"), join(OUT, "manifest.json"));
console.log(`✔ terreno regional: ${manifest.blocks.length} bloques verificados (${(total / 1e6).toFixed(2)} MB) → public/data/site-regret/terrain-regional/v1/`);
