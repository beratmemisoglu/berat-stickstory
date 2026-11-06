#!/usr/bin/env python3
"""Step (late): procedural ambience beds + subtle SFX, synthesized (no samples, no licensing).

  python sound_design.py <project>

Inputs:  audio/events.json   (from `node render.mjs <project> events`)
         audio/beds.json     (you write it: which ambience plays when)
Output:  audio/sfx_bed.wav   (stereo 48 kHz) - then run mix.py

beds.json format:
  {"beds": [ {"from": 0, "to": 78.3, "type": "pad", "gain": -31, "root": 55},
             {"from": 78.3, "to": 128, "type": "city", "gain": -30}, ... ],
   "sfx": {"transition": -29, "chapter": -24, "card": -30, "accent": -30}}      (all optional)
Bed types: pad (warm breathing synth; 'root' Hz), hum (electronics / circuit boards), city (distant
night-city rumble + muffled traffic), wind (open land, gusts; 'bright' 0.5-1.2), ocean (waves + sparse
birds), room (quiet interior), keys (computer room + soft typing), crackle (room + candle/fire),
rain (steady rain), space (very low drone + slow shimmer), crowd (distant murmur).
Gains are target RMS in dBFS before the -4 dB global trim; -29..-32 is the tasteful range.

Design rules baked in (learned the hard way): beds are high-passed at 40 Hz (inaudible rumble wastes
headroom and pumps the ducker) and soft-limited at -20 dBFS; noise beds are low-passed (bright hiss
reads as repetitive whooshing); no tonal whines above ~1 kHz; crossfade 2.5 s between beds.
"""
import json, os, sys, wave
import numpy as np
from scipy.signal import lfilter

P = os.path.abspath(sys.argv[1]); A = os.path.join(P, 'audio')
ev = json.load(open(os.path.join(A, 'events.json'), encoding='utf-8'))
cfg = json.load(open(os.path.join(A, 'beds.json'), encoding='utf-8'))
tl = json.load(open(os.path.join(A, 'timeline.json'), encoding='utf-8'))
SR = 48000
DUR = max(b['to'] for b in cfg['beds']) + 1.0
DUR = max(DUR, tl[-1]['e'] + 1.5)
N = int(SR * DUR)
rng = np.random.default_rng(7)
db = lambda v: 10 ** (v / 20)

def onepole(x, fc, n=2):
    a = np.exp(-2 * np.pi * fc / SR)
    for _ in range(n): x = lfilter([1 - a], [1, -a], x)
    return x
lp = onepole
def hp(x, fc): return x - onepole(x, fc)
def bp(x, lo, hi): return lp(hp(x, lo), hi)
def noise(n, color='white'):
    x = rng.standard_normal(n)
    if color == 'pink':
        x = sum(np.convolve(rng.standard_normal(n), np.ones(k) / k, 'same') * (k ** .5) for k in (1, 3, 9, 27, 81, 243))
    elif color == 'brown':
        x = np.cumsum(x); x -= np.convolve(x, np.ones(4801) / 4801, 'same')
    return x / (np.abs(x).max() + 1e-9)
def lfo(n, rate, depth, ph=0.):
    t = np.arange(n) / SR; return 1 - depth * (.5 + .5 * np.sin(2 * np.pi * rate * t + ph))
def st(l, r=None): return np.stack([l, l if r is None else r], 1)
def env(n, a, r):
    e = np.ones(n); ka, kr = int(a * SR), int(r * SR)
    if ka: e[:ka] = np.linspace(0, 1, min(ka, n))[:ka]
    if kr: e[-kr:] *= np.linspace(1, 0, kr) ** 2
    return e

def pad(n, root=55.0, **_):
    # built in 30 s blocks with the low-pass state carried over: the same samples as one long pass, a fraction of the memory
    out = np.empty((n, 2)); k = np.exp(-2 * np.pi * 900 / SR); zi = {}
    for c0 in range(0, n, SR * 30):
        m = min(SR * 30, n - c0); t = (np.arange(m) + c0) / SR; blk = np.zeros((m, 2))
        for i, (mul, amp) in enumerate([(1, 1), (1.5, .6), (2, .5), (3, .18)]):
            for ch, det in ((0, -.6), (1, .7)):
                blk[:, ch] += amp * np.sin(2 * np.pi * (root * mul + det) * t + i) * (1 + .15 * np.sin(2 * np.pi * .05 * t + i))
        blk *= (1 - .35 * (.5 + .5 * np.sin(2 * np.pi * .03 * t)))[:, None]                     # = lfo(n, .03, .35)
        for ch in (0, 1):
            x = blk[:, ch]
            for p in (0, 1):                                                                       # = onepole(x, 900), two passes
                x, zi[ch, p] = lfilter([1 - k], [1, -k], x, zi=zi.get((ch, p), np.zeros(1)))
            out[c0:c0 + m, ch] = x
    return out
