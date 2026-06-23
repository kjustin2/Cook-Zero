// The diner pets — procedural, kawaii animal friends that wander the floor: a
// CORGI (long low body, big ears), a KITTY (sleek, triangle ears, swishy tail)
// and a BUNNY (round, tall floppy ears, big hops). Each is recoloured from the
// chosen PetLook (body / belly markings / accent). Pure rendering; the caller
// drives it with update(dt, anim). Phase-driven animation — no Date/Math.random.

import * as THREE from "three";
import type { PetLook } from "../game/types";
import { box, cyl, group, sphere, stdMat } from "./kit";

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}
function squash(m: THREE.Mesh, sy: number): THREE.Mesh {
  m.scale.y = sy;
  return m;
}

export interface PetAnim {
  speed: number;
  face: number;
  happy: number;
  wag: number;
  hop: number;
}

export interface PetRig {
  group: THREE.Group;
  update(dt: number, a: PetAnim): void;
}

const DARK = 0x241a18;

// ── Corgi ─────────────────────────────────────────────────────────────────────

function buildCorgi(look: PetLook): PetRig {
  const tan = stdMat(look.body, { rough: 0.7 });
  const cream = stdMat(look.belly, { rough: 0.7 });
  const dark = stdMat(DARK, { rough: 0.4, metal: 0.1 });
  const pink = stdMat(look.accent, { rough: 0.6 });
  const glint = stdMat(0xffffff, { rough: 0.1 });

  const torso = at(sphere(0.42, tan, 16), 0, 0.42, -0.05);
  torso.scale.set(0.62, 0.55, 1.05);
  const belly = at(sphere(0.4, cream, 14), 0, 0.32, 0.0);
  belly.scale.set(0.5, 0.4, 0.95);
  const rump = at(squash(sphere(0.34, tan, 14), 0.95), 0, 0.44, -0.5);

  const head = at(sphere(0.34, tan, 16), 0, 0.62, 0.62);
  const cheekL = at(sphere(0.18, cream, 12), -0.16, 0.5, 0.78);
  const cheekR = at(sphere(0.18, cream, 12), 0.16, 0.5, 0.78);
  const snout = at(sphere(0.13, cream, 12), 0, 0.54, 0.92);
  const nose = at(sphere(0.06, dark, 10), 0, 0.58, 1.0);
  const blaze = at(squash(sphere(0.1, cream, 10), 1.6), 0, 0.78, 0.84);

  const eyeL = at(sphere(0.05, dark, 10), -0.13, 0.66, 0.88);
  const eyeR = at(sphere(0.05, dark, 10), 0.13, 0.66, 0.88);
  const shineL = at(sphere(0.02, glint, 8), -0.15, 0.69, 0.92);
  const shineR = at(sphere(0.02, glint, 8), 0.11, 0.69, 0.92);
  const tongue = at(squash(sphere(0.05, pink, 8), 0.6), 0, 0.46, 0.96);

  const earL = new THREE.Group();
  earL.add(cyl(0.001, 0.13, 0.3, tan, 8));
  const earInL = cyl(0.001, 0.08, 0.22, pink, 8);
  earInL.position.set(0, 0.0, 0.04);
  earL.add(earInL);
  at(earL, -0.18, 0.92, 0.56);
  earL.rotation.z = 0.25;
  const earR = earL.clone();
  at(earR, 0.18, 0.92, 0.56);
  earR.rotation.z = -0.25;

  const legGeoY = 0.24;
  const mkLeg = (x: number, z: number) => at(cyl(0.09, 0.1, legGeoY, cream, 10), x, legGeoY / 2, z);
  const legFL = mkLeg(-0.2, 0.42);
  const legFR = mkLeg(0.2, 0.42);
  const legBL = mkLeg(-0.2, -0.42);
  const legBR = mkLeg(0.2, -0.42);

  const tail = new THREE.Group();
  tail.add(at(squash(sphere(0.16, tan, 12), 1.5), 0, 0.18, 0), at(sphere(0.13, cream, 12), 0, 0.36, 0));
  at(tail, 0, 0.5, -0.62);

  const g = group(torso, belly, rump, head, cheekL, cheekR, snout, nose, blaze,
    eyeL, eyeR, shineL, shineR, tongue, earL, earR, legFL, legFR, legBL, legBR, tail);

  let legT = 0;
  function update(dt: number, a: PetAnim): void {
    legT += dt * (2 + a.speed * 2.2);
    g.rotation.y = a.face;
    const trot = Math.sin(legT) * Math.min(1, a.speed / 2.5);
    legFL.rotation.x = trot * 0.6; legBR.rotation.x = trot * 0.6;
    legFR.rotation.x = -trot * 0.6; legBL.rotation.x = -trot * 0.6;
    tail.rotation.z = Math.sin(a.wag) * (0.4 + a.happy * 0.5);
    tail.rotation.x = -0.3;
    earL.rotation.x = -0.15 * a.happy; earR.rotation.x = -0.15 * a.happy;
    const bob = Math.abs(Math.sin(legT)) * 0.05 * Math.min(1, a.speed / 2);
    g.position.y = bob + a.hop * Math.abs(Math.sin(a.wag * 2)) * 0.22;
    head.position.y = 0.62 + Math.sin(legT * 0.8) * 0.02;
  }
  return { group: g, update };
}

