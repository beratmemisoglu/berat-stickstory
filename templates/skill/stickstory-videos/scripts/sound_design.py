#!/usr/bin/env python3
"""Stick stories sound design: sound effects on picture events (recorded CC0 / public-domain clips where the library has
them, synthesized ones where it doesn't) and a music bed only when beds.json says "music": true (the app writes a quiet story
bed with it for every new Stick stories project; the user's own track replaces it: Project settings > Music, mixed by mix.py
about 18 LU under the voice); ambience beds only with "ambience": true (room tone capped at -45 dB).
(Started as a copy of the 3D cartoon shorts sound designer. Stick stories changes, 2026-10-23, from the study
experiments/stickstory-style/analysis/story/NOTES.md section 3: the UI blip (the references' most frequent effect: 40-100 a
video, one per HUD element, tag and counter step), the sub boom and the riser (reveals and act changes) and footsteps have
synthesized fallbacks; any other type that names a library category (siren, sub_drop, reverse_swell, tension_drone,
door_creak, typewriter, crickets, rain_window ...) plays a recording of it instead of being dropped; about 25 effects a
minute are kept (the references: 15-25, 35+ in action), at least 0.4 s apart.)

  python sound_design.py <project> [sfx library args]

Inputs:  audio/events.json  (the app's event pass, engine style 'stickstory': shots with transitions, and every sound the
                             scenes scheduled with S.sfx(type, t, { gain, pan }): {"t", "type", "pan" 0..1, "gain" dB, "dur"})
         audio/beds.json    (music per section - see below)
         audio/timeline.json
Output:  audio/sfx_bed.wav  (stereo 48 kHz) - mix.py ducks it under the voice and normalises to about -14 LUFS.

beds.json:
  {"beds": [ {"from": 0, "to": 38, "type": "music", "mood": "mystery", "bpm": 80, "gain": -34, "key": "D"} ], "music": true}
  Music beds at about -34 dB: the bare music ~19 dB under the voice, the whole bed (music + this style's audible effects)
  ~15 dB under it (measured on video 02: -32 -> 14.2 dB, -34 -> 15.1, -38 -> 16.0; the references 10-13 LU with effects,
  14-19 LU for the bare music). A music bed louder than 14 dB under the voice (clean.wav while speaking) is lowered to that.
Bed types: music (mood: playful | quirky | upbeat | warm | tense | mystery | dark | casino), pad (soft sustained chord),
           room (quiet room tone), crowd (murmur), city (traffic hum), wind.
SFX types (the engine's): whoosh pop impact thud click ding swish splash blip boom riser step; extras: boing bonk zip squeak blink
           and everything the low poly shorts designer knows: beep coin cash chime win slot roulette cards chips typing phone
           camera stamp bell glitch crowd cheer gasp heartbeat alarm explosion honk glass tick footstep door ...; any category
           of the sound library by its name (siren, sub_drop, reverse_swell, door_creak, paper_rustle ...), "tag:<words>" or an id.

Design rules: the voice leads, effects land on picture EVENTS (a pop-in, a fall, a splash, a door), not on every cut;
whips and zooms get a soft whoosh (the engine adds those); nothing louder than the voice; the master is compressed (mix.py).
"""
import json, os, sys, wave
import numpy as np
from scipy.signal import lfilter, butter

P = os.path.abspath(sys.argv[1]); A = os.path.join(P, 'audio')
ev = json.load(open(os.path.join(A, 'events.json'), encoding='utf-8'))
cfg = json.load(open(os.path.join(A, 'beds.json'), encoding='utf-8'))
tlf = os.path.join(A, 'timeline.json')
tl = json.load(open(tlf, encoding='utf-8')) if os.path.exists(tlf) else []
STYLE = 'stickstory'
if ev.get('style') not in (None, STYLE): print(f"note: audio/events.json was made by the '{ev.get('style')}' engine, not '{STYLE}' (run Sound again after Update engine)")
SR = 48000
DUR = max([b['to'] for b in cfg.get('beds', [])] + ([tl[-1]['e'] + 1.5] if tl else [2])) + .5
N = int(SR * DUR)
rng = np.random.default_rng(23)
db = lambda v: 10 ** (v / 20)

