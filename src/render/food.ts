// Procedural food meshes for the arcade kitchen. Every dish is built from a
// handful of plump, rounded, glossy primitives so it reads as cute, kawaii and
// appetizing. No game logic lives here — this module only knows how to turn a
// FoodKind (+ optional cook quality) into a small THREE.Group resting on a
// surface (bottom ~y=0, growing upward). The caller positions the group at a
// slot; buildPlate composes several items into an assembled dish on a plate.

import * as THREE from "three";
import { box, cyl, group, sphere, stdMat, TILE } from "./kit";

export type FoodKind =
  | "patty_raw"
  | "patty"
  | "fries"
  | "soda"
  | "bun"
  | "cheese"
  | "lettuce"
  | "tomato"
  | "burnt";

export type FoodQuality = "perfect" | "good" | "overdone";

// Base radius of a "burger-sized" item, tied loosely to the tile scale so food
// stays small relative to the kitchen furniture.
const R = TILE * 0.26; // ~0.6 world units wide

// --- small shared helpers -------------------------------------------------

/** Lift a mesh so its centre sits at `y` (its bottom is wherever geometry says). */
function at(mesh: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  mesh.position.set(x, y, z);
  return mesh;
}

/** Squash a sphere into a soft dome / patty shape by scaling Y. */
function squash(mesh: THREE.Mesh, sy: number): THREE.Mesh {
  mesh.scale.y = sy;
  return mesh;
}

/**
 * A tiny kawaii face: two dark dot eyes each with a white sparkle plus a small
 * curved smile, all parented to a node that the caller positions/rotates onto
 * the front of an item. `s` scales the whole face; `eyeGap` spreads the eyes.
 * Kept deliberately small + subtle so the item still reads as food.
 */
function cuteFace(s: number, eyeGap: number): THREE.Group {
  const eyeMat = stdMat(0x2a1d22, { rough: 0.3, flat: true });
  const sparkMat = stdMat(0xffffff, { rough: 0.1, emissive: 0xffffff, emissiveIntensity: 0.5 });
  const mouthMat = stdMat(0x6b3a3f, { rough: 0.35, flat: true });
  const f = new THREE.Group();
  for (const sign of [-1, 1]) {
    const eye = at(sphere(s * 0.5, eyeMat, 8), sign * eyeGap, s * 0.55, 0.02);
    const spark = at(sphere(s * 0.16, sparkMat, 6), sign * eyeGap + s * 0.16, s * 0.78, 0.04);
    f.add(eye, spark);
  }
  // Small upturned smile built from three little segments curving downward.
  const smileMat = mouthMat;
  for (let k = -1; k <= 1; k++) {
    const seg = at(box(s * 0.34, s * 0.12, s * 0.1, smileMat), k * s * 0.32, -s * 0.55 - Math.abs(k) * s * 0.18, 0.02);
    seg.rotation.z = -k * 0.5;
    f.add(seg);
  }
  return f;
}

/** A bright little four-point sparkle that sells a "perfect" cook as delightful. */
function sparkle(size: number): THREE.Mesh {
  const mat = stdMat(0xfff4d0, { rough: 0.1, metal: 0.1, emissive: 0xffe9b0, emissiveIntensity: 0.7 });
  const star = box(size, size * 0.28, size * 0.28, mat);
  // A crossed second bar would add meshes; instead squash into a soft diamond.
  star.rotation.z = Math.PI / 4;
  star.scale.set(1, 1, 1);
  return star;
}

// --- individual items -----------------------------------------------------

function buildPattyRaw(): THREE.Group {
  const h = 0.13;
  // Plump pink-red puck with a soft glossy sheen so it still looks fresh + cute.
  const mat = stdMat(0xe0697b, { rough: 0.38, metal: 0.04 });
  const disc = at(cyl(R * 0.94, R * 0.98, h, mat, 24), 0, h / 2, 0);
  const dome = at(squash(sphere(R * 0.92, mat, 16), 0.2), 0, h, 0);
  // A paler fat fleck on top so it does not look like flat plastic.
  const fleck = at(sphere(R * 0.16, stdMat(0xf0aab2, { rough: 0.45 })), R * 0.28, h + 0.01, 0.05);
  return group(disc, dome, squash(fleck as THREE.Mesh, 0.35));
}

