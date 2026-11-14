/**
 * Metadatos de presentación de las métricas que entrega el motor
 * (`scenarios[].metrics`). No se define ninguna métrica nueva.
 */
import type { IconName } from "@/components/ui/Icon";
import type { Criterion } from "../contract/constants";
import type { MetricKey } from "../contract/schema";
import { bi } from "../i18n";

export interface MetricMeta {
  label: string;
  short: string;
  icon: IconName;
  description: string;
  /** Sentido favorable SOLO cuando un criterio del motor lo define. */
  better?: "higher" | "lower";
}

export const METRIC_META: Record<MetricKey, MetricMeta> = bi({
  sun_hours: {
    label: "Horas con Sol",
    short: "Con Sol",
    icon: "sun",
    description: "Tiempo con el centro geométrico del Sol por encima del relieve.",
    better: "higher",
  },
  dte_center_hours: {
    label: "Horas con Tierra visible",
    short: "Con Tierra",
    icon: "earth",
    description: "Tiempo con el centro de la Tierra por encima del relieve. Geometría, no enlace de radio.",
    better: "higher",
  },
  joint_hours: {
    label: "Horas con Sol y Tierra",
    short: "Sol + Tierra",
    icon: "sparkles",
    description: "Intersección de ambas visibilidades.",
    better: "higher",
  },
  longest_dark_hours: {
    label: "Racha más larga sin Sol",
    short: "Racha sin Sol",
    icon: "moon",
    description: "Mayor intervalo continuo sin el centro del Sol, recortado a la ventana.",
    better: "lower",
  },
  longest_no_earth_hours: {
    label: "Racha más larga sin Tierra",
    short: "Racha sin Tierra",
    icon: "radio",
    description: "Mayor intervalo continuo sin el centro de la Tierra, recortado a la ventana. No es criterio de decisión del motor.",
  },
  known_hours: { label: "Horas conocidas", short: "Conocidas", icon: "check", description: "Horas con estado determinado." },
  unknown_hours: {
    label: "Horas desconocidas",
    short: "Desconocidas",
    icon: "alert",
    description: "Horas sin estado determinable. Nunca se interpretan como sombra.",
  },
  duration_hours: { label: "Duración de la ventana", short: "Duración", icon: "clock", description: "Horas de la ventana analizada." },
}, {
  sun_hours: { label: "Hours with Sun", short: "Sunlit", icon: "sun", description: "Time with the geometric centre of the Sun above the terrain.", better: "higher" },
  dte_center_hours: {
    label: "Hours with Earth visible",
    short: "Earth",
    icon: "earth",
    description: "Time with the centre of the Earth above the terrain. Geometry, not a radio link.",
    better: "higher",
  },
  joint_hours: { label: "Hours with Sun and Earth", short: "Sun + Earth", icon: "sparkles", description: "Intersection of both visibilities.", better: "higher" },
  longest_dark_hours: {
    label: "Longest stretch without Sun",
    short: "Dark streak",
    icon: "moon",
    description: "Longest continuous interval without the Sun centre, clipped to the window.",
    better: "lower",
  },
  longest_no_earth_hours: {
    label: "Longest stretch without Earth",
    short: "No-Earth streak",
    icon: "radio",
    description: "Longest continuous interval without the Earth centre, clipped to the window. Not a decision criterion of the engine.",
  },
  known_hours: { label: "Known hours", short: "Known", icon: "check", description: "Hours with a determined state." },
  unknown_hours: { label: "Unknown hours", short: "Unknown", icon: "alert", description: "Hours without a determinable state. Never interpreted as shadow." },
  duration_hours: { label: "Window duration", short: "Duration", icon: "clock", description: "Hours in the analysed window." },
});

/** Métricas de visibilidad mostradas en comparaciones, en orden. */
export const DISPLAY_METRICS: MetricKey[] = ["sun_hours", "dte_center_hours", "joint_hours", "longest_dark_hours", "longest_no_earth_hours"];

/** Métrica que usa cada criterio (se contrasta con `criteria[C].metric` en los tests). */
export const CRITERION_METRIC: Record<Criterion, MetricKey> = {
  min_longest_dark_hours: "longest_dark_hours",
  max_sun_hours: "sun_hours",
  max_dte_hours: "dte_center_hours",
  max_joint_hours: "joint_hours",
};
