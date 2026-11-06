# Grave mound (BELL film): long axis along Y, the headstone / bell post stands at its +Y end (head end).
#   fresh=False: an old, settled grassy mound (smooth, low 0.15 m) with spiky grass tufts in two greens and a few stones.
#   fresh=True: a FRESH dark brown-violet dirt mound (0.22 m, faceted, lumpy), clods on it and spilled around it, the
#   -X long side cut steep and straight by a shovel (a flat spade facet on top too), and a wilted flower bunch tied with a
#   ribbon lying near the head end.
# length=1.8, width=0.8, seed. Floor prop: root = floor centre of the mound, front -Y (the foot end).
import math, os, random, subprocess

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')


def _tex(cz, n):
    p = os.path.join(TEX, n)
    if not os.path.exists(p):
        py = cz.py()
        try:
            subprocess.run([py, os.path.join(TEX, 'make_gb_grave.py'), 'static'], timeout=120, check=True, capture_output=True,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except Exception as e:
            print('CZ gb_grave_mound: png failed', e)
    return p if os.path.exists(p) else None


META = {'size': (0.8, 1.8, 0.22), 'anchor': 'floor centre; long axis along Y, head end +Y (headstone / bell post go at y = +length/2 + 0.1)',
        'animate': [],
        'params': "fresh=False|True, length=1.8, width=0.8, seed=0. height(x, y) of the top surface: module function surface(x, y, fresh, length, width)."}


def _shape(fresh, length, width):
    a, b = width / 2, length / 2
    n = 3.4 if fresh else 2.5
    H = 0.22 if fresh else 0.15
    return a, b, n, H


def _prof(rho, fresh, x_side):
    """Height factor 0..1 at normalised radius rho (0 centre, 1 edge)."""
    rho = min(1.0, max(0.0, rho))
    if not fresh: return (1 - rho ** 2.2) ** 0.85
    if x_side < 0: return (1 - rho ** 9) ** 0.4           # the shovel-cut long side: steep, straight
    return (1 - rho ** 2.6) ** 0.7                        # the heaped side: a rounded pile


def _bumps(x, y, seed, fresh):
    r = random.Random(seed)
    s = 0.0
    for k in range(9):
        lo = k < 4
        fx, fy, p = r.uniform(4, 8) if lo else r.uniform(12, 24), r.uniform(4, 8) if lo else r.uniform(12, 24), r.uniform(0, 6.3)
        s += math.sin(x * fx + p) * math.sin(y * fy + 1.7 * p) * (1.0 if lo else 0.45)
    return s * (0.016 if fresh else 0.006)


def _edge(x, y, seed):
    """Irregular footprint: the radius wobbles with the angle."""
    t = math.atan2(y, x); r = random.Random(seed + 3)
    return 1 + sum(r.uniform(0.02, 0.05) * math.sin(k * t + r.uniform(0, 6.3)) for k in (3, 5, 8))


def surface(x, y, fresh=False, length=1.8, width=0.8, seed=0):
    a, b, n, H = _shape(fresh, length, width)
    rho = ((abs(x) / a) ** n + (abs(y) / b) ** n) ** (1 / n) / _edge(x, y, seed)
    if rho >= 1: return 0.0
    h = H * _prof(rho, fresh, x) + _bumps(x, y, seed, fresh) * (1 - rho ** 4)
    return max(0.0, h)


def _clod(cz, name, loc, size, mat, parent, rnd, ol=0.004):
    sx, sy, sz = size
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=8, rings=5)
    a = rnd.uniform(0, 6.3)
    for v in o.data.vertices:
        x, y, z = v.co; k = 0.75 + 0.4 * rnd.random()
        x, y, z = x * k * sx, y * k * sy, max(z * k * sz, -0.015)
        v.co = (x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a), z)
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    return o


def _tuft(cz, name, loc, h, r, mat, parent, rnd, k=5):
    o = cz.sphere(name, 1.0, loc, mat, ol=0.004, parent=parent, segs=k * 6, rings=8)
    ph = rnd.uniform(0, 6.28); hs = [rnd.uniform(0.7, 1.0) for _ in range(k)]
    for v in o.data.vertices:
        x, y, z = v.co
        phi = math.acos(max(-1.0, min(1.0, z))); th = math.atan2(y, x)
        u = 1 - phi / math.pi
        a = (k * th + ph) / (2 * math.pi)
        blade = int(math.floor(a + 0.5)) % k
        s = (0.5 + 0.5 * math.cos(k * th + ph)) ** 2.5
        Hh = h * (0.28 + 0.72 * s * hs[blade])
        if phi < 1e-4: v.co = (0, 0, h * 0.3); continue
        if phi > math.pi - 1e-4: v.co = (0, 0, 0); continue
        rad = r * (0.4 + u * (0.15 + 0.7 * s))
        v.co = (math.cos(th) * rad, math.sin(th) * rad, Hh * u ** 0.9)
    o.data.update()
    return o


