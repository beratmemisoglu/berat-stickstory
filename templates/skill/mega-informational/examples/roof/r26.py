# R26 "Add a strip of metal around the chimney" 1867-1925 (stone chimney; a metal flashing wraps its base, green)
F0, F1 = 1867, 1925
import math


def build(ctx):
    import os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, props_r2 as R
    R.world(F1, 'clear')
    mt = R.mats()
    P = R.cottage(mt)
    R.land(mt)
    fl = flashing(R, cz, mt)
    fm = M.steel('r2_flash_metal', color='#b9bec6', rough=0.25)
    for p in fl: p.data.materials[0] = fm
    pr = fm.node_tree.nodes['Principled BSDF']; pr.inputs['Emission Color'].default_value = cz.col('#3cff4a')
    for f, v in ((1891, 0.0), (1896, 2.5), (1918, 2.5), (1926, 0.0)):
        pr.inputs['Emission Strength'].default_value = v; pr.inputs['Emission Strength'].keyframe_insert('default_value', frame=f)
    xm = M.xray('r2_x_flash')
    R.xcopy(fl, xm, 1.2, lift=0.03)
    k = lambda tt, a, b: cz.clamp(((tt * 30 + 1) - a) / (b - a))
    # the pieces wrap round the base one after another: "strip" (1888) .. "around" (1902)
    for i, p in enumerate(fl):
        fa = 1884 + i * 4
        R.pop(p, fa, F0, F1, dur=6)
    R.xfade(xm, 1896, hold=22, off=8)
    R.flight([(1867, (6.4, 7.6, 6.6), (2.8, 1.1, 4.5), 26),
              (1900, (4.2, 7.4, 6.0), (2.8, 1.1, 4.45), 28),
              (1925, (1.6, 7.0, 5.8), (2.8, 1.1, 4.5), 28)], F0, F1)
    return F0, F1


def flashing(R, cz, mt):
    """Four bent strips round the chimney base on the back slope (apron below, back gutter above, two step sides)."""
    cx, cy = R.W / 2 - 1.2, 1.1
    zc = R.surf_z(cy) - 0.02
    a = math.radians(R.H.PITCH)
    parts = []
    # side strips follow the slope (rotate about X so they lie along the roof line)
    for sx in (-1, 1):
        parts.append(cz.box(f'flash_s{sx}', (0.06, 1.14, 0.3), (cx + sx * 0.48, cy, zc + 0.12), mt['metal'], rot=(-R.H.PITCH, 0, 0), bevel=0.005, ol=0))
        parts.append(cz.box(f'flash_sf{sx}', (0.22, 1.14, 0.012), (cx + sx * 0.58, cy, zc + 0.07), mt['metal'], rot=(-R.H.PITCH, 0, 0), bevel=0.002, ol=0))
    # apron on the downhill side (y bigger = downhill on the back slope)
    yd = cy + 0.5
    parts.append(cz.box('flash_ap', (1.06, 0.06, 0.32), (cx, yd, R.surf_z(yd) + 0.12), mt['metal'], bevel=0.005, ol=0))
    parts.append(cz.box('flash_apf', (1.2, 0.3, 0.012), (cx, yd + 0.14, R.surf_z(yd + 0.14) + 0.07), mt['metal'], rot=(-R.H.PITCH, 0, 0), bevel=0.002, ol=0))
    # back (uphill) cricket strip
    yu = cy - 0.5
    parts.append(cz.box('flash_bk', (1.06, 0.06, 0.32), (cx, yu, R.surf_z(yu) + 0.12), mt['metal'], bevel=0.005, ol=0))
    parts.append(cz.box('flash_bkf', (1.2, 0.3, 0.012), (cx, yu - 0.14, R.surf_z(yu - 0.14) + 0.07), mt['metal'], rot=(-R.H.PITCH, 0, 0), bevel=0.002, ol=0))
    return parts
