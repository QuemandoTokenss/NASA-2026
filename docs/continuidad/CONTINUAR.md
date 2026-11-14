# Prompt para la siguiente sesión

> **Superado el 14-11-2026 (PC-23).** Las ramas y commits que cita el texto de abajo ya están en `main`. Para continuar: lee `docs/continuidad/HANDOFF.md` §0 (estado vigente, propietarios, pruebas y siguiente acción) y trabaja en la rama que indique; no en `main`, que publica en producción. El resto se conserva como registro.

Copia y pega esto en tu IA, dentro del repositorio.

```text
Retomas el trabajo en curso de SITE REGRET (NASA Space Apps 2026, equipo QuemandoTokens). No tienes el historial de la sesión anterior: el estado está en archivos. No reinicies el proyecto ni hagas una auditoría general.

Antes de modificar nada, lee en este orden:
1. docs/continuidad/HANDOFF.md  (estado, bloque activo, siguiente tarea exacta, comandos, pruebas)
2. docs/continuidad/ENCARGO_VIGENTE.md  (§A.5 «Mission Control v2» y autorizaciones)
3. AGENTS.md y CLAUDE.md  (reglas del repo y científicas)
4. docs/continuidad/HISTORIAL.md  (puntos de control)
5. web/docs/GEOESPACIAL.md y web/ARCHITECTURE.md

Comprobaciones iniciales (solo lectura):
  git rev-parse --show-toplevel
  git branch --show-current        → feat/mission-control-v2
  git rev-parse HEAD ; git status --short --branch ; git log --oneline -5
La rama sale de main = 6e41690 (PR #18 fusionado: la capa geoespacial YA está en main).
La rama está en GitHub (PR #19 contra main): si no la tienes, `git fetch origin && git switch feat/mission-control-v2`.
Si el código o Git contradicen al HANDOFF, mandan el código y Git; reconcilia sin descartar trabajo.

Preparación, dentro de web/:
  npm ci
Los originales NASA (web/data/raw/, ≈410 MB con los 5 clones) no están en Git y NO hacen falta para trabajar ni para las pruebas: los recortes derivados (incluidos clones/) sí están versionados. Solo si vas a regenerarlos: npm run geo:fetch && npm run geo:build.

Bloque activo: el de «Siguiente tarea exacta» del HANDOFF. Tras PC-16 los bloques A–E están implementados: falta la revisión humana de la demo completa y el bloque F (pendientes científicos G9/G11/G12/G13/ODE). No declares el encargo terminado sin esa revisión. Además, la demo interactiva de /historia/ está en la rama local `feat/historia-demo-interactiva` (HANDOFF §4 quinquies), pendiente de ensayo del equipo y sin subir. Encima, la iteración visual de Timeline y Engineer está en la rama local `feat/timeline-engineer-visual` (HANDOFF §4 sexies), también sin subir. Encima, el rediseño para el jurado (HANDOFF §4 septies) y el rediseño integral con acabado de PC-21 (HANDOFF §4 octies: portada, Explore, Engineer con deslizador 0–30 m, Timeline, Comparador) están en la rama local `feat/jurado-rediseno-visual`: `git switch feat/jurado-rediseno-visual` para continuar. Imágenes de portada y cielo: originales en `web/src/assets/scene/SOURCES.json`, regenerar con `python -I web/scripts/imagery/make_scene_images.py web/data/raw/imagery web/src/assets/scene`. Para regenerar las imágenes del Timeline: descargar los originales indicados en `web/src/assets/celestial/SOURCES.json` a `web/data/raw/imagery/` y ejecutar `python -I web/scripts/imagery/make_celestial.py web/data/raw/imagery web/src/assets/celestial`. Un bloque cada vez: inspeccionar, implementar, probar, revisar visualmente, documentar, seguir.

Reglas que no puedes romper:
- No tocar web/data/source/. No inventar terreno, texturas, trayectorias, métricas, fechas ni coordenadas. Solo sitios A (ROI 4) y B (ROI 6), ventanas W1/W2, alturas 0/2/10 m, 10 superficies.
- Geometría lunar: R = 1 737 400 m, estereográfica polar sur; nada terrestre. Visibilidad y métricas se leen del motor, no se recalculan. Nunca combinar efemérides nominales con horizontes de variantes.
- Si un servicio o dato falta, se muestra «no disponible»: nunca una imagen o valor de sustitución. Las ilustraciones se rotulan como tales.
- No push, no PR, no merge, no despliegue, no `git reset --hard`, `clean`, `stash` ni cambio de rama sin que lo pida una persona. Commits locales solo con archivos explícitos y revisados. Sin secretos ni DEM originales en Git.
- En esta máquina los heredocs de bash con comillas/acentos fallan: escribe los scripts a un archivo.

Mantén el relevo: actualiza docs/continuidad/HANDOFF.md tras cada bloque o cambio significativo y antes de operaciones largas; añade una línea a HISTORIAL.md; actualiza este CONTINUAR.md si cambia el bloque activo.
```
