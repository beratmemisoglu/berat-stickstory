# Stickman (MS Paint) style — the visual grammar

Measured on the reference ("The Craziest Ancient Folklore That Turned Out to be True", 12:03): 252 shots, mean 2.87 s,
median 2.33 s per image; 29 shots under 1 s, 134 between 1 and 3 s, 17 between 6 and 10 s. Narration ~213 words/min,
~10 words per image. The look is ours: MS Paint (classic palette, flat fills, black wobbly outlines, no anti-aliasing,
pixel-crisp Comic Sans text, rendered at 960x540 and doubled with nearest-neighbour to 1920x1080).

## One clause = one image
Every new noun, number, place, person or claim gets a new image. Split narration at commas: "On the night of
August 21st, 1986 | nearly 2,000 people died | in the valleys below Lake Nyos". Target 2-3 s per image, a 1 s punch
image is fine ("On birds." / "Just one problem."), never more than ~4.5 s on one image.

## Shot types (in rough order of frequency in the reference)
1. **Scene** — characters acting in a simple backdrop (ground band + sky, or white). Most shots.
2. **Reaction close-up** — the narrator or a character, `size=XL`, big face: shock, smug, worried, confused. Use after
   every surprising fact and for punchlines ("He didn't find one city." / "Sleep well.").
3. **Text card** — white frame, one date/number/name in red or yellow outlined text (`card "1870" c=yellow`).
4. **Labelled scene** — a scene plus a red/yellow label naming the place/person/number ("Hisarlik, Turkey").
5. **Diagram** — cross-sections (`layers`), arrows, dashed distance lines, measure bars, before->after arrows,
   blast maps, scales. Explanations are shown, not told.
6. **Symbol shot** — one big prop on white or a simple set: an X over something ("no crater"), a question mark,
   a checkmark, an hourglass ("1,000 years too old").
7. **Spectacle** — explosions, meteors, flames, monsters filling the frame.

## Characters
- Big round heads (head diameter ~ the torso), stick bodies, no hands. Faces carry the story: eyes with pupils,
  brows, open mouths with a tongue. X eyes = dead.
- Identity comes from skin tone + one or two accessories (pith helmet, top hat + moustache, hood + beard, turban,
  mitre). Define each person once with `cast` and reuse it, so they look the same in every shot.
- The narrator is a plain white-headed stickman (`cast narr`) used for reactions and asides.

## Chapter header
Every frame carries the chapter title in caps, top centre (`title THE EMU WAR`). It is the only constant on screen.

## Colour and text
Labels: red (facts, numbers, warnings) or yellow (names, places, dates), black outline. Blue/green only for
science terms (water, sodium, chlorine). Keep floating things below 85% height (the header lives there).

## Sound
One voice, fast, almost no pause between sentences (pauses cut to 0.22 s), fitted to the target length with a
pitch-preserving tempo of at most ~1.15. Images cut 0.06 s before the first word of their clause.
