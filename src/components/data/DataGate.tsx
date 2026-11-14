"use client";

import type { ReactNode } from "react";
import type { Core } from "@/lib/contract/schema";
import type { ValidationReport } from "@/lib/contract/validate";
import { useData, type ChunkState } from "@/lib/data/DataProvider";
import type { DataError } from "@/lib/data/loader";
import type { DataManifest } from "@/lib/data/manifest";
import { Callout, Skeleton } from "../ui/Display";
import { Icon } from "../ui/Icon";

const KIND_LABEL: Record<DataError["kind"], string> = {
  network: "No se pudo descargar",
  integrity: "Integridad no verificada",
  parse: "JSON inválido",
  contract: "No cumple el contrato",
};

export function DataErrorPanel({ error, onRetry }: { error: DataError; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/[0.06] p-5">
      <div className="flex items-start gap-3">
        <Icon name="alert" className="mt-0.5 size-5 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-danger">{KIND_LABEL[error.kind]}</p>
          <p className="mt-1 font-semibold text-ink">{error.message}</p>
          <p className="mt-1 text-sm text-ink-muted">
            No se muestra ningún resultado: la interfaz nunca sustituye datos ausentes o inválidos por valores aproximados.
          </p>
          {error.details.length ? (
            <ul className="mt-3 max-h-48 space-y-1 overflow-auto rounded-lg bg-bg-2 p-3 font-mono text-xs text-ink-muted">
              {error.details.map((d, i) => (
                <li key={i} className="break-words">
                  {d}
                </li>
              ))}
            </ul>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-3"
            >
              Reintentar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export interface ReadyData {
  core: Core;
  manifest: DataManifest;
  report: ValidationReport;
  integrity: "verified" | "unverifiable";
}

/**
 * Renderiza `children` solo con el núcleo cargado, verificado y válido.
 * Gestiona los estados de carga y error de forma uniforme.
 */
export function DataGate({ children, fallback }: { children: (d: ReadyData) => ReactNode; fallback?: ReactNode }) {
  const { state, retry } = useData();
  if (state.status === "loading")
    return (
      fallback ?? (
        <div aria-busy="true" aria-live="polite" className="space-y-3 rounded-2xl border border-line bg-surface/70 p-5">
          <p className="text-sm text-ink-muted">Cargando y verificando el paquete científico…</p>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )
    );
  if (state.status === "error") return <DataErrorPanel error={state.error} onRetry={retry} />;
  return (
    <>
      {state.report.warnings.length ? (
        <div className="mb-4">
          <Callout tone="warn" icon="alert" title="Avisos del paquete">
            <ul className="list-disc pl-4">
              {state.report.warnings.slice(0, 5).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Callout>
        </div>
      ) : null}
      {children(state)}
    </>
  );
}

/** Estado compacto de un trozo de carga diferida. */
export function ChunkGate<T>({
  state,
  children,
  label,
  minHeight = "min-h-40",
}: {
  state: ChunkState<T>;
  children: (data: T) => ReactNode;
  label: string;
  minHeight?: string;
}) {
  if (state.status === "ready") return <>{children(state.data.value)}</>;
  if (state.status === "error") return <DataErrorPanel error={state.error} />;
  return (
    <div aria-busy="true" className={`flex flex-col justify-center gap-2 ${minHeight}`}>
      <p className="text-xs text-ink-faint">Cargando {label}…</p>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
