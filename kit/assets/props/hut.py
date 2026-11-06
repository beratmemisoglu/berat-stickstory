# Hut: the inventor's small humble thatched hut. A rammed-earth plinth, chunky round corner posts, mud walls with
# darker patches, the gable end to the front (-Y) with the doorway in the middle (a split indigo cloth hanging from a
# rod) and a small lattice window on the right, a steep thatched roof of three layered courses per side (slabs with a
# ragged lower edge, straw streaks) under a bound ridge bundle; a stone step, a stack of firewood under the left eave,
# a straw hat on a peg, a clay water jar.
# lit=True: warm light inside - the window and the gaps around the cloth glow, the cloth is back-lit, and (lamp=True)
# a small warm point light outside the door puts a glow pool on the doorstep.
# Floor prop: root at the floor centre (z = 0 = the ground; the plinth reaches 0.3 m below it, so the hut can stand on a
# slightly uneven hilltop), front = the door side (-Y). 2.5 x 2.0 x 2.3 m; the doorway is 0.72 x 1.42 m, sill 0.14 m.
# Animate: <name>_cloth rotation_euler.x (the curtain swings about its rod; - = the bottom swings out toward -Y, + = in),
# <name>_clothL / <name>_clothR rotation_euler.z (open one half: pivot at the outer edge of the rod),
# <name>_lamp light energy (flicker; only when lit and lamp).
import math
from mathutils import Matrix, Vector

META = {'size': (2.92, 2.35, 2.31), 'body': (2.5, 2.0, 2.3), 'anchor': 'floor centre (woodpile out to x -1.57, step + jar to y -1.26); door in the front gable (-Y) at x = 0, 0.72 x 1.42 m, '
        'floor (plinth top) at z = 0.14; plinth goes 0.3 m below z = 0',
        'animate': ['_cloth (rotation x: sway)', '_clothL/_clothR (rotation z: open a half)', '_lamp (energy)'],
        'params': "lit=False (warm light inside), lamp=True (real warm light at the door when lit), cloth='#36507a', "
                  "wood=True (firewood stack), hat=True (straw hat on the woodpile), jar=True, open=0.0 (0..1 pulls the right "
                  "cloth half aside), sink=0.3 (how far the plinth reaches below z = 0; 0 on a flat floor)"}

PL = 0.14                 # plinth top / floor
WX, WY, WT = 0.95, 0.8, 0.09     # wall half width, half depth, thickness
XE, YE = 1.25, 1.0        # roof eave half width, half depth
ZR = 2.04                 # ridge line of the base thatch plane
ALPHA = math.radians(35)
T = 0.15                  # thatch slab thickness
DW, DH = 0.72, 1.42       # doorway
WIN = (0.46, 0.78, 0.66, 0.96)   # window x0, x1, z0, z1 (front wall)


def zu(x, over=0.06):
    """Roof underside height above x (plus how far a wall top reaches into the thatch)."""
    return ZR - abs(x) * math.tan(ALPHA) - T / math.cos(ALPHA) + over


def _prism(cz, name, pts, depth, mat, loc=(0, 0, 0), rot=(0, 0, 0), ol=0.006, bevel=0.0, parent=None):
    """Extrude the 2-D outline pts (local XY, any winding, may be concave) along local +Z by depth: a cz.cyl whose two
    rings are moved onto the outline (one mesh, one outline). Flat shaded."""
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    if area < 0: pts = pts[::-1]
    n = len(pts)
    o = cz.cyl(name, 1.0, depth, loc, mat, rot=rot, verts=n, bevel=bevel, ol=ol, parent=parent)
    vs = o.data.vertices
    a0 = math.atan2(vs[0].co.y, vs[0].co.x); step = 2 * math.pi / n
    for v in vs:
        k = int(round(((math.atan2(v.co.y, v.co.x) - a0) % (2 * math.pi)) / step)) % n
        v.co.x, v.co.y = pts[k]
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons))
    o.data.update()
    return o


def _wall_xz(cz, name, pts, y_out, mat, parent, ol=0.009, depth=WT):
    """A wall from an (x, z) outline whose outer face is at y = y_out, thickness toward +Y (front wall) ."""
    return _prism(cz, name, pts, depth, mat, (0, y_out + depth, 0), (90, 0, 0), ol=ol, bevel=0.015, parent=parent)


