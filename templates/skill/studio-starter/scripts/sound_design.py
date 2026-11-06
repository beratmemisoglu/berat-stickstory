#!/usr/bin/env python3
"""Studio starter sound design (the same synthesiser as the Flat explainer): small tactile SFX from the engine's events
+ a light procedural music bed. No samples. A style made in the Style Studio keeps this until it designs its own sound.

  python sound_design.py <project>

Inputs:  audio/events.json  (the app's event pass: shots with transitions, and every tactile sound the scenes
                             scheduled: {"t", "type", "pan", "gain", "dur"})
         audio/beds.json    (music and room tone per section - see below)
         audio/timeline.json
Output:  audio/sfx_bed.wav  (stereo 48 kHz) - mix.py then ducks it under the voice and normalises.

beds.json:
  {"beds": [ {"from": 0, "to": 21, "type": "music", "mood": "curious", "bpm": 96, "gain": -30, "key": "D"},
             {"from": 0, "to": 21, "type": "room", "gain": -44} ],
   "sfx": {"paper": -24, "marker": -28, ...}}                       (per-type level overrides, optional)
Bed types: music (mood: curious | archive | news | tense | warm), room (quiet room tone), crackle (vinyl dust),
           pad (soft sustained chord).
SFX types: paper slide lift pop flip pin tape marker type tick stamp coin click grow whoosh swish snap thud.

Design rules (why the mix sounds "Vox"): every visual event gets a small physical sound (paper, pins, pens,
keys), never a cartoon effect; SFX sit well under the voice (-24..-30 dBFS peaks) and are band-limited so they
never mask speech; the music is sparse, plucky and mid-quiet, and ducks further under the voice in mix.py.
"""
import json, os, sys, wave
import numpy as np
from scipy.signal import lfilter, butter

P = os.path.abspath(sys.argv[1]); A = os.path.join(P, 'audio')
ev = json.load(open(os.path.join(A, 'events.json'), encoding='utf-8'))
cfg = json.load(open(os.path.join(A, 'beds.json'), encoding='utf-8'))
tlf = os.path.join(A, 'timeline.json')
tl = json.load(open(tlf, encoding='utf-8')) if os.path.exists(tlf) else []      # no voiceover yet: still render the bed
SR = 48000
DUR = max([b['to'] for b in cfg['beds']] + ([tl[-1]['e'] + 1.5] if tl else [])) + .5
N = int(SR * DUR)
rng = np.random.default_rng(11)
db = lambda v: 10 ** (v / 20)

def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], btype='band'); return lfilter(b, a, x)
def lp(x, fc, order=2): b, a = butter(order, fc / (SR / 2)); return lfilter(b, a, x)
def hp(x, fc, order=2): b, a = butter(order, fc / (SR / 2), btype='high'); return lfilter(b, a, x)
def noise(n): return rng.standard_normal(n)
def env(n, a, r, shape=2.): t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4) * shape)
def tt(d): return np.arange(int(d * SR)) / SR

# ---------- tactile SFX (each returns mono, peak-normalised later) ----------
def s_paper(d=0):                                   # a card landing: soft flap + tiny low thump
    n = int(.16 * SR); x = bp(noise(n), 900, 5200) * env(n, .004, .035) + .5 * lp(noise(n), 260) * env(n, .002, .03)
    return x
def s_slide(d=0):                                   # paper sliding over paper
    n = int(.34 * SR); t = np.linspace(0, 1, n); sweep = bp(noise(n), 1400, 5000) * np.sin(np.pi * t) ** 1.6
    return sweep * (1 + .3 * np.sin(2 * np.pi * 34 * t * .34))
def s_lift(d=0): return s_slide()[::-1] * .8
def s_pop(d=0):
    t = tt(.09); f = 700 * np.exp(-t * 18) + 220; return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .001, .025) + .15 * bp(noise(len(t)), 2000, 7000) * env(len(t), .0005, .006)
def s_flip(d=0): a = s_paper(); b = np.zeros(int(.07 * SR)); return np.concatenate([a * .7, b, a])
def s_pin(d=0):
    t = tt(.25); click = bp(noise(len(t)), 2500, 9000) * env(len(t), .0003, .004)
    ring = (np.sin(2 * np.pi * 3100 * t) + .5 * np.sin(2 * np.pi * 4740 * t)) * env(len(t), .0005, .05) * .25
    return click + ring + .4 * lp(noise(len(t)), 300) * env(len(t), .001, .012)
