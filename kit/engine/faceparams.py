# Procedural faces: the parameter model, the expression presets and the visemes (pure Python: used in Blender by
# char.py and outside it by tools/facegen.py). A face is a dict of numbers in face space (u right, v up, 0..1 across
# the head's front circle). Every frame of every character gets one dict; facegen draws it.
#
# v3 (night 2): presets retuned to the owner's reference (ref/ref.mp4, full-size crops in renders/study/): resting eyes
# are LIDDED grey half-ovals (eo ~0.6) under a long straight lid line - the "unimpressed" look of every character at
# rest; surprise / shock / fear = grey RINGS with small pupils (em 2) and brows shot up over the hairline; happiness =
# closed n-arcs (em 1) with a smile curve, a clenched white grin grid (mt 2) or a wide open grin with dividers (mz);
# worry = rings + a small wavy mouth. Mouths change on ones/twos while talking: closed line, clenched teeth bar, small o
# with tongue, mid open, wide open with the top teeth band + tongue.

BASE = {
    # brows: height offset, tilt (deg, + = inner end up: sad / worried; - = angry), arch (+ = curved up), thickness
    'bh_L': 0.0, 'bh_R': 0.0, 'bt_L': 0.0, 'bt_R': 0.0, 'ba_L': 0.2, 'ba_R': 0.2, 'bw': 1.0,
    # eyes: open (upper lid 1 = no lid .. 0 = shut), low (lower lid 0..1), lid tilt (+ = inner end down), size, gaze, mode
    'eo_L': 0.6, 'eo_R': 0.6, 'el_L': 0.0, 'el_R': 0.0, 'lt_L': 0.0, 'lt_R': 0.0, 'es': 1.0, 'gx': 0.0, 'gy': 0.0,
    'em': 0.0,    # eye mode: 0 grey oval, 1 happy n-arcs, 2 rings + pupil, 3 stars, 4 hearts, 5 spirals, 6 X
    'pupil': 1.0, 'pop': 1.0,   # ring pupil size; pop = overall eye scale pulse (the overshoot on a swap)
    # mouth: width, open, smile curve (+ up), teeth (0 none, 1 top band, 2 clenched grid), tongue, round (O), skew,
    # wave, y, mz (tooth dividers on the top band = a big grin)
    'mw': 0.75, 'mo': 0.0, 'ms': 0.0, 'mt': 0.0, 'mg': 0.0, 'mr': 0.0, 'mk': 0.0, 'mv': 0.0, 'my': 0.0, 'mz': 0.0,
    # extras (0..1 strength): sweat, blush, tears, stress, sparkle, vein, gloom
    'x_sweat': 0.0, 'x_blush': 0.0, 'x_tears': 0.0, 'x_stress': 0.0, 'x_sparkle': 0.0, 'x_vein': 0.0, 'x_gloom': 0.0,
}

P = {}
def _p(name, **kw):
    d = dict(BASE); d.update(kw); P[name] = d

