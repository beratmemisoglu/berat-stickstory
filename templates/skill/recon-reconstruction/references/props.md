# Props: the kit, placement rules, designing a new prop (lib/props.js, lib/propview.html)

Props are never built ad hoc from boxes inside a scene and never placed with hand-computed coordinates. Use a kit prop
(or a verified project prop) and `place()` / `arrange.*`: they put things ON what holds them, facing what they face,
never overlapping, and the build fails loudly when something does not fit. check_layout reports **PLACEMENT** issues.

```js
import { prop, place, arrange, PROP_KINDS, propInfo } from '../lib/props.js';
const desk  = place(S, prop('desk', { variant: 'wooden' }), { at: [0, -2], face: [0, 3] });   // on the floor, front toward z=3
const chair = place(S, prop('office chair'), { at: [0, -1.25], face: desk });                // faces the desk
const got   = arrange.desk(S, desk, { sitter: chair });          // monitor, keyboard, mouse, lamp, mug, papers: a real layout
const b1 = place(S, prop('book'), { on: desk, uv: [.2, .75] }); place(S, prop('book', { seed: 4 }), { on: b1, yaw: -5 });
const ws = arrange.workstation(S, { at: [2, -2], face: 'camera' });   // desk + chair pulled out + arranged items in one call
```

## The prop contract (kit props and every prop you design)
- `prop(kind, o)` returns ONE `THREE.Group`: origin = centre of the footprint at floor level (**lowest point exactly y = 0**),
  **front = local +Z**, metres, real-world proportions (typical dims cited in the builder comment).
- One connected piece: every part overlaps its neighbour by >= 2 mm (no loose bits), no coplanar faces (decals >= 1 mm
  proud), no flat part >= 30 cm thinner than 2% of its length lying within 1 cm of another (the COPLANAR audit), closed meshes.
