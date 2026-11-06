# Porcelain vase on a carved rosewood stand. Shapes (lathe profiles): 'meiping' (plum vase: broad shoulder, tiny
# neck), 'baluster' (tall, flared trumpet neck), 'gourd' (double gourd), 'jar' (ginger jar with a domed lid + knob).
# Glazes: 'bw' blue-and-white (painted wrap: waves, cloud collar, lotus scroll, petal foot), 'rose' (yellow ground,
# pink flowers), 'teal' (turquoise ground, cream flowers), or plain 'oxblood' / 'celadon' / 'imperial' (yellow) with a
# gold rim. Stand: 'low' (a round stand with a moulded apron and five little cabriole feet), 'tall' (a 0.75 m round
# floor stand: dished top, beaded apron, three S-legs on a ring stretcher) or None.
# Floor / table prop: root = floor centre under the stand; front -Y (the painted wrap's seam faces +Y, the back).
import math, bmesh

META = {'size': (0.5, 0.5, 1.3), 'anchor': 'floor (or table top) centre under the stand', 'animate': [],
        'params': "kind='meiping'|'baluster'|'gourd'|'jar', h=0.7 (vase height), glaze='bw'|'rose'|'teal'|'oxblood'|'celadon'|'imperial', "
                  "stand='low'|'tall'|None"}

PROFILES = {   # (r, z) for a vase of height 1 (r relative to the height), bottom to the lip
    'meiping': [(0.0, 0.0), (0.13, 0.0), (0.14, 0.02), (0.15, 0.08), (0.2, 0.3), (0.255, 0.56), (0.27, 0.68), (0.24, 0.79), (0.15, 0.87),
                (0.07, 0.9), (0.065, 0.95), (0.08, 0.985), (0.075, 1.0), (0.05, 1.0), (0.05, 0.94)],
    'baluster': [(0.0, 0.0), (0.12, 0.0), (0.13, 0.03), (0.12, 0.06), (0.17, 0.18), (0.22, 0.34), (0.215, 0.46), (0.15, 0.56), (0.1, 0.62),
                 (0.095, 0.7), (0.13, 0.86), (0.18, 0.97), (0.185, 1.0), (0.165, 1.0), (0.12, 0.9)],
    'gourd': [(0.0, 0.0), (0.12, 0.0), (0.13, 0.02), (0.2, 0.1), (0.24, 0.22), (0.22, 0.36), (0.13, 0.46), (0.11, 0.5), (0.16, 0.6),
              (0.17, 0.7), (0.13, 0.8), (0.07, 0.88), (0.06, 0.95), (0.07, 1.0), (0.045, 1.0), (0.045, 0.95)],
    'jar': [(0.0, 0.0), (0.18, 0.0), (0.19, 0.02), (0.24, 0.16), (0.3, 0.38), (0.31, 0.5), (0.28, 0.64), (0.2, 0.75), (0.17, 0.78),
            (0.17, 0.8), (0.0, 0.8)],
}
WRAP = {'bw': 'hall_porcelain_bw', 'rose': 'hall_porcelain_rose', 'teal': 'hall_porcelain_teal'}
PLAIN = {'oxblood': '#9c2420', 'celadon': '#8fbfa6', 'imperial': '#e0b23a'}


