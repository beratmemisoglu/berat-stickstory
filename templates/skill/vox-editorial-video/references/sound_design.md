# Sound design (Vox style)

Vox videos feel satisfying because every visual event makes a small physical sound: paper landing, a marker on paper,
a pin, a film camera snap. The engine schedules these automatically from what you build; you only choose the music.

## Automatic sounds
- `S.add(obj, { in })`: drop -> `paper`, slide -> `slide`, pop -> `pop`, flip -> `flip`, grow -> `grow`; `out: 'lift'` -> `lift`.
  Override with `sfx: 'pin' | 'tape' | 'coin' | 'stamp' | 'click' | ...` or silence with `sfx: false`.
- `words`: `type` -> typewriter clacks, `odometer`/`random` -> ticks, `fill` -> a soft pop, highlights/underlines -> `marker`.
- `scribble` -> `marker` for its duration.
- Transitions: slide/whip/push -> `whoosh`, blur -> `snap` (film camera), paper -> `swish`.
- By hand in build(): `sfx(type, time, { pan, gain, dur })`.

Types: paper slide lift pop flip pin tape marker type tick stamp coin click grow whoosh swish snap thud.

## audio/beds.json
```json
{ "beds": [
    { "from": 0, "to": 22, "type": "music", "mood": "curious", "bpm": 96, "key": "D", "gain": -31 },
    { "from": 0, "to": 22, "type": "room", "gain": -46 } ],
  "sfx": { "marker": -30 } }
```
- `music` moods: `curious` (plucked, light shaker: explainers), `warm`, `archive` (music box + minor: history; pair with
  a `crackle` bed at -41), `news` (brisk pluck pulse: tech/data), `tense`. `bpm`, `key` (C..B).
- `room` room tone (-44..-48), `crackle` vinyl dust, `pad` soft chord.
- Gains are RMS targets; -30..-33 for music keeps the voice-to-bed ratio above 16 dB after the mix ducks it.
- `sfx` overrides per-type peak levels (default -23..-31 dBFS).
The app's mix step ducks the bed under the voice, normalises to -16 LUFS and checks the ratio (mix_report.json).
