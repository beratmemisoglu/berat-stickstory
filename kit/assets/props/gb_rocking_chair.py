# BELL: wooden rocking chair (the wife sits in it all night). Two curved rockers (radius 1.1 m), turned legs, a
# spindle back leaning 12 deg with a shaped crest rail, flat arms with scrolled ends on turned arm posts, a knitted
# cushion (tex/gb_rocking_chair_knit.png, striped V stitches) and a crocheted granny-square throw hung over the back
# (tex/gb_rocking_chair_throw.png) with a fringe.
# Floor prop: root at the floor centre (= the rockers' floor contact), seat front faces -Y.
# Pivot <name>_rock at the floor contact: rotation_euler.x rocks the whole chair; NEGATIVE tips it BACK (top toward
# +Y), positive tips it forward (tested). At +-8 deg the rocker tips dip ~1 cm into the floor (R (1 - cos 8deg)).
import math, os, subprocess

META = {'size': (0.6, 0.9, 1.12), 'anchor': 'floor centre at the rockers\' contact; seat faces -Y',
        'animate': ['_rock'], 'seat_z': 0.46, 'seat_y': -0.03, 'arm_z': 0.65,
        'params': "rock=deg (rotation_euler.x of <name>_rock, - = back), wood (hex), throw=True|False"}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')


