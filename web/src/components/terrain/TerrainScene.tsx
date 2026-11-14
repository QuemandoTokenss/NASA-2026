"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { rampColor, type Rgb } from "@/lib/geospatial/colormap";

const MINERAL: Rgb[] = [
  [58, 60, 64],
  [96, 97, 99],
  [138, 137, 134],
  [178, 175, 168],
];
import type { Vec3 } from "@/lib/geospatial/lunar";
import type { TerrainMesh } from "@/lib/geospatial/mesh";
import { L } from "@/lib/i18n";
import { Callout } from "../ui/Display";
import earthImg from "@/assets/celestial/earth-bluemarble-as17.webp";
import sunImg from "@/assets/celestial/sun-sdo-aia171.webp";
import starsImg from "@/assets/scene/stars-svs4851-3k.jpg";
import { azimuthDir, latticeTower, strut, textSprite } from "./sceneParts";

export interface SceneDirection {
  /** [este, norte, arriba] unitario. */
  enu: Vec3;
  color: string;
  /** Etiqueta corta («Sol», «Tierra»). */
  label?: string;
  /** Cuerpo, para dibujar su disco en el cielo en esa dirección (tamaño no a escala). */
  body?: "sun" | "earth";
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

/**
 * Terreno 3D dibujado con los vértices reales del DEM (ver `buildTerrainMesh`).
 * Es una VISTA: la luz de la escena solo da volumen y no proyecta sombras; la
 * visibilidad y las métricas salen del motor.
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
  /** Azimut consultado (°), para la brújula y la cuña de orientación. */
  azimuthDeg?: number | null;
  labels?: SceneLabels;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const three = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    world: THREE.Group;
    dynamic: THREE.Group;
    light: THREE.DirectionalLight;
    render: () => void;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const colors = useMemo(() => {
    const out = new Float32Array(mesh.heights.length * 3);
    const span = mesh.maxHeight - mesh.minHeight || 1;
    for (let i = 0; i < mesh.heights.length; i++) {
      // Gris mineral: la altura solo matiza el tono; la forma la da la luz rasante.
      const c = rampColor(MINERAL, (mesh.heights[i] - mesh.minHeight) / span);
      // Colores en sRGB → lineal (la salida del renderizador es sRGB).
      out[3 * i] = Math.pow(c[0] / 255, 2.2);
      out[3 * i + 1] = Math.pow(c[1] / 255, 2.2);
      out[3 * i + 2] = Math.pow(c[2] / 255, 2.2);
    }
    return out;
  }, [mesh]);

