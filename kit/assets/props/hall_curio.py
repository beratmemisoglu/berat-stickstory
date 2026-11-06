# Curio cabinet (duobaoge): a dark rosewood display cabinet of staggered open compartments, each holding one treasure
# (small porcelain vases, thread-bound book cases, rolled scrolls, a bronze tripod, a jade disc on a stand, a plate on
# a stand, red coral in a pot, a lacquer box, a gourd), a teal-lacquer back so the pieces stand out, gold edging on the
# divider fronts, a closed base with two doors (panels, round gold pulls, a lock plate) on a plinth, and a carved crest
# board with gold cloud bosses on top. Content and the compartment pattern come from seed.
# Floor prop: root = floor centre of the cabinet's BACK edge (back at y = 0, against a wall); front -Y.
import math, random, os, importlib.util

META = {'size': (1.35, 0.34, 2.7), 'anchor': 'floor centre of the back edge (back at y = 0), front -Y', 'animate': [],
        'params': "w=1.35, h=2.6, d=0.34, seed=1, back='#1e5c58', wood='#4a2218'"}

_V = None


def _vase_mod():
    global _V
    if _V is None:
        spec = importlib.util.spec_from_file_location('hall_vase_lib', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hall_vase.py'))
        _V = importlib.util.module_from_spec(spec); spec.loader.exec_module(_V)
    return _V


def _layout(w, z0, z1, rng):
    """Staggered compartments: rows of random heights, each row cut into cells of random widths (dividers offset
    from the row below). Returns [(x0, x1, za, zb)]."""
    cells = []
    z = z0
    hs = []
    while z1 - z > 0.3:
        hh = rng.choice((0.34, 0.4, 0.46, 0.52))
        if z1 - (z + hh) < 0.3: hh = z1 - z
        hs.append((z, z + hh)); z += hh
    prev = []
    for za, zb in hs:
        xs = [-w / 2]
        while True:
            cw = rng.uniform(0.3, 0.58)
            nx = xs[-1] + cw
            if w / 2 - nx < 0.26: xs.append(w / 2); break
            # keep dividers off the row below's dividers (the staggered look)
            if any(abs(nx - p) < 0.09 for p in prev): nx += 0.12
            if w / 2 - nx < 0.26: xs.append(w / 2); break
            xs.append(nx)
        prev = xs[1:-1]
        for a, b in zip(xs, xs[1:]): cells.append((a, b, za, zb))
    return cells


def _item(cz, name, kind, cx, cz_, cw, chh, d, parent, rng, mats):
    """One treasure standing on the compartment floor at (cx, cz_), cell width cw, clear height chh."""
    y = -d * 0.48
    V = _vase_mod()
    if kind == 'vase':
        shape = rng.choice(('meiping', 'baluster', 'gourd', 'jar'))
        hh = min(chh * 0.78, cw * 1.25, 0.4)
        glaze = rng.choice(('bw', 'bw', 'rose', 'teal', 'oxblood', 'celadon', 'imperial'))
        mat = mats['glaze_' + glaze]
        z = cz_
        cz.cyl(name + '_st', min(0.11, hh * 0.3), 0.025, (cx, y, z), mats['wood'], verts=20, bevel=0.005, ol=0.003, parent=parent)
        V.lathe(cz, name + '_v', V.PROFILES[shape], mat, parent, segs=28, ol=0.004, loc=(cx, y, z + 0.025), scale=hh)
        if shape == 'jar':
            lid = [(0.0, 0.0), (0.2, 0.0), (0.2, 0.03), (0.17, 0.09), (0.1, 0.13), (0.05, 0.14), (0.05, 0.16), (0.07, 0.19), (0.0, 0.2)]
            V.lathe(cz, name + '_lid', lid, mat, parent, segs=28, ol=0.003, loc=(cx, y, z + 0.025 + 0.8 * hh), scale=hh)
    elif kind == 'books':
        n = rng.randint(2, 4); z = cz_
        for i in range(n):
            bw, bd, bh = min(cw * 0.75, 0.3) * rng.uniform(0.85, 1.0), min(d * 0.7, 0.22), rng.uniform(0.035, 0.05)
            col = rng.choice(('#2b4a86', '#22407a', '#6a2a6a', '#2f6a4a', '#8a5a20'))
            cz.box(f'{name}_b{i}', (bw, bd, bh), (cx + rng.uniform(-0.02, 0.02), y, z), mats['cloth_' + col], rot=(0, 0, rng.uniform(-6, 6)),
                   bevel=0.004, ol=0.003, parent=parent, origin='bottom')
            cz.box(f'{name}_t{i}', (0.025, bd * 0.3, bh * 0.6), (cx + bw * 0.38, y - bd / 2 - 0.004, z + bh / 2), mats['ivory'], bevel=0.002, ol=0.0, parent=parent)
            z += bh
    elif kind == 'scrolls':
        n = rng.randint(3, 5)
        L = min(cw * 0.8, 0.36)
        for i in range(n):
            row = 0 if i < 3 else 1
            off = (i - 1) * 0.052 if row == 0 else (i - 3.5) * 0.052
            zz = cz_ + 0.024 + row * 0.044
            col = rng.choice(('#efe4c8', '#e8d6a8', '#d9c48e'))
            cz.cyl(f'{name}_s{i}', 0.024, L, (cx - L / 2, y + off, zz), mats['paper_' + col], rot=(0, 90, 0), verts=14, ol=0.003, parent=parent)
            for s in (-1, 1):
                cz.cyl(f'{name}_k{i}{s}', 0.012, 0.03, (cx + s * L / 2 - (0.03 if s > 0 else 0), y + off, zz), mats['wood'], rot=(0, 90, 0), verts=10, ol=0.0, parent=parent)
            cz.cyl(f'{name}_tie{i}', 0.0255, 0.012, (cx - 0.04, y + off, zz), mats['red'], rot=(0, 90, 0), verts=14, ol=0.0, parent=parent)
    elif kind == 'bronze':
        s = min(cw * 0.5, chh * 0.55, 0.22) / 0.22
        z = cz_
        for k in range(3):
            a = math.radians(90 + 120 * k)
            cz.cyl(f'{name}_leg{k}', 0.012 * s, 0.07 * s, (cx + 0.06 * s * math.cos(a), y + 0.06 * s * math.sin(a), z), mats['bronze'], verts=8, ol=0.002, parent=parent, r2=0.008 * s)
        cz.cyl(name + '_bowl', 0.09 * s, 0.09 * s, (cx, y, z + 0.06 * s), mats['bronze'], r2=0.1 * s, verts=24, bevel=0.01 * s, ol=0.004, parent=parent)
        cz.cyl(name + '_band', 0.095 * s, 0.02 * s, (cx, y, z + 0.12 * s), mats['patina'], verts=24, ol=0.0, parent=parent)
        for sx in (-1, 1):
            cz.box(f'{name}_ear{sx}', (0.018 * s, 0.05 * s, 0.05 * s), (cx + sx * 0.07 * s, y, z + 0.17 * s), mats['bronze'], bevel=0.004, ol=0.002, parent=parent)
    elif kind == 'disc':
        r = min(cw * 0.36, chh * 0.38, 0.13)
        cz.box(name + '_st', (r * 1.2, 0.06, 0.035), (cx, y, cz_), mats['wood'], bevel=0.006, ol=0.003, parent=parent, origin='bottom')
        cz.cyl(name + '_d', r, 0.022, (cx, y + 0.011, cz_ + 0.03 + r), mats['jade'], rot=(90, 0, 0), verts=32, bevel=0.004, ol=0.004, parent=parent)
        cz.cyl(name + '_h', r * 0.32, 0.024, (cx, y + 0.0115 - 0.0005, cz_ + 0.03 + r), mats['back'], rot=(90, 0, 0), verts=20, ol=0.0, parent=parent)
    elif kind == 'plate':
        r = min(cw * 0.38, chh * 0.4, 0.15)
        cz.box(name + '_st', (r * 0.9, 0.08, 0.04), (cx, y + 0.02, cz_), mats['wood'], bevel=0.006, ol=0.003, parent=parent, origin='bottom')
        p = cz.cyl(name + '_p', r, 0.02, (cx, y + 0.05, cz_ + 0.025 + r), mats['plate'], rot=(98, 0, 0), verts=32, bevel=0.006, ol=0.004, parent=parent)
    elif kind == 'coral':
        z = cz_
        cz.cyl(name + '_pot', 0.06, 0.07, (cx, y, z), mats['glaze_bw'], r2=0.075, verts=20, bevel=0.006, ol=0.003, parent=parent)
        hh = min(chh * 0.7, 0.3)
        for k in range(5):
            a = rng.uniform(-40, 40); b = rng.uniform(-20, 20)
            cz.cyl(f'{name}_br{k}', 0.012, hh * rng.uniform(0.5, 1.0), (cx, y, z + 0.06), mats['coral'], rot=(b, a, 0), r2=0.005, verts=8, ol=0.003, parent=parent)
    elif kind == 'box':
        bw, bd, bh = min(cw * 0.6, 0.24), min(d * 0.6, 0.18), min(chh * 0.4, 0.12)
        col = rng.choice(('#9a2a1e', '#2e1a16', '#c0902a'))
        cz.box(name + '_b', (bw, bd, bh), (cx, y, cz_), mats['lac_' + col], bevel=0.008, ol=0.004, parent=parent, origin='bottom')
        cz.box(name + '_lid', (bw * 1.04, bd * 1.04, 0.02), (cx, y, cz_ + bh - 0.02), mats['gold'], bevel=0.004, ol=0.003, parent=parent, origin='bottom')
        cz.sphere(name + '_knob', 0.018, (cx, y, cz_ + bh + 0.01), mats['jade'], ol=0.002, parent=parent, segs=12, rings=6)


def build(cz, name='hall_curio', w=1.35, h=2.6, d=0.34, seed=1, back='#1e5c58', wood='#4a2218'):
    rng = random.Random(seed)
    root = cz.empty(name)
    V = _vase_mod()
    mats = {'wood': cz.toon('hall_rosewood', wood, tex='wood', tex_strength=0.06),
            'back': cz.toon(f'{name}_backm', back, tex='grain', tex_scale=2.0, tex_strength=0.05),
            'gold': cz.toon('hall_gold', '#d2a23e', tex='grain', tex_scale=3.0, tex_strength=0.04),
            'ivory': cz.toon('hall_ivory', '#efe6cf'), 'red': cz.toon('hall_tassel_red', '#b8291b'),
            'bronze': cz.toon('hall_bronze', '#9a6a34', tex='grain', tex_strength=0.06), 'patina': cz.toon('hall_patina', '#3f8a78'),
            'jade': cz.toon('hall_jade', '#6fb08a', tex='grain', tex_strength=0.05), 'coral': cz.toon('hall_coral', '#d8432e'),
            'plate': cz.toon('hall_glaze_bw', img='assets/props/tex/hall_porcelain_bw.png', lift=0.66)}
    for g, png in V.WRAP.items(): mats['glaze_' + g] = cz.toon('hall_glaze_' + g, img=f'assets/props/tex/{png}.png', lift=0.66)
    for g, c in V.PLAIN.items(): mats['glaze_' + g] = cz.toon('hall_glaze_' + g, c, tex='grain', tex_strength=0.03)
    for c in ('#2b4a86', '#22407a', '#6a2a6a', '#2f6a4a', '#8a5a20'): mats['cloth_' + c] = cz.toon('hall_cloth_' + c.lstrip('#'), c, tex='grain', tex_strength=0.05)
    for c in ('#efe4c8', '#e8d6a8', '#d9c48e'): mats['paper_' + c] = cz.toon('hall_paper_' + c.lstrip('#'), c, tex='paper', tex_strength=0.04)
    for c in ('#9a2a1e', '#2e1a16', '#c0902a'): mats['lac_' + c] = cz.toon('hall_lac_' + c.lstrip('#'), c, tex='grain', tex_strength=0.04)
    W, BASE, CREST, T = w, 0.62, 0.16, 0.045
    yc = -d / 2
    # plinth, base cabinet with two doors
    cz.box(name + '_plinth', (W - 0.04, d - 0.03, 0.08), (0, yc + 0.01, 0), mats['wood'], bevel=0.01, ol=0.005, parent=root, origin='bottom')
    cz.box(name + '_base', (W, d, BASE - 0.08), (0, yc, 0.08), mats['wood'], bevel=0.012, ol=0.006, parent=root, origin='bottom')
    for s in (-1, 1):
        dx = s * W / 4
        cz.box(f'{name}_door{s}', (W / 2 - 0.07, 0.014, BASE - 0.2), (dx, -d - 0.004, 0.14), mats['back'], bevel=0.006, ol=0.004, parent=root, origin='bottom')
        cz.box(f'{name}_dpan{s}', (W / 2 - 0.17, 0.008, BASE - 0.3), (dx, -d - 0.012, 0.19), mats['wood'], bevel=0.004, ol=0.003, parent=root, origin='bottom')
        cz.cyl(f'{name}_pull{s}', 0.024, 0.012, (s * 0.06, -d - 0.012, 0.36), mats['gold'], rot=(90, 0, 0), verts=16, ol=0.002, parent=root)
    cz.box(name + '_lock', (0.06, 0.008, 0.1), (0, -d - 0.008, 0.36), mats['gold'], bevel=0.003, ol=0.002, parent=root)
    # the display part: back panel, sides, top
    z0, z1 = BASE, h - CREST
    cz.box(name + '_backp', (W - 0.02, 0.02, z1 - z0), (0, -0.01, z0), mats['back'], bevel=0.0, ol=0.0, parent=root, origin='bottom')
    for s in (-1, 1):
        cz.box(f'{name}_side{s}', (T, d, z1 - z0), (s * (W / 2 - T / 2), yc, z0), mats['wood'], bevel=0.008, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_top', (W + 0.06, d + 0.04, 0.05), (0, yc - 0.01, z1), mats['wood'], bevel=0.012, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_topg', (W + 0.065, 0.01, 0.014), (0, yc - 0.01 - (d + 0.04) / 2 - 0.002, z1 + 0.018), mats['gold'], bevel=0.002, ol=0.0, parent=root, origin='bottom')
    # crest: an arched carved board with gold cloud bosses
    cr = cz.cyl(name + '_crest', W * 0.36, 0.04, (0, yc - d / 2 + 0.05, z1 + 0.05), mats['wood'], rot=(90, 0, 0), verts=36, ol=0.006, parent=root)
    cr.scale = (1.0, 0.3, 1.0)
    for k in range(5):
        a = math.radians(30 + 30 * k)
        cz.cyl(f'{name}_boss{k}', 0.035, 0.02, (W * 0.25 * math.cos(a), yc - d / 2 + 0.008, z1 + 0.06 + 0.065 * math.sin(a)), mats['gold'], rot=(90, 0, 0),
               verts=14, ol=0.002, parent=root)
    # compartments
    inner = W - 2 * T
    cells = _layout(inner, z0 + 0.03, z1 - 0.01, rng)
    zs = sorted({round(c[2], 4) for c in cells} | {round(c[3], 4) for c in cells})
    for i, zz in enumerate(zs):        # shelf boards (gold-edged)
        cz.box(f'{name}_shelf{i}', (inner, d - 0.03, 0.03), (0, yc + 0.005, zz - 0.03), mats['wood'], bevel=0.005, ol=0.004, parent=root, origin='bottom')
        cz.box(f'{name}_sedge{i}', (inner, 0.006, 0.012), (0, -d + 0.012, zz - 0.021), mats['gold'], bevel=0.0, ol=0.0, parent=root, origin='bottom')
    kinds = ['vase', 'vase', 'books', 'scrolls', 'bronze', 'disc', 'plate', 'coral', 'box', 'vase', 'books', 'plate']
    rng.shuffle(kinds)
    for j, (a, b, za, zb) in enumerate(cells):
        if b < inner / 2 - 0.01:      # a divider on the right of the cell
            cz.box(f'{name}_div{j}', (0.03, d - 0.03, zb - za - 0.03), (b, yc + 0.005, za), mats['wood'], bevel=0.005, ol=0.004, parent=root, origin='bottom')
            cz.box(f'{name}_dedge{j}', (0.012, 0.006, zb - za - 0.03), (b, -d + 0.012, za), mats['gold'], bevel=0.0, ol=0.0, parent=root, origin='bottom')
        kind = kinds[j % len(kinds)]
        _item(cz, f'{name}_i{j}', kind, (a + b) / 2, za, b - a - 0.04, zb - za - 0.06, d, root, rng, mats)
    return root
