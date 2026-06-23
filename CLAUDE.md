# CLAUDE.md

Guidance for Claude Code when working with the **Sizzle Rush** codebase — a
cute, **kid-simple 3D cooking game** (rebuilt from scratch in 2026-06 from an
older, far more complex kitchen roguelite). Learn the architecture from the
sibling games `Rogue-Hero-3` (look & feel), `Wall-of-Dead-3` and `Wall-of-Dead-2`
(cinematic cutscene directors).

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

A bright, warm **3D cooking game so simple a young kid can play and have fun.**
You are **Pip**, a tiny chef helping **Grandma's Diner**. Guests walk in, sit at
a table, and show a big **picture order** (🍔🍟🥤🍦🌭) with a happy→sad face
timer. The player roams with **WASD or Arrow keys** and does **everything with one
button** (SPACE/ENTER): grab → cook → serve. Each food is **one clear path**:
`grab at its source → (maybe) cook at its station → carry it to the guest`. There
is **no plate assembly, no economy, no fail state** — the run is always winnable.

**Design pillars (do not regress these):**
- **One-button play.** `interact.ts actionFor()` returns the single best
  `{label, icon, run}` for whatever the chef is next to + holding. The label/icon
  drive the big on-screen SPACE button.
- **The guest IS the order.** A floating emoji bubble + a generous green→red
  patience bar. Serve by walking up and pressing the button. No ticket UI.
- **The Wayfinder.** `wayfinder.ts computeGuide()` reads real state and points a
  3D beacon + a DOM hint banner at the single most helpful next step, so a
  pre-reader **can never get lost**. Guidance and the action prompt are derived
  from the same state and can't contradict.
- **No-fail / always-winnable.** A guest whose patience runs out just leaves a
  little sad (no score penalty; the streak resets). Burning is so slow it almost
  never happens, and the "helper" treat removes it entirely. Stars are 1–3, never 0.
- **NO glow halos.** There is intentionally **no bloom post-pass, no point lights
  on cooking food, and particles use `NormalBlending` (not Additive)** — so sparks/
  steam never stack into a glowing "bulb of light" over the food or guests. Cooking
  shows as a live colour tint (raw→golden→char). Render uses **`NeutralToneMapping`
  + near-neutral lights** so a colour the player picks renders true (white = white).
  Don't reintroduce bloom, additive particles, ACES, or emissive halos.
- **Make-it-yours customization.** A `RestaurantConfig` (`config` on `G`) holds the
  name, chosen menu, chef + pet looks, the full colour palette (walls/floor/tiles/
  stripe/windows, table top/rim/legs/chairs, equipment body/trim, flower type +
  bloom), table count and decor level. Defaults (`customize.ts`) reproduce the
  original look exactly. Editing config live re-skins the 3D diner (SceneView diffs
  config each frame). The customizer (`ui.ts`) is a **friendly icon category bar**
  (Food/Chef/Pet/Diner/Tables/Gear/Flowers) showing **one focused section at a
  time** — never a wall of swatches. The setup/manage live preview frames what
  you're editing via `G.studioFocus` (`chef` close-up for Chef/Pet, pulled-back
  `room` view for Diner/Tables/Gear/Flowers so wall/floor colours are seen
  changing); `G.studioCat` is the open category, so a debug scenario can cut
  straight to e.g. the Diner section with a room-framed preview.
- **Juice everywhere.** Live cooking-mesh tint, squash-stretch pops, confetti/
  hearts/coins on a serve, a purely-celebratory combo, bouncy adaptive music.
- **Cinematic cutscenes.** A data-driven director dollies the real camera through
  the diner with letterbox, a title card, and big emoji-portrait dialogue.

