// Procedural food meshes — plump, glossy, kawaii. Two jobs: (1) build the little
// item the chef carries / a guest is served, and (2) build the LIVE cooking mesh
// that sits in a grill/fryer slot and browns continuously from the slot timer
// (the food cooking IS the timing UI). No game logic here.

import * as THREE from "three";
import type { CookSlot, FoodId, Quality } from "../game/types";
import { box, cyl, group, sphere, stdMat } from "./kit";

const R = 0.55;

function at<T extends THREE.Object3D>(m: T, x: number, y: number, z: number): T {
  m.position.set(x, y, z);
  return m;
}
function squash(m: THREE.Mesh, sy: number): THREE.Mesh {
  m.scale.y = sy;
  return m;
}

function cuteFace(s: number, gap: number): THREE.Group {
  const eyeMat = stdMat(0x2a1d22, { rough: 0.3, flat: true });
  const sparkMat = stdMat(0xffffff, { rough: 0.1, emissive: 0xffffff, emissiveIntensity: 0.5 });
  const mouthMat = stdMat(0x6b3a3f, { rough: 0.35, flat: true });
  const f = new THREE.Group();
  for (const sign of [-1, 1]) {
    f.add(at(sphere(s * 0.5, eyeMat, 8), sign * gap, s * 0.55, 0.02));
    f.add(at(sphere(s * 0.16, sparkMat, 6), sign * gap + s * 0.16, s * 0.78, 0.04));
  }
  for (let k = -1; k <= 1; k++) {
    const seg = at(box(s * 0.34, s * 0.12, s * 0.1, mouthMat), k * s * 0.32, -s * 0.5 - Math.abs(k) * s * 0.18, 0.02);
    seg.rotation.z = -k * 0.5;
    f.add(seg);
  }
  return f;
}

function sparkleMesh(size: number): THREE.Mesh {
  // A bright matte star (no emissive glow) — reads as a clear "ready!" sparkle.
  const mat = stdMat(0xfff4d0, { rough: 0.25, metal: 0.05 });
  const star = box(size, size * 0.28, size * 0.28, mat);
  star.rotation.z = Math.PI / 4;
  return star;
}

// ── Raw ingredients (carried before cooking) ────────────────────────────────

function buildRaw(food: FoodId): THREE.Group {
  if (food === "burger") {
    const mat = stdMat(0xd98f8f, { rough: 0.4, metal: 0.04 });
    const disc = at(cyl(R * 0.94, R * 0.98, 0.13, mat, 22), 0, 0.065, 0);
    const dome = at(squash(sphere(R * 0.92, mat, 14), 0.22), 0, 0.13, 0);
    return group(disc, dome);
  }
  if (food === "fries") {
    const mat = stdMat(0xe9d6a8, { rough: 0.6 });
    const skin = stdMat(0xc8a063, { rough: 0.7 });
    const potato = at(squash(sphere(R * 0.7, mat, 14), 0.7), 0, R * 0.5, 0);
    potato.scale.x = 1.3;
    const patch = at(squash(sphere(R * 0.2, skin, 8), 0.6), R * 0.3, R * 0.6, R * 0.1);
    return group(potato, patch);
  }
  // hotdog raw → a pink sausage
  const mat = stdMat(0xe09a8a, { rough: 0.5, metal: 0.03 });
  const link = at(cyl(R * 0.34, R * 0.34, R * 1.5, mat, 16), 0, R * 0.34, 0);
  link.rotation.z = Math.PI / 2;
  const cap1 = at(sphere(R * 0.34, mat, 12), R * 0.75, R * 0.34, 0);
  const cap2 = at(sphere(R * 0.34, mat, 12), -R * 0.75, R * 0.34, 0);
  return group(link, cap1, cap2);
}

// ── Live cooking meshes (tinted each frame from the slot timer) ──────────────

interface CookTint {
  body: THREE.MeshStandardMaterial;
  sheen: THREE.MeshStandardMaterial;
  sear?: THREE.MeshStandardMaterial;
  doneSpark?: THREE.Object3D; // a "ready!" sparkle shown in the perfect window
  rawC: THREE.Color;
  cookC: THREE.Color;
  charC: THREE.Color;
}

