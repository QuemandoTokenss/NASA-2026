/**
 * Prepara los datos científicos para la web SIN modificar los originales.
 *
 *   1. Verifica cada archivo de data/source contra SHA256_TRANSFERENCIA.txt.
 *   2. Divide paquete_frontend.json en trozos de carga diferida.
 *   3. Relee los trozos escritos, reensambla y exige igualdad estricta con el original.
 *   4. Copia byte a byte los originales que la web ofrece como descarga/figura.
 *   5. Escribe manifest.json con SHA-256 y tamaño de cada archivo servido.
 *
 * Uso: `npm run data` (se ejecuta también antes de `dev`, `build` y `test`).
 * Requiere Node >= 22.18 (ejecución directa de TypeScript).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SPLIT_LAYOUT_VERSION,
  assemblePackage,
  canonicalStringify,
  deepEqualStrict,
  splitPackage,
} from "../src/lib/data/split.ts";
import { DATA_ROOT, DATA_VERSION_DIR, type DataManifest, type FileEntry, type OriginalEntry } from "../src/lib/data/manifest.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "data", "source");
const HASH_LIST = "SHA256_TRANSFERENCIA.txt";
const PACKAGE_PATH = "DERIVADOS_SITE_REGRET/paquete_frontend.json";
const OUT = join(ROOT, "public", ...DATA_ROOT.split("/"));
const OUT_CHUNKS = join(OUT, DATA_VERSION_DIR);
const OUT_ORIGINAL = join(OUT, "original");

/** Originales que la web publica tal cual (descarga, figuras, evidencia). */
const PUBLISHED_ORIGINALS: Array<{ path: string; description: string }> = [
  { path: PACKAGE_PATH, description: "Paquete científico completo site-regret/0.1 (120 escenarios)" },
  { path: "DERIVADOS_SITE_REGRET/datos/pasaporte.json", description: "Pasaporte científico de la ejecución" },
  { path: "DERIVADOS_SITE_REGRET/datos/eventos_acotados.json", description: "Cruces nominales acotados a 10 minutos" },
  { path: "DERIVADOS_SITE_REGRET/datos/contexto_2d.json", description: "Metadatos del mapa de contexto 2D" },
  { path: "DERIVADOS_SITE_REGRET/CONTRATO_DATOS.md", description: "Contrato de datos site-regret/0.1" },
  { path: "DERIVADOS_SITE_REGRET/RESUMEN.json", description: "Resumen numérico de la ejecución" },
  { path: "DERIVADOS_SITE_REGRET/INFORME_RESULTADOS.html", description: "Informe estático de resultados" },
  { path: "DERIVADOS_SITE_REGRET/validacion/pruebas.json", description: "Comprobaciones científicas almacenadas" },
  { path: "DERIVADOS_SITE_REGRET/validacion/contraste_horizons.json", description: "Contraste SPICE DE421 frente a JPL Horizons" },
  { path: "DERIVADOS_SITE_REGRET/figuras/mapa_sitios.svg", description: "Figura: DEM de Connecting Ridge con A y B" },
  { path: "DERIVADOS_SITE_REGRET/figuras/horizonte_A.svg", description: "Figura: horizonte de A" },
  { path: "DERIVADOS_SITE_REGRET/figuras/horizonte_B.svg", description: "Figura: horizonte de B" },
  { path: "DERIVADOS_SITE_REGRET/figuras/cielo_W1_A.svg", description: "Figura: cielo nominal W1, A" },
  { path: "DERIVADOS_SITE_REGRET/figuras/cielo_W1_B.svg", description: "Figura: cielo nominal W1, B" },
  { path: "DERIVADOS_SITE_REGRET/figuras/cielo_W2_A.svg", description: "Figura: cielo nominal W2, A" },
  { path: "DERIVADOS_SITE_REGRET/figuras/cielo_W2_B.svg", description: "Figura: cielo nominal W2, B" },
  { path: HASH_LIST, description: "Lista de hashes SHA-256 de la transferencia" },
];

const sha256 = (buf: Buffer | string) => createHash("sha256").update(buf).digest("hex");
const toPosix = (p: string) => p.split(sep).join("/");

