"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Core } from "../contract/schema";
import type { ValidationReport } from "../contract/validate";
import { DataError, loadCore, loadManifest, type IntegrityStatus, type Loaded } from "./loader";
import type { DataManifest } from "./manifest";

export type CoreState =
  | { status: "loading" }
  | { status: "error"; error: DataError }
  | {
      status: "ready";
      core: Core;
      manifest: DataManifest;
      report: ValidationReport;
      integrity: IntegrityStatus;
    };

interface DataContextValue {
  state: CoreState;
  retry: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

function toDataError(e: unknown): DataError {
  return e instanceof DataError ? e : new DataError("Error inesperado al cargar los datos", "parse", [String(e)]);
}

/** Carga el núcleo (≈150 kB) una vez por sesión; el resto se pide bajo demanda. */
export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CoreState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([loadManifest(), loadCore()])
      .then(([manifest, core]) => {
        if (alive)
          setState({ status: "ready", core: core.value, manifest, report: core.report, integrity: core.integrity });
      })
      .catch((e) => alive && setState({ status: "error", error: toDataError(e) }));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return <DataContext.Provider value={{ state, retry }}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData debe usarse dentro de <DataProvider>");
  return ctx;
}

export type ChunkState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: DataError }
  | { status: "ready"; data: Loaded<T> };

/**
 * Carga diferida de un trozo. `load` debe devolver la promesa cacheada del
 * loader; `deps` (valores primitivos) identifica el trozo, p. ej. [siteId, heightM].
 * Mientras llega el trozo de una selección nueva se informa "loading", nunca
 * el resultado de la selección anterior.
 */
export function useChunk<T>(
  load: (() => Promise<Loaded<T>>) | null,
  deps: ReadonlyArray<string | number | boolean | null>,
): ChunkState<T> {
  const key = JSON.stringify(deps);
  const [entry, setEntry] = useState<{ key: string; state: ChunkState<T> } | null>(null);
  useEffect(() => {
    if (!load) return;
    let alive = true;
    load()
      .then((data) => alive && setEntry({ key, state: { status: "ready", data } }))
      .catch((e) => alive && setEntry({ key, state: { status: "error", error: toDataError(e) } }));
    return () => {
      alive = false;
    };
    // `load` se recrea en cada render; el trozo lo identifica `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, load === null]);
  if (!load) return { status: "idle" };
  return entry?.key === key ? entry.state : { status: "loading" };
}
