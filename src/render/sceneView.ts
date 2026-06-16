// The scene assembler: builds the static restaurant (floor, counter, walls),
// then every frame syncs Three.js objects to the game state — placed stations &
// decor, food on slots, assembled plates, the chef + helper, customers and their
// order bubbles, floating text, and the build-mode cursor/ghost.

import * as THREE from "three";
import type { GameState, Carry, IngredientId, PlacedItem, PlatePart } from "../game/types";
import type { Input } from "../core/input";
import { def, RECIPES } from "../game/catalog";
import { items, worldOfCell, cellOfWorld, TILE, COUNTER_Z, CUSTOMER_Z } from "../game/grid";
import { GAP_HALF, HALF_W, DINING_COLS, tableWorld, diningColOf, inDiningZone } from "../game/dining";
import { pullQuality } from "../game/cooking";
import { Stage } from "./stage";
import { buildStation } from "./stations";
import { buildDecor } from "./decor";
import { buildFood, buildPlate, type FoodKind, type FoodQuality } from "./food";
import { buildChef, buildCustomer, type ChefRig, type CustomerRig } from "./actors";
import { stdMat, box, cyl, sphere, group, canvasTex, disposeTree } from "./kit";
import { clamp, damp, easeOutBack } from "../core/math";

/** Dispose only geometries in a subtree (leaves materials alone — used for actor
 *  rigs that share module-level eye/glint materials across instances). */
function disposeGeom(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
}

/** A cute round dining table with two cushioned stools (origin at its base). */
function buildTableMesh(): THREE.Group {
  const woodMat = stdMat(0x9c5a2e, { rough: 0.6 });
  const t = group();
  const topT = cyl(0.72, 0.72, 0.12, stdMat(0xcf8f55, { rough: 0.45 }), 18);
  topT.position.y = 0.92;
  const ped = cyl(0.13, 0.18, 0.9, woodMat, 10);
  ped.position.y = 0.46;
  const base = cyl(0.42, 0.42, 0.08, woodMat, 14);
  base.position.y = 0.04;
  t.add(topT, ped, base);
  const cushMat = stdMat(0xff8fae, { rough: 0.7 });
  for (const sz of [0.98, -0.98]) {
    const seat = cyl(0.26, 0.26, 0.12, cushMat, 12);
    seat.position.set(0, 0.5, sz);
    const leg = cyl(0.05, 0.07, 0.5, woodMat, 8);
    leg.position.set(0, 0.22, sz);
    t.add(seat, leg);
  }
  return t;
}

const FOOD_ANCHOR = new THREE.Vector3(0, 1.1, 0); // fallback slot height

const ING_FOOD: Partial<Record<IngredientId, FoodKind>> = {
  bun: "bun",
  patty_raw: "patty_raw",
  cheese: "cheese",
  lettuce: "lettuce",
  tomato: "tomato",
};

interface ItemView {
  group: THREE.Group;
  defId: string;
  light?: THREE.PointLight;
}
/** How a piece of food on a slot moves: patties somersault-flip on the grill,
 *  fries shimmy in the fryer, everything else does a gentle living bob. */
type SlotMotion = "flip" | "shake" | "bob";
interface SlotEntry {
  group: THREE.Group;
  sig: string;
  phase: number;
  motion: SlotMotion;
  bornTime: number; // this.time when (re)built — drives the placement pop
}
interface CustView {
  rig: CustomerRig;
  bubble: THREE.Group;
  bar: THREE.Mesh;
  icon: THREE.Sprite;
  ring?: THREE.Mesh; // special-customer floor ring (kept grounded, not parented to the rig)
  shownT: number; // bubble pop-in age
}

export class SceneView {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private itemViews = new Map<number, ItemView>();
  private slotFood = new Map<string, SlotEntry>();
  private custViews = new Map<number, CustView>();
  private tableViews = new Map<number, THREE.Group>();
  private tableGhost: THREE.Group | null = null;
  private chef: ChefRig;
  private helper: ChefRig;
  private carryHolder = new THREE.Group();
  private carrySig = "";
  private floaters: THREE.Sprite[] = [];

  private cursorTile: THREE.Mesh;
  private ghost: THREE.Group | null = null;
  private ghostSig = "";
  private ray = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private time = 0;
  private neonMat: THREE.MeshStandardMaterial | null = null;
  private readonly scratch = new THREE.Vector3();

