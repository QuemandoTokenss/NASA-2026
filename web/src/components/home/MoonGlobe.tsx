"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { SiteId } from "@/lib/contract/constants";
import { BASE_PATH } from "@/lib/data/loader";
import { altitudeKm, detailOpacity, DETAIL_FADE, isBehindMoon, isFrontSide, sceneFromLonLat, sceneFromXY, shouldCluster } from "@/lib/geospatial/globe";
import type { Vec3 } from "@/lib/geospatial/lunar";
import { L } from "@/lib/i18n";
import { SITE_META } from "@/lib/labels";
import GLOBE_SOURCES from "@/assets/globe/SOURCES.json";
import moonTex1k from "@/assets/globe/moon-lroc-color-1k.webp";
import moonTex2k from "@/assets/globe/moon-lroc-color-2k.webp";
import capImg from "@/assets/globe/pole-lola240-cap.webp";
import ridgeImg from "@/assets/globe/pole-lola80-ridge.webp";
import siteImg from "@/assets/globe/pole-pgda78-site01.webp";
import earthImg from "@/assets/celestial/earth-bluemarble-as17.webp";
import sunImg from "@/assets/celestial/sun-sdo-aia171.webp";
import glowImg from "@/assets/scene/sky-glow-svs4851-2k.jpg";
import { Icon } from "../ui/Icon";
import { starPoints } from "../terrain/sceneParts";

export interface GlobeSite {
  id: SiteId;
  /** X/Y estereográficos del paquete (m). */
  x: number;
  y: number;
}
export type GlobeView = "globe" | "pole" | "free";

/** Evento de diagnóstico: dibuja de forma síncrona (el lienzo solo es legible en la tarea en que se dibuja). */
export const GLOBE_RENDER_NOW = "site-regret:render-now";

const FOV = 35;
const TAN = Math.tan((FOV / 2) * (Math.PI / 180));
/** Alturas de la cámara sobre la superficie, en radios lunares. */
const POLE_ALT = 0.0034; // ≈ 5,9 km: A y B (648 m) quedan separados y con etiqueta propia
const ALT_MIN = 0.0012;
const ALT_MAX = 8;
/** Altura desde la que caben la Luna y, a su lado, el Sol o la Tierra. */
const BODY_ALT = 5;
/**
 * Composición ILUSTRATIVA: la Tierra está en su dirección media real (longitud 0°, latitud 0°: la Luna
 * le da siempre la misma cara); el Sol se coloca sobre el ecuador a 64° O para que el primer encuadre
 * tenga relieve. Tamaños y distancias de ambos, fuera de escala.
 */
const SUN_DIR = sceneFromLonLat(-64, 0);
const EARTH_DIR = sceneFromLonLat(0, 0);
const BODY_DISTANCE = 60;
const STAR_RADIUS = 400;

const v3 = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2]);