def lathe(cz, name, prof, mat, parent, segs=40, ol=0.005, loc=(0, 0, 0), scale=1.0, smooth=True):
    """Surface of revolution from (r, z) pairs with UVs (u around, starting at +Y so the seam faces the back; v = z)."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    zs = [z for _, z in prof]; z0, z1 = min(zs), max(zs)
    rings = []
    for r, z in prof:
        ring = []
        for i in range(segs + 1):
            a = math.pi / 2 + 2 * math.pi * i / segs
            ring.append(bm.verts.new((r * scale * math.cos(a), r * scale * math.sin(a), z * scale)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        va, vb = (prof[j][1] - z0) / (z1 - z0 or 1), (prof[j + 1][1] - z0) / (z1 - z0 or 1)
        for i in range(segs):
            q = (rings[j][i], rings[j][i + 1], rings[j + 1][i + 1], rings[j + 1][i])
            if len({v.index for v in q}) < 4 and (prof[j][0] == 0 or prof[j + 1][0] == 0):
                pass
            try: f = bm.faces.new(q)
            except ValueError: continue
            for lp, (u, v) in zip(f.loops, ((i / segs, va), ((i + 1) / segs, va), ((i + 1) / segs, vb), (i / segs, vb))):
                lp[uvl].uv = (u, v)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    o = cz._mesh_obj(name, bm, mat, smooth=smooth)
    return cz.place(o, loc, parent=parent, outline_t=ol)


def _stand(cz, name, kind, r, parent, wood):
    """Returns the height of the stand top."""
    gold = cz.toon('hall_gold', '#d2a23e', tex='grain', tex_scale=3.0, tex_strength=0.04)
    if kind == 'low':
        hgt = 0.1
        cz.cyl(name + '_top', r, 0.03, (0, 0, hgt - 0.03), wood, verts=32, bevel=0.008, ol=0.004, parent=parent)
        cz.cyl(name + '_apron', r * 0.9, 0.04, (0, 0, hgt - 0.07), wood, r2=r * 0.95, verts=32, ol=0.004, parent=parent)
        for k in range(5):
            a = math.radians(90 + 72 * k)
            cz.box(f'{name}_foot{k}', (0.035, 0.035, 0.05), (r * 0.82 * math.cos(a), r * 0.82 * math.sin(a), 0.0), wood, rot=(0, 0, math.degrees(a)),
                   bevel=0.008, ol=0.003, parent=parent, origin='bottom')
        cz.cyl(name + '_bead', r * 1.0, 0.008, (0, 0, hgt - 0.035), gold, verts=32, ol=0.0, parent=parent)
        return hgt
    if kind == 'tall':
        hgt = 0.75
        R = max(r, 0.22)
        cz.cyl(name + '_top', R, 0.04, (0, 0, hgt - 0.04), wood, verts=36, bevel=0.01, ol=0.005, parent=parent)
        cz.cyl(name + '_rim', R * 1.02, 0.014, (0, 0, hgt - 0.03), gold, verts=36, ol=0.0, parent=parent)
        cz.cyl(name + '_apron', R * 0.9, 0.08, (0, 0, hgt - 0.12), wood, verts=36, ol=0.004, parent=parent)
        for k in range(10):
            a = math.radians(90 + 36 * k)
            cz.sphere(f'{name}_bead{k}', 0.014, (R * 0.91 * math.cos(a), R * 0.91 * math.sin(a), hgt - 0.08), gold, ol=0.0, parent=parent, segs=10, rings=5)
        for k in range(3):
            a = math.radians(90 + 120 * k + 60)
            # S-leg: a tapered post bowed outward (two segments) ending in a scroll foot
            px, py = math.cos(a), math.sin(a)
            for s, (z0, z1, r0, r1) in enumerate(((hgt - 0.12, 0.38, R * 0.78, R * 0.95), (0.38, 0.04, R * 0.95, R * 0.82))):
                ax, ay = px * r0, py * r0; bx, by = px * r1, py * r1
                L = math.sqrt((bx - ax) ** 2 + (by - ay) ** 2 + (z1 - z0) ** 2)
                o = cz.cyl(f'{name}_leg{k}_{s}', 0.03, L, (bx, by, z1), wood, verts=10, ol=0.004, parent=parent, r2=0.024 if s else 0.03)
                d = (ax - bx, ay - by, z0 - z1)
                from mathutils import Vector
                o.rotation_euler = Vector(d).to_track_quat('Z', 'Y').to_euler()
            cz.sphere(f'{name}_scroll{k}', 0.04, (px * R * 0.86, py * R * 0.86, 0.04), wood, scale=(1, 1, 0.7), ol=0.004, parent=parent, segs=14, rings=8)
        cz.cyl(name + '_ring', R * 0.78, 0.025, (0, 0, 0.16), wood, verts=36, ol=0.003, parent=parent)
        return hgt
    return 0.0


def build(cz, name='hall_vase', kind='meiping', h=0.7, glaze='bw', stand='low'):
    root = cz.empty(name)
    wood = cz.toon('hall_rosewood', '#4a2218', tex='wood', tex_strength=0.06)
    gold = cz.toon('hall_gold', '#d2a23e', tex='grain', tex_scale=3.0, tex_strength=0.04)
    if glaze in WRAP:
        mat = cz.toon('hall_glaze_' + glaze, img=f'assets/props/tex/{WRAP[glaze]}.png', lift=0.66)
    else:
        mat = cz.toon('hall_glaze_' + glaze, PLAIN.get(glaze, '#9c2420'), tex='grain', tex_strength=0.03)
    prof = PROFILES[kind]
    rmax = max(r for r, _ in prof) * h
    z0 = _stand(cz, name + "_stand", stand, rmax * 0.85 + 0.03, root, wood) if stand else 0.0
    lathe(cz, name + '_body', prof, mat, root, loc=(0, 0, z0), scale=h, ol=0.006 if h > 0.4 else 0.004)
    top = z0 + max(z for _, z in prof) * h
    # dark inside of the mouth
    lip = [r for r, z in prof if abs(z - max(zz for _, zz in prof)) < 1e-6]
    if kind != 'jar':
        rin = min(lip) * h * 0.95
        cz.cyl(name + '_mouth', rin, 0.004, (0, 0, top - 0.012), cz.toon('hall_vase_inside', '#2a2622'), verts=24, ol=0.0, parent=root)
    if glaze not in WRAP:
        # gold rim + a gold band at the shoulder for the plain glazes
        rl = max(lip) * h
        cz.cyl(name + '_rimg', rl * 1.01, 0.012, (0, 0, top - 0.012), gold, verts=32, ol=0.0, parent=root)
    if kind == 'jar':
        # domed lid with a knob
        lid = [(0.0, 0.0), (0.2, 0.0), (0.2, 0.03), (0.17, 0.09), (0.1, 0.13), (0.05, 0.14), (0.05, 0.16), (0.07, 0.19), (0.04, 0.22), (0.0, 0.22)]
        lathe(cz, name + '_lid', lid, mat, root, loc=(0, 0, top), scale=h, ol=0.004)
        cz.cyl(name + '_lidband', 0.205 * h, 0.012, (0, 0, top + 0.005), gold, verts=32, ol=0.0, parent=root)
    return root