def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], btype='band'); return lfilter(b, a, x)
def lp(x, fc, order=2): b, a = butter(order, fc / (SR / 2)); return lfilter(b, a, x)
def hp(x, fc, order=2): b, a = butter(order, fc / (SR / 2), btype='high'); return lfilter(b, a, x)
def noise(n): return rng.standard_normal(n)
def env(n, a, r, shape=2.): t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4) * shape)
def tt(d): return np.arange(int(d * SR)) / SR
def tone(f, d, dec=6., wave='sine'):
    t = tt(d); ph = 2 * np.pi * f * t
    x = np.sin(ph) if wave == 'sine' else np.sign(np.sin(ph)) * .5 if wave == 'square' else 2 * (t * f % 1) - 1
    return x * np.minimum(1, t / .004) * np.exp(-t * dec)
def glide(f0, f1, d, dec=6.):
    t = tt(d); f = f0 * (f1 / f0) ** (t / max(d, 1e-4)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / .003) * np.exp(-t * dec)
def cat(*xs): return np.concatenate(xs)
def at(dst, x, s): s0 = int(s * SR); m = min(len(x), len(dst) - s0); dst[s0:s0 + m] += x[:m]; return dst

# ---------- SFX (synthesized: used where the library has no recording of the type) ----------
def s_whoosh(d=0):
    n = int(.45 * SR); t = np.linspace(0, 1, n); x = noise(n); out = np.zeros(n)
    for i in range(8):
        a, b = i * n // 8, (i + 1) * n // 8; f = 300 + 2400 * np.sin(np.pi * (a + b) / 2 / n); out[a:b] = bp(x, f * .6, f * 1.6)[a:b]
    return out * np.sin(np.pi * t) ** 2.4
def s_swish(d=0): n = int(.25 * SR); t = np.linspace(0, 1, n); return bp(noise(n), 1500, 6000) * np.sin(np.pi * t) ** 1.5
def s_impact(d=0): t = tt(.6); return np.sin(2 * np.pi * 52 * t * (1 - .3 * t)) * env(len(t), .001, .12) + .6 * lp(noise(len(t)), 1800) * env(len(t), .0005, .05)
def s_thud(d=0): t = tt(.35); return np.sin(2 * np.pi * 70 * t) * env(len(t), .002, .06) + .3 * lp(noise(len(t)), 400) * env(len(t), .001, .03)
def s_pop(d=0): t = tt(.09); f = 700 * np.exp(-t * 18) + 220; return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .001, .025)
def s_click(d=0): t = tt(.04); return bp(noise(len(t)), 2000, 8000) * env(len(t), .0002, .004)
def s_ding(d=0): t = tt(1.1); return sum(a * np.sin(2 * np.pi * 1760 * m * t) * np.exp(-t * k) for m, a, k in [(1, 1, 3.5), (2.0, .3, 6), (3.01, .18, 9)]) * np.minimum(1, t / .002)
def s_boing(d=0):                                      # a spring: a wobbling pitch that sags
    t = tt(.55); f = 180 + 140 * np.exp(-t * 5) * (1 + .5 * np.sin(2 * np.pi * 16 * t)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .002, .18)
def s_bonk(d=0): t = tt(.25); return (np.sin(2 * np.pi * 420 * t) + .5 * np.sin(2 * np.pi * 1130 * t)) * env(len(t), .0008, .05) + .3 * bp(noise(len(t)), 800, 3000) * env(len(t), .0005, .01)
def s_zip(d=0): return glide(400, 2600, .18, 3) * .7
def s_squeak(d=0): return glide(1800, 2600, .16, 8) * .6 + glide(2600, 2100, .16, 10) * .3
def s_blink(d=0): return tone(2400, .05, 40) * .5
def s_beep(d=0): return tone(1320, .14, 4, 'square') * .6
def s_coin(d=0): t = tt(.7); return sum(a * np.sin(2 * np.pi * f * t) for f, a in [(2150, 1), (3310, .6), (5590, .35)]) * env(len(t), .0005, .09)
def s_cash(d=0):
    t = tt(.9); bell_ = (np.sin(2 * np.pi * 2600 * t) + .5 * np.sin(2 * np.pi * 3900 * t)) * env(len(t), .001, .25)
    return at(bell_ * .7, s_thud() * .8, 0) + at(np.zeros(len(t)), s_click(), .12)
