import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assemblePackage, canonicalStringify, deepEqualStrict, splitPackage } from "@/lib/data/split";
import { OUT, SOURCE, originalPackage, readChunk, readManifest, sha256 } from "./helpers";

const PACKAGE = "DERIVADOS_SITE_REGRET/paquete_frontend.json";

describe("originales intactos", () => {
  it("paquete_frontend.json coincide con su hash de la transferencia", () => {
    const list = readFileSync(join(SOURCE, "SHA256_TRANSFERENCIA.txt"), "utf8");
    const expected = list.match(new RegExp(`^([0-9a-f]{64})  ${PACKAGE}$`, "m"))?.[1];
    expect(expected).toBe("e7c8984b2bcfe804bdabed0d13a9f812d34739b6d1e957466ced784bd86fd936");
    expect(sha256(readFileSync(join(SOURCE, ...PACKAGE.split("/"))))).toBe(expected);
  });

  it("el paquete tiene 12.464.735 bytes, como declara RESUMEN.json", () => {
    const resumen = JSON.parse(readFileSync(join(SOURCE, "DERIVADOS_SITE_REGRET", "RESUMEN.json"), "utf8"));
    expect(readFileSync(join(SOURCE, ...PACKAGE.split("/"))).length).toBe(resumen.frontend_json_bytes);
  });
});

describe("serialización y división", () => {
  it("canonicalStringify conserva -0 y los doubles exactos", () => {
    const v = { a: -0, b: 0.1 + 0.2, c: [1e-7, -38.666666666666664, 720], d: null, e: "·" };
    const back = JSON.parse(canonicalStringify(v));
    expect(deepEqualStrict(v, back)).toBe(true);
    expect(Object.is(back.a, -0)).toBe(true);
    expect(JSON.stringify(-0)).toBe("0"); // por esto existe canonicalStringify
  });

  it("deepEqualStrict distingue -0 de 0 y detecta claves distintas", () => {
    expect(deepEqualStrict({ x: -0 }, { x: 0 })).toBe(false);
    expect(deepEqualStrict({ x: 1 }, { x: 1, y: 2 })).toBe(false);
    expect(deepEqualStrict([1, 2], [2, 1])).toBe(false);
  });

  it("dividir + serializar + reensamblar reproduce el paquete original exactamente", () => {
    const pkg = originalPackage();
    const chunks = splitPackage(pkg);
    const serialized = new Map([...chunks].map(([k, v]) => [k, JSON.parse(canonicalStringify(v))]));
    const diffs: string[] = [];
    const ok = deepEqualStrict(pkg, assemblePackage((p) => serialized.get(p)), "$", diffs);
    expect(diffs).toEqual([]);
    expect(ok).toBe(true);
  });

  it("el original contiene -0 (utilidades), y se conserva en los trozos", () => {
    const pkg = originalPackage();
    const u = pkg.comparisons[0].criteria.min_longest_dark_hours.cases.nominal.utility_A;
    expect(Object.is(u, -0)).toBe(true);
    const core = readChunk("core.json");
    expect(Object.is(core.comparisons[0].criteria.min_longest_dark_hours.cases.nominal.utility_A, -0)).toBe(true);
  });

  it("assemblePackage falla si falta un trozo", () => {
    const chunks = splitPackage(originalPackage());
    chunks.delete("horizons/B_h2.json");
    expect(() => assemblePackage((p) => chunks.get(p))).toThrow();
  });
});

describe("salida servida (public/data/site-regret)", () => {
  const manifest = readManifest();

  it("el manifiesto apunta al paquete original verificado", () => {
    expect(manifest.schema_version).toBe("site-regret/0.1");
    expect(manifest.source.sha256).toBe("e7c8984b2bcfe804bdabed0d13a9f812d34739b6d1e957466ced784bd86fd936");
    expect(manifest.equivalence).toBe("deep-equal-strict-verified");
    expect(Object.keys(manifest.chunks)).toHaveLength(27);
  });

  it("cada trozo en disco coincide con el SHA-256 del manifiesto", () => {
    for (const entry of Object.values(manifest.chunks)) {
      const buf = readFileSync(join(OUT, "v0.1", ...entry.path.split("/")));
      expect(sha256(buf), entry.path).toBe(entry.sha256);
      expect(buf.length).toBe(entry.bytes);
    }
  });

  it("los originales publicados son copias byte a byte", () => {
    const list = readFileSync(join(SOURCE, "SHA256_TRANSFERENCIA.txt"), "utf8");
    for (const o of manifest.originals) {
      const file = join(OUT, ...o.path.split("/"));
      expect(existsSync(file), o.path).toBe(true);
      expect(sha256(readFileSync(file))).toBe(o.sha256);
      if (o.transfer_path !== "SHA256_TRANSFERENCIA.txt") expect(list).toContain(`${o.sha256}  ${o.transfer_path}`);
    }
  });

  it("el núcleo es pequeño frente al paquete (carga inicial < 200 kB)", () => {
    expect(manifest.chunks["core.json"].bytes).toBeLessThan(200_000);
  });
});
