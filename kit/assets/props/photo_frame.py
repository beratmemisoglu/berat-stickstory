# Desk photo frame: chunky landscape frame (wood or silver) with an inner lip, a cream mat, a printed photo (default a
# cartoon family of round-headed stick figures, tex/make_photo_frame.py), a cardboard back with turn clips and a hinged
# kickstand. It leans back 15 deg on its bottom-back edge; the kickstand reaches the floor behind it.
# Floor/desk prop: root at the floor centre of its footprint, front faces -Y.
# Pivots: <name>_tilt (bottom-back edge of the frame, rotation_euler.x: -15 deg = standing; 0 = upright, more negative
#   = falls back) and <name>_stand (kickstand hinge on the back, rotation_euler.x relative to the frame: 30 deg = open,
#   0 = folded flat against the back).
# kw: photo=PNG path (landscape ~1.48:1, 1.6 % of each edge hides under the mat), style='wood'|'silver', stand=1 (0..1).
import math

META = {'size': (0.2, 0.15, 0.16), 'anchor': 'floor centre of the footprint', 'animate': ['_tilt', '_stand'],
        'params': "photo=PNG, style='wood'|'silver', stand=0..1"}

TEX = 'assets/props/tex/'
STYLES = {   # bar, inner lip, bar texture
    'wood': ('#a8693b', '#6e4024', dict(tex='wood', tex_scale=18.0, tex_strength=0.07)),
    'silver': ('#8f97a2', '#565d68', dict(tex='grain', tex_scale=3.0, tex_strength=0.04)),
}
TILT = 15.0      # lean back (deg)
OPEN = 30.0      # kickstand open angle relative to the frame (deg); OPEN = 2 * TILT keeps the folded leg inside the frame


