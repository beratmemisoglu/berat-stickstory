# Potted plant: a chunky terracotta pot on a saucer, a domed soil top with a plant tag, and a stylised rubber plant
# (three shoots of jointed tapering stems, big pointed oval leaves folded along the midrib on their own pivots, a pink
# sheath on the growing tips).
# droop=0 healthy .. 1 wilted for the abandoned room: the stems slump, the leaves hang and go olive / brown, the soil
# dries pale, and leaves have fallen on the soil and the floor.
# Animate: <name>_stem<A|B|C><i> rotation (sway / slump; chained, each joint's pivot at the joint),
# <name>_leaf<k> rotation_euler.y (leaf flop: more positive = the leaf hangs lower).
# Floor prop: root at the pot axis on the floor; size scales every length (outlines stay the same width).
import math, random
from mathutils import Euler, Vector

META = {'size': (0.64, 0.6, 0.96), 'anchor': 'floor centre (pot axis); pot 0.34 wide, 0.32 tall',
        'animate': ['_stemA0..3', '_stemB0..2', '_stemC0..2', '_leaf0..19'],
        'params': 'size=1.0 (uniform scale), droop=0..1 (wilted), pot=#hex, tag=True (plant tag in the soil)'}


def _rgb(h): h = h.lstrip('#'); return [int(h[i:i + 2], 16) for i in (0, 2, 4)]
def _hex(c): return '#%02x%02x%02x' % tuple(int(round(max(0, min(255, v)))) for v in c)
def mix(a, b, k): return _hex([x + (y - x) * k for x, y in zip(_rgb(a), _rgb(b))])


def _world(o):
    """World matrix from the parent chain's loc/rot/scale (valid before any depsgraph update; parents are set without
    an inverse by cz)."""
    m = o.matrix_basis.copy(); p = o.parent
    while p is not None: m = p.matrix_basis @ m; p = p.parent
    return m


def _shape_leaf(o, L, w, th, fold=0.25, arc=0.1):
    """Turn a sphere of radius L/2 (centred on its origin, long axis X) into a leaf: width w, half-thickness th, a
    pointed tip toward +X, the halves folded up along the midrib (reads as a midrib under cel light), the tip arcing
    down. Done on the mesh itself so the outline hull keeps one width all round."""
    h = L / 2
    for v in o.data.vertices:
        x, y, z = v.co
        t = x / h
        yy = y / h * (w / 2)
        if t > 0.05: yy *= 1 - 0.55 * ((t - 0.05) / 0.95) ** 1.5
        if t < -0.75: yy *= 0.6 + 0.4 * (1 + t) / 0.25        # narrower at the stalk end
        u = (t + 1) / 2
        v.co = (x, yy, z / h * th + abs(yy) * fold - arc * L * u * u)
    o.data.update()


