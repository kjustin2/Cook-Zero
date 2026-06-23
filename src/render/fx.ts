// Visual feedback: one pooled CPU particle cloud (sparks/steam/smoke/confetti),
// expanding ground rings, spinning coin/star sprites, floating hearts, and 3D
// text floaters ("YUMMY!"). Implements the game's Fx interface so gameplay code
// stays fully decoupled from Three.js. Everything is pooled — no per-frame alloc.

import * as THREE from "three";
import type { Fx } from "../game/ctx";
import type { Stage } from "./stage";
import { canvasTex } from "./kit";

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number; size: number;
  r: number; g: number; b: number;
  grav: number; drag: number;
}

interface CoinSprite {
  sp: THREE.Sprite;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number; spin: number; spinV: number;
  flip: boolean; base: number; active: boolean;
}

interface Floater {
  sp: THREE.Sprite;
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  x: number; y: number; z: number;
  life: number; max: number; pop: number; big: boolean; active: boolean;
}

const MAX_P = 1000;

function softTexture(): THREE.Texture {
  // A solid-core round dot with only a thin soft rim — reads as a crisp little
  // puff/confetto, NOT a glowing radial halo (the whole game is no-glow).
  return canvasTex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.62, "rgba(255,255,255,1)");
    g.addColorStop(0.82, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

function emojiTex(emoji: string): THREE.CanvasTexture {
  return canvasTex(96, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.font = `${Math.floor(s * 0.8)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, s / 2, s / 2 + s * 0.04);
  });
}

export class FxSystem implements Fx {
  private particles: P[] = [];
  private points: THREE.Points;
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private rings: Array<{ mesh: THREE.Mesh; t: number; life: number; active: boolean; r0: number; r1: number }> = [];
  private coinPool: CoinSprite[] = [];
  private floaters: Floater[] = [];
  private heartPool: CoinSprite[] = [];
  private coinTex: THREE.CanvasTexture;
  private starTex: THREE.CanvasTexture;
  private heartTex: THREE.CanvasTexture;

  constructor(scene: THREE.Scene, private stage: Stage) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_P * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX_P * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("size", new THREE.BufferAttribute(new Float32Array(MAX_P), 1).setUsage(THREE.DynamicDrawUsage));
    this.posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    this.colAttr = geo.getAttribute("color") as THREE.BufferAttribute;
    this.sizeAttr = geo.getAttribute("size") as THREE.BufferAttribute;
    geo.setDrawRange(0, 0);

    const mat = new THREE.PointsMaterial({
      // NORMAL blending (not additive) so sparks/steam read as cute little puffs
      // instead of stacking into a glowing "bulb of light" over the food/guests.
      size: 0.4, map: softTexture(), vertexColors: true,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending, sizeAttenuation: true,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = "attribute float size;\n" + shader.vertexShader.replace("uniform float size;", "");
    };
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    const ringTex = canvasTex(128, (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      ctx.strokeStyle = "rgba(255,255,255,1)";
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2 - 12, 0, Math.PI * 2);
      ctx.stroke();
    });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.NormalBlending }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, t: 0, life: 1, active: false, r0: 0.5, r1: 2 });
    }

    this.coinTex = emojiTex("🪙");
    this.starTex = emojiTex("⭐");
    this.heartTex = emojiTex("💖");
    const makeSpritePool = (tex: THREE.CanvasTexture, n: number, pool: CoinSprite[]) => {
      for (let i = 0; i < n; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        sp.visible = false;
        sp.scale.set(0.5, 0.5, 1);
        scene.add(sp);
        pool.push({ sp, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, spin: 0, spinV: 0, flip: true, base: 0.5, active: false });
      }
    };
    makeSpritePool(this.coinTex, 24, this.coinPool);
    makeSpritePool(this.heartTex, 16, this.heartPool);

    for (let i = 0; i < 18; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 160;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.visible = false;
      scene.add(sp);
      this.floaters.push({ sp, canvas, tex, x: 0, y: 0, z: 0, life: 0, max: 1, pop: 0, big: false, active: false });
    }
  }

  private spawn(p: P): void {
    if (this.particles.length >= MAX_P) this.particles.shift();
    this.particles.push(p);
  }

  private emit(x: number, z: number, count: number, color: number, opts: Partial<P> & { spread?: number; up?: number; y?: number } = {}): void {
    const c = new THREE.Color(color);
    const spread = opts.spread ?? 2.4;
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.3,
        y: (opts.y ?? 0.7) + Math.random() * 0.2,
        z: z + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * spread,
        vy: (opts.up ?? 1.6) + Math.random() * 1.4,
        vz: (Math.random() - 0.5) * spread,
        life: opts.max ?? 0.7, max: opts.max ?? 0.7, size: opts.size ?? 0.32,
        r: c.r, g: c.g, b: c.b, grav: opts.grav ?? 6, drag: opts.drag ?? 0.9,
      });
    }
  }

  // ── Fx interface ──
  float(text: string, x: number, z: number, opts?: { color?: string; big?: boolean }): void {
    const f = this.floaters.find((ff) => !ff.active);
    if (!f) return;
    const big = !!opts?.big;
    const c2 = f.canvas.getContext("2d")!;
    const W = f.canvas.width, H = f.canvas.height;
    c2.clearRect(0, 0, W, H);
    c2.textAlign = "center";
    c2.textBaseline = "middle";
    c2.lineJoin = "round";
    // Auto-shrink the font so longer labels ("PERFECT! ⭐") never clip the canvas.
    let fs = big ? 100 : 80;
    const maxW = W - 48;
    c2.font = `800 ${fs}px "Baloo 2", system-ui, sans-serif`;
    while (c2.measureText(text).width > maxW && fs > 26) {
      fs -= 4;
      c2.font = `800 ${fs}px "Baloo 2", system-ui, sans-serif`;
    }
    c2.lineWidth = Math.max(8, fs * 0.16);
    c2.strokeStyle = "rgba(40,20,10,0.85)";
    c2.strokeText(text, W / 2, H / 2);
    c2.fillStyle = opts?.color ?? "#fff4ea";
    c2.fillText(text, W / 2, H / 2);
    f.tex.needsUpdate = true;
    f.x = x;
    f.y = 1.7;
    f.z = z;
    f.big = big;
    f.life = big ? 1.5 : 1.1;
    f.max = f.life;
    f.pop = 0;
    f.active = true;
    f.sp.visible = true;
  }

  burst(x: number, z: number, color: number, count: number): void {
    this.emit(x, z, count, color, { spread: 1.7, up: 1.4, size: 0.2, max: 0.5 });
  }

  /** Remove every active particle / floater / coin / heart / ring at once. Used to
   *  "cut" cleanly to a debug scenario without stale FX from prior state lingering. */
  clear(): void {
    this.particles.length = 0;
    (this.points.geometry as THREE.BufferGeometry).setDrawRange(0, 0);
    for (const r of this.rings) { r.active = false; r.mesh.visible = false; }
    for (const c of this.coinPool) { c.active = false; c.sp.visible = false; }
    for (const c of this.heartPool) { c.active = false; c.sp.visible = false; }
    for (const f of this.floaters) { f.active = false; f.sp.visible = false; }
  }

  sizzle(x: number, z: number): void {
    this.emit(x, z, 1, 0xffb84a, { spread: 0.7, up: 1.1, size: 0.13, max: 0.45, grav: 3, y: 0.9 });
  }

  steam(x: number, z: number): void {
    this.spawn({
      x: x + (Math.random() - 0.5) * 0.22, y: 1.0, z: z + (Math.random() - 0.5) * 0.22,
      vx: (Math.random() - 0.5) * 0.25, vy: 1.2 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.25,
      life: 0.75, max: 0.75, size: 0.26, r: 0.45, g: 0.45, b: 0.5, grav: -0.5, drag: 0.96,
    });
  }

  sparkle(x: number, z: number): void {
    this.emit(x, z, 3, 0xffe680, { spread: 1.0, up: 1.4, size: 0.17, max: 0.55, grav: 2, y: 1.0 });
  }

  smoke(x: number, z: number): void {
    for (let i = 0; i < 3; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.3, y: 0.9, z: z + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 0.5, vy: 1.3 + Math.random(), vz: (Math.random() - 0.5) * 0.5,
        life: 1.2, max: 1.2, size: 0.5, r: 0.28, g: 0.28, b: 0.3, grav: -1.2, drag: 0.95,
      });
    }
  }

  trail(x: number, z: number): void {
    this.spawn({
      x: x + (Math.random() - 0.5) * 0.25, y: 0.32 + Math.random() * 0.35, z: z + (Math.random() - 0.5) * 0.25,
      vx: (Math.random() - 0.5) * 0.4, vy: 0.12, vz: (Math.random() - 0.5) * 0.4,
      life: 0.26, max: 0.26, size: 0.16, r: 0.6, g: 0.75, b: 0.95, grav: 0.4, drag: 0.9,
    });
  }

  coins(x: number, z: number, n = 4): void {
    this.emit(x, z, 4, 0xffe27a, { spread: 1.4, up: 1.8, size: 0.18, max: 0.55, grav: 7 });
    let spawned = 0;
    for (const c of this.coinPool) {
      if (spawned >= n) break;
      if (c.active) continue;
      const star = spawned % 2 === 1;
      const mat = c.sp.material as THREE.SpriteMaterial;
      mat.map = star ? this.starTex : this.coinTex;
      mat.rotation = 0;
      mat.opacity = 1;
      c.flip = !star;
      c.base = star ? 0.58 : 0.5;
      c.x = x + (Math.random() - 0.5) * 0.6;
      c.y = 0.9;
      c.z = z + (Math.random() - 0.5) * 0.6;
      c.vx = (Math.random() - 0.5) * 1.7;
      c.vy = 2.7 + Math.random() * 1.5;
      c.vz = (Math.random() - 0.5) * 1.3 - 0.4;
      c.life = 0.95 + Math.random() * 0.35;
      c.max = c.life;
      c.spin = 0;
      c.spinV = (star ? 6 : 13) * (0.75 + Math.random() * 0.5);
      c.active = true;
      c.sp.visible = true;
      spawned++;
    }
  }

  hearts(x: number, z: number): void {
    let spawned = 0;
    for (const c of this.heartPool) {
      if (spawned >= 3) break;
      if (c.active) continue;
      const mat = c.sp.material as THREE.SpriteMaterial;
      mat.opacity = 1;
      c.base = 0.5 + Math.random() * 0.18;
      c.x = x + (Math.random() - 0.5) * 0.8;
      c.y = 1.4;
      c.z = z + (Math.random() - 0.5) * 0.4;
      c.vx = (Math.random() - 0.5) * 0.7;
      c.vy = 1.6 + Math.random() * 0.7;
      c.vz = (Math.random() - 0.5) * 0.4;
      c.life = 1.1 + Math.random() * 0.4;
      c.max = c.life;
      c.flip = false;
      c.spinV = 0;
      c.spin = 0;
      c.active = true;
      c.sp.visible = true;
      spawned++;
    }
  }

  ring(x: number, z: number, color: number): void {
    const r = this.rings.find((rr) => !rr.active);
    if (!r) return;
    r.active = true;
    r.t = 0;
    r.life = 0.5;
    r.r0 = 0.4;
    r.r1 = 1.9;
    r.mesh.visible = true;
    r.mesh.position.set(x, 0.06, z);
    (r.mesh.material as THREE.MeshBasicMaterial).color = new THREE.Color(color);
  }

  confetti(): void {
    for (let i = 0; i < 150; i++) {
      const c = new THREE.Color().setHSL(Math.random(), 0.9, 0.62);
      this.spawn({
        x: (Math.random() - 0.5) * 18, y: 12 + Math.random() * 4, z: (Math.random() - 0.5) * 12 + 1,
        vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, vz: (Math.random() - 0.5) * 2,
        life: 3 + Math.random() * 2, max: 5, size: 0.36, r: c.r, g: c.g, b: c.b, grav: 3, drag: 0.98,
      });
    }
  }

  shake(amount: number): void {
    this.stage.punch(amount);
  }

  punch(amount: number): void {
    this.stage.punchZoom(amount);
  }

  // ── Frame update ──
  update(dt: number): void {
    const pos = this.posAttr.array as Float32Array;
    const col = this.colAttr.array as Float32Array;
    const sz = this.sizeAttr.array as Float32Array;
    // Compact survivors in place — no per-frame array allocation.
    const arr = this.particles;
    let n = 0;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vx *= p.drag;
      p.vz *= p.drag;
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.04) { p.y = 0.04; p.vy *= -0.3; }
      const f = p.life / p.max;
      pos[n * 3] = p.x;
      pos[n * 3 + 1] = p.y;
      pos[n * 3 + 2] = p.z;
      col[n * 3] = p.r * f;
      col[n * 3 + 1] = p.g * f;
      col[n * 3 + 2] = p.b * f;
      sz[n] = p.size * (0.4 + f) * 60;
      arr[n] = p;
      n++;
    }
    arr.length = n;
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    (this.points.geometry as THREE.BufferGeometry).setDrawRange(0, n);

    for (const r of this.rings) {
      if (!r.active) continue;
      r.t += dt;
      const f = r.t / r.life;
      if (f >= 1) { r.active = false; r.mesh.visible = false; continue; }
      const rad = r.r0 + (r.r1 - r.r0) * f;
      r.mesh.scale.set(rad * 2, rad * 2, 1);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - f) * 0.36;
    }

    const stepSprite = (c: CoinSprite, grav: number) => {
      if (!c.active) return;
      c.life -= dt;
      if (c.life <= 0) { c.active = false; c.sp.visible = false; return; }
      c.vy -= grav * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      if (c.flip && c.y < 0.3) { c.y = 0.3; c.vy *= -0.35; c.vx *= 0.7; c.vz *= 0.7; }
      c.spin += c.spinV * dt;
      c.sp.position.set(c.x, c.y, c.z);
      const mat = c.sp.material as THREE.SpriteMaterial;
      mat.opacity = Math.min(1, c.life / 0.35);
      if (c.flip) {
        const sx = Math.max(0.12, Math.abs(Math.cos(c.spin)));
        c.sp.scale.set(c.base * sx, c.base, 1);
      } else {
        c.sp.scale.set(c.base, c.base, 1);
      }
    };
    for (const c of this.coinPool) stepSprite(c, 7);
    for (const c of this.heartPool) stepSprite(c, 1.4);

    for (const f of this.floaters) {
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) { f.active = false; f.sp.visible = false; continue; }
      if (f.pop < 1) f.pop = Math.min(1, f.pop + dt * 6);
      f.y += dt * 1.1;
      const mat = f.sp.material as THREE.SpriteMaterial;
      mat.opacity = Math.min(1, f.life / 0.4);
      const base = f.big ? 2.6 : 2.0;
      const pop = 0.7 + 0.3 * f.pop;
      f.sp.position.set(f.x, f.y, f.z);
      f.sp.scale.set(base * pop, base * 0.31 * pop, 1);
    }
  }
}
