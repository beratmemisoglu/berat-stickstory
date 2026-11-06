# Pitfalls (3D cartoon shorts, Blender engine)

What went wrong in the lab's five films (141 logged failures, the builders' notes, the critics' logs) and the rule that
fixed it. One line each: `- <what you see>: <why> -> <the rule>`. Grows with every real build.

## Faces

- A face that reads "stamped" or dead: a dead-frontal head -> 15-20 deg of yaw plus a tilt in every shot (`set(hyaw=14..24, hroll=3..6)`).
- Features gone below MS: they were drawn too small -> keep the engine's feature sizes (face_style values >= 1), frame faces MS or closer for a face beat.
- `sly` shows wide round eyes: that is the preset (a big ring side glance) -> `knowing` for a lidded, quiet side glance + smirk.
- `nervous` reads as sunglasses (half lids over grey ovals) -> `worried` for nervous beats.
- `grin` closes the eyes: the preset's happy arcs -> `c.faces.append((t, 'grin', True, {'em': 0, 'eo_L': 0.9, 'eo_R': 0.9}))`.
- Glasses read as sunglasses: filled lens discs, or grey eye ovals behind thick frames -> open ring lenses; thick frames get `face_style={'dot_eyes': True}`.
- Brows land on the hair as one dark bar: the hairline sits too low -> hairline `front` ~0.68 (43 deg) for characters whose brows must read; the engine draws raised brows over the hair.
- A shout reads as a calm remark: the normal mouth range -> `talk(..., loud=1.6-2.0)`.
- The mouth shut in the middle of a quoted line: the talk window was shorter than the words -> `talk(t0, t1)` spans the whole line (first word's start to last word's end).
- MCU faces grey under night light: the face shader drains the light -> a small shadowless POINT (~16 W, cool) parented to `head_pv`, in front and to the window side.
- A lying character's face reads as grey bars: the face is projected on the head's front, now pointing up -> roll the body 30-50 deg toward the camera and `hroll +80` (sitting.md).
- `CZ FACES MISSING` / blank heads: facegen had no Python with Pillow -> `CZ_PY=<python>` in the render's environment.
- A magenta head in a dissolve: the face images stop at the shot's range -> keep dissolve pads within 24 frames (the engine pads 24) and bake the pads.
- An unknown face name renders `neutral` silently; an unknown `extra()` name crashes the bake -> names from catalog.md only.
- Faces that don't land on the word: the expression takes 5 frames -> key `face()` at the word's start (gestures 3-5 f before it).

## Motion and acting

