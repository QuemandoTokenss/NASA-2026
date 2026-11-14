# Prompt para la siguiente sesión (Asier y siguientes)

Copia y pega esto en tu IA, dentro del repositorio.

```text
Retomas el trabajo en curso de SITE REGRET (NASA Space Apps 2026, equipo Quemando Tokens). No tienes el historial de la sesión anterior: el estado está en archivos. No reinicies el proyecto ni hagas una auditoría general.

Antes de modificar nada, lee en este orden:
1. docs/continuidad/HANDOFF.md  (estado, tarea activa, comandos, pruebas)
2. docs/continuidad/ENCARGO_VIGENTE.md  (qué pidió el usuario y qué está autorizado)
3. AGENTS.md  (reglas del repo y reglas científicas)
4. docs/continuidad/HISTORIAL.md  (puntos de control anteriores)

Comprobaciones iniciales (solo lectura):
  git rev-parse --show-toplevel
  git branch --show-current        → debe ser feat/geo-real-terrain
  git rev-parse HEAD ; git status --short --branch ; git log --oneline -5
Si la rama no existe en tu copia, PARA y pide a Hugo que la suba: en main no está este trabajo.
Si el código o Git contradicen al HANDOFF, mandan el código y Git; reconcilia sin descartar trabajo.

Preparación, dentro de web/:
  npm ci
Los originales NASA (web/data/raw/, 205 MB) no están en Git y NO hacen falta para trabajar ni para las pruebas: los recortes derivados sí están versionados. Solo si vas a regenerarlos: npm run geo:fetch && npm run geo:build.

Asume UNA sola tarea activa: la de la sección «Tarea activa» del HANDOFF. Hoy es G15 (Regret Lab conectado al mapa con los clones reales del DEM); el HANDOFF §4 da los pasos exactos. Lee también docs/continuidad/01_REANUDAR_IMPLEMENTACION.md y el megaprompt literal docs/continuidad/MEGAPROMPT_ORIGINAL.md: el encargo NO está terminado.
IMPORTANTE: si `git status -sb` no dice que estás al día con el remoto, o no ves los commits de corregistro y ODE en `git log --oneline -6`, es que Hugo aún no ha subido los últimos commits: PARA y pídeselo.

Reglas que no puedes romper:
- No tocar web/data/source/. No inventar terreno, texturas, métricas, fechas ni coordenadas. Solo sitios A (ROI 4) y B (ROI 6), ventanas W1/W2, alturas 0/2/10 m.
- Geometría lunar: R = 1 737 400 m, estereográfica polar sur; nada terrestre. La visibilidad se lee del motor, no se recalcula.
- Si un servicio o dato falta, se muestra «no disponible»: nunca una imagen o valor de sustitución.
- No push, no PR, no despliegue, no `git reset --hard`, `git clean`, `pull`, `merge`, `stash` ni cambio de rama sin que lo pida una persona. No hagas commits automáticos: si los haces, archivos explícitos y revisados. Sin secretos ni DEM grandes en Git.

Mantén el protocolo de relevo: actualiza docs/continuidad/HANDOFF.md al terminar cada unidad pequeña, al cambiar de tarea, al bloquearte y ANTES de cualquier operación larga; añade una línea a HISTORIAL.md en cada punto de control. Si te escriben CIERRA_RELEVO: no empieces nada, deja el estado por escrito, revisa Git en solo lectura y actualiza este CONTINUAR.md para la siguiente persona.
```
