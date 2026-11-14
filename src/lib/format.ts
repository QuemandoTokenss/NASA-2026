/**
 * Formato de ETIQUETAS. Ninguna decisión (ganador, empate, orden) debe
 * tomarse con valores formateados: siempre con los valores completos del JSON.
 */

const nf = (digits: number) =>
  new Intl.NumberFormat("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function formatNumber(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return nf(digits).format(Object.is(v, -0) ? 0 : v);
}

/** 38.6666… → "38 h 40 min". Las métricas son múltiplos de 10 min. */
export function formatHoursMinutes(h: number | null | undefined): string {
  if (h === null || h === undefined || !Number.isFinite(h)) return "—";
  const total = Math.round(Math.abs(h) * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  const sign = h < 0 && total > 0 ? "−" : "";
  return mm === 0 ? `${sign}${hh} h` : `${sign}${hh} h ${mm} min`;
}

export function formatDeg(v: number | null | undefined, digits = 2): string {
  return v === null || v === undefined ? "—" : `${formatNumber(v, digits)}°`;
}

export function formatLatitude(lat: number, digits = 4): string {
  return `${formatNumber(Math.abs(lat), digits)}° ${lat < 0 ? "S" : "N"}`;
}

/** Longitud positiva al este (convención del paquete). */
export function formatLongitudeEast(lonEast: number, digits = 4): string {
  return `${formatNumber(lonEast, digits)}° E`;
}

const utcFmt = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const utcDateFmt = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

export function formatUtc(iso: string): string {
  return `${utcFmt.format(new Date(iso))} UTC`;
}
export function formatUtcDate(iso: string): string {
  return utcDateFmt.format(new Date(iso));
}

export function formatBytes(n: number): string {
  if (n >= 1e6) return `${formatNumber(n / 1e6, 2)} MB`;
  if (n >= 1e3) return `${formatNumber(n / 1e3, 1)} kB`;
  return `${n} B`;
}

export function shortHash(h: string, n = 12) {
  return h.length > n ? `${h.slice(0, n)}…` : h;
}
