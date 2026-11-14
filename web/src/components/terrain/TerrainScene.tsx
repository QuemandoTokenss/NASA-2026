"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { rampColor, type Rgb } from "@/lib/geospatial/colormap";
import type { Vec3 } from "@/lib/geospatial/lunar";
import type { TerrainMesh } from "@/lib/geospatial/mesh";
import { L } from "@/lib/i18n";
import { BASE_PATH } from "@/lib/data/loader";
import { Callout } from "../ui/Display";
import earthImg from "@/assets/celestial/earth-bluemarble-as17.webp";
import sunImg from "@/assets/celestial/sun-sdo-aia171.webp";
import glowImg from "@/assets/scene/sky-glow-svs4851-2k.jpg";
import { LabelCache, TowerRig, UNIT_CYLINDER, azimuthDir, regolithMaterial, starPoints, strutMatrix } from "./sceneParts";

/** Grises minerales del regolito (sRGB): la altura solo matiza; la forma la dan la luz rasante y el detalle. */
const MINERAL: Rgb[] = [
  [74, 73, 72],
  [98, 97, 95],
  [124, 122, 118],
  [150, 147, 141],
];

export interface SceneDirection {
  /** [este, norte, arriba] unitario. */
  enu: Vec3;
  color: string;
  /** Etiqueta corta («Sol», «Tierra»). */
  label?: string;
  /** Cuerpo, para dibujar su disco en el cielo en esa dirección (marcador ampliado, no a escala). */
  body?: "sun" | "earth";
  /** `true` si el motor da el centro del cuerpo por TAPADO en este instante (el marcador se atenúa). */
  occluded?: boolean;
  /** Dibujar el rayo discontinuo desde el observador (solo el cuerpo consultado). */
  ray?: boolean;
}

export interface SceneSightLine {
  /** Extremo de la visual en coordenadas locales [este, norte, arriba] (m). */
  end: Vec3;
  /** `true` si el extremo es el obstáculo; `false` si solo indica la dirección (obstáculo fuera del recorte). */
  reachesObstacle: boolean;
  /** Etiqueta del extremo («Relieve que limita la vista», «Fin del recorte 3D»…). */
  endLabel?: string;
}

export type ViewPreset = "tower" | "overview" | "near" | "behind";

export interface SceneLabels {
  observer: string;
  sight: string;
}

const toScene = (v: Vec3) => new THREE.Vector3(v[0], v[2], -v[1]);
const STAR_RADIUS = 30000;
const DASHES = 18;
const VIOLET = 0xb79bff;

interface BodyRig {
  sprite: THREE.Sprite;
  ray: THREE.Line;
  label: THREE.Sprite;
}
/** Evento de diagnóstico: dibuja la escena de forma síncrona (ver el efecto del visor). */
export const RENDER_NOW_EVENT = "site-regret:render-now";

interface Rig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  world: THREE.Group;
  terrain: THREE.Mesh;
  terrainMat: ReturnType<typeof regolithMaterial>;
  tower: TowerRig;
  head: THREE.Mesh;
  pad: THREE.Mesh;
  observerLabel: THREE.Sprite;
  bodies: Record<"sun" | "earth", BodyRig>;
  sightSolid: THREE.Mesh;
  sightDashes: THREE.InstancedMesh;
  sightMark: THREE.Mesh;
  sightLabel: THREE.Sprite;
  endLabel: THREE.Sprite;
  labels: LabelCache;
  light: THREE.DirectionalLight;
  stars: { points: THREE.Points | null };
  requestRender: () => void;
  shadowDirty: () => void;
  /** Número de renderizados (para las pruebas de rendimiento). */
  frames: number;
}

/**
 * Terreno 3D dibujado con los vértices reales del DEM (ver `buildTerrainMesh`).
 * Es una VISTA: material del suelo, luz y sombras son de presentación; la visibilidad
 * y las métricas salen del motor. El visor, el terreno, el cielo y las texturas viven
 * mientras el componente está montado; cambiar la altura solo recoloca piezas.
 */
