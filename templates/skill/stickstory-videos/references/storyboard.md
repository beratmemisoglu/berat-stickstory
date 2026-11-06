# Storyboard: turning clauses into pictures

Measured on the three references (experiments/stickstory-style/analysis/story NOTES.md §2, camera NOTES.md §5): 739
shots over ~27 minutes. The two example videos' picture plans (experiments/stickstory-style/videos/01-pause/beats.md,
02-handshake/beats.md) are written this way: read one when in doubt.

## 1. The numbers

| measure | target for an 8-minute video |
|---|---|
| pictures | ~25 a minute (23-28), ~200-210 in 8 minutes; the climax minute faster (32-39), the last minute slower |
| shot length | median 1.7-2.1 s, mean 2.2-2.6; ~10 % under 1 s; ~3 % over 6 s |
| per clause / sentence | about one picture per clause, ~1.4 per sentence |
| words per shot | median 3, at most ~12; length ~0.7 s + 0.4 s per word |
| wordless shots | 22-45 % of all shots (median 1.3 s): reactions, action runs, results, wides |
| hook | 7-11 shots in the first 15 s, the title by 12-30 s |
| end | the end card 8-11 s with the question spoken over it |

**The picture mix** (per 100 shots; the 60-shot sample):

| type | share | what |
|---|---|---|
| INS: insert (hands, a prop, a phone or device screen) | 32 | the noun of the clause, close: a hand closes, a battery icon, a key turns |
| CU: face close-up | 23 | the speaker; a 0.5-0.7 s reaction between lines or between graphics |
| ONE: one person acting (medium / wide) | 15 | walking, sipping, kneeling, raising the arms |
| TWO: two people interacting | 8 | a hug, a hand-off, a handshake, CPR |
| WIDE: establishing / overhead | 8 | every new place, first |
| GFX: full-frame graphic | 8 | maps, charts, diagrams, big numbers, terminals |
| TITLE: wide + a title / chapter card | 3 | the title, a new life, a new chapter |
| SPLIT: split screen | 2 | a phone call between two places, good side / bad side |

## 2. Each kind of clause -> its picture

**Literal first.** The picture shows the noun of the clause, almost word for word: "a battery that lasts a month" = the
phone's battery icon with `31 DAYS`; "three floors underground" = a `LEVEL -3` sign; "shock advised" = the device screen
with those words. Spoken numbers ALWAYS appear as on-screen text.