**Phase machine (`src/main.ts`):**
```
title → cutscene(intro) → playing(tutorial) → cutscene("Tutorial Complete!") →
        setup → playing → dayComplete → manage → [cutscene(dayN story)] →
        playing → … → cutscene(win) → win
```
First-ever Play → `startTutorial` (slow intro + a guided burger-only shift, no clock,
super-patient guests) → `finishTutorial` plays a clear "Tutorial Complete!" beat →
`setup` (the build-your-diner studio: name, menu, looks, colours, layout) →
`finishSetup` → `beginDay` (real day 1). Returning players (meta `tutorialDone`)
skip straight to `setup`. Finishing a day → `dayComplete` (stars) →
`nextFromDayComplete` rolls 3 upgrades → `manage` (Upgrade / Decorate / Arrange
tabs) → `finishManage` (`G.day++`) → story cutscene (days 3 & 5) → play. **Esc/P**
pauses; the pause menu's **Quit** snapshots the run so the title shows **Continue**.
Tests reach real play via `__SR.quickStart()` (drives through tutorial + setup).

## Architecture

Strict-TS ESM, Vite-bundled, Electron-wrapped. Plain-function game systems share
one central `G` (`GameState`) created in `state.ts`. Render + audio are reached
only through the `Fx`/`Sfx`/`Music` interfaces on the `Ctx` hub, so game logic
never imports Three.js and runs headless in tests (`NULL_FX/NULL_SFX/NULL_MUSIC`).

| Area | Files | Role |
|---|---|---|
| Core | `core/{math,rng,input,save}.ts` | helpers, seeded RNG, keyboard input (WASD+arrows); `save.ts` = localStorage meta (best/settings/**unlocks**/**tutorialDone**/last **config**) + a versioned resumable **run snapshot** (`saveRun`/`loadRun`/`clearRun`) |
| State | `game/{types,balance,catalog,customize,ctx,state}.ts` | pure type model, tunables, food/station data, **`customize.ts` (RestaurantConfig defaults + colour swatches + choosable pets/foods + the unlock table)**, system hub, `G` factory + `recomputeDerived` + `applyConfig`/`addTable`/`toggleTableAt`/`swapStations` |
| Sim | `game/{chef,stations,customers,interact,wayfinder,serving,pet,garden,sim}.ts` | the playing-state systems: chef movement+one-button interact, cook-slot timers, guest lifecycle (spawns from the **chosen menu**), `actionFor()`, the wayfinder, serve payout (×`derived.coinMult` from decor)/combo/juice, the pet (pet/feed), the garden, `updatePlaying`+`shiftOver` |
| Flow | `game/{flow,upgrades,cutscene,story}.ts` | day start (+ tutorial branch + per-day checkpoint), stars, **upgrade roll (incl. `table`/`decor`)**, the cutscene director, the warm story (incl. `tutorialDoneScene`) |
| Render | `render/{stage,sceneView,kit,fx,diner,stations,food,actors,figures,pets,plants}.ts` | Three.js renderer/post (**no bloom**) + cinematic camera, one-way `G`→Three diff that **rebuilds room/tables/stations/chef/pet when `config` changes**, procedural meshes recoloured from config (incl. 3 pet kinds: corgi/cat/bunny, 4 flower types), pooled particles, cutscene cast |
| Audio | `audio/{sfx,music}.ts` | procedural WebAudio SFX + adaptive step-sequencer music |
| UI | `ui/ui.ts`, `style.css` | DOM HUD + every overlay + the cutscene presentation + full-screen FX layers |

**Render is a separate, one-way world.** `Stage` owns the renderer/camera/lights/
post and a `setCinematic`/`setCinePose` mode the cutscene uses. `SceneView.update`
diffs `G` against Three objects every frame via uid/key-keyed Maps (customers,
slot food, carried item), building/disposing as state changes; it also drives the
wayfinder beacon and, during a cutscene, the figure cast + camera. Render never
mutates gameplay.

## Key conventions

- **Fixed, data-driven world (no grid/build mode).** Stations live in
  `state.ts STATION_SPOTS` along the back wall; six tables in `TABLE_SPOTS`. The
  chef roams the whole floor with soft circle collision (`chef.ts`); bounds are
  `FLOOR` in `balance.ts`.
