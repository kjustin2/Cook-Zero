// Procedural character rigs: the chef (Pip) and the diner's customers. Every rig
// is a tiny kawaii toy — an OVERSIZED round head on a chubby body, sparkly eyes,
// rosy cheeks and a sweet smile — built from squashed spheres. No game logic
// lives here; rigs expose update(dt, anim) for idle/walk bob, facing, emotion and
// a happy hop. All animation is phase-driven; no Date.now()/Math.random().

import * as THREE from "three";
import type { ChefLook, CustomerLook } from "../game/types";
import { box, cyl, group, sphere, stdMat } from "./kit";

function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  return obj;
}
function squash(mesh: THREE.Mesh, sy: number): THREE.Mesh {
  mesh.scale.y = sy;
  return mesh;
}

// Eye/glint materials are created PER RIG (not shared module singletons) so that
// disposing a departed customer's rig (disposeTree) can't dispose materials the
// persistent chef + remaining guests still reference.
function buildEye(x: number, y: number, z: number): THREE.Group {
  const eyeMat = stdMat(0x20202c, { rough: 0.18, metal: 0.15 });
  const glintMat = stdMat(0xffffff, { rough: 0.1, emissive: 0xffffff, emissiveIntensity: 0.45 });
  const ball = sphere(0.072, eyeMat, 14);
  const shine = at(sphere(0.03, glintMat, 8), -0.022, 0.026, 0.058);
  const spark = at(sphere(0.013, glintMat, 6), 0.028, -0.018, 0.058);
  const g = group(ball, shine, spark);
  g.position.set(x, y, z);
  return g;
}

const BLINK_PERIOD = 4.0;
const BLINK_DUR = 0.12;
const BLINK_SHUT = 0.1;
function blinkScale(t: number, phase: number): number {
  const local = (((t + phase) % BLINK_PERIOD) + BLINK_PERIOD) % BLINK_PERIOD;
  if (local >= BLINK_DUR) return 1;
  const k = Math.sin((local / BLINK_DUR) * Math.PI);
  return 1 - (1 - BLINK_SHUT) * k;
}

function buildSmile(mat: THREE.Material, r: number): THREE.Mesh {
  const geo = new THREE.TorusGeometry(r, r * 0.22, 8, 14, Math.PI);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.rotation.z = Math.PI;
  return m;
}

const SKIN = [0xffe0bd, 0xf6c9a0, 0xe8b07e, 0xc68642, 0x8d5524, 0x5c3a21];
const SHIRT = [0xffb3c1, 0xa5d8ff, 0xb2f2bb, 0xffec99, 0xd0bfff, 0xffd6a5, 0x99e9f2, 0xfcc2d7];
const HAIR = [0x3a2a1d, 0x4d3424, 0x6b4423, 0xb07a3d, 0xe0c178, 0x2a2a2e, 0xb0b6bd];
const pick = (p: number[], i: number): number => p[((i % p.length) + p.length) % p.length];

// ── CHEF (Pip) ───────────────────────────────────────────────────────────────

export interface ChefAnim {
  speed: number;
  face: number;
  carrying: boolean;
  cook: number; // 0..1 cook arm-pump
  fire: number; // 0..1 on-a-roll glow
  cheer: number; // 0..1 happy hop after a serve
}

export interface ChefRig {
  group: THREE.Group;
  update(dt: number, a: ChefAnim): void;
}

