# E23 "Over thousands of years ... across Asia" 1061-1205: the globe from space, years counter, the swarm dragging
# the green Everest marker and its dark trail across Asia, Asia glowing red at "across Asia", pull back to the globe.
F0, F1 = 1061, 1205


def build(ctx):
    import bpy, os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, common as C
    import props_c as P
    from mathutils import Vector
    from cz import FPS, smooth, lerp
    t = P.t
    M.setup(F1, sun_elev=30, sun_rot=300, sun_power=5.0, exposure=0.3)
    P.space_world()
    if bpy.data.objects.get('sun_disc'): bpy.data.objects['sun_disc'].hide_render = True
    sun = bpy.data.objects['sun']
    d = (P.ll(18, 62).normalized() + Vector((0, 0, 0.25))).normalized()
    sun.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    P.stars()
    P.globe([(t(1180), 0.0), (t(1190), 1.0)], night_keys=[(t(1064), 0.0), (t(1070), 1.0), (t(1090), 1.0), (t(1097), 0.0)])
    tr, reveal = P.trail('trail')
    tr2, rv2 = P.trail('trail_w', w=1.4, lift=0.08)
    M.visible(tr2, [(t(1186), 99)], F0, F1)
    sw = P.swarm('swarm')
    mk = P.marker('mark')
    anchor = cz.empty('anchor')
    sw.parent = anchor; mk.parent = anchor

    _kk = lambda tt: lerp(0.12, 0.62, smooth((tt - t(1061)) / (t(1205) - t(1061))) * 0.3 + 0.7 * ((tt - t(1061)) / (t(1205) - t(1061))))
    kk = lambda tt: _kk(min(tt, t(1184)))           # the crawl parks when the camera rushes out (no slide in the wide)

    def frame(tt):
        k = kk(tt); la, lo = P.path_pt(k); la2, lo2 = P.path_pt(k + 0.01)
        a, b = P.ll(la, lo), P.ll(la2, lo2); n = a.normalized()
        fwd = (b - a); fwd = (fwd - n * fwd.dot(n)).normalized(); side = fwd.cross(n)
        from mathutils import Matrix
        m = Matrix((side, fwd, n)).transposed().to_4x4(); m.translation = a
        return m

    from mathutils import Matrix as _M2
    for f in range(F0 - 1, F1 + 2):
        tt = (f - 1) / FPS
        m = frame(tt)
        sk = 1 + 1.2 * cz.smooth((tt - t(1188)) / (t(1198) - t(1188)))
        anchor.matrix_world = m @ _M2.Diagonal((sk, sk, sk, 1)); anchor.keyframe_insert('location', frame=f); anchor.keyframe_insert('rotation_euler', frame=f); anchor.keyframe_insert('scale', frame=f)
        reveal.outputs[0].default_value = kk(tt) - 0.004; reveal.outputs[0].keyframe_insert('default_value', frame=f)
        rv2.outputs[0].default_value = kk(tt) - 0.01; rv2.outputs[0].keyframe_insert('default_value', frame=f)
    M._linear(anchor)

    # ---- camera (round 3: M.Flight v2 keys every 3 frames, matched to the reference's measured motion):
    # A 1061-1070 whip out (image turns +3 deg/f), cut; B 1071-1094 night pass, slow push-in, whip in (zoom +7 %/f),
    # cut; C 1095-1107 settles; D 1108-1177 continuous orbit about the marker (image turns +2 -> 0 deg/f), slow
    # pull-out; E 1178-1192 rush out to orbit (zoom -13 %/f); F 1193-1205 slow roll +0.4 deg/f, whip at the end.
    import math as _m
    SG = 1.0                                      # orbit sign -> image rotation sign (checked on the curve)
    def orbit_deg(f):
        if f <= 1070: return 80 + SG * 40 * max(0, (f - 1061) / 9) ** 2.5
        if f <= 1094: return 150 + SG * (0.15 * (f - 1071) + 25 * max(0, (f - 1091) / 3) ** 2.2)
        if f <= 1107: return -80 - SG * 14 * (1 - min(1, (f - 1095) / 6)) ** 2
        s = 0;
        for g in range(1108, min(f, 1178)): s += 4.0 * _m.exp(-(g - 1108) / 20)
        return -80 + SG * s
    def dist(f):
        if f <= 1070: return 0.75 * (1 + 0.6 * max(0, (f - 1061) / 9) ** 2)
        if f <= 1094: return 1.0 * (0.997 ** (f - 1071)) * (1 - 0.6 * max(0, (f - 1091) / 3) ** 2)
        if f <= 1107: return 0.62 * (1 + 0.25 * (1 - min(1, (f - 1095) / 6)) ** 2)
        return 0.62 * (1.002 ** (min(f, 1178) - 1108))
    def local_cam(f):
        a = _m.radians(orbit_deg(f)); d = dist(f)
        ca, sa = _m.cos(a), _m.sin(a)
        e = Vector((0.6, -8.5, 4.8)) * 3.2 * d; tg = Vector((0, 0.6, 0)) * 3.2 * d
        b = 0.55 * cz.smooth((min(f, 1184) - 1140) / 44.0)          # the reference tilts down 1140-1181 (pan y +0.3..1 %/f)
        e = e.normalized().lerp(Vector((0, -0.25, 1)).normalized(), b).normalized() * e.length; tg = tg * (1 - b)
        rot = lambda v: Vector((v.x * ca - v.y * sa, v.x * sa + v.y * ca, v.z))
        return rot(e), rot(tg)
    G_C = Vector((0, 0, 0))
    def wide_cam(f):
        # orbit framing of the globe; slow roll; the last frames whip (pan + roll + zoom in)
        u = (f - 1192) / 13.0
        ang = 100 + 4 * u + 10 * max(0, (f - 1202) / 3) ** 2.5
        e = P.ll(32, ang, 390 - 40 * u - 40 * max(0, (f - 1202) / 3) ** 2.5); tg = P.ll(40, ang - 2, 0)
        return e, tg, 0.4 * (f - 1192) + 8 * max(0, (f - 1202) / 3) ** 2.5
    keys, ups = [], {}
    for f in list(range(F0 - 2, F1 + 3, 3)) + [1070, 1071, 1094, 1095, 1184]:
        tt = t(f); m = frame(t(min(f, 1184))); n = m.col[2].xyz.normalized()
        le, lt = local_cam(f)
        eye, tgt = m @ le, m @ lt
        roll = 0.0; up = n
        if f > 1184:
            # pure dolly back along the view ray (the reference only zooms out here, no pan), then a slow roll + push
            u = min(1.0, (f - 1184) / 12.0); k = 1 - (1 - u) ** 3; s = 11.0 ** k
            w = 0.0
            dv = Vector(eye) - Vector(tgt); dv = dv.normalized().lerp(n, 0.0 * k).normalized() * dv.length
            eye = Vector(tgt) + dv * s * (1 - 0.15 * w)
            roll = 0.25 * max(0, f - 1190) + 4 * w
            eye = eye + Vector((0, 0, 1)).cross(Vector(eye)).normalized() * 25 * w
        keys.append((tt, tuple(eye), tuple(tgt), 30, roll, f == 1184)); ups[round(tt * FPS)] = up
    keys = sorted({k[0]: k for k in keys}.values())
    def upf(tt):
        f = tt * FPS + 1; n = frame(min(tt, t(1184))).col[2].xyz.normalized()
        if f <= 1184: return n
        m2 = frame(t(1184)); return n.lerp(m2.col[1].xyz.normalized(), 0.6 * cz.smooth((f - 1184) / 12.0)).normalized()
    fl = M.Flight(keys, lens=30, up=upf, cuts=[t(1070.5), t(1094.5)], clip=(0.02, 6000))
    fl.bake(F0, F1)
    cam = fl.obj
    P.counter(cam, [(t(1061), 1281), (t(1073), 1585), (t(1085), 1879), (t(1100), 2026)], F0, F1, [(t(1061), t(1104))])
    # (calm camera, 2026-10-27: no transition cards - plain cut into E24)
    if False: P.fade_card(cam, C.T('earth_day.png'), [(t(1196), 0.0), (t(1205), 0.55)], F0, F1)
    return F0, F1
