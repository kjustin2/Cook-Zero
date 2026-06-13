// Keyboard + mouse. `held` is live state, `pressed`/`clicked` last one frame
// (cleared by main via endFrame). Mouse coords are in logical canvas space —
// main supplies the client→logical transform after computing letterbox scale.

export const input = {
  held: {},
  pressed: {},
  mouse: { x: -999, y: -999, clicked: false },
  toLogical: (x, y) => ({ x, y }),

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) {
        this.held[e.code] = true;
        this.pressed[e.code] = true;
      }
    });
    window.addEventListener('keyup', (e) => { this.held[e.code] = false; });
    window.addEventListener('blur', () => { this.held = {}; });
    canvas.addEventListener('mousemove', (e) => {
      const p = this.toLogical(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    canvas.addEventListener('mousedown', (e) => {
      const p = this.toLogical(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.clicked = true;
    });
  },

  axis() {
    let x = 0, y = 0;
    if (this.held.KeyA || this.held.ArrowLeft) x -= 1;
    if (this.held.KeyD || this.held.ArrowRight) x += 1;
    if (this.held.KeyW || this.held.ArrowUp) y -= 1;
    if (this.held.KeyS || this.held.ArrowDown) y += 1;
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  },

  interactPressed() {
    return !!(this.pressed.Space || this.pressed.KeyE);
  },

  confirmPressed() {
    return !!(this.pressed.Enter || this.pressed.Space);
  },

  endFrame() {
    this.pressed = {};
    this.mouse.clicked = false;
  },
};
