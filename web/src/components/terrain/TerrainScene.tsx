"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LAYER_STYLE, rampColor } from "@/lib/geospatial/colormap";
import type { Vec3 } from "@/lib/geospatial/lunar";
import type { TerrainMesh } from "@/lib/geospatial/mesh";
import { L } from "@/lib/i18n";
import { Callout } from "../ui/Display";

export interface SceneDirection {
  /** [este, norte, arriba] unitario. */
  enu: Vec3;
  color: string;
}

export interface SceneSightLine {
  /** Extremo de la visual en coordenadas locales [este, norte, arriba] (m). */
  end: Vec3;
  /** `true` si el extremo es el obstáculo; `false` si solo indica la dirección (obstáculo fuera del recorte). */
  reachesObstacle: boolean;
}

export type ViewPreset = "overview" | "near" | "behind";

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
      const c = rampColor(LAYER_STYLE.elevation.stops, (mesh.heights[i] - mesh.minHeight) / span);
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
    const camera = new THREE.PerspectiveCamera(42, 1, 1, 60000);
    const world = new THREE.Group();
    const dynamic = new THREE.Group();
    world.add(dynamic);
    scene.add(world);
    scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    const light = new THREE.DirectionalLight(0xffffff, 2.3);
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
    // Marcador del sitio (anillo plano, no es una estructura real).
    const ring = new THREE.Mesh(new THREE.RingGeometry(14, 17, 48), new THREE.MeshBasicMaterial({ color: siteColor, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.4;
    g.add(ring);
    // Mástil a su altura real (0, 2 o 10 m) y punto del observador.
    if (observerHeightM > 0) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, observerHeightM, 12), new THREE.MeshBasicMaterial({ color: 0xe8eef8 }));
      mast.position.y = observerHeightM / 2;
      g.add(mast);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.4, 20, 12), new THREE.MeshBasicMaterial({ color: siteColor }));
    head.position.copy(eye);
    g.add(head);
    for (const d of directions) {
      const arrow = new THREE.ArrowHelper(toScene(d.enu).normalize(), eye, 420, new THREE.Color(d.color), 36, 14);
      g.add(arrow);
    }
    if (sightLine) {
      const end = toScene(sightLine.end);
      const material = sightLine.reachesObstacle ? new THREE.LineBasicMaterial({ color: 0xa78bfa }) : new THREE.LineDashedMaterial({ color: 0xa78bfa, dashSize: 40, gapSize: 28 });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([eye, end]), material);
      line.computeLineDistances();
      g.add(line);
      if (sightLine.reachesObstacle) {
        const mark = new THREE.Mesh(new THREE.SphereGeometry(Math.max(3, eye.distanceTo(end) * 0.012), 20, 12), new THREE.MeshBasicMaterial({ color: 0xa78bfa }));
        mark.position.copy(end);
        g.add(mark);
      }
    }
    t.world.scale.set(1, exaggeration, 1);
    const l = lightEnu ?? [-0.5, 0.5, 0.7];
    t.light.position.copy(toScene(l as Vec3).normalize().multiplyScalar(1000));
    t.render();
  }, [mesh, colors, observerHeightM, siteColor, directions, sightLine, exaggeration, lightEnu]);

  /* --------------------------------- cámara --------------------------------- */
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    const target = new THREE.Vector3(0, observerHeightM * exaggeration, 0);
    let pos: THREE.Vector3;
    if (preset.view === "near") pos = new THREE.Vector3(-70, 28 + observerHeightM, 95);
    else if (preset.view === "behind" && sightLine) {
      // Detrás del observador, mirando hacia el extremo de la visual.
      const dir = toScene(sightLine.end).setY(0).normalize();
      pos = new THREE.Vector3(-dir.x * 260, 110, -dir.z * 260);
    } else pos = new THREE.Vector3(-1300, 1150, 1600);
    t.camera.position.copy(pos);
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
  return <div ref={hostRef} role="img" aria-label={label} data-testid="terrain-scene" className="h-[420px] w-full overflow-hidden rounded-xl border border-line-strong bg-[#03060d] sm:h-[520px]" />;
}