- **Foods (`catalog.ts FOODS`).** Each `FoodDef` has a `source` station, an
  optional `cook` station (null = instant like drink/icecream), a `minDay`, and
  cute names/colours. `menuForDay(day)` gates the unlocked menu.
- **Carry model** (`chef.carry`): `null` · `{kind:'raw',food}` · `{kind:'ready',
  food,quality}` · `{kind:'burnt'}`. Hands are full or empty — nothing to manage.
- **Cook timing** (`stations.ts`, windows from `balance.ts COOK`): raw →
  good(ready) → **PERFECT** (wide, easy) → crispy (long grace) → burnt (grills
  only, very rare; `helper` treat freezes at perfect). Quality is read from the
  slot timer; the cooking mesh **browns continuously every frame**
  (`food.ts tintCooking`).
- **Treats** (`upgrades.ts`): between-day pick-one upgrades shown by big icon. Most
  repeatable stat boosts (`fast/reach/time/quickcook/patient/extracustomer`); two
  one-time powers (`sparkle/helper`). `recomputeDerived()` in `state.ts` folds the
  chosen treats into `G.derived` (moveSpeed, reach, level time, cook speed,
  patience, sparkle, helper). **Picking a treat visibly redecorates the diner**
  (`sceneView.syncDecor`): balloons (extracustomer), wall clock (time), rug (fast),
  grill flames (quickcook), a helper chef (helper) — so the customization is SEEN.
- **Pet + garden = the cute "designing your restaurant" layer.** `pet.ts` — a
  corgi (`G.pet`) wanders the dining floor; the chef can **pet** it (joy + a little
  patience back for waiting guests) or **feed** it a finished dish (consumes it,
  keeps your streak) — both optional "cool decisions" the wayfinder never forces.
  `garden.ts` — flower planters (`G.plants`) **grow a stage each day** (`growGarden`
  at `startDay`) and can be watered in-shift (`waterPlant`); each bloomed flower
  adds patience (folded into `recomputeDerived`). Rendered by `pets.ts`/`plants.ts`.
- **Clarity:** every station has a **floating sign** (`sceneView.signSprite`) — cook
  stations show 🔥, sources/instants show the food they make — so a kid instantly
  knows what each does and which order it matches. Order bubbles are big and
  colour-coded to the food, and pulse when patience is low.
- **Cutscenes** (`cutscene.ts` logic + `story.ts` data + `sceneView` camera/cast +
  `ui.ts` letterbox/dialogue). A `CineScene` is timed `Shot`s (camera `from/to`
  pose, fov, optional `line`/`title`/`fade`/`sfx`) plus a `cast` of `CastPlacement`s.
  The logic core only handles timing + per-shot sfx + `onDone` chaining; the camera
  dolly, DoF-free cinematic mode, figure cast and DOM letterbox/dialogue read
  `G.cutscene`. Skippable with a short input guard.
- **`window.__G` / `window.__SR`** are exposed in `main.ts` for headless tests:
  `tick(dt)` runs one deterministic `stepSim`; `interact()`, `gotoStation(id)`,
  `gotoCustomer(uid)`, `spawnGuest(order,table)`, `quickStart()`, `skipStory()`,
  `finishDay()`, `nextDay()`, `chooseTreat(id)`, `stars()`, `guide()`,
  `info()`/`drawCalls()`/`setQuality()`.
- **Debug scenario system** (`game/scenarios.ts`, exposed as `__SR.scenario(name)`
  + `__SR.scenarios()`). A scenario is a deterministic "cut" that drives the game
  straight into a named situation for tests + screenshots — `title`, `play`,
  `cooking`, `carry`, `burning`, `wayfinder`, `serve-perfect`, `white-diner`,
  `setup`/`setup-chef`/`setup-room`, `manage`, `day-complete`, `win`. Each cut
  ends `quickStart`/`toSetup` with `ctx.fx.clear()` and starts with `ctx.fx.clear()` (new on the
  `Fx` interface) so no stale particles linger. `scripts/loop/capture.mjs` and
  `smoke-scenarios.mjs` drive screenshots/assertions off these instead of
  hand-staging each moment.

