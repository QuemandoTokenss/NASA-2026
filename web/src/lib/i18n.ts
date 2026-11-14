/**
 * Bilingüismo ES/EN sin dependencias.
 *
 * - El idioma activo vive en un módulo (`current`). El proveedor lo fija
 *   ANTES de renderizar y remonta la interfaz al cambiarlo, así que funciones
 *   puras como `L()` o los formateadores siempre leen el idioma correcto.
 * - Los textos se escriben en pareja junto a su uso: `L("Horas con Sol", "Sunlit hours")`.
 * - Las tablas de etiquetas (`bi(es, en)`) devuelven la versión del idioma activo
 *   sin cambiar sus tipos ni sus llamadas.
 * - Solo se traducen TEXTOS: identificadores, valores y frases del motor
 *   (`summary_es`) no se alteran.
 */
import { Fragment, createElement, type ReactNode } from "react";

export type Locale = "es" | "en";
export const LOCALES: Locale[] = ["es", "en"];
export const LOCALE_STORAGE_KEY = "site-regret-lang";

let current: Locale = "es";

export const getLocale = (): Locale => current;
export function setLocaleUnsafe(l: Locale) {
  current = l;
}
export const isLocale = (v: unknown): v is Locale => v === "es" || v === "en";

/** Texto del idioma activo. */
export const L = (es: string, en: string): string => (current === "en" ? en : es);

/**
 * Texto con huecos `{nombre}` rellenados con nodos React (p. ej. cifras
 * resaltadas). Los huecos deben coincidir en ambos idiomas.
 */
export function R(es: string, en: string, vars: Record<string, ReactNode>): ReactNode {
  const text = current === "en" ? en : es;
  const parts = text.split(/\{(\w+)\}/g);
  return parts.map((p, i) => (i % 2 === 1 ? createElement(Fragment, { key: i }, vars[p] ?? `{${p}}`) : p));
}

/** Tabla bilingüe con la misma forma en ambos idiomas. */
export function bi<T extends object>(es: T, en: T): T {
  const pick = () => (current === "en" ? en : es) as object;
  return new Proxy(es, {
    get: (_t, k) => Reflect.get(pick(), k),
    has: (_t, k) => Reflect.has(pick(), k),
    ownKeys: () => Reflect.ownKeys(pick()),
    getOwnPropertyDescriptor: (_t, k) => {
      const d = Reflect.getOwnPropertyDescriptor(pick(), k);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

/** Etiqueta BCP 47 para Intl. */
export const intlLocale = () => (current === "en" ? "en-GB" : "es-ES");
