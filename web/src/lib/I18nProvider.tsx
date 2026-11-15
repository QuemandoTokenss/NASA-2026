"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { LOCALE_STORAGE_KEY, isLocale, setLocaleUnsafe, type Locale } from "./i18n";

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({ locale: "es", setLocale: () => {} });

function storeLocale(l: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, l);
  } catch {
    /* preferencia no persistente */
  }
}

/** Un `?lang=` válido manda sobre la preferencia guardada y pasa a ser la preferencia. */
function initialLocale(): Locale | null {
  const q = new URLSearchParams(window.location.search).get("lang");
  if (isLocale(q)) {
    storeLocale(q);
    return q;
  }
  try {
    const s = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(s)) return s;
  } catch {
    /* almacenamiento no disponible: se usa el idioma por defecto */
  }
  return null;
}

/**
 * Idioma de la interfaz. El export estático se genera en español; en el
 * cliente se adopta `?lang=en` (que además se guarda, para que sobreviva a la
 * navegación y a la recarga) o la preferencia guardada. Cambiar de idioma
 * remonta la interfaz (la selección vive por encima y se conserva).
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es");
  setLocaleUnsafe(locale);

  useEffect(() => {
    const l = initialLocale();
    // Adopción única tras la hidratación (el HTML estático está en español).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (l && l !== "es") setLocaleState(l);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    storeLocale(l);
    setLocaleState(l);
  }, []);

  return <Ctx.Provider value={{ locale, setLocale }}>{children}</Ctx.Provider>;
}

export const useLocale = () => useContext(Ctx);

/** Remonta su contenido al cambiar de idioma (todos los textos se recalculan). */
export function LocaleKeyed({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  return <div key={locale} className="contents">{children}</div>;
}
