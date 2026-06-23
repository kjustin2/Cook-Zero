// Pure type declarations for Sizzle Rush (kid edition). No runtime, no imports —
// every system can depend on this file without creating an import cycle. The
// whole game is one mutable `GameState` (G) that plain-function systems read and
// write; render/audio are reached only through interfaces (see ctx.ts).

// ── Core enums ───────────────────────────────────────────────────────────────

export type Phase =
  | "title" // main menu
  | "cutscene" // a story cinematic is playing over the diner
  | "setup" // first-time studio: name + menu + looks + layout (after the tutorial)
  | "playing" // a cooking shift
  | "dayComplete" // celebration + stars
  | "manage" // between-day: rearrange, recolour, pick an upgrade
  | "treat" // (legacy) pick one of three upgrade "treats" — folded into manage
  | "win"; // final celebration

/** How well a cooked item turned out. Kid-forgiving: "good" is always fine. */
export type Quality = "good" | "perfect" | "crispy" | "burnt";

/** Every food a customer can order. */
export type FoodId = "burger" | "fries" | "drink" | "icecream" | "hotdog";

/** Which animal friend wanders the diner (chosen + recoloured at setup). */
export type PetKind = "corgi" | "cat" | "bunny";

/** Stable ids for the hand-placed stations in the diner. */
export type StationId =
  | "meat"
  | "grill"
  | "potato"
  | "fryer"
  | "soda"
  | "icecream"
  | "sausage"
  | "hotgrill"
  | "trash";

/** Station roles. A "source" hands out an ingredient; a "cook" transforms it. */
export type StationKind = "source" | "cook" | "instant" | "trash";

// ── The thing in the chef's hands (carry one item, or nothing) ───────────────

export type Carry =
  | null
  | { kind: "raw"; food: FoodId } // uncooked ingredient headed for a cook station
  | { kind: "ready"; food: FoodId; quality: Quality } // done, ready to serve
  | { kind: "burnt" }; // oops — toss it in the bin

// ── Data definitions (catalog.ts) ────────────────────────────────────────────

export interface FoodDef {
  id: FoodId;
  name: string;
  icon: string; // big emoji shown in order bubbles + HUD
  /** Station that dispenses the raw/ready item for this food. */
  source: StationId;
  /** Cook station this raw item goes onto, or null for instant foods. */
  cook: StationId | null;
  /** Day this food first appears on the menu. */
  minDay: number;
  /** Cute name for the raw ingredient ("a patty", "a potato"). */
  rawName: string;
  color: number; // base tint for the cooked food mesh
  rawColor: number; // tint while raw / cooking start
}

export interface StationDef {
  id: StationId;
  name: string;
  kind: StationKind;
  icon: string;
  color: number;
  gives?: FoodId; // source/instant: food dispensed here
  cooks?: FoodId[]; // cook: foods accepted here
  slots: number; // cook stations only
}

// ── Live instances (state.ts) ────────────────────────────────────────────────

export interface CookSlot {
  food: FoodId | null; // what's cooking, or null = empty
  t: number; // seconds since placed
  readyT: number; // becomes edible at this time
  goldenT: number; // start of the perfect window
  crispT: number; // past golden → "crispy" (still ok)
  burnT: number; // past this → burnt (rare; Infinity if it can't burn)
  pop: number; // placement squash-stretch timer
}

export interface Station {
  id: StationId;
  kind: StationKind;
  x: number;
  z: number;
  ry: number; // facing
  slots: CookSlot[]; // cook stations
}

export type CustomerState = "entering" | "seated" | "leaving";

export interface CustomerLook {
  body: number; // body color
  hair: number;
  hat: boolean;
  hue: number; // 0..1 used to stagger animation phase
}

export interface Customer {
  uid: number;
  order: FoodId;
  table: number; // index into G.tables
  x: number;
  z: number;
  state: CustomerState;
  patience: number; // seconds left before they give up
  maxPatience: number;
  served: boolean;
  servedT: number; // celebration timer after being served
  mood: number; // 0 sad .. 1 happy, eased toward patience ratio
  hop: number; // happy-hop timer
  look: CustomerLook;
}

