// Flower planters that visibly grow across the run: seed → sprout → leaves →
// bud → bloom. Pure rendering; the SceneView rebuilds a planter's mesh when its
// stage changes. Each kind blooms a different candy colour.

import * as THREE from "three";
import { cyl, group, sphere, stdMat } from "./kit";

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}
function squash(m: THREE.Mesh, sy: number): THREE.Mesh {
  m.scale.y = sy;
  return m;
}

const FLOWER = [0xff6f9c, 0xffd23a, 0x7aa8ff, 0xff5d5d];

export function buildPlant(stage: number, kind: number, bloom?: number): THREE.Group {
  const potMat = stdMat(0xc77a43, { rough: 0.85 });
  const soilMat = stdMat(0x4a3526, { rough: 0.95 });
  const stemMat = stdMat(0x5fbf52, { rough: 0.7 });
  const leafMat = stdMat(0x74cf60, { rough: 0.7 });
  const fmat = stdMat(bloom ?? FLOWER[kind % 4], { rough: 0.5 });

  const pot = at(cyl(0.34, 0.26, 0.5, potMat, 16), 0, 0.25, 0);
  const rim = at(cyl(0.38, 0.38, 0.09, stdMat(0xd98a5a, { rough: 0.8 }), 16), 0, 0.48, 0);
  const soil = at(cyl(0.31, 0.31, 0.06, soilMat, 16), 0, 0.5, 0);
  const parts: THREE.Object3D[] = [pot, rim, soil];

  if (stage <= 0) {
    parts.push(at(sphere(0.05, stdMat(0x6a4a30, { rough: 0.9 }), 8), 0, 0.56, 0));
    return group(...parts);
  }

  const stemH = 0.18 + stage * 0.18;
  const stem = at(cyl(0.045, 0.06, stemH, stemMat, 10), 0, 0.5 + stemH / 2, 0);
  parts.push(stem);

  const leaves = Math.min(stage + 1, 4);
  for (let i = 0; i < leaves; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const ly = 0.6 + (i / leaves) * stemH * 0.7;
    const leaf = squash(sphere(0.13, leafMat, 10), 0.5);
    leaf.scale.x = 1.6;
    at(leaf, side * 0.16, ly, 0);
    leaf.rotation.z = side * 0.5;
    parts.push(leaf);
  }

  const topY = 0.5 + stemH;
  const center = stdMat(0xffe27a, { rough: 0.5 });
  const type = ((kind % 4) + 4) % 4; // 0 daisy · 1 tulip · 2 rose · 3 big bloom
  if (stage === 3) {
    // a closed bud (slim for tulips, round for the rest)
    const bud = type === 1 ? squash(sphere(0.12, fmat, 12), 1.7) : squash(sphere(0.13, fmat, 12), 1.4);
    parts.push(at(bud, 0, topY + 0.05, 0));
  } else if (stage >= 4) {
    const y = topY + 0.05;
    if (type === 0) {
      // Daisy — many slim petals around a small centre.
      parts.push(at(sphere(0.1, center, 12), 0, y, 0));
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const petal = squash(sphere(0.085, fmat, 8), 0.45);
        petal.scale.x = 2.0;
        at(petal, Math.cos(a) * 0.2, y, Math.sin(a) * 0.2);
        petal.rotation.y = -a;
        parts.push(petal);
      }
    } else if (type === 1) {
      // Tulip — a tight cup of a few upright petals.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const petal = squash(sphere(0.12, fmat, 10), 1.5);
        at(petal, Math.cos(a) * 0.07, y + 0.06, Math.sin(a) * 0.07);
        petal.rotation.z = Math.cos(a) * 0.25;
        petal.rotation.x = Math.sin(a) * 0.25;
        parts.push(petal);
      }
    } else if (type === 2) {
      // Rose — layered rings of rounded petals.
      parts.push(at(sphere(0.09, fmat, 12), 0, y, 0));
      for (const [n, r, s] of [[5, 0.14, 0.1], [4, 0.09, 0.12]] as [number, number, number][]) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + r;
          const petal = squash(sphere(s, fmat, 10), 0.8);
          at(petal, Math.cos(a) * r, y + 0.03, Math.sin(a) * r);
          parts.push(petal);
        }
      }
    } else {
      // Big bloom — sunny centre + a ring of round petals.
      parts.push(at(sphere(0.13, center, 12), 0, y, 0));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const petal = squash(sphere(0.12, fmat, 10), 0.6);
        at(petal, Math.cos(a) * 0.2, y, Math.sin(a) * 0.2);
        parts.push(petal);
      }
    }
    // A tiny happy face on every bloom.
    const eyeMat = stdMat(0x2a1d22, { rough: 0.3 });
    parts.push(at(sphere(0.025, eyeMat, 8), -0.05, y + 0.01, 0.12));
    parts.push(at(sphere(0.025, eyeMat, 8), 0.05, y + 0.01, 0.12));
  }

  return group(...parts);
}
