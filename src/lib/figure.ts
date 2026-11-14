/**
 * Geometría de la figura original `figuras/mapa_sitios.svg` (generada por el
 * motor). Se usa SOLO para superponer marcadores en la misma imagen; no es un
 * sistema cartográfico. Los límites del área de dibujo se leen de la propia
 * figura (ejes a −13000…−9000 m en X y −14000…−10000 m en Y) y coinciden con
 * `datos/contexto_2d.json → bounds_xy_m`. Un test comprueba que los puntos
 * calculados aquí caen exactamente sobre los círculos dibujados por el motor.
 */
export const CONTEXT_FIGURE = {
  path: "original/DERIVADOS_SITE_REGRET/figuras/mapa_sitios.svg",
  viewBox: { width: 760, height: 740 },
  plot: { x0: 80, y0: 50, width: 600, height: 600 },
  /** [xmin, ymin, xmax, ymax] en metros (estereográfica polar sur, MOON_ME_DE421). */
  boundsXY: [-13000, -14000, -9000, -10000] as const,
  displayPixelSizeM: 40,
} as const;

export function figureXY(xM: number, yM: number) {
  const [xmin, ymin, xmax, ymax] = CONTEXT_FIGURE.boundsXY;
  const { x0, y0, width, height } = CONTEXT_FIGURE.plot;
  return {
    x: x0 + ((xM - xmin) / (xmax - xmin)) * width,
    y: y0 + ((ymax - yM) / (ymax - ymin)) * height,
  };
}

/** Píxeles de la figura por metro (para barras de escala). */
export const FIGURE_PX_PER_M = CONTEXT_FIGURE.plot.width / (CONTEXT_FIGURE.boundsXY[2] - CONTEXT_FIGURE.boundsXY[0]);

/**
 * Leyenda de la figura: los colores extremos y la escala se leen de la propia
 * figura (pie: «Oscuro: 1227 m · Claro: 1958 m»). Un test comprueba que el
 * color más oscuro y el más claro existen en el SVG original.
 */
export const CONTEXT_LEGEND = {
  darkM: 1227,
  lightM: 1958,
  stops: ["#234b6e", "#3d5c74", "#566d79", "#6d7c7f", "#868d84", "#9e9d8a", "#b6ad8f", "#cebd95", "#e6cd9b"],
  caption: "Altura del terreno sobre la esfera de referencia (promedio a 40 m/píxel)",
} as const;

/** Inversa de figureXY: unidades de la figura → X/Y estereográficos (m). */
export function figureToXY(fx: number, fy: number) {
  const [xmin, ymin, xmax, ymax] = CONTEXT_FIGURE.boundsXY;
  const { x0, y0, width, height } = CONTEXT_FIGURE.plot;
  return {
    xM: xmin + ((fx - x0) / width) * (xmax - xmin),
    yM: ymax - ((fy - y0) / height) * (ymax - ymin),
    inside: fx >= x0 && fx <= x0 + width && fy >= y0 && fy <= y0 + height,
  };
}