def s_tape(d=0):                                    # masking tape pulled and pressed: crackly rip
    n = int(.38 * SR); t = np.linspace(0, 1, n); crack = (rng.random(n) < .012) * rng.standard_normal(n) * 3
    return bp(noise(n) * .4 + crack, 800, 6000) * np.sin(np.pi * t) ** .7
def s_marker(d=.4):                                 # felt marker on paper: dry squeaky scrub
    d = max(d, .2); n = int(d * SR); t = np.arange(n) / SR
    am = .55 + .45 * np.sin(2 * np.pi * (9 + 3 * np.sin(t * 7)) * t) ** 2
    return bp(noise(n), 1800, 5500) * am * np.minimum(1, t / .03) * np.minimum(1, (d - t) / .06)
def s_type(d=.6):                                   # typewriter: clacks at ~12/s with a thunk each
    d = max(d, .15); out = np.zeros(int((d + .15) * SR)); k = 0
    for c in np.arange(0, d, 1 / 12):
        c += rng.uniform(-.012, .012); s0 = int(max(0, c) * SR); t = tt(.07)
        clack = bp(noise(len(t)), 1500, 7000) * env(len(t), .0003, .006) + .6 * np.sin(2 * np.pi * 180 * t) * env(len(t), .001, .012)
        out[s0:s0 + len(t)] += clack[:len(out) - s0] * (.8 + .4 * rng.random()); k += 1
    return out
def s_tick(d=.8):                                   # odometer / counter: fast ticks slowing down
    d = max(d, .2); out = np.zeros(int((d + .1) * SR)); c = 0.; step = .035
    while c < d:
        s0 = int(c * SR); t = tt(.02); tk = bp(noise(len(t)), 2500, 8000) * env(len(t), .0002, .003) + .3 * np.sin(2 * np.pi * 1900 * t) * env(len(t), .0002, .004)
        out[s0:s0 + len(t)] += tk[:len(out) - s0]; c += step; step *= 1.09
    return out
def s_stamp(d=0):
    t = tt(.3); return np.sin(2 * np.pi * 95 * t * (1 - .4 * t)) * env(len(t), .001, .05) + .6 * bp(noise(len(t)), 600, 4000) * env(len(t), .0005, .02)
def s_coin(d=0):
    t = tt(.7); return sum(a * np.sin(2 * np.pi * f * t) for f, a in [(2150, 1), (3310, .6), (5590, .35), (7800, .15)]) * env(len(t), .0005, .09) + .5 * bp(noise(len(t)), 3000, 9000) * env(len(t), .0003, .004)
def s_click(d=0): t = tt(.04); return bp(noise(len(t)), 2000, 8000) * env(len(t), .0002, .004)
def s_grow(d=0): n = int(.5 * SR); t = np.linspace(0, 1, n); return bp(noise(n), 500, 2500) * t ** 1.5 * (1 - t) * 3
def s_whoosh(d=0):
    n = int(.5 * SR); t = np.linspace(0, 1, n); x = noise(n); out = np.zeros(n)
    for i in range(8):                                                  # swept band: low -> high -> low
        a, b = i * n // 8, (i + 1) * n // 8; f = 400 + 2600 * np.sin(np.pi * (a + b) / 2 / n)
        out[a:b] = bp(x, f * .6, f * 1.6)[a:b]
    return out * np.sin(np.pi * t) ** 2.2
def s_swish(d=0): return np.concatenate([s_slide(), np.zeros(int(.02 * SR))]) * 1.2
def s_snap(d=0):                                    # film camera shutter
    a = s_click(); gap = np.zeros(int(.045 * SR)); b = s_click() * .7; body = lp(noise(int(.06 * SR)), 900) * env(int(.06 * SR), .001, .01) * .5
    x = np.concatenate([a, gap, b]); x[:len(body)] += body; return x
