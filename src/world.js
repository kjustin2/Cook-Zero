// The restaurant: layout zones, stations, player movement, and the
// context-sensitive interact action. Logical canvas is 1280×720.
//
// Vertical zones:  HUD bar → back wall (windows/door) → dining floor where
// customers queue → front counter → kitchen (bins, plating, grill, fryer).

import { fx } from './fx.js';
import { audio } from './audio.js';
import { serveCustomer, plateKey } from './orders.js';

export const W = 1280;
export const H = 720;

export const ZONES = {
  hudH: 52,        // HUD bar
  wallB: 100,      // back wall bottom (windows, door, neon)
  counterY: 214,   // front counter top
  counterH: 48,
  counterX: 140,
  counterW: 1000,
  kitchenTop: 262, // kitchen floor starts
};

export const EMOJI = {
  bun: '🥯',
  patty: '🥩',
  patty_raw: '🥩',
  cheese: '🧀',
  potato: '🥔',
  fries: '🍟',
};

// Grill timing (seconds). cookT is divided by the Turbo Grill modifier.
const BASE_COOK = 6;
const BASE_PERFECT = 2.2;
const BURN_EXTRA = 3.5;
const FRY_T = 5;

const PLAYER_R = 20;
const INTERACT_DIST = 92;
const BASE_SPEED = 330;

const BIN_DEFS = [
  { id: 'bun', label: 'BUNS' },
  { id: 'patty_raw', label: 'PATTIES' },
  { id: 'potato', label: 'POTATOES' },
  { id: 'cheese', label: 'CHEESE' },
];

export function computeLayout(G) {
  const L = {};
  L.bins = BIN_DEFS.map((b, i) => ({ ...b, x: 28, y: 280 + i * 94, w: 92, h: 86 }));
  L.trash = { x: W - 104, y: 528, w: 80, h: 84 };

  const gs = G.mods.grillSlots;
  L.grillSlots = [];
  for (let i = 0; i < gs; i++) L.grillSlots.push({ x: 240 + i * 94, y: H - 106, w: 80, h: 80 });
  L.grillZone = { x: 224, y: H - 132, w: gs * 94 + 18, h: 118 };

  const fx0 = L.grillZone.x + L.grillZone.w + 44;
  L.fryerSlots = [];
  for (let i = 0; i < G.mods.fryerSlots; i++) L.fryerSlots.push({ x: fx0 + 16 + i * 94, y: H - 106, w: 80, h: 80 });
  L.fryerZone = { x: fx0, y: H - 132, w: G.mods.fryerSlots * 94 + 34, h: 118 };

  const cc = G.mods.counters;
  const cw = 112, gap = 36;
  const cx0 = 660 - (cc * cw + (cc - 1) * gap) / 2;
  L.counters = [];
  for (let i = 0; i < cc; i++) L.counters.push({ x: cx0 + i * (cw + gap), y: 420, w: cw, h: 68 });

  return L;
}

export function resetShiftWorld(G) {
  G.layout = computeLayout(G);
  G.grill = G.layout.grillSlots.map(() => ({ state: 'empty', t: 0, cookT: 0, perfT: 0, burnT: 0, smokeT: 0 }));
  G.fryer = G.layout.fryerSlots.map(() => ({ state: 'empty', t: 0 }));
  G.plates = G.layout.counters.map(() => ({ parts: [], perfects: 0 }));
  G.carry = null;
  G.player = { x: 660, y: 520, vx: 0, vy: 0, face: 1, walk: 0 };
  G.hint = null;
  G.sizzleLevel = 0;
}

