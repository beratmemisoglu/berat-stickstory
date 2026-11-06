# R21 "The snow melts, runs down to the cold edge, and freezes into a wall of ice that pushes water back up under
# your shingles" 1396-1570 (section at the -X end of the front slope)
F0, F1 = 1396, 1570


def build(ctx):
    import os, sys, math
    import numpy as np
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import bpy, cz, mega as M, props_r2 as R
    from mathutils import Vector
    R.world(F1, 'winter')
    mt = R.mats(winter=True)
    P = R.cottage(mt, snow=0.5, snow_cut=True)
    R.land(mt, winter=True)
    k = lambda tt, a, b: cz.clamp(((tt * 30 + 1) - a) / (b - a))
    up = Vector((0, R.COSP, R.TANP * R.COSP))                      # up-slope unit vector on the front side
    wd = R.W + 2 * R.OVER + 0.15
    melt_m = M.pbr('r2_melt', '#1f6fb0', rough=0.02, spec=1.0, coat=1.0, emit='#3aa0ff', emit_strength=0.8)
    # 1) the snow melts ("melts" 1407): the snow layer sinks a little
    sn = P['snow'][0]
    M.bake_path(sn, F0, F1, scale=lambda tt: (1, 1, 1 - 0.25 * cz.smooth(k(tt, 1405, 1440))))
    # 2) meltwater runs down under the snow to the cold edge ("runs down" 1424 -> "edge" 1455)
    L = (R.EY - 0.6) / R.COSP
    melt = R.sloped('melt', -1, R.EY - 0.15, 0.45, -0.005, 0.07, wd, melt_m)
    base = Vector(melt.location)
    def mpos(tt):
        kk = cz.smooth(k(tt, 1418, 1458)); return tuple(base + up * (1 - kk) * L)
    M.bake_path(melt, F0, F1, pos=mpos, scale=lambda tt: (1, max(0.001, cz.smooth(k(tt, 1418, 1458))), 1))
    # 3) it freezes into a wall of ice at the eave ("freezes" 1467 -> "ice" 1508)
    def dam_top(U, V):
        n = M.fbm(U * 30, V * 3 + 4, seed=8, octaves=4)
        return 0.5 * np.sin(np.pi * np.clip(V, 0, 1)) ** 0.6 * (0.75 + 0.5 * n) * (0.4 + 0.6 * np.clip(U / 0.02, 0, 1) * np.clip((1 - U) / 0.02, 0, 1))
    dam = R.slab('icedam', wd, 0.9, dam_top, nx=120, ny=12, mat=mt['ice'])
    R.on_slope(dam, -1, R.EY + 0.08, lift=-0.02)
    M.bake_path(dam, F0, F1, scale=lambda tt: (1, 0.4 + 0.6 * cz.smooth(k(tt, 1464, 1505)), 0.02 + 0.98 * cz.smooth(k(tt, 1464, 1505))))
    ic = R.icicles('icic', mt['ice'], -R.W / 2 - R.OVER, R.W / 2 + R.OVER, -(R.EY + 0.12), P['gutter_z'] - 0.08, n=70, lmax=0.6)
    M.bake_path(ic, F0, F1, scale=lambda tt: (1, 1, 0.001 + cz.smooth(k(tt, 1470, 1520))))
    # 4) water pools behind the dam and is pushed back up under the shingles ("pushes water back up" 1518-1562)
    pool = R.sloped('pool', -1, R.EY - 0.75, R.EY - 1.6, 0.0, 0.06, wd, melt_m)
    M.bake_path(pool, F0, F1, scale=lambda tt: (1, 1, 0.01 + cz.smooth(k(tt, 1500, 1520))))
    under = R.slab('underwater', wd, 2.2 / R.COSP, lambda U, V: 0.11 * (1 - V) ** 1.3 + 0.004, nx=2, ny=16, mat=melt_m, smooth=False)
    R.on_slope(under, -1, R.EY - 0.4, lift=-0.13)
    wm = M.pbr('r2_wedge', '#1f6fb0', rough=0.02, spec=1.0, coat=1.0, emit='#3aa0ff', emit_strength=0.8); under.data.materials[0] = wm
    pw = wm.node_tree.nodes['Principled BSDF']
    for f, c, s in ((1528, '#3aa0ff', 0.8), (1538, '#3cff4a', 4.0), (1570, '#3cff4a', 4.0)):
        pw.inputs['Emission Color'].default_value = cz.col(c); pw.inputs['Emission Color'].keyframe_insert('default_value', frame=f)
        pw.inputs['Emission Strength'].default_value = s; pw.inputs['Emission Strength'].keyframe_insert('default_value', frame=f)
    M.bake_path(under, F0, F1, scale=lambda tt: (1, max(0.001, cz.smooth(k(tt, 1518, 1560))), 1))
    # diagram arrows beside the cut face: blue down the slope, red back up under the shingles
    xa = -wd / 2 - 0.25
    for i in range(3):
        a = R.arrow(f'adown{i}', mt['blue'], (0, 0, 0), -up, 0.5, 0.035)
        def ap(tt, i=i):
            kk = k(tt, 1424 + i * 7, 1452 + i * 7); s0 = (R.EY - 0.6) / R.COSP * (1 - kk)
            p = Vector((xa, -(R.EY - 0.4), R.surf_z(R.EY - 0.4) + 0.45)) + up * s0
            return tuple(p)
        M.bake_path(a, F0, F1, pos=ap); M.visible(a, [(R.t(1424 + i * 7), R.t(1456 + i * 7))], F0, F1)
    for i in range(3):
        a = R.arrow(f'aup{i}', mt['red'], (0, 0, 0), up, 0.5, 0.035)
        def ap2(tt, i=i):
            kk = k(tt, 1520 + i * 8, 1550 + i * 8); s0 = 1.9 / R.COSP * kk
            p = Vector((xa, -(R.EY - 0.6), R.surf_z(R.EY - 0.6) - 0.08)) + up * s0
            return tuple(p)
        M.bake_path(a, F0, F1, pos=ap2); M.visible(a, [(R.t(1520 + i * 8), R.t(1556 + i * 8))], F0, F1)
    R.hide([o for o in P['extra'] if o.name.startswith('gicica')])
    R.flight([(1396, (-6.9, -1.6, 4.2), (-4.5, -1.8, 3.95), 30),
              (1450, (-6.8, -2.7, 3.4), (-4.5, -2.8, 3.25), 32),
              (1505, (-6.9, -3.4, 3.05), (-4.5, -3.2, 2.85), 30),
              (1570, (-7.0, -3.1, 3.2), (-4.5, -2.9, 3.0), 30)], F0, F1)
    return F0, F1
