# BELL film: an 1800s double-hung sash window as a WALL piece (for a dark room lit by the moon through it): painted
# casing (architrave) with a head cap, stool + apron, jamb lining through the wall, two sashes 6-over-6 (3 x 2 panes
# each, real gaps between stiles / rails / muntins so a sun or moon behind it throws the pane pattern), clear glass
# (blended, Fresnel edges, named *glass*, no shadow) with cartoon shine strokes on a few panes, a brass sash lock and
# lifts, a curtain rod with finials, and two lace curtains (alpha-clipped lace, transparent shadows: lace speckles in the
# light) tied back each side with red tiebacks + tassels.
# Wall prop: wall face = the plane y = 0 (casing, stool, rod and curtains proud toward -Y = the room; sashes + lining in
# the hole toward +Y, lining 0.12 m deep), centred on z = 0 (the middle of the opening). It does NOT cut the wall: leave a
# hole of exactly META['opening'] = (w, h) centred on (x 0, z 0) in a wall whose room face is y = 0.
import math, os, subprocess, bmesh
from mathutils import Vector

META = {'size': (1.63, 0.29, 1.79), 'anchor': 'centre of the opening on the wall face y = 0 (room toward -Y, lining 0.12 m into +Y)',
        'opening': (1.0, 1.4), 'depth': 0.12,
        'animate': ['_sash_lower (location z: slide it up to open, 0 .. +0.6 * h/1.4)'],
        'params': "w=1.0, h=1.4 (hole size = META opening), color='#c2b596' (paint), curtains=True, lace='#ece6da', tie='#7a1f24', "
                  "open=0.0 (0..1 lifts the lower sash)"}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
MAKER = os.path.join(TEX, 'make_gb_handprops.py')


def _png(cz, fn, what):
    out = os.path.join(TEX, fn)
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(MAKER): return out
    py = cz.py()
    try:
        subprocess.run([py, MAKER, what], timeout=90, check=True, capture_output=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except Exception as e: print('CZ gb png failed', fn, e)
    return out


def _tube(cz, name, pts, r, mat, parent=None, ol=0.003, sides=10, closed=False, r_end=None):
    """A round tube swept along pts (parallel-transport frames), capped unless closed."""
    bm = bmesh.new(); P = [Vector(p) for p in pts]; n = len(P); rings = []; prev = None
    for i, p in enumerate(P):
        t = (P[(i + 1) % n] - P[i - 1]) if closed else (P[min(i + 1, n - 1)] - P[max(i - 1, 0)])
        t.normalize()
        if prev is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            nr = (ref - t * ref.dot(t)).normalized()
        else: nr = (prev - t * prev.dot(t)).normalized()
        prev = nr; bn = t.cross(nr)
        rr = r if r_end is None else r + (r_end - r) * i / max(1, n - 1)
        rings.append([bm.verts.new(p + (nr * math.cos(2 * math.pi * k / sides) + bn * math.sin(2 * math.pi * k / sides)) * rr) for k in range(sides)])
    for i in range(n if closed else n - 1):
        a, b = rings[i], rings[(i + 1) % n]
        for k in range(sides): bm.faces.new((a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]))
    if not closed: bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _glassmat(cz, name, tint, alpha=0.05, edge=0.3, strength=0.6):
    import bpy
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial'); tr = N.new('ShaderNodeBsdfTransparent')
    em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = cz.col(tint); em.inputs['Strength'].default_value = strength
    lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.3
    k = cz.mth(N, L, 'MINIMUM', cz.mth(N, L, 'MULTIPLY_ADD', lw.outputs['Facing'], edge, alpha), 0.8)
    mx = N.new('ShaderNodeMixShader'); L.new(k, mx.inputs[0]); L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    return m