/** Orientación de la cámara que mira al centro desde `dir`, con `upHint` hacia arriba en pantalla. */
function lookFrom(dir: THREE.Vector3, upHint: THREE.Vector3): THREE.Quaternion {
  const z = dir.clone().normalize();
  const x = new THREE.Vector3().crossVectors(upHint, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function globeGeometry(): THREE.BufferGeometry {
  const W = 144;
  const H = 72;
  const pos = new Float32Array((W + 1) * (H + 1) * 3);
  const uv = new Float32Array((W + 1) * (H + 1) * 2);
  let k = 0;
  for (let j = 0; j <= H; j++) {
    const lat = 90 - (180 * j) / H;
    for (let i = 0; i <= W; i++, k++) {
      const p = sceneFromLonLat(-180 + (360 * i) / W, lat);
      pos.set(p, 3 * k);
      uv[2 * k] = i / W;
      uv[2 * k + 1] = 1 - j / H;
    }
  }
  const idx = new Uint16Array(W * H * 6);
  let n = 0;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const a = j * (W + 1) + i;
      const c = a + W + 1;
      idx.set([a, c, a + 1, a + 1, c, c + 1], n);
      n += 6;
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/** Parche curvo sobre la esfera para una imagen georreferenciada en X/Y estereográficos. */
function patchGeometry(bounds: number[], cells: number, lift: number): THREE.BufferGeometry {
  const [xmin, ymin, xmax, ymax] = bounds;
  const n = cells + 1;
  const pos = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);
  let k = 0;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++, k++) {
      const p = sceneFromXY(xmin + ((xmax - xmin) * i) / cells, ymax - ((ymax - ymin) * j) / cells);
      pos.set([p[0] * lift, p[1] * lift, p[2] * lift], 3 * k);
      uv[2 * k] = i / cells;
      uv[2 * k + 1] = 1 - j / cells;
    }
  const idx = new Uint16Array(cells * cells * 6);
  let m = 0;
  for (let j = 0; j < cells; j++)
    for (let i = 0; i < cells; i++) {
      const a = j * n + i;
      idx.set([a, a + n, a + 1, a + 1, a + n, a + n + 1], m);
      m += 6;
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

const DETAIL = [
  { src: capImg.src, cells: 48, lift: 1.00002 },
  { src: ridgeImg.src, cells: 24, lift: 1.00003 },
  { src: siteImg.src, cells: 12, lift: 1.00004 },
].map((d, i) => ({ ...d, bounds: GLOBE_SOURCES.assets.find((a) => "level" in a && a.level === i + 1)!.bounds_xy_m as number[] }));

type FlyTarget = "globe" | "pole" | "sun" | "earth";
interface Api {
  flyTo: (view: FlyTarget) => void;
  zoom: (factor: number) => void;
}

/**
 * Globo lunar manipulable: textura global LROC (NASA SVS 4720), detalle polar georreferenciado
 * (relieve LOLA con luz sintética) y los sitios A y B en sus coordenadas del paquete. Es una vista:
 * no calcula visibilidad ni métricas. Se dibuja bajo demanda (nada de bucle cuando está quieto).
 */
export default function MoonGlobe({
  sites,
  selected,
  onSelect,
  onState,
}: {
  sites: GlobeSite[];
  selected: SiteId | null;
  onSelect: (id: SiteId) => void;
  onState?: (state: "ready" | "failed") => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const markerRefs = useRef<Record<string, HTMLElement | null>>({});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<GlobeView>("globe");
  const stateCb = useRef(onState);
  useEffect(() => {
    stateCb.current = onState;
  }, [onState]);

  useEffect(() => {
    const host = hostRef.current;
    const wrap = wrapRef.current;
    if (!host || !wrap) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      const t = setTimeout(() => {
        setFailed(true);
        stateCb.current?.("failed");
      }, 0);
      return () => clearTimeout(t);
    }
    const coarse = window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 768;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 1);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, STAR_RADIUS * 1.5);
    const loader = new THREE.TextureLoader();
    const textures: THREE.Texture[] = [];
    const tex = (src: string, onLoad?: () => void) => {
      const t = loader.load(src, () => {
        onLoad?.();
        requestRender();
      });
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      textures.push(t);
      return t;
    };

    // Vía Láctea: brillo difuso de fondo + estrellas en puntos (NASA SVS 4851). Ilustrativo.
    const glow = tex(glowImg.src);
    glow.mapping = THREE.EquirectangularReflectionMapping;
    glow.generateMipmaps = false;
    glow.minFilter = THREE.LinearFilter;
    scene.background = glow;
    scene.backgroundIntensity = 0.9;

    // Luna.
    let moonLoaded = false;
    const moonMap = tex(coarse ? moonTex1k.src : moonTex2k.src, () => {
      moonLoaded = true;
    });
    moonMap.wrapS = THREE.RepeatWrapping;
    const moonMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: moonMap }, uSun: { value: v3(SUN_DIR) }, uFill: { value: 0.07 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN;
void main() { vUv = uv; vN = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 uSun; uniform float uFill; varying vec2 vUv; varying vec3 vN;
void main() {
  vec3 c = texture2D(map, vUv).rgb;
  float lit = smoothstep(-0.06, 0.42, dot(normalize(vN), uSun));
  gl_FragColor = vec4(c * mix(uFill, 1.0, lit) * 1.12, 1.0);
  #include <colorspace_fragment>
}`,
    });
    const moon = new THREE.Mesh(globeGeometry(), moonMat);
    scene.add(moon);

    // Detalle polar: se carga cuando la cámara se acerca lo bastante para necesitarlo.
    const detail = DETAIL.map((d, i) => {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, color: 0xd6d2cb });
      const mesh = new THREE.Mesh(patchGeometry(d.bounds, d.cells, d.lift), mat);
      mesh.renderOrder = 1 + i;
      mesh.visible = false;
      scene.add(mesh);
      return { ...d, mat, mesh, requested: false, loaded: false };
    });

    // Sol y Tierra: discos lejanos (tamaño y distancia fuera de escala).
    const body = (src: string, dir: Vec3, size: number) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(src), transparent: true, depthWrite: false }));
      s.position.copy(v3(dir).multiplyScalar(BODY_DISTANCE));
      s.scale.set(size, size, 1);
      scene.add(s);
      return s;
    };
    const sun = body(sunImg.src, SUN_DIR, 9);
    const earth = body(earthImg.src, EARTH_DIR, 6.5);

    let stars: THREE.Points | null = null;
    const abort = new AbortController();
    fetch(`${BASE_PATH}/scene/stars-svs4851-v1.bin`, { signal: abort.signal })
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((buf) => {
        const n = new DataView(buf).getUint32(4, true);
        if (new TextDecoder().decode(new Uint8Array(buf, 0, 4)) !== "STR1" || buf.byteLength !== 8 + n * 16) return;
        stars = starPoints(new Float32Array(buf.slice(8, 8 + n * 12)), new Uint8Array(buf, 8 + n * 12, n * 4), STAR_RADIUS, pixelRatio);
        scene.add(stars);
        requestRender();
      })
      .catch(() => undefined);

    /* ------------------------------ cámara ------------------------------ */
    const siteVec = Object.fromEntries(sites.map((s) => [s.id, v3(sceneFromXY(s.x, s.y))])) as Record<string, THREE.Vector3>;
    const poleDir = sites.reduce((acc, s) => acc.add(siteVec[s.id]), new THREE.Vector3()).normalize();
    const HOME_Q = lookFrom(v3(sceneFromLonLat(-8, -46)), new THREE.Vector3(0, 1, 0));
    // Polo: misma orientación que el mapa de la app (longitud 0° arriba, 90° E a la derecha).
    const POLE_Q = lookFrom(poleDir, v3(sceneFromLonLat(0, 0)));
    const q = HOME_Q.clone();
    // Vista global: la Luna ocupa ~84 % del lado corto del lienzo.
    const homeAlt = () => 1 / Math.sin(Math.atan(0.84 * Math.min(1, (width / height) * 0.94) * TAN)) - 1;
    /** Encuadre con la Luna en el centro y el cuerpo asomando a su derecha. */
    const bodyView = (dir: Vec3) => {
      const b = v3(dir);
      const x0 = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), b.clone().negate()).normalize();
      const y0 = new THREE.Vector3().crossVectors(b.clone().negate(), x0);
      const halfH = Math.atan(TAN * Math.min(1.6, width / height));
      const off = Math.min(Math.asin(1 / (1 + BODY_ALT)) + 0.1, halfH - 0.085);
      const f = b.clone().multiplyScalar(Math.cos(off)).addScaledVector(x0, -Math.sin(off));
      return lookFrom(f.negate(), y0);
    };
    let alt = 2.9;
    let width = 1;
    let height = 1;
    let pending = 0;
    let anim = 0;
    let frames = 0;
    let firstFrame = false;
    let currentView: GlobeView = "globe";
    const markView = (v: GlobeView) => {
      if (v === currentView) return;
      currentView = v;
      setView(v);
    };

    const tmp = new THREE.Vector3();
    const camLocal = new THREE.Quaternion();
    const place = (el: HTMLElement | null | undefined, x: number, y: number, show: boolean) => {
      if (!el) return;
      el.style.display = show ? "block" : "none";
      if (show) el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    };
    const project = (p: THREE.Vector3) => {
      tmp.copy(p).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height };
    };

    const overlay = () => {
      const cam: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
      const pts = sites.map((s) => {
        const p = siteVec[s.id];
        return { id: s.id, ...project(p), front: isFrontSide([p.x, p.y, p.z], cam, 0.012) };
      });
      const [a, b] = pts;
      const cluster = shouldCluster(a, b);
      const anyFront = a.front && b.front;
      const inside = (p: { x: number; y: number }) => p.x > -20 && p.x < width + 20 && p.y > -20 && p.y < height + 20;
      place(markerRefs.current.cluster, (a.x + b.x) / 2, (a.y + b.y) / 2, cluster && anyFront && inside(a));
      for (const p of pts) place(markerRefs.current[p.id], p.x, p.y, !cluster && p.front && inside(p));
      wrap.dataset.cluster = String(cluster);
      wrap.dataset.sitesVisible = String(anyFront);
      wrap.dataset.altKm = altitudeKm(1 + alt).toFixed(1);
      wrap.dataset.siteA = `${a.x.toFixed(1)},${a.y.toFixed(1)}`;
      wrap.dataset.siteB = `${b.x.toFixed(1)},${b.y.toFixed(1)}`;
      wrap.dataset.camera = cam.map((c) => c.toFixed(4)).join(",");

      // Sol y Tierra: rótulo bajo el disco si se ve; flecha en el borde si queda fuera del encuadre.
      camLocal.copy(camera.quaternion).invert();
      for (const [key, dir, sprite] of [
        ["sun", SUN_DIR, sun],
        ["earth", EARTH_DIR, earth],
      ] as const) {
        const el = markerRefs.current[key];
        if (!el) continue;
        const s = project(sprite.position);
        tmp.copy(sprite.position).sub(camera.position).applyQuaternion(camLocal);
        const onScreen = tmp.z < 0 && s.x > 24 && s.x < width - 24 && s.y > 30 && s.y < height - 40;
        const arrow = el.querySelector<HTMLElement>("[data-arrow]");
        if (onScreen) {
          const hidden = isBehindMoon(dir, cam);
          place(el, s.x, s.y + (sprite.scale.y / 2 / (BODY_DISTANCE * TAN)) * (height / 2) + 12, !hidden);
          if (arrow) arrow.style.display = "none";
          el.dataset.where = hidden ? "behind" : "screen";
        } else {
          const len = Math.hypot(tmp.x, tmp.y) || 1;
          const ux = tmp.x / len;
          const uy = -tmp.y / len;
          const k = Math.min((width / 2 - 48) / Math.max(1e-6, Math.abs(ux)), (height / 2 - 26) / Math.max(1e-6, Math.abs(uy)));
          place(el, width / 2 + ux * k, height / 2 + uy * k, true);
          if (arrow) {
            arrow.style.display = "inline-block";
            arrow.style.transform = `rotate(${(Math.atan2(uy, ux) * 180) / Math.PI}deg)`;
          }
          el.dataset.where = "edge";
        }
      }
    };

    const draw = () => {
      pending = 0;
      camera.quaternion.copy(q);
      camera.position.set(0, 0, 1 + alt).applyQuaternion(q);
      camera.near = Math.max(alt * 0.2, 0.0001);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      // Al acercar, la luz se uniforma para leer el relieve del detalle polar.
      const near = Math.min(1, Math.max(0, (Math.log(1.6) - Math.log(alt)) / (Math.log(1.6) - Math.log(0.2))));
      moonMat.uniforms.uFill.value = 0.07 + 0.85 * near;
      for (let i = 0; i < detail.length; i++) {
        const d = detail[i];
        if (!d.requested && alt < DETAIL_FADE[i].from * 1.6) {
          d.requested = true;
          d.mat.map = tex(d.src, () => {
            d.loaded = true;
            d.mat.needsUpdate = true;
          });
        }
        const o = d.loaded ? detailOpacity(i, alt) : 0;
        d.mat.opacity = o;
        d.mesh.visible = o > 0.001;
      }
      if (stars) stars.position.copy(camera.position);
      renderer.render(scene, camera);
      frames++;
      wrap.dataset.frames = String(frames);
      overlay();
      if (!firstFrame && moonLoaded) {
        firstFrame = true;
        setReady(true);
        stateCb.current?.("ready");
      }
    };
    function requestRender() {
      if (!pending && !anim) pending = requestAnimationFrame(draw);
    }

    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const stopAnim = () => {
      if (anim) cancelAnimationFrame(anim);
      anim = 0;
    };
    const flyTo = (target: FlyTarget) => {
      stopAnim();
      const q1 = target === "pole" ? POLE_Q : target === "globe" ? HOME_Q : bodyView(target === "sun" ? SUN_DIR : EARTH_DIR);
      const a1 = target === "pole" ? POLE_ALT : target === "globe" ? homeAlt() : BODY_ALT;
      markView(target === "pole" || target === "globe" ? target : "free");
      if (reduced) {
        q.copy(q1);
        alt = a1;
        requestRender();
        return;
      }
      const q0 = q.clone();
      const a0 = alt;
      const down = a1 < a0;
      const span = Math.abs(Math.log(a1 / a0));
      const T = 900 + 260 * span;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / T);
        // Al bajar se gira primero y se acerca después; al subir, al revés.
        const kr = ease(down ? Math.min(1, t * 1.7) : Math.max(0, (t - 0.41) * 1.7));
        q.slerpQuaternions(q0, q1, kr);
        alt = Math.exp(Math.log(a0) + (Math.log(a1) - Math.log(a0)) * ease(t));
        anim = t < 1 ? requestAnimationFrame(step) : 0;
        draw();
      };
      anim = requestAnimationFrame(step);
    };
    const rotatePx = (dx: number, dy: number) => {
      const k = Math.min(0.006, (2 * alt * TAN) / height);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -dx * k));
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -dy * k));
      q.normalize();
      markView("free");
      requestRender();
    };
    const zoom = (factor: number) => {
      stopAnim();
      alt = Math.min(ALT_MAX, Math.max(ALT_MIN, alt * factor));
      markView("free");
      requestRender();
    };
    apiRef.current = { flyTo, zoom };

    /* ---------------------------- interacción ---------------------------- */
    const el = renderer.domElement;
    el.style.touchAction = "pan-y";
    const pointers = new Map<number, { x: number; y: number }>();
    let engaged = false;
    let pinch = 0;
    const down = (e: PointerEvent) => {
      stopAnim();
      engaged = true;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
      if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        pinch = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      }
    };
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (pinch > 0 && dist > 0) zoom(pinch / dist);
        pinch = dist;
      } else rotatePx(dx, dy);
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
      if (!pointers.size) el.style.cursor = "grab";
    };
    const wheel = (e: WheelEvent) => {
      // La rueda solo acerca tras tocar el globo (o con Ctrl / pellizco del panel táctil): no secuestra el desplazamiento de la página.
      if (!engaged && !e.ctrlKey) return;
      e.preventDefault();
      zoom(Math.exp(Math.max(-120, Math.min(120, e.deltaY)) * 0.0022));
    };
    const leave = () => {
      if (!pointers.size && document.activeElement !== host) engaged = false;
    };
    const key = (e: KeyboardEvent) => {
      const stepPx = 15 * (Math.PI / 180) / Math.min(0.006, (2 * alt * TAN) / height);
      const moves: Record<string, () => void> = {
        ArrowLeft: () => rotatePx(stepPx, 0),
        ArrowRight: () => rotatePx(-stepPx, 0),
        ArrowUp: () => rotatePx(0, stepPx),
        ArrowDown: () => rotatePx(0, -stepPx),
        "+": () => zoom(0.72),
        "=": () => zoom(0.72),
        "-": () => zoom(1 / 0.72),
        p: () => flyTo("pole"),
        P: () => flyTo("pole"),
        "0": () => flyTo("globe"),
        Home: () => flyTo("globe"),
        Escape: () => flyTo("globe"),
      };
      const fn = moves[e.key];
      if (!fn) return;
      e.preventDefault();
      stopAnim();
      fn();
    };
    const focus = () => {
      engaged = true;
    };
    const blur = () => {
      engaged = false;
    };
    el.style.cursor = "grab";
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("wheel", wheel, { passive: false });
    host.addEventListener("keydown", key);
    host.addEventListener("focus", focus);
    host.addEventListener("blur", blur);
    const renderNow = () => draw();
    host.addEventListener(GLOBE_RENDER_NOW, renderNow);

    const resize = () => {
      width = Math.max(1, host.clientWidth);
      height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      camera.aspect = width / height;
      if (currentView === "globe" && !anim) alt = homeAlt();
      requestRender();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    return () => {
      abort.abort();
      stopAnim();
      if (pending) cancelAnimationFrame(pending);
      ro.disconnect();
      apiRef.current = null;
      host.removeEventListener("keydown", key);
      host.removeEventListener("focus", focus);
      host.removeEventListener("blur", blur);
      host.removeEventListener(GLOBE_RENDER_NOW, renderNow);
      moon.geometry.dispose();
      moonMat.dispose();
      for (const d of detail) {
        d.mesh.geometry.dispose();
        d.mat.dispose();
      }
      for (const s of [sun, earth]) s.material.dispose();
      if (stars) {
        stars.geometry.dispose();
        (stars.material as THREE.Material).dispose();
      }
      for (const t of textures) t.dispose();
      renderer.dispose();
      el.remove();
    };
    // Los sitios son constantes del paquete: el visor se crea una vez por montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMarker = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      markerRefs.current[id] = el;
    },
    [],
  );
  const pick = (id: SiteId) => onSelect(id);
  // Elegir un sitio (en el globo o en los botones de la portada) lleva la cámara al polo.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    if (selected && ready && viewRef.current !== "pole") apiRef.current?.flyTo("pole");
  }, [selected, ready]);

  if (failed) return null;
  const btn = "inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/25 bg-black/65 px-3 text-sm font-semibold text-ink backdrop-blur-sm hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-black/65";
  return (
    <div ref={wrapRef} data-testid="moon-globe" data-ready={ready} data-view={view} className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
      <div
        ref={hostRef}
        tabIndex={0}
        role="application"
        aria-label={L(
          "Globo lunar interactivo. Flechas: girar. Más y menos: acercar y alejar. P: polo sur. 0: volver al globo.",
          "Interactive Moon globe. Arrow keys: rotate. Plus and minus: zoom. P: south pole. 0: back to the globe.",
        )}
        className="absolute inset-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {(["sun", "earth"] as const).map((b) => (
          <span key={b} ref={setMarker(b)} className="absolute top-0 left-0 hidden">
            <button
              type="button"
              onClick={() => apiRef.current?.flyTo(b)}
              data-testid={`globe-${b}`}
              aria-label={b === "sun" ? L("Girar para ver el Sol", "Turn to see the Sun") : L("Girar para ver la Tierra", "Turn to see the Earth")}
              className="pointer-events-auto flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white/90 hover:bg-white/15"
            >
              {b === "sun" ? L("Sol", "Sun") : L("Tierra", "Earth")}
              <span data-arrow aria-hidden className="inline-block text-accent">
                →
              </span>
            </button>
          </span>
        ))}
        <span ref={setMarker("cluster")} className="absolute top-0 left-0 hidden">
          <button
            type="button"
            onClick={() => apiRef.current?.flyTo("pole")}
            data-testid="globe-cluster"
            className="pointer-events-auto flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-white/60 bg-black/70 py-1 pr-3 pl-1.5 text-sm font-bold text-white shadow-[0_0_24px_-4px_#fff] backdrop-blur-sm hover:bg-white/20"
            aria-label={L("Sitios A y B, en el polo sur lunar: acercar", "Sites A and B, at the lunar south pole: zoom in")}
          >
            <span aria-hidden className="flex">
              <span className="size-3.5 rounded-full bg-site-a ring-2 ring-black/60" />
              <span className="-ml-1 size-3.5 rounded-full bg-site-b ring-2 ring-black/60" />
            </span>
            <span>
              <span className="text-site-a">A</span> · <span className="text-site-b">B</span>
            </span>
            <span className="text-xs font-medium text-white/75">{L("polo sur", "south pole")}</span>
          </button>
        </span>
        {sites.map((s) => (
          <span key={s.id} ref={setMarker(s.id)} className="absolute top-0 left-0 hidden">
            <button
              type="button"
              onClick={() => pick(s.id)}
              aria-pressed={selected === s.id}
              data-testid={`globe-site-${s.id}`}
              className="group pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-2"
              aria-label={`${SITE_META[s.id].label} · Connecting Ridge`}
            >
              <span className={`block size-4 rounded-full ring-2 ring-black/70 ${s.id === "A" ? "bg-site-a" : "bg-site-b"} ${selected === s.id ? "outline-2 outline-offset-4 outline-white" : "group-hover:outline-2 group-hover:outline-offset-2 group-hover:outline-white/70"}`} />
              <span className={`absolute rounded-md bg-black/75 px-2 py-0.5 text-sm font-bold whitespace-nowrap ${SITE_META[s.id].textClass} ${s.id === "A" ? "top-full right-1/2 mt-0.5" : "bottom-full left-1/2 mb-0.5"}`}>{SITE_META[s.id].label}</span>
            </button>
          </span>
        ))}
      </div>
      <div className="absolute right-3 bottom-3 flex justify-end gap-2 sm:right-4 sm:bottom-4" role="group" aria-label={L("Controles del globo", "Globe controls")}>
        <button type="button" className={btn} onClick={() => apiRef.current?.flyTo("pole")} disabled={view === "pole"} data-testid="globe-pole">
          <Icon name="pin" className="size-4" /> {L("Polo sur", "South pole")}
        </button>
        <button type="button" className={btn} onClick={() => apiRef.current?.flyTo("globe")} disabled={view === "globe"} data-testid="globe-reset">
          <Icon name="orbit" className="size-4" /> <span className="sm:hidden">{L("Globo", "Globe")}</span>
          <span className="hidden sm:inline">{L("Volver al globo", "Back to globe")}</span>
        </button>
        <button type="button" className={`${btn} w-10 justify-center px-0 text-lg`} onClick={() => apiRef.current?.zoom(0.6)} aria-label={L("Acercar", "Zoom in")} data-testid="globe-zoom-in">
          +
        </button>
        <button type="button" className={`${btn} w-10 justify-center px-0 text-lg`} onClick={() => apiRef.current?.zoom(1 / 0.6)} aria-label={L("Alejar", "Zoom out")} data-testid="globe-zoom-out">
          −
        </button>
      </div>
    </div>
  );
}
