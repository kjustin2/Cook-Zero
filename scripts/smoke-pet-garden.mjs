// Pet + garden smoke: the corgi can be petted (joy + cheers guests up) and fed
// (consumes a dish); the garden grows a stage each day and bloomed flowers make
// guests more patient; a plant can be watered in-shift.
import { withGame, finish } from "./_harness.mjs";

const fail = await withGame(async ({ page, check }) => {
  // ── Pet ──
  const pet = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    G.spawnQueue = 0;
    G.customers.length = 0;
    G.pet.x = 0; G.pet.z = 0; G.chef.x = 0; G.chef.z = 0; G.chef.carry = null;
    const uid = SR.spawnGuest("burger", 0);
    const c = G.customers.find((x) => x.uid === uid);
    c.patience = 5; c.maxPatience = 20;
    const petLabel = SR.actionLabel();
    SR.interact();
    const log = { petLabel, petted: G.pet.happy >= 0.99 && G.pet.followT > 0, cheered: c.patience > 5 };
    // feed
    G.chef.carry = { kind: "ready", food: "burger", quality: "good" };
    G.pet.x = G.chef.x; G.pet.z = G.chef.z;
    log.feedLabel = SR.actionLabel();
    SR.interact();
    log.fed = G.chef.carry === null && G.pet.happy >= 0.99;
    return log;
  });
  check("can pet the corgi", pet.petLabel === "Pet the pup" && pet.petted, `label="${pet.petLabel}"`);
  check("petting cheers waiting guests up", pet.cheered);
  check("can feed the corgi a dish", pet.feedLabel === "Feed the pup" && pet.fed, `label="${pet.feedLabel}"`);

  // ── Garden ──
  const gard = await page.evaluate(() => {
    const SR = window.__SR, G = window.__G;
    SR.quickStart();
    const day1 = G.plants[0].stage;
    let safety = 0;
    while (G.day < 3 && safety++ < 30) {
      if (G.phase === "playing") { G.servedToday = G.goal; SR.finishDay(); }
      else if (G.phase === "dayComplete") SR.nextDay();
      else if (G.phase === "manage") {
        const pick = G.treatChoices.find((t) => t !== "extracustomer") ?? G.treatChoices[0];
        if (pick) SR.chooseTreat(pick);
        SR.finishManage();
      } else if (G.phase === "cutscene") SR.skipStory();
    }
    const day3 = G.plants[0].stage;
    // bloom bonus
    const base = G.derived.patienceMult;
    G.plants.forEach((p) => (p.stage = 4));
    SR.recompute();
    const bloomed = G.derived.patienceMult;
    // water a plant in-shift
    G.plants[0].stage = 1; G.plants[0].growth = 0;
    G.chef.x = G.plants[0].x; G.chef.z = G.plants[0].z; G.chef.carry = null;
    const waterLabel = SR.actionLabel();
    SR.interact();
    return { day1, day3, base, bloomed, waterLabel, watered: G.plants[0].growth > 0 || G.plants[0].stage > 1 };
  });
  check("garden grows a stage on day 1", gard.day1 >= 1, `stage=${gard.day1}`);
  check("garden keeps growing across days", gard.day3 > gard.day1, `day1=${gard.day1} day3=${gard.day3}`);
  check("bloomed flowers boost patience", gard.bloomed > gard.base, `${gard.base} → ${gard.bloomed}`);
  check("can water a plant in-shift", gard.waterLabel === "Water it" && gard.watered, `label="${gard.waterLabel}"`);
});

finish("PET-GARDEN", fail);
