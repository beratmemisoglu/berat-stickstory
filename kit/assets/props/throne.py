# Emperor's throne on a three-step dais. Dais: three stacked lacquer levels (deep red, 0.15 m steps, each inset on the
# front and both sides) with gold nosing strips on every step front. Throne (on the top level): gold hoof feet, a box
# base with a gold-framed front recess and three gold bosses, a seat board with a gold edge, an imperial-yellow cushion
# with red corner tassels, scroll armrests (rolled gold ends, a gold medallion outside), a tall back board carrying the
# carved dragon-and-cloud panel (PNG from tex/make_throne.py), a crest board (sun disc between clouds) with rolled gold
# scroll ends and a pearl finial. A low footstool in front so a seated character's feet rest on it (legs 0.42 m).
# Floor prop: root = floor centre of the dais FRONT edge (y = 0); the dais goes toward +Y (depth 2.0 m), front -Y.
# Sitting: char at (x 0, y 1.4) facing -Y, char.sit(t, 1.0, feet_y=-0.34, feet_z=0.6): back on the yellow back pillow,
# feet on the footstool (META['seat']).
import math, os

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
STEP = 0.15
SEAT_H = 1.0            # cushion top, from the floor (0.55 above the dais top at 0.45)
FOOT_H = 0.6            # footstool top
TY, BD, BW = 1.46, 0.62, 1.36      # seat board centre y, depth, width

META = {'size': (2.6, 2.0, 2.6), 'anchor': 'floor centre of the dais front edge (dais extends to +Y), front -Y',
        'animate': [],
        'seat': {'height': SEAT_H, 'centre': (0.0, 1.36), 'front_edge_y': TY - BD / 2, 'back_pillow_y': TY + BD / 2 - 0.19,
                 'footstool_top': FOOT_H, 'footstool_y': (0.82, 1.16),
                 'sit_hint': 'char at (root.x, root.y + 1.4) facing -Y, sit(t, 1.0, feet_y=-0.34, feet_z=0.6)', 'dais_top': 3 * STEP, 'steps_front_y': (0.0, 0.3, 0.6)},
        'params': "lacquer='#9a221c' (throne), dais='#4e1411', gold='#c99a2e', cushion='#d9a22a', footstool=True"}


def _disc(cz, nm, r, t, loc, axis, mat, parent, ol=0.0, verts=24, bevel=0.0):
    """Centred disc/cylinder whose axis is 'x', 'y' or 'z'."""
    rot = {'x': (0, 90, 0), 'y': (90, 0, 0), 'z': (0, 0, 0)}[axis]
    return cz.cyl(nm, r, t, loc, mat, rot=rot, verts=verts, bevel=bevel, ol=ol, parent=parent, origin='center')


