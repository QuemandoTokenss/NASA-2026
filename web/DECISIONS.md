# Decisiones (ADR breves)

| # | Fecha | Decisión | Motivo |
|---|---|---|---|
| D1 | 2026-11-14 | La ruta de la misión `C:\Users\Hu7go\Desktop\Hugogol\Hackaton NASA` no existe en este equipo (usuario `Hugo`). Se continúa sobre la implementación existente de la fase 1 (`site-regret/`), creada en una carpeta de sesión. | No reiniciar trabajo válido. Al final se propone moverla a una carpeta permanente elegida por el equipo. |
| D2 | 2026-11-14 | Los mockups son las 7 imágenes adjuntas en la conversación; no hay carpeta `mockups/` en este equipo. | Identificados por contenido. |
| D3 | 2026-11-14 | Next.js 16 App Router con `output: "export"` (sitio estático), React 19, TypeScript estricto, Tailwind v4. | Sin backend: la ciencia ya está calculada; entrega offline posible. |
| D4 | 2026-11-14 | Datos: `paquete_frontend.json` original intacto en `data/source`; se divide en 27 trozos con reensamblado verificado (igualdad estricta, incluido -0). SHA-256 por trozo comprobado en el navegador. | Carga diferida sin perder ni alterar información; trazabilidad. |
| D5 | 2026-11-14 | Gráficos científicos con SVG propio (y canvas solo si hiciera falta), no Recharts/Plotly. | Series de 1440/4321 muestras exactas, estados categóricos sin interpolación, control total de huecos `UNKNOWN`, tamaño de bundle y coherencia visual. |
| D6 | 2026-11-14 | Iconografía Lucide (`lucide-react`) envuelta en `Icon` semántico. Controles accesibles propios (radiogroup, switch, select nativo, tooltip con foco) en lugar de una biblioteca de componentes. | Pocas piezas; evita dependencia pesada; ARIA verificado a mano. |
| D7 | 2026-11-14 | Colores: A naranja, B cian, incertidumbre/regret violeta; Sol amarillo, Tierra azul, Sol+Tierra verde, ninguno pizarra, desconocido trama gris. | Los mockups usaban naranja/cian para Sol/Tierra y chocaban con A/B. |
| D8 | 2026-11-14 | Sin puntuación 0–100, sin Monte Carlo, sin probabilidades. Fracciones solo como «n de N superficies de la familia», con denominador visible. | Contrato y plan maestro §0.3. |
| D9 | 2026-11-14 | El criterio de decisión empieza vacío; el ganador se revela tras elegirlo. | Plan maestro §2.7 «01 / CHOOSE». |
| D10 | 2026-11-14 | Curvas Sol/Tierra solo para la superficie nominal; con otras superficies se muestran estados y métricas precalculados y un aviso. | No combinar cielo nominal con horizontes de variantes. |
| D11 | 2026-11-14 | Engineer: selector discreto 0/2/10 m; escena 2D ilustrativa rotulada como tal. Sin 3D (P2). | Solo existen esas alturas; prioridad P0/P1. |
| D12 | 2026-11-14 | `scripts/fix-export-segments.ts` tras el build. | Next 16.4.6 en Windows escribe mal los archivos de prefetch por segmento. |
| D13 | 2026-11-14 | Pruebas E2E con Playwright usando el navegador Edge instalado (`channel: "msedge"`), sin descargar navegadores. | Pruebas funcionales reales sin dependencias de red. |
| D14 | 2026-11-14 | Despliegue en Vercel como sitio estático (`vercel.json`, `framework: null`, `out/`), producción en https://site-regret.vercel.app. `qa_entradas.json` se excluye de la subida. | La CLI estaba autenticada y la misión autorizaba desplegar; el archivo excluido contiene rutas locales de un equipo. |
| D15 | 2026-11-14 | Sin bilingüismo ES/EN en esta entrega. | P2; se priorizó P0/P1 y QA. |
| D16 | 2026-11-14 | Sin `git push`: no hay remoto configurado ni destino autorizado. | Instrucción de la misión §18. |
| D17 | 2026-11-14 | Bilingüismo sin biblioteca: idioma en un módulo, textos en pareja `L(es, en)`, tablas `bi()` y remontaje de la interfaz al cambiar de idioma (la selección se conserva). Se reemplaza la decisión D15. | Sin dependencias ni claves desincronizadas; el export estático sigue en español y el cliente adopta `?lang=en` o la preferencia guardada. |
| D18 | 2026-11-14 | Modo historia `/historia/` como guion de presentación, fuera de la navegación principal (enlace «Presentar»). | El orden de las 7 secciones es el acordado; la historia reutiliza los mismos datos y lleva a Regret Lab, Comparador y Evidencia. |
| D19 | 2026-11-14 | Auditoría axe-core WCAG 2.1 A/AA como prueba E2E en todas las rutas. | Evita regresiones de contraste y ARIA; no sustituye una prueba con lector de pantalla. |

