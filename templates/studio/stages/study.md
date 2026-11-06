# Stage: study

**Inputs:** reference/stats.json (the app measured every reference before this run: cuts, shot lengths, palette with
shares, loudness, pauses, words per minute and where cuts land on the words, per video range and per picture), the
contact sheets in reference/sheets/ (one frame per shot, 24 to a sheet, each labelled "#shot time length"), one frame and
one 12 fps motion strip per shot in reference/shots/, the user's references (tags img1 / vid1; reference_frames gives more
frames of any range), the brief.
**One output:** reference/ANALYSIS.md, every section of its template filled. Nothing else.
**Gate:** every section filled (no "_(to fill)_"), at least 5 hex colours, the Pacing section in numbers when a reference
is a video.

## Steps
1. Read reference/stats.json first, then every contact sheet; open single shot frames full size only where detail matters
   (type, edges, texture) and the motion strips of the shots whose movement you describe.
2. Take the numbers from stats.json, don't re-estimate them: cuts per minute, median / p10 / p90 shot length, palette hex
   and share, LUFS, pauses, words per minute, the share of cuts on a word start (compare it with its chance value).
   When stats.json notes something was skipped (no transcriber, no sound), say so in that section.
3. Measure what the app can't: sizes in px at 1920 wide, durations of moves in seconds, shares of running time in %.
4. Shot types: name each kind, its share of time and median length, from the measured shots (the sheets number them).
5. Write the "narration trigger -> visual" rules from what happens on screen when something is said (at least five).
6. "What to avoid": what the references never do + the NO_SLOP.md items that apply.
7. Reuse: library_search 2-3 times (the look's key words, e.g. "blueprint navy line art", and the kind of shots) and name the entries that fit (id + what to reuse); none fit -> "nothing in the Library fits yet". Never library_add here.

## Don't
- Don't copy faces, logos or copyrighted art into the style: the style takes the look, never the content.
- Don't write adjectives without a number next to them ("warm" -> "#e8a33c key, 3200 K feel").
- Don't change any other file: this stage writes ANALYSIS.md only.
