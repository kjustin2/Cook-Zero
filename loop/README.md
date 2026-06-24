# The self-iterating improvement loop

A closed loop that **measures the game against objective goals, implements fixes,
and re-verifies — repeating until the goals are met** (or a budget is hit). Each
goal is judged by two independent signals:

| Signal | What it proves | How |
|---|---|---|
| **Visual** | A visual/UX goal was actually achieved on screen | A screenshot is captured and an AI vision model (`claude-opus-4-8`) judges it against a strict PASS/FAIL **rubric**. The screenshot is the objective evidence, not a description. |
| **Logical** | In-game values & state transitions are correct as the match plays | A self-contained assertion runs in the browser against `window.__SR` / `window.__G`. |

A goal counts as **met only when every signal it defines passes** (logic-only
goals need only logic; goals with both need both).

## One iteration

```
capture ──▶ observe ──▶ (verify-logic) ──▶ report ──▶ decide
  │            │              │                │           │
screenshots  AI vision     __SR asserts    report.md   all met? stop.
of the flow  per rubric    per goal        decision.json  else: implement, repeat
```

1. **Capture** — `capture.mjs` boots the real game and walks the whole journey
   (title → tutorial → serve PERFECT → setup → recolour → busy day → day-complete
   → manage → win), screenshotting each goal-relevant step into the cycle folder
   with a `manifest.json`.
2. **Observe** — `observe.mjs` sends each visual goal's screenshot + rubric to
   Claude and gets back a structured verdict (`pass`, `confidence`, `observed`,
   `reasoning`, `issues[]`). With no API key it degrades to *logic-only* and marks
   visual goals UNVERIFIED.
3. **Verify (logical)** — `verify-logic.mjs` runs each goal's in-browser
   assertions in a fresh isolated context (no state bleed).
4. **Report** — `report.mjs` writes `report.md` (scorecard + per-goal detail +
   embedded screenshots + remaining gaps) and `decision.json`, and appends a line
   to `PROGRESS.md`.
5. **Decide** — `loop.mjs` stops if all goals are met; otherwise records the gaps
   and starts the next cycle (running the implementer, if configured).

## Run it

```bash
npm run loop                       # full auto loop (vision if ANTHROPIC_API_KEY is set)
npm run loop -- --max-cycles 3     # cap this run to 3 cycles
npm run loop -- --no-vision        # logic-only (skip AI vision; visuals UNVERIFIED)
npm run loop -- --fresh            # restart from cycle 001
npm run loop -- --implementer "claude -p 'Read $SR_LOOP_REPORT and fix the failing goals'"
```

Individual steps are runnable on their own (each boots its own dev server):

```bash
npm run loop:capture  loop/cycles/manual/shots          # just capture the flow
npm run loop:verify   loop/cycles/manual/logic.json     # just run the logic asserts
npm run loop:observe  loop/cycles/manual/shots          # just AI-judge captured shots
```

### Vision (no API key needed)

`observe.mjs` auto-detects how to judge screenshots, in order:

1. **Claude Code CLI (`claude -p`) — default.** Uses your existing Claude Code
   login, so **no `ANTHROPIC_API_KEY` is required**. Each visual goal is judged by
   spawning `claude -p --output-format json --allowedTools Read`, which reads the
   screenshot and returns a structured verdict.
2. **Anthropic API** (`claude-opus-4-8` via `@anthropic-ai/sdk`, `fetch` fallback)
   — used only if the CLI is absent but `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN`
   is set.
3. **none** → the loop still runs end-to-end in **logic-only** mode (screenshots
   captured for review, all logic asserted, visual goals marked UNVERIFIED).

Force a method with `SR_LOOP_VISION=cli|api|off`; override the model with
`SR_LOOP_MODEL`.

### Implementer (the only non-measurement step)

