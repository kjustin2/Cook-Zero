// One-way render sync: read G each frame and build/update/dispose Three.js
// objects to match. Render never mutates gameplay. Covers the diner room, tables,
// stations + signs, the chef, the customers (with floating order bubbles), the
// live cooking food, the carried item, the pet, the garden, treat decor, the
// wayfinder beacon, and the cinematic figure cast. The room/tables/stations/chef/
// pet are rebuilt when the player's RestaurantConfig (colours, layout, looks)
// changes, so customization + layout edits + a restored save all just appear.

import * as THREE from "three";
import type { Carry, Customer, GameState, Station, StationId } from "../game/types";
import type { Stage } from "./stage";
import { activeStationIds, food, stationDef } from "../game/catalog";
import { currentShot, shotProgress } from "../game/cutscene";
import { buildDinerRoom, buildTable, buildBalloons, buildWallClock, buildRug, buildFlame } from "./diner";
import { buildStation } from "./stations";
import { buildChef, buildCustomer, type ChefRig, type CustomerRig } from "./actors";
import { buildCarryMesh, buildCookingFood, tintCooking } from "./food";
import { buildPet, type PetRig } from "./pets";
import { buildPlant } from "./plants";
import { Figures } from "./figures";
import { canvasTex, disposeTree, emojiSprite, roundRect } from "./kit";
import { easeInOut } from "../core/math";

/** A floating sign badge (rounded card + emoji) so a kid instantly knows what a
 *  station does and which order it matches. */
function signSprite(icon: string, borderHex: number): THREE.Sprite {
  const border = "#" + borderHex.toString(16).padStart(6, "0");
  const tex = canvasTex(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    roundRect(ctx, 10, 14, s - 20, s - 34, 24);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = border;
    ctx.stroke();
    ctx.font = `${Math.floor(s * 0.52)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, s / 2, s / 2 - 1);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(1.3, 1.3, 1);
  return sp;
}

const COOK_PULSE = 0.42;

interface CustView {
  rig: CustomerRig;
  bubble: THREE.Group;
  barFill: THREE.Mesh;
  prevX: number;
  prevZ: number;
  face: number;
}

interface SlotView {
  mesh: THREE.Group;
  food: string;
}

function bubbleBgTex(): THREE.CanvasTexture {
  return canvasTex(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#ff9ec7";
    ctx.stroke();
  });
}

function iconTex(icon: string): THREE.CanvasTexture {
  return canvasTex(96, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.font = `${Math.floor(s * 0.8)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, s / 2, s / 2 + s * 0.04);
  });
}

const sig = (o: unknown): string => JSON.stringify(o);

export class SceneView {
  private chefRig!: ChefRig;
  private chefSig = "";
  private custViews = new Map<number, CustView>();
  private slotViews = new Map<string, SlotView>();
  private stationSlots = new Map<string, THREE.Vector3[]>();
  private carryMesh: THREE.Group | null = null;
  private carrySig = "";
  private beacon: THREE.Group;
  private beaconIcon: THREE.Sprite;
  private beaconIconStr = "";
  private figures: Figures;
  private bubbleTex: THREE.CanvasTexture;
  private petRig!: PetRig;
  private petSig = "";
  private petPrev = { x: 0, z: 0, face: 0 };
  private plantViews = new Map<number, { mesh: THREE.Group; sig: string }>();
  // Diffable world (rebuilt when config colours/layout change).
  private roomMesh: THREE.Group | null = null;
  private roomSig = "";
  private tableMeshes: THREE.Group[] = [];
  private tableSig = "";
  private stationMeshes = new Map<StationId, THREE.Group>();
  private signSprites = new Map<StationId, THREE.Sprite>();
  private stationSig = "";
  // Treat decorations (a picked treat visibly redecorates the diner).
  private decorBalloons: THREE.Group;
  private decorClock: THREE.Group;
  private decorRug: THREE.Group;
  private decorFlames: THREE.Group[] = [];
  private helperRig: ChefRig;
  private lastTreatSig = "?";
  private iconCache = new Map<string, THREE.CanvasTexture>();

  private lastScene: object | null = null;
  private lastShot = -1;
  private posV = new THREE.Vector3();
  private lookV = new THREE.Vector3();

