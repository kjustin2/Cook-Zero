// DOM UI: the persistent HUD plus every overlay screen (title, day results, the
// between-day manager with shop/pricing/upgrades tabs, the build-mode palette,
// game over, win). The UI reads G and calls game logic directly; phase
// transitions go through the GameController the main loop provides.

import type { GameState } from "../game/types";
import type { Ctx } from "../game/ctx";
import { fmtTime } from "../core/math";
import { def } from "../game/catalog";
import { items } from "../game/grid";
import { recomputeDerived } from "../game/adjacency";
import { PRICE_LEVELS, QUOTAS, TOTAL_DAYS, HELPER_HIRE_COST, HELPER_UPGRADE_COST, HELPER_WAGES, ON_FIRE_AT } from "../game/balance";
import { upgradeDef, applyUpgrade } from "../game/upgrades";
import { buyItem, canAfford, hireHelper, upgradeHelper } from "../game/shop";
import { setBrush } from "../game/placement";
import { loadMeta } from "../core/save";

export interface GameController {
  play(): void;
  toManage(): void;
  startNextShift(): void;
  enterBuild(): void;
  exitBuild(): void;
  togglePause(): void;
}

type El = HTMLElement;
function el(tag: string, attrs: Record<string, string> = {}, ...kids: (El | string)[]): El {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === "class") e.className = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  for (const c of kids) e.append(c);
  return e;
}
const btn = (label: string, cls: string, on: () => void): El => {
  const b = el("button", { class: `btn ${cls}` }, label);
  b.addEventListener("click", on);
  return b;
};

const starStr = (n: number): string => "★".repeat(n) + "☆".repeat(Math.max(0, 3 - n));

export class UI {
  private hud: El;
  private hint: El;
  private overlay: El;
  private derived: El;
  private toast: El;
  private modChip: El;
  private refs: Record<string, El> = {};
  private lastPhase = "";
  private lastMod = "";

  constructor(root: El, private ctrl: GameController, private ctx: Ctx) {
    this.hud = this.buildHud();
    this.hint = el("div", { class: "hint" }, el("span", { class: "key" }, "SPACE"), el("span", { id: "hint-text" }));
    this.toast = el("div", { class: "toast" });
    this.derived = el("div", { class: "derived" });
    this.modChip = el("div", { class: "modchip" });
    this.overlay = el("div", { class: "overlay" });
    root.append(this.hud, this.hint, this.toast, this.modChip, this.derived, this.overlay);
    this.hud.style.display = "none";
    this.hint.style.display = "none";
    this.toast.style.display = "none";
    this.modChip.style.display = "none";
    this.derived.style.display = "none";
  }

  private buildHud(): El {
    const stat = (label: string, id: string, cls = "") => {
      const v = el("span", { class: "val", id });
      this.refs[id] = v;
      return el("div", { class: `stat ${cls}` }, el("span", { class: "label" }, label), v);
    };
    const quotaBar = el("i", { id: "h-quotabar" });
    this.refs["h-quotabar"] = quotaBar;
    const quota = el("div", { class: "quota-wrap" },
      el("span", { class: "small-muted" }, "Quota ", this.refs["h-quota"] = el("span", { id: "h-quota" })),
      el("div", { class: "bar" }, quotaBar));
    return el("div", { class: "hud" },
      stat("Day", "h-day"),
      el("div", { class: "sep" }),
      stat("Time", "h-time", "timer"),
      el("div", { class: "sep" }),
      stat("Coins", "h-coins"),
      quota,
      el("div", { class: "sep" }),
      stat("Stars", "h-rep"),
      el("div", { class: "sep" }),
      stat("Combo", "h-combo", "combo"));
  }

