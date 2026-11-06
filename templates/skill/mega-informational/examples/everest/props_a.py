# Group A props (E01-E10): excavator, thermal drill rig, plasma beam, sparks, debris chunks, dimension line + label,
# trench terrain helpers. Scale: props in metres (1 unit = 1 m) unless a shot scales the root.
import bpy, bmesh, math, random
import numpy as np
from mathutils import Vector
import cz, mega as M

_MC = {}


def mats():
    """Group A extra materials (made once)."""
    if _MC: return _MC
    _MC.update(
        cat=cat_paint(),
        catdark=M.pbr('a_catdark', '#2a2724', rough=0.6, metal=0.4, noise=0.2),
        track=M.pbr('a_track', '#1d1c1b', rough=0.75, metal=0.6, bump=0.6, bump_scale=30),
        glass=M.pbr('a_glass', '#05080b', rough=0.04, metal=0.3, spec=1.0, coat=1.0),
        chrome=M.pbr('a_chrome', '#d8d8d8', rough=0.15, metal=1.0),
        copper=M.pbr('a_copper', '#d0845a', rough=0.35, metal=0.85, noise=0.25, bump=0.15, bump_scale=20),
        copperdk=M.pbr('a_copperdk', '#8a4a30', rough=0.45, metal=0.8, noise=0.3),
        rail=M.pbr('a_rail', '#3a3d42', rough=0.4, metal=0.9),
        hot=M.emit('a_hot', '#ff2200', 1.5),
        white=M.emit('a_white', '#fff4ec', 3.0),
        beamglow=M.xray('a_beamglow', color='#ff3a20', alpha=0.18, strength=1.2),
        spark=M.emit('a_spark', '#ff5a08', 1.5),
        dim=M.emit('a_dim', '#f4fff4', 1.2),
        gx=M.xray('a_gx', alpha=0.72),
        chunk=M.rock('a_chunk', scale=1.5, bump=1.2),
    )
    return _MC


def _join_parts(name, parts, parent=None):
    """Apply bevels and join static parts into one mesh (fewer draw calls)."""
    objs = [p for p in parts if p and p.type == 'MESH']
    for o in objs:
        for md in list(o.modifiers):
            pass
    j = M.join(name, objs)
    if parent is not None and j is not None:
        mw = j.matrix_world.copy(); j.parent = parent; j.matrix_world = mw
    return j


# ---------------------------------------------------------------- excavator
def _track_loop(name, x, length, h, mat, n=54):
    """Track pads around a stadium loop (in the YZ plane) at side x, joined in one mesh."""
    bm = bmesh.new()
    r = h / 2; straight = length - 2 * r
    per = 2 * straight + 2 * math.pi * r
    for i in range(n):
        s = per * i / n
        if s < straight: y, z, a = -straight / 2 + s, 0, 0
        elif s < straight + math.pi * r:
            th = (s - straight) / r; y, z, a = straight / 2 + r * math.sin(th), r - r * math.cos(th), th
        elif s < 2 * straight + math.pi * r:
            y, z, a = straight / 2 - (s - straight - math.pi * r), 2 * r, math.pi
        else:
            th = (s - 2 * straight - math.pi * r) / r; y, z, a = -straight / 2 - r * math.sin(th), r + r * math.cos(th), math.pi + th
        g = bmesh.ops.create_cube(bm, size=1)['verts']
        for v in g:
            co = Vector((v.co.x * 0.8, v.co.y * per / n * 0.8, v.co.z * 0.11 - 0.055 - (0.05 if v.co.z < 0 and abs(v.co.y) < 0.2 else 0)))
            # grouser bar
            co.rotate(__import__('mathutils').Euler((-a, 0, 0)))
            v.co = co + Vector((x, y, z))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob


