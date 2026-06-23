// Procedural cooking-station meshes for the toy diner. Pure rendering — no game
// logic. Each station exposes its cook-slot positions (local) via
// group.userData.slots: THREE.Vector3[] so the SceneView can rest food on top.

import * as THREE from "three";
import type { StationId, StationStyle } from "../game/types";
import { stdMat, box, cyl, sphere, group } from "./kit";

const FOOT = 1.7;
const STEEL = { metal: 0.8, rough: 0.35 } as const;
const STEEL_BRIGHT = { metal: 0.85, rough: 0.28 } as const;

// Equipment customization: `body` recolours the cook-station cabinets, `trim`
// the warm accent bezels/brand panels/fronts. Fallbacks reproduce a cohesive
// default kitchen. Specialty machines (fountain, ice-cream) keep their character.
const DEF_BODY = 0x6f7480;
const DEF_TRIM = 0xffd27a;
const bodyOf = (s?: StationStyle): number => s?.body ?? DEF_BODY;
const trimOf = (s?: StationStyle): number => s?.trim ?? DEF_TRIM;

function setSlots(g: THREE.Group, slots: THREE.Vector3[]): void {
  g.userData.slots = slots;
}
function dome(mesh: THREE.Mesh, sy: number): THREE.Mesh {
  mesh.scale.y = sy;
  return mesh;
}
function legs(top: number): THREE.Mesh[] {
  const mat = stdMat(0x23262b, { metal: 0.7, rough: 0.4 });
  const dx = FOOT / 2 - 0.18;
  const out: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = cyl(0.05, 0.06, top, mat, 8);
    leg.position.set(sx * dx, top / 2, sz * dx);
    out.push(leg);
  }
  return out;
}
function knob(x: number, y: number, z: number, color: number): THREE.Mesh {
  const k = cyl(0.06, 0.06, 0.05, stdMat(color, { metal: 0.5, rough: 0.4 }), 12);
  k.rotation.x = Math.PI / 2;
  k.position.set(x, y, z);
  return k;
}

function buildGrill(style?: StationStyle): THREE.Group {
  const bodyH = 0.78, legH = 0.22;
  const cabinet = box(FOOT, bodyH, FOOT, stdMat(bodyOf(style), { metal: 0.4, rough: 0.45 }));
  cabinet.position.y = legH + bodyH / 2;
  const topY = legH + bodyH;
  const bezel = box(FOOT, 0.05, FOOT, stdMat(trimOf(style), { metal: 0.3, rough: 0.45 }));
  bezel.position.y = topY + 0.025;
  const firebox = box(FOOT * 0.86, 0.09, FOOT * 0.78, stdMat(0x141517, { metal: 0.35, rough: 0.65 }));
  firebox.position.set(0, topY + 0.045, -0.02);
  const embers = box(FOOT * 0.8, 0.02, FOOT * 0.72, stdMat(0x6e2410, { rough: 0.85 })); // matte warm coals — no glow
  embers.position.set(0, topY + 0.08, -0.02);
  const grateMat = stdMat(0x1b1d20, { metal: 0.35, rough: 0.55 });
  const grates: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const rib = box(FOOT * 0.82, 0.04, 0.06, grateMat);
    rib.position.set(0, topY + 0.12, -0.5 + i * 0.25);
    grates.push(rib);
  }
  const riser = box(FOOT * 0.96, 0.5, 0.06, stdMat(0x7d828a, { metal: 0.35, rough: 0.55 }));
  riser.position.set(0, topY + 0.28, -FOOT / 2 + 0.04);
  const panel = box(FOOT * 0.94, 0.22, 0.05, stdMat(0x34383e, STEEL));
  panel.position.set(0, legH + bodyH * 0.5, FOOT / 2 + 0.015);
  const g = group(...legs(legH), cabinet, bezel, firebox, embers, ...grates, riser, panel,
    knob(-0.45, legH + bodyH * 0.5, FOOT / 2 + 0.05, 0xd14b2a), knob(0.45, legH + bodyH * 0.5, FOOT / 2 + 0.05, 0xd14b2a));
  const slotY = topY + 0.16;
  setSlots(g, [new THREE.Vector3(-0.45, slotY, 0), new THREE.Vector3(0.45, slotY, 0)]);
  return g;
}

