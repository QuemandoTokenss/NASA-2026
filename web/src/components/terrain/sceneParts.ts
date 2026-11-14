/**
 * Piezas de dibujo de la escena 3D de Engineer: torre ilustrativa en celosía,
 * brújula en el suelo, visual con grosor y etiquetas de texto. Son GRÁFICOS:
 * la altura del remate es la altura real del observador del escenario
 * (0, 2 o 10 m); la forma de la torre es estilizada y no es un diseño estructural.
 */
import * as THREE from "three";

/** Escena: x = este, y = arriba, z = −norte. */
export const azimuthDir = (azDeg: number) => {
  const a = (azDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
};

/** Barra cilíndrica entre dos puntos (radios distintos en cada extremo). */
export function strut(a: THREE.Vector3, b: THREE.Vector3, rA: number, rB: number, material: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(rB, rA, len, 8, 1, false);
  const m = new THREE.Mesh(geo, material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/**
 * Torre de vigilancia en celosía: 4 patas que se estrechan, anillos horizontales,
 * diagonales cruzadas en cada cara, plataforma y barandilla. El remate (ojo del
 * observador) queda EXACTAMENTE a `heightM` sobre el suelo local.
 */
export function latticeTower(heightM: number, color: number): THREE.Group {
  const g = new THREE.Group();
  if (heightM <= 0) return g;
  // Proporciones continuas con la altura (el deslizador va de 0 a 30 m).
  const base = Math.min(3.2, 0.55 + heightM * 0.11);
  const top = base * 0.42;
  const r = Math.min(0.12, 0.022 + heightM * 0.0045);
  // Metal mate que recibe la luz: las caras se dibujan con el sombreado de la escena.
  const steel = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.5, emissive: 0x1c222c });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.95, metalness: 0 });
  const levels = Math.max(2, Math.round(heightM / 2.2));
  const deckY = heightM - Math.min(0.4, 0.12 + heightM * 0.02);
  const half = (y: number) => base + (top - base) * (y / deckY);
  const corner = (y: number, sx: number, sz: number) => new THREE.Vector3(sx * half(y), y, sz * half(y));
  const signs: Array<[number, number]> = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  for (const [sx, sz] of signs) {
    // Pata que entra en el terreno y zapata de apoyo.
    g.add(strut(corner(-0.25, sx, sz), corner(deckY, sx, sz), r * 1.9, r * 1.4, steel));
    const foot = new THREE.Mesh(new THREE.BoxGeometry(r * 9, Math.max(0.12, r * 3), r * 9), concrete);
    foot.position.copy(corner(0, sx, sz)).setY(Math.max(0.06, r * 1.5) - 0.05);
    g.add(foot);
  }
  for (let k = 0; k <= levels; k++) {
    const y0 = (deckY * k) / levels;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = signs[i];
      const [bx, bz] = signs[(i + 1) % 4];
      if (k > 0) g.add(strut(corner(y0, ax, az), corner(y0, bx, bz), r, r, steel));
      if (k < levels) {
        const y1 = (deckY * (k + 1)) / levels;
        g.add(strut(corner(y0, ax, az), corner(y1, bx, bz), r * 0.8, r * 0.8, steel));
        g.add(strut(corner(y0, bx, bz), corner(y1, ax, az), r * 0.8, r * 0.8, steel));
      }
    }
  }
  // Plataforma y barandilla.
  const deckHalf = top + Math.min(0.45, 0.15 + heightM * 0.02);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(deckHalf * 2, Math.max(0.05, r * 1.2), deckHalf * 2), steel);
  deck.position.y = deckY;
  g.add(deck);
  const railY = deckY + Math.min(0.9, 0.18 + heightM * 0.03);
  const rc = (sx: number, sz: number, y: number) => new THREE.Vector3(sx * deckHalf, y, sz * deckHalf);
  for (let i = 0; i < 4; i++) {
    const [ax, az] = signs[i];
    const [bx, bz] = signs[(i + 1) % 4];
    g.add(strut(rc(ax, az, deckY), rc(ax, az, railY), r * 0.7, r * 0.7, steel));
    g.add(strut(rc(ax, az, railY), rc(bx, bz, railY), r * 0.7, r * 0.7, steel));
  }
  return g;
}

/** Etiqueta de texto de tamaño constante en pantalla. */
export function textSprite(text: string, color: string, sizePx = 26): THREE.Sprite {
  const ratio = 2;
  const font = `600 ${sizePx * ratio}px Inter, system-ui, sans-serif`;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = font;
  const padX = 14 * ratio;
  const padY = 8 * ratio;
  const w = Math.ceil(ctx.measureText(text).width) + 2 * padX;
  const h = sizePx * ratio + 2 * padY;
  c.width = w;
  c.height = h;
  ctx.font = font;
  ctx.fillStyle = "rgba(5, 9, 18, 0.86)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 * ratio;
  const rr = 10 * ratio;
  ctx.beginPath();
  ctx.roundRect(1.5 * ratio, 1.5 * ratio, w - 3 * ratio, h - 3 * ratio, rr);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e8eef8";
  ctx.textBaseline = "middle";
  ctx.fillText(text, padX, h / 2 + ratio);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true });
  const s = new THREE.Sprite(mat);
  const scale = 0.032 * (sizePx / 26);
  s.scale.set((scale * w) / h, scale, 1);
  s.center.set(0.5, 0);
  s.renderOrder = 20;
  return s;
}

/** Brújula en el suelo: círculo, marca y letra del norte, cardinales y cuña hasta el azimut consultado. */
export function groundCompass(radius: number, azimuthDeg: number | null, lift: number): THREE.Group {
  const g = new THREE.Group();
  const ringMat = new THREE.LineBasicMaterial({ color: 0xe8eef8, transparent: true, opacity: 0.85, depthTest: false });
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 96; i++) pts.push(azimuthDir((i / 96) * 360).multiplyScalar(radius).setY(lift));
  const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
  ring.renderOrder = 5;
  g.add(ring);
  for (const [az, len] of [[0, 0.38], [90, 0.16], [180, 0.16], [270, 0.16]] as const) {
    const a = azimuthDir(az).multiplyScalar(radius).setY(lift);
    const b = azimuthDir(az).multiplyScalar(radius * (1 + len)).setY(lift);
    const tick = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), az === 0 ? new THREE.LineBasicMaterial({ color: 0xff5b5b, depthTest: false }) : ringMat);
    tick.renderOrder = 5;
    g.add(tick);
  }
  const n = textSprite("N", "#ff5b5b", 22);
  n.position.copy(azimuthDir(0).multiplyScalar(radius * 1.45).setY(lift));
  g.add(n);
  if (azimuthDeg !== null) {
    // Arco desde el norte hasta el azimut (sentido horario) y radio hacia la dirección de mirada.
    const violet = new THREE.LineBasicMaterial({ color: 0xa78bfa, depthTest: false });
    const arc: THREE.Vector3[] = [];
    const steps = Math.max(2, Math.ceil(azimuthDeg / 3));
    for (let i = 0; i <= steps; i++) arc.push(azimuthDir((azimuthDeg * i) / steps).multiplyScalar(radius * 0.6).setY(lift));
    const arcLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arc), violet);
    arcLine.renderOrder = 6;
    g.add(arcLine);
    const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, lift, 0), azimuthDir(azimuthDeg).multiplyScalar(radius).setY(lift)]), violet);
    ray.renderOrder = 6;
    g.add(ray);
  }
  return g;
}