function buildPatty(quality: FoodQuality): THREE.Group {
  const h = 0.14;
  // Glossy cooked beef: low roughness so the environment paints a soft sheen.
  // Slightly warmer/brighter browns than before so it reads candy-appetizing.
  const baseColor = quality === "overdone" ? 0x4a2a16 : 0x9a5a30;
  const bodyMat = quality === "perfect"
    ? stdMat(baseColor, { rough: 0.26, metal: 0.05, emissive: 0xff8a36, emissiveIntensity: 0.26 })
    : stdMat(baseColor, { rough: quality === "overdone" ? 0.5 : 0.34, metal: 0.05 });
  // Drum-shaped (bulging waist) so it reads as a plump juicy puck, not a coin.
  const disc = at(cyl(R * 0.88, R * 0.98, h, bodyMat, 24), 0, h / 2, 0);

  // A fuller domed cap on top so the patty bulges like a soft seared pillow.
  const domeMat = quality === "perfect"
    ? stdMat(baseColor, { rough: 0.24, metal: 0.06, emissive: 0xff8a36, emissiveIntensity: 0.24 })
    : stdMat(baseColor, { rough: quality === "overdone" ? 0.5 : 0.32, metal: 0.06 });
  const dome = at(squash(sphere(R * 0.92, domeMat, 18), 0.3), 0, h, 0);

  // Soft rounded sear marks crossing the top (thin flattened bars).
  const searMat = stdMat(0x33180a, { rough: 0.7 });
  const sear1 = at(box(R * 1.5, 0.03, R * 0.12, searMat), 0, h + 0.04, 0);
  const sear2 = at(box(R * 1.5, 0.03, R * 0.12, searMat), 0, h + 0.04, R * 0.34);
  const sear3 = at(box(R * 1.4, 0.03, R * 0.12, searMat), 0, h + 0.04, -R * 0.34);
  sear1.rotation.y = sear2.rotation.y = sear3.rotation.y = Math.PI / 7;

  const parts: THREE.Object3D[] = [disc, dome, sear1, sear2, sear3];

  if (quality === "perfect") {
    // A warm glossy highlight plus a bright sparkle so a perfect cook delights.
    const shine = at(
      squash(sphere(R * 0.22, stdMat(0xffe2bc, { rough: 0.1, metal: 0.12, emissive: 0xffe0b0, emissiveIntensity: 0.5 })), 0.32),
      -R * 0.22,
      h + 0.08,
      -R * 0.18,
    );
    const spk = at(sparkle(0.16), R * 0.34, h + 0.13, R * 0.2);
    parts.push(shine, spk);
  }
  return group(...parts);
}

/**
 * A patty that shows its LIVE cooking state on the grill. The body is one shared
 * material that browns as it sears; the sear marks fade in; a glossy sheen blob
 * blooms in the perfect window. The caller drives it each frame via the tintable
 * materials tagged on `group.userData.cook` (see sceneView.tintCookingPatty).
 */
export function buildCookingPatty(): THREE.Group {
  const h = 0.14;
  const bodyMat = stdMat(0xe0697b, { rough: 0.42, metal: 0.05, emissive: 0xff7a2a, emissiveIntensity: 0 });
  const disc = at(cyl(R * 0.9, R * 0.98, h, bodyMat, 24), 0, h / 2, 0);
  const dome = at(squash(sphere(R * 0.92, bodyMat, 18), 0.3), 0, h, 0);

  // Sear marks fade in as the crust forms.
  const searMat = stdMat(0x2a1408, { rough: 0.7, transparent: true, opacity: 0 });
  const marks: THREE.Object3D[] = [];
  for (const dz of [0, R * 0.34, -R * 0.34]) {
    const m = at(box(R * 1.5, 0.03, R * 0.12, searMat), 0, h + 0.045, dz);
    m.rotation.y = Math.PI / 7;
    marks.push(m);
  }

  // A juicy sheen highlight that brightens through the perfect window.
  const sheenMat = stdMat(0xffe2bc, { rough: 0.12, metal: 0.1, emissive: 0xffd9a0, emissiveIntensity: 0, transparent: true, opacity: 0 });
  const sheen = at(squash(sphere(R * 0.26, sheenMat, 10), 0.3), -R * 0.18, h + 0.1, -R * 0.14);

  const g = group(disc, dome, ...marks, sheen);
  g.userData.cook = { body: bodyMat, sear: searMat, sheen: sheenMat };
  return g;
}

