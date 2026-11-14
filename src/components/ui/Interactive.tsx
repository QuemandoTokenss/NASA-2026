"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { L } from "@/lib/i18n";

/* ------------------------------ Tooltip ---------------------------------- */

/**
 * Tooltip accesible: aparece con hover y con foco de teclado; el contenido
 * queda enlazado con aria-describedby. Escape lo cierra.
 */
const TIP_W = 288;

export function Tooltip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" }) {
  const id = useId();
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const above = side === "top" ? r.top > 120 : r.bottom > window.innerHeight - 120;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - TIP_W / 2), window.innerWidth - TIP_W - 8);
    setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above });
  };
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setPos(null)}
      onKeyDown={(e) => e.key === "Escape" && setPos(null)}
    >
      <span aria-describedby={pos ? id : undefined} className="inline-flex">
        {children}
      </span>
      {pos ? (
        // Posición fija y acotada a la ventana: nunca provoca scroll horizontal.
        <span
          id={id}
          role="tooltip"
          style={{ left: pos.left, top: pos.top, width: TIP_W, transform: pos.above ? "translateY(-100%)" : undefined }}
          className="pointer-events-none fixed z-[60] animate-[tip-in_140ms_ease-out] rounded-lg border border-line-strong bg-[#0a1426f5] px-3 py-2 text-left text-xs leading-relaxed font-normal normal-case tracking-normal text-ink-muted shadow-[0_12px_32px_-8px_#000] backdrop-blur"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

/** Icono «i» con explicación. */
export function InfoTip({ children, label }: { children: ReactNode; label?: string }) {
  label ??= L("Más información", "More information");
  return (
    <Tooltip content={children}>
      <button type="button" aria-label={label} className="rounded-full text-ink-faint transition-colors hover:text-ink">
        <Icon name="info" className="size-4" />
      </button>
    </Tooltip>
  );
}

/* ------------------------------ Botones ---------------------------------- */

const BTN = {
  primary:
    "border-accent-strong/70 bg-gradient-to-b from-[#2a5bd7] to-[#1d47b4] text-white shadow-[0_0_0_1px_#ffffff10_inset,0_8px_24px_-10px_#3a6ff0] hover:from-[#3468e6] hover:to-[#2150c4]",
  regret:
    "border-uncertainty/60 bg-gradient-to-b from-[#7c5cf0] to-[#5b3fd0] text-white shadow-[0_0_0_1px_#ffffff10_inset,0_8px_24px_-10px_#a78bfa] hover:from-[#8a6cf5] hover:to-[#6849dc]",
  secondary: "border-line-strong bg-surface-2 text-ink hover:border-accent/50 hover:bg-surface-3",
  ghost: "border-transparent bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink",
} as const;
export type ButtonVariant = keyof typeof BTN;

const btnClass = (variant: ButtonVariant, size: "sm" | "md") =>
  `inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-all duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-40 ${
    size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm"
  } ${BTN[variant]}`;

export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  disabled,
  title,
  type = "button",
  className = "",
  pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  className?: string;
  pressed?: boolean;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} aria-pressed={pressed} className={`${btnClass(variant, size)} ${className}`}>
      {icon ? <Icon name={icon} className="size-4" /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} className="size-4" /> : null}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
  size = "md",
  icon,
  iconRight = "arrowRight",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: IconName;
  iconRight?: IconName | null;
  className?: string;
}) {
  return (
    <Link href={href} className={`${btnClass(variant, size)} ${className}`}>
      {icon ? <Icon name={icon} className="size-4" /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} className="size-4" /> : null}
    </Link>
  );
}
