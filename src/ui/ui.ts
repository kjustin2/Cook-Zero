// DOM UI over the live 3D diner: a big, friendly HUD plus every overlay screen
// (title, setup studio, day-card, day-complete stars, between-day manage, pause,
// win) and the cutscene presentation. Minimal text, big icons — a young kid plays
// by pictures. The UI reads G and calls the GameController the main loop provides.
// Customization edits mutate a working config and call setConfig, so the 3D diner
// behind the panel updates live.

import type { FoodId, GameState, PetKind, RestaurantConfig, StationId, TreatId } from "../game/types";
import { TREATS } from "../game/upgrades";
import { chefRank } from "../game/story";
import { cutsceneText, currentShot } from "../game/cutscene";
import { FIRE_AT } from "../game/balance";
import { loadMeta } from "../core/save";
import {
  SWATCHES, TONE_SWATCHES, PET_OPTIONS, FOOD_OPTIONS, MAX_TABLES,
  cloneConfig, foodUnlocked, petUnlocked, unlockLabel,
} from "../game/customize";

export interface GameController {
  play(): void;
  continueRun(): void;
  hasSave(): boolean;
  togglePause(): void;
  resume(): void;
  restart(): void;
  quitToTitle(): void;
  config(): RestaurantConfig;
  setConfig(c: RestaurantConfig): void;
  setStudioFocus(focus: "chef" | "room", cat?: string): void;
  finishSetup(): void;
  nextFromDayComplete(): void;
  chooseTreat(id: TreatId): void;
  finishManage(): void;
  toggleTable(i: number): void;
  swapStations(a: StationId, b: StationId): void;
  moveTable(i: number, x: number, z: number): void;
  moveStation(id: StationId, x: number, z: number): void;
  addTable(): void;
  removeTable(): void;
  skipCutscene(): void;
  toggleMute(): void;
  toggleQuality(): void;
  // ── Display + audio options ──
  toggleFullscreen(): void;
  isFullscreen(): boolean;
  setResolution(scale: number): void;
  setMusicVol(v: number): void;
  setSfxVol(v: number): void;
}

const $ = (html: string): HTMLElement => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};

const hex = (n: number): string => n.toString(16).padStart(6, "0");

// Top-down floor-map mapping (matches the diner FLOOR with a little margin).
const MAP_MINX = -12.5, MAP_W = 25, MAP_MINZ = -10.5, MAP_H = 17;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const clampN = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const worldToMapPct = (x: number, z: number): [number, number] =>
  [((x - MAP_MINX) / MAP_W) * 100, ((z - MAP_MINZ) / MAP_H) * 100];
const mapPctToWorld = (px: number, py: number): [number, number] =>
  [px * MAP_W + MAP_MINX, py * MAP_H + MAP_MINZ];

export class UI {
  private root: HTMLElement;
  private ctrl: GameController;

  // cached refs
  private fxLow!: HTMLElement;
  private fxFire!: HTMLElement;
  private fxFlash!: HTMLElement;
  private hud!: HTMLElement;
  private dayVal!: HTMLElement;
  private scoreVal!: HTMLElement;
  private servedVal!: HTMLElement;
  private timerBar!: HTMLElement;
  private timerWrap!: HTMLElement;
  private comboChip!: HTMLElement;
  private nextHint!: HTMLElement;
  private actionBtn!: HTMLElement;
  private dayCardEl!: HTMLElement;
  private tutBadge!: HTMLElement;
  private screens!: HTMLElement;
  private cine!: HTMLElement;
  private settings!: HTMLElement;

  private lastScore = 0;
  private lastPhase = "";
  private lastDayCardKey = "";
  private uiLastShot = -1;
  private work: RestaurantConfig | null = null; // live editing copy in setup/manage
  private czCat: CzCat = "chef"; // which customizer category is open
  private settingsOpen = false;

  constructor(root: HTMLElement, ctrl: GameController) {
    this.root = root;
    this.ctrl = ctrl;
    this.build();
  }

