"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_SELECTION,
  URL_KEYS,
  parseSelection,
  selectionReducer,
  serializeSelection,
  type Selection,
  type SelectionAction,
} from "./selection";

interface SelectionContextValue {
  selection: Selection;
  dispatch: (a: SelectionAction) => void;
  /** Parámetros de la URL inicial que no son válidos para este paquete. */
  rejectedParams: string[];
  /** Query string actual (para construir enlaces que conservan la selección). */
  query: string;
  /** true cuando la selección ya se restauró desde la URL (evita cargar trozos por defecto). */
  restored: boolean;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, dispatch] = useReducer(selectionReducer, DEFAULT_SELECTION);
  const [rejectedParams, setRejected] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);
  const selectionRef = useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  const pathname = usePathname();

  // Restaurar desde la URL al cargar y al navegar con atrás/adelante.
  useEffect(() => {
    const restore = () => {
      const { selection: parsed, rejected } = parseSelection(window.location.search);
      dispatch({ type: "replace", value: parsed });
      setRejected(rejected);
      setRestored(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const query = useMemo(() => serializeSelection(selection), [selection]);

  // Navegación interna hacia una URL con parámetros explícitos (p. ej. el acceso
  // al caso demostrativo): adoptar esa selección. Si la URL no trae parámetros
  // (logo, enlaces sin query), se conserva la selección actual.
  useEffect(() => {
    if (!restored) return;
    const params = new URLSearchParams(window.location.search);
    if (![...params.keys()].some((k) => (Object.values(URL_KEYS) as string[]).includes(k))) return;
    const { selection: parsed, rejected } = parseSelection(params);
    if (serializeSelection(parsed) !== serializeSelection(selectionRef.current)) {
      dispatch({ type: "replace", value: parsed });
      setRejected(rejected);
    }
  }, [pathname, restored]);

  // Reflejar el estado en la URL (sin crear entradas de historial). Solo tras
  // restaurar: antes, la selección es la de por defecto y sobrescribiría la URL
  // compartida (en StrictMode los efectos se ejecutan dos veces).
  useEffect(() => {
    if (!restored) return;
    // Retardo breve: el reproductor de Timeline cambia `t` muchas veces por
    // segundo y el navegador limita las llamadas a replaceState.
    const id = setTimeout(() => {
      const next = `?${query}`;
      if (window.location.search !== next) {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${next}${window.location.hash}`);
      }
    }, 180);
    return () => clearTimeout(id);
  }, [query, pathname, restored]);

  const stableDispatch = useCallback((a: SelectionAction) => dispatch(a), []);
  const value = useMemo(
    () => ({ selection, dispatch: stableDispatch, rejectedParams, query, restored }),
    [selection, stableDispatch, rejectedParams, query, restored],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection debe usarse dentro de <SelectionProvider>");
  return ctx;
}
