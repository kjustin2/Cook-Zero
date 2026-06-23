// The story: a warm little tale where Pip helps Grandma's cosy diner become the
// happiest place in town. Cutscenes are CineScenes — timed camera shots that
// dolly through the real diner with big emoji-portrait dialogue. Everything is
// gentle and encouraging; a pre-reader can follow it by pictures and voice.

import type { CastPlacement, CineScene } from "./types";

const PIP = "#7CFF8a"; // Pip's name colour (mint)
const GRAN = "#ff9ec7"; // Grandma's name colour (pink)
const PIP_FACE = "🧑‍🍳";
const GRAN_FACE = "👵";

/** A little crowd of happy guests to dress a scene. */
function guests(...spots: Array<[number, number]>): CastPlacement[] {
  return spots.map(([x, z]) => ({ who: "guest" as const, x, y: 0, z, ry: 0 }));
}

const CAST_INTRO: CastPlacement[] = [
  { who: "grandma", x: -1.8, y: 0, z: -1.0, ry: 0.1 },
  { who: "pip", x: 1.4, y: 0, z: -0.6, ry: -0.1 },
  ...guests([6.5, 1.85], [-6.5, 1.85]),
];

/** Opening cinematic — meet Pip, Grandma and the diner. */
export function introScene(): CineScene {
  return {
    warm: true,
    music: "story",
    cast: CAST_INTRO,
    shots: [
      {
        dur: 4.6,
        from: { pos: [0, 13, 18], look: [0, 1.2, -3] },
        to: { pos: [0, 9.5, 12], look: [0, 1.2, -4.5] },
        fov: 50, focus: [0, 1.2, -3], bokeh: 1.6,
        fade: "fromBlack",
        title: { text: "SIZZLE RUSH", sub: "Pip's Big Day" },
      },
      {
        dur: 4.4,
        from: { pos: [-4, 2.7, 3.2], look: [-1.8, 1.5, -0.8] },
        to: { pos: [-2.4, 2.5, 2.6], look: [-1.8, 1.5, -0.9] },
        fov: 40, focus: [-1.8, 1.5, -0.9], bokeh: 2.2, handheld: 1,
        line: { who: "Grandma", portrait: GRAN_FACE, color: GRAN, text: "Oh, Pip! You came to help my little diner! 🥰" },
        sfx: "ding",
      },
      {
        dur: 3.8,
        from: { pos: [3, 2.5, 2.6], look: [1.4, 1.5, -0.6] },
        fov: 40, focus: [1.4, 1.5, -0.6], bokeh: 2.2, handheld: 1,
        line: { who: "Pip", portrait: PIP_FACE, color: PIP, text: "I'm ready, Grandma! Let's cook! 🍔" },
        sfx: "yay",
      },
      {
        dur: 5.0,
        from: { pos: [0, 6, 6.5], look: [0, 1.6, -7] },
        to: { pos: [0, 4.6, 3.5], look: [0, 1.5, -8] },
        fov: 52, focus: [0, 1.5, -8], bokeh: 1.4,
        line: { who: "Grandma", portrait: GRAN_FACE, color: GRAN, text: "Grab the food, cook it 'til it's golden, and carry it to our hungry friends!" },
      },
      {
        dur: 5.0,
        from: { pos: [4.6, 2.5, 4.2], look: [6.4, 1.4, 1.4] },
        to: { pos: [4.0, 2.4, 3.6], look: [6.4, 1.4, 1.4] },
        fov: 42, focus: [6.4, 1.4, 1.4], bokeh: 2.0, handheld: 1,
        line: { who: "Grandma", portrait: GRAN_FACE, color: GRAN, text: "Just follow the sparkly arrow! Walk with the ARROW KEYS, and do everything with the SPACE bar. Have fun, sweetie! 💛" },
      },
    ],
  };
}

/** A clear, celebratory "the tutorial is over!" beat before the setup studio,
 *  so it's unmistakable that the lesson ended and the real game is beginning. */
export function tutorialDoneScene(): CineScene {
  return {
    warm: true,
    music: "story",
    cast: [
      { who: "grandma", x: -1.6, y: 0, z: -0.8, ry: 0.1 },
      { who: "pip", x: 1.3, y: 0, z: -0.6, ry: -0.1 },
      ...guests([6.5, 1.85], [-6.5, 1.85]),
    ],
    shots: [
      {
        dur: 4.2,
        from: { pos: [0, 8, 11], look: [0, 1.3, -3] },
        to: { pos: [0, 6, 7.5], look: [0, 1.3, -4] },
        fov: 52, focus: [0, 1.3, -3], bokeh: 1.2, fade: "fromBlack",
        title: { text: "Tutorial Complete! 🎉", sub: "Now build YOUR diner!" },
        sfx: "fanfare",
      },
      {
        dur: 4.4,
        from: { pos: [-3.4, 2.5, 2.8], look: [-1.6, 1.5, -0.7] },
        fov: 42, focus: [-1.6, 1.5, -0.7], bokeh: 2.0, handheld: 1,
        line: { who: "Grandma", portrait: GRAN_FACE, color: GRAN, text: "You're a natural, Pip! Now let's make this diner truly OURS. 💛" },
        sfx: "ding",
      },
    ],
  };
}

