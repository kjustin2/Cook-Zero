// Procedural cooking-station + ingredient-bin meshes for the "toy kitchen".
// Pure rendering only — no game-logic imports. Each station fits within one grid
// cell (footprint ~1.7 x 1.7, height ~1.0–1.4) and exposes LOCAL food-placement
// slots on its top work surface via `group.userData.slots: THREE.Vector3[]`.
//
// The scene supplies an IBL environment map (PMREM RoomEnvironment), so metallic
// surfaces reflect their surroundings. Appliance bodies use a brushed-stainless
// look — `{ metal: 0.8, rough: 0.35 }` — so they pick up those reflections.

import * as THREE from "three";
import { stdMat, box, cyl, sphere, group, TILE } from "./kit";

// Footprint slightly smaller than a tile so neighbouring stations leave gaps.
const FOOT = TILE * 0.74; // ~1.7

// Station palette (matches the game's colours).
const COLORS: Record<string, number> = {
  grill: 0x4a4f59,
  fryer: 0x53504a,
  prep: 0x8a8f98,
  drink: 0x3a6ea5,
  trash: 0x33373d,
  bin_bun: 0xd9a866,
  bin_patty: 0xb35b5b,
  bin_potato: 0xc8a063,
  bin_cheese: 0xe9c14a,
  bin_lettuce: 0x6fbf5a,
  bin_tomato: 0xe05a44,
};

// Shared stainless-steel look for appliance bodies; the IBL env map reflects in it.
const STEEL = { metal: 0.8, rough: 0.35 } as const;
const STEEL_BRIGHT = { metal: 0.85, rough: 0.28 } as const;

/** Attach LOCAL top-surface slot positions for the caller to place food on. */
function setSlots(g: THREE.Group, slots: THREE.Vector3[]): void {
  g.userData.slots = slots;
}

/** Four short kickplate feet at the corners of a footprint, tops at y=`top`. */
function legs(top: number, inset = 0.18): THREE.Mesh[] {
  const mat = stdMat(0x23262b, { metal: 0.7, rough: 0.4 });
  const h = top;
  const dx = FOOT / 2 - inset;
  const out: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = cyl(0.05, 0.06, h, mat, 8);
      leg.position.set(sx * dx, h / 2, sz * dx);
      out.push(leg);
    }
  }
  return out;
}

/** A thin dark trim band wrapping the front+sides of a cabinet at height `y`. */
function trimBand(y: number, w = FOOT * 1.001, d = FOOT * 1.001): THREE.Mesh {
  const band = box(w, 0.04, d, stdMat(0x202327, { metal: 0.6, rough: 0.4 }));
  band.position.y = y;
  return band;
}

/** A round knob lying flat against a control panel face (axis along Z). */
function knob(x: number, y: number, z: number, color: number): THREE.Mesh {
  const k = cyl(0.06, 0.06, 0.05, stdMat(color, { metal: 0.5, rough: 0.4 }), 12);
  k.rotation.x = Math.PI / 2;
  k.position.set(x, y, z);
  return k;
}

/** A row of small rivets across the front face at height `y`. */
function rivets(y: number, z: number, count = 4): THREE.Mesh[] {
  const mat = stdMat(0xb6bcc4, { metal: 0.9, rough: 0.25 });
  const out: THREE.Mesh[] = [];
  const span = FOOT * 0.78;
  for (let i = 0; i < count; i++) {
    const r = sphere(0.018, mat, 8);
    r.position.set(-span / 2 + (span * i) / (count - 1), y, z);
    out.push(r);
  }
  return out;
}

/** Vertically squash a sphere into a soft dome/puck. */
function dome(mesh: THREE.Mesh, sy: number): THREE.Mesh {
  mesh.scale.y = sy;
  return mesh;
}

// Shared, cheap geometries for the little heaps of food filling the bins (one
// per kind so a binful of items is a handful of draw calls, not dozens).
const POTATO_GEO = new THREE.IcosahedronGeometry(0.17, 0);
const LEAF_GEO = new THREE.IcosahedronGeometry(0.2, 0);