  private build(): void {
    this.root.innerHTML = "";

    this.root.appendChild($(`<div class="fx fx-vignette"></div>`));
    this.fxLow = $(`<div class="fx fx-lowtime"></div>`);
    this.fxFire = $(`<div class="fx fx-fire"></div>`);
    this.fxFlash = $(`<div class="fx fx-flash"></div>`);
    this.root.append(this.fxLow, this.fxFire, this.fxFlash);

    this.hud = $(`
      <div class="hud">
        <div class="stat"><div class="label">Day</div><div class="val" data-day>1</div></div>
        <div class="sep"></div>
        <div class="stat"><div class="label">Score</div><div class="val score" data-score>0</div></div>
        <div class="sep"></div>
        <div class="stat"><div class="label">Happy</div><div class="val served" data-served>0/0</div></div>
        <div class="sep"></div>
        <div class="timer-wrap" data-timerwrap><div class="label">Time</div><div class="bar"><i data-timer></i></div></div>
      </div>`);
    this.root.appendChild(this.hud);
    this.dayVal = this.hud.querySelector("[data-day]")!;
    this.scoreVal = this.hud.querySelector("[data-score]")!;
    this.servedVal = this.hud.querySelector("[data-served]")!;
    this.timerBar = this.hud.querySelector("[data-timer]")!;
    this.timerWrap = this.hud.querySelector("[data-timerwrap]")!;

    this.comboChip = $(`<div class="combo-chip"><span class="cc-label">Streak</span><span class="cc-x">×</span><span data-combo>2</span><span class="cc-fire">🔥</span></div>`);
    this.root.appendChild(this.comboChip);

    this.nextHint = $(`<div class="next-hint"><span class="nh-icon" data-nhicon>✨</span><span class="nh-text" data-nhtext>Let's cook!</span></div>`);
    this.root.appendChild(this.nextHint);

    this.actionBtn = $(`<div class="action-btn"><span class="ab-icon" data-abicon>🍔</span><span class="ab-text" data-abtext>Grab</span><span class="ab-key">SPACE</span></div>`);
    this.root.appendChild(this.actionBtn);

    this.dayCardEl = $(`<div class="daycard"><div class="dc-title" data-dctitle>Day 1</div><div class="dc-sub" data-dcsub></div></div>`);
    this.root.appendChild(this.dayCardEl);

    this.tutBadge = $(`<div class="tut-badge">🎓 Tutorial — follow the arrow!</div>`);
    this.root.appendChild(this.tutBadge);

    this.screens = $(`<div class="screens"></div>`);
    this.root.appendChild(this.screens);

    this.cine = $(`
      <div class="cine">
        <div class="cine-bar cine-bar--top"></div>
        <div class="cine-bar cine-bar--bot"></div>
        <div class="cine-fade"></div>
        <div class="cine-title"><h1 data-ctitle></h1><p data-csub></p></div>
        <div class="cine-dialog">
          <span class="cd-portrait" data-cportrait>👵</span>
          <span class="cd-body"><span class="cd-name" data-cname></span><span class="cd-text" data-ctext></span></span>
        </div>
        <button class="cine-skip" data-cskip>Skip ▸</button>
      </div>`);
    this.root.appendChild(this.cine);
    this.cine.querySelector("[data-cskip]")!.addEventListener("click", () => this.ctrl.skipCutscene());

    // The Settings overlay sits above every other screen and can be opened from
    // the title or the pause menu. Empty + hidden until opened.
    this.settings = $(`<div class="settings-screen"></div>`);
    this.root.appendChild(this.settings);
    // Esc closes Settings (and is swallowed so it doesn't also toggle pause behind).
    window.addEventListener("keydown", (e) => {
      if (!this.settingsOpen) return;
      if (e.code === "Escape") { e.preventDefault(); e.stopPropagation(); this.closeSettings(); }
      else if (e.code === "Space" || e.code === "Enter") e.stopPropagation();
    }, true);
    // Leaving fullscreen by any route (Esc/F11) must refresh the open panel's label.
    document.addEventListener("fullscreenchange", () => { if (this.settingsOpen) this.renderSettingsBody(); });
  }

  // ── per-frame ──
  frame(G: GameState): void {
    this.updateHud(G);
    this.updatePrompts(G);
    this.updateDayCard(G);
    this.updateFx(G);
    this.updateCine(G);
    this.tutBadge.classList.toggle("show", G.phase === "playing" && G.tutorial);
    if (G.phase !== this.lastPhase) {
      this.lastPhase = G.phase;
      this.renderScreens(G);
    }
  }

  private updateHud(G: GameState): void {
    const playing = G.phase === "playing";
    this.hud.style.display = playing ? "flex" : "none";
    if (!playing) {
      this.comboChip.classList.remove("show");
      this.nextHint.classList.remove("show");
      this.actionBtn.classList.remove("show");
      return;
    }
    this.dayVal.textContent = G.tutorial ? "🎓" : String(G.day);
    if (G.coins !== this.lastScore) {
      this.scoreVal.textContent = String(G.coins);
      this.scoreVal.classList.remove("bump");
      void this.scoreVal.offsetWidth;
      this.scoreVal.classList.add("bump");
      if (G.coins > this.lastScore) this.flashServe();
      this.lastScore = G.coins;
    }
    this.servedVal.textContent = `${G.servedToday}/${G.goal}`;
    const ratio = Math.max(0, G.dayTime / Math.max(1, G.dayLen));
    this.timerWrap.style.visibility = G.tutorial ? "hidden" : "visible";
    this.timerBar.style.width = `${ratio * 100}%`;
    this.timerWrap.classList.toggle("low", !G.tutorial && G.dayTime < 10);

    if (G.combo >= 2) {
      this.comboChip.classList.add("show");
      this.comboChip.classList.toggle("fire", G.combo >= FIRE_AT);
      (this.comboChip.querySelector("[data-combo]")!).textContent = String(G.combo);
    } else {
      this.comboChip.classList.remove("show");
    }
  }

  private updatePrompts(G: GameState): void {
    if (G.phase !== "playing") return;
    if (G.guide.active) {
      this.nextHint.classList.add("show");
      (this.nextHint.querySelector("[data-nhicon]")!).textContent = G.guide.icon || "✨";
      (this.nextHint.querySelector("[data-nhtext]")!).textContent = G.guide.label;
    } else {
      this.nextHint.classList.remove("show");
    }
    if (G.prompt) {
      this.actionBtn.classList.add("show");
      (this.actionBtn.querySelector("[data-abtext]")!).textContent = G.prompt.label;
      (this.actionBtn.querySelector("[data-abicon]")!).textContent = G.prompt.icon;
    } else {
      this.actionBtn.classList.remove("show");
    }
  }

  private updateDayCard(G: GameState): void {
    const dc = G.dayCard;
    if (dc && G.phase === "playing") {
      const key = dc.title + "|" + dc.sub;
      if (key !== this.lastDayCardKey) {
        this.lastDayCardKey = key;
        (this.dayCardEl.querySelector("[data-dctitle]")!).textContent = dc.title;
        (this.dayCardEl.querySelector("[data-dcsub]")!).textContent = dc.sub;
        this.dayCardEl.classList.remove("show");
        void this.dayCardEl.offsetWidth;
        this.dayCardEl.classList.add("show");
      }
      this.dayCardEl.style.display = "block";
      this.dayCardEl.style.opacity = dc.t > 2.4 ? String(Math.max(0, (3 - dc.t) / 0.6)) : "1";
    } else {
      this.dayCardEl.style.display = "none";
      this.lastDayCardKey = "";
    }
  }

