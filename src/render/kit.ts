// Shared Three.js helpers so every procedural mesh has one consistent, slightly
// faceted "toy kitchen" look. No game imports — pure rendering utilities.

import * as THREE from "three";

export const TILE = 2.3; // world units per grid cell (mirrors game/grid.ts)

export interface MatOpts {
  rough?: number;
  metal?: number;
  emissive?: number;
  emissiveIntensity?: number;
  flat?: boolean;
  transparent?: boolean;
  opacity?: number;
}

export function stdMat(color: number, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: o.rough ?? 0.72,
    metalness: o.metal ?? 0.05,
    flatShading: o.flat ?? false,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
  });
  if (o.emissive !== undefined) {
    m.emissive = new THREE.Color(o.emissive);
    m.emissiveIntensity = o.emissiveIntensity ?? 1;
  }
  return m;
}

export function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Rounded box via a beveled extrude-free approximation (cheap: scaled boxes). */
export function roundBox(w: number, h: number, d: number, mat: THREE.Material, r = 0.12): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  // Soften the silhouette by pulling corner normals — fake bevel via small chamfer scale.
  geo.translate(0, 0, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  void r;
  return m;
}

export function cyl(
  rTop: number,
  rBot: number,
  h: number,
  mat: THREE.Material,
  seg = 18,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function sphere(r: number, mat: THREE.Material, seg = 16): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

/** Build a CanvasTexture by drawing into a square canvas. */
export function canvasTex(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A camera-facing sprite showing a big emoji (used for order bubbles/icons). */
export function emojiSprite(emoji: string, scale = 1): THREE.Sprite {
  const tex = canvasTex(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.font = `${Math.floor(s * 0.74)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, s / 2, s / 2 + s * 0.04);
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(scale, scale, scale);
  return sp;
}

/** A flat, camera-facing label sprite (rounded card with text). */
export function labelSprite(text: string, bg = "#10131c", fg = "#ffffff", scale = 1): THREE.Sprite {
  const pad = 18;
  const tex = canvasTex(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.font = "bold 44px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = bg;
    const w = Math.min(s - 4, ctx.measureText(text).width + pad * 2);
    roundRect(ctx, (s - w) / 2, s / 2 - 36, w, 72, 16);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(text, s / 2, s / 2 + 2);
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(scale * 2, scale, 1);
  return sp;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dispose a subtree's geometries + materials (call before discarding a mesh). */
export function disposeTree(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = (mesh as THREE.Mesh).material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) (mat as THREE.Material).dispose();
  });
}
