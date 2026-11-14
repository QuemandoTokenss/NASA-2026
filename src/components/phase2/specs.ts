import type { Phase2Spec } from "./Phase2Screen";

export const COMPARADOR_SPEC: Phase2Spec = {
  eyebrow: "Comparador A vs B",
  title: "Comparador A vs B",
  subtitle: "Una ventana, una altura y un criterio fijado antes de ver el resultado",
  purpose:
    "Enfrentará A y B con la superficie nominal para la ventana y la altura elegidas. Primero se fija el criterio; después se revelan el ganador nominal, las utilidades, la diferencia D en horas y la frase determinista del motor.",
  controls: ["window", "height", "criterion"],
  dataFields: [
    { path: "comparisons[w,h].criteria[C].nominal_winner", use: "A, B, TIE o UNKNOWN; se respeta tal cual, sin redondeos." },
    { path: "comparisons[w,h].criteria[C].cases.nominal.{utility_A, utility_B, D_hours}", use: "Ventaja en horas de la métrica elegida." },
    { path: "comparisons[w,h].criteria[C].{metric, maximize_sign, tie_tolerance_hours}", use: "Qué se mide y en qué sentido." },
    { path: "scenarios[A|B,w,h,nominal].metrics.*", use: "Horas con Sol, con Tierra, conjuntas y rachas, por sitio." },
    { path: "comparisons[w,h].criteria[C].summary_es", use: "Frase explicativa generada por el motor (sin LLM)." },
  ],
  mockupGaps: [
    { mockup: "Puntuación del sitio 88/100 y 81/100", reality: "No existe una puntuación agregada: cada criterio se compara por separado en horas." },
    { mockup: "Barras normalizadas 0–100", reality: "Se mostrarán horas reales y la diferencia D_hours." },
    { mockup: "«Candidato principal» antes de comparar", reality: "La etiqueta solo aparece tras elegir criterio." },
    { mockup: "Elevación solar máx., pendiente y horizonte como métricas de decisión", reality: "Los criterios del motor son 4: racha sin Sol, horas con Sol, con Tierra y conjuntas." },
    { mockup: "Fechas 15–29 mar 2026, resolución 1 h", reality: "Solo W1 y W2 (30 días cada una), paso de 10 min." },
  ],
  rules: [
    "El criterio se elige antes de revelar el ganador.",
    "Empate = diferencia dentro de la tolerancia de 10 min, calculada con valores completos.",
    "Desconocidos nunca se tratan como cero ni como sombra.",
  ],
};

export const TIMELINE_SPEC: Phase2Spec = {
  eyebrow: "Timeline",
  title: "Timeline de Sol y Tierra",
  subtitle: "Cinco estados de visibilidad a lo largo de cada ventana",
  purpose:
    "Mostrará la secuencia de estados (ninguno, solo Sol, solo Tierra, ambos, desconocido) de A y B en intervalos de 10 minutos, con tooltips de intervalos y censura en los bordes. Las curvas de elevación Sol/Tierra frente al horizonte solo existen para la superficie nominal.",
  controls: ["window", "height", "variant", "site"],
  dataFields: [
    { path: "scenarios[s,w,h,v].state_codes", use: "4320 códigos categóricos; nunca se interpolan." },
    { path: "scenarios[s,w,h,v].intervals[].{start, stop, state, duration_minutes, left/right_censored}", use: "Tramos y su censura en los bordes." },
    { path: "ephemerides[w].times_utc", use: "Reloj común: 4321 instantes UTC." },
    { path: "ephemerides[w].sites[s][h].bodies.SUN/EARTH.elevation_deg + sun/earth_horizon_deg", use: "Curvas nominales (solo superficie nominal)." },
    { path: "datos/eventos_acotados.json", use: "Salidas/puestas acotadas a 10 min, no instantes exactos." },
  ],
  mockupGaps: [
    { mockup: "Sol hasta 62,3° de elevación", reality: "Imposible a ~89,5° S: se usarán las elevaciones nominales reales del paquete." },
    { mockup: "Sol en naranja y Tierra en cian", reality: "Reasignados a amarillo y azul: naranja y cian identifican a A y B." },
    { mockup: "Resolución seleccionable (1 hora)", reality: "Paso fijo de 10 minutos del motor." },
    { mockup: "Amanecer 17 mar 04:12 UTC", reality: "Eventos como intervalos de 10 min (earliest_utc–latest_utc)." },
    { mockup: "Curvas para cualquier superficie", reality: "Para clones y perturbaciones solo hay estados y métricas, no curvas." },
  ],
  rules: [
    "Estados categóricos con leyenda textual y trama para desconocido.",
    "No combinar cielo nominal con horizontes de otras superficies.",
    "Rachas recortadas a la ventana, sin extrapolar.",
  ],
};

