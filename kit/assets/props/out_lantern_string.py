# Lantern string: a sagging cord between two points with small round paper lanterns hanging from it (gold caps, a tassel),
# alternating colours. lit=True: the lanterns glow (bright warm dots, like festival lights) and, with lights=k > 0, every
# k-th lantern gets a small warm point light (light shapes on what is under the string).
# Not a floor prop: root at the string's start point a; b is the end point relative to the root (metres); the cord sags
# by `sag` at the middle.
import math

META = {'size': (3.0, 0.3, 0.8), 'anchor': 'start point a of the string (b given relative to it)',
        'animate': ['_lan<i> (rotation: sway, pivot at the cord)'],
        'params': "b=(3.0, 0.0, 0.0) (end, root-local), sag=0.35, n=6 (lanterns), colours=('#c8291b', '#e8a830'), lit=False, "
                  "lights=0 (every k-th lantern gets a point light), power=12, r=0.085 (lantern radius)"}


def build(cz, name='out_lantern_string', b=(3.0, 0.0, 0.0), sag=0.35, n=6, colours=('#c8291b', '#e8a830'), lit=False, lights=0, power=12.0,
          r=0.085):
    from mathutils import Vector
    root = cz.empty(name)
    cord = cz.toon('out_lantern_string_cord', '#3a2a20')
    gold = cz.toon('out_lantern_string_gold', '#d0a23a')
    B = Vector(b)

    def P(t): return B * t + Vector((0, 0, -4 * sag * t * (1 - t)))
    N = 24
    pts = [P(i / N) for i in range(N + 1)]
    for i in range(N):   # the cord as short segments (thin cylinders between samples)
        a, c = pts[i], pts[i + 1]; d = c - a
        o = cz.cyl(f'{name}_cord{i}', 0.006, d.length, tuple(a), cord, verts=6, ol=0.0, parent=root)
        o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    for i in range(n):
        t = (i + 0.5) / n
        p = P(t)
        pv = cz.empty(f'{name}_lan{i}', tuple(p), parent=root)
        col = colours[i % len(colours)]
        m = cz.glow(f'out_lantern_string_lit{col}', _mix(col, '#ffd090', 0.3), 1.5) if lit else cz.toon(f'out_lantern_string_paper{col}', col, tex='grain', tex_strength=0.04)
        cz.cyl(f'{name}_lan{i}_hang', 0.004, 0.06, (0, 0, -0.06), cord, verts=5, ol=0.0, parent=pv)
        body = cz.sphere(f'{name}_lan{i}_body', 1.0, (0, 0, -0.06 - r * 1.05), m, ol=0.004, parent=pv, segs=16, rings=10)
        for v in body.data.vertices: v.co = (v.co.x * r, v.co.y * r, v.co.z * r * 1.15)
        body.data.update()
        for k, z in enumerate((-0.06 - r * 0.02, -0.06 - r * 2.1)):
            cz.cyl(f'{name}_lan{i}_cap{k}', r * 0.45, r * 0.22, (0, 0, z - r * 0.11), gold, verts=10, ol=0.002, parent=pv)
        cz.cyl(f'{name}_lan{i}_tassel', r * 0.12, r * 0.9, (0, 0, -0.06 - r * 3.1), cz.toon(f'out_lantern_string_tassel{col}', col), verts=6, ol=0.0, parent=pv)
        body.visible_shadow = False
        if lit and lights and i % lights == 0:
            L = cz.light(f'{name}_light{i}', 'POINT', tuple(p + Vector((0, 0, -0.06 - r * 1.05))), color='#ffb060', power=power, size=0.05, shadow=False)
            L.parent = root
    return root


def _mix(a, b, k):
    a, b = a.lstrip('#'), b.lstrip('#')
    ca = [int(a[i:i + 2], 16) for i in (0, 2, 4)]; cb = [int(b[i:i + 2], 16) for i in (0, 2, 4)]
    return '#' + ''.join(f'{int(round(x + (y - x) * k)):02x}' for x, y in zip(ca, cb))
