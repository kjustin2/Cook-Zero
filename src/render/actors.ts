// Procedural character rigs for the arcade kitchen: the player chef, the hired
// helper chef, and the customers who queue at the counter. Every rig is a tiny
// kawaii toy figurine — an OVERSIZED round head on a chubby little body with
// stubby arms, sparkly eyes, rosy cheeks and a sweet smile.
// No game logic lives here — rigs expose only an `update(dt, anim)` that drives
// idle/walk bobbing, facing, "on fire" glow (chef) and anger pout (customer).
// All animation is phase-driven from the caller; no Date.now()/Math.random().

import * as THREE from "three";
import { box, cyl, group, sphere, stdMat } from "./kit";

// One shared glossy white material for all eye catch-lights (no per-eye alloc).
const GLINT_MAT = stdMat(0xffffff, { rough: 0.1, emissive: 0xffffff, emissiveIntensity: 0.45 });
// Shared dark, glossy eye material (faintly metal so the big eyes read wet).
const EYE_MAT = stdMat(0x20202c, { rough: 0.18, metal: 0.15 });

/** Place an object and return it (keeps construction terse). */
function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  return obj;
}

/** Scale a sphere into a soft dome/disc/egg. */
function squash(mesh: THREE.Mesh, sy: number): THREE.Mesh {
  mesh.scale.y = sy;
  return mesh;
}

// A big round dark eye with a large white catch-light plus a tiny second
// sparkle, so it looks glossy and alive. Returned as a small group to place.
function buildEye(x: number, y: number, z: number): THREE.Group {
  const ball = sphere(0.072, EYE_MAT, 14);
  const shine = at(sphere(0.03, GLINT_MAT, 8), -0.022, 0.026, 0.058);
  const spark = at(sphere(0.013, GLINT_MAT, 6), 0.028, -0.018, 0.058);
  const g = group(ball, shine, spark);
  g.position.set(x, y, z);
  return g;
}

// Blink scheduler: given a rig's accumulated time + a per-rig phase offset,
// return the eye vertical scale (1 = open, ~0.1 = shut). Eyes squash closed for
// a brief BLINK_DUR every BLINK_PERIOD seconds, fully reopening in between so
// the rig never lingers half-blinked. Pure function of time — no randomness.
const BLINK_PERIOD = 4.0; // seconds between blinks
const BLINK_DUR = 0.12; // how long a blink lasts
const BLINK_SHUT = 0.1; // eye Y-scale at the bottom of a blink

function blinkScale(t: number, phase: number): number {
  // Position within this rig's blink cycle (phase staggers the crowd).
  const local = ((t + phase) % BLINK_PERIOD + BLINK_PERIOD) % BLINK_PERIOD;
  if (local >= BLINK_DUR) return 1; // open the rest of the cycle
  // Smooth close-then-open over the blink: 0→shut→1 via a sine half-wave.
  const k = Math.sin((local / BLINK_DUR) * Math.PI); // 0 → 1 → 0
  return 1 - (1 - BLINK_SHUT) * k;
}

// A sweet upturned smile from a thin torus arc (the bottom slice of a ring).
function buildSmile(mat: THREE.Material, r: number): THREE.Mesh {
  // Half-torus opening upward = a curved grin.
  const geo = new THREE.TorusGeometry(r, r * 0.22, 8, 14, Math.PI);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.rotation.z = Math.PI; // flip so the arc smiles upward
  return m;
}

// --- palettes (indexed by modulo so any int is safe) ----------------------

const SKIN: number[] = [
  0xffe0bd, 0xf6c9a0, 0xe8b07e, 0xc68642, 0x8d5524, 0x5c3a21,
];

// Soft pastels for maximum cuteness.
const SHIRT: number[] = [
  0xffb3c1, 0xa5d8ff, 0xb2f2bb, 0xffec99, 0xd0bfff, 0xffd6a5, 0x99e9f2, 0xfcc2d7,
];

