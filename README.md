# Sizzle Rush 3D

A real-time **3D arcade kitchen roguelite** built with Three.js. You directly
control a chef inside a restaurant — grab ingredients, cook on the grill & fryer,
plate dishes, and serve customers across the counter before their patience runs
out. Survive six escalating dinner rushes, each with a cash quota.

The twist: between shifts you **rebuild and decorate your kitchen** on a tile
floor plan, and **placement matters** — a fan next to the grill speeds cooking,
plants up front calm your guests, neon draws a bigger crowd. You also **run the
business**: set menu prices, grow your reputation, and hire a line cook.

A light **story** frames it — a rookie chef inherits the failing "Sizzle Rush"
diner with six nights to prove it can pay its way. It's told in skippable
cutscenes (intro, mid-run beats, and a win/lose ending), with a "Night N" title
card opening each shift and a career rank on the menu.

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

## Controls

- **WASD / arrows** — move the chef
- **Space** — context interact (grab, cook, plate, serve) — the on-screen hint
  shows what Space will do
- **Shift** — dash (short burst, ~1s cooldown)
- **P** / **Esc** — pause menu (Resume, Restart, settings, Quit to Title)
- In the **Floor Plan** (build mode): click to place/pick up, **R** rotate,
  **X** sell, **Esc** done

## Gameplay loop

1. **Cook & serve** during a 120s shift. Pull patties in the golden window for a
   *Perfect* sear; chain serves for a combo multiplier; go *On Fire* at combo 5.
   Watch for **VIPs** (👑 big pay, impatient) and **critics** (📸 huge reputation
   swing), and a random **daily modifier** (Happy Hour, Dinner Rush, Foodie
   Night…). Each shift is scored **1–3 stars**.
2. **Hit the quota** to keep your job. Miss it and you're fired.
3. **Manage** between shifts: shop for stations & decor, pick a roguelite
   upgrade, set your **pricing** (price vs. patience vs. crowd size), and hire /
   upgrade a **line cook** who tends your grills.
4. **Decorate** your floor plan. The live *Kitchen Effects* panel shows exactly
   how your layout changes cook speed, patience, tips, combo window, reputation
   gain and crowd size.

## Tech

- **Three.js r170** + `postprocessing` (bloom, vignette, SMAA) — all art is
  procedural (zero asset files). A **Graphics: High/Low** menu toggle scales
  shadows, antialiasing and pixel ratio for weaker GPUs.
- **Vite 6 + strict TypeScript**, ES modules. **Electron** desktop wrapper.
- Plain-function game systems sharing a central `G` state object via a `Ctx`
  hub; render & audio are reached only through interfaces, so the logic runs
  headless.

## Tests

Headless-Chromium smoke tests (Playwright) that drive the real game through a
`window.__SR` test surface:

```bash
npm test           # boots a dev server, runs every scripts/smoke-*.mjs
npm run typecheck  # tsc --noEmit (strict)
npm run build      # typecheck + production bundle
```

Suites: boot, adjacency/decoration effects, business/economy, the cook→serve
pipeline, and the full phase machine (day → manage → build → next day → win/lose).