export function TerrainScene({
  mesh,
  observerHeightM,
  siteColor,
  directions,
  sightLine,
  exaggeration,
  preset,
  lightEnu,
  label,
  azimuthDeg = null,
  labels,
}: {
  mesh: TerrainMesh;
  observerHeightM: number;
  siteColor: string;
  directions: SceneDirection[];
  sightLine: SceneSightLine | null;
  exaggeration: number;
  preset: { view: ViewPreset; nonce: number };
  /** Dirección de la luz de la escena [este, norte, arriba]; solo estética. */
  lightEnu: Vec3 | null;
  label: string;
  /** Azimut consultado (°), para orientar la cámara cuando no hay visual. */
  azimuthDeg?: number | null;
  labels?: SceneLabels;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<Rig | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const colors = useMemo(() => {
    const out = new Float32Array(mesh.heights.length * 3);
    const span = mesh.maxHeight - mesh.minHeight || 1;
    for (let i = 0; i < mesh.heights.length; i++) {
      const c = rampColor(MINERAL, (mesh.heights[i] - mesh.minHeight) / span);
      // sRGB → lineal (la salida del renderizador es sRGB).
      out[3 * i] = Math.pow(c[0] / 255, 2.2);
      out[3 * i + 1] = Math.pow(c[1] / 255, 2.2);
      out[3 * i + 2] = Math.pow(c[2] / 255, 2.2);
    }
    return out;
  }, [mesh]);

  /* --------------------- visor: se crea una vez por montaje --------------------- */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch (e) {
      const t = setTimeout(() => setFailed((e as Error).message || "WebGL"), 0);
      return () => clearTimeout(t);
    }
    const coarse = window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 768;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75);
    renderer.setPixelRatio(pixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Las sombras solo dependen de la torre y de la luz: no se recalculan al orbitar.
    renderer.shadowMap.autoUpdate = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x020306, 1);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.2, 60000);
    const world = new THREE.Group();
    scene.add(world);
    scene.add(new THREE.AmbientLight(0xffffff, 0.06));
    scene.add(new THREE.HemisphereLight(0x8f9fbd, 0x0b0c0f, 0.32));
    scene.fog = new THREE.Fog(0x020306, 450, 5200);
    // Cielo: brillo difuso (Vía Láctea) como fondo + estrellas en puntos (NASA SVS 4851). Ilustrativo.
    const glow = new THREE.TextureLoader().load(glowImg.src, () => rig.requestRender());
    glow.mapping = THREE.EquirectangularReflectionMapping;
    glow.colorSpace = THREE.SRGBColorSpace;
    glow.generateMipmaps = false; // sin mipmaps: ni costura en la longitud 180° ni bloques
    glow.minFilter = THREE.LinearFilter;
    scene.background = glow;
    scene.backgroundIntensity = 0.75;
    const abort = new AbortController();

    const light = new THREE.DirectionalLight(0xfffaf2, 3.3);
    light.castShadow = true;
    const shadowSize = coarse ? 1024 : 2048;
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.bias = -0.0003;
    light.shadow.normalBias = 0.03;
    scene.add(light, light.target);

    // Terreno (la geometría se asigna en su propio efecto).
    const terrainMat = regolithMaterial();
    const terrain = new THREE.Mesh(new THREE.BufferGeometry(), terrainMat);
    terrain.frustumCulled = false;
    terrain.receiveShadow = true;
    world.add(terrain);

    const labelsCache = new LabelCache();
    const tower = new TowerRig();
    world.add(tower.group);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), headMat);
    world.add(head);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2;
    world.add(pad);
    const observerLabel = labelsCache.sprite();
    world.add(observerLabel);

    // Sol y Tierra: textura cargada una sola vez; el marcador se recoloca.
    const texLoader = new THREE.TextureLoader();
    const bodyRig = (src: string): BodyRig => {
      const tex = texLoader.load(src, () => rig.requestRender());
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthWrite: false, fog: false, transparent: true }));
      sprite.renderOrder = 2;
      sprite.visible = false;
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
      ray.visible = false;
      ray.frustumCulled = false;
      const lab = labelsCache.sprite();
      world.add(sprite, ray, lab);
      return { sprite, ray, label: lab };
    };
    const bodies = { sun: bodyRig(sunImg.src), earth: bodyRig(earthImg.src) };

    // Visual: barra continua (obstáculo dentro del recorte) o tramos discontinuos (instancias).
    const violet = new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.95 });
    // Visual continua: cilindro propio, fino en el ojo y algo más ancho lejos (se rehace solo al llegar un resultado).
    const sightSolid = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), violet);
    sightSolid.matrixAutoUpdate = false;
    sightSolid.visible = false;
    sightSolid.frustumCulled = false;
    const sightDashes = new THREE.InstancedMesh(UNIT_CYLINDER, violet, DASHES);
    sightDashes.visible = false;
    sightDashes.frustumCulled = false;
    const sightMark = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: VIOLET }));
    sightMark.visible = false;
    const sightLabel = labelsCache.sprite();
    const endLabel = labelsCache.sprite();
    world.add(sightSolid, sightDashes, sightMark, sightLabel, endLabel);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 2;
    controls.maxDistance = 9000;

    let pending = 0;
    // Los shaders se compilan en paralelo (KHR_parallel_shader_compile) antes del primer fotograma:
    // el hilo principal no se bloquea mientras llega la página.
    let compiled = false;
    const stars = { points: null as THREE.Points | null };
    const draw = () => {
      pending = 0;
      if (!compiled) return;
      if (stars.points) stars.points.position.copy(camera.position);
      renderer.render(scene, camera);
      rig.frames++;
      host.dataset.frames = String(rig.frames);
    };
    const rig: Rig = {
      renderer,
      scene,
      camera,
      controls,
      world,
      terrain,
      terrainMat,
      tower,
      head,
      pad,
      observerLabel,
      bodies,
      sightSolid,
      sightDashes,
      sightMark,
      sightLabel,
      endLabel,
      labels: labelsCache,
      light,
      stars,
      frames: 0,
      // Renderizado bajo demanda, agrupado por fotograma.
      requestRender: () => {
        if (!pending) pending = requestAnimationFrame(draw);
      },
      shadowDirty: () => {
        renderer.shadowMap.needsUpdate = true;
      },
    };
    controls.addEventListener("change", rig.requestRender);
    // Diagnóstico: el búfer de WebGL solo es legible en la misma tarea en que se dibuja (se renderiza
    // bajo demanda y sin preserveDrawingBuffer). Este evento dibuja de forma síncrona para que una
    // prueba o una captura puedan leer el lienzo justo después.
    const renderNow = () => draw();
    host.addEventListener(RENDER_NOW_EVENT, renderNow);

    fetch(`${BASE_PATH}/scene/stars-svs4851-v1.bin`, { signal: abort.signal })
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((buf) => {
        const head4 = new TextDecoder().decode(new Uint8Array(buf, 0, 4));
        const n = new DataView(buf).getUint32(4, true);
        if (head4 !== "STR1" || buf.byteLength !== 8 + n * 16) throw new Error("formato de estrellas desconocido");
        const pts = starPoints(new Float32Array(buf.slice(8, 8 + n * 12)), new Uint8Array(buf, 8 + n * 12, n * 4), STAR_RADIUS, pixelRatio);
        stars.points = pts;
        scene.add(pts);
        rig.requestRender();
      })
      .catch(() => {
        /* sin estrellas en puntos: queda el brillo difuso */
      });

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      rig.requestRender();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    rigRef.current = rig;
    renderer
      .compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        compiled = true;
        rig.requestRender();
      });
    resize();
    const t = setTimeout(() => setReady(true), 0);
    return () => {
      clearTimeout(t);
      abort.abort();
      if (pending) cancelAnimationFrame(pending);
      host.removeEventListener(RENDER_NOW_EVENT, renderNow);
      ro.disconnect();
      controls.dispose();
      terrain.geometry.dispose();
      terrainMat.dispose();
      tower.dispose();
      head.geometry.dispose();
      headMat.dispose();
      pad.geometry.dispose();
      (pad.material as THREE.Material).dispose();
      for (const b of Object.values(bodies)) {
        (b.sprite.material as THREE.SpriteMaterial).map?.dispose();
        b.sprite.material.dispose();
        b.ray.geometry.dispose();
        (b.ray.material as THREE.Material).dispose();
      }
      violet.dispose();
      sightDashes.dispose();
      sightSolid.geometry.dispose();
      sightMark.geometry.dispose();
      (sightMark.material as THREE.Material).dispose();
      for (const s of [observerLabel, sightLabel, endLabel, bodies.sun.label, bodies.earth.label]) s.material.dispose();
      labelsCache.dispose();
      if (stars.points) {
        stars.points.geometry.dispose();
        (stars.points.material as THREE.Material).dispose();
      }
      glow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      rigRef.current = null;
    };
  }, []);

  /* ------------------------- terreno: solo si cambia la malla ------------------------- */
  useEffect(() => {
    const r = rigRef.current;
    if (!r) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeVertexNormals();
    const old = r.terrain.geometry;
    r.terrain.geometry = geometry;
    old.dispose();
    r.shadowDirty();
    r.requestRender();
  }, [ready, mesh, colors]);

  /* ----------------- torre y observador: se recolocan al mover la altura ----------------- */
  useEffect(() => {
    const r = rigRef.current;
    if (!r) return;
    const wide = preset.view === "overview";
    const h = observerHeightM;
    r.world.scale.set(1, exaggeration, 1);
    r.tower.update(h);
    r.terrainMat.userData.uniforms.uTowerHalf.value = r.tower.baseHalf;
    const headR = wide ? 3 : Math.max(0.12, h * 0.022 + 0.09);
    (r.head.material as THREE.MeshBasicMaterial).color.set(siteColor);
    r.head.scale.setScalar(headR);
    r.head.position.set(0, h + (h > 0 ? headR * 0.6 : headR), 0);
    r.pad.visible = h <= 0;
    (r.pad.material as THREE.MeshBasicMaterial).color.set(siteColor);
    r.pad.scale.setScalar(0.6);
    r.pad.position.y = 0.05;
    // Sombra: la caja de la luz cubre la torre y toda su sombra (más larga con la luz rasante).
    const l = toScene((lightEnu ?? [-0.5, 0.5, 0.7]) as Vec3).normalize();
    const elev = Math.max(0.15, Math.asin(Math.min(1, l.y)));
    const hEff = Math.max(1, h * exaggeration);
    const shadowLen = wide ? 0 : Math.min(160, hEff / Math.tan(elev));
    const ground = new THREE.Vector3(-l.x, 0, -l.z).normalize();
    const center = ground.multiplyScalar(shadowLen / 2);
    const half = wide ? 400 : shadowLen / 2 + Math.max(4, r.tower.baseHalf * 2) + 4;
    r.light.target.position.copy(center);
    r.light.position.copy(center).add(l.clone().multiplyScalar(800));
    const lc = r.light.shadow.camera;
    lc.left = -half;
    lc.right = half;
    lc.top = half;
    lc.bottom = -half;
    lc.near = 1;
    lc.far = 1800;
    lc.updateProjectionMatrix();
    r.shadowDirty();
    r.requestRender();
  }, [ready, observerHeightM, exaggeration, preset.view, siteColor, lightEnu]);

  /* --------------- direcciones, visual y etiquetas (solo con datos calculados) --------------- */
  useEffect(() => {
    const r = rigRef.current;
    if (!r) return;
    const wide = preset.view === "overview";
    const h = observerHeightM;
    const eye = new THREE.Vector3(0, h, 0);
    const near = Math.max(6, h * 1.6 + 4);
    const headR = r.head.scale.x;
    r.labels.set(r.observerLabel, labels?.observer, siteColor, 16);
    // A la izquierda del observador (encima quedaría bajo el recuadro de conclusión).
    // En pantallas estrechas el recuadro de conclusión no tapa la zona sobre la torre: ahí va encima.
    const above = wide || r.camera.aspect < 0.9;
    r.observerLabel.center.set(above ? 0.5 : 1.08, above ? 0 : 0.5);
    r.observerLabel.position.copy(r.head.position).add(new THREE.Vector3(0, wide ? 30 : above ? Math.max(0.5, near * 0.06) + headR : headR * 0.2, 0));

    for (const key of ["sun", "earth"] as const) {
      const b = r.bodies[key];
      const d = directions.find((x) => x.body === key);
      if (!d) {
        b.sprite.visible = b.ray.visible = b.label.visible = false;
        continue;
      }
      const dir = toScene(d.enu).normalize();
      const far = 5200;
      const mat = b.sprite.material as THREE.SpriteMaterial;
      // Marcador ampliado (no a escala). Si el motor da el centro por tapado, el marcador se atenúa.
      mat.opacity = d.occluded ? 0.42 : 1;
      mat.color.set(d.occluded ? 0x7d828c : 0xffffff);
      const sz = key === "earth" ? 0.075 : 0.06;
      b.sprite.scale.set(sz, sz, 1);
      b.sprite.position.copy(eye).add(dir.clone().multiplyScalar(far));
      b.sprite.visible = true;
      const pos = b.ray.geometry.getAttribute("position") as THREE.BufferAttribute;
      const tip = eye.clone().add(dir.clone().multiplyScalar(wide ? 900 : near * 4));
      pos.setXYZ(0, eye.x, eye.y, eye.z);
      pos.setXYZ(1, tip.x, tip.y, tip.z);
      pos.needsUpdate = true;
      b.ray.computeLineDistances();
      const lm = b.ray.material as THREE.LineDashedMaterial;
      lm.color.set(d.color);
      lm.dashSize = wide ? 30 : near * 0.12;
      lm.gapSize = wide ? 20 : near * 0.08;
      b.ray.visible = d.ray !== false;
      r.labels.set(b.label, d.label ? (d.occluded ? `${d.label} · ${key === "earth" ? L("tapada", "hidden") : L("tapado", "hidden")}` : d.label) : undefined, d.color, 16);
      b.label.position.copy(b.sprite.position).add(new THREE.Vector3(0, 170, 0));
    }

    const s = sightLine;
    if (!s) {
      r.sightSolid.visible = r.sightDashes.visible = r.sightMark.visible = r.sightLabel.visible = r.endLabel.visible = false;
    } else {
      const end = toScene(s.end);
      const len = eye.distanceTo(end);
      const r0 = wide ? 0.9 : Math.max(0.025, h * 0.004 + 0.025);
      const r1 = Math.max(r0, len * 0.0009);
      if (s.reachesObstacle) {
        const old = r.sightSolid.geometry;
        r.sightSolid.geometry = new THREE.CylinderGeometry(r1, r0, 1, 10, 1, true);
        old.dispose();
        r.sightSolid.matrix.copy(strutMatrix(eye, end, 1));
        r.sightSolid.visible = true;
        r.sightDashes.visible = false;
      } else {
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        for (let k = 0; k < DASHES; k++) {
          a.copy(eye).lerp(end, k / DASHES);
          b.copy(eye).lerp(end, (k + 0.55) / DASHES);
          r.sightDashes.setMatrixAt(k, strutMatrix(a, b, r0 + (r1 - r0) * ((k + 0.3) / DASHES)));
        }
        r.sightDashes.instanceMatrix.needsUpdate = true;
        r.sightDashes.visible = true;
        r.sightSolid.visible = false;
      }
      const markR = wide ? Math.max(3, len * 0.01) : Math.max(0.1, Math.min(len * 0.006, near * 0.06));
      r.sightMark.scale.setScalar(markR);
      r.sightMark.position.copy(end);
      (r.sightMark.material as THREE.MeshBasicMaterial).color.set(s.reachesObstacle ? VIOLET : 0xe8eef8);
      r.sightMark.visible = true;
      r.labels.set(r.sightLabel, labels?.sight, "#b79bff", 15);
      r.sightLabel.center.set(0.5, 1);
      r.sightLabel.position.copy(eye.clone().lerp(end, Math.min(0.45, wide ? 0.3 : (near * 2.4) / Math.max(1, len)))).add(new THREE.Vector3(0, -(wide ? 12 : near * 0.05), 0));
      r.labels.set(r.endLabel, s.endLabel, s.reachesObstacle ? "#b79bff" : "#e8eef8", 16);
      // El extremo suele quedar a la derecha del encuadre: la etiqueta crece hacia la izquierda.
      r.endLabel.center.set(0.92, 0);
      r.endLabel.position.copy(end).add(new THREE.Vector3(0, wide ? Math.max(6, len * 0.02) : markR * 1.6, 0));
    }
    r.requestRender();
  }, [ready, observerHeightM, siteColor, directions, sightLine, labels, preset.view]);

  /* --------------------------------- cámara --------------------------------- */
  useEffect(() => {
    const r = rigRef.current;
    if (!r) return;
    let target = new THREE.Vector3(0, observerHeightM * exaggeration, 0);
    let pos: THREE.Vector3;
    if (preset.view === "tower") {
      // Oblicua, detrás y a un lado de la torre, mirando en la dirección de la visual:
      // se ven la base, el remate y el arranque del rayo.
      const h = observerHeightM * exaggeration;
      const d = Math.max(8, observerHeightM * 2.2 + 8) * (r.camera.aspect < 0.9 ? 1.6 : 1);
      const look = sightLine ? toScene(sightLine.end).setY(0).normalize() : azimuthDeg !== null ? azimuthDir(azimuthDeg) : new THREE.Vector3(0, 0, -1);
      const side = new THREE.Vector3(-look.z, 0, look.x);
      pos = look.clone().multiplyScalar(-d * 0.8).add(side.multiplyScalar(d * 0.62)).setY(h * 0.62 + d * 0.26 + 1.2);
      target = new THREE.Vector3(0, h * 0.42 + 0.3, 0).add(look.clone().multiplyScalar(d * 0.3));
    } else if (preset.view === "near") pos = new THREE.Vector3(-70, 28 + observerHeightM, 95);
    else if (preset.view === "behind" && sightLine) {
      const dir = toScene(sightLine.end).setY(0).normalize();
      pos = new THREE.Vector3(-dir.x * 260, 110, -dir.z * 260);
    } else pos = new THREE.Vector3(-1300, 1150, 1600);
    r.camera.position.copy(pos);
    r.controls.minDistance = preset.view === "tower" ? 2 : 15;
    r.controls.target.copy(target);
    r.controls.update();
    r.requestRender();
    // Solo al pedir un encuadre (nonce) o al cambiar de malla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, preset.nonce, preset.view, mesh]);

  if (failed)
    return (
      <Callout tone="warn" icon="alert" title={L("Vista 3D no disponible", "3D view unavailable")}>
        {L("Este navegador no ha podido iniciar WebGL. Los datos del obstáculo y el mapa siguen disponibles; no se muestra ninguna imagen de sustitución.", "This browser could not start WebGL. The obstacle data and the map remain available; no substitute image is shown.")}
      </Callout>
    );
  return <div ref={hostRef} role="img" aria-label={label} data-testid="terrain-scene" data-observer-height={observerHeightM} data-view={preset.view} className="h-[clamp(380px,calc(100dvh-250px),620px)] w-full overflow-hidden bg-[#020306]" />;
}