  // ── per-frame ──
  frame(G: GameState): void {
    if (G.phase !== this.lastPhase) {
      this.lastPhase = G.phase;
      this.onPhase(G);
    }
    const playing = G.phase === "playing";
    this.hud.style.display = playing || G.phase === "build" ? "flex" : "none";
    if (this.hud.style.display !== "none") this.updateHud(G);

    // Hint.
    if (playing && G.hint) {
      this.hint.style.display = "block";
      (this.refs["hint-text"] ??= this.hint.querySelector("#hint-text") as El).textContent = G.hint;
    } else {
      this.hint.style.display = "none";
    }

    // Toast.
    if (G.toast) {
      this.toast.style.display = "block";
      this.toast.textContent = G.toast.text;
      this.toast.style.opacity = String(Math.max(0, 1 - G.toast.t / 2.6));
    } else {
      this.toast.style.display = "none";
    }

    // Modifier chip — a whole-shift reminder of today's twist.
    if ((G.phase === "playing" || G.phase === "build") && G.modifier) {
      if (this.lastMod !== G.modifier.id) {
        this.lastMod = G.modifier.id;
        this.modChip.replaceChildren(
          el("span", { class: "mc-icon" }, G.modifier.icon),
          el("span", {}, G.modifier.name),
        );
      }
      this.modChip.style.display = "flex";
    } else {
      this.modChip.style.display = "none";
      this.lastMod = "";
    }

    // Derived panel during manage/build.
    if (G.phase === "manage" || G.phase === "build") {
      this.derived.style.display = "block";
      this.renderDerived(G);
    } else {
      this.derived.style.display = "none";
    }
  }

  private updateHud(G: GameState): void {
    this.refs["h-day"].textContent = `${G.day}/${TOTAL_DAYS}`;
    this.refs["h-time"].textContent = fmtTime(G.dayTime);
    this.refs["h-time"].parentElement?.classList.toggle("low", G.dayTime <= 15);
    this.refs["h-coins"].textContent = `$${G.coins}`;
    this.refs["h-quota"].textContent = `$${G.dayCoins}/$${G.quota}`;
    this.refs["h-quotabar"].style.width = `${Math.min(100, (G.dayCoins / G.quota) * 100)}%`;
    this.refs["h-rep"].textContent = `★${Math.round(G.rep)}`;
    this.refs["h-combo"].textContent = G.combo > 0 ? `x${G.combo}` : "—";
    this.refs["h-combo"].parentElement?.classList.toggle("fire", G.combo >= ON_FIRE_AT);
  }

  private renderDerived(G: GameState): void {
    const grills = items(G.grid).filter((i) => { const d = def(i.defId); return d?.kind === "grill" || d?.kind === "fryer"; });
    const avgSpeed = grills.length ? grills.reduce((a, i) => a + i.effCookSpeed, 0) / grills.length : G.mods.cookSpeed;
    const lines: [string, string][] = [
      ["Ambience vibe", `${Math.round(G.derived.vibe)}`],
      ["Crowd size", `${G.derived.spawnMult.toFixed(2)}×`],
      ["Patience", `${G.derived.patience.toFixed(2)}×`],
      ["Cook speed", `${avgSpeed.toFixed(2)}×`],
      ["Move speed", `${G.derived.moveSpeed.toFixed(2)}×`],
      ["Tip / serve", `+$${Math.round(G.derived.tip)}`],
      ["Combo window", `${G.derived.comboWindow.toFixed(0)}s`],
      ["Perfect window", `+${G.derived.perfectWindow.toFixed(1)}s`],
      ["Reputation gain", `${G.derived.repGainMult.toFixed(2)}×`],
    ];
    this.derived.replaceChildren(
      el("h4", {}, "Kitchen Effects"),
      ...lines.map(([k, v]) => el("div", { class: "line" }, el("span", {}, k), el("b", {}, v))),
    );
  }

  // ── overlays ──
  private onPhase(G: GameState): void {
    this.overlay.className = "overlay";
    this.overlay.replaceChildren();
    switch (G.phase) {
      case "title": this.renderTitle(); break;
      case "dayEnd": this.renderDayEnd(G); break;
      case "manage": this.renderManage(G); break;
      case "build": this.renderBuild(G); break;
      case "gameOver": this.renderEnd(G, false); break;
      case "win": this.renderEnd(G, true); break;
      default: this.overlay.className = "overlay transparent"; break;
    }
  }

