# Hanging scroll (calligraphy or painting): the picture mounted on silk (the PNG carries its own brocade mount), on an
# outlined backing so the silk edge reads, a flat wooden top stick, a round bottom roller with gold knob ends sticking
# out past the silk, a hanging cord in a V up to a brass hook in the wall.
# kind='banner': a long silk banner instead (no rollers): a gold pole across the top with knob ends, a swallow-tail
# bottom edge and two red-and-gold tassels hanging from the pole ends.
# Wall prop: back at y = 0, root at the centre of the silk (z = 0 there), front -Y.
import math

META = {'size': (0.7, 0.06, 2.0), 'anchor': 'centre of the silk, back at y = 0', 'animate': [],
        'params': "img='assets/props/tex/hall_scroll_s0.png', w=0.58, h=1.7 (silk), kind='scroll'|'banner', "
                  "roller='#5a2618', knob='#d2a23e', cord=True"}


def _rod(cz, name, a, b, r, mat, parent, verts=8, ol=0.0):
    """A thin cylinder from a to b in the XZ plane (y of a)."""
    dx, dz = b[0] - a[0], b[2] - a[2]; L = math.hypot(dx, dz)
    return cz.cyl(name, r, L, a, mat, rot=(0, math.degrees(math.atan2(dx, dz)), 0), verts=verts, ol=ol, parent=parent)


def build(cz, name='hall_scroll', img='assets/props/tex/hall_scroll_s0.png', w=0.58, h=1.7, kind='scroll', roller='#5a2618',
          knob='#d2a23e', cord=True):
    root = cz.empty(name)
    wood = cz.toon('hall_scroll_wood_' + roller.lstrip('#'), roller, tex='wood', tex_strength=0.05)
    gold = cz.toon('hall_gold', '#d2a23e', tex='grain', tex_scale=3.0, tex_strength=0.04)
    kn = cz.toon('hall_knob_' + knob.lstrip('#'), knob, tex='grain', tex_strength=0.03)
    pic = cz.toon(name + '_picm', img=img, lift=0.72)
    if kind == 'banner':
        # silk with a swallow-tail: the picture plane, its bottom cut by two dark triangles' worth of shape (a V notch)
        import bmesh
        bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
        notch = 0.12 * h
        pts = [(-w / 2, -h / 2), (0, -h / 2 + notch), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
        vs = [bm.verts.new((x, -0.014, z)) for x, z in pts]
        f = bm.faces.new(vs)
        for lp in f.loops: lp[uvl].uv = (lp.vert.co.x / w + 0.5, lp.vert.co.z / h + 0.5)
        o = cz._mesh_obj(name + '_silk', bm, pic, smooth=False); cz.place(o, (0, 0, 0), parent=root)
        bb = bmesh.new()
        vs = [bb.verts.new((x, -0.006, z)) for x, z in pts]; bb.faces.new(vs)
        o2 = cz._mesh_obj(name + '_back', bb, cz.toon('hall_scroll_backm', '#2a2622'), smooth=False)
        s = o2.modifiers.new('thick', 'SOLIDIFY'); s.thickness = 0.006; s.offset = 0
        cz.place(o2, (0, 0, 0), parent=root, outline_t=0.004)
        # the pole + knobs, brackets to the wall
        _rod(cz, name + '_pole', (-w / 2 - 0.08, -0.03, h / 2 + 0.03), (w / 2 + 0.08, -0.03, h / 2 + 0.03), 0.022, gold, root, verts=16, ol=0.004)
        for s_ in (-1, 1):
            cz.sphere(f'{name}_knob{s_}', 0.04, (s_ * (w / 2 + 0.1), -0.03, h / 2 + 0.03), kn, ol=0.004, parent=root, segs=16, rings=8)
            cz.box(f'{name}_brk{s_}', (0.03, 0.05, 0.05), (s_ * (w / 2 - 0.02), -0.012, h / 2 + 0.03), gold, bevel=0.005, ol=0.003, parent=root)
            # tassel: a cord, a red knot, gold collar, red strands
            x = s_ * (w / 2 + 0.1)
            _rod(cz, f'{name}_tcord{s_}', (x, -0.03, h / 2 - 0.25), (x, -0.03, h / 2 + 0.0), 0.006, gold, root, verts=6)
            cz.sphere(f'{name}_tknot{s_}', 0.03, (x, -0.03, h / 2 - 0.27), cz.toon('hall_tassel_red', '#b8291b'), ol=0.003, parent=root, segs=12, rings=6)
            cz.cyl(f'{name}_tcol{s_}', 0.02, 0.03, (x, -0.03, h / 2 - 0.33), gold, verts=12, ol=0.002, parent=root)
            cz.cyl(f'{name}_tstr{s_}', 0.022, 0.2, (x, -0.03, h / 2 - 0.53), cz.toon('hall_tassel_red', '#b8291b'), r2=0.016, verts=12, ol=0.003, parent=root)
        return root
    cz.plane(name + '_silk', w, h, (0, -0.012, 0), pic, parent=root)
    cz.box(name + '_back', (w, 0.008, h), (0, -0.005, 0), cz.toon('hall_scroll_backm', '#2a2622'), bevel=0.0, ol=0.004, parent=root)
    # top stick (flat, a little wider than the silk) and the bottom roller with knob ends
    cz.box(name + '_stick', (w + 0.03, 0.026, 0.04), (0, -0.016, h / 2 + 0.012), wood, bevel=0.006, ol=0.004, parent=root)
    _rod(cz, name + '_roller', (-w / 2 - 0.04, -0.03, -h / 2 - 0.012), (w / 2 + 0.04, -0.03, -h / 2 - 0.012), 0.024, wood, root, verts=16, ol=0.004)
    for s in (-1, 1):
        _rod(cz, f'{name}_knob{s}', (s * (w / 2 + 0.03), -0.03, -h / 2 - 0.012), (s * (w / 2 + 0.085), -0.03, -h / 2 - 0.012), 0.032, kn, root, verts=16, ol=0.004)
    if cord:
        hz = h / 2 + 0.24
        for s in (-1, 1):
            _rod(cz, f'{name}_cord{s}', (s * w * 0.36, -0.02, h / 2 + 0.03), (0, -0.02, hz), 0.005, cz.toon('hall_cord', '#3a2a20'), root, verts=6)
        cz.sphere(name + '_hook', 0.018, (0, -0.012, hz), gold, ol=0.003, parent=root, segs=12, rings=6)
    return root