  private updateFx(G: GameState): void {
    const playing = G.phase === "playing";
    this.fxLow.classList.toggle("active", playing && !G.tutorial && G.dayTime < 10);
    this.fxFire.classList.toggle("active", playing && G.combo >= FIRE_AT);
  }

  private flashServe(): void {
    this.fxFlash.classList.remove("on");
    void this.fxFlash.offsetWidth;
    this.fxFlash.classList.add("on");
  }

  // ── cutscene ──
  private updateCine(G: GameState): void {
    const cs = G.cutscene;
    if (!cs) {
      this.cine.classList.remove("on");
      this.uiLastShot = -1;
      return;
    }
    this.cine.classList.add("on");
    const shot = currentShot(cs);
    if (!shot) return;

    if (cs.shotIndex !== this.uiLastShot) {
      this.uiLastShot = cs.shotIndex;
      const fade = this.cine.querySelector(".cine-fade") as HTMLElement;
      if (shot.fade === "fromBlack") {
        fade.style.transition = "none";
        fade.style.opacity = "1";
        void fade.offsetWidth;
        fade.style.transition = `opacity ${shot.dur * 0.7}s ease-out`;
        fade.style.opacity = "0";
      } else if (shot.fade === "toBlack") {
        fade.style.transition = `opacity ${shot.dur * 0.9}s ease-in`;
        fade.style.opacity = "1";
      }
    }

    const titleEl = this.cine.querySelector(".cine-title") as HTMLElement;
    if (shot.title) {
      titleEl.classList.add("show");
      (this.cine.querySelector("[data-ctitle]")!).textContent = shot.title.text;
      (this.cine.querySelector("[data-csub]")!).textContent = shot.title.sub ?? "";
    } else {
      titleEl.classList.remove("show");
    }

    const dialog = this.cine.querySelector(".cine-dialog") as HTMLElement;
    if (shot.line) {
      dialog.classList.add("show");
      (this.cine.querySelector("[data-cportrait]")!).textContent = shot.line.portrait;
      const nameEl = this.cine.querySelector("[data-cname]") as HTMLElement;
      nameEl.textContent = shot.line.who;
      nameEl.style.color = shot.line.color ?? "#fff4ea";
      (this.cine.querySelector("[data-ctext]")!).textContent = cutsceneText(cs);
    } else {
      dialog.classList.remove("show");
    }
  }

  // ── overlay screens ──
  private renderScreens(G: GameState): void {
    const phase = G.phase;
    this.work = null;
    // Open the customizer on the category the game state asks for (lets debug
    // scenarios cut straight to e.g. the Diner section with a room-framed preview).
    if (phase === "setup" || phase === "manage") {
      const cats = phase === "setup" ? CZ_CATS_SETUP : CZ_CATS;
      this.czCat = cats.some(([k]) => k === G.studioCat) ? (G.studioCat as CzCat) : "chef";
    }
    if (phase === "title") this.screens.innerHTML = this.titleHtml();
    else if (phase === "setup") this.screens.innerHTML = this.setupHtml(G);
    else if (phase === "dayComplete") this.screens.innerHTML = this.dayCompleteHtml(G);
    else if (phase === "manage") this.screens.innerHTML = this.manageHtml(G);
    else if (phase === "win") this.screens.innerHTML = this.winHtml(G);
    else this.screens.innerHTML = "";
    this.wireScreens(G);
  }

  private titleHtml(): string {
    const meta = loadMeta();
    const cont = this.ctrl.hasSave()
      ? `<button class="btn big" data-continue>▶ Continue</button>`
      : "";
    const playLabel = this.ctrl.hasSave() ? "✨ New Diner" : "▶ Play";
    return `
      <div class="overlay">
        <div class="title-logo">SIZZLE&nbsp;RUSH</div>
        <div class="subtitle">🍔 Help Pip cook at Grandma's Diner! 🍦</div>
        ${cont}
        <button class="btn ${this.ctrl.hasSave() ? "" : "big"}" data-play>${playLabel}</button>
        <div class="panel small">
          <div class="rank">Rank: <b>${chefRank(meta.bestDay)}</b></div>
          <div class="muted">Best day reached: ${meta.bestDay} ${"⭐".repeat(Math.min(3, meta.bestStars))}</div>
        </div>
        <div class="row">
          <button class="btn ghost" data-opensettings>⚙️ Settings</button>
        </div>
        <div class="controls-tip">Move: Arrow keys (or WASD) &nbsp;·&nbsp; Do everything: SPACE &nbsp;·&nbsp; Dash: Shift</div>
      </div>`;
  }

  // ── Setup studio (after the tutorial) ──
  private setupHtml(G: GameState): string {
    const c = this.ctrl.config();
    return `
      <div class="overlay wide dock">
        <div class="big-title">🎉 Build Your Diner!</div>
        <div class="subtitle">Name it, choose your food &amp; friends, then make it yours. Watch it change behind you!</div>
        <div class="cz-panel" data-cz-panel>
          ${this.nameSection(c)}
          ${this.customizerHtml(G, true)}
        </div>
        <button class="btn big" data-finishsetup>🚪 Open My Diner!</button>
      </div>`;
  }