/** A little "ta-da, I'm ready!" sparkle that pops above food in the perfect window. */
function doneSparkle(y: number): THREE.Group {
  const g = group(sparkleMesh(0.16));
  const s2 = sparkleMesh(0.16);
  s2.rotation.z = Math.PI / 4;
  g.add(s2);
  g.position.set(0, y, 0);
  g.visible = false;
  return g;
}

function buildCookingPatty(): THREE.Group {
  const h = 0.14;
  const body = stdMat(0xe88a8a, { rough: 0.42, metal: 0.05, emissive: 0xff7a2a, emissiveIntensity: 0 });
  const disc = at(cyl(R * 0.9, R * 0.98, h, body, 22), 0, h / 2, 0);
  const dome = at(squash(sphere(R * 0.92, body, 16), 0.3), 0, h, 0);
  const sear = stdMat(0x2a1408, { rough: 0.7, transparent: true, opacity: 0 });
  const marks: THREE.Object3D[] = [];
  for (const dz of [0, R * 0.34, -R * 0.34]) {
    const m = at(box(R * 1.5, 0.03, R * 0.12, sear), 0, h + 0.045, dz);
    m.rotation.y = Math.PI / 7;
    marks.push(m);
  }
  const sheen = stdMat(0xffe2bc, { rough: 0.12, metal: 0.1, emissive: 0xffd9a0, emissiveIntensity: 0, transparent: true, opacity: 0 });
  const sheenM = at(squash(sphere(R * 0.26, sheen, 10), 0.3), -R * 0.18, h + 0.1, -R * 0.14);
  const face = cuteFace(0.05, 0.07);
  face.position.set(0, h + 0.02, R * 0.72);
  face.rotation.x = -0.35;
  const spark = doneSparkle(h + 0.34);
  const g = group(disc, dome, ...marks, sheenM, face, spark);
  g.userData.cook = { body, sheen, sear, doneSpark: spark, rawC: new THREE.Color(0xe88a8a), cookC: new THREE.Color(0x9a5a30), charC: new THREE.Color(0x241208) } as CookTint;
  return g;
}

function buildCookingFries(): THREE.Group {
  const carton = stdMat(0xf24a4a, { rough: 0.32, metal: 0.03 });
  const rimMat = stdMat(0xfdf6ec, { rough: 0.4 });
  const cartonH = 0.26;
  const c = at(cyl(R * 0.52, R * 0.34, cartonH, carton, 16), 0, cartonH / 2, 0);
  const rim = at(cyl(R * 0.56, R * 0.55, cartonH * 0.24, rimMat, 16), 0, cartonH * 0.9, 0);
  const fry = stdMat(0xe9d6a8, { rough: 0.36, metal: 0.03, emissive: 0xffa522, emissiveIntensity: 0 });
  const parts: THREE.Object3D[] = [c, rim];
  const fryH = 0.4;
  let i = 0;
  for (const cx of [-0.2, -0.06, 0.08, 0.2]) {
    for (const cz of [-0.1, 0.12]) {
      if (i >= 7) break;
      const f = box(0.062, fryH, 0.062, fry);
      at(f, cx * R, cartonH + fryH / 2 - 0.06, cz * R);
      f.rotation.z = cx * 0.6;
      f.rotation.x = cz * 0.7;
      parts.push(f);
      i++;
    }
  }
  const sheen = stdMat(0xfff4d0, { rough: 0.12, emissive: 0xffe9b0, emissiveIntensity: 0, transparent: true, opacity: 0 });
  parts.push(at(box(0.16, 0.05, 0.05, sheen), R * 0.3, cartonH + fryH * 0.7, R * 0.2));
  const face = cuteFace(0.045, 0.06);
  face.position.set(0, cartonH + 0.02, R * 0.5);
  const spark = doneSparkle(cartonH + fryH + 0.1);
  parts.push(face, spark);
  const g = group(...parts);
  g.userData.cook = { body: fry, sheen, doneSpark: spark, rawC: new THREE.Color(0xe9d6a8), cookC: new THREE.Color(0xe6a634), charC: new THREE.Color(0x7a4a16) } as CookTint;
  return g;
}

