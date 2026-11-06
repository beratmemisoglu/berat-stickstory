# TICKETS: a chunky old CRT TV on a low wooden stand. Charcoal plastic body with a thick bezel, a slightly bulging
# screen `<name>_screen` (cz.screen; kw screen=PNG, default tex/tk_tv_show.png: a late-night talk show) in a dark
# recess, a side control strip (speaker slots, power button with a red LED, channel buttons), a ZENOVA badge, the deep
# tapered tube housing behind, rabbit-ear antenna on top, cables down the back. The honey-wood stand (two open bays)
# holds a game console with a green LED + its controller, and stacks of DVD cases.
# on=True: lit screen; off: dark glass. light=True (default False): an AREA light `<name>_light` on the screen facing
# -Y (#6ab8ff, 40 W, size 0.5) for the blue TV glow; the scene may move / re-power it.
# Floor prop: root at the floor centre (the stand), front (screen) -Y.
#   textures: .venv/Scripts/python.exe assets/props/tex/make_tk_tv.py
import math, os, bmesh
from mathutils import Vector

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
SW, SD, SH = 0.95, 0.42, 0.44               # stand
TW, TH = 0.75, 0.58                        # TV front body
TZ = SH + 0.018                            # TV body bottom (on little feet)
SCR_W, SCR_H = 0.52, 0.39
SCR_C = (-0.05, -0.2, TZ + 0.318)          # screen centre (x, front face y, z)

META = {'size': (SW, SD, 1.05), 'anchor': 'floor centre (stand), front -Y',
        'screen': '<name>_screen: 0.52 x 0.39 (4:3), centre (-0.05, -0.21, 0.776) local, faces -Y',
        'antenna_top': 1.45, 'animate': [],
        'params': 'screen=PNG (4:3), on=True, light=False (adds the blue screen light), power=40'}


def _frustum(cz, nm, y0, y1, r0, r1, mat, parent, bevel=0.02, ol=0.008):
    """Box tapering along +Y: rect r0=(x0, x1, z0, z1) at y0 -> rect r1 at y1."""
    bm = bmesh.new()
    vs = [bm.verts.new((r[0 if i in (0, 3) else 1], y, r[2 if i < 2 else 3])) for y, r in ((y0, r0), (y1, r1)) for i in range(4)]
    for f in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(nm, bm, mat, smooth=False), (0, 0, 0), (0, 0, 0), None, parent, ol, bevel)