  private renderTitle(): void {
    const meta = loadMeta();
    this.overlay.append(
      el("h1", { class: "title-logo" }, "SIZZLE RUSH"),
      el("div", { class: "subtitle" }, "Cook · Serve · Decorate · Run the joint"),
      el("div", { class: "panel center" },
        el("div", { class: "small-muted" }, "Move WASD · Interact SPACE · Dash SHIFT · Pause P"),
        el("div", { class: "small-muted" }, "Survive 6 dinner rushes. Between shifts, rebuild & decorate your kitchen — placement matters."),
        el("div", { class: "stats-grid", style: "margin-top:12px" },
          el("span", { class: "k" }, "Best day reached"), el("span", { class: "v" }, `${meta.bestDay}`),
          el("span", { class: "k" }, "Best bank"), el("span", { class: "v" }, `$${meta.bestCoins}`),
          el("span", { class: "k" }, "Best combo"), el("span", { class: "v" }, `x${meta.bestCombo}`),
          el("span", { class: "k" }, "Best day rating"), el("span", { class: "v" }, starStr(meta.bestStars))),
      ),
      btn("▶  Start Shift 1", "", () => this.ctrl.play()),
    );
  }

  private renderDayEnd(G: GameState): void {
    const wage = G.helper.hired ? G.helper.wage : 0;
    this.overlay.append(
      el("div", { class: "panel center" },
        el("h2", {}, `Day ${G.day} — Service Complete!`),
        el("div", { class: "stars" }, starStr(G.dayStars)),
        el("div", { class: "stats-grid", style: "margin:14px auto; width:340px" },
          el("span", { class: "k" }, "Earned today"), el("span", { class: "v" }, `$${G.dayCoins}`),
          el("span", { class: "k" }, "Quota"), el("span", { class: "v" }, `$${G.quota} ✓`),
          el("span", { class: "k" }, "Served"), el("span", { class: "v" }, `${G.stats.served}`),
          el("span", { class: "k" }, "Perfect dishes"), el("span", { class: "v" }, `${G.stats.perfect}`),
          el("span", { class: "k" }, "Walkouts"), el("span", { class: "v" }, `${G.stats.expired}`),
          el("span", { class: "k" }, "Reputation"), el("span", { class: "v" }, `★${Math.round(G.rep)}`),
          el("span", { class: "k" }, "Helper wage"), el("span", { class: "v" }, wage ? `-$${wage}` : "—"),
          el("span", { class: "k" }, "Bank"), el("span", { class: "v" }, `$${G.coins}`)),
        btn("Manage Restaurant  →", "", () => this.ctrl.toManage()),
      ),
    );
  }

  private renderManage(G: GameState): void {
    const tabBtn = (id: GameState["manageTab"], label: string) => {
      const t = el("div", { class: `tab clickable ${G.manageTab === id ? "active" : ""}` }, label);
      t.addEventListener("click", () => { G.manageTab = id; this.ctx.sfx.ui(); this.onPhase(G); });
      return t;
    };
    const nextQuota = QUOTAS[Math.min(G.day, QUOTAS.length - 1)];
    const header = el("div", { class: "center" },
      el("h2", {}, `Manager — Day ${G.day} cleared`),
      el("div", { class: "small-muted" }, "Bank: ", el("span", { class: "coins-chip" }, `$${G.coins}`),
        `  ·  Next quota: $${nextQuota}`));

    let content: El;
    if (G.manageTab === "shop") content = this.shopTab(G);
    else if (G.manageTab === "pricing") content = this.pricingTab(G);
    else content = this.upgradeTab(G);

    this.overlay.append(
      el("div", { class: "panel", style: "min-width:640px" },
        header,
        el("div", { class: "tabs", style: "margin-top:14px" },
          tabBtn("shop", "🛒 Shop"), tabBtn("pricing", "💲 Pricing"), tabBtn("upgrades", "⭐ Upgrades")),
        content,
        el("div", { class: "row", style: "margin-top:20px" },
          btn("🔧 Floor Plan", "blue", () => this.ctrl.enterBuild()),
          btn(`Start Day ${G.day + 1}  ▶`, "", () => this.ctrl.startNextShift())),
        this.inventoryNote(G),
      ),
    );
  }

