// Setup smoke: after the guided tutorial the player lands in the build-your-diner
// setup studio, where naming, menu choice, colour customization, table count and
// the pet kind all apply live to G (and the chosen menu actually limits orders).
// Also exercises every pet rig rendering without a runtime error.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    // Play → skip the intro cutscene → finish the tutorial → land in setup.
    SR.ctrl.play();
    let g = 0;
    while (G.phase === "cutscene" && g++ < 40) SR.skipStory();
    const inTutorial = G.tutorial && G.phase === "playing";
    SR.finishDay(); // tutorial over → "Tutorial Complete!" cutscene → setup studio
    let g2 = 0;
    while (G.phase === "cutscene" && g2++ < 30) SR.skipStory();
    const inSetup = G.phase === "setup";

    // Edit the restaurant through the controller (mirrors the wizard).
    const c = JSON.parse(JSON.stringify(SR.ctrl.config()));
    c.name = "Test Diner";
    c.menu = ["burger"];
    c.tableCount = 6;
    c.chef.apron = 0x123456;
    c.palette.wall = 0x7aa8ff;
    SR.ctrl.setConfig(c);
    const applied = {
      name: G.config.name, menu: G.config.menu.slice(), tables: G.tables.length,
      apron: G.config.chef.apron, wall: G.config.palette.wall,
    };
    const unlocks = {
      burger: G.unlocks.includes("food:burger"),
      hotdog: G.unlocks.includes("food:hotdog"),
      cat: G.unlocks.includes("pet:cat"),
    };

    // Layout edits (what the Arrange tab calls): move/remove a table + swap equipment.
    const beforeTables = G.tables.length;
    SR.ctrl.toggleTable(5); // a filled spot → removes that table
    const afterToggle = G.tables.length;
    const meatX0 = G.stations.find((s) => s.id === "meat").x;
    const grillX0 = G.stations.find((s) => s.id === "grill").x;
    SR.ctrl.swapStations("meat", "grill");
    const swapped = G.stations.find((s) => s.id === "meat").x === grillX0
      && G.stations.find((s) => s.id === "grill").x === meatX0;
    const arrange = { removed: afterToggle === beforeTables - 1, swapped };

    SR.finishSetup(); // open the diner → real day 1
    const open = { phase: G.phase, day: G.day, tutorial: G.tutorial };

    // The chosen menu limits who walks in.
    G.customers.length = 0; G.spawnQueue = 1; G.spawnTimer = 0;
    for (let i = 0; i < 90; i++) SR.tick(1 / 30);
    const order = G.customers[0]?.order ?? null;

    return { inTutorial, inSetup, applied, unlocks, open, order, arrange };
  });

  check("tutorial runs before setup", r.inTutorial && r.inSetup);
  check("setup names the diner", r.applied.name === "Test Diner");
  check("setup picks the menu", r.applied.menu.length === 1 && r.applied.menu[0] === "burger");
  check("a bigger diner reconciles table count", r.applied.tables === 6, `tables=${r.applied.tables}`);
  check("colours apply to the config", r.applied.apron === 0x123456 && r.applied.wall === 0x7aa8ff);
  check("starter content unlocked, later content locked", r.unlocks.burger && !r.unlocks.hotdog && !r.unlocks.cat);
  check("layout: a table can be moved/removed", r.arrange.removed);
  check("layout: equipment spots can be swapped", r.arrange.swapped);
  check("opening starts the real day 1", r.open.phase === "playing" && r.open.day === 1 && !r.open.tutorial);
  check("chosen menu limits orders", r.order === "burger", `order=${r.order}`);

  // Every pet kind builds + renders without throwing (the harness fails on errors).
  const lastKind = await page.evaluate(async () => {
    const SR = window.__SR, G = window.__G;
    for (const kind of ["corgi", "cat", "bunny"]) {
      const c = JSON.parse(JSON.stringify(G.config));
      c.pet.kind = kind;
      SR.ctrl.setConfig(c);
      await new Promise((res) => requestAnimationFrame(() => res()));
      await new Promise((res) => requestAnimationFrame(() => res()));
    }
    return G.pet.kind;
  });
  check("all pet kinds render", lastKind === "bunny");
});

finish("SETUP", fail);
