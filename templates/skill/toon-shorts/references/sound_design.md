# Sound design (3D cartoon shorts)

The app collects every `S.sfx(type, t)` the shots schedule (each shot is built once for it), adds a soft whoosh on every
`whip` / `zoom` transition, and runs `scripts/sound_design.py`, which writes `audio/sfx_bed.wav`; the mix puts it under
the voice (final about -14 LUFS). You only schedule events.

## The rules (measured on the references)

- The voice leads, wall to wall. Effects are heard but sit 8-14 dB under it (the levels per type are set; `gain`
  -6..+3 dB adjusts one).
- **Every effect belongs to something visible on screen at that frame**: a prop popping in, a landing, a door, a splash,
  a counter landing, a light switching, a camera rush that really moves. Never on a plain cut, never on a caption.
- **Density**: 3-5 in the first 5-8 s (the hook), then about one every 3-5 s: 12-20 a minute. A dense action beat may
  have 3 in a second; a calm stretch may have none for 4 s.
- **No music** unless the user asked: music is the user's choice (Project settings > Music). sound_design.py ignores
  `music` beds unless `audio/beds.json` says `"music": true`, and ambience beds unless `"ambience": true` (rain, crowd,
  city, wind, only when the scene really needs it; a `room` bed is capped at -45 dB).
- The one 0.5 s pause a short may have is filled with an effect.

## The call

`S.sfx(type, t, { gain: 0, pan: .5, dur })` in build (also `sfx(...)` from engine.js). `t` is a video time: a cue
(`S.at('door')`) or an event time you computed (`tHit`, `tGrab`). `pan` 0 = left .. 1 = right (match the thing's side
of the frame). `dur` (seconds) for timed types.

## Types

| type | for |
|---|---|
| `impact`, `thud`, `bonk` | a hit, a landing, a fall, a heavy prop set down |
| `explosion`, `boom` | a blast (`S.fx('explosion')` adds its own impact) |
| `pop` | a prop popping in, a sign or bubble appearing, a cork |
| `whoosh`, `swish`, `zip` | a real rush of the camera or a thing (a throw, a swipe, a fly-through) |
| `click`, `tick`, `beep`, `blink` | buttons, switches, a counter rolling (`tick` with `dur`), UI |
| `ding`, `chime`, `bell` | a counter landing, a correct answer, an idea |
| `boing`, `squeak` | cartoon springs, a squeeze, a comic bounce |
| `splash` | water (`S.fx('splash')` adds its own) |
| `glass` | something breaking |
| `coin`, `cash`, `win`, `slot`, `roulette`, `cards`, `chips` | money, prizes, games (`slot` / `roulette` with `dur`) |
| `typing`, `phone`, `camera`, `paper`, `door`, `keys` | everyday foley (`typing` with `dur`) |
| `footstep` | a step that matters (a sneak, a big stomp), not every step of a walk |
| `alarm`, `heartbeat` | danger, tension (with `dur`) |
| `gasp`, `cheer`, `crowd` | a crowd's reaction (with `dur`) |
| `glitch`, `error`, `notification` | screens and devices |
| `thunder`, `rain`, `fire` | weather and fire beats (`S.fx('lightning')` adds its own thunder) |

The script sets the levels the references use: impacts loudest (~10 LU under the voice), pops and whooshes ~15, foley
~16, landing dings ~20, UI ticks ~22. Types without a recording in the library and without a synthesized version (some
of the foley ones) are skipped with a note in the Sound step's log: prefer the common types.

- Most types play real recorded CC0 / public-domain clips (a seeded random pick per event, with a little pitch and gain
  jitter); `boing`, `bonk`, `zip`, `squeak`, `blink` are always synthesized. Credits of the recordings are written to
  DESCRIPTION.txt by themselves.
- Timed types are cut to `dur` with a fade: `S.sfx('tick', tStart, { dur: tLand - tStart })` under a counter roll.
- A specific recording: `S.sfx('tag:door creak', t)` (all words must match its tags) or a clip id (`'sfx.coin.02'`).

## Added for you (don't double them)

- A whoosh on every `whip*` and `zoom` transition (at its start, -8 dB).
- `S.fx('confetti')` burst: pop; `S.fx('explosion')`: impact; `S.fx('splash')`: splash; `S.fx('lightning')`: an impact
  0.35 s after each strike. (`sfx: false` in the fx options turns one off.)
- `S.info(kind, { sfx: true })`: `led` and `gauge` ding when they land, map pins pop, checklist marks and grid runs click,
  calendar pages swish. Off unless you pass `sfx: true` (or a type: `sfx: 'coin'`).
- `S.fx('sparkle', { sfx: true })`: a soft ding.

## Examples

```js
S.sfx('pop', S.at('cake'));                                // the cake pops onto the table on its word
S.sfx('swish', tThrow); S.sfx('pop', tCatch, { gain: -2 }); // a throw and its catch
S.sfx('impact', tHit); you.hop(tHit + 5 * F);               // the impact, then the startle 5 frames later
S.sfx('tick', S.at('rolls'), { dur: S.at('ninety') - S.at('rolls'), gain: -4 });   // a counter rolling ...
S.info('led', { ..., t1: S.at('ninety'), sfx: true });      // ... and its ding on the number
S.sfx('alarm', tAlarm, { dur: .9, gain: -6 });              // the alarm light on its word
S.sfx('whoosh', S.t1 - .3, { gain: -3 });                   // a fly-through rushing into the next shot
```

## Check (sop.md G6)

grep the scenes for `sfx(`: 12-20 a minute, 3-5 in the hook, every one on a visible event at that frame; no effect
on a cut alone; no music bed unless asked. After the app's Sound step, `audio/sfx_placed.txt` lists every placed effect
(time, type, recorded / synth).