function buildCookingDog(): THREE.Group {
  const body = stdMat(0xe09a8a, { rough: 0.45, metal: 0.04, emissive: 0xff7a2a, emissiveIntensity: 0 });
  const link = at(cyl(R * 0.32, R * 0.32, R * 1.5, body, 16), 0, R * 0.34, 0);
  link.rotation.z = Math.PI / 2;
  const cap1 = at(sphere(R * 0.32, body, 12), R * 0.75, R * 0.34, 0);
  const cap2 = at(sphere(R * 0.32, body, 12), -R * 0.75, R * 0.34, 0);
  const sheen = stdMat(0xffe2bc, { rough: 0.12, emissive: 0xffd9a0, emissiveIntensity: 0, transparent: true, opacity: 0 });
  const sheenM = at(squash(sphere(R * 0.2, sheen, 8), 0.4), 0, R * 0.6, 0);
  const face = cuteFace(0.045, 0.06);
  face.position.set(0, R * 0.5, R * 0.78);
  const spark = doneSparkle(R * 0.85);
  const g = group(link, cap1, cap2, sheenM, face, spark);
  g.userData.cook = { body, sheen, doneSpark: spark, rawC: new THREE.Color(0xe88a78), cookC: new THREE.Color(0xb5642f), charC: new THREE.Color(0x3a1c0e) } as CookTint;
  return g;
}

export function buildCookingFood(food: FoodId): THREE.Group {
  if (food === "fries") return buildCookingFries();
  if (food === "hotdog") return buildCookingDog();
  return buildCookingPatty();
}

/** Drive a cooking mesh's colours from its slot timer. */
export function tintCooking(g: THREE.Group, slot: CookSlot): void {
  const ck = g.userData.cook as CookTint | undefined;
  if (!ck) return;
  const cook = Math.min(1, slot.t / Math.max(0.01, slot.crispT));
  ck.body.color.copy(ck.rawC).lerp(ck.cookC, cook);
  if (slot.burnT !== Infinity && slot.t > slot.crispT) {
    const over = Math.min(1, (slot.t - slot.crispT) / Math.max(0.01, slot.burnT - slot.crispT));
    ck.body.color.lerp(ck.charC, over * 0.85);
  }
  if (ck.sear) ck.sear.opacity = Math.min(0.9, cook * 1.2);
  // A soft white sheen highlight rides through the perfect window — no emissive
  // glow (so it never haloes), just a glossy wet-look pop.
  const inPerfect = slot.t >= slot.goldenT && slot.t < slot.crispT;
  const pf = inPerfect ? Math.sin(((slot.t - slot.goldenT) / Math.max(0.01, slot.crispT - slot.goldenT)) * Math.PI) : 0;
  ck.sheen.opacity = 0.3 * pf;
  ck.sheen.emissiveIntensity = 0;
  ck.body.emissiveIntensity = 0;
  // The "I'm ready!" sparkle pops the moment it's at least good, brightest at perfect.
  if (ck.doneSpark) {
    const ready = slot.t >= slot.readyT && slot.t < slot.burnT;
    ck.doneSpark.visible = ready;
    if (ready) {
      ck.doneSpark.rotation.y = slot.t * 3;
      ck.doneSpark.scale.setScalar(0.7 + 0.3 * Math.abs(Math.sin(slot.t * 6)) + pf * 0.4);
    }
  }
}

// ── Ready / served meshes ────────────────────────────────────────────────────