const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// Build the action available at one interactable for the current carry state.
// Returns { label, fn } or null.
function actionFor(G, kind, i, ref) {
  const c = G.carry;
  if (kind === 'bin') {
    const bin = G.layout.bins[i];
    if (!c) {
      return {
        label: `Grab ${EMOJI[bin.id]}`,
        fn: () => { G.carry = { kind: 'ing', id: bin.id }; audio.pickup(); },
      };
    }
    return null;
  }

  if (kind === 'grill') {
    const slot = G.grill[i];
    const pos = center(G.layout.grillSlots[i]);
    if (c && c.kind === 'ing' && c.id === 'patty_raw' && slot.state === 'empty') {
      return {
        label: 'Grill patty',
        fn: () => {
          slot.state = 'on';
          slot.t = 0;
          slot.cookT = BASE_COOK / G.mods.cookSpeed;
          slot.perfT = slot.cookT + BASE_PERFECT + G.mods.perfectWindow;
          slot.burnT = slot.perfT + BURN_EXTRA;
          G.carry = null;
          audio.place();
          fx.smoke(pos.x, pos.y - 10, 'rgba(255,160,90,', 2);
        },
      };
    }
    if (!c && slot.state === 'on') {
      if (slot.t >= slot.burnT) {
        return {
          label: 'Scrape off 🪦',
          fn: () => {
            slot.state = 'empty';
            G.carry = { kind: 'burnt' };
            audio.trash();
            fx.smoke(pos.x, pos.y - 10);
          },
        };
      }
      if (slot.t >= slot.cookT) {
        const perfect = slot.t < slot.perfT;
        return {
          label: perfect ? 'Take patty ✨' : 'Take patty',
          fn: () => {
            slot.state = 'empty';
            G.carry = { kind: 'part', id: 'patty', quality: perfect ? 'perfect' : 'cooked' };
            if (perfect) {
              audio.perfect();
              fx.burst(pos.x, pos.y - 14, '#fff3b0', 10, 120);
              fx.text(pos.x, pos.y - 44, 'PERFECT!', '#fff3b0', 17);
            } else {
              audio.pickup();
            }
          },
        };
      }
    }
    return null;
  }

  if (kind === 'fryer') {
    const slot = G.fryer[i];
    const pos = center(G.layout.fryerSlots[i]);
    if (c && c.kind === 'ing' && c.id === 'potato' && slot.state === 'empty') {
      return {
        label: 'Fry potato',
        fn: () => {
          slot.state = 'on';
          slot.t = 0;
          G.carry = null;
          audio.place();
        },
      };
    }
    if (!c && slot.state === 'on' && slot.t >= FRY_T) {
      return {
        label: 'Take fries',
        fn: () => {
          slot.state = 'empty';
          G.carry = { kind: 'part', id: 'fries' };
          audio.pickup();
          fx.burst(pos.x, pos.y - 14, '#ffd54a', 6, 100);
        },
      };
    }
    return null;
  }

  if (kind === 'counter') {
    const plate = G.plates[i];
    if (c && c.kind === 'ing' && (c.id === 'bun' || c.id === 'cheese') && plate.parts.length < 5) {
      return {
        label: 'Plate it',
        fn: () => { plate.parts.push(c.id); G.carry = null; audio.place(); },
      };
    }
    if (c && c.kind === 'part' && plate.parts.length < 5) {
      return {
        label: 'Plate it',
        fn: () => {
          plate.parts.push(c.id);
          if (c.quality === 'perfect') plate.perfects++;
          G.carry = null;
          audio.place();
        },
      };
    }
    if (c && c.kind === 'plate' && plate.parts.length === 0) {
      return {
        label: 'Set plate down',
        fn: () => {
          plate.parts = c.parts;
          plate.perfects = c.perfects;
          G.carry = null;
          audio.place();
        },
      };
    }
    if (!c && plate.parts.length > 0) {
      return {
        label: 'Pick up plate',
        fn: () => {
          G.carry = { kind: 'plate', parts: plate.parts, perfects: plate.perfects };
          plate.parts = [];
          plate.perfects = 0;
          audio.pickup();
        },
      };
    }
    return null;
  }

  if (kind === 'customer') {
    const cust = ref;
    if (c && c.kind === 'plate') {
      if (plateKey(c.parts) === plateKey(cust.recipe.parts)) {
        return {
          label: `Serve ${cust.recipe.name}! 🛎️`,
          fn: () => {
            serveCustomer(G, cust, c);
            G.carry = null;
          },
        };
      }
      return {
        label: 'Not their order…',
        fn: () => audio.buzzer(),
      };
    }
    return null;
  }

  if (kind === 'trash') {
    if (c) {
      return {
        label: 'Trash it',
        fn: () => {
          G.carry = null;
          G.stats.trashed++;
          audio.trash();
          const pos = center(G.layout.trash);
          fx.smoke(pos.x, pos.y - 20);
        },
      };
    }
    return null;
  }
  return null;
}

