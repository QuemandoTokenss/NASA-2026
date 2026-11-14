"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useData } from "@/lib/data/DataProvider";
import { shortHash } from "@/lib/format";
import { NAV, normalizePath } from "@/lib/nav";
import { useSelection } from "@/lib/state/SelectionProvider";
import { Callout } from "../ui/Display";
import { Icon } from "../ui/Icon";

function Logo() {
  return (
    <svg viewBox="0 0 40 28" className="h-7 w-10 shrink-0" aria-hidden>
      <defs>
        <linearGradient id="sr-arc" x1="0" x2="1">
          <stop offset="0" stopColor="#e8eef8" stopOpacity="0.35" />
          <stop offset="1" stopColor="#e8eef8" />
        </linearGradient>
      </defs>
      <path d="M4 26a16 16 0 0 1 32 0" fill="none" stroke="url(#sr-arc)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11 26a9 9 0 0 1 18 0" fill="none" stroke="#e8eef8" strokeOpacity="0.25" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function NavLinks({ onNavigate, vertical = false }: { onNavigate?: () => void; vertical?: boolean }) {
  const pathname = normalizePath(usePathname() ?? "/");
  const { query } = useSelection();
  return (
    <ul className={vertical ? "flex flex-col gap-1" : "flex items-stretch gap-1"}>
      {NAV.map((item) => {
        const active = normalizePath(item.href) === pathname;
        return (
          <li key={item.href} className="flex">
            <Link
              href={`${item.href}?${query}`}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-2 rounded-lg px-3 text-sm font-medium transition-all duration-200 ${
                vertical ? "w-full py-2.5" : "py-2"
              } ${
                active
                  ? "bg-gradient-to-b from-accent-surface to-[#0d1d3a] text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong),0_0_24px_-8px_#3a6ff0]"
                  : "text-ink-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon name={item.icon} className={`size-[18px] transition-colors ${active ? "text-accent" : "group-hover:text-ink"}`} />
              {vertical ? (
                <span className="whitespace-nowrap">{item.label}</span>
              ) : (
                <>
                  <span className="whitespace-nowrap 2xl:hidden">{item.short}</span>
                  <span className="hidden whitespace-nowrap 2xl:inline">{item.label}</span>
                </>
              )}
              {active && !vertical ? (
                <span aria-hidden className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-accent shadow-[0_0_10px_#8fb4ff]" />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DataStatusPill() {
  const { state } = useData();
  if (state.status === "loading")
    return <span className="text-xs text-ink-faint" aria-live="polite">Cargando datos…</span>;
  if (state.status === "error")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
        <Icon name="alert" className="size-4" /> Datos no válidos
      </span>
    );
  const verified = state.integrity === "verified";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        verified ? "border-ok/30 text-ok" : "border-warn/40 text-warn"
      }`}
      title={`${state.core.schema_version} · paquete sha256 ${state.manifest.source.sha256}`}
    >
      <Icon name={verified ? "shield" : "alert"} className="size-4" />
      <span className="hidden sm:inline">{state.core.schema_version}</span>
      <span className="font-mono">{shortHash(state.manifest.source.sha256, 8)}</span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState(pathname);
  const { rejectedParams } = useSelection();

  // Cerrar el menú móvil al cambiar de ruta (ajuste durante el render) o con Escape.
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent-strong focus:px-3 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="SITE REGRET — inicio">
            <Logo />
            <span className="flex flex-col leading-none">
              <span className="text-lg font-bold tracking-[0.08em] text-ink">SITE REGRET</span>
              <span className="mt-1 hidden text-[10px] font-medium tracking-[0.22em] text-ink-faint sm:block">
                LUNAR LANDING SITE NAVIGATOR
              </span>
            </span>
          </Link>
          <nav aria-label="Secciones" className="ml-4 hidden min-w-0 flex-1 justify-center xl:flex">
            <NavLinks />
          </nav>
          <div className="ml-auto flex items-center gap-2 xl:ml-0">
            <DataStatusPill />
            <button
              type="button"
              className="rounded-lg border border-line p-2 text-ink-muted hover:text-ink xl:hidden"
              aria-expanded={open}
              aria-controls="menu-movil"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              onClick={() => setOpen((v) => !v)}
            >
              <Icon name={open ? "close" : "menu"} />
            </button>
          </div>
        </div>
        {open ? (
          <nav id="menu-movil" aria-label="Secciones" className="border-t border-line bg-bg px-4 py-3 xl:hidden">
            <NavLinks vertical onNavigate={() => setOpen(false)} />
          </nav>
        ) : null}
      </header>

      <main id="contenido" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {rejectedParams.length ? (
          <div className="mb-4">
            <Callout tone="warn" icon="alert" title="Parámetros de URL ignorados">
              {rejectedParams.join(", ")} no corresponden a combinaciones calculadas; se usan los valores por defecto.
            </Callout>
          </div>
        ) : null}
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-5 text-xs text-ink-faint sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>
            SITE REGRET · equipo QuemandoTokens · NASA International Space Apps Challenge 2026. Datos: NASA PGDA, LRO-LOLA, JPL/NAIF
            DE421 y JPL Horizons. No implica respaldo de la NASA ni aptitud operacional.
          </p>
          <p className="flex gap-4">
            <Link href="/sistema-diseno/" className="hover:text-ink">
              Sistema de diseño
            </Link>
            <Link href="/evidencia/" className="hover:text-ink">
              Límites y fuentes
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