# --- rest / attitude (lidded)
_p('neutral', mw=0.62, ms=0.05)
_p('calm', eo_L=0.5, eo_R=0.5, ms=0.25, mw=0.62)
_p('bored', eo_L=0.42, eo_R=0.42, lt_L=0.15, lt_R=0.15, gy=-0.3, mw=0.55, mk=-0.25, bh_L=-0.02, bh_R=-0.02, ba_L=0.0, ba_R=0.0)
_p('unimpressed', eo_L=0.5, eo_R=0.5, mw=0.7, ms=-0.1, mk=0.1, ba_L=0.05, ba_R=0.05)
_p('smug', eo_L=0.45, eo_R=0.4, ms=0.45, mk=0.55, mw=0.68, bh_L=0.035, bt_L=-4, bt_R=4, ba_R=0.3, gx=0.2)
_p('sly', eo_L=1, eo_R=1, em=2, es=0.95, pupil=0.85, gx=0.78, gy=-0.25, ms=0.3, mk=0.65, mw=0.45, bh_L=0.03, bt_R=-6)
_p('sideglance', eo_L=0.55, eo_R=0.55, em=2, es=0.92, gx=0.8, mw=0.45, mk=0.3)
_p('scheming', eo_L=0.38, eo_R=0.38, lt_L=0.35, lt_R=0.35, ms=0.85, mo=0.0, mt=2, mw=1.15, mk=0.2, bt_L=-16, bt_R=-16, bh_L=-0.01, bh_R=-0.01)
_p('skeptical', eo_L=0.62, eo_R=0.45, bh_L=0.05, bt_L=4, bh_R=-0.02, bt_R=-8, mk=0.5, mw=0.55)
_p('thinking', eo_L=0.7, eo_R=0.7, em=2, es=0.9, gx=0.5, gy=0.55, mw=0.45, mk=-0.5, mr=0.2, bh_L=0.04, bt_L=6, bh_R=-0.01, bt_R=-4)
_p('confused', em=2, es=0.95, bh_L=0.05, bt_L=10, bh_R=-0.01, bt_R=-10, mv=1.0, mw=0.55, gx=-0.25)
_p('determined', eo_L=0.55, eo_R=0.55, lt_L=0.3, lt_R=0.3, bt_L=-14, bt_R=-14, bh_L=-0.015, bh_R=-0.015, mw=0.7, mk=0.2, ms=0.05)
_p('annoyed', eo_L=0.42, eo_R=0.42, lt_L=0.25, lt_R=0.25, bt_L=-12, bt_R=-12, ms=-0.35, mw=0.62, mk=-0.3)
_p('angry', eo_L=0.6, eo_R=0.6, lt_L=0.5, lt_R=0.5, bt_L=-24, bt_R=-24, bh_L=-0.025, bh_R=-0.025, ms=-0.5, mw=0.75)
_p('furious', eo_L=0.55, eo_R=0.55, lt_L=0.6, lt_R=0.6, bt_L=-30, bt_R=-30, bh_L=-0.03, bh_R=-0.03, ms=-0.6, mo=0.6, mt=2, mw=1.0, x_vein=1)
_p('pout', eo_L=0.55, eo_R=0.55, bt_L=-10, bt_R=-10, gy=0.4, mr=0.6, mo=0.1, mw=0.4, ms=-0.4)
_p('whistle', eo_L=0.7, eo_R=0.7, em=2, es=0.9, mr=1.0, mo=0.22, mw=0.35, mk=0.4, gx=0.4, gy=0.5, bh_L=0.04, bh_R=0.04)
_p('sleepy', eo_L=0.18, eo_R=0.18, bh_L=-0.02, bh_R=-0.02, bt_L=6, bt_R=6, mr=0.8, mo=0.2, mw=0.35)
_p('asleep', eo_L=0.0, eo_R=0.0, bh_L=-0.025, bh_R=-0.025, mo=0.12, mr=0.6, mw=0.35)
_p('effort', eo_L=0.18, eo_R=0.18, lt_L=0.4, lt_R=0.4, bt_L=-20, bt_R=-20, bh_L=-0.02, bh_R=-0.02, mo=0.0, mt=2, mw=1.05, x_sweat=0.6)
_p('sick', eo_L=0.42, eo_R=0.42, bt_L=14, bt_R=14, mv=1.0, mw=0.6, x_gloom=0.6)
_p('disgusted', eo_L=0.55, eo_R=0.4, bt_L=8, bt_R=-14, ms=-0.5, mk=-0.5, mv=0.5, mg=0.5, mo=0.22)
# --- happy (closed n-arcs / grins)
_p('smile', eo_L=0.58, eo_R=0.58, ms=0.75, mw=0.75, bh_L=0.015, bh_R=0.015)
_p('happy', em=1, ms=0.85, mw=0.8, bh_L=0.03, bh_R=0.03, ba_L=0.4, ba_R=0.4)
_p('blissful', em=1, ms=0.7, mw=0.62, bh_L=0.03, bh_R=0.03, bt_L=8, bt_R=8, x_blush=0.5)
_p('grin', em=1, mt=2, mo=0.0, mw=0.95, ms=0.35, bh_L=0.04, bh_R=0.04, ba_L=0.4, ba_R=0.4)
_p('biggrin', em=2, es=1.05, eo_L=1, eo_R=1, mt=1, mz=1, mo=0.42, ms=0.95, mw=1.35, mg=0.0, bh_L=0.06, bh_R=0.06)
_p('laugh', em=1, ms=0.9, mo=0.8, mt=1, mg=0.7, mw=1.1, bh_L=0.05, bh_R=0.05, ba_L=0.5, ba_R=0.5)
_p('excited', em=2, es=1.08, eo_L=1, eo_R=1, ms=0.85, mo=0.7, mt=1, mg=0.6, mw=1.1, bh_L=0.06, bh_R=0.06, x_sparkle=1)
_p('manic', em=2, es=1.25, eo_L=1, eo_R=1, pupil=0.7, ms=0.9, mo=0.0, mt=2, mw=1.3, bh_L=0.07, bh_R=0.07)
_p('wink', eo_R=0.0, eo_L=0.7, ms=0.7, mk=0.45, mw=0.75, bt_R=-8, bh_L=0.03)   # the shut eye draws as a happy arc (facegen: shut + smiling)
_p('knowing', eo_L=0.42, eo_R=0.42, lt_L=0.2, lt_R=0.2, gx=0.55, ms=0.4, mk=0.55, mw=0.55, bh_L=0.03, bt_L=-4, bt_R=4)
_p('suspicious', eo_L=0.34, eo_R=0.4, lt_L=0.35, lt_R=0.3, gx=0.6, mw=0.45, mk=-0.3, ms=-0.15, bt_L=-12, bt_R=-6, bh_R=0.02)
_p('love', em=4, ms=0.85, mo=0.45, mt=1, mw=1.0, bh_L=0.04, bh_R=0.04, x_blush=0.8)
_p('starstruck', em=3, es=1.15, ms=0.9, mo=0.7, mt=1, mg=0.5, mw=1.15, bh_L=0.06, bh_R=0.06)
# --- surprise / fear (rings)
_p('surprised', em=2, es=1.0, bh_L=0.085, bh_R=0.085, ba_L=0.45, ba_R=0.45, eo_L=1, eo_R=1, mr=0.8, mo=0.4, mw=0.5, mg=0.6)
_p('shocked', em=2, es=1.1, pupil=0.85, bh_L=0.1, bh_R=0.1, ba_L=0.5, ba_R=0.5, eo_L=1, eo_R=1, mr=0.6, mo=0.5, mw=0.6, mg=0.6, x_sweat=1)
_p('gape', em=2, es=1.05, bh_L=0.07, bh_R=0.07, eo_L=1, eo_R=1, mr=0.4, mo=0.95, mw=0.75, mt=1, mg=0.7)
_p('worried', em=2, es=1.0, eo_L=1, eo_R=1, bt_L=20, bt_R=20, bh_L=0.035, bh_R=0.035, mv=1.0, mw=0.42)
_p('nervous', eo_L=0.62, eo_R=0.62, bt_L=16, bt_R=16, bh_L=0.025, bh_R=0.025, gx=-0.5, ms=0.3, mo=0.0, mt=2, mw=0.95, x_sweat=1)
_p('embarrassed', eo_L=0.5, eo_R=0.5, bt_L=12, bt_R=12, gx=0.5, gy=-0.4, ms=0.3, mv=0.6, mw=0.55, x_blush=1)
_p('scared', em=2, es=1.08, pupil=0.75, eo_L=1, eo_R=1, bt_L=24, bt_R=24, bh_L=0.06, bh_R=0.06, ms=-0.3, mo=0.2, mv=0.5, mw=0.55)
_p('terrified', em=2, es=1.25, pupil=0.6, eo_L=1, eo_R=1, bt_L=26, bt_R=26, bh_L=0.09, bh_R=0.09, mo=0.0, mt=2, mw=1.15, x_sweat=1)
_p('panic', em=2, es=1.22, pupil=0.65, eo_L=1, eo_R=1, bt_L=24, bt_R=24, bh_L=0.09, bh_R=0.09, mo=0.95, mr=0.3, mt=1, mg=0.6, mw=0.95, x_sweat=1, x_stress=1)
_p('sad', bt_L=18, bt_R=18, bh_L=0.015, bh_R=0.015, eo_L=0.55, eo_R=0.55, lt_L=-0.3, lt_R=-0.3, gy=-0.3, ms=-0.55, mw=0.55)
_p('crying', em=1, bt_L=22, bt_R=22, ms=-0.7, mo=0.55, mv=0.6, mw=0.95, mg=0.3, x_tears=1)
_p('pain', em=6, bt_L=-20, bt_R=-20, ms=-0.5, mo=0.0, mt=2, mw=1.0, x_stress=1)
_p('dizzy', em=5, bt_L=10, bt_R=-10, mv=1.0, mg=0.4, mo=0.18, mw=0.7)
_p('dead', em=6, mv=1.0, mg=0.6, mo=0.12, mw=0.7)