def excavator(name, loc=(0, 0, 0), rotz=0.0, scale=1.0, mt=None, glass=True):
    """A big hydraulic excavator (yellow, ~11 m long). Forward = local +Y. Returns dict of pivots for animation:
    root, upper (swing Z), boom (pitch X), stick (pitch X), bucket (pitch X)."""
    m = mt or mats()
    root = cz.empty(name, loc); root.rotation_euler = (0, 0, math.radians(rotz)); root.scale = (scale,) * 3
    st = []
    for sx in (-1.45, 1.45):
        st.append(cz.box(name + '_tf', (0.7, 4.6, 0.7), (sx, 0, 0.55), m['catdark'], bevel=0.08, ol=0))
        for yy in (-2.25, 2.25):
            st.append(cz.cyl(name + '_wh', 0.42, 0.75, (sx - 0.375, yy, 0.5), m['catdark'], rot=(0, 90, 0), verts=16, ol=0))
        for yy in (-1.2, -0.4, 0.4, 1.2):
            st.append(cz.cyl(name + '_rl', 0.16, 0.8, (sx - 0.4, yy, 0.18), m['rail'], rot=(0, 90, 0), verts=10, ol=0))
        st.append(_track_loop(name + '_trk', sx, 5.3, 1.0, m['track']))
    st.append(cz.box(name + '_cb', (2.2, 2.0, 0.5), (0, 0, 0.8), m['catdark'], bevel=0.05, ol=0))
    st.append(cz.cyl(name + '_tt', 1.1, 0.25, (0, 0, 1.05), m['rail'], verts=24, ol=0))
    lower = J(name + '_lower', st); lower.parent = root
    up = cz.empty(name + '_up', (0, 0, 1.3), parent=root)
    u = []
    u.append(cz.box(name + '_house', (2.9, 3.4, 1.3), (0.15, -0.7, 0.65), m['cat'], bevel=0.1, ol=0))
    u.append(cz.box(name + '_cw', (3.0, 1.0, 1.1), (0.15, -2.75, 0.6), m['cat'], bevel=0.25, ol=0))
    u.append(cz.box(name + '_hood', (1.6, 1.8, 0.35), (0.6, -1.4, 1.45), m['cat'], bevel=0.08, ol=0))
    for i in range(6):
        u.append(cz.box(name + '_gr', (1.4, 0.06, 0.05), (0.6, -2.1 + i * 0.25, 1.64), m['catdark'], bevel=0, ol=0))
    u.append(cz.cyl(name + '_ex', 0.08, 0.9, (1.15, -1.9, 1.5), m['catdark'], verts=10, ol=0))
    u.append(cz.box(name + '_step', (0.5, 1.2, 0.08), (-1.55, 0.6, 0.15), m['rail'], bevel=0, ol=0))
    # railings
    for yy in (-2.2, -1.2, -0.2):
        u.append(cz.cyl(name + '_rp', 0.03, 0.6, (1.55, yy, 1.3), m['catdark'], verts=6, ol=0))
    u.append(cz.cyl(name + '_rr', 0.03, 2.1, (1.55, -2.2, 1.9), m['catdark'], rot=(-90, 0, 0), verts=6, ol=0))
    # cab
    u.append(cz.box(name + '_cab', (1.1, 1.7, 1.7), (-0.85, 0.75, 2.15), m['cat'], bevel=0.08, ol=0))
    u.append(cz.box(name + '_roof', (1.2, 1.8, 0.1), (-0.85, 0.75, 3.02), m['catdark'], bevel=0.03, ol=0))
    # cab frame pillars, wipers, mirror, work lights, handrails along the house
    for px, py in ((-1.4, 1.6), (-0.3, 1.6), (-1.4, -0.1), (-0.3, -0.1)):
        u.append(cz.box(name + '_pil', (0.09, 0.09, 1.7), (px, py, 2.15), m['catdark'], bevel=0.01, ol=0))
    u.append(cz.box(name + '_mid', (1.1, 0.07, 0.09), (-0.85, 1.62, 1.68), m['catdark'], bevel=0, ol=0))
    u.append(cz.box(name + '_mir', (0.05, 0.25, 0.35), (-1.6, 1.5, 2.6), m['catdark'], bevel=0.01, ol=0))
    for lx in (-1.2, -0.5):
        u.append(cz.box(name + '_wl', (0.22, 0.12, 0.16), (lx, 1.55, 3.12), m['chrome'], bevel=0.02, ol=0))
    for i in range(7):
        u.append(cz.cyl(name + '_bo', 0.05, 0.04, (1.62, -2.3 + i * 0.5, 0.9), m['chrome'], rot=(0, 90, 0), verts=6, ol=0))
    u.append(cz.box(name + '_tank', (0.9, 1.1, 0.9), (1.05, 0.5, 0.45), m['cat'], bevel=0.06, ol=0))
    u.append(cz.box(name + '_panel', (0.04, 1.6, 0.9), (1.62, -1.2, 0.6), m['catdark'], bevel=0, ol=0))
    for i in range(4):
        u.append(cz.cyl(name + '_gh', 0.025, 0.7, (-1.42, 0.3 + i * 0.001, 1.6 + i * 0.0), m['chrome'], verts=6, ol=0))
    u.append(cz.box(name + '_door', (0.03, 0.9, 1.5), (-1.43, 0.35, 2.1), m['catdark'], bevel=0, ol=0))
    u.append(cz.cyl(name + '_beacon', 0.09, 0.14, (-0.5, 0.2, 3.07), M.emit('a_beacon', '#ffa000', 1.4), verts=10, ol=0))
    for tx in (-1.1, 1.3):
        u.append(cz.box(name + '_tl', (0.25, 0.04, 0.12), (tx, -3.27, 0.95), M.emit('a_tail', '#ff1a00', 1.2), bevel=0, ol=0))
    for i in range(8):
        u.append(cz.box(name + '_vent', (0.05, 0.9, 0.5), (1.62, -2.2 + i * 0.13, 0.65), m['catdark'], bevel=0, ol=0))
    for yy in (-2.3, -1.3, -0.3):
        u.append(cz.cyl(name + '_hr', 0.025, 0.5, (-1.0, yy, 1.3), m['chrome'], verts=6, ol=0))
    u.append(cz.cyl(name + '_hrr', 0.025, 2.1, (-1.0, -2.3, 1.8), m['chrome'], rot=(-90, 0, 0), verts=6, ol=0))
    body = J(name + '_body', u); body.parent = up
    if glass:
        g = [cz.box(name + '_gf', (0.95, 0.04, 1.2), (-0.85, 1.61, 2.3), m['glass'], bevel=0, ol=0),
             cz.box(name + '_gs', (0.04, 1.4, 1.1), (-1.41, 0.75, 2.3), m['glass'], bevel=0, ol=0),
             cz.box(name + '_gs2', (0.04, 1.4, 1.1), (-0.29, 0.75, 2.3), m['glass'], bevel=0, ol=0)]
        gl = J(name + '_glass', g); gl.parent = up
        it = [cz.box(name + '_seat', (0.5, 0.5, 0.15), (-0.85, 0.6, 1.75), m['catdark'], bevel=0.04, ol=0),
              cz.box(name + '_back', (0.5, 0.12, 0.6), (-0.85, 0.35, 2.05), m['catdark'], bevel=0.04, ol=0),
              cz.box(name + '_cons', (0.25, 0.4, 0.5), (-0.5, 1.2, 1.85), m['rail'], bevel=0.03, ol=0),
              cz.cyl(name + '_joy', 0.03, 0.25, (-0.55, 0.9, 1.9), m['catdark'], verts=6, ol=0)]
        J(name + '_interior', it).parent = up
    # boom
    boom = cz.empty(name + '_boom', (0.25, 1.1, 0.9), parent=up)
    b = [cz.box(name + '_b1', (0.75, 3.6, 0.95), (0, 1.8, 0), m['cat'], rot=(0, 0, 0), bevel=0.08, ol=0),
         cz.box(name + '_b2', (0.65, 3.0, 0.8), (0, 4.9, -0.55), m['cat'], rot=(-22, 0, 0), bevel=0.08, ol=0),
         cz.cyl(name + '_bp', 0.2, 0.9, (-0.45, 0, 0), m['chrome'], rot=(0, 90, 0), verts=12, ol=0),
         # boom rams (twin) under the boom
         cz.cyl(name + '_r1', 0.16, 2.2, (0.3, 0.2, -0.75), m['catdark'], rot=(-80, 0, 0), verts=12, ol=0),
         cz.cyl(name + '_r1b', 0.16, 2.2, (-0.3, 0.2, -0.75), m['catdark'], rot=(-80, 0, 0), verts=12, ol=0),
         cz.cyl(name + '_r1c', 0.09, 1.6, (0.3, 2.3, -0.4), m['chrome'], rot=(-80, 0, 0), verts=10, ol=0),
         cz.cyl(name + '_r1d', 0.09, 1.6, (-0.3, 2.3, -0.4), m['chrome'], rot=(-80, 0, 0), verts=10, ol=0),
         # stick ram on top
         cz.cyl(name + '_r2', 0.15, 2.4, (0, 2.4, 0.6), m['catdark'], rot=(-95, 0, 0), verts=12, ol=0),
         cz.cyl(name + '_r2c', 0.08, 1.6, (0, 4.6, 0.6), m['chrome'], rot=(-95, 0, 0), verts=10, ol=0),
         cz.cyl(name + '_hose', 0.05, 5.0, (0.42, 0.5, 0.35), m['catdark'], rot=(-88, 0, 0), verts=6, ol=0)]
    bj = J(name + '_boomm', b); bj.parent = boom
    blk = M.pbr('a_decal', '#0a0a0a', rough=0.6)
    for sx, rz in ((0.39, 90), (-0.39, -90)):
        cz.text(name + '_cz', 'CZ', size=0.62, loc=(sx, 1.9, 0.0), mat=blk, rot=(90, 0, rz), extrude=0.005, parent=boom)
    cz.text(name + '_czw', 'CZ', size=0.55, loc=(0.15, -3.27, 0.6), mat=blk, rot=(90, 0, 0), extrude=0.005, parent=up)
    stick = cz.empty(name + '_stick', (0, 6.2, -1.1), parent=boom)
    s = [cz.box(name + '_s1', (0.55, 3.4, 0.65), (0, 1.6, 0), m['cat'], bevel=0.06, ol=0),
         cz.cyl(name + '_sp', 0.18, 0.8, (-0.4, 0, 0), m['chrome'], rot=(0, 90, 0), verts=12, ol=0),
         cz.cyl(name + '_r3', 0.12, 1.8, (0, 0.4, 0.5), m['catdark'], rot=(-90, 0, 0), verts=10, ol=0),
         cz.cyl(name + '_r3c', 0.06, 1.3, (0, 2.2, 0.5), m['chrome'], rot=(-90, 0, 0), verts=8, ol=0),
         cz.box(name + '_lk', (0.5, 0.6, 0.12), (0, 3.2, 0.35), m['rail'], bevel=0.02, ol=0)]
    # round 3: hydraulic hoses along the stick, grab handles, door frame, beacon, tail lights, engine vents
    for hx in (-0.2, 0.2):
        s.append(cz.cyl(name + '_sh', 0.045, 3.0, (hx, 0.1, 0.42), m['catdark'], rot=(-90, 0, 0), verts=6, ol=0))
        s.append(cz.cyl(name + '_shc', 0.06, 0.12, (hx, 3.1, 0.42), m['chrome'], rot=(-90, 0, 0), verts=8, ol=0))
    sj = J(name + '_stickm', s); sj.parent = stick
    bucket = cz.empty(name + '_bucket', (0, 3.3, 0), parent=stick)
    k = [cz.box(name + '_bk', (1.4, 1.2, 0.08), (0, 0.6, -0.5), m['cat'], rot=(20, 0, 0), bevel=0.02, ol=0),
         cz.box(name + '_bkb', (1.4, 0.08, 1.0), (0, 0.05, -0.1), m['cat'], bevel=0.02, ol=0),
         cz.box(name + '_bkl', (0.08, 1.2, 1.0), (-0.68, 0.55, -0.2), m['cat'], bevel=0.02, ol=0),
         cz.box(name + '_bkr', (0.08, 1.2, 1.0), (0.68, 0.55, -0.2), m['cat'], bevel=0.02, ol=0),
         cz.box(name + '_bkt', (1.4, 0.5, 0.08), (0, 0.25, 0.35), m['cat'], bevel=0.02, ol=0)]
    for i in range(5):
        k.append(cz.box(name + '_th', (0.14, 0.35, 0.12), (-0.56 + i * 0.28, 1.35, -0.78), m['rail'], rot=(20, 0, 0), bevel=0.02, ol=0))
    kj = J(name + '_bucketm', k); kj.parent = bucket
    ex = dict(root=root, upper=up, boom=boom, stick=stick, bucket=bucket)
    pose(ex, 0, 0, 0, 0)
    return ex