def build(cz, name='photo_frame', photo=None, style='wood', stand=1.0):
    barc, lipc, btex = STYLES[style]
    FW, FH, FD, BW = 0.20, 0.16, 0.018, 0.026           # outer width / height, bar depth, bar width
    root = cz.empty(name)
    tilt = cz.empty(name + '_tilt', (0, -0.035, -0.001), parent=root)   # bottom-back edge of the bars (y = 0 local); -1 mm: the bevel rounds that edge
    tilt.rotation_euler.x = math.radians(-TILT)
    bar = cz.toon(f'{name}_{style}', barc, **btex)
    bev = 0.003 if style == 'wood' else 0.0045
    ow, oh = FW - 2 * BW, FH - 2 * BW                    # opening 0.148 x 0.108
    # top / bottom bars are built standing and turned 90 deg about Y so the wood grain (object-X bands) runs along them
    cz.box(name + '_bartop', (BW, FD, FW), (0, -FD / 2, FH - BW / 2), bar, rot=(0, 90, 0), bevel=bev, ol=0.004, parent=tilt)
    cz.box(name + '_barbot', (BW, FD, FW), (0, -FD / 2, BW / 2), bar, rot=(0, 90, 0), bevel=bev, ol=0.004, parent=tilt)
    # side bars run (almost) full height behind the top / bottom bars, 1 mm shallower and narrower: the corners read as
    # one frame with a joint line instead of two bevel notches
    for s in (-1, 1):
        cz.box(f'{name}_bar{"LR"[s > 0]}', (BW - 0.001, FD - 0.001, FH - 0.008), (s * (FW - BW - 0.001) / 2, -(FD - 0.001) / 2, FH / 2), bar,
               bevel=bev, ol=0.004, parent=tilt)
    if style == 'silver':   # cartoon metal: a light shine strip along the top and left bars, a darker one on the bottom
        shine = cz.toon(name + '_shine', '#eef1f5'); dull = cz.toon(name + '_dull', '#7e8793')
        cz.plane(name + '_shine_top', FW - 0.024, 0.0035, (0, -FD - 0.001, FH - 0.009), shine, parent=tilt)
        cz.plane(name + '_shine_left', 0.0035, oh - 0.004, (-FW / 2 + 0.009, -FD - 0.0002, FH / 2), shine, parent=tilt)   # between the bars only
        cz.plane(name + '_dull_bot', FW - 0.024, 0.003, (0, -FD - 0.001, 0.008), dull, parent=tilt)
    # inner lip: a darker 5 mm step just inside the opening, recessed 5.5 mm behind the bar faces
    lip = cz.toon(f'{name}_lip_{style}', lipc, **btex); LW, ly0, ly1 = 0.005, -0.0125, -0.0085
    ld, lyc = ly1 - ly0, (ly0 + ly1) / 2
    cz.box(name + '_liptop', (LW, ld, ow), (0, lyc, FH - BW - LW / 2), lip, rot=(0, 90, 0), bevel=0.0012, ol=0.0015, parent=tilt)
    cz.box(name + '_lipbot', (LW, ld, ow), (0, lyc, BW + LW / 2), lip, rot=(0, 90, 0), bevel=0.0012, ol=0.0015, parent=tilt)
    for s in (-1, 1):
        cz.box(f'{name}_lip{"LR"[s > 0]}', (LW, ld, oh - 2 * LW), (s * (ow - LW) / 2, lyc, FH / 2), lip, bevel=0.0012, ol=0.0015, parent=tilt)
    # mat (4 cream strips, 1 mm behind the lip) and the photo (1.2 mm behind the mat)
    mat = cz.toon(name + '_matm', '#efe8d6', tex='paper', tex_strength=0.04)
    mw, mh, pw, ph = 0.144, 0.104, 0.120, 0.080          # mat outer / window
    my = ly1 + 0.001; zc = FH / 2
    cz.plane(name + '_mattop', mw, (mh - ph) / 2, (0, my, zc + (mh + ph) / 4), mat, parent=tilt)
    cz.plane(name + '_matbot', mw, (mh - ph) / 2, (0, my, zc - (mh + ph) / 4), mat, parent=tilt)
    for s in (-1, 1):
        cz.plane(f'{name}_mat{"LR"[s > 0]}', (mw - pw) / 2, ph, (s * (mw + pw) / 4, my, zc), mat, parent=tilt)
    photo = photo or TEX + 'photo_frame_family.png'
    pm = cz.toon(f'{name}_photo_{photo.replace(chr(92), "/").split("/")[-1]}', img=photo, lift=0.7)
    cz.plane(name + '_photo', pw + 0.004, ph + 0.004, (0, my + 0.0012, zc), pm, parent=tilt)
    # cardboard back (behind the bars) + four metal turn clips
    card = cz.toon(name + '_card', '#8c6a48', tex='paper', tex_scale=0.5, tex_strength=0.06)
    BD = 0.005
    cz.box(name + '_back', (FW - 0.01, BD, FH - 0.01), (0, BD / 2, FH / 2), card, bevel=0.0015, ol=0.002, parent=tilt)
    metal = cz.toon(name + '_metal', '#9aa1ab')
    for k, (cx_, cz_, rz) in enumerate(((0, FH - 0.012, 0), (0, 0.012, 0), (-FW / 2 + 0.012, FH / 2, 90), (FW / 2 - 0.012, FH / 2, 90))):
        cz.box(f'{name}_clip{k}', (0.016, 0.002, 0.005), (cx_, BD + 0.0009, cz_), metal, rot=(0, rz, 0), bevel=0.0007, ol=0.001, parent=tilt)
    # kickstand: hinge on the back at hz, the leg is long enough to touch the floor when open
    hz = 0.105
    a = math.radians(-TILT)
    hy_w, hz_w = BD * math.cos(a) - hz * math.sin(a), BD * math.sin(a) + hz * math.cos(a) - 0.001   # hinge height in the world
    c = math.radians(OPEN - TILT)                                                           # leg angle from vertical
    L = (hz_w - 0.0006) / math.cos(c)
    st = cz.empty(name + '_stand', (0, BD, hz), parent=tilt)
    st.rotation_euler.x = math.radians(OPEN * max(0.0, min(1.0, stand)))
    cz.box(name + '_leg', (0.042, 0.005, L), (0, 0.0025, -L / 2), card, bevel=0.0015, ol=0.002, parent=st)
    cz.box(name + '_hinge', (0.034, 0.003, 0.009), (0, BD + 0.0014, hz - 0.002), metal, bevel=0.0008, ol=0.001, parent=tilt)
    return root