def build(cz, name='throne', lacquer='#9a221c', dais='#4e1411', gold='#c99a2e', cushion='#d9a22a', footstool=True):
    root = cz.empty(name)
    red = cz.toon(name + '_lacquer', lacquer, tex='grain', tex_strength=0.035)
    dm = cz.toon(name + '_daism', dais, tex='grain', tex_strength=0.04)
    gm = cz.toon(name + '_gold', gold, tex='grain', tex_scale=2.0, tex_strength=0.05)
    dk = cz.toon(name + '_recess', '#6a1713', tex='grain', tex_strength=0.03)

    # ---- dais: three levels, each inset 0.15 m on the sides and 0.3 m at the front, common back at y = 2.0
    DB = 2.0
    for i in range(3):
        w = 2.6 - 0.3 * i; y0 = 0.3 * i; z0 = STEP * i
        cz.box(f'{name}_step{i}', (w, DB - y0, STEP), (0, (y0 + DB) / 2, z0 + STEP / 2), dm, bevel=0.015, ol=0.009, parent=root)
        cz.box(f'{name}_nose{i}', (w - 0.04, 0.008, 0.035), (0, y0 - 0.004, z0 + STEP - 0.028), gm, bevel=0.003, ol=0.003,
               parent=root)
    top = 3 * STEP
    yb0, yb1 = TY - BD / 2, TY + BD / 2
    # ---- throne: gold hoof feet, base, front recess
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        cz.box(f'{name}_foot{i}', (0.15, 0.15, 0.07), (sx * (BW / 2 - 0.1), TY + sy * (BD / 2 - 0.1), top + 0.035), gm,
               bevel=0.025, ol=0.005, parent=root)
    zb0, zb1 = top + 0.07, 0.86
    cz.box(name + '_base', (BW - 0.08, BD - 0.06, zb1 - zb0), (0, TY, (zb0 + zb1) / 2), red, bevel=0.012, ol=0.008, parent=root)
    fy = TY - (BD - 0.06) / 2
    rw, rh, rz = BW - 0.34, 0.2, (zb0 + zb1) / 2
    fb = 0.03                                # gold frame bars 12 mm proud, darker panel 4 mm proud between them
    for k, (sz, loc) in enumerate((((rw + 2 * fb, 0.014, fb), (0, fy - 0.005, rz + rh / 2 + fb / 2)),
                                   ((rw + 2 * fb, 0.014, fb), (0, fy - 0.005, rz - rh / 2 - fb / 2)),
                                   ((fb, 0.014, rh), (-rw / 2 - fb / 2, fy - 0.005, rz)),
                                   ((fb, 0.014, rh), (rw / 2 + fb / 2, fy - 0.005, rz)))):
        cz.box(f'{name}_recessbar{k}', sz, loc, gm, bevel=0.004, ol=0.0035, parent=root)
    cz.box(name + '_recesspanel', (rw + 0.004, 0.008, rh + 0.004), (0, fy, rz), dk, bevel=0.0, ol=0.0, parent=root)
    for k, (bx, br) in enumerate(((-rw * 0.3, 0.045), (0.0, 0.06), (rw * 0.3, 0.045))):
        _disc(cz, f'{name}_boss{k}', br, 0.012, (bx, fy - 0.009, rz), 'y', gm, root, ol=0.003, verts=28, bevel=0.004)
    # seat board + gold front edge
    zs0, zs1 = 0.86, 0.92
    cz.box(name + '_seat', (BW, BD, zs1 - zs0), (0, TY, (zs0 + zs1) / 2), red, bevel=0.012, ol=0.008, parent=root)
    cz.box(name + '_seatedge', (BW - 0.02, 0.008, 0.03), (0, yb0 - 0.004, (zs0 + zs1) / 2), gm, bevel=0.003, ol=0.003, parent=root)
    # cushion (soft, rounded, 2 cm proud of the board front) + corner tassels hanging in front
    cm = cz.toon(name + '_cushionm', cushion, tex='grain', tex_scale=2.0, tex_strength=0.04)
    CW, CD = 1.02, 0.6
    cy0 = yb0 - 0.02
    cz.box(name + '_cushion', (CW, CD, 0.1), (0, cy0 + CD / 2, SEAT_H - 0.045), cm, bevel=0.04, ol=0.007, parent=root)
    tm = cz.toon(name + '_tasselm', '#b8261f')
    for sx in (-1, 1):
        k = 'LR'[sx > 0]; x = sx * (CW / 2 - 0.035); ty = yb0 - 0.036
        cz.sphere(f'{name}_tknot{k}', 0.018, (x, ty, SEAT_H - 0.068), gm, ol=0.002, parent=root, segs=16, rings=8)
        cz.cyl(f'{name}_tassel{k}', 0.011, 0.08, (x, ty, SEAT_H - 0.165), tm, r2=0.019, verts=12, ol=0.0025, parent=root)
    # armrests: side panels, rounded top rail, rolled gold scroll at the front, gold medallion outside
    AH = 0.32
    for sx in (-1, 1):
        k = 'LR'[sx > 0]
        x = sx * (BW / 2 - 0.07)
        cz.box(f'{name}_arm{k}', (0.1, BD - 0.06, AH), (x, TY + 0.03, zs1 + AH / 2), red, bevel=0.012, ol=0.008, parent=root)
        cz.cyl(f'{name}_armrail{k}', 0.055, BD - 0.1, (x, yb0 + 0.06, zs1 + AH), red, rot=(-90, 0, 0), verts=24, bevel=0.01,
               ol=0.007, parent=root)
        sz_ = zs1 + AH - 0.035
        _disc(cz, f'{name}_scroll{k}', 0.095, 0.13, (x, yb0 + 0.06, sz_), 'x', gm, root, ol=0.006, verts=32, bevel=0.012)
        _disc(cz, f'{name}_scrolleye{k}', 0.05, 0.006, (x + sx * 0.0665, yb0 + 0.06, sz_), 'x', red, root, verts=24)
        _disc(cz, f'{name}_medal{k}', 0.07, 0.012, (x + sx * 0.056, TY + 0.06, zs1 + AH * 0.45), 'x', gm, root, ol=0.004,
              verts=28, bevel=0.004)
        _disc(cz, f'{name}_medaleye{k}', 0.036, 0.004, (x + sx * 0.0625, TY + 0.06, zs1 + AH * 0.45), 'x', red, root, verts=20)
    # back board + dragon panel
    BKH = 1.1
    bky0 = yb1 - 0.02                      # back board front face
    bz0 = zs1 - 0.01
    cz.box(name + '_back', (BW - 0.04, 0.11, BKH), (0, bky0 + 0.055, bz0 + BKH / 2), red, bevel=0.015, ol=0.009, parent=root)
    pz0, pz1 = 1.03, bz0 + BKH - 0.035
    ph = pz1 - pz0; pw = ph * 1024 / 896
    cz.plane(name + '_panel', pw, ph, (0, bky0 - 0.0015, (pz0 + pz1) / 2),
             cz.toon(name + '_dragonm', img=os.path.join(TEX, 'throne_dragon.png'), lift=0.55), parent=root)
    # back pillow (makes the 0.6 m deep seat ~0.42 m for a toy-size sitter) with a gold roundel
    bp = cz.box(name + '_backpillow', (0.92, 0.17, 0.38), (0, bky0 - 0.1, SEAT_H + 0.17), cm, rot=(-6, 0, 0), bevel=0.06,
                ol=0.007, parent=root)
    _disc(cz, name + '_roundel', 0.075, 0.008, (0, -0.086, 0.02), 'y', red, bp, ol=0.003, verts=28)
    # crest board, scroll ends, pearl finial
    CH = 0.3; CRW = BW + 0.1
    cz0 = bz0 + BKH - 0.005
    ccy = bky0 + 0.055
    cz.box(name + '_crest', (CRW, 0.13, CH), (0, ccy, cz0 + CH / 2), red, bevel=0.015, ol=0.009, parent=root)
    cw = CRW - 0.06; chh = cw * 320 / 1024
    cz.plane(name + '_crestpic', cw, chh, (0, ccy - 0.065 - 0.0015, cz0 + CH / 2),
             cz.toon(name + '_crestm', img=os.path.join(TEX, 'throne_crest.png'), lift=0.55), parent=root)
    for sx in (-1, 1):
        k = 'LR'[sx > 0]; cx = sx * (CRW / 2 + 0.02); czz = cz0 + CH - 0.02
        _disc(cz, f'{name}_curl{k}', 0.12, 0.17, (cx, ccy, czz), 'y', gm, root, ol=0.007, verts=36, bevel=0.015)
        _disc(cz, f'{name}_curleye{k}', 0.06, 0.006, (cx, ccy - 0.0865, czz), 'y', red, root, verts=28)
    cz.cyl(name + '_finialbase', 0.06, 0.05, (0, ccy, cz0 + CH - 0.005), gm, verts=28, bevel=0.01, ol=0.005, parent=root)
    cz.cyl(name + '_finialcup', 0.045, 0.06, (0, ccy, cz0 + CH + 0.04), gm, r2=0.085, verts=10, bevel=0.008, ol=0.005,
           parent=root)    # 10-sided flared cup = lotus petals
    pz = cz0 + CH + 0.14
    cz.sphere(name + '_pearl', 0.062, (0, ccy, pz), cz.toon(name + '_pearlm', '#e3d3b3'), ol=0.005, parent=root,
              segs=32, rings=16)
    from mathutils import Vector
    for k in range(7):          # gold flame tongues around the pearl (a "flaming pearl", not a ping-pong ball)
        a = math.radians(180 * k / 6)          # fanned over the top half, left to right
        d = Vector((math.cos(a) * 0.9, 0, math.sin(a) * 0.9 + 0.25)).normalized()
        base = Vector((0, ccy, pz)) + d * 0.045
        fl = cz.cyl(f'{name}_flame{k}', 0.024, 0.07 + 0.03 * math.sin(math.pi * k / 6), tuple(base), gm, r2=0.002, verts=12,
                    ol=0.003, parent=root)
        fl.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    # ---- footstool (y 0.82 .. 1.16, top at FOOT_H, 2 cm in front of the throne base)
    if footstool:
        fs_y, fs_d = 0.99, 0.34
        for i, sx in enumerate((-1, 1)):
            cz.box(f'{name}_fsfoot{i}', (0.08, fs_d - 0.04, 0.03), (sx * 0.33, fs_y, top + 0.015), gm, bevel=0.01, ol=0.004,
                   parent=root)
        h = FOOT_H - top - 0.03
        cz.box(name + '_fstool', (0.82, fs_d, h), (0, fs_y, top + 0.03 + h / 2), red, bevel=0.012, ol=0.007, parent=root)
        cz.box(name + '_fsedge', (0.78, 0.008, 0.025), (0, fs_y - fs_d / 2 - 0.004, FOOT_H - 0.022), gm, bevel=0.003, ol=0.003,
               parent=root)
    return root