/** Short mid-run beats. Returns a scene to play before that day, or null. */
export function storyForDay(day: number): CineScene | null {
  if (day === 3) {
    return {
      warm: true, music: "story",
      cast: [
        { who: "grandma", x: -1.4, y: 0, z: -0.8, ry: 0.1 },
        { who: "pip", x: 1.2, y: 0, z: -0.6 },
        ...guests([6.5, 1.85], [0, 1.85], [-6.5, 1.85], [6.5, -2.75], [-6.5, -2.75]),
      ],
      shots: [
        {
          dur: 4.4,
          from: { pos: [0, 8, 10], look: [0, 1.3, -4] },
          to: { pos: [0, 6, 7], look: [0, 1.3, -5] },
          fov: 52, focus: [0, 1.3, -4], bokeh: 1.4, fade: "fromBlack",
          title: { text: "Day 3", sub: "The Lunch Bunch" },
        },
        {
          dur: 4.6,
          from: { pos: [-3.5, 2.5, 2.8], look: [-1.4, 1.5, -0.7] },
          fov: 42, focus: [-1.4, 1.5, -0.7], bokeh: 2.0, handheld: 1,
          line: { who: "Grandma", portrait: GRAN_FACE, color: GRAN, text: "Word's getting around, Pip — the whole town wants your cooking! 🎉" },
          sfx: "ding",
        },
        {
          dur: 3.8,
          from: { pos: [2.8, 2.4, 2.6], look: [1.2, 1.5, -0.6] },
          fov: 42, focus: [1.2, 1.5, -0.6], bokeh: 2.0,
          line: { who: "Pip", portrait: PIP_FACE, color: PIP, text: "More friends to feed? Yummy! Let's go! 🍟" },
          sfx: "yay",
        },
      ],
    };
  }
  if (day === 5) {
    return {
      warm: true, music: "story",
      cast: [
        { who: "grandma", x: -1.4, y: 0, z: -0.8 },
        { who: "pip", x: 1.2, y: 0, z: -0.6 },
        ...guests([6.5, 1.85], [0, 1.85], [-6.5, 1.85]),
      ],
      shots: [
        {
          dur: 4.4,
          from: { pos: [0, 9, 11], look: [0, 1.3, -4] },
          to: { pos: [0, 6.5, 7.5], look: [0, 1.3, -5] },
          fov: 50, focus: [0, 1.3, -4], bokeh: 1.4, fade: "fromBlack",
          title: { text: "Day 5", sub: "The Big Day" },
        },
        {
          dur: 4.8,
          from: { pos: [-3.4, 2.5, 2.8], look: [-1.4, 1.5, -0.7] },
          fov: 42, focus: [-1.4, 1.5, -0.7], bokeh: 2.0, handheld: 1,
          line: { who: "Grandma", portrait: GRAN_FACE, color: GRAN, text: "This is the biggest day ever, Pip. I'm so proud of you already. 🥲" },
          sfx: "ding",
        },
        {
          dur: 3.8,
          from: { pos: [2.8, 2.4, 2.6], look: [1.2, 1.5, -0.6] },
          fov: 42, focus: [1.2, 1.5, -0.6], bokeh: 2.0,
          line: { who: "Pip", portrait: PIP_FACE, color: PIP, text: "One more sizzle, Grandma. Let's make everybody smile! ⭐" },
          sfx: "yay",
        },
      ],
    };
  }
  return null;
}

/** The triumphant finale. */
export function winScene(): CineScene {
  return {
    warm: true,
    music: "win",
    cast: [
      { who: "grandma", x: -1.6, y: 0, z: -0.8 },
      { who: "pip", x: 1.3, y: 0, z: -0.6 },
      ...guests([6.5, 1.85], [0, 1.85], [-6.5, 1.85], [6.5, -2.75], [0, -2.75], [-6.5, -2.75]),
    ],
    shots: [
      {
        dur: 4.6,
        from: { pos: [0, 8, 11], look: [0, 1.3, -3] },
        to: { pos: [0, 5.5, 7], look: [0, 1.3, -4] },
        fov: 52, focus: [0, 1.3, -3], bokeh: 1.4, fade: "fromBlack",
        title: { text: "YOU DID IT! 🎉", sub: "The happiest diner in town" },
        sfx: "fanfare",
      },
      {
        dur: 4.6,
        from: { pos: [-3.4, 2.5, 2.8], look: [-1.6, 1.5, -0.7] },
        fov: 42, focus: [-1.6, 1.5, -0.7], bokeh: 2.0, handheld: 1,
        line: { who: "Grandma", portrait: GRAN_FACE, color: GRAN, text: "You did it, Pip! Everyone's so happy. You're a real chef now! 💛" },
        sfx: "ding",
      },
      {
        dur: 4.8,
        from: { pos: [2.8, 2.4, 2.6], look: [1.3, 1.5, -0.6] },
        to: { pos: [2.4, 2.6, 2.4], look: [1.3, 1.6, -0.6] },
        fov: 42, focus: [1.3, 1.5, -0.6], bokeh: 2.0,
        line: { who: "Pip", portrait: PIP_FACE, color: PIP, text: "Best. Day. Ever! Who's hungry?! 🍔🍟🍦" },
        sfx: "yay",
      },
    ],
  };
}

export const DAY_THEMES = [
  "Opening Day",
  "Word Gets Around",
  "The Lunch Bunch",
  "Birthday Party!",
  "The Big Day",
];

const RANKS = ["New Helper", "Junior Cook", "Cook", "Star Cook", "Head Chef", "Diner Hero"];

/** A friendly career rank shown on the menu, from the best day reached. */
export const chefRank = (bestDay: number): string =>
  RANKS[Math.max(0, Math.min(RANKS.length - 1, bestDay))];
