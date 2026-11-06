# The roof film's hero cottage (shared by every shot; builders call house.build(stage=..., ...) and animate parts).
# 1 unit = 1 m. Footprint 8 (x) by 6 (y), walls 2.8 high, the long walls along X. The roof is built in STAGES:
#   'walls'    stone walls only (window + door holes, a stone chimney on the +X gable)
#   'flat'     + flat boards across the wall tops (roof['boards'])
#   'gable'    + the sloped two-pitch deck of boards on rafters (roof['deck'], roof['rafters'])
#   'shingles' + rows of shingles (roof['shingle_rows'] - one object per row, bottom row first)
#   'full'     + underlayment sheet, gutters + downpipe, ties (trusses), insulation, chimney flashing
# Each part is returned in a dict so shots can hide, animate or X-ray them.
import bpy, math, os, random
import numpy as np
from mathutils import Vector
import cz, mega as M

W, D, WALL = 8.0, 6.0, 2.8          # footprint x, y and wall height
T = 0.4                              # wall thickness
PITCH = 35.0                         # roof pitch (degrees)
OVER = 0.45                          # eave overhang
TEX = lambda n: os.path.join(cz.LAB, 'assets', 'mega', n)
has = lambda n: os.path.exists(TEX(n))


def mats():
    return dict(
        stone=M.pbr('rf_stone', '#9a948a', rough=0.85, img=TEX('roof_stone.png') if has('roof_stone.png') else None, scale=0.45, bump=0.6, bump_scale=3, noise=0.4),
        wood=M.pbr('rf_wood', '#a8774a', rough=0.6, img=TEX('roof_wood.png') if has('roof_wood.png') else None, scale=0.6, noise=0.3),
        wood_dark=M.pbr('rf_wood_dark', '#6b4a30', rough=0.6, img=TEX('roof_wood.png') if has('roof_wood.png') else None, scale=0.6, tint='#8a6a50'),
        shingle=M.pbr('rf_shingle', '#5b4038', rough=0.75, img=TEX('roof_shingle.png') if has('roof_shingle.png') else None, scale=1.2, noise=0.35),
        membrane=M.pbr('rf_membrane', '#24262b', rough=0.35, spec=0.6),
        metal=M.steel('rf_metal', color='#a9adb3', rough=0.3),
        glass=M.pbr('rf_glass', '#1d2a33', rough=0.05, spec=1.0),
        grass=M.pbr('rf_grass', '#4f7d32', rough=0.9, img=TEX('roof_grass.png') if has('roof_grass.png') else None, scale=0.25, noise=0.4),
        insul=M.pbr('rf_insul', '#f2a0a8', rough=0.95, bump=0.8, bump_scale=20),
        floor=M.pbr('rf_floor', '#7a5a3c', rough=0.5, img=TEX('roof_wood.png') if has('roof_wood.png') else None, scale=0.5, tint='#b08a68'),
        xray=M.xray('rf_xray'),
    )


