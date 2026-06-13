<<<<<<< HEAD
# 🔥 Sizzle Rush

**A frantic arcade kitchen roguelite.** You're the whole kitchen crew. Customers walk in the door
and queue at your counter with order bubbles — grill patties in the golden perfect-sear window,
fry potatoes, assemble plates, and run each order to the right customer before they storm out.
Chain serves to build a combo multiplier, hit each shift's cash quota, pick an upgrade, and do it
again — busier. Survive all 5 shifts to become a Kitchen Legend.

Built with zero dependencies: vanilla JS + Canvas 2D, with all sound synthesized live via WebAudio.

## Play it

No build step. Serve the project root with any static server:

```bash
python -m http.server 8000
# open http://localhost:8000
```

Or run as a desktop app:

```bash
npm install
npm start
```

## Controls

| Key | Action |
|---|---|
| WASD / Arrows | Move |
| Space / E | Interact (grab, cook, plate, serve, trash) |
| 1 / 2 / 3 | Pick upgrade |
| P / Esc | Pause |
| M | Mute |

## How to play

1. Customers walk in and wait at the **service counter** — their speech bubble shows what they want.
2. **Grab** a raw patty 🥩 from the bin and drop it on the **grill**.
3. Watch the ring: orange = cooking, **pulsing gold = perfect sear** (bonus cash!), red = about to burn.
4. Build the order on a **prep counter** — bun 🥯, patty, cheese 🧀, fries 🍟 — it glows green when it matches someone's order.
5. Carry the plate across the kitchen and serve it **to that customer** at the counter.
6. Serve fast and back-to-back: combos multiply your earnings up to 3×. At ×5 you're **ON FIRE**.
7. Miss the shift quota and you're fired. Clear it and choose 1 of 3 upgrades before the next, harder shift.

Burnt patties must be scraped off and trashed 🗑️. Ignored customers storm out and kill your combo.

## Dev

```bash
node check-syntax.js   # parse-check all src modules
```
=======
# Cook-Zero
>>>>>>> ef53ecb104db9455f34caf1c2d8bd111cae4b5d9
