# Two-sided gondola snack shelf (TICKETS): dark plinth, grey end uprights, a cream pegboard spine, 4 levels per side
# (big family-size chips bags on the deck, regular chips bags, cookie packs stacked two high, candy boxes two deep),
# yellow / red price-tag strips on every shelf lip, candy bags hanging on peg hooks above the top shelf, and a red
# "SNACKS" header card on a post. Both sides are dressed (the -Y side and the +Y side face their own aisle).
# kw seed: which brands go where (facings of 2-3 of a kind, like a real shelf).
# Floor prop: root at the floor centre, front -Y.
import math, os

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')

META = {'size': (1.2, 0.6, 1.6), 'anchor': 'floor centre, two-sided (fronts face -Y and +Y)', 'animate': [],
        'params': "seed=1 (brand layout), header=True ('SNACKS' card), hooks=True (peg-hook candy bags), turn=0 (degrees about Z, for viewing the +Y side)"}

W, D = 1.2, 0.6
SH = (0.1, 0.46, 0.78, 1.06)          # level tops: deck + 3 shelves
SPINE_TOP = 1.36
IW = W - 0.08                          # inner width between the uprights


def _tex(n): return os.path.join(TEX, n)


def build(cz, name='tk_snack_rack', seed=1, header=True, hooks=True, turn=0):
    import random
    rnd = random.Random(seed)
    root = cz.empty(name)

    def M(key, c, **k): return cz.toon(f'tk_snk_{key}', c, **k)
    def face(png): return cz.toon('tk_snk_' + png, img=_tex(f'tk_snack_rack_{png}.png'), lift=0.72)
    plinth = M('plinth', '#2e3036', tex='grain')
    metal = M('metal', '#7f8690', tex='grain', tex_strength=0.04)
    shelfm = M('shelf', '#b9bdc2', tex='grain', tex_strength=0.04)
    spine = M('spine', '#cfc9bc', tex='grain', tex_strength=0.04)
    chrome = M('chrome', '#c3c8cf', lift=0.5)
    strip = cz.toon('tk_snk_strip', img=_tex('tk_snack_rack_strip.png'), lift=0.75)
    peg = cz.toon('tk_snk_peg', img=_tex('tk_snack_rack_peg.png'), lift=0.68)
    COL = {'chips0': '#d42c2a', 'chips1': '#e0561b', 'chips2': '#6e2a16', 'chips3': '#f08a1c', 'chips4': '#2f8a4a', 'chips5': '#1b5fc4',
           'candy0': '#6e3a1c', 'candy1': '#d42c8a', 'candy2': '#2fae52', 'candy3': '#e0561b',
           'cookie0': '#1b4fa8', 'cookie1': '#b8661a', 'cookie2': '#15131a', 'pegbag0': '#d42c8a', 'pegbag1': '#1b5fc4', 'pegbag2': '#2fae52'}

    # ---- structure
    cz.box(name + '_plinth', (W, D, SH[0]), (0, 0, 0), plinth, bevel=0.006, ol=0.008, parent=root, origin='bottom')
    for s in (-1, 1):
        cz.box(f'{name}_upright{s:+d}', (0.04, D, SPINE_TOP), (s * (W / 2 - 0.02), 0, 0), metal, bevel=0.005, ol=0.008, parent=root, origin='bottom')
        cz.plane(f'{name}_endcap{s:+d}', D - 0.04, SPINE_TOP - 0.06, (s * (W / 2 + 0.0013), 0, SPINE_TOP / 2),
                 cz.toon('tk_snk_endcap', img=_tex('tk_snack_rack_endcap.png'), lift=0.7), rot=(90, 0, s * 90), parent=root)
    cz.box(name + '_spine', (IW, 0.04, SPINE_TOP - SH[0]), (0, 0, SH[0]), spine, bevel=0.003, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_cap', (W, 0.07, 0.025), (0, 0, SPINE_TOP), metal, bevel=0.004, ol=0.005, parent=root, origin='bottom')
    for s in (-1, 1):
        rz = 0 if s < 0 else 180
        cz.plane(f'{name}_peg{s:+d}', IW - 0.004, SPINE_TOP - SH[0] - 0.004, (0, s * (0.02 + 0.0013), (SH[0] + SPINE_TOP) / 2), peg, rot=(90, 0, rz), parent=root)
        # deck price strip on the plinth face
        cz.plane(f'{name}_strip{s:+d}_0', IW, 0.03, (0, s * (D / 2 + 0.0013), SH[0] - 0.03), strip, rot=(90, 0, rz), parent=root)
        for j, z in enumerate(SH[1:], 1):
            cz.box(f'{name}_shelf{s:+d}_{j}', (IW, D / 2 - 0.03, 0.02), (0, s * (0.02 + (D / 2 - 0.03) / 2), z), shelfm, bevel=0.002, ol=0.004, parent=root, origin='top')
            ly = s * (D / 2 - 0.01 + 0.006)
            cz.box(f'{name}_lip{s:+d}_{j}', (IW, 0.012, 0.04), (0, ly, z - 0.028), shelfm, bevel=0.002, ol=0.004, parent=root, origin='bottom')
            cz.plane(f'{name}_strip{s:+d}_{j}', IW - 0.01, 0.032, (0, ly + s * (0.006 + 0.0013), z - 0.008), strip, rot=(90, 0, rz), parent=root)

        # ---- products, one level at a time: (kind, designs, item w/d/h, rows deep, layers)
        levels = [('chips', 6, (0.2, 0.075, 0.3), 1, 1), ('chips', 6, (0.148, 0.065, 0.22), 1, 1),
                  ('cookie', 3, (0.175, 0.055, 0.074), 2, 2), ('candy', 4, (0.078, 0.045, 0.1), 2, 1)]
        for j, (kind, nd, (iw, idp, ih), deep, layers) in enumerate(levels):
            z0 = SH[j]
            n = int(IW // (iw + 0.006))
            pitch = IW / n
            seq, k = [], 0
            while len(seq) < n:                      # facings of 2-3 of the same design
                d_ = rnd.randrange(nd); seq += [d_] * rnd.choice((2, 3))
            seq = seq[:n]
            for row in range(deep):
                yr = s * (D / 2 - 0.06 - row * (idp + 0.02))
                for i in range(n):
                    for L in range(layers):
                        x = -IW / 2 + (i + 0.5) * pitch + rnd.uniform(-0.004, 0.004)
                        des = f'{kind}{seq[i]}'
                        pv = cz.empty(f'{name}_{s:+d}_{j}_{row}_{i}_{L}', (x, yr, z0 + L * (ih + 0.002)), parent=root, size=0.01)
                        lean = -7 if kind == 'chips' else 0
                        pv.rotation_euler = (math.radians(lean + rnd.uniform(-2, 2)), 0, math.radians(rz + rnd.uniform(-4, 4)))
                        bev = 0.024 if kind == 'chips' and iw > 0.17 else 0.018 if kind == 'chips' else 0.004
                        cz.box(pv.name + '_m', (iw, idp, ih), (0, 0, 0), M('b' + des, COL[des], tex='grain', tex_strength=0.04), bevel=bev, ol=0.004 if kind == 'chips' else 0.003,
                               parent=pv, origin='bottom')
                        if row == 0 or kind == 'candy':
                            fw, fh = (iw - 1.3 * bev, ih - 1.6 * bev) if kind == 'chips' else (iw - 0.006, ih - 0.006)
                            cz.plane(pv.name + '_f', fw, fh, (0, -idp / 2 - 0.0013, ih / 2), face(des), parent=pv)
        # ---- peg hooks + hanging candy bags above the top shelf
        if hooks:
            for i, x in enumerate((-0.36, 0.0, 0.36)):
                hz = SPINE_TOP - 0.03
                cz.cyl(f'{name}_hook{s:+d}_{i}', 0.004, 0.14, (x, s * 0.02, hz), chrome, rot=(-90 * s, 0, 0), verts=8, ol=0.0015, parent=root)
                for b in range(2):
                    des = f'pegbag{(i + seed) % 3}'
                    pv = cz.empty(f'{name}_pbag{s:+d}_{i}_{b}', (x, s * (0.06 + b * 0.04), hz + 0.01), parent=root, size=0.01)
                    pv.rotation_euler = (math.radians(rnd.uniform(-3, 3)), 0, math.radians(rz + rnd.uniform(-5, 5)))
                    cz.box(pv.name + '_m', (0.125, 0.026, 0.17), (0, 0, 0), M('b' + des, COL[des], tex='grain'), bevel=0.008, ol=0.003, parent=pv, origin='top')
                    if b == 1:
                        cz.plane(pv.name + '_f', 0.115, 0.16, (0, -0.013 - 0.0013, -0.085), face(des), parent=pv)
    # ---- header card on a post
    if header:
        cz.box(name + '_post', (0.03, 0.02, 0.08), (0, 0, SPINE_TOP + 0.025), metal, bevel=0.003, ol=0.004, parent=root, origin='bottom')
        hz = SPINE_TOP + 0.025 + 0.08 + 0.09
        cz.box(name + '_card', (0.7, 0.016, 0.18), (0, 0, hz), M('cardred', '#b3172a'), bevel=0.004, ol=0.006, parent=root)
        hm = cz.toon('tk_snk_header', img=_tex('tk_snack_rack_header.png'), lift=0.75)
        for s, rz in ((-1, 0), (1, 180)):
            cz.plane(f'{name}_cardart{s:+d}', 0.69, 0.172, (0, s * (0.008 + 0.0013), hz), hm, rot=(90, 0, rz), parent=root)
    root.rotation_euler.z = math.radians(turn)
    return root