const HAIR: number[] = [
  0x3a2a1d, 0x4d3424, 0x6b4423, 0xb07a3d, 0xe0c178, 0x2a2a2e, 0xb0b6bd,
];

function pick(palette: number[], i: number): number {
  return palette[((i % palette.length) + palette.length) % palette.length];
}

// ===========================================================================
// CHEF
// ===========================================================================

export interface ChefRig {
  group: THREE.Group;
  update(dt: number, a: { walk: number; face: number; fire: number; carrying: boolean }): void;
}

export function buildChef(opts: { helper?: boolean } = {}): ChefRig {
  const helper = opts.helper ?? false;

  // Uniform colours: helper wears blue, the player wears a creamy-white apron.
  const apronColor = helper ? 0x6ba8ff : 0xf6f3ec;
  const accentColor = helper ? 0x3a6fd0 : 0xff7a8a; // bandana band / neckerchief
  const skin = 0xffd9b3;

  // The body/apron material is the one that glows when "on fire" — keep it so
  // update() can lerp its emissive intensity. Warm emissive preset, zeroed out.
  const bodyMat = stdMat(apronColor, {
    rough: 0.55,
    emissive: 0xff6a2a,
    emissiveIntensity: 0,
  });
  const skinMat = stdMat(skin, { rough: 0.6 });
  const accentMat = stdMat(accentColor, { rough: 0.5 });
  const whiteMat = stdMat(0xfdfcf8, { rough: 0.5 });
  const blushMat = stdMat(0xff9ea8, { rough: 0.85 });
  const mouthMat = stdMat(0xc4506a, { rough: 0.5 });

  // Tiny chubby body — a rounded plump barrel, deliberately small so the head
  // dominates. Sits low; little legs poke out beneath.
  const torso = at(squash(sphere(0.27, bodyMat, 16), 0.95), 0, 0.5, 0);
  torso.scale.x = 0.92;
  torso.scale.z = 0.82;

  // Apron front: a soft white panel down the belly with a little waist tie.
  const apronFront = at(squash(sphere(0.2, whiteMat, 14), 1.0), 0, 0.47, 0.2);
  apronFront.scale.z = 0.4;
  const apronTie = at(box(0.42, 0.07, 0.18, accentMat), 0, 0.45, 0);

  // Neckerchief tied at the throat, just under the big head (with a little knot).
  const scarf = at(squash(cyl(0.15, 0.2, 0.1, accentMat, 16), 1), 0, 0.72, 0.02);

  // HEAD — huge round chibi sphere (≈45% of the ~1.4 total height).
  const head = at(sphere(0.42, skinMat, 20), 0, 1.06, 0);
  head.scale.y = 0.96;

  // Face: big sparkly eyes set wide and low, rosy cheeks, a sweet smile.
  const eyeL = buildEye(-0.16, 1.04, 0.35);
  const eyeR = buildEye(0.16, 1.04, 0.35);
  const blushL = at(squash(sphere(0.07, blushMat, 10), 0.62), -0.26, 0.96, 0.32);
  const blushR = at(squash(sphere(0.07, blushMat, 10), 0.62), 0.26, 0.96, 0.32);
  const smile = at(buildSmile(mouthMat, 0.07), 0, 0.93, 0.39);

  // Hat: tall puffy white toque (player) or a cute blue cap (helper).
  let hat: THREE.Group;
  if (helper) {
    const band = at(cyl(0.4, 0.42, 0.14, accentMat, 18), 0, 1.4, 0);
    const dome = at(squash(sphere(0.42, bodyMat, 16), 0.55), 0, 1.5, 0);
    const brim = at(squash(cyl(0.46, 0.46, 0.05, bodyMat, 18), 1), 0, 1.34, 0.24);
    brim.scale.z = 1.5;
    hat = group(band, dome, brim);
  } else {
    const stalk = at(cyl(0.3, 0.36, 0.22, whiteMat, 18), 0, 1.46, 0);
    const puff = at(squash(sphere(0.4, whiteMat, 18), 0.92), 0, 1.66, 0);
    hat = group(stalk, puff);
  }

  // Arms — tiny stubby rounded nubs that swing while walking.
  const armL = at(squash(sphere(0.1, skinMat, 10), 1.5), -0.32, 0.54, 0);
  const armR = at(squash(sphere(0.1, skinMat, 10), 1.5), 0.32, 0.54, 0);

  // Little feet — short rounded pillars in opposition.
  const legL = at(cyl(0.09, 0.11, 0.2, accentMat, 12), -0.12, 0.12, 0);
  const legR = at(cyl(0.09, 0.11, 0.2, accentMat, 12), 0.12, 0.12, 0);

  const body = group(
    torso, apronFront, apronTie, scarf, head, eyeL, eyeR, blushL, blushR,
    smile, hat, armL, armR, legL, legR,
  );

  // Track rest transforms so we can offset cleanly.
  const armRestY = armL.position.y;

  // Blink bookkeeping: accumulate our own clock from dt; a small fixed phase
  // keeps the chef out of sync with any nearby customer's blink.
  let blinkT = 0;
  const BLINK_PHASE = 0.7;

  // Idle-fidget bookkeeping: a free-running clock plus a smoothed "moving"
  // amount (0 = standing still, 1 = walking). We watch how fast `a.walk`
  // advances between frames (Δwalk/dt) and ease the estimate so brief pauses
  // don't snap the idle motion on/off. A fixed phase keeps the chef's fidget
  // from syncing with neighbouring customers.
  let idleT = 0;
  let prevWalk = 0;
  let moving = 0; // smoothed 0..1
  const IDLE_PHASE = 1.7;

  function update(dt: number, a: { walk: number; face: number; fire: number; carrying: boolean }): void {
    blinkT += dt;
    idleT += dt;
    // Periodic blink: squash both eyes' Y, fully reopening between blinks.
    const eyeY = blinkScale(blinkT, BLINK_PHASE);
    eyeL.scale.y = eyeY;
    eyeR.scale.y = eyeY;

    // Estimate how much the chef is moving from the rate `a.walk` advances.
    // The walk phase ticks at a steady rate while walking and holds steady when
    // idle, so Δwalk/dt is a clean "speed" proxy. Map it to 0..1 and smooth.
    const dWalk = dt > 1e-5 ? Math.abs(a.walk - prevWalk) / dt : 0;
    prevWalk = a.walk;
    const target = Math.min(1, dWalk * 0.16); // ~6 rad/s of phase ⇒ fully "moving"
    // Ease toward the target so the idle motion fades in/out gracefully.
    moving += (target - moving) * Math.min(1, dt * 8);
    const idle = 1 - moving; // idle weight is the complement of movement

    // Face heading.
    body.rotation.y = a.face;

    // Idle vs. walk: when walk ~0 there is essentially no swing.
    const swing = Math.sin(a.walk);
    const swingOpp = Math.sin(a.walk + Math.PI);

    // Little feet swing forward/back about their tops.
    legL.rotation.x = swing * 0.5;
    legR.rotation.x = swingOpp * 0.5;

    // --- IDLE FIDGET (only meaningful while standing; scaled by `idle`) ------
    // Gentle weight-shift sway: a slow side-to-side lean that rocks the whole
    // body, like settling weight from foot to foot.
    const sway = Math.sin(idleT * 1.4 + IDLE_PHASE);
    body.rotation.z = sway * 0.035 * idle;
    // Occasional little head tilt: a slow, mostly-flat wave that only crests
    // every few seconds (the cubed sine stays near zero, then peeks up).
    const tiltWave = Math.sin(idleT * 0.55 + IDLE_PHASE * 1.3);
    const headTilt = tiltWave * tiltWave * tiltWave; // sharpened: rare little dips
    head.rotation.z = headTilt * 0.07 * idle;

    // Springy bob up/down with the gait. Vanishes at walk≈0.
    const bob = Math.abs(Math.sin(a.walk)) * 0.06;
    body.position.y = bob;

    // Bouncy squash-and-stretch on the little body, synced to the bob: stretch
    // tall at the top of the bounce, squash wide at the bottom.
    const stretch = Math.sin(a.walk) * 0.08;
    torso.scale.y = 0.95 * (1 + stretch);
    torso.scale.x = 0.92 * (1 - stretch * 0.6);
    torso.scale.z = 0.82 * (1 - stretch * 0.6);

    // Arms: swing opposite the legs, or raise forward together when carrying.
    // A tiny idle arm jiggle (only when standing & empty-handed) makes the chef
    // shuffle a little as if itching to cook; it returns to rest as `idle`→0.
    const jiggle = Math.sin(idleT * 2.1 + IDLE_PHASE) * 0.018 * idle;
    if (a.carrying) {
      armL.position.set(-0.24, armRestY + 0.1, 0.18);
      armR.position.set(0.24, armRestY + 0.1, 0.18);
    } else {
      armL.position.set(-0.32, armRestY + swingOpp * 0.05 + jiggle, swingOpp * 0.08);
      armR.position.set(0.32, armRestY + swing * 0.05 - jiggle, swing * 0.08);
    }

    // On-fire glow: lerp the apron/body emissive intensity toward `fire`.
    bodyMat.emissiveIntensity = a.fire * 0.95;
  }

  return { group: body, update };
}