function buildBurger(q: Quality): THREE.Group {
  const perfect = q === "perfect";
  const bunMat = stdMat(0xeab867, { rough: 0.4, metal: 0.03 });
  const baseMat = stdMat(0xcf924f, { rough: 0.55 });
  const pattyColor = q === "crispy" ? 0x5a3318 : 0x9a5a30;
  // No emissive glow ever — a perfect patty just reads a touch glossier.
  const pattyMat = stdMat(pattyColor, { rough: perfect ? 0.28 : 0.34, metal: perfect ? 0.06 : 0 });
  const bottom = at(squash(sphere(R * 0.92, baseMat, 16), 0.4), 0, R * 0.18, 0);
  const patty = at(cyl(R * 0.95, R * 0.95, 0.14, pattyMat, 20), 0, R * 0.42, 0);
  const top = at(squash(sphere(R * 0.98, bunMat, 18), 0.66), 0, R * 0.7, 0);
  const seedMat = stdMat(0xfbeec2, { rough: 0.3 });
  const parts: THREE.Object3D[] = [bottom, patty, top];
  for (const [sx, sz] of [[0, 0], [0.34, 0.1], [-0.3, 0.16], [0.14, -0.32]] as [number, number][]) {
    parts.push(at(squash(sphere(0.036, seedMat, 8), 0.55), sx * R, R * 0.86 - (sx * sx + sz * sz) * 0.12, sz * R));
  }
  const face = cuteFace(0.07, 0.09);
  face.position.set(0, R * 0.72, R * 0.78);
  face.rotation.x = -0.3;
  parts.push(face);
  if (perfect) parts.push(at(sparkleMesh(0.16), R * 0.4, R * 1.0, R * 0.2)); // matte star, no glow
  return group(...parts);
}

function buildFriesReady(q: Quality): THREE.Group {
  const cartonMat = stdMat(0xf24a4a, { rough: 0.32, metal: 0.03 });
  const rimMat = stdMat(0xfdf6ec, { rough: 0.4 });
  const cartonH = 0.26;
  const carton = at(cyl(R * 0.52, R * 0.34, cartonH, cartonMat, 16), 0, cartonH / 2, 0);
  const rim = at(cyl(R * 0.56, R * 0.55, cartonH * 0.24, rimMat, 16), 0, cartonH * 0.9, 0);
  const gold = q === "perfect" ? 0xffcf4a : q === "crispy" ? 0xc78a2a : 0xe6a634;
  const fryMat = stdMat(gold, { rough: q === "perfect" ? 0.3 : 0.38 }); // no emissive glow
  const parts: THREE.Object3D[] = [carton, rim];
  const fryH = 0.4;
  let i = 0;
  for (const cx of [-0.2, -0.06, 0.08, 0.2]) {
    for (const cz of [-0.1, 0.12]) {
      if (i >= 7) break;
      const f = box(0.062, fryH, 0.062, fryMat);
      at(f, cx * R, cartonH + fryH / 2 - 0.06, cz * R);
      f.rotation.z = cx * 0.6;
      f.rotation.x = cz * 0.7;
      parts.push(f);
      i++;
    }
  }
  if (q === "perfect") parts.push(at(sparkleMesh(0.16), R * 0.34, cartonH + fryH * 0.7, R * 0.24));
  return group(...parts);
}

function buildHotdog(q: Quality): THREE.Group {
  const bunMat = stdMat(0xeab867, { rough: 0.42, metal: 0.02 });
  const dogMat = stdMat(q === "perfect" ? 0xb5642f : q === "crispy" ? 0x6e3a1c : 0xb5642f, { rough: q === "perfect" ? 0.3 : 0.4 }); // no emissive glow
  const bunL = at(cyl(R * 0.26, R * 0.26, R * 1.6, bunMat, 14), -R * 0.34, R * 0.24, 0);
  bunL.rotation.z = Math.PI / 2;
  const bunR = at(cyl(R * 0.26, R * 0.26, R * 1.6, bunMat, 14), R * 0.34, R * 0.24, 0);
  bunR.rotation.z = Math.PI / 2;
  const dog = at(cyl(R * 0.26, R * 0.26, R * 1.7, dogMat, 14), 0, R * 0.44, 0);
  dog.rotation.z = Math.PI / 2;
  const capA = at(sphere(R * 0.26, dogMat, 10), R * 0.82, R * 0.44, 0);
  const capB = at(sphere(R * 0.26, dogMat, 10), -R * 0.82, R * 0.44, 0);
  const mustardMat = stdMat(0xffd23a, { rough: 0.3 });
  const parts: THREE.Object3D[] = [bunL, bunR, dog, capA, capB];
  for (let k = -2; k <= 2; k++) {
    parts.push(at(box(0.05, 0.05, R * 0.5, mustardMat), k * R * 0.32, R * 0.58, 0));
  }
  return group(...parts);
}

