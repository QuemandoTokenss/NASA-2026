/**
 * Representación en color de un raster NUMÉRICO. El color es solo una vista:
 * las lecturas se hacen siempre sobre los valores, no sobre estos píxeles.
 * `NaN` (nodata) se dibuja transparente.
 */
import type { RasterGrid } from "./raster";
import type { TerrainLayerId } from "./terrain";

export type Rgb = [number, number, number];

export interface LayerStyle {
  stops: Rgb[];
  /** Valores enteros con un color por clase (p. ej. nº de retornos LOLA). */
  discrete?: boolean;
}

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export const LAYER_STYLE: Record<TerrainLayerId, LayerStyle> = {
  // Misma paleta que la figura original del motor (azul = bajo, arena = alto).
  elevation: { stops: ["#234b6e", "#3d5c74", "#566d79", "#6d7c7f", "#868d84", "#9e9d8a", "#b6ad8f", "#cebd95", "#e6cd9b"].map(hex) },
  slope: { stops: ["#0d0887", "#5b02a3", "#9a179b", "#cb4678", "#eb7852", "#fbb32f", "#f0f921"].map(hex) },
  vertical_rms: { stops: ["#0b1026", "#3b1c6e", "#7b2382", "#b63679", "#eb5760", "#fe9f6d", "#fcfdbf"].map(hex) },
  slope_rms: { stops: ["#0b1026", "#3b1c6e", "#7b2382", "#b63679", "#eb5760", "#fe9f6d", "#fcfdbf"].map(hex) },
  // 0 = sin retornos (altura interpolada) en gris; 1…4 retornos en verdes.
  lola_count: { stops: ["#4b5568", "#2f7f5f", "#3fae6f", "#7fd98a", "#d6f5a8"].map(hex), discrete: true },
};

export function rampColor(stops: Rgb[], t: number): Rgb {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export const rgbCss = (c: Rgb) => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;
export const rampCss = (stops: Rgb[]) => `linear-gradient(90deg, ${stops.map(rgbCss).join(", ")})`;

/** RGBA (fila 0 arriba) del raster coloreado entre `min` y `max`. */
export function colorizeRaster(g: RasterGrid, min: number, max: number, style: LayerStyle): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(g.width * g.height * 4);
  const span = max - min || 1;
  for (let i = 0; i < g.data.length; i++) {
    const v = g.data[i];
    if (!Number.isFinite(v)) continue; // nodata → transparente
    const c = style.discrete ? style.stops[Math.min(style.stops.length - 1, Math.max(0, Math.round(v - min)))] : rampColor(style.stops, (v - min) / span);
    out[4 * i] = c[0];
    out[4 * i + 1] = c[1];
    out[4 * i + 2] = c[2];
    out[4 * i + 3] = 255;
  }
  return out;
}

/**
 * Relieve sombreado calculado a partir del DEM. La luz es SINTÉTICA (viene de
 * la esquina superior izquierda del mapa, 45° de altura) y solo sirve para
 * leer la forma del terreno: no es la iluminación solar real de ningún instante.
 */
export function hillshade(g: RasterGrid, lightFromMapDeg = 315, altitudeDeg = 45): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(g.width * g.height * 4);
  const az = (lightFromMapDeg * Math.PI) / 180;
  const alt = (altitudeDeg * Math.PI) / 180;
  // Vector hacia la luz en el plano del mapa (x a la derecha, y arriba).
  const lx = Math.sin(az) * Math.cos(alt);
  const ly = Math.cos(az) * Math.cos(alt);
  const lz = Math.sin(alt);
  const w = g.width;
  const h = g.height;
  const d = g.data;
  for (let r = 0; r < h; r++) {
    const rN = Math.max(0, r - 1);
    const rS = Math.min(h - 1, r + 1);
    for (let c = 0; c < w; c++) {
      const cW = Math.max(0, c - 1);
      const cE = Math.min(w - 1, c + 1);
      const dzdx = (d[r * w + cE] - d[r * w + cW]) / ((cE - cW) * g.pixelSizeM);
      const dzdy = (d[rN * w + c] - d[rS * w + c]) / ((rS - rN) * g.pixelSizeM);
      const i = 4 * (r * w + c);
      if (!Number.isFinite(dzdx) || !Number.isFinite(dzdy)) continue;
      const n = Math.hypot(dzdx, dzdy, 1);
      const shade = Math.max(0, (-dzdx * lx - dzdy * ly + lz) / n);
      const v = 30 + 225 * shade;
      out[i] = v;
      out[i + 1] = v;
      out[i + 2] = v;
      out[i + 3] = 255;
    }
  }
  return out;
}
