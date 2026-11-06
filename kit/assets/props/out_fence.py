# Bamboo fence: a rustic run along a polyline - bamboo posts every ~0.5 m (a node ring near the top), two horizontal
# rails, and a diagonal lattice between them (crossed slats), lashed with cord at the joints; one post leaning.
# On uneven ground pass ground=f(x, y) -> z (world) and at=(x, y) (the root's world position).
# Floor prop: root at the first point; pts = [(x, y), ...] root-local.
import math, random

META = {'size': (3.0, 0.1, 0.9), 'anchor': 'first point of the run (z = ground)', 'animate': [],
        'params': "pts=[(0, 0), (3, 0)] (root-local), h=0.85, step=0.5, lattice=True, ground=None, at=(0, 0), night=False, seed=1"}


def _seg(cz, name, a, b, r, mat, parent, ol=0.003, verts=6):
    from mathutils import Vector
    a, b = Vector(a), Vector(b); d = b - a
    o = cz.cyl(name, r, d.length, tuple(a), mat, verts=verts, ol=ol, parent=parent)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return o


def build(cz, name='out_fence', pts=((0, 0), (3, 0)), h=0.85, step=0.5, lattice=True, ground=None, at=(0, 0), night=False, seed=1):
    rnd = random.Random(seed)
    root = cz.empty(name)
    bam = cz.toon('out_fence_bamboo' + ('n' if night else ''), '#b8a06a' if not night else '#8a8aa0', tex='grain', tex_scale=3.0, tex_strength=0.07)
    slat = cz.toon('out_fence_slat' + ('n' if night else ''), '#a08a58' if not night else '#7a7a92', tex='wood', tex_scale=4.0, tex_strength=0.06)
    cord = cz.toon('out_fence_cord', '#5a3a24')
    z0 = ground(at[0], at[1]) if ground else 0.0

    def gz(x, y): return (ground(at[0] + x, at[1] + y) - z0) if ground else 0.0
    # sample posts along the polyline
    posts = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0); n = max(1, int(round(L / step)))
        for k in range(n):
            t = k / n; posts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    posts.append(tuple(pts[-1]))
    lean_i = rnd.randrange(len(posts))
    tops = []
    for i, (x, y) in enumerate(posts):
        g = gz(x, y); hh = h * rnd.uniform(0.95, 1.08)
        lean = (rnd.uniform(-0.12, 0.12), rnd.uniform(-0.12, 0.12)) if i == lean_i else (rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02))
        top = (x + lean[0], y + lean[1], g + hh)
        _seg(cz, f'{name}_post{i}', (x, y, g - 0.05), top, 0.028, bam, root, ol=0.004, verts=8)
        cz.cyl(f'{name}_node{i}', 0.034, 0.025, (top[0], top[1], top[2] - 0.12), bam, verts=8, ol=0.0, parent=root)
        tops.append((x, y, g))
    for k, zr in enumerate((0.3, 0.68)):
        for i in range(len(tops) - 1):
            (xa, ya, ga), (xb, yb, gb) = tops[i], tops[i + 1]
            _seg(cz, f'{name}_rail{k}_{i}', (xa, ya, ga + zr * h), (xb, yb, gb + zr * h), 0.018, bam, root, ol=0.003)
            if k == 1:
                cz.sphere(f'{name}_tie{i}', 0.03, (xa, ya, ga + zr * h), cord, ol=0.0, parent=root, segs=8, rings=5)
    if lattice:
        for i in range(len(tops) - 1):
            (xa, ya, ga), (xb, yb, gb) = tops[i], tops[i + 1]
            for s in (0, 1):
                za, zb = (0.3 * h, 0.68 * h) if s == 0 else (0.68 * h, 0.3 * h)
                _seg(cz, f'{name}_lat{i}_{s}', (xa, ya, ga + za), (xb, yb, gb + zb), 0.01, slat, root, ol=0.002, verts=4)
    return root
