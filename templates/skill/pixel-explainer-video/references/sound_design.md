# Sound design

Goal: immersion without ever competing with the voice. Everything is synthesized by
`scripts/sound_design.py` (no samples, no licensing), driven by `audio/events.json` (from
`render.mjs events`) and `audio/beds.json` (you write it).

## Choosing beds (one per section, crossfaded 2.5 s)
| Scene type | Bed |
|---|---|
| Intro, abstract/diagram sections, endings | `pad` (root 49-82 Hz; use a different root per section for variety) |
| Hardware, circuit boards, electronics | `hum` |
| Cities, streets, traffic | `city` |
| Open land, deserts, mountains | `wind` (`bright` 0.6-1.0) |
| Coasts, islands, tropical | `ocean` |
| Offices, studios, coding | `keys` (room tone + soft typing) |
| Interiors with fire/candles | `crackle` |
| Quiet interiors | `room` |
| Weather scenes | `rain` |
| Space, sci-fi, abstract vastness | `space` |
| Events, conferences, crowds | `crowd` |
Gains: -29 to -32 (dBFS RMS before a global -4 dB trim). Example:
```json
{"beds": [{"from": 0, "to": 78.3, "type": "pad", "gain": -31, "root": 55},
          {"from": 78.3, "to": 128.0, "type": "city", "gain": -30},
          {"from": 128.0, "to": 210.4, "type": "hum", "gain": -32}]}
```
Beds must cover 0 .. end without gaps (the last bed's `to` = video end).

## SFX (automatic from events.json)
- Transitions: a soft filtered-air whoosh peaking at the cut (-29 dB).
- Chapter openings: deeper swell + gentle sub thump (-24 dB).
- Image cards: tiny paper tick (-30 dB).
- `st.hits` accents: soft pentatonic chime, at most one per 1.5 s (-30 dB).
Override levels with `"sfx": {"transition": -29, "chapter": -24, "card": -30, "accent": -30}`.

## Mix and verification (mix.py)
- Voice untouched; bed sidechain-ducked by the voice (~4-5 dB dip while speaking), then the whole mix
  loudness-normalised to -16 LUFS with a -1.5 dB true-peak ceiling (YouTube-friendly; original TTS/voice
  files are often around -22 LUFS).
- Pass: voice-to-bed >= 16 dB while speaking. If lower, reduce bed gains 2-4 dB and re-run.
- You can't listen, so verify visually: `ffmpeg -ss 200 -t 40 -i audio/sfx_bed.wav -lavfi
  showspectrumpic=s=1600x300:legend=0 out/spec.png`. Bad signs: thin horizontal lines above ~1 kHz
  (tonal whine), repeated broadband columns every few seconds that aren't transitions (hissy swells).
- Always tell the user a few timestamps to listen to and that levels are one number each in beds.json.
