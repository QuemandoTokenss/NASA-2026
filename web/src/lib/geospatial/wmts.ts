/**
 * Lectura de un documento WMTS GetCapabilities (RESTful) de Moon Trek.
 * Todo se obtiene del documento: capa, estilo, formato, plantilla de URL,
 * TileMatrixSet y matrices. No se asume un esquema XYZ terrestre.
 *
 * El CRS que declaran estos documentos es ambiguo (`urn:ogc:def:crs:EPSG::0`):
 * NO se interpreta como WGS84 ni Web Mercator. La proyección la aporta el
 * registro de activos y se comprueba con `checkPolarStereographicGrid`.
 */
import { XMLParser } from "fast-xml-parser";

/** Tamaño de píxel normalizado de OGC WMTS (m) para convertir ScaleDenominator. */
export const OGC_PIXEL_SIZE_M = 0.00028;

export interface WmtsTileMatrix {
  id: string;
  scaleDenominator: number;
  /** Unidades del CRS por píxel (metros en estas capas). */
  resolution: number;
  topLeft: [number, number];
  tileWidth: number;
  tileHeight: number;
  matrixWidth: number;
  matrixHeight: number;
}

export interface WmtsCapabilities {
  layerId: string;
  title: string;
  style: string;
  format: string;
  tileMatrixSet: string;
  declaredCrs: string;
  /** [oeste, sur, este, norte] en unidades del CRS, tal como lo declara el documento. */
  bbox: [number, number, number, number];
  template: string;
  matrices: WmtsTileMatrix[];
}

export class WmtsError extends Error {}

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string => (v === undefined || v === null ? "" : typeof v === "object" ? String((v as Record<string, unknown>)["#text"] ?? "") : String(v));
const pair = (v: unknown): [number, number] => {
  const p = text(v).trim().split(/\s+/).map(Number);
  if (p.length !== 2 || p.some((n) => !Number.isFinite(n))) throw new WmtsError(`Par de coordenadas no válido: «${text(v)}»`);
  return [p[0], p[1]];
};

export function parseWmtsCapabilities(xml: string): WmtsCapabilities {
  if (!/<Capabilities[\s>]/.test(xml)) throw new WmtsError("La respuesta no es un documento WMTS Capabilities");
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", removeNSPrefix: true, parseTagValue: false }).parse(xml);
  const contents = doc?.Capabilities?.Contents;
  const layer = arr(contents?.Layer)[0];
  if (!layer) throw new WmtsError("El documento no contiene ninguna capa");
  const setId = text(arr(layer.TileMatrixSetLink)[0]?.TileMatrixSet);
  const set = arr(contents.TileMatrixSet).find((s: Record<string, unknown>) => text(s.Identifier) === setId);
  if (!set) throw new WmtsError(`TileMatrixSet «${setId}» no definido`);
  const styles = arr(layer.Style);
  const style = text((styles.find((s: Record<string, unknown>) => s["@isDefault"] === "true") ?? styles[0])?.Identifier);
  const resource = arr(layer.ResourceURL).find((r: Record<string, unknown>) => r["@resourceType"] === "tile");
  const template = text(resource?.["@template"]);
  const format = text(resource?.["@format"]) || text(arr(layer.Format)[0]);
  if (!style || !template || !format) throw new WmtsError("Faltan estilo, formato o plantilla de teselas");
  if (!["image/png", "image/jpeg"].includes(format)) throw new WmtsError(`Formato de tesela no soportado: ${format}`);
  const box = layer.BoundingBox ?? layer.WGS84BoundingBox;
  const lower = pair(arr(box)[0]?.LowerCorner);
  const upper = pair(arr(box)[0]?.UpperCorner);
  const matrices: WmtsTileMatrix[] = arr(set.TileMatrix).map((m: Record<string, unknown>) => {
    const scaleDenominator = Number(text(m.ScaleDenominator));
    const out = {
      id: text(m.Identifier),
      scaleDenominator,
      resolution: scaleDenominator * OGC_PIXEL_SIZE_M,
      topLeft: pair(m.TopLeftCorner),
      tileWidth: Number(text(m.TileWidth)),
      tileHeight: Number(text(m.TileHeight)),
      matrixWidth: Number(text(m.MatrixWidth)),
      matrixHeight: Number(text(m.MatrixHeight)),
    };
    for (const [k, v] of Object.entries(out)) if (typeof v === "number" && !(Number.isFinite(v) && v > 0)) throw new WmtsError(`TileMatrix ${out.id}: ${k} no válido`);
    return out;
  });
  if (!matrices.length) throw new WmtsError("TileMatrixSet sin matrices");
  matrices.sort((a, b) => b.resolution - a.resolution);
  return {
    layerId: text(layer.Identifier),
    title: text(layer.Title),
    style,
    format,
    tileMatrixSet: setId,
    declaredCrs: text(set.SupportedCRS),
    bbox: [lower[0], lower[1], upper[0], upper[1]],
    template,
    matrices,
  };
}

/** URL de una tesela a partir de la plantilla ResourceURL del documento. */
export function tileUrl(cap: WmtsCapabilities, matrixId: string, row: number, col: number): string {
  return cap.template
    .replace("{Style}", cap.style)
    .replace("{TileMatrixSet}", cap.tileMatrixSet)
    .replace("{TileMatrix}", matrixId)
    .replace("{TileRow}", String(row))
    .replace("{TileCol}", String(col));
}

/** Fila/columna de la tesela que contiene un punto del CRS en una matriz. */
export function tileForPoint(m: WmtsTileMatrix, x: number, y: number): { row: number; col: number; inside: boolean } {
  const col = Math.floor((x - m.topLeft[0]) / (m.tileWidth * m.resolution));
  const row = Math.floor((m.topLeft[1] - y) / (m.tileHeight * m.resolution));
  return { row, col, inside: col >= 0 && row >= 0 && col < m.matrixWidth && row < m.matrixHeight };
}

/**
 * Comprueba que la rejilla es coherente con una estereográfica polar en
 * METROS centrada en el polo: esquina superior izquierda simétrica y nivel 0
 * que abarca exactamente de −X a +X. Si no se cumple, la capa no se habilita.
 */
export function checkPolarStereographicGrid(cap: WmtsCapabilities): string[] {
  const issues: string[] = [];
  const m0 = cap.matrices[0];
  if (m0.topLeft[0] !== -m0.topLeft[1]) issues.push("La esquina superior izquierda no es simétrica respecto al polo");
  const span = m0.tileWidth * m0.resolution;
  if (Math.abs(span - 2 * Math.abs(m0.topLeft[0])) > 1e-6 * span) issues.push("El nivel 0 no abarca de −X a +X: las unidades no son metros centrados en el polo");
  for (let i = 1; i < cap.matrices.length; i++) {
    const a = cap.matrices[i - 1];
    const b = cap.matrices[i];
    if (Math.abs(a.resolution / b.resolution - 2) > 1e-9) issues.push(`Las matrices ${a.id}→${b.id} no duplican la resolución`);
    if (b.topLeft[0] !== m0.topLeft[0] || b.topLeft[1] !== m0.topLeft[1]) issues.push(`La matriz ${b.id} cambia de origen`);
  }
  const [w, s, e, n] = cap.bbox;
  if (!(w < 0 && s < 0 && e > 0 && n > 0)) issues.push("La cobertura declarada no contiene el polo");
  return issues;
}

/** Firma PNG/JPEG de los primeros bytes (un 200 con HTML no la supera). */
export function imageSignature(bytes: Uint8Array): "png" | "jpeg" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  return null;
}
