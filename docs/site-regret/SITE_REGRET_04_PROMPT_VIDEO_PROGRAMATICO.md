# SITE REGRET — Prompt maestro de vídeo programático cinematográfico

**QUEMANDOTOKENS · Edición 1.0 · 13/11/2026 · NASA Space Apps Challenge 2026, Bilbao**  
**Estado:** especificación audiovisual, **NO VÍDEO RENDERIZADO NI SOFTWARE CONSTRUIDO**.  
**Formato deseado:** vídeo de explicación largo, 1920×1080, 30 fps, voz ES + subtítulos ES/EN, duración exacta **08:20 (500 s = 15 000 fotogramas)**.  
**Tecnología:** Remotion + three.js/R3F + SVG, edición determinista mediante código, audio original o licenciado.

> **REGLA TEMPORAL:** el vídeo de SITE REGRET solo puede producirse y renderizarse dentro de la ventana habilitada desde el 14/11/2026 a las 09:00 hora local. Este archivo contiene storyboard, narrativa y contrato técnico, no escenas ya realizadas.

> **DOS VÍDEOS INCONFUNDIBLES:** el vídeo programático largo es **EXPLICACIÓN CONCEPTUAL**. La demo oficial de **30 s** es **captura del producto realmente funcionando**, sin pantallas recreadas, capturas inventadas ni CGI presentado como implementación. Si el producto está parcial, el vídeo real lo muestra honestamente.

> **REGLA DE DATOS:** todo dato visual con apariencia científica se etiqueta `OBSERVED`, `DERIVED`, `MODELED` o `ILLUSTRATIVE`. En la app, la altura introducida por usuario se etiqueta además `SIMULATED`. Los tipos nunca se intercambian, y ninguna fuente cambia a `VERIFIED_ASSET` sin archivo concreto comprobado. Pertenencia a Resources sigue `RESOURCE_TAB_UNVERIFIED` hasta verificación humana.

## 01 / Instrucción integral para el agente audiovisual

> Actúa como dirección cinematográfica científica, guionista técnico, motion designer, especialista en gráficos programáticos, editor de voz y revisor de honestidad científica. Lee íntegramente `SITE_REGRET_01_PLAN_MAESTRO.md`, `SITE_REGRET_02_GUIA_CREACION_SEGUIMIENTO.md`, `SITE_REGRET_03_RESUMEN_FUNCIONALIDADES.md` y `SITE_REGRET_05_GUIA_INSTALACION_ENTORNO.md`. Diseña y, **solo durante las horas autorizadas**, programa un vídeo de 500 segundos exactos que responda a «¿Y SI EL MAPA SE EQUIVOCA?». La narración debe explicar por qué el horizonte lunar condiciona el Sol y la Tierra, cómo se calculan comparaciones desde NASA LOLA/DEM y SPICE, qué implica mover el observador 0/2/10 m, y por qué una decisión nominal debe probarse frente a variantes modeladas del terreno. Da la mayor fuerza visual y tiempo al REGRET mínimo y al mapa de robustez P1, aclarando que el mapa es una extensión condicionada a P0. No incluyas módulos fuera de alcance. Prohibido utilizar capturas falsas, logotipos oficiales NASA, líneas de misión inventadas y porcentajes de riesgo sin calibración.

La película debe parecer una exploración causal continua, no catorce diapositivas. La Luna se convierte en perfil; el perfil en máscara temporal; una decisión nominal en perturbaciones; las perturbaciones en robustez de una cresta; la robustez en una frase que incluye el método y su evidencia. La música y las transiciones ayudan a comprender la geometría, no a aparentar precisión.

## 02 / Pregunta dramática y arco narrativo

**Apertura:** dos balizas sobre una cresta estilizada; una elección parece evidente. Una mínima modificación del relieve gráfico cambia la línea de vista **solo como metáfora conceptual**. La voz pregunta: «¿Y si el mapa se equivoca?». La imagen se congela y una etiqueta dice `ILLUSTRATIVE • CONCEPT, NOT NASA DATA`.

