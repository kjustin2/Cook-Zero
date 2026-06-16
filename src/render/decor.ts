// Procedural decoration meshes for the cute "toy kitchen". Pure rendering: no
// game-logic imports. Each builder returns a self-contained THREE.Group whose
// base sits on the floor (y=0) and is centered on the origin, fitting within one
// grid cell (~1.6 footprint, TILE=2.3). Animated items expose an Object3D on
// `group.userData.spin` (+ optional `spinAxis` "y"|"z") for the caller to rotate.

import * as THREE from "three";
import { box, canvasTex, cyl, group, sphere, stdMat, TILE } from "./kit";

// --- small shared helpers (all used below) ----------------------------------

/** Tag a group so the caller animates `spinner` each frame. */
function markSpin(g: THREE.Group, spinner: THREE.Object3D, axis: "y" | "z"): void {
  g.userData.spin = spinner;
  g.userData.spinAxis = axis;
}

/** A thin vertical pole/stand centered on origin, top at height `h`.
 *  Metallic so the IBL env map gives it a chromed accent. */
function pole(r: number, h: number, color: number): THREE.Mesh {
  const m = cyl(r, r, h, stdMat(color, { rough: 0.3, metal: 0.8 }), 14);
  m.position.y = h / 2;
  return m;
}

/** A flat circular base disc on the floor with a brushed-metal sheen. */
function baseDisc(r: number, color: number): THREE.Mesh {
  const m = cyl(r, r * 1.06, 0.06, stdMat(color, { rough: 0.35, metal: 0.7 }), 22);
  m.position.y = 0.03;
  return m;
}

// --- per-decor builders ------------------------------------------------------

function buildFan(): THREE.Group {
  const g = group();
  g.add(baseDisc(0.34, 0x6b7680));
  g.add(pole(0.045, 1.05, 0x9fb6c4));

  const headY = 1.18;
  // Chromed guard cage: an outer ring + a smaller inner ring facing +Z.
  const ringMat = stdMat(0xc6d3dc, { rough: 0.25, metal: 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 24), ringMat);
  ring.position.y = headY;
  g.add(ring);
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 6, 20), ringMat);
  innerRing.position.set(0, headY, 0.03);
  g.add(innerRing);
  // Cage cross-wires across the face.
  for (let i = 0; i < 4; i++) {
    const wire = cyl(0.01, 0.01, 0.82, ringMat, 6);
    wire.position.set(0, headY, 0.015);
    wire.rotation.z = (i / 4) * Math.PI;
    g.add(wire);
  }
  // Motor housing behind the hub.
  const motor = cyl(0.13, 0.15, 0.16, stdMat(0x7d8590, { rough: 0.4, metal: 0.6 }), 14);
  motor.rotation.x = Math.PI / 2;
  motor.position.set(0, headY, -0.12);
  g.add(motor);

  // Hub + blades grouped into one spinner that rotates about Z (faces +Z).
  const spinner = new THREE.Group();
  spinner.position.set(0, headY, 0.02);
  const hub = sphere(0.07, stdMat(0x7d8590, { rough: 0.4, metal: 0.5 }), 10);
  spinner.add(hub);
  const bladeMat = stdMat(0xcfe0ea, { rough: 0.35, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 4; i++) {
    const blade = box(0.1, 0.34, 0.015, bladeMat);
    blade.position.y = 0.2;
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / 4) * Math.PI * 2;
    pivot.add(blade);
    // Angle each blade slightly to read as a real fan pitch.
    blade.rotation.y = 0.5;
    spinner.add(pivot);
  }
  g.add(spinner);
  markSpin(g, spinner, "z");
  return g;
}

function buildHood(): THREE.Group {
  const g = group();
  // Brushed stainless so the canopy reflects the room.
  const metal = stdMat(0xb8bfc6, { rough: 0.3, metal: 0.85 });

  // Tall back post mounting the canopy high up.
  const post = box(0.12, 1.9, 0.12, metal);
  post.position.set(0, 0.95, -0.62);
  g.add(post);

  // Angled canopy: wide top box + a tapered lower lip via a second box.
  const canopyY = 1.66;
  const top = box(1.4, 0.22, 0.66, metal);
  top.position.set(0, canopyY + 0.18, -0.18);
  g.add(top);

  const skirt = box(1.0, 0.36, 0.5, metal);
  skirt.position.set(0, canopyY - 0.12, -0.05);
  skirt.rotation.x = 0.22; // tilt the trapezoid lip forward
  g.add(skirt);

  // Dark vent slats across the front of the canopy.
  const ventMat = stdMat(0x3a4047, { rough: 0.8 });
  for (let i = 0; i < 3; i++) {
    const vent = box(0.86, 0.05, 0.03, ventMat);
    vent.position.set(0, canopyY + 0.04 - i * 0.07, 0.24);
    g.add(vent);
  }

  // Warm under-hood task light strip (gentle glow).
  const light = box(0.7, 0.04, 0.1, stdMat(0xfff1d0, { emissive: 0xffe6b0, emissiveIntensity: 0.8, rough: 0.4 }));
  light.position.set(0, canopyY - 0.3, 0.12);
  g.add(light);

  return g;
}

