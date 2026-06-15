// Central type model. Pure type declarations — no runtime, no imports — so any
// module (game logic, render, ui, tests) can depend on it without cycles.

// ─── Ingredients, parts, food ────────────────────────────────────────────────

/** Raw items dispensed from bins. */
export type IngredientId =
  | "bun"
  | "patty_raw"
  | "potato"
  | "cheese"
  | "lettuce"
  | "tomato"
  | "cup";

/** Components that can sit on a plate. */
export type PartId =
  | "bun"
  | "patty"
  | "fries"
  | "cheese"
  | "lettuce"
  | "tomato"
  | "soda";

export type Quality = "perfect" | "good" | "overdone";

export interface PlatePart {
  id: PartId;
  quality: Quality;
}

/** What the chef's hands hold. Exactly one item at a time. */
export type Carry =
  | { kind: "ing"; id: IngredientId }
  | { kind: "part"; id: PartId; quality: Quality }
  | { kind: "plate"; parts: PlatePart[] }
  | { kind: "burnt" }
  | null;

// ─── Recipes ─────────────────────────────────────────────────────────────────

export interface Recipe {
  id: string;
  name: string;
  /** Multiset of parts required (order irrelevant; matched as a sorted key). */
  parts: PartId[];
  basePrice: number;
  /** Minimum day before this recipe can appear (also gated by shop unlock). */
  minDay: number;
  weight: number;
  /** Emoji shown in the order bubble / menus. */
  icon: string;
  /** Whether the recipe is unlocked for this run (shop purchase). */
  unlocked?: boolean;
}

// ─── Catalog (placeable stations + decor) ────────────────────────────────────

export type StationKind = "grill" | "fryer" | "prep" | "bin" | "drink" | "trash";
export type Category = "station" | "decor";

/** Bonus a decor item projects onto an ADJACENT functional station. */
export interface AdjBonus {
  to: StationKind[];
  cookSpeedMult?: number; // multiplies neighbour cook speed
  slots?: number; // +N slots on neighbour
}

/** Global pools every placed copy contributes to (scaled by front-of-house
 *  proximity for vibe-flavoured stats). */
export interface GlobalBonus {
  vibe?: number; // restaurant ambience points
  patienceMult?: number; // customers wait longer
  tipFlat?: number; // +coins per serve
  comboWindow?: number; // +seconds before combo decays
  moveSpeedMult?: number; // chef speed
  perfectWindow?: number; // +seconds on cook perfect windows
  repGainMult?: number; // reputation gained per good serve
}

export interface CatalogDef {
  id: string;
  name: string;
  category: Category;
  /** For stations: their function. */
  kind?: StationKind;
  /** For bins: which ingredient they dispense. */
  ingredient?: IngredientId;
  /** Cook/fry/drink stations: number of simultaneous slots. */
  slots?: number;
  /** Coins to buy from the shop. */
  cost: number;
  /** Does it block chef movement / other placement on its cell? */
  solid: boolean;
  /** Short description for shop + build tooltips. */
  desc: string;
  /** Adjacency projection (decor). */
  adj?: AdjBonus;
  /** Global pool contribution (decor, some stations). */
  global?: GlobalBonus;
  /** Tint used by procedural mesh + UI swatch (hex). */
  color: number;
  /** Emoji used in shop / palette. */
  icon: string;
}

// ─── Floor-plan grid ─────────────────────────────────────────────────────────

export interface CookSlot {
  /** Source ingredient currently cooking, or null if empty. */
  filling: IngredientId | null;
  t: number; // elapsed cook time
  cookT: number; // → ready
  perfT: number; // perfect window end
  burnT: number; // burnt threshold (Infinity for fryer)
  done: boolean;
}

export interface PlacedItem {
  uid: number;
  defId: string;
  col: number;
  row: number;
  rot: number; // 0..3 quarter turns (visual only)
  /** Cook stations: live slots. */
  slots?: CookSlot[];
  /** Prep counters: the plate currently being assembled on this counter. */
  plate?: PlatePart[];
  // Adjacency-derived effective values, recomputed by adjacency.ts:
  effCookSpeed: number; // multiplier vs base
  effSlots: number; // resolved slot count
}

export interface Cell {
  col: number;
  row: number;
  item: PlacedItem | null;
}

export interface Grid {
  cols: number;
  rows: number;
  cells: Cell[]; // row-major: cells[row * cols + col]
}

// ─── Customers ───────────────────────────────────────────────────────────────

export type CustomerState = "walkin" | "waiting" | "served" | "leaving";

/** normal · vip (big pay, impatient) · critic (huge reputation swing). */
export type CustomerKind = "normal" | "vip" | "critic";

export interface Customer {
  uid: number;
  recipe: Recipe;
  kind: CustomerKind;
  payMult: number; // coin payout multiplier for this guest
  repMult: number; // reputation swing multiplier (serve + walkout)
  spot: number; // counter slot index
  x: number; // world position
  z: number;
  state: CustomerState;
  patience: number; // remaining seconds (counts down only while waiting)
  maxPatience: number;
  anger: number; // 0..1 visual fume
  servedT: number; // time spent in served animation
  happy: boolean; // served (true) vs stormed off (false)
  look: CustomerLook;
  bob: number; // animation phase
}

