# BELL film: a packed 1800s leather valise (0.56 x 0.24 x 0.43 m incl. the handle): saddle-brown body + darker lid,
# brass corner caps, two brass clasps, two dark leather straps with brass buckles, a rolled leather handle on brass
# mounts (grip), a manila luggage tag "GOING WEST" on a string from the right mount, a shirt sleeve caught in the lid
# seam hanging down the front, and TWO stagecoach tickets "OVERLAND STAGE CO. - ONE WAY - 2 PASSENGERS" tucked under
# the left strap (PNGs by tex/make_gb_handprops.py). Root = bottom centre, front -Y.
import math, os, subprocess, bmesh
from mathutils import Vector

META = {'size': (0.58, 0.28, 0.44), 'anchor': 'bottom centre (stands on the floor), front -Y',
        'grip': (0.0, 0.0, 0.42), 'tickets': (-0.1, -0.115, 0.14),
        'animate': [], 'params': "tickets=True, sleeve=True, tag=True, leather='#6a3a1e', lid='#56301a'"}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
MAKER = os.path.join(TEX, 'make_gb_handprops.py')


def _png(cz, fn, what):
    """PNG from tex/make_gb_handprops.py (lab venv, no window); remade when missing or older than the maker."""
    out = os.path.join(TEX, fn)
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(MAKER): return out
    py = cz.py()
    try:
        subprocess.run([py, MAKER, what], timeout=90, check=True, capture_output=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except Exception as e: print('CZ gb png failed', fn, e)
    return out


def _tube(cz, name, pts, r, mat, parent=None, ol=0.003, sides=10, closed=False, r_end=None):
    """A round tube swept along pts (parallel-transport frames), capped unless closed."""
    bm = bmesh.new(); P = [Vector(p) for p in pts]; n = len(P); rings = []; prev = None
    for i, p in enumerate(P):
        t = (P[(i + 1) % n] - P[i - 1]) if closed else (P[min(i + 1, n - 1)] - P[max(i - 1, 0)])
        t.normalize()
        if prev is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            nr = (ref - t * ref.dot(t)).normalized()
        else: nr = (prev - t * prev.dot(t)).normalized()
        prev = nr; bn = t.cross(nr)
        rr = r if r_end is None else r + (r_end - r) * i / max(1, n - 1)
        rings.append([bm.verts.new(p + (nr * math.cos(2 * math.pi * k / sides) + bn * math.sin(2 * math.pi * k / sides)) * rr) for k in range(sides)])
    for i in range(n if closed else n - 1):
        a, b = rings[i], rings[(i + 1) % n]
        for k in range(sides): bm.faces.new((a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]))
    if not closed: bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def build(cz, name='gb_suitcase', tickets=True, sleeve=True, tag=True, leather='#6a3a1e', lid='#56301a'):
    root = cz.empty(name)
    lm = cz.toon(name + '_leather', leather, tex='grain', tex_scale=3.0, tex_strength=0.08)
    lidm = cz.toon(name + '_lidm', lid, tex='grain', tex_scale=3.0, tex_strength=0.08)
    strap = cz.toon(name + '_strapm', '#3a2214', tex='grain', tex_scale=4.0, tex_strength=0.08)
    brass = cz.toon(name + '_brass', '#94691f', tex='grain', tex_scale=5.0, tex_strength=0.07)
    W, D, Hb, Hl = 0.55, 0.22, 0.29, 0.075
    cz.box(name + '_body', (W, D, Hb), (0, 0, 0), lm, bevel=0.024, ol=0.007, parent=root, origin='bottom')
    cz.box(name + '_lid', (W + 0.01, D + 0.01, Hl), (0, 0, Hb + 0.003), lidm, bevel=0.024, ol=0.007, parent=root, origin='bottom')
    top = Hb + 0.003 + Hl
    # brass corner caps
    for sx in (-1, 1):
        for sy in (-1, 1):
            for k, z in enumerate((0.024, top - 0.026)):
                cz.box(f'{name}_corner{"LR"[sx > 0]}{"FB"[sy > 0]}{k}', (0.06, 0.06, 0.052), (sx * (W / 2 - 0.018), sy * (D / 2 - 0.016), z),
                       brass, bevel=0.012, ol=0.004, parent=root)
    # straps all the way round (a slab a little bigger than the case), buckles on the front
    for s in (-1, 1):
        x = s * 0.17
        cz.box(f'{name}_strap{"LR"[s > 0]}', (0.046, D + 0.024, top + 0.012), (x, 0, -0.004), strap, bevel=0.01, ol=0.005, parent=root, origin='bottom')
        bz = 0.2
        loop = [(x - 0.03, -D / 2 - 0.016, bz - 0.022), (x + 0.03, -D / 2 - 0.016, bz - 0.022), (x + 0.03, -D / 2 - 0.016, bz + 0.022),
                (x - 0.03, -D / 2 - 0.016, bz + 0.022)]
        pts = []
        for a, b in zip(loop, loop[1:] + loop[:1]):
            for t in (0.15, 0.5, 0.85): pts.append(tuple(a[i] + (b[i] - a[i]) * t for i in range(3)))
        _tube(cz, f'{name}_buckle{"LR"[s > 0]}', pts, 0.0045, brass, root, ol=0.002, sides=8, closed=True)
        cz.box(f'{name}_tongue{"LR"[s > 0]}', (0.006, 0.006, 0.04), (x, -D / 2 - 0.017, bz + 0.004), brass, bevel=0.002, ol=0.0015, parent=root)
        cz.box(f'{name}_keeper{"LR"[s > 0]}', (0.054, 0.012, 0.016), (x, -D / 2 - 0.014, bz - 0.045), strap, bevel=0.004, ol=0.003, parent=root)
    # clasps on the seam
    for s in (-1, 1):
        x = s * 0.075
        cz.box(f'{name}_claspA{"LR"[s > 0]}', (0.044, 0.008, 0.036), (x, -D / 2 - 0.002, Hb - 0.016), brass, bevel=0.003, ol=0.003, parent=root)
        cz.box(f'{name}_claspB{"LR"[s > 0]}', (0.032, 0.01, 0.034), (x, -D / 2 - 0.008, Hb + 0.016), brass, bevel=0.004, ol=0.003, parent=root)
        cz.sphere(f'{name}_claspbtn{"LR"[s > 0]}', 0.007, (x, -D / 2 - 0.012, Hb - 0.014), brass, ol=0.0015, parent=root, segs=12, rings=8)
    # brass studs along the bottom of the front
    for i in range(8):
        x = -0.24 + i * (0.48 / 7)
        if abs(abs(x) - 0.17) < 0.04: continue
        cz.sphere(f'{name}_stud{i}', 0.0055, (x, -D / 2 - 0.0005, 0.04), brass, ol=0.0, parent=root, segs=10, rings=6)
    # handle: rolled leather on two brass mounts
    for s in (-1, 1):
        cz.box(f'{name}_mount{"LR"[s > 0]}', (0.026, 0.034, 0.018), (s * 0.075, 0, top + 0.004), brass, bevel=0.005, ol=0.003, parent=root)
    pts = [(-0.072, 0, top + 0.012), (-0.07, 0, top + 0.03), (-0.055, 0, top + 0.046), (-0.025, 0, top + 0.053), (0, 0, top + 0.054),
           (0.025, 0, top + 0.053), (0.055, 0, top + 0.046), (0.07, 0, top + 0.03), (0.072, 0, top + 0.012)]
    _tube(cz, name + '_handle', pts, 0.0125, strap, root, ol=0.004, sides=12)
    # shirt sleeve caught in the lid seam, hanging down the front (with a cuff and two buttons)
    if sleeve:
        shirt = cz.toon(name + '_shirt', '#7f98b6', tex='paper', tex_strength=0.06)
        cuffm = cz.toon(name + '_cuffm', '#d9d2c1', tex='paper', tex_strength=0.05)
        sx, yc = 0.0, -D / 2 - 0.026
        pts = [(sx, -0.05, Hb + 0.0015), (sx, -0.1, Hb + 0.002), (sx + 0.004, -0.122, Hb - 0.008), (sx + 0.01, yc, Hb - 0.04),
               (sx + 0.02, yc, Hb - 0.075), (sx + 0.03, yc + 0.002, Hb - 0.105), (sx + 0.036, yc + 0.003, Hb - 0.125)]
        sl = _tube(cz, name + '_sleeve', pts, 0.026, shirt, root, ol=0.004, sides=16, r_end=0.03)
        for v in sl.data.vertices:
            c = v.co
            if c.y > -0.118: c.z = Hb + 0.0015 + (c.z - Hb - 0.0015) * 0.28          # pinched flat by the lid
            else:
                c.y = yc + (c.y - yc) * 0.55                                           # lies flat against the case
                c.x += 0.003 * math.sin(c.z * 160)                                     # soft fabric wobble
        sl.data.update()
        e0, e1 = (sx + 0.036, yc + 0.003, Hb - 0.122), (sx + 0.041, yc + 0.004, Hb - 0.158)
        cf = _tube(cz, name + '_cuff', [e0, e1], 0.031, cuffm, root, ol=0.004, sides=16)
        for v in cf.data.vertices: v.co.y = yc + 0.004 + (v.co.y - yc - 0.004) * 0.55
        cf.data.update()
        op = cz.cyl(name + '_cuffhole', 0.026, 0.004, (e1[0] + 0.0006, e1[1], e1[2] - 0.0015), cz.toon(name + '_holem', '#2a2220'),
                    rot=(0, 0, 0), verts=16, ol=0.0, parent=root, origin='center')
        for v in op.data.vertices: v.co.y *= 0.5
        op.data.update()
        for i, dz in enumerate((-0.132, -0.148)):
            cz.sphere(f'{name}_button{i}', 0.0045, (sx + 0.039 + 0.022, yc - 0.012, Hb + dz), cz.toon(name + '_btnm', '#efe9da'), ol=0.0012,
                      parent=root, segs=10, rings=6)
    # luggage tag on a string from the right mount, hanging in front of the lid
    if tag:
        tp = _png(cz, 'gb_suitcase_tag.png', 'tag')
        tw, th = 0.072, 0.12
        tx, tz = 0.118, top - 0.012 - th / 2
        tm = cz.toon(name + '_tagm_gb_suitcase_tag', img=tp, alpha_clip=True, lift=0.5)
        t = cz.plane(name + '_tag', tw, th, (tx, -D / 2 - 0.0215, tz), tm, rot=(90, 7, 0), parent=root)
        hole = (tx - 0.0006, -D / 2 - 0.022, tz + th / 2 - 0.0135)
        _tube(cz, name + '_string', [(0.082, 0.0, top + 0.012), (0.1, -0.06, top + 0.006), (0.112, -D / 2 - 0.012, top - 0.001),
                                    (hole[0], hole[1], hole[2] + 0.004)], 0.0016, cz.toon(name + '_stringm', '#b9a57e'), root, ol=0.0, sides=6)
    # two stagecoach tickets tucked under the left strap (the stubs under it, the print toward the middle)
    if tickets:
        x0 = -0.178
        for i, (fn, dx, dz, rot, dy) in enumerate((('gb_suitcase_ticket_b.png', 0.008, 0.024, 7, -0.0015), ('gb_suitcase_ticket_a.png', 0.0, 0.0, -4, -0.003))):
            p = _png(cz, fn, 'tickets')
            m = cz.toon(f'{name}_tkm_{os.path.splitext(fn)[0]}', img=p, lift=0.48)
            w, h = 0.15, 0.15 * 420 / 900
            # the plane's left edge (stub) under the strap: pivot at the left edge so a tilt keeps it there
            pv = cz.empty(f'{name}_ticket{i}', (x0 + dx, -D / 2 + dy, 0.13 + dz), parent=root)
            pv.rotation_euler = (0, math.radians(-rot), 0)
            cz.plane(f'{name}_ticket{i}_card', w, h, (w / 2, 0, 0), m, rot=(90, 0, 0), parent=pv)
    root['grip'] = META['grip']
    return root