function buildSpice(): THREE.Group {
  const g = group();
  const wood = stdMat(0xc06a3a, { rough: 0.85, metal: 0.02 });

  // Two-tier wooden shelf: back panel + two shelves on short legs.
  const back = box(1.1, 0.7, 0.05, wood);
  back.position.set(0, 0.85, -0.18);
  g.add(back);
  const lowShelf = box(1.1, 0.05, 0.28, wood);
  lowShelf.position.set(0, 0.6, -0.05);
  g.add(lowShelf);
  const highShelf = box(1.1, 0.05, 0.28, wood);
  highShelf.position.set(0, 0.92, -0.05);
  g.add(highShelf);

  const legL = box(0.05, 0.6, 0.05, wood);
  legL.position.set(-0.5, 0.3, -0.05);
  g.add(legL);
  const legR = box(0.05, 0.6, 0.05, wood);
  legR.position.set(0.5, 0.3, -0.05);
  g.add(legR);

  // Little jars with colored caps in varied warm tones.
  const jarMat = stdMat(0xe7d8b8, { rough: 0.3, transparent: true, opacity: 0.85 });
  const caps = [0xd24b3a, 0xe0922f, 0xc9b23a, 0xa6552b, 0xd56b9c, 0xb5573f];
  for (let i = 0; i < 6; i++) {
    const onTop = i >= 3;
    const x = -0.38 + (i % 3) * 0.38;
    const y = onTop ? 1.04 : 0.72;
    const jar = cyl(0.07, 0.07, 0.16, jarMat, 10);
    jar.position.set(x, y, -0.05);
    g.add(jar);
    const cap = cyl(0.072, 0.072, 0.04, stdMat(caps[i], { rough: 0.5 }), 10);
    cap.position.set(x, y + 0.1, -0.05);
    g.add(cap);
  }
  return g;
}

function buildPlant(): THREE.Group {
  const g = group();
  // Terracotta tapered pot.
  const pot = cyl(0.34, 0.24, 0.42, stdMat(0xb5613a, { rough: 0.9 }), 16);
  pot.position.y = 0.21;
  g.add(pot);
  const rim = cyl(0.37, 0.34, 0.07, stdMat(0xc06a3a, { rough: 0.9 }), 16);
  rim.position.y = 0.42;
  g.add(rim);

  // Soil cap.
  const soil = cyl(0.31, 0.31, 0.05, stdMat(0x3a2a1c, { rough: 1 }), 16);
  soil.position.y = 0.44;
  g.add(soil);

  // Squashed flat-shaded foliage blobs (icosahedra) in green.
  const leaf = stdMat(0x4f9d52, { rough: 0.8, flat: true });
  const blobs: Array<[number, number, number, number]> = [
    [0, 0.78, 0, 0.36],
    [-0.22, 0.62, 0.1, 0.26],
    [0.24, 0.66, -0.06, 0.24],
    [0.04, 0.96, -0.08, 0.22],
  ];
  for (const [x, y, z, r] of blobs) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf);
    blob.position.set(x, y, z);
    blob.scale.y = 0.72; // squash vertically
    blob.castShadow = true;
    blob.receiveShadow = true;
    g.add(blob);
  }
  return g;
}

function buildFlowers(): THREE.Group {
  const g = group();
  // Slim vase.
  const vaseMat = stdMat(0xdfe7ee, { rough: 0.2, metal: 0.1, transparent: true, opacity: 0.8 });
  const vase = cyl(0.13, 0.18, 0.5, vaseMat, 14);
  vase.position.y = 0.25;
  g.add(vase);
  const neck = cyl(0.11, 0.13, 0.08, vaseMat, 14);
  neck.position.y = 0.52;
  g.add(neck);

  // A few flower heads on thin stems.
  const stemMat = stdMat(0x4f9d52, { rough: 0.8 });
  const headColors = [0xd56b9c, 0xf2c879, 0xff7f6e, 0x9b6bd5, 0xffffff];
  const offsets: Array<[number, number]> = [
    [0, 0.0],
    [-0.12, 0.18],
    [0.13, 0.12],
    [-0.05, -0.14],
    [0.08, -0.1],
  ];
  for (let i = 0; i < 5; i++) {
    const [ox, oz] = offsets[i];
    const stemH = 0.36 + (i % 3) * 0.08;
    const stem = cyl(0.012, 0.012, stemH, stemMat, 6);
    stem.position.set(ox, 0.56 + stemH / 2, oz);
    stem.rotation.z = ox * 0.6;
    g.add(stem);
    const head = sphere(0.085, stdMat(headColors[i], { rough: 0.5, flat: true }), 10);
    head.position.set(ox * 1.25, 0.56 + stemH, oz);
    g.add(head);
  }
  return g;
}