/** Fries that brighten from pale to golden as they fry (live, like the patty). */
export function buildCookingFries(): THREE.Group {
  const cartonMat = stdMat(0xf24a4a, { rough: 0.32, metal: 0.03 });
  const rimMat = stdMat(0xfdf6ec, { rough: 0.4 });
  const cartonH = 0.26;
  const carton = at(cyl(R * 0.52, R * 0.34, cartonH, cartonMat, 16), 0, cartonH / 2, 0);
  const rim = at(cyl(R * 0.56, R * 0.55, cartonH * 0.24, rimMat, 16), 0, cartonH * 0.9, 0);

  // One shared fry material that the caller tints from pale → golden → deep.
  const fryMat = stdMat(0xe8d9a0, { rough: 0.36, metal: 0.03, emissive: 0xffa522, emissiveIntensity: 0 });
  const parts: THREE.Object3D[] = [carton, rim];
  const fryH = 0.4;
  const cols = [-0.2, -0.06, 0.08, 0.2];
  const rows = [-0.1, 0.12];
  let i = 0;
  for (const cx of cols) {
    for (const cz of rows) {
      if (i >= 7) break;
      const fry = box(0.062, fryH, 0.062, fryMat);
      at(fry, cx * TILE * 0.24, cartonH + fryH / 2 - 0.06, cz * TILE * 0.24);
      fry.rotation.z = cx * 0.6;
      fry.rotation.x = cz * 0.7;
      parts.push(fry);
      i++;
    }
  }
  const sheenMat = stdMat(0xfff4d0, { rough: 0.12, emissive: 0xffe9b0, emissiveIntensity: 0, transparent: true, opacity: 0 });
  const sheen = at(box(0.16, 0.05, 0.05, sheenMat), R * 0.3, cartonH + fryH * 0.7, R * 0.2);
  parts.push(sheen);

  const g = group(...parts);
  g.userData.cook = { fries: fryMat, sheen: sheenMat };
  return g;
}

function buildBurnt(): THREE.Group {
  const h = 0.16;
  // A sad little charred matte lump — dead-matte charcoal so it never catches a
  // tasty highlight. Comically overcooked, drooping and dark (but no happy face).
  const charMat = stdMat(0x171210, { rough: 1, metal: 0, flat: true });
  const blob = at(squash(sphere(R * 0.96, charMat, 12), 0.46), 0, h * 0.6, 0);
  blob.scale.x = 1.06;
  // A few crusty lumps so the char looks brittle and inedible.
  const lumpMat = stdMat(0x0d0a07, { rough: 1, flat: true });
  const lump1 = at(squash(sphere(R * 0.32, lumpMat, 7), 0.5), R * 0.3, h * 0.72, R * 0.1);
  const lump2 = at(squash(sphere(R * 0.26, lumpMat, 7), 0.5), -R * 0.28, h * 0.66, -R * 0.22);
  const lump3 = at(squash(sphere(R * 0.2, lumpMat, 7), 0.5), R * 0.05, h * 0.78, -R * 0.3);
  // Two tiny down-sloped dot "eyes" hint at a sad face without a smile.
  const sadMat = stdMat(0x000000, { rough: 1, flat: true });
  const sad1 = at(sphere(R * 0.07, sadMat, 6), -R * 0.22, h * 0.78, R * 0.42);
  const sad2 = at(sphere(R * 0.07, sadMat, 6), R * 0.2, h * 0.74, R * 0.42);
  // A wisp of grey ash on top for a touch of texture.
  const ash = at(squash(sphere(R * 0.16, stdMat(0x4a4540, { rough: 1, flat: true }), 6), 0.4), -R * 0.05, h * 0.86, R * 0.05);
  return group(blob, lump1, lump2, lump3, sad1, sad2, ash);
}

