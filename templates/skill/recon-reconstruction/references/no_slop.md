# SOP: no slop (every style, every video)

Written 2026-10-13 from the owner's review of crime-style v1 (`out/v1/mona_v1_standard.mp4`, scene
`experiments/recon-style/src/scenes/mona.js`). The skill copy is `templates/skill/recon-reconstruction/references/no_slop.md`
(keep the two identical). This SOP outranks pacing targets, reference-channel imitation and any older doc that says otherwise.

## What "slop" means here

Slop is anything on screen or in the mix that a viewer reads as cheap, generic or machine-made: a decoration that carries no
fact, a frame where nothing can be seen, a body that does not do what it holds, a move that jerks, a text that flashes past
unread, a sound that interrupts. **One slop frame costs the whole video's credibility.** If a shot cannot be made good,
replace it with a shot that can (real footage, a real document with a highlight, a held clean wide), never ship it as-is.

## Absolute bans (all styles: pixel, Vox/collage, flat, recon Studio + Investigation, low poly, custom styles)

| # | Banned | Why | Instead |
|---|---|---|---|
| B1 | **Red stamp / plaque / verdict overlays**: rubber stamps, boxed red words slammed on ('FERMÉ', 'LOCKED', 'CASE CLOSED', 'DENIED', 'REJECTED', 'CLASSIFIED', 'TOO FAR' verdict marks on lists) | Owner: "prohibited, straight slop, never ever have it again, not in this style not in any". | Show the fact: the real document, photo or footage with a highlight / circle / redaction on the words that matter, or the 3D action itself (the door shown locked, the hand trying it). |
| B2 | **Any notice that the voice is AI** ('AI-generated voice', 'synthetic voice', 'voice: AI', 'TTS') | Not wanted on screen, ever. | Nothing. A neutral label (`notice('ARCHIVE FOOTAGE')`, 'DRAMATISATION') is fine; `notice()` drops AI-voice texts by itself. |
| B3 | **Sound effects the user did not supply** (whooshes, booms, typewriters, stamps, blips) | "disruptive". | Voice + the user's music bed only. Kit overlays are silent unless `{ sound: true }` and the user gave the sounds. |
| B4 | **Local / placeholder TTS as the final voice** | Owner's voice is the ElevenLabs voice. | ElevenLabs (Settings voice). A local TTS take is a timing draft only, never rendered. |

Code enforcement: `crimeover.js` `stamp()` is a no-op (kept so old scenes load), `notice()` refuses AI-voice text, kit
overlays are silent by default. Engine `list()` `mark` (red verdict stamp on list cards, `templates/recon/engine.js`) is
deprecated in the docs: never pass `mark`. (Engine-side removal is pending with the engine agent.)

## Failure catalogue (symptom -> why slop -> required fix -> how checked)

