/**
 * Estado global de selección (puro y serializable a URL).
 *
 * - Los sitios son fijos (A = ROI 4, B = ROI 6); `focusSite` solo indica qué
 *   ficha se inspecciona.
 * - `criterion` empieza en `null`: el criterio se elige ANTES de revelar
 *   ningún ganador (plan maestro §2.7, «01 / CHOOSE»).
 * - Cambiar ventana/altura/superficie selecciona resultados precalculados;
 *   no dispara cálculos.
 */
import {
  CLOCK_SAMPLES,
  isCriterion,
  isHeightM,
  isSiteId,
  isVariant,
  isWindowId,
  type Criterion,
  type HeightM,
  type SiteId,
  type Variant,
  type WindowId,
} from "../contract/constants";

export interface Selection {
  focusSite: SiteId;
  windowId: WindowId;
  heightM: HeightM;
  variant: Variant;
  criterion: Criterion | null;
  /** Índice de intervalo dentro de la ventana (0..4319); para Timeline. */
  timeIndex: number;
}

export const DEFAULT_SELECTION: Selection = {
  focusSite: "A",
  windowId: "W1",
  heightM: 0,
  variant: "nominal",
  criterion: null,
  timeIndex: 0,
};

export type SelectionAction =
  | { type: "setFocusSite"; value: SiteId }
  | { type: "setWindow"; value: WindowId }
  | { type: "setHeight"; value: HeightM }
  | { type: "setVariant"; value: Variant }
  | { type: "setCriterion"; value: Criterion | null }
  | { type: "setTimeIndex"; value: number }
  | { type: "replace"; value: Selection };

const MAX_TIME_INDEX = CLOCK_SAMPLES - 2;

export function selectionReducer(state: Selection, action: SelectionAction): Selection {
  switch (action.type) {
    case "setFocusSite":
      return { ...state, focusSite: action.value };
    case "setWindow":
      // El índice temporal pertenece a una ventana concreta: se reinicia.
      return action.value === state.windowId ? state : { ...state, windowId: action.value, timeIndex: 0 };
    case "setHeight":
      return { ...state, heightM: action.value };
    case "setVariant":
      return { ...state, variant: action.value };
    case "setCriterion":
      return { ...state, criterion: action.value };
    case "setTimeIndex":
      return { ...state, timeIndex: clampIndex(action.value) };
    case "replace":
      return action.value;
  }
}

function clampIndex(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_TIME_INDEX, Math.max(0, Math.trunc(n)));
}

/** Parámetros de URL (cortos y estables): s, w, h, v, c, t. */
export const URL_KEYS = { focusSite: "s", windowId: "w", heightM: "h", variant: "v", criterion: "c", timeIndex: "t" } as const;

export interface ParsedSelection {
  selection: Selection;
  /** Parámetros presentes pero no válidos para este paquete. */
  rejected: string[];
}

export function parseSelection(search: string | URLSearchParams): ParsedSelection {
  const p = typeof search === "string" ? new URLSearchParams(search) : search;
  const sel: Selection = { ...DEFAULT_SELECTION };
  const rejected: string[] = [];

  const s = p.get(URL_KEYS.focusSite);
  if (s !== null) {
    if (isSiteId(s)) sel.focusSite = s;
    else rejected.push(`${URL_KEYS.focusSite}=${s}`);
  }
  const w = p.get(URL_KEYS.windowId);
  if (w !== null) {
    if (isWindowId(w)) sel.windowId = w;
    else rejected.push(`${URL_KEYS.windowId}=${w}`);
  }
  const h = p.get(URL_KEYS.heightM);
  if (h !== null) {
    const n = /^\d+$/.test(h) ? Number(h) : NaN;
    if (isHeightM(n)) sel.heightM = n;
    else rejected.push(`${URL_KEYS.heightM}=${h}`);
  }
  const v = p.get(URL_KEYS.variant);
  if (v !== null) {
    if (isVariant(v)) sel.variant = v;
    else rejected.push(`${URL_KEYS.variant}=${v}`);
  }
  const c = p.get(URL_KEYS.criterion);
  if (c !== null) {
    if (isCriterion(c)) sel.criterion = c;
    else rejected.push(`${URL_KEYS.criterion}=${c}`);
  }
  const t = p.get(URL_KEYS.timeIndex);
  if (t !== null) {
    const n = /^\d+$/.test(t) ? Number(t) : NaN;
    if (Number.isInteger(n) && n >= 0 && n <= MAX_TIME_INDEX) sel.timeIndex = n;
    else rejected.push(`${URL_KEYS.timeIndex}=${t}`);
  }
  return { selection: sel, rejected };
}

/** Serializa la selección completa (explícita: la URL reproduce el estado). */
export function serializeSelection(sel: Selection): string {
  const p = new URLSearchParams();
  p.set(URL_KEYS.focusSite, sel.focusSite);
  p.set(URL_KEYS.windowId, sel.windowId);
  p.set(URL_KEYS.heightM, String(sel.heightM));
  p.set(URL_KEYS.variant, sel.variant);
  if (sel.criterion) p.set(URL_KEYS.criterion, sel.criterion);
  if (sel.timeIndex !== 0) p.set(URL_KEYS.timeIndex, String(sel.timeIndex));
  return p.toString();
}
