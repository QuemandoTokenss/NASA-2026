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