function buildLamp(): THREE.Group {
  const g = group();
  g.add(baseDisc(0.3, 0x4a4f57));
  g.add(pole(0.04, 1.5, 0x5a606a));

  // Chromed collar where the shade meets the pole.
  const collar = cyl(0.1, 0.12, 0.08, stdMat(0xd2d6db, { rough: 0.25, metal: 0.85 }), 16);
  collar.position.y = 1.4;
  g.add(collar);

  // Glowing warm shade (cone) that blooms.
  const shadeMat = stdMat(0xf2c879, { emissive: 0xf2c879, emissiveIntensity: 1.2, rough: 0.5 });
  const shade = cyl(0.12, 0.46, 0.5, shadeMat, 18);
  shade.position.y = 1.62;
  g.add(shade);
  // Metallic trim ring around the shade's wide bottom rim.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.02, 8, 22), stdMat(0xd2d6db, { rough: 0.25, metal: 0.85 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.38;
  g.add(rim);

  // Inner glow nub so the bloom reads from below too.
  const bulb = sphere(0.14, stdMat(0xfff3d6, { emissive: 0xfff0cf, emissiveIntensity: 1.4 }), 10);
  bulb.position.y = 1.46;
  g.add(bulb);
  return g;
}

function buildPainting(): THREE.Group {
  const g = group();
  // Wall-mounted style frame standing upright on a thin foot.
  const frameMat = stdMat(0x8a6bbf, { rough: 0.6, metal: 0.1 });
  const fw = 1.1;
  const fh = 0.86;
  const t = 0.07;

  // Frame border = four boxes around the canvas.
  const top = box(fw, t, 0.06, frameMat);
  top.position.set(0, 1.1 + fh / 2, 0);
  const bot = box(fw, t, 0.06, frameMat);
  bot.position.set(0, 1.1 - fh / 2, 0);
  const left = box(t, fh, 0.06, frameMat);
  left.position.set(-fw / 2 + t / 2, 1.1, 0);
  const right = box(t, fh, 0.06, frameMat);
  right.position.set(fw / 2 - t / 2, 1.1, 0);
  g.add(top, bot, left, right);

  // Painted canvas via canvasTex: sky/landscape + a sun.
  const tex = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#7ec8e3";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#f6d365";
    ctx.beginPath();
    ctx.arc(s * 0.72, s * 0.28, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4f9d52";
    ctx.fillRect(0, s * 0.62, s, s * 0.2);
    ctx.fillStyle = "#3a7d3d";
    ctx.fillRect(0, s * 0.78, s, s * 0.22);
    ctx.fillStyle = "#d56b9c";
    ctx.fillRect(s * 0.12, s * 0.5, s * 0.16, s * 0.14);
    ctx.fillStyle = "#8a6bbf";
    ctx.fillRect(s * 0.5, s * 0.46, s * 0.14, s * 0.18);
  });
  const canvas = new THREE.Mesh(
    new THREE.PlaneGeometry(fw - t * 2, fh - t * 2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
  );
  canvas.position.set(0, 1.1, 0.02);
  g.add(canvas);

  // Thin foot/stand so it stands upright on the floor.
  const foot = box(0.5, 1.1, 0.08, frameMat);
  foot.position.set(0, 0.55, -0.03);
  g.add(foot);
  return g;
}

function buildSpeaker(): THREE.Group {
  const g = group();
  const cabMat = stdMat(0x33373d, { rough: 0.7, metal: 0.1 });
  // PA cabinet (tall dark box).
  const cab = box(0.78, 1.2, 0.5, cabMat);
  cab.position.y = 0.6;
  g.add(cab);

  // Brushed-metal corner caps (top + bottom) for a roadcase look.
  const capMat = stdMat(0xb6bcc4, { rough: 0.3, metal: 0.85 });
  for (const cy of [0.04, 1.16]) {
    const cap = box(0.8, 0.06, 0.52, capMat);
    cap.position.set(0, cy, 0);
    g.add(cap);
  }

  const coneMat = stdMat(0x1b1d22, { rough: 0.4, metal: 0.2 });
  const surroundMat = stdMat(0x6f767e, { rough: 0.3, metal: 0.7 });
  // Two round woofer cones recessed on the front (+Z), with metallic surrounds.
  for (let i = 0; i < 2; i++) {
    const y = 0.45 + i * 0.42;
    const surround = cyl(0.27, 0.27, 0.03, surroundMat, 18);
    surround.rotation.x = Math.PI / 2;
    surround.position.set(0, y, 0.25);
    g.add(surround);
    const cone = cyl(0.2, 0.24, 0.05, coneMat, 18);
    cone.rotation.x = Math.PI / 2;
    cone.position.set(0, y, 0.27);
    g.add(cone);
    const dust = sphere(0.06, stdMat(0x9aa0a8, { rough: 0.2, metal: 0.8 }), 10);
    dust.position.set(0, y, 0.31);
    g.add(dust);
  }

  // Tweeter near the top.
  const tweeter = cyl(0.08, 0.09, 0.05, surroundMat, 14);
  tweeter.rotation.x = Math.PI / 2;
  tweeter.position.set(0, 1.04, 0.26);
  g.add(tweeter);

  // Tiny emissive power LED.
  const led = sphere(0.03, stdMat(0x44ff88, { emissive: 0x44ff88, emissiveIntensity: 1.6 }), 8);
  led.position.set(0.3, 1.08, 0.26);
  g.add(led);
  return g;
}

