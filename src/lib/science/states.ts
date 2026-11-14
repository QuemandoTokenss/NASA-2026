/**
 * Utilidades sobre estados categóricos (state_names 0..4).
 * El código i describe el intervalo [times_utc[i], times_utc[i+1]) de 10 min.
 * Nunca se interpolan: solo se cuentan o se agrupan en tramos.
 */
import { STATE_NAMES, type StateName } from "../contract/constants";
import type { Interval } from "../contract/schema";

export const STEP_MINUTES = 10;
export const STEP_MS = STEP_MINUTES * 60_000;

export const sunVisible = (code: number) => code === 1 || code === 3;
export const earthVisible = (code: number) => code === 2 || code === 3;

/** Muestras por estado (índice = código). */
export function countStates(codes: ArrayLike<number>): number[] {
  const out = [0, 0, 0, 0, 0];
  for (let i = 0; i < codes.length; i++) out[codes[i]]++;
  return out;
}

export const samplesToHours = (n: number) => (n * STEP_MINUTES) / 60;

export interface Run {
  start: number; // índice de intervalo inclusivo
  end: number; // exclusivo
  value: boolean;
}

/** Tramos de una propiedad booleana derivada del estado (p. ej. «Sol visible»). */
export function booleanRuns(codes: ArrayLike<number>, predicate: (c: number) => boolean): Run[] {
  const runs: Run[] = [];
  let start = 0;
  for (let i = 1; i <= codes.length; i++) {
    if (i === codes.length || predicate(codes[i]) !== predicate(codes[start])) {
      runs.push({ start, end: i, value: predicate(codes[start]) });
      start = i;
    }
  }
  return runs;
}

/** Índice de intervalo de un instante UTC dentro de la ventana. */
export function indexOf(windowStartIso: string, iso: string) {
  return Math.round((Date.parse(iso) - Date.parse(windowStartIso)) / STEP_MS);
}

export interface IndexedInterval extends Interval {
  startIndex: number;
  endIndex: number;
}

export function indexIntervals(windowStartIso: string, intervals: Interval[]): IndexedInterval[] {
  return intervals.map((iv) => ({ ...iv, startIndex: indexOf(windowStartIso, iv.start), endIndex: indexOf(windowStartIso, iv.stop) }));
}

/** Intervalo que contiene el índice i (búsqueda binaria). */
export function intervalAt(list: IndexedInterval[], i: number): IndexedInterval | undefined {
  let lo = 0;
  let hi = list.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (i < list[mid].startIndex) hi = mid - 1;
    else if (i >= list[mid].endIndex) lo = mid + 1;
    else return list[mid];
  }
  return undefined;
}

export const stateName = (code: number): StateName => STATE_NAMES[code] ?? "UNKNOWN";
