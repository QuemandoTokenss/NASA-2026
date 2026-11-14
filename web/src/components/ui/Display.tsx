import type { ReactNode } from "react";
import type { SiteId, StateName, Winner } from "@/lib/contract/constants";
import { NATURE_META, SITE_META, STATE_META, WINNER_LABEL, type Nature } from "@/lib/labels";
import { Icon, type IconName } from "./Icon";
import { L } from "@/lib/i18n";

/* ----------------------------- Sitios ----------------------------------- */

export function SiteDot({ site, className = "size-2.5" }: { site: SiteId; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full ${SITE_META[site].bgClass} ${className}`} />;
}

export function SiteTag({ site, children }: { site: SiteId; children?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold ${SITE_META[site].textClass}`}>
      <SiteDot site={site} />
      {children ?? SITE_META[site].label}
    </span>
  );
}

/* ----------------------------- Insignias -------------------------------- */

const TONE = {
  neutral: "border-line-strong bg-surface-2 text-ink-muted",
  accent: "border-accent-strong/60 bg-accent-surface text-accent",
  ok: "border-ok/40 bg-ok/10 text-ok",
  warn: "border-warn/40 bg-warn/10 text-warn",
  danger: "border-danger/40 bg-danger/10 text-danger",
  uncertainty: "border-uncertainty/40 bg-uncertainty-soft text-uncertainty",
  a: "border-site-a/40 bg-site-a-soft text-site-a",
  b: "border-site-b/40 bg-site-b-soft text-site-b",
} as const;
export type Tone = keyof typeof TONE;