export interface Table {
  x: number;
  z: number;
  seatX: number; // where the customer sits
  seatZ: number;
  occupied: number; // customer uid, or 0
}

// ── Pet (a corgi!) — wanders the diner; the chef can pet + feed it ───────────

export interface Pet {
  kind: PetKind;
  x: number;
  z: number;
  vx: number;
  vz: number;
  tx: number; // wander target
  tz: number;
  retargetT: number;
  happy: number; // 0..1
  wag: number; // animation phase
  followT: number; // follows the chef after being petted/fed
  hop: number; // happy hop timer
  barkT: number; // bark cooldown
}

// ── Garden — planters that grow over the run ─────────────────────────────────

export interface Plant {
  x: number;
  z: number;
  kind: number; // which flower (colour/shape)
  growth: number; // 0..1 within the current stage; whole = stage progress
  stage: number; // 0 seed .. 4 bloom
}

// ── Chef ─────────────────────────────────────────────────────────────────────

export interface Chef {
  x: number;
  z: number;
  facing: number; // radians
  vx: number;
  vz: number;
  carry: Carry;
  dashT: number; // remaining dash time
  dashCd: number; // dash cooldown
  cookT: number; // cook/serve arm-pump animation pulse
  cheer: number; // happy bounce after a serve
}

// ── Cutscenes (data-driven cinematic; see cutscene.ts + render/cineView) ─────

export type Vec3 = [number, number, number];
export interface Pose {
  pos: Vec3;
  look: Vec3;
}

/** One member of the cutscene cast, placed by data (interpreted by render). */
export interface CastPlacement {
  who: "pip" | "grandma" | "guest";
  x: number;
  y: number;
  z: number;
  ry?: number;
  color?: number;
  vz?: number; // per-shot stroll velocity
}

export interface Shot {
  dur: number;
  from: Pose;
  to?: Pose;
  fov?: number;
  focus?: Vec3; // depth-of-field rack target
  bokeh?: number; // blur strength
  handheld?: number; // 0 locked .. 1 normal camera life
  line?: { who: string; portrait: string; text: string; color?: string };
  title?: { text: string; sub?: string };
  fade?: "fromBlack" | "toBlack";
  flash?: boolean;
  shake?: number;
  sfx?: string;
}

export interface CineScene {
  shots: Shot[];
  cast?: CastPlacement[];
  warm?: boolean; // tint lights warm/golden for the scene
  music?: "story" | "win";
}

export interface CutsceneState {
  scene: CineScene;
  shotIndex: number;
  elapsed: number; // seconds into the current shot
  typed: number; // typewriter character count for the current line
  started: boolean; // has the current shot's onEnter fired yet
  guard: number; // input guard so the launching click doesn't skip
  label: string;
  onDone: () => void;
}

// ── Treats (between-day upgrades; upgrades.ts) ────────────────────────────────

export type TreatId =
  | "fast"
  | "reach"
  | "time"
  | "sparkle"
  | "helper"
  | "patient"
  | "quickcook"
  | "extracustomer"
  | "table" // a new dining table — more guests can sit at once
  | "decor"; // decorations — each happy guest is worth more score

export interface TreatDef {
  id: TreatId;
  name: string;
  icon: string;
  blurb: string;
}

// ── Derived knobs (recomputed from chosen treats) ────────────────────────────

export interface Derived {
  moveSpeed: number;
  reachMult: number;
  levelTime: number;
  cookSpeedMult: number;
  patienceMult: number;
  coinMult: number; // decorations make each happy guest worth more score
  sparkle: boolean; // every serve bursts extra confetti + keeps combo alive
  helper: boolean; // cook stations auto-hold at perfect (never burn)
}

