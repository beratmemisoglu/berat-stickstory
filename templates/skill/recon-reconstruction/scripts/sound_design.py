#!/usr/bin/env python3
"""Reconstruction-style sound design: a quiet documentary bed + physical effects on the moments the scenes show. No samples.

  python sound_design.py <project>

Inputs:  audio/events.json   (the app's event pass: shots, and every sfx(type, t, { gain, pan, dur }) the scenes scheduled)
         audio/beds.json     (optional) {"beds": [{"from": 0, "to": 70, "type": "wind", "gain": -30}], "sfx": {"impact": -8}}
         audio/timeline.json (the voice, so the bed ducks under speech)
Output:  audio/sfx_bed.wav   (stereo 48 kHz) - mix.py then puts it under the voice and normalises.

Bed types: wind (outdoors, weather), water (sea, rivers, caves), drone (interiors, tension), space (low chord, airless).
SFX types: whoosh impact thud splash rumble creak tick beep alarm bubbles.
Every dip transition gets a soft whoosh automatically; everything else comes from sfx() calls in the scenes.
Design rules: effects are physical and real (no cartoon sounds), sit well under the voice (-12..-26 dB peaks), and are
placed on the exact frame the picture shows the event (an impact on the frame the object hits, not the cue word).
"""
import json, os, sys, wave
import numpy as np
from scipy.signal import lfilter

SR = 48000
P = os.path.abspath(sys.argv[1]); A = os.path.join(P, 'audio')
ev = json.load(open(os.path.join(A, 'events.json'), encoding='utf-8'))
try: cfg = json.load(open(os.path.join(A, 'beds.json'), encoding='utf-8'))
except Exception: cfg = {}
try: tl = json.load(open(os.path.join(A, 'timeline.json'), encoding='utf-8'))
except Exception: tl = []
END = max([p.get('e', 0) for p in tl] + [s['t0'] + 3 for s in ev.get('shots', [])] + [e['t'] + 3 for e in ev.get('sfx', [])] + [5])
try: END = max(END, json.load(open(os.path.join(P, 'project.json'), encoding='utf-8')).get('end', 0))
except Exception: pass
N = int(END * SR) + SR
rng = np.random.default_rng(7)
db = lambda d: 10 ** (d / 20)

def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    return lfilter([1 - a], [1, -a], lfilter([1 - a], [1, -a], x)).astype(np.float32)
def hp(x, fc): return (x - lp(x, fc)).astype(np.float32)
def pink(n):
    w = rng.standard_normal(n).astype(np.float32); f = np.fft.rfft(w); k = np.arange(len(f)); k[0] = 1
    return np.fft.irfft(f / np.sqrt(k), n).astype(np.float32) * 30
def norm(x): m = float(np.max(np.abs(x))) or 1; return (x / m).astype(np.float32)
def env(n, a, r):
    t = np.arange(n) / SR; return (np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(r, 1e-4))).astype(np.float32)

def bed(kind, n):
    t = np.arange(n) / SR
    if kind in ('wind', 'water'):
        x = lp(pink(n), 900 if kind == 'wind' else 500) * (.55 + .45 * np.sin(2 * np.pi * .07 * t) * np.sin(2 * np.pi * .023 * t + 1))
        if kind == 'water': x = x + .3 * hp(pink(n), 2500) * (.6 + .4 * np.sin(2 * np.pi * .3 * t))
    else:
        f0 = 55.0 if kind == 'drone' else 41.2
        x = sum(np.sin(2 * np.pi * f * t + p) * g for f, p, g in [(f0, 0, 1), (f0 * 1.5, 1, .5), (f0 * 2.003, 2, .35), (f0 * 3.01, 3, .15)])
        x = x * (.7 + .3 * np.sin(2 * np.pi * .05 * t)) + .15 * lp(pink(n), 400)
    return norm(x)

def sfx(kind, dur=None):
    if kind in ('whoosh', 'swish'):
        d = dur or 1.0; n = int(d * SR); t = np.arange(n) / SR; return norm(lp(pink(n), 2500) * np.sin(np.pi * t / d) ** 2)
    if kind in ('impact', 'thud'):
        d = dur or (2.5 if kind == 'impact' else .6); n = int(d * SR); t = np.arange(n) / SR
        boom = np.sin(2 * np.pi * (48 * np.exp(-t * 3) + 28) * t) * env(n, .005, .5 if kind == 'impact' else .12)
        return norm(boom + .5 * lp(rng.standard_normal(n).astype(np.float32), 3000) * env(n, .001, .08))
    if kind == 'splash':
        d = dur or 3.0; n = int(d * SR); return norm(hp(pink(n), 300) * env(n, .03, .9) + .5 * lp(pink(n), 600) * env(n, .01, 1.6))
    if kind == 'rumble':
        d = dur or 4.0; n = int(d * SR); t = np.arange(n) / SR; return norm(lp(pink(n), 120) * (np.sin(np.pi * t / d) ** .5))
    if kind == 'creak':
        d = dur or 1.6; n = int(d * SR); t = np.arange(n) / SR; f = 90 + 40 * np.sin(2 * np.pi * .8 * t)
        x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * .3 + np.sin(2 * np.pi * np.cumsum(f * 3.1) / SR) * .2
        return norm(lp(x.astype(np.float32), 1500) * np.sin(np.pi * t / d))
    if kind == 'tick':
        n = int(.05 * SR); t = np.arange(n) / SR; return norm(np.sin(2 * np.pi * 2400 * t) * env(n, .0005, .008))
    if kind == 'beep':
        n = int(.18 * SR); t = np.arange(n) / SR; return norm(np.sin(2 * np.pi * 1320 * t) * np.minimum(1, np.minimum(t, .18 - t) / .01))
    if kind == 'alarm':
        d = dur or 1.6; n = int(d * SR); t = np.arange(n) / SR; return norm(np.sin(2 * np.pi * 880 * t) * (np.floor(t / .2) % 2 == 0) * np.minimum(1, (d - t) / .2))
    if kind == 'bubbles':
        d = dur or 2.0; n = int(d * SR); x = np.zeros(n, np.float32)
        for _ in range(int(d * 14)):
            s = int(rng.integers(0, max(1, n - 4000))); m = min(3000, n - s); tt = np.arange(m) / SR; f = rng.uniform(300, 900)
            x[s:s + m] += np.sin(2 * np.pi * f * (1 + 2 * tt) * tt) * np.exp(-tt * 40)
        return norm(x)
    return None