def pose(ex, swing, boom, stick, bucket):
    """Degrees: swing about Z, boom pitch (+ up), stick pitch (- folds down), bucket pitch (- curls)."""
    ex['upper'].rotation_euler = (0, 0, math.radians(swing))
    ex['boom'].rotation_euler = (math.radians(25 + boom), 0, 0)
    ex['stick'].rotation_euler = (math.radians(-95 + stick), 0, 0)
    ex['bucket'].rotation_euler = (math.radians(-40 + bucket), 0, 0)


def dig(ex, f0, f1, period=2.4, phase=0.0, swing=25.0, amp=1.0):
    """Bake a digging cycle: boom down + stick pull + bucket curl, lift, swing aside, dump, back."""
    def ph(t): return ((t / period) + phase) % 1.0
    def S(t):  # swing
        p = ph(t); return swing * (0.5 - 0.5 * math.cos(2 * math.pi * p)) * amp
    def B(t):
        p = ph(t); return (-22 * math.cos(2 * math.pi * p) - 5) * amp
    def K(t):
        p = ph(t); return 30 * math.sin(2 * math.pi * p + 0.6) * amp
    def U(t):
        p = ph(t); return (-45 * (0.5 + 0.5 * math.sin(2 * math.pi * p + 1.2)) + 15) * amp
    M.bake_path(ex['upper'], f0, f1, rot=lambda t: (0, 0, S(t)))
    M.bake_path(ex['boom'], f0, f1, rot=lambda t: (74 + B(t) * 0.5, 0, 0))
    M.bake_path(ex['stick'], f0, f1, rot=lambda t: (-95 + K(t), 0, 0))
    M.bake_path(ex['bucket'], f0, f1, rot=lambda t: (-40 + U(t), 0, 0))


# ---------------------------------------------------------------- thermal drill rig
def drill_rig(name, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, mt=None, cable=0.0, glow=True):
    """Copper-orange thermal drill rig, long body pointing local +X, nozzle at +X end (local x ~ 7.6).
    cable > 0: four cables go up that far. Returns the root empty (nozzle empty child 'name_tip')."""
    m = mt or mats()
    root = cz.empty(name, loc); root.rotation_euler = [math.radians(a) for a in rot]; root.scale = (scale,) * 3
    p = []
    p.append(cz.box(name + '_core', (6.0, 1.5, 1.3), (0, 0, 0), m['copper'], bevel=0.12, ol=0))
    p.append(cz.box(name + '_top', (5.2, 1.1, 0.35), (-0.2, 0, 0.8), m['copperdk'], bevel=0.06, ol=0))
    for i in range(14):   # cooling fins
        p.append(cz.box(name + '_fin', (0.08, 1.9, 1.6), (-2.6 + i * 0.32, 0, 0), m['copper'], bevel=0.02, ol=0))
    for sy in (-0.95, 0.95):  # side rails + tanks
        p.append(cz.box(name + '_rail', (6.6, 0.12, 0.18), (0, sy, -0.55), m['rail'], bevel=0.02, ol=0))
        p.append(cz.cyl(name + '_tank', 0.32, 2.6, (-2.9, sy * 1.1, 0.1), m['copperdk'], rot=(0, 90, 0), verts=16, ol=0))
        for i in range(5):
            p.append(cz.cyl(name + '_bolt', 0.06, 0.05, (-2.4 + i * 1.2, sy * 0.79, 0.35), m['chrome'], rot=(90, 0, 0), verts=6, ol=0))
    p.append(cz.box(name + '_head', (1.0, 1.7, 1.6), (3.3, 0, 0), m['copperdk'], bevel=0.1, ol=0))
    p.append(cz.cyl(name + '_cone', 0.6, 1.8, (3.8, 0, 0), m['copper'], rot=(0, 90, 0), r2=0.18, verts=24, ol=0))
    p.append(cz.cyl(name + '_ring', 0.68, 0.15, (3.85, 0, 0), m['rail'], rot=(0, 90, 0), verts=24, ol=0))
    p.append(cz.box(name + '_back', (0.6, 1.3, 1.1), (-3.3, 0, 0), m['rail'], bevel=0.05, ol=0))
    for z in (-0.3, 0.0, 0.3):  # pipes along the body
        p.append(cz.cyl(name + '_pipe', 0.07, 6.0, (-3.0, 0.82, z), m['chrome'], rot=(0, 90, 0), verts=8, ol=0))
    if cable:
        for sx in (-2.4, 2.4):
            for sy in (-0.6, 0.6):
                p.append(cz.cyl(name + '_cab', 0.04, cable, (sx, sy, 0.9), m['rail'], verts=6, ol=0))
    # round 3 machinery detail: motor housing with gear ring, control cab, ladder + railings, hose bundle, hazard band
    p.append(cz.cyl(name + '_motor', 0.75, 1.4, (-1.6, 0, 0.95), m['rail'], verts=20, ol=0))
    for i in range(16):
        a = 2 * math.pi * i / 16
        p.append(cz.box(name + '_gt', (0.12, 0.18, 0.2), (-1.6 + 0.8 * math.cos(a), 0.8 * math.sin(a), 2.0), m['chrome'], rot=(0, 0, math.degrees(a)), bevel=0, ol=0))
    p.append(cz.box(name + '_ccab', (1.0, 0.9, 0.8), (1.6, 0.55, 1.25), m['copperdk'], bevel=0.05, ol=0))
    p.append(cz.box(name + '_cwin', (0.04, 0.7, 0.4), (2.11, 0.55, 1.35), m['glass'], bevel=0, ol=0))
    for i in range(6):
        p.append(cz.box(name + '_lad', (0.04, 0.5, 0.04), (-3.6, -0.35, -0.5 + i * 0.25), m['rail'], bevel=0, ol=0))
    for sx in (-2.8, -0.8, 1.2, 2.8):
        p.append(cz.cyl(name + '_rp', 0.03, 0.55, (sx, -0.95, 0.65), m['rail'], verts=6, ol=0))
    p.append(cz.cyl(name + '_rr', 0.03, 5.6, (-2.8, -0.95, 1.2), m['rail'], rot=(0, 90, 0), verts=6, ol=0))
    for k, z in enumerate((-0.2, -0.05, 0.1, 0.25)):
        p.append(cz.cyl(name + '_hb', 0.05, 5.2, (-2.6, -0.85 - 0.06 * k, z), m['catdark'], rot=(0, 90, 0), verts=6, ol=0))
    for i in range(10):
        p.append(cz.cyl(name + '_bt', 0.05, 0.05, (3.3, -0.82, -0.6 + i * 0.13), m['chrome'], rot=(90, 0, 0), verts=6, ol=0))
    for i in range(5):
        p.append(cz.box(name + '_hz', (0.18, 1.55, 0.05), (2.45 + i * 0.36, 0, 0.67), m['catdark'] if i % 2 else hzm(), rot=(0, 0, 30), bevel=0, ol=0))
    body = M.join(name + '_m', p); body.parent = root
    tip = cz.empty(name + '_tip', (5.65, 0, 0), parent=root)
    if glow:
        g = cz.sphere(name + '_glow', 0.2, (5.6, 0, 0), m['hot'], ol=0, parent=root, segs=12, rings=8)
    return root