def s_chime(d=0): out = np.zeros(int(.9 * SR)); [at(out, tone(f, .6, 5), i * .07) for i, f in enumerate([1046, 1318, 1568, 2093])]; return out
def s_win(d=0):
    out = np.zeros(int(1.6 * SR))
    for i, f in enumerate([523, 659, 784, 1046, 1318, 1568, 2093]): at(out, tone(f, .3, 8, 'square') * .5, i * .06)
    for i in range(14): at(out, s_coin() * .35, .4 + i * .06 + rng.uniform(0, .03))
    return out
def s_slot(d=0):
    d = max(d, 1.2); out = np.zeros(int((d + .2) * SR)); c, step = 0., .04
    while c < d: at(out, s_click() * .8, c); c += step; step *= 1.045
    return out
def s_roulette(d=0):
    d = max(d, 1.5); out = np.zeros(int((d + .2) * SR)); c, step = 0., .05
    while c < d: at(out, bp(noise(int(.02 * SR)), 2500, 7000) * env(int(.02 * SR), .0003, .004) * rng.uniform(.4, 1), c); c += step; step *= 1.03
    return out
def s_cards(d=0): out = np.zeros(int(.5 * SR)); [at(out, bp(noise(int(.012 * SR)), 1500, 6000), i * .012) for i in range(30)]; return out * .6
def s_chips(d=0): out = np.zeros(int(.4 * SR)); [at(out, tone(rng.uniform(2500, 3400), .05, 60) + bp(noise(int(.05 * SR)), 3000, 8000) * .2 * env(int(.05 * SR), .0005, .01), i * .05 + rng.uniform(0, .02)) for i in range(5)]; return out
def s_typing(d=.6):
    d = max(d, .2); out = np.zeros(int((d + .1) * SR))
    for c in np.arange(0, d, 1 / 11): at(out, bp(noise(int(.03 * SR)), 1500, 7000) * env(int(.03 * SR), .0003, .005) * (.6 + .4 * rng.random()), c + rng.uniform(0, .02))
    return out
