# Reconstruction engine API (engine.js, models.js, lib/)

Scenes live in scenes/*.js and import from `../engine.js`, `../models.js` and `../lib/*.js`. Units are metres, y is up.
The output frame is 1920×1080 at 30 fps (1080×1920 when `settings.format` is `vertical`, engine v14+: use `FW`, `FH`). Every module except engine.js is optional.

## A scene file
```js
import { shot, cue, THREE, E, ease, lerp, tag, timecard, chapter, place, photo, footage, source, big, sfx, C, MAT } from '../engine.js';
import { cast, POSE, mesh, box, particles, hash, walkAt } from '../models.js';
import { setup, model, hitAlong } from '../lib/library.js';
import { terrainMesh, riverWater, ll, heightAt } from '../lib/world.js';
import { figure } from '../lib/figures.js';         // the people (section "Figures", references/characters.md)

await setup({                       // only in the FIRST scene file, and only what the film uses
  region: 'tacoma',                 // assets/map/tacoma (scripts/region.py)
  models: { lm: 'assets/models/apollo_lm.glb' },
  textures: { moon: 'assets/models/moon.jpg', 'moonDisp@data': 'assets/models/moon_disp.jpg' },   // TEXTURES.moon
  images: { opening: 'assets/opening.jpg' },          // IMG.opening (web_image also adds to project.json images)
  sequences: [['fall', 120, 'assets/footage/fall']],  // assets/footage/fall/001.jpg..120.jpg -> footage('fall_f', 120, ...)
});

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const T2 = cue('Locals', 8.4);                         // the word's start time in the voice (near = rough time)
// ---- 1. the Narrows from above ----                  // this comment names the shot in the editor
shot({ t0: 0, trans: 'cut', build(S) {
  S.studio({ floor: false, near: .02, far: 200, fog: [9, 13], area: 12, key: [-14, 26, 9] });
  S.sky('#c8d1d9', '#e4e4df');
  S.scene.add(terrainMesh({ unit: 'km', vScale: 2.5, res: 512 }));
  S.camera([{ t: 0, p: [3.5, 11, 9.5], l: [0, 0, -.6], fov: 38 }, { t: T2, p: [1.6, 3.6, 3.4], l: [0, .05, 0], fov: 38 }]);
  S.over(chapter('Reconstruction · 7 November 1940', 'The Tacoma Narrows Bridge', { t0: .3, t1: 4.2 }));
  S.over(place(V(0, .16, 0), 'THE NARROWS', { t0: 5 }));
  S.over(source('Relief: AWS Terrain Tiles · coastline © OpenStreetMap contributors (ODbL)', { t0: 2 }));
} });
```

## Shots
- `shot({ t0, trans: 'cut' | 'dissolve', name?, build(S) -> st, update?(st, t, S) })`. A shot runs until the next shot's t0.
  'dissolve' dips through the studio grey; it never cross-dissolves two 3D scenes.
- `S.studio({ near, far, fog: [near, far], key: [x,y,z], target, area, soft, keyI, floor, floorY, interior, lamps: [[x,y,z,intensity]], shadowFar })`
  sets up the seamless grey room. Give every scene a depth range that fits its scale:
  - interiors: near .02-.1, far 40-120
  - km-scale maps: near .02, far 200
  - metre exteriors: near 1-2, far up to 16000

  Use `floor: false` when the scene has its own ground. `interior: true` gives soft light from inside. `area` is the
  half-size of the shadow box: keep it just big enough.
- `S.sky(top, horizon, ground?)`: the gradient behind everything.
- `S.camera([{ t, p, l, fov }])`: eased moves between keys, with absolute times. For a camera that follows something, set
  `S.cam` / `S.look` inside `S.tick(t => ...)` after the subject has moved.
- `S.tick(t => ...)` runs every frame: animation goes here, and everything is a pure function of t (no state carried between frames).
- `S.post = { ao: radius (default .5), dof: null | { focus, aperture, maxblur }, bloom: 0 }`. Keep DOF subtle and only on close shots.
- `S.followKey(pos)` moves the shadow box with a moving subject (texel-snapped, so shadows never swim).
- `S.proj(v3) -> [x, y, ok]` gives screen pixels for overlays; ok = false when the point is behind the camera.
- The RECONSTRUCTION corner badge is OFF unless the user's Look turns it on (`settings.badge: true`, Look > Corner tag, engine v20+); never add your own corner tag to replace it. `S.recon = false` hides it on one shot (diagrams).
- `S.collide = { bodies: () => [{ name, caps }], solids: [closed meshes] }` declares bodies for the interpenetration check.
  It is required in every shot with people or moving bodies. Build caps with `f.caps()` for a figure (legacy scenes:
  `personCaps(p)` / `actorCaps(a)` from lib/collide.js). Solids must be CLOSED meshes; leave out open shells such as half pipes, planes and arcs.

## Engine v7: themes, full-screen b-roll, effect transitions
- `settings.theme`: 'studio' (default, unchanged) | 'investigation' (a dark, cinematic investigative documentary, for any topic). `THEME` is the active entry of
  `THEMES` (room colours, lights, `fov`, `post` defaults incl. DoF on the look point, bloom, the grade, the mannequin
  material, overlay text colours `THEME.ov`). `C` gains `text paper paper2 type hl hl2 crimson wave dot glow` in both themes.
  Investigation: `S.studio()` builds the same room in near-black with a cool key and a rim light (`rim: false` / `[x,y,z]`);
  people are glossy porcelain (MAT.white, MAT.joint); MAT.clay/clay2/clay3 are dark greys; `S.post.dof` is on by default.
- `broll(key, { t0, t1, n, fps, from, loop, zoom, focus, pan, fit, grade, censor, credit, num, cover })`: real footage or a
  photo edge to edge (cover crop, Ken Burns, archival grade, pixel censor rects `{ x, y, w, h, t0, t1 }` in 0-1 fractions,
  bottom-left credit "[n] ; Outlet - Title (Year)"). It cuts in/out (no fade). While it covers the frame the 3D is not
  rendered. A shot that is only 2D: `shot({ flat: true, ... })` or `S.flat = true` (alias `S.skip3d`).
- `sources('A - B (2019)', ...)` numbers the film's sources in order; `cite(text, { n })` puts the same credit on any shot.
- `shot({ trans })`: 'cut' | 'dip' ('dissolve') | 'flash' (white bloom, cut on the white frame) | 'glitch' (2 frames colour
  tear + 3 frames mosaic) | 'black' (`hold: s`) | 'iris' (`iris: { x, y, w, h }`, `hold`). `transDur` overrides lengths.
- `cutAt(word, near, { lead = .04 })`: the shot start for a cut one frame before the word.
- Sound: `sfx(type, t, { gain, pan -1..1, dur })` inside build() is collected by the event pass (every shot is built once);
  effect transitions add their own sounds (flash: impact, glitch: glitch, black: riser, iris: whoosh).

## Overlays (2D, always sharp)
`S.over(item)`. Every item takes `{ t0, t1 }`. Positions are in frame pixels (FW × FH: 1920×1080, or 1080×1920 vertical). `at` is `[x, y]` or `s => s.proj(vec3)`.
Brand colour (engine v6): the look's `brand.color` ('#rrggbb' or unset) replaces the blue `C.accent` everywhere the
overlays use it (chapter kickers, the timecard bar, callouts, route lines, place dots, quote marks and highlights), moved
just enough to read on the white cards. `BRAND = { on, color, accent, ink, onDark, soft }`: `ink` = text on an accent
fill, `onDark` = the accent on dark cards. Use `C.accent` for any accent you draw; never hard-code the blue.
Text shadow: text NEVER gets a coloured glow (no red halo, no blurred coloured copy). Draw custom overlay text with
`drawText(ctx, s, X, Y, { font, align, base, ls, color, level: 'soft' | 'strong', shadow: false })` or add only the shadow
with `textShadow(ctx, s, X, Y, { level })` (current font/align); the look is `THEME.ov.shadow` (soft neutral drop shadow
+ a tight contact shadow). The kit's `glowText` uses the same shadow.
- `tag(at, title, sub, { line: true, dx, dy })`: a black name tag on a leader line. Pick dx/dy so the tag sits in empty space.
- `place(at3d, 'TITLE', { dot, fill, sub })`: a map label pinned to a 3D point.
- `timecard(title, sub)` sits bottom-left (blue bar, bold time). `chapter(kicker, title, { center })` sits top-left.
- `headline(text, { kicker, sub, y, size })`: a centred headline (no card).
- `big(value | t => value, label, { x, y, size, w, color })`: a big number on a card.
- `quote(text, who, src, { x, y, w, hi })`, `list(items, {...})`, `callout(at, text)`.
- `pathline(points3d, { t0, dur, color, width, dash })`: a route that draws on.
- `photo(key, { x, y, w, h, caption, credit, focus: [fx, fy], zoom })`: a real photo in a print frame. The credit is required.
- `footage(prefix, n, { x, y, w, label, caption, credit })`: real footage frames.
- `source(text)`: the credits line bottom-left. `custom((x, t, a, S) => draw on canvas 2D context x)` draws charts and gauges.
- Colours: `C.ink`, `C.accent` (blue), `C.red`, `C.card`. Fonts: `FONT.h(size, weight)` (Inter), `FONT.m(size)` (mono). `rr(x, ...)` draws a rounded rect.
- Other languages (engine v5+): Japanese, Korean, Chinese, Thai and Hindi letters (and Vietnamese ones) draw in a bundled
  font the preview adds under Inter and the mono font. `wrap()` breaks Japanese, Chinese and Thai lines between words (no
  spaces there); a cue may span several timed words: `cue('東京タワー', 12)` finds "東京" + "タワー". No letter spacing on
  Thai or Hindi text.

## Models (models.js): procedural clay
- `mesh(geo, mat, [x,y,z], [rx,ry,rz], parent)` and `box(w, h, d, radius)` (rounded). Materials: `MAT.clay` / `clay2` / `clay3` / `dark` / `glass` / `blue`.
- `particles(parent, n, { color, opacity })` makes soft sprites. Call `set(i, x, y, z, size, alpha)` for each, then `commit()` every frame.
  For splashes, venting and dust, use small sprites, many of them, born where the event happens (never solid balls).
- `hash(i, n)` is a deterministic random number 0..1.
- **People (our rig), LEGACY: old projects only.** New people are `figure(role)` (section "Figures" below).
  - `const crowd = cast(parent, max); const p = crowd.add({ color, scale, name })`. `name` ('the captain') is what the editor
    shows when the user clicks that person; keep the people the story talks about on `st` too (`st.captain = p`).
  - Each frame: `p.place(x, y, z, ry)` and `p.apply(POSE.stand | sit | brace | ...)` (`mix`, `add`, `jitter` vary poses).
    Hands go on surfaces with `p.handTo(side, point, palmNormal, fingerDir, curl, pole)` or `p.grip()`.
    Walking is only through `walkAt(p, from, dir, dist)` (feet planted). Then `crowd.sync()`.
  - `p.scenePos('head')` gives a joint's true world position for overlays and cameras.
- Built-in assets from the reference films: `airliner`, `cabin`/`fill`, `cockpit`, `goose`, `ferry`, `raft`, `water`.

## Library (lib/library.js): downloaded models
- `model(key, { size | height | width | length, upright, look: 'tone' | 'clay' | 'orig', tint, dark, parent })` returns a restyled
  clone: the original's light and dark parts kept as clay tones, scaled to real size, standing on y = 0. `upright: true`
  rotates a tilted scan's symmetry axis to +y. Check it in front and side views.
- `hitAlong(obj, from, dir)` raycasts to the real surface (docking ports, contact points). Never use bounding boxes for contact.
- LEGACY (old projects only; new people are `figure(role)`): `actor(key, { height, look, tint, parent })` is a rigged glTF person. Each frame: `a.pose(clip, t).apply()`; blend clips with
  weights. `a.bone(name)`, `a.duration(clip)`, `a.height`.
  - Clips in the Quaternius mannequin include: Walk_Loop, Jog_Fwd_Loop, Sprint_Loop, Idle_Loop, Crouch_Idle_Loop,
    Crouch_Fwd_Loop, Sitting_Idle_Loop, Swim_Fwd_Loop, Swim_Idle_Loop (upright treading water), Driving_Loop, Push_Loop,
    Idle_Torch_Loop, Interact, PickUp_Table, Death01, Roll.
  - Walking at the clip's own planted-foot speed: `clipSpeed(a, 'Walk_Loop')` (m/s at that height).
- `bodyFrame(a)` and `wear(obj, F, 'back' | 'head', { off, up })` from lib/cave.js put props (tanks, helmets) on a body every frame.
- `TEXTURES[key]`: textures preloaded by setup().
- Only when you have the `make_texture` tool (it is offered only when this project's image service is Google Flow, where
  pictures are free): big visible surfaces (floor, walls, table tops, counters, sofas) get a seamless 2K texture made while you
  build (`make_texture { name, material, tile_m }` -> `assets/textures/<name>.jpg`), loaded through `setup({ textures })`, cloned
  per surface with `wrapS = wrapT = THREE.RepeatWrapping` and `repeat = surface metres / tile_m` (the tool returns the lines).
  Keep them subtle and stylized, never photo-real; small things keep the procedural materials. Small details and pictures
  (framed art, posters, signs without text, screens, desk photos, food, label-free packaging) are `make_image` image planes.
  Without the tool, nothing changes: procedural materials as before.
- `model()` takes `name` too (default: the model key).

## Figures (lib/figures.js; engine v17): the people, in BOTH looks
**The source of truth is references/characters.md** (the two bodies, finishes, roles, `settings.figures`, groups, the user's
own uploaded characters, the whole `f.` API), with **references/animations.md** (the clip catalog, lib/anims.js:
`findAnims(tag)`, `f.play('<clip>')`) and **references/hands.md** (when present: objects in the hands, lib/hands.js `hold()`).
Only what those files do not cover is here.
```js
import { figure, figureGroup, loadFigures } from '../lib/figures.js';
import { sitOn } from '../lib/props.js';
const s = figure('suspect', { parent: S.scene, x: 0, z: 0, ry: .3, name: 'the suspect' });   // the role as Look > Characters says
sitOn(S, s, chair);                                     // every seated person (a kit seat, or { at: [x, seatTop, z], face: degrees })
S.tick(t => s.act('typing', { t }));                    // after sitOn: act WITHOUT seat (it would move the root again)
S.collide = { bodies: () => [{ name: 'suspect', caps: s.caps() }], solids: [desk] };
```
- Scenes name the ROLE only (never `rig` / `outfit` / `colors`): a change in Look > Characters changes every scene at once,
  and the user's per-role picks win over groups and defaults. Same figures in the Studio look (matte suits the clay set
  unless the user picked another finish) and the Investigation look.
- **Never switch actions with a ternary on t (it snaps): every change of action crossfades.** Preferred, the whole schedule
  of a figure called every frame with the time only (stateless: any frame rendered alone = the frame played):
  `f.sequence([{ act: 'stand', t0: 0, x, z, ry }, { act: 'walk', t0: 3, to: V(2, 0, 1) }, { act: 'stand', t0: 5.5 }, { act: 'sit', t0: 6, seat: .45 }], t)`.
  Step keys: `act` (an act or any catalog clip name), `t0`, `blend` (s; default `blendFor(prev, act)`: sit<->stand 0.5,
  seated<->seated 0.45, gestures 0.25, walk starts/stops 0.35, else 0.3), `loop`, `rate`, `start` (clip time at t0), `seat`,
  `x/y/z/ry` (a step without them stands where the step before ends; yaw changes turn smoothly). Walk steps (walk, walkCarry,
  jog, run, sneak + `dir` or `to`): from `from` (default: where the step before stands) at `speed` (default the clip's,
  `f.speed(clip)` m/s) or reaching `to` exactly by the next step's t0; the clip time follows the distance (no foot slide).
  `f.timeline([{ t, act, opts }], t)` is the same written as switches.
- Contact (move the object FIRST, then call act; re-solved inside every `act()` / `walkAt()`):
  ```js
  const h = f.holdTwoHand(painting, { leftAt: [-.31, -.04, 0], rightAt: [.31, -.04, 0], curl: .5, weight: 0 });   // obj-local edge points
  h.weight = ramp(.1, .8, u);            // fade the hands onto the frame (ramp is exported); f.release(painting) lets go
  f.holdTwoHand(p, { leftAt: [-.31, -.04, 0], rightAt: [.31, -.04, 0], attach: 'chest', at: [0, -.16, .24], rot: [0, Math.PI, 0] });   // carried while walking
  f.contactReport();   // [{ hands: { l: { dist, forearmIn, handIn }, r: {...} } }]: dist <= 0.02 m, forearmIn 0
  ```
- **Legacy, old projects only (never for new people):** the rigs `human` / `porcelain` / `faceted` / `masked` / `ual` /
  `mixamo` / `model`, outfits and `colors` still load (drawn as the two bodies) so old scenes keep working; `cast()` (Models)
  and `actor()` (Library) stay for an old project's existing scenes. A crowd is several `figure('extra')`s.

## Click to select (the editor, engine v4+)
The user clicks things in the paused preview and you get what they clicked (`get_selection`): an overlay (its text and the
scene line that added it with `S.over`), one person (a figure, by its `name`), a whole `model()`, a built-in asset (airliner,
car1936, ...), or the `st` entry that holds what was hit. The floor, maps, terrain and water are never selected.
- Hand-built objects: build them in one group and mark it `selectable(g, 'control tower', 'building')` (engine.js), or keep
  it on `st`. Otherwise a click selects the outermost group around the hit.
- Something that should never be selected (a backdrop, a helper): `obj.userData.noPick = true`; a ground-like surface:
  `obj.userData.ground = true`.

## World (lib/world.js): real places
- A map from `scripts/region.py` (see SKILL.md) is loaded by `setup({ region })`. Then:
  - `terrainMesh({ unit: 'km' | 'm', center: [x, y] km, radius, res, vScale })` drapes the map on the real relief
    (km maps exaggerate relief by vScale).
  - `riverWater(scene, { sun, color, scale, distortion })` is reflective water. Call `S.tick(t => w.userData.tick(t))`.
  - `ll(lat, lon) -> [x, y]` gives km from the map centre; the world position is `V(x, h, -y)`.
  - `heightAt([x, y])` gives metres.
  - Engine v16: `terrainMesh({ look: 'dark' | 'light' })` picks the map texture (default: the look's own; region.py bakes
    `map.jpg` (high-key clay) and `map_dark.jpg` (the Investigation look: dark land, light roads and runways)); `AERO` is the
    region's airport (runways, taxiways, aprons, terminals, hangars, gates in map km) when region.py had the `aeroway` layer.

## Maps and exteriors (engine v16: lib/maps.js, lib/exterior.js)
A map or an exterior gets the interiors' bar: it reads at a glance, never a pale or foggy sheet, never a white void.
- **A map shot in one call** (after `setup({ region })`; an airport: region.py `--layers roads,aeroway`):
  ```js
  import { regionMap, marker, strikeArc } from '../lib/maps.js';
  const M = regionMap(S, { center: { lat: 24.9576, lon: 46.6988 }, radius: 3 });   // km world, the look's room and light
  marker(S, M, { lat: 24.9606, lon: 46.7005 }, { t0: cue('terminal'), title: 'TERMINAL 4' });
  strikeArc(S, M, { bearing: 200, dist: 8 }, { lat: 24.9606, lon: 46.7005 }, { t0: cue('missile'), dur: 2.4 });
  camera(S).move('satelliteZoom', { subject: M.at({ lat: 24.9606, lon: 46.7005 }), t0, dur });   // named moves frame map points too
  ```
  regionMap: the look's map texture with the real roads, runways and taxiways, the smoothed relief lit by a low raking
  sun, terminals and hangars standing (aero.json), airliners at the gates, the background and fog of the look (fog only far
  past the frame), no DOF. o: `center` (a point: `{ lat, lon }` or `[x, y]` km), `radius` (km the shot covers: frame the
  place, not the whole region), `vScale` (1.6), `smooth` (4), `look`, `sun: { az, el }`, `buildings`, `aircraft`, `hScale`,
  `studio: false` (keep your own room). Returns `{ terrain, at(p, up) -> Vector3 on the ground, km(p), buildings, aircraft,
  gates, radius }`. `marker()`: a dot + pulsing ring resting on the ground (`title` / `sub` add a place() tag).
  `strikeArc(from, to)`: a path through the air that draws itself (from `{ bearing, dist }` = a launch site off the map),
  a glowing head, an impact flash and ring at `t1`.
- **The world outside** (metres): `horizon(S, { time: 'day' | 'afternoon' | 'dusk' | 'night', kind: 'airport' | 'city' |
  'desert' | 'flat', y, center: [x, z], dist (700), dir: [x, z] + arc (deg: only the sector a window sees), ground, sun
  (false in a room that has its own key), sunAz })`: the sky gradient, the sun, a ground to the horizon (0.6 m under y), far
  silhouettes in the haze (far terminals, hangars, a control tower, light masts / a skyline / desert ridges), the look's fog.
  Call it in EVERY exterior and in every interior with windows (the gate hall's glass shows the apron, never a void).
- **An airport apron** in front of a facade along x at z = 0 that faces -z (`at: [x, z]`, `yaw` move and turn it):
  `apron(S, { y, x0, x1, depth, stands: n | [x, ...] | [{ x, model, front, size }], spacing (48: airliners need ~43 m),
  model ('airliner': the scout's model; default the built-in airliner with landing gear), front ('+z' | '-z' | '+x' | '-x':
  where the model's nose points in its file), noseGap (9), floor (4.5: the gate level where the bridges meet the facade),
  labels: ['401', ...], bridges, vehicles, masts, markings, time, horizon })`. Concrete with joints and the stand markings in
  ONE texture (lead-in lines, stop bars, safety boxes, stand numbers: no decals, nothing coplanar), aircraft parked nose-in
  ON their wheels, jet bridges (rotunda on a column, sloping tunnel, cab at the forward door, drive leg on wheels), service
  vehicles at work, light masts, and horizon(). Returns `{ group, slab, aircraft, bridges, vehicles, masts, stands: [{ x,
  nose, door, plane }] (world), solids, horizon }`.
- `terminal(S, { y, x0, x1, depth, lower (4.5), glazed (6.5), roof: 'flat' | 'sawtooth' | 'vault', gates: [{ x, label }],
  lit })`: a terminal's airside face (service level, the glazed gate level with mullions and the hall's glow, roof canopy).
- `restOnGround(obj, y, { wheels: /wheel|tyre|gear/i })`: stands a downloaded vehicle or aircraft ON its wheels (and pitches
  it so the nose and main wheels touch together). `landingGear(plane)` gives the built-in airliner its gear.
- Vehicles (prop contract, front +Z, also `prop(kind)` once lib/exterior.js is imported): `vehicle('tug' | 'baggage cart' |
  'belt loader' | 'fuel truck' | 'catering truck' | 'bus' | 'fire truck' | 'ambulance')`; place them with `place()`.

## Libraries from the reference films (reuse or read as examples)
- lib/bridge.js: a deformable suspension bridge (vertical waves, torsion, tear and fall), `car1936`, a crawl cycle, `streamlines()` (wind and water flow).
- lib/space.js: `earth()`, `moon()` (NASA textures via setup), `serviceModule()`, `stack()`, a cabin cutaway, `parachute()`.
- lib/cave.js: `caveEntrance()`, `crossSection()` from real relief, `chamber()`, `tunnel()` cutaway, `faceMask()`, `torchBeam()`, `roughen()`.

## Sound
- `sfx(type, t, { gain, pan, dur })` on the frame the picture shows the event. Types: whoosh, impact, thud, splash, rumble,
  creak, tick, beep, alarm, bubbles.
- Dip transitions get a soft whoosh automatically.
- audio/beds.json: `{ "beds": [{ "from": 0, "to": 70, "type": "wind" | "water" | "drone" | "space", "gain": -30 }] }`.

## Checks (the sign-off)
- check_layout runs `layoutIssues` over every 0.1 s of the film:
  - **COPLANAR:** two surfaces less than 1 cm apart, which will flicker. Checked once per shot.
  - **OVERLAP:** a body through a body or through a solid. Checked in every shot that declares S.collide.
  - **FLICKER:** a z-fight found by re-rendering with only the near plane changed. Checked every 0.5 s.
  - **FLOATING / THROUGH** (engine v3, lib/contact.js): props on screen that rest on nothing (a stone a few cm in the air, a rail
    short of its posts, a whole car hovering) and props that pass through another solid prop. Checked once per shot and every
    second. Rest it on the surface (bottom on the surface y: hitAlong / a ray down), make the parts meet, or move it. Something
    that really flies, falls or is thrown: `obj.userData.airborne = true` (`userData.noContact = true` skips it entirely).
- Fix each problem at its cause (references/failures.md). Run it again until it says Clean.

## Investigation kit (lib/crime.js 3D, lib/crimeover.js 2D; engine v7+)
Reusable devices of the Investigation look, for ANY topic (the names are historical: crime.js and crimeBoard() came from the
crime-documentary references and stay so old projects load). The story's topic decides what they show: the board pins its
players, teams, companies or events; the network grid shows who connects to whom in that field; evidence() holds that
field's papers and screens; police sets, redact() and the crime roles only in a story about a crime. Everything is a pure function of the time, closed meshes standing on what holds
them (check_layout Clean), and coloured from the theme tokens (`C.text C.crimson C.dot C.hl C.hl2 C.paper C.paper2 C.type`).
They work in the Studio theme too, but are tuned for Investigation. The 3D builders take `S` first. Sound events they add
(for the sound pass): pin, string, blip, marker, paper, typewriter, boom, stamp, glitch, whoosh, powerdown, cash.
```js
import { crimeBoard, networkGrid, sideView, evidence, darkSpace, setBedroom, setOffice, setLobby, setStreet, setVoid } from '../lib/crime.js';
import { placeTag, lowerThird, statFloater, notice, stamp, redact, chapterCard, titleCard, quoteCard, headlineCard, creditsPanel, makeDoc, decodeText } from '../lib/crimeover.js';
```
### 3D (crime.js)
- `crimeBoard(S, { w = 2.4, h = 1.4, pos = [0, 1.55, 0], rot, style: 'cork' | 'dark', frame = true, wall = true, lamp = true })` -> board.
  Board coordinates are metres from its centre on its face. Use it with `S.studio({ near: .03, far: 40, keyI: .5, rim: false })`.
  - `board.pin(photoKey | text, { x, y, rot (deg), size (m), kind: 'polaroid' | 'print' | 'note' | 'card' | 'clip', label, pin: 'red' | 'white' |
    'black' | false, t0, focus, lines })` -> item. Photos are IMG keys; text makes a sticky note (`kind: 'card'` an index card with `lines`).
    Items stand >= 1 cm proud of the cork (overlapping ones 6 mm more), a pin goes into the cork; with `t0` the item pops in.
  - `board.string(a, b, { color = C.dot, sag, t0, dur = .8, slack: { t0, dur, sag } })`: red string pin to pin, a hanging curve that
    rides over items between and draws on a -> b. `b` may be `[x, y]` (a string that stops short); `slack` lets it go loose.
  - `board.camTo(item, { t0, dur = 1.6, dist = .55, side, fov })` (chainable): eased camera travel item to item, along the string
    between them when there is one; the look point is the item (the default depth of field focuses on it).
    `board.view(item, o)` / `board.wide({ fov, side, at })` -> a key for `S.camera`. `board.highlight(item, t)`: push-focus.
  ```js
  const B = crimeBoard(S, { w: 2.4, h: 1.35 }); const a = B.pin('mona', { x: -.7, y: .25, label: 'La Joconde', t0: .4 });
  const q = B.pin('?', { kind: 'card', lines: ['WHO TOOK HER?'], t0: .7 }); B.string(a, q, { t0: 1.2 });
  B.camTo(a, { t0: 0, dur: .1 }).camTo(q, { t0: 2, dur: 1.6 });
  ```
- `networkGrid(S, { size = [24, 16], cell = .5, glow: [x, z], fog, bloom = .3 })` -> net (call it instead of `S.studio`; it sets the
  black room and `S.recon = false`). Grid coordinates `[x, z]` in metres.
  - `net.node(id, { icon, label, at: [x, z], t0, size = .8 })`. Icons (drawn, no files): pc hacker house wifi dish bitcoin phone server
    document money person building envelope globe; any other value is an IMG key (a photo square). Labels scramble in under it.
  - `net.link(a, b, { t0, dur = .7, kind: 'line' | 'arc' | 'dashed', color, height })` draws on a -> b (arcs crimson, with a bright head).
  - `net.packets(a, b, { t0, t1, every = .45, speed = 2.2, color })`; `net.state(id, 'infected' | 'locked' | 'money' | 'target', t)`
    (red skull, red padlock badge, green $$$, red target ring); `net.label(id, text, t)` scrambles to a new label (counters).
  - `net.camTo(id | [x, z], { t0, dur = 2, dist = 5, tilt (deg; first 70, then 38), yaw, fov })` (chainable): one continuous eased move.
  ```js
  const net = networkGrid(S); net.node('kid', { icon: 'hacker', label: 'D3f4ult', at: [-3, 1], t0: 8.1 }); net.node('isp', { icon: 'server', label: 'ISP', at: [0, 0], t0: 8.6 });
  net.link('kid', 'isp', { t0: 8.9 }); net.state('isp', 'infected', 10); net.camTo('kid', { t0: 8, dur: .1, tilt: 70 }).camTo('isp', { t0: 9, dur: 2.5 });
  ```
- `sideView(S, { floors: [{ name, h = 3, rooms: [{ name, w, kind: 'room' | 'stairs' | 'gallery' | 'well', door: 'left' | 'right', frames, empty,
  lamp }] }], depth = 3, slab = .25, wall = .16, fov = 11, labels = true })` -> sv. A locked side cutaway (bottom floor first; stairs
  climb left to right to the next floor, which is open above them: give that room `kind: 'well'`). No depth of field.
  - `sv.camera(t, { zoom, at: [x, y] })` -> key; `sv.spot(room, fx, fy)` -> Vector3 on a room's floor (or a stair tread);
    `sv.place(person, room, fx, ry)`; `sv.path([[room, fx, fy], ...], { t0, dur, color, dashed, dot })` a crimson route drawing on;
    `sv.solids` for `S.collide`.
  ```js
  const sv = sideView(S, { floors: [{ name: 'Ground floor', rooms: [{ name: 'Exit hall', w: 3.4, door: 'left' }, { name: 'Service stairs', w: 4, kind: 'stairs' }] },
    { name: 'First floor', rooms: [{ name: 'Gallery', w: 3.4, kind: 'gallery' }, { name: '', w: 4, kind: 'well' }] }] });
  S.camera([sv.camera(14)]); sv.path([['Gallery', .5], ['Service stairs', .98], ['Service stairs', .02], ['Exit hall', -.1]], { t0: 14.5, dur: 3 });
  ```
- `evidence(S, doc, { width = .42, yaw = -8, aperture = .32 })` -> ev: a page on a grey desk, filmed close with a tilt-shift focus band.
  `doc` is a `makeDoc` spec (below) or `evidence.fromCanvas((ctx, L) => { L.text('words', x, y, { font, color, maxW, lh }) }, { w, h })`.
  - `ev.highlight(phrase | [x, y, w, h], { t0, dur = .7 })` (yellow #E6D63A wiping L->R, rough edges; t0 = the word's cue);
    `ev.ellipse(phrase, t0)` (hand-drawn crimson); `ev.redact(phrase, t0)`.
  - `ev.key(t, phrase | null, { dist = .32, tilt = 48, turn, dx, fov })` -> key; `ev.zoomTo(phrase, { t0, dur, dist = .14, from })` -> 2 keys;
    `ev.drift(t0, t1, phrase)` -> 2 keys.
  ```js
  const ev = evidence(S, { kind: 'document', title: 'Police report', body: ['He worked on the glass cases of the Louvre.'] });
  ev.highlight('glass cases', { t0: cue('glass', 19) - .4 }); S.camera([ev.key(18, 'glass cases'), ...ev.zoomTo('glass cases', { t0: 20.5 })]);
  ```
- `darkSpace(S, { bokeh = 26, color })` -> ds; `ds.photo(key, { w = 1.1, at, t0, t1, slide = .04, dist, fov, focus })`: a borderless portrait
  standing in black space with blue bokeh, the camera sliding sideways (also `darkSpace.photo(S, key, o)`).
- Sets: `setBedroom(S, { screens: ['code' | 'game' | 'browser' | 'red' | fn(ctx, w, h), ...], rgb, bed, poster, clock })`, `setOffice(S, { screen, url,
  title, window, pendants })`, `setLobby(S, { seal: 'DEPARTMENT OF ...', glass, columns })` (seal inlaid in the floor texture),
  `setStreet(S, { houses, police: { x }, wet, night })`, `setVoid(S, { desk, chair, pool })`. Each calls `S.studio` itself and returns
  `{ group, solids, spots, lights, screens, lightsOut(t0, { dur = .35, red = true }) }`. `spots.chair` is where a seated person goes
  (`sitOn()`, facing -z); `solids` go in `S.collide` (leave out the chair a person sits on).
  ```js
  const R = setBedroom(S), p = figure('main', { parent: S.scene, name: 'the hacker' });
  sitOn(S, p, { at: [0, .42, -1.9], face: 180 }); R.lightsOut(cue('power', 27));   // the gaming chair's seat top (spots.chair, seat .42)
  S.collide = { bodies: () => [{ name: 'hacker', caps: p.caps() }], solids: R.solids.filter(m => !/seat|chair back/.test(m.name)) };
  ```
### 2D (crimeover.js), with `S.over(...)`
- `placeTag(text, { t0, hold = 2.8, x = 150, y = 690, roll: { from, to, at, dur }, frame, sub })`: place/date label, unscrambles ~0.4 s;
  `'{y}'` in the text is a rolling year (`placeTag('PARIS, {y}', { roll: { from: 1913, to: 1911 } })`). To carry it across a cut, add
  the same item to the next shot as well.
- `lowerThird(name, role, { t0, hold = 3, x = 130, y = 690 })`: name ~48 px with a soft neutral drop shadow over a faint grid plate, decodes in.
- `statFloater(value, label, { t0, hold, at: [x, y] | (S, t) => [x, y], count: { from, to, dur, fmt }, size })`.
- `notice('ARCHIVE FOOTAGE', { t0, t1 })` a neutral top-right label (never about the voice being AI: such text is dropped);
  `redact([x, y, w, h], { t0, dur })`. `stamp()` is BANNED (draws nothing): see "No slop" at the end.
- Full-frame cards (use them in `shot({ flat: true, ... })`; they cover the frame):
  `chapterCard(kicker, title, { t0, t1 })` (red grid, three dots, decodes, starts and ends on black; put it in a pause, after a
  'black' cut), `titleCard(title, { kicker, t0, t1, size })` (circuit lines, red block glitch out),
  `quoteCard({ speaker, words: [{ w, t0, t1, p }], text, photo, censor: [word | index], env: t => 0..1, t0, t1, size, lines })`
  (blurred red-duotone still or the red grid, words typing on their timings, `p: true` starts a new page, pixel-blur censor,
  crimson waveform that moves only with the voice, glitch exit), `headlineCard({ outlet, kicker, headline, standfirst, date,
  highlights: [{ text, t0, dur }], ellipses: [{ text, t0 }], punch: { t, to = 2.2, on: phrase }, t0, t1 })` (grey paper, italic heavy
  headline, highlighter on the spoken words, slow push + hard punch-in).
- `creditsPanel([['Script', 'Name'], ...], { t0, dur })`: the scrolling credits in a dashed grey panel on the left.
- `makeDoc({ kind: 'headline' | 'document' | 'tweet' | 'card' | 'letter' | 'canvas', ... })`: the documents behind evidence() and
  headlineCard (word boxes recorded: `doc.find(phrase)`); `decodeText(text, k, { t, seed })` / `scrambleAt(text, t, t0, dur)` for your own
  decoding text in `custom()`.

## No slop (bans, all looks; full SOP: references/no_slop.md)
- **No red stamp / plaque / verdict overlays**, ever: `stamp()` from lib/crimeover.js is a no-op kept only so old scenes load;
  `list(items)` item fields `mark` / `markAt` (the red verdict stamp on a list card) are DEPRECATED and forbidden: never pass them.
- **No notice that the voice is AI** (`notice()` drops 'AI-generated voice' and similar texts and logs a warning).
- **No sound effects unless the user supplied them**: the Investigation kit's overlays are silent by default (`{ sound: true }` opts in);
  don't add `sfx()` calls on your own. The voice is the user's ElevenLabs voice.
- Lighting (three-point + practicals, visibility gates), IK-attached hands on every handled prop, eased camera moves (push >= 2.5 s)
  and text holds >= 1.5 s after it settles: no_slop.md.

## Lighting rig, visibility gate, camera rig (engine v8)

**Lighting rig.** `S.lighting(preset, o)` after `S.studio()` (the kit's sets call it themselves: `setBedroom` 'practical',
`setOffice` 'window', `setLobby` 'threePoint', `setStreet` 'lowKey', `setVoid` 'void', new `setGallery` 'lowKey' with a
picture light over every frame; each takes `o.light: preset | false`, `o.subject`, `o.lightOpts`). Lights are placed from
the camera at the shot's first frame, aimed at the subject: a soft shadow-casting KEY spot, a FILL from the other side at
the preset's ratio, a RIM from behind, a WALL WASH on the first surface behind the subject (or `o.wall`), an ambient floor.
The studio's flat key drops to `o.studioKey` (.25).
- presets (`LIGHTING`): `threePoint` (key 45 deg / 35 deg up, fill 1:3, rim) | `lowKey` (noir but readable: key 55 deg,
  fill 1:6, strong rim) | `window` (low cool side key + warm bounce) | `practical` (warm low key as from the lamp/monitor,
  fill 1:2.5) | `topDown` (overhead, tables and boards) | `void` (steep pool, rim, no wash)
- `o`: `subject` (Object3D, person, `[x, y, z]`, Vector3, Box3, fn; also sets `S.subject`), `fallback` (aim point when
  there is no subject), `side` (1 / -1: which side the key is on), `az`, `el`, `dist`, multipliers `key fill rim wash amb`
  (0 = off), `keyColor`, `wall: [x, y, z]`, `practicals: [{ at, color, i, range, r, bulb }]` (visible lamps: a point
  light + a glowing bulb), `follow: true` (the rig moves with a walking subject). Returns `{ key, fill, rim, wash, hemi,
  practicals }`. A dark wall needs more `wash` / `amb`, never a brighter grade.
- The Investigation floor is now 0x24272b (was 0x141619: it read as a hole).

**Visibility gate** (check_layout, Investigation and Studio): a settled frame per shot, then every whole second, at
480x270 after the grade, before the 2D overlay (`VISIBILITY`): `DARK` mean < .10 or > 85 % of pixels < .06 | `CRUSHED`
> 60 % of pixels < .03 | `SUBJECT` the subject's projected box mean < .18 or contrast to the ring around it < .04 (needs
`S.subject` or the rig's subject) | `BLUR` the subject's depth-of-field blur (|depth - focus| x aperture) > .0075. All-black
frames (mean < .008) and transitions are skipped; flat / b-roll-covered shots are not judged. Per shot:
`S.visibility = { dark, darkPx, darkFrac, crushPx, crushFrac, subject, contrast, blur }` (a deliberate silhouette:
`{ subject: 0, contrast: 0 }`; `setVoid` sets `{ dark: .05, darkFrac: .95, crushFrac: .9 }`), `S.visibility = false` = off.
`frameStats(S)` returns the numbers. Calibration (Mona v1): the salon 0.013-0.019 mean, the landing 0.039, the door
0.043-0.072 all fail; relit with the rig 0.106-0.151 pass and read as a moody, professionally lit set.

**Camera.** `S.camera(keys, { smooth: true })`: one C2 move through all keys (natural cubic spline on a smootherstep clock:
starts and ends at rest, no stop at inner keys). `S.cameraRig` (moves chain, the camera holds between them; all smootherstep,
peak angular speed kept <= 25 deg/s by lengthening, pushes >= 2.5 s unless `snap: true`):
`push({ t0, dur, from: { p, l, fov }, to, snap })`, `drift({ t0, dur, at, by })`, `arc({ t0, dur, center, radius, y, from,
to, fov })`, `crane({ t0, dur, x, z, y0, y1, l, fov })`, `rack({ t0, dur, from, to, aperture })` (focus pull: distance,
point or thing), `hold({ t0, p, l, fov })`. `smootherstep` is exported.
**Engine v15:** `path({ t0, dur, at: u => ({ p, l, fov, roll }), ease, snap })` = any move as a function of u (0..1), limit-checked
like the others; rig moves take `roll`; `S.late(fn(t))` runs after the shot's update() every frame (a camera that tracks
what update() just moved). **Use the named moves first:** lib/camera.js (references/camera_moves.md) frames a subject by
shot size and angle and builds these moves for you: `const C = camera(S); C.move('dollyIn', { subject, t0, dur, from: 'MS', to: 'MCU' })`.
**Props (v15):** lib/props.js (references/props.md): kit props `prop(kind)`, put down by rule with `place()` / `arrange.*` (on what
holds them, facing what they serve, never overlapping; check_layout reports PLACEMENT), and the `view_prop` tool for a new prop.
**ABRUPT** (check_layout, once per shot, `CAMERA_LIMITS`): the camera sampled at 30 fps with the shot's own ticks; probe
points re-projected frame to frame give the picture's motion in frame widths. Flags: peak acceleration > 2.4 frame/s^2,
a move under 0.8 s that sweeps > 15 % of the frame, or the view turning > 60 deg/s. A cut into a moving camera is fine.
Calibration (Mona v1): the board's .1 s jump + second move 13.6, the letter's .3 s zoom 87.6 (and 63 % in .3 s) fail;
the smooth pushes and holds of the film peak at 0.43; a 2.6 s `cameraRig.push` 0.1.

## Graphics settings (engine runtime, v9)

The editor's **Graphics** panel (button next to Look) tunes the whole engine live in the preview and saves the user's
choices in `project.json` `settings.graphics` (absent key = what the look and the scenes say). The engine applies them
itself: `applyGraphics(partial, replace)` / `getGraphics()` (`{ supported, values, look, drawn }`); the host page passes
the panel's changes on without a reload. Keys (ranges as in `src/shared/gfx.ts`):
- Preview only (ignored by exports): `scale` (.25-2, the 3D image's resolution), `lite` (skips AO, DOF, bloom, soft shadows,
  MSAA), `maxFps` (host: 10 / 15 / 24). The Export dialog's "Export quality" (the app, per export, never saved here) can
  override for one export: Draft (ss 1, no AO/DOF/bloom, 1024 hard shadows, no MSAA), Same as preview (scale -> ss, lite
  -> the same cuts), Maximum (ss 3, MSAA 8x, 4096 shadows, max bitrate); Standard = these settings as saved.
- Preview and export alike: `exposure` (EV, -2..2), `toneMap` (neutral | aces | agx | none), `aa` (msaa | msaa8 | fxaa |
  msaa-fxaa | off), `fovScale` (.6-1.5, every camera), `shadows`, `shadowSize` (512-4096), `shadowSoft`, `ao`, `aoStrength`,
  `aoRadius`, `fog` (density multiplier, 0 = none), `env` (room light), `dof` (look | on | off), `dofStrength`, `dofFocus`
  (m), `bloom` (look | on | off), `bloomStrength`, `bloomThreshold`, `grain`, `vignette`, `ca`, `sharpen`, and the colour
  grade `contrast saturation cap lift gamma gain warmth tint` (a FINISH pass before the look's own grade; off while neutral).
- Export only: `exportSs` (1 / 1.5 / 2 / 3 supersampling, wins over `quality.ss`), `exportBitrate` (standard | high | max),
  `exportSamples` (1 / 2 / 4 / 8: motion blur, a 180-degree shutter, never across a cut).

**Rules for scenes:** these are the user's. Never write `settings.graphics`, never undo them in a scene (no per-frame
`renderer.toneMappingExposure`, `scene.fog` density pumping, `cam.fov` scaling or `S.post` overrides meant to "fix" a
Graphics choice), and never judge a frame by them: check_layout and Claude's frames use the saved values, so a scene
lit for the look also reads with the user's grade. Light with `S.lighting` / `S.studio`, as before; `S.post` sets the
shot's own AO / DOF / bloom, and Graphics scales or switches them on top. With no `settings.graphics` the engine renders
exactly as v8.