/** A small heap of the bin's actual ingredient, resting in the open crate so it
 *  clearly reads as a box holding that food. `topY` is the crate's rim height. */
function crateFill(defId: string, topY: number): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const put = (m: THREE.Mesh, x: number, dy: number, z: number): void => {
    m.position.set(x, topY + dy, z);
    out.push(m);
  };
  switch (defId) {
    case "bin_bun": {
      const mat = stdMat(0xeab867, { rough: 0.45, metal: 0.03 });
      for (const [x, z] of [[-0.18, 0.05], [0.2, -0.05], [0.0, 0.2]] as const) {
        put(dome(sphere(0.21, mat, 12), 0.6), x, 0.04, z);
      }
      break;
    }
    case "bin_potato": {
      const mat = stdMat(0xc8a063, { rough: 0.85, flat: true });
      for (const [x, z, ry] of [[-0.16, 0.0, 0.4], [0.16, 0.1, -0.5], [0.0, -0.16, 0.9]] as const) {
        const p = new THREE.Mesh(POTATO_GEO, mat);
        p.castShadow = true;
        p.scale.set(1.35, 0.9, 0.95);
        p.rotation.y = ry;
        put(p, x, 0.03, z);
      }
      break;
    }
    case "bin_cheese": {
      const mat = stdMat(0xffcf45, { rough: 0.3, metal: 0.05 });
      for (let i = 0; i < 4; i++) {
        const slice = box(0.5, 0.04, 0.5, mat);
        slice.rotation.y = 0.22 * i;
        put(slice, 0.02 * (i % 2) - 0.01, -0.02 + i * 0.05, 0.02 * (i % 2));
      }
      break;
    }
    case "bin_lettuce": {
      const mats = [stdMat(0x6cbf52, { rough: 0.6, flat: true }), stdMat(0x98e07a, { rough: 0.55, flat: true })];
      for (const [x, z, m] of [[-0.15, 0.05, 0], [0.16, -0.02, 1], [0.0, 0.18, 0]] as const) {
        const leaf = new THREE.Mesh(LEAF_GEO, mats[m]);
        leaf.castShadow = true;
        leaf.scale.set(1.05, 0.7, 1.05);
        put(leaf, x, 0.04, z);
      }
      break;
    }
    case "bin_tomato": {
      const mat = stdMat(0xf2543c, { rough: 0.25, metal: 0.03 });
      for (const [x, z] of [[-0.15, 0.04], [0.16, -0.04], [0.0, 0.16]] as const) {
        put(sphere(0.16, mat, 12), x, 0.04, z);
      }
      break;
    }
  }
  return out;
}