def s_thud(d=0): t = tt(.35); return np.sin(2 * np.pi * 70 * t) * env(len(t), .002, .06)
SFX = dict(paper=s_paper, slide=s_slide, lift=s_lift, pop=s_pop, flip=s_flip, pin=s_pin, tape=s_tape, marker=s_marker, type=s_type,
           tick=s_tick, stamp=s_stamp, coin=s_coin, click=s_click, grow=s_grow, whoosh=s_whoosh, swish=s_swish, snap=s_snap, thud=s_thud)
LEVEL = dict(paper=-25, slide=-28, lift=-29, pop=-27, flip=-27, pin=-25, tape=-26, marker=-29, type=-28, tick=-31, stamp=-23, coin=-25,
             click=-28, grow=-30, whoosh=-26, swish=-26, snap=-25, thud=-26, **cfg.get('sfx', {}))

# ---------- music ----------
NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}
def hz(semi_from_c4): return 261.63 * 2 ** (semi_from_c4 / 12)
def pluck(f, d, bright=.5):                         # Karplus-Strong plucked string
    n = int(d * SR); p = max(2, int(SR / f)); buf = rng.uniform(-1, 1, p) * (1 - bright) + np.sign(rng.uniform(-1, 1, p)) * bright * .3
    out = np.zeros(n); j = 0; decay = .9915                                   # short, woody pluck (longer rings into a tone)
    for i in range(n): out[i] = buf[j]; nxt = decay * .5 * (buf[j] + buf[(j + 1) % p]); buf[j] = nxt; j = (j + 1) % p
    return lp(out, 4200) * np.exp(-np.arange(n) / SR * 2.2)
def bell(f, d):
    t = tt(d); return sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * k) for m, a, k in [(1, 1, 3), (2.76, .35, 6), (5.4, .15, 10)]) * np.minimum(1, t / .004)
def soft_bass(f, d): t = tt(d); return (np.sin(2 * np.pi * f * t) + .25 * np.sin(4 * np.pi * f * t)) * np.minimum(1, t / .01) * np.exp(-t * 2.2)
def shaker(): n = int(.05 * SR); return bp(noise(n), 5000, 11000) * env(n, .002, .012)
MOODS = {   # chord roots (semitones from key) + quality, instrument
  'curious': ([0, 9, 5, 7], ['maj', 'min', 'maj', 'maj'], 'pluck', 96),
  'warm':    ([0, 5, 9, 7], ['maj', 'maj', 'min', 'maj'], 'pluck', 84),
  'archive': ([0, 8, 3, 10], ['min', 'maj', 'maj', 'maj'], 'bell', 78),
  'news':    ([0, 0, 5, 7], ['maj', 'maj', 'maj', 'maj'], 'pluck', 112),
  'tense':   ([0, 1, 0, 8], ['min', 'maj', 'min', 'maj'], 'bell', 88),
}
def music(n, mood='curious', bpm=None, key='D', **_):
    roots, quals, inst, bpm0 = MOODS.get(mood, MOODS['curious']); bpm = bpm or bpm0
    beat = 60 / bpm; bar = beat * 4; out = np.zeros(n); k0 = NOTE.get(key, 2) - 12
    cache = {}
    def note(f, d, kind):
        key2 = (round(f, 1), round(d, 2), kind)
        if key2 not in cache: cache[key2] = pluck(f, d, .35) if kind == 'pluck' else bell(f, d) if kind == 'bell' else soft_bass(f, d)
        return cache[key2]
    t = 0.; b = 0
    while t < n / SR:
        r, q = roots[b % 4], quals[b % 4]; third = 4 if q == 'maj' else 3
        chord = [k0 + r, k0 + r + third, k0 + r + 7, k0 + r + 12]
        pattern = [0, 2, 1, 3, 2, 1, 3, 2]                               # eighth-note arpeggio
        for i, pi in enumerate(pattern):
            s0 = int((t + i * beat / 2) * SR)
            if s0 >= n: break
            x = note(hz(chord[pi]), beat * 1.6, inst) * (.55 if i % 2 else .8); m = min(len(x), n - s0); out[s0:s0 + m] += x[:m]
        for i in range(2):                                              # bass on 1 and 3
            s0 = int((t + i * beat * 2) * SR)
            if s0 < n: x = note(hz(k0 + r - 24), beat * 1.9, 'bass') * .9; m = min(len(x), n - s0); out[s0:s0 + m] += x[:m]
        if mood in ('news', 'curious'):
            for i in range(8):
                s0 = int((t + i * beat / 2 + beat / 4) * SR)
                if s0 < n: x = shaker() * (.35 if i % 2 else .2); m = min(len(x), n - s0); out[s0:s0 + m] += x[:m]
        t += bar; b += 1
    return hp(out, 60)