| # | Symptom (seen in v1) | Why it is slop | Required solution | Check |
|---|---|---|---|---|
| F1 | Shots where nothing is visible: navy-black salon, black frame at "frame dropped", empty-wall void | The viewer sees a dark screen and assumes a broken video. | Three-point light per scene (below), practicals in frame, a lit floor/wall so the space reads. Dark *mood* comes from contrast and colour, not from underexposure. | Visibility gate (L1-L5) on start/middle/end stills of every shot. |
| F2 | Blurred grey close-ups (thumbprint, glass) where the subject is a smear | DOF/vignette ate the subject; reads as a render error. | Focus ON the subject; DOF only on the background; the subject fills >= 15 % of the frame with edge contrast. | L4 subject sharpness + eyes-on look at scale 1. |
| F3 | Old egg-head rigs, frozen or hand-posed people | Look cheap and unfinished. | Every person is the project's `figure(role)` (references/characters.md: the user's body / finish / colour per role) playing a catalog mocap clip that fits the words (references/animations.md: walk, idle, sit, talk, phone, carry, push); never `cast()` / `actor()` / the old rigs in new work. | Look at a full-size still of every person; grep the scenes for `cast(`, `actor(`, `rig:`, `outfit:`. |
| F4 | Lifting / carrying the painting: arms not attached, not moving, frame through the body | Breaks physical belief instantly. | Interaction SOP (I1-I6): IK hands on grip points, prop parented to the hand/chest, body animated by a carry clip. | check_layout contact + `hand` findings; 3 stills 0.3 s apart at the grab. |
| F5 | Static plumber "opening" a door: no body motion | A puppet, not a person. | Every verb said is acted: reach (anticipation) -> act -> follow-through; door rotates on its hinge with the hand on the handle. | Motion stills; body joints move > 5 deg across the action. |
| F6 | Abrupt camera push (sec 11) | Jerky, amateur. | Camera SOP (C1-C6): eased, >= 2.5 s push, velocity and jerk limits. | Camera velocity/jerk check (numbers below). |
| F7 | Cards held 0.7 s, unreadable | Information shown that nobody can read is noise. | Readability SOP (R1-R5): hold >= 1.5 s after the text settles + 0.3 s per extra word. | Hold timer per text item. |
| F8 | Scrambling/decoding text still scrambled when the shot ends ('FLORENTK - X7RZN...', 'vityvmtx h tugs') | Looks like a bug. | Decode completes within 0.6 s of t0 and then holds settled >= 1.5 s before the cut. | Last frame of every text item == its final string. |
| F9 | Drawn oval as a "thumbprint" | Fake evidence drawn with a primitive. | A real fingerprint texture (CC0 scan) or a real archive card with a highlight; never a primitive standing for evidence. | Look at it full size: does it read as the real thing without the narration? |
| F10 | Merged / overlapping boxes, props through each other (trunk, frame, case) | Clipping = cheap. | Contact rules: everything rests on what holds it, nothing through anything. | check_layout Clean (coplanar / through / floating). |
| F11 | Storyboard departures: the shot shows something other than what storyboard.md / the narration says | Picture and word disagree. | The picture lands on its word; a change to the board is written into storyboard.md with the reason. | Narration vs frame at every shot middle. |
| F12 | Fast cuts over shots that don't look good | Pacing used to hide weak frames; feels careless. | Pacing SOP (P1-P4): cut length follows readability; fast montage only of strong frames. | Every shot passes the gates before its length is set. |
| F13 | Red tinted scan bar across a face/painting | Decoration that obscures the subject. | Highlights frame the subject, never cover it. | No overlay over > 10 % of the subject's box. |

## What the owner liked (keep as standards)

- **Highlighting parts of real footage and documents** (depth: the doc on a desk, words highlighted, circles on the 1911 wall
  photo). This is the preferred way to show a fact.
- **The sec 11 composition** (the shadow box / glass case framed in the landing): a clear subject, foreground + background
  layers. Keep the composition, fix only the move into it.
- **Sec 19, the real media shot** (Excelsior front page, the 1913 recovery): real period media full screen with its credit.

## PRE-RENDER CHECKLIST (all must be YES before any render; write the answers at the end of storyboard.md)

1. **Visibility**: every shot's start/middle/end still passes L1-L5. No black, no grey smear, no subject lost in the dark.
2. **Lighting setup per scene** written in the scene file comment: key (dir, intensity, colour), fill, rim, practicals.
3. **Physical accuracy**: check_layout Clean; every held/carried/opened thing has IK hands on it (I1-I6); no clipping.
4. **Characters**: `figure(role)` + a catalog clip for every person (seated: `sitOn()`); nobody frozen while the narration says they act.
5. **Camera**: every move eased, push >= 2.5 s, within C3-C5 limits, no stop-start.
6. **Readability**: every text settled and held >= 1.5 s after decode (+0.3 s/word beyond 5); scrambles resolved.
7. **No prohibited overlays**: grep the scenes: no `stamp(`, no `mark:`, no AI-voice `notice(`, no verdict plaques.
8. **Sources**: every real asset has its numbered credit; real evidence is real (no drawn stand-ins).
9. **Sound**: voice is the ElevenLabs take; no sfx unless the user supplied them; no AI-voice notice.
10. **Pacing**: no shot shorter than its read time; fast cuts only in a declared montage of strong frames.