function buildGrill(): THREE.Group {
  const bodyH = 0.78;
  const legH = 0.22;
  const cabinet = box(FOOT, bodyH, FOOT, stdMat(COLORS.grill, STEEL));
  cabinet.position.y = legH + bodyH / 2;

  const topY = legH + bodyH;

  // Bright stainless bezel framing the cooktop.
  const bezel = box(FOOT, 0.05, FOOT, stdMat(0xc2c7cd, STEEL_BRIGHT));
  bezel.position.y = topY + 0.025;

  // Recessed firebox with a bed of softly-glowing embers down inside it (kept
  // dim so it reads as a warm glow under the grate, never a bloom flare).
  const firebox = box(FOOT * 0.86, 0.09, FOOT * 0.78, stdMat(0x141517, { metal: 0.35, rough: 0.65 }));
  firebox.position.set(0, topY + 0.045, -0.02);
  const embers = box(FOOT * 0.8, 0.02, FOOT * 0.72, stdMat(0x381206, { emissive: 0xc2330e, emissiveIntensity: 0.16, rough: 0.8 }));
  embers.position.set(0, topY + 0.08, -0.02);

  // Cast-iron grate over the embers: long ribs + a few cross ribs (the glow
  // peeks between them).
  const grateMat = stdMat(0x1b1d20, { metal: 0.35, rough: 0.55 });
  const grates: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const rib = box(FOOT * 0.82, 0.04, 0.06, grateMat);
    rib.position.set(0, topY + 0.12, -0.5 + i * 0.25);
    grates.push(rib);
  }
  for (let i = 0; i < 3; i++) {
    const cross = box(0.06, 0.035, FOOT * 0.74, grateMat);
    cross.position.set(-0.5 + i * 0.5, topY + 0.11, -0.02);
    grates.push(cross);
  }

  // Grease trough running along the front lip.
  const trough = box(FOOT * 0.86, 0.06, 0.1, stdMat(0x3a3d42, { metal: 0.55, rough: 0.4 }));
  trough.position.set(0, topY + 0.05, FOOT / 2 - 0.07);

  // Brushed (matte-ish) backsplash riser with a utensil rail + hanging tongs.
  // Deliberately NOT mirror-bright so the grill's warm point light can't kick a
  // blooming specular off this big flat panel.
  const riser = box(FOOT * 0.96, 0.5, 0.06, stdMat(0x7d828a, { metal: 0.35, rough: 0.55 }));
  riser.position.set(0, topY + 0.28, -FOOT / 2 + 0.04);
  const rail = cyl(0.02, 0.02, FOOT * 0.72, stdMat(0x9aa0a8, { metal: 0.85, rough: 0.25 }), 8);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, topY + 0.16, -FOOT / 2 + 0.13);
  const tongMat = stdMat(0xc6ccd2, { metal: 0.9, rough: 0.22 });
  const tongA = box(0.03, 0.36, 0.025, tongMat);
  tongA.position.set(-0.42, topY - 0.02, -FOOT / 2 + 0.15);
  const tongB = box(0.03, 0.36, 0.025, tongMat);
  tongB.position.set(-0.36, topY - 0.02, -FOOT / 2 + 0.15);

  // Control panel strip on the front with two knobs.
  const panel = box(FOOT * 0.94, 0.22, 0.05, stdMat(0x34383e, STEEL));
  panel.position.set(0, legH + bodyH * 0.5, FOOT / 2 + 0.015);
  const k1 = knob(-0.45, legH + bodyH * 0.5, FOOT / 2 + 0.05, 0xd14b2a);
  const k2 = knob(0.45, legH + bodyH * 0.5, FOOT / 2 + 0.05, 0xd14b2a);

  const trim = trimBand(legH + bodyH * 0.82);

  // A spatula resting on the front lip + a little grease cup beside it.
  const spatHead = box(0.24, 0.02, 0.22, tongMat);
  spatHead.position.set(0.34, topY + 0.16, 0.4);
  const spatHandle = box(0.045, 0.03, 0.34, stdMat(0x2a2d33, { rough: 0.5 }));
  spatHandle.position.set(0.34, topY + 0.17, 0.66);
  const greaseCup = cyl(0.1, 0.08, 0.12, stdMat(0x8a8f98, { metal: 0.7, rough: 0.35 }), 12);
  greaseCup.position.set(-0.52, topY + 0.12, 0.42);

  const g = group(
    ...legs(legH),
    cabinet,
    bezel,
    firebox,
    embers,
    ...grates,
    trough,
    riser,
    rail,
    tongA,
    tongB,
    panel,
    k1,
    k2,
    trim,
    spatHead,
    spatHandle,
    greaseCup,
    ...rivets(legH + bodyH * 0.18, FOOT / 2 + 0.01, 4),
  );
  const slotY = topY + 0.15;
  setSlots(g, [new THREE.Vector3(-0.45, slotY, 0), new THREE.Vector3(0.45, slotY, 0)]);
  return g;
}