def hum(n, **_):
    t = np.arange(n) / SR
    h = .5 * np.sin(2 * np.pi * 60 * t) + .25 * np.sin(2 * np.pi * 120 * t) + .08 * np.sin(2 * np.pi * 180 * t)
    return st(h * .22, h * .2) + pad(n, 49) * .6
def city(n, **_):
    base = np.stack([lp(noise(n, 'brown'), 300), lp(noise(n, 'brown'), 300)], 1) * .5
    sw = np.zeros((n, 2)); t = 0.
    while t < n / SR:
        d = 3 + rng.random() * 3; s0 = int(t * SR); k = min(int(d * SR), n - s0)
        if k > 0:
            e = np.sin(np.linspace(0, np.pi, k)) ** 2; pan = rng.random()
            car = lp(bp(noise(k, 'pink'), 70, 420), 420) * e * .2
            sw[s0:s0 + k, 0] += car * (1 - pan); sw[s0:s0 + k, 1] += car * pan
        t += 2 + rng.random() * 5
    return base + sw
def wind(n, bright=1.0, **_):
    g = np.clip(lfo(n, .07, .9, 1) * lfo(n, .19, .5, 2), .15, 1)
    mk = lambda gg: lp(bp(noise(n, 'pink'), 110, 650 * bright), 900) * gg
    return st(mk(g), mk(np.roll(g, SR // 3))) * .7
def ocean(n, **_):
    t = np.arange(n) / SR; we = (.5 + .5 * np.sin(2 * np.pi * t / 7.5)) ** 3
    mk = lambda e: lp(bp(noise(n, 'pink'), 180, 1500), 2000) * (.25 + .75 * e)
    out = st(mk(we), mk(np.roll(we, SR))) * .55; tb = 1.5
    while tb < n / SR - 1:
        for k in range(rng.integers(2, 4)):
            s0 = int((tb + k * .13) * SR); m = int(.09 * SR)
            if s0 + m >= n: break
            f = np.linspace(3200, 4200, m) + rng.random() * 500
            c = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.linspace(0, np.pi, m)) * .06; pan = rng.random()
            out[s0:s0 + m, 0] += c * (1 - pan); out[s0:s0 + m, 1] += c * pan
        tb += 3 + rng.random() * 5
    return out
def room(n, clicks=False, crackle=False, **_):
    out = np.stack([lp(noise(n, 'pink'), 1200), lp(noise(n, 'pink'), 1200)], 1) * .16
    t = np.arange(n) / SR; out += st(np.sin(2 * np.pi * 110 * t) * .03)
    if clicks or crackle:
        tc = .3
        while tc < n / SR - .2:
            s0 = int(tc * SR); m = int((.012 if clicks else .006) * SR)
            k = hp(noise(m), 1500 if clicks else 2500) * np.exp(-np.linspace(0, 8, m)) * (.10 if clicks else .07)
            pan = .35 + rng.random() * .3; out[s0:s0 + m, 0] += k * (1 - pan); out[s0:s0 + m, 1] += k * pan
            tc += (.08 + rng.random() * .22) if clicks else (.05 + rng.random() * .6)
            if clicks and rng.random() < .08: tc += .6
    return out
def rain(n, **_):
    mk = lambda: lp(bp(noise(n, 'pink'), 400, 3500), 5000) * (1 + .1 * np.sin(np.arange(n) / SR * .3))
    return st(mk(), mk()) * .5
def space(n, **_):
    t = np.arange(n) / SR
    d = np.sin(2 * np.pi * 41.2 * t) * .6 + np.sin(2 * np.pi * 61.7 * t) * .3
    sh = np.sin(2 * np.pi * 880 * t + 3 * np.sin(2 * np.pi * .07 * t)) * .02 * lfo(n, .05, .9)
    return st(lp(d, 300) + sh, lp(d, 300) + np.roll(sh, SR // 2))
def crowd(n, **_):
    mk = lambda: bp(noise(n, 'pink'), 250, 1400) * np.clip(lfo(n, .13, .5) * lfo(n, .41, .3, 1), .3, 1)
    return st(mk(), mk()) * .6
GEN = {'pad': pad, 'hum': hum, 'city': city, 'wind': wind, 'ocean': ocean, 'room': room, 'rain': rain, 'space': space, 'crowd': crowd,
       'keys': lambda n, **k: room(n, clicks=True), 'crackle': lambda n, **k: room(n, crackle=True)}

FADE = 2.5
bed = np.zeros((N, 2))
for b in cfg['beds']:
    s0, s1 = int(max(0, b['from'] - FADE / 2) * SR), min(N, int((b['to'] + FADE / 2) * SR))
    kw = {k: v for k, v in b.items() if k not in ('from', 'to', 'type', 'gain')}
    xb = GEN[b['type']](s1 - s0, **kw)
    xb /= (np.sqrt(np.mean(xb ** 2)) + 1e-9); xb *= db(b.get('gain', -30) - 4)
    xb *= env(s1 - s0, FADE if b['from'] > 0 else 3.0, FADE)[:, None]
    bed[s0:s1] += xb; del xb
    print(f"bed {b['from']:7.1f}-{b['to']:7.1f}  {b['type']:8s} {b.get('gain', -30)} dB")
bed[:, 0] = hp(bed[:, 0], 40); bed[:, 1] = hp(bed[:, 1], 40)
L = db(-20); bed /= L; np.tanh(bed, out=bed); bed *= L

S = {'transition': -29, 'chapter': -24, 'card': -30, 'accent': -30, **cfg.get('sfx', {})}
sfx = np.zeros((N, 2))
# the user's own recordings (Settings > Media > Sound effects library: whoosh, impact, tick, chime ...) replace the
# synthesized ones of that kind; project.json "sound": {"effects": "auto" | "library" (only theirs) | "off"} (sfxlib.py)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sfxlib import Library, write_stems
SL = Library(P, sys.argv[2:], SR)
def place(t, x, g, pan=.5, kind=None):
    if SL.mode == 'off': return
    mine = SL.recorded(kind, 0, user_only=True) if kind else None
    if mine is None and SL.mode == 'library': return
    if mine is not None: x = mine
    s0 = int(t * SR); m = min(len(x), N - s0)
    if m <= 0 or s0 < 0: return
    x = x / (np.abs(x).max() + 1e-9) * db(g - 2)
    sfx[s0:s0 + m, 0] += x[:m] * np.sqrt(1 - pan) * 1.41; sfx[s0:s0 + m, 1] += x[:m] * np.sqrt(pan) * 1.41
def whoosh(d, lo, hi): m = int(d * SR); return bp(noise(m, 'pink'), lo, hi) * np.sin(np.linspace(0, np.pi, m)) ** 2.5
def thump(d=.5, f=55): t = np.arange(int(d * SR)) / SR; return np.sin(2 * np.pi * f * t * (1 - .3 * t)) * np.exp(-t * 7)
def tick(): t = np.arange(int(.06 * SR)) / SR; return bp(noise(len(t)), 1800, 6000) * np.exp(-t * 90) + .6 * np.sin(2 * np.pi * 1320 * t) * np.exp(-t * 60)
def chime(f):
    t = np.arange(int(.9 * SR)) / SR
    return (np.sin(2 * np.pi * f * t) + .4 * np.sin(2 * np.pi * f * 1.5 * t) + .15 * np.sin(2 * np.pi * f * 2.01 * t)) * np.exp(-t * 5.5) * (1 - np.exp(-t * 300))
for i, s in enumerate(ev['shots'][1:], 1):
    if s.get('cut'): continue
    if s['chapter']: place(s['t0'] - .45, whoosh(.9, 120, 1600), S['chapter'], .5, 'whoosh'); place(s['t0'] + .1, thump(), S['chapter'] - 1, .5, 'impact')
    else: place(s['t0'] - .3, whoosh(.55, 400, 3000), S['transition'], .3 + .4 * (i % 2), 'whoosh')
for c in ev['cards']: place(c['t'], tick(), S['card'], .6, 'tick')
notes, last = [659.3, 783.99, 880.0, 987.8, 1174.7], -9
for k, h in enumerate(ev['hits']):
    if h - last < 1.5: continue
    place(h, chime(notes[k % 5]), S['accent'], .4 + .1 * (k % 3), 'chime'); last = h
SL.write_credits()

bed_rms = 20 * np.log10(np.sqrt(np.einsum('ij,ij->', bed, bed) / bed.size) + 1e-9)   # no full-length temporaries
# (summed 10 s at a time, no full-length temporaries: the beds and the effects stay apart for the separate tracks)
wv = wave.open(os.path.join(A, 'sfx_bed.wav'), 'wb'); wv.setnchannels(2); wv.setsampwidth(2); wv.setframerate(SR); pk = 0.
for i in range(0, N, SR * 10):
    mix = bed[i:i + SR * 10] + sfx[i:i + SR * 10]; pk = max(pk, mix.max(), -mix.min())
    wv.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
wv.close()
print(f'peak {20 * np.log10(pk + 1e-9):.1f} dBFS, bed RMS {bed_rms:.1f} dBFS')
print('wrote audio/sfx_bed.wav')
write_stems(A, SR, bed, sfx)                                                  # sound_music.wav + sound_sfx.wav (Export: separate tracks)