  private nameSection(c: RestaurantConfig): string {
    const presets = ["Grandma's Diner", "Yummy Town", "Pip's Place", "Tasty Castle", "Happy Plate"];
    const btns = presets.map((p) => `<button class="chip name-preset" data-namepreset="${p}">${p}</button>`).join("");
    return `
      <div class="cz-group">
        <div class="cz-title">✏️ Restaurant Name</div>
        <input class="name-input" data-name maxlength="22" value="${escapeAttr(c.name)}" placeholder="My Diner" />
        <div class="chip-list">${btns}</div>
      </div>`;
  }

  /** The shared colour/menu/pet/look editor used by setup + the manage screen.
   *  One category is shown at a time (picked from a friendly icon bar) so a young
   *  kid sees a focused, un-cluttered set of choices instead of a wall of swatches. */
  private customizerHtml(G: GameState, withLayout = false): string {
    const cats = withLayout ? CZ_CATS_SETUP : CZ_CATS;
    const bar = cats.map(([k, ic, nm]) =>
      `<button class="cz-cat${k === this.czCat ? " on" : ""}" data-czcat="${k}">
         <span class="cz-cat-ic">${ic}</span><span class="cz-cat-nm">${nm}</span></button>`,
    ).join("");
    return `
      <div class="cz" data-cz-root>
        <div class="cz-cats">${bar}</div>
        <div class="cz-section" data-cz-section>${this.czSection(G)}</div>
      </div>`;
  }

  /** The controls for the currently-open customizer category. */
  private czSection(G: GameState): string {
    const c = this.ctrl.config();
    switch (this.czCat) {
      case "menu":
        return `<div class="cz-group">
          <div class="cz-title">🍽️ Your Menu — what your guests order</div>
          <div class="cz-hint">Tap to add or remove a food. Locked foods unlock as you play!</div>
          <div class="chip-list big">${this.menuChips(G)}</div>
        </div>`;
      case "chef":
        return `<div class="cz-group">
          <div class="cz-title">🧑‍🍳 Chef Pip — that's you!</div>
          ${this.swatchRow("Apron", "chef.apron", c.chef.apron, SWATCHES)}
          ${this.swatchRow("Trim", "chef.accent", c.chef.accent, SWATCHES)}
          ${this.swatchRow("Skin", "chef.skin", c.chef.skin, TONE_SWATCHES)}
          ${this.swatchRow("Hat", "chef.hat", c.chef.hat, SWATCHES)}
          ${this.swatchRow("Hair", "chef.hair", c.chef.hair, TONE_SWATCHES)}
        </div>`;
      case "pet":
        return `<div class="cz-group">
          <div class="cz-title">🐾 Your Pet Pal</div>
          <div class="cz-hint">Pick your friend, then colour them in.</div>
          <div class="chip-list big">${this.petChips(G)}</div>
          ${this.swatchRow("Fur", "pet.body", c.pet.body, TONE_SWATCHES)}
          ${this.swatchRow("Belly", "pet.belly", c.pet.belly, TONE_SWATCHES)}
          ${this.swatchRow("Ears", "pet.accent", c.pet.accent, SWATCHES)}
        </div>`;
      case "diner":
        return `<div class="cz-group">
          <div class="cz-title">🏠 The Diner</div>
          ${this.swatchRow("Walls", "palette.wall", c.palette.wall, SWATCHES)}
          ${this.swatchRow("Floor", "palette.floorA", c.palette.floorA, SWATCHES)}
          ${this.swatchRow("Tiles", "palette.floorB", c.palette.floorB, SWATCHES)}
          ${this.swatchRow("Stripe", "palette.stripe", c.palette.stripe, SWATCHES)}
          ${this.swatchRow("Windows", "palette.window", c.palette.window, SWATCHES)}
        </div>`;
      case "tables":
        return `<div class="cz-group">
          <div class="cz-title">🪑 Tables &amp; Chairs</div>
          ${this.swatchRow("Top", "table.top", c.table.top, SWATCHES)}
          ${this.swatchRow("Rim", "table.rim", c.table.rim, SWATCHES)}
          ${this.swatchRow("Legs", "table.leg", c.table.leg, SWATCHES)}
          ${this.swatchRow("Chairs", "table.chair", c.table.chair, SWATCHES)}
        </div>`;
      case "gear":
        return `<div class="cz-group">
          <div class="cz-title">🍳 Kitchen Gear</div>
          ${this.swatchRow("Body", "station.body", c.station.body, SWATCHES)}
          ${this.swatchRow("Trim", "station.trim", c.station.trim, SWATCHES)}
        </div>`;
      case "flowers":
        return `<div class="cz-group">
          <div class="cz-title">🌸 Flowers</div>
          <div class="cz-row col"><span class="cz-label">Type</span><div class="chip-list">${this.plantTypeChips(c)}</div></div>
          ${c.plants.map((p, i) => this.swatchRow(`Pot ${i + 1}`, `plants.${i}.bloom`, p.bloom, SWATCHES)).join("")}
        </div>`;
      case "layout":
        return `<div class="cz-group">
          <div class="cz-title">🔀 Layout — place your tables &amp; equipment</div>
          ${this.arrangePanel(G)}
        </div>`;
    }
  }

  private plantTypeChips(c: RestaurantConfig): string {
    const types = ["🌼 Daisy", "🌷 Tulip", "🌹 Rose", "🌻 Bloom"];
    const cur = c.plants[0]?.kind ?? 0;
    return types.map((t, i) => {
      const [ic, nm] = t.split(" ");
      return `<button class="chip${i === cur ? " on" : ""}" data-planttype="${i}"><span class="chip-ic">${ic}</span><span class="chip-tx">${nm}</span></button>`;
    }).join("");
  }

