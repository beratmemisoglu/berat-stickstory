# Investigation look: shots, cuts and pacing (quick reference)

For `settings.theme === 'investigation'`. Kit calls are in references/engine_api.md ("Engine v7" and "Investigation kit");
people come from lib/figures.js: `figure('main', { parent: S.scene, act: 'typing' })`, the role's rig and outfit as the
project's Look > Characters says. Numbers come from a 23-minute reference film (median shot 2.3 s, 354+ shots).

**Any topic.** The look is a visual style, not a genre: the story's own topic decides what the devices show. The board
pins that story's players, teams, companies or events; the grid shows who connects to whom in that field; the desk holds
that field's papers (a team sheet, a contract, a lab notebook, a match report). Suspects, police, redactions and charges
only when the story is about a crime; never invent one.

**references/no_slop.md outranks every number here** (mandatory read): a shot is never cut faster than it can be read
(text holds >= 1.5 s after it settles), fast bursts only of strong, well-lit frames, every scene lit (key/fill/rim +
practicals, its visibility gates), hands IK-attached to what they handle, eased camera moves (a push >= 2.5 s).
Banned in every style: red stamp / plaque / verdict overlays, and any notice that the voice is AI.

## Narration trigger -> shot -> kit call
| The narration... | Shot (script tag) | Kit call | Length |
|---|---|---|---|
| a person does something, present tense | MANNEQUIN diorama | `setBedroom / setOffice / setLobby / setStreet(S, {...})` + `figure(role, { act })`, `S.collide` | 1.5-4 s; up to ~19 s only under a real voice |
| a generic or hypothetical person, an emotional beat | MANNEQUIN in the void | `setVoid(S, { desk, pool })` + `figure(role)` | 3-8 s |
| names a public figure (first time) | PHOTO on the name + LOWER THIRD | `broll(key, { credit })` or `darkSpace(S).photo(key)`; `lowerThird(name, role)` | 1.2-2.5 s, cut one frame before the name |
| jumps in place or time | PLACE+DATE | establishing set / map / broll + `placeTag('PARIS, {y}', { roll })` (add it to the next shot too to carry it across the cut) | 2-3 s |
| states a claim, a record or a charge, a press fact | DOC / HEADLINE | `evidence(S, makeDoc({...}))` + `ev.highlight(phrase, { t0: cue - .4 })`, `ev.zoomTo`; or `headlineCard({ highlights, punch })` in a flat shot | 5-18 s (a headline with a number longest) |
| says a number | stat | `statFloater(value, label, { count })` or `ev.ellipse(phrase, t0)` | on screen within ~1 s of the word |
| explains who connects to whom, money or data flow | GRID network | `networkGrid(S)` + `net.node / link / packets / state / label`, one continuous `net.camTo` | 8-40 s, one new element per noun every 2-4 s |
| links the story's players, events and clues (in a crime story: investigators linking suspects) | BOARD | `crimeBoard(S)` + `B.pin / string / camTo / highlight` | 2-10 s |
| names an online action (log in, search, post) | UI | `evidence(S, evidence.fromCanvas(...))` or a set's `screens` | 0.3-5 s |
| says something general or present-day | STOCK b-roll | `broll(key, { credit })` | 2-5 s, or bursts of 0.5-1 s |
| tells a real event that was filmed | ARCHIVE footage | `broll(key, { n, fps, credit, censor })` | median ~1.1 s, in bursts |
| moves through a building, a route inside | SIDEVIEW | `sideView(S, { floors })` + `sv.path(...)`, `sv.place(person, room)` | 3-8 s, locked camera |
| travels between places | MAP | `setup({ region })` + `regionMap(S, { center, radius })` (lib/maps.js, engine v16: the dark map, roads and runways, buildings standing) + `marker()` / `strikeArc()`, or `placeTag` over a map | 3-16 s |
| plays a real person's own voice | QUOTE card | `shot({ flat: true })` + `quoteCard({ speaker, words, env })` | 8-44 s |
| starts a chapter, inside a pause | CHAPTER | `shot({ flat: true, trans: 'black' })` + `chapterCard(kicker, title)` | ~2.7-4 s, black before and after |
| ends the cold open | TITLE | burst ending on one black frame, then `titleCard(title)` | ~5-8 s |
| lists things | one shot per item | any of the above, cut on each item's word | 0.6-0.8 s each |
| someone goes to work at a keyboard | keyboard stutter | three close-ups of hands on keys (`figure(role, { act: 'typing' })`), jump cuts | 3 x ~0.65 s |
| the foreshadow line before a break | FLASH-FORWARD | `trans: 'flash'`, four shots 0.3-1.1 s, then `trans: 'black'` (`hold: 2`) | ~4 s |
| a dread or power moment | lights out | the set's `lightsOut(cue(...))` (red-black) | on the word |
| something too violent to show | HEADLINE only | `headlineCard` carries it; no gore, ever | |

## Cut rules
- **Cut ~1 frame before the word**: start the shot at `cutAt('word', near)` (0.04 s lead). Inserts may lead by 0.15-0.7 s
  (the noun they show); highlighter wipes lead the word by ~0.4 s; labels unscramble 0-0.3 s after it.
- **The picture lands on the name**: a named person's photo cuts in on their name, with the lower third.
- **One shot per list item**, 0.6-0.8 s each, on each item's word.
- **Burst then hold**: 3-12 cuts under a second, then a 3-19 s hold, then another burst. Never a steady cut every 3 s.
- **Keyboard stutter**: three ~0.65 s jump cuts of hands typing = "he goes to work".
- **Black and chapter cards only inside narration pauses** (a [BREAK] or a real gap in audio/timeline.json); the fastest
  montage cuts also live in music-only gaps.
- **Hard cut by default** (~95%). `flash` for a hit or into a screen, `glitch` out of archive / quote cards back into 3D,
  `black` for chapters and the flash-forward, `iris` once or twice a film. No dissolves between 3D scenes.
- Long holds only when audio carries them (a real voice, a quote card, an explanation on the grid).
- The climax re-uses cold-open shots (same set, same camera) as a callback.

## Pacing targets
| Stretch | Cuts per minute | Median shot |
|---|---|---|
| Whole film | ~16-18 | 2.3 s |
| Cold-open teaser / title montage | 40-60 | 0.7 s |
| Reenacted dialogue / phone call | ~14 | 3 s |
| Background, history, archive bursts | 44-48 | ~1.2 s |
| A character at work (hacking, planning) | 15-25 | 2-3 s |
| Long explanation (grid, quote card) | ~5 | 8-40 s |
| Middle acts | 14-20 | 2.5-3 s |
| Climax callback montage | ~50 | 0.6-1.8 s, ending on a ~5 s hold on the moral |
A storyboard for N minutes has roughly 16 x N shots; check the count before writing scenes.

## Look rules that the storyboard decides
- **The outfit is the identity**: each role keeps one outfit colour for the whole film (Look > Characters); never recolour
  a person per shot. A withheld identity stays a mannequin (or the faceted unknown) until the reveal.
- **Colour code**: one crimson accent over black and grey. RED = threat / digital (the grid, padlocks, skulls, progress
  bars, the waveform); BLUE = a character's mind (circuit lines growing behind a head). Nothing else saturated.
- **Every real asset carries its numbered credit**: declare the film's sources once with `sources('Outlet - Title (Year)', ...)`
  and give each `broll()` its `credit` (or `cite()` on any shot). Designed props (a letter, an order card) look designed,
  never like fake archival documents with real-looking stamps.
- **No gore.** Victims are never shown hurt; the headline carries it.
