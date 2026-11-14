"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./Icon";

export interface Option<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Texto accesible si `label` no es texto plano. */
  ariaLabel?: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * Control segmentado accesible (patrón radiogroup: flechas para moverse,
 * tabulador entra/sale del grupo). Para conjuntos pequeños y cerrados:
 * ventanas W1/W2, alturas 0/2/10, sitio A/B.
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size = "md",
  hideLabel = false,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  hideLabel?: boolean;
}) {
  const labelId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.filter((o) => !o.disabled);

  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const idx = enabled.findIndex((o) => o.value === value);
    const next = enabled[(idx + dir + enabled.length) % enabled.length];
    onChange(next.value);
    refs.current[options.indexOf(next)]?.focus();
  }

  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className={hideLabel ? "sr-only" : "text-xs font-medium text-ink-muted"}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="inline-flex w-fit max-w-full flex-wrap rounded-xl border border-line bg-bg-2 p-1">
        {options.map((o, i) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.ariaLabel}
              title={o.hint}
              disabled={o.disabled}
              tabIndex={active ? 0 : -1}
              onKeyDown={onKey}
              onClick={() => onChange(o.value)}
              className={`tabular rounded-lg font-medium transition-colors ${pad} ${
                active
                  ? "bg-accent-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
                  : "text-ink-muted hover:bg-surface-2 hover:text-ink"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface SelectGroup<T extends string> {
  label: string;
  options: Option<T>[];
}

/** Desplegable nativo estilizado (teclado y lectores de pantalla nativos). */
export function SelectField<T extends string>({
  label,
  value,
  onChange,
  groups,
  placeholder,
  hideLabel = false,
  className = "",
}: {
  label: string;
  value: T | null;
  onChange: (v: T | null) => void;
  groups: SelectGroup<T>[];
  placeholder?: string;
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-xs font-medium text-ink-muted"}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as T))}
          className="w-full appearance-none rounded-xl border border-line bg-bg-2 py-2 pr-9 pl-3 text-sm text-ink hover:border-line-strong"
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {groups.map((g) =>
            groups.length === 1 ? (
              g.options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {typeof o.label === "string" ? o.label : (o.ariaLabel ?? o.value)}
                </option>
              ))
            ) : (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.disabled}>
                    {typeof o.label === "string" ? o.label : (o.ariaLabel ?? o.value)}
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </select>
        <Icon name="chevronDown" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted" />
      </div>
    </div>
  );
}

/** Interruptor accesible (role="switch"). */
export function Toggle({
  label,
  checked,
  onChange,
  disabled,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span id={id} className="block text-sm text-ink">
          {label}
        </span>
        {description ? <span className="block text-xs text-ink-faint">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-40 ${
          checked ? "border-accent-strong bg-accent-strong" : "border-line-strong bg-surface-3"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0 size-[18px] rounded-full bg-white transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}
