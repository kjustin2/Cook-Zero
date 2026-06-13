// Roguelite upgrades offered between shifts. Each mutates G.mods.
// `max` caps how many copies of an upgrade a run can take.

export const UPGRADES = [
  { id: 'spatula',   emoji: '🔥', name: 'Turbo Grill',    desc: 'Patties cook 25% faster',        max: 3, apply: (m) => { m.cookSpeed *= 1.25; } },
  { id: 'shoes',     emoji: '👟', name: 'Rocket Shoes',   desc: 'Move 18% faster',                max: 3, apply: (m) => { m.moveSpeed *= 1.18; } },
  { id: 'grillslot', emoji: '♨️', name: 'Bigger Grill',   desc: '+1 grill slot',                  max: 2, apply: (m) => { m.grillSlots += 1; } },
  { id: 'fryerslot', emoji: '🧺', name: 'Extra Basket',   desc: '+1 fryer basket',                max: 1, apply: (m) => { m.fryerSlots += 1; } },
  { id: 'zen',       emoji: '🧘', name: 'Charming Host',  desc: 'Customers wait 25% longer',      max: 2, apply: (m) => { m.patience *= 1.25; } },
  { id: 'sear',      emoji: '✨', name: 'Golden Sear',    desc: 'Perfect window lasts +1.5s',     max: 2, apply: (m) => { m.perfectWindow += 1.5; } },
  { id: 'tips',      emoji: '💰', name: 'Tip Jar',        desc: '+$3 on every order served',      max: 3, apply: (m) => { m.tip += 3; } },
  { id: 'keeper',    emoji: '🧲', name: 'Combo Keeper',   desc: 'Combo meter drains 6s slower',   max: 2, apply: (m) => { m.comboWindow += 6; } },
  { id: 'counter',   emoji: '🍽️', name: 'Extra Counter',  desc: '+1 plating counter',             max: 1, apply: (m) => { m.counters += 1; } },
];

export function rollUpgrades(G) {
  const counts = {};
  for (const id of G.upgradesTaken) counts[id] = (counts[id] || 0) + 1;
  const pool = UPGRADES.filter((u) => (counts[u.id] || 0) < u.max);
  // Fisher–Yates shuffle, then take 3.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

export function takenCount(G, id) {
  return G.upgradesTaken.filter((t) => t === id).length;
}
