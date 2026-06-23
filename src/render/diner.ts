// The diner room: a warm, sunny, candy-coloured space. Built once and never
// changes. Pure rendering. Exports the room shell + a cute table/chair builder
// that the SceneView places at each of G.tables.

import * as THREE from "three";
import { box, cyl, group, sphere, stdMat, canvasTex, labelSprite } from "./kit";
import type { DinerPalette, TableStyle } from "../game/types";

/** Convert a hex number (0xrrggbb) to a "#rrggbb" CSS string. */
function hexCss(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}

function checkerFloorTex(aHex: number, bHex: number): THREE.CanvasTexture {
  const tex = canvasTex(256, (ctx, s) => {
    const a = hexCss(aHex), b = hexCss(bHex);
    const n = 8, cell = s / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 7);
  return tex;
}

export function buildDinerRoom(palette?: DinerPalette, name?: string): THREE.Group {
  const wallC = palette?.wall ?? 0xa6d8c2;
  const floorA = palette?.floorA ?? 0xf0d0a0;
  const floorB = palette?.floorB ?? 0xe0b87e;
  const stripeC = palette?.stripe ?? 0xff9ec7;
  const windowC = palette?.window ?? 0xa9d8f0;

  const g = new THREE.Group();

  // Floor — warm checker tiles.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 28), new THREE.MeshStandardMaterial({ map: checkerFloorTex(floorA, floorB), roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -1);
  floor.receiveShadow = true;
  g.add(floor);

  // Back wall + side walls — soft mint, low so the camera sees over them.
  const wallMat = stdMat(wallC, { rough: 0.95 });
  const back = box(34, 7, 0.4, wallMat);
  back.position.set(0, 3.5, -10.2);
  back.receiveShadow = true;
  g.add(back);
  const stripe = box(34, 1.0, 0.42, stdMat(stripeC, { rough: 0.9 }));
  stripe.position.set(0, 5.4, -10.15);
  g.add(stripe);
  for (const sx of [-1, 1]) {
    const side = box(0.4, 7, 18, wallMat);
    side.position.set(sx * 13.6, 3.5, -1);
    side.receiveShadow = true;
    g.add(side);
  }

  // Sunny windows on the back wall — symmetric, leaving the centre clear for the
  // diner sign. (No emissive: bright sky colour, no glow.)
  for (const wx of [-9.5, -5.5, 5.5, 9.5]) {
    const sky = box(3.2, 2.5, 0.1, stdMat(windowC, { rough: 0.55 }));
    sky.position.set(wx, 4.0, -9.95);
    const frame = box(3.5, 2.8, 0.16, stdMat(0xf2efe6, { rough: 0.7 }));
    frame.position.set(wx, 4.0, -10.0);
    const sun = sphere(0.36, stdMat(0xffe9a0, { rough: 0.4 }), 12);
    sun.position.set(wx + 0.75, 4.55, -9.9);
    g.add(frame, sky, sun);
  }

  // Big friendly sign in the centre of the back wall — shows the player's chosen
  // diner name (auto-fit, never clipped), at window height so it's clearly
  // readable in-frame (not lost behind the top HUD).
  const sign = labelSprite((name && name.trim() ? name : "Grandma's Diner").toUpperCase(), "#ff7a3d", "#fff4ea", 3.4);
  sign.position.set(0, 3.3, -9.55);
  sign.scale.set(6.6, 1.4, 1);
  g.add(sign);

  // Hanging warm lamps over the dining area.
  for (const lx of [-6.5, 0, 6.5]) {
    const cord = cyl(0.02, 0.02, 1.4, stdMat(0x4a3a2a, { rough: 0.8 }), 6);
    cord.position.set(lx, 6.3, 1);
    const shade = cyl(0.5, 0.2, 0.4, stdMat(0xffd27a, { emissive: 0xffb84a, emissiveIntensity: 0.35, rough: 0.5 }), 14);
    shade.position.set(lx, 5.5, 1);
    g.add(cord, shade);
    // A faint warmth — intentionally tiny so it never casts a visible "glow" pool
    // on the floor (the key + hemisphere lights do the lighting).
    const lamp = new THREE.PointLight(0xffd49a, 0.28, 3.2, 2.4);
    lamp.position.set(lx, 5.2, 1);
    g.add(lamp);
  }

  // Potted plants in the corners.
  for (const px of [-12.4, 12.4]) {
    const pot = cyl(0.5, 0.36, 0.7, stdMat(0xff8f6b, { rough: 0.7 }), 14);
    pot.position.set(px, 0.35, 5.5);
    const leaves = sphere(0.9, stdMat(0x5fbf6a, { rough: 0.8 }), 12);
    leaves.scale.set(1, 1.3, 1);
    leaves.position.set(px, 1.5, 5.5);
    g.add(pot, leaves);
  }

  // Bunting balloons along the top of the back wall.
  for (let i = 0; i < 9; i++) {
    const hue = (i / 9);
    const c = new THREE.Color().setHSL(hue, 0.7, 0.62).getHex();
    const balloon = sphere(0.34, stdMat(c, { rough: 0.5 }), 12);
    balloon.scale.set(1, 1.2, 1);
    balloon.position.set(-12 + i * 3, 6.1, -9.4);
    g.add(balloon);
  }

  return g;
}

// ── Treat decorations — picking a treat visibly redecorates the diner ────────

/** "Big Crowd" — a festive balloon bunch. */
export function buildBalloons(): THREE.Group {
  const g = new THREE.Group();
  const colors = [0xff6f9c, 0xffd23a, 0x7aa8ff, 0xff5d5d, 0x9be86a];
  for (let i = 0; i < 7; i++) {
    const c = colors[i % colors.length];
    const b = sphere(0.42, stdMat(c, { rough: 0.45 }), 12);
    b.scale.set(1, 1.25, 1);
    const ang = (i / 7) * Math.PI * 2;
    b.position.set(Math.cos(ang) * 0.6, 3.2 + Math.sin(i) * 0.3, Math.sin(ang) * 0.4);
    const str = cyl(0.01, 0.01, 2.4, stdMat(0xeeeeee, { rough: 0.8 }), 5);
    str.position.set(b.position.x, b.position.y - 1.4, b.position.z);
    g.add(b, str);
  }
  return g;
}

/** "Extra Time" — a big friendly wall clock. */
export function buildWallClock(): THREE.Group {
  const face = cyl(0.9, 0.9, 0.12, stdMat(0xfff4e6, { rough: 0.5, emissive: 0xffe8c0, emissiveIntensity: 0.25 }), 22);
  face.rotation.x = Math.PI / 2;
  const rim = cyl(1.0, 1.0, 0.1, stdMat(0xff7a3d, { rough: 0.5 }), 22);
  rim.rotation.x = Math.PI / 2;
  rim.position.z = -0.02;
  const h1 = box(0.08, 0.5, 0.06, stdMat(0x3a2a22, { rough: 0.5 }));
  h1.position.set(0, 0.22, 0.08);
  const h2 = box(0.08, 0.35, 0.06, stdMat(0x3a2a22, { rough: 0.5 }));
  h2.position.set(0.16, 0.08, 0.08);
  h2.rotation.z = -1.1;
  return group(rim, face, h1, h2);
}

/** "Speedy Shoes" — a bright round rug under the action. */
export function buildRug(): THREE.Group {
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 28),
    new THREE.MeshStandardMaterial({ color: 0xff8fc4, roughness: 0.95 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.02;
  rug.receiveShadow = true;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 2.9, 28),
    new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.95, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  return group(rug, ring);
}

/** "Super Stove" — a bright flame that sits over an upgraded grill. */
export function buildFlame(): THREE.Group {
  // Flame-coloured cones (bright orange/yellow) but NO emissive — no glow bulb.
  const f1 = cyl(0.001, 0.22, 0.5, stdMat(0xff7a2a, { rough: 0.4 }), 10);
  const f2 = cyl(0.001, 0.13, 0.32, stdMat(0xffd23a, { rough: 0.4 }), 10);
  f2.position.y = 0.08;
  return group(f1, f2);
}

/** A cute round table with a chair (chair behind the seat, toward the kitchen). */
export function buildTable(style?: TableStyle): THREE.Group {
  const topC = style?.top ?? 0xfff0e0;
  const rimC = style?.rim ?? 0xff9ec7;
  const legC = style?.leg ?? 0xd98f5a;
  const chairC = style?.chair ?? 0x7ec4ff;

  const topMat = stdMat(topC, { rough: 0.5, metal: 0.05 });
  const top = cyl(0.85, 0.85, 0.12, topMat, 20);
  top.position.y = 0.92;
  top.castShadow = true;
  top.receiveShadow = true;
  const rim = cyl(0.88, 0.88, 0.06, stdMat(rimC, { rough: 0.5 }), 20);
  rim.position.y = 0.86;
  const post = cyl(0.12, 0.16, 0.9, stdMat(legC, { rough: 0.6 }), 12);
  post.position.y = 0.45;
  const foot = cyl(0.45, 0.45, 0.08, stdMat(legC, { rough: 0.6 }), 16);
  foot.position.y = 0.04;
  // A little vase on the table.
  const vase = cyl(0.08, 0.06, 0.18, stdMat(0x9fe3ff, { rough: 0.3, metal: 0.1 }), 10);
  vase.position.y = 1.07;
  const flower = sphere(0.12, stdMat(0xff5d9e, { rough: 0.5 }), 10);
  flower.position.y = 1.26;
  // Chair on the kitchen side of the table (where the guest sits).
  const chairMat = stdMat(chairC, { rough: 0.6 });
  const seat = box(0.6, 0.1, 0.6, chairMat);
  seat.position.set(0, 0.52, -0.55);
  const backRest = box(0.6, 0.6, 0.1, chairMat);
  backRest.position.set(0, 0.82, -0.82);
  return group(top, rim, post, foot, vase, flower, seat, backRest);
}
