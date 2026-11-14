/**
 * Copia el paquete versionado de alturas de Engineer (`data/derived/engineer-heights/v1/`)
 * a `public/data/site-regret/engineer-heights/v1/`, comprobando tamaño y SHA-256 de cada
 * archivo contra su manifiesto. Se ejecuta dentro de `npm run data` (después de
 * prepare-data, que regenera la carpeta pública).
 *
 * Regenerar el paquete (originales NASA en web/data/raw/motor, no versionados):
 *   python -I web/scripts/engine/fetch_originals.py
 *   web/data/raw/motor-venv/Scripts/python -I web/scripts/engine/engineer_heights.py --all
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const SRC = join(ROOT, "data", "derived", "engineer-heights", "v1");
const OUT = join(ROOT, "public", "data", "site-regret", "engineer-heights", "v1");

if (!existsSync(join(SRC, "manifest.json"))) {
  console.error("✘ alturas de Engineer: falta data/derived/engineer-heights/v1/manifest.json. Regenera con scripts/engine/engineer_heights.py --all.");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8"));
if (manifest.schema !== "site-regret-engineer-heights/1") {
  console.error(`✘ alturas de Engineer: esquema inesperado ${manifest.schema}`);
  process.exit(1);
}
const files = Object.entries(manifest.files as Record<string, { sha256: string; bytes: number }>);
mkdirSync(OUT, { recursive: true });
for (const [path, f] of files) {
  const buf = readFileSync(join(SRC, path));
  const digest = createHash("sha256").update(buf).digest("hex");
  if (buf.length !== f.bytes || digest !== f.sha256) {
    console.error(`✘ alturas de Engineer: ${path} no coincide con su manifiesto (¿archivo alterado?).`);
    process.exit(1);
  }
  mkdirSync(dirname(join(OUT, path)), { recursive: true });
  copyFileSync(join(SRC, path), join(OUT, path));
}
copyFileSync(join(SRC, "manifest.json"), join(OUT, "manifest.json"));
console.log(`✔ alturas de Engineer: ${files.length} archivos verificados (${manifest.scenario_count} escenarios) → public/data/site-regret/engineer-heights/v1/`);