// ── Kitty ─────────────────────────────────────────────────────────────────────

function buildCat(look: PetLook): PetRig {
  const fur = stdMat(look.body, { rough: 0.72 });
  const cream = stdMat(look.belly, { rough: 0.72 });
  const dark = stdMat(DARK, { rough: 0.4, metal: 0.1 });
  const pink = stdMat(look.accent, { rough: 0.6 });
  const glint = stdMat(0xffffff, { rough: 0.1 });

  // Sleek sitting body.
  const haunch = at(squash(sphere(0.36, fur, 16), 1.05), 0, 0.36, -0.18);
  haunch.scale.x = 0.8;
  const torso = at(sphere(0.3, fur, 16), 0, 0.5, 0.08);
  torso.scale.set(0.7, 0.9, 0.66);
  const belly = at(squash(sphere(0.2, cream, 12), 1.1), 0, 0.4, 0.26);
  belly.scale.x = 0.6;

  const head = at(sphere(0.3, fur, 16), 0, 0.86, 0.18);
  const muzzle = at(squash(sphere(0.14, cream, 12), 0.8), 0, 0.78, 0.4);
  const nose = at(squash(sphere(0.04, pink, 8), 0.7), 0, 0.8, 0.48);
  const eyeL = at(sphere(0.05, dark, 10), -0.12, 0.9, 0.42);
  const eyeR = at(sphere(0.05, dark, 10), 0.12, 0.9, 0.42);
  const shineL = at(sphere(0.018, glint, 8), -0.13, 0.93, 0.46);
  const shineR = at(sphere(0.018, glint, 8), 0.11, 0.93, 0.46);

  // Triangle ears: cones, accent inner.
  const mkEar = (sx: number) => {
    const e = new THREE.Group();
    e.add(cyl(0.001, 0.12, 0.26, fur, 4));
    const inner = cyl(0.001, 0.07, 0.18, pink, 4);
    inner.position.z = 0.03;
    e.add(inner);
    at(e, sx * 0.16, 1.12, 0.12);
    e.rotation.z = sx * 0.18;
    return e;
  };
  const earL = mkEar(-1), earR = mkEar(1);

  // Whiskers.
  const whisk: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) for (const dy of [-0.03, 0.03]) {
    const w = box(0.22, 0.006, 0.006, cream);
    w.position.set(sx * 0.2, 0.78 + dy, 0.42);
    w.rotation.y = sx * 0.3;
    whisk.push(w);
  }

  const legGeoY = 0.18;
  const mkLeg = (x: number, z: number) => at(cyl(0.07, 0.08, legGeoY, cream, 10), x, legGeoY / 2, z);
  const legFL = at(cyl(0.07, 0.08, 0.3, fur, 10), -0.14, 0.15, 0.34);
  const legFR = at(cyl(0.07, 0.08, 0.3, fur, 10), 0.14, 0.15, 0.34);
  const pawFL = at(sphere(0.08, cream, 10), -0.14, 0.04, 0.42);
  const pawFR = at(sphere(0.08, cream, 10), 0.14, 0.04, 0.42);
  const legBL = mkLeg(-0.2, -0.32);
  const legBR = mkLeg(0.2, -0.32);

  // Long swishy tail (segmented).
  const tail = new THREE.Group();
  let prevY = 0;
  for (let i = 0; i < 4; i++) {
    const seg = at(sphere(0.1 - i * 0.012, i === 3 ? cream : fur, 10), 0, prevY, -i * 0.12);
    tail.add(seg);
    prevY += 0.06;
  }
  at(tail, 0, 0.36, -0.5);

  const g = group(haunch, torso, belly, head, muzzle, nose, eyeL, eyeR, shineL, shineR,
    earL, earR, ...whisk, legFL, legFR, pawFL, pawFR, legBL, legBR, tail);

  let legT = 0;
  function update(dt: number, a: PetAnim): void {
    legT += dt * (2 + a.speed * 2.2);
    g.rotation.y = a.face;
    const trot = Math.sin(legT) * Math.min(1, a.speed / 2.5);
    legFL.rotation.x = trot * 0.5; legBR.rotation.x = trot * 0.5;
    legFR.rotation.x = -trot * 0.5; legBL.rotation.x = -trot * 0.5;
    // Tail swishes (slow when calm, faster/curlier when happy).
    tail.rotation.z = Math.sin(a.wag * 0.8) * (0.5 + a.happy * 0.6);
    tail.rotation.x = -0.4 - a.happy * 0.2;
    earL.rotation.x = -0.12 * a.happy; earR.rotation.x = -0.12 * a.happy;
    const bob = Math.abs(Math.sin(legT)) * 0.04 * Math.min(1, a.speed / 2);
    g.position.y = bob + a.hop * Math.abs(Math.sin(a.wag * 2)) * 0.2;
    head.rotation.z = Math.sin(legT * 0.5) * 0.04;
  }
  return { group: g, update };
}