function buildRug(): THREE.Group {
  const g = group();
  // Very thin wide slab lying flat on the floor.
  const base = box(1.5, 0.04, 1.5, stdMat(0xb5573f, { rough: 0.95, metal: 0 }));
  base.position.y = 0.02;
  g.add(base);
  // Lighter inset border stripe sitting just on top.
  const inset = box(1.18, 0.045, 1.18, stdMat(0xd98a6f, { rough: 0.95 }));
  inset.position.y = 0.025;
  g.add(inset);
  // Inner field back to the base tone for a bordered look.
  const field = box(0.86, 0.05, 0.86, stdMat(0xa84d36, { rough: 0.95 }));
  field.position.y = 0.027;
  g.add(field);
  return g;
}

function buildNeon(): THREE.Group {
  const g = group();
  // Chromed stand + dark backing panel with a thin metal frame.
  g.add(pole(0.035, 0.9, 0x9aa0a8));
  const panel = box(1.05, 0.74, 0.05, stdMat(0x1a1c20, { rough: 0.6 }));
  panel.position.set(0, 1.2, -0.04);
  g.add(panel);
  const frame = box(1.12, 0.81, 0.03, stdMat(0x6f767e, { rough: 0.3, metal: 0.8 }));
  frame.position.set(0, 1.2, -0.06);
  g.add(frame);

  // Bright magenta emissive tubes forming an abstract glowing star + bar.
  const tube = stdMat(0xff4fd8, { emissive: 0xff4fd8, emissiveIntensity: 1.6, rough: 0.3 });
  const star = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 8, 24), tube);
  star.position.set(-0.22, 1.28, 0);
  g.add(star);

  // A few bent bars suggesting an "OPEN"-ish glow.
  const barDefs: Array<[number, number, number, number]> = [
    [0.18, 1.42, 0.34, 0],
    [0.18, 1.14, 0.34, 0],
    [0.36, 1.28, 0.28, Math.PI / 2],
    [0.0, 1.28, 0.28, Math.PI / 2],
  ];
  for (const [x, y, len, rot] of barDefs) {
    const bar = cyl(0.022, 0.022, len, tube, 8);
    bar.rotation.z = rot;
    bar.position.set(x, y, 0.01);
    g.add(bar);
  }
  return g;
}

function buildMenuboard(): THREE.Group {
  const g = group();
  // A-frame style legs.
  const wood = stdMat(0x6b4a2f, { rough: 0.85, metal: 0.02 });
  const legL = box(0.06, 1.3, 0.06, wood);
  legL.position.set(-0.5, 0.65, 0.06);
  legL.rotation.z = 0.06;
  g.add(legL);
  const legR = box(0.06, 1.3, 0.06, wood);
  legR.position.set(0.5, 0.65, 0.06);
  legR.rotation.z = -0.06;
  g.add(legR);

  // Wooden frame around the chalkboard.
  const frame = box(1.16, 0.96, 0.06, wood);
  frame.position.set(0, 0.86, 0);
  g.add(frame);

  // Chalk text via canvasTex on a dark board.
  const tex = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#2f3640";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "#eef3e7";
    ctx.fillStyle = "#eef3e7";
    ctx.lineWidth = 4;
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillText("MENU", s * 0.3, s * 0.16);
    const rows = [0.34, 0.5, 0.66, 0.82];
    for (const r of rows) {
      ctx.beginPath();
      ctx.moveTo(s * 0.12, s * r);
      ctx.lineTo(s * 0.62, s * r);
      ctx.stroke();
      ctx.font = "26px system-ui, sans-serif";
      ctx.fillText("$" + Math.round(2 + r * 9), s * 0.74, s * r + 8);
    }
  });
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.82),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }),
  );
  board.position.set(0, 0.86, 0.035);
  g.add(board);
  return g;
}

