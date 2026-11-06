# R23 "So you lay a blanket of insulation on the attic floor and let cold air flow through above it" 1611-1752
# (attic cutaway: pink batts roll out between the ceiling joists, cold blue air in at the eaves, out at the ridge vent)
F0, F1 = 1611, 1752


def build(ctx):
    import os, sys, math, random
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import bpy, cz, mega as M, props_r2 as R
    R.world(F1, 'winter')
    mt = R.mats(winter=True)
    P = R.cottage(mt, snow=0.4, ties=True, ceiling=True)
    R.land(mt, winter=True)
    k = lambda tt, a, b: cz.clamp(((tt * 30 + 1) - a) / (b - a))
    R.hide([o for o in P['deck'] if o.name.startswith('decka')] + [o for o in P['shingle_rows'] if o.name.startswith('shrowa')] + [o for o in P['extra'] if o.name == 'underlaya'] + [P['snow'][0]])
    # ridge vent cap
    vent = cz.box('ridgevent', (R.W + 0.4, 0.5, 0.08), (0, 0, R.WALL + R.RISE + 0.42), mt['metal'], bevel=0.01, ol=0)
    # batts: one per bay between the joists, rolled out from the front ("lay" 1631 .. "insulation" 1650 .. "floor" 1679)
    y0 = -(R.D / 2 - R.T); Lb = R.D - 2 * R.T
    xs = [o.location.x for o in P['myties']]
    batts = []
    xm = M.xray('r2_x_insul')
    from mathutils import Matrix
    for i in range(8):
        cx = (xs[i] + xs[i + 1]) / 2; bw = xs[i + 1] - xs[i] - 0.1
        b = cz.box(f'batt{i}', (bw, Lb, 0.24), (0, 0, 0), mt['insul'], bevel=0.06, ol=0)
        b.data.transform(Matrix.Translation((0, Lb / 2, 0.12)))          # origin at the front end, on the ceiling
        b.location = (cx, y0, R.WALL + 0.06)
        R.xcopy([b], xm, 1.0)[0].scale = (1.04, 1.0, 1.15)
        fa = 1628 + i * 5
        M.bake_path(b, F0, F1, scale=lambda tt, fa=fa: (1, max(0.001, cz.smooth(k(tt, fa, fa + 26))), 1))
        roll = cz.cyl(f'roll{i}', 0.3, bw, (0, 0, 0), mt['insul'], rot=(0, 90, 0), verts=24, ol=0, origin='center')
        def rp(tt, fa=fa, cx=cx):
            kk = cz.smooth(k(tt, fa, fa + 26)); rr = 0.3 * math.sqrt(max(0.02, 1 - kk))
            return (cx, y0 + Lb * kk, R.WALL + 0.06 + rr)
        M.bake_path(roll, F0, F1, pos=rp, scale=lambda tt, fa=fa: max(0.001, math.sqrt(max(0.0, 1 - cz.smooth(k(tt, fa, fa + 26)))) if (tt * 30 + 1) < fa + 26 else 0.001))
        batts.append(b)
    # green on "insulation" (1650): X-ray twins of the batts (static, full length) fade in as the rolls finish
    R.xfade(xm, 1652, hold=24, off=10)
    # cold air: blue streaks in at both eaves, up under the roof deck, out at the ridge vent ("cold air flow" 1699-1734)
    cold = M.emit('r2_cold', '#1e9cff', 3.5)
    rr = random.Random(7)
    def path(u, s):
        # u 0..1: soffit -> under the deck -> ridge -> out of the vent
        ey = R.EY - 0.1
        if u < 0.85:
            q = u / 0.85; ay = ey * (1 - q)
            return (s * ay, R.surf_z(ay) - 0.42)
        q = (u - 0.85) / 0.15
        return (0.0, R.surf_z(0) - 0.42 + q * 1.2)
    for i in range(70):
        s = -1 if i % 2 else 1
        x = rr.uniform(-R.W / 2 + 0.3, R.W / 2 - 0.3); fa = 1695 + rr.uniform(0, 45); sp = rr.uniform(0.9, 1.3)
        st = cz.box(f'cold{i}', (0.05, 0.75, 0.05), (x, 0, 0), cold, bevel=0, ol=0)
        def cp(tt, x=x, s=s, fa=fa, sp=sp):
            u = max(0.0, ((tt * 30 + 1) - fa) / 30 * 0.42 * sp); u = min(u, 1.0)
            y, z = path(u, s); return (x, y, z)
        def cr(tt, x=x, s=s, fa=fa, sp=sp):
            u = max(0.0, ((tt * 30 + 1) - fa) / 30 * 0.42 * sp); u = min(u, 0.999)
            y0_, z0_ = path(u, s); y1_, z1_ = path(min(1, u + 0.01), s)
            return (math.degrees(math.atan2(z1_ - z0_, y1_ - y0_)), 0, 0)
        M.bake_path(st, F0, F1, pos=cp, rot=cr)
        M.visible(st, [(R.t(fa), R.t(fa + 30 / (0.42 * sp)))], F0, F1)
    R.flight([(1611, (-3.5, -9.5, 7.0), (0.0, 0.0, 2.9), 22),
              (1680, (0.5, -9.0, 6.4), (0.0, 0.0, 3.1), 22),
              (1752, (3.8, -8.6, 5.4), (0.0, 0.0, 3.6), 22)], F0, F1)
    return F0, F1
