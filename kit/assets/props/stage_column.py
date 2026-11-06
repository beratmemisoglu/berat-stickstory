# Courthouse column for the law stage: a fluted classical shaft (20 concave flutes, slight taper) in warm cream marble
# on a square plinth with two round base mouldings, a gold astragal ring, a round echinus capital, a gold band and a
# square abacus on top. sconce=True adds a brass wall sconce on the front (-Y) face: back plate, curled arm, cup and a
# glowing frosted globe (bloom point). No light object: the set adds a warm point light at META['light_at'] if wanted.
# Floor prop: root at the floor centre; height = floor to the top of the abacus.
import math, bmesh

META = {'size': (0.72, 0.72, 4.4), 'anchor': 'floor centre', 'animate': [],
        'light_at': 'globe centre (0, -(R + 0.2), sconce_z) local, R ~ 0.24',
        'params': "height=4.4, marble='#ddd2bb', gold='#d2a23e', flutes=20, sconce=False, sconce_z=2.1, glow='#ffd58a'"}


def lathe(cz, name, prof, mat, parent, segs=48, ol=0.006, flutes=0, fdepth=0.0, fk=None, smooth=True):
    """Surface of revolution about Z from (r, z) pairs, capped. flutes: concave channels (depth fdepth * r, scaled per
    ring by fk[i])."""
    bm = bmesh.new(); rings = []
    for j, (r, z) in enumerate(prof):
        ring = []
        k = fk[j] if fk else 1.0
        for i in range(segs):
            a = 2 * math.pi * i / segs
            rr = r
            if flutes:
                u = (flutes * a / (2 * math.pi)) % 1.0
                rr = r * (1 - fdepth * k * math.sin(math.pi * u) ** 0.8)
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        rings.append(ring)
    for ra, rb in zip(rings, rings[1:]):
        for i in range(segs):
            bm.faces.new((ra[i], ra[(i + 1) % segs], rb[(i + 1) % segs], rb[i]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=smooth), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def build(cz, name='stage_column', height=4.4, marble='#ddd2bb', gold='#d2a23e', flutes=20, sconce=False, sconce_z=2.1,
          glow='#ffd58a'):
    root = cz.empty(name)
    mm = cz.toon(name + '_marble', marble, tex='grain', tex_scale=2.0, tex_strength=0.05)
    gm = cz.toon('stage_gold', gold, tex='grain', tex_scale=3.0, tex_strength=0.04)
    H = height
    # plinth + base mouldings (torus, scotia, torus)
    cz.box(name + '_plinth', (0.7, 0.7, 0.22), (0, 0, 0.11), mm, bevel=0.012, ol=0.009, parent=root)
    lathe(cz, name + '_base', [(0.33, 0.22), (0.345, 0.25), (0.33, 0.285), (0.29, 0.295), (0.28, 0.315), (0.3, 0.335),
                                (0.29, 0.36), (0.26, 0.37)], mm, root, ol=0.007)
    # fluted shaft, flutes fade out at both ends
    z0, z1 = 0.37, H - 0.46
    prof = [(0.255, z0), (0.253, z0 + 0.09), (0.245, (z0 + z1) * 0.5), (0.226, z1 - 0.09), (0.224, z1)]
    lathe(cz, name + '_shaft', prof, mm, root, segs=flutes * 6, ol=0.009, flutes=flutes, fdepth=0.075, fk=[0, 1, 1, 1, 0])
    # gold astragal, echinus capital, gold band, abacus
    lathe(cz, name + '_astragal', [(0.222, z1), (0.25, z1 + 0.02), (0.25, z1 + 0.04), (0.222, z1 + 0.06)], gm, root, ol=0.005)
    lathe(cz, name + '_echinus', [(0.226, z1 + 0.06), (0.25, z1 + 0.12), (0.3, z1 + 0.2), (0.33, z1 + 0.24), (0.33, z1 + 0.25)],
          mm, root, ol=0.008)
    cz.box(name + '_band', (0.7, 0.7, 0.05), (0, 0, z1 + 0.275), gm, bevel=0.008, ol=0.006, parent=root)
    cz.box(name + '_abacus', (0.74, 0.74, H - (z1 + 0.3)), (0, 0, (H + z1 + 0.3) / 2), mm, bevel=0.012, ol=0.009, parent=root)
    if sconce:
        R = 0.255 + (0.224 - 0.255) * (sconce_z - z0) / (z1 - z0)
        brass = cz.toon('stage_brass', '#b8862f')
        cz.box(name + '_sc_plate', (0.13, 0.03, 0.26), (0, -R + 0.005, sconce_z - 0.02), brass, bevel=0.008, ol=0.004, parent=root)
        cz.cyl(name + '_sc_arm', 0.018, 0.16, (0, -R - 0.005, sconce_z - 0.05), brass, rot=(90, 0, 0), verts=16, ol=0.003, parent=root)
        cz.cyl(name + '_sc_cup', 0.035, 0.05, (0, -R - 0.17, sconce_z - 0.09), brass, verts=24, r2=0.06, ol=0.004, parent=root)
        cz.sphere(name + '_sc_globe', 0.085, (0, -R - 0.17, sconce_z + 0.03), cz.glow('stage_globe', glow, 6.0), ol=0.004, parent=root,
                  segs=24, rings=12)
    return root