function buildAquarium(): THREE.Group {
  const g = group();
  // Wooden stand.
  const stand = box(1.2, 0.5, 0.6, stdMat(0x6b4a2f, { rough: 0.85 }));
  stand.position.y = 0.25;
  g.add(stand);

  const tankY = 0.5;
  const tankH = 0.62;
  // Translucent water inside the glass.
  const water = box(1.04, tankH - 0.06, 0.5, stdMat(0x2aa9b8, { transparent: true, opacity: 0.4, rough: 0.2 }));
  water.position.y = tankY + (tankH - 0.06) / 2;
  g.add(water);

  // Glass shell (transparent, light blue).
  const glass = box(1.1, tankH, 0.56, stdMat(0xbfe9ef, { transparent: true, opacity: 0.25, rough: 0.05, metal: 0.1 }));
  glass.position.y = tankY + tankH / 2;
  g.add(glass);

  // Pebbles at the bottom.
  const pebbleMat = stdMat(0x8a7d6a, { rough: 1, flat: true });
  for (let i = 0; i < 3; i++) {
    const peb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), pebbleMat);
    peb.position.set(-0.3 + i * 0.3, tankY + 0.06, 0);
    peb.scale.y = 0.6;
    g.add(peb);
  }

  // A couple of tiny fish grouped so the caller can slowly rotate them about Y.
  const spinner = new THREE.Group();
  spinner.position.set(0, tankY + tankH / 2, 0);
  const fishColors = [0xff8a3a, 0xf2c879];
  for (let i = 0; i < 2; i++) {
    const fish = sphere(0.07, stdMat(fishColors[i], { rough: 0.5, flat: true }), 8);
    fish.scale.set(1.4, 0.8, 0.6); // ellipsoid body
    const orbit = new THREE.Group();
    orbit.rotation.y = i * Math.PI;
    fish.position.set(0.3, (i - 0.5) * 0.12, 0);
    orbit.add(fish);
    spinner.add(orbit);
  }
  g.add(spinner);
  markSpin(g, spinner, "y");
  return g;
}

function buildTv(): THREE.Group {
  const g = group();
  // Slim stand + neck so it reads as a wall/stand TV.
  g.add(baseDisc(0.28, 0x16181c));
  const neck = box(0.12, 0.7, 0.12, stdMat(0x1c2026, { rough: 0.6, metal: 0.3 }));
  neck.position.y = 0.55;
  g.add(neck);

  const bezelY = 1.2;
  // Glossy dark bezel box with a thin brushed-metal edge frame.
  const bezel = box(1.34, 0.84, 0.1, stdMat(0x1c2026, { rough: 0.35, metal: 0.4 }));
  bezel.position.y = bezelY;
  g.add(bezel);
  const edge = box(1.4, 0.9, 0.06, stdMat(0x8a9098, { rough: 0.3, metal: 0.85 }));
  edge.position.set(0, bezelY, -0.03);
  g.add(edge);

  // Bright glowing screen via canvasTex (color bars + a little sun scene).
  const tex = canvasTex(256, (ctx, s) => {
    const bars = ["#ff5d5d", "#ffd35d", "#5dff9b", "#5dd6ff", "#9b6bff", "#ff6bd6"];
    const bw = s / bars.length;
    for (let i = 0; i < bars.length; i++) {
      ctx.fillStyle = bars[i];
      ctx.fillRect(i * bw, 0, bw, s * 0.6);
    }
    ctx.fillStyle = "#14233a";
    ctx.fillRect(0, s * 0.6, s, s * 0.4);
    ctx.fillStyle = "#ffe27a";
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.62, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  });
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.7),
    new THREE.MeshStandardMaterial({
      map: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: tex,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    }),
  );
  screen.position.set(0, bezelY, 0.052);
  g.add(screen);
  return g;
}

function buildLights(): THREE.Group {
  const g = group();
  // Thin support bar/wire mounted high across the cell on two little posts.
  const wireMat = stdMat(0x4a4f57, { rough: 0.6, metal: 0.5 });
  const barY = 1.7;
  const postL = box(0.04, 0.5, 0.04, wireMat);
  postL.position.set(-0.72, barY - 0.25, -0.05);
  g.add(postL);
  const postR = box(0.04, 0.5, 0.04, wireMat);
  postR.position.set(0.72, barY - 0.25, -0.05);
  g.add(postR);

  // Six warm bulbs strung along a gently-drooping arc (parabolic sag).
  const bulbMat = stdMat(0xfff3d0, { emissive: 0xffe6a0, emissiveIntensity: 1.1, rough: 0.4 });
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); // 0..1 across the span
    const x = -0.66 + t * 1.32;
    const sag = 0.22 * (1 - Math.pow(2 * t - 1, 2)); // droop deepest at center
    const y = barY - sag;
    // Short wire segment hanging the bulb just below the cord.
    const cord = cyl(0.008, 0.008, 0.07, wireMat, 6);
    cord.position.set(x, y - 0.04, -0.05);
    g.add(cord);
    const bulb = sphere(0.06, bulbMat, 10);
    bulb.position.set(x, y - 0.1, -0.05);
    g.add(bulb);
  }
  return g;
}

