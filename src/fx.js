// Particles, floating text, and screen shake. Purely visual — safe to reset any time.

export const fx = {
  parts: [],
  texts: [],
  shake: 0,

  reset() {
    this.parts.length = 0;
    this.texts.length = 0;
    this.shake = 0;
  },

  addShake(n) {
    this.shake = Math.min(18, this.shake + n);
  },

  // Generic radial burst of sparks.
  burst(x, y, color, n = 12, speed = 170) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        type: 'spark', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
        life: 0, maxLife: 0.45 + Math.random() * 0.35,
        size: 2.5 + Math.random() * 3, color, grav: 420,
      });
    }
  },

  // Slow rising smoke puff.
  smoke(x, y, color = 'rgba(120,120,130,', n = 3) {
    for (let i = 0; i < n; i++) {
      this.parts.push({
        type: 'puff', x: x + (Math.random() - 0.5) * 16, y,
        vx: (Math.random() - 0.5) * 18, vy: -30 - Math.random() * 28,
        life: 0, maxLife: 0.9 + Math.random() * 0.7,
        size: 6 + Math.random() * 7, color, grav: 0,
      });
    }
  },

  // Quick upward flame lick (used for ON FIRE chef and title ambience).
  flame(x, y, big = false) {
    const colors = ['#ff5a3c', '#ff9b2d', '#ffd54a'];
    this.parts.push({
      type: 'flame', x: x + (Math.random() - 0.5) * 14, y,
      vx: (Math.random() - 0.5) * 26, vy: -70 - Math.random() * 70,
      life: 0, maxLife: 0.4 + Math.random() * 0.3,
      size: (big ? 8 : 5) + Math.random() * 4,
      color: colors[(Math.random() * colors.length) | 0], grav: -40,
    });
  },

  confetti(x, y, n = 40) {
    const colors = ['#ff5a3c', '#ffd54a', '#5ee0c8', '#7aa2ff', '#ff7ad9'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 120 + Math.random() * 260;
      this.parts.push({
        type: 'confetti', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 180,
        life: 0, maxLife: 1.2 + Math.random() * 0.8,
        size: 4 + Math.random() * 4,
        color: colors[(Math.random() * colors.length) | 0],
        grav: 320, spin: (Math.random() - 0.5) * 12, rot: Math.random() * 6,
      });
    }
  },

  text(x, y, str, color = '#ffd54a', size = 20) {
    this.texts.push({ x, y, str, color, size, life: 0, maxLife: 1.1 });
  },

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 30);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.maxLife) { this.parts.splice(i, 1); continue; }
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rot += p.spin * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt;
      t.y -= 38 * dt;
      if (t.life >= t.maxLife) this.texts.splice(i, 1);
    }
  },

  draw(ctx) {
    for (const p of this.parts) {
      const k = 1 - p.life / p.maxLife;
      ctx.save();
      if (p.type === 'puff') {
        ctx.globalAlpha = k * 0.5;
        ctx.fillStyle = p.color + '1)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'confetti') {
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else { // spark / flame
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    for (const t of this.texts) {
      const k = 1 - t.life / t.maxLife;
      const pop = t.life < 0.12 ? 1 + (0.12 - t.life) * 4 : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = `900 ${Math.round(t.size * pop)}px 'Segoe UI', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(10,10,16,0.85)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
      ctx.restore();
    }
  },
};
