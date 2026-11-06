# Camera moves (lib/camera.js, engine v15+)

Never compute camera coordinates by hand. Pick a named move: it frames the subject by shot size + angle + side, starts
and ends at rest, keeps the picture under 20 deg/s (it lengthens a move that would be faster and says so in the check),
never puts the camera inside the subject or behind / inside the set (see Occlusion), keeps a person's head in frame, and
is deterministic (frames render out of order). Customise with options;
fall back to `S.cameraRig.path` / `S.camera` keys only for a move this catalog does not have.

```js
import { camera } from '../lib/camera.js';
build(S) {
  // ... build the set FIRST (walls, pillars, desk, props): C.move checks the camera against what is in S.scene
  const C = camera(S);                                       // one per shot
  C.move('dollyIn', { subject: f, t0: S.t0 + .5, dur: 4, from: 'MS', to: 'MCU' })
   .move('arc', { deg: 20 });                                // chained: starts where the push ended, t0 = its end
}
```

## Framing API

- `C.frame(subject, o)` -> `{ p, l, fov, roll }` key (usable in `S.camera([...])` and `S.cameraRig`). Options:
  `size`, `angle`, `side`, `lens` (mm, 35 mm equiv.) or `fov` (16:9 vertical fov; 9:16 is handled by the engine),
  `lead` (look room in the facing direction, fraction of frame width; default .06 for MS-ECU people), `height` (camera
  height, m), `pitch` (deg, + = looking down; overrides the angle), `offset: [x, y, z]`, `part: 'wrR'` (a joint of a
  person for ECU of a hand: head, wrR/wrL, fiR, elR, knL...), `facing: [x, z]` (override the subject's front), `roll` (deg).
- `C.move(name, { subject, t0, dur, ...options })` adds the move (chainable). `subject` defaults to the previous move's;
  `t0` defaults to the end of the previous move (else the shot start); `dur` has a per-move default.
- `C.hold(size, { subject, t0, angle, side })` = `C.move('static', ...)`. `C.match(key, otherSubject)`: the same size /
  angle / side on another subject (match cut). `C.last()`: the key where the last move ended. `listMoves()`,
  `CAMERA_MOVES` (registry: `aka`, `group`, `intent`, `params`), `SIZES`, `ANGLES`, `lensFov(mm)` are exported.
- **subject**: an Object3D, a person (`figure()` / `cast()`), `[x, y, z]`, a Vector3, a Box3, or an array (two-shot:
  the union, the camera square to the line between them). Front = the object's local +Z (people face +Z).
- **Region subjects** (a map / terrain mesh with `userData.ground`, anything flat and >= 40 m wide, or `{ extent: m }`):
  sizes mean a share of the region (EWS = all of it, WS 30 %, MS 7.5 %); `site: thing | [x, y, z]` is where on it the
  frame centres. The far plane (and a fog that would hide the region) is raised for the move and noted; for km scenes
  still set `S.studio({ near, far })` yourself.
- **Headroom**: people at FS-CU keep the top of the head >= 6 % of frame height inside the top edge for the whole move
  (walking subjects: their head at every frame); the camera rises to keep it. ECU / `part` / `headroom: false` exempt.
- **Small props**: the camera stays >= the near plane + margin from the subject's surface and never goes under / into
  the thing it stands on (desk, shelf: found by a ray down at build); it backs off with a longer lens instead.
- **Occlusion** (build time): rays from the subject to the camera at 5 points of the move hit the shot's solid meshes
  (not the subject, its clothes, glass / transparent, back-faced domes, things < 8 % of the distance). If blocked, the move
  is rebuilt from other sides (+-35, +-70, +-110, 180 deg), closer with a wider lens (x.6, x.4) or higher (+18, +35 deg),
  first clear one wins (noted in the check). None clear: the clearest is kept and `console.warn` names the move and what is
  in the way. `avoid: false` turns it off, `avoid: [objects]` checks only those. A chained move keeps its start (warns
  only). So: call `C.move` after the set is built in `build(S)`.
- **Chaining**: a move with no `from` / `size` / `angle` / `side` / `lens` / `fov` / `pitch` / `height` starts exactly
  where the previous `C.move` ended (no jump). Give any of them to re-frame (that is a cut point: put it at a new shot).
  Between two moves the camera holds. Rig moves win over `S.camera` keys.

**Sizes** (people, by how much of the body the frame holds; objects by how much of the frame their box fills):

| size | aka | person | object fill | default lens |
|---|---|---|---|---|
| EWS | XWS, ELS, establishing | ~8 % of frame height, high angle | .1 | fov 40 |
| WS | LS, wide | full body ~45 % | .35 | 34 |
| FS | MWS, full | full body ~80 % | .55 | 32 |
| MFS | cowboy | knees up | .68 | 30 |
| MS | medium, mid | waist up | .8 | 30 |
| MCU | | chest up | .92 | 28 |
| CU | closeup | head + shoulders | 1.1 | 26 |
| ECU | XCU, detail | face (or `part`) | 2.2 | 22 |

**Angles**: `eye` (people: the camera at their eye line; objects 8 deg down) | `low` (-18: power, threat) | `worm`
(-40, at the floor) | `high` (30: vulnerable, overview) | `overhead` (60) | `top` / `birdseye` / `topdown` (straight
down) | `profile` (side 90) | `dutch` (roll 10). **side**: degrees round the subject from its front, + = toward its
left hand (default 20 for people, 30 for objects, 0 for a two-shot). `ots` and `pov` are moves.

## The moves (name (aka) - what the camera does - when - example)

### Static / framing
- **static** (hold, lockedOff) - locked-off frame - dialogue, evidence, a beat of stillness - `C.move('static', { subject: f, size: 'MCU' })`
- **dutch** (dutchTilt, canted) - rolls in to a tilted horizon (10 deg) and holds - unease, the moment it goes wrong - `C.move('dutch', { subject: f, roll: -10 })`
- **twoShot** (two, groupShot) - two or more together, square to the line between them, slow 4 % creep - a meeting, a relationship - `C.move('twoShot', { subject: [a, b], size: 'MFS' })`
- **handheld** (shake, documentary) - a held camera, 0.25 deg seeded shake < 1.5 Hz, eased in/out - urgency, reportage (a declared style) - `C.move('handheld', { subject: f, size: 'MCU', seed: 2 })`
- **ots** (overTheShoulder) - behind `over`'s shoulder onto the subject (MCU) - conversation, interrogation - `C.move('ots', { subject: b, over: a, shoulder: 'left' })`
- **pov** (pointOfView, firstPerson) - from the subject's eyes, at `at` or ahead - what they saw; cut to it from their CU - `C.move('pov', { subject: a, at: door, push: .3 })`

### Pan / tilt (camera stays, the view turns; lands on the subject)
- **panLeft** / **panRight** (pan) - turns 18 deg onto the subject - follow the eye across a place - `C.move('panLeft', { subject: f, deg: 15 })`
- **panReveal** - starts on something else (`from`) or 40 deg away, pans onto the subject - the reveal - `C.move('panReveal', { subject: f, from: door })`
- **tiltUp** (tilt) - from the feet / base up to the framing - size someone up - `C.move('tiltUp', { subject: f, size: 'MCU' })`
- **tiltDown** - from above (22 deg) down onto the subject - arrive in a place - `C.move('tiltDown', { subject: sign, deg: 25 })`
- **tiltReveal** - low angle, base to top of a tall subject (FS) - scale, power - `C.move('tiltReveal', { subject: tower, size: 'WS' })`

### Zoom / lens (camera stays, the lens changes)
- **zoomIn** / **zoomOut** (zoom) - fov only, one size step (or `amount`) - surveillance, archive, attention narrowing - `C.move('zoomIn', { subject: f, to: 'CU' })`
- **slowZoom** (creepZoom, kenBurns) - 15 % fov over 7 s - tension under narration - `C.move('slowZoom', { subject: f, dur: 8 })`
- **dollyZoom** (vertigo, zolly) - pulls back x1.8 while zooming in, subject size held - realisation, dread - `C.move('dollyZoom', { subject: f, dir: 'out' })`
- **rackFocus** (rack, focusPull) - held frame, focus shifts to `to` - shift attention near -> far - `C.move('rackFocus', { subject: photo, to: f, frame: [photo, f] })`

### Dolly / truck / pedestal (the camera travels)
- **dollyIn** (pushIn, push) - travels toward the subject, one size tighter - importance, "this is the one" - `C.move('dollyIn', { subject: f, from: 'MS', to: 'CU', dur: 5 })`
- **dollyOut** (pullOut, pullBack) - backs away, one size wider - isolation, aftermath, context - `C.move('dollyOut', { subject: f, to: 'WS' })`
- **creep** (slowPush) - 8 % closer over 6 s - keep a still image alive - `C.move('creep', { subject: board, dur: 8 })`
- **truckLeft** / **truckRight** (truck, crab) - slides sideways, view parallel - glide along a line-up, a desk, a wall - `C.move('truckRight', { subject: desk, dist: 1.2 })`
- **parallax** (parallaxSlide) - slides sideways, look locked on the subject - depth, foreground sliding past - `C.move('parallax', { subject: f, dir: 'left' })`
- **pedestalUp** / **pedestalDown** (pedestal) - straight up / down, view level - over a table edge, settle to a level - `C.move('pedestalUp', { subject: f })`
- **pushThrough** (flyThrough) - flies through an opening (`through`: its centre) onto the subject - enter a new space - `C.move('pushThrough', { subject: f, through: [0, 1.5, 4], to: 'MS' })`
- **trackSide** (tracking, track) - travels beside a walking subject, side-on, look room ahead - a journey, the walk to the door - `C.move('trackSide', { subject: walker, side: -90 })`
- **follow** (trackBehind, chase) - behind the moving subject - we go where they go - `C.move('follow', { subject: walker })`
- **lead** (trackFront, leading) - in front, backing away as they come - determination, confrontation - `C.move('lead', { subject: walker, size: 'MS' })`
- **steadicam** (walkAndTalk, gimbal) - smooth follow behind the shoulder with a 1.5 cm walking bob - a human presence - `C.move('steadicam', { subject: walker })`

Simplest correct call: build the walker at its start pose, pose it in `update()` (`walkAt` / `place`), then
`C.move('trackSide', { subject: walker, size: 'MS' })` - nothing else. The camera reads the subject after `update()` and
follows its displacement softly (pure function of where it is now: a walk that starts at speed, at any time, eases in;
`soft` m, default .3 frame heights; `easeIn` s, default .8, ramps the start). A walk that STOPS dead mid-move needs
`path: t => [x, y, z]` (the subject's position; followed through a `smooth` .5 s window, so starts and stops both ease;
no matching walk `to` needed). `dir: [x, z]` fixes the heading.

### Orbit / crane
- **orbitCW** / **orbitCCW** (orbit) - circles the subject 90 deg (seen from above) - study an object, a monument - `C.move('orbitCCW', { subject: car, deg: 60, size: 'FS' })`
- **arc** - a short arc <= 30 deg (default 24, `dir: 'left'`) - depth on a held moment - `C.move('arc', { subject: f, deg: 20 })`
- **hero360** (orbit360, turntable) - full slow circle with a slight rise (34 s+) - the hero object, the whole site - `C.move('hero360', { subject: model, size: 'WS' })`
- **craneUp** (jibUp) - rises to a high angle, one size wider - leaving, the bigger picture, chapter end - `C.move('craneUp', { subject: f, to: 'WS' })`
- **craneDown** (jibDown) - from high wide down to eye level - arriving, joining the people - `C.move('craneDown', { subject: f, to: 'MS' })`
- **craneReveal** (jibReveal) - from near the ground up to a high wide frame - reveal the scene and its scale - `C.move('craneReveal', { subject: site, to: 'EWS' })`
- **boomOver** (overTheTop) - from the front up over to straight down - a summary of a desk, a body, a layout - `C.move('boomOver', { subject: table, size: 'MS' })`

### Drone / aerial
- **flyover** (droneFlyover) - passes over the target at height, looking 38 deg ahead-down - travel, approach - `C.move('flyover', { subject: bridge, height: 40 })`
- **droneRise** (droneReveal) - rises from head height and tilts down to an EWS - establishing reveal - `C.move('droneRise', { subject: town })`
- **topDownDescend** (godsEye) - straight down, descending EWS -> WS with a 25 deg turn - a crash site, a body, a crowd - `C.move('topDownDescend', { subject: wreck })`
- **aerialOrbit** (establishingOrbit) - high slow 45 deg orbit at EWS - the establishing shot of a place - `C.move('aerialOrbit', { subject: ship, deg: 30 })`
- **satelliteZoom** (mapZoom, earthZoom) - straight down from very high to the site, ALWAYS descending (start >= 3 x the end; a region: its whole extent in frame, a `site` thing: 12 x its WS) - where in the world - `C.move('satelliteZoom', { subject: regionMap, site: crashSite, dur: 8 })`

On a region subject `flyover` (height .12 x extent, over `site`), `droneRise` (starts 2 % of the extent up),
`topDownDescend` (whole region -> 30 %) and `aerialOrbit` (whole region) scale to it. Big zooms get lengthened: read the note.

### Stylised (snap) - for a cut on motion ONLY
- **whipPan** (swishPan) - 70 deg in 0.45 s - end one shot on it, start the next in it - `C.move('whipPan', { subject: f, t0: S.t1 - .45 })`
- **crashZoom** (snapZoom) - two sizes tighter in 0.35 s - a punch on a hit word - `C.move('crashZoom', { subject: f, t0: cue('dead') })`

These two are the only moves check_layout's ABRUPT flags; use them only across a cut on motion and say so in the
shot's comment. Every other move passes ABRUPT with its defaults.

## Customising

- Change the defaults first: `size` / `from` / `to`, `angle`, `side`, `lens`, `deg`, `dist`, `dur`, `lead`, `offset`.
- Need a frame for a move the catalog lacks: `const A = C.frame(f, { size: 'MS' }), B = C.frame(f, { size: 'CU', side: -30 });`
  `S.cameraRig.path({ t0, dur, at: u => ({ p: lerp of A.p..B.p, l: ..., fov }) })`.
- A long move is lengthened, never shortened: the check prints "<move> at <t> lengthened a -> b s". If the shot is too
  short for it, give a smaller `deg` / `dist`, or cut.

## Rules

1. One move per shot is the norm; chain at most two or three (hold, move, hold). Hold >= 1.5 s around big moves.
2. Push >= 2.5 s, orbit >= 4 s, picture turn <= 20 deg/s, nothing abrupt: the defaults guarantee it; don't override `dur` downward.
3. Match the move to the narration: push on the word that matters, pull out on aftermath, crane up to close a chapter.
4. Snap moves (whipPan, crashZoom) only across a cut on motion. Handheld only as a declared style (<= 0.3 deg).
5. Vertical (9:16): fov keeps its 16:9 meaning; prefer MS-CU for people and `lead: 0`; two-shots get wider by themselves.
6. Look at the start, middle and end frame of every move before rendering (the subject framed, nothing inside geometry).

## Pitfalls (learnt in real builds)

- Call `C.move` AFTER building the set: the occlusion check only sees what is already in `S.scene`.
- A warn "inside / behind X" means no side / height / distance was clear: move X or re-frame; never ship it unread.
- Km maps: pass the map as subject + `site`; never frame the map's box with person sizes, and set near/far for the scene.
- Props on a desk: give the prop (not the desk) as subject; ECU fills 2.2 x the frame (the prop's surface fills it).
- Walkers: build them at their t0 pose; a dead stop mid-move needs `path`, else the camera stops dead too (ABRUPT).
- A chained move cannot dodge a pillar (its start is fixed): re-frame with `side` / `angle` at a new shot instead.
- Heads: if a hand-keyed `S.camera` crops a walker's head, use the named move (headroom is only in the library).
- A held object in close-up: give the OBJECT (or the hand: part 'hand_r') as subject at angle 'high' or 'eye' from the
  side the person faces; never a CU / ECU of a person aimed at the hands from hip level (the body below fills the frame).
