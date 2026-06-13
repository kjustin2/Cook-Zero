// All canvas drawing. Reads game state, never mutates it — except G.ui.buttons,
// which it rebuilds each frame so main can hit-test clicks.

import { W, H, ZONES, EMOJI } from './world.js';
import { findMatch, comboMult } from './orders.js';
import { takenCount } from './upgrades.js';
import { fx } from './fx.js';
import { input } from './input.js';
import { audio } from './audio.js';

if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

const FONT = "'Segoe UI', system-ui, sans-serif";

function rr(ctx, x, y, w, h, r, fill, stroke, lw = 2) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function txt(ctx, str, x, y, size, color, align = 'left', weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function emoji(ctx, e, x, y, size) {
  ctx.font = `${size}px 'Segoe UI Emoji', ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(e, x, y + size * 0.36);
}

function shadow(ctx, x, y, rx, ry, a = 0.32) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fill();
}

function button(ctx, G, id, x, y, w, h, label, primary = false) {
  const hov = input.mouse.x >= x && input.mouse.x <= x + w && input.mouse.y >= y && input.mouse.y <= y + h;
  const lift = hov ? 3 : 0;
  shadow(ctx, x + w / 2, y + h + 4, w * 0.46, 7, 0.35);
  rr(ctx, x, y - lift, w, h, 12,
    primary ? (hov ? '#ff7a52' : '#ff5a3c') : (hov ? '#3a4060' : '#2c3148'),
    primary ? '#ffd54a' : '#4a5172', primary ? 3 : 2);
  txt(ctx, label, x + w / 2, y - lift + h / 2 + 7, 20, '#fff', 'center', 800);
  G.ui.buttons.push({ id, x, y, w, h });
  return hov;
}

// ---------- restaurant backdrop ----------

function drawBackdrop(ctx, G) {
  const Z = ZONES;

  // back wall
  const wg = ctx.createLinearGradient(0, Z.hudH, 0, Z.wallB);
  wg.addColorStop(0, '#2b2f44');
  wg.addColorStop(1, '#232738');
  ctx.fillStyle = wg;
  ctx.fillRect(0, Z.hudH, W, Z.wallB - Z.hudH);
  ctx.fillStyle = '#1b1e2c'; // baseboard
  ctx.fillRect(0, Z.wallB - 6, W, 6);

  // night windows
  for (const wx of [250, 530, 810]) {
    rr(ctx, wx, Z.hudH + 8, 150, 34, 6, null, '#454b68', 3);
    const ng = ctx.createLinearGradient(0, Z.hudH + 8, 0, Z.hudH + 42);
    ng.addColorStop(0, '#101a33');
    ng.addColorStop(1, '#1c2a4d');
    rr(ctx, wx, Z.hudH + 8, 150, 34, 6, ng);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let s = 0; s < 7; s++) {
      const sx = wx + 12 + ((s * 53 + wx) % 126);
      const sy = Z.hudH + 13 + ((s * 29) % 22);
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.strokeStyle = '#454b68';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx + 75, Z.hudH + 8);
    ctx.lineTo(wx + 75, Z.hudH + 42);
    ctx.stroke();
  }
  // moon in the first window
  ctx.beginPath();
  ctx.arc(286, ZONES.hudH + 22, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#f2ecd4';
  ctx.fill();

  // neon OPEN sign
  const flick = Math.sin(G.t * 1.7) > -0.92 ? 1 : 0.4;
  ctx.save();
  ctx.shadowColor = '#ff5a3c';
  ctx.shadowBlur = 14 * flick;
  txt(ctx, 'OPEN', 105, Z.hudH + 34, 21, `rgba(255,110,80,${flick})`, 'center', 900);
  ctx.restore();
  rr(ctx, 64, Z.hudH + 12, 82, 30, 8, null, 'rgba(255,110,80,0.5)', 2);

  // dining floor: warm wood planks
  ctx.fillStyle = '#43352a';
  ctx.fillRect(0, Z.wallB, W, Z.counterY - Z.wallB);
  for (let py = Z.wallB; py < Z.counterY; py += 19) {
    ctx.fillStyle = ((py / 19) | 0) % 2 ? '#3e3126' : '#473828';
    ctx.fillRect(0, py, W, 17);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let sx = ((py * 7) % 160); sx < W; sx += 213) ctx.fillRect(sx, py, 2, 17);
  }

  // entry door on the right edge of the dining room
  ctx.fillStyle = '#15161f';
  ctx.fillRect(W - 44, Z.wallB, 44, Z.counterY - Z.wallB);
  rr(ctx, W - 48, Z.wallB - 2, 8, Z.counterY - Z.wallB + 4, 3, '#5d4a33');
  txt(ctx, 'ENTRY', W - 22, Z.wallB + 30, 9, '#8b93b8', 'center', 800);
  emoji(ctx, '🚪', W - 22, Z.wallB + 58, 18);

  // potted plant by the door
  emoji(ctx, '🪴', W - 78, Z.counterY - 22, 26);

  // kitchen floor: slate tiles
  ctx.fillStyle = '#13141c';
  ctx.fillRect(0, Z.counterY, W, Z.kitchenTop - Z.counterY); // under-counter band
  const tile = 80;
  for (let ty = Z.kitchenTop; ty < H; ty += tile) {
    for (let tx = 0; tx < W; tx += tile) {
      const odd = ((tx / tile) + Math.floor((ty - Z.kitchenTop) / tile)) % 2;
      ctx.fillStyle = odd ? '#222633' : '#1e222d';
      ctx.fillRect(tx, ty, tile - 2, tile - 2);
    }
  }

  // warm light pools under the hanging lamps
  for (const lx of [400, 660, 920]) {
    const lg = ctx.createRadialGradient(lx, 430, 10, lx, 430, 170);
    lg.addColorStop(0, 'rgba(255,210,140,0.07)');
    lg.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.ellipse(lx, 430, 180, 110, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // warm glow rising from the grill row
  const g = ctx.createLinearGradient(0, H - 190, 0, H);
  g.addColorStop(0, 'rgba(255,90,40,0)');
  g.addColorStop(1, 'rgba(255,90,40,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 190, W, 190);
}

function drawLamps(ctx, G) {
  for (const lx of [400, 660, 920]) {
    ctx.strokeStyle = '#11131c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx, ZONES.kitchenTop);
    ctx.lineTo(lx, ZONES.kitchenTop + 26);
    ctx.stroke();
    // shade
    ctx.beginPath();
    ctx.moveTo(lx - 16, ZONES.kitchenTop + 42);
    ctx.lineTo(lx - 7, ZONES.kitchenTop + 26);
    ctx.lineTo(lx + 7, ZONES.kitchenTop + 26);
    ctx.lineTo(lx + 16, ZONES.kitchenTop + 42);
    ctx.closePath();
    ctx.fillStyle = '#2e3140';
    ctx.fill();
    // bulb glow
    const pulse = 0.75 + 0.08 * Math.sin(G.t * 3 + lx);
    ctx.beginPath();
    ctx.arc(lx, ZONES.kitchenTop + 42, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,222,150,${pulse})`;
    ctx.fill();
  }
}