  private inventoryNote(G: GameState): El {
    const owned = Object.entries(G.inventory).filter(([, n]) => n > 0);
    if (!owned.length) return el("div", { class: "small-muted center", style: "margin-top:8px" }, "Tip: buy stations & decor, then place them in the Floor Plan.");
    const txt = owned.map(([id, n]) => `${def(id)?.icon ?? ""}×${n}`).join("  ");
    return el("div", { class: "small-muted center", style: "margin-top:8px" }, `Unplaced (go to Floor Plan): ${txt}`);
  }

  private shopTab(G: GameState): El {
    const cards = G.shopOffer.map((id) => {
      const d = def(id)!;
      const affordable = canAfford(G, id);
      const c = el("div", { class: `card ${affordable ? "" : "disabled"}` },
        el("div", { class: "emoji" }, d.icon),
        el("div", { class: "name" }, d.name),
        el("div", { class: "desc" }, d.desc),
        el("div", { class: "cost" }, `$${d.cost}`),
        btn("Buy", "small", () => {
          if (buyItem(G, id)) { this.ctx.sfx.coin(); this.onPhase(G); }
          else this.ctx.sfx.error();
        }));
      return c;
    });
    // Helper hire/upgrade.
    const h = G.helper;
    let helperCard: El;
    if (!h.hired) {
      helperCard = el("div", { class: `card ${G.coins >= HELPER_HIRE_COST ? "" : "disabled"}` },
        el("div", { class: "emoji" }, "🧑‍🍳"),
        el("div", { class: "name" }, "Hire Line Cook"),
        el("div", { class: "desc" }, `Tends grills so they never burn. Wage $${HELPER_WAGES[1]}/day.`),
        el("div", { class: "cost" }, `$${HELPER_HIRE_COST}`),
        btn("Hire", "small", () => { if (hireHelper(G)) { this.ctx.sfx.coin(); this.onPhase(G); } else this.ctx.sfx.error(); }));
    } else if (h.level < HELPER_WAGES.length - 1) {
      const cost = HELPER_UPGRADE_COST[h.level + 1];
      helperCard = el("div", { class: `card ${G.coins >= cost ? "" : "disabled"}` },
        el("div", { class: "emoji" }, "🧑‍🍳"),
        el("div", { class: "name" }, `Line Cook Lv.${h.level}`),
        el("div", { class: "desc" }, `Upgrade to Lv.${h.level + 1}: tends more grills & holds the perfect sear. Wage $${HELPER_WAGES[h.level + 1]}/day.`),
        el("div", { class: "cost" }, `$${cost}`),
        btn("Upgrade", "small", () => { if (upgradeHelper(G)) { this.ctx.sfx.coin(); this.onPhase(G); } else this.ctx.sfx.error(); }));
    } else {
      helperCard = el("div", { class: "card" },
        el("div", { class: "emoji" }, "🧑‍🍳"),
        el("div", { class: "name" }, "Line Cook Lv.3"),
        el("div", { class: "desc" }, "Fully trained! Holds perfect sears on up to 4 grills."));
    }
    return el("div", { class: "cards", style: "margin-top:6px" }, ...cards, helperCard);
  }

  private pricingTab(G: GameState): El {
    const opts = PRICE_LEVELS.map((p, i) => {
      const o = el("div", { class: `price-opt clickable ${G.priceLevel === i ? "active" : ""}` },
        el("div", { class: "pl" }, p.label),
        el("div", { class: "pd" }, `Price ${p.price.toFixed(2)}×`),
        el("div", { class: "pd" }, `Patience ${p.patience.toFixed(2)}×`),
        el("div", { class: "pd" }, `Crowd ${p.demand.toFixed(2)}×`));
      o.addEventListener("click", () => { G.priceLevel = i; recomputeDerived(G); this.ctx.sfx.ui(); this.onPhase(G); });
      return o;
    });
    return el("div", { class: "center" },
      el("p", { class: "small-muted" }, "Higher prices earn more per dish but shrink and impatient-ify your crowd. Vibe & reputation soften the hit."),
      el("div", { class: "pricing-row" }, ...opts));
  }