def beam(name, length=40.0, r=0.07, mt=None, parent=None, loc=(0, 0, 0)):
    """Plasma beam along local +X: white-hot core + red glow shell. Animate the root's scale.x to extend it."""
    m = mt or mats()
    root = cz.empty(name, loc, parent=parent)
    cz.cyl(name + '_core', r, length, (0, 0, 0), m['white'], rot=(0, 90, 0), verts=12, ol=0, parent=root)
    cz.cyl(name + '_glow', r * 2.6, length, (0, 0, 0), m['beamglow'], rot=(0, 90, 0), verts=16, ol=0, parent=root)
    return root


def spray(name, n=160, length=4.0, cone=35.0, mt=None, seed=1, parent=None, loc=(0, 0, 0), size=0.04):
    """A spray of hot spark streaks along local +X (one joined mesh). Use flicker() to animate it."""
    m = mt or mats()
    rnd = random.Random(seed)
    bm = bmesh.new()
    for i in range(n):
        d = rnd.uniform(0.15, 1.0) ** 0.7 * length
        a = math.radians(rnd.uniform(-cone, cone)); b = rnd.uniform(0, 2 * math.pi)
        dirv = Vector((math.cos(a), math.sin(a) * math.cos(b), math.sin(a) * math.sin(b) - 0.25 * d / length))
        dirv.normalize()
        c = dirv * d
        ln = rnd.uniform(0.1, 0.35) * length * 0.05
        g = bmesh.ops.create_cube(bm, size=1)['verts']
        q = dirv.to_track_quat('X', 'Z')
        for v in g:
            co = Vector((v.co.x * ln, v.co.y * size, v.co.z * size))
            v.co = q @ co + c
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(m['spark'])
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    if parent: ob.parent = parent
    return ob


def flicker(ob, f0, f1, seed=1, s=(0.8, 1.2)):
    rnd = random.Random(seed)
    base = tuple(ob.rotation_euler)
    for f in range(f0 - 1, f1 + 2):
        ob.rotation_euler = (base[0] + rnd.uniform(0, 6.28), base[1], base[2]); ob.keyframe_insert('rotation_euler', frame=f)
        k = rnd.uniform(*s); ob.scale = (k, k, k); ob.keyframe_insert('scale', frame=f)
    _constant(ob)


def chunk(name, r=1.0, mat=None, seed=1, loc=(0, 0, 0), parent=None):
    """Irregular rock chunk (displaced icosphere)."""
    rnd = random.Random(seed)
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
    sx, sy, sz = rnd.uniform(0.7, 1.3), rnd.uniform(0.7, 1.3), rnd.uniform(0.5, 1.0)
    for v in bm.verts:
        k = 1 + 0.25 * math.sin(v.co.x * 3.1 / r + seed) * math.cos(v.co.y * 2.7 / r + seed * 2) + rnd.uniform(-0.08, 0.08)
        v.co = Vector((v.co.x * sx * k, v.co.y * sy * k, v.co.z * sz * k))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(mat or mats()['chunk'])
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob.location = loc
    if parent: ob.parent = parent
    return ob


def falling(objs, f0, f1, top, bottom, seed=3, spread=(2, 2), speed=(6, 12)):
    """Chunks falling in a loop between z top and bottom around their start xy."""
    rnd = random.Random(seed)
    for o in objs:
        x0, y0 = o.location.x, o.location.y
        v = rnd.uniform(*speed); off = rnd.uniform(0, 1); sp = [rnd.uniform(-200, 200) for _ in range(3)]
        H = top - bottom
        M.bake_path(o, f0, f1, pos=lambda t, x0=x0, y0=y0, v=v, off=off: (x0, y0, top - ((t * v + off * H) % H)),
                    rot=lambda t, sp=sp: (t * sp[0], t * sp[1], t * sp[2]))


# ---------------------------------------------------------------- dimension line
def dimension(name, loc, h_fn, f0, f1, label_keys, fmt='{:,.0f} ft', size=1.0, mt=None, rot=(90, 0, 0)):
    """A vertical measuring line from loc (top) down by h_fn(t), end ticks, rotated label counting label_keys.
    The whole thing faces -Y (rotate the root to face the camera)."""
    m = mt or mats()
    root = cz.empty(name, loc); root.rotation_euler = [math.radians(a) for a in (rot[0] - 90, rot[1], rot[2])]
    cz.box(name + '_tt', (size * 1.6, size * 0.12, size * 0.12), (0, 0, 0), m['dim'], bevel=0, ol=0, parent=root)
    line = cz.empty(name + '_ls', (0, 0, 0), parent=root)
    cz.box(name + '_l', (size * 0.12, size * 0.12, 1.0), (0, 0, -0.5), m['dim'], bevel=0, ol=0, parent=line)
    bt = cz.box(name + '_bt', (size * 1.6, size * 0.12, size * 0.12), (0, 0, -1), m['dim'], bevel=0, ol=0, parent=root)
    lab = cz.text(name + '_lab', fmt.format(label_keys[0][1]), size=size * 1.6, loc=(-size * 1.4, 0, -1), mat=m['dim'],
                  rot=(90, -90, 0), extrude=0.0, parent=root)
    lab.data.align_x = 'CENTER'
    M.bake_path(line, f0, f1, scale=lambda t: (1, 1, max(0.01, h_fn(t))))
    M.bake_path(bt, f0, f1, pos=lambda t: (0, 0, -h_fn(t)))
    M.bake_path(lab, f0, f1, pos=lambda t: (-size * 1.4, 0, -h_fn(t) * 0.5))
    M.count_text(lab, fmt, label_keys, f0, f1)
    return root


# ---------------------------------------------------------------- terrain helpers
def trench_ground(name, mat, size=(240, 240), res=(300, 300), width=9.0, depth=14.0, angle=0.0, seed=7, hills=10.0, rough=1.0, bank=0.0):
    """Snowfield with a straight trench (axis along local Y rotated by angle). Steep walls get rock from snow_rock.
    bank: extra height of the u<0 side (a spoil bank: the far wall rises above the camera's rim)."""
    ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    def fn(X, Y):
        u = X * ca + Y * sa
        base = hills * M.fbm(X / 60 + 3, Y / 60 + 9, seed, 6) - hills * 0.5
        base = base * np.clip((np.abs(u) - width) / 40, 0, 1) + rough * (0.6 * M.fbm(X / 4, Y / 4, seed + 3, 4) + 1.6 * M.fbm(X / 9, Y / 22, seed + 5, 5, ridged=True))
        base = base + bank * np.clip((-u - width / 2) / 2.0, 0, 1) * (0.8 + 0.4 * M.fbm(Y / 8, X / 8, seed + 4, 3))
        wall = np.clip((np.abs(u) - width / 2) / 1.2, 0, 1)
        jag = 0.8 * M.fbm(X / 2 + 1, Y / 2 + 4, seed + 9, 4)
        return base * wall - depth * (1 - wall) + jag * (1 - wall)
    return M.heightfield(name, size, res, fn, mat=mat)