function buildClock(): THREE.Group {
  const g = group();
  const mountY = 1.45;
  // Short back-mount peg holding the clock off the wall.
  const mount = cyl(0.05, 0.05, 0.12, stdMat(0x4a4f57, { rough: 0.5, metal: 0.4 }), 12);
  mount.rotation.x = Math.PI / 2;
  mount.position.set(0, mountY, -0.1);
  g.add(mount);

  // Dark rim ring + cream face.
  const rim = cyl(0.42, 0.42, 0.07, stdMat(0x2f3640, { rough: 0.6, metal: 0.2 }), 28);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, mountY, -0.04);
  g.add(rim);
  const face = cyl(0.37, 0.37, 0.04, stdMat(0xe8e2d0, { rough: 0.7 }), 28);
  face.rotation.x = Math.PI / 2;
  face.position.set(0, mountY, 0.0);
  g.add(face);

  // Four tick marks at 12/3/6/9.
  const tickMat = stdMat(0x2f3640, { rough: 0.6 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const tick = box(0.03, 0.07, 0.02, tickMat);
    tick.position.set(Math.sin(a) * 0.3, mountY + Math.cos(a) * 0.3, 0.03);
    g.add(tick);
  }

  // Two hands (hour shorter, minute longer) + a center hub.
  const handMat = stdMat(0x33373d, { rough: 0.5 });
  const hour = box(0.03, 0.18, 0.02, handMat);
  hour.position.set(0.04, mountY + 0.08, 0.04);
  hour.rotation.z = -0.5;
  g.add(hour);
  const minute = box(0.025, 0.27, 0.02, handMat);
  minute.position.set(-0.07, mountY + 0.1, 0.04);
  minute.rotation.z = 0.6;
  g.add(minute);
  const hub = sphere(0.04, stdMat(0x2f3640, { rough: 0.4 }), 10);
  hub.position.set(0, mountY, 0.05);
  g.add(hub);
  return g;
}

function buildCat(): THREE.Group {
  const g = group();
  const fur = stdMat(0x9a7b5a, { rough: 0.8, flat: true });

  // Small round cushion to sit on.
  const cushion = cyl(0.42, 0.46, 0.12, stdMat(0xd56b9c, { rough: 0.85 }), 18);
  cushion.position.y = 0.06;
  cushion.scale.y = 0.9;
  g.add(cushion);

  // Rounded body (squashed sphere) sitting on the cushion.
  const body = sphere(0.34, fur, 14);
  body.scale.set(1, 0.95, 0.85);
  body.position.y = 0.42;
  g.add(body);

  // Head (sphere) atop the body.
  const head = sphere(0.27, fur, 14);
  head.position.set(0, 0.82, 0.05);
  g.add(head);

  // Two triangle ears via squashed low-poly cones.
  const earMat = stdMat(0x8a6c4d, { rough: 0.8, flat: true });
  for (const sx of [-1, 1]) {
    const ear = cyl(0.0, 0.12, 0.18, earMat, 3);
    ear.position.set(sx * 0.15, 1.02, 0.03);
    ear.rotation.z = sx * -0.2;
    g.add(ear);
  }

  // Dot eyes + tiny pink nose.
  const eyeMat = stdMat(0x1a1c20, { rough: 0.3 });
  for (const sx of [-1, 1]) {
    const eye = sphere(0.035, eyeMat, 8);
    eye.position.set(sx * 0.09, 0.86, 0.29);
    g.add(eye);
  }
  const nose = sphere(0.028, stdMat(0xd56b9c, { rough: 0.5 }), 8);
  nose.position.set(0, 0.79, 0.31);
  g.add(nose);

  // Tail as a swaying spinner pivoting at the body base (rocks about Z).
  const spinner = new THREE.Group();
  spinner.position.set(0.26, 0.36, -0.18);
  const tail = cyl(0.05, 0.07, 0.5, fur, 10);
  tail.position.set(0.08, 0.18, 0); // offset so the pivot reads at the base
  tail.rotation.z = -0.6;
  spinner.add(tail);
  g.add(spinner);
  markSpin(g, spinner, "z");
  return g;
}

