# Theatre velvet for the law stage, three kinds:
#   'drape'    a tied-back stage drape: hangs from its top rail, swoops in to a gold rope tie-back (side = the side it is
#              pulled to), flares out again below; deep folds where it is gathered, a gold cord down the leading edge,
#              a gold tassel on the tie-back
#   'straight' a plain pleated curtain wall (masking legs): even folds with a little variation, a gold cord along the hem
#   'valance'  a swagged border: scalloped swags with curved folds and a forward belly, gold fringe along the bottom,
#              gold tassels at the swag joins
# The fabric is a real folded sheet (rows of vertices) with thickness, so the hull outline draws the fold silhouettes.
# Root = the top centre of the rail; everything hangs toward -Z; the back of the folds is at y = 0, folds come to -Y.
import math, bmesh
from mathutils import Vector

META = {'size': (2.0, 0.3, 5.0), 'anchor': 'top centre of the rail (hangs toward -Z), back of the folds at y = 0', 'animate': [],
        'params': "kind='drape'|'straight'|'valance', width=2.0, height=5.0, folds=7, depth=0.12, side='L'|'R' (drape: the side "
                  "it is tied to), tie=0.4 (drape: tie-back height as a fraction of the height from the bottom), swags=3, "
                  "color='#8a1824', gold='#d2a23e', seed=1"}


def _sheet(cz, name, rows, mat, parent, flip, thick=0.02, ol=0.008):
    bm = bmesh.new()
    V = [[bm.verts.new(p) for p in row] for row in rows]
    for j in range(len(V) - 1):
        for i in range(len(V[0]) - 1):
            q = (V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i])
            bm.faces.new(q[::-1] if flip else q)
    o = cz.place(cz._mesh_obj(name, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, 0, 0)
    # even offset spikes where the gathered folds are steep (a 4 m spike out of the tie-back): plain offset
    s = o.modifiers.new('fabric', 'SOLIDIFY'); s.thickness = thick; s.offset = 1.0; s.use_even_offset = False
    cz.outline(o, ol)
    return o


def tube(cz, name, pts, r, mat, parent, segs=8, closed=False, ol=0.003):
    """A round cord swept along a polyline."""
    P = [Vector(p) for p in pts]; n = len(P)
    bm = bmesh.new(); rings = []
    for k in range(n):
        if closed: t = (P[(k + 1) % n] - P[k - 1])
        else: t = (P[min(n - 1, k + 1)] - P[max(0, k - 1)])
        t = t.normalized() if t.length > 1e-9 else Vector((0, 0, 1))
        a = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        u = t.cross(a).normalized(); v = t.cross(u).normalized()
        rings.append([bm.verts.new(P[k] + r * (math.cos(2 * math.pi * s / segs) * u + math.sin(2 * math.pi * s / segs) * v)) for s in range(segs)])
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    for ra, rb in pairs:
        for s in range(segs):
            bm.faces.new((ra[s], ra[(s + 1) % segs], rb[(s + 1) % segs], rb[s]))
    if not closed:
        bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat), (0, 0, 0), (0, 0, 0), None, parent, ol, 0)


def tassel(cz, name, p, s, mat, parent):
    x, y, z = p
    cz.sphere(name + '_knob', 0.045 * s, (x, y, z), mat, ol=0.003, parent=parent, segs=16, rings=8)
    cz.cyl(name + '_skirt', 0.065 * s, 0.17 * s, (x, y, z - 0.22 * s), mat, verts=16, r2=0.02 * s, ol=0.003, parent=parent)
    cz.cyl(name + '_neck', 0.03 * s, 0.035 * s, (x, y, z - 0.05 * s), mat, verts=16, ol=0.0025, parent=parent)


