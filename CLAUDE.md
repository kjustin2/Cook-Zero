# CLAUDE.md

Guidance for Claude Code when working with the **Sizzle Rush 3D** codebase.

## How to Run

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5179
npm start            # build + launch the Electron desktop app
```

## Verify after edits

```bash
npm run typecheck    # tsc --noEmit (STRICT: noUnusedLocals/Parameters on)
npm run build        # typecheck + vite build
npm test             # Playwright headless smoke suite (boots its own dev server)
```

All three must stay green. Strict TS is unforgiving — every local and parameter
must be used (prefix intentionally-unused params with `_`).

---

## What the game is

A real-time **3D** arcade kitchen roguelite (Three.js). The player controls a
chef (WASD + Space) inside a restaurant: customers walk in, queue at the counter
with orders, and the chef grabs ingredients from bins, cooks on grill/fryer/soda
stations, assembles plates on prep counters, and serves across the counter. Runs
are **6 shifts** of 120s with a cash quota. Between shifts the player shops,
picks an upgrade, sets pricing, and **rearranges/decorates the kitchen** on a
tile grid where **placement & adjacency drive gameplay bonuses**.

**Phase machine (`src/main.ts`):**
```
title → cutscene(intro) → playing → dayEnd → manage ⇄ build → [cutscene] → playing …
        → cutscene(ending) → win (day 6 cleared)
        → cutscene(closed) → gameOver (quota missed)
