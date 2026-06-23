# Sizzle Rush 🍔

A cute, **kid-simple 3D cooking game** built with Three.js. You are **Pip**, a
tiny chef helping out at **Grandma's Diner**. Friends walk in, sit down, and show
you a big picture of what they want. Grab it, cook it until it glows, and carry it
over — that's it! Bright, warm, bouncy, and **so simple a young kid can play and
have fun.**

There's **no losing** and nothing to read: a sparkly arrow always shows you what
to do next, and a happy story plays in lovely little cutscenes.

## Run it

No global tooling needed (Node 18+).

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5179
```

Desktop app (Electron, serves the production build over loopback):

```bash
npm start          # = vite build + electron .
```

## How to play

- **Arrow keys** or **WASD** — walk around
- **SPACE** (or Enter) — do everything: grab, cook, and serve. The big on-screen
  button always tells you what it will do.
- **Shift** — a little "zoom!" dash
- **Esc** / **P** — pause

Follow the **sparkly arrow** to the next thing. Grab the food at its box, cook it
on the grill/fryer until it **glows golden** (that's a Perfect!), then carry it to
the hungry friend. Drinks and ice cream are ready to go — no cooking needed!

## The loop

1. **Cook & serve** happy friends. Serve quickly and perfectly for extra confetti,
   coins and a celebratory streak. Each day you earn **1–3 stars**.
2. **Never lose.** If a friend waits too long they just leave a little sad — no
   penalty. Burning your food is nearly impossible (and a treat removes it
   entirely).
3. **Pick a treat** between days — one of three big shiny upgrades (faster shoes,
   stretchy arms, a helper pal, sparkle power…). Just tap the one you like!
4. **5 cosy days** of new foods and friends, with cutscenes and a triumphant
   finale where Pip becomes a real chef. 🎉

## Tech

- **Three.js r170** + `postprocessing` (bloom, vignette, SMAA) — all art is
  procedural (zero asset files). A **High/Low** quality toggle scales shadows,
  antialiasing and pixel ratio for weaker / school hardware.
- **Vite 6 + strict TypeScript**, ES modules. **Electron** desktop wrapper.
- Plain-function game systems share a central `G` state object via a `Ctx` hub;
  render & audio are reached only through interfaces, so the logic runs headless.
- **Cinematic cutscenes** dolly the real camera through the diner with letterbox,
  a title card and big emoji-portrait dialogue (a data-driven `Shot`/`CineScene`
  director). A **wayfinder** points a glowing beacon at the next step from real
  game state, so the goal and the arrow can never disagree.

## Tests

Headless-Chromium smoke tests (Playwright) that drive the real game through a
`window.__SR` test surface:

```bash
npm test           # boots a dev server, runs every scripts/smoke-*.mjs
npm run typecheck  # tsc --noEmit (strict)
npm run build      # typecheck + production bundle
```

Suites: boot, the cook→serve loop, instant foods + trash, the wayfinder's
next-step targeting, guest arrival/patience, day flow → stars → treats → win, the
intro cinematic, a perf budget, and real-DOM playthrough + soak.