function buildBalloons(): THREE.Group {
  const g = group();
  // Small floor weight anchoring the strings.
  const weight = cyl(0.16, 0.2, 0.16, stdMat(0x6f767e, { rough: 0.4, metal: 0.6 }), 16);
  weight.position.y = 0.08;
  g.add(weight);

  const colors = [0xff7fb0, 0x6fb6ff, 0xffd95d];
  const offs: Array<[number, number]> = [
    [-0.22, 0.04],
    [0.0, -0.06],
    [0.22, 0.05],
  ];
  const strMat = stdMat(0xdddddd, { rough: 0.7 });
  for (let i = 0; i < 3; i++) {
    const [ox, oz] = offs[i];
    const by = 1.35 + (i % 2) * 0.12;
    // Thin string from weight up to the knot.
    const str = cyl(0.006, 0.006, by - 0.16, strMat, 6);
    str.position.set(ox * 0.5, 0.16 + (by - 0.16) / 2, oz * 0.5);
    str.rotation.z = -ox * 0.4;
    g.add(str);
    // Glossy slightly-squashed balloon.
    const balloon = sphere(0.18, stdMat(colors[i], { rough: 0.18, metal: 0.1 }), 14);
    balloon.scale.set(1, 1.18, 1);
    balloon.position.set(ox, by, oz);
    g.add(balloon);
    // Tiny knot at the bottom.
    const knot = cyl(0.0, 0.04, 0.05, stdMat(colors[i], { rough: 0.3 }), 8);
    knot.position.set(ox, by - 0.21, oz);
    g.add(knot);
  }
  return g;
}

function buildJukebox(): THREE.Group {
  const g = group();
  const red = stdMat(0xc23a3a, { rough: 0.45, metal: 0.15 });
  // Rounded cabinet body.
  const body = box(0.9, 1.2, 0.5, red);
  body.position.y = 0.6;
  g.add(body);
  // Slightly inset lower base.
  const base = box(0.96, 0.18, 0.56, stdMat(0x8a2a2a, { rough: 0.5 }));
  base.position.y = 0.09;
  g.add(base);

  // Glowing arched top (half-cylinder) with warm emissive.
  const archMat = stdMat(0xffd98a, { emissive: 0xffb060, emissiveIntensity: 1.1, rough: 0.4 });
  const arch = cyl(0.45, 0.45, 0.5, archMat, 18);
  arch.rotation.x = Math.PI / 2;
  arch.position.set(0, 1.2, 0);
  g.add(arch);

  // Chrome trim ring around the arch front.
  const trim = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.03, 8, 22),
    stdMat(0xd2d6db, { rough: 0.25, metal: 0.85 }),
  );
  trim.position.set(0, 1.2, 0.26);
  g.add(trim);

  // Speaker grille (dark slatted panel) on the lower front.
  const grille = box(0.6, 0.4, 0.04, stdMat(0x2a2024, { rough: 0.8 }));
  grille.position.set(0, 0.5, 0.26);
  g.add(grille);

  // Two glowing buttons.
  const btnColors = [0x5dff9b, 0x5dd6ff];
  for (let i = 0; i < 2; i++) {
    const btn = cyl(0.05, 0.05, 0.04, stdMat(btnColors[i], { emissive: btnColors[i], emissiveIntensity: 1.4, rough: 0.3 }), 12);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(-0.15 + i * 0.3, 0.9, 0.26);
    g.add(btn);
  }
  return g;
}

