/**
 * Manifiesto de los datos servidos. Lo genera `scripts/prepare-data.ts`
 * y el cliente lo usa para comprobar cada trozo antes de interpretarlo.
 */

export const DATA_ROOT = "data/site-regret";
export const DATA_VERSION_DIR = "v0.1";

export interface FileEntry {
  /** Ruta relativa a la carpeta servida (`/data/site-regret/<dir>/`). */
  path: string;
  sha256: string;
  bytes: number;
}

export interface OriginalEntry extends FileEntry {
  /** Ruta en la transferencia original (clave de SHA256_TRANSFERENCIA.txt). */
  transfer_path: string;
  description: string;
}

export interface DataManifest {
  manifest_version: 1;
  schema_version: string;
  split_layout_version: number;
  source: {
    transfer_path: string;
    sha256: string;
    bytes: number;
    hash_list: string;
    verified_files: number;
  };
  serializer: string;
  equivalence: "deep-equal-strict-verified";
  chunks: Record<string, FileEntry>;
  originals: OriginalEntry[];
}

export function dataUrl(basePath: string, ...parts: string[]) {
  return `${basePath}/${DATA_ROOT}/${parts.join("/")}`;
}