def _walls(mt, root):
    parts = []
    z = WALL / 2
    # long walls (front y=-D/2 has a door + 2 windows, back y=+D/2 has 2 windows)
    def wall_with_holes(name, length, axis, pos, holes):
        # holes: list of (u_center, width, z0, z1) along the wall
        segs = []; u0 = -length / 2
        cuts = sorted(holes)
        cur = u0
        for (uc, w, z0, z1) in cuts:
            a, b = uc - w / 2, uc + w / 2
            if a > cur: segs.append((cur, a, 0, WALL))
            segs.append((a, b, 0, z0))
            if z1 < WALL: segs.append((a, b, z1, WALL))
            cur = b
        segs.append((cur, length / 2, 0, WALL))
        for i, (a, b, z0, z1) in enumerate(segs):
            if b - a < 1e-3 or z1 - z0 < 1e-3: continue
            c = (a + b) / 2
            size = (b - a, T, z1 - z0) if axis == 'x' else (T, b - a, z1 - z0)
            loc = (c, pos, (z0 + z1) / 2) if axis == 'x' else (pos, c, (z0 + z1) / 2)
            parts.append(cz.box(f'{name}{i}', size, loc, mt['stone'], bevel=0.03, ol=0, parent=root))
        for j, (uc, w, z0, z1) in enumerate(cuts):
            if z0 > 0.1:   # window: glass + timber frame + sill
                loc = (uc, pos, (z0 + z1) / 2) if axis == 'x' else (pos, uc, (z0 + z1) / 2)
                gs = (w, 0.04, z1 - z0) if axis == 'x' else (0.04, w, z1 - z0)
                parts.append(cz.box(f'{name}_glass{j}', gs, loc, mt['glass'], bevel=0, ol=0, parent=root))
                sl = (w + 0.2, T + 0.12, 0.08) if axis == 'x' else (T + 0.12, w + 0.2, 0.08)
                sloc = (uc, pos, z0 - 0.04) if axis == 'x' else (pos, uc, z0 - 0.04)
                parts.append(cz.box(f'{name}_sill{j}', sl, sloc, mt['stone'], bevel=0.02, ol=0, parent=root))
                for k, du in enumerate((-w / 2, 0, w / 2)):
                    fl = (0.07, T + 0.02, z1 - z0) if axis == 'x' else (T + 0.02, 0.07, z1 - z0)
                    floc = (uc + du, pos, (z0 + z1) / 2) if axis == 'x' else (pos, uc + du, (z0 + z1) / 2)
                    parts.append(cz.box(f'{name}_mul{j}{k}', fl, floc, mt['wood_dark'], bevel=0.01, ol=0, parent=root))
            else:          # door
                loc = (uc, pos - 0.05, z1 / 2) if axis == 'x' else (pos, uc, z1 / 2)
                ds = (w, 0.08, z1) if axis == 'x' else (0.08, w, z1)
                parts.append(cz.box(f'{name}_door{j}', ds, loc, mt['wood_dark'], bevel=0.02, ol=0, parent=root))
    wall_with_holes('wF', W, 'x', -D / 2 + T / 2, [(-2.2, 1.1, 1.0, 2.1), (0.0, 1.0, 0.0, 2.15), (2.2, 1.1, 1.0, 2.1)])
    wall_with_holes('wB', W, 'x', D / 2 - T / 2, [(-2.0, 1.1, 1.0, 2.1), (2.0, 1.1, 1.0, 2.1)])
    wall_with_holes('wL', D - 2 * T, 'y', -W / 2 + T / 2, [(0.0, 1.0, 1.0, 2.0)])
    wall_with_holes('wR', D - 2 * T, 'y', W / 2 - T / 2, [])
    # gable triangles (stone) on both ends, for stages with a pitched roof (returned separately)
    return parts


def _gable(mt, root, x, name):
    rise = (D / 2) * math.tan(math.radians(PITCH))
    verts = [(x - T / 2, -D / 2, WALL), (x - T / 2, D / 2, WALL), (x - T / 2, 0, WALL + rise),
             (x + T / 2, -D / 2, WALL), (x + T / 2, D / 2, WALL), (x + T / 2, 0, WALL + rise)]
    faces = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob.parent = root
    me.materials.append(mt['stone'])
    return ob


def _chimney(mt, root):
    rise = (D / 2) * math.tan(math.radians(PITCH))
    ch = cz.box('chimney', (0.9, 0.9, WALL + rise + 1.3), (W / 2 - 1.2, 1.1, (WALL + rise + 1.3) / 2), mt['stone'], bevel=0.04, ol=0, parent=root)
    cap = cz.box('chimney_cap', (1.05, 1.05, 0.12), (W / 2 - 1.2, 1.1, WALL + rise + 1.36), mt['stone'], bevel=0.02, ol=0, parent=root)
    return [ch, cap]


