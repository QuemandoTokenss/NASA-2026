# HANDOFF · SITE REGRET · Operación final de integración

**Punto de control vigente:** PC-28 publicado: PR #28 fusionada en `main` con el merge `e38fdd9` (§0-nonies), producción = `e38fdd9`. La sección 0.7 recoge la comprobación de entrega del 15-11-2026.
Documento principal del relevo. Si contradice al código o a `git status`, mandan el código y Git. **El estado vigente es la sección 0; las secciones 1–10 son históricas (PC-13 a PC-21) y sus referencias a ramas, HEAD y «sin push/sin despliegue» están superadas.**

## 0-nonies. PC-28 · Auditoría de alturas y Regret Lab — PUBLICADO (leer primero)

**Fusión (2026-11-15, a petición de Hugo):** PR #28 fusionada en `main` con el commit de merge `e38fdd9` (`e38fdd901fbc764c35fe0a2fa14505a99d29a9f8`). Antes: cabeza `f5dfbad`, Vercel en verde, estado `CLEAN`. Estado Vercel del merge: success; producción sirve `/icon.svg` (200) y el `favicon.ico` nuevo (SHA-256 `921e9c0c…`). Incluye además el icono de pestaña con el logotipo de la cabecera (`web/src/app/icon.svg`, `favicon.ico`, `apple-icon.png`). Rollback: promover en Vercel el despliegue anterior (`f395794`) o revertir el merge `e38fdd9`.

**2026-11-15.** Rama `fix/regret-lab-height-audit` desde `origin/main` = `f395794` (= producción). Encargo: incidente de los ceros de oscuridad a 2 y 10 m en Regret Lab (W2) y salto 0 → 0,5 m. Sin merge ni despliegue: necesita revisión humana.

**Dictamen científico** (`docs/SCIENCE_HEIGHT_AUDIT.md`): no hay error en el motor; los datos del contrato y del paquete de alturas **se conservan**. A 0 m la sombra W2 la produce microrrelieve a 25–31 m que asoma 0,03–0,13 m sobre la línea del Sol, menos que el error vertical del DEM (0,27–0,30 m): rachas inestables (A 33 h 50 min – 54 h 10 min, B 0 h – 26 h 10 min con ±2,5 m), aunque B < A en las 14 configuraciones. Desde 0,5 m ninguna configuración da sombra; margen solar mínimo a 2 m ≥ 0,90°. Geometría del motor = vectores cartesianos independientes (< 5·10⁻⁹°).

| Módulo | Problema | Solución | Archivos | Prueba |
|---|---|---|---|---|
| Ciencia | Ceros a 2/10 m y salto 0→0,5 m sin explicar | Auditoría reproducible con el motor importado sin modificar | `web/scripts/engine/height_audit.py`, `web/data/derived/height-audit/v1/{audit,summary}.json`, `docs/SCIENCE_HEIGHT_AUDIT.md` | `tests/height-audit.test.ts` (14) |
| Regret Lab | Empate a 0 h parecía pantalla vacía | Veredicto con tipo de resultado (empate sin oscuridad / toda la ventana / diferencia / no determinable) y los 4 criterios con valores; indica cuál sí diferencia (la selección solo cambia si el usuario pulsa) | `src/components/regret/RegretVerdict.tsx`, `src/lib/science/regretSummary.ts` | `e2e/regret-lab-pc28.spec.ts` |
| Regret Lab | 2 y 10 m sin historia útil | «¿Qué cambia con la altura?»: alturas del contrato + paquete 0–30 m (puntos, sin interpolar) + franja de ganador + avisos de la auditoría | `src/components/regret/HeightEvolution.tsx`, `src/lib/science/heightAudit.ts` | ídem |
| Demo guiada | Explicaba W2 · 0 m con controles en 2/10 m | Se pausa si la selección no coincide con el paso; «Volver al caso» o «Cerrar» | `RegretLabView.tsx` | ídem + `app.spec.ts` |
| Otras vistas | Revisadas con W2 · 2 m · racha sin Sol (Dashboard, Explore, Timeline, Comparador, Engineer, Evidencia, Historia) | Sin cambios: cifras coherentes (720 h Sol, 0 h racha, Tierra A 398 h 40 min / B 398 h); el bloque del Dashboard rotula su caso fijo «W2 · 0 m» | — | lectura en navegador |

**Capturas** (antes = producción, después = rama; 1440×900 y 390×844): `web/docs/capturas/pc28/{antes,despues}/` con `log.json`; script `web/scripts/qa/capture-pc28.mjs`.

**Verificación:** `npm run verify`: tipos y lint limpios · Vitest **170/170** (18 archivos; +14 `height-audit.test.ts`) · build PASS · Playwright **123 PASS, 4 FAIL, 1 omitida** (12,7 min). Los 4 fallos fueron esperas agotadas de carga de datos (`waitForData` / clic) mientras la auditoría Python se regeneraba en paralelo con la CPU saturada (`mission-control` ×2, `regret-lab-pc28` ×2). Repetidas sin carga: `mission-control`, `regret-lab-pc28`, `app`, `jurado-pc25` ×2 → **78/78 PASS**. No hubo una pasada completa con salida 0.

**Pendiente:** revisión humana; el Comparador podría reutilizar el aviso «otro criterio sí diferencia» (fuera de alcance); DEM de mayor resolución para cerrar el caso de 0 m.

## 0-octies. Fusión de la PR #25 (PC-27) — PUBLICADA (leer primero)

**2026-11-15.** PR #25 fusionada en `main` con el commit de merge `c9749ca` (`c9749cac54ad21765c358a1124ab11424d493c76`), a petición de Hugo. Antes: cabeza de la PR = `c6f7cb6`, check de Vercel en verde, estado `CLEAN`, sin conflictos. **Producción = `c9749ca`** (estado Vercel del commit: success, «Deployment has completed»).

