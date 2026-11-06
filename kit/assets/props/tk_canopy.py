# Gas-station canopy + pumps + price sign (TICKETS exterior, seen through the store windows at dusk, 8-15 m away).
# A chunky flat canopy (7.6 x 4.4 m, clearance 3.4 m) on 2 square posts, its fascia printed "GAS & GO" (front/back)
# and "OPEN 24 HOURS" (ends), a magenta neon band along the bottom edge and a cyan one along the top, glowing light
# panels underneath (+ area lights that pool on the ground, lights=True); 2 concrete islands, each with a post, a
# double-sided pump (red lit brand header, lit screen + grade buttons, pay keypad, 2 hoses in holsters each side) and
# yellow bollards; a concrete pad with joints; a tall price sign (brand + 3 glowing LED prices) on a pole at the side.
# on=False: everything unlit (daytime). Floor prop: root at the floor centre (canopy centre), front -Y.
import math, os
from mathutils import Vector

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')

META = {'size': (10.5, 5.6, 7.2), 'anchor': 'floor centre under the canopy, front -Y (pumps are double-sided); x extent -4.2 .. +6.3 (sign side +X)',
        'animate': [], 'parts': 'canopy 7.6 x 4.4 at z 3.4..3.9; pumps at x = +-1.6; price sign pole at x = +5.4, y = +1.2 (top 7.2)',
        'params': "on=True (glow + lights), lights=True (2 area lights under the canopy when on), power=600 (W each), "
                  "pad=True (concrete pad 8.4 x 5.6, 3 cm), sign=True (price sign), neon=('#ff3fb0', '#3fe6ff') (bottom, top band)"}

CW, CD, CZ, CT = 7.6, 4.4, 3.4, 0.5      # canopy width, depth, clearance, fascia height


def _tex(n): return os.path.join(TEX, n)


def _segment(cz, nm, a, b, r, mat, parent, ol):
    a, b = Vector(a), Vector(b); d = b - a
    o = cz.capsule(nm, r, d.length + 2 * r, tuple(a - d.normalized() * r), mat, ol=ol, parent=parent)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return o