def build(cz, name='potted_plant', size=1.0, droop=0.0, pot='#c9714b', tag=True):
    s = float(size); dr = cz.clamp(float(droop)); sd = cz.smooth(dr)
    rnd = random.Random(7)
    root = cz.empty(name)
    potm = cz.toon(name + '_pot', pot, tex='grain', tex_strength=0.05)
    rimm = cz.toon(name + '_rim', mix(pot, '#ffe2c4', 0.12), tex='grain', tex_strength=0.05)
    sauc = cz.toon(name + '_saucer', mix(pot, '#2a2622', 0.18), tex='grain', tex_strength=0.04)
    soil = cz.toon(name + '_soil', mix('#4a3426', '#8a6c4e', sd), tex='grain', tex_scale=4, tex_strength=0.12)
    stemm = cz.toon(name + '_stem', mix('#5f7d3c', '#7a6a3c', sd), tex='grain', tex_strength=0.04)

    # ---- pot: saucer, tapered body, a chunky rim band, soil mound filling it to the brim
    cz.cyl(name + '_saucer', 0.17 * s, 0.028 * s, (0, 0, 0), sauc, bevel=0.006 * s, ol=0.005, parent=root)
    cz.cyl(name + '_body', 0.13 * s, 0.26 * s, (0, 0, 0.022 * s), potm, r2=0.158 * s, bevel=0.004 * s, ol=0.007, parent=root)
    cz.cyl(name + '_rimband', 0.172 * s, 0.06 * s, (0, 0, 0.25 * s), rimm, bevel=0.012 * s, ol=0.007, parent=root)
    top = 0.31 * s
    cz.cyl(name + '_soil', 0.148 * s, 0.022 * s, (0, 0, top - 0.012 * s), soil, r2=0.118 * s, bevel=0.006 * s, ol=0.004, parent=root)
    soil_top = top + 0.01 * s
    pebm = cz.toon(name + '_pebble', '#d8d1c2', tex='grain', tex_strength=0.06)
    for i, (px, py, pr) in enumerate(((0.075, -0.085, 0.014), (0.1, -0.045, 0.011), (-0.105, -0.055, 0.012), (-0.03, -0.12, 0.01))):
        cz.sphere(f'{name}_pebble{i}', pr * s, (px * s, py * s, top + 0.003 * s), pebm, ol=0.002, parent=root, segs=12, rings=8)
    if tag:   # white plastic plant tag stuck in the soil, a green leaf print on it
        tg = cz.box(name + '_tag', (0.034 * s, 0.004 * s, 0.085 * s), (0.085 * s, -0.1 * s, soil_top - 0.03 * s),
                    cz.toon(name + '_tagm', '#f2efe6', tex='grain', tex_strength=0.03), rot=(-12, 8, -20), bevel=0.0015 * s, ol=0.003, parent=root, origin='bottom')
        cz.box(name + '_tagleaf', (0.016 * s, 0.002 * s, 0.022 * s), (0, -0.0028 * s, 0.058 * s), cz.toon(name + '_tagleafm', '#4fa055'), rot=(0, 30, 0), bevel=0.003 * s, ol=0.0, parent=tg)

    # ---- the plant
    greens = ['#3f8a4a', '#4c9a52', '#367f45']
    olive, brown = '#a39a46', '#946a3a'
    leaves = []

    def shoot(tag_, base, lens, r, tilts, slump, n, Lb, Lt, yaw0, sheath):
        """Jointed tapering stem: pivots <name>_stem<tag><i> chained end to end (each at its joint), n leaves."""
        cur, pvs, rr = None, [], r
        for i, L in enumerate(lens):
            loc = base if i == 0 else (0, 0, lens[i - 1])
            cur = cz.empty(f'{name}_stem{tag_}{i}', loc, parent=root if i == 0 else cur)
            tx, ty = tilts[i]
            k = sd * (0.6 + 0.9 * i)          # wilted: every joint bends further, the stem arcs over
            cur.rotation_euler = (math.radians(tx + slump[0] * k), math.radians(ty + slump[1] * k), 0)
            r2 = rr * 0.82
            cz.cyl(f'{name}_stem{tag_}{i}_c', rr, L, (0, 0, 0), stemm, r2=r2, verts=14, ol=0.003, parent=cur)
            if i < len(lens) - 1:
                cz.sphere(f'{name}_stem{tag_}{i}_j', r2, (0, 0, L), stemm, ol=0.0, parent=cur, segs=14, rings=8)
            pvs.append(cur); rr = r2
        total = sum(lens); yaw = yaw0
        for j in range(n):
            f = j / max(1, n - 1)
            hgt = total * (0.16 + 0.8 * f)
            seg, acc = 0, 0.0
            while seg < len(lens) - 1 and hgt > acc + lens[seg]: acc += lens[seg]; seg += 1
            leaves.append((pvs[seg], hgt - acc, cz.lerp(Lb, Lt, f), cz.lerp(10, 56, f ** 1.1), yaw))
            yaw += 137.5
        if sheath:   # growing tip: a pink sheath (browned when wilted)
            cz.cyl(f'{name}_sheath{tag_}', rr * 0.95, 0.075 * s * (1 - 0.6 * sd), (0, 0, lens[-1]), cz.toon(name + '_sheathm', mix('#d0605a', brown, sd)),
                   r2=0.0025 * s, verts=12, ol=0.003, parent=pvs[-1])
        return pvs

    shoot('A', (0.015 * s, 0.0, soil_top - 0.01 * s), [0.15 * s, 0.14 * s, 0.12 * s, 0.11 * s], 0.019 * s,
          [(2, 3), (-2, -2), (-1, 0), (2, 3)], (6, 15), 10, 0.3 * s, 0.16 * s, 15, True)
    shoot('B', (-0.06 * s, 0.035 * s, soil_top - 0.01 * s), [0.11 * s, 0.1 * s, 0.08 * s], 0.015 * s,
          [(-6, -13), (2, -3), (2, -3)], (-8, -22), 6, 0.27 * s, 0.16 * s, 80, True)
    shoot('C', (0.055 * s, 0.055 * s, soil_top - 0.01 * s), [0.08 * s, 0.07 * s, 0.06 * s], 0.013 * s,
          [(-12, 10), (-3, 4), (-2, 2)], (-9, 14), 4, 0.25 * s, 0.16 * s, 200, False)
    rim_r, rim_z = 0.19 * s, top + 0.03 * s
    for k, (seg, h, L, el, yaw) in enumerate(leaves):
        L *= 1 - 0.12 * sd; w = L * 0.56 * (1 - 0.25 * sd)
        roll = rnd.uniform(-30, 30) + 25 * sd * (1 if k % 2 else -1)
        yaw += rnd.uniform(-10, 10)
        # leaf angles are set in WORLD space (a slumped stem must not drag its leaves along): wilted leaves hang by
        # gravity, but never lower than clears the pot rim / soil / floor
        Mw = _world(seg); P = Mw @ Vector((0, 0, h)); Rinv = Mw.to_3x3().normalized().inverted()
        u = Vector((math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0))
        e_t = cz.lerp(el, -62 - 16 * rnd.random(), sd); e = e_t
        while e < el:
            d = u * math.cos(math.radians(e)) + Vector((0, 0, math.sin(math.radians(e))))
            hit = False
            for j in range(1, 11):
                t = L * j / 10; q = P + d * t; q.z -= (0.10 + 0.12 * sd) * L * (j / 10) ** 2
                rad = q.xy.length
                if q.z < 0.03 * s or (rad < rim_r and q.z < rim_z): hit = True; break
            if not hit: break
            e += 4
        pv = cz.empty(f'{name}_leaf{k}', (0, 0, h), parent=seg)
        pv.rotation_euler = (Rinv @ Euler((math.radians(roll), math.radians(-e), math.radians(yaw))).to_matrix()).to_euler()
        c = mix(greens[k % 3], olive, sd * (0.7 + 0.3 * rnd.random()))
        if dr > 0.3 and k in (0, 8, 13, 3): c = mix(c, brown, min(1, (dr - 0.3) * 1.6))
        m = cz.toon(f'{name}_leaf_{c[1:]}', c, tex='grain', tex_strength=0.05)
        lf = cz.sphere(f'{name}_leaf{k}_m', L / 2, (0.012 * s + L / 2 * 0.95, 0, 0), m, ol=0.0045, parent=pv, segs=28, rings=14)
        _shape_leaf(lf, L, w, 0.007 * s, fold=0.25, arc=0.10 + 0.12 * sd)

    # ---- fallen leaves (wilted only): on the soil, on the floor by the saucer
    if dr >= 0.35:
        fall = [(-0.04, -0.07, soil_top + 0.006 * s, 0.17, 110), (0.28, -0.12, 0.0072 * s, 0.21, 30), (-0.27, -0.2, 0.0072 * s, 0.19, -25)]
        for i, (fx, fy, fz, L, yw) in enumerate(fall[:1 if dr < 0.7 else 3]):
            c = mix(olive, brown, 0.6 + 0.2 * i)
            m = cz.toon(f'{name}_leaf_{c[1:]}', c, tex='grain', tex_strength=0.05)
            lf = cz.sphere(f'{name}_fallen{i}', L * s / 2, (fx * s, fy * s, fz), m, ol=0.0045, parent=root, segs=28, rings=14)
            lf.rotation_euler = (0, math.radians(0 if i else 6), math.radians(yw))
            _shape_leaf(lf, L * s, L * s * 0.42, 0.007 * s, fold=0.12, arc=-0.03)
    return root
