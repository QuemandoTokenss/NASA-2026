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
import { azimuthDir, groundCompass, latticeTower, strut, textSprite } from "./sceneParts";

export interface SceneDirection {
  /** [este, norte, arriba] unitario. */
  enu: Vec3;
  color: string;
  /** Etiqueta corta («Sol», «Tierra»). */
  label?: string;
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
      out[3 * i] = c[0] / 255;
      out[3 * i + 1] = c[1] / 255;
      out[3 * i + 2] = c[2] / 255;
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
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.2, 60000);
    const world = new THREE.Group();
    const dynamic = new THREE.Group();
    world.add(dynamic);
    scene.add(world);
    scene.add(new THREE.AmbientLight(0xffffff, 0.16));
    scene.add(new THREE.HemisphereLight(0x9fb3d6, 0x15171b, 0.35));
    scene.fog = new THREE.Fog(0x03060d, 2200, 9000);
    const light = new THREE.DirectionalLight(0xfff4e0, 3.1);
    scene.add(light);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    terrain.frustumCulled = false;
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
    // Escala de los elementos gráficos según el encuadre (cerca de la torre o vista amplia).
    const near = Math.max(6, observerHeightM * 1.6 + 4);
    // Marcador del sitio (anillo plano, no es una estructura real).
    const ringR = wide ? 15 : Math.max(1.2, near * 0.18);
    const ring = new THREE.Mesh(new THREE.RingGeometry(ringR * 0.82, ringR, 48), new THREE.MeshBasicMaterial({ color: siteColor, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    g.add(ring);
    // Torre ilustrativa en celosía: el remate está a la altura REAL del observador.
    g.add(latticeTower(observerHeightM, 0xdfe7f3));
    const headR = wide ? 3 : Math.max(0.22, observerHeightM * 0.045);
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 20, 12), new THREE.MeshBasicMaterial({ color: siteColor }));
    head.position.copy(eye);
    g.add(head);
    if (observerHeightM <= 0) {
      // A 0 m: observador a ras del suelo (pin vertical corto, sin estructura).
      const pin = strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, near * 0.22, 0), 0.04, 0.04, new THREE.MeshBasicMaterial({ color: siteColor }));
      g.add(pin);
    }
    if (labels) {
      const obs = textSprite(labels.observer, siteColor);
      obs.position.copy(eye).add(new THREE.Vector3(0, wide ? 30 : Math.max(0.6, near * 0.12), 0));
      g.add(obs);
    }
    // Brújula en el suelo con la cuña hasta el azimut consultado.
    g.add(groundCompass(wide ? 160 : near * 1.35, azimuthDeg, 0.25));
    for (const d of directions) {
      const len = wide ? 420 : near * 2.6;
      const dir = toScene(d.enu).normalize();
      const arrow = new THREE.ArrowHelper(dir, eye, len, new THREE.Color(d.color), len * 0.09, len * 0.035);
      g.add(arrow);
      if (d.label) {
        const tag = textSprite(d.label, d.color, 22);
        tag.position.copy(eye).add(dir.clone().multiplyScalar(len * 1.04));
        g.add(tag);
      }
    }
    if (sightLine) {
      const end = toScene(sightLine.end);
      const len = eye.distanceTo(end);
      const violet = new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.95 });
      const r0 = wide ? 1.2 : Math.max(0.05, observerHeightM * 0.012 + 0.04);
      const r1 = Math.max(r0, len * 0.0028);
      if (sightLine.reachesObstacle) g.add(strut(eye, end, r0, r1, violet));
      else {
        // Discontinua: solo indica la dirección hasta el borde del recorte 3D.
        const segs = 16;
        for (let k = 0; k < segs; k++) {
          const a = eye.clone().lerp(end, k / segs);
          const b = eye.clone().lerp(end, (k + 0.55) / segs);
          g.add(strut(a, b, r0 + (r1 - r0) * (k / segs), r0 + (r1 - r0) * ((k + 0.55) / segs), violet));
        }
      }
      const markR = wide ? Math.max(3, len * 0.012) : Math.max(0.12, Math.min(len * 0.01, near * 0.1));
      const mark = new THREE.Mesh(new THREE.SphereGeometry(markR, 20, 12), new THREE.MeshBasicMaterial({ color: sightLine.reachesObstacle ? 0xa78bfa : 0xe8eef8 }));
      mark.position.copy(end);
      g.add(mark);
      if (labels) {
        const along = eye.clone().lerp(end, Math.min(0.5, (wide ? 0.3 : (near * 2.2) / Math.max(1, len))));
        const sight = textSprite(labels.sight, "#a78bfa", 22);
        sight.position.copy(along).add(new THREE.Vector3(0, wide ? 20 : near * 0.08, 0));
        g.add(sight);
      }
      if (sightLine.endLabel) {
        const endTag = textSprite(sightLine.endLabel, sightLine.reachesObstacle ? "#a78bfa" : "#e8eef8");
        endTag.position.copy(end).add(new THREE.Vector3(0, wide ? Math.max(6, len * 0.02) : markR * 1.6, 0));
        g.add(endTag);
      }
    }
    t.world.scale.set(1, exaggeration, 1);
    const l = lightEnu ?? [-0.5, 0.5, 0.7];
    t.light.position.copy(toScene(l as Vec3).normalize().multiplyScalar(1000));
    t.render();
  }, [mesh, colors, observerHeightM, siteColor, directions, sightLine, exaggeration, lightEnu, azimuthDeg, labels, preset.view]);

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
      const d = Math.max(8, observerHeightM * 2.3 + 7) * (t.camera.aspect < 0.9 ? 1.6 : 1);
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