function buildFryer(): THREE.Group {
  const bodyH = 0.8;
  const legH = 0.2;
  const cabinet = box(FOOT, bodyH, FOOT, stdMat(COLORS.fryer, STEEL));
  cabinet.position.y = legH + bodyH / 2;

  const topY = legH + bodyH;
  const cooktop = box(FOOT * 0.98, 0.05, FOOT * 0.98, stdMat(0xb6bcc4, STEEL_BRIGHT));
  cooktop.position.y = topY + 0.025;

  const wellMat = stdMat(0x17181a, { metal: 0.7, rough: 0.35 });
  const oilMat = stdMat(0xffb347, { emissive: 0xffb347, emissiveIntensity: 0.35, rough: 0.3 });
  const handleMat = stdMat(0x9aa0a8, { metal: 0.85, rough: 0.25 });

  const wells: THREE.Mesh[] = [];
  for (const sx of [-0.45, 0.45]) {
    const well = cyl(0.32, 0.34, 0.18, wellMat, 16);
    well.position.set(sx, topY + 0.05, 0);
    wells.push(well);
    const oil = cyl(0.27, 0.27, 0.02, oilMat, 16);
    oil.position.set(sx, topY + 0.14, 0);
    wells.push(oil);
    // Wire basket: a shallow mesh-like ring sitting in the oil.
    const basket = cyl(0.24, 0.2, 0.12, stdMat(0xcfd4da, { metal: 0.85, rough: 0.3 }), 14);
    basket.position.set(sx, topY + 0.1, 0);
    wells.push(basket);
    // Bent wire basket handle: an upright then a forward kink.
    const post = cyl(0.02, 0.02, 0.28, handleMat, 6);
    post.position.set(sx, topY + 0.28, -0.18);
    wells.push(post);
    const grip = cyl(0.02, 0.02, 0.16, handleMat, 6);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(sx, topY + 0.42, -0.18);
    wells.push(grip);
  }

  // Control panel + temperature knob + dark trim line.
  const panel = box(FOOT * 0.94, 0.2, 0.05, stdMat(0x3a382f, STEEL));
  panel.position.set(0, legH + bodyH * 0.55, FOOT / 2 + 0.015);
  const dial = knob(0.4, legH + bodyH * 0.55, FOOT / 2 + 0.05, 0xe0922f);
  const trim = trimBand(legH + bodyH * 0.85);

  // A little salt shaker + a chip scoop standing on the front lip.
  const shakerBody = cyl(0.07, 0.08, 0.16, stdMat(0xf4f1e8, { rough: 0.4, transparent: true, opacity: 0.85 }), 12);
  shakerBody.position.set(-0.5, topY + 0.11, 0.5);
  const shakerCap = cyl(0.072, 0.072, 0.05, stdMat(0x9aa0a8, { metal: 0.8, rough: 0.3 }), 12);
  shakerCap.position.set(-0.5, topY + 0.21, 0.5);
  const scoop = box(0.18, 0.16, 0.2, stdMat(0xd2d6db, { metal: 0.85, rough: 0.28 }));
  scoop.position.set(0.5, topY + 0.12, 0.52);
  scoop.rotation.x = -0.35;
  const scoopGrip = cyl(0.022, 0.022, 0.2, stdMat(0x2a2d33, { rough: 0.5 }), 8);
  scoopGrip.position.set(0.5, topY + 0.22, 0.66);
  scoopGrip.rotation.x = 0.7;

  const g = group(...legs(legH), cabinet, cooktop, ...wells, panel, dial, trim, shakerBody, shakerCap, scoop, scoopGrip);
  const slotY = topY + 0.16;
  setSlots(g, [new THREE.Vector3(-0.45, slotY, 0), new THREE.Vector3(0.45, slotY, 0)]);
  return g;
}