**Desarrollo:** se explica que la pregunta no se responde con más zoom ni un cielo vistoso; se responde con fuentes, marcos y geometría. Sol y Tierra se convierten en series y ventanas, la altura en una hipótesis de infraestructura, y la clasificación A/B en una función objetivo firmada antes de calcular.

**Clímax:** el terreno deja de ser una verdad dibujada para convertirse en un conjunto **pequeño y controlado de hipótesis modeladas**. Una elección puede invertirse, mantenerse o quedar indeterminada. Cualquier porcentaje se lee con denominador y se denomina **fracción de variantes modeladas**. Se revela el mapa P1 de la cresta, mostrando no colores aleatorios, sino la idea de que una decisión puede ser robusta o frágil **solo respecto al conjunto de pruebas**.

**Cierre:** la frase científica y el pasaporte ocupan toda la pantalla, y el lema final es «NO SOLO ELIJAS UN LUGAR. CUESTIONA EL MAPA.»; no existe una promesa de seguridad de aterrizaje ni vínculo de aval NASA.

### Objetivos cognitivos del espectador

1. Diferenciar **sitio, fecha, altura, objetivo y variante topográfica** como cinco ejes de una decisión.
2. Entender que el DEM determina un perfil angular, SPICE produce direcciones y el algoritmo clasifica estados temporales.
3. Saber por qué los cinco estados incluyen `UNKNOWN`: ausencia de datos no equivale a sombra.
4. Reconocer que ver el centro solar no certifica vatios y ver el centro terrestre no certifica radio.
5. Saber por qué el terreno no puede desplazarse uniformemente con observador y producir artificialmente una gran reversión de horizonte.
6. Entender que un campo correlacionado con semilla es una hipótesis espacial, no ruido decorativo ni distribución calibrada de errores LOLA.
7. Distinguir la incertidumbre epistémica del DEM, la numérica del cálculo y la sensibilidad a parámetros modelados.
8. Poder explicar `regret` como diferencia entre utilidad óptima en variante y utilidad de la elección nominal bajo el mismo criterio.
9. Comprender qué será obligatorio P0, qué queda P1 si P0 verde y qué es opcional P2.
10. Reconocer la fuente, los límites y la autoría honesta a través del pasaporte.

## 03 / Sistema visual y sonoro

**Paleta:** azul noche `#091524`, azul profundo `#123650`, cian científico `#5fd7e5`, naranja solar `#ff9c6b`, violeta de incertidumbre `#9d8cf7`, hielo `#f4f8fb`. Azimut = arco horizontal fino; elevación = ángulo vertical explícito; horizonte = perfil blanco-cian; perturbación = trazo violeta con textura. Los tonos tienen significado y siempre un rótulo textual, no son solo decoración.

**Tipografía:** DejaVu Sans o equivalente licenciada para cuerpo, DejaVu Sans Mono para unidades, semilla, hash y etiquetas técnicas; títulos muy grandes y pocas palabras por plano. Números científicos auténticos se actualizan por JSON validado, no se interpolan a valores falsos. Las cifras ilustrativas nunca llevan unidades que las hagan parecer mediciones reales.

**Cámara:** combinar plano orbital conceptual, macro de cresta, cámara al nivel del observador, diagramas 2D y detalles de la interfaz **solo si se capturan de un producto real**. Descartar zooms que oculten incertidumbre. No copiar una captura de Moon Trek o NASA para falsificar funcionalidad propia.

**Sonido:** música original/licenciada suave, pulsos de tensión cuando cambia la elección, silencio en la aparición de la frase. Los sonidos de viento/superficie son dramatización editorial: la Luna no transmite sonido ambiental a través del vacío. Voz ES con vocalización precisa de unidades, más subtítulos EN humanos y revisión científica. No usar música de franquicias ni pistas con derechos ambiguos.

