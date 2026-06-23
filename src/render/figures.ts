// Cutscene cast — a small pool of cute figures (Pip, Grandma, guests) placed by
// the CineScene's `cast` data and animated with gentle idle/stroll motion. Owned
// by the SceneView's cinematic layer so it never fights the live gameplay actors.

import * as THREE from "three";
import type { CastPlacement } from "../game/types";
import { buildChef, buildCustomer, type ChefRig, type CustomerRig } from "./actors";

interface Member {
  group: THREE.Group;
  step: (dt: number, walking: boolean, face: number) => void;
}

export class Figures {
  private root = new THREE.Group();
  private pip: Member;
  private grandma: Member;
  private guests: Member[] = [];
  private active: Array<{ m: Member; x: number; y: number; z: number; vz: number; face: number }> = [];

  constructor(scene: THREE.Scene) {
    const wrapChef = (rig: ChefRig): Member => ({
      group: rig.group,
      step: (dt, walking, face) => rig.update(dt, { speed: walking ? 3 : 0, face, carrying: false, cook: 0, fire: 0, cheer: 0 }),
    });
    const wrapCust = (rig: CustomerRig): Member => ({
      group: rig.group,
      step: (dt, walking, face) => rig.update(dt, { walking, served: true, mood: 1, face, hop: 0 }),
    });
    this.pip = wrapChef(buildChef());
    this.grandma = wrapChef(buildChef({ grandma: true }));
    for (let i = 0; i < 8; i++) {
      this.guests.push(wrapCust(buildCustomer({ body: i, hair: (i * 3) % 6, hat: i % 3 === 0, hue: (i * 0.137) % 1 })));
    }
    for (const m of [this.pip, this.grandma, ...this.guests]) {
      m.group.visible = false;
      this.root.add(m.group);
    }
    scene.add(this.root);
  }

  setCast(cast: CastPlacement[]): void {
    this.hideAll();
    let guestIdx = 0;
    for (const c of cast) {
      let m: Member | null = null;
      if (c.who === "pip") m = this.pip;
      else if (c.who === "grandma") m = this.grandma;
      else m = this.guests[guestIdx++ % this.guests.length];
      if (!m) continue;
      m.group.visible = true;
      m.group.position.set(c.x, c.y, c.z);
      m.group.rotation.y = c.ry ?? 0;
      this.active.push({ m, x: c.x, y: c.y, z: c.z, vz: c.vz ?? 0, face: c.ry ?? 0 });
    }
  }

  update(dt: number): void {
    for (const a of this.active) {
      const walking = Math.abs(a.vz) > 0.01;
      if (walking) {
        a.z += a.vz * dt;
        a.face = a.vz < 0 ? Math.PI : 0;
        a.m.group.position.z = a.z;
      }
      a.m.step(dt, walking, a.face);
    }
  }

  hideAll(): void {
    for (const a of this.active) a.m.group.visible = false;
    this.active = [];
  }
}
