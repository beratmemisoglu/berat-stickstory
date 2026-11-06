# Reconstruction style: playbook (build any story)

How to turn a script into a reconstruction film in this style, with the tools and APIs that already exist. Quality bar:
[QUALITY_STANDARD.md](QUALITY_STANDARD.md). What went wrong before and why: [FAILURES.md](FAILURES.md).

## 0. Inputs
- Voiceover with word timings (`tts.py` gives ElevenLabs alignment, or the Parakeet pipeline). `cue('word', near)` places events on words.
- Real data for real places: `tools/bake_map.py` (OpenStreetMap via Overpass, ODbL): coastline, water, parks, airports, roads, piers, buildings with heights.
- Real media: Wikimedia Commons search, keeping public domain and CC-BY / BY-SA only. Write `media/CREDITS.json` and put the credit on screen.

## 1. World (engine.js / world.js / models.js)
| Need | API |
|---|---|
| A shot | `shot({ t0, trans, build(S), update(st, t, S) })`. `S.studio({ near, far, interior, lamps, floor })` always sets near/far for the scene's scale |
| Camera | `S.camera([{ t, p, l, fov }])` eased keys. Anything that follows a subject is computed in `update()` after the subject moves |
| City / map | `groundMesh()`, `cityMesh({ unit: 'km' or 'm', center, radius, hScale })`, `landMesh()` over water |
| Water | `riverWater(scene)`: reflective, tileable generated normals |
| Particles | `particles(parent, n, { color, opacity })`: soft sprites; `set(i, x, y, z, size, alpha)`, then `commit()` |
| Light that follows | `S.followKey(pos)`: texel-snapped shadows |
| Overlays | `tag` (with `line: true`), `place`, `quote`, `list`, `big`, `timecard`, `chapter`, `photo`, `footage`, `custom` |

## 2. Motion
- **Along a path:** a `CatmullRomCurve3` sampled with `getPointAt` (arc length). Attitude from `flightPose()` (real climb angle, smoothed bank). Drawn lines sample the same curve.
- **Events:** solve them backwards from the contact point and time (`aim + velocity * (t - T)`). Nothing appears or disappears without a visible reason (it leaves the frame, is hidden inside an effect, or fades with a cause).
- **Speeds are real:** goose 15 m/s, airliner climb about 77 m/s, walking 1-1.4 m/s, ferries about 6 m/s.

## 3. Characters (the rig)
- Poses are data (`POSE.sit / stand / brace / balance / wave / huddle`), blended with `mix` and varied with `jitter`.
- **Walking only through `walkAt(person, from, dir, distance, { blend, look })`.** Phase comes from distance, so planted feet never slide.
- **Every hand contact goes through `handTo(point, palmNormal, fingerDir, curl, pole)`, or `grip()` for handles.** `settle()` puts seated hands on the thighs; `brace(k)` puts them on the seat back ahead (front row: on the head).
- Crowds are placed so no two people can touch (at least 1 m apart on wings), with arm-out poses only at row ends.
- Check new poses in `scenes/chars.js` with close-ups before using them in a shot.

## 4. QA (run all of these before showing anything)
```
node render.mjs stills --scenes assets ...          # every asset alone, full size
node render.mjs stills --scenes chars ...           # every pose and hand contact, full size
node render.mjs stills <key times> --q audit=1      # COPLANAR lines must be 0
node render.mjs zfight 0 <end> .2                   # must print "clean"
node render.mjs flicker <t0> <t1>                   # heat map: look at anything red
node render.mjs probe <t0> <t1> "<expr>"            # smoothness of any value (camera, attitude, feet)
node render.mjs video 30 0 <end>                    # then pull consecutive frames from the MP4 at every risky moment
```
Viewing: full 1920x1080 stills, and 6 consecutive frames (`ffmpeg -ss T -frames:v 6 -vf tile=3x2`) at every transition, contact, effect and fast move.

## 5. Added with v8 (the three-film test)
| Need | API |
|---|---|
| Any region on Earth | `tools/fetch_terrain.py`, then `tools/bake_region.py <region>` (layers per period). Use `loadWorld('', region)`, `terrainMesh({ unit, center, radius, vScale })`, `heightAt` |
| A downloaded model, restyled | `story.json "models"`, then `model(key, { size/height/width, upright, look: 'tone' or 'clay', tint })`. `hitAlong(obj, from, dir)` finds contact points |
| A rigged, animated person (CC0 Quaternius mannequin, 43 clips) | `actor('ual', { height, tint })`, then every frame `a.pose(clip, t).apply()`. `clipSpeed(a, clip)` gives slide-free walking speed. `bodyFrame(a)` with `wear(obj, F, 'back' or 'head')` attaches props |
| Textures that must be there on frame 1 | `story.json "textures"` (add the `@data` suffix for non-colour maps), read from `TEXTURES` |
| Deformable bridge | `tacomaBridge()`: `set({ v, n, th, ph, gone })`, `frame(x)` for riders, `piece(x0, x1)` for falling parts. Also `deckSection()` |
| Flow lines (wind, water) | `streamlines(parent, { lines, x0, x1, field })` |
| Space | `earth()`, `moon()`, `serviceModule()` (openable bay), `stack()`, `lmCabin({ cutaway })`, `mailbox()`, `parachute()` |
| Caves | `caveEntrance()`, `crossSection({ km, bearing })` from real relief, `chamber()`, `tunnel({ length, pinch })`, `faceMask()`, `torchBeam()`, `roughen(geo, amp, freq)` (welds first) |
| Sound | `tools/mix.py <story>`: VO, a procedural bed (wind, water, drone, space) and timed effects from `story.json "audio"` |
| Free models | A sub-agent searches CC0, public-domain and CC-BY sources that need no account (NASA 3D, Smithsonian CC0, Poly Pizza, Quaternius, Kenney), checks the licence on each page and appends to `CREDITS.json` |

Asset galleries per story: `scenes/assets2.js` (Tacoma), `assets3.js` (Apollo), `assets4.js` (cave), `modelqa.js` (any downloaded model), `actorqa.js` (rig clips).
Every story is `src/stories/<id>/story.json` + `scenes/<id>.js`; render with `--story <id>` (output in `out/<id>/`).

## 6. Sign-off (no render without it)
- Every shot with people or moving bodies: `S.collide = { bodies: () => [{ name, caps: personCaps(p) or actorCaps(a) }], solids: [closed meshes] }`.
- `sh tools/signoff.sh <story> <end>`: syntax, coplanar audit, zfight and collide. It must print PASS.
- Then the manual frame review in [SIGNOFF.md](SIGNOFF.md), written into LOG.md. Only then `render.mjs video`.
