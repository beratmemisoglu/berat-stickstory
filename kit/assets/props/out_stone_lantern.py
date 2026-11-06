# Stone lantern: a chunky granite garden / roadside lantern (~1.25 m): a square plinth, an octagonal drum, a faceted post
# with a ring, a platform, an open firebox (four corner pillars between two slabs, paper panels inside so light shines out
# through the gaps), a pyramid roof with upturned corners and a bud finial; moss on the plinth, a lichen patch.
# lit=True: the paper panels glow warm and (light=True) a warm point light <name>_light inside the firebox throws light
# out through the four openings (light shapes on the ground around it). lit=False: pale paper, no light.
# Floor prop: root at the floor centre; front -Y.
# Animate: <name>_light energy (flicker).
import math

META = {'size': (0.66, 0.66, 1.25), 'anchor': 'floor centre', 'animate': ['_light (energy)'],
        'params': "lit=False, light=True (point light when lit), power=60 (W), stone='#a9a595', moss=True, scale=1.0 (size)"}


def build(cz, name='out_stone_lantern', lit=False, light=True, power=60.0, stone='#a9a595', moss=True, scale=1.0):
    k = scale
    root = cz.empty(name)
    st = cz.toon(f'out_stone_lantern_stone{stone}', stone, tex='grain', tex_scale=2.0, tex_strength=0.09)
    st2 = cz.toon(f'out_stone_lantern_stone2{stone}', _dark(stone, 0.86), tex='grain', tex_scale=2.0, tex_strength=0.08)
    paper = cz.glow('out_stone_lantern_paperlit', '#ffcf7a', 2.4) if lit else cz.toon('out_stone_lantern_paper', '#e9dcc0', tex='paper', tex_strength=0.04)
    z = 0.0
    cz.box(name + '_plinth', (0.5 * k, 0.5 * k, 0.12 * k), (0, 0, 0.06 * k), st2, bevel=0.02 * k, ol=0.006, parent=root)
    z = 0.12 * k
    cz.cyl(name + '_drum', 0.2 * k, 0.1 * k, (0, 0, z), st, verts=8, bevel=0.012 * k, ol=0.006, parent=root, r2=0.17 * k); z += 0.1 * k
    cz.cyl(name + '_post', 0.085 * k, 0.4 * k, (0, 0, z), st, verts=8, bevel=0.008 * k, ol=0.006, parent=root); z += 0.4 * k
    cz.cyl(name + '_ring', 0.11 * k, 0.04 * k, (0, 0, z - 0.2 * k), st2, verts=8, bevel=0.006 * k, ol=0.004, parent=root)
    cz.cyl(name + '_platform', 0.17 * k, 0.07 * k, (0, 0, z), st, verts=8, bevel=0.012 * k, ol=0.006, parent=root, r2=0.24 * k); z += 0.07 * k
    # firebox: bottom slab, four corner pillars, top slab; paper panels set in from each face
    fb = 0.3 * k; fh = 0.26 * k
    cz.box(name + '_fbase', (fb, fb, 0.04 * k), (0, 0, z + 0.02 * k), st, bevel=0.006 * k, ol=0.005, parent=root)
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        cz.box(f'{name}_pillar{i}', (0.06 * k, 0.06 * k, fh), (sx * (fb / 2 - 0.03 * k), sy * (fb / 2 - 0.03 * k), z + 0.04 * k + fh / 2), st,
               bevel=0.008 * k, ol=0.005, parent=root)
    pz = z + 0.04 * k + fh / 2
    for i, (dx, dy, rz) in enumerate(((0, -1, 0), (1, 0, 90), (0, 1, 180), (-1, 0, -90))):
        p = cz.plane(f'{name}_paper{i}', fb - 0.12 * k, fh - 0.03 * k, (dx * (fb / 2 - 0.05 * k), dy * (fb / 2 - 0.05 * k), pz), paper,
                     rot=(90, 0, rz), parent=root)
        p.visible_shadow = False
        # paper lattice: one bar across, one up
        cz.box(f'{name}_bar{i}h', (fb - 0.12 * k, 0.012 * k, 0.014 * k) if dy else (0.012 * k, fb - 0.12 * k, 0.014 * k),
               (dx * (fb / 2 - 0.045 * k), dy * (fb / 2 - 0.045 * k), pz), st2, bevel=0, ol=0.0, parent=root)
        cz.box(f'{name}_bar{i}v', (0.014 * k, 0.012 * k, fh - 0.03 * k) if dy else (0.012 * k, 0.014 * k, fh - 0.03 * k),
               (dx * (fb / 2 - 0.045 * k), dy * (fb / 2 - 0.045 * k), pz), st2, bevel=0, ol=0.0, parent=root)
    z += 0.04 * k + fh
    cz.box(name + '_ftop', (fb + 0.04 * k, fb + 0.04 * k, 0.04 * k), (0, 0, z + 0.02 * k), st, bevel=0.006 * k, ol=0.005, parent=root)
    z += 0.04 * k
    # roof: a square pyramid turned so its edges run to the corners, the four eave corners curling up
    cz.box(name + '_eave', (0.6 * k, 0.6 * k, 0.045 * k), (0, 0, z + 0.0225 * k), st2, bevel=0.012 * k, ol=0.006, parent=root)
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):    # the curled corner tips
        cz.cyl(f'{name}_tip{i}', 0.035 * k, 0.08 * k, (sx * 0.28 * k, sy * 0.28 * k, z + 0.03 * k), st, rot=(-sy * 40, sx * 40, 0), verts=8,
               ol=0.004, parent=root, r2=0.012 * k)
    z += 0.045 * k
    cz.cyl(name + '_roof', 0.4 * k, 0.17 * k, (0, 0, z), st, rot=(0, 0, 45), verts=4, ol=0.007, parent=root, r2=0.045 * k)
    z += 0.17 * k
    cz.cyl(name + '_neck', 0.04 * k, 0.04 * k, (0, 0, z - 0.02 * k), st2, verts=8, ol=0.004, parent=root)
    cz.sphere(name + '_bud', 0.055 * k, (0, 0, z + 0.06 * k), st, ol=0.004, parent=root, segs=12, rings=8)
    cz.cyl(name + '_budtip', 0.03 * k, 0.06 * k, (0, 0, z + 0.1 * k), st, verts=8, ol=0.003, parent=root, r2=0.0)
    if moss:
        mm = cz.toon('out_stone_lantern_moss', '#5f8a3e', tex='grain', tex_strength=0.06)
        for i, (x, y, r) in enumerate(((-0.2, -0.18, 0.07), (0.21, -0.12, 0.05), (0.16, 0.2, 0.06))):
            cz.sphere(f'{name}_moss{i}', r * k, (x * k, y * k, 0.11 * k), mm, scale=None, ol=0.003, parent=root, segs=10, rings=6)
        # a lichen patch stuck on the drum's front face (half sunk into it)
        cz.sphere(name + '_lichen', 0.03 * k, (-0.05 * k, -0.175 * k, 0.17 * k), cz.toon('out_stone_lantern_lichen', '#c8b46a'), ol=0.0,
                  parent=root, segs=8, rings=6)
    for part in ('_drum', '_post', '_ring', '_platform', '_roof'):     # faceted stone, not turned metal
        o = cz.find(name + part)
        if o: o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    if lit and light:
        L = cz.light(name + '_light', 'POINT', (0, 0, pz), color='#ffb45a', power=power, size=0.05)
        L.parent = root
    return root


def _dark(h, k):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return '#' + ''.join(f'{int(x * k):02x}' for x in c)