**Normas de accesibilidad del vídeo:** no estroboscopios, contrastes suficientes, subtítulos activables/quemados según export, descripciones para escenas abstractas y transiciones razonables; evitar destellos que compitan con texto importante. Respetar reduced-motion en una versión alternativa o reducir movimientos excesivos en la principal.

### Contrato de etiquetado

| Rótulo sobreimpreso | Uso y criterio |
|---|---|
| `OBSERVED` | asset NASA concreto y atribuido con identificador efectivo; no disponible en esta edición |
| `DERIVED` | resultado de cálculo reproducible con hash/algoritmo reales; nunca asumir que ya existe |
| `MODELED` | perturbación, regret, parámetros de sensibilidad con rango y semilla explícitos |
| `ILLUSTRATIVE` | Luna, relieve, iconos, UI ficticia o tramas **puramente conceptuales** |
| `CONCEPT · NOT NASA DATA` | rótulo grande y persistente en cualquier mapa no real |
| `ACTUAL PRODUCT CAPTURE` | solo para imágenes capturadas de app realmente ejecutable durante el evento, con prueba en repo |

**Convención de narración:** no decir «NASA decidió», «nuestra aplicación ha demostrado» ni «hay 90 % de éxito». Decir «el prototipo está concebido para...», «la variante modelada...» o, solo cuando el sistema esté construido y existan evidencias, «este cálculo registró...». La voz no conoce valores futuros que no están en `data/manifest.json` y salida científica real.

## 04 / Arquitectura de producción, sin código de producto

```text
video/
├── README.md
├── src/
│   ├── compositions/SiteRegretExplainer.tsx
│   ├── scenes/Scene00...Scene13/
│   ├── components/ConceptualMoon.tsx
│   ├── components/HorizonProfile.tsx
│   ├── components/SunEarthTimeline.tsx
│   ├── components/ObserverHeight.tsx
│   ├── components/RegretVariants.tsx
│   ├── components/CrestRobustnessMap.tsx
│   ├── components/ScientificPassport.tsx
│   ├── theme/tokens.ts
│   └── narration/cues.json
├── assets/verified/         # solo assets cuyo origen y licencia se constaten
├── assets/illustrative/     # assets propios y claramente conceptuales
├── audio/voice/
├── audio/music/
├── subtitles/es.srt
├── subtitles/en.srt
├── outputs/preview.mp4
├── outputs/explainer_1080p.mp4
└── docs/SHOTS_CREDITS_AND_EVIDENCE.md
```

**Separación técnica:** los componentes de película consumen un modelo visual `visual_examples` cuya procedencia indica su categoría; las escenas conceptuales no tienen acceso a tablas de cifras «reales» generadas por IA. Cuando se incorporen cálculos del software, se admite únicamente importar JSON validado por tests y enlazado a manifest/hash. Remotion controla tiempos y determinismo por frame; three.js produce perspectivas y curvas; SVG dibuja gráficos y pasaporte; FFmpeg solo mezcla y codifica sin cambiar las cifras.

**Reproducibilidad:** seed fija para ruido ilustrativo, interpolaciones de cámara deterministas, referencias semánticas de fotograma, paleta centralizada y archivos de voz con timecodes. Si se regraba un segmento, retimar por cue sin desplazar la longitud total de 15 000 fotogramas. Render preliminar a baja resolución, revisión de todas las etiquetas y después 1080p; no iniciar render 4K por prestigio.

### Gramática visual de una decisión refutable

La película tiene un protagonista permanente: un **recibo científico** que se rellena gradualmente, sin datos inventados. Sus cinco partes son `CRITERION LOCK`, `NOMINAL`, `STRESS K=4`, `WORST COUNTEREXAMPLE`, `PASSPORT + HASH`. El dato nominal no entra en el denominador K de perturbaciones. Nunca se hace pasar un clip conceptual por captura de producto construido.