- `pose('rest', hL=...)` sent the other hand back down: a named pose sets all its channels -> one hand: `set(t, hL=...)`.
- Arms straight up read as antennae -> wide and forward: `hL=(0.42, -0.14, 0.8), hR=(-0.42, -0.14, 0.8)`.
- A turn spins the long way round: the yaw number interpolates -> turn to the equivalent angle nearest the current yaw (`14 + 360 * round((y_end - 14) / 360)`).
- Characters face away in "to camera" beats: yaw 180 faces +Y -> yaw 0..20 faces the camera side.
- A lean / pitch / roll went the wrong way (lean +82 toppled backwards): signs are not obvious -> test every sign with a 3-frame 0.4x render. (lean + = back, hpitch + = face down, hyaw + = to the character's left.)
- A helper that keys a channel dropped a sitter to standing height: it set bodyz to an absolute value -> key relative to `c.T[ch].at(t)`.
- Big-bellied characters' arms vanish inside the body: presets ignore the belly -> hands at `y = -(c.rt * c.belly + 0.07)`.
- Big gestures look stiff -> `antic=0.1-0.15` on points, shrugs, cheers, presents.
- An arm swings through an armrest on a walk -> walk paths at least 0.45 m from furniture.
- A walker steps through a closed door -> every entrance animates its door (one door bake per door: two bakes on one door overwrite each other).
- People inside house walls for seconds before their cue (3655 contact samples) -> park actors far off the set until 0.03 s before their cue, start them 0.12 m behind the door.
- A walker appears 1.3 s into his own entrance shot -> start him inside the frame edge on the shot's first frame.
- Reaches end inside the counter or table: the hand ball has a radius -> targets at the top + 0.05 m, computed from the hip (`to_local`), lean / twist ~0 while reaching.
- Ball hands can't tie, point a finger or give a thumbs-up -> add a finger cylinder or a mitten + thumb to the hand empty; stage gags as big readable silhouettes.
- A finger-up that reads as a hand on the head -> the hand above the head (1.4 x head height), arm straight; a shrug = both arms out at the elbows, shoulders up.
- Time cuts inside one file leave characters mid-move -> at the cut `place(t, ...)` (dur 0), `stand(t, dur=0.001)`, poses with `dur=0.001`; park the unused cast far away.
- Holds that feel dead -> blinks on beats, glances (`look`), small head turns; NEVER an idle wobble (the camera creep and the engine's 0.8 % breath are the life).

## Sitting (sitting.md)

- Legs through seats, bodies sunk in cushions: hand-tuned seat offsets -> `sit(t)` with no offsets, the root ~5 cm behind the seat centre; read `CZ SIT` / `CZ CLIP` / `CZ SITCHECK` first.
- "Sitting on air" at a desk: the forward rays took the desk top over the knees -> move the root back or force `seat=`.
- A forced seat sank the sitter: matrix_world was stale -> `bpy.context.view_layer.update()` before `sit(seat=...)`.
- A driver sinks to the road: his root was parented to the car -> unparented root + a linear position key riding along.
- Sitting on the bare floor reads as on air -> a cushion object to sit on.
- Seated characters as tall as standing ones: 0.45 m seats lift 0.42 m legs to standing height -> seats 0.30-0.36 m.
- A standing skirt cone through the seat to the floor -> hide it, lay a lap drape (`seated_dress`).
- Wallets / boxes "on the lap" inside the thighs -> seat top + 0.05-0.11 m, or in the hands.
- Legs through a solid desk body -> desks with open knee space (modesty panel + end panels).
- A lying head through the coffin floor: the head is deeper than the torso -> root height = pillow top + head radius, a pad under the body.

## Holds (props in hands)

- A white board through a head: the prop came with its own sheet, and the whole root follows the hand -> hide the parts that stay behind; grip by the handle (`offset = -(R @ handle)`).
- A prop sits at the world origin before it is picked up: hold() leaves unheld frames where the prop is -> build it parked out of sight (z -50) or key its visibility.
- A prop jumps home when the hand lets go -> `release='stay'` (the default); a bounce after the release starts from the prop's own world position.
- A candle held at the hip vanished in a nightshirt -> carry props up in front of the chest (it also lights the face).
- A held spear crossed the face in a 3/4 MCU -> hold it out at x -0.3 and shoot from the other side.
- A phone handset would not follow the hand: it was parented to its base -> clear the parent first.
- A prop slid across a counter, then picked up -> bake the slide yourself (`carry`), hold only from the pick-up.
- Insert hands as a black stick with a ball (a "lollipop") covering the subject, 4 critic rounds -> ONE cuffed forearm + mitten insert-hand helper for every insert, entering from the nearest frame edge, smaller than the target, never crossing it; when you fix a helper, grep every sequence that uses the old one.
- A hat taken off hid the whole face (brim to the camera) -> re-parent the hat parts to one empty, blend head -> hand, hold it by the brim, crown out.

## Outlines (ink)

- Lines of 0.4-6 mm on one flattened sphere: object scale distorts the hull -> bake the scale into the mesh (`o.data.transform(...)`), never `scale=` on outlined meshes.
- Outlines vanish on big objects -> 9-10 mm on big parts (6-7 mm vanishes on a 2 m object), ~2 % of a small prop's width, 5 mm on tiny far things.
- Thin parts become ink spikes (thatch teeth with a 9 mm outline) -> thinner outline or none on thin parts.
- An ink ring at every joint of stacked cones -> one shape.
- A cap or vest rendered solid black: a Solidify added after `cz.outline` wraps the part in ink -> thickness first, then `cz.outline`.
- A boolean bite lost its outline -> re-add the outline after the boolean.
- An outlined sticker or decal floats -> decals without outline, 1.2 mm off the surface.
- A dark line through tape on a seam: hull shells stick out past free edges -> no outline on open strips.
- A spike on gathered curtain folds: even-offset solidify -> plain offset.
- Glowing glass or a globe with an ink rim reads as a flat sticker -> no outline on glass and glows.

## Light

- No sun patches, no stripes: a window prop on a solid wall, a ceiling overhang shading it, the sun aimed past the camera's view -> real holes, and aim the sun at what the camera sees (~35 deg; ~24 deg to stripe a desk and the floor; ~14 deg to get past desk rows).
- `window_blinds` blocks a sun completely -> its parts `visible_shadow = False` and a slat cutter outside the window (thin boxes, `visible_camera = False`) with a strong spot behind it.
- Blind stripes run the wrong way -> test, don't reason: the slat line is the wanted stripe direction projected into the plane perpendicular to the sun.
- Light shapes washed out: fills too strong (stripes only 14-18 % above the floor), shadowless area lights flooding the set through the toon lift -> fills down ~40 %, a narrow spot on the character instead of a face area light.
- Light-power changes do nothing: the toon lift (light ** 0.62) compresses them -> darker base colours and a stronger key move the mood.
- Lavender shadows and golden lit stripes can't both happen: the shader multiplies the lights' colours -> `cz.toon(ramp=(shadow, lit, lo, hi))` per material, lo / hi measured (engine_api.md §11).
- A ramped surface lost its stripes after a light change: a ramp is tuned to the light levels -> never touch those lights without re-measuring.
- Colours render 15-25 % lighter than the hex (top faces most) -> pick every base a step darker; keep surfaces under decals mid-value.
- Hair turns orange / salmon under a warm key (it lifts a base ~3x) -> darker hair bases (#2e180b, #7a3f20 instead of #5c2c0f, #c4642a).
- Flat paper blows out under a key -> darker paper, lift 0.45.
- Screens, neon and pools clip to white -> screen strength ~1.15 (not 1.6), neon ~1.3, glow pools strength 1 with a radial ramp.
- Candles and lanterns glow but light nothing -> a warm POINT at the flame (60-80 W lantern), a ~140 W warm POINT under each lit porch ceiling.
- Lights inside a wall light nothing (torch lights inside a 3 m wall) -> put them at the flame (META torch_lights).
- Big area lights near the floor light everything above them; a visible light cone reads as haze in every frame -> small spots tucked behind things; a shaft = nested soft prisms, faded when the camera is inside one.
- "Realistic" nights unreadable at phone size, dark saturated sets murky -> nights blue-violet and BRIGHT (moon 2.2-4.2, fills 1600-5200 W, world 0.6-0.9), interiors light; value, not just colour.
- A night room muddy purple-brown: warm bases x blue light -> tint the night room's own pictures blue.
- Glass and sky cards block the sun -> `cz.no_shadow()` and add your own names to it (`'outside'`).
- A sun outside lights the room through the exterior -> exteriors unlit emission, casting no shadow.
- Shadows silently dropped at full size ("Shadow buffer full"): decorative spots casting shadows -> `shadow=False` on decorative lights; grep every full-size log for the line and A/B one frame.
- EEVEE GI "improvements": the toon shaders end in Emission, GI never reaches them -> leave GI off; contact shading is the built-in AO.
- A practical's globe at the frame edge renders as a pure-white flat shape -> lower glow (~1.4), no outline, or out of frame.
- A glowing mote in a close-up reads as an orb; fireflies filled a third of a CU -> motes and fireflies away from camera spots, none in close shots.

## Sets and props

- A picture, a prop or the words read from the kit instead of your project -> name your files relative to the project
  (`pics/sign.png`, your own `props/<kind>.py`, `cz.words()`): the project folder is looked in first. `ctx.lab` is the
  read-only kit: never build paths to your own files from it.

- A wall prop facing the wall: wall props face -Y -> left wall (x < 0) rot +90, right wall rot -90, a back wall facing -Y rot 0.
- A new angle sees a hole, a bare world colour, the void under a diorama -> build all 4 walls, close every corner, extend blocks deep; a 360-degree sky drum outdoors (a 160-degree arc leaves the world colour in reverses); the world colour = the sky's top colour.
- Two sky drums overlap -> sets with drums far apart (80 m).
- A distant city looms like a courtyard wall -> scale ~0.42 and haze toward the horizon.
- A partition the wrong width, a chair through a desk's knee space: scale is not the prop's size, knee spaces are off-centre -> read each prop's META and kw before staging.
- Decals and floor inserts z-fight -> 1.2 mm off a surface, flat inserts 1 cm above the floor.
- No printed graphics on boxes or cylinders (no UVs) -> pictures on planes (cards wrapped on round walls).
- Box-projected textures break where separate wall boxes meet -> one continuous wall mesh, or a world-position mapping in your own material.
- Seams at a 1.4 m repeat, a stain repeating as a grid of spots -> cross-fade half a repeat in the texture maker, clean copies without stains.
- Wood grain runs the wrong way (it follows the object's X) -> build horizontal bars standing and turn them.
- Box-projected roof tiles read as hazard stripes -> give roofs their own UVs.
- A picture on the wrong object: `cz.toon` reuses materials by name -> the picture's name in the material name.
- Things that read as other things at phone size (leaves as paddles, crumpled paper as rocks, smoke as pillars, dust as cotton, a pearl as a ping-pong ball, a hat cone as a gong, wallpaper flowers as polka dots, a pipe as a ladder, a coffin as a drawer) -> shape over detail: pointed folded leaves, flat-shaded paper, thin soft smoke without outline, dust lifted 15-35 cm, low-contrast motifs at 0.42 m; check every hero prop in a still at its shot size.
- Same-colour neighbours merge (a dais as red as its throne) -> a value step between touching parts.
- A big flat prop face fills a third of the frame -> frame it out or give it wear.
- Clutter that never reached the frame -> build the extras inside each camera's frustum and check it in a render.
- A cable dropping in front of a character reads as a rope -> cables on walls and ceilings.
- A new board placed in front of a porch turned an MCU into a CU of a poster -> check every placement against every camera that sees it.
- A scene of 4000 objects builds slowly (bpy join 0.45 s per call) -> build merged meshes with numpy; hundreds of copies = linked mesh data without outline.
- A dressing file crash left the set bare (`CZ DRESS FAILED`) -> read the log; never name a local variable after a module (`os`) or a one-letter helper (`T`).
- A magenta box: `CZ PLACEHOLDER` (the prop failed: film pictures, a bad option) -> read `CZ PROP FAILED` above it; catalog.md lists the props that need pictures the engine does not ship.
- Text in the wrong script or language (a Japanese marker in an American office) -> check every label against the story; CJK text needs a CJK font (Arial renders boxes).
- Pillow drawing on a transparent layer replaced pixels (opaque brown "wear" dots) -> draw on the RGB image with `ImageDraw.Draw(img, 'RGBA')`, alpha-composite clouds.
- A generated picture of an object came with a room baked in -> ask for it isolated on plain white, crop it, or build it in 3D.
- A clock running backwards -> hands rotate about Y, positive = clockwise from the front.

## Camera (camera.md)

- The camera inside a wall, a cabinet, a door leaf, an armrest, a head (an all-orange frame) -> check every camera spot against doors, furniture and the cast; inserts from above, beyond the reach of hair.
- The back of a head in a close shot; a reaction CU with the partner's head in the foreground -> `rel=` angles, turns finished before the camera lands; inner thoughts turn to the camera.
- A subject framed where it WAS (it walked out of its MCU) -> `at=` the landing time.
- A flight through a column, a prop or a house -> a `path=` waypoint on the open side (and the waypoint not inside a prop).
- No hold between two framings -> the next flight starts at `t - fly / 30`: keep >= 0.3-0.4 s of hold.
- A line spoken during a flight -> land 0-3 f before the word, hold through it.
- "The camera passes through him": a long-to-wide lens blend during the flight + motion blur -> change the lens before or after a flight.
- A 358-degree spin smear mid-pan: an euler flip at +-180 -> `cam.bake` unwraps; unwrap anything else you key across 180.
- Fast flights smear to pure blur -> shutter 0.3 (default); a keyed short shutter on a very fast move.
- A face cut through the eye, a sign cut by the frame edge, a walker leaving the frame -> subject on a third, whole head + ~10 % headroom, signs whole or out; check the shot's last frame too (creep moves things).
- A reveal pull-out pushes an off-centre subject out -> aim between subject and set, checked with hfov = 2 atan(6.75 / lens).
- A two-character reverse loses someone -> compute the azimuths, pick the lens that fits them in +-hfov/2.
- Computed aims ~0.1 of the frame off -> render, measure the head, correct the aim.
- f/1.4-1.8 close-ups blur a dressed set to mush -> `min_fstop` 2.4 for dressed sets.
- A long creeping hold dollied into a foreground head -> creep ~0.0004 there.
- The moon / sky cut off -> `c.obj.data.clip_end = 3000`.
- A closer framing made the head huge: the bound (a glass plane) clamped the eye and widened the lens -> watch `CZ CAM ... lens ->` lines; move the bound or use an exact `frame()`.
- Every counter shot from behind the customer: his face never shows, the clerk hidden behind the register -> shoot two-person counter scenes from the side where both faces show.
- The same framing four times -> vary height, side, lens.
- Framing math from a 36 mm habit lands outside -> the sensor is 24 mm VERTICAL.

## Transitions

- A dissolve or a match cut played as a hard cut -> step through every boundary frame by frame; dissolve windows 8-12 f, measured (their faint first and last frames don't show on a sheet).
- A frozen pose or a magenta head inside a dissolve: the pad frames were not baked -> bake B0..B1 beyond F0..F1 in both shots.
- The film jumped back to the outgoing shot after a dissolve -> check the ASSEMBLED frames around every transition (the assembler now hands the outgoing shot's late frames to the incoming one).
- A match cut 10 frames late -> find its real first frame at step 1; the incoming file writes the print's screen box per frame (`world_to_camera_view`) for assemble.json `matchcuts`.
- One continuous take split over several files drifts -> stage the take once in a shared helper; each file bakes only its own frames.
- A picture of one shot inside the next (a print, a bowl) shows the wrong frames -> list them in `prerender` and render that shot's frames first.
- A short that should loop doesn't -> the last framing ends exactly on the first shot's opening camera.

## Rendering and the GPU

- Every frame took 90 s: 8-10 Blenders on one 16 GB card -> ONE queue, at most 4 Blenders including the app's preview; add to the queue instead of starting a second one.
- A "successful" render that failed: Blender exits 0 when the script throws -> treat `Traceback` in the log as failure.
- Shots "missing" from a log: `grep | head` showed only CLIP lines -> filter `CZ CLIP ` lines out before reading the rest.
- A broken PNG after a stopped render -> render_queue only counts whole PNGs; never trust a frame from an interrupted run.
- Every shot failed to build after a sed edit: a `# comment` appended inside a call's argument list -> edit with Edit, `py_compile` every edited file before a render.
- Blinks moved between partial re-renders: Python's `hash()` is salted per process -> seed anything per-character with `zlib.crc32(name)` or a fixed seed.
- A slow first frame mistaken for a cost: it includes the shader compile and a cold face cache -> time from the second frame, with faces drawn.
- The preview restarts endlessly: test renders written into the project root or `tex/` -> test output under `renders/`.
- Halving samples to save time -> 48 -> 24 saves only 16-28 % (the build, ink and faces dominate); use 12 for tests, leave finals to the export.
- A render wrote into the engine folder -> always pass `--out`.

## Assembly and the finish

- The app or the queue skipped a shot: no literal `F0, F1 = a, b` line, or the shot is missing from assemble.json `shots` -> both, always.
- A helper module treated as a sequence: its name was letters + digits (`sets2.py`) -> helper names without a trailing number.
- The grade from one film failed on the next (lum 99 / sat 157) -> probe the grade per film and LOOK at the samples (a gain hit the numbers and washed bronze to cream); settle the grade before the holds.

## Never (the owner's rules)

- No rubber stamps, red verdict plaques or boxed red words slammed on ('CLOSED', 'DENIED', 'CASE CLOSED' ...): show the fact as a real object.
- No notice that the voice is AI, anywhere.
- No real brands, logos, people, shows or channels; never the reference short's characters, sets, props or jokes: invented names and our own designs only.
- Nothing graphic in a dark comedy (a bone painted out of a grave): the joke lives in the objects and the faces.