## Balance knobs (`game/balance.ts`)

`MAX_DAY`, `DAY_LEN`, `DAY_GOAL`, `DAY_GUESTS`, `SPAWN_GAP`, `PATIENCE`, the `COOK`
window durations, `CHEF_SPEED/REACH`, `DASH_*`, `COMBO_WINDOW`, `FIRE_AT`,
`COIN_*`, `FLOOR`. Everything is tuned **generous** — wide perfect window, patient
guests, near-impossible burning — so a kid wins and has fun.

## Performance

- **Quality toggle** (`stage.applyQuality`, persisted as `meta.quality`): `high` =
  1024 PCF soft shadows + SMAA + dpr≤2; `low` = no shadows, no SMAA, dpr 1. Both
  share the same post chain — a `RenderPass` + a vignette `EffectPass`. There is
  **no bloom pass** (`stage.buildPost`), in line with the no-glow pillar.
- Hot paths avoid per-frame allocation: pooled particles/coins/hearts/floaters in
  one capped buffer; uid/key-keyed view maps build once and dispose on removal;
  the beacon icon texture is cached by string. `smoke-perf` guards a draw-call
  budget (`< 700`), bounded geometry (`< 3000`) and texture (`< 400`) counts, a
  sub-1ms sim step, and that the quality toggle drives `keyLight.castShadow`.

## Testing notes

- Smoke tests (`scripts/smoke-*.mjs`) use the shared `_harness.mjs` (auto-finds
  cached Chromium via `_chrome.mjs`). `npm test` (`run-smokes.mjs`) boots one dev
  server and runs all suites. Two styles, both Playwright headless:
  - **Logic probes** (`boot/cook/instant/wayfinder/customers/balance/pet-garden/
    setup/save/flow/story/perf`) drive `window.__SR` directly for deterministic
    assertions on the full grab→cook→serve loop, instant foods, the wayfinder's
    next-step targeting (incl. the no-blackout regression), guest arrival/patience/
    leave, the balance invariants (reachable goals + guest overlap), the pet
    (pet/feed/cheer) and garden (grow/bloom/water), the **setup studio** (tutorial→
    setup, naming/menu/colours/table-count/pet-kinds apply, unlock gating), **save/
    resume** (quit → Continue restores a run from storage), stars/upgrades/day
    progression to the win, the intro cinematic, and the perf budget. `__SR` now
    also exposes `finishSetup`/`finishManage`/`continueRun`; advancing a day in a
    probe is `finishDay → nextDay → (chooseTreat) → finishManage`.
  - **Real play** (`playthrough/soak`) drive the REAL game via real DOM clicks +
    keyboard: click Play, skip the cutscene, walk + press the action button; soak
    mashes random keys for ~8s watching for runtime errors.
  All suites fail on any `console.error`/pageerror (benign AudioContext + the
  headless `glBlitFramebuffer` warnings are filtered).
- **`npm run shots`** (`scripts/shots-flow.mjs`) boots a server and walks the WHOLE
  journey (title → intro → tutorial → serve "PERFECT" → setup character preview →
  recolour/custom diner → cook → day-complete → manage tabs → win), saving a fresh
  numbered storyboard to `shots/flow/`. This is the eyes of the improve-look-improve
  loop: regenerate, open the images, judge clarity/glows/clipping, fix, repeat. It
  also fails loudly on console errors. `scripts/shot.mjs` is a smaller title/cook/
  manage snapshot.
- Gotcha: a **stale Vite squatting port 5179** serves a broken page and makes
  every smoke time out waiting for `window.__SR`. Kill stray `vite`/`esbuild`
  processes first if tests mysteriously fail.
