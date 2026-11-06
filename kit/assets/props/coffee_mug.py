# Coffee mug: a chunky warm-white ceramic mug with a ginger cat face printed on the front (-Y), two mustard bands, a
# round handle on +X, coffee inside (cartoon cheat on the solid body: inner-wall ring + coffee disc), optional steam:
# three soft curly wisps (bent glowing tubes, cz.limb) on the pivot <name>_steam; each wisp's bend points are the
# empties <name>_steam<i>_<a|b|c|d|e> (move them to make the steam drift). Table prop: root at the mug's bottom centre.
import math
from mathutils import Vector

META = {'size': (0.135, 0.1, 0.105), 'anchor': 'bottom centre (stands on a desk), motif toward -Y, handle +X',
        'animate': ['_steam', '_steam0_a..e', '_steam1_a..e', '_steam2_a..e'],
        'params': 'steam=False, coffee=True, color=#hex (body), band=#hex'}

STRIPS = 6
TEX = 'assets/props/tex/'
R, H = 0.046, 0.102


def _wrap(cz, name, prefix, n, r_at, zc, w, h, phi0, parent, tilt=0.0):
    """A printed graphic wrapped around a round wall: n narrow cards (one PNG slice each) 1.8 mm proud of it."""
    r = r_at(zc) + 0.0018
    dphi = w / n / r
    for i in range(n):
        phi = phi0 + (i + 0.5 - n / 2) * dphi
        m = cz.toon(f'{name}_m{i}', img=TEX + f'{prefix}{i}.png', lift=0.55, alpha_clip=True)
        cz.plane(f'{name}{i}', 2 * r * math.sin(dphi / 2) * 1.02, h, (r * math.sin(phi), -r * math.cos(phi), zc), m,
                 rot=(90 + tilt, 0, math.degrees(phi)), parent=parent)


def _segment(cz, nm, a, b, r, mat, parent, ol):
    """A capsule whose two ball centres sit on points a and b."""
    a, b = Vector(a), Vector(b); d = b - a
    o = cz.capsule(nm, r, d.length + 2 * r, tuple(a - d.normalized() * r), mat, ol=ol, parent=parent)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return o


def build(cz, name='coffee_mug', steam=False, coffee=True, color='#efe8da', band='#e0a63c'):
    root = cz.empty(name)
    body = cz.toon(name + '_body', color, tex='grain', tex_strength=0.03)
    bandm = cz.toon(name + '_band', band, tex='grain', tex_strength=0.03)
    cz.cyl(name + '_foot', R - 0.004, 0.008, (0, 0, 0), cz.toon(name + '_footm', '#c9bfac'), bevel=0.002, ol=0.0025, parent=root, verts=40)
    cz.cyl(name + '_body', R, H - 0.004, (0, 0, 0.004), body, bevel=0.004, ol=0.004, parent=root, verts=48)
    top = H
    # printed bands: thin rings 1.2 mm proud of the wall (no outline: they are print, not shape)
    for nm, z in (('_bandtop', top - 0.016), ('_bandlow', 0.016)):
        cz.cyl(name + nm, R + 0.0012, 0.006, (0, 0, z - 0.003), bandm, ol=0.0, parent=root, verts=48)
    _wrap(cz, name + '_motif', 'coffee_mug_motif', STRIPS, lambda z: R, 0.051, 0.056, 0.05, 0.0, root)
    # inside: the far inner wall in shade, coffee nudged toward the viewer (the near wall hides that side)
    cz.cyl(name + '_inwall', R - 0.0045, 0.002, (0, 0, top - 0.0012), cz.toon(name + '_inwallm', '#cdc4b2'), ol=0.0, parent=root, verts=40)
    if coffee:
        cz.cyl(name + '_coffee', R - 0.009, 0.002, (0, -0.0025, top - 0.0002), cz.toon(name + '_coffeem', '#5a3622', 0.7), ol=0.0, parent=root, verts=40)
        cz.cyl(name + '_crema', R - 0.016, 0.001, (0.004, -0.004, top + 0.0012), cz.toon(name + '_cremam', '#7a4c30', 0.7), ol=0.0, parent=root, verts=32)
    else:
        cz.cyl(name + '_empty', R - 0.009, 0.002, (0, -0.0025, top - 0.0002), cz.toon(name + '_emptym', '#b3a993'), ol=0.0, parent=root, verts=40)
    # round handle on +X: eight capsules on a half ellipse, the ends sunk into the wall
    hz, hr, hx, hh = 0.054, 0.0085, 0.028, 0.031
    angs = [10 + 160 * k / 8 for k in range(9)]
    pts = [(R - 0.006 + hx * math.sin(math.radians(a)), 0, hz + hh * math.cos(math.radians(a))) for a in angs]
    pts[0] = (R - 0.009, 0, pts[0][2]); pts[-1] = (R - 0.009, 0, pts[-1][2])
    for i in range(8):
        _segment(cz, f'{name}_handle{i}', pts[i], pts[i + 1], hr, body, root, 0.0035)

    if steam:   # three curly wisps floating just above the coffee: thin bent glowing tubes on empties, round ends
        sm = cz.glow(name + '_steamm', '#f4f6f2', 1.0)
        sp = cz.empty(name + '_steam', (0, 0, top + 0.018), parent=root)
        for i, (x0, z0, hgt, sway, r) in enumerate(((-0.017, 0.004, 0.075, 0.011, 0.0034), (0.002, 0.016, 0.095, -0.013, 0.0038), (0.019, 0.0, 0.065, 0.01, 0.003))):
            P = lambda x, z: (x0 + x, (i - 1) * -0.006, z0 + z)
            pts = [P(0, 0), P(sway, hgt * 0.25), P(0, hgt * 0.5), P(-sway, hgt * 0.75), P(0, hgt)]
            es = [cz.empty(f'{name}_steam{i}_{"abcde"[k]}', p, parent=sp, size=0.01) for k, p in enumerate(pts)]
            cz.limb(f'{name}_steam{i}_lo', es[0], es[1], es[2], r, sm, sp)
            cz.limb(f'{name}_steam{i}_hi', es[2], es[3], es[4], r * 0.7, sm, sp)
            # round ends + a ball on the joint, riding on their empties
            for k, rr in ((0, r), (2, r * 0.85), (4, r * 0.7)):
                cz.sphere(f'{name}_steam{i}_cap{k}', rr, (0, 0, 0), sm, ol=0, parent=es[k], segs=12, rings=8)
    return root
