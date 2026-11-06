# R07 "So you cover them with small flat pieces" 337-400: a bundle of shingles on a pallet by the house; one by one the
# pieces fly up off the stack and land side by side in the bottom row along the eave of the board deck.
F0, F1 = 337, 400


def build(ctx):
    import bpy, os, sys, math, random
    from mathutils import Vector
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=32, sun_rot=268)
    mt = P.mats()
    P.ground(mt)
    hs = H.build('gable', mt)
    P.dress(hs, mt, 'gable', sunny=True)
    row = P.shingle_row_spec(-1, 0)
    # the pallet + stack
    base = Vector((-2.6, -6.6, 0))
    pal = []
    for k in range(5):
        pal.append(cz.box(f'pal_t{k}', (1.25, 0.16, 0.025), (base.x, base.y - 0.45 + k * 0.225, 0.135), mt['wood_dark'], bevel=0.004, ol=0))
    for k in range(3):
        pal.append(cz.box(f'pal_b{k}', (0.1, 1.05, 0.1), (base.x - 0.55 + k * 0.55, base.y, 0.07), mt['wood_dark'], bevel=0.006, ol=0))
    M.join('pallet', pal)
    sz = row[0][1]
    N = len(row)
    r = random.Random(2)
    stack = []
    for k in range(34):
        z = 0.16 + k * 0.027
        stack.append(cz.box(f'stk{k}', (sz[0] * 1.02, sz[1] * 1.0, 0.025), (base.x + r.uniform(-0.015, 0.015), base.y + r.uniform(-0.02, 0.02), z),
                            mt['shingle'], rot=(0, 0, 90 + r.uniform(-2, 2)), bevel=0.003, ol=0))
    top_z = 0.16 + 33 * 0.027
    # the stack shrinks as pieces leave (top boxes hide as each one launches)
    order = sorted(range(N), key=lambda j: row[j][0][0])          # left to right
    t0, t1 = T(347), T(390)
    fl = 0.5
    for n_, j in enumerate(order):
        loc, size, rot = row[j]
        tl = t0 + (t1 - t0) * n_ / (N - 1); ts = tl - fl
        src = stack[33 - n_] if n_ < 34 else None
        if src: M.visible(src, [(0, ts)], F0, F1)
        sh = cz.box(f'fly{j}', size, (0, 0, -50), mt['shingle'], bevel=0.003, ol=0)
        a = Vector((base.x, base.y, top_z - n_ * 0.027)); b = Vector(loc)
        sp = r.uniform(-1, 1)
        def pos(t, a=a, b=b, ts=ts, tl=tl):
            if t < ts: return tuple(a)
            k = min(1.0, (t - ts) / (tl - ts)); e = 1 - (1 - k) ** 2.2
            p = a.lerp(b, e); p.z += 1.6 * math.sin(math.pi * min(1, e)) * (1 - k * 0.3)
            if t > tl: p.z += 0.03 * math.exp(-(t - tl) * 18) * abs(math.sin((t - tl) * 40))
            return tuple(p)
        def rt(t, rot=rot, ts=ts, tl=tl, sp=sp):
            if t < ts: return (0, 0, 90)
            k = min(1.0, (t - ts) / (tl - ts)); e = 1 - (1 - k) ** 2
            return (rot[0] * e + 360 * sp * (1 - e) * 0.2, 0, 90 * (1 - e) + 25 * sp * math.sin(e * math.pi))
        M.bake_path(sh, F0, F1, pos=pos, rot=rt, scale=lambda t, ts=ts: 1.0 if t >= ts - 0.04 else 0.001)
    P.fly([(T(337), (-5.8, -10.2, 1.3), (-2.4, -6.2, 0.7), 26),
           (T(360), (-5.2, -10.6, 2.0), (-1.8, -5.0, 1.7), 25),
           (T(385), (-2.6, -10.8, 3.2), (0.0, -3.6, 2.5), 25),
           (T(400), (-0.8, -10.4, 3.6), (0.8, -3.4, 2.6), 25)], F0, F1)
    return F0, F1