export function Badge({ tone = "neutral", icon, children, title }: { tone?: Tone; icon?: IconName; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${TONE[tone]}`}>
      {icon ? <Icon name={icon} className="size-3.5" /> : null}
      {children}
    </span>
  );
}

const NATURE_TONE: Record<Nature, Tone> = { OBSERVED: "neutral", DERIVED: "accent", MODELED: "uncertainty", SIMULATED: "warn" };

/** Etiqueta de naturaleza del dato (plan maestro §0.2). */
export function NatureBadge({ nature }: { nature: Nature }) {
  return (
    <Badge tone={NATURE_TONE[nature]} title={NATURE_META[nature].description}>
      {NATURE_META[nature].label}
    </Badge>
  );
}

/** Resultado de una comparación. TIE y UNKNOWN tienen apariencia propia. */
export function WinnerTag({ winner, short = false }: { winner: Winner; short?: boolean }) {
  if (winner === "A" || winner === "B") return <Badge tone={winner === "A" ? "a" : "b"}>{short ? winner : WINNER_LABEL[winner]}</Badge>;
  if (winner === "TIE")
    return (
      <Badge tone="neutral" title={WINNER_LABEL.TIE}>
        {short ? L("Empate", "Tie") : WINNER_LABEL.TIE}
      </Badge>
    );
  return (
    <Badge tone="warn" icon="alert" title={WINNER_LABEL.UNKNOWN}>
      {short ? "?" : WINNER_LABEL.UNKNOWN}
    </Badge>
  );
}

/* ----------------------------- Métricas --------------------------------- */

/** Fila etiqueta/valor, con valores opcionales por sitio. */
export function MetricRow({
  icon,
  label,
  hint,
  value,
  a,
  b,
}: {
  icon?: IconName;
  label: ReactNode;
  hint?: ReactNode;
  value?: ReactNode;
  a?: ReactNode;
  b?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line/70 py-2.5 last:border-b-0">
      {icon ? <Icon name={icon} className="size-[18px] shrink-0 text-ink-faint" /> : null}
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ink">{label}</div>
        {hint ? <div className="text-xs text-ink-faint">{hint}</div> : null}
      </div>
      {value !== undefined ? <div className="tabular shrink-0 text-right text-sm font-semibold text-ink">{value}</div> : null}
      {a !== undefined ? <div className="tabular w-24 shrink-0 text-right text-sm font-semibold text-site-a">{a}</div> : null}
      {b !== undefined ? <div className="tabular w-24 shrink-0 text-right text-sm font-semibold text-site-b">{b}</div> : null}
    </div>
  );
}

/** Tarjeta de cifra principal (KPI). Solo para valores presentes en el paquete. */
export function StatTile({
  label,
  value,
  unit,
  detail,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  icon?: IconName;
  tone?: "neutral" | "a" | "b" | "uncertainty";
}) {
  const accent = { neutral: "text-ink", a: "text-site-a", b: "text-site-b", uncertainty: "text-uncertainty" }[tone];
  return (
    <div className="rounded-xl border border-line bg-surface-2/70 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        {icon ? <Icon name={icon} className="size-4" /> : null}
        {label}
      </div>
      <div className={`tabular mt-1.5 text-2xl font-bold tracking-tight ${accent}`}>
        {value}
        {unit ? <span className="ml-1 text-sm font-medium text-ink-muted">{unit}</span> : null}
      </div>
      {detail ? <div className="mt-1 text-xs text-ink-faint">{detail}</div> : null}
    </div>
  );
}

/** Lista de definición compacta. */
export function KeyValueList({ items }: { items: Array<{ k: ReactNode; v: ReactNode; mono?: boolean }> }) {
  return (
    <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="text-ink-muted">{it.k}</dt>
          <dd className={`min-w-0 text-right break-words text-ink ${it.mono ? "font-mono text-xs" : "tabular"}`}>{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ----------------------------- Leyendas --------------------------------- */

export interface LegendItem {
  label: string;
  color: string;
  shape?: "line" | "dash" | "swatch";
  pattern?: "hatch";
  description?: string;
}

export function Legend({ items, className = "" }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-muted ${className}`}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2" title={it.description}>
          {it.shape === "line" || it.shape === "dash" ? (
            <svg width="22" height="8" aria-hidden>
              <line x1="1" y1="4" x2="21" y2="4" stroke={it.color} strokeWidth="2.5" strokeDasharray={it.shape === "dash" ? "4 3" : undefined} strokeLinecap="round" />
            </svg>
          ) : (
            <span
              aria-hidden
              className={`inline-block h-3 w-4 rounded-[3px] border border-white/10 ${it.pattern === "hatch" ? "pattern-hatch" : ""}`}
              style={it.pattern === "hatch" ? undefined : { background: it.color }}
            />
          )}
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Leyenda de los cinco estados del contrato, con texto y trama para desconocido. */
export function StateLegend({ className }: { className?: string }) {
  const order: StateName[] = ["BOTH", "SUN_ONLY", "EARTH_ONLY", "NEITHER", "UNKNOWN"];
  return (
    <Legend
      className={className}
      items={order.map((s) => ({
        label: STATE_META[s].label,
        color: STATE_META[s].colorVar,
        pattern: STATE_META[s].pattern,
        description: STATE_META[s].description,
      }))}
    />
  );
}

/* ----------------------------- Avisos ----------------------------------- */

export function Callout({
  tone = "neutral",
  icon = "info",
  title,
  children,
}: {
  tone?: "neutral" | "warn" | "danger" | "uncertainty" | "ok";
  icon?: IconName;
  title?: ReactNode;
  children: ReactNode;
}) {
  const style = {
    neutral: "border-line bg-surface-2/60 text-ink-muted",
    warn: "border-warn/35 bg-warn/[0.07] text-ink-muted",
    danger: "border-danger/40 bg-danger/[0.08] text-ink-muted",
    uncertainty: "border-uncertainty/35 bg-uncertainty-soft text-ink-muted",
    ok: "border-ok/35 bg-ok/[0.07] text-ink-muted",
  }[tone];
  const iconColor = { neutral: "text-ink-muted", warn: "text-warn", danger: "text-danger", uncertainty: "text-uncertainty", ok: "text-ok" }[tone];
  return (
    <div className={`flex gap-3 rounded-xl border p-3.5 text-sm ${style}`}>
      <Icon name={icon} className={`mt-0.5 size-[18px] shrink-0 ${iconColor}`} />
      <div className="min-w-0">
        {title ? <p className="mb-0.5 font-semibold text-ink">{title}</p> : null}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-surface-3/70 ${className}`} />;
}
