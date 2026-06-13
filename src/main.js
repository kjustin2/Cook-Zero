// Boot, the game state machine, and the main loop.
// States: title → playing → shiftEnd → upgrade → playing… → gameOver | win

import { input } from './input.js';
import { audio } from './audio.js';
import { fx } from './fx.js';
import { W, H, resetShiftWorld, updateWorld, computeLayout } from './world.js';
import { resetShiftOrders, updateOrders } from './orders.js';
import { rollUpgrades } from './upgrades.js';
import { render } from './render.js';

const TOTAL_SHIFTS = 5;
const SHIFT_LEN = 120;
const QUOTAS = [70, 120, 190, 260, 340];
const SAVE_KEY = 'sizzle_rush_save';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---------- letterboxed scaling ----------
let scale = 1, offX = 0, offY = 0, dpr = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  scale = Math.min(cw / W, ch / H);
  offX = (cw - W * scale) / 2;
  offY = (ch - H * scale) / 2;
}
window.addEventListener('resize', resize);
resize();

input.toLogical = (cx, cy) => {
  const r = canvas.getBoundingClientRect();
  return { x: (cx - r.left - offX) / scale, y: (cy - r.top - offY) / scale };
};
input.init(canvas);

// Audio can only start after a user gesture.
const wake = () => audio.init();
window.addEventListener('keydown', wake);
window.addEventListener('mousedown', wake);

// ---------- game state ----------

function loadMeta() {
  try {
    return { bestShift: 0, bestCoins: 0, bestCombo: 0, runs: 0, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') };
  } catch {
    return { bestShift: 0, bestCoins: 0, bestCombo: 0, runs: 0 };
  }
}

const G = {
  state: 'title',
  t: 0,
  paused: false,
  TOTAL_SHIFTS,
  SHIFT_LEN,
  shift: 1,
  shiftTime: SHIFT_LEN,
  quota: QUOTAS[0],
  coins: 0,
  shiftCoins: 0,
  combo: 0,
  comboTimer: 0,
  comboPop: 0,
  bestCombo: 0,
  totalServed: 0,
  totalPerfect: 0,
  stats: { served: 0, perfect: 0, expired: 0, trashed: 0 },
  mods: null,
  upgradesTaken: [],
  upgradeChoices: [],
  customers: [],
  ui: { buttons: [], primary: null },
  meta: loadMeta(),
  sizzleLevel: 0,
};

function defaultMods() {
  return {
    moveSpeed: 1, cookSpeed: 1, patience: 1,
    perfectWindow: 0, tip: 0, comboWindow: 12,
    grillSlots: 3, fryerSlots: 2, counters: 3,
  };
}

function saveMeta() {
  G.meta.bestCoins = Math.max(G.meta.bestCoins, G.coins);
  G.meta.bestCombo = Math.max(G.meta.bestCombo, G.bestCombo);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.meta)); } catch { /* private mode */ }
}

function newRun() {
  G.shift = 1;
  G.coins = 0;
  G.bestCombo = 0;
  G.totalServed = 0;
  G.totalPerfect = 0;
  G.mods = defaultMods();
  G.upgradesTaken = [];
}

function startShift() {
  G.quota = QUOTAS[G.shift - 1];
  G.shiftTime = SHIFT_LEN;
  G.shiftCoins = 0;
  G.combo = 0;
  G.comboTimer = 0;
  G.stats = { served: 0, perfect: 0, expired: 0, trashed: 0 };
  G.paused = false;
  fx.reset();
  resetShiftWorld(G);
  resetShiftOrders(G);
  G.state = 'playing';
}

function endShift() {
  G.totalServed += G.stats.served;
  G.totalPerfect += G.stats.perfect;
  const pass = G.shiftCoins >= G.quota;
  if (pass) {
    G.meta.bestShift = Math.max(G.meta.bestShift, G.shift);
    audio.fanfare();
    fx.confetti(W / 2, H / 2 - 60, 30);
  } else {
    audio.fail();
  }
  saveMeta();
  G.state = 'shiftEnd';
}

function endRun(won) {
  G.meta.runs += 1;
  saveMeta();
  G.state = won ? 'win' : 'gameOver';
  if (won) audio.fanfare();
}

function pickUpgrade(i) {
  const u = G.upgradeChoices[i];
  if (!u) return;
  u.apply(G.mods);
  G.upgradesTaken.push(u.id);
  audio.click();
  G.shift += 1;
  startShift();
}

function handleAction(id) {
  audio.click();
  if (id === 'start' || id === 'again') {
    newRun();
    startShift();
  } else if (id === 'continue') {
    const pass = G.shiftCoins >= G.quota;
    if (!pass) endRun(false);
    else if (G.shift >= TOTAL_SHIFTS) endRun(true);
    else {
      G.upgradeChoices = rollUpgrades(G);
      G.state = 'upgrade';
    }
  } else if (id === 'title') {
    G.state = 'title';
  } else if (id.startsWith('pick')) {
    pickUpgrade(Number(id.slice(4)));
  }
}

// ---------- per-frame update ----------

function update(dt) {
  // global keys
  if (input.pressed.KeyM) audio.toggleMute();

  if (G.state === 'playing') {
    if (input.pressed.KeyP || input.pressed.Escape) G.paused = !G.paused;
    if (!G.paused) {
      G.shiftTime -= dt;
      updateWorld(G, dt, input);
      updateOrders(G, dt);
      if (G.combo > 0) {
        G.comboTimer -= dt;
        if (G.comboTimer <= 0) {
          G.combo = 0;
          G.comboTimer = 0;
        }
      }
      G.comboPop = Math.max(0, G.comboPop - dt);
      if (G.shiftTime <= 0) {
        G.shiftTime = 0;
        endShift();
      }
    }
    return;
  }

  // menu states: clicks hit-test against last frame's buttons
  if (input.mouse.clicked) {
    for (const b of G.ui.buttons) {
      if (input.mouse.x >= b.x && input.mouse.x <= b.x + b.w &&
          input.mouse.y >= b.y && input.mouse.y <= b.y + b.h) {
        handleAction(b.id);
        return;
      }
    }
  }
  if (G.ui.primary && input.confirmPressed()) {
    handleAction(G.ui.primary);
    return;
  }
  if (G.state === 'upgrade') {
    if (input.pressed.Digit1) pickUpgrade(0);
    else if (input.pressed.Digit2) pickUpgrade(1);
    else if (input.pressed.Digit3) pickUpgrade(2);
  }
}

// ---------- main loop ----------

// Layout must exist before the first title-screen render.
G.mods = defaultMods();
G.layout = computeLayout(G);
resetShiftWorld(G);
G.state = 'title';

window.__G = G; // debug/testing hook

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.t += dt;

  update(dt);
  fx.update(dt);
  audio.update(G);

  // letterbox bars
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#06070b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
  render(G, ctx);

  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
