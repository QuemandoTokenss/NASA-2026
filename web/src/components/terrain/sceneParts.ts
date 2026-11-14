/**
 * Piezas de dibujo de la escena 3D de Engineer. Son GRÁFICOS de presentación:
 * la altura del remate de la torre es la altura real del observador; la forma de la
 * torre, el material del suelo, la luz y las sombras son ilustrativos (no medidas).
 *
 * Todo se crea UNA vez por visor y se actualiza con transformaciones: mover el
 * deslizador de altura no crea geometrías, materiales ni texturas.
 */
import * as THREE from "three";

/** Escena: x = este, y = arriba, z = −norte. */
export const azimuthDir = (azDeg: number) => {
  const a = (azDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
};

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _d = new THREE.Vector3();

/** Matriz de un cilindro unidad (radio 1, alto 1, centrado) que va de `a` a `b` con radio `r`. */
export function strutMatrix(a: THREE.Vector3, b: THREE.Vector3, r: number, out = _m): THREE.Matrix4 {
  _d.subVectors(b, a);
  const len = _d.length();
  _q.setFromUnitVectors(UP, len > 0 ? _d.multiplyScalar(1 / len) : UP);
  _p.addVectors(a, b).multiplyScalar(0.5);
  _s.set(r, Math.max(len, 1e-6), r);
  return out.compose(_p, _q, _s);
}

/** Barra suelta (cilindro unidad compartido) entre dos puntos. */
export const UNIT_CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);

/**
 * Torre de vigilancia en celosía con piezas reutilizables: TODAS las barras son
 * instancias de un mismo cilindro (una llamada de dibujo) y las zapatas otra.
 * `update(h)` recoloca las instancias; el remate queda EXACTAMENTE a `h` sobre el suelo.
 */
export class TowerRig {
  readonly group = new THREE.Group();
  private readonly struts: THREE.InstancedMesh;
  private readonly feet: THREE.InstancedMesh;
  private readonly deck: THREE.Mesh;
  private readonly steel: THREE.MeshStandardMaterial;
  private readonly concrete: THREE.MeshStandardMaterial;
  private readonly deckGeo = new THREE.BoxGeometry(1, 1, 1);
  private readonly footGeo = new THREE.BoxGeometry(1, 1, 1);
  /** Semiancho de la base a la altura actual (para el contacto con el suelo). */
  baseHalf = 0;

  static readonly MAX_STRUTS = 4 + 14 * 12 + 8 + 4;

  constructor(color = 0xc3cad3) {
    // Metal mate claro: contrasta con el regolito oscuro sin reflejos de espejo.
    this.steel = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.62 });
    this.concrete = new THREE.MeshStandardMaterial({ color: 0x9a9893, roughness: 0.95, metalness: 0 });
    this.struts = new THREE.InstancedMesh(UNIT_CYLINDER, this.steel, TowerRig.MAX_STRUTS);
    this.feet = new THREE.InstancedMesh(this.footGeo, this.concrete, 4);
    this.deck = new THREE.Mesh(this.deckGeo, this.steel);
    for (const o of [this.struts, this.feet, this.deck]) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      this.group.add(o);
    }
  }

  update(heightM: number) {
    const visible = heightM > 0;
    this.group.visible = visible;
    if (!visible) {
      this.baseHalf = 0;
      return;
    }
    // Proporciones continuas con la altura (0–30 m).
    const base = Math.min(3.2, 0.55 + heightM * 0.11);
    const top = base * 0.42;
    const r = Math.min(0.12, 0.022 + heightM * 0.0045);
    const levels = Math.max(2, Math.min(14, Math.round(heightM / 2.2)));
    const deckY = heightM - Math.min(0.4, 0.12 + heightM * 0.02);
    this.baseHalf = base;
    const half = (y: number) => base + (top - base) * (y / deckY);
    const corner = (y: number, sx: number, sz: number, v = new THREE.Vector3()) => v.set(sx * half(y), y, sz * half(y));
    const signs: Array<[number, number]> = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    let n = 0;
    const put = (r0: number) => this.struts.setMatrixAt(n++, strutMatrix(a, b, r0));
    for (const [sx, sz] of signs) {
      corner(-0.25, sx, sz, a);
      corner(deckY, sx, sz, b);
      put(r * 1.65);
    }
    for (let k = 0; k <= levels; k++) {
      const y0 = (deckY * k) / levels;
      for (let i = 0; i < 4; i++) {
        const [ax, az] = signs[i];
        const [bx, bz] = signs[(i + 1) % 4];
        if (k > 0) {
          corner(y0, ax, az, a);
          corner(y0, bx, bz, b);
          put(r);
        }
        if (k < levels) {
          const y1 = (deckY * (k + 1)) / levels;
          corner(y0, ax, az, a);
          corner(y1, bx, bz, b);
          put(r * 0.8);
          corner(y0, bx, bz, a);
          corner(y1, ax, az, b);
          put(r * 0.8);
        }
      }
    }
    // Barandilla.
    const deckHalf = top + Math.min(0.45, 0.15 + heightM * 0.02);
    const railY = deckY + Math.min(0.9, 0.18 + heightM * 0.03);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = signs[i];
      const [bx, bz] = signs[(i + 1) % 4];
      a.set(ax * deckHalf, deckY, az * deckHalf);
      b.set(ax * deckHalf, railY, az * deckHalf);
      put(r * 0.7);
      a.set(ax * deckHalf, railY, az * deckHalf);
      b.set(bx * deckHalf, railY, bz * deckHalf);
      put(r * 0.7);
    }
    this.struts.count = n;
    this.struts.instanceMatrix.needsUpdate = true;
    // Zapatas de hormigón en el arranque de cada pata.
    const fw = Math.max(0.18, r * 9);
    const fh = Math.max(0.12, r * 3);
    signs.forEach(([sx, sz], i) => {
      corner(0, sx, sz, a);
      _m.compose(a.setY(fh / 2 - 0.05), _q.identity(), _s.set(fw, fh, fw));
      this.feet.setMatrixAt(i, _m);
    });
    this.feet.instanceMatrix.needsUpdate = true;
    this.deck.position.set(0, deckY, 0);
    this.deck.scale.set(deckHalf * 2, Math.max(0.05, r * 1.2), deckHalf * 2);
  }

  dispose() {
    this.struts.dispose();
    this.feet.dispose();
    this.deckGeo.dispose();
    this.footGeo.dispose();
    this.steel.dispose();
    this.concrete.dispose();
  }
}

