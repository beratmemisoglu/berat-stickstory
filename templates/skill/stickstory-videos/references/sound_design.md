# Sound design

The references' mix, measured (experiments/stickstory-style/analysis/story NOTES.md §3), and how this project's sound is
made: you schedule effects in the scenes with `S.sfx` and write the music beds in `audio/beds.json`; the app collects the
events, runs `scripts/sound_design.py` (effects + beds -> `audio/sfx_bed.wav`) and its mixer puts the voice on top and
normalises the master. Don't run the mix or render yourself.

## 1. The references' mix

| | measured |
|---|---|
| master | -15.0 LUFS integrated, true peak -1.5 to -1.8 dBTP, LRA 4.6-11.4 LU |
| voice | momentary -13 to -14 LUFS while speaking; character voices level-matched to the narrator |
| background in pauses | ~10-13 LU under the voice (music + effects + ambience); the bare music bed ~14-19 LU under |
| ducking | almost none (under 1 dB; one reference ~4 dB) |
| silence | pauses are almost never silent: the bed runs from the first frame to the last |
| music | soft, melodic, mid-tempo, no strong beat, mellow (little above 6 kHz), near-mono; 4-6 cues a video that change per act; **drops to (near) silence 1-3 times** at the darkest or most shocking moment (5-20 s); **swells** into montages, the reunion and the sequel hook |
| effects | 15-25 non-speech events a minute in normal scenes, 35+ in action; peaks at about the voice's level, the biggest hits up to +7 dB |

## 2. Effects: `S.sfx(type, t, { gain, pan, dur })`

- `t` absolute seconds (`S.at('word')`), `gain` dB (default 0), `pan` 0..1 (0.5 centre), `dur` seconds for timed ones
  (a riser, typing, a crowd).
- On a VISIBLE event only, never on nothing: about 15-25 a minute. The designer keeps ~25 a minute (the most important,
  at least 0.4 s apart) if you write more.
- What goes where (the references):

| event | type | per 8-minute video |
|---|---|---|
| a pill, tag, label, counter step, HUD element popping in; a typed character burst | `blip` (a 2.3-3.3 kHz tick, 30-60 ms) | 40-100 |
| a scene-changing cut that falls in a pause | `whoosh` | 30-50 |
| a hand action in an insert (pick up, put down, pour, tap, open) | `click`, `pop`, `paper`, `keys`, `thud`, `typing` | 25-40 |
| a walk | `step` (one per few steps, or `{ dur }`) | 10-20 runs |
| a reveal, an act change, the title, a big hit | `boom` (sub boom) + a `riser` 1.2-1.8 s before it | 10-20 |
| a phone ringing, a notification | `phone`, `ding`, `notification` | 4-8 |
| a door, a lock | `door`, `click`, `door_creak`, `door_lock` | 4-8 |
| beeps: a heart monitor, a device, a timer | `beep`, `heartbeat`, `alarm`, `tick` | 3-8 |
| a crowd: cheer, applause, laughter, gasp | `cheer`, `applause`, `crowd`, `gasp` | 5-10 |
| action (only if the story has it) | `impact`, `glass`, `explosion`, `fall`, `siren` | 0-40 |

- All types: `whoosh swish impact thud pop click ding blip boom riser step footstep beep coin cash chime win typing
  phone camera bell glitch crowd cheer gasp heartbeat alarm explosion honk glass splash tick paper door keys fall breath
  dog thunder rain fire notification error metal applause`, and ANY category of the sound library by its name (`siren`,
  `sub_drop`, `reverse_swell`, `tension_drone`, `door_creak`, `door_lock`, `paper_rustle`, `typewriter`, `crickets`,
  `rain_window`, `night_ambience`, `car_door`, `camera_flash`, `police_radio` ...), `tag:<words>` (a recording whose tags
  match) or a library id (`sfx.impact.01`). The user's own sound library wins per category.
- Some effects add their own sound (`S.skill` a blip): don't double them.

## 3. Music and beds: `audio/beds.json`

```json
{"music": true, "beds": [
  {"from": 0, "to": 35, "type": "music", "mood": "mystery", "gain": -34},
  {"from": 35, "to": 140, "type": "music", "mood": "playful", "gain": -34},
  {"from": 140, "to": 236, "type": "music", "mood": "warm", "gain": -35},
  {"from": 262, "to": 330, "type": "music", "mood": "tense", "gain": -34},
  {"from": 0, "to": 482, "type": "room", "gain": -46}
]}
```

- One music bed per section of the story with its mood (`playful`, `quirky`, `upbeat`, `warm`, `tense`, `mystery`,
  `dark`), **about -34 dB** (-33 .. -36), plus a room tone at -46 dB (-45 at most). `"music": true` is required for music
  beds; other bed types (`pad`, `crowd`, `city`, `wind`) also need `"ambience": true`.
- What that sounds like, measured on video 02 (Fish narrator, the app's Stick stories mix): the bare music ~19 dB under the
  voice while it speaks, the whole bed (music + this style's audible effects) ~15 dB under it - the references' range
  (bare music 14-19 LU, music + effects 10-13 LU under the voice). The crew's -32 beds measured 14.2 dB and tripped the
  mix's generic 16 dB check (a toast); the follow-up's -38 measured 16.0 with the music ~23 dB under (quieter than any
  reference). The effects are most of the bed: lowering the music below -38 gains almost nothing.
- sound_design.py lowers any music bed that would sit less than 14 dB under the voice (a swell written at -26 won't bury
  the narration); quieter in dialogue-heavy stretches is fine (-36).
- The planned silences are GAPS in the music beds (236-262 above): the darkest moment of the story, 1-3 times a video.
- Swells: a new bed starting on the reunion / montage / sequel hook, a few dB louder (-31).
- The user's own music (Project settings > Music) replaces the generated bed.

## 4. Character voices

Done by the app's Voiceover from the `[Name]` lines (script.md): each character its own voice, loudness matched to the
narrator; phone voices only a gentle low cut. The scenes lip-sync those lines (`a.say`).