// ── Restaurant customization (chosen at setup, tweaked between days) ──────────
// Every part of the diner can be recoloured. Defaults (customize.ts) reproduce
// the original look exactly, so a fresh config is a no-op visually.

export interface ChefLook {
  apron: number;
  accent: number; // scarf / ties / shoes
  skin: number;
  hat: number;
  hair: number;
}

export interface PetLook {
  kind: PetKind;
  body: number;
  belly: number; // belly / cream markings
  accent: number; // ears / collar / inner
}

export interface DinerPalette {
  wall: number;
  floorA: number; // checker tile A
  floorB: number; // checker tile B
  stripe: number; // accent stripe on the back wall
  window: number; // sky in the windows
}

export interface TableStyle {
  top: number;
  rim: number;
  leg: number; // post + foot
  chair: number;
}

export interface StationStyle {
  body: number; // equipment cabinet tint
  trim: number; // bezel / accent
}

/** One planter's chosen flower (type + bloom colour). */
export interface PlantStyle {
  kind: number; // flower shape/type
  bloom: number; // bloom colour
}

export interface RestaurantConfig {
  name: string;
  menu: FoodId[]; // which unlocked foods this diner serves
  tableCount: number; // how many tables are out (upgradeable)
  decorLevel: number; // decorations owned → score per guest
  chef: ChefLook;
  pet: PetLook;
  palette: DinerPalette;
  table: TableStyle;
  station: StationStyle;
  plants: PlantStyle[]; // per-planter
}

// ── The whole game state ─────────────────────────────────────────────────────

export interface DayCard {
  title: string;
  sub: string;
  t: number;
}

export interface GameState {
  phase: Phase;
  t: number; // global clock
  paused: boolean;

  day: number; // 1-based current day
  maxDay: number;

  chef: Chef;
  stations: Station[];
  tables: Table[];
  customers: Customer[];
  pet: Pet;
  plants: Plant[];

  // shift timing / goals
  dayTime: number; // seconds left in the shift
  dayLen: number; // shift length (for the bar)
  goal: number; // happy guests needed for 3 stars
  servedToday: number;
  happyToday: number; // served before they got too sad
  spawnTimer: number;
  spawnQueue: number; // guests still to arrive this shift
  spawnGap: number; // seconds between arrivals this shift
  nextUid: number;

  // score / feel
  coins: number; // friendly score number
  combo: number;
  comboT: number; // time left before the combo cools
  bestCombo: number;
  fire: number; // 0..1 "on a roll" glow

  // treats / upgrades
  treats: TreatId[]; // chosen so far
  treatChoices: TreatId[]; // the 3 currently offered
  derived: Derived;

  // the player's restaurant (name, menu, looks, colours, layout)
  config: RestaurantConfig;
  // content unlocked across all runs (food/pet/decor keys) — gates setup/manage
  unlocks: string[];

  // tutorial — a slow, guided first shift before the real game begins
  tutorial: boolean; // this shift is the guided tutorial (does not count)
  tutorialStep: number; // 0.. which guided step the kid is on
  tutorialServed: number; // serves completed during the tutorial
  newUnlocks: string[]; // content keys unlocked by the day just finished (toast)

  // story / flow
  cutscene: CutsceneState | null;
  dayCard: DayCard | null;
  stars: number; // stars earned on the most recent day

  // wayfinder (recomputed each frame): where to go + what to do next. Drives a
  // single 3D beacon (ring + bobbing icon) at the target.
  guide: { x: number; z: number; label: string; icon: string; active: boolean };
  // the immediate one-button action when standing next to something
  prompt: { label: string; icon: string } | null;
  // what the setup/manage live preview should frame while customizing: the
  // characters (chef + pet close-up) or the whole diner room.
  studioFocus: "chef" | "room";
  // which customizer category the studio opens on (lets debug scenarios + the UI
  // agree on the open section, e.g. "diner" for a room-focused cut).
  studioCat: string;

  // settings (persisted)
  muted: boolean;
  quality: "high" | "low";

  rngSeed: number;
}
