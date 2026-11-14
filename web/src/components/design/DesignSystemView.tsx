"use client";

import { useState } from "react";
import { Segmented, SelectField, Toggle } from "../ui/Controls";
import { Badge, Callout, KeyValueList, Legend, MetricRow, NatureBadge, SiteTag, Skeleton, StateLegend, WinnerTag } from "../ui/Display";
import { PageHeader, Panel, PanelSection } from "../ui/Panel";

const TOKENS: Array<{ group: string; items: Array<{ name: string; varName: string; note: string }> }> = [
  {
    group: "Datos",
    items: [
      { name: "Sitio A", varName: "--color-site-a", note: "ROI 4" },
      { name: "Sitio B", varName: "--color-site-b", note: "ROI 6" },
      { name: "Incertidumbre", varName: "--color-uncertainty", note: "Variantes / MODELED" },
    ],
  },
  {
    group: "Estados",
    items: [
      { name: "Sol y Tierra", varName: "--color-state-both", note: "BOTH (3)" },
      { name: "Solo Sol", varName: "--color-state-sun", note: "SUN_ONLY (1)" },
      { name: "Solo Tierra", varName: "--color-state-earth", note: "EARTH_ONLY (2)" },
      { name: "Ninguno", varName: "--color-state-neither", note: "NEITHER (0)" },
      { name: "Desconocido", varName: "--color-state-unknown", note: "UNKNOWN (4) + trama" },
    ],
  },
  {
    group: "Interfaz",
    items: [
      { name: "Fondo", varName: "--color-bg", note: "" },
      { name: "Superficie", varName: "--color-surface", note: "Paneles" },
      { name: "Línea", varName: "--color-line", note: "Bordes" },
      { name: "Acento", varName: "--color-accent", note: "Navegación y foco" },
      { name: "Aviso", varName: "--color-warn", note: "" },
      { name: "Error", varName: "--color-danger", note: "" },
    ],
  },
];

/** Catálogo de componentes. Usa textos de ejemplo, nunca cifras científicas inventadas. */
export function DesignSystemView() {
  const [seg, setSeg] = useState<"x" | "y" | "z">("x");
  const [sel, setSel] = useState<string | null>(null);
  const [tog, setTog] = useState(true);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Referencia" title="Sistema de diseño" subtitle="Tokens y componentes reutilizables de SITE REGRET" />

      <Panel title="Tokens de color" icon="layers">
        <div className="grid gap-6 lg:grid-cols-3">
          {TOKENS.map((g) => (
            <PanelSection key={g.group} title={g.group}>
              <ul className="flex flex-col gap-2">
                {g.items.map((t) => (
                  <li key={t.varName} className="flex items-center gap-3">
                    <span
                      className={`h-7 w-10 rounded-md border border-white/10 ${t.varName === "--color-state-unknown" ? "pattern-hatch" : ""}`}
                      style={t.varName === "--color-state-unknown" ? undefined : { background: `var(${t.varName})` }}
                    />
                    <span className="min-w-0 flex-1 text-sm text-ink">{t.name}</span>
                    <code className="font-mono text-[11px] text-ink-faint">{t.varName}</code>
                  </li>
                ))}
              </ul>
            </PanelSection>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Controles" icon="target">
          <div className="flex flex-col gap-5">
            <Segmented
              label="Control segmentado (flechas para moverse)"
              value={seg}
              onChange={setSeg}
              options={[
                { value: "x", label: "Opción 1" },
                { value: "y", label: "Opción 2" },
                { value: "z", label: "Deshabilitada", disabled: true },
              ]}
            />
            <SelectField
              label="Desplegable con grupos"
              value={sel}
              onChange={setSel}
              placeholder="— Elegir —"
              groups={[
                { label: "Grupo 1", options: [{ value: "a", label: "Elemento a" }] },
                { label: "Grupo 2", options: [{ value: "b", label: "Elemento b" }] },
              ]}
            />
            <Toggle label="Interruptor" description="role=switch" checked={tog} onChange={setTog} />
          </div>
        </Panel>

        <Panel title="Insignias y etiquetas" icon="info">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <NatureBadge nature="OBSERVED" />
              <NatureBadge nature="DERIVED" />
              <NatureBadge nature="MODELED" />
              <NatureBadge nature="SIMULATED" />
            </div>
            <div className="flex flex-wrap gap-2">
              <WinnerTag winner="A" />
              <WinnerTag winner="B" />
              <WinnerTag winner="TIE" />
              <WinnerTag winner="UNKNOWN" />
            </div>
            <div className="flex flex-wrap gap-4">
              <SiteTag site="A" />
              <SiteTag site="B" />
              <Badge tone="uncertainty">Variante modelada</Badge>
            </div>
            <StateLegend />
            <Legend
              items={[
                { label: "Serie A", color: "var(--color-site-a)", shape: "line" },
                { label: "Serie B", color: "var(--color-site-b)", shape: "line" },
                { label: "Referencia", color: "var(--color-ink-faint)", shape: "dash" },
              ]}
            />
          </div>
        </Panel>

        <Panel title="Métricas" icon="compare">
          <MetricRow icon="sun" label="Fila de métrica" hint="Etiqueta secundaria con unidades" value="valor" />
          <MetricRow icon="earth" label="Fila A/B" hint="Columnas por sitio" a="valor A" b="valor B" />
          <div className="mt-4">
            <KeyValueList items={[{ k: "Clave", v: "Valor" }, { k: "Hash", v: "0123abcd…", mono: true }]} />
          </div>
        </Panel>

        <Panel title="Avisos y carga" icon="alert">
          <div className="flex flex-col gap-3">
            <Callout tone="neutral" title="Información">Texto informativo.</Callout>
            <Callout tone="warn" icon="alert" title="Aviso">Resultado con limitaciones.</Callout>
            <Callout tone="uncertainty" title="Incertidumbre">Hipótesis modelada, no medida.</Callout>
            <Callout tone="danger" icon="alert" title="Error">Datos no válidos: no se muestra ningún resultado.</Callout>
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
