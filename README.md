# SITE REGRET · web (fase 1)

Comparador de dos sitios del polo sur lunar —**A = Connecting Ridge ROI 4**, **B = ROI 6**— sobre resultados científicos precalculados y trazables (`site-regret/0.1`: 120 escenarios, 6 comparaciones × 4 criterios). Equipo **QuemandoTokens**, NASA Space Apps Challenge 2026 · reto *Lunar Landing Site Navigator*.

> Pregunta: ¿se mantiene la elección entre dos lugares cuando cambiamos explícitamente las hipótesis sobre el terreno?

## Requisitos

- Node.js ≥ 22.18 (probado con 24.19). npm.
- No hace falta Python, Internet en tiempo de ejecución ni ninguna API.

## Ejecutar

```bash
npm install
npm run dev          # http://localhost:3000 (prepara los datos antes de arrancar)
```

Versión estática, como se entregaría (sirve `out/` sin red):

```bash
npm run build        # prepara datos → next build → corrige segmentos del export
npm run serve        # http://127.0.0.1:4173
```

## Verificar

```bash
npm run verify       # typecheck + lint + tests + build
```

| Comando | Qué comprueba |
|---|---|
| `npm run data` | 47 originales contra `SHA256_TRANSFERENCIA.txt`; división en 27 trozos; reensamblado **idéntico** al original (igualdad estricta, incluido `-0`); copias byte a byte; manifiesto con SHA-256 |
| `npm test` | 47 pruebas sobre datos auténticos: integridad, contrato (positivos y negativos), selección por tupla, caso documentado W2·0 m (B gana; 2/4 propias con 1 empate, 4/5 clones; peor regret 16,5 h y 528,67 h), empate nominal en los otros 5 pares, alineación de marcadores con la figura del motor, URL/estado, formato |
| En navegador | Cada trozo se verifica con SHA-256 antes de usarse; si no coincide, la interfaz se bloquea y lo explica |

Comprobación manual sugerida: abrir `/explore/`, cambiar altura (0/2/10 m) y superficie; ver que la URL cambia y que el perfil de horizonte se recarga; navegar a otra sección y comprobar que la selección se conserva; abrir `/?w=W9&h=7` y ver el aviso de parámetros ignorados; estrechar a móvil (375 px) sin scroll horizontal.

## Estructura

```
data/source/              originales científicos intactos (ver su README)
scripts/                  prepare-data · fix-export-segments · serve-static
src/app/                  rutas: /, /explore, /comparador, /timeline, /engineer, /regret-lab, /evidencia, /sistema-diseno
src/components/ui/        sistema de diseño (paneles, controles, métricas, leyendas, insignias, iconos)
src/components/data/      DataGate/ChunkGate (carga y errores) y controles ligados al estado
src/components/…          vistas por pantalla y gráfico de horizonte (SVG)
src/lib/contract/         contrato TS + zod + validación semántica
src/lib/data/             división, manifiesto, cargador con SHA-256, selectores, proveedor
src/lib/state/            estado global (ventana, altura, superficie, criterio, sitio, tiempo) ↔ URL
tests/                    pruebas Vitest sobre los datos reales
docs/                     ARQUITECTURA.md · INCOMPATIBILIDADES_MOCKUPS.md
```

## Qué hay en la fase 1

- **Inicio**: contenido del paquete, escenario entregado, principios de lectura y recorrido.
- **Explorar**: figura DEM original con marcadores A/B, ficha de cada sitio (coordenadas, altura del suelo, capas de calidad PGDA78), perfil de horizonte real de A y B para 0/2/10 m y las 10 superficies.
- **Evidencia**: integridad, motor y entorno, parámetros modelados, naturaleza de datos, límites, fuentes y descargas de originales.
- **Comparador, Timeline, Engineer, Regret Lab**: pantallas preparadas que comparten el estado global y comprueban que la selección existe, **sin métricas** hasta la fase 2; cada una lista los campos reales que consumirá y sus diferencias con el mockup.

## Reglas que la web respeta

Los mockups son solo referencia visual. Solo W1/W2, 0/2/10 m y A/B. El criterio se elige antes del ganador. Empate con tolerancia de 10 min sobre valores completos. Frecuencias de variantes ≠ probabilidades; familias propias y publicadas separadas. `UNKNOWN`/`null` nunca son sombra ni cero. Visibilidad geométrica ≠ energía, enlace o seguridad. No implica respaldo de la NASA.