function collectInteractables(G) {
  const list = [];
  const L = G.layout;
  L.bins.forEach((b, i) => list.push({ kind: 'bin', i, ...center(b) }));
  L.grillSlots.forEach((s, i) => list.push({ kind: 'grill', i, ...center(s) }));
  L.fryerSlots.forEach((s, i) => list.push({ kind: 'fryer', i, ...center(s) }));
  L.counters.forEach((s, i) => list.push({ kind: 'counter', i, ...center(s) }));
  // Waiting customers are served across the front counter.
  for (const c of G.customers) {
    if (c.state === 'waiting') list.push({ kind: 'customer', i: 0, ref: c, x: c.x, y: ZONES.counterY + 64 });
  }
  list.push({ kind: 'trash', i: 0, ...center(L.trash) });
  return list;
}

export function updateWorld(G, dt, input) {
  const p = G.player;

  // Movement: snappy accel toward target velocity.
  const ax = input.axis();
  const speed = BASE_SPEED * G.mods.moveSpeed;
  const k = Math.min(1, dt * 12);
  p.vx += (ax.x * speed - p.vx) * k;
  p.vy += (ax.y * speed - p.vy) * k;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (Math.abs(p.vx) > 10) p.face = Math.sign(p.vx);
  p.walk += Math.hypot(p.vx, p.vy) * dt * 0.05;

  // Kick up a little dust when sprinting.
  if (Math.hypot(p.vx, p.vy) > 240 && Math.random() < dt * 8) {
    fx.smoke(p.x - p.face * 10, p.y + 14, 'rgba(150,150,165,', 1);
  }

  // Keep the chef on the kitchen floor.
  p.x = Math.max(144, Math.min(W - 140, p.x));
  p.y = Math.max(ZONES.kitchenTop + 30, Math.min(H - 145, p.y));

  // Soft push-out from plating counters so they read as solid.
  for (const c of G.layout.counters) {
    const nx = Math.max(c.x, Math.min(p.x, c.x + c.w));
    const ny = Math.max(c.y, Math.min(p.y, c.y + c.h));
    const dx = p.x - nx, dy = p.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < PLAYER_R * PLAYER_R && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      p.x += (dx / d) * (PLAYER_R - d);
      p.y += (dy / d) * (PLAYER_R - d);
    }
  }

  // Grill slots tick.
  let sizzling = 0;
  G.grill.forEach((slot, i) => {
    if (slot.state !== 'on') return;
    const pos = center(G.layout.grillSlots[i]);
    const prev = slot.t;
    slot.t += dt;
    if (slot.t < slot.burnT) sizzling++;
    if (prev < slot.cookT && slot.t >= slot.cookT) {
      audio.ding();
      fx.text(pos.x, pos.y - 46, 'Ready!', '#7ad97a', 15);
    }
    if (prev < slot.burnT && slot.t >= slot.burnT) {
      audio.buzzer();
      fx.addShake(4);
      fx.text(pos.x, pos.y - 46, 'BURNT!', '#ff5a3c', 16);
    }
    if (slot.t >= slot.burnT) {
      slot.smokeT -= dt;
      if (slot.smokeT <= 0) {
        fx.smoke(pos.x, pos.y - 12);
        slot.smokeT = 0.4;
      }
    } else if (slot.t > slot.cookT * 0.3 && Math.random() < dt * 4) {
      fx.burst(pos.x + (Math.random() - 0.5) * 30, pos.y - 8, '#ffb36b', 1, 50);
    }
  });
  G.sizzleLevel = sizzling;

  // Fryer slots tick.
  G.fryer.forEach((slot, i) => {
    if (slot.state !== 'on') return;
    const prev = slot.t;
    slot.t += dt;
    if (prev < FRY_T && slot.t >= FRY_T) {
      const pos = center(G.layout.fryerSlots[i]);
      audio.ding();
      fx.text(pos.x, pos.y - 46, 'Fries up!', '#ffd54a', 15);
    }
  });

  // Nearest available action → hint + interact.
  G.hint = null;
  let bestD = INTERACT_DIST * INTERACT_DIST;
  let best = null;
  for (const it of collectInteractables(G)) {
    const d = dist2(p, it);
    if (d > bestD) continue;
    const act = actionFor(G, it.kind, it.i, it.ref);
    if (!act) continue;
    bestD = d;
    best = { ...it, ...act };
  }
  if (best) {
    G.hint = best;
    if (input.interactPressed()) best.fn();
  }

  // ON FIRE chef trail.
  if (G.combo >= 5 && Math.random() < dt * 22) fx.flame(p.x, p.y - 26, true);
}
