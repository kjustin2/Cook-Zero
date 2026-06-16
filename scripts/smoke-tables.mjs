// Table-service smoke: customers walk in from the entrance, path to a free table,
// seat themselves there (distinct tables, no double-booking), and are served by
// proximity — the chef must walk out to a seated guest; a plate offered from
// across the kitchen (out of reach) does NOT serve.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  const r = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    const log = {};

    // ── Walk-in → seat ──
    G.customers.length = 0;
    G.spawnTimer = 0;
    SR.tick(0.2); // spawn one
    const first = G.customers[0];
    log.startedWalkin = first && first.state === "walkin";
    const entryDist = first ? Math.hypot(first.x - G.chef.x, first.z - G.chef.z) : 0;
    // Let it path all the way to its table.
    SR.tickN(1 / 30, 240);
    const c0 = G.customers[0];
    log.seated = !!c0 && c0.state === "waiting";
    log.atTableDepth = !!c0 && c0.z < -3.5; // tables live deep in the dining room
    log.seatZ = c0 ? +c0.z.toFixed(2) : null;

    // ── Distinct tables, no double-booking ──
    G.spawnTimer = 0;
    for (let i = 0; i < 4; i++) { G.spawnTimer = 0; SR.tickN(1 / 30, 220); }
    const seats = G.customers.filter((c) => c.state === "waiting").map((c) => c.spot);
    log.multiSeated = seats.length >= 2;
    log.distinctTables = new Set(seats).size === seats.length;

    // ── Proximity serve ──
    const burger = G.recipes.find((x) => x.id === "burger");
    G.customers.length = 0;
    const guest = {
      uid: 4242, recipe: burger, kind: "normal", payMult: 1, repMult: 1, spot: 2,
      x: 0, z: -4.4, state: "waiting", patience: 30, maxPatience: 30, anger: 0,
      servedT: 0, happy: false, look: { skin: 0, shirt: 0, hair: 0, hat: false }, bob: 0,
    };
    G.customers.push(guest);
    const plate = () => ({ kind: "plate", parts: [{ id: "bun", quality: "good" }, { id: "patty", quality: "good" }] });

    // Too far (chef parked back in the kitchen) → no serve possible.
    G.carry = plate();
    G.chef.x = 0; G.chef.z = 4.0;
    log.farLabel = SR.actionLabel() || "";
    const servedBefore = G.stats.served;

    // Walk out to the table → proximity serve fires.
    G.chef.x = 0; G.chef.z = -3.0;
    log.nearLabel = SR.actionLabel() || "";
    const before = G.coins;
    SR.interact();
    log.servedDelta = G.stats.served - servedBefore;
    log.coins = G.coins - before;
    return { ...log, entryDist };
  });

  check("customer enters walking from the door", r.startedWalkin && r.entryDist > 6, `dist=${r.entryDist?.toFixed(1)}`);
  check("customer seats itself at a table", r.seated && r.atTableDepth, `state seated=${r.seated} z=${r.seatZ}`);
  check("multiple guests seat at distinct tables", r.multiSeated && r.distinctTables);
  check("plate out of reach can't be served", !r.farLabel.includes("Serve"), `label="${r.farLabel}"`);
  check("walking up to the table offers the serve", r.nearLabel.includes("Serve"), `label="${r.nearLabel}"`);
  check("serving at the table pays + counts", r.servedDelta === 1 && r.coins > 0, `+$${r.coins}`);

  // ── Arranging the dining area in build mode: add, move, remove tables, and a
  //    guest seats at a moved table's new spot. ──
  const build = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    SR.ctrl.enterBuild();
    const log = {};
    const N0 = G.tables.length;
    const firstEmpty = (exclude = -1) => {
      const used = new Set(G.tables.map((t) => t.col));
      for (let c = 0; c < 9; c++) if (!used.has(c) && c !== exclude) return c;
      return -1;
    };

    // Add a table at an empty column.
    const addCol = firstEmpty();
    G.build.inDining = true; G.build.diningCol = addCol;
    SR.buildClick();
    log.added = G.tables.length === N0 + 1 && G.tables.some((t) => t.col === addCol);

    // Lift it (pick up to move).
    SR.buildClick();
    log.lifted = !!G.build.movingTable && G.tables.length === N0;

    // Drop it at a different empty column.
    const destCol = firstEmpty(addCol);
    G.build.diningCol = destCol;
    SR.buildClick();
    log.moved = !G.build.movingTable && G.tables.some((t) => t.col === destCol) && !G.tables.some((t) => t.col === addCol);

    // Remove it with X.
    const beforeRemove = G.tables.length;
    G.build.diningCol = destCol;
    SR.sell();
    log.removed = G.tables.length === beforeRemove - 1 && !G.tables.some((t) => t.col === destCol);

    SR.ctrl.exitBuild();
    log.exited = !G.build.active && !G.build.movingTable;

    // A guest still seats correctly on the (rearranged) tables.
    G.phase = "playing"; // exitBuild returned us to the manage hub
    G.customers.length = 0; G.spawnTimer = 0;
    SR.tick(0.2); SR.tickN(1 / 30, 260);
    const c = G.customers[0];
    const seatedAtATable = !!c && c.state === "waiting" &&
      G.tables.some((t) => Math.abs(((t.col - 4) * 2.0) - c.x) < 0.2);
    log.seatsAfter = seatedAtATable;
    return log;
  });
  check("add a table on the dining floor", build.added);
  check("lift a table to move it", build.lifted);
  check("drop a table at a new column", build.moved);
  check("X removes a table", build.removed);
  check("leaving build holds no table", build.exited);
  check("guests seat on the rearranged tables", build.seatsAfter);
});

finish("TABLES", fail);