  constructor(stage: Stage, G: GameState) {
    this.scene = stage.scene;
    this.camera = stage.camera;
    this.buildEnvironment(G);

    this.chef = buildChef();
    this.scene.add(this.chef.group);
    this.scene.add(this.carryHolder);

    this.helper = buildChef({ helper: true });
    this.helper.group.visible = false;
    this.scene.add(this.helper.group);

    this.cursorTile = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 0.94, TILE * 0.94),
      new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    this.cursorTile.rotation.x = -Math.PI / 2;
    this.cursorTile.position.y = 0.03;
    this.cursorTile.visible = false;
    this.scene.add(this.cursorTile);
  }

  // ── Static environment ──────────────────────────────────────────────────
  private buildEnvironment(G: GameState): void {
    const cols = G.grid.cols;
    const rows = G.grid.rows;
    const width = cols * TILE + 4;
    const backZ = worldOfCell(G.grid, 0, rows - 1).z + TILE;

    // Kitchen tile floor.
    const floorTex = canvasTex(256, (ctx, s) => {
      const t = s / 8;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? "#7a72ad" : "#6f679f";
          ctx.fillRect(x * t, y * t, t, t);
        }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(cols, rows + 2);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, backZ - COUNTER_Z + 2),
      stdMat(0xffffff, { rough: 0.95 }),
    );
    (floor.material as THREE.MeshStandardMaterial).map = floorTex;
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, (COUNTER_Z + backZ) / 2 + 0.5);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Dining floor (customer side) — warm wood.
    const dining = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 7),
      stdMat(0x9a6c44, { rough: 0.85 }),
    );
    dining.rotation.x = -Math.PI / 2;
    dining.position.set(0, -0.01, CUSTOMER_Z - 2.4);
    dining.receiveShadow = true;
    this.scene.add(dining);

    // Service counter — two segments with a central gap the chef walks through.
    const counterTopMat = stdMat(0xb9c2cc, { rough: 0.4, metal: 0.3 });
    const counterBodyMat = stdMat(0x7a5a3c, { rough: 0.7 });
    for (const seg of [[-HALF_W, -GAP_HALF], [GAP_HALF, HALF_W]]) {
      const w = seg[1] - seg[0];
      const cx = (seg[0] + seg[1]) / 2;
      const top = box(w, 0.2, 1.1, counterTopMat);
      top.position.set(cx, 1.0, COUNTER_Z);
      const body = box(w, 1.0, 0.9, counterBodyMat);
      body.position.set(cx, 0.5, COUNTER_Z);
      this.scene.add(top, body);
    }
    // (Dining tables are placed dynamically from G.tables in syncTables.)

    // Restaurant back wall (behind the customers) with glowing windows + neon.
    const wallZ = CUSTOMER_Z - 3.4;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 7, 0.4), stdMat(0x423e68, { rough: 0.85 }));
    wall.position.set(0, 3.2, wallZ);
    wall.receiveShadow = true;
    this.scene.add(wall);
    for (let i = -1; i <= 1; i++) {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 2.4, 0.12),
        stdMat(0x0c1430, { emissive: 0x2d4a8a, emissiveIntensity: 0.9 }),
      );
      win.position.set(i * 5.5, 3.2, wallZ + 0.25);
      this.scene.add(win);
    }
    const neon = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.9, 0.2),
      stdMat(0x111111, { emissive: 0xff5ab0, emissiveIntensity: 1.7 }),
    );
    neon.position.set(0, 5.6, wallZ + 0.3);
    this.scene.add(neon);
    this.neonMat = neon.material as THREE.MeshStandardMaterial;
    // A back wall behind the kitchen too, so the room reads as enclosed.
    const kWall = new THREE.Mesh(new THREE.BoxGeometry(width, 5, 0.4), stdMat(0x383260, { rough: 0.9 }));
    kWall.position.set(0, 2.5, backZ + 1.2);
    kWall.receiveShadow = true;
    this.scene.add(kWall);

    // ── Cute decorations ──
    // Bunting garland strung in a gentle droop over the service counter.
    const span = (cols / 2) * TILE; // ~ play width
    const buntZ = COUNTER_Z + 0.8;
    const flagCols = [0xff9ec4, 0xffd27a, 0x9ed8ff, 0xb6f0a8, 0xd5a8ff];
    const NF = 16;
    for (let i = 0; i < NF; i++) {
      const ft = i / (NF - 1);
      const fc = flagCols[i % flagCols.length];
      const droop = Math.sin(ft * Math.PI) * 0.55;
      const flag = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.46, 4),
        stdMat(fc, { rough: 0.6, emissive: fc, emissiveIntensity: 0.2 }),
      );
      flag.rotation.x = Math.PI;
      flag.rotation.y = Math.PI / 4;
      flag.position.set(-span + ft * span * 2, 4.5 - droop, buntZ);
      this.scene.add(flag);
    }
    // A glowing heart sign hung above the counter centre.
    const heartMat = stdMat(0x331018, { emissive: 0xff5a9e, emissiveIntensity: 1.4 });
    const heart = group();
    const lobeL = sphere(0.34, heartMat, 12);
    lobeL.position.set(-0.26, 0.18, 0);
    const lobeR = sphere(0.34, heartMat, 12);
    lobeR.position.set(0.26, 0.18, 0);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.72, 14), heartMat);
    tip.rotation.x = Math.PI;
    tip.position.set(0, -0.34, 0);
    heart.add(lobeL, lobeR, tip);
    heart.position.set(0, 4.95, buntZ);
    heart.scale.setScalar(0.62);
    this.scene.add(heart);
    // Potted plants sitting on the counter.
    for (const sx of [-1, 1]) {
      const plant = buildDecor("plant");
      plant.position.set(sx * 5.6, 1.1, COUNTER_Z);
      plant.scale.setScalar(0.8);
      this.scene.add(plant);
    }

    // Hanging lamps over the kitchen.
    for (let i = -1; i <= 1; i++) {
      const lamp = group(
        cyl(0.05, 0.05, 1.4, stdMat(0x222222), 6),
        (() => {
          const shade = cyl(0.5, 0.3, 0.4, stdMat(0x222222, { emissive: 0xffd9a0, emissiveIntensity: 0.6 }), 10);
          shade.position.y = -0.85;
          return shade;
        })(),
      );
      lamp.position.set(i * 4.6, 5.4, 3.2);
      this.scene.add(lamp);
    }
  }

  // ── Per-frame sync ──────────────────────────────────────────────────────
  update(G: GameState, dt: number, input: Input): void {
    const its = items(G.grid); // compute the placed-item list once per frame
    this.syncLayout(G, its);
    this.syncTables(G);
    this.syncSlotFood(its);
    this.syncChef(G, dt);
    this.syncHelper(G, dt);
    this.syncCustomers(G, dt);
    this.syncCarry(G);
    this.syncFloaters(G);
    this.syncBuild(G, input);
    this.animateDecor(dt);
    this.animateStations(dt, its);
  }

  private syncLayout(G: GameState, its: PlacedItem[]): void {
    const live = new Set<number>();
    for (const it of its) {
      live.add(it.uid);
      let v = this.itemViews.get(it.uid);
      if (!v) {
        const d = def(it.defId);
        const g = d?.category === "decor" ? buildDecor(it.defId) : buildStation(it.defId);
        this.scene.add(g);
        v = { group: g, defId: it.defId };
        // Grills/fryers glow — a warm point light that brightens while cooking.
        if (d?.kind === "grill" || d?.kind === "fryer") {
          const light = new THREE.PointLight(d.kind === "grill" ? 0xff6a2a : 0xffb066, 0.3, 3.6, 2);
          light.position.set(0, 1.2, 0);
          g.add(light);
          v.light = light;
        }
        // Floating icon over storage/utility stations so they read clearly.
        if (d && (d.kind === "bin" || d.kind === "trash" || d.kind === "drink")) {
          const label = makeEmoji(d.icon, 0.8);
          label.position.set(0, 1.78, 0);
          g.add(label);
        }
        this.itemViews.set(it.uid, v);
      }
      const { x, z } = worldOfCell(G.grid, it.col, it.row);
      v.group.position.set(x, 0, z);
      v.group.rotation.y = (it.rot * Math.PI) / 2;
      v.group.visible = true;
    }
    for (const [uid, v] of this.itemViews) {
      if (!live.has(uid)) {
        this.scene.remove(v.group);
        disposeTree(v.group);
        this.itemViews.delete(uid);
      }
    }
  }

  /** Sync the dining tables to G.tables — the player arranges these in build mode. */
  private syncTables(G: GameState): void {
    const live = new Set<number>();
    for (const t of G.tables) {
      live.add(t.uid);
      let g = this.tableViews.get(t.uid);
      if (!g) {
        g = buildTableMesh();
        this.scene.add(g);
        this.tableViews.set(t.uid, g);
      }
      const { x, z } = tableWorld(t.col);
      g.position.set(x, 0, z);
    }
    for (const [uid, g] of this.tableViews) {
      if (!live.has(uid)) {
        this.scene.remove(g);
        disposeTree(g);
        this.tableViews.delete(uid);
      }
    }
  }

  /** Place an entry at a station's local slot anchor (reuses a scratch vector)
   *  and animate it: a patty somersault-flip on the grill, a fryer shimmy, or a
   *  gentle sizzle bob — plus a squash-stretch "pop" the moment it's placed. */
  private placeAtSlot(entry: SlotEntry, view: ItemView | undefined, local: THREE.Vector3 | undefined): void {
    if (!view) return;
    this.scratch.copy(local ?? FOOD_ANCHOR);
    view.group.localToWorld(this.scratch);
    const g = entry.group;
    g.position.copy(this.scratch);
    const t = this.time + entry.phase;
    let yLift = 0;

    if (entry.motion === "flip") {
      // Toss the patty for a satisfying somersault every couple of seconds; a
      // high arc so the wide puck clears the griddle as it turns over. Gentle
      // sizzle jitter between flips.
      const period = 2.4;
      const lt = ((t % period) + period) % period;
      const flipDur = 0.6;
      if (lt < flipDur) {
        const f = lt / flipDur; // 0..1 through the flip
        yLift = Math.sin(f * Math.PI) * 0.85; // leap up and back down
        g.rotation.set(f * Math.PI * 2, 0, Math.sin(f * Math.PI) * 0.2);
      } else {
        yLift = Math.abs(Math.sin(t * 7)) * 0.04;
        g.rotation.set(0, 0, Math.sin(t * 3.4) * 0.05);
      }
    } else if (entry.motion === "shake") {
      // Fryer basket shimmy: a quick side-to-side jiggle.
      g.position.x += Math.sin(t * 24) * 0.03;
      yLift = Math.abs(Math.sin(t * 15)) * 0.05;
      g.rotation.set(0, 0, Math.sin(t * 20) * 0.1);
    } else {
      // Gentle living bob (plates, soda, burnt scraps).
      yLift = Math.abs(Math.sin(t * 4)) * 0.03;
      g.rotation.set(0, Math.sin(t * 1.6) * 0.12, Math.sin(t * 2.6) * 0.05);
    }

    // Placement pop: squash-stretch up to full size over the first ~1/3 s so food
    // landing on a slot (and each part added to a plate) feels tactile.
    const age = this.time - entry.bornTime;
    g.scale.setScalar(age < 0.34 ? 0.45 + 0.55 * easeOutBack(age / 0.34) : 1);

    g.position.y += yLift;
  }

  /** Choose the slot animation for a freshly-built food kind. */
  private motionFor(kind: FoodKind): SlotMotion {
    if (kind === "patty" || kind === "patty_raw") return "flip";
    if (kind === "fries") return "shake";
    return "bob";
  }

  private syncSlotFood(its: PlacedItem[]): void {
    const live = new Set<string>();
    for (const it of its) {
      const d = def(it.defId);
      if (!it.slots || !d?.kind) continue;
      const view = this.itemViews.get(it.uid);
      const slots = (view?.group.userData.slots as THREE.Vector3[] | undefined) ?? [];
      for (let i = 0; i < it.slots.length; i++) {
        const slot = it.slots[i];
        if (slot.filling === null) continue;
        const key = `${it.uid}:${i}`;
        const { kind, quality } = slotFoodKind(d.kind, slot);
        const sig = `${kind}:${quality}`;
        live.add(key);
        let entry = this.slotFood.get(key);
        if (!entry || entry.sig !== sig) {
          if (entry) {
            this.scene.remove(entry.group);
            disposeTree(entry.group);
          }
          const g = buildFood(kind, quality);
          this.scene.add(g);
          entry = { group: g, sig, phase: it.uid * 0.9 + i, motion: this.motionFor(kind), bornTime: this.time };
          this.slotFood.set(key, entry);
        }
        this.placeAtSlot(entry, view, slots[i]);
      }
      // Prep plate.
      if (d.kind === "prep" && it.plate && it.plate.length > 0) {
        const key = `${it.uid}:plate`;
        const sig = plateSig(it.plate);
        live.add(key);
        let entry = this.slotFood.get(key);
        if (!entry || entry.sig !== sig) {
          if (entry) {
            this.scene.remove(entry.group);
            disposeTree(entry.group);
          }
          const g = buildPlate(it.plate);
          this.scene.add(g);
          entry = { group: g, sig, phase: it.uid * 0.9, motion: "bob", bornTime: this.time };
          this.slotFood.set(key, entry);
        }
        this.placeAtSlot(entry, view, slots[0]);
      }
    }
    for (const [key, entry] of this.slotFood) {
      if (!live.has(key)) {
        this.scene.remove(entry.group);
        disposeTree(entry.group);
        this.slotFood.delete(key);
      }
    }
  }

  private syncChef(G: GameState, dt: number): void {
    this.chef.group.position.set(G.chef.x, 0, G.chef.z);
    const cook = Math.min(1, G.chef.cookT / 0.42);
    this.chef.update(dt, { walk: G.chef.walk, face: G.chef.face, fire: G.chef.fire, carrying: G.carry !== null, cook });
  }

  private syncHelper(G: GameState, dt: number): void {
    this.helper.group.visible = G.helper.hired;
    if (!G.helper.hired) return;
    this.helper.group.position.set(G.helper.x, 0, G.helper.z);
    this.helper.update(dt, { walk: 4, face: Math.PI, fire: 0, carrying: false, cook: 0 });
  }

  private syncCustomers(G: GameState, dt: number): void {
    const live = new Set<number>();
    for (const c of G.customers) {
      live.add(c.uid);
      let v = this.custViews.get(c.uid);
      if (!v) {
        const rig = buildCustomer(c.look);
        this.scene.add(rig.group);
        const icon = makeEmoji(c.recipe.icon, 1.1);
        const bar = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 0.16),
          new THREE.MeshBasicMaterial({ color: 0x66ff66, depthWrite: false }),
        );
        const barBg = new THREE.Mesh(
          new THREE.PlaneGeometry(1.26, 0.22),
          new THREE.MeshBasicMaterial({ color: 0x111111, depthWrite: false }),
        );
        barBg.position.z = -0.01;
        const bubble = group(icon, bar, barBg);
        this.scene.add(bubble);
        // Special-customer flourish: a glowing floor ring (kept as its own scene
        // object so it stays on the floor when the guest lifts onto a stool) + a
        // badge in the bubble.
        const kindColor = c.kind === "vip" ? 0xffd24a : c.kind === "critic" ? 0x6cc6ff : 0;
        let ring: THREE.Mesh | undefined;
        if (kindColor) {
          ring = new THREE.Mesh(
            new THREE.RingGeometry(0.5, 0.74, 26),
            new THREE.MeshBasicMaterial({ color: kindColor, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
          );
          ring.rotation.x = -Math.PI / 2;
          this.scene.add(ring);
          const badge = makeEmoji(c.kind === "vip" ? "👑" : "📸", 0.62);
          badge.position.set(0.62, 0.5, 0.02);
          bubble.add(badge);
        }
        v = { rig, bubble, bar, icon, ring, shownT: 0 };
        this.custViews.set(c.uid, v);
      }
      v.rig.group.position.set(c.x, 0, c.z);
      v.rig.update(dt, { bob: c.bob, anger: c.anger, state: c.state, walk: c.walk, face: c.face });
      if (v.ring) v.ring.position.set(c.x, 0.05, c.z);
      // Order bubble.
      const showBubble = c.state === "waiting" || c.state === "walkin";
      v.bubble.visible = showBubble;
      if (showBubble) {
        v.shownT += dt;
        v.bubble.position.set(c.x, 2.0, c.z);
        v.bubble.lookAt(this.camera.position);
        v.bubble.scale.setScalar(easeOutBack(Math.min(1, v.shownT / 0.32)));
        const frac = Math.max(0, c.patience / c.maxPatience);
        v.bar.scale.x = Math.max(0.001, frac);
        v.bar.position.x = -(1 - frac) * 0.6;
        v.bar.position.y = -0.7;
        (v.bar.material as THREE.MeshBasicMaterial).color.setHSL(0.33 * frac, 0.8, 0.5);
        v.icon.position.y = 0.1;
      }
    }
    for (const [uid, v] of this.custViews) {
      if (!live.has(uid)) {
        this.scene.remove(v.rig.group);
        this.scene.remove(v.bubble);
        disposeGeom(v.rig.group); // actors share module-level materials
        disposeTree(v.bubble);
        if (v.ring) {
          this.scene.remove(v.ring);
          disposeTree(v.ring);
        }
        this.custViews.delete(uid);
      }
    }
  }

  private syncCarry(G: GameState): void {
    const sig = carrySig(G.carry);
    if (sig !== this.carrySig) {
      this.carrySig = sig;
      for (const child of this.carryHolder.children) disposeTree(child);
      this.carryHolder.clear();
      const mesh = makeCarryMesh(G.carry);
      if (mesh) this.carryHolder.add(mesh);
    }
    const c = G.chef;
    this.carryHolder.visible = G.carry !== null;
    this.carryHolder.position.set(c.x + Math.sin(c.face) * 0.5, 1.25, c.z - Math.cos(c.face) * 0.5);
  }

  private syncFloaters(G: GameState): void {
    while (this.floaters.length < G.floats.length) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
      this.floaters.push(sp);
      this.scene.add(sp);
    }
    for (let i = 0; i < this.floaters.length; i++) {
      const sp = this.floaters[i];
      const fl = G.floats[i];
      if (!fl) {
        sp.visible = false;
        continue;
      }
      sp.visible = true;
      const mat = sp.material as THREE.SpriteMaterial;
      const wantSig = `${fl.text}|${fl.color}`;
      if (mat.userData.sig !== wantSig) {
        mat.userData.sig = wantSig;
        mat.map?.dispose();
        mat.map = makeText(fl.text, fl.color);
      }
      const f = fl.t / fl.life;
      mat.opacity = 1 - f * f;
      const sc = (fl.big ? 1.7 : 1.2) * (1 + f * 0.3);
      sp.scale.set(sc * 2, sc, 1);
      sp.position.set(fl.x, 1.6 + f * 1.4, fl.z);
    }
  }

  private animateDecor(dt: number): void {
    for (const v of this.itemViews.values()) {
      const spin = v.group.userData.spin as THREE.Object3D | undefined;
      if (spin) {
        const axis = (v.group.userData.spinAxis as string) ?? "z";
        if (axis === "y") spin.rotation.y += dt * 3;
        else spin.rotation.z += dt * 3;
      }
    }
  }

  private animateStations(dt: number, its: PlacedItem[]): void {
    this.time += dt;
    for (const it of its) {
      const v = this.itemViews.get(it.uid);
      if (!v?.light) continue;
      const cooking = it.slots?.some((s) => s.filling !== null) ?? false;
      const flick = 0.9 + Math.sin(this.time * 17 + it.uid) * 0.1;
      // Ease gently between idle and cooking glow so dropping food on never
      // pops a bright flash — just a soft warm-up.
      v.light.intensity = damp(v.light.intensity, (cooking ? 0.5 : 0.18) * flick, 4, dt);
    }
    if (this.neonMat) {
      const pop = Math.sin(this.time * 23) > 0.96 ? 0.7 : 0;
      this.neonMat.emissiveIntensity = 1.5 + Math.sin(this.time * 6) * 0.25 + pop;
    }
  }

  private syncBuild(G: GameState, input: Input): void {
    if (!G.build.active) {
      this.cursorTile.visible = false;
      if (this.ghost) this.ghost.visible = false;
      if (this.tableGhost) this.tableGhost.visible = false;
      return;
    }
    // Pick hovered cell from the mouse ray against the floor.
    const ndc = new THREE.Vector2(
      (input.mouseX / window.innerWidth) * 2 - 1,
      -(input.mouseY / window.innerHeight) * 2 + 1,
    );
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.groundPlane, hit)) {
      if (inDiningZone(hit.z)) {
        G.build.inDining = true;
        G.build.diningCol = clamp(diningColOf(hit.x), 0, DINING_COLS - 1);
      } else {
        G.build.inDining = false;
        const { col, row } = cellOfWorld(G.grid, hit.x, hit.z);
        G.build.cursorCol = col;
        G.build.cursorRow = row;
      }
    }

    // ── Arranging tables out on the dining floor ──
    if (G.build.inDining) {
      const tw = tableWorld(G.build.diningCol);
      const occupied = G.tables.some((t) => t.col === G.build.diningCol);
      const invalid = !!G.build.movingTable && occupied;
      this.cursorTile.visible = true;
      this.cursorTile.position.set(tw.x, 0.03, tw.z);
      (this.cursorTile.material as THREE.MeshBasicMaterial).color.setHex(invalid ? 0xff5a5a : 0x66ff99);
      if (this.ghost) this.ghost.visible = false;
      if (!this.tableGhost) {
        this.tableGhost = buildTableMesh();
        this.tableGhost.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          if (m) {
            m.transparent = true;
            m.opacity = 0.5;
          }
        });
        this.scene.add(this.tableGhost);
      }
      // Preview a table only where one would actually land (drop spot or new add).
      const showGhost = !!G.build.movingTable || !occupied;
      this.tableGhost.visible = showGhost;
      if (showGhost) this.tableGhost.position.set(tw.x, 0.04, tw.z);
      return;
    }
    if (this.tableGhost) this.tableGhost.visible = false;

    const { x, z } = worldOfCell(G.grid, G.build.cursorCol, G.build.cursorRow);
    const occupied = !!G.grid.cells[G.build.cursorRow * G.grid.cols + G.build.cursorCol]?.item;
    this.cursorTile.visible = true;
    this.cursorTile.position.set(x, 0.03, z);
    (this.cursorTile.material as THREE.MeshBasicMaterial).color.setHex(occupied ? 0xff5a5a : 0x66ff99);

    // Ghost preview of the brush / moving item.
    const previewId = G.build.movingItem?.defId ?? G.build.brush;
    if (previewId !== this.ghostSig) {
      this.ghostSig = previewId ?? "";
      if (this.ghost) {
        this.scene.remove(this.ghost);
        disposeTree(this.ghost);
      }
      this.ghost = null;
      if (previewId) {
        const d = def(previewId);
        this.ghost = d?.category === "decor" ? buildDecor(previewId) : buildStation(previewId);
        this.ghost.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          if (m) {
            m.transparent = true;
            m.opacity = 0.55;
          }
        });
        this.scene.add(this.ghost);
      }
    }
    if (this.ghost) {
      this.ghost.visible = true;
      this.ghost.position.set(x, 0.05, z);
      this.ghost.rotation.y = (G.build.rot * Math.PI) / 2;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function slotFoodKind(kind: string, slot: { filling: IngredientId | null; t: number; cookT: number; perfT: number; burnT: number; done: boolean }): { kind: FoodKind; quality: FoodQuality } {
  const q = pullQuality(slot);
  if (kind === "grill") {
    if (q === "burnt") return { kind: "burnt", quality: "good" };
    if (q === "raw") return { kind: "patty_raw", quality: "good" };
    return { kind: "patty", quality: q === "perfect" ? "perfect" : "good" };
  }
  if (kind === "fryer") return { kind: "fries", quality: q === "perfect" ? "perfect" : "good" };
  return { kind: "soda", quality: "good" };
}

function plateSig(parts: PlatePart[]): string {
  return parts.map((p) => `${p.id}.${p.quality}`).join(",");
}

function carrySig(c: Carry): string {
  if (!c) return "none";
  if (c.kind === "ing") return `ing:${c.id}`;
  if (c.kind === "part") return `part:${c.id}.${c.quality}`;
  if (c.kind === "burnt") return "burnt";
  return `plate:${plateSig(c.parts)}`;
}

function ingredientMesh(id: IngredientId): THREE.Group {
  const fk = ING_FOOD[id];
  if (fk) return buildFood(fk);
  if (id === "potato") return group(sphere(0.24, stdMat(0xc8a063, { flat: true })));
  // cup
  return group(cyl(0.18, 0.13, 0.34, stdMat(0xdedede)));
}

function makeCarryMesh(c: Carry): THREE.Object3D | null {
  if (!c) return null;
  if (c.kind === "ing") return ingredientMesh(c.id);
  if (c.kind === "part") return buildFood(c.id as FoodKind, c.quality);
  if (c.kind === "burnt") return buildFood("burnt");
  return buildPlate(c.parts);
}

function makeEmoji(emoji: string, scale: number): THREE.Sprite {
  const tex = canvasTex(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    // soft card behind the emoji
    ctx.fillStyle = "rgba(20,22,34,0.82)";
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${Math.floor(s * 0.5)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, s / 2, s / 2 + s * 0.03);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(scale, scale, scale);
  return sp;
}

function makeText(text: string, color: string): THREE.CanvasTexture {
  return canvasTex(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.font = "bold 60px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(text, s / 2, s / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, s / 2, s / 2);
  });
}

// Keep RECIPES referenced for potential future order-bubble detail.
void RECIPES;