function buildFryer(style?: StationStyle): THREE.Group {
  const bodyH = 0.8, legH = 0.2;
  const cabinet = box(FOOT, bodyH, FOOT, stdMat(bodyOf(style), { metal: 0.2, rough: 0.5 }));
  cabinet.position.y = legH + bodyH / 2;
  const topY = legH + bodyH;
  const cooktop = box(FOOT * 0.98, 0.05, FOOT * 0.98, stdMat(0xb6bcc4, STEEL_BRIGHT));
  cooktop.position.y = topY + 0.025;
  const wellMat = stdMat(0x17181a, { metal: 0.7, rough: 0.35 });
  const oilMat = stdMat(0xf2a838, { rough: 0.32, metal: 0.05 }); // bright oil colour — no glow
  const parts: THREE.Object3D[] = [...legs(legH), cabinet, cooktop];
  for (const sx of [-0.45, 0.45]) {
    const well = cyl(0.32, 0.34, 0.18, wellMat, 16);
    well.position.set(sx, topY + 0.05, 0);
    const oil = cyl(0.27, 0.27, 0.02, oilMat, 16);
    oil.position.set(sx, topY + 0.14, 0);
    parts.push(well, oil);
  }
  const panel = box(FOOT * 0.94, 0.2, 0.05, stdMat(0x3a382f, STEEL));
  panel.position.set(0, legH + bodyH * 0.55, FOOT / 2 + 0.015);
  parts.push(panel, knob(0.4, legH + bodyH * 0.55, FOOT / 2 + 0.05, 0xe0922f));
  const g = group(...parts);
  const slotY = topY + 0.16;
  setSlots(g, [new THREE.Vector3(-0.45, slotY, 0), new THREE.Vector3(0.45, slotY, 0)]);
  return g;
}

function buildFountain(style?: StationStyle): THREE.Group {
  const bodyH = 0.5;
  const base = box(FOOT, bodyH, FOOT * 0.7, stdMat(0x3a6ea5, { metal: 0.55, rough: 0.4 }));
  base.position.set(0, bodyH / 2, 0.1);
  const topY = bodyH;
  const towerH = 0.78;
  const tower = box(FOOT * 0.82, towerH, 0.26, stdMat(0xc2c7cd, STEEL_BRIGHT));
  tower.position.set(0, topY + towerH / 2, -0.42);
  const dripTray = box(FOOT * 0.9, 0.06, 0.4, stdMat(0x9aa0a8, STEEL));
  dripTray.position.set(0, topY + 0.03, 0.4);
  const nozzleMat = stdMat(0xced3da, STEEL_BRIGHT);
  const parts: THREE.Object3D[] = [base, tower, dripTray];
  for (const sx of [-0.45, 0.45]) {
    const nz = cyl(0.05, 0.07, 0.18, nozzleMat, 10);
    nz.position.set(sx, topY + 0.28, -0.26);
    parts.push(nz);
  }
  const brand = box(FOOT * 0.5, 0.3, 0.02, stdMat(trimOf(style), { rough: 0.4, metal: 0.2 }));
  brand.position.set(0, topY + 0.5, -0.27);
  parts.push(brand);
  const g = group(...parts);
  setSlots(g, []);
  return g;
}

function buildIcecreamMachine(style?: StationStyle): THREE.Group {
  const bodyH = 1.1;
  const body = box(FOOT * 0.86, bodyH, FOOT * 0.7, stdMat(0xfff0f5, { rough: 0.4, metal: 0.05 }));
  body.position.set(0, bodyH / 2, 0);
  const top = dome(sphere(FOOT * 0.42, stdMat(0xffc4dd, { rough: 0.4 }), 18), 0.7);
  top.position.set(0, bodyH, 0);
  const spout = cyl(0.07, 0.1, 0.3, stdMat(0xd2d6db, STEEL_BRIGHT), 12);
  spout.position.set(0, bodyH * 0.62, FOOT * 0.36);
  const swirl = dome(sphere(0.12, stdMat(0xfff0f5, { rough: 0.35 }), 12), 1.4);
  swirl.position.set(0, bodyH * 0.5, FOOT * 0.36);
  const lever = box(0.06, 0.22, 0.06, stdMat(0xff5d9e, { rough: 0.4 }));
  lever.position.set(0.35, bodyH * 0.66, FOOT * 0.3);
  const brand = box(FOOT * 0.5, 0.26, 0.02, stdMat(trimOf(style), { rough: 0.5 }));
  brand.position.set(0, bodyH * 0.78, FOOT * 0.36);
  const g = group(body, top, spout, swirl, lever, brand);
  setSlots(g, []);
  return g;
}