function buildPrep(): THREE.Group {
  const bodyH = 0.86;
  const legH = 0.2;
  const body = box(FOOT, bodyH, FOOT, stdMat(COLORS.prep, STEEL));
  body.position.y = legH + bodyH / 2;

  const topY = legH + bodyH;
  // Brushed stainless counter top with a raised back lip.
  const counter = box(FOOT, 0.08, FOOT, stdMat(0xc2c7cd, STEEL_BRIGHT));
  counter.position.y = topY + 0.04;
  const lip = box(FOOT, 0.08, 0.06, stdMat(0xb6bcc4, STEEL_BRIGHT));
  lip.position.set(0, topY + 0.1, -FOOT / 2 + 0.03);

  // Wood cutting board stays matte.
  const board = box(0.95, 0.06, 0.7, stdMat(0x9c6b3f, { rough: 0.8 }));
  board.position.set(0, topY + 0.11, 0.05);

  // Pull handle + dark seam line read as a drawer.
  const handle = box(0.46, 0.05, 0.05, stdMat(0xb6bcc4, { metal: 0.9, rough: 0.25 }));
  handle.position.set(0, legH + bodyH * 0.6, FOOT / 2 + 0.04);
  const trim = trimBand(legH + bodyH * 0.35);

  // A chef's knife laid across the front-left of the board + a couple of prepped
  // bits in the back-right corner so it reads as a working station, not a slab.
  const boardY = topY + 0.14;
  const blade = box(0.36, 0.02, 0.11, stdMat(0xd7dbe0, { metal: 0.92, rough: 0.18 }));
  blade.position.set(-0.34, boardY, 0.32);
  blade.rotation.y = 0.5;
  const knifeHandle = box(0.13, 0.04, 0.045, stdMat(0x2a2d33, { rough: 0.45 }));
  knifeHandle.position.set(-0.56, boardY, 0.45);
  knifeHandle.rotation.y = 0.5;
  const tomatoBit = cyl(0.1, 0.1, 0.03, stdMat(0xf2543c, { rough: 0.25, metal: 0.03 }), 14);
  tomatoBit.position.set(0.42, boardY, -0.2);
  const lettuceBit = new THREE.Mesh(LEAF_GEO, stdMat(0x6cbf52, { rough: 0.6, flat: true }));
  lettuceBit.scale.set(0.9, 0.5, 0.9);
  lettuceBit.position.set(0.3, boardY + 0.02, 0.0);

  const g = group(...legs(legH), body, counter, lip, board, handle, trim, blade, knifeHandle, tomatoBit, lettuceBit);
  setSlots(g, [new THREE.Vector3(0, topY + 0.16, 0)]);
  return g;
}

function buildDrink(): THREE.Group {
  const bodyH = 0.5;
  const base = box(FOOT, bodyH, FOOT * 0.7, stdMat(COLORS.drink, { metal: 0.55, rough: 0.4 }));
  base.position.set(0, bodyH / 2, 0.1);

  const topY = bodyH;

  // Metallic fountain tower rising from the back.
  const towerH = 0.78;
  const tower = box(FOOT * 0.82, towerH, 0.26, stdMat(0xc2c7cd, STEEL_BRIGHT));
  tower.position.set(0, topY + towerH / 2, -0.42);
  // Subtle darker trim line down the tower face.
  const towerTrim = box(FOOT * 0.82, 0.04, 0.02, stdMat(0x2f5d8c, { metal: 0.5, rough: 0.4 }));
  towerTrim.position.set(0, topY + towerH * 0.5, -0.28);

  // Stainless drip tray with a perforated-look insert.
  const dripTray = box(FOOT * 0.9, 0.06, 0.4, stdMat(0x9aa0a8, STEEL));
  dripTray.position.set(0, topY + 0.03, 0.4);
  const grate = box(FOOT * 0.82, 0.02, 0.32, stdMat(0x6f767e, { metal: 0.7, rough: 0.45 }));
  grate.position.set(0, topY + 0.07, 0.4);

  const nozzleMat = stdMat(0xced3da, STEEL_BRIGHT);
  const leverMat = stdMat(0x2f5d8c, { metal: 0.4, rough: 0.4 });
  const nozzles: THREE.Mesh[] = [];
  for (const sx of [-0.45, 0.45]) {
    const nz = cyl(0.05, 0.07, 0.18, nozzleMat, 10);
    nz.position.set(sx, topY + 0.28, -0.26);
    nozzles.push(nz);
    const lever = box(0.05, 0.16, 0.05, leverMat);
    lever.position.set(sx, topY + 0.42, -0.2);
    lever.rotation.x = -0.4;
    nozzles.push(lever);
  }

  // A short stack of empty cups waiting to be filled, on the front-left.
  const cups: THREE.Mesh[] = [];
  const cupMat = stdMat(0xfafaff, { rough: 0.3, metal: 0.04 });
  for (let i = 0; i < 3; i++) {
    const cup = cyl(0.12, 0.09, 0.16, cupMat, 14);
    cup.position.set(-0.62, topY + 0.1 + i * 0.05, 0.36);
    cups.push(cup);
  }
  // A glowing brand panel on the tower front so the fountain reads lively.
  const brand = box(FOOT * 0.5, 0.3, 0.02, stdMat(0x9fe3ff, { emissive: 0x4fbfff, emissiveIntensity: 0.7, rough: 0.4 }));
  brand.position.set(0, topY + 0.5, -0.27);

  const g = group(base, tower, towerTrim, dripTray, grate, ...nozzles, ...cups, brand);
  const slotY = topY + 0.06;
  setSlots(g, [new THREE.Vector3(-0.45, slotY, 0.4), new THREE.Vector3(0.45, slotY, 0.4)]);
  return g;
}

