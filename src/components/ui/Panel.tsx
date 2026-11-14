import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Contenedor base de todas las pantallas (estilo Explore v2). */
export function Panel({
  title,
  icon,
  actions,
  footer,
  children,
  className = "",
  bodyClassName = "",
  as: Tag = "section",
  id,
}: {
  title?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "aside" | "div";
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Tag
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={`flex min-w-0 flex-col rounded-2xl border border-line bg-surface/85 shadow-[0_1px_0_0_#ffffff08_inset,0_20px_40px_-24px_#000] backdrop-blur-sm ${className}`}
    >
      {title ? (
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          {icon ? <Icon name={icon} className="size-5 shrink-0 text-ink-muted" /> : null}
          <h2 id={headingId} className="min-w-0 flex-1 text-[15px] font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`min-w-0 flex-1 p-4 sm:p-5 ${bodyClassName}`}>{children}</div>
      {footer ? <footer className="border-t border-line px-4 py-3 text-xs text-ink-faint sm:px-5">{footer}</footer> : null}
    </Tag>
  );
}

/** Sub-sección dentro de un panel. */
export function PanelSection({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{title}</h3>
      {children}
    </div>
  );
}

/** Cabecera de pantalla: etiqueta de sección + título + subtítulo + acciones. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">{eyebrow}</p>
        <div className="mt-1 flex flex-col gap-1 md:flex-row md:items-baseline md:gap-5">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-ink-muted md:border-l md:border-line md:pl-5">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-end gap-3">{actions}</div> : null}
    </div>
  );
}