function fail(msg: string): never {
  console.error(`\n✖ prepare-data: ${msg}\n`);
  process.exit(1);
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function parseHashList(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([0-9a-f]{64}) [ *](.+)$/);
    if (m) map.set(m[2].trim(), m[1]);
  }
  return map;
}

// 1. Integridad de los originales -------------------------------------------
const hashList = parseHashList(readFileSync(join(SOURCE, HASH_LIST), "utf8"));
if (hashList.size === 0) fail(`${HASH_LIST} vacío o ilegible`);

let verified = 0;
for (const file of listFiles(SOURCE)) {
  const rel = toPosix(relative(SOURCE, file));
  if (rel === HASH_LIST || rel === "README.md") continue; // la lista no se lista a sí misma; README propio
  const expected = hashList.get(rel);
  if (!expected) fail(`${rel} no figura en ${HASH_LIST}: no se acepta como original`);
  const actual = sha256(readFileSync(file));
  if (actual !== expected) fail(`hash distinto en ${rel}\n  esperado ${expected}\n  obtenido ${actual}`);
  verified++;
}

// 2. División ----------------------------------------------------------------
const packageBuffer = readFileSync(join(SOURCE, PACKAGE_PATH));
const pkg = JSON.parse(packageBuffer.toString("utf8"));
if (pkg.schema_version !== "site-regret/0.1") fail(`schema_version inesperado: ${pkg.schema_version}`);

rmSync(OUT, { recursive: true, force: true });
const chunks = splitPackage(pkg);
const chunkEntries: Record<string, FileEntry> = {};
for (const [path, value] of chunks) {
  const text = canonicalStringify(value);
  const target = join(OUT_CHUNKS, ...path.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text, "utf8");
  chunkEntries[path] = { path, sha256: sha256(text), bytes: Buffer.byteLength(text) };
}

// 3. Equivalencia: releer desde disco y reensamblar ---------------------------
const reassembled = assemblePackage((path) => {
  const entry = chunkEntries[path];
  if (!entry) throw new Error(`Trozo inexistente: ${path}`);
  return JSON.parse(readFileSync(join(OUT_CHUNKS, ...path.split("/")), "utf8"));
});
const diffs: string[] = [];
if (!deepEqualStrict(pkg, reassembled, "$", diffs)) fail(`el reensamblado difiere del original en ${diffs[0]}`);

// 4. Originales publicados byte a byte ----------------------------------------
const originals: OriginalEntry[] = PUBLISHED_ORIGINALS.map(({ path, description }) => {
  const src = join(SOURCE, ...path.split("/"));
  const target = join(OUT_ORIGINAL, ...path.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(src, target);
  const buf = readFileSync(target);
  const digest = sha256(buf);
  if (path !== HASH_LIST && digest !== hashList.get(path)) fail(`copia alterada de ${path}`);
  return { path: `original/${path}`, transfer_path: path, sha256: digest, bytes: buf.length, description };
});

// 5. Manifiesto -----------------------------------------------------------------
const manifest: DataManifest = {
  manifest_version: 1,
  schema_version: pkg.schema_version,
  split_layout_version: SPLIT_LAYOUT_VERSION,
  source: {
    transfer_path: PACKAGE_PATH,
    sha256: sha256(packageBuffer),
    bytes: packageBuffer.length,
    hash_list: HASH_LIST,
    verified_files: verified,
  },
  serializer: "canonicalStringify: JSON determinista, doubles de ida y vuelta exacta, conserva -0",
  equivalence: "deep-equal-strict-verified",
  chunks: chunkEntries,
  originals,
};
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

const totalChunkBytes = Object.values(chunkEntries).reduce((n, c) => n + c.bytes, 0);
const core = chunkEntries["core.json"];
console.log(
  [
    `✔ prepare-data: ${verified} originales verificados contra ${HASH_LIST}`,
    `  paquete ${PACKAGE_PATH} sha256=${manifest.source.sha256.slice(0, 16)}… (${packageBuffer.length} bytes)`,
    `  ${Object.keys(chunkEntries).length} trozos (${totalChunkBytes} bytes); núcleo ${core.bytes} bytes`,
    `  reensamblado idéntico al original (igualdad estricta, -0 incluido)`,
    `  ${originals.length} originales publicados sin modificar → public/${DATA_ROOT}/original/`,
  ].join("\n"),
);