| Plano cinematográfico | Transición programática | Qué enseña sin inventar |
|---|---|---|
| `THE HORIZON LIE` | línea de visión se aproxima a una cresta SVG estilizada | topografía y ocultación no son una foto |
| `THE MAST` | 0→2→10 m en geometría ilustrativa | cambia la línea de observación, no garantiza más horas |
| `THE COUNTEREXAMPLE` | cuatro variantes rotuladas, selección por regla | el peor caso **ensayado** tiene evidencia o dice «estable» |
| `DECISION CLIFF` P1 | una secuencia de amplitudes reveladas | la primera inversión **de la malla**, no un umbral universal |
| `PROVENANCE LIFT` | reloj → DEM → método → hash → frase | un hash comprueba identidad de datos, no exactitud del terreno |

Una referencia importante para explicar Validez es [NASA PGDA](https://pgda.gsfc.nasa.gov/products/78): documenta mapas de incertidumbre y 100 clones topográficos para algunas regiones polares. Los archivos exactos no están verificados en esta especificación; se puede explicar la existencia documental, pero nunca mostrar una supuesta muestra NASA o una distribución de incertidumbre como resultado si no se valida el asset y su licencia. Los histogramas de estrés sintético y clones de fuente, si llegan a calcularse, se reportan **por separado**.

**Diferencia científica crucial:** sumar la misma constante al terreno y al observador no es un estrés relativo que necesariamente cambie visibilidad; el sesgo ±X se define sobre oclusores respecto al observador anclado. Un flip observado en una variante no se llama fallo de misión, y su frecuencia no se llama probabilidad calibrada.

## 05 / Storyboard y aritmética exacta (14 escenas)

| # | Inicio–fin | Duración | Núcleo | Naturaleza visual |
|---|---|---:|---|---|
| 00 | 00:00–00:24 | 24 s | Pregunta: ¿y si el mapa se equivoca? | `ILLUSTRATIVE` |
| 01 | 00:24–00:54 | 30 s | Polo sur, crestas y horizonte | `ILLUSTRATIVE` |
| 02 | 00:54–01:24 | 30 s | Reto: sitios y fechas | reto textual `VERIFIED_SOURCE`, escenario ilustrativo |
| 03 | 01:24–01:58 | 34 s | DEM/LOLA, marco local, nodata | fuente explicada, gráficos ilustrativos |
| 04 | 01:58–02:34 | 36 s | SPICE, Sol y Tierra en el mismo perfil | geometría conceptual |
| 05 | 02:34–03:12 | 38 s | Dos sitios, dos ventanas, cinco estados | UI conceptual claramente rotulada |
| 06 | 03:12–03:54 | 42 s | Mástil 0/2/10 y línea de vista | altura `SIMULATED`, geometría conceptual |
| 07 | 03:54–04:40 | 46 s | Elegir un criterio; ranking nominal | `MODELED` solo si datos realmente calculados |
| 08 | 04:40–05:34 | 54 s | REGRET: ±X y correlación espacial | `MODELED` / `ILLUSTRATIVE` según material |
| 09 | 05:34–06:28 | 54 s | Cresta robusta/frágil P1 y límites | `ILLUSTRATIVE` salvo mapa calculado |
| 10 | 06:28–07:02 | 34 s | Fracción de variantes, no probabilidad | contador conceptual o JSON real |
| 11 | 07:02–07:30 | 28 s | Pasaporte, incertidumbres y validación | esquema conceptual |
| 12 | 07:30–07:56 | 26 s | 4 portátiles, gates y uso honesto de IA | diagramas de organización |
| 13 | 07:56–08:20 | 24 s | Demo real vs concepto y cierre | captura real solo si existe |

**Suma comprobable:** 24 + 30 + 30 + 34 + 36 + 38 + 42 + 46 + 54 + 54 + 34 + 28 + 26 + 24 = **500 segundos exactos**, equivalentes a 8 minutos 20 segundos y **15 000 frames a 30 fps**. Cada escena ocupa intervalo semiabierto `[inicio, fin)`; no duplicar el frame de corte.

## 06 / Desarrollo narrativo por escena

### 00 · La elección imposible — 00:00–00:24 (24 s)

**Imagen:** pantalla negra, dos marcadores A/B sobre una línea fina que evoca un relieve. Una silueta de elevación casi invisible corta el rayo de luz. Pregunta escrita en letras enormes, naranja y violeta; sello `ILLUSTRATIVE`. **Voz:** «Dos lugares en la Luna. Una única elección. El mapa parece responder. Pero, ¿qué pasa si el mapa se equivoca?». **Movimiento:** no activar un flip numérico de ganador; solo una metáfora de incertidumbre que revela el problema. **Fondo de seguridad:** la geometría no representa ningún lugar real.

### 01 · La geografía de las sombras — 00:24–00:54 (30 s)

**Imagen:** vista polar conceptual, horizonte muy bajo, luces que recorren un perfil. La Tierra aparece cercana al horizonte solo como representación, con rótulo. **Voz:** «En regiones lunares polares, el Sol puede estar cerca del horizonte. Colinas y crestas interfieren con líneas de visión de Sol y Tierra. El lugar y el instante importan». **Inserción:** nota «visibilidad geométrica ≠ potencia o radio». No dibujar coordenadas ni rachas en horas.

### 02 · La misión del reto — 00:54–01:24 (30 s)

**Imagen:** panel con texto correcto del reto *Lunar Landing Site Navigator* y dos selecciones A/B; ambas son tarjetas conceptuales sin nombres propios. **Voz:** «El desafío propone una herramienta intuitiva para comparar sitios y fechas usando posiciones de Sol y Tierra respecto al horizonte. Queremos llevar una elección hasta su condición menos cómoda: ¿resiste cuando el terreno no es perfectamente conocido?». **Crédito:** enlace oficial del reto revisado, sin logotipo NASA ni aval.

### 03 · De un DEM a un perfil — 01:24–01:58 (34 s)

**Imagen:** mosaico abstracto de celdas que se convierten en malla; un sector `nodata` aparece rayado; líneas 3D salen del observador y convergen en un perfil polar. **Voz:** «Un modelo digital de elevaciones, como los productos de LOLA, describe el terreno con una resolución y un datum. Desde cada sitio trazamos líneas de vista, buscamos el obstáculo angular máximo y anotamos dónde el dato falta. El horizonte es un cálculo, no una fotografía». **Rótulos:** `OBSERVED` solo sobre referencia documental, `ILLUSTRATIVE TERRAIN` sobre superficie no real.

### 04 · El reloj celeste — 01:58–02:34 (36 s)

**Imagen:** dos haces de dirección, naranja y cian, se proyectan en la base este/norte/arriba. Un reloj UTC da paso a ET como etiqueta sin valores ficticios. **Voz:** «SPICE ofrece las direcciones geométricas del centro solar y terrestre desde un observador lunar. Las transformamos al mismo sistema local del relieve y comprobamos cuándo superan el horizonte. El marco y la escala temporal quedan en el pasaporte». **Advertencia:** no interpolar posiciones reales inexistentes.

### 05 · Dos ventanas y cinco estados — 02:34–03:12 (38 s)

**Imagen:** dos filas A/B y dos periodos W1/W2; barras sincronizadas y leyenda explícita `SUN_ONLY`, `EARTH_ONLY`, `BOTH`, `NEITHER`, `UNKNOWN`. `UNKNOWN` tiene rayado gris, no es sombra. **Voz:** «En dos ventanas de fechas comparamos los mismos criterios. Contamos las horas, intervalos y rachas dentro de cada ventana. Y si falta un sector, no lo pintamos de noche: lo declaramos desconocido». **Visual:** valores de tiempo ficticios están prohibidos; usar rótulos sin números o texto `CONCEPT`.

### 06 · Subir el observador — 03:12–03:54 (42 s)

**Imagen:** una torre lineal con marcas 0/2/10 m como **parámetros de diseño**, tres haces de visión y reconstrucción de horizonte. **Voz:** «Elevar un observador puede superar una cresta. SITE REGRET plantea tres alturas: cero, dos y diez metros sobre el terreno modelado. Cada altura exige un horizonte propio. Puede cambiar una ventana, o puede no cambiar nada; la respuesta no se decide con una animación». **Detalle:** las tres marcas sí son especificación real del producto, no cotas de emplazamientos.

### 07 · Antes de preguntar quién gana — 03:54–04:40 (46 s)

**Imagen:** tarjetas de criterio «minimizar mayor racha sin Sol», «maximizar tiempo simultáneo», con candado visible al escoger una. En el plano siguiente se ve un ranking A/B con etiquetas `EXAMPLE, NO NASA RESULT`, nunca números. **Voz:** «Elegimos un criterio antes de mirar los resultados: qué queremos maximizar o minimizar y cómo tratar empates. Con el mismo modelo, A o B tendrá un resultado nominal. Pero un ganador en el modelo nominal no termina la investigación. La pregunta esencial empieza aquí». **Motion:** transición del perfil blanco al violeta de incertidumbre.

### 08 · REGRET: el terreno no es una verdad absoluta — 04:40–05:34 (54 s)

**Imagen:** malla de terreno que se deforma en una región alrededor de observador fijo, comparada con una traslación uniforme de todo el sistema que no debe producir una inversión artificial. Dos deformaciones relativas ±X y un campo suave correlacionado con semilla (ondas espaciales), con etiquetas grandes `MODELED / SEED / NOT CALIBRATED`. **Voz:** «Primero calculamos la elección nominal. Después aplicamos hipótesis explícitas: un sesgo relativo del relieve y un campo espacialmente correlacionado, ambos reproducibles. No estamos corrigiendo un error NASA conocido. Estamos preguntando qué decisiones sobreviven a estas variantes. El regret mide la pérdida de utilidad de la elección frente a la mejor alternativa dentro de cada variante». **Ciencia:** si el resultado real no invierte el ranking, mostrar mantenimiento; no construir drama con datos falsos.

### 09 · La cresta de la robustez — 05:34–06:28 (54 s)

**Imagen:** un transecto conceptual con puntos de colores por estado `ROBUST`, `FRAGILE`, `UNKNOWN`, visiblemente rotulado `CONCEPT / NOT NASA DATA`. Se acerca la cámara a un punto donde una curva de horizonte cruza una dirección celeste; el mapa muestra qué *podría* revelar el P1. **Voz:** «Si el núcleo funciona, podemos repetir la comparación en puntos de una cresta. No buscamos un mapa de probabilidades. Marcamos dónde una elección sigue ganando bajo todas las variantes evaluadas, dónde alguna la invierte y dónde no hay información suficiente. Es una manera espacial de localizar la fragilidad de una decisión». **Límite:** hasta 25 puntos por presupuesto inicial, no una cartografía global.

### 10 · Un contador no es una probabilidad — 06:28–07:02 (34 s)

**Imagen:** fichas de variantes que entran en tres columnas: conserva, invierte/empata, inválida. Un cociente explícito `N evaluadas que conservan / N evaluadas` aparece sin sustituirlo por un porcentaje inventado. **Voz:** «Una fracción de variantes modeladas no significa probabilidad de que una misión triunfe. No tenemos aquí una distribución de errores calibrada. Por eso mostramos semilla, amplitud, correlación, empates, hipótesis y límites». **Rótulos:** epistémica DEM / numérica / parámetros modelados en tres planos distintos.

### 11 · Pasaporte de una decisión — 07:02–07:30 (28 s)

**Imagen:** una tarjeta de evidencia con iconos de DEM, kernel, código, fecha y hash; los campos concretos llevan `PENDING` hasta existir. Una pestaña `VALIDATION` distingue prueba analítica y referencia independiente. **Voz:** «Cada escenario tendrá un pasaporte: datos, hashes, kernels, marcos, umbrales, versión de algoritmo y comparaciones independientes cuando sean posibles. El hash no hace perfecto el mapa; hace reconocible el experimento». **Precaución:** no decir «error inferior a...» sin diferencia medida en grados.

### 12 · Cuatro portátiles, una misión — 07:30–07:56 (26 s)

**Imagen:** GitHub en el centro, PC-A datos, PC-B ciencia/REGRET, PC-C interfaz, PC-D QA/offline/submission. Desde cada equipo salen 1–2 pequeñas tarjetas AO aisladas. **Voz:** «Durante 39 horas, cuatro responsables coordinan fuentes, motor, experiencia y pruebas. Los agentes ayudan a programar y explicar, pero la física y la decisión son deterministas. GitHub y revisiones humanas aseguran que lo que se entrega exista». **Seguridad:** no mostrar claves, sesiones ni marcas de proveedores sin permiso.

### 13 · La pregunta permanece — 07:56–08:20 (24 s)

**Imagen:** split-screen conceptual vs captura real, con rótulos inequívocos. Si todavía no hay aplicación lista en ese momento, la parte de captura solo dice `ACTUAL PRODUCT CAPTURE PENDING`, nunca una simulación de software. La frase determinista aparece como **plantilla**, no como resultado real. **Voz:** «No pedimos que confíes en una imagen espectacular. Pedimos que puedas repetir la decisión, leer sus supuestos y cuestionar el mapa. SITE REGRET. No solo elijas un lugar. Cuestiona el mapa». **Último segundo:** solo el lema en alto contraste.

### 06.1 La demo oficial y el vídeo conceptual nunca se confunden

La demo de 30 segundos, si la guía oficial confirma ese límite, será **captura de la aplicación realmente construida desde H+0**, no un render de Remotion. Proponer seis clips objetivos: 00–03 pregunta, 03–08 dos sitios/ventanas, 08–13 mástil, 13–21 REGRET mínimo, 21–26 peor variante y frase, 26–30 pasaporte/hash. Si P1 está construido y trazable puede ocupar el intervalo 21–26; si no, conservar exclusivamente P0. No superponer UI fabricada como si fuera una sesión interactiva.

**Frases ES/EN para orientar el montaje:** «La pregunta no es solo quién gana, sino qué supuesto podría hacerle perder» / «The question is not only who wins, but which assumption could make it lose». «Esta fracción cuenta variantes ensayadas, no futuros de misión» / «This fraction counts tested variants, not possible mission futures». «Si la evidencia no alcanza, preferimos no decidir» / «If evidence is insufficient, we prefer not to decide».

El último segundo transmite una idea única: **«Una buena decisión muestra sus supuestos» / «A good decision shows its assumptions»**. No usar logos oficiales y evitar cifras sin manifest y JSON validados.

## 07 / Reglas de animación detalladas

- **Objeto compartido:** la misma cresta conceptual conserva forma básica desde la escena 00 hasta 09; cuando se deforma, el movimiento lleva una etiqueta de variante. Nada de topografía falsa que parezca observada.
- **Sincronía causal:** cada cambio visual debe tener causa explicada: cambiar fecha modifica orientación, cambiar altura modifica líneas de vista, cambiar variante modifica relieve relativo, cambiar objetivo modifica cómo se compara.
- **Curvas y tablas:** SVG dibuja máscaras discretas con 5 estados; transiciones suaves en dirección celeste no deben esconder los saltos de muestreo ni la presencia de `UNKNOWN`.
- **Ensemble:** la semilla de efectos gráficos no es semilla científica por defecto. La variable visual queda separada de cualquier hash del motor. Si se importan datos reales, la escena indica exactamente de qué JSON proceden.
- **Crest map:** máximo 25 marcadores **conceptuales** si no se ha calculado; no asignar coordenadas lunares ni alturas reales. Un resultado real P1 solo se representa tras validación explícita.
- **Textos técnicos:** no confundir «visibilidad del centro de la Tierra» con «comunicación directa garantizada», «centro solar despejado» con «potencia eléctrica» o «robustez frente a K variantes» con «probabilidad de misión».
- **Color y subtítulos:** cian para Tierra, naranja para Sol, violeta para incertidumbre, gris rayado para falta de datos; las descripciones textuales deben sobrevivir a la escala móvil y al contraste de pantalla.
- **Plan de montaje:** 14 escenas autónomas con timecodes exactos, cada una pudiendo renderizarse de forma separada, sin modificar la duración global.

## 08 / Recursos, integridad y créditos

**Material audiovisual permitido:** diseño propio de gráficos vectoriales, iluminación conceptual de tres.js, música y voz originales, fuentes con licencia. Un asset NASA real solo puede utilizarse tras verificar origen, licencia y atribución; nunca el logotipo NASA como identidad del equipo. Material creado por IA se declara cuando el reglamento o licencias lo requieran. Prohibido atribuir a NASA una frase, clasificación o escenario inventado.

**Fuentes textuales verificables de contexto:** [reto #04](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/), [NAIF](https://naif.jpl.nasa.gov/), [Moon Trek](https://trek.nasa.gov/moon/), [PDS LOLA](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=LRO-L-LOLA-4-GDR-V1.0). Estos enlaces son documentación consultable; no se declaran bytes descargados ni datos calculados. Todo recurso exacto usado debe quedar en manifest y créditos.

## 09 / QA de película y render

- [ ] Dura exactamente **500 segundos**, 15 000 frames a 30 fps, sin frames extra de cierre. Esta cifra es duración audiovisual, no dato lunar.
- [ ] Escenas 08 y 09 tienen 54 s cada una; REGRET y cresta son el clímax, no un apéndice final.
- [ ] No hay captura simulada de una aplicación no construida.
- [ ] Todos los ejemplos planetarios que no proceden de un DEM verificado están rotulados `ILLUSTRATIVE / CONCEPT, NOT NASA DATA` durante la visualización.
- [ ] Cualquier ángulo/hora con apariencia real proviene de JSON y fuente con hash, o se retira.
- [ ] No se menciona probabilidad real de éxito/fallo sin calibración ni se confunde una fracción modelada con confianza.
- [ ] Las tres incertidumbres aparecen separadas y se explica el truco de la traslación uniforme del DEM.
- [ ] Los subtítulos ES/EN se sincronizan con voz, se leen en móvil y usan traducción científica consistente.
- [ ] Se verifican audio/licencia/contraste/accesibilidad/créditos y ausencia de logotipos NASA.
- [ ] La última idea ocupa el último segundo: **«No solo elijas un lugar. Cuestiona el mapa.»**

## 10 / Encargo entregable al creador del vídeo

Una vez abierto H+0 y únicamente si los responsables consideran que no distrae del P0, producir: fuentes Remotion/three.js/SVG versionables; narración y subtítulos ES/EN; renders de escena a baja resolución y máster MP4 1080p/30 fps; lista de assets y licencias; reporte de cumplimiento de 15 000 frames y correspondencia voz/timecode. Separar en carpeta distinta los assets de la **demo real de 30 segundos**, que debe grabarse posteriormente desde el producto ejecutable. La película larga es material para comprender la idea y puede no incluirse en el envío del concurso.

**Documentos de base:** `SITE_REGRET_01_PLAN_MAESTRO.md`, `SITE_REGRET_02_GUIA_CREACION_SEGUIMIENTO.md`, `SITE_REGRET_03_RESUMEN_FUNCIONALIDADES.md` y `SITE_REGRET_05_GUIA_INSTALACION_ENTORNO.md`. La técnica no amplía el alcance P0/P1/P2 del plan. **Estado al 13/11/2026:** storyboard listo para ejecutar durante el evento, vídeo no creado.