def build(stage='full', mt=None, loc=(0, 0, 0), seed=1):
    """Returns dict of parts. Stages are cumulative (see the header)."""
    mt = mt or mats()
    root = cz.empty('house', loc)
    P = dict(root=root, mats=mt)
    P['walls'] = _walls(mt, root)
    P['floor'] = cz.box('floor', (W - 2 * T, D - 2 * T, 0.1), (0, 0, 0.05), mt['floor'], bevel=0, ol=0, parent=root)
    order = ['walls', 'flat', 'gable', 'shingles', 'full']
    lvl = order.index(stage)
    if lvl == 1:
        boards = []
        n = 16; bw = (D + 2 * OVER) / n
        r = random.Random(seed)
        for i in range(n):
            y = -D / 2 - OVER + bw * (i + 0.5)
            boards.append(cz.box(f'board{i}', (W + 2 * OVER, bw - 0.025, 0.06), (0, y, WALL + 0.03 + r.uniform(-0.004, 0.004)),
                                 mt['wood'], rot=(0, 0, r.uniform(-0.3, 0.3)), bevel=0.008, ol=0, parent=root))
        P['boards'] = boards
        P['chimney'] = _chimney(mt, root)
    if lvl >= 2:
        P['gables'] = [_gable(mt, root, -W / 2 + T / 2, 'gableL'), _gable(mt, root, W / 2 - T / 2, 'gableR')]
        P['chimney'] = _chimney(mt, root)
        rise = (D / 2) * math.tan(math.radians(PITCH))
        slope_len = (D / 2 + OVER) / math.cos(math.radians(PITCH))
        rafters, deck = [], []
        nraf = 9
        for i in range(nraf):
            x = -W / 2 + 0.2 + i * (W - 0.4) / (nraf - 1)
            for s in (-1, 1):
                ang = math.radians(PITCH) * -s
                cy = s * (D / 2 + OVER) / 2 - s * OVER / 2 * 0
                ob = cz.box(f'rafter{i}{"ab"[s > 0]}', (0.08, slope_len, 0.18),
                            (x, s * (D / 2 + OVER) / 2 - s * 0.0, WALL + rise / 2 - (OVER * math.tan(math.radians(PITCH))) / 2 + 0.05),
                            mt['wood'], rot=(math.degrees(ang), 0, 0), bevel=0.01, ol=0, parent=root)
                rafters.append(ob)
        for s in (-1, 1):
            ang = math.radians(PITCH) * -s
            n = 14
            for i in range(n):
                k = (i + 0.5) / n
                y = s * (k * (D / 2 + OVER))
                z = WALL + rise - k * (D / 2 + OVER) * math.tan(math.radians(PITCH)) + 0.17
                deck.append(cz.box(f'deck{"ab"[s > 0]}{i}', (W + 2 * OVER, slope_len / n - 0.02, 0.03), (0, y, z),
                                   mt['wood'], rot=(math.degrees(ang), 0, 0), bevel=0.004, ol=0, parent=root))
        P['rafters'], P['deck'] = rafters, deck
        P['rise'], P['slope_len'] = rise, slope_len
    if lvl >= 3:
        rows = []
        rise = P['rise']
        for s in (-1, 1):
            ang = math.radians(PITCH) * -s
            n = 16
            for i in range(n):
                k = (i + 0.5) / n
                k = 1 - k                         # bottom row first
                y = s * (k * (D / 2 + OVER + 0.1))
                z = WALL + rise - k * (D / 2 + OVER + 0.1) * math.tan(math.radians(PITCH)) + 0.22
                row = []
                ns = 22
                for j in range(ns):
                    x = -W / 2 - OVER + (j + 0.5 + 0.5 * (i % 2)) * (W + 2 * OVER) / ns
                    if x > W / 2 + OVER: continue
                    row.append(cz.box(f'sh{"ab"[s > 0]}{i}_{j}', ((W + 2 * OVER) / ns - 0.015, P['slope_len'] / n * 1.6, 0.025),
                                      (x, y, z), mt['shingle'], rot=(math.degrees(ang) + s * 3, 0, 0), bevel=0.004, ol=0, parent=root))
                rows.append(M.join(f'shrow{"ab"[s > 0]}{i}', row))
        P['shingle_rows'] = rows
    if lvl >= 4:
        P['gutters'] = []
        for s in (-1, 1):
            y = s * (D / 2 + OVER + 0.05)
            g = cz.cyl(f'gutter{"ab"[s > 0]}', 0.08, W + 2 * OVER, (-(W + 2 * OVER) / 2, y, WALL - OVER * math.tan(math.radians(PITCH)) + 0.05),
                       mt['metal'], rot=(0, 90, 0), verts=24, ol=0, parent=root)
            P['gutters'].append(g)
        P['downpipe'] = cz.cyl('downpipe', 0.05, WALL, (W / 2 + OVER - 0.1, -D / 2 - OVER, 0), mt['metal'], verts=20, ol=0, parent=root)
        P['ties'] = [cz.box(f'tie{i}', (0.08, D, 0.14), (-W / 2 + 0.2 + i * (W - 0.4) / 8, 0, WALL + 0.2), mt['wood'], bevel=0.01, ol=0, parent=root) for i in range(9)]
        P['insulation'] = cz.box('insulation', (W - 2 * T, D - 2 * T, 0.25), (0, 0, WALL + 0.15), mt['insul'], bevel=0.05, ol=0, parent=root)
        P['flashing'] = cz.box('flashing', (1.02, 1.02, 0.3), (W / 2 - 1.2, 1.1, WALL + P['rise'] - 0.4), mt['metal'], bevel=0.01, ol=0, parent=root)
    return P


def hill(mt=None, size=200, seed=2):
    """The green hillside the house sits on (flat pad at the house) + far hills."""
    mt = mt or mats()
    f = M.range_fn(height=10, scale=40, seed=seed, ridged=False)
    def fn(X, Y):
        r = np.sqrt(X * X + Y * Y)
        Z = f(X, Y) - 4 + 0.03 * X
        return np.where(r < 9, 0.0, Z * np.clip((r - 9) / 25, 0, 1))
    return M.heightfield('hill', size, 220, fn, mat=mt['grass'], loc=(0, 0, 0))