export interface CustomerLook {
  skin: number;
  shirt: number;
  hair: number;
  hat: boolean;
}

// ─── Helper (sous-chef) ──────────────────────────────────────────────────────

export interface Helper {
  hired: boolean;
  level: number; // 1..3 — faster reactions / wider reach
  wage: number; // deducted at day end
  x: number;
  z: number;
  targetUid: number | null; // station slot it's heading to tend
  cooldown: number;
}

// ─── Derived (recomputed) global modifiers ───────────────────────────────────

export interface Mods {
  // Base run mods (mutated by upgrades).
  moveSpeed: number;
  cookSpeed: number;
  patience: number;
  perfectWindow: number;
  tip: number;
  comboWindow: number;
  repGain: number;
}

/** Fully-resolved knobs the sim reads each frame: base mods × decor × pricing ×
 *  reputation. Recomputed by adjacency.ts whenever layout/pricing/rep change. */
export interface Derived {
  moveSpeed: number;
  patience: number; // multiplier
  perfectWindow: number; // +seconds
  tip: number; // +coins flat
  comboWindow: number; // seconds
  repGainMult: number;
  vibe: number; // 0..100-ish ambience score
  spawnMult: number; // customer arrival rate multiplier
}

// ─── Top-level game state ────────────────────────────────────────────────────

export type Phase =
  | "title"
  | "cutscene"
  | "playing"
  | "dayEnd"
  | "manage"
  | "build"
  | "gameOver"
  | "win";

/** One line of dialogue in a cutscene. */
export interface Beat {
  speaker: string;
  portrait: string; // emoji
  text: string;
  color?: string; // name-plate accent
}

export interface Cutscene {
  beats: Beat[];
  index: number;
  typed: number; // typewriter progress (chars, fractional)
  onDone: () => void;
  label: string; // e.g. "Night 1"
}

/** Brief "Night N — theme" title card shown at the start of a shift. */
export interface DayCard {
  title: string;
  sub: string;
  t: number;
}

export interface Chef {
  x: number;
  z: number;
  vx: number;
  vz: number;
  face: number; // heading angle (radians)
  walk: number; // gait phase
  interactCD: number; // debounce on the interact key
  fire: number; // 0..1 on-fire glow (combo)
  dashT: number; // remaining dash time (>0 = dashing)
  dashCD: number; // dash cooldown remaining
  dashX: number; // locked dash direction
  dashZ: number;
}

/** A one-day twist (Happy Hour, Dinner Rush, …). Data in game/modifiers.ts. */
export interface DayModifier {
  id: string;
  name: string;
  desc: string;
  icon: string;
  patienceMult?: number;
  spawnMult?: number;
  tipAdd?: number;
  tipMult?: number;
  perfectMult?: number;
  payMult?: number;
  vipBoost?: number; // extra VIP spawn chance
}

export interface RunStats {
  served: number;
  perfect: number;
  expired: number;
  trashed: number;
  bestCombo: number;
}

export interface FloatText {
  text: string;
  x: number;
  z: number;
  t: number;
  life: number;
  color: string;
  big: boolean;
}

export interface GameState {
  phase: Phase;
  prevPhase: Phase;
  t: number; // total elapsed
  paused: boolean;
  seed: number;

  day: number; // 1..TOTAL_DAYS
  dayTime: number; // seconds remaining in the shift
  quota: number;
  coins: number; // bank (persists across days in a run)
  dayCoins: number; // earned this shift (vs quota)
  lastDayPassed: boolean;
  modifier: DayModifier | null; // today's twist
  dayStars: number; // 0..3 rating for the last completed day

  rep: number; // reputation 0..100
  priceLevel: number; // 0..N index into PRICE_LEVELS
  combo: number;
  comboTimer: number;

  mods: Mods;
  derived: Derived;
  upgrades: Record<string, number>; // upgrade id → stacks owned

  grid: Grid;
  /** Owned-but-unplaced items available in build mode (counts by defId). */
  inventory: Record<string, number>;
  recipes: Recipe[]; // run's recipe pool (unlocked flags vary)
  helper: Helper;

  chef: Chef;
  customers: Customer[];
  carry: Carry;
  spawnTimer: number;

  stats: RunStats;
  dayStats: { served: number; perfect: number; expired: number }; // reset each shift
  floats: FloatText[];

  // UI scratch
  hint: string; // current SPACE action label
  build: BuildState;
  manageTab: "shop" | "pricing" | "upgrades" | "build";
  shopOffer: string[]; // catalog ids offered this visit
  upgradeOffer: string[]; // upgrade ids offered this visit
  toast: { text: string; t: number } | null;
  cutscene: Cutscene | null;
  dayCard: DayCard | null;
  muted: boolean;
}

export interface BuildState {
  active: boolean;
  /** defId being placed from the palette, or null when moving/idle. */
  brush: string | null;
  cursorCol: number;
  cursorRow: number;
  rot: number;
  /** uid of a placed item picked up for moving. */
  movingUid: number | null;
  /** The lifted item while moving (off-grid until dropped). */
  movingItem?: PlacedItem | null;
}