  private menuChips(G: GameState): string {
    const c = this.ctrl.config();
    return FOOD_OPTIONS.map((f) => {
      const unlocked = foodUnlocked(G.unlocks, f.id);
      const on = c.menu.includes(f.id);
      return `<button class="chip food${on ? " on" : ""}${unlocked ? "" : " locked"}" data-menu="${f.id}" ${unlocked ? "" : "disabled"}>
        <span class="chip-ic">${unlocked ? f.icon : "🔒"}</span><span class="chip-tx">${f.name}</span></button>`;
    }).join("");
  }

  private petChips(G: GameState): string {
    const c = this.ctrl.config();
    return PET_OPTIONS.map((p) => {
      const unlocked = petUnlocked(G.unlocks, p.kind);
      const on = c.pet.kind === p.kind;
      return `<button class="chip pet${on ? " on" : ""}${unlocked ? "" : " locked"}" data-petkind="${p.kind}" ${unlocked ? "" : "disabled"}>
        <span class="chip-ic">${unlocked ? p.icon : "🔒"}</span><span class="chip-tx">${p.name}</span></button>`;
    }).join("");
  }

  private swatchRow(label: string, path: string, current: number, swatches: { hex: number; name: string }[]): string {
    const btns = swatches.map((s) =>
      `<button class="sw${s.hex === current ? " sel" : ""}" data-cz="${path}" data-hex="${s.hex}" title="${s.name}" style="background:#${hex(s.hex)}"></button>`,
    ).join("");
    return `<div class="cz-row"><span class="cz-label">${label}</span><div class="sw-list">${btns}</div></div>`;
  }

  private dayCompleteHtml(G: GameState): string {
    const stars = G.stars;
    const starRow = [1, 2, 3].map((i) => `<span class="star ${i <= stars ? "lit" : ""}">⭐</span>`).join("");
    const cheer = stars >= 3 ? "Amazing!" : stars >= 2 ? "Great job!" : "Nice work!";
    return `
      <div class="overlay">
        <div class="big-title">${cheer}</div>
        <div class="subtitle">Day ${G.day} done — you made ${G.servedToday} friends happy! 🥰</div>
        <div class="stars">${starRow}</div>
        ${this.unlockToast(G)}
        <button class="btn big" data-next>${G.day >= G.maxDay ? "🎉 Finish!" : "🛠️ Manage Diner"}</button>
      </div>`;
  }

  private unlockToast(G: GameState): string {
    if (!G.newUnlocks.length) return "";
    const items = G.newUnlocks.map((k) => `<span class="ul-chip">${unlockLabel(k)}</span>`).join("");
    return `<div class="toast"><span class="toast-h">✨ New unlocked!</span>${items}</div>`;
  }

  // ── Between-day manage (upgrade / decorate / arrange) ──
  private manageHtml(G: GameState): string {
    return `
      <div class="overlay wide">
        <div class="big-title">🛠️ Manage Your Diner</div>
        <div class="subtitle">Day ${G.day} done! Pick an upgrade, redecorate, or move things around.</div>
        ${this.unlockToast(G)}
        <div class="tabs">
          <button class="tab on" data-tab="upgrade">🎁 Upgrade</button>
          <button class="tab" data-tab="decorate">🎨 Decorate</button>
          <button class="tab" data-tab="arrange">🔀 Arrange</button>
        </div>
        <div class="tab-body">
          <div class="tab-panel" data-panel="upgrade">${this.upgradePanel(G)}</div>
          <div class="tab-panel" data-panel="decorate" hidden><div class="cz-panel">${this.customizerHtml(G)}</div></div>
          <div class="tab-panel" data-panel="arrange" hidden>${this.arrangePanel(G)}</div>
        </div>
        <button class="btn big" data-finishmanage>▶ Start Day ${G.day + 1}</button>
      </div>`;
  }

  private upgradePanel(G: GameState): string {
    if (!G.treatChoices.length) {
      return `<div class="picked">✓ Upgrade chosen! Tap a tab or start the day.</div>`;
    }
    const cards = G.treatChoices.map((id) => {
      const t = TREATS.find((x) => x.id === id)!;
      return `<button class="treat-card" data-treat="${id}">
          <div class="tc-icon">${t.icon}</div>
          <div class="tc-name">${t.name}</div>
          <div class="tc-blurb">${t.blurb}</div>
        </button>`;
    }).join("");
    return `<div class="subtitle small">Pick one to make tomorrow even more fun!</div><div class="treats">${cards}</div>`;
  }

  private arrangePanel(G: GameState): string {
    return `
      <div class="arr-group">
        <div class="cz-title" data-arrtitle>🔀 Drag tables &amp; equipment (${G.tables.length}/${MAX_TABLES} tables)</div>
        <div class="floor-map" data-map>${this.mapTokens(G)}</div>
        <div class="map-legend">🍽️ tables (front) · 🍳 equipment (back wall)</div>
        <div class="row">
          <button class="btn ghost" data-addtable>➕ Table</button>
          <button class="btn ghost" data-removetable>➖ Table</button>
        </div>
      </div>`;
  }

  private mapTokens(G: GameState): string {
    const kitchen = `<div class="map-kitchen"></div><div class="map-doormat"></div>`;
    const tables = G.tables.map((t, i) => this.mapToken("table", String(i), "🍽️", t.x, t.z)).join("");
    const stations = G.stations.filter((s) => s.kind !== "trash")
      .map((s) => this.mapToken("station", s.id, iconForStation(s.id), s.x, s.z)).join("");
    return kitchen + tables + stations;
  }

