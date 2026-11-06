# Reconstruction style: sign-off before render

**No video gets its final render until both halves of this sign-off pass:** the automatic gate and the manual frame review.
Nothing is shown to anyone before then. A failed item is fixed at its cause, never hidden by moving the camera away.
This file is the contract for wiring the style into Toon Studio: the app's build step must run the same gate and refuse
to export a video that fails it (see "For the Toon Studio integration" at the end).

## 0. Build it right first (prevention)

Overlaps are cheaper to prevent than to find. When a scene is built:

- **Plan positions as numbers, not by eye.** Write down every body's position, height and reach, and every solid's extents.
  Then check the gaps: two people side by side need about 0.95 m between centres if their arms swing, and 0.6 m if they stand still.
  A person moving through a space needs the opening's radius to be at least their shoulder half-width plus 10 cm.
- **Respect the room's size.** A 1.8 m person floating in a 2.15 m cabin has no room to float high, or their head goes into the ceiling.
- **Holes are real.** If a body passes through a hatch, door or tunnel, model the hole in the solid. A ring drawn on a ceiling is not a hole.
- **Contacts are explicit.** Hands go on surfaces through `handTo` / `grip`, feet are planted by `walkAt` or
  `clipSpeed`, and sitting uses the seat's real height. Anything else stays at least 2 cm away from every surface.
- **Choose poses that fit the furniture.** A pose with bent knees in front of a console puts the knees through it. Pick or
  adjust poses for the space the body is actually in.
- **Prefer a cutaway with the camera outside** for small crowded interiors. A camera inside a 2 m room sees one arm.
- **Declare `S.collide`** in every shot that has people or moving bodies, at the time the shot is written (section 1).

## 1. Automatic gate (must print PASS)

```
sh tools/signoff.sh <story> <end-seconds>
```

It runs, in order:

| Check | Catches | Pass |
|---|---|---|
| `tools/check_syntax.sh` | Broken modules, including code accidentally swallowed by a `//` comment (happened twice in v8) | `SYNTAX clean` |
| `render.mjs stills --q audit=1` (one still every 3 s, so every shot is built) | Coplanar surfaces that will z-fight | no `COPLANAR` line |
| `render.mjs zfight 0 <end> .2` | Flicker from ambiguous depth anywhere in the film | `clean` |
| `render.mjs collide 0 <end> .1` | **Bodies passing through bodies or through solid objects**, every 0.1 s | `clean` |
| `check_layout` in Toon Studio (engine v3, `src/contact.js`) | **Spatial consistency**: props on screen that float (rest on nothing, gaps where parts should meet) or pass through another solid prop | no `floating` / `through` line |

**How `collide` works** (`src/collide.js`):
- Each body becomes a set of capsules (torso, head, upper and lower arms, hands, thighs, shins) built from its joints every frame.
  `personCaps(p)` covers our rig and `actorCaps(a)` covers rigged glTF people.
- **Body against body:** any two capsules closer than the sum of their radii, less 1 cm, is a violation. The report gives the depth in cm.
- **Body against solid:** points through each capsule are tested for being inside a closed mesh, using a ray parity test.
- A shot opts in with `S.collide = { bodies: () => [{ name, caps }], solids: [meshes] }`. Solids must be closed meshes.
  Open shells such as half pipes, open cylinders and arcs give wrong parity, so a shot lists the closed rock or furniture behind them instead.
- The report names the body part and the object, for example `Swigert.elR inside ceiling`, so the fix is direct.

**A check is only trusted once it has been seen to fail** on a known-bad case. These calibrations are kept:
- `scenes/zf.js` must print COPLANAR.
- The pre-fix Apollo cabin failed `collide` on 49 of 49 frames.

If a check prints nothing at all, treat that as a broken pipe until proven otherwise. That is how the audit went silent from v7 to v8.

## 2. Manual frame review (after the gate, before the final render)

The gate only catches geometry. These need eyes, at full 1920x1080 resolution and never on contact sheets:

1. **Every asset alone** in its gallery (`scenes/assets*.js`, `modelqa.js`, `actorqa.js`).
   Downloaded models also get front and side views to check tilt and scale.
2. **Every shot at its start, middle and end**, plus every word cue that moves something.
3. **Every moment something moves near something else** gets consecutive frames: 6 frames from the encoded MP4
   (`ffmpeg -ss T -frames:v 6 -vf tile=3x2`). That covers entries and exits, hand and foot contacts, passes through openings,
   crowds walking, and falls and splashes.