function buildPoster(): THREE.Group {
  const g = group();
  const frameMat = stdMat(0x6a8cff, { rough: 0.5, metal: 0.1 });
  const fw = 0.96;
  const fh = 1.2;
  const t = 0.07;
  const cy = 1.2;

  // Thin back-post so it mounts higher like a wall item.
  const post = box(0.1, 1.2, 0.06, frameMat);
  post.position.set(0, 0.6, -0.05);
  g.add(post);

  // Frame border = four boxes.
  const top = box(fw, t, 0.06, frameMat);
  top.position.set(0, cy + fh / 2, 0);
  const bot = box(fw, t, 0.06, frameMat);
  bot.position.set(0, cy - fh / 2, 0);
  const left = box(t, fh, 0.06, frameMat);
  left.position.set(-fw / 2 + t / 2, cy, 0);
  const right = box(t, fh, 0.06, frameMat);
  right.position.set(fw / 2 - t / 2, cy, 0);
  g.add(top, bot, left, right);

  // Bold band poster: bright background + a star + musical notes.
  const tex = canvasTex(256, (ctx, s) => {
    ctx.fillStyle = "#ffe27a";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#ff5d8f";
    ctx.fillRect(0, 0, s, s * 0.22);
    ctx.fillStyle = "#9b6bff";
    // A bold 5-point star.
    ctx.beginPath();
    const cx = s * 0.5;
    const cyy = s * 0.42;
    const R = s * 0.26;
    const r2 = s * 0.11;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? R : r2;
      const px = cx + Math.cos(a) * rr;
      const py = cyy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // Two musical notes (filled circles + stems) at the bottom.
    ctx.fillStyle = "#2f3640";
    for (const nx of [0.32, 0.6]) {
      ctx.beginPath();
      ctx.arc(s * nx, s * 0.82, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(s * nx + s * 0.04, s * 0.66, s * 0.02, s * 0.16);
    }
  });
  const canvas = new THREE.Mesh(
    new THREE.PlaneGeometry(fw - t * 2, fh - t * 2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
  );
  canvas.position.set(0, cy, 0.02);
  g.add(canvas);
  return g;
}

function buildBookshelf(): THREE.Group {
  const g = group();
  const wood = stdMat(0x7a5230, { rough: 0.85, metal: 0.02 });
  // Outer frame: back panel + sides + bottom + middle/top shelves.
  const back = box(1.0, 1.1, 0.05, wood);
  back.position.set(0, 0.6, -0.18);
  g.add(back);
  for (const sx of [-1, 1]) {
    const side = box(0.06, 1.1, 0.4, wood);
    side.position.set(sx * 0.5, 0.6, -0.02);
    g.add(side);
  }
  const shelfYs = [0.08, 0.62, 1.14];
  for (const sy of shelfYs) {
    const shelf = box(1.0, 0.06, 0.4, wood);
    shelf.position.set(0, sy, -0.02);
    g.add(shelf);
  }

  // Two rows of colorful book spines (thin upright boxes).
  const spineColors = [0xff7f6e, 0xf2c879, 0x6fb6ff, 0x9b6bd5, 0x5dff9b, 0xff5d8f];
  for (let row = 0; row < 2; row++) {
    const rowY = 0.4 + row * 0.54;
    for (let i = 0; i < 6; i++) {
      const c = spineColors[(i + row * 3) % spineColors.length];
      const bh = 0.4 + ((i + row) % 3) * 0.04;
      const spine = box(0.1, bh, 0.26, stdMat(c, { rough: 0.7 }));
      spine.position.set(-0.4 + i * 0.16, rowY + bh / 2 - 0.22, 0.0);
      spine.rotation.z = i === 5 ? 0.18 : 0; // last one leaning, cozy
      g.add(spine);
    }
  }

  // Tiny potted plant on top.
  const pot = cyl(0.1, 0.08, 0.12, stdMat(0xb5613a, { rough: 0.9 }), 12);
  pot.position.set(0.32, 1.23, 0);
  g.add(pot);
  const leaf = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.14, 0),
    stdMat(0x4f9d52, { rough: 0.8, flat: true }),
  );
  leaf.position.set(0.32, 1.36, 0);
  leaf.scale.y = 0.8;
  g.add(leaf);
  return g;
}

function buildCandle(): THREE.Group {
  const g = group();
  // Small dish.
  const dish = cyl(0.24, 0.26, 0.05, stdMat(0xc6d3dc, { rough: 0.3, metal: 0.7 }), 18);
  dish.position.y = 0.025;
  g.add(dish);

  // Cream wax pillar.
  const wax = cyl(0.15, 0.16, 0.5, stdMat(0xf2ead4, { rough: 0.6 }), 18);
  wax.position.y = 0.3;
  g.add(wax);

  // Tiny wick.
  const wick = cyl(0.012, 0.012, 0.05, stdMat(0x33373d, { rough: 0.6 }), 6);
  wick.position.y = 0.57;
  g.add(wick);

  // Glowing teardrop flame (cone) that blooms bright.
  const flameMat = stdMat(0xffd98a, { emissive: 0xffb060, emissiveIntensity: 1.4, rough: 0.4 });
  const flame = cyl(0.0, 0.06, 0.16, flameMat, 12);
  flame.position.y = 0.66;
  g.add(flame);
  return g;
}

// --- public API --------------------------------------------------------------

export function buildDecor(defId: string): THREE.Group {
  switch (defId) {
    case "fan":
      return buildFan();
    case "hood":
      return buildHood();
    case "spice":
      return buildSpice();
    case "plant":
      return buildPlant();
    case "flowers":
      return buildFlowers();
    case "lamp":
      return buildLamp();
    case "painting":
      return buildPainting();
    case "speaker":
      return buildSpeaker();
    case "rug":
      return buildRug();
    case "neon":
      return buildNeon();
    case "menuboard":
      return buildMenuboard();
    case "aquarium":
      return buildAquarium();
    case "tv":
      return buildTv();
    case "lights":
      return buildLights();
    case "clock":
      return buildClock();
    case "cat":
      return buildCat();
    case "balloons":
      return buildBalloons();
    case "jukebox":
      return buildJukebox();
    case "poster":
      return buildPoster();
    case "bookshelf":
      return buildBookshelf();
    case "candle":
      return buildCandle();
    default: {
      // Unknown id → small gray box placeholder (kept well within one cell).
      const ph = box(0.5, 0.5, 0.5, stdMat(0x888888, { rough: 0.8 }));
      ph.position.y = 0.25;
      void TILE; // footprint reference; placeholder stays small.
      return group(ph);
    }
  }
}