// ── Bunny ─────────────────────────────────────────────────────────────────────

function buildBunny(look: PetLook): PetRig {
  const fur = stdMat(look.body, { rough: 0.78 });
  const cream = stdMat(look.belly, { rough: 0.78 });
  const dark = stdMat(DARK, { rough: 0.4, metal: 0.1 });
  const pink = stdMat(look.accent, { rough: 0.6 });
  const glint = stdMat(0xffffff, { rough: 0.1 });

  // Round, plump body.
  const torso = at(sphere(0.36, fur, 16), 0, 0.4, -0.04);
  torso.scale.set(0.85, 0.95, 0.95);
  const belly = at(squash(sphere(0.24, cream, 12), 1.1), 0, 0.34, 0.22);
  belly.scale.x = 0.7;

  const head = at(sphere(0.3, fur, 16), 0, 0.78, 0.18);
  const cheekL = at(sphere(0.13, cream, 10), -0.16, 0.7, 0.34);
  const cheekR = at(sphere(0.13, cream, 10), 0.16, 0.7, 0.34);
  const nose = at(squash(sphere(0.045, pink, 8), 0.7), 0, 0.74, 0.46);
  const eyeL = at(sphere(0.055, dark, 10), -0.12, 0.82, 0.4);
  const eyeR = at(sphere(0.055, dark, 10), 0.12, 0.82, 0.4);
  const shineL = at(sphere(0.02, glint, 8), -0.13, 0.85, 0.44);
  const shineR = at(sphere(0.02, glint, 8), 0.11, 0.85, 0.44);

  // Tall floppy ears (long capsules, accent inner).
  const mkEar = (sx: number) => {
    const e = new THREE.Group();
    const outer = at(squash(sphere(0.12, fur, 10), 2.4), 0, 0.28, 0);
    outer.scale.x = 0.55;
    const inner = at(squash(sphere(0.08, pink, 10), 2.4), 0, 0.3, 0.04);
    inner.scale.x = 0.45;
    e.add(outer, inner);
    at(e, sx * 0.12, 1.0, 0.06);
    e.rotation.z = sx * 0.22;
    return e;
  };
  const earL = mkEar(-1), earR = mkEar(1);

  const mkLeg = (x: number, z: number) => at(cyl(0.08, 0.09, 0.16, cream, 10), x, 0.08, z);
  const legFL = at(sphere(0.09, cream, 10), -0.16, 0.08, 0.28);
  const legFR = at(sphere(0.09, cream, 10), 0.16, 0.08, 0.28);
  const footL = at(squash(sphere(0.12, cream, 10), 0.5), -0.18, 0.04, -0.18);
  footL.scale.z = 1.6;
  const footR = at(squash(sphere(0.12, cream, 10), 0.5), 0.18, 0.04, -0.18);
  footR.scale.z = 1.6;
  void mkLeg;

  const tail = at(sphere(0.13, cream, 12), 0, 0.42, -0.4);

  const g = group(torso, belly, head, cheekL, cheekR, nose, eyeL, eyeR, shineL, shineR,
    earL, earR, legFL, legFR, footL, footR, tail);

  let legT = 0;
  function update(dt: number, a: PetAnim): void {
    legT += dt * (3 + a.speed * 2.6);
    g.rotation.y = a.face;
    // Bunnies bound — a springy vertical hop tied to movement.
    const spring = Math.abs(Math.sin(legT)) * Math.min(1, a.speed / 2);
    g.position.y = spring * 0.14 + a.hop * Math.abs(Math.sin(a.wag * 2)) * 0.28;
    // Ears flop with the bounce + perk when happy.
    const flop = Math.sin(legT) * 0.18 * Math.min(1, a.speed / 2);
    earL.rotation.x = 0.1 - 0.3 * a.happy + flop;
    earR.rotation.x = 0.1 - 0.3 * a.happy - flop;
    legFL.position.y = 0.08 + spring * 0.04; legFR.position.y = 0.08 + spring * 0.04;
    head.position.y = 0.78 + Math.sin(legT) * 0.02;
  }
  return { group: g, update };
}

/** Build the chosen pet (kind + colours from the PetLook). */
export function buildPet(look: PetLook): PetRig {
  if (look.kind === "cat") return buildCat(look);
  if (look.kind === "bunny") return buildBunny(look);
  return buildCorgi(look);
}