4. **Readability, which no check can measure:**
   - Is anyone hidden behind someone else?
   - Does anyone look headless, cut by a frame edge or by an opening?
   - Is the subject covered by a card?
   - Are two tags on screen at once?

   v8.1 example: the cabin passed `collide` but Swigert stood behind Lovell and hid him, then floated so high his head
   vanished into the tunnel. Both were fixed by moving him into the gap between the other two and lowering him.
5. **Investigation look only** (QUALITY_STANDARD.md "The Investigation look"), at the same frames:
   - every real asset on screen carries its numbered source credit; designed props look designed;
   - text is light on the dark and readable (no dark grey on black, nothing over a bright highlight, nothing cut by an edge);
   - the subject separates from the dark (its key or rim light), nothing clipped to pure white except a flash frame;
   - each person wears their role's outfit in every shot; the only saturated colours are the crimson accent and the outfits;
   - cuts land about a frame before their word, black and chapter cards sit in narration pauses; no gore anywhere.
6. Write the review down in the story's log: times checked, what was fixed. "Looked fine" is not a review.

Only then: `node render.mjs video 30 0 <end> --story <id>`, followed by one last look at consecutive frames of the encoded file
at the riskiest moments.

## 3. Why v8 shipped an overlap (31 s, Apollo 13), and what changed

- **What happened.**
  - Swigert's arm went through Lovell's head and his head went into Haise's.
  - He hung through a ceiling that had no hole.
  - Lovell's and Haise's knees went through the console.
  - It was visible on every frame from 30 to 40 s.
- **Why the review missed it.** I looked at stills of that shot (35.0 s and 36.8 s) and judged the composition ("reads like a
  museum cutaway") instead of checking each body against every other body and every object. Consecutive-frame checks had been
  run only at effects (explosion, separation, splashdown), not where people move near each other. Rule 11 ("bodies never
  overlap bodies") had been written down without any check behind it, so it depended entirely on my eyes, and they failed.
- **What changed.**
  - The rule now has an automatic check (`collide`) that is part of the sign-off gate.
  - The manual review now explicitly covers every moment something moves near something else.
  - Readability (hidden or headless people) is a separate review item, because a scene can be collision-free and still wrong.
  - Running the new check on all three films found one more case the eye had missed: two walkers in the cave film bumped
    arms by up to 4 cm at 8–10 s.

## For the Toon Studio integration (later)

When this style is wired into the app:

- **The project's build runs `tools/signoff.sh` equivalent before every export** and shows the failures to the user in plain words.
  For example: "At 0:31 Swigert's arm passes through Lovell's head". Export is blocked until they pass.
- **The project's Claude session gets this file and QUALITY_STANDARD.md** as instructions. A scene is not done until the gate
  passes and the frame review is written down, the same as the build prompt already requires for other styles.
- **Every scene template that places people declares `S.collide`**, so new projects get the check without extra work.
- **The asset galleries and calibration scenes ship with the style**, so the checks can be proven to work on the user's machine.

## No slop gate (added 2026-10-13, owner review of crime-style v1; full SOP: references/no_slop.md)

Before any render, answer each item of no_slop.md's PRE-RENDER CHECKLIST at the end of storyboard.md, all YES:
- **Visibility + lighting:** every shot's start/middle/end still passes the visibility gates (frame mean luma >= 45 dark looks / 90 bright,
  < 35 % pixels crushed below 16, subject mean >= 70 and 1.4x its surround, faces/hands >= 80 and sharp); each scene file states its
  key / fill / rim / practicals. Nothing ships where the subject can't be seen.
- **Physical accuracy:** carry / hold / lift / open / hand-over: hands IK-attached to grip points, prop parented to the hand, body animated,
  no clipping (check_layout Clean). Realistic library characters with mocap, not egg-head mannequins (unless the user picked them).
- **Camera:** eased in/out, push >= 2.5 s, <= 20 deg/s, no stop-start.
- **Readability:** every text settled and held >= 1.5 s; no scramble left unresolved at a cut.
- **Banned overlays (every style):** grep scenes for `stamp(`, `mark:` and AI-voice `notice(`: zero hits. No red plaques, no 'AI-generated voice'.
- **Sound:** ElevenLabs voice; no sound effects unless the user supplied them.
- **Pacing:** no shot shorter than its read time; fast montage only of strong frames.
