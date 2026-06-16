// Story beats + cutscene content. A light diner-rescue arc: a rookie chef
// inherits the failing "Sizzle Rush" diner and has six nights to prove it can
// pay its way. Beats play between shifts; "Night N" title cards open each shift.

import type { Beat } from "./types";

const CHEF = "#7CFF6b";
const SAL = "#ff8f6b";
const ROSA = "#9be7ff";

export const INTRO: Beat[] = [
  { speaker: "Sal", portrait: "🤵", color: SAL, text: "So YOU'RE the sucker who inherited this greasy little spoon. “Sizzle Rush.” *snrk* Cute name." },
  { speaker: "Sal", portrait: "🤵", color: SAL, text: "Here's the deal, kid: six nights. Hit each night's cash quota — or I bulldoze this place into a parking lot." },
  { speaker: "You", portrait: "🧑‍🍳", color: CHEF, text: "...Six nights. Watch me. I was BORN to flip patties." },
  { speaker: "Rosa", portrait: "👵", color: ROSA, text: "Ignore that old grump, sugar. 🧡 Grab your bits, cook 'em just right, and feed folks before they get cranky." },
  { speaker: "Rosa", portrait: "👵", color: ROSA, text: "Walk with WASD, do everything with SPACE, and SHIFT to dash when it gets hairy. Aprons on — let's COOK!" },
];

const DAY3: Beat[] = [
  { speaker: "Rosa", portrait: "👵", color: ROSA, text: "Psst! A big-shot food critic 📸 is sniffin' around tonight. Tips like a king... but one cold plate and your stars take a dive." },
  { speaker: "You", portrait: "🧑‍🍳", color: CHEF, text: "A critic, huh? Then every plate is a love letter. Let's make 'em weep happy tears. 🥲" },
];

const DAY5: Beat[] = [
  { speaker: "Sal", portrait: "🤵", color: SAL, text: "...Huh. Joint's actually PACKED. Don't get a big head, hotshot — the weekend rush eats rookies for breakfast." },
  { speaker: "Rosa", portrait: "👵", color: ROSA, text: "Look at you go, hon! 🥹 Tart up that kitchen, hire some hands, and surf this wave all the way home." },
];

export const WIN_STORY: Beat[] = [
  { speaker: "Sal", portrait: "🤵", color: SAL, text: "Six nights. Every. Single. Quota. I... I think I got somethin' in my eye." },
  { speaker: "Rosa", portrait: "👵", color: ROSA, text: "Aww, Sal's CRYING! 🥲 This kid turned your sad little spoon into the hottest table in town, you old softie." },
  { speaker: "You", portrait: "🧑‍🍳", color: CHEF, text: "Sizzle Rush is here to stay. 🔥 Now who's hungry? ORDER UP!" },
];

export const LOSE_STORY: Beat[] = [
  { speaker: "Sal", portrait: "🤵", color: SAL, text: "Quota's quota, kid. Hang up the apron. 🪦 Sizzle Rush is... closed." },
  { speaker: "Rosa", portrait: "👵", color: ROSA, text: "Chin up, sweetie. Every great chef burns a few. Come back and give 'em another sizzle. 🧡" },
];

/** Cutscene that plays at the start of a given day, or null. */
export function storyForDay(day: number): Beat[] | null {
  if (day === 1) return INTRO;
  if (day === 3) return DAY3;
  if (day === 5) return DAY5;
  return null;
}

export const DAY_THEMES = [
  "Opening Night",
  "Word Gets Around",
  "The Critic",
  "Regulars' Night",
  "Weekend Rush",
  "The Final Service",
];

const RANKS = ["Dishwasher", "Fry Cook", "Fry Cook", "Line Cook", "Sous Chef", "Head Chef", "Kitchen Legend"];

/** Career rank shown on the menu, earned from the best night ever reached. */
export function careerRank(bestDay: number): string {
  return RANKS[Math.max(0, Math.min(RANKS.length - 1, bestDay))];
}
