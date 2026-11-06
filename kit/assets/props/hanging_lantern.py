# Red silk palace lantern: a gold hanging ring + cord, a gold crown with a knob, a round ten-lobed silk body (a gold
# "fu" / good-fortune character printed on the front lobe, PNG from tex/make_hanging_lantern.py), an open gold bottom
# ring with the glowing inside visible through it, and a tassel (gold bead, red knot, gold collar, red strands).
# lit=True: the silk glows warm from inside (toon + emission) and the inside disc is a low cz.glow; lit=False: plain
# lit-by-the-scene silk and a dark inside. There is NO light object: the set adds its own warm point light at the body
# centre (META['light_at']).
# Root = the hanging point (top of the ring); everything hangs toward -Z on the pivot <name>_swing (at the root).
import math, os, bmesh

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
R0, HZ, LOBES = 0.25, 0.27, 10

META = {'size': (0.5, 0.5, 1.4), 'anchor': 'hanging point (top of the ring); hangs toward -Z',
        'animate': ['_swing (rotation_euler.x / .y in radians about the hanging point, e.g. +-0.08 sway)'],
        'light_at': 'z = -(drop + 0.36) (body centre, local)',
        'params': "lit=True, drop=0.25 (cord length, m), swing=0.0 (static tilt about X, deg), silk='#b8291b', fu=True"}


def _k(a):
    """Lobe factor: 1 at a lobe centre (one lobe centred on -Y), dips 5 % between lobes."""
    return 1 - 0.05 * (1 - abs(math.sin(LOBES * a / 2))) ** 2


def _body_r(t):
    return R0 * math.sqrt(max(0.0, 1 - 0.82 * t * t))