def build(cz, name='hut', lit=False, lamp=True, cloth='#36507a', wood=True, hat=True, jar=True, open=0.0, sink=0.3):
    root = cz.empty(name)
    tan, cos = math.tan(ALPHA), math.cos(ALPHA)
    mud = cz.toon(name + '_mud', '#b98e5c', tex='grain', tex_scale=2.0, tex_strength=0.07)
    mud2 = cz.toon(name + '_mud2', '#a67c4e', tex='grain', tex_scale=2.0, tex_strength=0.07)
    earth = cz.toon(name + '_plinth', '#8a7b66', tex='grain', tex_scale=1.5, tex_strength=0.06)
    wood_m = cz.toon(name + '_wood', '#6a4630', tex='wood', tex_scale=1.5, tex_strength=0.08)
    dark_w = cz.toon(name + '_wood2', '#57392a', tex='wood', tex_scale=1.5, tex_strength=0.08)

    # ---- plinth (rammed earth, goes below the ground) + stone step at the door
    sink = max(0.0, float(sink))
    cz.box(name + '_plinth', (2 * WX + 0.24, 2 * WY + 0.24, PL + sink), (0, 0, -sink), earth, bevel=0.03, ol=0.009,
           parent=root, origin='bottom')
    cz.box(name + '_step', (0.66, 0.3, 0.08 + sink), (0, -WY - 0.12 - 0.14, -sink), cz.toon(name + '_stone', '#9c968a', tex='grain',
           tex_strength=0.06), bevel=0.025, ol=0.007, parent=root, origin='bottom')

    # ---- walls: the front gable with the door notch, the back gable, two low side walls
    front = [(-WX, PL), (-DW / 2, PL), (-DW / 2, PL + DH), (DW / 2, PL + DH), (DW / 2, PL), (WX, PL), (WX, zu(WX)),
             (0, zu(0)), (-WX, zu(-WX))]
    _wall_xz(cz, name + '_wallF', front, -WY, mud, root)
    back = [(-WX, PL), (WX, PL), (WX, zu(WX)), (0, zu(0)), (-WX, zu(-WX))]
    _wall_xz(cz, name + '_wallB', back, WY - WT, mud, root)
    for sx in (-1, 1):
        cz.box(f'{name}_wall{"L" if sx < 0 else "R"}', (WT, 2 * WY - 0.02, zu(WX) - PL), (sx * (WX - WT / 2 - 0.003), 0, PL), mud,
               bevel=0.015, ol=0.009, parent=root, origin='bottom')
    # darker mud patches (decals 1.5 mm proud, no outline)
    blobs = [(-0.62, 0.5, 0.17, 0.12), (0.0, 1.79, 0.11, 0.06), (0.74, 0.34, 0.12, 0.1)]
    for i, (bx, bz, rx, rz) in enumerate(blobs):
        pts = [(bx + rx * math.cos(a) * (1 + 0.18 * math.sin(3 * a + i)), bz + rz * math.sin(a) * (1 + 0.15 * math.cos(2 * a + i)))
               for a in [k / 12 * 2 * math.pi for k in range(12)]]
        _prism(cz, f'{name}_patch{i}', pts, 0.004, mud2, (0, -WY + 0.0025, 0), (90, 0, 0), ol=0.0, parent=root)
    cz.box(name + '_patchS', (0.004, 0.36, 0.2), (-WX + 0.003 - 0.0012, 0.15, 0.55), mud2, bevel=0.0, ol=0.0, parent=root)

    # ---- timber: corner posts, door jambs + lintel, wall plates under the eaves
    for sx in (-1, 1):
        for sy in (-1, 1):
            cz.cyl(f'{name}_post{"LR"[sx > 0]}{"FB"[sy > 0]}', 0.095, zu(WX, 0.04) - PL + 0.02, (sx * WX, sy * WY, PL - 0.02),
                   wood_m, r2=0.085, verts=14, ol=0.008, parent=root)
    for sx in (-1, 1):
        cz.box(f'{name}_jamb{"LR"[sx > 0]}', (0.09, 0.11, DH + 0.06), (sx * (DW / 2 + 0.035), -WY + 0.03, PL - 0.01), wood_m,
               bevel=0.012, ol=0.007, parent=root, origin='bottom')
    # horizontal bars are built standing and turned (the wood grain follows the object's X)
    cz.box(name + '_lintel', (0.12, 0.12, DW + 0.32), (0, -WY + 0.025, PL + DH + 0.06), wood_m, rot=(0, 90, 0),
           bevel=0.012, ol=0.007, parent=root)
    for sx in (-1, 1):
        cz.box(f'{name}_plate{"LR"[sx > 0]}', (0.11, 2 * WY + 0.3, 0.1), (sx * (WX + 0.02), 0, zu(WX, 0.0) + 0.02), dark_w,
               bevel=0.012, ol=0.007, parent=root)

    # ---- window (front right): glowing / dark pane decal, chunky frame, a cross lattice, a little sill
    x0, x1, z0, z1 = WIN; wx, wz = (x0 + x1) / 2, (z0 + z1) / 2
    if lit:
        pane = cz.glow(name + '_winglow', '#ffb24a', 2.2)
    else:
        pane = cz.toon(name + '_windark', '#2f2a2a', lift=0.8)
    cz.box(name + '_pane', (x1 - x0, 0.004, z1 - z0), (wx, -WY - 0.0022, wz), pane, bevel=0, ol=0, parent=root)
    fw = 0.05
    for i, (cx, cz_, sw, sh) in enumerate(((wx, z1 + fw / 2, x1 - x0 + 2 * fw, fw), (wx, z0 - fw / 2, x1 - x0 + 2 * fw, fw))):
        cz.box(f'{name}_winbar{i}', (sh, 0.05, sw), (cx, -WY - 0.012, cz_), wood_m, rot=(0, 90, 0), bevel=0.008, ol=0.006, parent=root)
    for i, cx in enumerate((x0 - fw / 2, x1 + fw / 2)):
        cz.box(f'{name}_winpost{i}', (fw, 0.05, z1 - z0), (cx, -WY - 0.012, wz), wood_m, bevel=0.008, ol=0.006, parent=root)
    cz.box(name + '_latV', (0.026, 0.03, z1 - z0), (wx, -WY - 0.015, wz), dark_w, bevel=0.004, ol=0.004, parent=root)
    cz.box(name + '_latH', (0.026, 0.03, x1 - x0), (wx, -WY - 0.017, wz), dark_w, rot=(0, 90, 0), bevel=0.004, ol=0.004, parent=root)
    cz.box(name + '_sill', (x1 - x0 + 0.2, 0.1, 0.045), (wx, -WY - 0.03, z0 - fw - 0.02), dark_w, bevel=0.01, ol=0.006, parent=root)

    # ---- inside: a card behind the doorway (dark, or warm light when lit)
    inner = cz.glow(name + '_inglow', '#ff9e3d', 1.25) if lit else cz.toon(name + '_indark', '#2a2420', lift=0.8)
    cz.plane(name + '_inside', DW + 0.12, DH + 0.06, (0, -WY + WT + 0.006, PL + DH / 2), inner, parent=root)
    cz.box(name + '_floor', (2 * WX - 2 * WT, 2 * WY - 2 * WT, 0.02), (0, 0, PL - 0.01), cz.toon(name + '_floorm', '#5e4d3c'),
           bevel=0, ol=0, parent=root)

    # ---- door cloth: two folded halves on a rod, a gap in the middle (glows when lit)
    rod_z = PL + DH - 0.01
    cz.cyl(name + '_rod', 0.02, DW + 0.22, (-(DW + 0.22) / 2, -WY - 0.045, PL + DH + 0.005), dark_w, rot=(0, 90, 0), verts=10,
           ol=0.004, parent=root)
    pv = cz.empty(name + '_cloth', (0, -WY - 0.068, rod_z), parent=root)
    cm = cz.toon(name + '_clothm' + ('_lit' if lit else ''), cloth, tex='grain', tex_strength=0.05,
                 emit=0.22 if lit else 0.0)      # back-lit: a little brighter in its own colour (warm emission turned it pink)
    L = DH - 0.17            # the cloth ends 0.14 m above the sill
    half = DW / 2 + 0.03
    for side, sx in (('L', -1), ('R', 1)):
        hp = cz.empty(f'{name}_cloth{side}', (sx * half, 0, 0), parent=pv)      # pivot at the outer edge of the rod
        w = half - 0.02
        folds = 3
        top, bot = [], []
        for k in range(folds * 4 + 1):
            u = k / (folds * 4); x = -sx * u * w
            f = 0.022 * math.sin(u * folds * 2 * math.pi)
            top.append((x, f - 0.01)); bot.append((x, f + 0.01))
        pts = top + bot[::-1]
        c = _prism(cz, f'{name}_cloth{side}_m', pts, L, cm, (0, 0, -L), ol=0.005, parent=hp)
        for v in c.data.vertices:   # the bottom flares: deeper folds, a little wider
            if v.co.z < L / 2:
                v.co.y *= 1.3; v.co.x *= 1.05
        c.data.update()
        if side == 'R' and open:
            hp.rotation_euler = (0, 0, math.radians(-70 * float(open)))

    # ---- roof: per side three thatch courses (base -> top), each a slab with a ragged lower edge, then the ridge
    straw = [cz.toon(name + '_thatch0', '#9e7c3e', tex='wood', tex_scale=5.0, tex_strength=0.1),
             cz.toon(name + '_thatch1', '#ab8847', tex='wood', tex_scale=5.0, tex_strength=0.1),
             cz.toon(name + '_thatch2', '#957238', tex='wood', tex_scale=5.0, tex_strength=0.1)]
    SL = XE / cos                    # slope length ridge -> eave along the base plane
    import random
    rnd = random.Random(4)
    for side, sx in (('R', 1), ('L', -1)):
        d = Vector((sx * cos, 0, -math.sin(ALPHA))); nrm = Vector((sx * math.sin(ALPHA), 0, cos))
        X = Vector((0, -sx, 0))
        M = Matrix((X, d, nrm)).transposed()        # columns: local X (along the ridge), Y (down-slope), Z (normal)
        for k, (lk, off) in enumerate(((SL + 0.03, 0.0), (SL - 0.5, 0.05), (SL - 1.0, 0.1))):
            y0 = -0.13 - 0.02 * k
            ye = YE
            pts = [(-ye, y0), (ye, y0), (ye, lk + 0.03), (ye - 0.09, lk + 0.04)]
            # the ragged lower edge, from +YE to -YE: chunky uneven teeth (thin ones turn into black ink spikes),
            # plain for the last 9 cm at both gable ends
            x = ye - 0.09
            while x > -ye + 0.09 + 0.12:
                tw = rnd.uniform(0.12, 0.2); dep = rnd.uniform(0.045, 0.09)
                pts.append((x - tw * 0.5, lk + dep)); pts.append((x - tw, lk + rnd.uniform(-0.01, 0.015)))
                x -= tw
            pts += [(-ye + 0.09, lk + 0.04), (-ye, lk + 0.03)]
            loc = Vector((0, 0, ZR)) + nrm * (off - T)
            o = _prism(cz, f'{name}_thatch{side}{k}', pts, T, straw[k], tuple(loc), ol=0.009 if k == 0 else 0.007,
                       bevel=0.012, parent=root)
            o.rotation_euler = M.to_euler()
    # ridge bundle with rope bindings
    rz = ZR + 0.11
    ridge = cz.toon(name + '_ridge', '#86632f', tex='wood', tex_scale=4.0, tex_strength=0.08)
    rope = cz.toon(name + '_rope', '#5e4426', tex='grain', tex_strength=0.05)
    cz.cyl(name + '_ridge', 0.15, 2 * YE + 0.16, (0, YE + 0.08, rz), ridge, rot=(90, 0, 0), r2=0.15, verts=24, ol=0.009,
           bevel=0.03, parent=root)
    for i, y in enumerate((-0.82, -0.28, 0.28, 0.82)):
        cz.cyl(f'{name}_bind{i}', 0.158, 0.05, (0, y + 0.025, rz), rope, rot=(90, 0, 0), verts=24, ol=0.004, parent=root)

    # ---- dressing
    if wood:   # firewood under the left eave: logs along Y, pale end faces toward the front
        bark = cz.toon(name + '_bark', '#6b4b33', tex='grain', tex_strength=0.06)
        endm = cz.toon(name + '_logend', '#d6b07a', tex='grain', tex_strength=0.05)
        r = 0.065; y1, y2 = -0.72, -0.16
        logs = [(-1.43, r), (-1.3, r), (-1.17, r), (-1.365, r * 2.73), (-1.235, r * 2.73), (-1.3, r * 4.46)]
        for i, (lx, lz) in enumerate(logs):
            jy = (i * 0.37) % 0.06
            cz.cyl(f'{name}_log{i}', r, y2 - y1, (lx, y2 + jy, lz), bark, rot=(90, 0, 0), verts=12, ol=0.005, parent=root)
            cz.cyl(f'{name}_logend{i}', r * 0.72, 0.004, (lx, y1 + jy + 0.0025, lz), endm, rot=(90, 0, 0), verts=12, ol=0.0, parent=root)
    if hat:    # a conical straw hat resting on the woodpile (or on the step without wood)
        hm = cz.toon(name + '_hat', '#b89148', tex='wood', tex_scale=6, tex_strength=0.08)
        hx, hy, hz = (-1.3, -0.47, 0.345) if wood else (-0.62, -1.15, 0.0)
        hp = cz.empty(name + '_hatpv', (hx, hy, hz), parent=root); hp.rotation_euler = (math.radians(24), math.radians(-10), 0)
        cz.cyl(name + '_hat', 0.22, 0.165, (0, 0, 0), hm, r2=0.016, verts=28, ol=0.006, parent=hp)
        cz.cyl(name + '_hatband', 0.222, 0.016, (0, 0, -0.002), cz.toon(name + '_hatbandm', '#7a5028'), verts=28, ol=0.003, parent=hp)
    # a dried bottle gourd hanging on a peg left of the door, a red string at its waist
    cz.cyl(name + '_peg', 0.018, 0.09, (-0.62, -WY + 0.01, 1.2), dark_w, rot=(90, 0, 0), verts=8, ol=0.003, parent=root)
    gm = cz.toon(name + '_gourd', '#c49a45', tex='grain', tex_strength=0.06)
    gy = -WY - 0.088
    cz.cyl(name + '_cord', 0.006, 0.1, (-0.62, -WY - 0.07, 1.1), cz.toon(name + '_cordm', '#5e4426'), verts=6, ol=0.0, parent=root)
    cz.sphere(name + '_gourdT', 0.052, (-0.62, gy, 1.06), gm, ol=0.005, parent=root, segs=20, rings=10)
    cz.sphere(name + '_gourdB', 0.08, (-0.62, gy, 0.955), gm, ol=0.006, parent=root, segs=24, rings=12)
    cz.cyl(name + '_gourdstr', 0.036, 0.016, (-0.62, gy, 1.0), cz.toon(name + '_redstr', '#b8322a'), verts=16, ol=0.003, parent=root)
    if jar:    # clay water jar on the ground right of the step
        jm = cz.toon(name + '_jarm', '#a65a3c', tex='grain', tex_strength=0.06)
        j = cz.sphere(name + '_jar', 0.15, (0.6, -1.1, 0.13), jm, ol=0.006, parent=root, segs=24, rings=12)
        for v in j.data.vertices: v.co.z *= 0.85
        j.data.update()
        cz.cyl(name + '_jarneck', 0.075, 0.09, (0.6, -1.1, 0.22), jm, r2=0.095, verts=20, ol=0.005, parent=root)
        cz.cyl(name + '_jarwater', 0.07, 0.004, (0.6, -1.1, 0.3115), cz.toon(name + '_water', '#2e4f63'), verts=20, ol=0.0, parent=root)

    # ---- light
    if lit and lamp:
        lt = cz.light(name + '_lamp', 'POINT', (0.1, -1.35, 0.55), color='#ffa24a', power=22, size=0.25)
        lt.parent = root
    return root