  /* ----------------------------- escena y malla ----------------------------- */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) {
      const t = setTimeout(() => setFailed((e as Error).message || "WebGL"), 0);
      return () => clearTimeout(t);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.2, 60000);
    const world = new THREE.Group();
    const dynamic = new THREE.Group();
    world.add(dynamic);
    scene.add(world);
    scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    scene.add(new THREE.HemisphereLight(0x8ea4c8, 0x101216, 0.45));
    scene.fog = new THREE.Fog(0x05070c, 1800, 8500);
    // Cielo: mapa estelar NASA SVS (Gaia DR2), solo fondo ilustrativo.
    const sky = new THREE.TextureLoader().load(starsImg.src, () => render());
    sky.mapping = THREE.EquirectangularReflectionMapping;
    sky.colorSpace = THREE.SRGBColorSpace;
    scene.background = sky;
    scene.backgroundIntensity = 0.75;
    const light = new THREE.DirectionalLight(0xfff1dc, 3.0);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.02;
    scene.add(light);
    scene.add(light.target);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeVertexNormals();
    // Material mate: la luz rasante y las sombras dibujan las formas sin saturar las zonas iluminadas.
    const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, side: THREE.DoubleSide }));
    terrain.frustumCulled = false;
    terrain.receiveShadow = true;
    world.add(terrain);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 15;
    controls.maxDistance = 9000;
    const render = () => renderer.render(scene, camera);
    controls.addEventListener("change", render);
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    three.current = { renderer, scene, camera, controls, world, dynamic, light, render };
    resize();
    return () => {
      ro.disconnect();
      controls.dispose();
      geometry.dispose();
      (terrain.material as THREE.Material).dispose();
      sky.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      three.current = null;
    };
  }, [mesh, colors]);

  /* ------------------- observador, direcciones y línea de visión ------------------- */
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    const g = t.dynamic;
    for (const child of [...g.children]) {
      g.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
    }
    const eye = new THREE.Vector3(0, observerHeightM, 0);
    const wide = preset.view === "overview";
    const near = Math.max(6, observerHeightM * 1.6 + 4);
    // Torre ilustrativa: el remate está a la altura del observador (o de la vista previa).
    const tower = latticeTower(observerHeightM, 0xaeb7c2);
    tower.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    g.add(tower);
    // Observador: punto en el remate (o a ras del suelo a 0 m).
    const headR = wide ? 3 : Math.max(0.16, observerHeightM * 0.03 + 0.12);
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 24, 14), new THREE.MeshBasicMaterial({ color: siteColor }));
    head.position.copy(eye).add(new THREE.Vector3(0, observerHeightM > 0 ? headR * 0.6 : headR, 0));
    g.add(head);
    if (observerHeightM <= 0) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.5, near * 0.06), 32), new THREE.MeshBasicMaterial({ color: siteColor, transparent: true, opacity: 0.35 }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.05;
      g.add(pad);
    }
    if (labels && labels.observer) {
      const obs = textSprite(labels.observer, siteColor, 22);
      obs.position.copy(head.position).add(new THREE.Vector3(0, wide ? 30 : Math.max(0.5, near * 0.1), 0));
      g.add(obs);
    }
    // Cuerpos en el cielo en su dirección real (si el paquete la trae); tamaño NO a escala.
    for (const d of directions) {
      const dir = toScene(d.enu).normalize();
      const far = 5200;
      if (d.body) {
        const tex = new THREE.TextureLoader().load(d.body === "earth" ? earthImg.src : sunImg.src, () => t.render());
        tex.colorSpace = THREE.SRGBColorSpace;
        const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthWrite: false, fog: false, transparent: true }));
        const sz = d.body === "earth" ? 0.07 : 0.06;
        disc.scale.set(sz, sz, 1);
        disc.position.copy(eye).add(dir.clone().multiplyScalar(far));
        disc.renderOrder = 2;
        g.add(disc);
      }
      const ray = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([eye, eye.clone().add(dir.clone().multiplyScalar(wide ? 900 : near * 4))]),
        new THREE.LineDashedMaterial({ color: new THREE.Color(d.color), dashSize: wide ? 30 : near * 0.12, gapSize: wide ? 20 : near * 0.08, transparent: true, opacity: 0.7 }),
      );
      ray.computeLineDistances();
      g.add(ray);
      if (d.label) {
        const tag = textSprite(d.label, d.color, 20);
        tag.position.copy(eye).add(dir.clone().multiplyScalar(far)).add(new THREE.Vector3(0, 160, 0));
        g.add(tag);
      }
    }
    if (sightLine) {
      const end = toScene(sightLine.end);
      const len = eye.distanceTo(end);
      const violet = new THREE.MeshBasicMaterial({ color: 0xb79bff, transparent: true, opacity: 0.95 });
      const r0 = wide ? 0.9 : Math.max(0.03, observerHeightM * 0.005 + 0.03);
      const r1 = Math.max(r0, len * 0.0016);
      if (sightLine.reachesObstacle) g.add(strut(eye, end, r0, r1, violet));
      else {
        const segs = 18;
        for (let k = 0; k < segs; k++) {
          const a0 = eye.clone().lerp(end, k / segs);
          const b0 = eye.clone().lerp(end, (k + 0.55) / segs);
          g.add(strut(a0, b0, r0 + (r1 - r0) * (k / segs), r0 + (r1 - r0) * ((k + 0.55) / segs), violet));
        }
      }
      const markR = wide ? Math.max(3, len * 0.012) : Math.max(0.12, Math.min(len * 0.008, near * 0.08));
      const mark = new THREE.Mesh(new THREE.SphereGeometry(markR, 20, 12), new THREE.MeshBasicMaterial({ color: sightLine.reachesObstacle ? 0xb79bff : 0xe8eef8 }));
      mark.position.copy(end);
      g.add(mark);
      if (labels) {
        const along = eye.clone().lerp(end, Math.min(0.45, wide ? 0.3 : (near * 2.4) / Math.max(1, len)));
        const sight = textSprite(labels.sight, "#b79bff", 19);
        sight.center.set(0.5, 1);
        sight.position.copy(along).add(new THREE.Vector3(0, -(wide ? 12 : near * 0.05), 0));
        g.add(sight);
      }
      if (sightLine.endLabel) {
        const endTag = textSprite(sightLine.endLabel, sightLine.reachesObstacle ? "#b79bff" : "#e8eef8", 22);
        // El extremo suele quedar a la derecha del encuadre: la etiqueta crece hacia la izquierda.
        endTag.center.set(0.92, 0);
        endTag.position.copy(end).add(new THREE.Vector3(0, wide ? Math.max(6, len * 0.02) : markR * 1.6, 0));
        g.add(endTag);
      }
    }
    // Luz direccional y caja de sombras centradas en la torre.
    const span = wide ? 400 : Math.max(18, observerHeightM * 2.2 + 12);
    const lc = t.light.shadow.camera;
    lc.left = -span;
    lc.right = span;
    lc.top = span;
    lc.bottom = -span;
    lc.near = 1;
    lc.far = 4000;
    lc.updateProjectionMatrix();
    t.world.scale.set(1, exaggeration, 1);
    const l = lightEnu ?? [-0.5, 0.5, 0.7];
    t.light.position.copy(toScene(l as Vec3).normalize().multiplyScalar(1500));
    t.light.target.position.set(0, 0, 0);
    t.render();
  }, [mesh, colors, observerHeightM, siteColor, directions, sightLine, exaggeration, lightEnu, labels, preset.view]);

  /* --------------------------------- cámara --------------------------------- */
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    let target = new THREE.Vector3(0, observerHeightM * exaggeration, 0);
    let pos: THREE.Vector3;
    if (preset.view === "tower") {
      // Oblicua, detrás y a un lado de la torre, mirando en la dirección de la visual:
      // se ven la estructura, su remate y el arranque del rayo.
      const h = observerHeightM * exaggeration;
      // En pantallas estrechas (móvil) la cámara se aleja para que quepan torre y visual.
      const d = Math.max(8, observerHeightM * 2.2 + 8) * (t.camera.aspect < 0.9 ? 1.6 : 1);
      const look = sightLine ? toScene(sightLine.end).setY(0).normalize() : azimuthDeg !== null ? azimuthDir(azimuthDeg) : new THREE.Vector3(0, 0, -1);
      const side = new THREE.Vector3(-look.z, 0, look.x);
      pos = look.clone().multiplyScalar(-d * 0.8).add(side.multiplyScalar(d * 0.62)).setY(h * 0.62 + d * 0.26 + 1.2);
      // Objetivo a media torre y algo por delante: base, remate y arranque de la visual en cuadro.
      target = new THREE.Vector3(0, h * 0.42 + 0.3, 0).add(look.clone().multiplyScalar(d * 0.3));
    } else if (preset.view === "near") pos = new THREE.Vector3(-70, 28 + observerHeightM, 95);
    else if (preset.view === "behind" && sightLine) {
      // Detrás del observador, mirando hacia el extremo de la visual.
      const dir = toScene(sightLine.end).setY(0).normalize();
      pos = new THREE.Vector3(-dir.x * 260, 110, -dir.z * 260);
    } else pos = new THREE.Vector3(-1300, 1150, 1600);
    t.camera.position.copy(pos);
    t.controls.minDistance = preset.view === "tower" ? 2 : 15;
    t.controls.target.copy(target);
    t.controls.update();
    t.render();
    // Solo al pedir un encuadre (nonce) o al cambiar de malla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.nonce, preset.view, mesh]);

  if (failed)
    return (
      <Callout tone="warn" icon="alert" title={L("Vista 3D no disponible", "3D view unavailable")}>
        {L("Este navegador no ha podido iniciar WebGL. Los datos del obstáculo y el mapa siguen disponibles; no se muestra ninguna imagen de sustitución.", "This browser could not start WebGL. The obstacle data and the map remain available; no substitute image is shown.")}
      </Callout>
    );
  return <div ref={hostRef} role="img" aria-label={label} data-testid="terrain-scene" data-observer-height={observerHeightM} data-view={preset.view} className="h-[clamp(380px,calc(100dvh-250px),620px)] w-full overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#0c1424,#03060d)]" />;
}