export function buildChef(opts: { grandma?: boolean; look?: ChefLook } = {}): ChefRig {
  const grandma = opts.grandma ?? false;
  // Look colours apply only to Pip (not grandma). Each field falls back to Pip's
  // exact current hardcoded colour, so an omitted look or field is a visual no-op.
  const look = grandma ? undefined : opts.look;
  const apronColor = grandma ? 0xff9ec7 : look?.apron ?? 0xf6f3ec;
  const accentColor = grandma ? 0xc94f86 : look?.accent ?? 0xff7a8a;
  const skin = grandma ? 0xf6c9a0 : look?.skin ?? 0xffd9b3;
  const hatColor = look?.hat ?? 0xfdfcf8;
  const hairColor = grandma ? 0xdfe3e8 : look?.hair ?? 0x6b4423;

  const bodyMat = stdMat(apronColor, { rough: 0.55, emissive: 0xff6a2a, emissiveIntensity: 0 });
  const skinMat = stdMat(skin, { rough: 0.6 });
  const accentMat = stdMat(accentColor, { rough: 0.5 });
  const whiteMat = stdMat(0xfdfcf8, { rough: 0.5 });
  const hatMat = stdMat(hatColor, { rough: 0.5 });
  const blushMat = stdMat(0xff9ea8, { rough: 0.85 });
  const mouthMat = stdMat(0xc4506a, { rough: 0.5 });
  const hairMat = stdMat(hairColor, { rough: 0.8 });

  const torso = at(squash(sphere(0.27, bodyMat, 16), 0.95), 0, 0.5, 0);
  torso.scale.x = 0.92;
  torso.scale.z = 0.82;
  const apronFront = at(squash(sphere(0.2, whiteMat, 14), 1.0), 0, 0.47, 0.2);
  apronFront.scale.z = 0.4;
  const apronTie = at(box(0.42, 0.07, 0.18, accentMat), 0, 0.45, 0);
  const scarf = at(squash(cyl(0.15, 0.2, 0.1, accentMat, 16), 1), 0, 0.72, 0.02);

  const head = at(sphere(0.42, skinMat, 20), 0, 1.06, 0);
  head.scale.y = 0.96;
  const eyeL = buildEye(-0.16, 1.04, 0.35);
  const eyeR = buildEye(0.16, 1.04, 0.35);
  const blushL = at(squash(sphere(0.07, blushMat, 10), 0.62), -0.26, 0.96, 0.32);
  const blushR = at(squash(sphere(0.07, blushMat, 10), 0.62), 0.26, 0.96, 0.32);
  const smile = at(buildSmile(mouthMat, 0.07), 0, 0.93, 0.39);

  let hat: THREE.Group;
  if (grandma) {
    const bun = at(squash(sphere(0.22, hairMat, 14), 0.8), 0, 1.4, -0.05);
    const cap = at(squash(sphere(0.44, hairMat, 16), 0.5), 0, 1.2, -0.02);
    hat = group(cap, bun);
  } else {
    const stalk = at(cyl(0.3, 0.36, 0.22, hatMat, 18), 0, 1.46, 0);
    const puff = at(squash(sphere(0.4, hatMat, 18), 0.92), 0, 1.66, 0);
    hat = group(stalk, puff);
  }

  const armL = at(squash(sphere(0.1, skinMat, 10), 1.5), -0.32, 0.54, 0);
  const armR = at(squash(sphere(0.1, skinMat, 10), 1.5), 0.32, 0.54, 0);
  const legL = at(cyl(0.09, 0.11, 0.2, accentMat, 12), -0.12, 0.12, 0);
  const legR = at(cyl(0.09, 0.11, 0.2, accentMat, 12), 0.12, 0.12, 0);

  const body = group(torso, apronFront, apronTie, scarf, head, eyeL, eyeR, blushL, blushR, smile, hat, armL, armR, legL, legR);
  const armRestY = armL.position.y;

  let blinkT = 0;
  let idleT = 0;
  let walkT = 0;
  let moving = 0;
  const BLINK_PHASE = 0.7;
  const IDLE_PHASE = 1.7;

  function update(dt: number, a: ChefAnim): void {
    blinkT += dt;
    idleT += dt;
    const eyeY = blinkScale(blinkT, BLINK_PHASE);
    eyeL.scale.y = eyeY;
    eyeR.scale.y = eyeY;

    const target = Math.min(1, a.speed / 5);
    moving += (target - moving) * Math.min(1, dt * 8);
    walkT += dt * (6 + a.speed * 0.7);
    const idle = 1 - moving;

    body.rotation.y = a.face;
    const swing = Math.sin(walkT) * moving;
    const swingOpp = Math.sin(walkT + Math.PI) * moving;
    legL.rotation.x = swing * 0.5;
    legR.rotation.x = swingOpp * 0.5;

    const sway = Math.sin(idleT * 1.4 + IDLE_PHASE);
    body.rotation.z = sway * 0.035 * idle;
    const tiltWave = Math.sin(idleT * 0.55 + IDLE_PHASE * 1.3);
    head.rotation.z = tiltWave * tiltWave * tiltWave * 0.07 * idle;

    const bob = Math.abs(Math.sin(walkT)) * 0.06 * moving;
    body.position.y = bob + a.cheer * Math.abs(Math.sin(idleT * 16)) * 0.18;

    const stretch = Math.sin(walkT) * 0.08 * moving + a.cheer * 0.1;
    torso.scale.y = 0.95 * (1 + stretch);
    torso.scale.x = 0.92 * (1 - stretch * 0.6);
    torso.scale.z = 0.82 * (1 - stretch * 0.6);

    const cook = Math.max(0, Math.min(1, a.cook));
    body.rotation.x = cook * 0.12;
    if (cook > 0.01) {
      const pump = Math.sin(idleT * 32);
      armL.position.set(-0.22, armRestY + 0.16 + pump * 0.14 * cook, 0.24);
      armR.position.set(0.22, armRestY + 0.16 - pump * 0.14 * cook, 0.24);
      body.position.y += Math.abs(Math.sin(idleT * 32)) * 0.025 * cook;
    } else if (a.carrying) {
      armL.position.set(-0.24, armRestY + 0.14, 0.2);
      armR.position.set(0.24, armRestY + 0.14, 0.2);
    } else {
      const jiggle = Math.sin(idleT * 2.1 + IDLE_PHASE) * 0.018 * idle;
      armL.position.set(-0.32, armRestY + swingOpp * 0.05 + jiggle, swingOpp * 0.08);
      armR.position.set(0.32, armRestY + swing * 0.05 - jiggle, swing * 0.08);
    }

    void a.fire; // no chef "on a roll" glow — the combo is celebrated by UI juice only
  }

  return { group: body, update };
}