## Lighting SOP ("ultra important")

Every scene gets a written three-point setup plus practicals:
- **Key**: the motivated source (window, lamp, monitor, skylight), 30-45 deg off the camera axis, 15-35 deg above the subject.
- **Fill**: opposite side, 25-50 % of the key (dark looks: 25 %, never 0). Hemisphere/ambient so shadows keep detail.
- **Rim / back light**: behind the subject, 60-120 % of the key, separates head and shoulders from the background.
- **Practicals**: visible lamps/windows in frame with a light near them, so the dark has a reason.
- **Set light**: a pool on the wall/floor behind the subject so the space reads (no flat black void behind people).

Numeric gates proposed for the engine agent's visibility checker (frame at render resolution, luminance Y = 0.2126R +
0.7152G + 0.0722B on sRGB 0-255; subject box = projected bounds of the shot's subject/selectable):
- **L1 frame**: mean Y >= 45 (Investigation) / >= 90 (Studio, flat, Vox); fewer than **35 %** of pixels with Y < 16 (crushed).
- **L2 subject**: mean Y inside the subject box >= 70 and >= 1.4x the mean Y of the surrounding ring (box grown 25 %).
- **L3 detail**: >= 20 % of subject-box pixels with Y > 90; Y p95 - p5 inside the subject box >= 80 (it has shape, not a flat blob).
- **L4 face / hands / held prop**: mean Y >= 80 on the face or hand box, p95 - p5 >= 60; Laplacian variance inside the box >= 60 % of the
  frame's sharpest region (not blurred out).
- **L5 clipping**: fewer than 2 % of pixels at Y >= 250 except on a declared flash frame.
- A shot that fails is relit (raise fill/rim, add a practical, move the key), never just brightened in post.

## Interaction SOP (carry, hold, lift, open, hand over, handshake, push)

- **I1** Every prop someone handles has named grip points (frame: two side bars at hand height; door: handle; case: lid edge).
- **I2** Hands are IK-solved to the grip points for the whole contact (wrist within 2 cm of the grip, palm facing the prop).
- **I3** During the contact the prop is parented to the hand (one hand) or a carry anchor between both hands / against the chest; it
  moves with the body, never on its own path.
- **I4** The body plays a matching mocap clip (reach, lift, carry walk, push, open) with anticipation before contact and settle after;
  arms, spine and head move.
- **I5** No clipping: prop vs body, prop vs furniture and hand vs prop interpenetration <= 1 cm (check_layout `through` / `hand`).
- **I6** Handshake / hand-over: both hands meet at one point at the same frame; the object changes parent on the frame of the hand-over.
- Checked with 3 stills 0.3 s apart at contact, release and mid-carry, at scale 1.

## Camera SOP

- **C1** Every move eases in and out (smoothstep / easeInOutCubic or a critically damped spring). No linear starts, no snaps.
- **C2** A push-in or dolly lasts **>= 2.5 s**; an orbit >= 4 s; a hold >= 1.5 s before and after a big move.
- **C3** Linear speed <= 0.25 x subject-distance per second; angular speed <= 20 deg/s (pans/orbits), <= 8 deg/s for a close-up.
- **C4** Jerk: the speed may not change by more than 50 % of its peak within any 0.2 s window except at the eased ends.
- **C5** No stop-start: one continuous move per shot (or one hold then one move); never two moves with a dead stop between.
- **C6** Handheld shake only as a declared style choice, amplitude <= 0.3 deg, low frequency (< 1.5 Hz).

## Readability SOP

