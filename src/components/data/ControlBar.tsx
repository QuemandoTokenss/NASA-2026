"use client";

import type { ReactNode } from "react";

/** Barra de controles de escenario (estilo de la cabecera de los mockups). */
export function ControlBar({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-gradient-to-b from-surface/90 to-bg-2/80 px-4 py-3.5 shadow-[0_1px_0_0_#ffffff08_inset] sm:px-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">{children}</div>
      {aside ? <div className="flex flex-wrap items-center gap-3">{aside}</div> : null}
    </div>
  );
}