  constructor(private stage: Stage, G: GameState) {
    const scene = stage.scene;

    // The customizable world (room/tables/stations/signs/chef/pet) — built now,
    // rebuilt on config change by syncWorld.
    this.syncWorld(G);

    this.bubbleTex = bubbleBgTex();

    this.beacon = new THREE.Group();
    const ringTex = canvasTex(128, (ctx, s) => {
      ctx.clearRect(0, 0, s, s);
      ctx.strokeStyle = "rgba(124,255,138,1)";
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2 - 14, 0, Math.PI * 2);
      ctx.stroke();
    });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    // Float the beacon WELL above the station signs (y≈2.45) and guest order
    // bubbles so the "go here" arrow + icon never overlap them.
    const arrow = emojiSprite("⬇️", 0.9);
    arrow.position.y = 4.0;
    this.beaconIcon = emojiSprite("✨", 1.0);
    this.beaconIcon.position.y = 3.3;
    this.beacon.add(ring, arrow, this.beaconIcon);
    this.beacon.visible = false;
    scene.add(this.beacon);

    // Treat decorations — built hidden, revealed when the matching treat is owned.
    this.decorBalloons = buildBalloons();
    this.decorBalloons.position.set(10.6, 0, -7.5);
    this.decorClock = buildWallClock();
    this.decorClock.position.set(-6, 5.3, -9.85);
    this.decorRug = buildRug();
    this.decorRug.position.set(0, 0, -1.5);
    this.helperRig = buildChef();
    this.helperRig.group.position.set(-8.4, 0, -6.3);
    this.helperRig.group.rotation.y = 0.4;
    for (const obj of [this.decorBalloons, this.decorClock, this.decorRug, this.helperRig.group]) {
      obj.visible = false;
      scene.add(obj);
    }
    for (let i = 0; i < 3; i++) {
      const fl = buildFlame();
      fl.visible = false;
      scene.add(fl);
      this.decorFlames.push(fl);
    }

    this.petPrev.x = G.pet.x;
    this.petPrev.z = G.pet.z;

    // Garden planters along the front — rebuilt when their stage/style changes.
    G.plants.forEach((pl, i) => {
      const bloom = G.config.plants[i]?.bloom;
      const mesh = buildPlant(pl.stage, pl.kind, bloom);
      mesh.position.set(pl.x, 0, pl.z);
      scene.add(mesh);
      this.plantViews.set(i, { mesh, sig: `${pl.stage}:${pl.kind}:${bloom ?? -1}` });
    });

