# Green enamel pendant lamp (LOTTERY, over the counter): a wide shallow cone shade, dark green enamel outside with a
# rolled dark rim, a warm cream reflector inside (its own cone just inside the shell, lightly glowing), a glowing warm
# bulb (material lt_bulb, emission) under a brass socket, a black cord up to a ceiling canopy. Root = the ceiling
# attachment point (z = 0 = the ceiling surface); the shade hangs `drop` metres below. It swings about the root: pivot
# <name>_swing (rotation_euler.x / .y radians). No light object: the set adds the lamp (parent it to <name>_swing).
import math

META = {'size': (0.46, 0.46, 'drop + 0.2'), 'anchor': 'ceiling attachment (top), hangs toward -Z',
        'animate': ['_swing (rotation_euler.x / .y about the canopy)', '_bulbpos (empty at the bulb)'],
        'params': "drop=0.75 (cord length), shade='#1f5a3c', r=0.23, bulb=6.0 (emission strength)"}
PROF = [(0.05, 0.0), (0.09, -0.03), (0.15, -0.07), (0.2, -0.11), (0.23, -0.15)]


def _cone(cz, name, prof, mat, parent, z, flip=False, ol=0.0):
    import bmesh
    bm = bmesh.new(); NU = 64; rings = []
    for (rr, zz) in prof:
        rings.append([bm.verts.new((rr * math.cos(2 * math.pi * i / NU), rr * math.sin(2 * math.pi * i / NU), zz)) for i in range(NU)])
    for j in range(len(rings) - 1):
        for i in range(NU):
            f = (rings[j][i], rings[j][(i + 1) % NU], rings[j + 1][(i + 1) % NU], rings[j + 1][i])
            bm.faces.new(f[::-1] if flip else f)
    cap = list(reversed(rings[0])) if not flip else list(rings[0])
    bm.faces.new(cap)
    o = cz._mesh_obj(name, bm, mat); cz.place(o, (0, 0, z), parent=parent)
    if ol: cz.outline(o, ol)
    return o


def build(cz, name='lt_pendant', drop=0.75, shade='#1f5a3c', r=0.23, bulb=6.0):
    root = cz.empty(name)
    sw = cz.empty(name + '_swing', parent=root)
    blk = cz.toon(name + '_cordm', '#141210')
    cz.cyl(name + '_canopy', 0.06, 0.035, (0, 0, -0.035), cz.toon(name + '_canm', '#2a2c2a'), bevel=0.008, ol=0.004, parent=root, verts=24)
    cz.cyl(name + '_cord', 0.006, drop, (0, 0, -drop), blk, ol=0.0, parent=sw, verts=10)
    z = -drop
    g = cz.toon(name + '_enamel', shade, tex='grain', tex_strength=0.05)
    cz.cyl(name + '_cap', 0.045, 0.06, (0, 0, z - 0.05), g, r2=0.035, bevel=0.01, ol=0.005, parent=sw, verts=32)
    k = r / 0.23
    prof = [(a * k, b) for a, b in PROF]
    # outer enamel shell (normals out, outlined) + the cream reflector a few mm inside it (normals in, no outline)
    _cone(cz, name + '_shade', prof, g, sw, z - 0.04, ol=0.008)
    inner = [(max(0.01, a - 0.008), b - 0.004) for a, b in prof]
    _cone(cz, name + '_inside', inner, cz.toon(name + '_insidem', '#d8b878', lift=0.5, emit=0.25), sw, z - 0.04, flip=True)
    # rolled rim: an open band (a capped cylinder here closed the shade into a green disc: the bulb vanished)
    rim = cz.cyl(name + '_rim', r + 0.008, 0.018, (0, 0, z - 0.04 - 0.16), cz.toon(name + '_rimm', '#163f2b'), r2=r + 0.008, ol=0.0, parent=sw, verts=64)
    import bmesh
    bm = bmesh.new(); bm.from_mesh(rim.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if abs(f.normal.z) > 0.9], context='FACES_ONLY')
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.012)
    bm.to_mesh(rim.data); bm.free(); cz.outline(rim, 0.007)
    cz.cyl(name + '_socket', 0.03, 0.05, (0, 0, z - 0.12), cz.toon(name + '_sockm', '#c9a86a'), ol=0.003, parent=sw, verts=20)
    cz.sphere(name + '_bulb', 0.055, (0, 0, z - 0.17), cz.glow('lt_bulb', '#fff1c8', bulb), ol=0.0, parent=sw, segs=24, rings=12)
    cz.empty(name + '_bulbpos', (0, 0, z - 0.2), parent=sw)
    return root
