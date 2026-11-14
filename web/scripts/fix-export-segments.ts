/**
 * Corrige los archivos de prefetch por segmento del export estático cuando se
 * compila en Windows.
 *
 * Next 16 nombra cada segmento como `__next${ruta con "/" → "."}.txt`, pero en
 * Windows la ruta relativa usa "\", que no se sustituye; el resultado es una
 * carpeta `__next.explore/__PAGE__.txt` en lugar de `__next.explore.__PAGE__.txt`
 * y el cliente recibe 404 al precargar. Este paso aplana esas carpetas.
 * En Linux/macOS no encuentra nada que corregir.
 */
import { readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const out = process.argv[2] ?? "out";
let fixed = 0;

function filesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? filesIn(p) : [p];
  });
}

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name.startsWith("__next.")) {
      for (const file of filesIn(full)) {
        const rest = relative(full, file).split(sep).join(".");
        renameSync(file, join(dir, `${name}.${rest}`));
        fixed++;
      }
      rmSync(full, { recursive: true, force: true });
    } else if (name !== "_next" && name !== "data") {
      walk(full);
    }
  }
}

walk(out);
console.log(`✔ fix-export-segments: ${fixed} archivo(s) de segmento renombrados en ${out}/`);
