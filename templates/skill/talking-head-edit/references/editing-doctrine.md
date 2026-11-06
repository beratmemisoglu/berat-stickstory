# Editing doctrine: how to write script.md (with real examples from past edits)

## The one rule
Write down what the video needs. Nothing else exists. You never decide what a "bad take" is, never list what to
remove, never whitelist anything: a restart, a filler, a Hungarian aside, an off-mic sentence, an inhale is not in
the video because it is not in `script.md`. build_cut.py pulls exactly the listed words out of the recording and
check_edit.py proves nothing else got in.

## Restart chains -> the last complete take
```
15 | 88.06  | I made this whole...
17 | 92.83  | I made this whole 39...
18 | 97.25  | I made this whole 39 slide.
19 | 102.97 | Presentation.
20 | 104.90 | on the whole actual workflow.
```
script.md:
```
U18 | I made this whole 39 slide.
U19 | Presentation.
U20 | on the whole actual workflow.
```
Five takes of "So let me show you how I make a ... video" -> one line, the fifth take. build_cut.py refuses an earlier
take when a later one of the same sentence exists (`!earlier-take: <why>` only when the later take is broken).

## Restarts inside one utterance -> list only the words you mean
- `"and inspects and inspects its own work"` -> `U57 | and inspects its own work` (the last match wins).
- `"opus 5.5 / can understand / has such opus 5.5 opus 5.5 / opus 5.5 have such a crazy spatial awareness that"`
  -> only the last utterance.
- `"then you can have then you can have the setting"` -> `U88 | then you can have the setting`.
- One sentence split around a mistake: two lines, same utterance - `U63 | Sonnet is` + `U63 | kind of messy, in this case.`
- A stutter the transcript hid ("their their" aligned as one "their", "it it" as one "it"): you do nothing -
  build_cut.py cuts the extra sound at the dip before the kept word, check_edit.py fails if any of it survives.

## Spoken instructions inside the recording = orders
- "Actually cut this whole thing out, you don't need any of the three settings, this is bullshit slide 9, let's skip
  the whole thing" -> the whole "three settings" section (about 2 min) is simply not in the script.
- "So again, quick recap... Don't need this" -> recap not in the script.
- "First I read this intro, this is not part of the full video" -> intro delivered as its own edit.
List every one of these in the report.

## Discarded runs
A demo that is started, abandoned and redone (script "finished in 56 seconds", then the project restarted and the real
script took 5 minutes) -> the script follows the real run; the first run's narration is not listed.

## Never in the script
Other videos'/ads' audio captured during waits; off-mic conversations; fillers and reactions that lead nowhere
("Okay.", "Hmm.", "Yeah.", "Cool."); bloopers ("Bruh, I can't read"); accidental playback starts; pre-roll chatter;
duplicate sign-offs (the last clean one only); lines in another language (Parakeet writes them as English-looking
nonsense: "Meerst out my wind then" was Hungarian - if a line reads like nonsense, it is not needed).

## The viewer test: would the viewer miss this line?
Every line must carry something the viewer needs: a fact, a step, a result, a verdict, or the sentence that sets one up.
Talking to yourself while you work is not for the viewer. These are the lines an in-app run kept and the approved
Sonnet 5.5 edit did not - each one is what made a cut feel slow and unedited:
- **Echoes** - a line that repeats the one before in fewer words: "...a full three-minute animation only using
  JavaScript to" / "Only using JavaScript?"; "So far I made all of these videos with Opus 5.5." / "All the videos that I
  made." / "Using this tool." Keep the full statement, drop the echo.
  An echo is the NEXT line or two saying the same thing again. A claim made in the hook and shown again later with
  the demo is not an echo: "It managed to cut down my video from yesterday from 51 minutes to 27 minutes" (the hook)
  and "As you can see, 51 minutes was the raw recording, 27 minutes was the finished edit" (two minutes later, on
  screen) both stay - an in-app run dropped the hook's claim and the opening lost its point.
- **Thinking aloud** - a question to yourself while you remember or check something: "And we doesn't give it any style
  references?" (the next line answers it properly: "Then in version two, we gave it some style references...").
- **Waiting commentary** while something generates or renders: "I'm extremely curious." "How long is it going to take
  for Sonnet?" "So let's see." "What's it gonna cook up?" At most ONE line that frames what is about to happen (the
  fullest one: "So I'm actually curious how long it's going to take for Sonnet to build a twelve-minute video").
- **Reactions while watching** that state nothing: "Wow, nice." "That's cool." "What is this?" "That's not corny."
  "You know what? It's fine." "Okay, that's nice." Keep a reaction only when it IS the verdict the viewer needs:
  "Why does it say hook? It's corny for a documentary like this." "The stone visualization looks pretty awkward."
- **Fragments that go nowhere** - a sentence that stops and is not picked up by the next line: "That nail looks
  really." "Sauce" "But". (A sentence the transcriber split at a pause is fine: "Why does it?" + "Say hook.")
- **A transition said twice** - "Anything else? Any more inconsistencies?" was already said; a later "Okay, let's see
  what else we have. Do we have any more inconsistencies?" goes.
- **Clicking along** - narrating a click the picture already shows ("Connect it.") when the next line says what
  matters ("It has the right reference.").

The viewer test removes TALK, never CONTENT: every fact, number, price, deadline, offer and call to action the speaker
states stays in (from its last clean take), even when it sounds salesy or repeats a price said earlier in other words.
An in-app run dropped "After that, the price is going to go to 100." from the closing pitch: that is lost information,
not a tighter cut.

When done, read the script AS THE VIEWER HEARS IT - `python "$SK/script_lines.py" --read` prints it as flowing text -
and apply the test to every line once more. Slack reads obviously in prose that looks harmless in a list.

## In the script even though it "looks" like a repeat
- Rhetoric: "turn after turn after turn, revision after revision after revision" - it is in the script, so it passes.
- Natural reactions that land: "That's absolutely nuts." "Honestly, that's pretty cool."

## PLAYBACK
- Only what the viewer must SEE: a generated result, a side-by-side comparison. From where the shown thing starts to
  just after the point is made. 8-15 s is normally enough; `!long: <why>` above 15 s (a raw-vs-edit comparison where
  the comparison IS the point). A failed edit kept an 89 s casino playback and two 57 s ones: that is what "dead
  spaces" looks like to the user.
- A playback that was started, stopped and restarted: the final continuous run only.
- Gaps inside a PLAYBACK are never tightened.

## Things NOT to change
- What was said: wrong numbers, prices that differ between videos, "Cloud"/"Clot" for Claude. Keep the audio;
  mention factual slips in the report.
- Order: script lines in recording order (build_cut.py refuses anything else).