| the clause | the picture |
|---|---|
| a line of dialogue (`[Name] ...`) | the SPEAKER's close-up (lip-sync, the face on the stressed word); between two lines a 0.5 s reaction close-up of the listener (the reaction face 12-24 frames after the line) |
| a phone call | the phone insert first (ringing, the caller's name), then a split screen of the two places, then alternating close-ups |
| an explanation, a fact, a rule | a FULL-FRAME graphic held 4-10 s across 1-3 sentences (chart, map, diagram, terminal, big number), with 0.5 s cuts to the hero's face between ideas |
| a list ("A, B and C") | one picture per item, each cut 1-4 frames before its item's word |
| a number ("seventy times") | a pill, a counter, a big number, a tag or a sign IN that shot, landing on its word |
| a prediction / probability | a tag pinned to the thing with the percentage (`S.tag('SOCKS · 99%')`), or two option pills over the hero's head |
| a choice | `S.options` (the struck one greys out on its word, the answer turns amber) |
| a new place | a WIDE first, with a corner time / place label (`S.label('TUESDAY · 8:14 A.M.')`); then go in |
| a time jump ("a week later", "that night") | a 12-frame dissolve + the lower-left "later" caption, or the elapsed tab; at night the same set in its night mood |
| an emotion | a big close-up (the face 60-90 % of the picture height), held, with a slow push (`pushBig`) |
| an everyday miracle, a skill, a trick | a hand insert doing it (the glove hand on a tabletop or a prop close-up) |
| consequences at scale | a news broadcast (`S.info('news')`), a counter racing up, a crowd |
| a section of pros / cons | "Plus," / "Minus," / "The catch?" / "The price?" with the + or - icon in its top corner for the whole section |
| a message, a hacker moment | the terminal typing (24 characters a second) or a phone chat |
| a word-free beat `(beat Ns)` | ACTION or REACTION: 2-4 s beats = 1-2 shots (the result of the action, a reaction close-up, a wide); the long beats (8-14 s) = a silent run of 5-8 shots of 0.4-2.3 s each |
| the title | the "What if you ...?" title over a frozen / striking wide (`S.title`), a boom on it |
| the question at the end | the end card: the cast in a ring of light, the question in cream + amber (`S.endcard`) |

## 3. Where the cut lands

- **82-93 % of cuts fall in a pause** (between sentences 74-89 %, between words 7-13 %, inside a word only 4-12 %).
- A sentence-start cut sits two thirds of the way through the gap: ~6 frames before the first word; the picture arrives
  a quarter second before the voice names it. `say` cuts 2 frames before: inside the measured range.
- A mid-sentence cut (a list item, a new noun) lands 1-4 frames before the noun: a second shot inside the sentence with
  `say` = the words from that noun (`say: 'your friends'`).
- Never cut mid-word on purpose.

## 4. Transitions (shot.trans)

Hard cuts ~93 %. A `dissolve` (12 frames) for a time or place jump or a re-angle on the same moment (3-6 a video); `quick`
(4 frames) for rapid inserts; `flash` for an impact or a realisation; `whiteout` for a reset; `black` for an act break and
into the end card; split screens in and out by a cut. Graphics are cut in and out like any shot.

## 5. The devices (use them; they are the format)

1. One **counter** that runs the whole video (LIVES: N, a countdown, REFUNDED: N, simulations 902 / 1000): `UI.hud` in
   models.js, changing on its words.
2. **Prediction tags** with percentages over people and things.
3. **Time and place labels** in a corner, never a full-screen card (`S.label`, `S.clock`, the "later" caption).
4. **Plus / Minus / The catch? / The price?** sections with the corner icon.
5. Rhetorical one-word questions answered at once ("Your test scores? Always 100."): a close-up on the question, the
   answer as a pill or a number.
6. **Plant -> payoff callbacks**: the same picture (same place, framing, prop) when the payoff comes.
7. **News chyrons** for consequences at scale.
8. **Phone UI** for every message (calls, chats, the bank app, an alert).
9. One **real fact** per section as a full-frame graphic; one public-service line as `S.warning`.
10. The **end card** with the question to the viewer.

## 6. The storyboard rows

One row per shot (the example videos' format):

| # | words | type | shot | on screen |
|---|---|---|---|---|
| 1 | Every raindrop | INS | the street frozen: one raindrop hangs in front of the cafe window, a pigeon mid-flap behind it | countdown ring `38` |
| 1b | in the city just stopped. | WIDE | high wide of the street, frozen: rain as hanging streaks, a bus mid-turn, pedestrians mid-stride | label `TUESDAY · 8:14 A.M.` |
| 2 | A man, halfway through a sneeze. | CU | the sneezing man: eyes squeezed, droplets hanging | |
| 5 | Then you open your hand. | INS | your fist opens; a ripple out, colour floods back | |
| B1 | (beat 2s) | CU | the soaked woman: a slow blink, a drip falls off her nose; you sip on. SFX: rain hiss, one fat drip | |

`b`, `c` = more shots on the same line (a mid-sentence cut); `Bn` = a word-free beat; `g` = a short cut inside the
natural pause. Then, per row, the code is 3-8 lines (engine_api.md §1).

## 7. Checks on the storyboard (before writing scenes)

- Count the rows: ~25 a minute. Tally the types against §1 (the example videos have `videos/tools/beats_tally.py`).
- Every number has its graphic; every list item its picture; every new place its wide + label; every dialogue line its
  speaker; every beat its action.
- No two neighbouring shots with the same place AND framing (vary: wide -> close-up -> insert).
- The holds over 5 s each have a reason (acting, a push, a building graphic).
- The cast and the places are the same names in every row.