def _screen(cz, nm, w, h, bulge, mat, parent, loc, nu=16, nv=12):
    """Slightly bulging CRT glass facing -Y, UV 0..1."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); g = []
    for j in range(nv + 1):
        row = []
        for i in range(nu + 1):
            u, v = i / nu, j / nv; x, z = (u - 0.5) * w, (v - 0.5) * h
            y = -bulge * (1 - (2 * u - 1) ** 2) * (1 - (2 * v - 1) ** 2)
            row.append(bm.verts.new((x, y, z)))
        g.append(row)
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((g[j][i], g[j + 1][i], g[j + 1][i + 1], g[j][i + 1]))
            for lp, (a, b) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                lp[uvl].uv = (a / nu, b / nv)
    return cz.place(cz._mesh_obj(nm, bm, mat, smooth=True), loc, (0, 0, 0), None, parent, 0.0, 0.0)


def _tube(cz, nm, pts, r, mat, parent, ol=0.002, segs=10):
    from mathutils import Matrix
    pts = [Vector(p) for p in pts]
    bm = bmesh.new(); rings = []
    t0 = (pts[1] - pts[0]).normalized(); n = t0.cross(Vector((0, 0, 1)))
    if n.length < 1e-4: n = t0.cross(Vector((1, 0, 0)))
    n.normalize(); prev = t0
    for i, p in enumerate(pts):
        t = t0 if i == 0 else (pts[i] - pts[i - 1]).normalized() if i == len(pts) - 1 else (pts[i + 1] - pts[i - 1]).normalized()
        ax = prev.cross(t)
        if ax.length > 1e-6: n = Matrix.Rotation(prev.angle(t), 3, ax.normalized()) @ n
        prev = t; b = t.cross(n).normalized()
        rings.append([bm.verts.new(p + (n * math.cos(2 * math.pi * k / segs) + b * math.sin(2 * math.pi * k / segs)) * r) for k in range(segs)])
    for ra, rb in zip(rings, rings[1:]):
        for k in range(segs): bm.faces.new((ra[k], ra[(k + 1) % segs], rb[(k + 1) % segs], rb[k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(nm, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _rod(cz, nm, a, b, r, mat, parent, ol=0.002):
    a, b = Vector(a), Vector(b); d = b - a
    o = cz.cyl(nm, r, d.length, tuple(a), mat, verts=10, ol=ol, parent=parent)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return o


def build(cz, name='tk_tv', screen=None, on=True, light=False, power=40):
    root = cz.empty(name)
    wood = cz.toon(name + '_wood', '#8a5527', tex='wood', tex_scale=2.0, tex_strength=0.14)
    woodd = cz.toon(name + '_woodd', '#5a3618', tex='wood', tex_scale=2.0, tex_strength=0.1)
    plast = cz.toon(name + '_plastic', '#3d3a37', tex='grain', tex_strength=0.05)
    plastd = cz.toon(name + '_plasticd', '#24221f', tex='grain', tex_strength=0.04)
    rubber = cz.toon(name + '_rubber', '#1c1b1a')
    metal = cz.toon(name + '_metal', '#a7abb0', lift=0.55)
    # ---- stand: top, bottom, sides, shelf, back, feet
    cz.box(name + '_top', (SW, SD, 0.035), (0, 0, SH - 0.035), wood, bevel=0.008, ol=0.007, parent=root, origin='bottom')
    cz.box(name + '_bottom', (SW - 0.04, SD - 0.02, 0.03), (0, 0, 0.05), wood, bevel=0.006, ol=0.006, parent=root, origin='bottom')
    for s in (-1, 1):
        cz.box(f'{name}_side{"L" if s < 0 else "R"}', (0.035, SD - 0.01, SH - 0.035 - 0.05), (s * (SW / 2 - 0.035), 0, 0.05), wood,
               rot=(0, 0, 0), bevel=0.006, ol=0.006, parent=root, origin='bottom')
        for sy in (-1, 1):
            cz.cyl(f'{name}_foot{"L" if s < 0 else "R"}{"F" if sy < 0 else "B"}', 0.022, 0.052, (s * (SW / 2 - 0.06), sy * (SD / 2 - 0.05), 0), woodd,
                   r2=0.028, verts=16, ol=0.004, parent=root)
    cz.box(name + '_shelf', (SW - 0.105, SD - 0.04, 0.022), (0, 0.0, 0.235), wood, bevel=0.004, ol=0.005, parent=root, origin='bottom')
    cz.box(name + '_backp', (SW - 0.105, 0.012, SH - 0.035 - 0.08), (0, SD / 2 - 0.012, 0.08), woodd, bevel=0.0, ol=0.004, parent=root, origin='bottom')
    # ---- console (upper bay, left) + controller (upper bay, right), DVD stacks (lower bay)
    cz.box(name + '_console', (0.3, 0.22, 0.065), (-0.2, 0.0, 0.257), plastd, bevel=0.008, ol=0.004, parent=root, origin='bottom')
    cz.box(name + '_console_slot', (0.18, 0.004, 0.006), (-0.22, -0.111, 0.3), rubber, bevel=0.0, ol=0.0, parent=root)
    led = cz.glow(name + '_ledg', '#5dff8a', 4.0) if on else cz.toon(name + '_ledg_off', '#2e5a3a')
    cz.box(name + '_console_led', (0.012, 0.004, 0.006), (-0.08, -0.111, 0.3), led, bevel=0.0, ol=0.0, parent=root)
    for k in range(5):
        cz.box(f'{name}_console_vent{k}', (0.006, 0.12, 0.002), (-0.31 + k * 0.016, 0.0, 0.3225), rubber, bevel=0.0, ol=0.0, parent=root)
    cp = cz.empty(name + '_pad', (0.2, -0.04, 0.257), parent=root); cp.rotation_euler = (0, 0, math.radians(-14))
    pad = cz.toon(name + '_padm', '#2f3a52', tex='grain', tex_strength=0.05)
    cz.box(name + '_pad_body', (0.13, 0.065, 0.028), (0, 0, 0), pad, bevel=0.012, ol=0.004, parent=cp, origin='bottom')
    for s in (-1, 1):
        cz.sphere(f'{name}_pad_grip{"L" if s < 0 else "R"}', 0.022, (s * 0.058, 0.02, 0.022), pad, ol=0.004, parent=cp, segs=20, rings=10)
    for k, (dx, c) in enumerate(((0.03, '#d23a3a'), (0.045, '#3aa0d2'), (0.03 + 0.0075, '#e8c23a'))):
        cz.cyl(f'{name}_pad_btn{k}', 0.006, 0.006, (dx, -0.012 + k * 0.01, 0.027), cz.toon(f'{name}_btn_{c[1:]}', c), verts=12, ol=0.0015, parent=cp)
    cz.box(name + '_pad_dpad', (0.024, 0.008, 0.005), (-0.035, -0.006, 0.0285), rubber, bevel=0.002, ol=0.0015, parent=cp)
    cz.box(name + '_pad_dpad2', (0.008, 0.024, 0.005), (-0.035, -0.006, 0.0285), rubber, bevel=0.002, ol=0.0015, parent=cp)
    cols = ['#c8372d', '#2d6cc8', '#e5b62b', '#3a9a52', '#8a3ab0', '#e06a28', '#1f2a44']
    lab = cz.toon(name + '_dvdlabel', '#efe9da')
    for st, (sx0, n, rz0) in enumerate(((-0.26, 6, 4), (0.17, 4, -7))):
        z = 0.08
        for k in range(n):
            c = cols[(k * 3 + st * 2) % len(cols)]
            hgt = 0.015
            pv = cz.empty(f'{name}_dvd{st}_{k}', (sx0 + 0.006 * math.sin(k * 2.1), -0.01, z), parent=root)
            pv.rotation_euler = (0, 0, math.radians(rz0 + 5 * math.sin(k * 1.7)))
            cz.box(f'{pv.name}_m', (0.19, 0.135, hgt), (0, 0, 0), cz.toon(f'{name}_dvd_{c[1:]}', c, tex='grain', tex_strength=0.04), bevel=0.002, ol=0.0025, parent=pv, origin='bottom')
            cz.box(f'{pv.name}_lab', (0.07, 0.0012, 0.006), (-0.03, -0.0681, hgt / 2), lab, bevel=0.0, ol=0.0, parent=pv)
            z += hgt
    # three VHS tapes in black sleeves between the DVD stacks, spine labels out
    vhs = cz.toon(name + '_vhs', '#232325', tex='grain', tex_strength=0.05)
    for k, (c, rz) in enumerate((('#efe9da', 3), ('#e6c84a', -4), ('#efe9da', 6))):
        pv = cz.empty(f'{name}_vhs{k}', (-0.045 + 0.005 * k, 0.0, 0.08 + k * 0.026), parent=root)
        pv.rotation_euler = (0, 0, math.radians(rz))
        cz.box(f'{pv.name}_m', (0.19, 0.105, 0.025), (0, 0, 0), vhs, bevel=0.003, ol=0.003, parent=pv, origin='bottom')
        cz.box(f'{pv.name}_lab', (0.13, 0.0012, 0.013), (0.0, -0.0531, 0.0125), cz.toon(f'{name}_vhslab_{c[1:]}', c), bevel=0.0, ol=0.0, parent=pv)
    # ---- TV: front body, bezel recess, bulging screen, tube housing, feet
    for s in (-1, 1):
        cz.box(f'{name}_tvfoot{"L" if s < 0 else "R"}', (0.1, 0.06, 0.02), (s * 0.25, -0.1, SH - 0.002), rubber, bevel=0.005, ol=0.003, parent=root, origin='bottom')
    cz.box(name + '_body', (TW, 0.14, TH), (0, -0.13, TZ), plast, bevel=0.035, ol=0.009, parent=root, origin='bottom')
    _frustum(cz, name + '_tube', -0.07, 0.2, (-0.33, 0.33, TZ + 0.01, TZ + TH - 0.04), (-0.21, 0.21, TZ + 0.05, TZ + 0.42), plast, root, bevel=0.025, ol=0.008)
    cz.box(name + '_recess', (SCR_W + 0.06, 0.012, SCR_H + 0.06), (SCR_C[0], -0.2 - 0.004, SCR_C[2]), plastd, bevel=0.012, ol=0.004, parent=root)
    scrm = cz.screen(name + '_scr_' + os.path.basename(screen or 'tk_tv_show.png').split('.')[0], screen or os.path.join(TEX, 'tk_tv_show.png'), strength=1.15) if on \
        else cz.toon(name + '_scr_off_tk_tv_off', img=os.path.join(TEX, 'tk_tv_off.png'), lift=0.5)
    _screen(cz, name + '_screen', SCR_W, SCR_H, 0.014, scrm, root, (SCR_C[0], -0.2 - 0.0112, SCR_C[2]))
    # control strip: speaker slots, power button + LED, channel buttons
    cx = 0.3
    for k in range(7):
        cz.box(f'{name}_slot{k}', (0.075, 0.003, 0.007), (cx, -0.2 - 0.0012, TZ + 0.52 - k * 0.022), plastd, bevel=0.0, ol=0.0, parent=root)
    cz.cyl(name + '_power', 0.016, 0.012, (cx, -0.2, TZ + 0.3), plastd, rot=(90, 0, 0), verts=20, ol=0.003, parent=root)
    pled = cz.glow(name + '_ledr', '#ff3b2e', 4.0) if on else cz.toon(name + '_ledr_off', '#5a1e1a')
    cz.cyl(name + '_powerled', 0.0055, 0.004, (cx, -0.2 - 0.001, TZ + 0.255), pled, rot=(90, 0, 0), verts=12, ol=0.0, parent=root)
    for k in range(3):
        cz.box(f'{name}_chbtn{k}', (0.05, 0.01, 0.018), (cx, -0.2 - 0.003, TZ + 0.2 - k * 0.03), plastd, bevel=0.004, ol=0.002, parent=root)
    cz.plane(name + '_badge', 0.13, 0.026, (SCR_C[0], -0.2 - 0.0013, TZ + 0.06), cz.toon(name + '_badgem_tk_tv_badge', img=os.path.join(TEX, 'tk_tv_badge.png'), lift=0.65), parent=root)
    # ---- rabbit-ear antenna on top
    az = TZ + TH
    cz.cyl(name + '_antbase', 0.055, 0.03, (0.04, -0.13, az - 0.004), plastd, r2=0.035, verts=28, bevel=0.006, ol=0.004, parent=root)
    for s, ang in ((-1, 32), (1, 26)):
        a = math.radians(ang)
        p0 = Vector((0.04 + s * 0.012, -0.13, az + 0.022))
        dvec = Vector((s * math.sin(a), 0.22, math.cos(a))).normalized()
        p1 = p0 + dvec * 0.44
        _rod(cz, f'{name}_ant{"L" if s < 0 else "R"}', tuple(p0), tuple(p1), 0.0045, metal, root, ol=0.002)
        _rod(cz, f'{name}_ant{"L" if s < 0 else "R"}_seg', tuple(p0 + dvec * 0.2), tuple(p0 + dvec * 0.215), 0.0062, metal, root, ol=0.0015)
        cz.sphere(f'{name}_ant{"L" if s < 0 else "R"}_tip', 0.009, tuple(p1), metal, ol=0.002, parent=root, segs=12, rings=8)
    # ---- cables: TV back -> behind the stand -> floor; console -> controller
    cab = cz.toon(name + '_cable', '#22201e')
    _tube(cz, name + '_cable0', [(0.12, 0.19, TZ + 0.12), (0.14, 0.23, TZ + 0.05), (0.17, 0.25, SH - 0.02), (0.2, 0.25, 0.25), (0.24, 0.27, 0.06),
                                 (0.3, 0.32, 0.007), (0.45, 0.36, 0.007), (0.6, 0.33, 0.007)], 0.0065, cab, root)
    _tube(cz, name + '_cable1', [(-0.06, 0.0, 0.29), (0.02, -0.05, 0.27), (0.08, -0.07, 0.262), (0.14, -0.035, 0.262), (0.16, -0.02, 0.268)], 0.0035, cab, root, ol=0.0)
    if light and on:
        lt = cz.light(name + '_light', 'AREA', (SCR_C[0], -0.24, SCR_C[2]), rot=(-90, 0, 0), color='#6ab8ff', power=power, size=0.5)
        lt.parent = root
    return root
