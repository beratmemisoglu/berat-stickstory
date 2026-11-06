# Sound design (Studio starter)

Every entrance makes a small sound; the engine schedules them from what you build, you choose the music bed.
(The same synthesiser as the Flat explainer: scripts/sound_design.py, no samples. A style that needs its own sound
designs it later; until then this one is used.)

## Automatic sounds
- `S.add` entrances: pop / grow / rise -> `pop`, drop -> `thud`, slide -> `swish`; exits: pop -> `pop`, others `swish`.
  Elements without `at` (there from the start) make no sound.
- `S.line` / `S.arrow` -> `click` when they land. Dissolves -> a soft `swish`, pushes and other transitions -> `whoosh`.
- Per element: `sfx: 'coin' | 'tick' | 'thud' | ...`, `sfx: false` silences it; by hand: `S.sfx(type, time, { pan, gain })`.
  Keep it sparse: a sound on every pop of a 12-item grid is noise.

Types: paper slide lift pop flip pin tape marker type tick stamp coin click grow whoosh swish snap thud.

## audio/beds.json
```json
{ "beds": [
    { "from": 0, "to": 60, "type": "music", "mood": "curious", "bpm": 96, "key": "D", "gain": -31 },
    { "from": 0, "to": 60, "type": "room", "gain": -46 } ] }
```
Moods: `curious` (plucked, light), `warm`, `news`, `tense`, `archive`. Gains -30..-33 for music keep the voice clear; the
mix ducks the bed under the voice and normalises to -16 LUFS.