The loop performs every *measurement* step itself. Editing code is delegated to a
pluggable **implementer** command (`--implementer "<shell cmd>"` or
`SR_LOOP_IMPLEMENTER`). It runs between cycles with these env vars set, and is
expected to edit the source and (optionally) drop a `changes.md` in the cycle
folder describing what it changed:

| Env var | Value |
|---|---|
| `SR_LOOP_CYCLE` | cycle number |
| `SR_LOOP_CYCLE_DIR` | the cycle folder |
| `SR_LOOP_REPORT` | path to `report.md` |
| `SR_LOOP_DECISION` | path to `decision.json` |

With **no** implementer, the loop runs one measurement cycle and stops with the
report, to be implemented by a human or the Claude Code agent — then `npm run loop`
**resumes at the next cycle**. (Vite serves the edited source on the next capture;
no restart needed.)

## Traceability, stop & resume

- Every cycle is a self-contained folder: `loop/cycles/NNN/` →
  `shots/` (+ `manifest.json`), `logic.json`, `observe.json`, `report.md`,
  `decision.json`, and optional `changes.md`.
- `loop/state.json` records `lastCycle`, `done`, and the per-cycle history.
  Re-running resumes at the next cycle; `--fresh` restarts at 001. A crashed cycle
  leaves prior cycles and state intact (safe to stop and resume).
- `loop/PROGRESS.md` is the human-readable running log across cycles.

## Companion: the QA sweep (`npm run qa`)

The AI-vision loop above judges screenshots against prose rubrics. Its faster,
fully-deterministic sibling is **`scripts/loop/qa.mjs`** — it needs no model and
runs in seconds. For every debug scenario it collects a screenshot, a **visual
fingerprint** (`__SR.signature` — a downsampled RGB grid + luma/black/white/
variance stats), **perf metrics** (`__SR.metrics`), a **game-state invariant
report** (`__SR.invariants`), and any console errors, then:

- **diffs each fingerprint against the committed baseline** (`loop/qa-baseline.json`)
  to flag visual drift (a real regression — black screen, missing geometry, a
  palette shift — shows as a large delta; the deterministic 3D frames sit at
  ~0–1%),
- writes an annotated **contact sheet** (`shots/qa/index.html`) with a perf /
  invariant / visual-diff badge on every shot, an **AI-readable** `SUMMARY.md`,
  and a machine-readable `report.json`,
- exits non-zero on a *hard* failure: a degenerate frame (black/flat), an
  invariant violation, a console error, or a draw-call budget breach. A baseline
  visual DIFF is a warning unless `--strict`.

```bash
npm run qa                 # sweep → contact sheet + SUMMARY.md + diff vs baseline
npm run qa:baseline        # re-bless loop/qa-baseline.json (refuses if any frame is degenerate)
npm run qa:hud             # same, with the on-screen debug HUD overlaid on every shot
```

The same instrumentation (`src/debug/inspect.ts` + `hud.ts`) powers `smoke-visual`
in `npm test` and the live, toggleable HUD (backtick / `?debug`). See the
"Debug/QA harness surface" bullet in the top-level `CLAUDE.md`.

## The goals

Defined in [`goals.mjs`](./goals.mjs) — the single source of truth, traced to the
CLAUDE.md design pillars:

| Goal | Logic signal | Visual signal |
|---|---|---|
| `wayfinder-guides` | guide stays active across empty/raw/ready hands | `day-cooking` shows a clear prompt/beacon |
| `perfect-serve-celebrates` | serve bumps served+combo+score, empties hands | `serve-perfect` shows full "PERFECT! ⭐", no glow bulb |
| `no-fail-stars` | stars always 1–3; a timed-out guest never penalises | `day-complete` shows ≥1 star, warm tone |
| `custom-colours-apply` | edited config re-skins live `G.config` + invariants hold | `setup-white` shows the near-white diner |
| `performance-budget` | drawCalls<700, geos<3000, texs<400, sim step<1ms | _(logic-only)_ |

Add or tighten goals by editing `goals.mjs`; the rest of the loop adapts.