/** Etiquetas de texto de tamaño constante en pantalla, con caché por texto y color. */
export class LabelCache {
  private readonly map = new Map<string, { tex: THREE.CanvasTexture; aspect: number }>();

  sprite(): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true }));
    s.center.set(0.5, 0);
    s.renderOrder = 20;
    s.visible = false;
    return s;
  }

  set(s: THREE.Sprite, text: string | undefined | null, color: string, sizePx = 18) {
    if (!text) {
      s.visible = false;
      return;
    }
    const key = `${sizePx}|${color}|${text}`;
    let e = this.map.get(key);
    if (!e) {
      const ratio = 2;
      const font = `600 ${sizePx * ratio}px Inter, system-ui, sans-serif`;
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d")!;
      ctx.font = font;
      const padX = 10 * ratio;
      const padY = 6 * ratio;
      const w = Math.ceil(ctx.measureText(text).width) + 2 * padX;
      const h = sizePx * ratio + 2 * padY;
      c.width = w;
      c.height = h;
      ctx.font = font;
      ctx.fillStyle = "rgba(5, 9, 18, 0.78)";
      ctx.strokeStyle = color;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5 * ratio;
      ctx.beginPath();
      ctx.roundRect(ratio, ratio, w - 2 * ratio, h - 2 * ratio, 8 * ratio);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e8eef8";
      ctx.textBaseline = "middle";
      ctx.fillText(text, padX, h / 2 + ratio);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      e = { tex, aspect: w / h };
      this.map.set(key, e);
    }
    const mat = s.material as THREE.SpriteMaterial;
    if (mat.map !== e.tex) {
      mat.map = e.tex;
      mat.needsUpdate = true;
    }
    const scale = 0.038 * (sizePx / 24);
    s.scale.set(scale * e.aspect, scale, 1);
    s.visible = true;
  }

  dispose() {
    for (const e of this.map.values()) e.tex.dispose();
    this.map.clear();
  }
}

/**
 * Material del terreno: geometría = DEM real; encima, detalle de regolito ILUSTRATIVO
 * procedural a dos escalas (grano fino cerca de la torre, variación mineral amplia en
 * la ladera) en metros del terreno, como relieve de normales y matiz de gris. Cada
 * escala se apaga cuando un píxel cubre más que su longitud de onda (sin parpadeo ni
 * ruido en el horizonte). También oscurece el contacto de las patas con el suelo.
 * No añade cráteres, rocas ni desplazamientos: la superficie medida no se altera.
 */
