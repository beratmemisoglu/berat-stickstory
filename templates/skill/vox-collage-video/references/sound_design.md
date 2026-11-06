# Sound design (Vox collage)

Every event on the paper makes a small physical sound; the engine schedules them from what you build, you choose the
music bed. (Same synthesiser as the other Suite styles: scripts/sound_design.py, no samples.)

## Automatic sounds
- Entrances: drop -> `paper`, slide -> `slide`, pop/grow -> `pop`, ink (stamps) -> `stamp`, peel -> `flip`;
  `out: 'lift'` -> `lift`. Override with `sfx: 'pin' | 'tape' | 'coin' | 'click' | ...` or silence with `sfx: false`.
- Ransom letters: `paper` on every other letter. Typed labels and `headline(anim: 'type')`: typewriter clacks.
- `script()` and `mark()`: `marker` for their duration. `counter()`: odometer `tick`s. `tape()`: `tape`.
- Camera: whip -> `whoosh`, finale pull and the loop push -> `swish`.
- By hand: `sfx(type, time, { pan, gain, dur })`.

Types: paper slide lift pop flip pin tape marker type tick stamp coin click grow whoosh swish snap thud.

## audio/beds.json
```json
{ "beds": [
    { "from": 0, "to": 60, "type": "music", "mood": "archive", "bpm": 92, "key": "D", "gain": -31 },
    { "from": 0, "to": 60, "type": "crackle", "gain": -42 },
    { "from": 0, "to": 60, "type": "room", "gain": -47 } ] }
```
- `music` moods: `curious` (plucked, light shaker), `warm`, `archive` (music box + minor: history), `news` (brisk:
  tech/data), `tense`. `bpm`, `key` (C..B). History pieces: `archive` + a `crackle` bed.
- Gains are RMS targets; -30..-33 for music keeps the voice-to-bed ratio above 16 dB after the mix ducks it.
The app's mix step ducks the bed under the voice, normalises to -16 LUFS and checks the ratio (mix_report.json).