function buildSourceBox(kind: StationId, style?: StationStyle): THREE.Group {
  const tint = kind === "meat" ? 0xe07a6e : kind === "sausage" ? 0xe88a78 : 0xd9a04e;
  const bodyH = 0.85;
  const body = box(FOOT, bodyH, FOOT, stdMat(0xc98a5a, { rough: 0.7 }));
  body.position.y = bodyH / 2;
  const front = box(FOOT * 0.86, bodyH * 0.7, 0.04, stdMat(trimOf(style), { rough: 0.6 }));
  front.position.set(0, bodyH * 0.42, FOOT / 2 + 0.01);
  const rimMat = stdMat(0x6a4326, { rough: 0.75 });
  const parts: THREE.Object3D[] = [body, front];
  for (const [w, d, x, z] of [
    [FOOT * 0.98, 0.1, 0, FOOT * 0.44], [FOOT * 0.98, 0.1, 0, -FOOT * 0.44],
    [0.1, FOOT * 0.78, FOOT * 0.44, 0], [0.1, FOOT * 0.78, -FOOT * 0.44, 0],
  ] as [number, number, number, number][]) {
    const rail = box(w, 0.09, d, rimMat);
    rail.position.set(x, bodyH + 0.02, z);
    parts.push(rail);
  }
  // A little heap of the raw item brimming over the crate.
  const heapMat = stdMat(tint, { rough: 0.5, metal: 0.03 });
  if (kind === "potato") {
    const geo = new THREE.IcosahedronGeometry(0.18, 0);
    const pm = stdMat(0xc8a063, { rough: 0.85, flat: true });
    for (const [x, z] of [[-0.16, 0], [0.16, 0.1], [0, -0.16]] as [number, number][]) {
      const p = new THREE.Mesh(geo, pm);
      p.castShadow = true;
      p.scale.set(1.35, 0.9, 0.95);
      p.position.set(x, bodyH + 0.06, z);
      parts.push(p);
    }
  } else if (kind === "sausage") {
    for (const [x, z, ry] of [[-0.15, 0.05, 0.3], [0.15, -0.05, -0.4], [0, 0.16, 0.8]] as [number, number, number][]) {
      const link = cyl(0.1, 0.1, 0.5, heapMat, 12);
      link.rotation.z = Math.PI / 2;
      link.rotation.y = ry;
      link.position.set(x, bodyH + 0.08, z);
      parts.push(link);
    }
  } else {
    for (const [x, z] of [[-0.16, 0.05], [0.18, -0.04], [0, 0.18]] as [number, number][]) {
      parts.push((() => { const m = dome(sphere(0.2, heapMat, 12), 0.5); m.position.set(x, bodyH + 0.06, z); return m; })());
    }
  }
  const g = group(...parts);
  setSlots(g, []);
  return g;
}

function buildTrash(): THREE.Group {
  const bodyH = 0.7;
  const body = cyl(0.42, 0.34, bodyH, stdMat(0x39414a, { metal: 0.5, rough: 0.45 }), 18);
  body.position.y = bodyH / 2;
  const rim = cyl(0.45, 0.45, 0.05, stdMat(0x70757c, { metal: 0.6, rough: 0.35 }), 18);
  rim.position.y = bodyH;
  const lid = dome(sphere(0.46, stdMat(0x80868e, { metal: 0.6, rough: 0.35 }), 16), 0.28);
  lid.position.y = bodyH + 0.08;
  const g = group(body, rim, lid);
  setSlots(g, []);
  return g;
}

export function buildStation(id: StationId, style?: StationStyle): THREE.Group {
  switch (id) {
    case "grill":
    case "hotgrill":
      return buildGrill(style);
    case "fryer":
      return buildFryer(style);
    case "soda":
      return buildFountain(style);
    case "icecream":
      return buildIcecreamMachine(style);
    case "meat":
    case "potato":
    case "sausage":
      return buildSourceBox(id, style);
    case "trash":
      return buildTrash();
    default:
      return buildSourceBox("meat", style);
  }
}
