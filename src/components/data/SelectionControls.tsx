"use client";

import { HEIGHTS_M, SITE_IDS, VARIANTS, CRITERIA, variantFamily, type Variant, type VariantFamily } from "@/lib/contract/constants";
import type { Core } from "@/lib/contract/schema";
import { formatUtcDate } from "@/lib/format";
import { CRITERION_META, FAMILY_META, SITE_META, VARIANT_LABEL } from "@/lib/labels";
import { useSelection } from "@/lib/state/SelectionProvider";
import { Segmented, SelectField, type SelectGroup } from "../ui/Controls";
import { SiteDot } from "../ui/Display";

/** Ventana: solo las dos ventanas calculadas, con sus fechas UTC reales. */
export function WindowControl({ core }: { core: Core }) {
  const { selection, dispatch } = useSelection();
  return (
    <Segmented
      label="Ventana (UTC)"
      value={selection.windowId}
      onChange={(v) => dispatch({ type: "setWindow", value: v })}
      options={core.configuration.windows.map((w) => ({
        value: w.id,
        label: (
          <span>
            {w.id}
            <span className="ml-1.5 hidden text-ink-faint sm:inline">
              {formatUtcDate(w.start)} → {formatUtcDate(w.stop)}
            </span>
          </span>
        ),
        ariaLabel: `${w.id}: ${formatUtcDate(w.start)} a ${formatUtcDate(w.stop)} UTC`,
        hint: `${w.start} → ${w.stop}`,
      }))}
    />
  );
}

/** Altura del observador: solo 0/2/10 m precalculados (no hay slider continuo). */
export function HeightControl() {
  const { selection, dispatch } = useSelection();
  return (
    <Segmented
      label="Altura del observador"
      value={selection.heightM}
      onChange={(v) => dispatch({ type: "setHeight", value: v })}
      options={HEIGHTS_M.map((h) => ({ value: h, label: `${h} m`, hint: h === 0 ? "Sobre el terreno" : `Mástil simulado de ${h} m` }))}
    />
  );
}

const FAMILIES: VariantFamily[] = ["nominal", "own", "published"];

/** Superficie (variante del DEM), agrupada por familia sin mezclarlas. */
export function VariantControl() {
  const { selection, dispatch } = useSelection();
  const groups: SelectGroup<Variant>[] = FAMILIES.map((f) => ({
    label: FAMILY_META[f].label,
    options: VARIANTS.filter((v) => variantFamily(v) === f).map((v) => ({ value: v, label: VARIANT_LABEL[v] })),
  }));
  return (
    <SelectField
      label="Superficie del terreno"
      value={selection.variant}
      onChange={(v) => v && dispatch({ type: "setVariant", value: v })}
      groups={groups}
      className="min-w-52"
    />
  );
}

/** Criterio: empieza vacío; debe elegirse antes de ver un ganador. */
export function CriterionControl() {
  const { selection, dispatch } = useSelection();
  return (
    <SelectField
      label="Criterio de decisión"
      value={selection.criterion}
      onChange={(v) => dispatch({ type: "setCriterion", value: v })}
      placeholder="— Elegir antes de comparar —"
      groups={[{ label: "Criterios del motor", options: CRITERIA.map((c) => ({ value: c, label: CRITERION_META[c].label })) }]}
      className="min-w-64"
    />
  );
}

export function FocusSiteControl() {
  const { selection, dispatch } = useSelection();
  return (
    <Segmented
      label="Sitio inspeccionado"
      value={selection.focusSite}
      onChange={(v) => dispatch({ type: "setFocusSite", value: v })}
      options={SITE_IDS.map((s) => ({
        value: s,
        ariaLabel: SITE_META[s].label,
        label: (
          <span className="inline-flex items-center gap-2">
            <SiteDot site={s} />
            {SITE_META[s].label}
          </span>
        ),
      }))}
    />
  );
}