function buildFries(quality: FoodQuality): THREE.Group {
  // A cute little carton: a rounded, slightly out-flared red cup with a glossy
  // sheen and a pale cream rim band, so the fries spill from a candy-bright box.
  const cartonMat = stdMat(0xf24a4a, { rough: 0.32, metal: 0.03 });
  const rimMat = stdMat(0xfdf6ec, { rough: 0.4 });
  const cartonH = 0.26;
  const carton = at(cyl(R * 0.52, R * 0.34, cartonH, cartonMat, 16), 0, cartonH / 2, 0);
  // Pale rim band around the rounded top opening.
  const rim = at(cyl(R * 0.56, R * 0.55, cartonH * 0.24, rimMat, 16), 0, cartonH * 0.9, 0);

  // Chubby crisp golden sticks; perfect ones are brighter and gently glow.
  const friesGold = quality === "perfect" ? 0xffcf4a : 0xe6a634;
  const fryMat = quality === "perfect"
    ? stdMat(friesGold, { rough: 0.3, metal: 0.04, emissive: 0xffa522, emissiveIntensity: 0.22 })
    : stdMat(friesGold, { rough: 0.38, metal: 0.03 });

  const parts: THREE.Object3D[] = [carton, rim];
  const fryH = 0.4;
  const cols = [-0.2, -0.06, 0.08, 0.2];
  const rows = [-0.1, 0.12];
  let i = 0;
  for (const cx of cols) {
    for (const cz of rows) {
      if (i >= 7) break;
      // Chubbier sticks with a rounded tip cap so they read plump and cute.
      const fry = box(0.062, fryH, 0.062, fryMat);
      at(fry, cx * TILE * 0.24, cartonH + fryH / 2 - 0.06, cz * TILE * 0.24);
      // Fan each stick a slightly different way so they spill out naturally.
      fry.rotation.z = cx * 0.6;
      fry.rotation.x = cz * 0.7;
      parts.push(fry);
      i++;
    }
  }
  if (quality === "perfect") {
    parts.push(at(sparkle(0.16), R * 0.34, cartonH + fryH * 0.7, R * 0.24));
  }
  return group(...parts);
}

function buildSoda(): THREE.Group {
  const cupH = 0.42;
  // Plump glossy cup: low roughness so it picks up bright candy reflections.
  const cupMat = stdMat(0xfafaff, { rough: 0.2, metal: 0.05 });
  const cup = at(cyl(R * 0.46, R * 0.34, cupH, cupMat, 22), 0, cupH / 2, 0);
  // Bright cherry wrap band for branding.
  const band = at(cyl(R * 0.47, R * 0.44, cupH * 0.36, stdMat(0xff4d6d, { rough: 0.26, metal: 0.04 }), 22), 0, cupH * 0.42, 0);
  // Rounded domed lid.
  const lidMat = stdMat(0xeef1f7, { rough: 0.16, metal: 0.07 });
  const lid = at(cyl(R * 0.48, R * 0.47, 0.05, lidMat, 22), 0, cupH + 0.025, 0);
  const dome = at(squash(sphere(R * 0.43, lidMat, 16), 0.44), 0, cupH + 0.05, 0);
  // Bright glossy straw poking out at a jaunty angle.
  const strawH = 0.36;
  const straw = at(cyl(0.03, 0.03, strawH, stdMat(0xff5a8a, { rough: 0.16, metal: 0.06 }), 10), R * 0.12, cupH + strawH / 2, 0);
  straw.rotation.z = 0.24;
  // A subtle cute face centred on the front of the cup, just below the band.
  const face = cuteFace(0.07, 0.09);
  face.position.set(0, cupH * 0.32, R * 0.42);
  return group(cup, band, lid, dome, straw, face);
}

function buildBun(): THREE.Group {
  const h = 0.3;
  // Plump golden glazed dome — low-ish roughness gives an egg-washed sheen. A
  // darker rounded base ring grounds it like a real soft bun.
  const bunMat = stdMat(0xeab867, { rough: 0.4, metal: 0.03 });
  const dome = at(squash(sphere(R * 0.98, bunMat, 18), 0.66), 0, h * 0.4, 0);
  const baseMat = stdMat(0xcf924f, { rough: 0.55 });
  const baseRing = at(cyl(R * 0.96, R * 0.99, h * 0.18, baseMat, 22), 0, h * 0.09, 0);
  const parts: THREE.Object3D[] = [baseRing, dome];
  // A scatter of glossy sesame dots, derived statically (no randomness).
  const seedMat = stdMat(0xfbeec2, { rough: 0.3 });
  const seeds: [number, number][] = [
    [0.0, 0.0],
    [0.34, 0.1],
    [-0.3, 0.16],
    [0.14, -0.32],
    [-0.2, -0.26],
  ];
  for (const [sx, sz] of seeds) {
    const seed = at(squash(sphere(0.036, seedMat, 8), 0.55), sx * R, h * 0.56 - (sx * sx + sz * sz) * 0.12, sz * R);
    seed.rotation.z = sx * 0.6;
    parts.push(seed);
  }
  // A subtle cute face on the front of the bun crown.
  const face = cuteFace(0.07, 0.09);
  face.position.set(0, h * 0.34, R * 0.78);
  face.rotation.x = -0.3;
  parts.push(face);
  return group(...parts);
}

