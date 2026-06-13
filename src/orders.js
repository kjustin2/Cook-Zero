// Customers: they walk in the door, queue at the front counter with an order
// bubble, lose patience, and walk out (happy or furious). A customer IS the
// order — plates are matched against waiting customers.

import { fx } from './fx.js';
import { audio } from './audio.js';

export const RECIPES = [
  { id: 'fries',  name: 'Fries Basket',   emoji: '🍟', parts: ['fries'],                          coins: 10, minShift: 1, weight: 3 },
  { id: 'burger', name: 'Classic Burger', emoji: '🍔', parts: ['bun', 'patty'],                   coins: 16, minShift: 1, weight: 4 },
  { id: 'cheese', name: 'Cheeseburger',   emoji: '🧀', parts: ['bun', 'patty', 'cheese'],         coins: 22, minShift: 2, weight: 3 },
  { id: 'combo',  name: 'Combo Meal',     emoji: '🍱', parts: ['bun', 'patty', 'fries'],          coins: 26, minShift: 3, weight: 2 },
  { id: 'double', name: 'Double Trouble', emoji: '😤', parts: ['bun', 'patty', 'patty', 'cheese'], coins: 34, minShift: 4, weight: 2 },
];

export const SPOT_COUNT = 5;
export const SPOT_Y = 182;
export const spotX = (i) => 280 + i * 170;
const ENTER_X = 1330;       // off-screen, right of the door
const WALK_SPEED = 200;
const LEAVE_SPEED = 180;
const STORM_SPEED = 280;
const NO_SPAWN_TAIL = 15;   // stop seating customers this close to shift end

const SKINS = ['#f2c79b', '#e0a878', '#c98a5e', '#8d5a3b', '#6e4428', '#f7d9b8'];
const SHIRTS = ['#5ee0c8', '#7aa2ff', '#ff7ad9', '#ffd54a', '#9fe06b', '#ff8a6b', '#b58cff', '#6bd3ff'];
const HAIRS = ['#2b2118', '#4a3826', '#7a5230', '#b8b8c4', '#c4452f', '#202330'];

export const plateKey = (parts) => parts.slice().sort().join('+');

export function comboMult(combo) {
  return 1 + 0.25 * Math.min(Math.max(0, combo - 1), 8);
}

function basePatience(G) {
  return Math.max(28, 54 - G.shift * 4) * G.mods.patience;
}

function pickRecipe(G) {
  const pool = RECIPES.filter((r) => r.minShift <= G.shift);
  let total = 0;
  for (const r of pool) total += r.weight;
  let roll = Math.random() * total;
  for (const r of pool) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return pool[0];
}

function spawnInterval(G) {
  const ramp = (1 - G.shiftTime / G.SHIFT_LEN) * 2; // pressure rises within the shift
  const base = Math.max(4.5, 12 - G.shift * 1.4 - ramp);
  return base * (0.85 + Math.random() * 0.3);
}

function spawnCustomer(G, recipe) {
  const taken = new Set(G.customers.filter((c) => c.state === 'walkin' || c.state === 'waiting').map((c) => c.spot));
  const free = [];
  for (let i = 0; i < SPOT_COUNT; i++) if (!taken.has(i)) free.push(i);
  if (free.length === 0) return false;
  const spot = free[(Math.random() * free.length) | 0];
  const p = basePatience(G);
  G.customers.push({
    recipe, spot,
    x: ENTER_X, y: SPOT_Y, tx: spotX(spot),
    state: 'walkin',
    patience: p, maxPatience: p,
    age: 0, waitT: 0, servedT: 0, angry: false,
    look: {
      skin: SKINS[(Math.random() * SKINS.length) | 0],
      shirt: SHIRTS[(Math.random() * SHIRTS.length) | 0],
      hair: HAIRS[(Math.random() * HAIRS.length) | 0],
      hat: Math.random() < 0.25,
    },
    bobPhase: Math.random() * 6.28,
  });
  return true;
}

export function resetShiftOrders(G) {
  G.customers = [];
  G.spawnTimer = 0.3;
  G.tickTimer = 0;
  // Scripted openers on shift 1 so the first minute teaches the loop.
  G.scriptedQueue = G.shift === 1
    ? [RECIPES.find((r) => r.id === 'burger'), RECIPES.find((r) => r.id === 'fries')]
    : [];
}