function buildTrash(): THREE.Group {
  const bodyH = 0.7;
  const body = cyl(0.42, 0.34, bodyH, stdMat(COLORS.trash, { metal: 0.5, rough: 0.45 }), 18);
  body.position.y = bodyH / 2;

  // Two metallic band lines wrapping the bin.
  const bands: THREE.Mesh[] = [];
  for (const [by, br] of [[bodyH * 0.35, 0.4], [bodyH * 0.7, 0.43]] as const) {
    const band = cyl(br, br, 0.03, stdMat(0x6f767e, { metal: 0.8, rough: 0.3 }), 18);
    band.position.y = by;
    bands.push(band);
  }

  const rim = cyl(0.45, 0.45, 0.05, stdMat(0x70757c, { metal: 0.6, rough: 0.35 }), 18);
  rim.position.y = bodyH;

  // Swing lid: a slightly-domed disc (flattened sphere) resting on the rim.
  const lid = sphere(0.46, stdMat(0x80868e, { metal: 0.6, rough: 0.35 }), 16);
  lid.scale.y = 0.28;
  lid.position.y = bodyH + 0.08;

  // Small foot pedal up front.
  const pedal = box(0.34, 0.04, 0.16, stdMat(0x52575f, { metal: 0.7, rough: 0.4 }));
  pedal.position.set(0, 0.03, 0.42);

  const g = group(body, ...bands, rim, lid, pedal);
  setSlots(g, []);
  return g;
}