def s_phone(d=0): t = tt(1.2); g = (np.sin(2 * np.pi * 21 * t) > 0) * (t % .6 < .4); return (np.sin(2 * np.pi * 1300 * t) + np.sin(2 * np.pi * 1700 * t)) * g * .4
def s_camera(d=0): return cat(s_click(), np.zeros(int(.045 * SR)), s_click() * .7)
def s_stamp(d=0): t = tt(.3); return np.sin(2 * np.pi * 95 * t * (1 - .4 * t)) * env(len(t), .001, .05) + .6 * bp(noise(len(t)), 600, 4000) * env(len(t), .0005, .02)
def s_bell(d=0): t = tt(1.5); return sum(a * np.sin(2 * np.pi * 880 * m * t) * np.exp(-t * k) for m, a, k in [(1, 1, 2), (2.76, .35, 4), (5.4, .15, 7)])
def s_glitch(d=0):
    n = int(.3 * SR); x = np.repeat(rng.standard_normal(n // 300 + 1), 300)[:n]; return bp(x + noise(n) * .3, 300, 6000) * (rng.random(n) < .7)
def s_crowd(d=1.5): n = int(max(d, .8) * SR); return bp(noise(n), 300, 2200) * (1 + .4 * np.sin(np.arange(n) / SR * 7)) * np.minimum(1, np.arange(n) / (.2 * SR))
def s_cheer(d=1.5): n = int(max(d, 1.) * SR); t = np.linspace(0, 1, n); return bp(noise(n), 500, 4000) * np.sin(np.pi * t) ** .6 * (1 + .5 * np.sin(np.arange(n) / SR * 23))
def s_gasp(d=0): n = int(.5 * SR); t = np.linspace(0, 1, n); return bp(noise(n), 700, 3500) * np.sin(np.pi * t) ** 2 * (1 - t)
def s_heartbeat(d=1.6):
    d = max(d, .8); out = np.zeros(int((d + .3) * SR))
    for c in np.arange(0, d, .8): at(out, tone(55, .18, 18), c); at(out, tone(50, .16, 20) * .7, c + .22)
    return out
def s_alarm(d=1.2): t = tt(max(d, .6)); f = 900 + 400 * (np.sin(2 * np.pi * 2 * t) > 0); return np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * .35
def s_explosion(d=0): t = tt(1.6); return lp(noise(len(t)), 900) * env(len(t), .003, .5) * 1.5 + np.sin(2 * np.pi * 40 * t) * env(len(t), .002, .3)
def s_honk(d=0): t = tt(.5); return (np.sign(np.sin(2 * np.pi * 410 * t)) + np.sign(np.sin(2 * np.pi * 520 * t))) * .3 * np.minimum(1, t / .01) * np.minimum(1, (.5 - t) / .03)
def s_glass(d=0): t = tt(.8); return sum(np.sin(2 * np.pi * rng.uniform(2500, 6500) * t) * np.exp(-t * rng.uniform(6, 14)) for _ in range(8)) * .3 + bp(noise(len(t)), 3000, 9000) * env(len(t), .0005, .03)
def s_splash(d=0): n = int(.8 * SR); return bp(noise(n), 300, 5000) * env(n, .005, .2)
def s_tick(d=.8):
    d = max(d, .2); out = np.zeros(int((d + .1) * SR)); c, step = 0., .035
    while c < d: at(out, s_click() * .7, c); c += step; step *= 1.09
    return out
def s_footstep(d=0): t = tt(.12); return lp(noise(len(t)), 1200) * env(len(t), .001, .02) + .4 * np.sin(2 * np.pi * 90 * t) * env(len(t), .001, .02)
# the Stick stories study's measured kinds (story NOTES 3.4): UI blip = narrow 2.3-3.3 kHz, 30-60 ms; sub boom = a 25-100 Hz
# burst with a 0.2-1.2 s tail (reveals, act changes); riser = broadband 1-8 kHz noise swelling 1.2-1.8 s into a reveal
def s_blip(d=0): t = tt(.05); return np.sin(2 * np.pi * 2800 * t) * np.minimum(1, t / .002) * np.exp(-t * 55) * .8
def s_boom(d=0): t = tt(1.2); return np.sin(2 * np.pi * np.cumsum(38 + 50 * np.exp(-t * 9)) / SR) * env(len(t), .004, .45) + .25 * lp(noise(len(t)), 220) * env(len(t), .002, .15)
def s_riser(d=0):
    n = int(max(d, 1.4) * SR); t = np.linspace(0, 1, n); x = bp(noise(n), 1000, 8000) * t ** 2.2
    return x * np.minimum(1, (1 - t) / .02 + .0)
SFX = dict(whoosh=s_whoosh, swish=s_swish, impact=s_impact, thud=s_thud, pop=s_pop, click=s_click, ding=s_ding, boing=s_boing, bonk=s_bonk, zip=s_zip,
           squeak=s_squeak, blink=s_blink, beep=s_beep, coin=s_coin, cash=s_cash, chime=s_chime, win=s_win, slot=s_slot, roulette=s_roulette, cards=s_cards,
           chips=s_chips, typing=s_typing, phone=s_phone, camera=s_camera, stamp=s_stamp, bell=s_bell, glitch=s_glitch, crowd=s_crowd, cheer=s_cheer,
           gasp=s_gasp, heartbeat=s_heartbeat, alarm=s_alarm, explosion=s_explosion, honk=s_honk, glass=s_glass, splash=s_splash, tick=s_tick,
           footstep=s_footstep, step=s_footstep, grow=s_swish, slide=s_swish, paper=s_click, blip=s_blip, boom=s_boom, riser=s_riser)
LEVEL = dict(whoosh=-27, swish=-28, impact=-21, thud=-24, pop=-27, click=-29, ding=-26, boing=-26, bonk=-25, zip=-28, squeak=-28, blink=-31, beep=-29,
             coin=-25, cash=-23, chime=-25, win=-22, slot=-27, roulette=-27, cards=-27, chips=-26, typing=-29, phone=-27, camera=-26, stamp=-23, bell=-25,
             glitch=-27, crowd=-30, cheer=-26, gasp=-27, heartbeat=-22, alarm=-27, explosion=-19, honk=-25, glass=-24, splash=-24, tick=-30, footstep=-30,
             step=-30, blip=-31, boom=-20, riser=-28)
# effects must be HEARD (as in low poly shorts): peaks ~8-14 dB under the voice, hits loudest, ticks and steps lower
LEVEL = {k: v + 14 for k, v in LEVEL.items()}
if cfg.get('sfx'): print('ignored the old per-effect levels in beds.json (the Effects level slider sets them):', cfg['sfx'])
# beds.json is rewritten clean on every run: no music bed unless "music": true, no stale overrides, room tone at -45 dB at most
_keep = lambda b: b.get('type') == 'room' or (b.get('type') == 'music' and cfg.get('music') is True) or (b.get('type') not in ('music', 'room') and cfg.get('ambience') is True)
_clean = [{**b, 'gain': min(b.get('gain', -45), -45)} if b.get('type') == 'room' else b for b in cfg.get('beds', []) if _keep(b)]
_dropped = [b.get('type') for b in cfg.get('beds', []) if not _keep(b)]
cfg = {**({'music': True} if cfg.get('music') is True else {}), **({'ambience': True} if cfg.get('ambience') is True else {}), 'beds': _clean}
json.dump(cfg, open(os.path.join(A, 'beds.json'), 'w', encoding='utf-8'), indent=1)
if _dropped: print('beds.json cleaned: removed', ', '.join(_dropped), "(music is the user's own track: Music & effects)")

# ---------- real recordings: the CC0 / public-domain library (templates/lowpoly/library/sfx, see its index.json) ----------
# an event type plays a recorded clip of its category (a random pick per event, seeded by the project for determinism,
# with a little pitch/gain jitter); types with no recording stay synthesized (boing, bonk, zip, squeak, blink).
# "tag:<words>" or a library id ("sfx.coin.02") as the type asks for one specific sound.
REC = dict(impact='impact', thud='thud', pop='pop', click='click', ding='chime', beep='beep', coin='coin', cash='cash', chime='chime', win='win', cards='cards',
           chips='chips', typing='typing', phone='phone', camera='camera', stamp='stamp', bell='bell', glitch='glitch', crowd='applause', cheer='cheer',
           applause='applause', heartbeat='heartbeat', alarm='alarm', explosion='explosion', glass='glass', tick='tick', paper='paper', footstep='footstep',
           door='door', thunder='thunder', rain='rain', fire='fire', notification='notification', error='error', lose='lose', scratch='scratch',
           shuffle='shuffle', dice='dice', metal='metal', swish='swish', whoosh='whoosh', whoosh_fast='whoosh', swipe='whoosh',
           transition='whoosh', grow='swish', slide='swish', gasp='gasp', splash='splash', honk='honk', slot='slot', roulette='roulette', riser='riser',
           dog='dog_bark', boom='boom', fall='body_fall', breath='breath', keys='keys', car='car_engine', blip='blip', step='footstep')
for k in ('door', 'thunder', 'rain', 'fire', 'notification', 'error', 'lose', 'scratch', 'shuffle', 'dice', 'metal', 'applause', 'riser', 'dog', 'boom', 'fall', 'breath', 'keys', 'car'):
    LEVEL.setdefault(k, {'thunder': -12, 'rain': -24, 'fire': -24, 'applause': -16, 'breath': -20}.get(k, -16))
# the shared library reader (pixel-explainer-video/scripts/sfxlib.py): the built-in recordings merged with the user's own
# (Settings > Media > Sound effects library; theirs win per category), the project's effects choice (auto / library / off)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'pixel-explainer-video', 'scripts'))
from sfxlib import Library, place_report, write_stems
SL = Library(P, sys.argv[2:], SR); LIB = SL.dirs
def recorded(typ, d): return SL.recorded(typ, d, REC)

# ---------- music (only with "music": true): a light bed that sits low under the voice ----------
NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}
def hz(s): return 261.63 * 2 ** (s / 12)
def keys(f, d): t = tt(d); return (np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t) + .1 * np.sin(6 * np.pi * f * t)) * np.minimum(1, t / .01) * np.exp(-t * 2.5)
def sub(f, d): t = tt(d); return (np.sin(2 * np.pi * f * t) + .2 * np.sin(4 * np.pi * f * t)) * np.minimum(1, t / .02) * np.exp(-t * 1.5)
def kick(): t = tt(.25); return np.sin(2 * np.pi * np.cumsum(55 + 90 * np.exp(-t * 30)) / SR) * env(len(t), .001, .08)
def hat(): n = int(.04 * SR); return hp(noise(n), 7000) * env(n, .0005, .008)
MOODS = {   # chord roots from the key + quality, bpm, drums
  'playful': ([0, 5, 7, 5], ['maj', 'maj', 'maj', 'maj'], 112, 'light'),
  'quirky':  ([0, 9, 5, 7], ['maj', 'min', 'maj', 'maj'], 104, 'light'),
  'upbeat':  ([0, 7, 9, 5], ['maj', 'maj', 'min', 'maj'], 116, 'full'),
  'warm':    ([0, 5, 9, 7], ['maj', 'maj', 'min', 'maj'], 84, 'light'),
  'casino':  ([0, 5, 2, 7], ['min7', 'min7', 'min7', 'maj7'], 92, 'swing'),
  'tense':   ([0, 1, 0, 8], ['min', 'maj', 'min', 'maj'], 88, 'pulse'),
  'mystery': ([0, 3, 8, 7], ['min', 'maj', 'maj', 'min'], 80, 'pulse'),
  'dark':    ([0, 8, 5, 7], ['min', 'maj', 'min', 'min'], 76, 'pulse'),
}
IV = {'maj': [0, 4, 7, 12], 'min': [0, 3, 7, 12], 'min7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11]}
def music(n, mood='playful', bpm=None, key='D', **_):
    roots, quals, bpm0, drums = MOODS.get(mood, MOODS['playful']); bpm = bpm or bpm0
    beat = 60 / bpm; bar = beat * 4; out = np.zeros(n); k0 = NOTE.get(key, 2) - 12; t = 0.; b = 0
    while t < n / SR:
        r, q = roots[b % 4], quals[b % 4]; ch = [k0 + r + i for i in IV[q]]
        for i, pi in enumerate([0, 2, 1, 3, 2, 1, 3, 2]):
            s = t + i * beat / 2 + (beat * .08 if drums == 'swing' and i % 2 else 0)
            if s * SR < n: at(out, keys(hz(ch[pi]), beat * 1.4) * (.45 if i % 2 else .65), s)
        for i in range(2):
            if (t + i * beat * 2) * SR < n: at(out, sub(hz(k0 + r - 24), beat * 2) * 1.1, t + i * beat * 2)
        if drums in ('full', 'light', 'swing'):
            for i in range(4):
                if drums != 'light' or i % 2 == 0:
                    if (t + i * beat) * SR < n: at(out, kick() * (.7 if drums == 'full' else .45), t + i * beat)
            for i in range(8):
                if (t + i * beat / 2) * SR < n: at(out, hat() * (.25 if i % 2 else .15), t + i * beat / 2)
        elif drums == 'pulse':
            for i in range(4):
                if (t + i * beat) * SR < n: at(out, sub(hz(k0 + r - 24), beat * .5) * .5, t + i * beat)
        t += bar; b += 1
    return hp(out, 35)
def pad(n, key='D', **_): t = np.arange(n) / SR; k = NOTE.get(key, 2) - 12; return lp(sum(np.sin(2 * np.pi * hz(k + s) * t + s) for s in [0, 4, 7, 11]) * (1 + .2 * np.sin(2 * np.pi * .08 * t)), 1500)
def room(n, **_): return lp(noise(n), 900) * .5 + lp(noise(n), 250)
def crowd(n, **_): return bp(noise(n), 300, 2000) * (1 + .3 * np.sin(np.arange(n) / SR * 3))
def city(n, **_): return lp(noise(n), 500) + .2 * bp(noise(n), 500, 1500)
def wind(n, **_): t = np.arange(n) / SR; return bp(noise(n), 200, 1200) * (.6 + .4 * np.sin(2 * np.pi * .13 * t))
BEDS = dict(music=music, pad=pad, room=room, crowd=crowd, city=city, wind=wind)

# the bare music never closer than 14 dB to the voice while it speaks (the references' music bed: 14-19 LU under the voice).
# Lessons 02-handshake: the crew's -32 beds + this style's effects sat 14 dB under the voice and the mix's check (16 dB)
# flagged them; a far louder bed (a swell at -24) would bury the narration. Measured on clean.wav where the voice speaks.
VOICE, MUSIC_UNDER = None, 14
try:
    _w = wave.open(os.path.join(A, 'clean.wav')); _vsr, _vn, _vch = _w.getframerate(), _w.getnframes(), _w.getnchannels()
    _vx = np.frombuffer(_w.readframes(_vn), np.int16).astype(np.float32).reshape(-1, _vch)[:, 0] / 32768; _w.close()
    _vsp = np.zeros(len(_vx), bool)
    for _p in tl: _vsp[int(_p['s'] * _vsr):int(_p['e'] * _vsr)] = True
    if _vsp.any(): VOICE = float(20 * np.log10(np.sqrt(np.mean(_vx[_vsp] ** 2)) + 1e-9))
    del _vx, _vsp
except Exception: VOICE = None   # no voice yet (or a copy without it): the beds play as written
bed = np.zeros((N, 2))
for b in cfg.get('beds', []):
    s0, s1 = int(b['from'] * SR), min(N, int(b['to'] * SR))
    if s1 <= s0: continue
    if b['type'] == 'room': b = {**b, 'gain': min(b.get('gain', -45), -45)}
    if b['type'] == 'music' and VOICE is not None and b.get('gain', -30) - 3 > VOICE - MUSIC_UNDER:
        g = round(VOICE - MUSIC_UNDER + 3, 1)
        print(f"music bed {b['from']}-{b['to']} lowered from {b.get('gain', -30)} to {g} dB: it would sit less than {MUSIC_UNDER} dB under the voice")
        b = {**b, 'gain': g}
    kw = {k: v for k, v in b.items() if k not in ('from', 'to', 'type', 'gain')}
    x = BEDS.get(b['type'], room)(s1 - s0, **kw)
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * db(b.get('gain', -30) - 3)
    fade = np.minimum(1, np.minimum(np.arange(len(x)) / (SR * (.6 if b['from'] > 0 else .05)), (len(x) - np.arange(len(x))) / (SR * .8)))
    x *= fade; width = .2 if b['type'] == 'music' else .4
    bed[s0:s1, 0] += x * (1 - width / 2); bed[s0:s1, 1] += np.roll(x, int(SR * .006)) * (1 - width / 2)
    print(f"bed {b['from']:6.1f}-{b['to']:6.1f}  {b['type']:8s} {b.get('mood', '')} {b.get('gain', -30)} dB")

# density (the cartoon shorts' first real build, 2026-10-17: builders put an effect on nearly every action, ~80 a minute;
# the Stick stories references run 15-25 a minute, 35+ in action): keep the most important ones, at least 0.4 s apart,
# about 25 a minute. Sounds a scene asks for by name (tag: / user. / sfx.) come first.
_PRI = {'impact': 9, 'explosion': 9, 'splash': 8, 'thud': 8, 'boom': 8, 'glass': 7, 'punch': 7, 'sting': 7, 'riser': 6, 'hit': 6,
        'pop': 5, 'appear': 5, 'ding': 5, 'chime': 5, 'cash': 5, 'coin': 5, 'alarm': 5, 'phone': 5, 'door': 5, 'whoosh': 4, 'swish': 3, 'beep': 3, 'blip': 3}
_all = ev.get('sfx', [])
_cap = int(round(N / SR / 60 * 25)) + 3
_kept = []
for _e in sorted(_all, key=lambda e: (-(10 if str(e.get('type', '')).startswith(('tag:', 'user.', 'sfx.')) else _PRI.get(e.get('type'), 2)), -float(e.get('gain', 0) or 0), e['t'])):
    if len(_kept) >= _cap: break
    if all(abs(_e['t'] - k['t']) >= .4 for k in _kept): _kept.append(_e)
if len(_kept) < len(_all): print(f'sound effects: kept {len(_kept)} of {len(_all)} (about 25 a minute, the most important ones)')
ev['sfx'] = sorted(_kept, key=lambda e: e['t'])

sfx = np.zeros((N, 2)); counts = {}; placed = []
if SL.mode == 'off': print('sound effects: off for this project (Music & effects > Auto sound design)')
for e in ev.get('sfx', []) if SL.mode != 'off' else []:
    typ = e['type']; fn = SFX.get(typ); s0 = int(e['t'] * SR)
    if s0 < 0 or s0 >= N: continue
    # any other name is looked up as a library category (siren, sub_drop, reverse_swell ...) before it is given up on
    x = recorded(typ, e.get('dur', 0) or 0); rec = x is not None
    if x is None:
        if SL.mode == 'library': continue                       # only the user's own sounds
        if not fn: print(f'no sound for "{typ}" at {e["t"]:.2f}s'); continue
        x = fn(e.get('dur', 0) or 0)
    base = typ.split('.')[1] if typ.startswith('sfx.') else typ
    x = x / (np.abs(x).max() + 1e-9) * db(LEVEL.get(base, -13) + e.get('gain', 0))
    placed.append(f"{e['t']:7.2f}s  {typ:12s} {'recorded' if rec else 'synth'}")
    m = min(len(x), N - s0); pan = min(1, max(0, e.get('pan', .5)))
    sfx[s0:s0 + m, 0] += x[:m] * np.sqrt(1 - pan) * 1.41; sfx[s0:s0 + m, 1] += x[:m] * np.sqrt(pan) * 1.41
    counts[e['type']] = counts.get(e['type'], 0) + 1
print('sfx:', ', '.join(f'{k} x{v}' for k, v in sorted(counts.items())))

mix = bed + sfx
L = db(-6); mix = np.tanh(mix / L) * L
print(f'peak {20 * np.log10(np.abs(mix).max() + 1e-9):.1f} dBFS')
w = wave.open(os.path.join(A, 'sfx_bed.wav'), 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
print('wrote audio/sfx_bed.wav')
write_stems(A, SR, bed, sfx, lambda x: np.tanh(x / L) * L)              # sound_music.wav + sound_sfx.wav, the same limiter (Export: separate tracks)
place_report(P, placed)
mine = sum(1 for e in SL.used.values() if e['user'])
print(f'{sum(1 for p in placed if p.endswith("recorded"))} of {len(placed)} effects are real recordings' + (f' ({mine} from your library)' if mine else '') + ('' if LIB else ' (sound library not found: all synthesized)'))
# credits of the recordings used: their own block in DESCRIPTION.txt (CC0 / public domain need none, but it is kind)
SL.write_credits()