def _sash(cz, name, parent, Wc, Hs, y, T, mat, bottom_rail, top_rail, glass, shine, shine_panes):
    """A sash Wc x Hs (x centred, z from 0 up) at depth y: stiles, rails, 2 vertical + 1 horizontal muntins, glass."""
    s = cz.empty(name, (0, 0, 0), parent=parent)
    st = 0.05; mw = 0.024
    for k, sx in enumerate((-1, 1)):
        cz.box(f'{name}_stile{k}', (st, T, Hs), (sx * (Wc / 2 - st / 2), y, Hs / 2), mat, bevel=0.004, ol=0.005, parent=s)
    cz.box(f'{name}_rail_b', (Wc - 2 * st + 0.002, T, bottom_rail), (0, y, bottom_rail / 2), mat, bevel=0.004, ol=0.005, parent=s)
    cz.box(f'{name}_rail_t', (Wc - 2 * st + 0.002, T, top_rail), (0, y, Hs - top_rail / 2), mat, bevel=0.004, ol=0.005, parent=s)
    iw, ih = Wc - 2 * st, Hs - bottom_rail - top_rail
    z0 = bottom_rail
    for k in (1, 2):
        cz.box(f'{name}_munv{k}', (mw, T * 0.7, ih + 0.004), (-iw / 2 + iw * k / 3, y, z0 + ih / 2), mat, bevel=0.003, ol=0.003, parent=s)
    cz.box(f'{name}_munh', (iw + 0.004, T * 0.7, mw), (0, y, z0 + ih / 2), mat, bevel=0.003, ol=0.003, parent=s)
    g = cz.plane(f'{name}_glass', iw, ih, (0, y + 0.004, z0 + ih / 2), glass, rot=(90, 0, 0), parent=s)
    g.visible_shadow = False
    pw, ph = iw / 3, ih / 2
    for (i, j) in shine_panes:   # cartoon shine strokes on a few panes, 1.5 mm in front of the glass
        sp = cz.plane(f'{name}_glass_shine{i}{j}', pw * 0.62, ph * 0.62, (-iw / 2 + pw * (i + 0.5), y - 0.0015 + 0.004, z0 + ph * (j + 0.5)),
                      shine, rot=(90, 0, 0), parent=s)
        sp.visible_shadow = False
    return s