function buildBin(defId: string): THREE.Group {
  const color = COLORS[defId] ?? 0x888888;
  const isFridge = defId === "bin_patty";

  const bodyH = isFridge ? 1.1 : 0.85;
  // Fridge body is metallic; crates stay matte in their colour.
  const bodyMat = isFridge ? stdMat(0xbfc4ca, STEEL) : stdMat(color, { rough: 0.7 });
  const body = box(FOOT, bodyH, FOOT, bodyMat);
  body.position.y = bodyH / 2;

  const children: THREE.Object3D[] = [body];

  if (isFridge) {
    // Metallic fridge door inset with a long vertical handle + seam.
    const door = box(FOOT * 0.86, bodyH * 0.92, 0.04, stdMat(0xd2d6db, STEEL_BRIGHT));
    door.position.set(0, bodyH * 0.5, FOOT / 2 + 0.01);
    children.push(door);
    const handle = box(0.07, bodyH * 0.5, 0.07, stdMat(0x3a3d42, { metal: 0.8, rough: 0.3 }));
    handle.position.set(FOOT * 0.32, bodyH * 0.55, FOOT / 2 + 0.06);
    children.push(handle);
    const seam = box(FOOT * 0.86, 0.03, 0.05, stdMat(0x9aa0a8, { metal: 0.7, rough: 0.4 }));
    seam.position.set(0, bodyH * 0.62, FOOT / 2 + 0.02);
    children.push(seam);
    // A frosted glass window in the upper door revealing a stack of raw patties.
    const winY = bodyH * 0.66;
    const patties = box(FOOT * 0.5, 0.04, FOOT * 0.5, stdMat(0xe0697b, { rough: 0.45 }));
    for (let i = 0; i < 3; i++) {
      const p = patties.clone();
      p.position.set(0, winY - 0.12 + i * 0.07, FOOT / 2 - 0.06);
      children.push(p);
    }
    const glass = box(FOOT * 0.62, bodyH * 0.34, 0.03, stdMat(0xcfe6ef, { rough: 0.05, metal: 0.1, transparent: true, opacity: 0.34 }));
    glass.position.set(0, winY, FOOT / 2 + 0.05);
    children.push(glass);
    const frame = box(FOOT * 0.7, bodyH * 0.42, 0.03, stdMat(0x9aa0a8, { metal: 0.8, rough: 0.3 }));
    frame.position.set(0, winY, FOOT / 2 + 0.035);
    children.push(frame);
    // Patty-coloured accent stripe so it still reads as the patty source.
    const accent = box(FOOT * 0.86, 0.06, 0.02, stdMat(color, { rough: 0.6 }));
    accent.position.set(0, bodyH * 0.16, FOOT / 2 + 0.03);
    children.push(accent);
  } else {
    // Lighter front panel keyed to the bin colour.
    const front = box(FOOT * 0.86, bodyH * 0.7, 0.04, stdMat(mix(color, 0xffffff, 0.28), { rough: 0.6 }));
    front.position.set(0, bodyH * 0.42, FOOT / 2 + 0.01);
    children.push(front);
    // Metallic handle.
    const handle = box(0.5, 0.07, 0.06, stdMat(0x3a3d42, { metal: 0.7, rough: 0.35 }));
    handle.position.set(0, bodyH * 0.62, FOOT / 2 + 0.05);
    children.push(handle);
    // Open-topped crate: a thin rim frame around the mouth (instead of a solid
    // lid) so the ingredient heaped inside is visible.
    const rimMat = stdMat(mix(color, 0x000000, 0.2), { rough: 0.7 });
    for (const [w, d, x, z] of [
      [FOOT * 0.98, 0.1, 0, FOOT * 0.44],
      [FOOT * 0.98, 0.1, 0, -FOOT * 0.44],
      [0.1, FOOT * 0.78, FOOT * 0.44, 0],
      [0.1, FOOT * 0.78, -FOOT * 0.44, 0],
    ] as const) {
      const rail = box(w, 0.09, d, rimMat);
      rail.position.set(x, bodyH + 0.02, z);
      children.push(rail);
    }
    // …and the food itself, brimming over the rim.
    children.push(...crateFill(defId, bodyH));
  }

  // Small label plate on the front (both kinds).
  const label = box(0.42, 0.22, 0.02, stdMat(0xf4f1e8, { rough: 0.8 }));
  label.position.set(0, bodyH * (isFridge ? 0.28 : 0.3), FOOT / 2 + 0.05);
  children.push(label);

  const g = group(...children);
  setSlots(g, []);
  return g;
}

/** Linear blend between two packed RGB colours by `t` (0..1). */
function mix(a: number, b: number, t: number): number {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, t).getHex();
}

function buildPlaceholder(): THREE.Group {
  const b = box(FOOT, 1.0, FOOT, stdMat(0x808080, { rough: 0.8 }));
  b.position.y = 0.5;
  const g = group(b);
  setSlots(g, []);
  return g;
}

export function buildStation(defId: string): THREE.Group {
  switch (defId) {
    case "grill":
      return buildGrill();
    case "fryer":
      return buildFryer();
    case "prep":
      return buildPrep();
    case "drink":
      return buildDrink();
    case "trash":
      return buildTrash();
    case "bin_bun":
    case "bin_patty":
    case "bin_potato":
    case "bin_cheese":
    case "bin_lettuce":
    case "bin_tomato":
      return buildBin(defId);
    default:
      return buildPlaceholder();
  }
}
