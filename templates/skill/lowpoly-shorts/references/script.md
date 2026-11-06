# From narration to shots

## Writing the script (when you write it)
- 30-45 s (Bright) or 45-90 s (Moody); ~3.3-3.4 words a second, almost no pauses; speech starts at once.
- Hook = the event already in progress (Bright: "A man was furious because his fries were cold.") or a second-person
  scenario / question (Moody: "You run a casino and you have a problem."). No intro, no "in this video".
- Then the mechanism in 3-6 concrete steps ("They would ..."), escalation with real numbers, a twist, and a dry punchline or a
  rhetorical question - ideally one that leads back into the first sentence (the loop).
- Every sentence must be showable literally in 3D: concrete nouns and verbs, numbers you can put on screen.

## Cutting it into shots
1. Split audio/script_timed.txt at clause boundaries (commas, "and", "but", "so", "because", "which", a new verb). A clause is
   ~4-8 words = one shot of 1.2-2.5 s. A short punch clause (2-3 words) = a 0.6-1 s shot. Never more than ~4 s on one shot
   unless the camera travels (a journey shot).
2. For each shot write: the clause (its first 2-4 words become `say`), the literal picture, the set, the camera, the callout.
3. Reuse sets and the cast: 4-8 sets a video (Moody: one main set for most shots), every visit framed differently.
4. Beats: hook (0-3 s) · setup · 3-6 mechanism steps · escalation (numbers grow: callouts, counters, chip towers) · twist
   (a flash / drop to black / greyscale) · punchline or loop.
5. Count: about 30 shots a minute (Bright) / 24 (Moody). Fewer means shots hold too long.

## say and timing
- `say: 'He checked his bank'` - the words as spoken (any case, punctuation ignored). Search runs forward from the previous shot,
  so repeated phrases resolve in order. A "say miss" in check_preview: the words differ from the timeline (a mishearing):
  copy them from audio/script_timed.txt.
- Events inside a shot: `S.at('four')` (a word of this clause) for callouts, expressions, clips, sfx.
- The first shot starts at 0 whatever its words; the last ends with the narration (nothing after the last word).

## Example (Moody)
"You run a casino. | Your biggest problem | is that players know when to stop. | So you take down every clock, | cover the windows, |
and pump in fresh air at night." -> 6 shots: office wide push (hook) · face close-up worried · players leaving, track walk ·
man on a ladder removes a clock (insert, dutch) · windows covered (drop to black around the window) · vents + fresh-air
callout, pull-out to the casino floor.
