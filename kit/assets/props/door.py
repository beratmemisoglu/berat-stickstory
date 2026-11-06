# Interior office door in its frame: casing (architrave) proud of the wall, jamb lining through the wall, stops,
# threshold, three hinge knuckles; the leaf (0.9 x 2.0 m) hangs on the pivot empty <name>_leaf (rotation_euler.z;
# kw open=0..1 swings it ~100 deg toward -Y, the camera side). Leaf: narrow wired-glass window in a bead frame (both
# faces), lever handles + key escutcheons (both faces), kick plate with screws (front), optional sign plate (PNG made
# by tex/make_door.py, cached per text; CJK text uses Yu Gothic Bold).
# Floor prop: stands on z = 0, the wall face is the plane y = 0, the wall itself goes toward +Y (lining depth 0.12 m).
import hashlib, math, os, subprocess

META = {'size': (1.17, 0.15, 2.13), 'anchor': 'floor centre of the opening; wall face = plane y = 0 (casing proud toward -Y, lining 0.12 m into +Y)',
        'animate': ['_leaf'],
        'params': "open=0..1 (leaf rotation_euler.z = -100 deg * open, left hinge), hinge='left'|'right' (seen from the front), "
                  "sign=None|'text' (plate on the leaf; '\\n' = 2 lines; Japanese ok), color (leaf), frame (casing/jamb), sign_bg, sign_ink"}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')