def _curtain(cz, name, parent, side, W, H, cw, rod_z, rod_y, mat, hem, tie, tiem, lace_png):
    """Lace panel hanging from the rod, gathered to a tieback at the side; side -1 = left, +1 = right."""
    nu, nv = 18, 30
    x_out = W / 2 + cw + 0.1                 # outer edge |x|
    x_in_top = W / 2 - 0.16                  # top inner edge |x| (covers the outer pane column only)
    z_top, z_bot = rod_z - 0.02, -H / 2 - 0.16
    z_tie = -0.12 * H / 1.4
    t_tie = (z_top - z_tie) / (z_top - z_bot)
    x_tie_in = x_out - 0.13                  # gathered width at the tie
    x_bot_in = x_out - 0.26
    def ease(k): k = max(0.0, min(1.0, k)); return k * k * (3 - 2 * k)
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    grid = []
    for j in range(nv + 1):
        t = j / nv; z = z_top - t * (z_top - z_bot)
        if t <= t_tie:
            k = ease(t / t_tie) ** 0.85; xin = x_in_top + (x_tie_in - x_in_top) * k
        else:
            xin = x_tie_in + (x_bot_in - x_tie_in) * ease((t - t_tie) / (1 - t_tie))
        width = x_out - xin
        amp = 0.012 + 0.03 * max(0.0, 1 - abs(t - t_tie) / 0.35) * (1 - width / (x_out - x_in_top))
        bulge = 0.035 * math.exp(-((t - t_tie) / 0.18) ** 2)    # pulled forward over the tieback
        row = []
        for i in range(nu + 1):
            u = i / nu
            x = x_out - u * width
            y = rod_y + 0.012 - amp * math.sin(u * math.pi * 7) - bulge * math.sin(u * math.pi)
            row.append(bm.verts.new((side * x, y, z)))
        grid.append(row)
    for j in range(nv):
        for i in range(nu):
            q = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
            uv = [(i / nu, 1 - j / nv), ((i + 1) / nu, 1 - j / nv), ((i + 1) / nu, 1 - (j + 1) / nv), (i / nu, 1 - (j + 1) / nv)]
            if side < 0: q, uv = q[::-1], uv[::-1]
            f = bm.faces.new(q)
            for lp, c in zip(f.loops, uv): lp[uvl].uv = c
    for f in bm.faces:
        if f.normal.y > 0: f.normal_flip()
    inner = [tuple(grid[j][nu].co) for j in range(nv + 1)]     # read before the bmesh is freed
    c = cz.place(cz._mesh_obj(f'{name}', bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, 0.0, 0.0)
    # hem along the inner edge + the bottom (a solid edge so the lace reads as a panel)
    _tube(cz, name + '_hem', inner, 0.006, hem, parent, ol=0.002, sides=6)
    # tieback ring round the gathered curtain + a hook on the casing + a tassel
    cx = side * (x_out - 0.065); cy = rod_y + 0.012 - 0.035; zt = z_tie
    ring = [(cx + 0.085 * math.cos(a), cy + 0.042 * math.sin(a), zt + 0.012 * math.sin(2 * a)) for a in [2 * math.pi * k / 24 for k in range(24)]]
    _tube(cz, name + '_tie', ring, 0.012, tiem, parent, ol=0.003, sides=10, closed=True)
    cz.sphere(name + '_tiehook', 0.014, (side * (W / 2 + cw - 0.01), -0.03, zt), tie, ol=0.003, parent=parent, segs=12, rings=8)
    tx = cx - side * 0.02
    _tube(cz, name + '_tasselcord', [(tx, cy - 0.04, zt - 0.01), (tx, cy - 0.044, zt - 0.06)], 0.003, tiem, parent, ol=0.0015, sides=6)
    cz.cyl(name + '_tassel', 0.016, 0.06, (tx, cy - 0.044, zt - 0.12), tiem, r2=0.007, verts=12, ol=0.003, parent=parent)
    return c


def build(cz, name='gb_window', w=1.0, h=1.4, color='#c2b596', curtains=True, lace='#ece6da', tie='#7a1f24', open=0.0):
    W, H = float(w), float(h)
    root = cz.empty(name)
    paint = cz.toon(name + '_paint', color, tex='grain', tex_scale=2.0, tex_strength=0.05)
    sashm = cz.toon(name + '_sashpaint', color, tex='grain', tex_scale=3.0, tex_strength=0.06)
    brass = cz.toon(name + '_brass', '#94691f', tex='grain', tex_scale=5.0, tex_strength=0.07)
    cw, ct = 0.09, 0.026
    # casing: side boards, head board + cap, stool, apron (all outside the opening)
    for k, sx in enumerate((-1, 1)):
        cz.box(f'{name}_casing{k}', (cw, ct, H + cw + 0.0), (sx * (W / 2 + cw / 2), -ct / 2, cw / 2), paint, bevel=0.005, ol=0.007, parent=root)
    cz.box(name + '_head', (W + 2 * cw + 0.03, ct, cw + 0.02), (0, -ct / 2, H / 2 + cw / 2 + 0.01), paint, bevel=0.005, ol=0.007, parent=root)
    cz.box(name + '_headcap', (W + 2 * cw + 0.07, ct + 0.03, 0.03), (0, -(ct + 0.03) / 2, H / 2 + cw + 0.035), paint, bevel=0.006, ol=0.007, parent=root)
    cz.box(name + '_stool', (W + 2 * cw + 0.07, 0.13, 0.032), (0, -0.045, -H / 2 - 0.016), paint, bevel=0.006, ol=0.007, parent=root)
    cz.box(name + '_apron', (W + 2 * cw, ct, 0.09), (0, -ct / 2, -H / 2 - 0.032 - 0.045), paint, bevel=0.005, ol=0.006, parent=root)
    # jamb lining through the wall (inside the opening) + the outer sill
    D = 0.12
    for k, sx in enumerate((-1, 1)):
        cz.box(f'{name}_jamb{k}', (0.022, D, H), (sx * (W / 2 - 0.011), D / 2, 0), paint, bevel=0.003, ol=0.004, parent=root)
    cz.box(name + '_jambhead', (W, D, 0.022), (0, D / 2, H / 2 - 0.011), paint, bevel=0.003, ol=0.004, parent=root)
    cz.box(name + '_sill', (W, D, 0.03), (0, D / 2, -H / 2 + 0.015), paint, bevel=0.003, ol=0.004, parent=root)
    for k, sx in enumerate((-1, 1)):   # parting beads between the two sash tracks
        cz.box(f'{name}_bead{k}', (0.012, 0.012, H - 0.05), (sx * (W / 2 - 0.028), 0.062, 0.0), paint, bevel=0.002, ol=0.002, parent=root)
    # sashes: upper on the outer track, lower on the inner track, meeting rails overlap
    Wc = W - 0.044; Hclear = H - 0.052; z_bot = -H / 2 + 0.03
    Hs = Hclear / 2 + 0.018
    glass = _glassmat(cz, name + '_glassm', '#bcd3e0', alpha=0.05, edge=0.35, strength=0.55)
    shine = cz.toon(name + '_glass_shine_gb_window_glass', img=_png(cz, 'gb_window_glass.png', 'wglass'), alpha_clip=True, lift=0.9)
    up = cz.empty(name + '_sash_upper', (0, 0, z_bot + Hclear - Hs), parent=root)
    _sash(cz, name + '_su', up, Wc, Hs, 0.082, 0.034, sashm, 0.035, 0.05, glass, shine, [(0, 1), (2, 0)])
    lo = cz.empty(name + '_sash_lower', (0, 0, z_bot + open * 0.6 * H / 1.4), parent=root)
    _sash(cz, name + '_sl', lo, Wc, Hs, 0.042, 0.034, sashm, 0.075, 0.035, glass, shine, [(1, 1), (2, 0), (0, 0)])
    # brass sash lock on the meeting rail + two lifts on the lower sash's bottom rail
    zm = Hs - 0.035 / 2
    cz.box(name + '_lock', (0.06, 0.012, 0.012), (0, 0.042 - 0.024, zm + 0.017), brass, bevel=0.003, ol=0.002, parent=lo)
    cz.cyl(name + '_lockcam', 0.016, 0.006, (0.012, 0.042 - 0.03, zm + 0.024), brass, verts=16, ol=0.002, parent=lo)
    for k, sx in enumerate((-1, 1)):
        _tube(cz, f'{name}_lift{k}', [(sx * 0.25, 0.042 - 0.017, 0.045), (sx * 0.25, 0.042 - 0.036, 0.04), (sx * 0.25, 0.042 - 0.036, 0.022),
                                       (sx * 0.25, 0.042 - 0.017, 0.018)], 0.0045, brass, lo, ol=0.0018, sides=8)
    # curtain rod with brackets and finials
    rod_z, rod_y = H / 2 + cw + 0.1, -0.085
    L = W + 2 * cw + 0.34
    wood = cz.toon(name + '_rod', '#4b2b18', tex='wood', tex_scale=4.0, tex_strength=0.1)
    cz.cyl(name + '_rodbar', 0.015, L, (0, rod_y, rod_z), wood, rot=(0, 90, 0), verts=16, ol=0.004, parent=root, origin='center')
    for k, sx in enumerate((-1, 1)):
        cz.sphere(f'{name}_finial{k}', 0.03, (sx * (L / 2 + 0.022), rod_y, rod_z), brass, ol=0.004, parent=root, segs=20, rings=12)
        cz.box(f'{name}_bracket{k}', (0.025, abs(rod_y) + 0.01, 0.025), (sx * (W / 2 + cw + 0.02), rod_y / 2, rod_z), brass, bevel=0.004,
               ol=0.003, parent=root)
        for r in range(4):   # curtain rings on the rod
            x = sx * (W / 2 + cw + 0.09 - r * 0.075)
            pts = [(x, rod_y + 0.022 * math.cos(a), rod_z + 0.022 * math.sin(a)) for a in [2 * math.pi * q / 16 for q in range(16)]]
            _tube(cz, f'{name}_rring{k}{r}', pts, 0.004, brass, root, ol=0.0015, sides=6, closed=True)
    if curtains:
        lp = _png(cz, 'gb_window_lace.png', 'lace')
        lm = cz.toon(name + '_lace_gb_window_lace', img=lp, alpha_clip=True, tint=lace, lift=0.55)
        try: lm.use_transparent_shadow = True
        except Exception: pass
        hem = cz.toon(name + '_hem', lace, tex='grain', tex_strength=0.03)
        tiem = cz.toon(name + '_tiem', tie, tex='grain', tex_scale=4.0, tex_strength=0.08)
        for k, side in enumerate((-1, 1)):
            _curtain(cz, f'{name}_curtain{"LR"[k]}', root, side, W, H, cw, rod_z, rod_y, lm, hem, tie and tiem, tiem, lp)
    return root