def _flowers(cz, name, root, loc, yaw, rnd):
    """A wilted bunch lying on its side: stems along local +X, heads drooping at the +X end, a ribbon bow at the tie."""
    g = cz.empty(name + '_flowers', loc, parent=root)
    g.rotation_euler = (0, 0, math.radians(yaw))
    stem = cz.toon(name + '_stem', '#3d5a2a', tex='grain', tex_strength=0.08)
    petals = [cz.toon(name + '_petal0', '#7a4660', tex='grain', tex_strength=0.1), cz.toon(name + '_petal1', '#a8997a', tex='grain', tex_strength=0.08),
              cz.toon(name + '_petal2', '#8a5040', tex='grain', tex_strength=0.1)]
    eye = cz.toon(name + '_eye', '#3a2a1a')
    ribbon = cz.toon(name + '_ribbon', '#7a1c2c', tex='grain', tex_strength=0.06)
    for i in range(5):
        dy = (i - 2) * 0.022 + rnd.uniform(-0.006, 0.006); L = rnd.uniform(0.26, 0.34); ang = (i - 2) * 6 + rnd.uniform(-4, 4)
        cz.cyl(f'{name}_stem{i}', 0.0045, L, (-0.06, dy, 0.012), stem, rot=(0, 90, ang), verts=8, ol=0.0025, parent=g)
        ex = -0.06 + L * math.cos(math.radians(ang)); ey = dy + L * math.sin(math.radians(ang))
        # wilted head: a flattened petal cup hanging down past the stem end + a dark eye
        hd = cz.sphere(f'{name}_head{i}', 1.0, (ex + 0.015, ey, 0.03), petals[i % 3], ol=0.003, parent=g, segs=14, rings=8)
        tw = rnd.uniform(-0.5, 0.5)
        for v in hd.data.vertices:
            x, y, z = v.co
            r = 0.034 * (1 + 0.25 * math.cos(5 * math.atan2(y, z) + tw))
            x, y, z = x * 0.018, y * r, z * r
            v.co = (x * math.cos(1.1) + z * math.sin(1.1) * 0.5, y, -x * math.sin(1.1) + z * 0.75)
        hd.data.update()
        cz.sphere(f'{name}_eye{i}', 0.009, (ex + 0.03, ey, 0.024), eye, ol=0, parent=g, segs=8, rings=5)
        # a drooping leaf
        lf = cz.sphere(f'{name}_leaf{i}', 1.0, (-0.06 + L * 0.45, dy + 0.012 * (1 if i % 2 else -1), 0.008), stem, ol=0.002, parent=g, segs=8, rings=5)
        for v in lf.data.vertices:
            x, y, z = v.co; v.co = (x * 0.04, y * 0.014 + (0.01 if i % 2 else -0.01) * (x + 1) ** 2, z * 0.004 - 0.004 * x * x)
        lf.data.update()
    # ribbon: a band round the stems, two loops, two tails
    cz.cyl(name + '_band', 0.03, 0.03, (0.02, 0, 0.012), ribbon, rot=(0, 90, 0), verts=14, ol=0.003, parent=g)
    for s in (-1, 1):
        lp = cz.sphere(f'{name}_loop{s}', 1.0, (0.035, s * 0.04, 0.03), ribbon, ol=0.003, parent=g, segs=12, rings=8)
        for v in lp.data.vertices:
            x, y, z = v.co; v.co = (x * 0.016, y * 0.035, z * 0.022)
        lp.data.update()
        cz.box(f'{name}_tail{s}', (0.11, 0.022, 0.004), (-0.02, s * 0.05, 0.004), ribbon, rot=(0, 0, s * 22), bevel=0.001, ol=0.0025, parent=g)
    return g