// ===========================================================================
// CUSTOMER
// ===========================================================================

export interface CustomerRig {
  group: THREE.Group;
  update(dt: number, a: { bob: number; anger: number; state: string }): void;
}

export function buildCustomer(look: { skin: number; shirt: number; hair: number; hat: boolean }): CustomerRig {
  const skinColor = pick(SKIN, look.skin);
  const shirtColor = pick(SHIRT, look.shirt);
  const hairColor = pick(HAIR, look.hair);

  // Body/shirt material gets tinted toward red on anger — keep its base colour
  // so we can lerp back and forth each frame.
  const bodyMat = stdMat(shirtColor, {
    rough: 0.7,
    emissive: 0xff2a2a,
    emissiveIntensity: 0,
  });
  const bodyBase = new THREE.Color(shirtColor);
  const angerColor = new THREE.Color(0xe85a5a);

  const skinMat = stdMat(skinColor, { rough: 0.58 });
  const skinBase = new THREE.Color(skinColor);
  const hairMat = stdMat(hairColor, { rough: 0.78 });
  const mouthMat = stdMat(0xc4506a, { rough: 0.5 });
  const blushMat = stdMat(0xff9ea8, { rough: 0.85 });

  // Tiny chubby body so the big head dominates (same chibi proportions as chef).
  const torso = at(squash(sphere(0.26, bodyMat, 16), 1.0), 0, 0.48, 0);
  torso.scale.x = 0.92;
  torso.scale.z = 0.8;

  // A soft pale collar so the shirt reads as clothing rather than a blob.
  const collar = at(squash(cyl(0.13, 0.17, 0.07, stdMat(0xf6f2e9, { rough: 0.6 }), 14), 1), 0, 0.68, 0.02);

  // HEAD — big round chibi sphere (≈45% of total height).
  const head = at(sphere(0.41, skinMat, 20), 0, 1.04, 0);
  head.scale.y = 0.96;

  // Hair cap — a squashed dome over the top/back, plus a cute fringe tuft whose
  // side derives from the hair index so the crowd looks varied (not random).
  const hairCap = at(squash(sphere(0.43, hairMat, 16), 0.66), 0, 1.16, -0.04);
  const tuftSide = (look.hair % 2 === 0 ? 1 : -1) * 0.14;
  const tuft = at(squash(sphere(0.16, hairMat, 12), 0.85), tuftSide, 1.32, 0.16);

  // Face: big sparkly eyes set wide and low, rosy cheeks, a friendly smile.
  const eyeL = buildEye(-0.15, 1.02, 0.34);
  const eyeR = buildEye(0.15, 1.02, 0.34);
  const blushL = at(squash(sphere(0.068, blushMat, 10), 0.62), -0.25, 0.94, 0.31);
  const blushR = at(squash(sphere(0.068, blushMat, 10), 0.62), 0.25, 0.94, 0.31);
  const mouth = at(buildSmile(mouthMat, 0.06), 0, 0.91, 0.38);
  // Cute little brows that tilt into a pout when angry.
  const browL = at(box(0.08, 0.018, 0.02, hairMat), -0.15, 1.16, 0.34);
  const browR = at(box(0.08, 0.018, 0.02, hairMat), 0.15, 1.16, 0.34);

  // Tiny stubby arms.
  const armL = at(squash(sphere(0.09, skinMat, 10), 1.5), -0.3, 0.52, 0);
  const armR = at(squash(sphere(0.09, skinMat, 10), 1.5), 0.3, 0.52, 0);

  // Little feet.
  const pantsMat = stdMat(0x6b6b86, { rough: 0.7 });
  const legL = at(cyl(0.08, 0.1, 0.18, pantsMat, 12), -0.11, 0.11, 0);
  const legR = at(cyl(0.08, 0.1, 0.18, pantsMat, 12), 0.11, 0.11, 0);

  const parts: THREE.Object3D[] = [
    torso, collar, head, hairCap, tuft, eyeL, eyeR, blushL, blushR, mouth,
    browL, browR, armL, armR, legL, legR,
  ];

  // Optional snug rounded beanie pulled over the hair, topped with a fluffy pom.
  if (look.hat) {
    const beanieMat = stdMat(pick(SHIRT, look.shirt + 3), { rough: 0.7 });
    const beanie = at(squash(sphere(0.43, beanieMat, 16), 0.78), 0, 1.22, -0.02);
    const pom = at(sphere(0.09, stdMat(0xffffff, { rough: 0.75 }), 10), 0, 1.46, -0.02);
    parts.push(beanie, pom);
  }

  const body = group(...parts);
  // Customers always face the kitchen/camera — keep them facing forward.
  body.rotation.y = 0;

  const tmpColor = new THREE.Color();
  const browRestY = browL.position.y;

  // Blink bookkeeping: accumulate our own clock from dt and stagger the crowd by
  // deriving a stable phase offset from this customer's look (no randomness).
  let blinkT = 0;
  const blinkPhase = (look.shirt * 0.83 + look.hair * 1.37) % BLINK_PERIOD;
  const headRestY = head.rotation.y;

  // Idle-fidget bookkeeping: a free-running clock plus a stable per-rig phase
  // (derived from this customer's look, never random) so the queue's sways,
  // glances and little hops are all staggered rather than synced.
  let idleT = 0;
  const idlePhase = (look.shirt * 1.61 + look.hair * 0.97) % (Math.PI * 2);
  const IDLE_LOOK = 5.5; // seconds between "look around" head turns
  const IDLE_HOP = 7.0; // seconds between tiny idle hops
  const hopPhase = (look.shirt * 1.3 + look.hair * 2.1) % IDLE_HOP;
  const lookPhase = (look.shirt * 2.7 + look.hair * 1.1) % IDLE_LOOK;
  // Eye catch-lights (shine + spark) live as children of each eye group; hide
  // them for the happy squinted "^^" look when served.
  const eyeGlints: THREE.Object3D[] = [
    eyeL.children[1], eyeL.children[2], eyeR.children[1], eyeR.children[2],
  ];

  function update(dt: number, a: { bob: number; anger: number; state: string }): void {
    // Served customers get a bigger, happier hop; otherwise a gentle idle bob.
    const served = a.state === "served";
    idleT += dt;

    // Eyes: happy squinted "^^" curves when served, otherwise normal but with a
    // periodic blink. Both effects are just a vertical squash of the eye groups.
    blinkT += dt;
    const eyeY = served ? 0.12 : blinkScale(blinkT, blinkPhase);
    eyeL.scale.y = eyeY;
    eyeR.scale.y = eyeY;
    // Drop the glossy catch-lights while squinting so it reads as a closed smile.
    for (const g of eyeGlints) g.visible = !served;

    // How much "calm idle life" to apply: full while quietly waiting, but it
    // yields to the served happy-hop and fades out as anger rises (a cross
    // customer shouldn't be casually glancing about). 0..1.
    const calm = served ? 0 : Math.max(0, 1 - Math.max(0, Math.min(1, a.anger)));

    // Occasional tiny idle hop, staggered per-rig, layered onto the base bob so
    // the queue subtly bounces out of sync. A short sine pop once per IDLE_HOP.
    const hopLocal = ((idleT + hopPhase) % IDLE_HOP + IDLE_HOP) % IDLE_HOP;
    const hop = hopLocal < 0.45 ? Math.sin((hopLocal / 0.45) * Math.PI) * 0.04 * calm : 0;
    const amp = served ? 0.11 : 0.028;
    body.position.y = Math.abs(Math.sin(a.bob)) * amp + hop;
    // Tiny side-to-side sway so they never look frozen, plus a slower idle
    // weight-shift lean (staggered by idlePhase) for extra calm-standing life.
    body.rotation.z = Math.sin(a.bob * 0.5) * 0.03 + Math.sin(idleT * 1.1 + idlePhase) * 0.022 * calm;

    // Occasional "look around": slowly turn the head left/right every few
    // seconds, staggered per-rig. The cubed sine keeps the head mostly forward
    // and only sweeps to a side now and then. Suppressed when served/angry.
    const lookLocal = ((idleT + lookPhase) % IDLE_LOOK + IDLE_LOOK) % IDLE_LOOK;
    const lookWave = Math.sin((lookLocal / IDLE_LOOK) * Math.PI * 2 + idlePhase);
    head.rotation.y = headRestY + (lookWave * lookWave * lookWave) * 0.28 * calm;

    // Bouncy squash-and-stretch synced to the bob; livelier on the happy hop.
    const stretch = Math.sin(a.bob) * (served ? 0.12 : 0.05);
    torso.scale.y = 1.0 * (1 + stretch);
    torso.scale.x = 0.92 * (1 - stretch * 0.6);
    torso.scale.z = 0.8 * (1 - stretch * 0.6);

    // Anger: lerp shirt + skin toward red, flush a little emissive, AND give a
    // cute pouty look — brows tilt down toward the nose, mouth flips to a frown,
    // and the blush deepens. Everything returns to normal at anger 0.
    const t = Math.max(0, Math.min(1, a.anger));
    bodyMat.color.copy(tmpColor.copy(bodyBase).lerp(angerColor, t * 0.65));
    skinMat.color.copy(tmpColor.copy(skinBase).lerp(angerColor, t * 0.35));
    bodyMat.emissiveIntensity = t * 0.3;

    // Pouty brows: inner ends dip down as anger rises.
    browL.rotation.z = -t * 0.5;
    browR.rotation.z = t * 0.5;
    browL.position.y = browRestY - t * 0.015;
    browR.position.y = browRestY - t * 0.015;
    // Mouth: flip the happy arc over into a small pout as anger peaks.
    mouth.rotation.x = t * Math.PI;
    // Cheeks puff a touch redder when cross.
    blushMat.color.copy(tmpColor.copy(angerColor).lerp(new THREE.Color(0xff9ea8), 1 - t * 0.5));
  }

  return { group: body, update };
}
