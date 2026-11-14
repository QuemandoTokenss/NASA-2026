# Incompatibilidades entre los mockups y los datos científicos

Los mockups son **referencia visual**, no fuente de datos. Esta tabla registra cada elemento que no puede mostrarse tal cual y cómo se resuelve. Autoridad: `CONTRATO_DATOS.md`, `paquete_frontend.json` (site-regret/0.1) y `GUIA_INTEGRACION_WEB.md`.

## Transversales (todas las pantallas)

| Mockup | Realidad del paquete | Resolución en la web |
|---|---|---|
| Sitios «Shackleton Rim», «de Gerlache Plateau», 88,62° S 112,37° E, etc. | Solo A = Connecting Ridge ROI 4 (−89,4527°, 222,8513° E) y B = ROI 6 (−89,4739°, 222,6246° E) | Nombres y coordenadas leídos de `sites[]`; sin selección libre |
| Fechas 2030-06-01→09-30 (122 d), 15–29 mar 2026 | W1 14/11/2026–14/12/2026 y W2 14/12/2026–13/01/2027, 720 h cada una | Selector W1/W2 con fechas de `configuration.windows` |
| Resolución «1 hora» seleccionable | Paso fijo de 10 min (4320 intervalos) | Sin selector de resolución |
| Métricas en «días» y porcentajes redondeados | Métricas en horas, con valores completos | Horas (y h/min en etiquetas); decisiones con valores completos |
| Explore v2: A azul y B naranja; timelines: Sol naranja, Tierra cian | Requisito del equipo: A naranja, B cian, incertidumbre violeta | Sol amarillo, Tierra azul, ambos verde, ninguno pizarra, desconocido con trama |
| Acento violeta en navegación (mockups 3–7) | Violeta reservado a incertidumbre | Acento de interfaz azul acero (de Explore v2) |
| Iconos de notificación/usuario/ajustes | No hay cuentas ni backend | Omitidos |

## Explore (v1 y v2)

| Mockup | Realidad | Resolución |
|---|---|---|
| Capas LROC, iluminación, temperatura, pendiente ráster, zonas de riesgo | Solo `figuras/mapa_sitios.svg` (DEM PGDA78 a 40 m/px, `visual_only_not_horizon_input`) | Figura original + marcadores; capas inexistentes listadas como «no disponibles» |
| Mapa de 100 km / 20 km con rejilla 87,5°–89,5° S | Recorte de 4 × 4 km en X/Y estereográficos; A y B separados ≈ 648 m en ese plano (ΔX = 485 m, ΔY = 430 m según `sites[].x_m/y_m`) | Ejes originales de la figura |
| 2D/3D | 3D es P2 | Sin conmutador 3D |
| «Elevación relativa +1 420 m», «Temperatura −63 °C», «Fracción de luz 92 %» | `nominal_height_m` (altura del suelo sobre esfera de 1 737 400 m); sin temperatura; la luz depende de ventana/altura/superficie | Altura del suelo rotulada como tal; capas `ldec/toterr/slp/slperr` con unidades del README PGDA78 |
| «Establecer como Sitio A» | A/B fijos | Solo inspección del sitio |
| Mission Timeline con tránsito y operaciones | No modelado | Omitido |
| Comparación rápida con ganador | El ganador depende de criterio/ventana/altura | Solo propiedades del punto, «sin clasificación» |

## Timeline

| Mockup | Realidad | Resolución |
|---|---|---|
| Sol hasta 62,3° de elevación | Imposible a ~89,5° S | Series nominales reales `ephemerides[W].sites[S][H]` |
| Amanecer/atardecer al minuto | `eventos_acotados.json`: intervalos de 10 min | Mostrar `earliest_utc–latest_utc` |
| Curvas para cualquier sitio/superficie | Curvas solo nominales | Curvas solo en modo nominal; variantes por estados |
| «Orientación 118° E», «Horizonte −6,1°/+14,3°» | No existen esos valores | Derivar de `horizons` si se muestra |

## Comparador A vs B

| Mockup | Realidad | Resolución |
|---|---|---|
| Puntuación 88/100 vs 81/100, barras 0–100 | No hay puntuación agregada | Un criterio a la vez, en horas, con `D_hours` |
| Métricas «elevación solar máx.», pendiente y horizonte como criterio | 4 criterios del motor | Selector de criterio previo |
| «Se recomienda el Sitio A» | Frase determinista `summary_es` | Mostrar la frase del motor |

## Engineer

| Mockup | Realidad | Resolución |
|---|---|---|
| Slider 0–50 m, altura óptima 18–30 m | 0, 2 y 10 m | Control discreto de 3 alturas |
| Tipo, diámetro, albedo, material | No modelados | Omitidos |
| Vista orbital con haz solar | P2, requiere geometría del motor | Omitida |

## Regret Lab

| Mockup | Realidad | Resolución |
|---|---|---|
| Monte Carlo 1 000, curvas gaussianas μ/σ | 4 perturbaciones propias + 5 clones | Lista de casos por familia |
| «Prob. de ser mejor 92 %», «Robustez alta» | Prohibido convertir frecuencias en probabilidad | Conteos `same_winner_count/evaluated_count`, empates aparte, `null` = no aplicable |
| Albedo, transmitividad atmosférica, heatmap ±30 % | No modelados; no hay barrido de parámetros | Omitidos; se muestran X, σ y semilla reales |
