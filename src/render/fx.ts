// Visual feedback system: a CPU-driven particle cloud (sparks, smoke, coins,
// confetti), expanding ground rings, and floating text (pushed into G.floats for
// the SceneView to render). Implements the game's Fx interface so gameplay code
// stays decoupled from Three.js.

import * as THREE from "three";
import type { Fx } from "../game/ctx";
import type { GameState } from "../game/types";
import type { Stage } from "./stage";
import { canvasTex } from "./kit";

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number;
  r: number; g: number; b: number;
  grav: number; drag: number;
}

const MAX_P = 900;

/** A little spinning coin or star sprite that pops up on a serve and falls. */
interface CoinSprite {
  sp: THREE.Sprite;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  spin: number; spinV: number;
  flip: boolean; // true = coin (edge-flip), false = star (in-plane spin)
  base: number;
  active: boolean;
}

function softTexture(): THREE.Texture {
  return canvasTex(64, (ctx, s) => {
    const grd = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.4, "rgba(255,255,255,0.8)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd;
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
  private coinTex: THREE.CanvasTexture;
  private starTex: THREE.CanvasTexture;

  constructor(
    scene: THREE.Scene,
    private stage: Stage,
    private G: GameState,
  ) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_P * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX_P * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("size", new THREE.BufferAttribute(new Float32Array(MAX_P), 1).setUsage(THREE.DynamicDrawUsage));
    this.posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    this.colAttr = geo.getAttribute("color") as THREE.BufferAttribute;
    this.sizeAttr = geo.getAttribute("size") as THREE.BufferAttribute;
    geo.setDrawRange(0, 0);

    const mat = new THREE.PointsMaterial({
      size: 0.4,
      map: softTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    // Per-particle size via a tiny onBeforeCompile tweak.
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = "attribute float size;\n" + shader.vertexShader.replace(
        "gl_PointSize = size;",
        "gl_PointSize = size;",
      ).replace("uniform float size;", "");
    };
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    const ringTex = canvasTex(128, (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      ctx.strokeStyle = "rgba(255,255,255,1)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2 - 12, 0, Math.PI * 2);
      ctx.stroke();
    });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, t: 0, life: 1, active: false, r0: 0.5, r1: 2 });
    }

    // Pool of spinning coin/star sprites for serve payouts.
    this.coinTex = emojiTex("🪙");
    this.starTex = emojiTex("⭐");
    for (let i = 0; i < 24; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.coinTex, transparent: true, depthWrite: false }));
      sp.visible = false;
      sp.scale.set(0.5, 0.5, 1);
      scene.add(sp);
      this.coinPool.push({ sp, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, spin: 0, spinV: 0, flip: true, base: 0.5, active: false });
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
        life: opts.max ?? 0.7,
        max: opts.max ?? 0.7,
        size: opts.size ?? 0.32,
        r: c.r, g: c.g, b: c.b,
        grav: opts.grav ?? 6,
        drag: opts.drag ?? 0.9,
      });
    }
  }

  // ── Fx interface ──
  float(text: string, x: number, z: number, opts?: { color?: string; big?: boolean }): void {
    this.G.floats.push({ text, x, z, t: 0, life: opts?.big ? 1.5 : 1.1, color: opts?.color ?? "#ffffff", big: !!opts?.big });
    if (this.G.floats.length > 40) this.G.floats.shift();
  }

  burst(x: number, z: number, color: number, count: number): void {
    this.emit(x, z, count, color, { spread: 1.7, up: 1.3, size: 0.19, max: 0.48 });
  }

  sizzle(x: number, z: number): void {
    this.emit(x, z, 1, 0xffb84a, { spread: 0.7, up: 1.1, size: 0.13, max: 0.45, grav: 3, y: 0.9 });
  }

  smoke(x: number, z: number): void {
    for (let i = 0; i < 3; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.3, y: 0.9, z: z + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 0.5, vy: 1.3 + Math.random(), vz: (Math.random() - 0.5) * 0.5,
        life: 1.2, max: 1.2, size: 0.5, r: 0.25, g: 0.25, b: 0.28, grav: -1.2, drag: 0.95,
      });
    }
  }

  coins(x: number, z: number): void {
    // A few gold sparkles…
    this.emit(x, z, 4, 0xffe27a, { spread: 1.4, up: 1.8, size: 0.18, max: 0.55, grav: 7 });
    // …plus little spinning coins + stars that pop up and tumble down.
    let spawned = 0;
    for (const c of this.coinPool) {
      if (spawned >= 6) break;
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

  steam(x: number, z: number): void {
    // Faint, wispy, dim grey (the cloud is additive, so keep it subtle).
    this.spawn({
      x: x + (Math.random() - 0.5) * 0.22, y: 1.0, z: z + (Math.random() - 0.5) * 0.22,
      vx: (Math.random() - 0.5) * 0.25, vy: 1.2 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.25,
      life: 0.75, max: 0.75, size: 0.26, r: 0.4, g: 0.4, b: 0.45, grav: -0.5, drag: 0.96,
    });
  }

  sparkle(x: number, z: number): void {
    this.emit(x, z, 3, 0xffe680, { spread: 1.0, up: 1.4, size: 0.17, max: 0.55, grav: 2, y: 1.0 });
  }

  trail(x: number, z: number): void {
    // A single faint puff at the feet — just enough to read the dash.
    this.spawn({
      x: x + (Math.random() - 0.5) * 0.25, y: 0.32 + Math.random() * 0.35, z: z + (Math.random() - 0.5) * 0.25,
      vx: (Math.random() - 0.5) * 0.4, vy: 0.12, vz: (Math.random() - 0.5) * 0.4,
      life: 0.26, max: 0.26, size: 0.16, r: 0.42, g: 0.52, b: 0.74, grav: 0.4, drag: 0.9,
    });
  }

  ring(x: number, z: number, color: number): void {
    const r = this.rings.find((rr) => !rr.active);
    if (!r) return;
    r.active = true;
    r.t = 0;
    r.life = 0.5;
    r.r0 = 0.4;
    r.r1 = 1.7; // smaller, gentler — no big bright burst
    r.mesh.visible = true;
    r.mesh.position.set(x, 0.06, z);
    (r.mesh.material as THREE.MeshBasicMaterial).color = new THREE.Color(color);
  }

  confetti(): void {
    for (let i = 0; i < 120; i++) {
      const c = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
      this.spawn({
        x: (Math.random() - 0.5) * 16, y: 12 + Math.random() * 4, z: (Math.random() - 0.5) * 10 + 2,
        vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, vz: (Math.random() - 0.5) * 2,
        life: 3 + Math.random() * 2, max: 5, size: 0.34, r: c.r, g: c.g, b: c.b, grav: 3, drag: 0.98,
      });
    }
  }

  shake(amount: number): void {
    this.stage.punch(amount);
    this.stage.punchZoom(amount * 0.5);
  }

  // ── Frame update ──
  update(dt: number): void {
    const alive: P[] = [];
    const pos = this.posAttr.array as Float32Array;
    const col = this.colAttr.array as Float32Array;
    const sz = this.sizeAttr.array as Float32Array;
    let n = 0;
    for (const p of this.particles) {
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
      n++;
      alive.push(p);
    }
    this.particles = alive;
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
      // Keep rings faint so the additive blend never reads as a flash of light.
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - f) * 0.34;
    }

    for (const c of this.coinPool) {
      if (!c.active) continue;
      c.life -= dt;
      if (c.life <= 0) { c.active = false; c.sp.visible = false; continue; }
      c.vy -= 7 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      if (c.y < 0.3) { c.y = 0.3; c.vy *= -0.35; c.vx *= 0.7; c.vz *= 0.7; }
      c.spin += c.spinV * dt;
      c.sp.position.set(c.x, c.y, c.z);
      const mat = c.sp.material as THREE.SpriteMaterial;
      mat.opacity = Math.min(1, c.life / 0.35);
      if (c.flip) {
        const sx = Math.max(0.12, Math.abs(Math.cos(c.spin))); // coin flipping edge-on
        c.sp.scale.set(c.base * sx, c.base, 1);
      } else {
        mat.rotation = c.spin; // star spinning in-plane
        c.sp.scale.set(c.base, c.base, 1);
      }
    }
  }
}