def build(cz, name='stage_curtain', kind='drape', width=2.0, height=5.0, folds=7, depth=0.12, side='L', tie=0.4, swags=3,
          color='#8a1824', gold='#d2a23e', seed=1):
    root = cz.empty(name)
    vel = cz.toon('stage_velvet_' + color.lstrip('#'), color, tex='grain', tex_scale=3.0, tex_strength=0.07)
    gm = cz.toon('stage_gold', gold, tex='grain', tex_scale=3.0, tex_strength=0.04)
    W, H = width, height
    if kind in ('drape', 'straight'):
        nu = max(24, folds * 10); nz = 36
        rows = []
        st = 1 - tie
        Wt, Wb = 0.2 * W, 0.46 * W
        for j in range(nz + 1):
            s = j / nz
            if kind == 'straight': w = W
            elif s <= st: w = W + (Wt - W) * (s / st) ** 1.6
            else: k = (s - st) / (1 - st); w = Wt + (Wb - Wt) * (1 - (1 - k) ** 2)
            g = min(1.9, (W / w) ** 0.5)
            row = []
            for i in range(nu + 1):
                u = i / nu
                x = (-W / 2 + u * w) if side == 'L' else (W / 2 - u * w)
                var = 1 + 0.3 * math.sin(2 * math.pi * u * 1.3 + 0.7 * seed) + 0.12 * math.sin(2 * math.pi * folds * u * 0.5 + seed)
                y = -depth * g * var * (0.5 - 0.5 * math.cos(2 * math.pi * folds * u))
                z = -H * s
                if kind == 'drape' and s > st:      # the lower part kicks forward a little out of the tie-back
                    y -= 0.06 * math.sin(math.pi * (s - st) / (1 - st)) * u
                row.append((x, y, z))
            rows.append(row)
        _sheet(cz, name + '_cloth', rows, vel, root, flip=(side == 'L'), thick=0.025, ol=0.009)
        # gold cord down the leading edge (drape) / along the hem (straight)
        if kind == 'drape':
            edge = [(r[-1][0], r[-1][1] - 0.03, r[-1][2]) for r in rows]
            tube(cz, name + '_cord', edge, 0.02, gm, root, ol=0.003)
            jt = int(round(st * nz)); zt = -H * st
            xs = [p[0] for p in rows[jt]]; ys = [p[1] for p in rows[jt]]
            cx = (min(xs) + max(xs)) / 2; cy = min(ys) / 2 - 0.02
            ax = (max(xs) - min(xs)) / 2 + 0.05; ay = -min(ys) / 2 + 0.07
            ring = [(cx + ax * math.cos(2 * math.pi * k / 28), cy + ay * math.sin(2 * math.pi * k / 28), zt + 0.03 * math.sin(4 * math.pi * k / 28))
                    for k in range(28)]
            tube(cz, name + '_tieback', ring, 0.03, gm, root, segs=10, closed=True, ol=0.004)
            tx = max(xs) + 0.02 if side == 'L' else min(xs) - 0.02
            tube(cz, name + '_tasselcord', [(tx, cy - ay + 0.02, zt), (tx, cy - ay - 0.01, zt - 0.12)], 0.008, gm, root, segs=6, ol=0.002)
            tassel(cz, name + '_tassel', (tx, cy - ay - 0.01, zt - 0.16), 1.6, gm, root)
        else:
            hem = [(p[0], p[1] - 0.025, -H + 0.04) for p in rows[-1]]
            tube(cz, name + '_hem', hem, 0.02, gm, root, ol=0.003)
    else:   # valance
        nu = max(60, swags * 24); nz = 14
        rows = []
        for j in range(nz + 1):
            v = j / nz; row = []
            for i in range(nu + 1):
                u = i / nu; x = -W / 2 + u * W
                f = (u * swags) % 1.0
                bot = H * (0.6 + 0.4 * math.sin(math.pi * f))
                z = -bot * v
                y = (-depth * (0.5 - 0.5 * math.cos(2 * math.pi * 3 * v)) * (0.4 + 0.6 * math.sin(math.pi * f))
                     - 0.1 * math.sin(math.pi * f) * math.sin(math.pi * v))
                row.append((x, y, z))
            rows.append(row)
        _sheet(cz, name + '_cloth', rows, vel, root, flip=True, thick=0.025, ol=0.009)
        # gold rope along the top + fringe ribbon along the scalloped bottom (sawtooth hem reads as fringe)
        tube(cz, name + '_rope', [(-W / 2 + W * k / 40, -0.035, -0.03) for k in range(41)], 0.03, gm, root, ol=0.004)
        bm = bmesh.new(); last = rows[-1]; fr = []
        n = int(W / 0.03)
        for k in range(n + 1):
            u = k / n; i = u * nu; i0 = min(nu - 1, int(i)); t = i - i0
            p0, p1 = Vector(last[i0]), Vector(last[i0 + 1]); p = p0.lerp(p1, t)
            L = 0.12 if k % 2 == 0 else 0.07
            fr.append((bm.verts.new((p.x, p.y - 0.03, p.z + 0.01)), bm.verts.new((p.x, p.y - 0.03, p.z - L))))
        for a, b in zip(fr, fr[1:]):
            bm.faces.new((a[0], b[0], b[1], a[1]))
        o = cz.place(cz._mesh_obj(name + '_fringe', bm, gm, smooth=False), (0, 0, 0), (0, 0, 0), None, root, 0, 0)
        s_ = o.modifiers.new('fabric', 'SOLIDIFY'); s_.thickness = 0.01; s_.offset = 0
        cz.outline(o, 0.002)
        for k in range(swags + 1):
            x = -W / 2 + W * k / swags
            tassel(cz, f'{name}_tassel{k}', (x, -0.06, -H * 0.6 - 0.02), 1.9, gm, root)
    return root