export function updateOrders(G, dt) {
  // Seat new customers.
  G.spawnTimer -= dt;
  if (G.spawnTimer <= 0) {
    const active = G.customers.filter((c) => c.state === 'walkin' || c.state === 'waiting').length;
    if (active < SPOT_COUNT && G.shiftTime > NO_SPAWN_TAIL &&
        spawnCustomer(G, G.scriptedQueue.length ? G.scriptedQueue.shift() : pickRecipe(G))) {
      G.spawnTimer = spawnInterval(G);
    } else {
      G.spawnTimer = 1; // retry soon
    }
  }

  let lowest = 1;
  for (let i = G.customers.length - 1; i >= 0; i--) {
    const c = G.customers[i];
    c.age += dt;

    if (c.state === 'walkin') {
      c.x -= WALK_SPEED * dt;
      if (c.x <= c.tx) {
        c.x = c.tx;
        c.state = 'waiting';
        audio.pickup();
      }
    } else if (c.state === 'waiting') {
      c.waitT += dt;
      c.patience -= dt;
      lowest = Math.min(lowest, c.patience / c.maxPatience);
      if (c.patience <= 0) {
        c.state = 'leaving';
        c.angry = true;
        G.stats.expired++;
        if (G.combo > 0) {
          G.combo = 0;
          G.comboTimer = 0;
        }
        audio.buzzer();
        fx.addShake(7);
        fx.text(c.x, c.y - 70, '💢 That\'s it, I\'m leaving!', '#ff5a3c', 16);
      }
    } else if (c.state === 'served') {
      c.servedT += dt;
      if (Math.random() < dt * 3) fx.text(c.x + (Math.random() - 0.5) * 26, c.y - 50, '❤', '#ff7ad9', 13);
      if (c.servedT > 0.8) c.state = 'leaving';
    } else { // leaving
      c.x += (c.angry ? STORM_SPEED : LEAVE_SPEED) * dt;
      if (c.angry && Math.random() < dt * 8) fx.smoke(c.x - 8, c.y - 30, 'rgba(255,90,60,', 1);
      if (c.x > ENTER_X) G.customers.splice(i, 1);
    }
  }

  // Anxiety tick when someone is about to walk.
  if (lowest < 0.22) {
    G.tickTimer -= dt;
    if (G.tickTimer <= 0) {
      audio.tick();
      G.tickTimer = 1.1;
    }
  }
}

// The waiting customer whose order matches this plate (lowest patience first).
export function findMatch(G, parts) {
  const key = plateKey(parts);
  let best = null;
  for (const c of G.customers) {
    if (c.state !== 'waiting' || plateKey(c.recipe.parts) !== key) continue;
    if (!best || c.patience < best.patience) best = c;
  }
  return best;
}

// Serve a plate to a specific waiting customer. Caller has already matched.
export function serveCustomer(G, c, plate) {
  c.state = 'served';
  c.servedT = 0;

  G.combo += 1;
  G.comboTimer = G.mods.comboWindow;
  G.comboPop = 0.25;
  if (G.combo > G.bestCombo) G.bestCombo = G.combo;

  const speedBonus = Math.round(6 * (c.patience / c.maxPatience));
  const perfectBonus = (plate.perfects || 0) * 5;
  const total = Math.round((c.recipe.coins + perfectBonus + speedBonus) * comboMult(G.combo)) + G.mods.tip;

  G.coins += total;
  G.shiftCoins += total;
  G.stats.served++;
  G.stats.perfect += plate.perfects || 0;

  audio.coin(G.combo);
  fx.burst(c.x, c.y - 20, '#ffd54a', 14);
  fx.text(c.x, c.y - 64, `+$${total}`, '#ffd54a', 24);
  if (plate.perfects) fx.text(c.x, c.y - 92, '✨ PERFECT', '#fff3b0', 16);
  fx.addShake(2.5);

  if (G.combo === 5) {
    audio.whoosh();
    fx.text(640, 330, '🔥 ON FIRE!! 🔥', '#ff9b2d', 34);
    fx.addShake(6);
  } else if (G.combo >= 2) {
    fx.text(c.x, c.y - 116, `COMBO ×${G.combo}`, '#5ee0c8', 15);
  }
}