def build(cz, name='gb_grave_mound', fresh=False, length=1.8, width=0.8, seed=0):
    root = cz.empty(name)
    rnd = random.Random(seed + (100 if fresh else 0))
    a, b, n, H = _shape(fresh, length, width)
    dp, gp = _tex(cz, 'gb_grave_mound_dirt.png'), _tex(cz, 'gb_grave_mound_grass.png')
    if fresh:
        mat = cz.toon(name + '_dirt', '#47302f', img=dp, proj='box', proj_scale=2.6, tex='grain', tex_strength=0.1) if dp else \
            cz.toon(name + '_dirt', '#47302f', tex='grain', tex_strength=0.24, tex_scale=2.5)
        clodm = [cz.toon(name + '_clod0', '#5c3f3c', tex='grain', tex_strength=0.12), cz.toon(name + '_clod1', '#36242a', tex='grain', tex_strength=0.12)]
    else:
        mat = cz.toon(name + '_grass', '#35512a', img=gp, proj='box', proj_scale=2.2, tex='grain', tex_strength=0.12) if gp else \
            cz.toon(name + '_grass', '#35512a', tex='grain', tex_strength=0.24, tex_scale=2.5)
        tuftm = [cz.toon(name + '_tuft0', '#2e4a22', tex='grain', tex_strength=0.1), cz.toon(name + '_tuft1', '#44652c', tex='grain', tex_strength=0.1)]
        stonem = cz.toon(name + '_stone', '#5c5d72', tex='grain', tex_strength=0.1)

    o = cz.sphere(name + '_body', 1.0, (0, 0, 0), mat, ol=0.008, parent=root, segs=64, rings=32)
    for v in o.data.vertices:
        x, y, z = v.co
        phi = math.acos(max(-1.0, min(1.0, z))); th = math.atan2(y, x)
        c, s = math.cos(th), math.sin(th)
        ex = math.copysign(abs(c) ** (2 / n), c) * a; ey = math.copysign(abs(s) ** (2 / n), s) * b
        eg = _edge(ex, ey, seed); ex, ey = ex * eg, ey * eg
        if phi <= math.pi / 2 + 1e-6:
            rho = phi / (math.pi / 2)
            px, py = ex * rho, ey * rho
            v.co = (px, py, surface(px, py, fresh, length, width, seed) if rho < 0.999 else 0.0)
        else:
            rho = (math.pi - phi) / (math.pi / 2)
            v.co = (ex * rho, ey * rho, -0.03)
    if fresh: o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons))
    o.data.update()

    if fresh:
        for i in range(34):     # clods on the mound
            x, y = rnd.uniform(-a * 0.85, a * 0.85), rnd.uniform(-b * 0.9, b * 0.9)
            z = surface(x, y, True, length, width, seed)
            if z <= 0.01: continue
            sz = rnd.uniform(0.025, 0.055)
            _clod(cz, f'{name}_clod{i}', (x, y, z - sz * 0.25), (sz, sz * rnd.uniform(0.7, 1.0), sz * 0.6), clodm[i % 2], root, rnd)
        for i in range(22):     # spilled around the foot (more on the +X side, where it was shovelled from)
            t = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(1.02, 1.25)
            c, s = math.cos(t), math.sin(t)
            x, y = math.copysign(abs(c) ** (2 / n), c) * a * r, math.copysign(abs(s) ** (2 / n), s) * b * r
            if x < -a * 0.9 and rnd.random() < 0.7: x = -x
            sz = rnd.uniform(0.02, 0.045)
            _clod(cz, f'{name}_spill{i}', (x, y, 0.0), (sz, sz, sz * 0.6), clodm[i % 2], root, rnd)
        fy = b - 0.42
        _flowers(cz, name, root, (0.08, fy, surface(0.08, fy, True, length, width, seed) - 0.004), 70 + rnd.uniform(-10, 10), rnd)
    else:
        for i in range(64):
            x, y = rnd.uniform(-a * 1.05, a * 1.05), rnd.uniform(-b * 1.02, b * 1.02)
            z = surface(x, y, False, length, width, seed)
            big = i % 4 == 0
            _tuft(cz, f'{name}_tuft{i}', (x, y, z - 0.004), rnd.uniform(0.06, 0.11) if big else rnd.uniform(0.03, 0.06),
                  rnd.uniform(0.035, 0.05) if big else rnd.uniform(0.02, 0.035), tuftm[i % 2], root, rnd, k=rnd.choice((4, 5, 6)))
        for i in range(4):
            x, y = rnd.uniform(-a * 0.8, a * 0.8), rnd.uniform(-b * 0.85, b * 0.85)
            z = surface(x, y, False, length, width, seed); sz = rnd.uniform(0.03, 0.05)
            _clod(cz, f'{name}_stone{i}', (x, y, z - sz * 0.2), (sz, sz * 0.8, sz * 0.55), stonem, root, rnd, ol=0.005)
    return root
