# Sitting, lying, riding: bodies ON things, never in them

The owner, night 2: "the legs are clipping into the chairs ... almost every single shot ... how do you miss it with
visual verification?" A leg was one smooth curve from the hip straight to the foot, so seated it ran down through the
cushion, the chair front or the stool; the characters' legs (0.42 m) are shorter than most seats are high, and builders
"sank" bodies into seats to sit low. Every visual check looked at faces and framing, never at contacts. The engine now
sits characters by itself and prints a contact report on every render. Rule: a check a human has to notice is not a
check.

## What the engine does

- `sit(t, seat_h=None, dur=0.5, feet_y=None, feet_z=None, thigh=None, seat=None)` FINDS the seat: rays straight down
  under the hips and 0.07 / 0.14 m ahead under the thighs, at bake time, EVERY frame, from wherever the character
  really is (later `place()` calls and moving seats are fine). The surface under the hips wins; a forward ray replaces
  it only across a gap of more than 12 cm (a chair's back slot). Hits on any character's own parts, on held props and
  on things more than 16 cm above the seat (armrests, a table) are skipped.
- The body rests ON the seat top (a `seat_h` more than 6 cm off the found top prints `CZ SIT <name> t=..: seat_h .. but
  <seat> top is .. - using the seat top`), the thighs lie on it to a knee corner 6 cm past the seat's front edge, the
  leg bends there like an L, the shins hang to the floor in front of the knees. Seats up to 0.75 m keep the feet on the
  floor; higher ones dangle (feet at seat top - 0.42 m).
- `stand(t, dur=0.4)` undoes it (body to hip height, legs straight, feet under the hips).
- No seat found: `CZ SIT <name>: no seat under the hips at (x, y) - sitting on air`.
- Every render prints the contact report (engine_api.md §9): `CZ CLIP` (a limb inside a solid), `CZ SITCHECK <name> f..:
  floats N cm above the seat` (more than 5 cm) or `torso sunk N cm into <obj>` (more than 3.5 cm), then
  `CZ CLIPCHECK clean` or the total. It must say clean. A shallow contact on a seat top (under 2 cm) is resting, not a clip.

## How to seat a character

1. Build the set first (the seat must exist when the character sits).
2. Place the root over the seat, about 0.05 m BEHIND its centre, facing out (a chair prop at rot 0 faces -Y: the
   sitter's yaw 0). Read the seat's META for its numbers (`seat_z`, `seat_y`, `sit_at`, `mattress_z`).
3. `bpy.context.view_layer.update()` when the seat was built in this script just before (a stale matrix_world read a
   seat top as 5 cm and sank the sitter below the cushion).
4. `c.sit(t)` with NO hand-tuned `seat_h` offsets and no `feet_y` / `feet_z` unless the feet really go somewhere else.
5. Render 2-3 frames and read the `CZ SIT` / `CZ CLIP` / `CZ SITCHECK` lines before anything else. Fix them first.

```python
H.place(-1, rx + 1.6, ry + 1.5, 0)
H.sit(-1, dur=0.01, seat=cz.find('f_chair1_seat'), feet_y=-0.42)      # feet in front of the chair's front stretcher (a CZ CLIP)
H.pose(-1, 'rest', dur=0.01, hL=(0.16, -0.3, H.ht * 0.62), hR=(-0.2, -0.34, H.ht * 0.66))   # hands ON the table, not in it
```
```python
m.place(-1, 0.42, 0.45, 0)          # the demo: root a little behind the seat centre; the cushion is found every frame
m.sit(-1, dur=0.01)
```
```python
derek.sit(29.35, dur=0.35, seat=cush)              # a floor cushion box under him: sitting on the bare floor read as "on air"
derek.stand(44.3, 0.3); derek.walk(44.6, 45.6, [...])
```

## When the rays pick the wrong thing

| report / symptom | cause | fix |
|---|---|---|
| sitting on air at a desk; the sitter floats 13 cm | the rays ahead of the hips hit the DESK TOP over the knees | move the root back, make the desk top shallower, or force the seat: `seat=cz.find('<stool>_seat')` |
| `floats 49 cm` on a rocking chair or a kitchen chair, but the picture looks seated | the check's ray ran out of steps in her own clothes (fixed: 24 steps) | if it persists, force `seat=` after a `view_layer.update()` |
| sank 40 cm with `seat=<cushion>` | the forced seat's bounds read from a stale matrix | `view_layer.update()` before `sit()` |
| no seat in a moving car; the body sinks to the road | the root was PARENTED to the car: the rays read its local x / y | leave the root unparented and ride along with a linear position key; the engine re-casts per frame |
| sitting on the bare floor reads as on air | the engine needs a seat object | a cushion box (0.46 x 0.46 x 0.11) under the hips, `seat=cush`; cross-legged: a 3 cm seat, the feet keyed past each other, hands on the knees |
| floats 14-18 cm over a 0.80 m car seat, thighs grazing the wheel | a seat above the 0.75 m feet-on-floor limit | `thigh=` + `feet_y` / `feet_z` onto the car floor; say so if the report stays |
| a manual `set(bodyz=...)` after `sit()` does nothing useful | sit owns the body height every frame | never tune bodyz under a sitter (a laugh bounce must be relative: `c.T['bodyz'].at(t) + 0.012`) |
| a seated helper that keys `bodyz` to an absolute value drops the sitter to standing height | it overwrote sit's channel | helpers key RELATIVE to the channel's current value |

## Seats and furniture for these characters

- Toy proportions: legs 0.42 m, a seat of 0.45 m lifts the hips to STANDING height, so a seated character looks as
  tall as a standing one. Low seats read right: 0.30-0.36 m (a chair row scaled 0.8: seat 0.36). Seat depth ~0.4 m.
- A desk the character sits at needs open knee space (a modesty panel + end panels): a solid desk body clipped her
  legs by 19 cm. A worker behind a counter: a raised desk (0.84-0.93 m) and a real high stool (0.74 m) with the feet on
  its ring (`feet_y=-0.3, feet_z=0.36`).
- A character leaning over a table: the table top at ~0.6 m (a 1.3 m character's shoulders are at a 0.76 m table's
  height: leaning over it sank them into the top); stand at the edge, `lean=-15..-18`, hands beside the thing.
- Feet out ahead, splayed: `sit(..., feet_y=-0.5)` then `set(-1, dur=0.01, fL=(0.15, -0.5, 0.0), fR=(-0.13, -0.47, 0.0))`.
- Feet up on a desk or a pouf: `feet_y`, `feet_z` (coloured shoes on dark soles: plain black feet next to the hands read
  as two more hands).
- Props on a lap sit ON the thighs (seat top + 0.05-0.11 m) or in the hands (`hold()`); a wallet "resting" at the
  hands' height clipped the thighs by 2-9 cm.
- Hands on a counter or table: the hand target at the top + 0.05 m (the hand ball's radius), computed from the hip
  (`to_local()` in engine_api.md §12). Arms 1.4-3 cm inside a counter top were flagged on every reach.

## Dresses and robes

A standing skirt cone hangs straight down through a seat to the floor. Seated: hide the skirt parts and lay a soft
lap shape over the thighs, parented to the torso pivot (a bevelled box read as a box, a white disc as a plate):
```python
def seated_dress(cz, m):
    for suf in ('_skirt', '_hem', '_apron'):
        o = cz.find(m.name + suf)
        if o: o.hide_render = True; o.hide_viewport = True
    from mathutils import Matrix
    dm = cz.toon(m.name + '_skirtm', '#1e6a6a'); am = cz.toon(m.name + '_apronm', '#ece4d0')
    lap = cz.sphere(m.name + '_lap', 0.2, (0, -0.16, 0.05), dm, ol=0.006, parent=m.torso_pv, segs=32, rings=16)
    lap.data.transform(Matrix.Diagonal((m.rt * 2.4 / 0.4, 1.12, 0.36, 1)))
    drop = cz.cyl(m.name + '_lapdrop', m.rt * 1.18, 0.09, (0, -0.35, -0.05), dm, r2=m.rt * 1.12, ol=0.005, parent=m.torso_pv, verts=32)
    drop.data.transform(Matrix.Diagonal((1, 0.35, 1, 1)))          # the hem drapes ~8 cm over the knees
    cz.box(m.name + '_lapapron', (m.rt * 1.5, 0.34, 0.014), (0, -0.2, 0.125), am, bevel=0.006, ol=0.004, parent=m.torso_pv)
```
Big bellies: pose presets are in body units and ignore the belly; a character with belly 1.28 crossed his arms inside
his robe for a whole sequence. Pass the hands in front: `hL/hR y = -(c.rt x c.belly + 0.07)`.

## Lying, upside down, raised

- Lying on the back: `lean=+90` on the torso (the head follows), or a pivot parent: `common.lie(c, loc, roll=30-50)`
  (engine_api.md §12) rolls the body toward the camera about its long axis, then `set(-1, hroll=80)` turns the face
  upright for a camera in front (0 = the face reads as grey bars, -80 = upside down). Never roll the camera 90 deg (a
  man lying in a coffin read as a man standing in a box) and never rotate the head object alone.
- The head (0.24 radius) is deeper than the torso: a body resting on a floor puts the head through it. Root height =
  pillow top + head radius, plus a pad under the body.
- Propped up in bed facing the camera: `lean +72, hroll +70`; sitting up: `lean 38, hroll 40` (tested in 4 variants;
  a sit-up at lean 12 showed the back of the head).
- Lying face down: `hpitch -62` lifts the face (+62 pushed it into the ground).
- Upside down (head-first in a bin): parent the root to an empty flipped 180 deg about Y; in the flipped frame the feet
  at local z 0 = a straight leg, +0.2 = a bent knee (0.5 m from the hip overstretches the noodle into a pole). Hide the
  parts inside the bin and mark the bin `cz_contact_ok`.
- On a porch or a hidden step: `lift(c, z)` (the root rides an empty at that height; the rig is untouched).
- In bed under a quilt the legs report clips into the quilt: acceptable only while the quilt covers them on screen;
  say so in your summary.
