// ─────────────────────────────────────────────────────────────────────────────
// OBJECTIVE GOALS — the source of truth for the self-iterating improvement loop.
//
// Each goal carries up to TWO independent pass/fail signals:
//   • logic  — a self-contained function run IN THE BROWSER against window.__SR /
//              window.__G. It returns { pass, detail }. This is the "logical"
//              measure: values, state transitions and outcomes are correct as the
//              game actually runs. (Playwright serialises the function source, so
//              it must be pure — only touch window.__SR / window.__G.)
//   • visual — a screenshot `step` (captured by capture.mjs) plus a `rubric` an
//              AI vision model judges. This is the "visual/UX" measure — the
//              screenshot is the objective evidence, not a description.
//
// A goal counts as MET only when every signal it DEFINES passes (a logic-only
// goal needs only logic; a goal with both needs both). The goals trace directly
// to the design pillars in CLAUDE.md so the loop drives toward them, not vibes.
// ─────────────────────────────────────────────────────────────────────────────

/** @typedef {{ pass: boolean, detail: string }} LogicResult */

export const GOALS = [
  {
    id: "wayfinder-guides",
    title: "The Wayfinder always points at the next step (a pre-reader can't get lost)",
    pillar: "The Wayfinder / one-button play",
    visual: {
      step: "day-cooking",
      rubric:
        "This is the in-shift cooking screen. PASS if the player is clearly told what to do next: a big on-screen action button (SPACE/ENTER prompt) and/or a hint banner is visible, and a glowing beacon or arrow marks a target. A young child should be able to tell what to do without reading much. FAIL if there is no visible guidance/prompt at all, or the screen looks empty/ambiguous.",
    },
    // Empty hands → holding raw → holding ready: the guide must stay active and
    // coherent at every step, never blanking out.
    logic: () => {
      const SR = window.__SR, G = window.__G;
      try {
        SR.quickStart();
        G.customers.length = 0;
        for (const t of G.tables) t.occupied = 0;
        G.chef.carry = null;
        SR.spawnGuest("burger", 0);
        SR.tickN(1 / 60, 3);
        const g1 = { ...G.guide };
        G.chef.carry = { kind: "raw", food: "burger" };
        SR.tickN(1 / 60, 2);
        const g2 = { ...G.guide };
        G.chef.carry = { kind: "ready", food: "burger", quality: "perfect" };
        SR.tickN(1 / 60, 2);
        const g3 = { ...G.guide };
        const pass = !!(g1.active && g2.active && g3.active);
        return {
          pass,
          detail: `empty→"${g1.label || "∅"}" | raw→"${g2.label || "∅"}" | ready→"${g3.label || "∅"}"`,
        };
      } catch (e) {
        return { pass: false, detail: "threw: " + (e && e.message) };
      }
    },
  },

  {
    id: "perfect-serve-celebrates",
    title: "A perfect serve celebrates correctly and clears the hands",
    pillar: "Juice everywhere / the guest IS the order",
    visual: {
      step: "serve-perfect",
      rubric:
        "A 'PERFECT! ⭐' celebration is shown over a guest just served. PASS if the celebration text is FULLY visible (not clipped at any screen edge) AND there is NO glowing bulb/halo of light stacked over the food or guest — sparkles/confetti read as crisp shapes, not a blown-out glow. FAIL if the text is cut off, or there is an additive glowing light bulb over the food/guest.",
    },
    // Serving a ready+perfect plate to a matching seated guest must: fire the
    // serve action, empty the hands, bump served + combo + score, and mark the
    // guest served.
    logic: () => {
      const SR = window.__SR, G = window.__G;
      try {
        SR.quickStart();
        G.customers.length = 0;
        for (const t of G.tables) t.occupied = 0;
        G.chef.carry = null;
        const s0 = G.servedToday, c0 = G.combo, coins0 = G.coins;
        const uid = SR.spawnGuest("burger", 2);
        G.chef.carry = { kind: "ready", food: "burger", quality: "perfect" };
        SR.gotoCustomer(uid);
        const label = SR.interact();
        const cust = G.customers.find((c) => c.uid === uid);
        const pass = !!(
          G.chef.carry === null &&
          G.servedToday === s0 + 1 &&
          G.combo === c0 + 1 &&
          G.coins > coins0 &&
          cust && cust.served === true &&
          label === "Serve!"
        );
        return {
          pass,
          detail: `label="${label}" served ${s0}→${G.servedToday} combo ${c0}→${G.combo} coins+${G.coins - coins0} custServed=${cust ? cust.served : "gone"} hands=${G.chef.carry === null ? "empty" : "full"}`,
        };
      } catch (e) {
        return { pass: false, detail: "threw: " + (e && e.message) };
      }
    },
  },

  {
    id: "no-fail-stars",
    title: "No-fail: stars are always 1–3 and a timed-out guest never punishes",
    pillar: "No-fail / always-winnable",
    visual: {
      step: "day-complete",
      rubric:
        "The end-of-day results screen. PASS if it celebrates with 1, 2, or 3 stars (at least one filled star — NEVER zero/empty) and the tone is warm and encouraging, not a 'you lost' / game-over screen. FAIL if it shows zero stars or reads as a punishing failure.",
    },
    // Stars stay within [1,3] for every served count, and a guest whose patience
    // runs out leaves without throwing, without a score penalty, just resetting
    // the streak.
    logic: () => {
      const SR = window.__SR, G = window.__G;
      try {
        SR.quickStart();
        const goal = G.goal || 3;
        G.servedToday = 0; const sZero = SR.stars();
        G.servedToday = Math.ceil(goal * 0.6); const sTwo = SR.stars();
        G.servedToday = goal; const sThree = SR.stars();
        const boundsOk = sZero >= 1 && sZero <= 3 && sThree === 3 && sTwo >= 2 && sTwo <= 3;

        // No-fail timeout path.
        G.servedToday = 0;
        G.customers.length = 0;
        for (const t of G.tables) t.occupied = 0;
        G.combo = 5; G.comboT = 99; // high comboT so only the timeout can reset it
        const uid = SR.spawnGuest("burger", 0);
        const cust = G.customers.find((c) => c.uid === uid);
        cust.patience = 0.05; cust.maxPatience = 30;
        let threw = false;
        try { SR.tickN(1 / 60, 150); } catch (e) { threw = true; }
        const still = G.customers.find((c) => c.uid === uid);
        const gone = !still || still.state === "leaving";
        const comboReset = G.combo === 0;
        const noPenalty = G.servedToday === 0;
        const starsStillOk = SR.stars() >= 1 && SR.stars() <= 3;
        const pass = boundsOk && !threw && comboReset && noPenalty && gone && starsStillOk;
        return {
          pass,
          detail: `stars[served=0]=${sZero} stars[.6·goal]=${sTwo} stars[goal]=${sThree} | timeout: threw=${threw} comboReset=${comboReset} gone=${gone} penalty=${!noPenalty}`,
        };
      } catch (e) {
        return { pass: false, detail: "threw: " + (e && e.message) };
      }
    },
  },

  {
    id: "custom-colours-apply",
    title: "Make-it-yours: chosen colours actually re-skin the live diner",
    pillar: "Make-it-yours customization",
    visual: {
      step: "white-diner",
      rubric:
        "The actual diner ROOM in play, after the palette was set to near-white. PASS if the diner's walls AND floor visibly render near-white (the chosen colour applied to the live room — white reads as white, not the warm/coloured default). Ignore the HUD chrome and any UI panels; judge only the 3D diner room surfaces. FAIL if the room walls/floor still show the old warm default colours.",
    },
    // Editing the config must update G.config live and keep derived/tables
    // invariants consistent (applyConfig path).
    logic: () => {
      const SR = window.__SR, G = window.__G;
      try {
        SR.quickStart();
        const c = JSON.parse(JSON.stringify(SR.ctrl.config()));
        c.palette.wall = 0xffffff;
        c.palette.floorA = 0xffffff;
        c.table.top = 0x123456;
        SR.ctrl.setConfig(c);
        const okWall = G.config.palette.wall === 0xffffff;
        const okFloor = G.config.palette.floorA === 0xffffff;
        const okTable = G.config.table.top === 0x123456;
        const tablesMatch = G.tables.length === G.config.tableCount;
        const derivedOk = !!G.derived && typeof G.derived.moveSpeed === "number";
        const pass = okWall && okFloor && okTable && tablesMatch && derivedOk;
        return {
          pass,
          detail: `wall=${okWall} floorA=${okFloor} tableTop=${okTable} tablesMatch=${tablesMatch}(${G.tables.length}/${G.config.tableCount}) derivedOk=${derivedOk}`,
        };
      } catch (e) {
        return { pass: false, detail: "threw: " + (e && e.message) };
      }
    },
  },

  {
    id: "customization-clear",
    title: "The customization studio is clear & kid-friendly (not a wall of swatches)",
    pillar: "Make-it-yours customization",
    visual: {
      step: "setup",
      rubric:
        "The 'Build Your Diner!' setup studio. PASS if customization is presented clearly and kid-simple: a row of friendly icon category buttons (Food / Chef / Pet / Diner / …) with ONE focused section of choices shown at a time, plus a live 3D preview of the chef/pet. FAIL if it is an overwhelming long wall of many colour-swatch rows all at once with no category navigation.",
    },
    // The customizer exposes a category bar and shows one category section at a time.
    logic: async () => {
      try {
        const SR = window.__SR;
        SR.scenario("setup");
        // The setup DOM renders on the next frame — wait for it before querying.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const cats = document.querySelectorAll("[data-czcat]").length;
        const sections = document.querySelectorAll("[data-cz-section]").length;
        const groupsShown = document.querySelectorAll("[data-cz-section] .cz-group").length;
        const pass = cats >= 6 && sections === 1 && groupsShown === 1;
        return { pass, detail: `categoryButtons=${cats}(>=6) openSections=${sections}(==1) groupsShownAtOnce=${groupsShown}(==1)` };
      } catch (e) {
        return { pass: false, detail: "threw: " + (e && e.message) };
      }
    },
  },

  {
    id: "customization-works",
    title: "Customization actually applies — name, menu, pet, flowers, tables, colour",
    pillar: "Make-it-yours customization / works properly",
    // Editing the config must reflect across G (the live diner), every facet.
    logic: () => {
      const SR = window.__SR, G = window.__G;
      try {
        SR.scenario("setup");
        const c = JSON.parse(JSON.stringify(SR.ctrl.config()));
        c.name = "Pip's Test Diner";
        c.menu = ["burger", "fries"];
        c.pet.kind = "cat";
        c.plants[0].kind = 2;
        c.tableCount = 5;
        c.palette.wall = 0x123456;
        SR.ctrl.setConfig(c);
        const okName = G.config.name === "Pip's Test Diner";
        const okMenu = G.config.menu.length === 2 && G.config.menu.includes("fries") && !G.config.menu.includes("drink");
        const okPet = G.config.pet.kind === "cat" && G.pet.kind === "cat";
        const okPlant = G.config.plants[0].kind === 2;
        const okTables = G.config.tableCount === 5 && G.tables.length === 5;
        const okWall = G.config.palette.wall === 0x123456;
        const pass = okName && okMenu && okPet && okPlant && okTables && okWall;
        return {
          pass,
          detail: `name=${okName} menu=${okMenu} pet=${okPet}(${G.pet.kind}) flower=${okPlant} tables=${okTables}(${G.tables.length}) wall=${okWall}`,
        };
      } catch (e) {
        return { pass: false, detail: "threw: " + (e && e.message) };
      }
    },
  },

  {
    id: "performance-budget",
    title: "Performance budget holds in a busy diner (cheap to render + sim)",
    pillar: "Performance",
    // logic-only — no single screenshot proves perf; the numbers do.
    logic: () => {
      const SR = window.__SR, G = window.__G;
      try {
        SR.quickStart();
        // Build a representative busy scene: guests waiting + food cooking.
        SR.spawnGuest("burger", 0);
        SR.spawnGuest("fries", 1);
        SR.spawnGuest("drink", 2);
        SR.gotoStation("meat"); SR.interact(); SR.gotoStation("grill"); SR.interact();
        SR.gotoStation("potato"); SR.interact(); SR.gotoStation("fryer"); SR.interact();
        SR.tickN(1 / 60, 40);
        const calls = SR.drawCalls();
        const info = SR.info();
        const N = 120;
        const t0 = performance.now();
        SR.tickN(1 / 60, N);
        const stepMs = (performance.now() - t0) / N;
        const pass = calls < 700 && info.geometries < 3000 && info.textures < 400 && stepMs < 1.0;
        return {
          pass,
          detail: `drawCalls=${calls}(<700) geometries=${info.geometries}(<3000) textures=${info.textures}(<400) simStep=${stepMs.toFixed(3)}ms(<1.0)`,
        };
      } catch (e) {
        return { pass: false, detail: "threw: " + (e && e.message) };
      }
    },
  },
];

/** Steps that capture.mjs must produce a screenshot for (derived from goals). */
export const REQUIRED_STEPS = [...new Set(GOALS.filter((g) => g.visual).map((g) => g.visual.step))];
