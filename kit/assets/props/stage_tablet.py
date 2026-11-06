# Law tablet for the law stage: a round-topped navy slate stele engraved in gold with Article 16 of Japan's Labor
# Contract Act (the dismissal-abuse rule), standing on a stepped cream marble base with a gold band; a gold finial ball
# on the arch. Print: tex/make_stage.py (stage_tablet.png, 0.62 x 1.15 m).
# Floor prop: root at the floor centre, front faces -Y.
import math, bmesh

META = {'size': (0.9, 0.36, 1.95), 'anchor': 'floor centre', 'animate': [],
        'params': "slate='#1b2342', marble='#ddd2bb', gold='#d2a23e', height=1.55 (slab height above the base)"}

TEX = 'assets/props/tex/'


def build(cz, name='stage_tablet', slate='#1b2342', marble='#ddd2bb', gold='#d2a23e', height=1.55):
    root = cz.empty(name)
    mm = cz.toon(name + '_marble', marble, tex='grain', tex_scale=2.0, tex_strength=0.05)
    gm = cz.toon('stage_gold', gold, tex='grain', tex_scale=3.0, tex_strength=0.04)
    sl = cz.toon(name + '_slate', slate, tex='grain', tex_scale=2.0, tex_strength=0.06)
    cz.box(name + '_base0', (0.9, 0.36, 0.12), (0, 0, 0.06), mm, bevel=0.012, ol=0.007, parent=root)
    cz.box(name + '_base1', (0.8, 0.28, 0.1), (0, 0, 0.17), mm, bevel=0.01, ol=0.006, parent=root)
    cz.box(name + '_band', (0.81, 0.29, 0.025), (0, 0, 0.215), gm, bevel=0.005, ol=0.004, parent=root)
    # round-topped slab: an arch profile extruded 0.12 m in Y
    W, H, T, z0 = 0.74, height, 0.12, 0.22
    prof = [(-W / 2, 0.0), (W / 2, 0.0)]
    n = 16
    for i in range(n + 1):
        a = math.pi * i / n
        prof.append((W / 2 * math.cos(a), H - W / 2 + W / 2 * math.sin(a)))
    bm = bmesh.new()
    fr = [bm.verts.new((x, -T / 2, z0 + z)) for x, z in prof]; bk = [bm.verts.new((x, T / 2, z0 + z)) for x, z in prof]
    bm.faces.new(fr[::-1]); bm.faces.new(bk)
    m = len(prof)
    for i in range(m):
        bm.faces.new((fr[i], fr[(i + 1) % m], bk[(i + 1) % m], bk[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cz.place(cz._mesh_obj(name + '_slab', bm, sl, smooth=False), (0, 0, 0), (0, 0, 0), None, root, 0.008, 0.008)
    # engraved face (1.5 mm proud of the slab front), gold ball on the arch
    cz.plane(name + '_face', 0.62, 1.15, (0, -T / 2 - 0.0015, z0 + 0.1 + 1.15 / 2), cz.toon(name + '_facem', img=TEX + 'stage_tablet.png', lift=0.62),
             parent=root)
    cz.sphere(name + '_finial', 0.06, (0, 0, z0 + H + 0.05), gm, ol=0.004, parent=root, segs=20, rings=10)
    return root
