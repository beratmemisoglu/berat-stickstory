# E27 "the whole platform like a massive dock" 1401-1495: wide low flight over the sea toward the floating slab,
# low sun behind it with glints on the water; the dock ring of tanks flashes green; whip out at the end (to E28).
F0, F1 = 1401, 1495


def build(ctx):
    import os, sys, math, bpy
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M
    import props_c as P
    t, PR, WL = P.t, P.PR, P.WL
    M.setup(F1, sun_elev=15, sun_rot=181, sun_power=3.4, mb=1.0, haze=0.6, light_k=0.85)
    P.ssr()
    S = P.sea_set(F0, F1, xr_keys=[(t(1452), 0.0), (t(1460), 1.0), (t(1474), 1.0), (t(1480), 0.0)], tanks_from=0.0)
    # the dock's outer rim (a dark steel float ring tying the tank ends together) + its green twin
    bpy.ops.mesh.primitive_torus_add(major_radius=PR + 8.2, minor_radius=0.45, major_segments=160, minor_segments=12, location=(0, 0, WL + 0.1))
    rim = bpy.context.object; rim.name = 'dock_rim'; rim.data.materials.append(M.steel('tank_steel', '#3a3e44', rough=0.35)); rim.data.shade_smooth()
    g = rim.copy(); g.data = rim.data.copy(); g.data.materials[0] = S['xr']; g.scale = (1.01, 1.01, 1.3); bpy.context.scene.collection.objects.link(g)
    # round 3 (Flight v2, matched to the reference curve): the slow continuous push toward the dock (+0.05..0.4 %/f,
    # a quicker push at 1433-1436), hard cut at 1453.5 to the higher view of the green ring, slow drift, then the
    # whip: yaw right + roll (image -x, turns -) and a forward dive (zoom +5 %/f) into E28's hall.
    fl = M.Flight([(t(1400), (-5, -114, WL + 3.1), (0, 0, WL + 8), 26),
              (t(1450), (0, -84, WL + 3.6), (0.5, 0, WL + 8.5), 26),
              (t(1451), (1, -60, WL + 9.5), (0, 0, WL + 6), 26),
              (t(1476), (1.5, -58.5, WL + 9.3), (0, 0, WL + 6.2), 26),
              (t(1488), (2.5, -57.5, WL + 9.0), (0.5, 0, WL + 6.4), 26, 0, True),
              (t(1491), (2.4, -56.5, WL + 8.9), (6, 0, WL + 6.3), 26, -6),
              (t(1496), (1.5, -20, WL + 3.5), (4, 10, WL + 2.5), 20, -4)],
             cuts=[t(1450.5)]); fl.bake(F0, F1)
    return F0, F1