  private mapToken(kind: string, id: string, icon: string, x: number, z: number): string {
    const [px, py] = worldToMapPct(x, z);
    return `<button class="map-token ${kind}" data-token="${kind}:${id}" style="left:${px}%;top:${py}%">${icon}</button>`;
  }

  private winHtml(G: GameState): string {
    return `
      <div class="overlay">
        <div class="title-logo win">YOU DID IT! 🎉</div>
        <div class="subtitle">${escapeHtml(G.config.name)} is the happiest place in town! 💛</div>
        <div class="stars big">${"⭐".repeat(3)}</div>
        <div class="panel small"><div class="muted">Final score: <b>${G.coins}</b> 🪙</div></div>
        <button class="btn big" data-play>▶ Play Again</button>
      </div>`;
  }

  private pauseHtml(): string {
    return `
      <div class="overlay">
        <div class="big-title">Paused</div>
        <button class="btn big" data-resume>▶ Resume</button>
        <div class="row">
          <button class="btn ghost" data-opensettings>⚙️ Settings</button>
        </div>
        <button class="btn ghost" data-quit>🏠 Save &amp; Quit to Title</button>
      </div>`;
  }

  showPause(show: boolean): void {
    if (show) {
      this.screens.innerHTML = this.pauseHtml();
      this.wirePause();
    } else if (this.lastPhase === "playing") {
      this.screens.innerHTML = "";
    }
  }

  private wireScreens(G: GameState): void {
    this.screens.querySelector("[data-play]")?.addEventListener("click", () => this.ctrl.play());
    this.screens.querySelector("[data-continue]")?.addEventListener("click", () => this.ctrl.continueRun());
    this.screens.querySelector("[data-next]")?.addEventListener("click", () => this.ctrl.nextFromDayComplete());
    this.screens.querySelector("[data-finishsetup]")?.addEventListener("click", () => this.ctrl.finishSetup());
    this.screens.querySelector("[data-finishmanage]")?.addEventListener("click", () => this.ctrl.finishManage());
    if (G.phase === "setup" || G.phase === "manage") this.wireCustomizer(G);
    if (G.phase === "setup") this.wireArrange(G);
    if (G.phase === "manage") { this.wireTabs(); this.wireUpgrade(); this.wireArrange(G); }
    this.wireOpenSettings();
  }

  private wireTabs(): void {
    const tabs = Array.from(this.screens.querySelectorAll("[data-tab]")) as HTMLElement[];
    const panels = Array.from(this.screens.querySelectorAll("[data-panel]")) as HTMLElement[];
    tabs.forEach((t) => t.addEventListener("click", () => {
      const key = t.dataset.tab!;
      tabs.forEach((x) => x.classList.toggle("on", x === t));
      panels.forEach((p) => { p.hidden = p.dataset.panel !== key; });
    }));
  }