def _png(cz, *args):
    """Run tex/make_door.py in the lab venv (no window); returns True when it worked."""
    py = cz.py()
    try:
        subprocess.run([py, os.path.join(TEX, 'make_door.py'), *args], timeout=90, check=True, capture_output=True,
                       creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        return True
    except Exception as e:
        print('CZ door: png failed', e)
        return False


def _sign_png(cz, text, bg, ink):
    key = hashlib.sha1(f'{text}|{bg}|{ink}'.encode('utf8')).hexdigest()[:10]
    out = cz.gen_path(TEX, f'door_sign_{key}.png')
    if not os.path.exists(out): _png(cz, 'sign', text, out, bg, ink)
    return (out if os.path.exists(out) else None), key


def build(cz, name='door', open=0.0, hinge='left', sign=None, color='#6b8ba1', frame='#3f5263',
          sign_bg='#f2efe6', sign_ink='#2a2622'):
    root = cz.empty(name)
    s = 1 if hinge != 'right' else -1          # +1: hinge on the left (-X) seen from the front
    W, H, T = 0.90, 2.00, 0.045                 # leaf
    JI, JD = 0.455, 0.12                        # jamb inner face |x|, lining depth into the wall
    fm = cz.toon(name + '_framem', frame, tex='grain', tex_strength=0.03)
    lm = cz.toon(name + '_leafm', color, tex='grain', tex_strength=0.035)
    mm = cz.toon(name + '_metalm', '#bdbbb2', tex='grain', tex_strength=0.04)
    sm = cz.toon(name + '_screwm', '#7a776f')
    dm = cz.toon(name + '_darkm', '#2a2622')

    # ---- frame (static)
    for k, sx in (('l', -1), ('r', 1)):
        cz.box(f'{name}_jamb_{k}', (0.03, JD, 2.045), (sx * (JI + 0.015), JD / 2, 2.045 / 2), fm, bevel=0.003, ol=0.006, parent=root)
        cz.box(f'{name}_stop_{k}', (0.016, 0.016, 1.993), (sx * (JI - 0.008), 0.055, 0.006 + 1.993 / 2), fm, bevel=0.002, ol=0.004, parent=root)
    cz.box(name + '_jamb_head', (2 * JI, JD, 0.03), (0, JD / 2, 2.03), fm, bevel=0.003, ol=0.006, parent=root)
    cz.box(name + '_stop_head', (2 * JI - 0.032, 0.016, 0.016), (0, 0.055, 2.007), fm, bevel=0.002, ol=0.004, parent=root)
    cz.box(name + '_threshold', (2 * JI, JD + 0.012, 0.006), (0, JD / 2 - 0.006, 0.003), mm, bevel=0.002, ol=0.003, parent=root)
    CW, CP, ci, ctop = 0.105, 0.03, JI + 0.007, 2.022      # casing width, proud, inner edge, head bottom
    for k, sx in (('l', -1), ('r', 1)):
        cz.box(f'{name}_casing_{k}', (CW, CP, ctop), (sx * (ci + CW / 2), -CP / 2, ctop / 2), fm, bevel=0.007, ol=0.009, parent=root)
    cz.box(name + '_casing_head', (2 * (ci + CW) + 0.02, CP + 0.004, 0.105), (0, -(CP + 0.004) / 2, ctop + 0.0525), fm, bevel=0.007, ol=0.009, parent=root)
    hx, hy = -s * 0.452, -0.004                  # hinge axis
    for i, hz in enumerate((0.24, 1.06, 1.84)):
        cz.cyl(f'{name}_hinge{i}', 0.0095, 0.1, (hx, hy, hz - 0.05), mm, bevel=0.002, ol=0.003, parent=root, verts=20)

    # ---- leaf on its pivot (pivot-local: u = distance from the hinge edge, front face at y0)
    pv = cz.empty(name + '_leaf', (hx, hy, 0), parent=root)
    pv.rotation_euler = (0, 0, math.radians(-s * 100.0 * max(0.0, min(1.0, float(open)))))
    y0 = -hy
    def X(u): return s * u
    uc = 0.003 + W / 2                           # leaf centre
    cz.box(name + '_leafpanel', (W, T, H), (X(uc), y0 + T / 2, 0.01 + H / 2), lm, bevel=0.008, ol=0.01, parent=pv)
    # narrow window: bead frame through the leaf, wired glass on both faces
    ww, wh, wz, bez, bp = 0.15, 0.55, 1.50, 0.028, 0.008
    cz.box(name + '_winframe', (ww + 2 * bez, T + 2 * bp, wh + 2 * bez), (X(uc), y0 + T / 2, wz), fm, bevel=0.006, ol=0.007, parent=pv)
    gm = cz.toon(name + '_glassm', img=os.path.join(TEX, 'door_glass.png'))
    cz.plane(name + '_glass_f', ww, wh, (X(uc), y0 - bp - 0.0015, wz), gm, parent=pv)
    cz.plane(name + '_glass_b', ww, wh, (X(uc), y0 + T + bp + 0.0015, wz), gm, rot=(90, 0, 180), parent=pv)
    # kick plate (front) with six screws
    cz.box(name + '_kick', (W - 0.07, 0.003, 0.22), (X(uc), y0 - 0.0015, 0.15), mm, bevel=0.0012, ol=0.003, parent=pv)
    for i, (du, z) in enumerate([(a, b) for a in (-0.39, 0.0, 0.39) for b in (0.065, 0.235)]):
        cz.sphere(f'{name}_screw{i}', 0.0065, (X(uc + du), y0 - 0.0032, z), sm, scale=(1, 0.35, 1), ol=0, parent=pv, segs=12, rings=6)
    cz.plane(name + '_scuff', 0.3, 0.075, (X(uc + 0.17), y0 - 0.0045, 0.12),
             cz.toon(name + '_scuffm', img=os.path.join(TEX, 'door_scuff.png'), alpha_clip=True), parent=pv)
    # lever handles + key escutcheons, both faces (lever points toward the hinge side)
    hu, hz = 0.83, 0.95
    for side, yy, sg, rx in (('f', y0, -1, 90), ('b', y0 + T, 1, -90)):
        cz.cyl(f'{name}_rose_{side}', 0.038, 0.012, (X(hu), yy, hz), mm, rot=(rx, 0, 0), bevel=0.003, ol=0.005, parent=pv, verts=28)
        cz.cyl(f'{name}_neck_{side}', 0.013, 0.048, (X(hu), yy + sg * 0.011, hz), mm, rot=(rx, 0, 0), ol=0.004, parent=pv, verts=16)
        cz.box(f'{name}_lever_{side}', (0.15, 0.03, 0.03), (X(hu - 0.06), yy + sg * 0.059, hz), mm, bevel=0.011, ol=0.005, parent=pv)
        cz.cyl(f'{name}_esc_{side}', 0.016, 0.006, (X(hu), yy, hz - 0.1), mm, rot=(rx, 0, 0), bevel=0.002, ol=0.003, parent=pv, verts=20)
        cz.box(f'{name}_keyhole_{side}', (0.006, 0.002, 0.016), (X(hu), yy + sg * 0.0068, hz - 0.1), dm, bevel=0, ol=0, parent=pv)
    # optional sign plate
    if sign:
        txt = str(sign)
        sz = 1.088
        cz.box(name + '_signplate', (0.39, 0.006, 0.13), (X(uc), y0 - 0.003, sz), cz.toon(name + '_signbk', sign_ink), bevel=0.002, ol=0.004, parent=pv)
        png, key = _sign_png(cz, txt, sign_bg, sign_ink)
        if png:   # PNG is 680 x 220: keep that aspect
            cz.plane(name + '_sign', 0.384, 0.124, (X(uc), y0 - 0.0072, sz), cz.toon(f'{name}_signm_{key}', img=png), parent=pv)
        else:   # no venv / Pillow: 3D text on a plain plate
            cz.plane(name + '_sign', 0.384, 0.124, (X(uc), y0 - 0.0072, sz), cz.toon(name + '_signbg', sign_bg), parent=pv)
            cz.text(name + '_signtxt', txt.replace('\\n', '\n'), 0.055, (X(uc), y0 - 0.0085, sz), sign_ink, extrude=0.0008, parent=pv)
    return root