- **R1** Any text holds >= **1.5 s after it is fully settled** (decode finished, typing finished) + 0.3 s per word beyond 5.
- **R2** Scramble/decode effects finish within 0.6 s and must be settled on the last frame they show.
- **R3** Min sizes at 1080p: body text >= 28 px, labels >= 22 px, credits >= 16 px; contrast >= 4.5:1 against what is behind.
- **R4** Never over the subject, never cut by the frame edge, never two tags at once.
- **R5** Document close-ups: the highlighted phrase is in focus and sharp; the DOF blur only on the rest of the page.
- **R6** Text never gets a coloured glow (no red/crimson halo, outer glow or blurred coloured duplicate: the owner: it "reads
  as cheap"). Soft neutral drop shadow only: the engine's `drawText` / `textShadow` (`THEME.ov.shadow`: black ~0.5, blur
  10-14 px, 2-3 px down, plus a tight ~0.3 contact shadow). Coloured glow stays allowed on non-text marks (grid floors,
  dots, strings, waveforms). Checked by `reconcrimekit` (source grep + no red ring around text in the labels still).

## Pacing SOP

- **P1** A cut happens when the shot has been read, not on a fixed rhythm: never cut faster than R1 and L-gates allow.
- **P2** Shorter cuts (< 1 s) only in a deliberate, declared montage where every frame is strong on its own (passes all gates).
- **P3** "Scenes need more intention and more care": each shot has one idea written in storyboard.md (what the viewer should see).
- **P4** Reference-channel pacing numbers (median ~2.3 s) are a ceiling on boredom, not a licence for unreadable frames.

## How this is enforced

- `templates/skill/recon-reconstruction/references/no_slop.md` (this file) is a mandatory read in SKILL.md and in the recon
  build / Ultraedit prompts (`src/main/claude/sessions.ts`), and named in every recon project's CLAUDE.md (`projects.ts`).
- The two global bans are in the central prompt text for every style (build + Ultraedit) and in every style skill's docs.
- `scripts/drive.mjs reconcrimeprompts` asserts the SOP is in the Investigation build prompt and CLAUDE.md and that no skill /
  template doc shows an AI-voice notice or a red stamp example.

## v2.3 rules (the user's review of mona v2.2): text placement, strings, resolution
- **Text placement (TEXTPLACE).** Place tags, lower thirds, date labels and stat floaters on the SAFE grid only: lowerLeft
  (6 % from the left, baseline at 80 % of the height, above the credit line) is the default; lowerRight / upperLeft /
  upperRight are the alternatives. Leave `x` / `y` out: `at: 'auto'` (crimeover.js `safeSpot`) measures the picture under
  each anchor (edge density, luminance spread, brightness) and takes the calmest. Never over a face, the subject or the centre
  third of a real photo (declare faces with `S.textAvoid = [[x, y, w, h]]`), never over busy texture without the soft
  neutral scrim (`scrim: 'auto'` default; never a plate). Long tags split into a line + `sub`. check_layout TEXTPLACE fails
  overlaps with the subject / centre third / another text / the credit line, and anything outside 4 % margins.
- **Strings always connect (STRINGEND).** A board string runs from pin head to pin head, computed from the pins' world
  positions every frame. There is no slack / stops-short end: `B.string(item, item)`; a point end gets a visible pin
  (`B.pinAt`). check_layout STRINGEND fails any drawn string end more than 3 mm from a pin head.
- **No upscaled rasters (PIXELATED).** Never show a low-resolution raster magnified: any picture shown large (b-roll,
  photos, maps, evidence pages) may be magnified at most 1.5x at its most zoomed moment (Ken Burns included). Maps come from
  the open geodata pipeline (`region.py` / `bake_region.py` for places, `tools/bake_wide_map.py` for countries: AWS Terrain
  Tiles relief + Natural Earth borders, baked at 2x the frame), never an upscaled world image. For photos: find the
  original / a larger copy on Wikimedia Commons (same PD/CC0 licence, update CREDITS.json); if none exists, show it whole
  with `broll(key, { fit: 'print' })` (<= 1.4x over a blurred copy of itself) or reduce the zoom. check_layout PIXELATED
  fails a b-roll (or an overlay with `mag`) above 1.5x.
