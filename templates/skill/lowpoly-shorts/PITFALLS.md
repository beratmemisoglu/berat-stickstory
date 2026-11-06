# Pitfalls (Low poly shorts) - read when something misbehaves; add what you learn

## Assets
- "asset X is not loaded": the engine preloads only ids written as plain strings in scenes/*.js and models.js (and the
  first argument of S.prop / S.person / S.animal). An id built at run time (`'prop.' + name`) is invisible: write it out, or
  `await preload('prop.x')` at the top of the scene file.
- Search with several words and synonyms; tags carry pack words (kenney, kaykit). Whole phrases rank first ("slot machine").
- Kenney / KayKit sizes are approximate: give `height:` (or width / length) for anything next to a person.
- The base bodies' COLOR_0 is a mask, not a colour: the engine switches vertex colours off (else heads render black).
- `lowpoly_asset add` answers "already in the library as X" when the same file was saved before: use that id.
- Only uncompressed .glb (no Draco / Meshopt / KTX2: there are no decoders), under 8 MB.

## People
- Rooms are closed on all four sides and have ceilings, and a room's camera is kept inside the room. A set's spots face the
  camera side; `desk` / `counter` spots face the furniture (the camera then sees the back of the person: frame from the side).
- Hair, beards and eyebrows are re-bound to the body's own skeleton (lib/actor.js attach). Don't use anim-runtime's
  attachToSkeleton on these bodies: it kept the file's inverse binds and the hair came out turned 180 degrees.
- A walk that starts while another clip plays blends in over 0.2 s; walk() ramps its speed over the blend (no slide).
- hold(): the socket cancels the bones' world scale; a prop added with its own scale keeps it. grip 'phone' for a phone at the
  ear (Idle_TalkingPhone_Loop) and cards held up; 'grip' for cans, bottles, handles; look at a close-up once.
- sit(): the clips assume a 0.45 m seat. The seat a person sits on is ignored by the clipping check; armrests are not.
- The drawn face replaces the modelled eyes and lashes; expressions change only with expr() (or face: in the look).

## Rendering
- The low-res render target needs a depth buffer (it once had none: hair drew over faces, far walls over people).
- Moody: without a key on the subject people become silhouettes; the moody light follows S.subject (set by S.camera's `on`).
- Bloom eats white surfaces in Moody: keep table tops and walls below white, glow only lamps, screens and neon.
- Split screens show the middle half of each pane: the pane camera frames the subject smaller by itself (fill .4).

## Staging (learned on the demo videos)
- Spots that face furniture (casino 'slots', office 'desk') put the camera behind the furniture: give `yaw` (deg, the
  direction from the subject to the camera: 0 = +z) or `side`, and check_layout's "camera inside" until it is quiet.
- A face close-up needs room in front of the face (Moody face distance ~1 m): turn the person toward open space (the
  machine / desk behind them) instead of squeezing the camera between a face and a cabinet.
- Hands on props: measure where the clip's hand goes (see docs PITFALLS for the measured clips), then place the person so
  the hand lands on the prop (bill acceptor, buttons, a belly). KK_Interact = reach + press at 1.19 m with the right hand.
- A thing a person holds flat between the fingers (a banknote): `hold(b, { grip: 'palm', rot: [-PI/2, 0, PI/2],
  offset: [0, .012, .065] })` - more than 7 cm out and check_layout calls it "not in the hand".
- Sneaking: Crouch_Fwd_Loop (KK_Sneak_Loop sinks the toes on these bodies).
- A robot / machine that follows a hand: its tick reads `boneAt('hand_r')`; once the person falls, aim it at a fixed
  point (else the arm stretches to the floor).
- Wide boxes frame far away in 9:16 (the width rules): compose vertically (a coin STACK, not a row of coins).
- Split screens show the middle half of each pane: place pane B's subject so the caption (75% height) falls on empty
  cabinet, not on its numbers.
- Clip names written only in comments are not preloaded: put them in an exported array (`export const CLIPS = [...]`).
- The loop shot replays the opening's build at negative times: start the walk-in late and close (1.5 m, ~1.7 s before 0)
  so the hero is in frame for the whole loop.

## Timing
- `say` is searched forward from the previous shot's words: if a shot's words repeat earlier in the narration, the shot
  after it finds the next occurrence. A "say miss" means the words differ from the timeline (a mishearing): copy them.
- loopShot() replays the opening shot so it ENDS on the opening frame; walks that start at the opening's first frame are
  standing still in the loop's earlier part.

## Learned in the self-iteration pass (engine 3)
- Faces are the generated expression sheet (expr names map to its cells: neutral talk happy grin laugh smug shocked scared
  worried angry yell sad crying grimace thinking disgust sleep dead wink). Mesh eyebrows are off by default (brows: 'mesh').
- Bodies default to build 'normal' (the male base is a bodybuilder as modelled; 'athletic' keeps it).
- A walk's speed comes from the clip's own planted foot per phase: never move a walker by hand. A crouch walk ends crouched.
  check_layout 'feet ... slides' over 3.5 cm is real: look at 3 frames 0.1 s apart before changing anything.
- Hands: fingers('wiggle') for tickling / typing, 'point', 'fist', 'claw', 'open' (a palm offered).
- A visual metaphor is ONE object with a visible change (a WIN sign dropping over a LOSS sign), not a stamp on a prop.
- Don't repeat the same set + framing in neighbouring shots; Moody ~24 cuts/min (mean 2-2.4 s), Bright ~30.
- 16:9: overlay px positions are written for 1080 x 1920 and mapped; put panels beside the subject (the standing subject's head
  is at the top centre). check_layout's 'covered' finds it.
- The procedural head option (head: 'stylised') was judged worse than the library head: leave it off.

## Learned on three narrated shorts (engine 4)
- Lying (KK_Lie_Idle_Loop): the clip floats ~0.42 m: root y = surface - .42 (bed top .47 -> .05) and root.userData.airborne = true.
  At ry 0 the body lies along z, head toward -z, on its right side facing +x.
- A walk ends in Idle_Loop at its end time: a gesture started before that is overridden. Start gestures after the walk ends.
- With a keys camera (`S.camera([...])`) set `S.subject = actor` yourself, or the Moody key light follows nobody.
- 9:16 two-shots: put the two people along the camera axis (over the shoulder), never side by side across the frame.
- grip 'grip' adds an offset; with your own `rot` use grip 'palm' + offset (a hanging briefcase: rot [-PI/2, 0, 0], offset [0, 0, .22];
  a rod across the fist: rot [0, 0, -PI/2], offset [-.25, .03, .04]).
- 'hat' in a look doesn't show on the library heads: skip hats.
- A hyphenated word is one timed word: say 'a seventeen', not 'a seventeen year'.
- Lightning / flashes: S.flash on every bolt whites out the frame; flash the first and last only. Sprint_Loop's 'feet float 11 cm'
  is its flight phase (fine); run() with Jog_Fwd_Loop floated and slid on these bodies.
- In 9:16 the camera behind foreground trees: random scatter needs a clear corridor where the camera goes (keep trees out of it).

## From the audit of the three finished shorts (2026-10-12; review board: node scripts/lowpoly-review.mjs)
- Chairs placed with ry + PI faced away from the table: every seated dealer's shins went through the chair back. Chairs face
  their table; check: through (calf ... passes through chair).
- A rug put with { width: 5.5 } scales uniformly: 7 cm thick became 18 cm and people's feet sank into it. Give rugs a width
  AND a small height (or a flat floor texture). Check: support (a foot sinks into rug).
- root.userData.airborne = true on a lying person silenced the feet check AND every through check: the body sank into the
  bed unseen. Lie / Lay / Sit clips are already exempt from the feet checks; never mark people airborne.
- A hanging briefcase held with offset [0, 0, .22] swung 22 cm off the hand and through the leg on the walk (check: through,
  the briefcase ... passes through the thigh). Hold closer, or a smaller case.
- A hand-over with the prop held up by the giver only: the case hung beside his head, the taker's hands down. Two holds at
  the same moment, both hands at the prop (qa.md: the check cannot see this).
- A sitting clip rotated onto the back for 'asleep' puts the legs up in the air. Use the Lie clips for sleeping.
- Labels ('CON MAN', '7/7', 'NO EYEBROWS') on: the head sat on the hair; put them beside the head or above it with room.
- Lightning: a flash on every bolt strobes (1-2 s of white frames, 'washed-out' / 'strobing' in the image pass). Flash once.
- White surfaces under a lamp (paper, a sheet, a window) blow out in both looks: tint them grey / cream.
- Teal trees, salmon rocks and a skin-coloured top break the look: natural greens / greys, a shirt that reads as cloth.
- The camera keeps the framing of the first frame it draws: a shot first drawn mid-way framed differently (fixed in
  engine 5: every shot steps once at its start). Head turns / finger poses kept last frame's turn on bones the clip has
  no key for (fixed: they start from the rest pose each frame).

## Sound (your own music, recorded effects)
- **Commons fetch found nothing**: every Wikimedia Commons file URL ends in `?utm_source=...`, so an extension check with
  `$` failed every file. Strip the query before checking. Also: Commons rate-limits downloads (HTTP 429) after ~40 files.
- **ffmpeg afade `d=.15` = Invalid argument** (this ffmpeg build): use `duration=0.15` with a leading zero.
- **Music level slider did nothing audible**: the user's track went in at its own loudness (a quiet track at -22 dB was 33 dB
  under the voice). Fix: level every user track to -16 LUFS first (loudnorm in mix.py), then apply the slider dB.
- **loudnorm hides level changes**: measuring a music-only mix after the final normalisation shows the same loudness at any
  gain. Measure the voice-to-music ratio while speaking (mix_report.json) instead.
- **LL-Q... files on Commons are spoken words** (Lingua Libre pronunciations: "whoosh", "acclamation"), not sound effects:
  never take them.

## Final shorts pass (2026-10-12)
- **Chairs turned away from the table**: a chair put with `ry + Math.PI` faces away, and every sitter's shins go through
  its back. A chair faces the way its sitter faces (same ry); check one still before copying a seating helper.
- **lookAt on a body that faces away twists the head ~180 degrees**: turn the body (`ry = atan2(dx, dz)` toward the
  target) and use lookAt only for small head turns.
- **Seats: shins through a crate / step**: the seat block must be shallow and behind the knees (depth ~0.34 m, its front
  edge at the sitter's knees); a 0.5 m deep box under a sitter always swallows the calves.
- **Full-white flashes strobe on phones**: S.flash and the 'flash' transition peak at 70% white since ENGINE_VERSION 8;
  keep lightning flashes ~0.1 s (2-3 frames) and the bolt light moderate.
- **A tiny hill = the world's edge**: a hill under a low camera needs a wide, low mesh (radius ~10 m, scale.y ~0.1) and
  a camera above the slope, never a 'low' camera into a 4 m sphere (near-clip opens it, the slab fills the frame).
- **Pack tints**: tintMix .45 leaves the nature pack's teal trees / salmon rocks; use ~.8 and grey for rocks.
- **Roles, not bodies**: write `{ role: 'main', name, outfit }` (and 'dealer', 'police', 'friend', 'doctor', 'expert') so
  the project's settings.characters picks the people; a body/hair written in models.js ignores the picker.
- **Still open**: lying in bed (KK_Lie_Idle_Loop is legs-up beside the bed: no lie-on helper yet), a person sitting in a
  canoe (calf through the hull even at seat y .34), and a real two-person hand-over.
- **Default music bed in every new short** (user: 'sound is still the old engine'): the app wrote a music bed into a new
  lowpoly beds.json and the skill said 'a music bed is ALWAYS there'. Now: beds.json starts empty, sound_design.py skips
  music beds unless "music": true and ambience unless "ambience": true (room tone max -45 dB); skill/prompt say music is the
  user's choice.
- **Wikimedia Commons 429s leave EMPTY files** that ffmpeg reads as 'End of file' (skipped silently in the build). After ~40
  downloads Commons blocks for a long time: fetch in small batches, check sizes, and prefer whole CC0 packs (Kenney,
  OpenGameArt) over single Commons files. Commons 'whoosh'/'roulette' searches return music and spoken words: check titles.
