// Story beats + cutscene content. A light diner-rescue arc: a rookie chef
// inherits the failing "Sizzle Rush" diner and has six nights to prove it can
// pay its way. Beats play between shifts; "Night N" title cards open each shift.

import type { Beat } from "./types";

const CHEF = "#7CFF6b";
const SAL = "#ff8f6b";
const ROSA = "#9be7ff";

export const INTRO: Beat[] = [
  { speaker: "Sal", portrait: "🤵", color: SAL, text: "So you're the one who inherited this greasy little diner. “Sizzle Rush.” Hah." },
  { speaker: "Sal", portrait: "🤵", color: SAL, text: "Here's the deal, kid: six nights. Hit each night's cash quota, or I shut you down for good." },
  { speaker: "You", portrait: "🧑‍🍳", color: CHEF, text: "Six nights... I can do this. I just need to cook." },
  { speaker: "Rosa", portrait: "👵", color: ROSA, text: "Don't mind Sal, sweetie. Grab ingredients, cook 'em just right, and serve folks before they lose patience." },
  { speaker: "Rosa", portrait: "👵", color: ROSA, text: "Move with WASD, do everything with SPACE, and dash with SHIFT when it gets busy. Now — let's open up!" },
];

const DAY3: Beat[] = [
  { speaker: "Rosa", portrait: "👵", color: ROSA, text: "Word is a famous food critic is dropping by tonight. They tip big — but one slow plate and your reputation tanks." },
  { speaker: "You", portrait: "🧑‍🍳", color: CHEF, text: "A critic? Then every dish has to be perfect. Let's give them a show." },
];

const DAY5: Beat[] = [
  { speaker: "Sal", portrait: "🤵", color: SAL, text: "...Huh. Place is actually packed. Don't let it go to your head — the weekend rush is brutal." },
  { speaker: "Rosa", portrait: "👵", color: ROSA, text: "Look how far you've come, hon! Decorate that kitchen, hire some help, and ride the wave." },
];

export const WIN_STORY: Beat[] = [
  { speaker: "Sal", portrait: "🤵", color: SAL, text: "Six nights. Every quota. I... I don't believe it." },
  { speaker: "Rosa", portrait: "👵", color: ROSA, text: "Believe it, Sal! This kid turned your sad little diner into the hottest spot in town." },
  { speaker: "You", portrait: "🧑‍🍳", color: CHEF, text: "Sizzle Rush is here to stay. Order up!" },
];

export const LOSE_STORY: Beat[] = [
  { speaker: "Sal", portrait: "🤵", color: SAL, text: "Quota's quota, kid. Hang up the apron — Sizzle Rush is closed." },
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