// Backdrop + counter + lamps = the full room, shared by gameplay and menus.
function drawRoom(ctx, G) {
  drawBackdrop(ctx, G);
  drawCounterBar(ctx, G);
  drawLamps(ctx, G);
}

function drawCounterBar(ctx, G) {
  const Z = ZONES;
  // stools at each spot
  for (let i = 0; i < 5; i++) {
    const sx = 280 + i * 170;
    shadow(ctx, sx, Z.counterY - 2, 13, 4, 0.25);
    ctx.beginPath();
    ctx.ellipse(sx, Z.counterY - 6, 13, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6b4a2f';
    ctx.fill();
    ctx.strokeStyle = '#4f3622';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // side wall stubs sealing the room
  ctx.fillStyle = '#262a3a';
  ctx.fillRect(0, Z.counterY - 4, Z.counterX, Z.counterH + 8);
  ctx.fillRect(Z.counterX + Z.counterW, Z.counterY - 4, W - Z.counterX - Z.counterW, Z.counterH + 8);
  // counter top + front face
  const top = ctx.createLinearGradient(0, Z.counterY - 8, 0, Z.counterY + 18);
  top.addColorStop(0, '#b07a48');
  top.addColorStop(1, '#96653a');
  rr(ctx, Z.counterX, Z.counterY - 8, Z.counterW, 26, 6, top, '#7c532f', 2);
  const front = ctx.createLinearGradient(0, Z.counterY + 16, 0, Z.counterY + Z.counterH);
  front.addColorStop(0, '#6e4a2a');
  front.addColorStop(1, '#54371f');
  ctx.fillStyle = front;
  ctx.fillRect(Z.counterX + 2, Z.counterY + 16, Z.counterW - 4, Z.counterH - 16);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(Z.counterX + 2, Z.counterY + 16, Z.counterW - 4, 3);
  txt(ctx, '— SERVICE COUNTER —', W / 2, Z.counterY + 44, 11, 'rgba(255,235,200,0.35)', 'center', 800);
}

// ---------- customers ----------

function drawCustomer(ctx, G, c) {
  const waiting = c.state === 'waiting';
  const walking = c.state === 'walkin' || c.state === 'leaving';
  const bob = walking
    ? Math.abs(Math.sin(G.t * 10 + c.bobPhase)) * 3.5
    : Math.sin(G.t * 2.4 + c.bobPhase) * 1.5;
  const urgent = waiting && c.patience / c.maxPatience < 0.25;
  const x = c.x + (urgent ? Math.sin(G.t * 30 + c.bobPhase) * 1.6 : 0);
  const y = c.y - bob;

  shadow(ctx, c.x, c.y + 26, 16, 5);

  // body
  rr(ctx, x - 14, y - 12, 28, 38, 13, c.look.shirt, 'rgba(0,0,0,0.3)', 2);
  // head
  ctx.beginPath();
  ctx.arc(x, y - 26, 13, 0, Math.PI * 2);
  ctx.fillStyle = c.look.skin;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // hair / hat
  if (c.look.hat) {
    rr(ctx, x - 13, y - 40, 26, 9, 4, c.look.hair);
    rr(ctx, x - 9, y - 48, 18, 10, 4, c.look.hair);
  } else {
    ctx.beginPath();
    ctx.arc(x, y - 28, 13, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineWidth = 7;
    ctx.strokeStyle = c.look.hair;
    ctx.stroke();
  }

  // face by mood
  ctx.fillStyle = '#222';
  ctx.strokeStyle = '#222';
  if (c.state === 'served') {
    // happy closed eyes + blush
    ctx.lineWidth = 2;
    for (const ex of [-5, 5]) {
      ctx.beginPath();
      ctx.arc(x + ex, y - 25, 3, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,120,140,0.5)';
    ctx.beginPath();
    ctx.arc(x - 8, y - 21, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 8, y - 21, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (c.angry) {
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * 8, y - 31);
      ctx.lineTo(x + s * 2, y - 28);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x - 5, y - 24, 2.2, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 24, 2.2, 0, Math.PI * 2);
    ctx.fill();
    emoji(ctx, '💢', x + 16, y - 42, 14);
  } else {
    ctx.beginPath();
    ctx.arc(x - 5, y - 26, 2.2, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 26, 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (urgent) {
      // sweat drop + frown
      ctx.beginPath();
      ctx.arc(x - 12, y - 33, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#8fd6ff';
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 16, 4, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
  }
}

function drawBubble(ctx, G, c) {
  if (c.state !== 'waiting') return;
  const pop = Math.min(1, c.waitT / 0.22);
  const scale = 0.6 + 0.4 * pop;
  const frac = Math.max(0, c.patience / c.maxPatience);
  const urgent = frac < 0.25;

  const parts = c.recipe.parts;
  const bw = Math.max(104, 58 + parts.length * 24) * scale;
  const bh = 62 * scale;
  const bx = Math.max(8, Math.min(W - bw - 8, c.x - bw / 2));
  const by = c.y - 64 - bh;

  ctx.save();
  ctx.globalAlpha = pop;
  // tail
  ctx.beginPath();
  ctx.moveTo(c.x - 7, by + bh - 1);
  ctx.lineTo(c.x + 7, by + bh - 1);
  ctx.lineTo(c.x, by + bh + 9);
  ctx.closePath();
  ctx.fillStyle = '#fdf8ee';
  ctx.fill();
  // card
  shadow(ctx, bx + bw / 2, by + bh + 4, bw * 0.42, 6, 0.22);
  rr(ctx, bx, by, bw, bh, 10, '#fdf8ee',
    urgent ? `rgba(255,70,50,${0.6 + 0.4 * Math.sin(G.t * 9)})` : '#d6c9ae', urgent ? 3.5 : 2);

  // recipe icon + price + required parts
  emoji(ctx, c.recipe.emoji, bx + 21 * scale, by + 22 * scale, 24 * scale);
  txt(ctx, `$${c.recipe.coins}`, bx + bw - 8, by + 18 * scale, 12 * scale, '#8a7a5a', 'right', 800);
  parts.forEach((pid, j) => emoji(ctx, EMOJI[pid], bx + (44 + j * 24) * scale, by + 36 * scale, 16 * scale));

  // patience bar
  const barCol = frac > 0.5 ? '#7ad97a' : frac > 0.25 ? '#ffd54a' : '#ff5a3c';
  rr(ctx, bx + 8, by + bh - 12, bw - 16, 7, 3, '#e4d8bd');
  if (frac > 0) rr(ctx, bx + 8, by + bh - 12, (bw - 16) * frac, 7, 3, barCol);
  ctx.restore();
}

// ---------- kitchen stations ----------

function drawBins(ctx, G) {
  for (const b of G.layout.bins) {
    shadow(ctx, b.x + b.w / 2, b.y + b.h + 3, b.w * 0.45, 6);
    const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    bg.addColorStop(0, '#2e3450');
    bg.addColorStop(1, '#242940');
    rr(ctx, b.x, b.y, b.w, b.h, 12, bg, '#3f4666');
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(b.x + 4, b.y + 3, b.w - 8, 4);
    emoji(ctx, EMOJI[b.id], b.x + b.w / 2, b.y + b.h / 2 - 8, 36);
    txt(ctx, b.label, b.x + b.w / 2, b.y + b.h - 8, 10, '#9aa2c4', 'center', 800);
  }
  const t = G.layout.trash;
  shadow(ctx, t.x + t.w / 2, t.y + t.h + 3, t.w * 0.42, 6);
  rr(ctx, t.x, t.y, t.w, t.h, 12, '#23262f', '#3a3f50');
  emoji(ctx, '🗑️', t.x + t.w / 2, t.y + t.h / 2 - 6, 30);
  txt(ctx, 'TRASH', t.x + t.w / 2, t.y + t.h - 8, 10, '#7a8098', 'center', 800);
}

function drawGrill(ctx, G) {
  const z = G.layout.grillZone;
  shadow(ctx, z.x + z.w / 2, z.y + z.h, z.w * 0.46, 8);
  const zg = ctx.createLinearGradient(0, z.y, 0, z.y + z.h);
  zg.addColorStop(0, '#332329');
  zg.addColorStop(1, '#271a1f');
  rr(ctx, z.x, z.y, z.w, z.h, 14, zg, '#553540');
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(z.x + 5, z.y + 3, z.w - 10, 4);
  txt(ctx, '♨ GRILL', z.x + 12, z.y + 18, 12, '#ff8a6b', 'left', 800);

  G.layout.grillSlots.forEach((s, i) => {
    const slot = G.grill[i];
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    rr(ctx, s.x, s.y, s.w, s.h, 10, '#161014', '#3a2a30');
    // ember glow under an active slot
    if (slot.state === 'on' && slot.t < slot.burnT) {
      const eg = ctx.createRadialGradient(cx, cy, 4, cx, cy, 36);
      const a = 0.16 + 0.07 * Math.sin(G.t * 7 + i * 2);
      eg.addColorStop(0, `rgba(255,110,30,${a})`);
      eg.addColorStop(1, 'rgba(255,110,30,0)');
      ctx.fillStyle = eg;
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    // grate lines
    ctx.strokeStyle = '#33222a';
    ctx.lineWidth = 3;
    for (let gx = s.x + 12; gx < s.x + s.w - 6; gx += 12) {
      ctx.beginPath(); ctx.moveTo(gx, s.y + 8); ctx.lineTo(gx, s.y + s.h - 8); ctx.stroke();
    }
    if (slot.state !== 'on') return;

    // patty browning from pink → brown → charcoal
    const doneness = Math.min(1.25, slot.t / slot.cookT);
    const burnt = slot.t >= slot.burnT;
    const col = burnt ? '#1c1410' : doneness < 1
      ? `rgb(${200 - doneness * 80},${90 - doneness * 20},${70 - doneness * 20})`
      : '#6b3a22';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // sear marks
    if (!burnt && doneness > 0.4) {
      ctx.strokeStyle = 'rgba(60,25,12,0.55)';
      ctx.lineWidth = 3;
      for (const off of [-8, 0, 8]) {
        ctx.beginPath(); ctx.moveTo(cx + off - 6, cy - 12); ctx.lineTo(cx + off + 6, cy + 12); ctx.stroke();
      }
    }

    // state ring: orange cooking → pulsing gold (perfect) → red (overdone) → none (burnt)
    if (!burnt) {
      let ringCol, frac;
      if (slot.t < slot.cookT) { ringCol = '#ff9b2d'; frac = slot.t / slot.cookT; }
      else if (slot.t < slot.perfT) {
        ringCol = `rgba(255,220,90,${0.6 + 0.4 * Math.sin(G.t * 10)})`;
        frac = 1;
      } else { ringCol = '#ff5a3c'; frac = 1 - (slot.t - slot.perfT) / (slot.burnT - slot.perfT); }
      ctx.beginPath();
      ctx.arc(cx, cy, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.strokeStyle = ringCol;
      ctx.lineWidth = 5;
      ctx.stroke();
      if (slot.t >= slot.cookT && slot.t < slot.perfT) emoji(ctx, '✨', cx + 24, cy - 24, 16);
    }
  });
}

function drawFryer(ctx, G) {
  const z = G.layout.fryerZone;
  shadow(ctx, z.x + z.w / 2, z.y + z.h, z.w * 0.46, 8);
  const zg = ctx.createLinearGradient(0, z.y, 0, z.y + z.h);
  zg.addColorStop(0, '#232c42');
  zg.addColorStop(1, '#1b2233');
  rr(ctx, z.x, z.y, z.w, z.h, 14, zg, '#364465');
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(z.x + 5, z.y + 3, z.w - 10, 4);
  txt(ctx, '🧺 FRYER', z.x + 12, z.y + 18, 12, '#7aa2ff', 'left', 800);

  const FRY_T = 5;
  G.layout.fryerSlots.forEach((s, i) => {
    const slot = G.fryer[i];
    const cx = s.x + s.w / 2;
    rr(ctx, s.x, s.y, s.w, s.h, 10, '#141d2b', '#2c3a52');
    // oil surface
    rr(ctx, s.x + 8, s.y + 12, s.w - 16, s.h - 24, 8, '#43391f');
    if (slot.state !== 'on') return;
    const done = slot.t >= FRY_T;
    if (!done) {
      for (let b = 0; b < 5; b++) {
        const bx = s.x + 14 + ((b * 37 + G.t * 60) % (s.w - 28));
        const by = s.y + 20 + ((b * 23 + G.t * 40) % (s.h - 40));
        ctx.beginPath();
        ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,230,160,0.5)';
        ctx.fill();
      }
      if (Math.random() < 0.06) fx.smoke(cx, s.y + 10, 'rgba(230,230,235,', 1);
      const frac = slot.t / FRY_T;
      rr(ctx, s.x + 8, s.y + s.h - 8, (s.w - 16) * frac, 5, 2, '#ffd54a');
    } else {
      const bob = Math.sin(G.t * 6) * 3;
      emoji(ctx, '🍟', cx, s.y + s.h / 2 - 6 + bob, 30);
    }
  });
}

function drawPlateStack(ctx, parts, x, y, scale = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y + 6 * scale, 26 * scale, 9 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#e8e6e0';
  ctx.fill();
  ctx.strokeStyle = '#b9b6ae';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  parts.forEach((pid, j) => {
    emoji(ctx, EMOJI[pid], x, y - 4 - j * 13 * scale, 20 * scale);
  });
}

function drawCounters(ctx, G) {
  G.layout.counters.forEach((c, i) => {
    const plate = G.plates[i];
    const cx = c.x + c.w / 2;
    shadow(ctx, cx, c.y + c.h + 4, c.w * 0.46, 7);
    rr(ctx, c.x, c.y + 4, c.w, c.h, 8, '#5d3a22');
    const top = ctx.createLinearGradient(0, c.y, 0, c.y + c.h - 8);
    top.addColorStop(0, '#a06b3d');
    top.addColorStop(1, '#8a5a33');
    rr(ctx, c.x, c.y, c.w, c.h - 8, 8, top, '#b07a48');
    if (plate.parts.length === 0) {
      ctx.beginPath();
      ctx.ellipse(cx, c.y + c.h / 2 - 4, 24, 8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    }
    drawPlateStack(ctx, plate.parts, cx, c.y + c.h / 2 - 6);
    if (findMatch(G, plate.parts)) {
      const pulse = 0.5 + 0.5 * Math.sin(G.t * 8);
      rr(ctx, c.x - 3, c.y - 3, c.w + 6, c.h + 2, 10, null, `rgba(110,230,140,${0.4 + pulse * 0.6})`, 3);
      txt(ctx, '✓ READY', cx, c.y - 10, 12, '#7ad97a', 'center', 800);
    }
    if (plate.perfects > 0) emoji(ctx, '✨', c.x + c.w - 12, c.y + 4, 14);
  });
}

function drawPlayer(ctx, G) {
  const p = G.player;
  const bob = Math.sin(p.walk * 2) * 2;
  shadow(ctx, p.x, p.y + 16, 18, 6, 0.4);
  // body
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.3, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#f4f0e6';
  ctx.fill();
  ctx.strokeStyle = '#c9c2b2';
  ctx.lineWidth = 2;
  ctx.stroke();
  // apron
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.3, 20, Math.PI * 0.15, Math.PI * 0.85);
  ctx.fillStyle = '#ff5a3c';
  ctx.fill();
  // eyes
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(p.x - 6 + p.face * 2, p.y - 4 + bob * 0.3, 2.4, 0, Math.PI * 2);
  ctx.arc(p.x + 6 + p.face * 2, p.y - 4 + bob * 0.3, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // chef hat
  const hy = p.y - 22 + bob * 0.5;
  rr(ctx, p.x - 11, hy - 10, 22, 12, 3, '#fff', '#d8d2c2', 1.5);
  ctx.beginPath();
  ctx.arc(p.x - 6, hy - 12, 7, 0, Math.PI * 2);
  ctx.arc(p.x + 1, hy - 15, 8, 0, Math.PI * 2);
  ctx.arc(p.x + 8, hy - 12, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // carried item floats above
  if (G.carry) {
    const cy = p.y - 52 + Math.sin(G.t * 5) * 3;
    const c = G.carry;
    if (c.kind === 'plate') {
      drawPlateStack(ctx, c.parts, p.x, cy, 0.9);
      if (findMatch(G, c.parts)) {
        const a = 0.6 + 0.4 * Math.sin(G.t * 8);
        txt(ctx, '⬆ SERVE', p.x, cy - 24 - c.parts.length * 12, 14, `rgba(122,217,122,${a})`, 'center', 900);
      }
    } else if (c.kind === 'burnt') {
      ctx.beginPath();
      ctx.arc(p.x, cy, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#1c1410';
      ctx.fill();
      if (Math.random() < 0.1) fx.smoke(p.x, cy - 6, 'rgba(90,90,95,', 1);
    } else {
      emoji(ctx, EMOJI[c.id], p.x, cy, 26);
      if (c.kind === 'ing' && c.id === 'patty_raw') {
        ctx.beginPath(); ctx.arc(p.x, cy, 18, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,110,110,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      }
      if (c.quality === 'perfect') {
        ctx.beginPath(); ctx.arc(p.x, cy, 18, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,225,120,${0.6 + 0.4 * Math.sin(G.t * 10)})`; ctx.lineWidth = 3; ctx.stroke();
      } else if (c.quality === 'cooked') {
        ctx.beginPath(); ctx.arc(p.x, cy, 18, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(120,220,120,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
  }
}

function drawHint(ctx, G) {
  if (!G.hint) return;
  const h = G.hint;
  ctx.font = `800 14px ${FONT}`;
  const wTxt = ctx.measureText(h.label).width;
  const bw = wTxt + 86;
  const hx = Math.max(8, Math.min(W - bw - 8, h.x - bw / 2));
  const hy = Math.max(ZONES.hudH + 8, h.y - 66);
  rr(ctx, hx, hy, bw, 28, 8, 'rgba(8,9,14,0.82)', 'rgba(255,255,255,0.25)', 1.5);
  rr(ctx, hx + 6, hy + 5, 52, 18, 4, '#ffd54a');
  txt(ctx, 'SPACE', hx + 32, hy + 18, 11, '#0c0d14', 'center', 900);
  txt(ctx, h.label, hx + 68, hy + 19, 14, '#fff', 'left', 800);
}

// ---------- HUD ----------

function drawHUD(ctx, G) {
  const Z = ZONES;
  // glass bar
  const hg = ctx.createLinearGradient(0, 0, 0, Z.hudH);
  hg.addColorStop(0, 'rgba(13,14,22,0.97)');
  hg.addColorStop(1, 'rgba(18,20,32,0.94)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, Z.hudH);
  ctx.fillStyle = '#2c3148';
  ctx.fillRect(0, Z.hudH - 2, W, 2);

  // left: money + quota
  txt(ctx, `💰 $${G.shiftCoins}`, 16, 26, 21, '#ffd54a', 'left', 900);
  const qFrac = Math.min(1, G.shiftCoins / G.quota);
  rr(ctx, 16, 34, 150, 10, 5, '#262b40', '#3c4360');
  if (qFrac > 0) rr(ctx, 16, 34, 150 * qFrac, 10, 5, qFrac >= 1 ? '#7ad97a' : '#5ee0c8');
  txt(ctx, qFrac >= 1 ? `QUOTA MET ($${G.quota})` : `QUOTA $${G.quota}`, 174, 43, 11, qFrac >= 1 ? '#7ad97a' : '#8b93b8', 'left', 800);
  txt(ctx, `RUN $${G.coins}`, 174, 26, 12, '#5a6285', 'left', 700);

  // right: timer + shift
  const tLeft = Math.max(0, Math.ceil(G.shiftTime));
  const mm = Math.floor(tLeft / 60), ss = String(tLeft % 60).padStart(2, '0');
  const hurry = G.shiftTime < 15;
  const tCol = hurry ? (Math.sin(G.t * 10) > 0 ? '#ff5a3c' : '#fff') : '#fff';
  txt(ctx, `${mm}:${ss}`, W - 16, 30, 27, tCol, 'right', 900);
  txt(ctx, `SHIFT ${G.shift}/${G.TOTAL_SHIFTS}${audio.muted ? '  🔇' : ''}`, W - 16, 46, 11, '#8b93b8', 'right', 800);

  // center: combo
  if (G.combo >= 2) {
    const pop = 1 + Math.max(0, G.comboPop) * 1.4;
    const onFire = G.combo >= 5;
    const pw = 210 * pop;
    const px = W / 2 - pw / 2, py = 26 - 17 * pop;
    rr(ctx, px, py, pw, 34 * pop, 17 * pop,
      onFire ? 'rgba(255,90,40,0.95)' : 'rgba(34,38,58,0.95)',
      onFire ? '#ffd54a' : '#3c4360', 2.5);
    txt(ctx, `${onFire ? '🔥' : '⚡'} COMBO ×${G.combo}  (${comboMult(G.combo).toFixed(2)}×)`,
      W / 2, py + 23 * pop, 14 * pop, onFire ? '#fff' : '#5ee0c8', 'center', 900);
    const cFrac = Math.max(0, G.comboTimer / G.mods.comboWindow);
    rr(ctx, px + 12, py + 34 * pop - 6, (pw - 24) * cFrac, 3.5, 2, onFire ? '#ffd54a' : '#5ee0c8');
    if (onFire && Math.random() < 0.35) fx.flame(px + Math.random() * pw, py + 8);
  }

  // first-shift guide
  if (G.state === 'playing' && G.shift === 1 && G.SHIFT_LEN - G.shiftTime < 26) {
    const guide = 'WASD move · SPACE interact  —  Grill 🥩 → plate with 🥯 → walk it to the customer!';
    ctx.font = `700 15px ${FONT}`;
    const gw = ctx.measureText(guide).width + 36;
    rr(ctx, W / 2 - gw / 2, 318, gw, 32, 16, 'rgba(8,9,14,0.78)', 'rgba(255,255,255,0.18)', 1.5);
    txt(ctx, guide, W / 2, 339, 15, 'rgba(255,255,255,0.85)', 'center', 700);
  }

  // hurry vignette
  if (G.state === 'playing' && hurry && G.shiftTime > 0) {
    const a = 0.12 + 0.08 * Math.sin(G.t * 10);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(255,40,20,0)');
    g.addColorStop(1, `rgba(255,40,20,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawVignette(ctx) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ---------- full-screen states ----------

function dim(ctx, a = 0.78) {
  ctx.fillStyle = `rgba(8,9,15,${a})`;
  ctx.fillRect(0, 0, W, H);
}

function drawLogo(ctx, G, y) {
  const wob = Math.sin(G.t * 2.2) * 0.02;
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate(-0.03 + wob);
  ctx.font = `900 italic 92px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#12131c';
  ctx.strokeText('SIZZLE', -120, 0);
  ctx.fillStyle = '#ffd54a';
  ctx.fillText('SIZZLE', -120, 0);
  ctx.strokeText('RUSH', 170, 8);
  ctx.fillStyle = '#ff5a3c';
  ctx.fillText('RUSH', 170, 8);
  ctx.restore();
}

function drawTitle(ctx, G) {
  drawRoom(ctx, G);
  dim(ctx, 0.62);
  if (Math.random() < 0.3) fx.flame(W / 2 + (Math.random() - 0.5) * 600, H - 40, true);
  drawLogo(ctx, G, 230);
  txt(ctx, 'a frantic kitchen roguelite', W / 2, 285, 20, '#8b93b8', 'center', 600);

  button(ctx, G, 'start', W / 2 - 130, 360, 260, 58, '▶  START SHIFT 1', true);
  G.ui.primary = 'start';

  const lines = [
    'WASD / Arrows — move        SPACE / E — interact',
    'Grill patties (pull them in the ✨ gold window!) · build plates · run orders to your customers',
    `Hit each shift's quota. Survive all ${G.TOTAL_SHIFTS} shifts. Chain serves for 🔥 combo cash.`,
    'M — mute    P — pause',
  ];
  lines.forEach((l, i) => txt(ctx, l, W / 2, 470 + i * 28, 15, i === 1 ? '#c9cfe8' : '#737b9e', 'center', 600));

  const m = G.meta;
  if (m.runs > 0) {
    txt(ctx, `BEST — shift ${m.bestShift} · $${m.bestCoins} · combo ×${m.bestCombo} · ${m.runs} runs`,
      W / 2, 620, 15, '#ffd54a', 'center', 800);
  }
}

function statRow(ctx, y, label, value, color = '#fff') {
  txt(ctx, label, W / 2 - 190, y, 17, '#8b93b8', 'left', 700);
  txt(ctx, value, W / 2 + 190, y, 17, color, 'right', 800);
}

function drawShiftEnd(ctx, G) {
  drawRoom(ctx, G);
  dim(ctx);
  const pass = G.shiftCoins >= G.quota;
  shadow(ctx, W / 2, 588, 300, 14, 0.45);
  rr(ctx, W / 2 - 280, 110, 560, 470, 18, '#1b1e2c', pass ? '#7ad97a' : '#ff5a3c', 3);
  txt(ctx, pass ? `SHIFT ${G.shift} CLEARED!` : 'QUOTA MISSED…', W / 2, 170, 36, pass ? '#7ad97a' : '#ff5a3c', 'center', 900);
  emoji(ctx, pass ? '🎉' : '😓', W / 2, 215, 36);

  statRow(ctx, 290, 'Orders served', `${G.stats.served}`);
  statRow(ctx, 322, 'Perfect sears', `${G.stats.perfect} ✨`, '#fff3b0');
  statRow(ctx, 354, 'Customers lost', `${G.stats.expired}`, G.stats.expired ? '#ff8a6b' : '#fff');
  statRow(ctx, 386, 'Food trashed', `${G.stats.trashed}`);
  statRow(ctx, 418, 'Best combo', `×${G.bestCombo}`, '#5ee0c8');

  const qFrac = Math.min(1, G.shiftCoins / G.quota);
  txt(ctx, `EARNED $${G.shiftCoins} / QUOTA $${G.quota}`, W / 2, 462, 17, '#ffd54a', 'center', 800);
  rr(ctx, W / 2 - 190, 474, 380, 14, 6, '#262b40');
  if (qFrac > 0) rr(ctx, W / 2 - 190, 474, 380 * qFrac, 14, 6, pass ? '#7ad97a' : '#ff5a3c');

  const label = pass ? (G.shift >= G.TOTAL_SHIFTS ? '👑  FINISH' : 'CHOOSE UPGRADE  ➜') : 'SEE RESULTS';
  button(ctx, G, 'continue', W / 2 - 130, 510, 260, 52, label, true);
  G.ui.primary = 'continue';
}

function drawUpgrade(ctx, G) {
  drawRoom(ctx, G);
  dim(ctx);
  txt(ctx, 'CHOOSE AN UPGRADE', W / 2, 130, 38, '#ffd54a', 'center', 900);
  txt(ctx, `before shift ${G.shift + 1} — it only gets busier from here`, W / 2, 162, 16, '#8b93b8', 'center', 600);

  const cw = 250, ch = 300, gap = 40;
  const x0 = W / 2 - (3 * cw + 2 * gap) / 2;
  G.upgradeChoices.forEach((u, i) => {
    const x = x0 + i * (cw + gap), y = 210;
    const hov = input.mouse.x >= x && input.mouse.x <= x + cw && input.mouse.y >= y && input.mouse.y <= y + ch;
    const lift = hov ? 8 : 0;
    shadow(ctx, x + cw / 2, y + ch + 6, cw * 0.44, 9, 0.4);
    rr(ctx, x, y - lift, cw, ch, 16, hov ? '#262c46' : '#1b1e2c', hov ? '#ffd54a' : '#3c4360', hov ? 3 : 2);
    emoji(ctx, u.emoji, x + cw / 2, y - lift + 80, 56);
    txt(ctx, u.name, x + cw / 2, y - lift + 150, 21, '#fff', 'center', 900);
    const words = u.desc.split(' ');
    let line = '', ly = y - lift + 180;
    for (const w2 of words) {
      if ((line + ' ' + w2).length > 24) { txt(ctx, line, x + cw / 2, ly, 15, '#9aa2c4', 'center', 600); line = w2; ly += 22; }
      else line = line ? line + ' ' + w2 : w2;
    }
    txt(ctx, line, x + cw / 2, ly, 15, '#9aa2c4', 'center', 600);
    const have = takenCount(G, u.id);
    if (have > 0) txt(ctx, '●'.repeat(have) + '○'.repeat(u.max - have), x + cw / 2, y - lift + ch - 40, 14, '#5ee0c8', 'center');
    txt(ctx, `[ ${i + 1} ]`, x + cw / 2, y - lift + ch - 16, 15, '#737b9e', 'center', 800);
    G.ui.buttons.push({ id: `pick${i}`, x, y: y - lift, w: cw, h: ch });
  });
}

function drawGameOver(ctx, G) {
  drawRoom(ctx, G);
  dim(ctx);
  emoji(ctx, '🍳', W / 2, 180, 64);
  txt(ctx, "YOU'RE FIRED!", W / 2, 270, 56, '#ff5a3c', 'center', 900);
  txt(ctx, `The shift ${G.shift} quota was $${G.quota} — you plated $${G.shiftCoins}.`, W / 2, 315, 18, '#9aa2c4', 'center', 600);
  txt(ctx, `Run total $${G.coins} · ${G.totalServed} orders · best combo ×${G.bestCombo}`, W / 2, 348, 16, '#737b9e', 'center', 600);
  button(ctx, G, 'again', W / 2 - 130, 410, 260, 56, '↻  COOK AGAIN', true);
  button(ctx, G, 'title', W / 2 - 90, 486, 180, 42, 'TITLE');
  G.ui.primary = 'again';
}

function drawWin(ctx, G) {
  drawRoom(ctx, G);
  dim(ctx);
  if (Math.random() < 0.12) fx.confetti(Math.random() * W, -10, 14);
  emoji(ctx, '👑', W / 2, 150, 64);
  txt(ctx, 'KITCHEN LEGEND!', W / 2, 245, 58, '#ffd54a', 'center', 900);
  txt(ctx, `All ${G.TOTAL_SHIFTS} shifts survived. The town will speak of this grill for generations.`, W / 2, 290, 18, '#c9cfe8', 'center', 600);
  statRow(ctx, 350, 'Total earned', `$${G.coins}`, '#ffd54a');
  statRow(ctx, 382, 'Orders served', `${G.totalServed}`);
  statRow(ctx, 414, 'Perfect sears', `${G.totalPerfect} ✨`, '#fff3b0');
  statRow(ctx, 446, 'Best combo', `×${G.bestCombo}`, '#5ee0c8');
  button(ctx, G, 'again', W / 2 - 130, 500, 260, 56, '↻  PLAY AGAIN', true);
  button(ctx, G, 'title', W / 2 - 90, 576, 180, 42, 'TITLE');
  G.ui.primary = 'again';
}

// ---------- entry ----------

export function render(G, ctx) {
  G.ui.buttons = [];
  G.ui.primary = null;

  ctx.save();
  if (fx.shake > 0) {
    ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  }

  if (G.state === 'title') drawTitle(ctx, G);
  else if (G.state === 'shiftEnd') drawShiftEnd(ctx, G);
  else if (G.state === 'upgrade') drawUpgrade(ctx, G);
  else if (G.state === 'gameOver') drawGameOver(ctx, G);
  else if (G.state === 'win') drawWin(ctx, G);
  else {
    // playing
    drawBackdrop(ctx, G);
    drawCounterBar(ctx, G);
    drawLamps(ctx, G);
    for (const c of G.customers) drawCustomer(ctx, G, c);
    drawBins(ctx, G);
    drawGrill(ctx, G);
    drawFryer(ctx, G);
    drawCounters(ctx, G);
    drawPlayer(ctx, G);
    for (const c of G.customers) drawBubble(ctx, G, c);
    drawVignette(ctx);
    drawHUD(ctx, G);
    drawHint(ctx, G);
    if (G.paused) {
      dim(ctx, 0.6);
      txt(ctx, 'PAUSED', W / 2, H / 2, 52, '#fff', 'center', 900);
      txt(ctx, 'press P to resume', W / 2, H / 2 + 40, 17, '#8b93b8', 'center', 600);
    }
  }

  fx.draw(ctx);
  ctx.restore();
}