function buildCheese(): THREE.Group {
  // Glossy gooey draped slice: very low roughness so it gleams like soft cheese.
  const sliceMat = stdMat(0xffcf45, { rough: 0.18, metal: 0.04 });
  const slice = at(box(R * 1.5, 0.05, R * 1.5, sliceMat), 0, 0.045, 0);
  // Tilt a hair so the slice looks like it is draping rather than perfectly flat.
  slice.rotation.z = 0.07;
  slice.rotation.x = -0.06;
  // Three soft rounded drips melting over the front + corners for a gooey look.
  const dripMat = stdMat(0xfcc233, { rough: 0.2, metal: 0.04 });
  const dripL = at(squash(sphere(R * 0.24, dripMat, 10), 0.8), -R * 0.55, 0.01, R * 0.6);
  const dripR = at(squash(sphere(R * 0.22, dripMat, 10), 0.8), R * 0.6, 0.01, R * 0.5);
  const dripC = at(squash(sphere(R * 0.2, dripMat, 10), 0.85), 0, 0.01, R * 0.72);
  return group(slice, dripL, dripR, dripC);
}

function buildLettuce(): THREE.Group {
  // Ruffly cute layered leaves: a darker outer ring of frilly rounded lobes plus
  // brighter inner crinkles, all smooth-shaded so the edges read soft + ruffly.
  const outerMat = stdMat(0x6cbf52, { rough: 0.62 });
  const innerMat = stdMat(0x98e07a, { rough: 0.55 });
  const leafGeo = new THREE.IcosahedronGeometry(R * 0.52, 1);
  const parts: THREE.Object3D[] = [];
  // Outer ruffle ring (6 lobes) for the frilly skirt poking past the bun.
  const ring = 6;
  for (let k = 0; k < ring; k++) {
    const ang = (k / ring) * Math.PI * 2;
    const leaf = new THREE.Mesh(leafGeo, outerMat);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    leaf.scale.set(1.1, 0.3, 1.3);
    at(leaf, Math.cos(ang) * R * 0.62, 0.07 + (k % 2) * 0.04, Math.sin(ang) * R * 0.62);
    leaf.rotation.y = ang;
    leaf.rotation.x = 0.22;
    parts.push(leaf);
  }
  // A couple of brighter, plumper inner crinkles.
  const inner: [number, number][] = [[0, 0], [R * 0.3, -R * 0.2]];
  for (const [ix, iz] of inner) {
    const leaf = new THREE.Mesh(leafGeo, innerMat);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    leaf.scale.set(1.05, 0.36, 1.05);
    at(leaf, ix, 0.11, iz);
    leaf.rotation.y = ix + iz;
    parts.push(leaf);
  }
  return group(...parts);
}

function buildTomato(): THREE.Group {
  const h = 0.08;
  // Juicy glossy slice: bright wet red skin with a lighter pulpy centre and a
  // few cute pale seed dots so it reads as a fresh, plump cross-cut tomato.
  const fleshMat = stdMat(0xf2543c, { rough: 0.2, metal: 0.03 });
  const slice = at(cyl(R * 0.8, R * 0.82, h, fleshMat, 24), 0, h / 2, 0);
  // Lighter pulpy centre sitting just on top.
  const core = at(cyl(R * 0.48, R * 0.48, 0.02, stdMat(0xffae9c, { rough: 0.24, metal: 0.02 }), 24), 0, h + 0.006, 0);
  const parts: THREE.Object3D[] = [slice, core];
  // Cute pale seed dots ringed around the pulp.
  const seedMat = stdMat(0xfff0d2, { rough: 0.4 });
  for (let k = 0; k < 5; k++) {
    const ang = (k / 5) * Math.PI * 2;
    const seed = at(squash(sphere(0.026, seedMat, 6), 0.7), Math.cos(ang) * R * 0.5, h + 0.012, Math.sin(ang) * R * 0.5);
    parts.push(seed);
  }
  return group(...parts);
}

