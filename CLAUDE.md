# CLAUDE.md

Guidance for Claude Code when working with the Sizzle Rush codebase.

## How to Run

No build step. Serve the project root with any static server:

```bash
python -m http.server 8000
# open http://localhost:8000
```

Or as a desktop app: `npm install && npm start` (Electron).

## Syntax Check

```bash
node check-syntax.js
```

Run after any edits. All `src/*.js` files must pass (0 errors). The package is
`"type": "module"` — all src files are ESM; the Electron entry is `electron/main.cjs` (CommonJS).

---

## What the game is

A real-time arcade kitchen roguelite. The player directly controls a chef (WASD + Space) inside a
restaurant: customers walk in the entry door, queue at the front service counter with order
bubbles, and the player grabs ingredients from bins, cooks on grill/fryer stations, assembles
plates on prep counters, and serves the finished plate to the matching customer across the
counter. Runs are 5 shifts of 120s each with a cash quota; between shifts the player picks 1 of 3
roguelite upgrades.

**State machine (in `src/main.js`):**
```
title → playing → shiftEnd → upgrade → playing… → win (shift 5 cleared)
                           → gameOver (quota missed)
```

## Architecture

All modules are plain-function ESM sharing one central `G` game-state object created in `main.js`
and passed into every system. No classes, no event bus.

| File | Role |
|---|---|
| `src/main.js` | Boot, letterboxed canvas scaling, state machine, main rAF loop, menus/buttons input |
| `src/world.js` | Layout zones + `computeLayout`, player movement, grill/fryer timers, context-sensitive interact (`actionFor`) |
| `src/orders.js` | `RECIPES`, customer lifecycle (walkin → waiting → served/leaving), patience/expiry, plate matching, scoring + combo (`serveCustomer`) |
| `src/upgrades.js` | `UPGRADES` defs (mutate `G.mods`), `rollUpgrades` |
| `src/render.js` | ALL drawing (kitchen, HUD, tickets, menu screens). Reads `G`, writes only `G.ui.buttons` |
| `src/fx.js` | Particles, floating text, screen shake (singleton `fx`) |
| `src/audio.js` | WebAudio synth SFX + procedural music; intensity follows combo (singleton `audio`) |
| `src/input.js` | Keyboard `held`/`pressed` + mouse in logical canvas coords (singleton `input`) |

## Key conventions

- **Logical canvas is 1280×720** (`W`, `H` in world.js); main.js letterboxes to the window.
  Always use `G.layout.*` for positions — layout is recomputed each shift (upgrades add slots).
- **Vertical zones** (`ZONES` in world.js): HUD bar → back wall (windows/door/neon) → dining floor
  where customers queue → front service counter → kitchen. The player roams the kitchen; customers
  occupy the dining strip at `SPOT_Y` (orders.js) and are served across the counter.
- **Customers** (`G.customers`): `{ recipe, spot, x, y, state, patience, look, … }` with states
  `walkin → waiting → served|leaving`. Only `waiting` customers are matchable/servable. A customer
  IS the order — there is no separate ticket list.
- **`G.mods`** holds all upgrade-tunable knobs: `moveSpeed, cookSpeed, patience, perfectWindow,
  tip, comboWindow, grillSlots, fryerSlots, counters`. Reset per run in `defaultMods()`.
- **Carry model** (`G.carry`): `{kind:'ing', id}` raw ingredient · `{kind:'part', id, quality?}`
  cooked component · `{kind:'plate', parts[], perfects}` · `{kind:'burnt'}`. Plate↔ticket matching
  is a sorted-multiset compare (`plateKey`).
- **Grill timing** per slot, set at placement: cooking `[0,cookT)` → perfect window
  `[cookT,perfT)` → overdone `[perfT,burnT)` → burnt. Fryer never burns.
- **Interactions** live in `actionFor()` in world.js — it returns `{label, fn}` for the nearest
  interactable; the label doubles as the on-screen SPACE hint.
- Menu clicks: render.js pushes hit-rects into `G.ui.buttons` each frame; main.js hit-tests on
  click and dispatches via `handleAction(id)`. `G.ui.primary` is what Enter triggers.
- `window.__G` is exposed for headless smoke-testing (drive states/positions from a test page).

## Persistence

localStorage key `sizzle_rush_save`: `{ bestShift, bestCoins, bestCombo, runs }` — meta best-stats
only; runs are not resumable.

## Balance knobs

- Quotas per shift: `QUOTAS` in main.js. Shift length: `SHIFT_LEN` (120s), `TOTAL_SHIFTS` (5).
- Spawn pacing + patience scaling per shift: `spawnInterval()` / `basePatience()` in orders.js.
  Patience only counts down once a customer reaches their counter spot (`waiting`).
- Combo: `comboMult()` = 1 + 0.25·(combo−1), capped at 3×; decays after `G.mods.comboWindow` (12s)
  without a serve; resets when a customer walks. ON FIRE state at combo ≥ 5.
- Cook timings: `BASE_COOK`, `BASE_PERFECT`, `BURN_EXTRA`, `FRY_T` in world.js.
