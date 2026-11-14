/**
 * Servidor estático mínimo para probar la exportación `out/` sin red
 * y sin dependencias externas: `npm run build && npm run serve`.
 * Solo escucha en 127.0.0.1.
 */
import { appendFileSync, createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "out");
const port = Number(process.argv[3] ?? 4173);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".bin": "application/octet-stream",
  ".f32": "application/octet-stream",
};

// Registro opcional de peticiones (una línea por petición) para medir el tráfico en las pruebas.
const LOG = process.env.SERVE_LOG;

if (!existsSync(root)) {
  console.error(`No existe ${root}. Ejecuta antes \`npm run build\`.`);
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root + sep) && file !== root) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    const notFound = join(root, "404.html");
    res.writeHead(404, { "content-type": TYPES[".html"] });
    if (existsSync(notFound)) createReadStream(notFound).pipe(res);
    else res.end("404");
    return;
  }
  // Validadores como en un hosting estático: ETag + 304. Lo versionado por Next (_next/static) es inmutable;
  // el resto (HTML, datos) se revalida en cada visita.
  const st = statSync(file);
  const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  const headers: Record<string, string> = {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    etag,
    "last-modified": st.mtime.toUTCString(),
    "cache-control": url.pathname.startsWith("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache",
  };
  const fresh = req.headers["if-none-match"] === etag;
  if (LOG) appendFileSync(LOG, `${Date.now()} ${fresh ? 304 : 200} ${url.pathname}\n`);
  if (fresh) {
    res.writeHead(304, headers).end();
    return;
  }
  res.writeHead(200, { ...headers, "content-length": String(st.size) });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`SITE REGRET (estático) en http://127.0.0.1:${port}/  ·  raíz: ${root}`);
});