export const ENGINEER_SPEC: Phase2Spec = {
  eyebrow: "Engineer",
  title: "Engineer Mode",
  subtitle: "Efecto de la altura del observador: 0, 2 y 10 m precalculados",
  purpose:
    "Comparará el horizonte y las métricas de cada sitio a 0, 2 y 10 m para ver cuánto cambia la visibilidad al elevar un mástil, sin interpolar entre alturas ni extrapolar fuera de ellas.",
  controls: ["site", "window", "variant"],
  dataFields: [
    { path: "horizons[s].variants[v][\"0\"|\"2\"|\"10\"].elevation_deg", use: "Perfil del horizonte a cada altura." },
    { path: "scenarios[s,w,0|2|10,v].metrics.*", use: "Métricas por altura." },
    { path: "comparisons[w,0|2|10]", use: "Cómo cambia la decisión con la altura." },
    { path: "configuration.heights_m", use: "Únicas alturas disponibles." },
  ],
  mockupGaps: [
    { mockup: "Slider continuo 0–50 m y «altura óptima 18–30 m»", reality: "Solo 0, 2 y 10 m: otras alturas requieren nuevo cálculo." },
    { mockup: "Tipo, diámetro, albedo y material de la estructura", reality: "No forman parte del modelo geométrico." },
    { mockup: "Vista orbital 3D con haz solar", reality: "P2; requeriría geometría coherente con el motor." },
    { mockup: "Tabla de sensibilidad a 10/18/30/50 m", reality: "Se construirá con las tres alturas reales." },
  ],
  rules: [
    "Visibilidad geométrica ≠ energía generada.",
    "Mástil de 2/10 m etiquetado como SIMULATED.",
  ],
};

export const REGRET_SPEC: Phase2Spec = {
  eyebrow: "Regret Lab",
  title: "Regret Lab",
  subtitle: "¿Se mantiene la elección nominal con otras superficies del terreno?",
  purpose:
    "Para un criterio, ventana y altura, mostrará qué superficies mantienen, empatan o invierten la elección nominal, el regret en horas de cada caso y los recuentos por familia (4 hipótesis propias, 5 clones publicados), sin convertirlos en probabilidades.",
  controls: ["window", "height", "criterion"],
  dataFields: [
    { path: "comparisons[w,h].criteria[C].cases[v].{winner, D_hours, regret_A_hours, regret_B_hours}", use: "Resultado por superficie." },
    { path: "comparisons[w,h].criteria[C].robustness.own_sensitivity", use: "Conteos de la familia propia (generated, evaluated, same_winner, ties)." },
    { path: "comparisons[w,h].criteria[C].robustness.published_subset", use: "Conteos de los clones publicados, por separado." },
    { path: "…robustness.*.worst_regret_of_nominal_choice_hours", use: "Peor regret de mantener la elección nominal; null si no aplica." },
    { path: "configuration.{hypothesis_X_m, gaussian_filter_sigma_m, seed}", use: "Parámetros de las hipótesis propias." },
  ],
  mockupGaps: [
    { mockup: "Monte Carlo de 1000 escenarios", reality: "4 perturbaciones propias + 5 clones publicados." },
    { mockup: "Curvas gaussianas μ/σ y «±1,3 días»", reality: "No hay distribución estimada: se listan los casos." },
    { mockup: "«Probabilidad de ser mejor: 92 %»", reality: "Prohibido: las fracciones de variantes no son probabilidades." },
    { mockup: "Albedo y transmitividad atmosférica", reality: "No modelados (la Luna no tiene atmósfera relevante)." },
    { mockup: "Mapa de calor de sensibilidad ±30 %", reality: "No existe barrido de parámetros en el paquete." },
  ],
  rules: [
    "Familias propias y publicadas siempre separadas.",
    "Fracciones excluyen el nominal y los empates; null = no aplicable, no 0 %.",
    "Regret en horas de la métrica elegida; nunca se suman criterios distintos.",
  ],
};