```
A light diner-rescue story plays in cutscenes (`game/story.ts` data, `game/cutscene.ts`
controller): an intro on New Game, beats before nights 3 & 5, and a win/lose ending. A
"Night N — theme" title card (`G.dayCard`) opens each shift. The menu shows a career
**rank** derived from `meta.bestDay` (`careerRank`).

## Architecture

Strict-TS ESM, Vite-bundled, Electron-wrapped. Plain-function game systems share
one central `G` (`GameState`) created in `state.ts`. Render + audio are reached
only through the `Fx`/`Sfx`/`Music` interfaces on the `Ctx` hub, so game logic
never imports Three.js and runs headless in tests.

| Area | Files | Role |
|---|---|---|
| Core | `core/{math,rng,input,save}.ts` | helpers, seeded RNG, input, localStorage best-stats |
| State | `game/{types,balance,state,ctx}.ts` | type model, tunables, `G` factory + starting layout, system hub |
| Data | `game/catalog.ts` | `RECIPES`, `CATALOG` (stations + decor with adjacency/global bonuses), cook rules |
| Grid | `game/grid.ts` | tile model, cell↔world coords, front-of-house weighting |
| Adjacency | `game/adjacency.ts` | recomputes per-station cook bonuses + global `derived` knobs |
| Sim | `game/{cooking,interact,chef,customers,serving,helper,sim}.ts` | the playing-state systems (chef.ts also holds `startDash`) |
| Meta | `game/{upgrades,shop,placement,flow,modifiers,story,cutscene}.ts` | upgrades, shop, build mode, day transitions, modifiers, story content, cutscene controller |
| Render | `render/{stage,sceneView,kit,fx}.ts` + `render/{food,stations,decor,actors}.ts` | Three.js renderer/post (IBL env map + time-of-day), scene sync, FX, procedural meshes |
| Audio | `audio/{sfx,music}.ts` | procedural WebAudio SFX + music (intensity follows combo) |
| UI | `ui/ui.ts`, `style.css` | DOM HUD + every overlay screen + full-screen FX layers |

**Look & feel:** DOM/CSS over the live 3D canvas, modeled on Rogue-Hero-3's system.
Two self-hosted fonts (`@fontsource`): **Baloo 2** (`--font-display`, all titles/
headings/values) + **Nunito** (`--font-ui`, body/buttons). One warm token set + a
single accent; glows via `color-mix`. One container recipe (glass + hairline +
accent top-border + soft lift); every overlay fades in (`screen-fade`/`rise-in`),
cards deal in staggered. UI adds full-screen feedback layers (`.fx-vignette`,
`.fx-lowtime` red pulse, `.fx-fire` combo glow, `.fx-flash` serve flash) and a
combo HUD bump — re-triggered via the `void el.offsetWidth` reflow trick.

## Key conventions

- **The floor plan is the kitchen.** Stations + decor occupy a `GRID_COLS×GRID_ROWS`
  grid (`balance.ts`); the chef roams continuously and collides with solid cells.
  Row 0 is nearest the counter (front of house); decor up front is worth more vibe.
- **Adjacency is the heart of decoration.** `recomputeDerived()` must be called
  after any layout/pricing/reputation change. It sets each cook station's
  `effCookSpeed`/`effSlots` from neighbouring decor and fills `G.derived`
  (patience, tip, comboWindow, moveSpeed, perfectWindow, repGainMult, vibe,
  spawnMult). The build-mode "Kitchen Effects" panel reads `G.derived` live.
- **Carry model** (`G.carry`): `{kind:'ing',id}` · `{kind:'part',id,quality}` ·
  `{kind:'plate',parts[]}` · `{kind:'burnt'}` · `null`. Plate↔recipe matching is a
  sorted-multiset compare (`partsKey`).
- **Cook timing** per slot, baked at placement using the station's adjacency
  speed: cooking `[0,cookT)` → perfect `[cookT,perfT)` → overdone `[perfT,burnT)`
  → burnt (grills only; fryers/soda never burn).
- **Interactions** live in `interact.ts` `actionFor()` — returns `{label,run}` for
  the nearest interactable; the label is the SPACE hint. Serving is a special
  counter case (chef near the counter + aligned with a waiting customer).
- **Business layer:** `priceLevel` (PRICE_LEVELS) trades coins for patience/crowd;
  `rep` (0–100) scales `spawnMult`; the hired `helper` tends grills so they don't
  burn (and holds the perfect sear at higher levels), wage paid at day end.
- **Variety & feel:** customers have a `kind` (normal/vip/critic) with baked
  `payMult`/`repMult` (`CUSTOMER_KINDS`); each day rolls one `G.modifier`
  (`modifiers.ts`) read by `adjacency`/`serving`/`customers`; the chef can `dash`
  (Shift); `finishDay` scores the shift `0–3` stars via `computeStars`. Per-day
  tallies live in `G.dayStats` (reset in `startDay`), distinct from cumulative
  `G.stats`.
- **`window.__G` / `window.__SR`** are exposed in `main.ts` for headless tests.
  `__SR.tick(dt)` runs one deterministic logic step (no rAF); `__SR.interact()`,
  `__SR.place()`, `__SR.buy()` etc. drive systems directly.

## Balance knobs (`game/balance.ts`)

`TOTAL_DAYS`, `SHIFT_LEN`, `QUOTAS`, grill/fryer timing, combo window/cap,
`ON_FIRE_AT`, reputation deltas, `SPAWN_BASE`, `PRICE_LEVELS`, helper wages,
`GRID_COLS/ROWS`, `DASH_TIME/CD/MULT`, `CUSTOMER_KINDS`. Modifier list:
`game/modifiers.ts`.

## Performance

- **Quality setting** (`stage.applyQuality`, persisted as `meta.quality`, toggled on
  the menu): `high` = 1024 PCF shadows + mipmap bloom + SMAA + dpr≤2; `low` = no
  shadows, cheap bloom, no SMAA, dpr 1. Big win on weak GPUs.
- Shadow map is 1024 over a frustum tightened to the play area (¼ the fill of the
  old 2048/±20). IBL is a one-time PMREM; `environmentIntensity` kept low.
- Hot paths avoid per-frame allocation: `sceneView.update` computes `items()` once
  and reuses a scratch `Vector3` for slot-food placement; the build-mode "Kitchen
  Effects" panel only rebuilds its DOM when a value changes. Removed meshes are
  disposed (geometry-only for shared-material actor rigs) — `smoke-perf` proves
  there's no geometry leak across heavy customer churn.
- `smoke-perf` guards a scene draw-call budget, bounded geometry/texture counts, a
  sub-0.5ms sim step, the quality toggle, and an fps floor. Test hooks: `__SR.info()`,
  `__SR.drawCalls()` (direct non-composer render), `__SR.setQuality()`.

## Testing notes

- Smoke tests (`scripts/smoke-*.mjs`) use the shared `_harness.mjs` (auto-finds
  cached Chromium via `_chrome.mjs`). `npm test` (`run-smokes.mjs`) boots one dev
  server and runs all 13 suites against it. Cutscenes interrupt `play()` now, so
  logic tests call `__SR.skipStory()` after `play()` to reach `playing`; real-DOM
  tests click the cutscene **Skip** button. Two complementary styles, both
  Playwright headless:
  - **Logic probes** (`boot/story/adjacency/economy/cook/events/systems/balance/perf`) drive
    `window.__SR` directly (`tick`, `interact`, `place`, `buy`, `sell`, `upgrade`,
    `stars`, …) for deterministic assertions on cooking, scoring, adjacency, burns,
    build, upgrades, pricing payout, recipe gating, plate matching, star tiers, etc.
  - **RH3-style real play** (`input/playthrough/soak`) drive the REAL game through
    real keyboard/mouse + DOM clicks: `playthrough` navigates the whole run to the
    win + game-over screens, `input` exercises WASD/Shift/Space/P + mouse build
    placement, `soak` runs ~12s of real-time rAF watching for runtime errors.
  All suites fail on any `console.error`/pageerror (benign AudioContext + the
  headless `glBlitFramebuffer` warnings are filtered).
- Gotcha: a **stale Vite squatting port 5179** serves a broken page and makes
  every smoke time out waiting for `window.__SR`. Kill stray `vite`/`esbuild`
  processes first if tests mysteriously fail to find the test surface.
- Headless WebGL (SwiftShader) spams a harmless `glBlitFramebuffer` depth-stencil
  warning from postprocessing; it does not affect rendering and the harness
  ignores warnings (only `console.error`/pageerror fail a run).