def room(n, **_): return lp(noise(n), 900) * .5 + lp(noise(n), 250)
def crackle(n, **_): c = (rng.random(n) < .0009) * rng.standard_normal(n) * 6; return bp(c, 1200, 8000) + lp(noise(n), 400) * .08
def pad(n, key='D', **_):
    t = np.arange(n) / SR; k = NOTE.get(key, 2) - 12; return sum(np.sin(2 * np.pi * hz(k + s) * t + s) for s in [0, 4, 7, 11]) * (1 + .2 * np.sin(2 * np.pi * .08 * t))
BEDS = dict(music=music, room=room, crackle=crackle, pad=pad)

# ---------- render ----------
bed = np.zeros((N, 2))
for b in cfg['beds']:
    s0, s1 = int(b['from'] * SR), min(N, int(b['to'] * SR))
    if s1 <= s0: continue
    kw = {k: v for k, v in b.items() if k not in ('from', 'to', 'type', 'gain')}
    x = BEDS.get(b['type'], room)(s1 - s0, **kw)
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * db(b.get('gain', -32) - 3)
    fade = np.minimum(1, np.minimum(np.arange(len(x)) / (SR * (1.2 if b['from'] > 0 else .3)), (len(x) - np.arange(len(x))) / (SR * 1.2)))
    x *= fade
    width = .15 if b['type'] == 'music' else .4                           # stereo: slightly decorrelated channels
    bed[s0:s1, 0] += x * (1 - width / 2); bed[s0:s1, 1] += np.roll(x, int(SR * .006)) * (1 - width / 2)
    print(f"bed {b['from']:6.1f}-{b['to']:6.1f}  {b['type']:8s} {b.get('mood', '')} {b.get('gain', -32)} dB")

sfx = np.zeros((N, 2)); counts = {}
# the user's own recordings (Settings > Media > Sound effects library) replace this style's synthesized sound of the same
# kind; project.json "sound": {"effects": "auto" | "library" (only theirs) | "off"} (pixel-explainer-video/scripts/sfxlib.py)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'pixel-explainer-video', 'scripts'))
from sfxlib import Library, write_stems
SL = Library(P, sys.argv[2:], SR); placed = []
for e in ev.get('sfx', []) if SL.mode != 'off' else []:
    fn = SFX.get(e['type']); s0 = int(e['t'] * SR)
    if s0 < 0 or s0 >= N: continue
    x = SL.recorded(e['type'], e.get('dur', 0) or 0, user_only=True)
    if x is None and (not fn or SL.mode == 'library'): continue
    placed.append(f"{e['t']:7.2f}s  {e['type']:12s} {'recorded' if x is not None else 'synth'}")
    x = x if x is not None else fn(e.get('dur', 0) or 0); x = x / (np.abs(x).max() + 1e-9) * db(LEVEL.get(e['type'], -28) + e.get('gain', 0))
    m = min(len(x), N - s0); pan = e.get('pan', .5)
    sfx[s0:s0 + m, 0] += x[:m] * np.sqrt(1 - pan) * 1.41; sfx[s0:s0 + m, 1] += x[:m] * np.sqrt(pan) * 1.41
    counts[e['type']] = counts.get(e['type'], 0) + 1
print('sfx:', ', '.join(f'{k} x{v}' for k, v in sorted(counts.items())))
open(os.path.join(A, 'sfx_placed.txt'), 'w', encoding='utf-8').write('\n'.join(placed) + ('\n' if placed else '')); SL.write_credits()

mix = bed + sfx
L = db(-6); mix = np.tanh(mix / L) * L                                    # gentle safety limiter
print(f'peak {20 * np.log10(np.abs(mix).max() + 1e-9):.1f} dBFS')
w = wave.open(os.path.join(A, 'sfx_bed.wav'), 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
print('wrote audio/sfx_bed.wav')
write_stems(A, SR, bed, sfx, lambda x: np.tanh(x / L) * L)              # sound_music.wav + sound_sfx.wav, the same limiter (Export: separate tracks)
