# Engine v10: Hi-Bit pixel art, libraries, full-screen b-roll, the layout check

Read this before writing any scene in the Toon Studio. It wins over older advice in this skill (320x180 and "strict
16 colours" describe the legacy looks; they still work, unchanged).

## 1. The look
- **Hi-Bit** (look "Hi-Bit 640", `settings.color.palette = 'hibit'`): 640x360 art, about 100 colours (99), every surface shaded in
  five steps (`RAMP[name]` = [deep, shadow, mid, lit, top]), skies with up to 4 colour stops (`S.sky = [top, ..., horizon]`),
  emissive surfaces with `facet(ramp, { unlit: true })` (screens, neon, LEDs, lit windows), cast shadows two steps dark.
- Colours only through `RAMP` names and `C` keys, never hex. Ramp names in every look: grey white black blue cyan sky red
  orange yellow green lime plum teal navy dark sand stone skin skinDark hair brown wood asphalt concrete glass gold purple
  pink denim olive neonPink neonCyan paper rubber metal carbon (+ yellowFlat limeFlat orangeFlat cyanFlat).
  Hi-Bit adds `C` keys: ink steel snow royal ice aqua mint leaf olive cream peach coral rose violet lavender magenta pink
  brown tan skin gold asphalt concrete neon. `HIBIT` (boolean) and `PALETTE` (the colours) are exported.
- Light per shot: `lightPreset(S, 'day' | 'sunset' | 'night' | 'neon' | 'interior' | 'studio' | 'dramatic')` (lib/sets.js)
  sets S.sky, S.bg, fog and S.light together. Change light between chapters; night scenes get unlit windows and neon.

## 2. Libraries (lib/, import from '../lib/<file>.js')
- `props.js`: the prop kit (devices, consoles, chips, vehicles, street furniture, studio furniture, diagram props) at real
  scale (1 unit = 1 m), plus `place(obj, x, z, { on, rotY })`, `arrange(objs, { row | grid | arc, gap })`, `onTop(obj, s)`.
  `PROPS` lists every prop with a one-line description: use a kit prop before building one; a missing prop goes in
  scenes/shared.js (or models.js) and is checked alone at full size first.
- `sets.js`: environment kits `citySet highwaySet beachSet hillsSet roomSet officeSet labSet chipSet serverSet
  phoneMacroSet stageSet` - each returns `{ group, spots, cam }` (named standing spots and good camera positions).
- `camera.js`: `const rig = camera(S)` in build, `rig.update(t)` in update; `rig.frame(subject, { size, angle, side })`,
  `rig.move('dollyIn' | 'arc' | 'craneUp' | 'follow' | 'reveal' | 'flyover' | ..., { subject, t0, dur })` chainable;
  `CAMERA_MOVES` lists them. Moves start and end at rest, never shake.
- `anim.js`: `person2({...})` articulated people; `pose(rig, 'idle' | 'walk' | 'run' | 'sit' | 'typeAtDesk' | 'holdPhone' |
  'point' | 'wave' | 'shrug' | 'celebrate' | 'think' | 'drive', t)`, `walkTo`, `attach(rig, 'handR', obj)`; motion:
  `followPath, driveCar, spin, bob, blink, flowPackets, assemble, explode, countUp, typeOn` (all pure functions of t).
- The exact options of each are in the file headers (read the header of every lib you use).

## 3. Full-screen b-roll (the real thing, the whole frame)
- When the narration names something real (a game, a phone, a console, a person, a project, a headline), SHOW IT: a
  full-screen b-roll shot, not a small card. `brollShot({ t0: cue('word', near), keys: ['img1', 'img2'], label: 'What it is',
  credit: 'Source', treatment: 'crt' })` - several keys make a montage with pixel dissolves and alternating Ken Burns moves;
  `from` / `to` = `{ x, y, z }` (focus 0..1, zoom >= 1) choose the move. Treatments: 'crt' (default: the real picture with
  fine scanlines), 'clean', 'pixel' (re-drawn in the palette, for pictures that should blend into the 3D world).
- The layout picks itself: a picture under ~900 px wide is drawn as pixel art (never a blurry upscale), a portrait or square
  picture (box art, a phone screenshot, a poster) becomes a POSTER standing in the frame over a dark pixelated copy of itself;
  `side: -1 | 1` moves the poster left / right so a stat or caption fits beside it (never HUD text over the poster).
  `force: true` keeps the treatment you asked for.
- `broll(key, t, o)` draws one inside another shot's draw (e.g. full screen behind a stat). `imageMat(key)` puts a picture
  ON a 3D screen (a phone running the game, a monitor, a billboard): the most convincing way to show "this runs on that".
- Images: real, relevant, readable; one image = one idea; label every b-roll with what it is. Blur or crop anything
  pirated or private. Long videos: a full-screen b-roll at least every 30-45 s where the narration names something real.

## 4. Variety (a long video must never feel samey)
- No two consecutive shots with the same set + camera angle + shot size. Alternate: wide establishing -> medium -> close
  detail -> b-roll -> diagram -> person -> ...
- Every chapter gets its own set and light (city sunset, phone macro at night, studio diagram, server room, bedroom...).
- People act: walk in, hold the phone, point at the diagram, celebrate a result. Machines move: fans spin, data packets flow,
  parts assemble / explode.
- Shot length 3-8 s in long videos; cut on sentence starts (cue the first word of the sentence).

## 5. The layout check (check_layout) - must say Clean before you hand a chapter over
- `overlap` two solid things (userData.solid) pass through each other -> move them (place / arrange) or mark a meant contact
  with `userData.over = [other]`.
- `float` a thing that should rest (userData.rest) hangs in the air -> `place(obj, x, z, { on })`.
- `camera` the camera is inside a solid -> move the camera or hide the object for that shot.
- `cut` a subject (an object returned from build) is mostly outside the frame -> reframe (`rig.frame`) or `userData.bleed = true`.
- `hud` two HUD texts / cards cover each other, or the chapter tag (top left: keep x < 110, y < 24 free) -> move or retime.
- `edge` HUD text / cards in the outer 4 % of the frame; `small` HUD text below 4.4 units -> bigger.
- `blank` the frame as seen (3D + HUD) is almost one flat colour: nothing is shown (the subject is behind the camera, off-frame
  or hidden, or the set was never built) -> frame the subject (`rig.frame`), check it is visible. Reported instead of `dark` /
  `empty`; only a near-black blank frame with S.dark = true counts as meant ("the screen goes black").
- `dark` the 3D picture, or the frame as seen (a black HUD wash over it), is almost all near-black; `empty` the 3D picture is
  almost only two colours (a bare floor and wall with one small thing) -> bring the subject close, dress the set, add people;
  make a mood with light and colour, never with a black wash (S.dark / S.sparse = true only when the words call for it).
- Screens are never black unless the words say "off": imageMat(key) or a built-in screen ('game', 'code', 'boot', 'desktop').
- Props from the kit already set userData.name / size / solid / rest; your own props must set them too.
Then render_frames: look at every shot at full size (what is out of place, in the way, unreadable, not what the words say).