def far_range(name, mat, size=1600, res=220, height=120, scale=110, z=-20, inner=150, seed=5):
    """Big jagged snowy ranges on the horizon, flat (hidden below) inside inner radius."""
    f = M.range_fn(height=height, scale=scale, seed=seed)
    def fn(X, Y):
        rr = np.sqrt(X * X + Y * Y)
        return f(X, Y) * np.clip((rr - inner) / (inner * 0.8), 0, 1) - 5
    return M.heightfield(name, size, res, fn, mat=mat, loc=(0, 0, z))


def cloud_cards(name, n, area, z, size=(30, 60), seed=4, flat=True):
    """Cloud cards (Flow clouds.png) lying flat (sea of clouds) or upright."""
    import os
    img = os.path.join(cz.LAB, 'assets', 'mega', 'clouds.png')
    mat = cloud_mat()
    rnd = random.Random(seed); out = []
    for i in range(n):
        w = rnd.uniform(*size)
        x, y = rnd.uniform(area[0][0], area[1][0]), rnd.uniform(area[0][1], area[1][1])
        o = cz.plane(f'{name}{i}', w, w * 0.56, (x, y, z + rnd.uniform(-2, 2)), mat, rot=(0, 0, rnd.uniform(0, 360)) if flat else (90, 0, rnd.uniform(0, 360)), ol=0)
        out.append(o)
    return out