def _lathe(cz, name, prof, mat, parent, segs=48, ol=0.005, lobes=False, closed=False, smooth=True):
    """Surface of revolution from (r, z) pairs. closed=True: the profile is a loop (a ring, no caps); otherwise both
    ends are capped. lobes=True applies the body's lobe factor."""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs - math.pi
            k = _k(a) if lobes else 1.0
            ring.append(bm.verts.new((r * k * math.cos(a), r * k * math.sin(a), z)))
        rings.append(ring)
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    for ra, rb in pairs:
        for i in range(segs):
            bm.faces.new((ra[i], ra[(i + 1) % segs], rb[(i + 1) % segs], rb[i]))
    if not closed:
        bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=smooth), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _patch(cz, name, zc, a0, da, z0, z1, mat, parent, off=0.0025, nu=16, nv=16):
    """A printed card lying on the lobed body (angles a0 +- da, heights z0..z1 local), UV 0..1, facing outward."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); vs = []
    for j in range(nv + 1):
        z = z0 + (z1 - z0) * j / nv; t = (z - zc) / HZ
        row = []
        for i in range(nu + 1):
            a = a0 - da + 2 * da * i / nu
            r = _body_r(t) * _k(a) + off
            row.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        vs.append(row)
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
            for lp, (u, v) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (u / nu, v / nv)
    for f in bm.faces:       # the card's front faces away from the axis
        c = f.calc_center_median()
        if f.normal.x * c.x + f.normal.y * c.y < 0: f.normal_flip()
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, 0.0, 0.0)


def _ribs(cz, name, zc, mat, parent, w=0.009, off=0.0015, n=28, skip=True):
    """Thin rib lines along the ten seams between the lobes (one mesh)."""
    bm = bmesh.new()
    for m in range(LOBES):
        a = m * 2 * math.pi / LOBES
        L, Rr = [], []
        for j in range(n + 1):
            t = -0.97 + 1.94 * j / n
            r = _body_r(t) * _k(a) + off
            da = w / 2 / r
            z = zc + HZ * t
            L.append(bm.verts.new((r * math.cos(a - da), r * math.sin(a - da), z)))
            Rr.append(bm.verts.new((r * math.cos(a + da), r * math.sin(a + da), z)))
        da_front = abs((a + math.pi / 2 + math.pi) % (2 * math.pi) - math.pi)
        for j in range(n):
            zm = (L[j].co.z + L[j + 1].co.z) / 2
            if skip and da_front < 0.55 and abs(zm - zc) < 0.135: continue     # no rib under the printed character
            bm.faces.new((L[j], Rr[j], Rr[j + 1], L[j + 1]))
    for v in [v for v in bm.verts if not v.link_faces]: bm.verts.remove(v)
    for f in bm.faces:
        c = f.calc_center_median()
        if f.normal.x * c.x + f.normal.y * c.y < 0: f.normal_flip()
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, 0.0, 0.0)


def build(cz, name='hanging_lantern', lit=True, drop=0.25, swing=0.0, silk='#b8291b', fu=True):
    root = cz.empty(name)
    pv = cz.empty(name + '_swing', (0, 0, 0), parent=root)
    pv.rotation_euler = (math.radians(swing), 0, 0)
    gold = cz.toon(name + '_gold', '#c99a2e', tex='grain', tex_scale=3.0, tex_strength=0.05)
    cord = cz.toon(name + '_cordm', '#6e1a14')
    if lit:
        sm = cz.toon(name + '_silk_lit', silk, emit=0.55, emit_color='#ff4a2c', tex='paper', tex_strength=0.04)
        inside = cz.glow(name + '_insidem', '#ffd27a', 1.6)
    else:
        sm = cz.toon(name + '_silk', silk, tex='paper', tex_strength=0.05)
        inside = cz.toon(name + '_insidem', '#3a1410')
    # hanging ring + cord
    ring = _lathe(cz, name + '_ring', [(0.032 + 0.009 * math.cos(2 * math.pi * i / 12), 0.009 * math.sin(2 * math.pi * i / 12))
                                       for i in range(12)], gold, pv, segs=24, ol=0.002, closed=True)
    ring.rotation_euler = (math.radians(90), 0, 0); ring.location = (0, 0, -0.041)
    cz.cyl(name + '_cord', 0.008, drop - 0.06, (0, 0, -drop), cord, verts=12, ol=0.0025, parent=pv)
    # crown: knob + flared cap (covers the body's top opening)
    zt = -drop
    cz.sphere(name + '_knob', 0.026, (0, 0, zt - 0.012), gold, ol=0.003, parent=pv, segs=20, rings=10)
    _lathe(cz, name + '_crown', [(0.035, zt - 0.02), (0.06, zt - 0.035), (0.105, zt - 0.06), (0.128, zt - 0.085),
                                 (0.13, zt - 0.1), (0.11, zt - 0.105)], gold, pv, segs=48, ol=0.004)
    # body
    zc = zt - 0.36
    n = 24
    prof = [(_body_r(-1 + 2 * j / n), zc + HZ * (-1 + 2 * j / n)) for j in range(n + 1)]
    _lathe(cz, name + '_body', prof, sm, pv, segs=120, ol=0.006, lobes=True)
    _ribs(cz, name + '_ribs', zc, cz.toon(name + '_ribm', '#6e1a12'), pv, skip=fu)
    if fu:
        fm = cz.toon(name + '_fum', img=os.path.join(TEX, 'hanging_lantern_fu.png'), alpha_clip=True, lift=0.55,
                     emit=0.35 if lit else 0.0)
        _patch(cz, name + '_fu', zc, -math.pi / 2, 0.5, zc - 0.125, zc + 0.125, fm, pv)
    # open bottom ring + the inside seen through it
    zb = zc - HZ
    _lathe(cz, name + '_bottom', [(0.07, zb - 0.022), (0.118, zb - 0.022), (0.13, zb + 0.0), (0.122, zb + 0.03),
                                  (0.07, zb + 0.03)], gold, pv, segs=48, ol=0.004, closed=True)
    cz.cyl(name + '_inside', 0.075, 0.004, (0, 0, zb - 0.008), inside, verts=32, ol=0.0, parent=pv)   # under the body cap
    # tassel: bead, knot, collar, strands
    cz.cyl(name + '_tcord', 0.006, 0.07, (0, 0, zb - 0.09), cord, verts=10, ol=0.002, parent=pv)
    cz.sphere(name + '_bead', 0.024, (0, 0, zb - 0.045), gold, ol=0.003, parent=pv, segs=20, rings=10)
    knot = cz.box(name + '_knot', (0.06, 0.024, 0.06), (0, 0, zb - 0.12), cz.toon(name + '_knotm', '#c4301f'), rot=(0, 45, 0),
                  bevel=0.008, ol=0.003, parent=pv)
    cz.cyl(name + '_collar', 0.03, 0.04, (0, 0, zb - 0.2), gold, verts=24, bevel=0.005, ol=0.003, parent=pv)
    tz0, tz1 = zb - 0.52, zb - 0.19
    tp = [(0.05, tz0), (0.056, tz0 + 0.025), (0.046, tz0 + 0.13), (0.034, tz0 + 0.24), (0.026, tz1)]
    bm_ = _lathe(cz, name + '_strands', tp, cz.toon(name + '_strandm', '#b8281c'), pv, segs=48, ol=0.003)
    for v in bm_.data.vertices:        # fine grooves (strands) + a slightly ragged hem
        a = math.atan2(v.co.y, v.co.x)
        g = 1 - 0.12 * (1 - abs(math.sin(9 * a))) ** 3
        v.co.x *= g; v.co.y *= g
        if v.co.z < tz0 + 0.001: v.co.z += 0.012 * abs(math.sin(9 * a))
    return root