  private upgradeTab(G: GameState): El {
    if (!G.upgradeOffer.length) {
      return el("div", { class: "center small-muted", style: "padding:18px" }, "Upgrade chosen for today. Come back tomorrow!");
    }
    const cards = G.upgradeOffer.map((id) => {
      const u = upgradeDef(id)!;
      const owned = G.upgrades[id] ?? 0;
      const c = el("div", { class: "card pick" },
        el("div", { class: "emoji" }, u.icon),
        el("div", { class: "name" }, u.name),
        el("div", { class: "desc" }, u.desc),
        el("div", { class: "small-muted" }, `${owned}/${u.max}`));
      c.addEventListener("click", () => {
        if (applyUpgrade(G, id)) { this.ctx.sfx.coin(); G.upgradeOffer = []; this.onPhase(G); }
      });
      return c;
    });
    return el("div", { class: "center" },
      el("p", { class: "small-muted" }, "Pick ONE permanent upgrade for the run:"),
      el("div", { class: "cards" }, ...cards));
  }

  private renderBuild(G: GameState): void {
    this.overlay.className = "overlay transparent";
    const bar = el("div", { class: "build-bar" },
      el("b", {}, "🔧 Floor Plan"),
      el("span", { class: "keys" }, "Click ", el("b", {}, "place/pick"), " · ", el("b", {}, "R"), " rotate · ", el("b", {}, "X"), " sell · ", el("b", {}, "Esc"), " done"),
      btn("Done", "small", () => this.ctrl.exitBuild()));
    bar.style.pointerEvents = "auto";

    const palette = el("div", { class: "palette" });
    palette.style.pointerEvents = "auto";
    const entries = Object.entries(G.inventory).filter(([, n]) => n > 0);
    if (!entries.length) {
      palette.append(el("div", { class: "small-muted" }, "No items to place. Buy stations & decor in the Shop. You can still pick up & rearrange placed items by clicking them."));
    }
    for (const [id, n] of entries) {
      const d = def(id)!;
      const sw = el("div", { class: `swatch clickable ${G.build.brush === id ? "active" : ""}` },
        el("div", { class: "emoji" }, d.icon),
        el("div", {}, d.name.split(" ")[0]),
        el("div", { class: "qty" }, `×${n}`));
      sw.addEventListener("click", () => { setBrush(G, G.build.brush === id ? null : id); this.ctx.sfx.ui(); this.renderBuild(G); });
      palette.append(sw);
    }
    this.overlay.replaceChildren(bar, palette);
  }

  private renderEnd(G: GameState, won: boolean): void {
    const meta = loadMeta();
    this.overlay.append(
      el("h1", { class: "title-logo" }, won ? "KITCHEN LEGEND!" : "YOU'RE FIRED"),
      el("div", { class: "panel center" },
        el("div", { class: "subtitle" }, won ? "You survived all six dinner rushes." : `The boss expected $${G.quota} on day ${G.day}.`),
        el("div", { class: "stats-grid", style: "margin:14px auto; width:320px" },
          el("span", { class: "k" }, "Days cleared"), el("span", { class: "v" }, `${won ? G.day : G.day - 1}/${TOTAL_DAYS}`),
          el("span", { class: "k" }, "Final bank"), el("span", { class: "v" }, `$${G.coins}`),
          el("span", { class: "k" }, "Best combo"), el("span", { class: "v" }, `x${G.stats.bestCombo}`),
          el("span", { class: "k" }, "Reputation"), el("span", { class: "v" }, `★${Math.round(G.rep)}`),
          el("span", { class: "k" }, "All-time best day"), el("span", { class: "v" }, `${meta.bestDay}`)),
        btn("Play Again", "", () => this.ctrl.play())),
    );
    if (won) this.ctx.fx.confetti();
  }
}