  private wireUpgrade(): void {
    this.screens.querySelectorAll("[data-treat]").forEach((el) =>
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).dataset.treat as TreatId;
        this.ctrl.chooseTreat(id);
        const panel = this.screens.querySelector('[data-panel="upgrade"]');
        if (panel) panel.innerHTML = `<div class="picked">✓ Upgrade chosen! Tap a tab or start the day.</div>`;
      }),
    );
  }

  private wireArrange(G: GameState): void {
    const map = this.screens.querySelector("[data-map]") as HTMLElement | null;
    if (map) this.wireMapTokens(map);
    this.screens.querySelector("[data-addtable]")?.addEventListener("click", () => {
      this.ctrl.addTable();
      this.refreshMap(G);
    });
    this.screens.querySelector("[data-removetable]")?.addEventListener("click", () => {
      this.ctrl.removeTable();
      this.refreshMap(G);
    });
  }

  private refreshMap(G: GameState): void {
    const map = this.screens.querySelector("[data-map]") as HTMLElement | null;
    if (map) { map.innerHTML = this.mapTokens(G); this.wireMapTokens(map); }
    const title = this.screens.querySelector("[data-arrtitle]");
    if (title) title.textContent = `🔀 Drag tables & equipment (${G.tables.length}/${MAX_TABLES} tables)`;
  }

  /** Pointer drag: move a token on the top-down map → live 3D reposition. */
  private wireMapTokens(map: HTMLElement): void {
    map.querySelectorAll("[data-token]").forEach((node) => {
      const el = node as HTMLElement;
      el.addEventListener("pointerdown", (ev: Event) => {
        const pe = ev as PointerEvent;
        pe.preventDefault();
        const [kind, id] = el.dataset.token!.split(":");
        el.classList.add("dragging");
        try { el.setPointerCapture(pe.pointerId); } catch { /* ignore */ }
        const onMove = (e: Event): void => {
          const me = e as PointerEvent;
          const r = map.getBoundingClientRect();
          const px = clamp01((me.clientX - r.left) / r.width);
          const py = clamp01((me.clientY - r.top) / r.height);
          let [x, z] = mapPctToWorld(px, py);
          if (kind === "table") { x = clampN(x, -11, 11); z = clampN(z, -2.2, 5.6); }
          else { x = clampN(x, -11.5, 11.5); z = clampN(z, -9, -5.2); }
          const [rx, ry] = worldToMapPct(x, z);
          el.style.left = `${rx}%`;
          el.style.top = `${ry}%`;
          if (kind === "table") this.ctrl.moveTable(Number(id), x, z);
          else this.ctrl.moveStation(id as StationId, x, z);
        };
        const onUp = (): void => {
          el.classList.remove("dragging");
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerup", onUp);
          el.removeEventListener("pointercancel", onUp);
        };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerup", onUp);
        el.addEventListener("pointercancel", onUp);
      });
    });
  }

  /** Wire the customizer: the category bar (switch sections), the name field, and
   *  the controls inside the currently-open section. */
  private wireCustomizer(G: GameState): void {
    this.work = cloneConfig(this.ctrl.config());

    // Category bar — switch which section is shown, and tell the preview what to frame.
    this.screens.querySelectorAll("[data-czcat]").forEach((el) =>
      el.addEventListener("click", () => {
        this.czCat = (el as HTMLElement).dataset.czcat as CzCat;
        this.screens.querySelectorAll("[data-czcat]").forEach((b) => b.classList.toggle("on", b === el));
        const sec = this.screens.querySelector("[data-cz-section]");
        if (sec) {
          sec.innerHTML = this.czSection(G);
          this.wireCzControls();
          if (this.czCat === "layout") this.wireArrange(G); // the arrange map lives in this section
        }
        this.ctrl.setStudioFocus(CZ_FOCUS[this.czCat], this.czCat);
      }),
    );

    // Name field (lives outside the category section, in setup).
    const nameInput = this.screens.querySelector("[data-name]") as HTMLInputElement | null;
    nameInput?.addEventListener("input", () => { this.work!.name = nameInput.value; this.applyWork(); });
    this.screens.querySelectorAll("[data-namepreset]").forEach((el) =>
      el.addEventListener("click", () => {
        this.work!.name = (el as HTMLElement).dataset.namepreset!;
        if (nameInput) nameInput.value = this.work!.name;
        this.applyWork();
      }),
    );

    this.ctrl.setStudioFocus(CZ_FOCUS[this.czCat], this.czCat);
    this.wireCzControls();
  }

  private applyWork(): void { this.ctrl.setConfig(this.work!); }

  /** Wire the swatch / menu / pet / plant controls inside the current section. */
  private wireCzControls(): void {
    const sec = this.screens.querySelector("[data-cz-section]") ?? this.screens;
    sec.querySelectorAll("[data-cz]").forEach((el) =>
      el.addEventListener("click", () => {
        setPath(this.work!, (el as HTMLElement).dataset.cz!, parseInt((el as HTMLElement).dataset.hex!, 16));
        this.applyWork();
        el.parentElement!.querySelectorAll(".sw").forEach((b) => b.classList.toggle("sel", b === el));
      }),
    );
    sec.querySelectorAll("[data-menu]").forEach((el) =>
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).dataset.menu as FoodId;
        const m = this.work!.menu;
        const idx = m.indexOf(id);
        if (idx >= 0) { if (m.length > 1) m.splice(idx, 1); } else m.push(id);
        this.applyWork();
        el.classList.toggle("on", this.work!.menu.includes(id));
      }),
    );
    sec.querySelectorAll("[data-petkind]").forEach((el) =>
      el.addEventListener("click", () => {
        this.work!.pet.kind = (el as HTMLElement).dataset.petkind as PetKind;
        this.applyWork();
        sec.querySelectorAll("[data-petkind]").forEach((b) => b.classList.toggle("on", b === el));
      }),
    );
    sec.querySelectorAll("[data-planttype]").forEach((el) =>
      el.addEventListener("click", () => {
        const kind = Number((el as HTMLElement).dataset.planttype);
        this.work!.plants.forEach((p) => { p.kind = kind; });
        this.applyWork();
        sec.querySelectorAll("[data-planttype]").forEach((b) => b.classList.toggle("on", b === el));
      }),
    );
  }

  private wirePause(): void {
    this.screens.querySelector("[data-resume]")?.addEventListener("click", () => this.ctrl.resume());
    this.screens.querySelector("[data-quit]")?.addEventListener("click", () => this.ctrl.quitToTitle());
    this.wireOpenSettings();
  }

  private wireOpenSettings(): void {
    this.screens.querySelector("[data-opensettings]")?.addEventListener("click", () => this.openSettings());
  }

  // ── Settings overlay (display + sound) ──────────────────────────────────────
  openSettings(): void {
    this.settingsOpen = true;
    this.settings.innerHTML = `
      <div class="settings-card">
        <div class="set-head">⚙️ Settings</div>
        <div class="set-body" data-set-body>${this.settingsBody()}</div>
        <button class="btn big" data-set-close>✓ Done</button>
      </div>`;
    this.settings.classList.add("on");
    this.settings.querySelector("[data-set-close]")!.addEventListener("click", () => this.closeSettings());
    this.wireSettings();
  }

  closeSettings(): void {
    this.settingsOpen = false;
    this.settings.classList.remove("on");
    this.settings.innerHTML = "";
  }

  /** Re-render just the body (after a discrete toggle/segment change) and re-wire. */
  private renderSettingsBody(): void {
    const body = this.settings.querySelector("[data-set-body]");
    if (!body) return;
    body.innerHTML = this.settingsBody();
    this.wireSettings();
  }

  private settingsBody(): string {
    const meta = loadMeta();
    const fs = this.ctrl.isFullscreen();
    return `
      <div class="set-section">
        <div class="set-sec-title">🖥️ Display</div>
        <div class="set-row">
          <span class="set-label">Fullscreen</span>
          <button class="set-toggle${fs ? " on" : ""}" data-set-fs>${fs ? "⛶ On" : "⛶ Off"}</button>
        </div>
        <div class="set-row">
          <span class="set-label">Resolution</span>
          <div class="seg" data-set-res>${this.segButtons(RES_OPTIONS.map(([v, n]) => [String(v), n]), (v) => nearScale(meta.renderScale, Number(v)))}</div>
        </div>
        <div class="set-row">
          <span class="set-label">Graphics</span>
          <div class="seg" data-set-qual>${this.segButtons([["high", "Fancy"], ["low", "Smooth"]], (v) => v === meta.quality)}</div>
        </div>
      </div>
      <div class="set-section">
        <div class="set-sec-title">🔊 Sound</div>
        <div class="set-row">
          <span class="set-label">Sound</span>
          <button class="set-toggle${meta.muted ? "" : " on"}" data-set-mute>${meta.muted ? "🔇 Off" : "🔊 On"}</button>
        </div>
        ${this.sliderRow("Music", "music", meta.musicVol, meta.muted)}
        ${this.sliderRow("Effects", "sfx", meta.sfxVol, meta.muted)}
      </div>`;
  }

  private segButtons(opts: Array<[string, string]>, isOn: (v: string) => boolean): string {
    return opts.map(([v, n]) =>
      `<button class="seg-btn${isOn(v) ? " on" : ""}" data-seg="${v}">${n}</button>`,
    ).join("");
  }

  private sliderRow(label: string, key: string, val: number, muted: boolean): string {
    const pct = Math.round(val * 100);
    return `
      <div class="set-row${muted ? " dim" : ""}">
        <span class="set-label">${label}</span>
        <input class="set-slider" type="range" min="0" max="100" value="${pct}" data-set-slider="${key}" ${muted ? "disabled" : ""} />
        <span class="set-pct" data-set-pct="${key}">${pct}%</span>
      </div>`;
  }

  private wireSettings(): void {
    const root = this.settings;
    root.querySelector("[data-set-fs]")?.addEventListener("click", () => {
      this.ctrl.toggleFullscreen();
      // The fullscreenchange event re-renders the body; nothing else to do here.
    });
    root.querySelector("[data-set-mute]")?.addEventListener("click", () => {
      this.ctrl.toggleMute();
      this.renderSettingsBody();
    });
    root.querySelector("[data-set-res]")?.querySelectorAll("[data-seg]").forEach((el) =>
      el.addEventListener("click", () => {
        this.ctrl.setResolution(Number((el as HTMLElement).dataset.seg));
        this.renderSettingsBody();
      }),
    );
    root.querySelector("[data-set-qual]")?.querySelectorAll("[data-seg]").forEach((el) =>
      el.addEventListener("click", () => {
        const want = (el as HTMLElement).dataset.seg as "high" | "low";
        if (want !== loadMeta().quality) this.ctrl.toggleQuality();
        this.renderSettingsBody();
      }),
    );
    // Sliders update live (no re-render mid-drag, which would drop the thumb).
    root.querySelectorAll("[data-set-slider]").forEach((el) =>
      el.addEventListener("input", () => {
        const input = el as HTMLInputElement;
        const key = input.dataset.setSlider!;
        const v = Number(input.value) / 100;
        if (key === "music") this.ctrl.setMusicVol(v);
        else this.ctrl.setSfxVol(v);
        const pctEl = root.querySelector(`[data-set-pct="${key}"]`);
        if (pctEl) pctEl.textContent = `${Math.round(v * 100)}%`;
      }),
    );
  }
}