export function regolithMaterial(): THREE.MeshStandardMaterial & { userData: { uniforms: { uTowerHalf: { value: number }; uDetail: { value: number } } } } {
  const uniforms = { uTowerHalf: { value: 0 }, uDetail: { value: 1 } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0, side: THREE.DoubleSide });
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vGround;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGround = position.xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vGround;
uniform float uTowerHalf;
uniform float uDetail;
float rgHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float rgNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(rgHash(i), rgHash(i + vec2(1.0, 0.0)), u.x), mix(rgHash(i + vec2(0.0, 1.0)), rgHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float rgFbm(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int k = 0; k < 4; k++) { s += a * rgNoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.0; a *= 0.5; }
  return s;
}
float rgC(float x) { return clamp((x - 0.47) * 2.6, -1.0, 1.0); }  // contraste del fbm (que se agrupa en ~0,47)
// Relieve de presentación (m) a tres escalas, cada una ya atenuada según el tamaño del píxel.
float rgHeight(vec2 p, float fMicro, float fFine, float fRip, float fMid) {
  return 0.010 * rgNoise(p * 9.0) * fMicro + 0.07 * rgFbm(p * 1.6) * fFine + 0.16 * rgFbm(p * 0.42 + 7.0) * fRip + 0.45 * rgFbm(p * 0.12) * fMid;
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float rgPx = max(length(fwidth(vGround)), 1e-4);            // metros por píxel
float rgMicro = (1.0 - smoothstep(0.012, 0.06, rgPx)) * uDetail; // grano ~10 cm (solo muy cerca)
float rgFine = (1.0 - smoothstep(0.05, 0.3, rgPx)) * uDetail;    // grano ~0,6 m
float rgRip = (1.0 - smoothstep(0.15, 1.2, rgPx)) * uDetail;     // ondulación ~2,5 m
float rgMid = (1.0 - smoothstep(0.6, 5.0, rgPx)) * uDetail;      // ondulación ~8 m
float rgBroad = rgC(rgFbm(vGround * 0.011));                     // manchas minerales ~90 m (siempre)
float rgM = rgC(rgFbm(vGround * 0.12));
float rgF = rgC(rgFbm(vGround * 1.6 + 31.0));
float rgU = rgNoise(vGround * 9.0) * 2.0 - 1.0;
diffuseColor.rgb *= 1.0 + 0.13 * rgBroad + 0.09 * rgM * rgMid + 0.12 * rgF * rgFine + 0.10 * rgU * rgMicro;
// Contacto de las patas: oscurecimiento suave junto a las 4 zapatas y bajo la torre.
if (uTowerHalf > 0.0) {
  vec2 q = abs(vGround) - vec2(uTowerHalf);
  float dLeg = length(q);
  float dIn = max(abs(vGround.x), abs(vGround.y)) - uTowerHalf;
  float ao = 0.42 * exp(-dLeg * dLeg / (0.35 + 0.06 * uTowerHalf)) + 0.18 * (1.0 - smoothstep(-uTowerHalf * 0.6, 0.6, dIn));
  diffuseColor.rgb *= 1.0 - ao;
}`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
{
  // Pendiente del relieve de presentación en METROS (diferencias finitas en el suelo), girada al espacio de vista.
  float e = 0.02;
  float h0 = rgHeight(vGround, rgMicro, rgFine, rgRip, rgMid);
  float gx = (rgHeight(vGround + vec2(e, 0.0), rgMicro, rgFine, rgRip, rgMid) - h0) / e;
  float gz = (rgHeight(vGround + vec2(0.0, e), rgMicro, rgFine, rgRip, rgMid) - h0) / e;
  vec3 tx = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vec3 tz = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  normal = normalize(normal - gx * tx - gz * tz);
}`,
      );
  };
  mat.customProgramCacheKey = () => "regolith-v2";
  return mat as ReturnType<typeof regolithMaterial>;
}

/** Fondo estelar en puntos (estrellas extraídas de NASA SVS 4851; dirección equirectangular). */
export function starPoints(dirs: Float32Array, rgba: Uint8Array, radius: number, pixelRatio: number): THREE.Points {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(dirs.length);
  for (let i = 0; i < dirs.length; i++) pos[i] = dirs[i] * radius;
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(rgba, 4, true));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: pixelRatio } },
    vertexShader: `attribute vec4 aColor; uniform float uPx; varying vec4 vC;
void main() { vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.3 + 2.6 * aColor.a) * uPx; }`,
    fragmentShader: `varying vec4 vC;
void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * (0.42 + 0.58 * vC.a);
  gl_FragColor = vec4(vC.rgb * a, a); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -10;
  return pts;
}