def build(cz, name='tk_canopy', on=True, lights=True, power=600, pad=True, sign=True, neon=('#ff3fb0', '#3fe6ff')):
    root = cz.empty(name)
    st = 'on' if on else 'off'

    def M(key, c, **k): return cz.toon(f'tk_can_{key}', c, **k)
    def G(key, c, s):  # glow when on, plain toon when off
        return cz.glow(f'tk_can_{key}_on', c, s) if on else M(key + '_off', c, lift=0.6)
    def S(key, png, s=1.15):
        return cz.screen(f'{name}_{key}', _tex(png), s) if on else cz.toon(f'tk_can_{key}_off', img=_tex(png), lift=0.6)
    white = M('white', '#dcd8ce', tex='grain', tex_strength=0.05)
    red = M('red', '#b3172a', tex='grain', tex_strength=0.05)
    conc = M('conc', '#8a8d8b', pattern=('tiles', 1.4, '#5d605e'), tex='grain', tex_strength=0.08)
    curb = M('curb', '#a3a5a2', tex='grain', tex_strength=0.08)
    dark = M('dark', '#2a2d33', tex='grain')
    yellow = M('yellow', '#e3a514', tex='grain')
    hose = M('hose', '#18171b')

    if pad:
        cz.box(name + '_pad', (8.4, 5.6, 0.03), (0, 0, 0), conc, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    Z0 = 0.03 if pad else 0.0

    # ---- canopy roof + fascia prints + neon bands + light panels underneath
    cz.box(name + '_roof', (CW, CD, CT), (0, 0, CZ), white, bevel=0.03, ol=0.02, parent=root, origin='bottom')
    fm = S('fascia', 'tk_canopy_fascia.png', 1.0)
    sm = S('fside', 'tk_canopy_side.png', 1.0)
    zc = CZ + CT / 2
    cz.plane(name + '_fasciaF', CW - 0.06, CT - 0.04, (0, -CD / 2 - 0.004, zc), fm, parent=root)
    cz.plane(name + '_fasciaB', CW - 0.06, CT - 0.04, (0, CD / 2 + 0.004, zc), fm, rot=(90, 0, 180), parent=root)
    for s in (-1, 1):
        cz.plane(f'{name}_fasciaS{s:+d}', CD - 0.06, CT - 0.04, (s * (CW / 2 + 0.004), 0, zc), sm, rot=(90, 0, s * 90), parent=root)
    nb, nt = G('neonb', neon[0], 4.0), G('neont', neon[1], 4.0)
    t = 0.09
    for k, (mat, z) in enumerate(((nb, CZ - 0.0), (nt, CZ + CT - t))):
        for s in (-1, 1):
            cz.box(f'{name}_neon{k}y{s:+d}', (CW + 0.06, t, t), (0, s * (CD / 2 + 0.02), z), mat, bevel=0.0, ol=0.0, parent=root, origin='bottom')
            cz.box(f'{name}_neon{k}x{s:+d}', (t, CD + 0.06, t), (s * (CW / 2 + 0.02), 0, z), mat, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    panel = G('panel', '#f4fbff', 2.5)
    soffit = cz.toon('tk_can_soffit_' + st, '#c9cfdc', emit=0.35 if on else 0.0, tex='grain', tex_strength=0.04)
    cz.box(name + '_soffit', (CW - 0.12, CD - 0.12, 0.02), (0, 0, CZ - 0.02), soffit, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    for i in range(4):
        for j in range(2):
            cz.box(f'{name}_lamp{i}_{j}', (0.9, 0.9, 0.03), (-2.7 + i * 1.8, -1.0 + j * 2.0, CZ - 0.05), panel, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    if on and lights:
        for k, x in enumerate((-1.8, 1.8)):
            L = cz.light(f'{name}_light{k}', 'AREA', (x, 0, CZ - 0.05), rot=(0, 0, 0), color='#eef6ff', power=power, size=2.5, shadow=True)
            L.data.shape = 'RECTANGLE'; L.data.size = 3.2; L.data.size_y = 3.0
            L.parent = root

    # ---- islands, posts, pumps, bollards
    for s in (-1, 1):
        ix = s * 1.9
        cz.box(f'{name}_island{s:+d}', (2.8, 0.9, 0.16), (ix, 0, Z0), curb, bevel=0.03, ol=0.012, parent=root, origin='bottom')
        cz.box(f'{name}_islandtop{s:+d}', (2.7, 0.8, 0.005), (ix, 0, Z0 + 0.16), M('islandtop', '#b7b9b6', tex='grain'), bevel=0.0, ol=0.0, parent=root, origin='bottom')
        px = s * 2.9
        cz.box(f'{name}_post{s:+d}', (0.42, 0.42, CZ - Z0 - 0.16), (px, 0, Z0 + 0.16), white, bevel=0.02, ol=0.014, parent=root, origin='bottom')
        cz.box(f'{name}_postband{s:+d}', (0.44, 0.44, 0.5), (px, 0, Z0 + 0.16 + 0.35), red, bevel=0.01, ol=0.012, parent=root, origin='bottom')
        for by in (-0.3, 0.3):
            bx = s * 0.75
            cz.cyl(f'{name}_bollard{s:+d}{by:+.1f}', 0.085, 0.75, (bx, by, Z0 + 0.16), yellow, verts=20, bevel=0.02, ol=0.01, parent=root)
            cz.cyl(f'{name}_bollardband{s:+d}{by:+.1f}', 0.087, 0.08, (bx, by, Z0 + 0.16 + 0.5), dark, verts=20, ol=0.0, parent=root)
        _pump(cz, f'{name}_pump{s:+d}', root, (s * 1.6, 0, Z0 + 0.16), M, S, red, white, dark, hose)

    # ---- price sign on a pole
    if sign:
        sx, sy = 5.4, 1.2
        cz.box(name + '_signbase', (0.7, 0.7, 0.3), (sx, sy, 0), curb, bevel=0.03, ol=0.012, parent=root, origin='bottom')
        cz.box(name + '_signpole', (0.3, 0.3, 4.6), (sx, sy, 0.3), M('pole', '#5b5f68', tex='grain'), bevel=0.02, ol=0.014, parent=root, origin='bottom')
        cz.box(name + '_signbox', (1.7, 0.36, 2.3), (sx, sy, 4.9), red, bevel=0.04, ol=0.02, parent=root, origin='bottom')
        pm = S('price', 'tk_canopy_price.png', 1.1)
        for s, rz in ((-1, 0), (1, 180)):
            cz.plane(f'{name}_price{s:+d}', 1.56, 2.145, (sx, sy + s * (0.18 + 0.004), 4.9 + 1.15), pm, rot=(90, 0, rz), parent=root)
        cz.box(name + '_signcap', (1.8, 0.42, 0.1), (sx, sy, 7.2 - 0.1), dark, bevel=0.02, ol=0.012, parent=root, origin='bottom')
    return root


def _pump(cz, nm, root, loc, M, S, red, white, dark, hose):
    x, y, z = loc
    cz.box(nm + '_plinth', (0.86, 0.52, 0.1), (x, y, z), dark, bevel=0.01, ol=0.008, parent=root, origin='bottom')
    cz.box(nm + '_body', (0.76, 0.44, 1.18), (x, y, z + 0.1), white, bevel=0.03, ol=0.012, parent=root, origin='bottom')
    cz.box(nm + '_head', (0.82, 0.48, 0.3), (x, y, z + 1.28), red, bevel=0.03, ol=0.012, parent=root, origin='bottom')
    hm = S('pumphead', 'tk_canopy_pumphead.png', 1.1)
    scm = S('pumpscreen', 'tk_canopy_pumpscreen.png', 1.15)
    dm = cz.toon('tk_can_pumpdoor', img=_tex('tk_canopy_pumpdoor.png'), lift=0.7)
    for s, rz in ((-1, 0), (1, 180)):
        fy = y + s * 0.22
        cz.plane(f'{nm}_headart{s:+d}', 0.78, 0.27, (x, y + s * (0.24 + 0.002), z + 1.43), hm, rot=(90, 0, rz), parent=root)
        cz.box(f'{nm}_bezel{s:+d}', (0.46, 0.03, 0.36), (x, fy + s * 0.012, z + 1.05), dark, bevel=0.01, ol=0.006, parent=root)
        cz.plane(f'{nm}_screen{s:+d}', 0.4, 0.3, (x, fy + s * (0.027 + 0.0015), z + 1.05), scm, rot=(90, 0, rz), parent=root)
        cz.plane(f'{nm}_door{s:+d}', 0.42, 0.49, (x, fy + s * 0.0015, z + 0.52), dm, rot=(90, 0, rz), parent=root)
        # 2 nozzles in holsters at the body's sides of this face, hoses looping down and up from the head
        for hx in (-0.31, 0.31):
            hp = (x + hx, fy + s * 0.05, z + 0.78)
            cz.box(f'{nm}_holster{s:+d}{hx:+.2f}', (0.1, 0.08, 0.12), (hp[0], fy + s * 0.03, hp[2]), dark, bevel=0.01, ol=0.006, parent=root)
            cz.box(f'{nm}_nozzle{s:+d}{hx:+.2f}', (0.07, 0.09, 0.2), (hp[0], fy + s * 0.075, hp[2] + 0.06), M('grip' + ('g' if hx > 0 else 'k'), '#2fae52' if hx > 0 else '#2a2622'),
                   bevel=0.015, ol=0.006, parent=root, origin='bottom')
            top = (x + hx * 1.05, fy + s * 0.02, z + 1.26)
            low = (x + hx * 1.35, fy + s * 0.22, z + 0.42)
            _segment(cz, f'{nm}_hoseA{s:+d}{hx:+.2f}', top, low, 0.022, hose, root, 0.006)
            _segment(cz, f'{nm}_hoseB{s:+d}{hx:+.2f}', low, (hp[0], fy + s * 0.12, hp[2] + 0.1), 0.022, hose, root, 0.006)