LEVEL = {'whoosh': -26, 'swish': -26, 'impact': -9, 'thud': -14, 'splash': -12, 'rumble': -16, 'creak': -21, 'tick': -20, 'beep': -21, 'alarm': -20, 'bubbles': -19}
LEVEL.update(cfg.get('sfx', {}))
L = np.zeros(N, np.float32); R = np.zeros(N, np.float32)
# beds (default: one drone under the whole film), ducked under the voice
beds = cfg.get('beds') or [{'from': 0, 'to': END, 'type': 'drone', 'gain': -32}]
voice = np.zeros(N, np.float32)
for p in tl:
    for w in p.get('words', []): voice[int(w['s'] * SR):int(w['e'] * SR)] = 1
duck = 1 - .5 * lp(voice, 3)
for b in beds:
    i0, i1 = int(b.get('from', 0) * SR), min(N, int(b.get('to', END) * SR)); n = i1 - i0
    if n <= 0: continue
    x = bed(b.get('type', 'drone'), n) * db(b.get('gain', -30)); t = np.arange(n) / SR
    x *= np.minimum(1, np.minimum(t / 2, (n / SR - t) / 2.5)); x *= duck[i0:i1]
    L[i0:i1] += x; R[i0:i1] += np.roll(x, int(.013 * SR))
BL, BR = L.copy(), R.copy()                                              # the beds alone (Export: separate tracks)
# recorded clips first (the shared library: the user's own sounds win per category, then the built-in CC0 recordings), the
# synthesized sound where none fits. project.json "sound": {"effects": "auto" | "library" (only the user's own) | "off"}
# (the Investigation look: off unless set, no effects unless the user adds them)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'pixel-explainer-video', 'scripts'))
from sfxlib import Library, place_report, write_stems
SL = Library(P, sys.argv[2:], SR)
REC = dict(whoosh='whoosh', swish='swish', impact='impact', thud='thud', splash='splash', tick='tick', beep='beep', alarm='alarm', creak='door',
           rumble='thunder', bubbles='splash', typewriter='typing', typing='typing', camera='camera', flash='camera', stamp='stamp', paper='paper',
           phone='phone', glitch='glitch', heartbeat='heartbeat', footstep='footstep', door='door', metal='metal', glass='glass', thunder='thunder',
           rain='rain', fire='fire', bell='bell', click='click', riser='riser', explosion='explosion', blip='blip', notification='notification')
REC_LEVEL = {'whoosh': -20, 'swish': -20, 'tick': -18, 'click': -18, 'typing': -18, 'beep': -18, 'rain': -22, 'fire': -22}
# a soft whoosh into every dip transition, then every scheduled sound
events = [{'t': s['t0'] - .45, 'type': 'whoosh', 'gain': 0, 'pan': 0} for s in ev.get('shots', [])[1:] if not s.get('cut')] + ev.get('sfx', [])
if SL.mode == 'off': events = []; print('sound effects: off for this project (Music & effects > Auto sound design)')
placed = []
for e in events:
    x = SL.recorded(e['type'], e.get('dur') or 0, REC); rec = x is not None
    if x is not None: x = (x / (np.max(np.abs(x)) + 1e-9)).astype(np.float32); lvl = REC_LEVEL.get(e['type'], LEVEL.get(e['type'], -14))
    elif SL.mode == 'library': continue                                  # only the user's own sounds
    else: x = sfx(e['type'], e.get('dur')); lvl = LEVEL.get(e['type'], -20)
    if x is None: print('unknown sfx type', e['type']); continue
    x = x * db(lvl + (e.get('gain') or 0)); i0 = max(0, int(e['t'] * SR)); i1 = min(N, i0 + len(x))
    if i1 <= i0: continue
    placed.append(f"{e['t']:7.2f}s  {e['type']:12s} {'recorded' if rec else 'synth'}")
    pan = float(e.get('pan') or 0); L[i0:i1] += x[:i1 - i0] * (1 - max(0, pan)); R[i0:i1] += x[:i1 - i0] * (1 + min(0, pan))
place_report(P, placed); SL.write_credits()
print(f'{sum(1 for p in placed if p.endswith("recorded"))} of {len(placed)} effects are recordings')
peak = max(float(np.max(np.abs(L))), float(np.max(np.abs(R))), 1e-6); g = min(1, .5 / peak)
st = (np.stack([L, R], 1) * g * 32767).astype('<i2')
with wave.open(os.path.join(A, 'sfx_bed.wav'), 'wb') as wv: wv.setnchannels(2); wv.setsampwidth(2); wv.setframerate(SR); wv.writeframes(st.tobytes())
print('sfx_bed.wav', f'{END:.1f} s', len(events), 'sounds', len(beds), 'beds')
# sound_music.wav (the beds) + sound_sfx.wav (the effects: everything added after the beds), with the same gain g
write_stems(A, SR, np.stack([BL, BR], 1), np.stack([L - BL, R - BR], 1), lambda x: x * g)
