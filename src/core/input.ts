// Keyboard + mouse input. Tracks held keys, edge-triggered presses, and the
// pointer position in CSS pixels (the renderer/picker converts to NDC/world).

export class Input {
  readonly held = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private queued = new Set<string>();

  mouseX = 0;
  mouseY = 0;
  mouseDown = false;
  private mouseClicked = false;
  private mouseClickQueued = false;
  private clickTargetId = "";
  private clickTargetQueued = "";

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      const k = norm(e.code);
      if (k === "Space" || k.startsWith("Arrow")) e.preventDefault();
      if (!this.held.has(k)) this.queued.add(k);
      this.held.add(k);
    });
    target.addEventListener("keyup", (e) => {
      this.held.delete(norm(e.code));
    });
    target.addEventListener("mousemove", (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    target.addEventListener("mousedown", (e) => {
      this.mouseDown = true;
      this.mouseClickQueued = true;
      this.clickTargetQueued = (e.target as HTMLElement | null)?.id ?? "";
    });
    target.addEventListener("mouseup", () => {
      this.mouseDown = false;
    });
    // Lose held keys when the window blurs so the chef doesn't run forever.
    target.addEventListener("blur", () => this.held.clear());
  }

  /** Call once per frame, before reading pressed()/clicked(). */
  beginFrame(): void {
    this.pressedThisFrame = this.queued;
    this.queued = new Set();
    this.mouseClicked = this.mouseClickQueued;
    this.mouseClickQueued = false;
    this.clickTargetId = this.clickTargetQueued;
    this.clickTargetQueued = "";
  }

  pressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  /** True on the frame the primary mouse button was pressed. */
  clicked(): boolean {
    return this.mouseClicked;
  }

  /** True on click whose target element had the given id (e.g. the canvas). */
  clickedOn(id: string): boolean {
    return this.mouseClicked && this.clickTargetId === id;
  }

  /** WASD / arrows → normalized-ish movement vector (caller normalizes). */
  moveVector(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.held.has("KeyW") || this.held.has("ArrowUp")) z -= 1;
    if (this.held.has("KeyS") || this.held.has("ArrowDown")) z += 1;
    if (this.held.has("KeyA") || this.held.has("ArrowLeft")) x -= 1;
    if (this.held.has("KeyD") || this.held.has("ArrowRight")) x += 1;
    return { x, z };
  }
}

const norm = (code: string): string => code;