type CzCat = "menu" | "chef" | "pet" | "diner" | "tables" | "gear" | "flowers" | "layout";
const CZ_CATS: Array<[CzCat, string, string]> = [
  ["menu", "🍽️", "Food"],
  ["chef", "🧑‍🍳", "Chef"],
  ["pet", "🐾", "Pet"],
  ["diner", "🏠", "Diner"],
  ["tables", "🪑", "Tables"],
  ["gear", "🍳", "Gear"],
  ["flowers", "🌸", "Flowers"],
];
/** Setup also folds the table/equipment layout into the category bar, so it's one
 *  focused section (reachable from the sticky nav) instead of a long scroll below. */
const CZ_CATS_SETUP: Array<[CzCat, string, string]> = [...CZ_CATS, ["layout", "🔀", "Layout"]];
/** What the live preview should frame for a category: the characters, or the room. */
const CZ_FOCUS: Record<CzCat, "chef" | "room"> = {
  menu: "room", chef: "chef", pet: "chef", diner: "room", tables: "room", gear: "room", flowers: "room", layout: "room",
};

/** Resolution-scale options (multiplier on the device pixel ratio) → friendly name. */
const RES_OPTIONS: Array<[number, string]> = [
  [0.67, "Smooth"],
  [1.0, "Native"],
  [1.5, "Crisp"],
  [2.0, "Ultra"],
];
/** True if `scale` is the option closest to the saved render scale (float-safe match). */
const nearScale = (saved: number, opt: number): boolean => {
  let best = RES_OPTIONS[0][0];
  for (const [v] of RES_OPTIONS) if (Math.abs(v - saved) < Math.abs(best - saved)) best = v;
  return opt === best;
};

const iconForStation = (id: StationId): string => {
  switch (id) {
    case "grill": case "hotgrill": return "🔥";
    case "fryer": return "🍟";
    case "soda": return "🥤";
    case "icecream": return "🍦";
    case "meat": return "🥩";
    case "potato": return "🥔";
    case "sausage": return "🌭";
    default: return "📦";
  }
};

/** Write a hex colour into a dotted config path (e.g. "chef.apron", "plants.0.bloom"). */
function setPath(cfg: RestaurantConfig, path: string, val: number): void {
  const parts = path.split(".");
  if (parts[0] === "plants") {
    const i = Number(parts[1]);
    if (cfg.plants[i]) cfg.plants[i].bloom = val;
    return;
  }
  const top = (cfg as unknown as Record<string, Record<string, number>>)[parts[0]];
  if (top) top[parts[1]] = val;
}

const escapeHtml = (s: string): string => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const escapeAttr = (s: string): string => escapeHtml(s).replace(/"/g, "&quot;");
