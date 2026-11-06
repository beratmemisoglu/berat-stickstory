# Kyle's captain hat (LOTTERY L10, reference f583-660): a white flared crown, black band + glossy black peak, a gold
# anchor badge and a gold cord. Accessory: root = the head CENTRE of a 0.24 m-radius head (parent it to the head
# object at (0, 0, 0)); the hat sits on the crown tilted back a little. Front faces -Y.
import math
import bmesh

META = {'size': (0.56, 0.6, 0.2), 'anchor': 'head centre (parent to <char>_head at 0,0,0); front -Y', 'animate': [],
        'params': 'R=0.24 head radius, tilt=-8 (degrees about X, - = back)'}


def build(cz, name='ld_captain_hat', R=0.24, tilt=-8.0):
    import bpy
    root = cz.empty(name)
    pv = cz.empty(name + '_tilt', (0, 0, 0), parent=root); pv.rotation_euler = (math.radians(tilt), 0, 0)
    white = cz.toon(name + '_white', '#f2f0ea', tex='grain', tex_strength=0.03)
    black = cz.toon(name + '_black', '#1c1a22')
    gold = cz.toon(name + '_gold', '#e8b63a')
    s = R / 0.24
    z0 = 0.175 * s
    cz.cyl(name + '_band', 0.215 * s, 0.075 * s, (0, 0, z0), black, r2=0.222 * s, verts=40, ol=0.005, parent=pv)
    cz.cyl(name + '_crown', 0.222 * s, 0.085 * s, (0, 0.0, z0 + 0.07 * s), white, r2=0.285 * s, verts=40, ol=0.006, parent=pv)
    cz.cyl(name + '_top', 0.285 * s, 0.03 * s, (0, 0.0, z0 + 0.15 * s), white, r2=0.27 * s, verts=40, bevel=0.0, ol=0.006, parent=pv)
    # the peak: a flattened half disc at the front, tipped down
    bm = bmesh.new(); c = bm.verts.new((0, 0, 0)); ring = []
    for i in range(17):
        a = math.pi * i / 16
        ring.append(bm.verts.new((0.235 * s * math.cos(a), -0.11 * s - 0.17 * s * math.sin(a), 0)))
    back = [bm.verts.new((0.235 * s, -0.11 * s, 0)), bm.verts.new((-0.235 * s, -0.11 * s, 0))]
    for a_, b_ in zip(ring[:-1], ring[1:]): bm.faces.new((c, b_, a_))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.016 * s)
    me = bpy.data.meshes.new(name + '_peak'); bm.to_mesh(me); bm.free(); me.materials.append(black)
    pk = bpy.data.objects.new(name + '_peak', me)
    cz.place(pk, (0, -0.07 * s, z0 + 0.01 * s), (18, 0, 0), parent=pv, outline_t=0.004)
    # gold cord across the band front + the badge
    cz.box(name + '_cord', (0.3 * s, 0.012, 0.014 * s), (0, -0.212 * s, z0 + 0.06 * s), gold, bevel=0.003, ol=0.0, parent=pv)
    cz.cyl(name + '_badge', 0.042 * s, 0.014, (0, -0.245 * s, z0 + 0.115 * s), gold, rot=(80, 0, 0), verts=20, ol=0.003, parent=pv, origin='center')
    cz.box(name + '_anchor', (0.012 * s, 0.006, 0.05 * s), (0, -0.254 * s, z0 + 0.115 * s), black, bevel=0.0, ol=0.0, parent=pv)
    cz.box(name + '_anchorx', (0.04 * s, 0.006, 0.01 * s), (0, -0.254 * s, z0 + 0.13 * s), black, bevel=0.0, ol=0.0, parent=pv)
    return root