// --- public API -----------------------------------------------------------

/** Build a single food item resting on a surface (bottom near y=0). */
export function buildFood(kind: FoodKind, quality: FoodQuality = "good"): THREE.Group {
  switch (kind) {
    case "patty_raw":
      return buildPattyRaw();
    case "patty":
      return buildPatty(quality);
    case "burnt":
      return buildBurnt();
    case "fries":
      return buildFries(quality);
    case "soda":
      return buildSoda();
    case "bun":
      return buildBun();
    case "cheese":
      return buildCheese();
    case "lettuce":
      return buildLettuce();
    case "tomato":
      return buildTomato();
  }
}

/** Map a plate-part id string to the FoodKind that renders it. */
function kindForId(id: string): FoodKind {
  switch (id) {
    case "bun":
      return "bun";
    case "patty":
      return "patty";
    case "fries":
      return "fries";
    case "cheese":
      return "cheese";
    case "lettuce":
      return "lettuce";
    case "tomato":
      return "tomato";
    case "soda":
      return "soda";
    default:
      return "patty";
  }
}

/** Coerce an arbitrary quality string to a FoodQuality (default "good"). */
function asQuality(q: string): FoodQuality {
  return q === "perfect" || q === "overdone" || q === "good" ? q : "good";
}

// Items that stack into the burger tower vs. items that sit beside it.
const STACKABLE = new Set<FoodKind>(["patty", "cheese", "lettuce", "tomato"]);

/**
 * Build a plated dish: a round white plate with the parts assembled on it.
 * Burger-like parts stack (bun crowning the top); fries/soda/loose items sit
 * beside the stack so the whole thing reads as a served meal.
 */
export function buildPlate(parts: { id: string; quality: string }[]): THREE.Group {
  const plateH = 0.06;
  const plate = at(
    cyl(0.9, 0.86, plateH, stdMat(0xf4f4f8, { rough: 0.3, metal: 0.06 }), 28),
    0,
    plateH / 2,
    0,
  );
  const g = group(plate);

  // Split parts: the burger stack vs. the side items.
  const stack: { kind: FoodKind; quality: FoodQuality }[] = [];
  const sides: { kind: FoodKind; quality: FoodQuality }[] = [];
  let hasBun = false;
  for (const p of parts) {
    const kind = kindForId(p.id);
    const quality = asQuality(p.quality);
    if (kind === "bun") {
      hasBun = true;
    } else if (STACKABLE.has(kind)) {
      stack.push({ kind, quality });
    } else {
      sides.push({ kind, quality });
    }
  }

  // Build the burger tower on top of the plate, fillings first then the bun.
  let y = plateH;
  for (const layer of stack) {
    const item = buildFood(layer.kind, layer.quality);
    item.position.set(0, y, 0);
    g.add(item);
    y += layerHeight(layer.kind);
  }
  if (hasBun) {
    const bun = buildFood("bun");
    bun.position.set(0, y, 0);
    g.add(bun);
    y += layerHeight("bun");
  }

  // Place side items around the plate's edge so they do not overlap the stack.
  const sideAngles = [-Math.PI * 0.5, Math.PI * 0.5, Math.PI, 0];
  sides.forEach((side, i) => {
    const item = buildFood(side.kind, side.quality);
    const ang = sideAngles[i % sideAngles.length];
    item.position.set(Math.cos(ang) * 0.5, plateH, Math.sin(ang) * 0.5);
    g.add(item);
  });

  return g;
}

/** Approximate stacked height each layer adds to the burger tower. */
function layerHeight(kind: FoodKind): number {
  switch (kind) {
    case "patty":
      return 0.15;
    case "cheese":
      return 0.05;
    case "lettuce":
      return 0.1;
    case "tomato":
      return 0.09;
    case "bun":
      return 0.17;
    default:
      return 0.1;
  }
}
