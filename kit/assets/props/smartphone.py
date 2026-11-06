# Smartphone: chunky rounded-corner phone in a coloured case, a lit screen (cz.screen; default a cartoon social feed of
# the made-up app "pals", tex/make_smartphone.py), side buttons, a camera bump and a sticker on the back.
# Root at the phone's centre, screen facing -Y, long side along Z. Animate the root (held in a hand, picked up, ...).
# kw: screen=PNG path (any picture, drawn edge to edge on the 0.0695 x 0.1495 m face; keep a ~2.8 % dark border and
#     ~7 % rounded inner corners in it for the bezel), on=True (False = dark glass), case='#e86f5a', glow=1.15.
import math, bmesh

META = {'size': (0.075, 0.009, 0.155), 'anchor': 'centre (hand-held: screen -Y, top +Z)', 'animate': [],
        'params': "screen=PNG, on=True|False, case='#rrggbb', glow=1.15"}

TEX = 'assets/props/tex/'


def _ring(w, h, r, seg):
    """Rounded rectangle outline in the XZ plane, counter-clockwise seen from -Y."""
    pts = []
    for cx, cz_, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cz_ + r * math.sin(a)))
    return pts


def _uv(bm, w, h):
    uvl = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for lp in f.loops: lp[uvl].uv = (lp.vert.co.x / w + 0.5, lp.vert.co.z / h + 0.5)


def rslab(cz, name, w, d, h, r, loc, mat, bevel=0.0015, ol=0.003, parent=None, seg=8):
    """Rounded-rectangle slab (w along X, d along Y, h along Z), planar UVs from the front. cz has no rounded box yet."""
    bm = bmesh.new(); ring = _ring(w, h, r, seg)
    fr = [bm.verts.new((x, -d / 2, z)) for x, z in ring]; bk = [bm.verts.new((x, d / 2, z)) for x, z in ring]
    bm.faces.new(fr[::-1]); bm.faces.new(bk)
    n = len(ring)
    for i in range(n):
        f = bm.faces.new((fr[i], fr[(i + 1) % n], bk[(i + 1) % n], bk[i])); f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    _uv(bm, w, h)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=False), loc, (0, 0, 0), None, parent, ol, bevel)


def rplane(cz, name, w, h, r, loc, mat, parent=None, seg=8):
    """Rounded-rectangle card facing -Y, UV 0..1 over its bounds."""
    bm = bmesh.new(); vs = [bm.verts.new((x, 0, z)) for x, z in _ring(w, h, r, seg)]
    bm.faces.new(vs[::-1]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.y > 0: f.normal_flip()
    _uv(bm, w, h)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=False), loc, (0, 0, 0), None, parent, 0.0, 0.0)


def build(cz, name='smartphone', screen=None, on=True, case='#e86f5a', glow=1.15):
    W, D, H, R = 0.075, 0.009, 0.155, 0.011
    root = cz.empty(name)
    cm = cz.toon(name + '_case', case, tex='grain', tex_strength=0.03)
    rslab(cz, name + '_body', W, D, H, R, (0, 0, 0), cm, bevel=0.0018, ol=0.0018, parent=root)
    # screen: rounded card 1.2 mm in front of the case face (bezel + rounded inner corners are in the picture)
    sw, sh = 0.0695, 0.1495
    if on:
        sm = cz.screen(name + '_screenm', screen or TEX + 'smartphone_feed.png', strength=glow)
    else:
        sm = cz.toon(name + '_glassm', img=TEX + 'smartphone_off.png', lift=0.5)
    rplane(cz, name + '_screen', sw, sh, R - (W - sw) / 2, (0, -D / 2 - 0.0012, 0), sm, parent=root)
    # side buttons: power on the right, volume up/down on the left (half sunk into the case)
    bm_ = cz.toon(name + '_btn', '#' + ''.join(f'{int(int(case.lstrip("#")[i:i + 2], 16) * 0.82):02x}' for i in (0, 2, 4)))
    cz.box(name + '_power', (0.003, 0.0045, 0.02), (W / 2 + 0.0004, 0, 0.03), bm_, bevel=0.0008, ol=0.0009, parent=root)
    for i, z in enumerate((0.044, 0.026)):
        cz.box(f'{name}_vol{i}', (0.003, 0.0045, 0.013), (-W / 2 - 0.0004, 0, z), bm_, bevel=0.0008, ol=0.0009, parent=root)
    # camera bump on the back (top-left seen from behind = +X)
    bx, bz = W / 2 - 0.0185, H / 2 - 0.0185
    rslab(cz, name + '_bump', 0.029, 0.0024, 0.029, 0.007, (bx, D / 2 + 0.0008, bz), cz.toon(name + '_bumpm', '#2f3440'),
          bevel=0.0007, ol=0.0012, parent=root)
    ring = cz.toon(name + '_lensring', '#5b6270'); glass = cz.toon(name + '_lensglass', '#22324a')
    for k, (lx, lz) in enumerate(((bx - 0.0062, bz + 0.0062), (bx - 0.0062, bz - 0.0062))):
        cz.cyl(f'{name}_lens{k}', 0.0047, 0.0014, (lx, D / 2 + 0.0019, lz), ring, rot=(-90, 0, 0), verts=32, ol=0.0008, parent=root)
        cz.cyl(f'{name}_glass{k}', 0.0031, 0.0006, (lx, D / 2 + 0.0032, lz), glass, rot=(-90, 0, 0), verts=32, ol=0, parent=root)
        cz.sphere(f'{name}_glint{k}', 0.0008, (lx + 0.0012, D / 2 + 0.0039, lz + 0.0012), cz.glow(name + '_glintm', '#dfe8f5', 1.2), ol=0, parent=root, segs=12, rings=6)
    cz.cyl(name + '_flash', 0.0022, 0.0012, (bx + 0.0068, D / 2 + 0.0019, bz + 0.0062), cz.glow(name + '_flashm', '#fff1c4', 1.0),
           rot=(-90, 0, 0), verts=20, ol=0.0006, parent=root)
    # sticker on the back (die-cut, alpha clipped), 1.2 mm off the case
    st = cz.toon(name + '_stickerm', img=TEX + 'smartphone_sticker.png', alpha_clip=True)
    cz.plane(name + '_sticker', 0.03, 0.03, (-0.012, D / 2 + 0.0012, -0.03), st, rot=(90, 0, 180), parent=root)
    return root
