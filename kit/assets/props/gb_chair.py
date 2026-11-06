# BELL: ladder-back kitchen chair with a woven rush seat (tex/gb_chair_rush.png: strands woven corner to centre).
# Turned front legs with knob tops, rear posts leaning 6 deg with ball finials, three arched ladder slats, double
# stretchers. kw wood (hex) or paint='#hex' (a painted country chair, e.g. '#3f6a52').
# Floor prop: root at the floor centre, seat front faces -Y, seat top z = 0.46.
import math, os, subprocess

META = {'size': (0.48, 0.47, 1.02), 'anchor': 'floor centre; seat front faces -Y', 'animate': [],
        'seat_z': 0.46, 'seat_y': -0.005, 'params': "wood (hex), paint=None|'#hex'"}

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


def build(cz, name='gb_chair', wood='#6e4220', paint=None):
    root = cz.empty(name)
    c = paint or wood
    wd = cz.toon(name + '_woodm' + ('_p' + paint.lstrip('#') if paint else ''), c, tex='wood' if not paint else 'grain',
                 tex_scale=8.0 if not paint else 2.0, tex_strength=0.16 if not paint else 0.07)
    rp = _png(cz, 'rush', 'gb_chair_rush.png')
    rm = cz.toon(name + '_rushm_gb_chair_rush', '#b0883e', img=rp, lift=0.62, tint='#cdb48c') if rp else '#b0883e'
    rs = cz.toon(name + '_rushsidem', '#9a7434', tex='grain', tex_scale=4.0, tex_strength=0.12)
    XF, YF, YB, ZS = 0.2, -0.19, 0.18, 0.46
    # front legs + knob tops
    for k, x in (('l', -XF), ('r', XF)):
        cz.cyl(f'{name}_legf_{k}', 0.024, ZS + 0.01, (x, YF, 0), wd, ol=0.006, parent=root, verts=20)
        cz.sphere(f'{name}_legf_knob_{k}', 0.03, (x, YF, ZS + 0.02), wd, ol=0.005, parent=root, segs=20, rings=10)
        cz.cyl(f'{name}_legf_ring_{k}', 0.031, 0.025, (x, YF, 0.3), wd, bevel=0.006, ol=0.004, parent=root, verts=20)
    # rear posts leaning back
    lean = 6.0; tl = math.radians(lean); LP = 1.0
    def py(z): return YB + max(0.0, z - ZS) * math.tan(tl)
    for k, x in (('l', -XF), ('r', XF)):
        cz.cyl(f'{name}_legb_{k}', 0.026, ZS, (x, YB, 0), wd, ol=0.006, parent=root, verts=20)
        cz.cyl(f'{name}_post_{k}', 0.026, LP - ZS, (x, YB, ZS - 0.005), wd, rot=(-lean, 0, 0), ol=0.006, parent=root, verts=20)
        zt = ZS + (LP - ZS) * math.cos(tl)
        cz.sphere(f'{name}_finial_{k}', 0.034, (x, py(zt), zt + 0.02), wd, ol=0.005, parent=root, segs=20, rings=10)
    # ladder slats (three, the top one tallest)
    for j, (zz, hh) in enumerate(((0.62, 0.06), (0.75, 0.07), (0.89, 0.085))):
        cz.box(f'{name}_slat{j}', (0.4, 0.024, hh), (0, py(zz) + 0.004, zz), wd, rot=(-lean, 0, 0), bevel=0.01, ol=0.006, parent=root)
        cz.box(f'{name}_slat{j}_arch', (0.22, 0.022, hh * 0.45), (0, py(zz + hh * 0.55) + 0.004, zz + hh * 0.55), wd, rot=(-lean, 0, 0), bevel=0.01, ol=0.005, parent=root)
    # stretchers
    for j, zz in enumerate((0.13, 0.23)):
        cz.cyl(f'{name}_str_f{j}', 0.013, 2 * XF, (-XF, YF, zz), wd, rot=(0, 90, 0), ol=0.004, parent=root, verts=14)
    for k, x in (('l', -XF), ('r', XF)):
        for j, zz in enumerate((0.17, 0.27)):
            cz.cyl(f'{name}_str_{k}{j}', 0.013, YB - YF, (x, YF, zz), wd, rot=(-90, 0, 0), ol=0.004, parent=root, verts=14)
    cz.cyl(name + '_str_b', 0.013, 2 * XF, (-XF, YB, 0.2), wd, rot=(0, 90, 0), ol=0.004, parent=root, verts=14)
    # rush seat: woven slab over the seat rails, the weave PNG on a card on top
    cz.box(name + '_seat', (0.45, 0.42, 0.045), (0, -0.005, ZS - 0.045), rs, bevel=0.012, ol=0.007, parent=root, origin='bottom')
    cz.plane(name + '_seat_weave', 0.43, 0.40, (0, -0.005, ZS + 0.0013), rm, rot=(0, 0, 0), parent=root)
    return root