def cloud_mat(name='a_cloudl', strength=0.9):
    """clouds.png has a black background (no alpha): alpha from its luminance, soft emission + diffuse."""
    import os
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = cz.image(os.path.join(cz.LAB, 'assets', 'mega', 'clouds.png'))
    uv = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(uv.outputs['UV'], t.inputs[0])
    bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(t.outputs[0], bw.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.06; mr.inputs['From Max'].default_value = 0.35
    nt.links.new(bw.outputs[0], mr.inputs['Value'])
    d = nt.nodes.new('ShaderNodeBsdfDiffuse'); nt.links.new(t.outputs[0], d.inputs[0])
    e = nt.nodes.new('ShaderNodeEmission'); nt.links.new(t.outputs[0], e.inputs[0]); e.inputs[1].default_value = strength
    ad = nt.nodes.new('ShaderNodeAddShader'); nt.links.new(d.outputs[0], ad.inputs[0]); nt.links.new(e.outputs[0], ad.inputs[1])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(mr.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(ad.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def terrain_mats():
    """Snow terrain with a dirt/rock face for the trench walls and big mountains (texture scales per use)."""
    import os
    T = lambda n: os.path.join(cz.LAB, 'assets', 'mega', n)
    return dict(
        trench=M.snow_rock('a_trenchsnow', thresh=0.62, scale=0.12, img_rock=T('dirt_dark.png'), img_snow=T('snow.png'), bump=0.6),
        peak=M.snow_rock('a_peaksnow', thresh=0.64, scale=0.03, img_rock=T('mountain_rock.png'), img_snow=T('snow.png'), bump=0.4),
    )


def ring_scene(f0, f1, n=10, r_in=13.0, r_out=17.5, depth=18.0, ex_scale=1.25, seed=3):
    """E03/E04: the ring trench round Everest seen from above, n excavators on the outer rim digging inward."""
    tm = terrain_mats()
    mf = M.mountain_fn(peak_h=11, radius=r_in * 1.05, seed=seed, ridge=0.75, sharp=1.3)
    rf = M.range_fn(height=6, scale=14, seed=seed + 4)
    def fn(X, Y):
        rr = np.sqrt(X * X + Y * Y)
        inner = 0.6 + 0.3 * M.fbm(X / 2, Y / 2, seed + 2, 3)
        outer = rf(X, Y) * np.clip((rr - r_out - 6) / 30, 0, 1) + 0.5 * M.fbm(X / 3, Y / 3, seed + 7, 3) + 1.4 * M.fbm(X / 6, Y / 6, seed + 9, 5, ridged=True)
        k_in = np.clip((r_in - rr) / 0.8, 0, 1); k_out = np.clip((rr - r_out) / 0.8, 0, 1)
        floor = -depth + 1.5 * M.fbm(X / 2, Y / 2, seed + 8, 3)
        return np.where(rr < (r_in + r_out) / 2, inner * k_in + floor * (1 - k_in), outer * k_out + floor * (1 - k_out))
    M.heightfield('ringground', 260, 520, fn, mat=tm['trench'])
    import common as C
    C.cap('ringcap', C.mats(), r=r_in - 0.2, z=0.6, h=16, seed=seed)
    far_range('far', tm['peak'], inner=140, height=60, scale=60, z=-5)
    cz.cyl('ringfloor', r_out + 0.5, 1.0, (0, 0, -depth + 0.3), mats()['catdark'], verts=96, ol=0)
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n + 0.2
        rr = r_out + 3.2 * ex_scale / 0.6
        e = excavator(f'rx{i}', loc=(rr * math.cos(a), rr * math.sin(a), 0.4), rotz=math.degrees(a) + 90, scale=ex_scale)
        dig(e, f0, f1, period=1.6 + 0.1 * (i % 3), phase=i * 0.37, swing=-25)
        out.append(e)
    rim_dress(r_out)
    return out


def snowy_mat():
    """Mostly-snow mountains (rock only on the steepest faces) for the aerial shots."""
    import os
    T = lambda n: os.path.join(cz.LAB, 'assets', 'mega', n)
    return M.snow_rock('a_snowy', thresh=0.42, scale=0.03, img_rock=T('mountain_rock.png'), img_snow=T('snow.png'), bump=0.5)


def trench_walls(W=8.0, D=64.0, L=320.0, mt=None, seed=2, res=(110, 300)):
    """E06/E07: the trench seen from inside: two rough basalt walls x=-W / x=+W from z=0 down to -D, a rubble
    floor at -D, snow on the rims. Returns the floor z."""
    import common as C
    mt = mt or C.mats()
    for side, sgn in (('L', 1), ('R', -1)):
        def fn(X, Y, s=seed + (0 if sgn > 0 else 11)):
            # X: local depth axis (maps to -z), Y: along the trench; displacement into the trench
            big = 2.6 * M.fbm(X / 14 + 5, Y / 14 + 1, s, 6)
            strata = 0.8 * M.fbm(X / 2.5 + 2, Y / 30 + 3, s + 2, 4, ridged=True)
            return big + strata - 1.6
        ob = M.heightfield('wall' + side, (D + 8, L), res, fn, mat=mt['rock'])
        ob.rotation_euler = (0, math.radians(90 * sgn), 0)
        ob.location = (-W * sgn, 0, -(D + 8) / 2 * 1 + 4)
    # rim snow + far snowfield on both sides
    tm = terrain_mats()
    for sgn in (1, -1):
        g = M.heightfield('rim' + str(sgn), (200, L), (60, 200), lambda X, Y: 2.5 * M.fbm(X / 9, Y / 9, seed + 30, 5) + np.clip(np.abs(X) - 60, 0, None) * 0.6,
                          mat=tm['peak'], loc=(sgn * (W + 100 - 1.5), 0, 0.8))
    fl = M.heightfield('floor', (2 * W + 6, L), (40, 300), lambda X, Y: 1.2 * M.fbm(X / 1.5, Y / 1.5, seed + 40, 4), mat=mt['ground'], loc=(0, 0, -D))
    return -D


def slab_base(R=40.0, Hs=70.0, n=24, rig_scale=1.0, mt=None, beams=True, seed=3, ring_r=None, beam_on=None, f0=1, f1=400):
    """E08/E09: the slab being cut free: a basalt cylinder radius R standing in its pit, a ring of n drill rigs on the
    pit floor firing plasma beams into its base, a glowing cut line, spark sprays. Returns dict(rigs, beams, sprays)."""
    import common as C
    mt = mt or C.mats(); m = mats()
    body = M.column('slabcol', R, Hs, mat=pit_basalt(), rough=0.035, seed=seed, nu=360, nv=120, loc=(0, 0, -6), pits=1.0)
    rr = ring_r or R + 13 * rig_scale
    M.heightfield('pitfloor', 600, 300, lambda X, Y: 0.8 * M.fbm(X / 3, Y / 3, 4, 4) + np.clip(np.sqrt(X * X + Y * Y) - rr - 30, 0, None) * 0.5,
                  mat=dark_ground(), loc=(0, 0, -0.6))
    cut = cz.cyl('cutline', R + 0.3, 0.22, (0, 0, 2.2 * rig_scale - 0.11), M.emit('a_cut', '#ff4a10', 1.5), verts=160, ol=0)
    out = dict(rigs=[], beams=[], sprays=[], cut=cut, body=body)
    for i in range(n):
        a = 2 * math.pi * i / n
        p = (rr * math.cos(a), rr * math.sin(a), 2.2 * rig_scale)
        rig = drill_rig(f'rig{i}', loc=p, rot=(0, 0, math.degrees(a) + 180), scale=rig_scale)
        # legs / skid under the rig
        cz.box(f'skid{i}', (8, 2.6, 1.2), (0, 0, -1.6), m['rail'], bevel=0.05, ol=0, parent=rig)
        out['rigs'].append(rig)
        if beams:
            L = (rr - R) / rig_scale - 5.6
            b = beam(f'bm{i}', length=L + 0.5, loc=(5.65, 0, 0), parent=rig)
            out['beams'].append(b)
            sp = spray(f'sp{i}', n=420, length=9, cone=85, seed=i, parent=rig, loc=(5.65 + L, 0, 0), size=0.03)
            sp.rotation_euler = (0, 0, math.pi)
            flicker(sp, f0, f1, seed=i)
            out['sprays'].append(sp)
    out['glows'] = impact_glow(out['rigs'], R, rr, rig_scale)
    return out


def cliff_slot(w=14.0, Hc=46.0, depth_back=60.0, mt=None, seed=2, wb=None):
    """E06/E07: the trench seen from the pit floor: a dark basalt cliff (front face at y=0, facing -Y, top z=Hc,
    jagged, snow lip) with the trench slot (width w) cut through it, slot walls going back, lava-cracked ground in
    front. Returns the slot's top z."""
    import common as C
    mt = mt or C.mats()
    def face(name, x0, x1, s):
        def fn(X, Y):   # X across, Y = height (local), displacement toward -Y (local Z -> world -Y)
            return 4.0 * M.fbm(X / 9 + s, Y / 9, seed + s, 6) + 2.4 * M.fbm(X / 1.6, Y / 1.6, seed + s + 3, 5, ridged=True)
        ob = M.heightfield(name, (x1 - x0, Hc), (int((x1 - x0) * 2.2), int(Hc * 2.2)), fn, mat=cliff_rock())
        ob.rotation_euler = (math.radians(90), 0, 0)
        ob.location = ((x0 + x1) / 2, -1.0, Hc / 2)
        # jagged top: push top-row vertices up/down
        co = np.zeros(len(ob.data.vertices) * 3, np.float32); ob.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        top = co[:, 1] > Hc / 2 - 0.3
        rnd = np.random.default_rng(seed + s)
        co[top, 1] += np.repeat(rnd.uniform(-3, 2.5, int(top.sum() // 6 + 1)), 6)[:int(top.sum())]
        ob.data.vertices.foreach_set('co', co.ravel()); ob.data.update()
        return ob
    face('cliffL', -160, -w / 2, 0); face('cliffR', w / 2, 160, 7)
    # slot side walls going back (planes facing into the slot) + cliff body behind
    for sgn in (-1, 1):
        def fn2(X, Y, s=sgn):
            return 0.9 * M.fbm(X / 4 + 9 * s, Y / 4, seed + 20, 5) + 1.4 * M.fbm(X / 1.5, Y / 1.5, seed + 21, 4, ridged=True)
        ob = M.heightfield('slot' + str(sgn), (Hc, depth_back), (90, 120), fn2, mat=cliff_rock())
        ob.rotation_euler = (0, math.radians(-90 * sgn), 0)
        ob.location = (sgn * w / 2, depth_back / 2 - 1, Hc / 2)
    cz.box('cliffbody', (320, depth_back, Hc), (0, depth_back / 2 + 1.5, Hc / 2 - 0.5), mt['rock'], bevel=0, ol=0)
    # carve the slot out of the body: two body halves instead of one
    bpy.data.objects.remove(bpy.data.objects['cliffbody'])
    for sgn in (-1, 1):
        cz.box('body' + str(sgn), (160 - w / 2, depth_back, Hc - 1), (sgn * (80 + w / 4), depth_back / 2 + 1.5, (Hc - 1) / 2), cliff_rock(), bevel=0, ol=0)
    cz.box('slotback', (w + 2, 2, Hc + 2), (0, depth_back - 1, Hc / 2), cliff_rock(), bevel=0, ol=0)
    tm = terrain_mats()
    M.heightfield('snowtop', (320, 260), (160, 120), lambda X, Y: 1.5 * M.fbm(X / 8, Y / 8, seed + 50, 5),
                  mat=tm['peak'], loc=(0, 130 + depth_back, Hc + 0.3))
    for sgn in (-1, 1):
        cz.box('snowlip' + str(sgn), (160 - w / 2, depth_back, 1.2), (sgn * (80 + w / 4), depth_back / 2 + 1.5, Hc + 0.2), tm['peak'], bevel=0.3, ol=0)
    M.heightfield('pitground', (400, 300), (200, 150), lambda X, Y: 0.6 * M.fbm(X / 3, Y / 3, seed + 60, 4) - np.clip(-Y - 120, 0, None) * 0.1,
                  mat=mt['lava'], loc=(0, -150, 0))
    M.heightfield('slotfloor', (w, depth_back), (30, 60), lambda X, Y: 0.6 * M.fbm(X / 2, Y / 2, seed + 61, 4), mat=mt['lava'], loc=(0, depth_back / 2 - 1, 0))
    far_range('far', tm['peak'], size=3000, inner=700, height=160, scale=160, z=Hc - 60)
    cz.box('slotfill', (w, depth_back, 3.0), (0, depth_back / 2, 0.5), mt['rock'], bevel=0, ol=0)
    if wb is not None and wb < w:
        _taper([o for o in bpy.data.objects if o.type == 'MESH' and o.name.split('.')[0] in ('cliffL', 'cliffR', 'slot-1', 'slot1', 'body-1', 'body1', 'slotfloor', 'slotback', 'slotfill')], w, wb, Hc)
    return Hc


def slab_rock():
    """Big-scale dark pitted basalt for the R=40 slab (the shared one tiles too finely at this scale)."""
    import os
    return M.rock('a_slabrock', color='#6a6e7e', dark='#060709', scale=0.1, bump=3.0, pits=True)


def _constant(idb):
    """Stepped keys (no motion-blur smear between random per-frame poses)."""
    ad = getattr(idb, 'animation_data', None)
    if not ad or not ad.action: return
    fcs = []
    try: fcs = list(ad.action.fcurves)
    except Exception:
        for lay in ad.action.layers:
            for st in lay.strips:
                for cb in st.channelbags: fcs += list(cb.fcurves)
    for fc in fcs:
        for k in fc.keyframe_points: k.interpolation = 'CONSTANT'


def cool_fill(energy=0.45, color='#9db8ff', elev=35, rot=120):
    """Blue skylight fill from the shadow side: the reference's blue-shadowed snow."""
    ld = bpy.data.lights.new('coolfill', 'SUN'); ld.energy = energy; ld.color = cz.col(color)[:3]; ld.angle = math.radians(20)
    try: ld.use_shadow = False
    except Exception: pass
    o = bpy.data.objects.new('coolfill', ld); bpy.context.scene.collection.objects.link(o)
    e, r = math.radians(elev), math.radians(rot)
    d = Vector((math.sin(r) * math.cos(e), -math.cos(r) * math.cos(e), math.sin(e)))
    o.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    return o


def drift(objs, f0, f1, v=(0.6, 0.2, 0.0)):
    """Slow cloud drift."""
    for o in objs:
        p0 = tuple(o.location)
        M.bake_path(o, f0, f1, pos=lambda t, p0=p0: (p0[0] + v[0] * t, p0[1] + v[1] * t, p0[2] + v[2] * t))


def cloud_banks(name, center, radius, z, n=18, size=(14, 30), seed=3, f0=1, f1=400, layers=3, avoid=0.0):
    """Billowing cloud banks: upright Flow cloud cards (M.cloud_mat), several stacked layers at different depths,
    each card facing the origin direction roughly, slowly drifting."""
    import os, random
    cm = M.cloud_mat('a_cloudbank', os.path.join(cz.LAB, 'assets', 'mega', 'clouds.png'))
    rnd = random.Random(seed); out = []
    for i in range(n):
        a = rnd.uniform(0, 2 * math.pi); rr = rnd.uniform(avoid, radius)
        for L in range(layers):
            w = rnd.uniform(*size) * (1 - 0.15 * L)
            x = center[0] + rr * math.cos(a) + rnd.uniform(-2, 2); y = center[1] + rr * math.sin(a) + rnd.uniform(-2, 2)
            o = cz.plane(f'{name}{i}_{L}', w, w * 0.56, (x, y, z + L * w * 0.12 + rnd.uniform(-1, 1)), cm,
                         rot=(90, 0, rnd.uniform(-20, 20)), ol=0)
            out.append(o)
    drift(out, f0, f1)
    return out


def _taper(objs, w, wb, Hc, B=12.0):
    """V-shaped slot: pull geometry near the slot edge inward with depth (half width wb/2 at z=0, w/2 at the top)."""
    for o in objs:
        mw = o.matrix_world; inv = mw.inverted()
        for v in o.data.vertices:
            p = mw @ v.co
            ax = abs(p.x)
            if ax > w / 2 + B: continue
            hw = wb / 2 + (w - wb) / 2 * min(1.0, max(0.0, p.z / Hc))
            if ax <= w / 2: nx = ax * hw / (w / 2)
            else: nx = hw + (ax - w / 2) * (w / 2 + B - hw) / B
            p.x = math.copysign(nx, p.x if p.x != 0 else 1)
            v.co = inv @ p
        o.data.update()


def ring_flight(f0, f1, sign=1.0):
    """E03+E04 share one camera (the reference: a fast decelerating orbit over the ring, ~4.5 deg/f, then a dive
    in at 67-72). Flight v2 keys from an (angle, radius, height) schedule round the ring centre."""
    T = lambda fr: (fr - 1) / 30
    sched = [(50, -84, 58, 72), (53, -64, 58, 74), (55, -53, 57, 75), (57, -45, 56, 76), (59, -38, 56, 76),
             (63, -25, 55, 74), (66.3, -14, 54, 72), (67.3, -10, 51, 68), (68.4, -1, 40, 53, 1), (70.6, -0.9, 39.8, 52.8, 1), (71.4, 4, 31, 41, 1), (73, 4.1, 30.8, 40.8, 1)]
    keys = []
    for fr, a, r, h, *hold in sched:
        aa = math.radians(a * sign)
        ty = -6 + max(0.0, 54 - r) * 0.9
        keys.append((T(fr), (r * math.sin(aa), -r * math.cos(aa), h), (ty * -math.sin(aa) * 0, ty * 1.0, 0), 22, 0, bool(hold)))
    return M.Flight(keys, smooth=0.45).bake(f0, f1)


def cliff_dress(w=14.0, Hc=46.0, depth_back=60.0, seed=9):
    """Enrich pass (E06/E07 enriched targets): rubble + boulders on the pit floor in front of the cliff, boulders on
    the cliff top, ledges on the face, steel cable runs with small red marker lamps down the slot walls, dust haze."""
    rnd = random.Random(seed); m = mats()
    dirt = M.pbr('a_rubble', '#5a5148', rough=0.9, bump=0.8, bump_scale=6, noise=0.5)
    parts = []
    for i in range(160):          # floor rubble, denser near the cliff foot
        y = -abs(rnd.gauss(0, 14)) - 3; x = rnd.uniform(-60, 60)
        r = rnd.uniform(0.15, 1.1) * (1.6 if rnd.random() < 0.08 else 1)
        parts.append(chunk(f'rb{i}', r, mat=dirt if rnd.random() < 0.6 else None, seed=i + 100, loc=(x, y, r * 0.3)))
    for i in range(40):           # boulders along the cliff top
        x = rnd.choice((-1, 1)) * rnd.uniform(w / 2 + 2, 60); y = rnd.uniform(2, 40)
        r = rnd.uniform(0.6, 2.2)
        parts.append(chunk(f'tb{i}', r, mat=dirt, seed=i + 300, loc=(x, y, Hc + r * 0.3)))
    M.join('rubble', parts)
    lamp = M.emit('a_lamp', '#ff2a10', 1.5)
    c = []
    for sgn in (-1, 1):           # cable runs down the slot walls + marker lamps
        for k in range(3):
            y = 4 + k * 9
            c.append(cz.cyl(f'cb{sgn}{k}', 0.08, Hc, (sgn * (w / 2 - 0.6), y, 0), m['rail'], verts=6, ol=0))
            for z in range(4, int(Hc), 7):
                c.append(cz.box(f'cl{sgn}{k}{z}', (0.3, 0.3, 0.15), (sgn * (w / 2 - 0.55), y, z), m['rail'], bevel=0, ol=0))
                c.append(cz.sphere(f'lp{sgn}{k}{z}', 0.12, (sgn * (w / 2 - 0.75), y - 0.2, z + 0.2), lamp, ol=0, segs=8, rings=6))
    M.join('slotcables', c)


def cliff_rock():
    """Enriched-target cliff rock: warm brown-grey, lumpy, high-contrast (dirt texture + rock pits + strong bump)."""
    import os
    m = M.pbr('a_cliffrock', '#6b6257', rough=0.92, img=os.path.join(cz.LAB, 'assets', 'mega', 'mountain_rock.png'), scale=0.08,
              bump=1.6, bump_scale=3.0, tint='#d8c2a8')
    return m


def hzm():
    """Hazard-stripe yellow for rig bands."""
    return M.pbr('a_hzy', '#f0b818', rough=0.5, metal=0.1)


def dark_basalt():
    """Lighting pass E08-E10: near-black lumpy basalt like the reference slab (Flow basalt darkened + strong bump)."""
    import os
    return M.pbr('a_darkbasalt', '#222228', rough=0.85, img=os.path.join(cz.LAB, 'assets', 'mega', 'basalt.png'), scale=0.35,
                 bump=2.4, bump_scale=4.0, tint='#9a9aa8')


def dark_ground():
    import os
    return M.pbr('a_darkground', '#2a2a2e', rough=0.95, img=os.path.join(cz.LAB, 'assets', 'mega', 'dirt_dark.png'), scale=0.06,
                 bump=0.9, bump_scale=2.0, tint='#a0a0a6')


def pit_basalt():
    """The reference's pitted slab: dense dark voronoi pits + lumps (procedural, scale tuned for R=10..40)."""
    return M.rock('a_pitbasalt', color='#4c4d55', dark='#0b0b0e', scale=0.18, bump=2.6, pits=True)


def rim_dress(r_out=17.5, n=260, seed=12):
    """Enrich E03/E04: dark spoil and rubble round the ring rim, dirt mounds, caterpillar tracks in the snow."""
    rnd = random.Random(seed)
    dirt = M.pbr('a_spoil', '#3a342e', rough=0.95, bump=0.7, bump_scale=5, noise=0.5)
    parts = []
    for i in range(n):
        a = rnd.uniform(0, 2 * math.pi); rr = r_out + abs(rnd.gauss(0, 3.5)) + 0.5
        s = rnd.uniform(0.15, 0.7)
        parts.append(chunk(f'sp{i}', s * 0.9, mat=dirt, seed=i + 700, loc=(rr * math.cos(a), rr * math.sin(a), 1.2)))
    for i in range(14):
        a = rnd.uniform(0, 2 * math.pi); rr = r_out + rnd.uniform(2, 6)
        parts.append(chunk(f'md{i}', rnd.uniform(0.9, 1.5), mat=dirt, seed=i + 900, loc=(rr * math.cos(a), rr * math.sin(a), 0.6)))
    tr = M.pbr('a_tracks', '#9aa6b8', rough=0.9)
    for k in range(10):           # track paths: pairs of long thin dark strips curving out from the rim
        a0 = 2 * math.pi * k / 10 + 0.5
        for j in range(18):
            rr = r_out + 6 + j * 2.2; a = a0 + j * 0.03
            for off in (-0.9, 0.9):
                parts.append(cz.box(f'tk{k}_{j}{off}', (0.5, 2.3, 0.04), ((rr) * math.cos(a) - off * math.sin(a), rr * math.sin(a) + off * math.cos(a), 0.45), tr, rot=(0, 0, math.degrees(a) - 90), bevel=0, ol=0))
    M.join('rimdress', parts)


def impact_glow(rigs, R, rr, rig_scale, seed=3):
    """Enrich E08/E09: white-hot impact glow + scorch where each beam meets the rock, cables on the ground."""
    hot = M.emit('a_impact', '#ff5a08', 1.5)
    scorch = M.pbr('a_scorch', '#0a0806', rough=0.9)
    cab = M.pbr('a_cable', '#0c0c0e', rough=0.6)
    rnd = random.Random(seed); parts = []; glows = []
    z = 2.2 * rig_scale
    for i, rig in enumerate(rigs):
        a = math.atan2(rig.location.y, rig.location.x)
        p = (R * 1.01 * math.cos(a), R * 1.01 * math.sin(a), z)
        glows.append(cz.sphere(f'imp{i}', 0.38, p, hot, ol=0, segs=12, rings=8))
        parts.append(cz.cyl(f'sc{i}', 2.2, 0.05, (R * 1.002 * math.cos(a), R * 1.002 * math.sin(a), z), scorch,
                            rot=(0, 90, math.degrees(a)), verts=16, ol=0))
        for k in range(3):        # cables snaking from each rig outward
            pts = []
            for j in range(10):
                rad = rr + 2 + j * 2.4; aa = a + 0.03 * k + 0.05 * math.sin(j * 0.9 + k + i)
                pts.append((rad * math.cos(aa), rad * math.sin(aa), 0.1))
            for (x0, y0, z0), (x1, y1, z1) in zip(pts, pts[1:]):
                L = math.hypot(x1 - x0, y1 - y0)
                parts.append(cz.cyl(f'cb{i}{k}', 0.09, L, (x0, y0, z0), cab, rot=(-90, 0, math.degrees(math.atan2(y1 - y0, x1 - x0)) - 90), verts=6, ol=0))
    M.join('impactdress', parts)
    return glows


def J(name, objs):
    """Join that KEEPS each part's bevel (M.join drops the modifiers of every part but the first): bake the
    evaluated mesh of each part first."""
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o and o.type == 'MESH' and o.modifiers:
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); o.modifiers.clear(); o.data = me
    return M.join(name, objs)


def cat_paint():
    """Worn yellow machine paint: roughness ~0.5, metallic 0.15, dirt in crevices (AO), mud on the lower half
    (object Z), worn lighter speckle, fine bump."""
    m = bpy.data.materials.get('a_catpaint')
    if m: return m
    m = bpy.data.materials.new('a_catpaint'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear(); L = nt.links.new
    o = nt.nodes.new('ShaderNodeOutputMaterial'); p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    p.inputs['Metallic'].default_value = 0.15
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 6; nz.inputs['Detail'].default_value = 8
    L(tc.outputs['Object'], nz.inputs[0])
    ao = nt.nodes.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = 0.4
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); L(tc.outputs['Object'], sep.inputs[0])
    mud = nt.nodes.new('ShaderNodeMapRange'); mud.inputs['From Min'].default_value = 1.5; mud.inputs['From Max'].default_value = 0.0
    L(sep.outputs['Z'], mud.inputs['Value'])
    paint = nt.nodes.new('ShaderNodeMix'); paint.data_type = 'RGBA'
    paint.inputs[6].default_value = cz.col('#c98a10'); paint.inputs[7].default_value = cz.col('#f3a20e')
    L(nz.outputs['Fac'], paint.inputs[0])
    dirt = nt.nodes.new('ShaderNodeMix'); dirt.data_type = 'RGBA'; dirt.inputs[7].default_value = cz.col('#3b2e1e')
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; L(ao.outputs['AO'], inv.inputs[1])
    df = nt.nodes.new('ShaderNodeMath'); df.operation = 'MULTIPLY_ADD'; L(inv.outputs[0], df.inputs[0]); df.inputs[1].default_value = 1.4
    L(mud.outputs[0], df.inputs[2])
    cl = nt.nodes.new('ShaderNodeClamp'); L(df.outputs[0], cl.inputs[0])
    nz2 = nt.nodes.new('ShaderNodeTexNoise'); nz2.inputs['Scale'].default_value = 11; nz2.inputs['Detail'].default_value = 10; L(tc.outputs['Object'], nz2.inputs[0])
    mm = nt.nodes.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; L(cl.outputs[0], mm.inputs[0]); L(nz2.outputs['Fac'], mm.inputs[1])
    mm2 = nt.nodes.new('ShaderNodeMath'); mm2.operation = 'MULTIPLY'; L(mm.outputs[0], mm2.inputs[0]); mm2.inputs[1].default_value = 1.25
    L(mm2.outputs[0], dirt.inputs[0]); L(paint.outputs[2], dirt.inputs[6])
    wear = nt.nodes.new('ShaderNodeTexNoise'); wear.inputs['Scale'].default_value = 40; L(tc.outputs['Object'], wear.inputs[0])
    wr = nt.nodes.new('ShaderNodeMapRange'); wr.inputs['From Min'].default_value = 0.66; wr.inputs['From Max'].default_value = 0.7
    L(wear.outputs['Fac'], wr.inputs['Value'])
    wm = nt.nodes.new('ShaderNodeMix'); wm.data_type = 'RGBA'; wm.inputs[7].default_value = cz.col('#8d8a84')
    L(wr.outputs[0], wm.inputs[0]); L(dirt.outputs[2], wm.inputs[6])
    L(wm.outputs[2], p.inputs['Base Color'])
    rg = nt.nodes.new('ShaderNodeMapRange'); rg.inputs['To Min'].default_value = 0.45; rg.inputs['To Max'].default_value = 0.85
    L(mm2.outputs[0], rg.inputs['Value']); L(rg.outputs[0], p.inputs['Roughness'])
    bn = nt.nodes.new('ShaderNodeTexNoise'); bn.inputs['Scale'].default_value = 25; L(tc.outputs['Object'], bn.inputs[0])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.15; L(bn.outputs['Fac'], b.inputs['Height']); L(b.outputs[0], p.inputs['Normal'])
    L(p.outputs[0], o.inputs[0])
    return m