- Theme materials (engine `MAT` tiers + the kit palette), `o.color` / `o.tint` recolours the main material, screens take `o.screen`.
- Every mesh named (`'monitor screen'`), the group `selectable()`, shadows on, geometries/materials shared (hundreds of copies are cheap).
- `g.userData.prop = { kind, size: [w,h,d], front: [0,0,1], mount: 'floor'|'surface'|'wall'|'ceiling', tops: [{ name, y, x0, x1, z0, z1,
  clear?, overhang? }], seat?: { y, z }, foot?: [x0,x1,z0,z1], solids?: [{ x0,x1,y0,y1,z0,z1 }] }`. `tops` = horizontal support surfaces
  (local); `clear` = room above a shelf; `overhang` = a stack top (only the item's centre must be over it); `foot` = what touches the
  surface when smaller than the box (a lamp's base under its overhanging head); `solids` = the solid volumes when the box has open
  space (a desk's knee space, so a chair can tuck under it).

## The kit (`PROP_KINDS`; sizes W x H x D in cm; front = +Z)
Office: **desk** 140x75x70 (front = sitter side; `variant` office|wooden; top `desktop`) · **office chair** 59x112x61 (seat 46) ·
**monitor** 54x42x18 (one piece; `screen` off|desktop|code|browser|cctv|chart|red|fn(ctx,w,h)|canvas|texture|IMG key) ·
**laptop** 32x23x28 (`open` deg, 0 = closed) · **keyboard** 44x2.4x14 · **mouse** 6x4x11 · **desk lamp** 15x43x43 (articulated, head
aims +Z and down, `light`) · **desk phone** 20x10x21 · **smartphone** 7x1x15 (lying, `screen`) · **mug** 11x10x8 (handle +X) ·
**papers** 21x1x30 (A4 stack) · **folder** 24x1x34 · **book** 16x3x23 (lying; `standing`, `seed`, `w/t/d`; top `cover`) ·
**book row** ~30x24x16 (`n` or `w`, `seed`, `lean`) · **bookshelf** 80x180x30 (tops `shelf 1`..`shelf 5` + `top`) ·
**filing cabinet** 47x132x65 · **whiteboard** 131x187x55 (on a stand; `cork`, `draw(ctx,w,h)`) · **server rack** 60x200x100 ·
**reception counter** 242x111x84 (visitor side +Z; tops `ledge` = the default, `worktop` 75 cm: staff things incl. a monitor
need `top: 'worktop'` + `face: 'support-back'`) · **trash bin** 29x32x29 · **fire extinguisher** 17x59x17.
Home: **table** 160x75x90 · **coffee table** 110x42x60 · **dining chair** 44x90x43 · **sofa** 200x85x90 · **armchair** 90x85x90 ·
**bed** 163x100x212 (foot = front) · **nightstand** 45x55x44 · **tv** 123x78x26 (`screen`) · **tv console** 160x50x42 ·
**floor lamp** 44x162x44 · **table lamp** 30x53x30 · **potted plant** 40x70x45 (`h`; a desk plant `h: .3`) · **plate** 26x2x26 ·
**glass** 7x11x7 (`full`) · **water bottle** 7x25x7 · **picture frame** 50x40x3 wall / `stand` desk frame (`image`).
Building: **door** 104x217x15 (`open` deg toward +Z, hinges -X) · **window** 130x143x20 (wall; `light` day|night|glass) ·
**wall clock** 30x30x5 (`time`) · **ceiling lamp** 40x82x40 (hangs, `drop`, `light`) · **cctv camera** 10x17x30 (wall, `tilt`).
Things: **crate** 61x45x46 · **cardboard box** 40x30x30 (`w/h/d`) · **suitcase** 47x76x26 · **backpack** 30x47x25.
Lights (`o.light`) are real lights inside the prop: few per shot.

## place(S, item, o) -> item (the rules it enforces)
- `on: 'floor'` (default for floor props): `at: [x, z]` world; rests on the ground under its footprint (S.floor / anything
  `userData.ground`, raycast). Floor items never overlap each other (their `solids`): it nudges up to `nudge` (25 cm) or throws.
- `on: support` (a kit prop or any object): `slot` back-left|back-center|back-right|left|center|right|front-left|front-center|
  front-right, or `uv: [u, v]` (u 0 = left .. 1 = right seen from the support's front, v 0 = front edge .. 1 = back), or
  `local: [x, z]` in the support's frame, or `at` world; `top: 'shelf 3'` picks the surface. The item is **parented to the support**
  (move the desk, its things move with it), rests 0.8 mm above the surface, its footprint stays 1 cm inside the edge, never on
  another item: it moves to the nearest free spot within `nudge` (12 cm) or **throws** an error naming what is in the way and a free
  uv. Too tall for a shelf throws. Unknown objects as supports: measured, the rest height found by a ray down.
- Stacking: `place(S, prop('book'), { on: book })` - exact rest on the one below, no clipping.
- `face`: a person / chair / object (its seat or position), `[x, z]` / `[x, y, z]` / Vector3, `'camera'` (the shot's first camera
  key: call S.camera first; better face a person), `'support-front'` (default on a support), or a number = degrees. `yaw: deg` adds a
  small deliberate turn (papers askew). Facing is checked later: > 70 deg off = PLACEMENT.
- `on: 'wall'`, `at: [x, y, z]` (bottom height y), `face` = away from the wall: snaps its back onto a wall within 40 cm.
  `on: 'ceiling'`, `at: [x, z]` (ray up, or `y` = the ceiling height): hangs, `noContact`.

## sitOn(S, person, seat, o) -> { gap, back, feet } (seating a figure: never hand-tune seat offsets)
- `person` = a `figure()` of ANY rig; it is posed (`o.act`, default `'sit'`; `'typing'`, ... at `o.t`) and its root moved by what
  is MEASURED on the posed body: thighs / buttocks 3 mm on the seat top, facing the seat's front, back 1.2 cm off the backrest
  (found by rays), centred. Each rig's sit pose puts the pelvis somewhere else: that is why `seatAt(z - .88)` guesses fail.
- `seat`: a kit seat (office / dining chair, sofa, armchair; rotated or parented, e.g. `arrange.workstation().chair`); `o.x` = metres
  along a sofa (seat centres of a 2-seater w 1.4: -.27 / .27); any prop with a top (bed, bench, crate): sits on its `o.side` edge
  (front | back | left | right) with the knees just past it; or `{ at: [x, y, z] (seat top under the pelvis), face }`.
- `o.slide` m forward (typing: closer to the desk), `o.lean` deg back (+) / forward (-), `o.gap`. Then animate with
  `person.act(act, { t })` WITHOUT `seat:` (that would move the root again); call sitOn again if the chair moves.
- Check the result: `gap` ~0.003, `back` 0.012 (more = the shins had to clear the seat's front; null = no backrest), `feet` =
  lowest body point above the floor (the pose decides it: the UAL actor's clip hangs its feet ~15 cm on a 46 cm seat).

## arrange.* (intentional layouts; everything still goes through place())
- `arrange.desk(S, desk, { sitter, items, hand: 'right', top })`: monitor at the back facing the sitter, keyboard in front of it
  10 cm from the edge, mouse on the dominant side, lamp at the back corner on the other side aimed at the work area, mug / phone /
  smartphone to the dominant side, papers / folder / `books` to the other, `plant` back corner. Items: strings or `{ kind, ...o }`.
  A sitter behind the desk (or a counter's staff side) flips the layout. Returns `{ monitor, keyboard, ... }`.
- `arrange.workstation(S, { at, face, desk: { variant }, chair, items, pull: .3 })` -> `{ desk, chair, items }`.
- `arrange.shelf(S, shelf, { seed, fill, items: [[...kinds per shelf]] })`: book rows left/right alternating + a small plant, box
  or lying stack beside them.  `arrange.table(S, table, { seats: 4, settings: true })`: chairs facing it, plate + glass per seat.
  `arrange.nightstand(S, ns, { items: ['table lamp', 'book', 'glass'] })`.

## PLACEMENT (check_layout, LAYOUT_CHECKS)
Every placed item is re-checked each frame of the check: no longer resting on its support (> 1 cm gap or sunk), sticking out past
the edge, two items overlapping on one surface, floor things passing through each other, an item turned > 70 deg away from its
`face` target. Animate a support (its items follow), never an item away from what holds it; to move an item, `place()` it again.

## Designing a NEW prop (a "prop designer" agent; the kit has no fax, safe, ...)
1. Write `lib/props/<name>.js` exporting a builder that uses `propGroup(kind, o, g => meta)` from `../props.js` (it recentres,
   measures and writes the contract) and the part helpers `part, boxPart(g, w,h,d, mat, x, yBottom, z, name, r), rodPart(g, a, b, r,
   mat, name), roundedBox, cylinder, latheGeo, PMAT` (theme materials: `PMAT.body()`, `.metal()`, `.wood()`, `.black()` ...).
   Build y up from 0, front +Z, real dimensions (cite them), parts overlapping >= 2 mm, every mesh named `'<kind> <part>'`,
   `tops` for anything that holds things. Then `defineProp('fax', fax, { size, mount })` so `prop('fax')` and arrange use it.
2. **Look at it alone** in the viewer, both themes:
   `<project>/lib/propview.html?mod=lib/props/fax.js&fn=fax&args=[{}]&theme=studio&expect=[.4,.15,.35]` (kit props:
   `mod=lib/props.js&fn=prop&args=["monitor",{"screen":"code"}]`). It renders front / side (+X) / 3/4 / top-down on a 10 cm grid
   with the size and a blue arrow = front. `window.viewProp()` -> `{ png, report }`.
3. Self-check: `report.warnings` must be empty and `loose`, `floating`, `through` empty; `minY` 0; `frontHint` ok. Then LOOK at
   the PNG: one solid piece, front where the arrow points, proportions right against the grid, readable at medium shot, nothing
   egg-shaped or blobby, no part hovering. Fix and re-render until all four panels are right. Only then use it in a scene.