**Comprobado en producción** (navegador sin preferencia guardada, https://site-regret.vercel.app/?lang=en):

- 375×667: «Try the mission» en y = 597–649, dentro de la pantalla.
- `/historia/`: flecha derecha A → B y flecha izquierda B → A, con foco y `aria-checked` en la tarjeta nueva; Tab lleva a «Try a different terrain map».
- Camino B tras cambiar el terreno: A 32 h 30 min, B 49 h, regret 16 h 30 min; mensaje «Keeping B means 16 h 30 min more without sunlight than choosing A in this scenario. In this test, both sites are over the 24 h limit.»; etiqueta «Alternative terrain · team hypothesis».
- «See the evidence» → recarga: sigue en inglés (`lang="en"`, preferencia guardada `en`). Sin errores de consola.

**Pruebas previas a la fusión:** las de §0-septies. Además, según el encargo de Hugo, Codex ejecutó la suite completa (156 unitarias y 123 escenarios E2E; la prueba del inspector de Explore pasó al reintentar, 5/5 en local y 3/3 en producción); esa pasada no se ha repetido en esta sesión.

**Rollback:** promover en Vercel el despliegue anterior (`ddbbf6c`) o revertir el merge `c9749ca` en Git.

**Enlace público de entrega:** https://site-regret.vercel.app/?lang=en

**Entrega NASA:** ver la tabla actualizada en §0.7.

## 0-septies. PC-27 · cuatro hallazgos de la revisión del jurado — EN RAMA, sin fusionar (leer primero)

**2026-11-15.** Rama `fix/jurado-idioma-portada-demo` desde `origin/main` = `ddbbf6c` (versión auditada; incluye las PR #22 y #24). Commit local; **sin push ni PR**. Solo cambia idioma, portada y demo guiada; datos, motor, cifras, mapas y escenas 3D intactos.

| Hallazgo | Archivo | Qué cambió |
|---|---|---|
| 1 · El inglés se perdía al recargar | `web/src/lib/I18nProvider.tsx` | Un `?lang=` válido se guarda como preferencia (mismo `try/catch` que el selector) y manda sobre la guardada; `?lang=es` vuelve al español; un valor no válido no cambia nada. **Los enlaces públicos que se entreguen deben llevar `?lang=en`** (p. ej. `https://site-regret.vercel.app/?lang=en`) para abrir en inglés en un navegador nuevo |
| 2 · Botón de portada fuera de pantalla en móviles cortos | `web/src/components/home/Hero.tsx` | El área de la Luna mide `clamp(200px, 100dvh − 432px, 360px)` (440 px desde `sm`): 235 px a 375×667, 360 px desde 792 px de alto. Por debajo de 500 px de alto, la pregunta y el botón van antes que la Luna. Escritorio (`lg`) sin cambios |
| 3 · A/B sin teclado | `web/src/components/story/LandingDemo.tsx` | Patrón radiogroup como `Segmented`: flechas (los dos sentidos, con vuelta) mueven selección y foco, `tabindex` itinerante, Enter/Espacio y clic eligen. Al reiniciar, el foco vuelve a la tarjeta A. La región viva (`role=status`, `aria-atomic`) es solo el texto del resultado (`demo-result`); los botones quedan fuera |
| 4 · Resultado del giro | `LandingDemo.tsx` | Si las dos tarjetas marcan `exceeds`: «En esta prueba, ambos sitios superan el límite de 24 h.» / “In this test, both sites are over the 24 h limit.” (de `DEMO_LIMIT_HOURS` y los estados del escenario). Mensaje de las 16 h 30 min, íntegro. Botón: «Prueba otro mapa del terreno» / “Try a different terrain map”. «hipótesis del equipo» sigue en la etiqueta de la foto |

**Medido en navegador (servidor de desarrollo, es y en):** 375×667 botón en y = 597–649 (antes 722–774), Luna 235 px; 390×844 botón 722–774, Luna 360 px (igual que antes); 720×450 título 150–211 y botón 298–350, Luna debajo; 1280×720 y 1440×900 idénticos a producción (botón 425–477 y 460–512).

**Pruebas:** nuevas en `e2e/i18n.spec.ts` (enlace en inglés → misión → Evidencia → recarga; `?lang=es`; valor no válido), `e2e/landing-demo.spec.ts` (teclado completo, región viva, frase de «ambos superan» en B y en A) y `e2e/dashboard-globe.spec.ts` (375×667, 390×844 y 720×450 en ambos idiomas). Texto del botón actualizado en `landing-demo.spec.ts` y `jurado-pc25.spec.ts`.

**Verificación (`npm run verify`, código final):** tipos y lint limpios · Vitest 156/156 · build PASS · Playwright **120 PASS, 2 FAIL, 1 omitida** (6,4 min). Los dos fallos son esperas agotadas en Engineer, no tocado (`engineer-heights` «volver a 10 m…» y `engineer-pc24` «caso 2 · Sol oculto»): esas dos specs repetidas ×2, **20/20 PASS**. La pasada anterior, con el mismo código de la app, dio 121 PASS y un único fallo en una aserción de la prueba nueva de idioma (el título de Evidencia es «Scientific Evidence» en ambos idiomas), corregida: `i18n.spec.ts` ×3, 12/12. No hubo una pasada completa con salida 0.

**Pendiente:** revisión humana; lector de pantalla real (la región viva está comprobada por atributos, no por voz); móvil físico. El título fijo en inglés de Evidencia es anterior y queda fuera de este encargo.

**Siguiente paso:** revisar en local (`cd web && npm run build && npm run serve` → http://127.0.0.1:4173/?lang=en); si se aprueba, `git push -u origin fix/jurado-idioma-portada-demo` y PR contra `main` (fusionar publica en producción).

## 0-sexies. PC-26 · Timeline en dos filas con el Cielo local ampliado — EN RAMA, sin fusionar (leer primero)

**2026-11-14.** Rama `feat/timeline-cielo-local` desde `main` = `31f38f1` (incluye el apunte `4156e30` de la fusión de la #21, que estaba solo en la rama de la #21: traído aquí como `f7e0b98`). Commit local; **sin push ni PR**. Solo cambia Timeline.

- `web/src/components/timeline/TimelineView.tsx`: rejilla CSS con áreas. Escritorio (`xl`): fila 1 Geometría │ Cielo local (2 columnas, la más ancha) │ Métricas, misma altura; fila 2 Elevación (gráfico, franjas, leyenda) │ Sitio A/B │ Salidas y puestas (o el aviso de superficie alternativa) con Instante seleccionado justo debajo. `lg`: Geometría │ Cielo local, y el resto apilado con Sitio │ Salidas+Instante al final. Móvil: Geometría → Cielo local → Métricas → Elevación → Sitio → Salidas y puestas → Instante. Una sola instancia por panel y sin `order-*`: orden del código = visual = lectura = teclado.
- `web/src/components/charts/HorizonChart.tsx`: modo `fill` opcional (solo lo usa el Cielo local). Mide su caja y dibuja en píxeles reales, así que crecer da más resolución, no letra más grande; ejes, escala angular, leyenda y marcadores de Sol y Tierra intactos. Sin `fill` (Engineer, Explore, Comparador, Historia) no cambia nada. Medido: 617×460 px a 1440×900 y 533×462 a 1280×720; la tarjeta mide lo mismo que Geometría (684/686 px).
- `web/e2e/timeline-pc24.spec.ts`: orden y alineación a 1440×900 y 1280×720 (fila superior a la misma altura, cielo ≥ 1,4 × las otras dos columnas, gráfico ≥ 55 % de su tarjeta, Sitio junto a Elevación, Instante bajo Salidas y puestas, orden del DOM), móvil 390 px, e instante bajo el aviso con superficie alternativa. A → B, reproductor y sincronía: pruebas existentes, en verde.
- **Verificación:** `npm run verify`: tipos y lint limpios · Vitest 156/156 · build PASS · Playwright 112 PASS, **2 FAIL**, 1 omitida (7,7 min). Los dos fallos son de Engineer (`engineer-heights` «19,5 m, 16 m y 30 m…» y `timeline-engineer-visual` «la torre cambia…»), por espera agotada; Engineer no se ha tocado. Esas dos specs repetidas ×2 con 2 procesos: **20/20 PASS**. Timeline (`timeline-pc24`, `timeline-orbital`, `timeline-engineer-visual`): 13/13.
- **Capturas** (compilación servida en 4190): `web/docs/capturas/pc26/timeline-{1440x900,1280x720,390x844}[-page].png` y `log.json` con las cajas medidas. URL: http://127.0.0.1:4190/timeline/?s=A&w=W2&h=0&v=nominal&t=3200
- **Siguiente paso:** revisión humana; si se aprueba, `git push -u origin feat/timeline-cielo-local` y PR contra `main` (fusionar publica en producción).

## 0-quinquies. Fusión de la PR #21 (rediseño PC-24 + PC-25) — estado actual (leer primero)

- **PR #21 fusionada en `main`** con commit de merge `31f38f1`, a petición de Hugo. Antes: checks de Vercel en verde, sin conflictos, base `main`.
- **Producción**: estado Vercel = success para `31f38f1`. https://site-regret.vercel.app/ responde 200 y sirve la nueva interfaz (pregunta «¿Dónde alunizarías?», foto de Connecting Ridge). `/timeline/` responde 200.
- **Rollback** si hiciera falta: promover en Vercel el despliegue anterior `8cZv4dTRkZh7BnFkF7CCDfeCtH6o` (merge de la #20, `9d0f09b`) o revertir el merge `31f38f1` en Git.
- **Pendiente humano**: revisión visual de la producción (portada con globo, Timeline, Presentar, Regret Lab, Engineer) y confirmación del equipo de los puntos de «Pendiente» de §0-bis y §0-ter (lector de pantalla, Safari/Firefox, móvil físico, mapa de Presentar sin conexión real).

## 0-quater. Fusión de la PR #20 (2026-11-14, a petición de Hugo) — leer primero

- **PR #20 fusionada en `main`** con commit de merge `9d0f09b` («Merge #20: guided demo in three steps ending in the regret; heights package evidence»), sobre `aae19b2`. Comprobado antes: estado limpio, sin conflictos, checks de Vercel en verde.
- **Producción**: el commit de `main` tiene estado Vercel = success (despliegue `8cZv4dTRkZh7BnFkF7CCDfeCtH6o` en el proyecto `site-regret` de Hugo). https://site-regret.vercel.app/ y `/historia/` responden 200 y el código servido contiene la demo de tres pasos de PC-23. El conector de Vercel de la sesión pertenece a otra cuenta, así que el ID y el alias de producción no se pudieron consultar directamente; se leyeron del estado del commit en GitHub.
- **Rollback** si hiciera falta: promover en Vercel el despliegue anterior `dpl_9htxT2H2dz7jRCQvWMikpJu28hGt` (`aae19b2`) y revertir el merge `9d0f09b` en Git.
- **PR #21** (rediseño PC-24 + PC-25): base cambiada a `main`; 8 commits propios (`6491f1e` … `59fa7a4` y el de este apunte). **Sin fusionar**: fusionarla publica en producción.

## 0-ter. PC-25 · ajustes finales para el jurado — IMPLEMENTADO Y VERIFICADO EN LOCAL (leer primero)

**2026-11-14 (+01:00).** Sobre PC-24 (§0-bis), misma rama `feat/rediseno-experiencia-lunar` (PR #21, apilada sobre #20). Commit local de este punto de control encima de `6dc33fb`; **sin push** al escribir esto (subirlo actualiza la PR #21). Nada fusionado ni publicado.

| Bloque | Archivos | Qué cambió |
|---|---|---|
| Timeline | `web/src/components/timeline/TimelineView.tsx`, `web/e2e/timeline-pc24.spec.ts` | Geometría Sol–Tierra–Luna y Cielo local, juntos (dos columnas desde `lg`), son el primer bloque bajo el reproductor; debajo, «Elevación sobre el horizonte» con franjas y leyenda; a la derecha (desde `xl`) la columna Sitio → Instante → Métricas → Eventos. Se quitaron todos los `order-*` y `contents`: el orden del código = orden visual, de lectura y de teclado. Móvil: Geometría → Cielo local → Elevación → lectura (el instante ya no va justo tras el reproductor; lo exige la coincidencia de órdenes) |
| Cabecera | `web/src/components/layout/AppShell.tsx` | Fuera `DataStatusPill` (etiqueta verde con el hash) y sus importaciones. ES/EN y Presentar siguen alineados. La verificación SHA-256 del paquete, el bloqueo con dato alterado (`DataGate`) y los hashes de Evidencia no cambian |
| Presentar | `web/src/components/story/LandingDemo.tsx`, `RidgePhotoMap.tsx` (nuevo), `web/src/assets/presentar/` (nuevo), `ui/Icon.tsx` (+`chevronRight`), `ui/Display.tsx` (`testId` opcional en `StatTile`) | `PairMap` sustituido por la foto local de Connecting Ridge del ZIP del equipo (`connecting-ridge-orbital.webp`, NASA Moon Trek · LRO/LROC NAC) con capa de marcadores HTML/SVG; respaldo `connecting-ridge-relieve.webp` (DEM PGDA78, luz ilustrativa, rotulado) si la foto no carga. Encuadre, escala y A/B del metadato (verificados contra el paquete en `tests/presentar-map.test.ts`); relación 1440:900 fija. Pregunta «¿Dónde alunizarías?» + una línea (24 h, límite ilustrativo); la definición larga pasa a «Ver explicación». Escritorio: foto grande a la izquierda, panel de decisión compacto a la derecha (Sitio A / Sitio B sin «?»; al elegir, el panel cambia y el mapa marca «tu elección»). Relieve y altura del paso, en la esquina de la foto. Recorrido, reinicio, idiomas, Evidencia y presentación de 7 escenas, intactos. `PairMap.tsx` sigue en el código (lo usan otras vistas). Referencias de diseño del ZIP no publicadas (hashes en `SOURCES.json`) |
| Regret Lab | `web/src/components/regret/RegretLabView.tsx`, `web/e2e/app.spec.ts` | Con empate nominal y A = B = 0 h sin horas desconocidas, una línea lo explica (texto por métrica; para la racha sin Sol, el pedido). «sin fracción (null)» → «El escenario de referencia empata, así que no hay una elección inicial que comparar» (también en el método). Valores y tolerancia de 10 min sin cambios |

**Comprobaciones del paquete (Regret Lab):** W1 y W2 a 2 y 10 m: las 20 filas (A/B × 10 superficies) dan `longest_dark_hours = 0` y `unknown_hours = 0` → Empate correcto, «Se mantiene» = No aplica, «Elige un sitio a conservar». Criterio Tierra visible en W2 nominal a 10 m: A 399 h, B 398 h 10 min, gana A. W2 nominal 0 m, racha sin Sol: A 38 h 40 min, B 14 h 40 min, sin texto de empate. Todo en `e2e/jurado-pc25.spec.ts`.

**Verificación:** `npm run verify` sobre el código final: typecheck y lint limpios · Vitest **156/156** (17 archivos; +3 `presentar-map.test.ts`) · build PASS · Playwright **113 PASS, 0 FAIL, 1 omitida** (la opcional en vivo de Moon Trek), 4,9 min. Nuevas: `e2e/jurado-pc25.spec.ts` (Presentar a 1280×720 con red externa cortada y caminos B y A, alineación de marcadores a 1440×900, 1280×720, 1024×768 y 390×844 con error < 1 px de imagen, respaldo de relieve, móvil; cabecera; Regret Lab) y Timeline a 1440×900, 1280×720 y 390 px más la sincronización de geometría y cielo local con el reproductor.

**Capturas** (compilación servida en 4190): `web/docs/capturas/pc25/` — `timeline-{1440x900,1280x720,390x844}.png`, `presentar-{1280x720,1440x900,390x844}.png`, `presentar-B-*.png` (paso 2), `presentar-B-paso3-*.png` (regret), `regret-W2-10m-{empate,tierra}.png`, `log.json` (posiciones de marcadores medidas).

**URL locales:** http://127.0.0.1:4190/historia/ · http://127.0.0.1:4190/timeline/?s=A&w=W2&h=0&v=nominal&t=3200 · http://127.0.0.1:4190/regret-lab/?w=W2&h=10&v=nominal&c=min_longest_dark_hours

**Pendiente:** revisión humana; subir el commit (actualiza la PR #21); en móvil, el instante seleccionado queda tras el gráfico (consecuencia de igualar órdenes); no comprobado con lector de pantalla real ni en Safari/Firefox.

**Siguiente paso exacto:** revisar las tres URL; si se aprueba, `git push` (actualiza la PR #21) y seguir §0-bis «Siguiente paso exacto» (fusionar #20, retarget de #21 a `main`).

## 0-bis. PC-24 · rediseño de la experiencia lunar — IMPLEMENTADO Y VERIFICADO EN LOCAL, pendiente de revisión del equipo (leer antes que §0)

**Relevo Hugo → Asier, 2026-11-14 (+01:00).** §0 (PC-23) sigue siendo cierto para `main`, producción, propietarios y entrega; esta sección solo añade el rediseño.

| | |
|---|---|
| Rama | `feat/rediseno-experiencia-lunar`, desde `be84975` = punta de `feat/operacion-final-integracion` (PR #20). **Subida y con PR #21** (https://github.com/QuemandoTokenss/NASA-2026/pull/21) a petición de Hugo, **apilada sobre la #20** (base `feat/operacion-final-integracion`, para que el diff muestre solo PC-24). Sin fusionar: primero se fusiona la #20, después se cambia la base de la #21 a `main`. Fusionar y publicar lo decide el equipo: `main` despliega en producción |
| Commits | `6491f1e` Dashboard (globo) · `3fab07e` Engineer (sombra solar + relieve regional) · `1d627d7` Timeline · `28ab76d` capturas y documentos · `a4ce5d8` deslizador · encima, `perf(engineer)` que aligera el relieve regional, con medidas y capturas de Engineer rehechas |
| Compilación servida | `web/out`, compilada por `npm run verify` sobre el código de esos commits. Servidor: `node scripts/serve-static.ts out 4190` (PID 30428, arrancado por Hugo a las 19:05; lee `out/` del disco en cada petición, así que sirve la compilación final). URL: http://127.0.0.1:4190/ · http://127.0.0.1:4190/timeline/?s=A&w=W2&h=0&v=nominal&t=3200 · http://127.0.0.1:4190/engineer/?s=A&w=W1&h=10&v=nominal&t=629. Si no responde: `cd web && npm run build && node scripts/serve-static.ts out 4190` |
| Referencia «antes» | `web/docs/capturas/pc24/antes/` (de Hugo, sobre el código de `0871dcf`), reutilizada sin repetir. «Después»: `web/docs/capturas/pc24/despues/` (mismo equipo, mismo Edge, mismo script) |

### Qué se hizo

**1 · Dashboard — globo lunar** (`web/src/components/home/Hero.tsx`, `MoonGlobe.tsx`, `HomeView.tsx`, `web/src/lib/geospatial/globe.ts`, `web/src/assets/globe/`, `web/scripts/imagery/make_globe_assets.py`)
- Portada: «¿Dónde alunizarías?», una frase («el relieve decide cuándo se ven el Sol y la Tierra desde cada sitio»), «Probar la misión» → `/historia/` (recorrido guiado de PC-23, intacto) y los botones Sitio A / Sitio B. El héroe ya no espera al paquete: texto, botón e imagen NASA local (SVS 5187) se pintan primero; el globo llega en su propio trozo y funde sobre la imagen. Cifras, fuentes, «Explorar el polo sur» y «Presentación en 7 escenas» pasan al segundo nivel (sección «por qué» y siguientes).
- Globo Three.js propio (sin OrbitControls: cámara por cuaternión, sin singularidad en los polos): rotación libre 360°, zoom (rueda solo tras tocar el globo, pellizco, botones +/−), «Polo sur», «Volver al globo», teclado (flechas, +/−, P, 0), render bajo demanda (0 fotogramas en reposo), `prefers-reduced-motion` (salto sin animación), caída sin WebGL (queda la imagen y la demo es accesible).
- Textura: NASA SVS 4720 LROC color 2k (`lroc_color_2k.jpg`, SHA-256 `f7130a18…` = el de `celestial/SOURCES.json`), recodificada a WebP 2k/1k sin reproyectar. Orientación comprobada (0° en el centro, −180° en la columna 0, norte arriba) con Tycho, Crisium, Imbrium, Orientale y Tsiolkovskiy.
- A y B: en sus X/Y del paquete (`unitFromXY`). De lejos, un marcador «A · B · polo sur»; al acercar (≈ 5,9 km de altura) dos marcadores con etiqueta; ocultos tras el limbo. Detalle polar georreferenciado en la misma proyección del mapa: relieve sombreado (luz sintética) de LOLA PGDA90 240 m (±480 km), PGDA90 80 m (80 × 80 km) y el recorte PGDA78 de 5 m. Procedencia y hashes en `web/src/assets/globe/SOURCES.json`.
- Sol (NASA/SDO), Tierra (Apollo 17) y Vía Láctea/estrellas (SVS 4851): la Tierra en su dirección media real (0°, 0°); Sol, tamaños, distancias y luz ilustrativos y rotulados («Composición ilustrativa: Sol, Tierra y luz fuera de escala» + créditos plegados). Los rótulos «Sol» y «Tierra» giran la cámara hasta verlos.

**2 · Engineer — sombra solar** (`web/src/components/terrain/TerrainPanel.tsx`, `TerrainScene.tsx`)
- Se eliminó `directionENU((azimuth ?? 0) + 115, 17)`. La luz es `directionENU(az, el)` del Sol del paquete para el mismo sitio, instante, altura y superficie (la misma transformación que su marcador), con su elevación real (1–2°), **solo si el motor da el Sol por visible**. Sol oculto, estado desconocido (4), carga, vista previa o superficie sin efemérides → luz neutra (hemisférica + cenital sin sombra), sin luz directa ni sombra solar. Rótulo en la escena (`scene-light`).
- La cámara de sombras mira a lo largo de la luz y solo encuadra la torre: la resolución no depende de la longitud de la sombra (hasta 2,6 km de alcance; con 1° una torre de 10 m proyecta ~530 m). El mapa de sombras solo se actualiza cuando cambian Sol, altura o exageración, no al orbitar.

**3 · Engineer — relieve regional** (`web/scripts/geospatial/build-regional.ts`, `publish-regional.ts`, `web/data/derived/terrain-regional/v1/`, `web/src/lib/geospatial/regional.ts`, `web/src/components/terrain/useRegionalTerrain.ts`, `GeoMap.tsx` solo `overlay.areas`)
- Originales PGDA90 verificados (firma TIFF, tamaño y SHA-256 = `datos/pasaporte.json`): 80 m `82030dcb…`, 240 m `3f966325…`. 251 bloques int16 (0,25 m; error máx. 0,125 m), 8,28 MB versionados: L0 80 m nativo (129 bloques: todos los puntos que fijan el horizonte según el motor + anillo de 25 km), L1 320 m (hasta 210 km), L2 1,28 km (todo el producto de 80 m), F 3,84 km (hasta 400 km). Vértices = centros de píxel reales; bordes compartidos idénticos (sin costuras); curvatura con `toLocal`. `npm run data` los publica.
- El visor carga siempre L2 (1 de cada 4 vértices), el anillo L1 de 50 km (1 de cada 2) y el L0 de 9 km (nativo), y bajo demanda los bloques L0/L1 de la visual. Cada malla excluye lo que dibuja un bloque más fino cargado; profundidad logarítmica; Sol y Tierra a 900 km para que una cresta los tape. PGDA78 de 5 m se conserva cerca de la torre.
- Si el bloque nativo del punto del motor está cargado, la visual acaba en la cresta (mismo X/Y que el mapa; se muestra la altura del relieve dibujado y su Δ con la del motor). Si carga o no hay cobertura, visual discontinua hasta el límite del visor y punto real en el mapa. El mapa dibuja en discontinuo la cobertura del 3D.
- **Hallazgo:** la URL «fuera» de `capture.mjs` (A · W1 · 10 m · t=3200, Sol) tiene el obstáculo a 450 m, dentro del recorte. El caso regional real es A · W1 · 10 m · t=629.

**4 · Timeline** (`web/src/components/timeline/TimelineView.tsx`, `charts/TimeCharts.tsx` solo `height`/`fontSize` opcionales)
- Barra (sitio, ventana, altura, superficie) → reproductor → zona principal (gráfico «Elevación sobre el horizonte» con franjas y leyendas dentro del panel; geometría orbital y cielo local) → columna de lectura (Sitio → Instante seleccionado → Métricas del periodo → Salidas y puestas). Una sola instancia de cada panel; en móvil el instante va tras el reproductor (orden CSS). Sin cambios de cálculo.

### Los cuatro casos de Engineer (reproducibles; comprobados en `web/e2e/engineer-pc24.spec.ts`)

| Caso | Sitio · ventana · instante UTC · altura · superficie | URL | Resultado numérico |
|---|---|---|---|
| 1 · Sol visible, sombra opuesta | A · W1 · 2026-12-06 05:20 (t=3200) · 10 m · nominal | `/engineer/?s=A&w=W1&h=10&v=nominal&t=3200` | Sol del motor az 353,636°, el 1,994° · luz de three.js az 353,6362°, el 1,9942° · sombra az 173,6362° (= +180°), 287,2 m |
| 2 · Sol oculto, sin sombra | A · W2 · 2027-01-05 05:20 (t=3200) · 0 m · nominal | `/engineer/?s=A&w=W2&h=0&v=nominal&t=3200` | el 1,487° < horizonte 1,497° (estado 0) · `data-sun-light=off`, sin azimut de luz ni de sombra. También neutra con `v=published_0001` |
| 3 · La mirada no mueve la sombra | mismo que el caso 1; mirar a la Tierra, azimut manual 90°/250°, orbitar | igual | luz 353,6362° y sombra 173,6362° idénticas en los cuatro estados; +1 día sí las cambia |
| 4 · Cresta regional | A · W1 · 2026-11-18 08:50 (t=629) · 10 m · nominal | `/engineer/?s=A&w=W1&h=10&v=nominal&t=629` | punto del motor X −2913,78 m, Y −9663,38 m, 8 740 m, az 210,5° · bloque `L0/29_30` · relieve dibujado − altura del motor = −0,058 m · fin de la visual local (E −4440,10, N −7537,80, U −318,93) = punto del mapa · elevación de la visual = horizonte del motor (−2,151°) con < 0,02° · sombra az 30,58° |

Capturas: `web/docs/capturas/pc24/despues/engineer-obstaculo-{fuera,sol-oculto,cresta-regional}-1440x900.png`, `despues/caso3/*.png`; lecturas en `despues/lecturas.json` y `despues/caso3/log.json`.

### Verificaciones reales (2026-11-14)

| Qué | Resultado |
|---|---|
| `npm run verify` completo (2 procesos, 8,7 min de E2E) sobre el código final | typecheck y lint limpios · Vitest **153/153** (16 archivos; +9 `globe.test.ts`, +18 `regional.test.ts`) · build PASS · Playwright **105 PASS, 0 FAIL, 1 omitida** (la opcional `E2E_LIVE_TREK=1`). Salida 0 |
| Specs nuevas | `dashboard-globe.spec.ts` (4: 1280×720 con Luna, pregunta y botón juntos; giro completo; polo; A/B; vuelta; render parado; móvil; movimiento reducido; sin WebGL → imagen local y entrada a la demo) · `engineer-pc24.spec.ts` (4 casos) · `timeline-pc24.spec.ts` (4) |
| Specs adaptadas | `jurado-pc21.spec.ts` (titular y frase nuevos de portada) · `timeline-engineer-visual.spec.ts` (texto «fuera del recorte») |
| Portada → recorrido guiado de PC-23 | Comprobado en E2E (`landing-demo.spec.ts` sin cambios, en verde; `hero-cta` → `/historia/`) |
| Revisión visual por la IA | Capturas a 1440×900, 1280×720 y 390×844 de las tres vistas. **No sustituye la revisión humana** |

### Rendimiento (mismo equipo, Edge, GPU Intel D3D11, `capture.mjs --perf --no-shots --gpu`, 1280×720, servidor local)

| Vista | Antes | Después | Nota |
|---|---|---|---|
| Dashboard · contenido útil (botón de misión) | 387 ms | 417–485 ms (dos pasadas) | |
| Dashboard · transferido / peticiones | 4 902 KB / 81 | 6 180 KB / 88 | + three.js, textura 2k y cielo; la capa `elevation.f32` (2,5 MB) ya se cargaba |
| Dashboard · arrastre del globo | sin globo | mediana 6,1 ms, p95 6,2 ms | |
| Timeline · útil / transferido | 111 ms / 6 303 KB | 135 ms / 6 374 KB | |
| Engineer · útil / transferido / peticiones | 116 ms / 8 561 KB / 100 | 112 ms / 9 677 KB / 126 | + bloques regionales (≈ 1,1 MB, 34 bloques en el caso de referencia) |
| Engineer · órbita | mediana 6,1 ms, p95 6,2 ms | mediana 6,1 ms, p95 6,2 ms | |
| Engineer · deslizador hasta 30 m con dato | 263 ms | **254 ms** (medida final; 316–334 ms antes de aligerar el relieve regional) | La primera versión de PC-24 daba 1 041 ms. Causa aislada midiendo con y sin relieve regional: al pasar a luz neutra durante la carga se quitaba `castShadow`, y three.js recompila todos los materiales cuando cambia el número de luces con sombra (≈ 0,9 s la primera vez). Ahora la luz solar conserva `castShadow` y en modo neutro va a intensidad 0. Además, los bloques de la visual se piden tras 450 ms de pausa |

Cómo mide el script y qué NO es comparable: `usefulMs` y `settledMs` son relojes de Node alrededor de Playwright (incluyen su latencia; `settledMs` lleva 1,8 s fijos de espera). El intervalo entre fotogramas es `requestAnimationFrame` de la página: **6,1 ms es el tope de la pantalla (~165 Hz)**, así que solo demuestra que no se pierden fotogramas, no cuánto margen queda. `transferKB` es contra un servidor local sin compresión. «Arrastre del globo» no tiene valor «antes».

### Pendiente / limitaciones (declarado)

- **Revisión humana** de las tres vistas (proyector incluido) antes de cualquier fusión. No se ha subido la rama.
- Relieve regional: fuera de los bloques L0 (puntos de horizonte del motor + 25 km) solo hay L1/L2/F; ahí las crestas entre vértices no están y la visual termina en «Límite del visor 3D» con el punto real en el mapa. No existe en el paquete un caso de **Sol oculto por cresta regional** a 2 ni a 10 m (no comprobado a 0 m ni en alturas intermedias). Entre el recorte de 4 km y el borde de la tesela Site01 (16 km) el motor usó PGDA78 de 5 m, que la web no publica: ahí el 80 m es contexto, con un escalón de hasta ~6 m (RMS 0,7 m) en la junta. Ampliar: `node scripts/geospatial/build-regional.ts --ring-km=40 --sector=A:120-140:150` y `publish-regional.ts`.
- **Verificación final (tras los dos ajustes de rendimiento de Engineer, commits `a4ce5d8` y siguiente):** `npm run verify` completo sobre el código final: typecheck y lint limpios · Vitest 153/153 · build PASS · Playwright **105 PASS, 0 FAIL, 1 omitida** en 4,6 min (la pasada anterior tardó 8,7 min). Historia: sobre `a4ce5d8` el verify dio 104 PASS y 1 FAIL de tiempo (`geo.spec.ts` «con otra superficie…»), y al repetir ×2 con 2 procesos solo las specs de Engineer fallaban 5 de 54 por tiempo: con WebGL por software el relieve regional pesaba demasiado. Se aligeró (L1 con 1 de cada 2 vértices, L2 con 1 de cada 4, anillo L0 de 9 km en vez de 12, y el relieve regional se pide 900 ms después de montar la vista); esa misma tanda pasó 52/52 en 2,7 min (antes 7,5 min). El caso 4 sigue igual: bloque `L0/29_30` a resolución nativa, Δ −0,058 m.
- Con el Sol a 1–2° la torre iluminada queda muy clara y el suelo oscuro (es la geometría real); la luz neutra del caso «Sol oculto» es plana a propósito.
- Globo: la textura global es de 2k (≈ 5 km/px); el detalle fino solo existe en el casquete sur. La rotación es de tipo «trackball» (puede acumular giro); «Volver al globo» lo restablece.
- Sin comprobar: lector de pantalla real, zoom al 200 %, Safari/Firefox, móvil físico, inglés de forma visual en las vistas nuevas.
- El proceso 30428 (servidor de Hugo en 4190) no se pudo detener desde esta sesión; no hizo falta: sirve `out/` actual.

### Siguiente paso exacto

1. Revisar en http://127.0.0.1:4190/ : portada (girar, «Polo sur», A/B, «Volver al globo», «Probar la misión»), Timeline y los cuatro casos de Engineer de la tabla.
2. Revisar la PR #21 y su vista previa de Vercel. Si se aprueba: fusionar antes la #20, cambiar la base de la #21 a `main` (`gh pr edit 21 --base main`) y fusionar. No fusionar en `main` sin esa decisión: publica en producción.
3. Si se pide más cobertura regional o afinar el deslizador, ver «Pendiente».

## 0. Estado vigente (PC-23) — leer primero

### 0.1 Reconciliación (comprobada con Git, GitHub y Vercel, no con informes)

| | |
|---|---|
| `main` (local = `origin/main`) | `aae19b2568befda0d40f03e9ee2528847c59289c` · «feat(engineer): calculate nominal visibility across the mast range» (PC-22, paquete de alturas 0–30 m) |
| Rama de trabajo | `feat/operacion-final-integracion`, creada desde `main` = `aae19b2`. Commits locales: `029ef05` (código y pruebas) y `0871dcf` (espera de carga en las pruebas E2E) = **commit candidato verificado**; encima, el commit de estos documentos (no toca `web/src`). Sin push al escribir esto |
| PR fusionadas | #9, #18, #19. Los commits de PC-18 a PC-22 (`4fe3247` … `aae19b2`) llegaron a `main` por push directo, sin PR |
| PR abiertas | #14, #15, #16, #17 (Aritz; las cuatro **en conflicto con `main`**, todas tocan `docs/VALIDATION.md`) · #7 y #8 (borradores de Aritz, sin conflicto) |
| Producción | https://site-regret.vercel.app → despliegue `dpl_9htxT2H2dz7jRCQvWMikpJu28hGt`, creado el 14-11-2026 17:37:30 (+01:00), `githubCommitSha` = `aae19b2…` (`main`). **Producción = `main`.** |
| Cómo se despliega | **Automático desde GitHub**: Vercel (proyecto `site-regret`, cuenta de Hugo) construye cada push a `main` y mueve el alias de producción (alias `site-regret-git-main-…`). Las ramas reciben vista previa. Los documentos que dicen «desde la CLI / sin despliegue automático» están superados |
| Protección de `main` | **Ninguna** (la API responde «Branch not protected») y sin CI en `main` (el flujo de CI está en la PR #16, sin fusionar). **Cualquier push a `main` publica en producción sin pruebas.** Pendiente de decisión humana: proteger la rama |

Documentos superados detectados (el código y Git mandan):

- `docs/STATUS.md` (dice que la capa geoespacial no está en `main`) y `docs/DEMO.md` (describe la demo antigua de 7 escenas como entrada de `/historia/`): **no se han tocado porque la PR #15 de Aritz los modifica**; hay que actualizarlos al resolver esa PR.
- `docs/continuidad/CONTINUAR.md` (rama `feat/mission-control-v2`, ramas locales «sin subir»): superado por esta sección.
- `web/README.md`, `docs/TRABAJO_REALIZADO.md` §9, `docs/DECISIONS.md` y `AGENTS.md` (recuento de pruebas y forma de despliegue): corregidos en PC-23.
- `web/PROGRESS.md`, `web/QA_REPORT.md`, `web/TASKS.md`: registro histórico de la primera entrega (PC-01 a PC-12); no describen el estado actual.

### 0.2 Propietarios por módulo (si hay solapamiento, gana el propietario ya asignado)

| Módulo / archivos | Propietario | Notas |
|---|---|---|
| `web/src/**`, `web/e2e/**`, `web/tests/**`, `web/scripts/**`, `web/data/derived/**`, `web/*.md` | Hugo · Claude Code (integrador único) | Nadie más edita estos archivos sin acuerdo previo y PR |
| `docs/continuidad/**`, `docs/TRABAJO_REALIZADO.md`, `docs/AI_USE.md`, `AGENTS.md`, `CLAUDE.md` | Hugo · Claude Code | Checkpoints y reglas |
| `docs/VALIDATION.md`, `docs/DEMO.md`, `docs/STATUS.md`, `.github/workflows/**` | Aritz (PR #14–#17) | El integrador NO los edita: se actualizan al resolver sus PR |
| `docs/site-regret/**` (PR #8), sección Orchestrator del `README.md` raíz (PR #7) | Aritz (borradores) | — |
| Auditoría científica y técnica, pruebas de regresión independientes | Oier · Claude Code | Solo en ramas `audit/*` o `test/*` nuevas, mediante PR; archivos nuevos (p. ej. `web/tests/audit-*.test.ts`), sin editar los existentes |
| Pruebas reales de UX, jurado, accesibilidad, navegador, contenido y entrega oficial | ChatGPT Work | Entrega informes e incidencias (issues); no edita el repositorio |
| `web/data/source/**` | Nadie | Paquete original: no se modifica nunca |

Reglas de integración: nadie salvo el integrador empuja a `main`; toda aportación llega en rama aislada con PR; fusionar y publicar lo deciden el integrador y el integrador humano (Hugo).

### 0.3 Qué cambia en el candidato (rama `feat/operacion-final-integracion`)

| Archivo | Cambio | Motivo |
|---|---|---|
| `web/src/components/story/LandingDemo.tsx` | Demo guiada en tres pasos: **1 · Elige** (A o B, sin cifras ni gráficos a la vista) → **2 · Descubre** (mayor racha sin Sol de A y B con el relieve de referencia, franjas de 30 días) → **3 · Cambia el terreno** (relieve alternativo y bloque **REGRET** con su explicación llana y «mejor elección: referencia → alternativo»). «Observador a 2 m» pasa a ser un extra. Cada paso tiene una acción principal y las salidas «Ver explicación» y «Ver evidencia» | P1: el giro final debe enseñar el regret sin jerga; la primera pantalla no debe exigir leer gráficos |
| `web/src/components/home/HomeView.tsx`, `comparador/PairTerrain.tsx` | Portada: mensaje de 10 segundos («Elegimos entre dos lugares de la Luna. Las montañas pueden tapar el Sol. Y si nuestro mapa del relieve cambia un poco, la mejor elección también puede cambiar») y fichas de A y B con su recorte real del DEM dentro de la primera pantalla | P1 |
| `web/src/components/evidence/HeightsEvidence.tsx` (nuevo), `EvidenceView.tsx`, `lib/data/engineerHeights.ts` | Evidencia documenta el paquete adicional de alturas: 244 escenarios, generador y hashes, contrastes con el contrato, límites, descarga del manifiesto; comprueba en el navegador que el SHA-256 del motor es el del paquete `site-regret/0.1` | P0: el paquete de alturas no tenía procedencia visible en la web |
| `web/src/components/engineer/EngineerView.tsx` | Texto de «Impacto de la altura» bilingüe y correcto (decía, solo en español, que «no hay datos entre alturas»); «Qué no calcula Engineer» distingue geometría de viabilidad estructural y declara que no se recomienda ninguna altura | P0: veracidad |
| `web/src/components/terrain/TerrainScene.tsx`, `web/e2e/geo.spec.ts` | Evento de diagnóstico `site-regret:render-now` (dibujo síncrono) y la prueba lo usa antes de leer el lienzo | P0: la prueba «dibuja la malla del DEM» **fallaba en `aae19b2`** (ver 0.4) |
| `web/tests/engineer-heights.test.ts` | +2 pruebas: igualdad con el contrato en TODOS los campos en 0/2/10 m y métricas de las 244 alturas recontadas desde sus propios estados | P0: cobertura de la auditoría |
| `web/e2e/landing-demo.spec.ts`, `jurado-pc21.spec.ts`, `engineer-heights.spec.ts`, `helpers.ts` | Adaptadas al nuevo flujo; portada; ficha de Evidencia (+1 prueba); arrastre rápido emitido dentro de la página; espera de carga del paquete de 15 a 30 s | Estabilidad de la suite sin rebajar ninguna comprobación |

No se ha tocado: `web/data/source/`, el contrato `site-regret/0.1`, `HEIGHTS_M`, el paquete de alturas, Regret Lab, Timeline, Comparador (salvo la miniatura compartida) ni Explore.

### 0.4 Auditoría del paquete de alturas de Engineer (`web/data/derived/engineer-heights/v1`)

Hecha con un script independiente (no el generador) sobre los archivos versionados y el paquete publicado:

- Trazabilidad: `engine_sha256` del manifiesto = `pipeline.py` del repositorio = línea de `SHA256_TRANSFERENCIA.txt` (`08e52de1…`); `generator_sha256` = `scripts/engine/engineer_heights.py` actual (`088cf068…`).
- Integridad: 371 archivos en disco = 371 declarados; 0 discrepancias de SHA-256 o tamaño.
- Coherencia en 0, 2 y 10 m con el contrato: **162 de 162 comparaciones exactas** (horizonte: elevación, distancia, origen, desconocidos, cota lejana y bandera; las seis series temporales; estados; intervalos; métricas; estado del escenario).
- Sin interpolación: las métricas de los 244 escenarios coinciden con el recuento de sus propios `state_codes`; 0 intervalos `UNKNOWN`; los intervalos son la codificación por tramos de los estados.
- Física: el horizonte no sube al elevar el observador (0 muestras en contra); suelo del observador = contrato; paralaje Sol/Tierra entre 0 y 30 m ≤ 4,8·10⁻⁶°.
- Interfaz: con superficies no nominales solo existen 0/2/10 m y cualquier otra altura es «vista previa sin cálculo» (probado en E2E); no se muestra ningún intervalo recomendado de altura.
- **Lectura científica a tener presente en la presentación:** en W2, con el terreno nominal, la mayor racha sin Sol pasa de 38 h 40 min (A) y 14 h 40 min (B) a 0 m a **0 h en ambos a 0,5 m**. El resultado a ras de suelo depende de relieve muy cercano (decenas de metros, rejilla de 5 m): es una propiedad del modelo, no una certeza sobre el terreno real, y refuerza el mensaje del proyecto; no debe presentarse como «con 50 cm de mástil se resuelve».
- **Decisión pendiente (humana):** el visor 3D de Engineer añade «grano y manchas del regolito procedurales» al sombreado. Está rotulado como presentación ilustrativa y no altera la malla ni ningún dato, pero el encargo geoespacial (§3) prohibía texturas de ruido presentadas como dato lunar. Opciones: mantener con el rótulo actual o retirarlo.

### 0.5 Pruebas

| Sobre | Comando | Resultado |
|---|---|---|
| `aae19b2` (= producción) | `npm run verify` (2 procesos) | typecheck y lint limpios · Vitest 124/124 · build PASS · Playwright **87 PASS, 5 FAIL, 1 omitida**. Durante esa pasada la máquina estaba cargada (auditoría y navegador en paralelo) |
| `aae19b2` | Las dos specs afectadas en serie (`--workers=1`) | 20 PASS, **1 FAIL real**, 1 omitida. El fallo real: `geo.spec.ts` «dibuja la malla del DEM…» leía 0 % de píxeles porque PC-22 pasó el visor a renderizado bajo demanda sin `preserveDrawingBuffer` y la prueba leía el lienzo fuera del fotograma. **La escena SÍ se dibuja** (comprobado en producción); el defecto era de la prueba. Los otros 4 eran de tiempo (15 s de `waitForData`, arrastre rápido del deslizador) |
| Candidato, antes del commit | `npm run verify` (2 procesos) | typecheck y lint limpios · Vitest **126/126** · build PASS · Playwright **92 PASS, 1 FAIL, 1 omitida**. El fallo: `engineer-heights.spec.ts` «una respuesta lenta…», en su parte de arrastre rápido (pedía una altura intermedia de más). La prueba enviaba 8 órdenes seguidas y exigía que todas llegaran dentro de los 180 ms de asentamiento del deslizador: depende de la carga (también falló en `aae19b2` con 2 procesos y pasó en serie). Se reescribió para emitir el arrastre dentro de la página, en una sola tarea; el comportamiento de la aplicación no cambia |
| Candidato | Specs afectadas ×2 (`engineer-heights`, `landing-demo`, `geo`, `--repeat-each=2`, 2 procesos) | **52 PASS, 0 FAIL**, 2 omitidas (la opcional en vivo, dos veces) |
| Commit `029ef05` | `npm run verify` completo (2 procesos) | Vitest 126/126 · build PASS · Playwright **92 PASS, 1 FAIL, 1 omitida**. El fallo, en otra prueba distinta (`timeline-engineer-visual.spec.ts` «azimut manual…»): `waitForData` agotó sus 15 s; esa spec en serie: 4/4 PASS. Es el patrón de tiempo conocido desde PC-13, que en cada pasada completa caía en una prueba diferente. Se amplió la espera de carga del paquete a 30 s en `e2e/helpers.ts` (solo pruebas) |
| **Commit candidato `0871dcf`** | `npm run verify` completo (2 procesos, 5,8 min de E2E) | typecheck y lint limpios · Vitest **126/126** · build PASS · Playwright **93 PASS, 0 FAIL, 1 omitida** · salida 0 |
| Omitida (declarada) | `geo.spec.ts` «Moon Trek en vivo» | Solo corre con `E2E_LIVE_TREK=1`; no ejecutada en esta sesión |

Revisión visual hecha por la IA en navegador (servidor de desarrollo): portada y demo en 1440×900 y 375×812, español e inglés, sin errores de consola ni desbordamiento horizontal; ficha de Evidencia. **No sustituye la revisión humana.**

No comprobado en PC-23 (declarado): zoom al 200 %, recorrido completo solo con teclado de la demo nueva, lector de pantalla real, WebGL desactivado en un navegador real (existe mensaje de caída, no probado aquí), prueba en proyector, segundo portátil sin red.

### 0.6 Alcance P2 («wow lunar»): estado, sin desarrollo nuevo en PC-23

Ya existe en `main`: Luna NASA en portada; mapa OpenLayers con imágenes LRO NAC; visor 3D del DEM en Engineer con rotación y zoom, torre a la altura real, Sol y Tierra en sus direcciones del paquete, línea de visión hasta el relieve que fija el horizonte, control de instante compartido con Timeline, caída si WebGL falla, y `prefers-reduced-motion` global. **No existe** un globo lunar 3D manipulable con A/B ni reproducción automática dentro de la escena 3D. No se ha iniciado: P0 y P1 tenían trabajo pendiente y queda menos de un día y medio para la entrega. Si se aborda, en rama propia con vista previa, sin tocar `main`.

### 0.7 Entrega NASA (15-11-2026, hora de Bilbao)

| Requisito | Estado |
|---|---|
| App y código públicos | App verificada en producción en `c9749ca`. GitHub abre sin cuenta. |
| Ficha del proyecto en inglés | Visible sin cuenta. Resumen, seis figuras con texto alternativo, fuentes, declaración de IA y enlaces a solución y código comprobados en Chrome. |
| Fuentes, créditos y licencia | Apache-2.0 para software original del equipo. Datos e imágenes con condiciones de sus proveedores. Véase [SOURCES.md](../SOURCES.md). La correspondencia exacta con la pestaña Resources no está acreditada. |
| Pruebas | 156 unitarias, 122 E2E contra producción, incluido Moon Trek en vivo, y la demo sin red externa aprobada en local. |
| Vídeo oficial | Pendiente de subir por el equipo. Añadir el enlace público, comprobar el límite de 30 s y los créditos del archivo final. |
| Envío | Pendiente de confirmación en el portal por el equipo. El correo local pide Submit for Judging antes de las 16:00 y otra vez antes de las 23:59. |

**Enlace público:** https://www.spaceappschallenge.org/2026/find-a-team/quemandotokens/?tab=project


### 0.8 Siguiente acción exacta

1. Hugo revisa el candidato (local: `cd web && npm run build && npm run serve`, o la vista previa de Vercel de la rama si se sube) recorriendo portada → «Probar la misión» → tres pasos → Evidencia, en español e inglés y en móvil.
2. Si lo aprueba: subir la rama, abrir PR contra `main`, comprobar la vista previa y fusionar. La fusión publica en producción; después, verificar `https://site-regret.vercel.app` y que el `githubCommitSha` del despliegue es el del merge.
3. Rollback si algo falla: en Vercel, promover el despliegue anterior `dpl_9htxT2H2dz7jRCQvWMikpJu28hGt` (`vercel promote https://site-regret-91h9xgawb-hugofdezdiez-5644s-projects.vercel.app`), y revertir el merge en Git para que `main` y producción vuelvan a coincidir.
4. Decidir con Aritz el orden de sus PR #14–#17 (hay que rehacerlas sobre `main`: las cuatro añaden filas a `docs/VALIDATION.md`) y fusionar #16 (CI) cuanto antes; proteger `main`.
5. Cerrar la tabla 0.7 con el equipo.

## 1. Dónde se trabaja

| | |
|---|---|
| Directorio de trabajo (raíz Git) | `C:\Users\Hugo\Projects\NASA-2026` (clon del equipo; antes estaba 29 commits por detrás y se avanzó con `merge --ff-only origin/main`, sin pérdidas) |
| Aplicación | subcarpeta `web/` (Next.js, export estático) |
| Remoto | `QuemandoTokenss/NASA-2026` (GitHub, privado) |
| Rama | `feat/mission-control-v2`, creada desde `main` = `6e41690` («Merge #18: integrate real lunar terrain and geospatial layers») |
| HEAD | `6dee90d` (E) sobre `8c2d682` (C + D), `0785e45` (B), `ca684bf` (A). **Subida a GitHub a petición de Hugo (2026-11-14); PR #19 abierto contra `main`** (https://github.com/QuemandoTokenss/NASA-2026/pull/19). Merge: lo decide el integrador. Sin despliegue |
| Otra copia | `C:\Users\Hugo\Desktop\Hugo\Proyectos\NASA-SpaceApps-2026\NASA-2026` (rama `feat/geo-real-terrain`, `47844ba`, ya fusionada en `main` por el PR #18). No se ha tocado; sus originales NASA de `web/data/raw/` se COPIARON a esta carpeta |

**Reconciliación de documentos antiguos:** el HANDOFF anterior (PC-11/12) decía que `feat/geo-real-terrain` no estaba fusionada. Ya lo está: `main` contiene el PR #18 (`6e41690`). En `main` SÍ está la capa geoespacial (G0–G10). `01_REANUDAR_IMPLEMENTACION.md` es histórico (relevo Hugo → Asier) y sus referencias de rama/HEAD están superadas.

## 2. Encargo y decisiones que se conservan

Encargo vigente: ver [ENCARGO_VIGENTE.md](ENCARGO_VIGENTE.md) §A.5 («Mission Control v2»: transformar Regret Lab, Timeline, Comparador, Engineer, Dashboard, Evidence e Historia). Reglas: `AGENTS.md`. Decisiones:

- La web solo LEE el paquete precalculado `site-regret/0.1`; no se recalcula visibilidad ni métricas en el navegador. `web/data/source/` no se toca.
- Geometría lunar del motor en `web/src/lib/geospatial/lunar.ts`: esfera R = 1 737 400 m, estereográfica polar sur, MOON_ME_DE421. Nada terrestre.
- Originales NASA en `web/data/raw/` (ignorado por Git). Derivados versionados en `web/data/derived/terrain/` con manifiesto y SHA-256.
- Con superficies no nominales no hay direcciones Sol/Tierra (el paquete solo las trae para la nominal). Nunca combinar efemérides nominales con horizontes de variantes.
- **Nuevo (PC-13):** la diferencia clon − nominal se calcula píxel a píxel en float32 con `src/lib/geospatial/difference.ts`, la misma función en Node (manifiesto) y en el navegador (mapa). Es una descripción del terreno, no una atribución causal de la inversión.
- **Nuevo (PC-13):** las 4 hipótesis propias (`bias_*`, `correlated_*`) NO se reconstruyen en la web (PCG64 + filtro gaussiano del motor). Solo se muestran sus horizontes.
- Texto de interfaz bilingüe: `L("es", "en")`.

## 3. Estado por bloques del encargo vigente

| Bloque | Requisito | Estado | Dónde |
|---|---|---|---|
| A · G15 | Regret Lab con clones reales, capas de diferencia y enlace al mapa | **HECHO (PC-13)**, verificado con Vitest + E2E + revisión visual en navegador | ver §4 |
| B | Timeline orbital con efemérides reales | **HECHO (PC-14)**, Vitest + E2E + revisión visual | ver §4 bis |
| C | Comparador A/B con cartografía real | **HECHO (PC-15)** | ver §4 ter |
| D | Engineer con 3D protagonista y alturas 0/2/10 | **HECHO (PC-15)** | ver §4 ter |
| E | Dashboard → Mission Control, Evidence, Historia | **HECHO (PC-16)** | ver §4 quater |
| F | G9 mosaico, G11 NAC, G10 mejoras ODE, G12 IAU, G13 PGDA90 | PENDIENTE (siguiente; sin cambios desde PC-11) | ver §5 |

Tabla G0–G18 heredada: G0–G8 VERIFICADO, G9 PARCIAL, G10 VERIFICADO en lo implementado, **G15 HECHO**, G11–G14 PENDIENTE, G16 no autorizado, G17 actualizado en PC-13 para G15, G18: rama nueva sin subir.

## 4. Bloque A terminado (PC-13): Regret Lab ↔ terreno real

Hecho:
1. **Registro**: 5 activos `pgda78.site01.clone_0001…0005` (`kind: "ensemble_raster"`, `variant: published_000N`) en `web/data/geospatial/registry.json`, con URL, bytes, SHA-256 y fechas del pasaporte. Disponibilidad comprobada antes de descargar (HTTP 200, `Content-Length` = pasaporte, `Last-Modified` = pasaporte), 277 GB libres.
2. **Descarga**: `npm run geo:fetch` descargó los 5 clones (5 × ~41 MB, 4 min 45 s) y los verificó enteros (tamaño, firma TIFF, SHA-256 = pasaporte). En `web/data/raw/pgda78_site01/` (no versionado).
3. **Recortes**: `scripts/geospatial/build-terrain.ts` (generator_version 2) recorta cada clon en la misma ventana 800×800 sin remuestrear → `web/data/derived/terrain/clones/clone_000N.f32` (5 × 2,56 MB, versionados). El manifiesto lleva `ensemble.members[]` con hash, estadísticas, `difference_vs_nominal` (mín, máx, media, media |Δ|, RMS, P99 |Δ|) y `at_sites`. **El script falla si la altura bilineal del clon en A o B no es exactamente `horizons_index.<sitio>.observer_ground_height_m.published_000N`**: coincide en los 10 casos. Las capas nominales se regeneraron byte a byte idénticas.
   - Resultado: Δ clon − nominal entre −3,70 y +4,57 m; RMS 0,44–0,45 m en los 5 clones; media ≈ 0.
4. **App**: `src/lib/geospatial/difference.ts` (`differenceGrid`, `differenceStats`, `horizonDelta`, `blockRms`), `terrain.ts` (`loadEnsembleMember`, verificación SHA-256), `colormap.ts` (`DIFFERENCE_STYLE` divergente azul-blanco-rojo, opacidad ∝ |Δ|), `publish-terrain.ts` copia `clones/`.
5. **Regret Lab** (`src/components/regret/TerrainDiffLab.tsx`, insertado en `RegretLabView.tsx` tras «Resultado por superficie»):
   - Mapa OpenLayers (misma proyección polar que Explore) con relieve sombreado del DEM nominal + capa clon − nominal, leyenda ±P99, lectura por clic, marcadores A/B y procedencia.
   - Gráfico Δ horizonte variante − nominal (1 440 azimuts, A y B; `src/components/charts/HorizonDeltaChart.tsx`), con selección de azimut por puntero/teclado.
   - Tabla del azimut elegido: altura de suelo del observador, horizonte, distancia y relieve (5/80/240 m) del punto que fija el horizonte en nominal y variante, y diferencia de terreno en ese punto; líneas N/V en el mapa. Texto explícito: no demuestra la causa de un cambio de ganador.
   - Miniaturas de los 5 clones (RMS de Δ por bloques de 80 m, misma escala), seleccionables.
   - Hipótesis propias: aviso «no reconstruible», sin terreno inventado; sí Δ horizonte.
   - «Mapa de decisiones» con modo **mapa de calor del regret** (regret de conservar la elección nominal de cada fila, en horas; filas sin elección nominal rayadas).
6. Hallazgo visible en la UI: en W2·0 m con `published_0001`, el mayor |Δ horizonte| de A es 2,05° a 5,25° y lo fija terreno a 7,5–30 m del observador: las variaciones del ensemble actúan sobre todo en campo cercano. Es una lectura de datos, no una causa demostrada.

## 4 bis. Bloque B terminado (PC-14): Timeline con geometría física

- `src/lib/geospatial/sky.ts`: cambio de base exacto azimut/elevación topocéntricos del paquete → vector en MOON_ME_DE421 con la base local del motor (`localBasis`); longitud y declinación lunar de la dirección; `bodyTrack`; `angleBetween`. No calcula efemérides nuevas.
- `tests/sky.test.ts` (4, datos reales): ida y vuelta az/el (< 1e-7°); la Tierra queda a < 9° de la longitud 0° y < 7,5° de declinación (libración); el Sol barre 360–380° de longitud en W1 (30 días) con declinación < 1,6°; A y B ven la Tierra en la misma dirección (< 0,01°).
- `src/components/timeline/OrbitalView.tsx`: esquema NO A ESCALA visto desde debajo del polo sur con la orientación del mapa (0° arriba, 90° E derecha): Luna con hemisferio iluminado según la dirección solar (iluminación global de la esfera, rotulada), trayectorias de Sol y Tierra de toda la ventana coloreadas por el ESTADO DEL MOTOR para la superficie seleccionada, cuerpos en el instante, líneas de visión desde el sitio, medidor de declinación lunar y lecturas reales (distancia km, az/el, ángulo Sol–sitio–Tierra, estado del intervalo).
- `TimelineView.tsx`: primera fila física = «Geometría Sol–Tierra–Luna» (esquema) + «Cielo local del observador» (horizonte del paquete con trayectorias nominales: geometría real), luego el reproductor y debajo las curvas/franjas existentes. Las efemérides se cargan siempre para la vista orbital; las curvas sobre el horizonte siguen solo con la nominal (no se mezclan con horizontes de variantes).
- Tres niveles rotulados: esquema no a escala / geometría real del observador / visibilidad respecto al horizonte (estado del motor).

## 4 ter. Bloques C y D terminados (PC-15)

**C · Comparador** (`src/components/comparador/PairTerrain.tsx`, `ComparadorView.tsx`):
- Nuevo primer panel «Terreno real del par A · B»: `GeoMap` compacto de Explore (teselas reales Moon Trek LRO NAC, proyección polar lunar) con la línea A→B y su distancia sobre la esfera; recortes del DEM PGDA78 de 800 × 800 m centrados en A y B a la MISMA escala (muestras exactas con `subGrid`, relieve sombreado de luz sintética + capa elegida: pendiente / retornos LOLA / solo relieve, ROI publicadas, barra de 200 m); tabla de lecturas de las 5 capas en A y B y A − B (iguales al paquete; enlaces a Evidencia). Rotulado: propiedades del terreno, no métricas de decisión.
- Se retiró `SiteThumb` de las tarjetas de sitio (el terreno real está en el panel nuevo).
- «Horizontes»: además de las dos curvas, Δ horizonte A − B por azimut (`HorizonDeltaChart` con rótulos configurables) y resumen de azimuts donde cada sitio está más tapado (> 0,1°).
- Se conservan conclusión dependiente del criterio, empates, UNKNOWN, 24 combinaciones y D por superficie.

**D · Engineer** (`EngineerView.tsx`, `terrain/TerrainPanel.tsx`):
- El panel 3D del DEM pasa a ser la vista principal (primera fila, ancho completo) con el selector de altura 0/2/10 m y «Rendimiento geométrico» a su lado: cambiar la altura actualiza a la vez el mástil, el obstáculo y las métricas del escenario.
- Con un clon publicado la malla 3D es el recorte de ESE clon (verificado con SHA-256) y el origen vertical es la altura de suelo del clon del paquete; con hipótesis propias se dibuja el nominal con aviso explícito. `data-mesh-surface` en el panel.
- `MastScene` sigue plegado y rotulado como ilustración.

## 4 octies. Rediseño visual integral y acabado para el jurado (PC-21, rama `feat/jurado-rediseno-visual`)

Encima de PC-20 (`25f24f8`), misma rama local. **Sin push, PR, merge ni despliegue.** Regret Lab queda fuera de alcance (sin cambios).

- **Imágenes nuevas** (solo presentación; `web/src/assets/scene/`, procedencia y SHA-256 en `SOURCES.json`; generador `web/scripts/imagery/make_scene_images.py`, con un decodificador OpenEXR ZIP/half propio en NumPy porque OpenCV no trae OpenEXR; originales en `web/data/raw/imagery/`, no versionados):
  - Portada: NASA SVS 5187 «Moon Phase and Libration, 2024», fotograma 413 (`moon.0413.tif`, SHA-256 `725b03a3…`) → `hero-moon-svs5187.webp` (2400 px) y `-1200.webp`. Crédito en la propia portada: «Vista de la Luna entera, no de Connecting Ridge».
  - Cielo de Engineer: NASA SVS 4851 Deep Star Maps 2020 (`starmap_2020_4k.exr`, `69b841cd…`) → `stars-svs4851-3k.jpg` (3072×1536, oscurecido). Fondo ilustrativo, no orientado al cielo real.
- **Dashboard** (`home/HomeView.tsx`): portada con la Luna NASA local, pregunta «¿Dónde alunizarías si solo pudieras aguantar 24 horas sin Sol?», nota «24 h = límite ilustrativo», CTA «Probar la misión» → `/historia/`, «Explorar el polo sur» y «Presentación en 7 escenas» (`/historia/#pregunta`). Debajo, el «porqué»: B pasa de 14 h 40 min a 49 h (leído del paquete con `siteReading`) con mapa NAC y relieve si falla Moon Trek. La imagen es local: carga sin Moon Trek. Cabecera a 1280 px sin solape (`AppShell`: navegación compacta, sello de datos y subtítulo solo ≥ 2xl).
- **Explore** (`explore/ExploreView.tsx`, `maps/GeoMap.tsx`, `colormap.ts`): mapa primero; fondo por defecto «Imagen lunar» (LRO/LROC NAC · NASA Moon Trek); «Relieve del terreno» con `mineralHillshade` (exageración ×3 solo visual, grises legibles); «Sin fondo» pasa a «Opciones avanzadas». Si Moon Trek falla o responde mal, el mapa cae solo al relieve calculado y lo dice: «Imagen orbital no disponible · mostrando relieve calculado» + motivo en lenguaje natural (`data-basemap-status="relief-fallback"`). Ficha simple (A/B, posición, lectura en lenguaje natural, «Ver luz y Tierra», «Comparar sitios»; «La altura de este punto se estimó a partir de las medidas cercanas» cuando LDEC = 0) con los datos técnicos en «Datos y fuentes» (`<details>`). PDS/ODE en una sección avanzada plegada. Las capas, leyendas, medidas, perfiles y procedencia siguen. Rótulos «ROI n» de los ROI de A/B desplazados bajo el marcador (antes se pisaban).
  - **Diagnóstico WAC**: el mosaico LROC WAC (100 m/px) solo tiene teselas a resoluciones de ~100 m/px o más gruesas; con el zoom por defecto (2,5 m/px) no se pedía nada y se veía negro. Se conserva como «Vista regional»: al elegirla el mapa se aleja a 160 m/px centrado entre A y B; al salir vuelve a 2,5 m/px. Verificado en navegador y E2E.
- **Engineer** (`terrain/TerrainPanel.tsx`, `TerrainScene.tsx`, `sceneParts.ts`, `engineer/EngineerView.tsx`): composición MU05 — escena 3D a la izquierda (~2/3) y mapa NASA a la derecha (~1/3), «Qué limita la visión» debajo; apilado en móvil. Torre de celosía con volumen, zapatas de hormigón, plataforma y barandilla en metal mate (`MeshStandardMaterial`), sombras PCF suaves; relieve con colores convertidos a espacio lineal (antes se veía lavado) y luz rasante; cielo de estrellas NASA; Sol y Tierra como imágenes en sus direcciones del paquete; visual fina; etiquetas sin solapes; brújula legible.
  - **Deslizador continuo 0–30 m** (paso 0,5, accesible por teclado, `tower-height-slider`): la torre crece sin reconstruir WebGL. 0/2/10 m son alturas calculadas (un clic, sincronizan la URL y las métricas). Cualquier otra altura es «Vista previa de la torre · sin cálculo de visibilidad a esta altura»: se ocultan conclusión, frase, direcciones, visual y guías dependientes de altura; el mapa pasa a vista en planta sin dirección; las métricas quedan atenuadas con «Último análisis calculado · X m». **No se ha tocado `HEIGHTS_M`, ni la URL analítica (sigue en la última altura calculada), ni el contrato; no se interpola nada.**
- **Timeline** (`charts/HorizonChart.tsx`, `TimelineView.tsx`): «Cielo local del observador» con Sol (SDO AIA 171) y Tierra (Blue Marble) como imágenes centradas en el punto real del instante, con rótulo y anti-colisión; leyenda debajo; gráfico más alto (470 de alto en el viewBox) y margen superior para que el disco no se corte. `HorizonChart` acepta `height` (300 por defecto: los demás usos no cambian).
- **Comparador** (`comparador/ComparadorView.tsx`): fichas gemelas refinadas; con Sol en toda la ventana (2/10 m nominal, 720 h) se lee «30 de 30 días» con 720 h en el detalle y fila «Sol visible durante toda la ventana»; la Tierra conserva su fila; la frase del motor va en «Cómo se obtuvo» (plegada). Control: W2 nominal 0 m → A 38 h 40 min, B 14 h 40 min.
- **Cambios tras la primera revisión visual**: terreno de Engineer en espacio lineal (antes lavado); fuera el halo naranja del observador; sin rótulo de observador en vista previa; rótulo final anclado a la izquierda; relieve mineral en Explore; texto del fallo en lenguaje natural (antes «Failed to fetch»); botones «0 m» sin salto de línea; iconos del cielo local más grandes + leyenda; crédito de portada legible en móvil. **Tras la segunda revisión**: gráfico del cielo local más alto (el panel quedaba medio vacío) y sin recorte de la Tierra; rótulos ROI bajo los marcadores; control de altura que encoge en 375 px (se salía de la tarjeta); contraste del crédito de portada (axe) y enlace subrayado en el pie del mapa de Engineer (axe).
- **Pruebas PC-21**: tsc y lint limpios; Vitest 119/119; build PASS. E2E nuevo `e2e/jurado-pc21.spec.ts` (portada y portada sin Moon Trek, Explore, deslizador 10 → 30 → «Ir a 2 m» → 0 → 6,5 sin escribir la URL, iconos del cielo que siguen al instante, control del Comparador y empate a 2 m). Ajustados `geo.spec.ts` (ODE avanzado, caída a relieve), `timeline-engineer-visual.spec.ts` (deslizador de azimut por nombre) y `app.spec.ts` (el caso demostrativo arranca desde «Ver la inversión paso a paso»). Batería completa con 2 procesos: 84 PASS, 3 FAIL por tiempo (`waitForData` 15 s en Evidencia y Mission Control), 1 omitida; esas dos specs en serie: 28/28 PASS. Tras los ajustes de la segunda revisión: specs afectadas en serie 34 PASS + 1 omitida; batería completa final con todo el código de PC-21 (2 procesos, 3,9 min): **87 PASS, 0 FAIL, 1 omitida**.
- **Capturas** (Edge headless, WebGL por software, red real a Moon Trek; versionadas en el commit de PC-21 a petición de Hugo, 17 MB): `web/docs/capturas/pc21/antes/` y `web/docs/capturas/pc21/despues/` — `{dashboard,explore,engineer-10m,timeline,comparador}-{1440x900,1280x720,375x812}.png`, `dashboard-1440x900-en.png`, `dashboard-1440x900-page.png`, `explore-offline-1440x900.png`, `engineer-{2m,0m}-1440x900.png`, `engineer-30m-preview-1440x900.png`, `engineer-page-1440x900.png`, `timeline-sky-1440x900.png`, `comparador-2m-sun-1440x900.png`, `comparador-page-1440x900.png`.
- **Pendiente / observado**: revisión del equipo en proyector; el relieve 3D de A es una meseta suave y se lee sobre todo por la sombra de la torre; el cielo estrellado no está orientado al cielo real del sitio (rotulado); en Explore el rótulo «ROI 4» puede ocultarse a zooms donde no cabe (OpenLayers no lo dibuja si se solapa).

## 4 septies. Rediseño visual para el jurado: Engineer, Timeline y Comparador (PC-20, rama `feat/jurado-rediseno-visual`)

Rama local creada desde `feat/timeline-engineer-visual` (`17beb48`). **Sin push, PR, merge ni despliegue.** Referencias: mockups MU03/MU04/MU05 (`origin/docs/site-regret-snapshot`), solo para composición (sin puntuaciones 0–100).

- **Engineer** (`terrain/TerrainPanel.tsx`, `TerrainScene.tsx`, `sceneParts.ts`, `CompassBadge.tsx`, `engineer/EngineerView.tsx`): el visor 3D es la primera pieza tras la cabecera, con una barra compacta pegada a la escena (Sitio A/B · 0/2/10 m · Sol/Tierra/Azimut · instante o deslizador de azimut · exageración). Conclusión breve sobre la escena («Sol visible · Horizonte −1,19° · relieve a 390 m · margen»). Relieve en gris mineral con luz rasante lateral a la mirada (estética, rotulada) y niebla de profundidad; torre de celosía con metal claro que recibe luz; cámara oblicua que encuadra base, remate y visual (y se aleja en pantallas estrechas). Etiquetas: la de «Sol»/«Tierra» se integra en «Dirección de mirada (Sol)» cuando el cuerpo está a < 12° de la mirada. Orden visual = orden de código: visor → frase completa → mapa orbital (sigue la dirección hasta el relieve) → bloque «Qué limita la visión» con todas las lecturas. Se retiró el selector de altura lateral duplicado; ventana y superficie pasan a una barra bajo el visor. A 1280×720 la primera pantalla contiene torre completa, observador, dirección, relieve que fija el horizonte y control de altura.
- **Timeline** (`timeline/OrbitalView.tsx`, `TimelineView.tsx`): escena «Geometría Sol–Tierra–Luna» con imágenes NASA locales optimizadas (`src/assets/celestial/`, procedencia en `SOURCES.json`, generadas con `web/scripts/imagery/make_celestial.py` desde originales en `web/data/raw/imagery/`, no versionados):
  - Luna: NASA SVS 4720 · LROC color 2k (SHA-256 `f7130a18…`), reproyectada ortográfica desde debajo del polo sur con la orientación del mapa; hemisferio nocturno sombreado según la dirección solar del instante.
  - Tierra: Blue Marble AS17-148-22727, NASA JSC (`adbdbbc7…`), recorte al disco.
  - Sol: PIA26681, NASA/GSFC/SDO, **AIA 171 Å, ultravioleta extremo en falso color (2025-09-10)** (`8b829280…`), recorte con 12 % de corona sin el rótulo de fecha.
  - Rótulos «Esquema geométrico · tamaños y distancias no a escala» y créditos «apariencia, no el instante». Trazas de la ventana atenuadas (color = estado del motor), direcciones del instante destacadas (continuas si visibles, discontinuas si no). El reproductor pasa a estar justo encima de la escena; altura del SVG limitada a 360 px.
- **Comparador** (`comparador/PairTerrain.tsx` → `PairAtlas` + `PairContext`, `ComparadorView.tsx`, `charts/Bars.tsx`): abre con relieve neutro en gris mineral (misma luz, misma curva de contraste y exageración ×3 solo del sombreado, idénticas en A y B); Pendiente y Retornos LOLA son capas opcionales al 45 % con leyenda y escala comunes. Dos fichas gemelas con la lectura del criterio bajo cada terreno y la Conclusión al lado; después «Comparación por métrica» (barras A y B en la misma escala de la ventana, Δ explícito) y un contexto compacto con la imagen orbital conjunta y las lecturas del DEM. Se retiraron las tarjetas de sitio con anillos y «Diferencias clave» (duplicaban la tabla). Corregido un fallo previo: las barras de `PairBars` no se pintaban (`var(--color)99` no es CSS válido) → `color-mix`.
- **Capturas antes/después** (build estático, Edge headless con WebGL por software, red real a Moon Trek): `web/docs/capturas/pc20/antes/` y `web/docs/capturas/pc20/despues/` — `engineer-10m-{1440x900,1280x720,375x812}[-page].png`, `engineer-2m-1440x900.png`, `engineer-0m-1440x900.png`, `engineer-manual-300-1440x900.png`, `timeline-{1440x900,1280x720,375x812}.png`, `timeline-orbital-1440x900.png`, `comparador-{1440x900,1280x720,375x812}.png`, `comparador-page-1440x900.png`.
- **Pruebas PC-20**: tsc y lint limpios; Vitest 119/119; build PASS. Playwright completo, 1.ª pasada tras la segunda iteración visual (2 procesos, 5,6 min): 81 PASS, 0 FAIL, 1 omitida. 2.ª pasada tras los últimos ajustes (2 procesos, 9,8 min, máquina cargada): 73 PASS, 8 FAIL, 1 omitida, todos con el patrón de tiempo (`waitForData` agota 15 s: Mission Control/Evidencia, Historia, Regret Lab ×2, Timeline…); repetida EN SERIE (`--workers=1`, 3,3 min): **81 PASS, 0 FAIL, 1 omitida**. Capturas (11 MB) en web/docs/capturas/pc20/, versionadas en el commit de PC-21 a petición de Hugo.
- **Pendiente / observado**: la cabecera común a 1280 px sigue solapando «Evidencia» con «Presentar» (AppShell, fuera de alcance); en móvil la escena de Engineer queda bajo la barra de controles (la torre se ve, la base cae bajo el pliegue); la textura lunar es «optimizada para estética» según su proveedor; revisión del equipo en proyector.

## 4 sexies. Iteración visual de Timeline y Engineer (PC-19, rama `feat/timeline-engineer-visual`)

Rama local creada desde `feat/historia-demo-interactiva` (`4fe3247`). **Sin push, PR, merge ni despliegue.**

- **Timeline** (`timeline/TimelineView.tsx`): la ficha del sitio sustituye `SiteThumb` por el `GeoMap` compacto con teselas reales NASA Moon Trek (LRO/LROC NAC). Encuadra el sitio activo (marcador grande) con el otro de referencia y lo sigue al alternar A ↔ B; nombre, coordenadas y datos cambian; ventana, altura, superficie e instante se conservan. Crédito visible «NASA Moon Trek · LRO/LROC NAC» y pie que recuerda que las sombras son de la adquisición. Sin conexión: relieve del DEM rotulado «Relieve derivado del DEM PGDA78 · luz sintética» + «Imagen orbital no disponible».
- **GeoMap** (`maps/GeoMap.tsx`): opciones nuevas SOLO para el modo compacto y desactivadas por defecto (`compactHeightClass`, `followFocus`, `showCredit`, `reliefFallback`); con `showCredit` se oculta la línea «m por píxel». Dashboard, Comparador, Historia y Engineer usan el compacto sin estas opciones: sin cambios.
- **Engineer** (`terrain/TerrainScene.tsx`, `terrain/sceneParts.ts`, `terrain/CompassBadge.tsx`, `terrain/TerrainPanel.tsx`): torre de vigilancia en celosía (patas, anillos, diagonales cruzadas, plataforma y barandilla) cuyo remate está a la altura REAL del observador (0/2/10 m); a 0 m, observador a ras del suelo. Encuadre inicial «Torre y visual» (cámara oblicua cercana que sigue la dirección de mirada y se aleja en pantallas estrechas); «Vista amplia del recorte» y «Mirar hacia el relieve» siguen disponibles. Brújula en el suelo (N, cardinales, arco hasta el azimut) y brújula 2D superpuesta (norte local arriba, θ, Sol y Tierra si el paquete trae direcciones). Visual gruesa desde el remate hasta el relieve que fija el horizonte; si cae fuera del recorte, discontinua hasta el BORDE REAL del recorte con la etiqueta «Fin del recorte 3D · relieve a X km». Etiquetas: «Observador · h», «Dirección de mirada · θ», «Relieve que limita la vista · d», «Sol», «Tierra». Frase explicativa encima de la escena y de la tabla técnica (estado visible/oculto del motor). La torre es ilustrativa (rotulado); el sombreado gráfico no es el cálculo.
- **Pruebas PC-19**: tsc y lint limpios; Vitest 119/119; build PASS; `e2e/timeline-engineer-visual.spec.ts` 4/4; Playwright completo con 2 procesos: 79 PASS, 2 FAIL (Comparador «24 combinaciones» y «exportación JSON», por tiempo), 1 omitida; esos 5 de Comparador con 1 proceso: 5/5 PASS.
- **Capturas** (build estático, red real a Moon Trek; Edge headless con WebGL por software): `web/docs/capturas/pc19/` — `timeline-{1440x900,1280x720,375x812}.png`, `timeline-B-1440x900.png`, `timeline-sitecard-{A,B}-1440x900.png`, `timeline-offline-1440x900.png`, `engineer-10m-{1440x900,1280x720,375x812}.png`, `engineer-2m-1440x900.png`, `engineer-0m-1440x900.png`, `engineer-manual-60deg-2m-1440x900.png`, `engineer-manual-300deg-10m-1440x900.png`.
- **Pendiente / observado**: a 1280 px la cabecera común solapa «Evidencia» con «Presentar» (AppShell, previo a esta iteración, no tocado); a veces la etiqueta «Sol» se superpone a «Dirección de mirada» cuando ambos azimuts coinciden; revisión humana en proyector.

## 4 quinquies. Demo interactiva de /historia/ (PC-18, rama `feat/historia-demo-interactiva`)

Rama local creada desde `feat/mission-control-v2` (PR #19) para no mezclar este encargo con el PR abierto. **Sin push** (el equipo la revisa antes).

- `/historia/` (y `?lang=en`) abre una demo de una sola pantalla: «Your mission can handle 24 hours without sunlight. Where would you land?». Ventana W2 (14 dic 2026 – 13 ene 2027 UTC), Connecting Ridge, mapa de relieve offline del paquete (`PairMap`), tarjetas A/B con la mayor racha sin Sol, mensaje y acción únicos por paso, franjas Sol/Tierra estables (UNKNOWN rayado).
- Pasos: elegir A/B (referencia, 0 m: A 38 h 40 min, B 14 h 40 min) → «Test another terrain model» (`correlated_plus`, rotulado «Alternative terrain · team hypothesis»: A 32 h 30 min, B 49 h; regret del motor 16 h 30 min si se eligió B) → «Raise the observer to 2 m» (A y B 0 h; «10 de 10 superficies» comprobado en el paquete). Cumplimiento del límite: B → ninguno → ambos. «Reiniciar demo». «¿Por qué cambió?» abre el horizonte del mismo sitio y altura (referencia vs alternativo) con enlaces a Regret Lab y Evidencia.
- El límite de 24 h es ilustrativo (único valor nuevo, `DEMO_LIMIT_HOURS`); con horas desconocidas no se declara cumplimiento.
- La presentación de 7 escenas sigue en «Presentación completa» y en sus enlaces directos (`/historia/#pregunta`, `#inversion`…); tiene «← Demo interactiva».
- Archivos: `src/lib/science/landingDemo.ts`, `src/components/story/LandingDemo.tsx`, `src/components/story/DemoStrips.tsx`, `src/components/story/StoryView.tsx`, `tests/landing-demo.test.ts`, `e2e/landing-demo.spec.ts`, `e2e/story.spec.ts`, `e2e/mission-control.spec.ts`.
- Pruebas: tsc y lint limpios; Vitest 119/119; build PASS; Playwright completo 77 PASS, 0 FAIL, 1 omitida (2 procesos, 3,0 min). Revisión visual en navegador a 1600×900 y 375×812. **Pendiente: ensayo del equipo en proyector.**

## 4 quater. Bloque E terminado (PC-16)

- **Dashboard** (`home/HomeView.tsx`): la luna ilustrada del héroe se sustituyó por el `GeoMap` compacto con imágenes reales LRO NAC (Moon Trek) de Connecting Ridge, A, B y la línea entre ambos. Nuevo panel **Mission Control** con el escenario sincronizado (sitio, ventana, altura, superficie, criterio) y una tarjeta por vista con un dato real de ese escenario (resultado del Comparador si hay criterio, «se mantiene x/y» de Regret Lab, clones verificados, intervalo del Timeline, altura y malla de Engineer, comprobaciones de Evidencia). Sustituye a los 3 pasos y a la navegación duplicada del pie. Las miniaturas `SiteThumb` de los sitios se sustituyeron por recortes reales del DEM (`SiteTerrainThumb`).
- **Evidencia** (`evidence/GeoEvidence.tsx`): las fichas de los 5 clones muestran su recorte descargable, SHA-256, estadísticas clon − nominal y la comprobación de altura en A/B; anclas `#geo-pgda78-site01-clone_000N` (Regret Lab enlaza a ellas).
- **Historia** (`story/StoryView.tsx`): la escena 1 usa el mapa NAC real (antes la figura `PairMap`); la escena «Desafiar el terreno» cita la RMS real de los clones (manifiesto) y enlaza al mapa de diferencias de Regret Lab.
- `PairMap.tsx` y `SiteThumb.tsx` siguen en el código (los usan otras vistas: `ContextMap` en Explore plegado y la figura del paquete), rotulados como derivados del motor.

## 5. Siguiente tarea exacta: revisión humana de la demo y bloque F

1. **Revisión humana** (bloqueo NO técnico): el equipo debe recorrer Dashboard → Explore → Timeline → Comparador → Engineer → Regret Lab → Evidencia → Historia con `npm run build && npm run serve` y anotar problemas visuales. Ninguna IA puede dar por buena la experiencia visual sola.
2. **Bloque F** (por orden de valor): G11/G9 producto NAC proyectado concreto de Connecting Ridge (ODE `pt=SDNDTM`/`BDRROI` en la caja de los sitios) y corregistro del mosaico; G12 nomenclatura IAU/USGS (Gazetteer of Planetary Nomenclature, solo con fuente verificada); G13 PGDA90 regional solo si aporta (≈408 MB: comprobar espacio y avisar); mejoras ODE (región visible / polígono).
3. **G18**: PR #19 abierto (push autorizado por Hugo). Pendiente: revisión del equipo, CI y merge por el integrador. No desplegar sin autorización.

### Antiguo §5 (bloque E) — HECHO en PC-16

En `web/`:
1. Dashboard (`src/components/home/HomeView.tsx`): sustituir la luna ilustrada del héroe por un mapa real (GeoMap compacto con NAC o el relieve del DEM) de Connecting Ridge con A/B; convertir el resto en «Mission Control»: estado del escenario seleccionado (ventana, altura, superficie, criterio), accesos directos a cada vista con su estado real (p. ej. ganador si hay criterio, número de clones verificados, instante de Timeline) y al caso demostrativo. Las tarjetas `SiteThumb` del Dashboard son derivados del motor: sustituir por recortes del DEM (`subGrid`) o rotular.
2. Evidence (`src/components/evidence/`): sección de procedencia de los 5 clones (ya hay entradas en el registro → comprobar que `GeoEvidence` las lista con hash) y de las nuevas vistas (diferencias, efemérides convertidas, recortes del Comparador); anclas `#geo-…` enlazables desde Regret Lab, Timeline y Comparador.
3. Historia (`src/components/story/`): actualizar escenas para enseñar mapa real, terreno 3D, diferencias de clones y vista orbital; las estrellas/luna ilustradas se rotulan o se sustituyen.
4. Pruebas E2E por vista y revisión visual.

### Antiguo §5 (bloque C) — HECHO en PC-15

En `web/`:
1. Leer `src/components/comparador/ComparadorView.tsx` (Conclusión, matriz de 24 combinaciones, `HorizonPair`, `PairMap`).
2. Sustituir el par de miniaturas/figura por cartografía real: `GeoMap` en modo compacto (o un mapa OpenLayers como `DiffMap` de `TerrainDiffLab.tsx`) con A y B, ROI y la capa numérica elegida; recortes georreferenciados de cada sitio lado a lado (misma escala) con lecturas del DEM en A y B (altura, pendiente, retornos LOLA, RMS) leídas de los recortes.
3. Tabla de métricas contrastadas A vs B para la ventana/altura/superficie, con diferencia explícita y conclusión que dependa del criterio elegido (conservar empates, UNKNOWN y la regla de tolerancia del motor).
4. Δ de horizonte A − B por azimut (mismo componente `HorizonDeltaChart`) en lugar de dos curvas sueltas, manteniendo la vista superpuesta.
5. Mantener la prueba de 24 combinaciones (`e2e/app.spec.ts`) y añadir E2E del mapa del comparador; revisión visual.

### Antiguo §5 (bloque B) — HECHO en PC-14

En `web/`:
1. Leer `src/components/timeline/TimelineView.tsx`, `TimePlayer.tsx` y `src/lib/data/loader.ts` (`loadEphemerisClock`, `loadEphemerisSite`). Las efemérides del paquete dan, por sitio, ventana y altura, azimut/elevación/distancia (km) de Sol y Tierra en 4 321 instantes (SPICE DE421, MOON_ME_DE421) — ver `EphemerisSiteChunk` en `src/lib/contract/schema.ts`.
2. Construir una vista «cielo local» (proyección azimut-elevación del observador): trayectorias reales de Sol y Tierra en la ventana, horizonte del paquete del sitio/altura como silueta, instante actual sincronizado con `timeIndex`, y estado (código del escenario) del instante. Rotular: geometría real del observador.
3. Panel aparte «geometría orbital no a escala»: Luna-Tierra-Sol a partir de las direcciones y distancias (`range_km`) del paquete en el instante (solo direcciones relativas desde el sitio; rotular «no a escala»). No inventar trayectorias: si falta un dato, no se dibuja.
4. Mantener las curvas/franjas actuales debajo, sincronizadas con el mismo `timeIndex`.
5. Pruebas: Vitest para cualquier transformación de coordenadas; E2E de sincronización instante ↔ cielo ↔ curvas; revisión visual.

Después: bloque C (Comparador con `GeoMap` compacto o recortes A/B), D (Engineer), E (Dashboard/Evidence/Historia), F.

## 6. Cambios locales y archivos de PC-13

Archivos nuevos o modificados (todo en `web/` salvo docs):
`data/geospatial/registry.json`, `data/derived/terrain/manifest.json`, `data/derived/terrain/clones/*.f32` (nuevo), `scripts/geospatial/build-terrain.ts`, `scripts/geospatial/publish-terrain.ts`, `src/lib/geospatial/difference.ts` (nuevo), `src/lib/geospatial/terrain.ts`, `src/lib/geospatial/colormap.ts`, `src/components/maps/GeoMap.tsx` (solo exporta `PROJECTION`, `SITE_HEX`, `rgbaToUrl`), `src/components/charts/HorizonDeltaChart.tsx` (nuevo), `src/components/regret/TerrainDiffLab.tsx` (nuevo), `src/components/regret/RegretLabView.tsx`, `tests/ensemble.test.ts` (nuevo), `e2e/regret-terrain.spec.ts` (nuevo), PC-16: `home/HomeView.tsx`, `evidence/GeoEvidence.tsx`, `story/StoryView.tsx`, `comparador/PairTerrain.tsx` (`SiteTerrainThumb`), `e2e/mission-control.spec.ts` (nuevo); PC-15: `src/components/comparador/PairTerrain.tsx` (nuevo), `ComparadorView.tsx`, `charts/HorizonDeltaChart.tsx`, `src/lib/geospatial/raster.ts` (`subGrid`), `engineer/EngineerView.tsx`, `terrain/TerrainPanel.tsx`, `e2e/comparador-terrain.spec.ts` (nuevo), `e2e/geo.spec.ts`, `tests/ensemble.test.ts`; PC-14: `src/lib/geospatial/sky.ts`, `src/components/timeline/OrbitalView.tsx`, `src/components/timeline/TimelineView.tsx`, `tests/sky.test.ts`, `e2e/timeline-orbital.spec.ts`, `docs/GEOESPACIAL.md`, `.claude/launch.json` (raíz; servidor de desarrollo para la vista previa), `docs/continuidad/*`.

No versionado a propósito: `web/data/raw/pgda78_site01/` (6 originales + 5 clones, ~410 MB), `web/node_modules`, `web/out`, `web/public/data`.

## 7. Comandos (en `web/`) y pruebas

Entorno: Windows 11, Node v24, npm, Edge (Playwright `channel: msedge`).

```
npm ci
npm run dev                         # http://localhost:3000
npm run build && npm run serve      # estático en http://127.0.0.1:4173
npm run geo:fetch                   # originales + 5 clones a data/raw (≈410 MB), verificados
npm run geo:build                   # regenera data/derived/terrain (incluye clones/ y diferencias)
npm run verify                      # typecheck → lint → test → build → test:e2e
```

| Prueba (PC-13, esta sesión) | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 avisos) |
| `npm test` (Vitest completo) | **108/108 PASS** (98 previas + 10 de `ensemble.test.ts`) |
| `npm run geo:fetch` | PASS: 5 clones descargados y verificados; 6 originales ya verificados |
| `npm run geo:build` | PASS: 5 capas idénticas + 5 clones; alturas A/B = paquete |
| `npm run build` | PASS |
| `npx playwright test` completo (2 procesos, 3,0 min) | **64 PASS, 1 FAIL, 1 omitida**. El fallo es «Comparador · las 24 combinaciones…» por TIEMPO (W2·2 m·max_joint_hours, 15 s); Comparador no se ha tocado. Re-ejecutada sola: PASS (11,3 s). Las 3 nuevas de `regret-terrain.spec.ts`: PASS |
| Revisión visual en navegador (dev, 1440×900) | HECHO: mapa de diferencia, Δ horizonte, tabla del obstáculo, miniaturas y mapa de calor visibles y coherentes. **Pendiente revisión humana del equipo** |
| PC-14 · `npm test` | **112/112 PASS** (+4 `sky.test.ts`) |
| PC-14 · `npm run lint`, `tsc`, `npm run build` | PASS |
| PC-14 · E2E Timeline (`timeline-orbital.spec.ts` 2 + 3 de `app.spec.ts`) | 5/5 PASS |
| PC-14 · E2E `a11y.spec.ts` (axe WCAG A/AA, 8 rutas) + `responsive.spec.ts` (375 px) + `i18n.spec.ts` | 20/20 PASS |
| PC-16 · lint, `tsc`, `npm test`, `npm run build` | PASS · Vitest **113/113** |
| PC-16 · `npx playwright test` completo (2 procesos, 4,0 min) | **73 PASS, 0 FAIL, 1 omitida** (incluye `mission-control.spec.ts` 3/3). Un primer intento quedó colgado ~17 min con 3 fallos: 2 por carga (pasan solos) y 1 real de localizador ambiguo (`heading 'Clones publicados'` también encontraba «Los 5 clones publicados…»), corregido con `exact: true` en `e2e/app.spec.ts`. Tras abortar una ejecución, matar el `serve-static` del puerto 4174 antes de relanzar |
| PC-16 · revisión visual Dashboard (dev, 1600×1000) | HECHO: mapa NAC real con A/B en el héroe, Mission Control con escenario sincronizado. Historia y Evidencia comprobadas solo por E2E. **Pendiente revisión humana** |
| PC-15 · `npm test` | **113/113 PASS** (+1 `subGrid`) |
| PC-15 · batería E2E completa tras C (2 procesos, 3,6 min) | **69 PASS, 0 FAIL, 1 omitida** |
| PC-15 · E2E Engineer/superficies tras D (`geo.spec.ts` + `app.spec.ts`) | 11/11 PASS (incluye la nueva «hipótesis propia») |
| PC-15 · revisión visual Comparador y Engineer (dev, 1600×1000) | HECHO: mapa NAC del par, recortes A/B, tabla, Δ A − B; 3D de Engineer en primera fila con malla del clon. **Pendiente revisión humana** |
| PC-14 · revisión visual Timeline (dev, 1600×1000) | HECHO: esquema orbital, trayectorias coloreadas por estado, hemisferio iluminado orientado al Sol, cielo local. **Pendiente revisión humana**. Batería E2E completa no re-ejecutada tras PC-14 (sí las afectadas) |

Resultados históricos (no re-ejecutados aquí antes de PC-13): Vitest 98/98 y Playwright 62 + 1 omitida (PC-10/11).

## 8. Problemas ya investigados (no repetir)

- **Heredocs de bash en esta máquina**: fallan con «unexpected EOF» si el texto lleva comillas o acentos. Escribir el script a un archivo (p. ej. Python) y ejecutarlo.
- **geotiff.js v3**: `getTiePoints()` es asíncrono; usar `getOrigin()`, `getResolution()`, `getGeoKeys()`, `pixelIsArea()`.
- **Precisión float32**: comparar alturas del motor sin pasar por double; en los centros de píxel la bilineal devuelve el valor exacto.
- **Vista previa**: tras cargar un mapa las teselas tardan 1–3 s; las capturas del panel pueden agotar el tiempo si la ventana no está al frente: reintentar.
- **`npm run build` con `npm run dev` abierto**: ambos usan `.next`; parar el servidor de desarrollo antes de compilar.
- **Miniaturas de clones**: el campo Δ es casi incorrelado a escala de píxel; submuestrear da «ruido de televisión». Se usa RMS por bloques de 80 m.
- E2E con 4 procesos agota tiempos (WebGL por software); `workers: 2` fijado. Con 2 procesos la prueba de 24 combinaciones del Comparador puede agotar tiempo de forma intermitente (PC-13); sola pasa.

## 9. Datos científicos y activos

| Activo | Estado | Ruta |
|---|---|---|
| PGDA78 Site01 surf, ldec, toterr, slp, slperr + ROI | VERIFICADO | `web/data/raw/pgda78_site01/` (no en Git); recortes en `web/data/derived/terrain/` |
| **PGDA78 Site01 clones 0001–0005** | **descargados y VERIFICADOS (SHA-256 = pasaporte); recortes y diferencias integrados** | raw no versionado; `web/data/derived/terrain/clones/` |
| Moon Trek NAC/WAC | integrado; en línea | registro |
| PGDA90 80/240 m, kernels NAIF | identificados, NO descargados | — |
| Ortoimagen NAC individual, nomenclatura IAU | no identificados | — |

## 10. Procesos

El servidor de desarrollo de la vista previa (`.claude/launch.json` → `site-regret-dev`, puerto 3000) se paró antes de compilar. Playwright levanta su propio servidor estático en 4174 y lo cierra al terminar. Sin descargas activas.