function buildDrink(): THREE.Group {
  const cupH = 0.5;
  const cupMat = stdMat(0xfafaff, { rough: 0.2, metal: 0.05 });
  const cup = at(cyl(R * 0.46, R * 0.34, cupH, cupMat, 22), 0, cupH / 2, 0);
  const band = at(cyl(R * 0.47, R * 0.44, cupH * 0.36, stdMat(0xff4d6d, { rough: 0.26 }), 22), 0, cupH * 0.42, 0);
  const lidMat = stdMat(0xeef1f7, { rough: 0.16, metal: 0.07 });
  const lid = at(cyl(R * 0.48, R * 0.47, 0.05, lidMat, 22), 0, cupH + 0.025, 0);
  const dome = at(squash(sphere(R * 0.43, lidMat, 16), 0.44), 0, cupH + 0.05, 0);
  const strawH = 0.4;
  const straw = at(cyl(0.03, 0.03, strawH, stdMat(0xff5a8a, { rough: 0.16 }), 10), R * 0.12, cupH + strawH / 2, 0);
  straw.rotation.z = 0.24;
  const face = cuteFace(0.07, 0.09);
  face.position.set(0, cupH * 0.34, R * 0.42);
  return group(cup, band, lid, dome, straw, face);
}

function buildIcecream(): THREE.Group {
  const coneMat = stdMat(0xd9a45a, { rough: 0.6 });
  const cone = at(cyl(R * 0.32, 0.02, R * 1.0, coneMat, 16), 0, R * 0.5, 0);
  const swirlMat = stdMat(0xfff0f5, { rough: 0.35 });
  const pinkMat = stdMat(0xffc4dd, { rough: 0.35 });
  const s1 = at(squash(sphere(R * 0.42, swirlMat, 14), 0.9), 0, R * 1.05, 0);
  const s2 = at(squash(sphere(R * 0.34, pinkMat, 14), 0.9), 0, R * 1.32, 0);
  const s3 = at(squash(sphere(R * 0.24, swirlMat, 12), 1.0), 0, R * 1.56, 0);
  const cherry = at(sphere(R * 0.12, stdMat(0xff3b5c, { rough: 0.25 }), 10), 0, R * 1.74, 0);
  const face = cuteFace(0.06, 0.08);
  face.position.set(0, R * 1.1, R * 0.34);
  return group(cone, s1, s2, s3, cherry, face);
}

function buildBurnt(): THREE.Group {
  const h = 0.16;
  const charMat = stdMat(0x171210, { rough: 1, metal: 0, flat: true });
  const blob = at(squash(sphere(R * 0.96, charMat, 12), 0.46), 0, h * 0.6, 0);
  blob.scale.x = 1.06;
  const lumpMat = stdMat(0x0d0a07, { rough: 1, flat: true });
  const parts: THREE.Object3D[] = [blob];
  for (const [lx, lz, ls] of [[0.3, 0.1, 0.32], [-0.28, -0.22, 0.26], [0.05, -0.3, 0.2]] as [number, number, number][]) {
    parts.push(at(squash(sphere(R * ls, lumpMat, 7), 0.5), R * lx, h * 0.72, R * lz));
  }
  const sadMat = stdMat(0x000000, { rough: 1, flat: true });
  parts.push(at(sphere(R * 0.07, sadMat, 6), -R * 0.22, h * 0.78, R * 0.42));
  parts.push(at(sphere(R * 0.07, sadMat, 6), R * 0.2, h * 0.74, R * 0.42));
  return group(...parts);
}

export function buildReadyFood(food: FoodId, q: Quality = "good"): THREE.Group {
  switch (food) {
    case "burger": return buildBurger(q);
    case "fries": return buildFriesReady(q);
    case "hotdog": return buildHotdog(q);
    case "drink": return buildDrink();
    case "icecream": return buildIcecream();
  }
}

/** Carried item mesh for the chef's hands (raw / ready / burnt). */
export function buildCarryMesh(carry: NonNullable<import("../game/types").Carry>): THREE.Group {
  if (carry.kind === "burnt") return buildBurnt();
  if (carry.kind === "raw") return buildRaw(carry.food);
  return buildReadyFood(carry.food, carry.quality);
}