# expressions whose arrival is a TAKE (char.py: head squash -> stretch -> settle, eyes pop past full size)
TAKES = {'surprised': 1.0, 'shocked': 1.25, 'gape': 1.0, 'panic': 1.2, 'terrified': 1.1, 'scared': 0.8, 'excited': 0.7,
         'biggrin': 0.8, 'starstruck': 0.8, 'manic': 0.9, 'worried': 0.5, 'furious': 0.8}

# visemes (mouth only): open, width, round, teeth - talking shapes measured on the reference (f121-151 "Sorry man"):
# closed line, a wide clenched-teeth bar, small o with tongue, mid, wide with the top teeth band + tongue
VIS = {
    'rest': (0.0, 0.85, 0.0, 0), 'MBP': (0.0, 0.8, 0.0, 0), 'AI': (1.0, 1.15, 0.1, 1), 'E': (0.55, 1.3, 0.0, 1),
    'O': (0.85, 0.9, 0.55, 1), 'U': (0.42, 0.55, 1.0, 0), 'FV': (0.0, 1.15, 0.0, 2), 'L': (0.55, 1.05, 0.15, 1),
    'etc': (0.5, 1.05, 0.2, 1), 'S': (0.0, 1.3, 0.0, 2),
}


def viseme_of(ch):
    if ch in 'mbp': return 'MBP'
    if ch in 'ai': return 'AI'
    if ch in 'eh': return 'E'
    if ch == 'o': return 'O'
    if ch in 'uwq': return 'U'
    if ch in 'fv': return 'FV'
    if ch in 'ltdn': return 'L'
    if ch in 'szcjx': return 'S'
    return 'etc'


def mix(a, b, k):
    """Blend two faces; discrete modes switch at the halfway point."""
    out = {}
    for key in BASE:
        if key in ('em', 'mt'): out[key] = b[key] if k >= 0.5 else a[key]
        else: out[key] = a[key] + (b[key] - a[key]) * k
    return out