def _png(cz, what, fname):
    p = os.path.join(TEX, fname)
    if not os.path.exists(p):
        py = cz.py()
        try:
            subprocess.run([py, os.path.join(TEX, 'make_gb_interior.py'), what], timeout=90, check=True, capture_output=True,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except Exception as e: print('CZ gb png failed', what, e)
    return p if os.path.exists(p) else None


def build(cz, name='gb_rocking_chair', rock=0.0, wood='#74401f', throw=True):
    root = cz.empty(name)
    pv = cz.empty(name + '_rock', (0, 0, 0), parent=root)
    pv.rotation_euler = (math.radians(rock), 0, 0)
    wd = cz.toon(name + '_woodm', wood, tex='wood', tex_scale=8.0, tex_strength=0.16)
    wdk = cz.toon(name + '_wooddkm', '#4e2a14', tex='wood', tex_scale=8.0, tex_strength=0.14)
    knit = _png(cz, 'knit', 'gb_rocking_chair_knit.png')
    thr = _png(cz, 'throw', 'gb_rocking_chair_throw.png')
    km = cz.toon(name + '_knitm_gb_rocking_chair_knit', '#a33a2e', img=knit, proj='box', proj_scale=1.6, lift=0.66) if knit else '#a33a2e'
    tm = cz.toon(name + '_throwm_gb_rocking_chair_throw', '#3a8480', img=thr, proj='box', proj_scale=1.4, lift=0.66) if thr else '#3a8480'
    fr = cz.toon(name + '_fringem', '#c9902a')

    # ---- rockers: overlapping straight segments along an arc (centre at z = R above the contact)
    R, TH = 1.1, 0.048
    n, phi = 9, math.radians(22.0)
    for k, x in (('l', -0.245), ('r', 0.245)):
        for i in range(n):
            pm = -phi + (i + 0.5) * 2 * phi / n
            rr = R - TH / 2
            seg = 2 * phi / n * R + 0.03
            cz.box(f'{name}_rocker_{k}{i}', (0.04, seg, TH), (x, rr * math.sin(pm), R - rr * math.cos(pm)), wdk,
                   rot=(math.degrees(pm), 0, 0), bevel=0.008, ol=0.006, parent=pv)
        # rocker tips: little rounded ends
        for s in (-1, 1):
            pm = s * phi; rr = R - TH / 2
            cz.cyl(f'{name}_rockertip_{k}{s > 0}', TH / 2, 0.04, (x - 0.02, rr * math.sin(pm), R - rr * math.cos(pm)), wdk,
                   rot=(0, 90, 0), ol=0.006, parent=pv, verts=16)

    def ztop(y):  # top surface of the rocker at y
        return R - math.sqrt((R - TH) ** 2 - y * y)

    # ---- legs (turned) from the rockers to the seat; front ones carry on up as arm posts
    YF, YB, ZS = -0.2, 0.17, 0.375
    for k, x in (('l', -0.225), ('r', 0.225)):
        z0 = ztop(YF) - 0.012
        cz.cyl(f'{name}_legf_{k}', 0.023, 0.65 - z0, (x, YF, z0), wd, ol=0.006, parent=pv, verts=20)
        for j, zz in enumerate((0.2, 0.52)):
            cz.cyl(f'{name}_legf_ring_{k}{j}', 0.03, 0.03, (x, YF, zz), wd, bevel=0.008, ol=0.005, parent=pv, verts=20)
        z0 = ztop(YB) - 0.012
        cz.cyl(f'{name}_legb_{k}', 0.023, ZS - z0 + 0.01, (x, YB, z0), wd, ol=0.006, parent=pv, verts=20)
        cz.cyl(f'{name}_legb_ring_{k}', 0.03, 0.03, (x, YB, 0.2), wd, bevel=0.008, ol=0.005, parent=pv, verts=20)
        cz.cyl(f'{name}_stretch_{k}', 0.014, YB - YF, (x, YF, 0.22), wd, rot=(-90, 0, 0), ol=0.004, parent=pv, verts=14)
    cz.cyl(name + '_stretch_f', 0.014, 0.45, (-0.225, YF, 0.15), wd, rot=(0, 90, 0), ol=0.004, parent=pv, verts=14)

    # ---- seat board + knitted cushion
    cz.box(name + '_seat', (0.5, 0.44, 0.04), (0, -0.03, ZS), wd, bevel=0.01, ol=0.008, parent=pv, origin='bottom')
    cz.box(name + '_cushion', (0.42, 0.39, 0.055), (0, -0.035, ZS + 0.033), km, bevel=0.022, ol=0.007, parent=pv, origin='bottom')
    for s in (-1, 1):    # cushion ties round the back posts
        cz.box(f'{name}_tie{s > 0}', (0.03, 0.01, 0.06), (s * 0.2, 0.155, ZS + 0.06), fr, bevel=0.002, ol=0.002, parent=pv)

    # ---- back: posts, spindles, rails, crest, leaning back
    lean = 12.0; tl = math.radians(lean)
    def back_pt(z):    # point on the back plane at height z (y grows toward +Y as it rises)
        return YB + (z - ZS) * math.tan(tl)
    LB = 0.72
    for k, x in (('l', -0.225), ('r', 0.225)):
        cz.cyl(f'{name}_post_{k}', 0.025, LB, (x, YB, ZS), wd, rot=(-lean, 0, 0), ol=0.007, parent=pv, verts=20)
        zt = ZS + LB * math.cos(tl)
        cz.sphere(f'{name}_postknob_{k}', 0.033, (x, back_pt(zt), zt), wd, ol=0.006, parent=pv, segs=20, rings=10)
    zr0, zr1 = 0.5, 1.0
    cz.box(name + '_backrail', (0.43, 0.035, 0.05), (0, back_pt(zr0), zr0), wd, rot=(-lean, 0, 0), bevel=0.01, ol=0.006, parent=pv)
    cz.box(name + '_crest', (0.47, 0.045, 0.11), (0, back_pt(zr1), zr1), wd, rot=(-lean, 0, 0), bevel=0.016, ol=0.008, parent=pv)
    for i in range(5):
        x = -0.15 + i * 0.075
        ln = (zr1 - zr0) / math.cos(tl)
        cz.cyl(f'{name}_spindle{i}', 0.012, ln, (x, back_pt(zr0), zr0), wd, rot=(-lean, 0, 0), ol=0.004, parent=pv, verts=14)
    # ---- arms with scrolled ends + arm spindles
    za = 0.65
    yb_a = back_pt(za)
    for k, x in (('l', -0.245), ('r', 0.245)):
        L = yb_a - YF + 0.08
        cz.box(f'{name}_arm_{k}', (0.065, L, 0.032), (x, (yb_a + YF - 0.08) / 2, za), wd, bevel=0.01, ol=0.007, parent=pv, origin='bottom')
        cz.cyl(f'{name}_armscroll_{k}', 0.03, 0.07, (x - 0.035, YF - 0.075, za + 0.02), wd, rot=(0, 90, 0), ol=0.006, parent=pv, verts=20)
        for j, yy in enumerate((-0.07, 0.06)):
            cz.cyl(f'{name}_armspindle_{k}{j}', 0.011, za - ZS - 0.03, (x, yy, ZS + 0.035), wd, ol=0.004, parent=pv, verts=12)

    # ---- crocheted throw over the back: over the crest, down the back, a corner hanging in front (fringed)
    if throw:
        grp = cz.empty(name + '_throw', (0, 0, 0), parent=pv)
        # the fold over the crest is a soft roll (a box here read as a plank)
        cz.cyl(name + '_throw_top', 0.036, 0.36, (-0.22, back_pt(zr1 + 0.06) + 0.012, zr1 + 0.06), tm, rot=(0, 90, 0), ol=0.006, parent=grp, verts=24)
        cz.box(name + '_throw_back', (0.36, 0.022, 0.5), (-0.04, back_pt(0.8) + 0.05, 0.8), tm, rot=(-lean, 0, 0), bevel=0.008, ol=0.006, parent=grp)
        cz.box(name + '_throw_front', (0.3, 0.02, 0.2), (-0.07, back_pt(0.95) - 0.048, 0.94), tm, rot=(-lean, 0, -6), bevel=0.008, ol=0.006, parent=grp)
        for i in range(8):
            x = -0.2 + i * 0.037
            cz.box(f'{name}_fringe{i}', (0.01, 0.008, 0.05), (x, back_pt(0.55) + 0.054, 0.53), fr, rot=(-lean, 0, 0), bevel=0.002, ol=0.002, parent=grp)
        for i in range(7):
            x = -0.2 + i * 0.04
            cz.box(f'{name}_fringef{i}', (0.01, 0.008, 0.045), (x, back_pt(0.84) - 0.048, 0.83 + (x + 0.07) * 0.1), fr, rot=(-lean, 0, -6), bevel=0.002, ol=0.002, parent=grp)
    return root