// ── CUSTOMER ─────────────────────────────────────────────────────────────────

export interface CustomerAnim {
  walking: boolean;
  served: boolean;
  mood: number; // 0 sad .. 1 happy
  face: number;
  hop: number; // 0..1 happy hop
}

export interface CustomerRig {
  group: THREE.Group;
  update(dt: number, a: CustomerAnim): void;
}

export function buildCustomer(look: CustomerLook): CustomerRig {
  const skinColor = pick(SKIN, Math.floor(look.hue * SKIN.length));
  const shirtColor = pick(SHIRT, look.body);
  const hairColor = pick(HAIR, look.hair);

  const bodyMat = stdMat(shirtColor, { rough: 0.7, emissive: 0xff2a2a, emissiveIntensity: 0 });
  const bodyBase = new THREE.Color(shirtColor);
  const sadColor = new THREE.Color(0x9fb0c4);
  const skinMat = stdMat(skinColor, { rough: 0.58 });
  const hairMat = stdMat(hairColor, { rough: 0.78 });
  const mouthMat = stdMat(0xc4506a, { rough: 0.5 });
  const blushMat = stdMat(0xff9ea8, { rough: 0.85 });

  const torso = at(squash(sphere(0.26, bodyMat, 16), 1.0), 0, 0.48, 0);
  torso.scale.x = 0.92;
  torso.scale.z = 0.8;
  const collar = at(squash(cyl(0.13, 0.17, 0.07, stdMat(0xf6f2e9, { rough: 0.6 }), 14), 1), 0, 0.68, 0.02);

  const head = at(sphere(0.41, skinMat, 20), 0, 1.04, 0);
  head.scale.y = 0.96;
  const hairCap = at(squash(sphere(0.43, hairMat, 16), 0.66), 0, 1.16, -0.04);
  const tuftSide = (look.hair % 2 === 0 ? 1 : -1) * 0.14;
  const tuft = at(squash(sphere(0.16, hairMat, 12), 0.85), tuftSide, 1.32, 0.16);

  const eyeL = buildEye(-0.15, 1.02, 0.34);
  const eyeR = buildEye(0.15, 1.02, 0.34);
  const blushL = at(squash(sphere(0.068, blushMat, 10), 0.62), -0.25, 0.94, 0.31);
  const blushR = at(squash(sphere(0.068, blushMat, 10), 0.62), 0.25, 0.94, 0.31);
  const mouth = at(buildSmile(mouthMat, 0.06), 0, 0.91, 0.38);
  const browL = at(box(0.08, 0.018, 0.02, hairMat), -0.15, 1.16, 0.34);
  const browR = at(box(0.08, 0.018, 0.02, hairMat), 0.15, 1.16, 0.34);

  const armL = at(squash(sphere(0.09, skinMat, 10), 1.5), -0.3, 0.52, 0);
  const armR = at(squash(sphere(0.09, skinMat, 10), 1.5), 0.3, 0.52, 0);
  const pantsMat = stdMat(0x6b6b86, { rough: 0.7 });
  const legL = at(cyl(0.08, 0.1, 0.18, pantsMat, 12), -0.11, 0.11, 0);
  const legR = at(cyl(0.08, 0.1, 0.18, pantsMat, 12), 0.11, 0.11, 0);

  const parts: THREE.Object3D[] = [torso, collar, head, hairCap, tuft, eyeL, eyeR, blushL, blushR, mouth, browL, browR, armL, armR, legL, legR];
  if (look.hat) {
    const beanieMat = stdMat(pick(SHIRT, look.body + 3), { rough: 0.7 });
    const beanie = at(squash(sphere(0.43, beanieMat, 16), 0.78), 0, 1.22, -0.02);
    const pom = at(sphere(0.09, stdMat(0xffffff, { rough: 0.75 }), 10), 0, 1.46, -0.02);
    parts.push(beanie, pom);
  }

  const body = group(...parts);
  const tmpColor = new THREE.Color();
  const browRestY = browL.position.y;
  const armRestY = armL.position.y;
  const SEAT_LIFT = 0.4;
  let lift = 0;
  let blinkT = 0;
  let idleT = 0;
  let walkT = 0;
  const blinkPhase = (look.body * 0.83 + look.hair * 1.37) % BLINK_PERIOD;
  const idlePhase = (look.body * 1.61 + look.hair * 0.97) % (Math.PI * 2);
  const hopPhase = (look.body * 1.3 + look.hair * 2.1) % 7.0;
  const eyeGlints: THREE.Object3D[] = [eyeL.children[1], eyeL.children[2], eyeR.children[1], eyeR.children[2]];

  function update(dt: number, a: CustomerAnim): void {
    idleT += dt;
    blinkT += dt;
    walkT += dt * 9;
    const seated = !a.walking;
    body.rotation.y = a.face;

    const eyeY = a.served ? 0.12 : blinkScale(blinkT, blinkPhase);
    eyeL.scale.y = eyeY;
    eyeR.scale.y = eyeY;
    for (const g of eyeGlints) g.visible = !a.served;

    lift += ((seated ? SEAT_LIFT : 0) - lift) * Math.min(1, dt * 6);

    if (a.walking) {
      const swing = Math.sin(walkT);
      legL.rotation.x = swing * 0.6;
      legR.rotation.x = -swing * 0.6;
      armL.position.set(-0.3, armRestY - swing * 0.05, -swing * 0.07);
      armR.position.set(0.3, armRestY + swing * 0.05, swing * 0.07);
      body.position.y = lift + Math.abs(swing) * 0.05;
      body.rotation.z = 0;
      const stretch = swing * 0.05;
      torso.scale.y = 1.0 * (1 + stretch);
      torso.scale.x = 0.92 * (1 - stretch * 0.6);
      torso.scale.z = 0.8 * (1 - stretch * 0.6);
    } else {
      const calm = Math.max(0, Math.min(1, a.mood));
      legL.rotation.x = 0.55;
      legR.rotation.x = 0.55;
      armL.position.set(-0.3, armRestY, 0);
      armR.position.set(0.3, armRestY, 0);
      const hopLocal = (((idleT + hopPhase) % 7.0) + 7.0) % 7.0;
      const idleHop = hopLocal < 0.45 ? Math.sin((hopLocal / 0.45) * Math.PI) * 0.04 * calm : 0;
      const amp = a.served ? 0.11 : 0.028;
      body.position.y = lift + Math.abs(Math.sin(idleT * 2)) * amp + idleHop + a.hop * 0.16;
      body.rotation.z = Math.sin(idleT) * 0.03 + Math.sin(idleT * 1.1 + idlePhase) * 0.022 * calm;
      head.rotation.y = Math.sin(idleT * 0.6 + idlePhase) * 0.18 * calm;
      const stretch = Math.sin(idleT * 2) * (a.served ? 0.12 : 0.05);
      torso.scale.y = 1.0 * (1 + stretch);
      torso.scale.x = 0.92 * (1 - stretch * 0.6);
      torso.scale.z = 0.8 * (1 - stretch * 0.6);
    }

    // Emotion: lerp shirt toward grey-blue + pout as mood drops (sad, not angry).
    const sad = 1 - Math.max(0, Math.min(1, a.mood));
    bodyMat.color.copy(tmpColor.copy(bodyBase).lerp(sadColor, sad * 0.4));
    browL.rotation.z = sad * 0.5;
    browR.rotation.z = -sad * 0.5;
    browL.position.y = browRestY + sad * 0.02;
    browR.position.y = browRestY + sad * 0.02;
    mouth.rotation.x = a.served ? 0 : sad * Math.PI;
  }

  return { group: body, update };
}
