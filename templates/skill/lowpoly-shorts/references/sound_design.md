# Sound design (Low poly shorts)

The app collects every `sfx(type, t)` the scenes schedule (plus a whoosh on every wipe, flash and pull-out) and runs
scripts/sound_design.py, then mixes with the voice (final -14 LUFS, true peak -2 dBTP).

## Default: voice + recorded sound effects, NO music
Music is the user's choice: they add their own track in Project settings > Music (level and ducking are theirs). Do NOT
write a music bed. sound_design.py ignores `music` beds (and ambience beds) unless beds.json opts in:
```json
{ "music": true, "ambience": true,
  "beds": [ { "from": 0, "to": 38.5, "type": "music", "mood": "quirky", "gain": -27 }, { "from": 0, "to": 38.5, "type": "wind", "gain": -38 } ],
  "sfx": { "whoosh": -28 } }
```
- `"music": true` only when the user asked for the style's generated music. moods: quirky, upbeat, mystery, tense, dark, casino, warm.
- `"ambience": true` only when a scene really needs it (rain, crowd, city, wind; -40..-34). A `room` bed plays at -45 dB at most.
- `"sfx"`: per-type level overrides (optional). beds.json may be just `{ "beds": [] }`.

## sfx (on picture events, never on every cut)
whoosh swish impact thud pop click beep coin cash chime win slot roulette cards chips typing phone camera stamp bell glitch
crowd cheer gasp heartbeat alarm explosion honk glass splash tick. `sfx('win', S.at('jackpot'))`, `sfx('thud', fallTime + .7)`.
Keep them under the voice (the levels are set; `gain` -6..+3 dB to adjust one). A coin shower or win jingle on a win, a thud
when someone lands, a gasp on a shock, typing under keyboards, a phone ring before a call, chips on bets.

## Real recordings (the sound library)
Most types now play REAL recorded sounds from `templates/lowpoly/library/sfx` (122 clips, all CC0 / public domain: Kenney
audio packs + Wikimedia Commons; index in its `index.json`). Each event picks a random clip of its category (the same pick
every run of this project) with a little pitch/gain jitter. Recorded categories: impact thud pop click beep coin cash chime
win lose cards shuffle chips dice typing phone camera stamp bell glitch applause (also `crowd`) cheer heartbeat alarm
explosion glass metal tick paper footstep door thunder rain fire notification error scratch blip swish.
Still synthesized (no good free recording yet): whoosh slot roulette honk splash gasp.
- A specific sound: `sfx('tag:footstep grass', t)` (all words must match the category/tags) or a clip id `sfx('sfx.coin.02', t)`.
- Find one: `node <library>/tools/lib.mjs sfx footstep` lists ids, lengths, licences and tags.
- Timed types (`dur`): typing, heartbeat, applause, rain, fire are cut to `dur` with a fade.
- What was placed where: `audio/sfx_placed.txt` (time, type, recorded/synth) after the Sound step. Credits of the
  recordings used are written to DESCRIPTION.txt (own block) automatically.
The user's own music (Project settings > Music) replaces the style's `music` beds (ambience beds stay); its level and
ducking are the user's, never change them from beds.json.