    this.figures = new Figures(scene);
  }

  private getIconTex(icon: string): THREE.CanvasTexture {
    let t = this.iconCache.get(icon);
    if (!t) {
      t = iconTex(icon);
      this.iconCache.set(icon, t);
    }
    return t;
  }

  // ── Customizable world (room/tables/stations/signs/chef/pet) ─────────────────
  private syncWorld(G: GameState): void {
    const scene = this.stage.scene;

    // Room (palette + name on the back sign).
    const rs = sig(G.config.palette) + "|" + G.config.name;
    if (rs !== this.roomSig) {
      this.roomSig = rs;
      if (this.roomMesh) { scene.remove(this.roomMesh); disposeTree(this.roomMesh); }
      this.roomMesh = buildDinerRoom(G.config.palette, G.config.name);
      scene.add(this.roomMesh);
    }

    // Tables (style + count). Rebuild on change; reposition each frame.
    const ts = sig(G.config.table) + ":" + G.tables.length;
    if (ts !== this.tableSig) {
      this.tableSig = ts;
      for (const m of this.tableMeshes) { scene.remove(m); disposeTree(m); }
      this.tableMeshes = G.tables.map(() => {
        const t = buildTable(G.config.table);
        scene.add(t);
        return t;
      });
    }
    G.tables.forEach((tb, i) => this.tableMeshes[i]?.position.set(tb.x, 0, tb.z));

    // Stations + floating signs (style). Rebuild on change; reposition + show only
    // the stations the current menu actually needs (cleaner, kid-readable diner).
    const active = activeStationIds(G);
    const ss = sig(G.config.station);
    if (ss !== this.stationSig) {
      this.stationSig = ss;
      for (const m of this.stationMeshes.values()) { scene.remove(m); disposeTree(m); }
      for (const sp of this.signSprites.values()) scene.remove(sp);
      this.stationMeshes.clear();
      this.signSprites.clear();
      this.stationSlots.clear();
      for (const st of G.stations) {
        const mesh = buildStation(st.id, G.config.station);
        scene.add(mesh);
        this.stationMeshes.set(st.id, mesh);
        this.stationSlots.set(st.id, (mesh.userData.slots as THREE.Vector3[]) ?? []);
        const def = stationDef(st.id);
        const icon = st.kind === "cook" ? "🔥" : st.kind === "trash" ? "🗑️" : def.gives ? food(def.gives).icon : def.icon;
        const sp = signSprite(icon, def.color);
        scene.add(sp);
        this.signSprites.set(st.id, sp);
      }
    }
    for (const st of G.stations) {
      const mesh = this.stationMeshes.get(st.id);
      if (mesh) {
        mesh.position.set(st.x, 0, st.z);
        mesh.rotation.y = st.ry;
        mesh.visible = active.has(st.id);
      }
      const sp = this.signSprites.get(st.id);
      if (sp) {
        sp.position.set(st.x, 2.45, st.z);
        sp.visible = active.has(st.id);
      }
    }

    // Chef look.
    const cs = sig(G.config.chef);
    if (cs !== this.chefSig) {
      this.chefSig = cs;
      if (this.chefRig) { scene.remove(this.chefRig.group); disposeTree(this.chefRig.group); }
      this.chefRig = buildChef({ look: G.config.chef });
      scene.add(this.chefRig.group);
    }

    // Pet kind + colours.
    const ps = sig(G.config.pet);
    if (ps !== this.petSig) {
      this.petSig = ps;
      if (this.petRig) { scene.remove(this.petRig.group); disposeTree(this.petRig.group); }
      this.petRig = buildPet(G.config.pet);
      scene.add(this.petRig.group);
    }
  }

  update(G: GameState, dt: number): void {
    if (G.phase === "cutscene" && G.cutscene) {
      this.syncCutscene(G);
      return;
    }
    if (this.lastScene !== null) {
      this.stage.setCinematic(false);
      this.figures.hideAll();
      this.lastScene = null;
      this.lastShot = -1;
    }
    this.syncWorld(G);
    if (G.phase === "setup") {
      this.stage.setPreviewFocus(G.studioFocus); // chef close-up vs. whole-room view
      if (!this.inSetup) { this.inSetup = true; this.stage.snapPreview(); } // snap in once, then glide
      this.syncPreview(G, dt);
      this.syncPlants(G);
      return;
    }
    this.inSetup = false;
    this.stage.setPreview(false);
    this.syncChef(G, dt);
    this.syncCarry(G);
    this.syncCustomers(G, dt);
    this.syncSlots(G);
    this.syncPet(G, dt);
    this.syncPlants(G);
    this.syncDecor(G, dt);
    this.syncBeacon(G);
  }

  // ── Setup studio preview: chef + pet on a slow turntable. Framed close for
  //    Chef/Pet edits, or standing in the room (front-centre) for room edits so the
  //    walls/floor/tables/equipment colours are clearly visible changing. ──
  private previewSpin = 0;
  private inSetup = false;
  private syncPreview(G: GameState, dt: number): void {
    const room = G.studioFocus === "room";
    this.previewSpin += dt * 0.45;
    // Mostly face the camera, with a gentle look left↔right so all sides show.
    const face = Math.sin(this.previewSpin) * 0.5;
    // Room view: chef + pet both stand front-centre in the room. Close-up view:
    // show ONLY the subject being edited (chef OR pet), centred — so the other
    // never crops in or pulls focus.
    const editingPet = G.studioCat === "pet";
    const showChef = room || !editingPet;
    const showPet = room || editingPet;
    this.chefRig.group.visible = showChef;
    if (showChef) {
      this.chefRig.group.position.set(room ? -1.4 : 4.3, 0, room ? 1.0 : 2.5);
      this.chefRig.update(dt, { speed: 0, face, carrying: false, cook: 0, fire: 0, cheer: 0 });
    }
    this.petRig.group.visible = showPet;
    if (showPet) {
      this.petRig.group.position.set(room ? 0.6 : 4.3, 0, room ? 1.4 : 2.5);
      this.petRig.update(dt, { speed: 0, face: face + 0.3, happy: 1, wag: G.t * 6, hop: 0 });
    }
    if (this.carryMesh) this.carryMesh.visible = false;
    for (const v of this.custViews.values()) v.rig.group.visible = false;
    // Hide the floating station signs in the studio preview — they otherwise poke
    // into the top of the frame and clip / overlap the setup UI.
    for (const sp of this.signSprites.values()) sp.visible = false;
    // In the character close-up, hide the kitchen clutter (stations / tables / bins)
    // so the chef or pet is the clean, sole subject. The room view keeps them.
    if (!room) {
      for (const m of this.stationMeshes.values()) m.visible = false;
      for (const m of this.tableMeshes) m.visible = false;
    }
    this.beacon.visible = false;
  }

  /** Reveal decor for owned treats (so picking a treat visibly redecorates). */
  private syncDecor(G: GameState, dt: number): void {
    const s = G.treats.join(",");
    if (s !== this.lastTreatSig) {
      this.lastTreatSig = s;
      const has = (id: string) => G.treats.includes(id as GameState["treats"][number]);
      this.decorBalloons.visible = has("extracustomer");
      this.decorClock.visible = has("time");
      this.decorRug.visible = has("fast");
      this.helperRig.group.visible = has("helper");
      const qc = has("quickcook");
      const cooks = G.stations.filter((st) => st.kind === "cook");
      this.decorFlames.forEach((fl, i) => {
        const st = cooks[i];
        fl.visible = qc && !!st;
        if (st) fl.position.set(st.x, 1.7, st.z);
      });
    }
    for (const fl of this.decorFlames) {
      if (fl.visible) fl.scale.y = 1 + Math.sin(G.t * 12 + fl.position.x) * 0.22;
    }
    if (this.helperRig.group.visible) {
      this.helperRig.update(dt, { speed: 0, face: 0.4, carrying: false, cook: 0.4, fire: 0, cheer: 0 });
    }
  }

  private syncPet(G: GameState, dt: number): void {
    const p = G.pet;
    this.petRig.group.visible = true;
    this.petPrev.x = p.x;
    this.petPrev.z = p.z;
    const speed = Math.hypot(p.vx, p.vz);
    if (speed > 0.2) this.petPrev.face = Math.atan2(p.vx, p.vz);
    this.petRig.group.position.set(p.x, 0, p.z);
    this.petRig.update(dt, { speed, face: this.petPrev.face, happy: p.happy, wag: p.wag, hop: p.hop });
  }

  private syncPlants(G: GameState): void {
    G.plants.forEach((pl, i) => {
      const bloom = G.config.plants[i]?.bloom;
      const s = `${pl.stage}:${pl.kind}:${bloom ?? -1}`;
      const v = this.plantViews.get(i);
      if (v && v.sig === s) return;
      if (v) {
        this.stage.scene.remove(v.mesh);
        disposeTree(v.mesh);
      }
      const mesh = buildPlant(pl.stage, pl.kind, bloom);
      mesh.position.set(pl.x, 0, pl.z);
      this.stage.scene.add(mesh);
      this.plantViews.set(i, { mesh, sig: s });
    });
  }

  // ── Cutscene ──
  private syncCutscene(G: GameState): void {
    const cs = G.cutscene!;
    this.stage.setCinematic(true);
    if (this.lastScene !== cs.scene) {
      this.lastScene = cs.scene;
      this.lastShot = -1;
      this.figures.setCast(cs.scene.cast ?? []);
      this.stage.setTimeOfDay(cs.scene.warm ? 0.5 : 0);
      this.chefRig.group.visible = false;
      if (this.carryMesh) this.carryMesh.visible = false;
      for (const v of this.custViews.values()) v.rig.group.visible = false;
      this.petRig.group.visible = false;
      this.beacon.visible = false;
    }
    const shot = currentShot(cs);
    if (!shot) return;
    const e = easeInOut(shotProgress(cs));
    const to = shot.to ?? shot.from;
    this.posV.set(
      shot.from.pos[0] + (to.pos[0] - shot.from.pos[0]) * e,
      shot.from.pos[1] + (to.pos[1] - shot.from.pos[1]) * e,
      shot.from.pos[2] + (to.pos[2] - shot.from.pos[2]) * e,
    );
    this.lookV.set(
      shot.from.look[0] + (to.look[0] - shot.from.look[0]) * e,
      shot.from.look[1] + (to.look[1] - shot.from.look[1]) * e,
      shot.from.look[2] + (to.look[2] - shot.from.look[2]) * e,
    );
    if (cs.shotIndex !== this.lastShot) {
      this.lastShot = cs.shotIndex;
      this.stage.snapCinePose(this.posV, this.lookV, shot.fov ?? 50);
    }
    this.stage.setCinePose(this.posV, this.lookV, shot.fov ?? 50, shot.handheld ?? 0.6);
    this.figures.update(1 / 60);
  }

  // ── Chef ──
  private syncChef(G: GameState, dt: number): void {
    const c = G.chef;
    this.chefRig.group.visible = true;
    this.chefRig.group.position.set(c.x, 0, c.z);
    this.chefRig.update(dt, {
      speed: Math.hypot(c.vx, c.vz),
      face: c.facing,
      carrying: c.carry !== null,
      cook: c.cookT / COOK_PULSE,
      fire: G.fire,
      cheer: c.cheer,
    });
  }

  private carrySigOf(carry: Carry): string {
    if (!carry) return "";
    if (carry.kind === "burnt") return "burnt";
    if (carry.kind === "raw") return "raw:" + carry.food;
    return "ready:" + carry.food + ":" + carry.quality;
  }

  private syncCarry(G: GameState): void {
    const c = G.chef;
    const s = this.carrySigOf(c.carry);
    if (s !== this.carrySig) {
      this.carrySig = s;
      if (this.carryMesh) {
        this.stage.scene.remove(this.carryMesh);
        disposeTree(this.carryMesh);
        this.carryMesh = null;
      }
      if (c.carry) {
        this.carryMesh = buildCarryMesh(c.carry);
        this.carryMesh.scale.setScalar(0.85);
        this.stage.scene.add(this.carryMesh);
      }
    }
    if (this.carryMesh) {
      this.carryMesh.visible = true;
      const fx = c.x + Math.sin(c.facing) * 0.35;
      const fz = c.z + Math.cos(c.facing) * 0.35;
      this.carryMesh.position.set(fx, 1.5, fz);
      this.carryMesh.rotation.y = c.facing;
    }
  }

  // ── Customers ──
  private buildBubble(icon: string, color: number): { bubble: THREE.Group; barFill: THREE.Mesh } {
    const bubble = new THREE.Group();
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bubbleTex, transparent: true, depthWrite: false }));
    bg.material.color = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.55);
    bg.scale.set(1.35, 1.35, 1);
    const icn = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.getIconTex(icon), transparent: true, depthWrite: false }));
    icn.scale.set(1.05, 1.05, 1);
    icn.position.set(0, 0.06, 0.01);
    const barBg = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.13, 0.04), new THREE.MeshBasicMaterial({ color: 0x2a2433 }));
    barBg.position.set(0, -0.74, 0);
    const barFill = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.09, 0.06), new THREE.MeshBasicMaterial({ color: 0x7cff8a }));
    barFill.position.set(0, -0.74, 0.02);
    bubble.add(bg, icn, barBg, barFill);
    bubble.position.set(0, 2.2, 0);
    return { bubble, barFill };
  }

  private syncCustomers(G: GameState, dt: number): void {
    const live = new Set<number>();
    for (const cust of G.customers) {
      live.add(cust.uid);
      let v = this.custViews.get(cust.uid);
      if (!v) {
        const rig = buildCustomer(cust.look);
        const fd = food(cust.order);
        const { bubble, barFill } = this.buildBubble(fd.icon, fd.color);
        rig.group.add(bubble);
        this.stage.scene.add(rig.group);
        v = { rig, bubble, barFill, prevX: cust.x, prevZ: cust.z, face: 0 };
        this.custViews.set(cust.uid, v);
      }
      this.updateCustView(v, cust, dt, G.t);
    }
    for (const [uid, v] of this.custViews) {
      if (!live.has(uid)) {
        this.stage.scene.remove(v.rig.group);
        disposeTree(v.rig.group);
        this.custViews.delete(uid);
      }
    }
  }

  private updateCustView(v: CustView, c: Customer, dt: number, t: number): void {
    v.rig.group.visible = true;
    const walking = c.state === "entering" || c.state === "leaving";
    const dx = c.x - v.prevX;
    const dz = c.z - v.prevZ;
    v.prevX = c.x;
    v.prevZ = c.z;
    if (walking && Math.hypot(dx, dz) > 1e-4) v.face = Math.atan2(dx, dz);
    else if (!walking) v.face = 0;
    v.rig.group.position.set(c.x, 0, c.z);
    v.rig.update(dt, { walking, served: c.served, mood: c.mood, face: v.face, hop: c.hop });

    const showBubble = c.state === "seated" && !c.served;
    v.bubble.visible = showBubble;
    if (showBubble) {
      const ratio = Math.max(0, Math.min(1, c.patience / c.maxPatience));
      v.barFill.scale.x = Math.max(0.02, ratio);
      v.barFill.position.x = -0.46 * (1 - ratio);
      (v.barFill.material as THREE.MeshBasicMaterial).color.setRGB(
        ratio > 0.5 ? (1 - ratio) * 2 : 1,
        ratio > 0.5 ? 1 : ratio * 2,
        0.3,
      );
      const pulse = ratio < 0.35 ? 1 + 0.09 * Math.abs(Math.sin(t * 8)) : 1;
      v.bubble.scale.setScalar(pulse);
    }
  }

  // ── Live cooking food on stations ──
  private syncSlots(G: GameState): void {
    const live = new Set<string>();
    for (const st of G.stations) {
      if (st.kind !== "cook") continue;
      const locals = this.stationSlots.get(st.id) ?? [];
      for (let i = 0; i < st.slots.length; i++) {
        const slot = st.slots[i];
        if (slot.food === null) continue;
        const key = st.id + ":" + i;
        live.add(key);
        let v = this.slotViews.get(key);
        if (!v || v.food !== slot.food) {
          if (v) {
            this.stage.scene.remove(v.mesh);
            disposeTree(v.mesh);
          }
          const mesh = buildCookingFood(slot.food);
          this.stage.scene.add(mesh);
          v = { mesh, food: slot.food };
          this.slotViews.set(key, v);
        }
        const local = locals[i] ?? new THREE.Vector3(0, 1.3, 0);
        v.mesh.position.set(st.x + local.x, local.y, st.z + local.z);
        tintCooking(v.mesh, slot);
        const pop = Math.min(1, slot.pop);
        v.mesh.scale.setScalar(0.5 + 0.5 * pop);
        if (this.flips(st)) {
          const phase = (slot.t * 0.42) % 1;
          v.mesh.rotation.x = phase < 0.12 ? Math.sin((phase / 0.12) * Math.PI) * 2 * Math.PI : 0;
        }
      }
    }
    for (const [key, v] of this.slotViews) {
      if (!live.has(key)) {
        this.stage.scene.remove(v.mesh);
        disposeTree(v.mesh);
        this.slotViews.delete(key);
      }
    }
  }

  private flips(st: Station): boolean {
    return st.id === "grill" || st.id === "hotgrill";
  }

  // ── Wayfinder beacon — the single "go here" marker (ring + bobbing icon + arrow) ──
  private syncBeacon(G: GameState): void {
    const g = G.guide;
    const dist = Math.hypot(G.chef.x - g.x, G.chef.z - g.z);
    const show = g.active && G.phase === "playing" && dist > 1.8;
    this.beacon.visible = show;
    if (!show) return;
    this.beacon.position.set(g.x, 0, g.z);
    this.beaconIcon.position.y = 3.3 + Math.abs(Math.sin(G.t * 4)) * 0.3;
    const icon = g.icon || "✨";
    if (icon !== this.beaconIconStr) {
      this.beaconIconStr = icon;
      (this.beaconIcon.material as THREE.SpriteMaterial).map = this.getIconTex(icon);
      (this.beaconIcon.material as THREE.SpriteMaterial).needsUpdate = true;
    }
  }
}
