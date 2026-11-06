# Sound design (Flat explainer)

Every event makes a small sound; the engine schedules them from what you build, you choose the music bed.
(Same synthesiser as the other Suite styles: scripts/sound_design.py, no samples.)

## Automatic sounds
- `S.add` entrances: pop / rise / grow -> `pop`, wipe -> `click`, slide -> `swish`; exits: pop -> `pop`, others `swish`.
- `S.line` -> `click` when it lands. `S.burst` -> `grow`. Dissolves -> soft `swish`, slides -> `whoosh`.
- Override per element with `sfx: 'coin' | 'tick' | 'thud' | ...`, silence with `sfx: false`, or add by hand with
  `S.sfx(type, time, { pan, gain })`. Keep it sparse: a sound on every pop of a 12-node grid is noise
  (silence most, keep the first and the last).

Types: paper slide lift pop flip pin tape marker type tick stamp coin click grow whoosh swish snap thud.

## audio/beds.json
```json
{ "beds": [
    { "from": 0, "to": 60, "type": "music", "mood": "curious", "bpm": 100, "key": "D", "gain": -31 },
    { "from": 0, "to": 60, "type": "room", "gain": -48 } ] }
```
Moods: `curious` (plucked, light: the default for this style), `warm` (gentle, human stories), `news` (brisk: tech,
data), `tense` (problems, risks), `archive` (history). Gains -30..-33 for music keep the voice clear; the mix step
ducks the bed under the voice and normalises to -16 LUFS.
